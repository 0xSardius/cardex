/**
 * HONEST arbitrage backtest — Edge A (paper arbitrage) with the FULL exit stack
 * (ME buy 2% + 1% royalty + CC redemption 2% + shipping + eBay ~13%), not just
 * the buy-side fee. This is the real Phase 9 go/no-go gate.
 *
 * NOTE: meaningful only once graded paper prices are loaded (needs
 * POKEMON_PRICE_TRACKER_API_KEY). Until then graded slabs fall back to raw
 * paper and the comparison is misleading — the script flags raw_fallback rows.
 *
 * Usage: npx tsx scripts/backtest-arbitrage-honest.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { computePaperArbitrageProfit } from "../src/lib/marketplace/round-trip";
import { fetchPaperPrice, gradedConditionFor } from "../src/lib/pricing/paper-price";
import { getSolUsdRate } from "../src/lib/oracle/sol-usd";

const MIN_PAPER = 25; // ignore sub-$25 cards — shipping drag makes them untradeable

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);

  // ── Self-check: the honest break-even bar by card value ──────────────────
  console.log("═══ honest break-even discount by paper value (Edge A) ═══");
  for (const p of [50, 100, 300, 1000, 3000]) {
    const r = computePaperArbitrageProfit({ paperPriceUsd: p, askUsd: p });
    console.log(`  $${String(p).padStart(4)} paper → must buy ≥${r.breakevenDiscountPct}% below paper to clear`);
  }

  const solUsd = (await getSolUsdRate())?.rate ?? null;

  const candidates = (await sql`
    SELECT l.price_sol, l.price_usdc, l.price_usd, l.source, l.marketplace,
           c.id AS collectible_id, c.name AS collectible_name,
           mcm.grader, mcm.grade
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    WHERE l.expired_at IS NULL AND mcm.collectible_id IS NOT NULL
  `) as any[];

  console.log(`\ncandidates (resolved + active): ${candidates.length}`);

  let priced = 0;
  let rawFallback = 0;
  let clearsHonest = 0;
  const winners: any[] = [];

  for (const row of candidates) {
    const ask = resolveAskUsd(row, solUsd);
    if (ask == null) continue;
    const cond = gradedConditionFor({ grader: row.grader, grade: row.grade });
    const paper = await fetchPaperPrice(sql, row.collectible_id, cond);
    if (paper.median_usd == null || paper.median_usd < MIN_PAPER) continue;
    priced++;
    const basis = paper.condition_basis ?? "?";
    if (basis === "raw_fallback" || basis === "raw") rawFallback++;

    const prof = computePaperArbitrageProfit({ paperPriceUsd: paper.median_usd, askUsd: ask });
    if (prof.netUsd > 0) {
      clearsHonest++;
      winners.push({
        card: (row.collectible_name ?? "?").slice(0, 22),
        grade: row.grader && row.grade ? `${row.grader}${row.grade}` : "raw",
        basis,
        paper: paper.median_usd,
        ask: Math.round(ask),
        net: prof.netUsd,
        roi_pct: prof.roiPct,
      });
    }
  }

  console.log(`priced (paper ≥ $${MIN_PAPER}): ${priced}`);
  console.log(`  of which raw_fallback (UNRELIABLE for graded): ${rawFallback}`);
  console.log(`clears HONEST net>0 (full exit stack): ${clearsHonest}`);
  if (winners.length) {
    winners.sort((a, b) => b.net - a.net);
    console.table(winners.slice(0, 20));
  }
  console.log(
    rawFallback === priced
      ? "\n⚠️  All priced rows are raw_fallback — load graded prices before trusting any winner."
      : ""
  );
}

function resolveAskUsd(row: any, solUsd: number | null): number | null {
  if (row.price_usdc) return parseFloat(row.price_usdc);
  if (row.price_usd) return parseFloat(row.price_usd);
  if (row.price_sol && solUsd) return parseFloat(row.price_sol) * solUsd;
  return null;
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
