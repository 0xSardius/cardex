/**
 * Data-quality trace: for resolved active listings that LOOK like deals
 * (onchain ask well below raw paper), dump the raw price fields + mint + paper
 * points so we can tell real signal from conversion/match artifacts.
 * Read-only. Usage: npx tsx scripts/trace-winners.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { getSolUsdRate } from "../src/lib/oracle/sol-usd";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const solUsd = (await getSolUsdRate())?.rate ?? null;
  console.log(`SOL/USD = ${solUsd}`);

  const rows = (await sql`
    SELECT c.name, mcm.grader, mcm.grade, l.mint_address,
           l.price_sol, l.price_usdc, l.price_usd, l.marketplace, l.source,
           l.observed_at::date AS observed,
           (SELECT (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))
            FROM price_points pp WHERE pp.collectible_id = c.id
              AND pp.condition NOT LIKE 'psa-%' AND pp.condition NOT LIKE 'cgc-%'
              AND pp.condition NOT LIKE 'bgs-%' AND pp.observed_at > NOW() - INTERVAL '7 days')::numeric(10,2) AS raw_paper,
           (SELECT COUNT(DISTINCT pp.condition) FROM price_points pp
            WHERE pp.collectible_id = c.id AND pp.observed_at > NOW() - INTERVAL '7 days')::int AS conditions_avail
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    WHERE l.expired_at IS NULL AND mcm.collectible_id IS NOT NULL
    ORDER BY l.observed_at DESC
    LIMIT 200
  `) as any[];

  const traced = rows.map((r) => {
    const askUsd = r.price_usdc
      ? parseFloat(r.price_usdc)
      : r.price_usd
      ? parseFloat(r.price_usd)
      : r.price_sol && solUsd
      ? parseFloat(r.price_sol) * solUsd
      : null;
    return {
      card: (r.name ?? "?").slice(0, 20),
      grade: r.grader && r.grade ? `${r.grader}${r.grade}` : "raw",
      sol: r.price_sol ? parseFloat(r.price_sol) : null,
      usdc: r.price_usdc ? parseFloat(r.price_usdc) : null,
      ask_usd: askUsd ? Math.round(askUsd) : null,
      raw_paper: r.raw_paper ? parseFloat(r.raw_paper) : null,
      mkt: r.marketplace,
    };
  });

  // Show ones that look like deals (ask < 60% of raw paper) — the suspicious set
  const deals = traced.filter(
    (t) => t.ask_usd != null && t.raw_paper != null && t.ask_usd < 0.6 * t.raw_paper
  );
  console.log(`\nListings where ask < 60% of RAW paper (graded vs raw — suspicious): ${deals.length}`);
  console.table(deals.slice(0, 20));

  // Price-denomination distribution to spot conversion issues
  const solOnly = traced.filter((t) => t.sol != null && t.usdc == null).length;
  const usdc = traced.filter((t) => t.usdc != null).length;
  console.log(`\nDenomination: ${usdc} USDC-priced, ${solOnly} SOL-priced (converted via Pyth)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
