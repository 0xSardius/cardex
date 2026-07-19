/**
 * Coverage report: mint→catalog resolution + paper-price availability for the
 * gacha pool and accumulated pulls, by machine + rarity tier, count- and
 * insured-value-weighted. The honesty metric for EV publishing.
 *
 * Usage: npx tsx scripts/gacha-coverage.ts [machine_code]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const code = process.argv[2] ?? "pokemon_50";

  console.log(`── Pool coverage: ${code} (top-100 per tier) ──`);
  const pool = await sql`
    SELECT g.rarity,
           COUNT(*)::int AS nfts,
           COUNT(g.collectible_id)::int AS resolved,
           ROUND(SUM(g.insured_value)::numeric, 0) AS insured_total,
           ROUND(SUM(g.insured_value) FILTER (WHERE g.collectible_id IS NOT NULL)::numeric, 0) AS insured_resolved,
           COUNT(p.collectible_id)::int AS with_paper_price
    FROM gacha_pool_nfts g
    LEFT JOIN LATERAL (
      SELECT pp.collectible_id FROM price_points pp
      WHERE pp.collectible_id = g.collectible_id
        AND pp.observed_at > NOW() - interval '14 days'
      LIMIT 1
    ) p ON true
    WHERE g.machine_code = ${code}
    GROUP BY g.rarity
    ORDER BY CASE g.rarity WHEN 'epic' THEN 1 WHEN 'rare' THEN 2 WHEN 'uncommon' THEN 3 ELSE 4 END
  `;
  for (const r of pool as any[]) {
    const pctN = ((r.resolved / r.nfts) * 100).toFixed(0);
    const pctV = ((r.insured_resolved / r.insured_total) * 100).toFixed(0);
    console.log(
      `  ${r.rarity.padEnd(9)} ${r.resolved}/${r.nfts} resolved (${pctN}% count, ${pctV}% value) | paper-priced: ${r.with_paper_price}/${r.nfts} | insured $${r.insured_total}`
    );
  }

  console.log(`\n── Pulls coverage (all packs, accumulated) ──`);
  const pulls = await sql`
    SELECT pack_type,
           COUNT(*)::int AS pulls,
           COUNT(collectible_id)::int AS resolved,
           COUNT(DISTINCT memo_slug) AS slugs,
           MIN(pulled_at) AS oldest, MAX(pulled_at) AS newest
    FROM gacha_pulls
    GROUP BY pack_type ORDER BY pulls DESC
  `;
  for (const r of pulls as any[]) {
    console.log(
      `  ${String(r.pack_type).padEnd(14)} ${r.pulls} pulls, ${r.resolved} resolved | ${new Date(r.oldest).toISOString().slice(11, 16)}→${new Date(r.newest).toISOString().slice(11, 16)} UTC`
    );
  }

  const bySlug = await sql`
    SELECT memo_slug, COUNT(*)::int AS n FROM gacha_pulls GROUP BY memo_slug ORDER BY n DESC
  `;
  console.log(
    "\n  by frontend:",
    (bySlug as any[]).map((r) => `${r.memo_slug}=${r.n}`).join("  ")
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
