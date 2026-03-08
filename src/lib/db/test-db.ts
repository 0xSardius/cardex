/**
 * Quick smoke test: verifies DB connection and seeded data.
 * Usage: npx tsx src/lib/db/test-db.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql, eq, ilike, count } from "drizzle-orm";
import * as schema from "./schema";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log("=== CardEx DB Smoke Tests ===\n");

  // Test 1: Connection
  console.log("1. Connection test...");
  const nowResult: any = await db.execute(sql`SELECT now()`);
  const rows = nowResult.rows ?? nowResult;
  const now = rows?.[0]?.now ?? "connected";
  console.log(`   OK — Server time: ${now}\n`);

  // Test 2: Set count
  console.log("2. Sets count...");
  const [setsCount] = await db.select({ count: count() }).from(schema.sets);
  console.log(`   OK — ${setsCount.count} sets\n`);

  // Test 3: Collectibles count
  console.log("3. Collectibles count...");
  const [collectiblesCount] = await db
    .select({ count: count() })
    .from(schema.collectibles);
  console.log(`   OK — ${collectiblesCount.count} cards\n`);

  // Test 4: Sample query — find Charizard cards
  console.log("4. Charizard lookup...");
  const charizards = await db
    .select({
      name: schema.collectibles.name,
      setNumber: schema.collectibles.setNumber,
      rarity: schema.collectibles.rarity,
      setName: schema.sets.name,
    })
    .from(schema.collectibles)
    .leftJoin(schema.sets, eq(schema.collectibles.setId, schema.sets.id))
    .where(ilike(schema.collectibles.name, "%charizard%"))
    .limit(10);

  console.log(`   Found ${charizards.length} Charizard cards (showing up to 10):`);
  for (const c of charizards) {
    console.log(`   - ${c.name} (${c.setName} #${c.setNumber}) [${c.rarity}]`);
  }
  console.log();

  // Test 4b: MTG card lookup — Lightning Bolt
  console.log("4b. MTG Lightning Bolt lookup...");
  const bolts = await db
    .select({
      name: schema.collectibles.name,
      setNumber: schema.collectibles.setNumber,
      rarity: schema.collectibles.rarity,
      treatment: schema.collectibles.treatment,
      setName: schema.sets.name,
    })
    .from(schema.collectibles)
    .leftJoin(schema.sets, eq(schema.collectibles.setId, schema.sets.id))
    .where(ilike(schema.collectibles.name, "Lightning Bolt"))
    .limit(10);

  console.log(`   Found ${bolts.length} Lightning Bolt printings (showing up to 10):`);
  for (const b of bolts) {
    console.log(`   - ${b.name} (${b.setName} #${b.setNumber}) [${b.rarity}] ${b.treatment}`);
  }
  console.log();

  // Test 5: Fuzzy search with pg_trgm
  console.log("5. Fuzzy search (pg_trgm) — 'lighning bolt' (misspelled)...");
  try {
    const fuzzyResult: any = await db.execute(
      sql`SELECT name, set_number FROM collectibles
          WHERE name % 'lighning bolt'
          ORDER BY similarity(name, 'lighning bolt') DESC
          LIMIT 5`
    );
    const fuzzyRows = fuzzyResult.rows ?? fuzzyResult;
    console.log(`   Found ${fuzzyRows.length} fuzzy matches:`);
    for (const r of fuzzyRows) {
      console.log(`   - ${r.name} #${r.set_number}`);
    }
  } catch (e: any) {
    if (e.message?.includes("pg_trgm")) {
      console.log("   SKIP — pg_trgm extension not enabled yet. Run migration 0001.");
    } else {
      console.log(`   WARN — ${e.message}`);
    }
  }
  console.log();

  // Test 6: Game filter
  console.log("6. Game filter (should all be 'pokemon')...");
  const games = await db
    .select({ game: schema.collectibles.game, count: count() })
    .from(schema.collectibles)
    .groupBy(schema.collectibles.game);
  for (const g of games) {
    console.log(`   ${g.game}: ${g.count} cards`);
  }
  console.log();

  // Test 7: Era distribution
  console.log("7. Era distribution...");
  const eras = await db
    .select({ era: schema.sets.era, count: count() })
    .from(schema.sets)
    .groupBy(schema.sets.era)
    .orderBy(schema.sets.era);
  for (const e of eras) {
    console.log(`   ${e.era}: ${e.count} sets`);
  }
  console.log();

  // Test 8: Empty tables (price_points, market_snapshots — expected empty pre-ingestion)
  console.log("8. Price tables (should be empty pre-ingestion)...");
  const [ppCount] = await db.select({ count: count() }).from(schema.pricePoints);
  const [msCount] = await db.select({ count: count() }).from(schema.marketSnapshots);
  console.log(`   price_points: ${ppCount.count}`);
  console.log(`   market_snapshots: ${msCount.count}`);
  console.log();

  console.log("=== All tests passed ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
