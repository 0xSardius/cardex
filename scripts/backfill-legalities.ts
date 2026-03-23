/**
 * Backfill format legalities from Scryfall
 *
 * Paginates through all MTG paper cards on Scryfall,
 * matches by external_id, and updates the legalities JSONB column.
 *
 * ~93K cards, ~530 pages. Takes ~5 minutes.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const SCRYFALL_API = "https://api.scryfall.com";
const BATCH_SIZE = 50;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const startPage = parseInt(process.argv[2] ?? "1");
  const sql = neon(process.env.DATABASE_URL);

  console.log("Backfilling format legalities from Scryfall...\n");

  // Build lookup map
  console.log("Fetching card IDs from DB...");
  const cards = await sql`
    SELECT id, external_id FROM collectibles WHERE game = 'mtg' AND external_id IS NOT NULL
  `;
  const idMap = new Map<string, string>();
  for (const c of cards) {
    idMap.set(c.external_id, c.id);
  }
  console.log(`Found ${idMap.size} MTG cards in DB\n`);

  let nextUrl: string | null = `${SCRYFALL_API}/cards/search?q=game%3Apaper&unique=prints&order=set&page=${startPage}`;
  let totalUpdated = 0;
  let pageNum = startPage;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: {
        "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.log("  Rate limited, waiting 2s...");
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      console.error(`Scryfall error: ${res.status}`);
      break;
    }

    const data = await res.json();
    const updates: { id: string; legalities: any }[] = [];

    for (const card of data.data) {
      const dbId = idMap.get(card.id);
      if (!dbId || !card.legalities) continue;
      updates.push({ id: dbId, legalities: card.legalities });
    }

    // Batch update
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const promises = batch.map((u) =>
        sql`UPDATE collectibles SET legalities = ${JSON.stringify(u.legalities)}::jsonb, updated_at = NOW() WHERE id = ${u.id}::uuid`
      );
      await Promise.all(promises);
      totalUpdated += batch.length;
    }

    if (pageNum % 25 === 0 || pageNum <= 3) {
      console.log(`  Page ${pageNum}: ${totalUpdated} cards updated`);
    }

    nextUrl = data.has_more ? data.next_page : null;
    pageNum++;
    await new Promise((r) => setTimeout(r, 110));
  }

  console.log(`\nDone! Updated legalities for ${totalUpdated} cards.`);

  // Verify
  const withLegalities = await sql`SELECT COUNT(*) as total FROM collectibles WHERE legalities IS NOT NULL`;
  console.log(`Cards with legalities: ${withLegalities[0].total}`);

  // Sample
  const sample = await sql`
    SELECT name, legalities FROM collectibles
    WHERE game = 'mtg' AND name = 'Lightning Bolt' AND legalities IS NOT NULL
    LIMIT 1
  `;
  if (sample.length > 0) {
    console.log(`\nSample — ${sample[0].name}:`);
    console.log(JSON.stringify(sample[0].legalities, null, 2));
  }
}

main().catch(console.error);
