/**
 * Sanity-check raw_paper against CC's own Insured Value for the honest winners.
 * If our matched paper price is wildly above CC's insured value, the match /
 * paper lookup is suspect (artifact, not a real deal). Implements task #13.
 * Read-only. Usage: npx tsx scripts/check-insured-vs-paper.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { getSolUsdRate } from "../src/lib/oracle/sol-usd";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const solUsd = (await getSolUsdRate())?.rate ?? null;

  // Resolved active listings priced ≥ $25 onchain-below-paper, with insured value.
  const rows = (await sql`
    SELECT c.name, mcm.grader, mcm.grade, l.price_sol, l.price_usdc, l.price_usd,
      (SELECT (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))
       FROM price_points pp WHERE pp.collectible_id = c.id
         AND pp.condition NOT LIKE 'psa-%' AND pp.condition NOT LIKE 'cgc-%'
         AND pp.condition NOT LIKE 'bgs-%' AND pp.observed_at > NOW() - INTERVAL '7 days')::numeric(10,2) AS raw_paper,
      (SELECT a.value->>'value' FROM jsonb_array_elements(mcm.raw_attributes) a
       WHERE lower(a.value->>'trait_type') = 'insured value' LIMIT 1) AS insured
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    WHERE l.expired_at IS NULL AND mcm.collectible_id IS NOT NULL
  `) as any[];

  const out: any[] = [];
  for (const r of rows) {
    const ask = r.price_usdc ? +r.price_usdc : r.price_usd ? +r.price_usd : r.price_sol && solUsd ? +r.price_sol * solUsd : null;
    const paper = r.raw_paper ? +r.raw_paper : null;
    const insured = r.insured && r.insured !== "NA" ? +r.insured : null;
    if (ask == null || paper == null || paper < 25) continue;
    if (ask >= paper) continue; // only onchain-below-paper
    out.push({
      card: (r.name ?? "?").slice(0, 20),
      grade: r.grader && r.grade ? `${r.grader}${r.grade}` : "raw",
      ask: Math.round(ask),
      raw_paper: paper,
      cc_insured: insured,
      paper_vs_insured: insured ? `${(paper / insured).toFixed(1)}x` : "—",
    });
  }
  out.sort((a, b) => b.raw_paper - a.raw_paper);
  console.table(out.slice(0, 20));

  const suspect = out.filter((o) => o.cc_insured && o.raw_paper / o.cc_insured > 3).length;
  console.log(`\n${out.length} onchain-below-raw-paper candidates`);
  console.log(`${suspect} have raw_paper > 3x CC insured value (SUSPECT match/paper)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
