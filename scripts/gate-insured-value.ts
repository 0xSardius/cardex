/**
 * FREE insured-value gate — the confirm-or-kill read for the trader edge with
 * zero API spend. Anchors fair value on Collector Crypt's own per-card Insured
 * Value (≈ graded eBay/ALT market value, already in raw_attributes) instead of
 * paper prices, then applies the honest round-trip cost models.
 *
 *   Edge A (paper arb / redemption exit): better-grounded — insured value is
 *     literally CC's eBay-derived graded value, ~ what you'd realize on resale.
 *   Edge B (secondary resale on ME/Tensor): softer — assumes onchain resale ≈
 *     insured value (unverified until onchain sale comps exist).
 *
 * Read-only. Usage: npx tsx scripts/gate-insured-value.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { getSolUsdRate } from "../src/lib/oracle/sol-usd";
import {
  computePaperArbitrageProfit,
  computeSecondaryResaleProfit,
} from "../src/lib/marketplace/round-trip";

const MIN_INSURED = 25;

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const solUsd = (await getSolUsdRate())?.rate ?? null;
  console.log(`SOL/USD = ${solUsd}\n`);

  // One active listing per mint (lowest ask), resolved English cards, with insured value.
  const rows = (await sql`
    SELECT DISTINCT ON (l.mint_address)
      l.mint_address, c.name, mcm.grader, mcm.grade,
      l.price_sol, l.price_usdc, l.price_usd,
      (SELECT a.value->>'value' FROM jsonb_array_elements(mcm.raw_attributes) a
       WHERE lower(a.value->>'trait_type') = 'insured value' LIMIT 1) AS insured
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    WHERE l.expired_at IS NULL AND mcm.collectible_id IS NOT NULL
    ORDER BY l.mint_address, l.price_sol::numeric ASC NULLS LAST
  `) as any[];

  let withInsured = 0;
  const tiers = { "<50": 0, "50-100": 0, "100-300": 0, "300-1000": 0, "1000+": 0 };
  const edgeA: any[] = [];
  const edgeB: any[] = [];
  let roundSolWinners = 0;

  for (const r of rows) {
    const ask = r.price_usdc ? +r.price_usdc : r.price_usd ? +r.price_usd : r.price_sol && solUsd ? +r.price_sol * solUsd : null;
    const insured = r.insured && r.insured !== "NA" ? parseFloat(r.insured) : null;
    if (ask == null || insured == null || !isFinite(insured) || insured < MIN_INSURED) continue;
    withInsured++;
    if (insured < 50) tiers["<50"]++;
    else if (insured < 100) tiers["50-100"]++;
    else if (insured < 300) tiers["100-300"]++;
    else if (insured < 1000) tiers["300-1000"]++;
    else tiers["1000+"]++;
    if (ask >= insured) continue; // only onchain below insured value

    const a = computePaperArbitrageProfit({ paperPriceUsd: insured, askUsd: ask });
    const b = computeSecondaryResaleProfit({ resaleValueUsd: insured, askUsd: ask });
    const grade = r.grader && r.grade ? `${r.grader}${r.grade}` : "raw";
    const disc = `${(((insured - ask) / insured) * 100).toFixed(0)}%`;
    const sol = r.price_sol ? +r.price_sol : null;
    const isRound = sol != null && (sol === Math.round(sol * 2) / 2); // .0 or .5 SOL

    if (a.netUsd > 0) {
      edgeA.push({ card: (r.name ?? "?").slice(0, 20), grade, ask: Math.round(ask), insured, disc, netA: a.netUsd, roiA: `${a.roiPct}%`, sol });
      if (isRound) roundSolWinners++;
    }
    if (b.netUsd > 0) edgeB.push({ card: (r.name ?? "?").slice(0, 20), grade, ask: Math.round(ask), insured, netB: b.netUsd });
  }

  console.log(`Resolved English listings with insured value ≥ $${MIN_INSURED}: ${withInsured}`);
  console.log("Insured-value tiers:", tiers);

  console.log(`\n═══ EDGE A — paper arb (redemption exit, ~20% stack) ═══`);
  console.log(`clears net>0: ${edgeA.length}`);
  edgeA.sort((x, y) => y.netA - x.netA);
  if (edgeA.length) console.table(edgeA.slice(0, 25));
  console.log(`  of Edge-A winners priced at round .0/.5 SOL (possible flat floor-listings, verify live): ${roundSolWinners}/${edgeA.length}`);

  console.log(`\n═══ EDGE B — secondary resale (ME/Tensor, ~5% stack; softer) ═══`);
  console.log(`clears net>0: ${edgeB.length}`);
  edgeB.sort((x, y) => y.netB - x.netB);
  if (edgeB.length) console.table(edgeB.slice(0, 15));

  // The honest cut: Edge A winners on $300+ cards (where redemption economics actually work).
  const a300 = edgeA.filter((w) => w.insured >= 300);
  console.log(`\n═══ THE REAL GATE: Edge-A winners on $300+ cards ═══`);
  console.log(`${a300.length} (these are the ones where the redemption exit economics genuinely close)`);
  if (a300.length) console.table(a300);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
