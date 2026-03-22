/**
 * Tests for Reserved List feature
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("=== Reserved List Tests ===\n");

  // Test 1: Column exists
  console.log("Schema:");
  const cols = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'collectibles' AND column_name = 'reserved'
  `;
  assert(cols.length === 1, "reserved column exists");
  assert(cols[0].data_type === "boolean", "reserved column is boolean");
  assert(cols[0].column_default === "false", "reserved column defaults to false");

  // Test 2: Partial index exists
  const indexes = await sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'collectibles' AND indexname = 'collectibles_reserved_idx'
  `;
  assert(indexes.length === 1, "partial index on reserved exists");

  // Test 3: Reserved count is reasonable (571 unique cards, should be 700-1500 printings)
  console.log("\nData integrity:");
  const reservedCount = await sql`SELECT COUNT(*) as total FROM collectibles WHERE reserved = true`;
  const count = parseInt(reservedCount[0].total);
  assert(count > 500, `reserved count > 500 (got ${count})`);
  assert(count < 2000, `reserved count < 2000 (got ${count})`);

  // Test 4: Known Reserved List cards
  console.log("\nKnown reserved cards:");
  const knownReserved = ["Black Lotus", "Ancestral Recall", "Time Walk", "Underground Sea", "Volcanic Island", "Tundra"];
  for (const name of knownReserved) {
    const result = await sql`
      SELECT name, reserved FROM collectibles
      WHERE game = 'mtg' AND name = ${name} AND reserved = true
      LIMIT 1
    `;
    assert(result.length > 0, `${name} is reserved`);
  }

  // Test 5: Known NON-reserved cards
  console.log("\nKnown non-reserved cards:");
  const knownNotReserved = ["Lightning Bolt", "Counterspell", "Llanowar Elves", "Swords to Plowshares"];
  for (const name of knownNotReserved) {
    const result = await sql`
      SELECT name, reserved FROM collectibles
      WHERE game = 'mtg' AND name = ${name}
      LIMIT 1
    `;
    assert(result.length > 0 && result[0].reserved === false, `${name} is NOT reserved`);
  }

  // Test 6: No Pokemon cards are reserved
  console.log("\nCross-game isolation:");
  const pokemonReserved = await sql`
    SELECT COUNT(*) as total FROM collectibles WHERE game = 'pokemon' AND reserved = true
  `;
  assert(parseInt(pokemonReserved[0].total) === 0, "no Pokemon cards are reserved");

  // Test 7: All non-MTG cards default to false
  const nonMtgReserved = await sql`
    SELECT COUNT(*) as total FROM collectibles WHERE game != 'mtg' AND reserved = true
  `;
  assert(parseInt(nonMtgReserved[0].total) === 0, "no non-MTG cards are reserved");

  // Test 8: Reserved cards with prices (useful data)
  console.log("\nReserved + pricing:");
  const reservedWithPrices = await sql`
    SELECT COUNT(DISTINCT c.id) as total
    FROM collectibles c
    JOIN price_points pp ON pp.collectible_id = c.id
    WHERE c.reserved = true
  `;
  const withPrices = parseInt(reservedWithPrices[0].total);
  assert(withPrices > 200, `reserved cards with prices > 200 (got ${withPrices})`);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
