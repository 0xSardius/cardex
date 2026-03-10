/**
 * Market Snapshot Aggregation
 *
 * Aggregates price_points into daily market_snapshots.
 * Run after price ingestion to create per-card daily summaries.
 *
 * Usage: npx tsx src/lib/ingestion/aggregate-snapshots.ts
 * Requires: DATABASE_URL env var
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log("Aggregating market snapshots...\n");

  // Aggregate today's price_points into market_snapshots
  // Only USD prices (source = scryfall_tcgplayer), condition = nm (regular cards)
  const result: any = await db.execute(sql`
    INSERT INTO market_snapshots (
      id, collectible_id, condition, date,
      avg_price, median_price, low_price, high_price,
      volume, sources_count
    )
    SELECT
      gen_random_uuid(),
      pp.collectible_id,
      pp.condition,
      CURRENT_DATE,
      ROUND(AVG(pp.price_usd::numeric)::numeric, 2),
      ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pp.price_usd::numeric))::numeric, 2),
      ROUND(MIN(pp.price_usd::numeric)::numeric, 2),
      ROUND(MAX(pp.price_usd::numeric)::numeric, 2),
      COUNT(*)::int,
      COUNT(DISTINCT pp.source)::int
    FROM price_points pp
    WHERE pp.currency = 'USD'
      AND pp.observed_at >= CURRENT_DATE
      AND pp.observed_at < CURRENT_DATE + INTERVAL '1 day'
    GROUP BY pp.collectible_id, pp.condition
    ON CONFLICT (collectible_id, condition, date)
    DO UPDATE SET
      avg_price = EXCLUDED.avg_price,
      median_price = EXCLUDED.median_price,
      low_price = EXCLUDED.low_price,
      high_price = EXCLUDED.high_price,
      volume = EXCLUDED.volume,
      sources_count = EXCLUDED.sources_count
    RETURNING id
  `);

  const rows = result.rows ?? result;
  console.log(`Created/updated ${rows.length} market snapshots for today.`);

  // Update 7d/30d/90d trends where we have historical data
  console.log("Calculating price trends...");
  await db.execute(sql`
    UPDATE market_snapshots ms
    SET
      trend_7d = CASE
        WHEN prev7.avg_price > 0
        THEN ROUND(((ms.avg_price::numeric - prev7.avg_price::numeric) / prev7.avg_price::numeric * 100)::numeric, 2)
        ELSE NULL
      END,
      trend_30d = CASE
        WHEN prev30.avg_price > 0
        THEN ROUND(((ms.avg_price::numeric - prev30.avg_price::numeric) / prev30.avg_price::numeric * 100)::numeric, 2)
        ELSE NULL
      END
    FROM
      (SELECT collectible_id, condition, avg_price
       FROM market_snapshots
       WHERE date = CURRENT_DATE - INTERVAL '7 days') prev7,
      (SELECT collectible_id, condition, avg_price
       FROM market_snapshots
       WHERE date = CURRENT_DATE - INTERVAL '30 days') prev30
    WHERE ms.date = CURRENT_DATE
      AND ms.collectible_id = prev7.collectible_id AND ms.condition = prev7.condition
      AND ms.collectible_id = prev30.collectible_id AND ms.condition = prev30.condition
  `);

  console.log("Done!");
}

main().catch((err) => {
  console.error("Aggregation failed:", err);
  process.exit(1);
});
