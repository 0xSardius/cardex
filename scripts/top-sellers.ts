/**
 * List the most active seller wallets in the listings table — candidates for
 * a rich /demo/wallet capture. Read-only.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`
    SELECT seller, count(*)::int AS active_listings
    FROM listings
    WHERE expired_at IS NULL AND seller IS NOT NULL
    GROUP BY seller
    ORDER BY active_listings DESC
    LIMIT 10`;
  console.table(rows);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
