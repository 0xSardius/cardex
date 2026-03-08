/**
 * Seed script: Fetches all Pokemon TCG sets and cards from pokemontcg.io
 * and inserts them into Neon DB via Drizzle.
 *
 * Usage: npm run db:seed
 * Requires: DATABASE_URL env var (or .env file)
 */

import "dotenv/config";
import https from "node:https";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sets, collectibles } from "./schema";
import { eq, and } from "drizzle-orm";

const POKEMON_TCG_API = "https://api.pokemontcg.io/v2";
const GAME = "pokemon";
const BATCH_SIZE = 250; // pokemontcg.io max page size

interface PokemonSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images: { symbol: string; logo: string };
}

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  set: { id: string };
  rarity?: string;
  supertype: string;
  images: { small: string; large: string };
  tcgplayer?: { url: string; updatedAt: string; prices?: Record<string, unknown> };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Set it in .env or environment.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding Pokemon TCG data from pokemontcg.io...\n");

  // --- Step 1: Seed Sets ---
  console.log("Fetching sets...");
  const setsRes = await fetchWithRetry(`${POKEMON_TCG_API}/sets?orderBy=releaseDate&pageSize=250`);
  if (setsRes.status !== 200) throw new Error(`Sets fetch failed: ${setsRes.status}`);
  const setsData = JSON.parse(setsRes.body) as { data: PokemonSet[] };
  console.log(`Found ${setsData.data.length} sets`);

  const setMap = new Map<string, string>(); // pokemontcg.io set id -> our DB uuid

  for (const s of setsData.data) {
    const era = classifyEra(s.series);
    const [inserted] = await db
      .insert(sets)
      .values({
        game: GAME,
        name: s.name,
        code: s.id,
        series: s.series,
        era,
        totalCards: s.total,
        releaseDate: s.releaseDate,
        logoUrl: s.images.logo,
        externalId: s.id,
      })
      .onConflictDoUpdate({
        target: [sets.game, sets.code],
        set: {
          name: s.name,
          totalCards: s.total,
          logoUrl: s.images.logo,
        },
      })
      .returning({ id: sets.id });

    setMap.set(s.id, inserted.id);
  }
  console.log(`Upserted ${setMap.size} sets\n`);

  // --- Step 2: Seed Cards (paginated) ---
  console.log("Fetching cards (this takes a few minutes)...");
  let page = 1;
  let totalCards = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${POKEMON_TCG_API}/cards?pageSize=${BATCH_SIZE}&page=${page}&orderBy=set.releaseDate`;
    console.log(`  Page ${page}...`);

    const cardsRes = await fetchWithRetry(url);
    if (cardsRes.status === 429) {
      console.log("  Rate limited, waiting 5s...");
      await sleep(5000);
      continue;
    }
    if (cardsRes.status !== 200) throw new Error(`Cards fetch failed: ${cardsRes.status}`);

    const cardsData = JSON.parse(cardsRes.body) as { data: PokemonCard[]; totalCount: number };
    const cards = cardsData.data;

    if (cards.length === 0) {
      hasMore = false;
      break;
    }

    for (const c of cards) {
      const setDbId = setMap.get(c.set.id);
      if (!setDbId) continue;

      const rarity = c.rarity?.toLowerCase().replace(/\s+/g, "_") ?? null;
      const supertype = c.supertype?.toLowerCase() ?? null;

      await db
        .insert(collectibles)
        .values({
          game: GAME,
          name: c.name,
          setId: setDbId,
          setNumber: c.number,
          rarity,
          cardType: supertype,
          language: "en",
          imageUrl: c.images.large || c.images.small,
          externalId: c.id,
          tcgplayerId: c.tcgplayer?.url
            ? extractTcgplayerId(c.tcgplayer.url)
            : null,
        })
        .onConflictDoUpdate({
          target: [collectibles.game, collectibles.externalId],
          set: {
            name: c.name,
            rarity,
            imageUrl: c.images.large || c.images.small,
            updatedAt: new Date(),
          },
        });
    }

    totalCards += cards.length;
    console.log(`  ${totalCards} / ${cardsData.totalCount} cards`);

    hasMore = cards.length === BATCH_SIZE;
    page++;

    // Be polite to the free API
    await sleep(500);
  }

  console.log(`\nDone! Seeded ${setMap.size} sets and ${totalCards} cards.`);
}

function classifyEra(series: string): string {
  const s = series.toLowerCase();
  if (s.includes("base") || s.includes("gym") || s.includes("neo") || s.includes("legendary") || s.includes("e-card")) return "wotc";
  if (s.includes("ex") || s.includes("pop")) return "ex";
  if (s.includes("diamond") || s.includes("platinum")) return "dp";
  if (s.includes("black") || s.includes("white")) return "bw";
  if (s.includes("xy") || s.includes("kalos")) return "xy";
  if (s.includes("sun") || s.includes("moon")) return "sm";
  if (s.includes("sword") || s.includes("shield")) return "swsh";
  if (s.includes("scarlet") || s.includes("violet") || s.includes("paldea")) return "sv";
  return "other";
}

function extractTcgplayerId(url: string): string | null {
  // TCGPlayer URLs: https://prices.pokemontcg.io/tcgplayer/base1-4
  const match = url.match(/tcgplayer\/(.+)$/);
  return match ? match[1] : null;
}

function httpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "CardEx/0.1" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fetchWithRetry(url: string, retries = 3): Promise<{ status: number; body: string }> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await httpsGet(url);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  Fetch failed, retrying (${i + 1}/${retries})...`);
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
