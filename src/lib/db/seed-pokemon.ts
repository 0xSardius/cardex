/**
 * Pokemon TCG Seed: Fetches card data from GitHub bulk data
 * (bypasses pokemontcg.io API which is blocked from this env)
 *
 * Source: https://github.com/PokemonTCG/pokemon-tcg-data
 * This is the same data that powers pokemontcg.io
 *
 * Usage: npx tsx src/lib/db/seed-pokemon.ts
 * Requires: DATABASE_URL env var
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { sets, collectibles } from "./schema";

const GITHUB_BASE =
  "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master";
const GAME = "pokemon";

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  supertype: string;
  rarity?: string;
  images: { small: string; large: string };
  tcgplayer?: { url: string };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding Pokemon TCG cards from GitHub bulk data...\n");

  // Step 1: Get all Pokemon sets already in our DB
  const dbSets = await db
    .select({ id: sets.id, code: sets.code })
    .from(sets)
    .where(eq(sets.game, GAME));

  if (dbSets.length === 0) {
    console.error("No Pokemon sets in DB. Run db:seed first to seed sets.");
    process.exit(1);
  }
  console.log(`Found ${dbSets.length} Pokemon sets in DB\n`);

  const setMap = new Map<string, string>();
  for (const s of dbSets) {
    setMap.set(s.code, s.id);
  }

  // Step 2: Get list of available set files from GitHub
  console.log("Fetching set file list from GitHub...");
  const setFilesRes = await fetchJson(
    "https://api.github.com/repos/PokemonTCG/pokemon-tcg-data/contents/cards/en"
  );
  const setFiles: Array<{ name: string }> = setFilesRes;
  console.log(`Found ${setFiles.length} set files\n`);

  // Step 3: Fetch and seed cards for each set
  let totalCards = 0;
  let totalInserted = 0;
  let setsProcessed = 0;

  for (const file of setFiles) {
    const setCode = file.name.replace(".json", "");
    const dbSetId = setMap.get(setCode);

    if (!dbSetId) {
      // Set might not be in DB if naming differs
      continue;
    }

    console.log(`  ${setCode}...`);

    let cards: PokemonCard[];
    try {
      cards = await fetchJson(`${GITHUB_BASE}/cards/en/${file.name}`);
    } catch (err: any) {
      console.log(`    SKIP — fetch failed: ${err.message?.slice(0, 60)}`);
      continue;
    }

    // Insert cards in small batches to avoid Neon timeout
    for (let i = 0; i < cards.length; i += 10) {
      const batch = cards.slice(i, i + 10);

      for (const c of batch) {
        try {
          const rarity = c.rarity?.toLowerCase().replace(/\s+/g, "_") ?? null;
          const supertype = c.supertype?.toLowerCase() ?? null;

          await db
            .insert(collectibles)
            .values({
              game: GAME,
              name: c.name,
              setId: dbSetId,
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

          totalInserted++;
        } catch (err: any) {
          if (err.message?.includes("fetch failed")) {
            // Neon connection dropped — wait and retry
            console.log(`    Connection dropped at card ${totalInserted}, waiting 3s...`);
            await sleep(3000);
            // Retry this card
            try {
              const rarity = c.rarity?.toLowerCase().replace(/\s+/g, "_") ?? null;
              await db
                .insert(collectibles)
                .values({
                  game: GAME,
                  name: c.name,
                  setId: dbSetId,
                  setNumber: c.number,
                  rarity,
                  cardType: c.supertype?.toLowerCase() ?? null,
                  language: "en",
                  imageUrl: c.images.large || c.images.small,
                  externalId: c.id,
                })
                .onConflictDoUpdate({
                  target: [collectibles.game, collectibles.externalId],
                  set: { name: c.name, rarity, updatedAt: new Date() },
                });
              totalInserted++;
            } catch {
              console.log(`    SKIP card ${c.id} after retry`);
            }
          } else {
            console.log(`    Error on ${c.id}: ${err.message?.slice(0, 80)}`);
          }
        }
      }

      // Small delay between batches to avoid Neon HTTP saturation
      if (i + 10 < cards.length) {
        await sleep(50);
      }
    }

    totalCards += cards.length;
    setsProcessed++;

    if (setsProcessed % 10 === 0) {
      console.log(`  ... ${setsProcessed}/${setFiles.length} sets, ${totalInserted} cards inserted`);
    }

    // Rate limit GitHub (60 req/hr unauthenticated)
    await sleep(700);
  }

  console.log(`\nDone! Processed ${setsProcessed} sets, ${totalCards} total cards, ${totalInserted} inserted.`);
}

function extractTcgplayerId(url: string): string | null {
  const match = url.match(/tcgplayer\/(.+)$/);
  return match ? match[1] : null;
}

async function fetchJson(url: string): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          console.log(`    Rate limited (${res.status}), waiting 60s...`);
          await sleep(60000);
          continue;
        }
        throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (i === 2) throw err;
      console.log(`    Fetch failed, retrying (${i + 1}/3)...`);
      await sleep(2000 * (i + 1));
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Pokemon seed failed:", err);
  process.exit(1);
});
