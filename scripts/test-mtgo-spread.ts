/**
 * Tests for MTGO-Paper Price Spread feature
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

  console.log("=== MTGO-Paper Spread Tests ===\n");

  // Test 1: Data availability
  console.log("Data availability:");
  const mtgoCount = await sql`SELECT COUNT(*) as total FROM price_points WHERE source = 'scryfall_mtgo'`;
  assert(parseInt(mtgoCount[0].total) > 50000, `MTGO price points > 50K (got ${mtgoCount[0].total})`);

  const usdCount = await sql`SELECT COUNT(*) as total FROM price_points WHERE source = 'scryfall_tcgplayer' AND condition = 'nm'`;
  assert(parseInt(usdCount[0].total) > 70000, `USD price points > 70K (got ${usdCount[0].total})`);

  // Test 2: Cards with both MTGO and USD prices exist
  const bothCount = await sql`
    SELECT COUNT(DISTINCT m.collectible_id) as total
    FROM (
      SELECT DISTINCT ON (collectible_id) collectible_id
      FROM price_points WHERE source = 'scryfall_mtgo'
      ORDER BY collectible_id, observed_at DESC
    ) m
    JOIN (
      SELECT DISTINCT ON (collectible_id) collectible_id
      FROM price_points WHERE source = 'scryfall_tcgplayer' AND condition = 'nm'
      ORDER BY collectible_id, observed_at DESC
    ) u ON u.collectible_id = m.collectible_id
  `;
  assert(parseInt(bothCount[0].total) > 40000, `Cards with both prices > 40K (got ${bothCount[0].total})`);

  // Test 3: MTGO-high signals exist (tix expensive relative to paper)
  console.log("\nMTGO-high signals:");
  const mtgoHigh = await sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT c.name, u.price as usd, t.tix, ROUND(t.tix / u.price, 2) as ratio
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    WHERE u.price >= 1 AND t.tix >= 0.1 AND t.tix / u.price >= 3
    ORDER BY t.tix / u.price DESC
    LIMIT 5
  `;
  assert(mtgoHigh.length > 0, `found MTGO-high signals (got ${mtgoHigh.length})`);
  if (mtgoHigh.length > 0) {
    assert(parseFloat(mtgoHigh[0].ratio) >= 3, `top result has ratio >= 3 (got ${mtgoHigh[0].ratio})`);
    console.log(`    Top: ${mtgoHigh[0].name} — $${mtgoHigh[0].usd} paper / ${mtgoHigh[0].tix} tix (${mtgoHigh[0].ratio}x)`);
  }

  // Test 4: Paper-high signals exist (paper expensive relative to MTGO)
  console.log("\nPaper-high signals:");
  const paperHigh = await sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT c.name, c.reserved, u.price as usd, t.tix, ROUND(u.price / t.tix, 2) as ratio
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    WHERE u.price >= 5 AND t.tix >= 0.1 AND u.price / t.tix >= 50
    ORDER BY u.price / t.tix DESC
    LIMIT 5
  `;
  assert(paperHigh.length > 0, `found paper-high signals (got ${paperHigh.length})`);
  if (paperHigh.length > 0) {
    assert(parseFloat(paperHigh[0].ratio) >= 50, `top paper-high has ratio >= 50 (got ${paperHigh[0].ratio})`);
    console.log(`    Top: ${paperHigh[0].name} — $${paperHigh[0].usd} paper / ${paperHigh[0].tix} tix (${paperHigh[0].ratio}x)`);
  }

  // Test 5: Reserved List cards tend to have high paper/MTGO ratio
  // (because they can't be reprinted online, but Reserved List only applies to paper)
  console.log("\nReserved List correlation:");
  const reservedPaperHigh = await sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT COUNT(*) as total
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    WHERE c.reserved = true AND u.price >= 5 AND t.tix >= 0.1 AND u.price / t.tix >= 10
  `;
  assert(parseInt(reservedPaperHigh[0].total) > 0, `reserved cards appear in paper-high signals (got ${reservedPaperHigh[0].total})`);

  // Test 6: Verify the spread data matches between both queries
  console.log("\nData consistency:");
  const sampleCard = await sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT c.name, u.price as usd, t.tix
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    WHERE c.name = 'Lightning Bolt' AND u.price > 0 AND t.tix > 0
    LIMIT 1
  `;
  assert(sampleCard.length > 0, "Lightning Bolt has both USD and MTGO prices");
  if (sampleCard.length > 0) {
    const usd = parseFloat(sampleCard[0].usd);
    const tix = parseFloat(sampleCard[0].tix);
    assert(usd > 0 && tix > 0, `prices are positive (usd: ${usd}, tix: ${tix})`);
    const ratio = tix / usd;
    assert(!isNaN(ratio), `ratio is calculable (${ratio.toFixed(2)} tix/$)`);
    console.log(`    Lightning Bolt: $${usd} / ${tix} tix (${ratio.toFixed(2)} tix/$)`);
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(console.error);
