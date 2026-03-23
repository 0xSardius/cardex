/**
 * Tests for Format Legality feature
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

  console.log("=== Format Legality Tests ===\n");

  // Test 1: Column exists
  console.log("Schema:");
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'collectibles' AND column_name = 'legalities'
  `;
  assert(cols.length === 1, "legalities column exists");
  assert(cols[0].data_type === "jsonb", "legalities column is JSONB");

  // Test 2: Coverage — most MTG cards should have legalities
  console.log("\nData coverage:");
  const totalMtg = await sql`SELECT COUNT(*) as total FROM collectibles WHERE game = 'mtg'`;
  const withLegalities = await sql`SELECT COUNT(*) as total FROM collectibles WHERE game = 'mtg' AND legalities IS NOT NULL`;
  const coverage = parseInt(withLegalities[0].total) / parseInt(totalMtg[0].total);
  assert(coverage > 0.9, `coverage > 90% (got ${(coverage * 100).toFixed(1)}% — ${withLegalities[0].total}/${totalMtg[0].total})`);

  // Test 3: Lightning Bolt — legal in modern, legacy, vintage, commander; NOT standard
  console.log("\nLightning Bolt:");
  const bolt = await sql`
    SELECT name, legalities FROM collectibles
    WHERE game = 'mtg' AND name = 'Lightning Bolt' AND legalities IS NOT NULL
    LIMIT 1
  `;
  assert(bolt.length > 0, "found Lightning Bolt with legalities");
  if (bolt.length > 0) {
    const leg = bolt[0].legalities as any;
    assert(leg.modern === "legal", "modern: legal");
    assert(leg.legacy === "legal", "legacy: legal");
    assert(leg.vintage === "legal", "vintage: legal");
    assert(leg.commander === "legal", "commander: legal");
    assert(leg.standard === "not_legal", "standard: not_legal");
  }

  // Test 4: Black Lotus — restricted in vintage, banned in legacy, not legal in modern
  console.log("\nBlack Lotus:");
  const lotus = await sql`
    SELECT name, legalities FROM collectibles
    WHERE game = 'mtg' AND name = 'Black Lotus' AND legalities IS NOT NULL
    LIMIT 1
  `;
  assert(lotus.length > 0, "found Black Lotus with legalities");
  if (lotus.length > 0) {
    const leg = lotus[0].legalities as any;
    assert(leg.vintage === "restricted", "vintage: restricted");
    assert(leg.legacy === "banned", "legacy: banned");
    assert(leg.modern === "not_legal", "modern: not_legal");
    assert(leg.standard === "not_legal", "standard: not_legal");
  }

  // Test 5: A recent Standard-legal card (check for something from recent sets)
  console.log("\nRecent Standard card:");
  const standardCards = await sql`
    SELECT name, legalities FROM collectibles
    WHERE game = 'mtg'
      AND legalities IS NOT NULL
      AND legalities->>'standard' = 'legal'
    LIMIT 3
  `;
  assert(standardCards.length > 0, `found Standard-legal cards (got ${standardCards.length})`);
  if (standardCards.length > 0) {
    console.log(`    Sample: ${standardCards[0].name}`);
  }

  // Test 6: Legalities object has expected keys
  console.log("\nStructure validation:");
  const sample = await sql`
    SELECT legalities FROM collectibles
    WHERE game = 'mtg' AND legalities IS NOT NULL
    LIMIT 1
  `;
  if (sample.length > 0) {
    const keys = Object.keys(sample[0].legalities as any);
    assert(keys.includes("standard"), "has standard key");
    assert(keys.includes("modern"), "has modern key");
    assert(keys.includes("legacy"), "has legacy key");
    assert(keys.includes("vintage"), "has vintage key");
    assert(keys.includes("commander"), "has commander key");
    assert(keys.includes("pioneer"), "has pioneer key");
    assert(keys.includes("pauper"), "has pauper key");
  }

  // Test 7: No Pokemon cards have legalities
  console.log("\nCross-game isolation:");
  const pokemonLeg = await sql`
    SELECT COUNT(*) as total FROM collectibles WHERE game = 'pokemon' AND legalities IS NOT NULL
  `;
  assert(parseInt(pokemonLeg[0].total) === 0, "no Pokemon cards have legalities");

  // Test 8: JSONB query works (can filter by format)
  console.log("\nJSONB query capability:");
  const modernLegal = await sql`
    SELECT COUNT(*) as total FROM collectibles
    WHERE game = 'mtg' AND legalities->>'modern' = 'legal'
  `;
  const modernCount = parseInt(modernLegal[0].total);
  assert(modernCount > 1000, `Modern-legal cards > 1000 (got ${modernCount})`);

  const vintageBanned = await sql`
    SELECT COUNT(*) as total FROM collectibles
    WHERE game = 'mtg' AND legalities->>'vintage' = 'banned'
  `;
  const bannedCount = parseInt(vintageBanned[0].total);
  assert(bannedCount > 0, `Vintage-banned cards exist (got ${bannedCount})`);

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
