/**
 * Backfill Reserved List flag from Scryfall
 *
 * Fetches all cards with `is:reserved` from Scryfall,
 * matches them by external_id (Scryfall ID), and sets reserved = true.
 *
 * The Reserved List is ~572 unique cards, but multiple printings exist.
 * Scryfall returns all printings, so we match by card name across all printings.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const SCRYFALL_API = "https://api.scryfall.com";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log("Backfilling Reserved List from Scryfall...\n");

  // Fetch all reserved cards from Scryfall (paginated)
  const reservedIds = new Set<string>();
  const reservedNames = new Set<string>();
  let nextUrl: string | null = `${SCRYFALL_API}/cards/search?q=is%3Areserved&unique=prints`;
  let page = 1;

  while (nextUrl) {
    console.log(`  Fetching page ${page}...`);
    const res = await fetch(nextUrl, {
      headers: {
        "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`Scryfall error: ${res.status} ${res.statusText}`);
      break;
    }

    const data = await res.json();
    for (const card of data.data) {
      reservedIds.add(card.id);
      reservedNames.add(card.name);
    }

    nextUrl = data.has_more ? data.next_page : null;
    page++;
    // Respect rate limit
    await new Promise((r) => setTimeout(r, 110));
  }

  console.log(`\nFound ${reservedIds.size} reserved printings (${reservedNames.size} unique card names)`);

  // Update by external_id (Scryfall ID) — exact match
  const idArray = Array.from(reservedIds);
  let totalUpdated = 0;

  // Batch updates in groups of 100
  for (let i = 0; i < idArray.length; i += 100) {
    const batch = idArray.slice(i, i + 100);
    const result = await sql`
      UPDATE collectibles
      SET reserved = true, updated_at = NOW()
      WHERE game = 'mtg'
        AND external_id = ANY(${batch})
        AND reserved = false
    `;
    // neon() tagged template returns { rowCount } on UPDATE
    const updated = (result as any).length ?? (result as any).rowCount ?? 0;
    totalUpdated += typeof updated === 'number' ? updated : 0;
  }

  // Verify
  const reservedCount = await sql`SELECT COUNT(*) as total FROM collectibles WHERE reserved = true`;
  console.log(`\nBackfill complete!`);
  console.log(`Cards marked as reserved: ${reservedCount[0].total}`);

  // Sample check: Black Lotus should be reserved
  const lotus = await sql`
    SELECT name, reserved, treatment, foil
    FROM collectibles
    WHERE game = 'mtg' AND name ILIKE '%Black Lotus%'
    LIMIT 5
  `;
  console.log("\nBlack Lotus check:");
  for (const card of lotus) {
    console.log(`  ${card.name} — reserved: ${card.reserved}, treatment: ${card.treatment}`);
  }

  // Sample check: Lightning Bolt should NOT be reserved
  const bolt = await sql`
    SELECT name, reserved
    FROM collectibles
    WHERE game = 'mtg' AND name = 'Lightning Bolt'
    LIMIT 3
  `;
  console.log("\nLightning Bolt check (should be false):");
  for (const card of bolt) {
    console.log(`  ${card.name} — reserved: ${card.reserved}`);
  }
}

main().catch(console.error);
