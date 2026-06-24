import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const fresh = await sql`
    SELECT source, MAX(observed_at)::date AS latest, COUNT(*)::int AS n
    FROM price_points
    WHERE source ILIKE 'pokemon%' OR source ILIKE 'pokemontcg%'
    GROUP BY source ORDER BY n DESC`;
  console.log("Pokemon paper price freshness by source:");
  console.table(fresh);

  const cov = (await sql`
    SELECT
      COUNT(DISTINCT mcm.collectible_id)::int AS resolved_cards,
      COUNT(DISTINCT mcm.collectible_id) FILTER (WHERE pp.collectible_id IS NOT NULL)::int AS with_any_pricepoint,
      COUNT(DISTINCT mcm.collectible_id) FILTER (WHERE pp.observed_at > NOW() - INTERVAL '7 days')::int AS with_fresh_7d
    FROM mint_card_map mcm
    JOIN listings l ON l.mint_address = mcm.mint_address AND l.expired_at IS NULL
    LEFT JOIN price_points pp ON pp.collectible_id = mcm.collectible_id
    WHERE mcm.collectible_id IS NOT NULL`) as any[];
  console.log("Coverage of resolved active-listing cards:");
  console.table(cov);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
