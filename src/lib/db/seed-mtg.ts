/**
 * MTG Seed: Fetches all Magic: The Gathering sets and cards from Scryfall
 * and inserts them into Neon DB via Drizzle.
 *
 * Usage: npx tsx src/lib/db/seed-mtg.ts
 * Requires: DATABASE_URL env var
 *
 * Scryfall rate limit: 10 req/sec (we use 100ms delay)
 * Expected: ~700+ sets, ~86K default printings
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sets, collectibles } from "./schema";

const SCRYFALL_API = "https://api.scryfall.com";
const GAME = "mtg";
const CARD_BATCH_SIZE = 50; // DB insert batch size

interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  parent_set_code?: string;
  icon_svg_uri: string;
  block?: string;
}

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  rarity: string;
  type_line?: string;
  lang: string;
  image_uris?: { normal?: string; large?: string; small?: string };
  card_faces?: Array<{ image_uris?: { normal?: string; large?: string } }>;
  finishes: string[];
  frame_effects?: string[];
  border_color: string;
  full_art: boolean;
  textless: boolean;
  promo: boolean;
  tcgplayer_id?: number;
  layout: string;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding MTG data from Scryfall...\n");

  // --- Step 1: Seed Sets ---
  console.log("Fetching sets...");
  const setsRes = await fetchJson(`${SCRYFALL_API}/sets`);
  const allSets: ScryfallSet[] = setsRes.data;
  console.log(`Found ${allSets.length} sets`);

  const setMap = new Map<string, string>(); // scryfall set code -> our DB uuid

  for (const s of allSets) {
    const era = classifyMtgEra(s.released_at, s.set_type);
    const [inserted] = await db
      .insert(sets)
      .values({
        game: GAME,
        name: s.name,
        code: s.code,
        series: s.block ?? s.set_type,
        era,
        totalCards: s.card_count,
        releaseDate: s.released_at ?? null,
        logoUrl: s.icon_svg_uri,
        externalId: s.id,
      })
      .onConflictDoUpdate({
        target: [sets.game, sets.code],
        set: {
          name: s.name,
          totalCards: s.card_count,
          logoUrl: s.icon_svg_uri,
        },
      })
      .returning({ id: sets.id });

    setMap.set(s.code, inserted.id);
  }
  console.log(`Upserted ${setMap.size} sets\n`);

  // --- Step 2: Seed Cards (paginated search) ---
  console.log("Fetching cards (this will take several minutes)...");

  let nextUrl: string | null =
    `${SCRYFALL_API}/cards/search?q=game%3Apaper&unique=prints&order=set&page=1`;
  let totalCards = 0;
  let pageNum = 1;
  let batch: Array<typeof collectibles.$inferInsert> = [];

  while (nextUrl) {
    console.log(`  Page ${pageNum}...`);
    const pageData = await fetchJson(nextUrl);
    const cards: ScryfallCard[] = pageData.data;

    for (const c of cards) {
      // Skip non-English cards (bulk default-cards are English only, but just in case)
      if (c.lang !== "en") continue;

      const setDbId = setMap.get(c.set);
      if (!setDbId) continue;

      const imageUrl = c.image_uris?.large
        ?? c.image_uris?.normal
        ?? c.card_faces?.[0]?.image_uris?.large
        ?? c.card_faces?.[0]?.image_uris?.normal
        ?? null;

      const treatment = classifyTreatment(c);

      batch.push({
        game: GAME,
        name: c.name,
        setId: setDbId,
        setNumber: c.collector_number,
        rarity: c.rarity,
        cardType: c.type_line?.split("—")[0]?.trim().toLowerCase() ?? null,
        language: "en",
        imageUrl: imageUrl,
        treatment,
        foil: c.finishes.includes("foil") && !c.finishes.includes("nonfoil"),
        externalId: c.id,
        tcgplayerId: c.tcgplayer_id?.toString() ?? null,
      });

      if (batch.length >= CARD_BATCH_SIZE) {
        await flushBatch(db, batch);
        batch = [];
      }
    }

    totalCards += cards.length;
    console.log(`  ${totalCards} cards so far`);

    nextUrl = pageData.has_more ? pageData.next_page : null;
    pageNum++;

    // Respect Scryfall rate limit (10 req/sec)
    await sleep(100);
  }

  // Flush remaining
  if (batch.length > 0) {
    await flushBatch(db, batch);
  }

  console.log(`\nDone! Seeded ${setMap.size} sets and ${totalCards} MTG cards.`);
}

async function flushBatch(db: ReturnType<typeof drizzle>, batch: Array<typeof collectibles.$inferInsert>) {
  for (const row of batch) {
    await db
      .insert(collectibles)
      .values(row)
      .onConflictDoUpdate({
        target: [collectibles.game, collectibles.externalId],
        set: {
          name: row.name,
          rarity: row.rarity,
          imageUrl: row.imageUrl,
          treatment: row.treatment,
          foil: row.foil,
          updatedAt: new Date(),
        },
      });
  }
}

function classifyTreatment(card: ScryfallCard): string {
  if (card.textless) return "textless";
  if (card.full_art) return "full_art";
  if (card.border_color === "borderless") return "borderless";
  if (card.frame_effects?.includes("showcase")) return "showcase";
  if (card.frame_effects?.includes("extendedart")) return "extended_art";
  if (card.frame_effects?.includes("etched")) return "etched";
  if (card.promo) return "promo";
  return "regular";
}

function classifyMtgEra(releasedAt?: string, setType?: string): string {
  if (!releasedAt) return "other";
  const year = parseInt(releasedAt.slice(0, 4));
  if (year <= 1994) return "early";       // Alpha through Revised
  if (year <= 1997) return "classic";     // Ice Age through Tempest
  if (year <= 2002) return "invasion";    // Masques through Onslaught
  if (year <= 2007) return "modern_early"; // Mirrodin through Lorwyn
  if (year <= 2013) return "modern_mid";   // Shards through Theros
  if (year <= 2017) return "modern_late";  // Khans through Ixalan
  if (year <= 2021) return "recent";       // Dominaria through MID
  return "current";                        // VOW onward
}

async function fetchJson(url: string): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
          "Accept": "application/json",
        },
      });
      if (!res.ok) {
        if (res.status === 429) {
          console.log("  Rate limited, waiting 2s...");
          await sleep(2000);
          continue;
        }
        throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (i === 2) throw err;
      console.log(`  Fetch failed, retrying (${i + 1}/3)...`);
      await sleep(1000 * (i + 1));
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
