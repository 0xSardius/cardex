/**
 * Audit the data claims on the landing page against the live DB.
 * Read-only. Usage: npx tsx scripts/audit-landing-claims.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("=== collectibles by game ===");
  console.table(await sql`SELECT game, count(*)::int AS n FROM collectibles GROUP BY game ORDER BY n DESC`);

  console.log("\n=== price_points: total ===");
  console.log(await sql`SELECT count(*)::int AS total FROM price_points`);

  console.log("\n=== price_points by source (top 20) ===");
  console.table(await sql`SELECT source, count(*)::int AS n FROM price_points GROUP BY source ORDER BY n DESC LIMIT 20`);

  console.log("\n=== price_points: distinct conditions (graded basis?) ===");
  console.table(await sql`SELECT condition, count(*)::int AS n FROM price_points GROUP BY condition ORDER BY n DESC LIMIT 20`);

  console.log("\n=== listings: by source, active vs total ===");
  console.table(await sql`
    SELECT source,
           count(*)::int AS total,
           count(*) FILTER (WHERE expired_at IS NULL)::int AS active
    FROM listings GROUP BY source ORDER BY total DESC`);

  console.log("\n=== listings: by marketplace ===");
  console.table(await sql`SELECT marketplace, count(*)::int AS n FROM listings GROUP BY marketplace ORDER BY n DESC`);

  console.log("\n=== mint_card_map: total + resolved to a collectible ===");
  console.log(await sql`
    SELECT count(*)::int AS total,
           count(collectible_id)::int AS resolved,
           round(100.0 * count(collectible_id) / nullif(count(*),0), 1) AS pct_resolved
    FROM mint_card_map`);

  console.log("\n=== reserved list count (MTG) ===");
  console.log(await sql`SELECT count(*)::int AS reserved FROM collectibles WHERE reserved = true`);

  console.log("\n=== any eBay-sourced price points? ===");
  console.log(await sql`SELECT count(*)::int AS ebay_rows FROM price_points WHERE source ILIKE '%ebay%'`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
