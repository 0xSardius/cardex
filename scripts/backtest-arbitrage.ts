/**
 * Dogfood step 0: is there a tradeable edge in rwa-arbitrage RIGHT NOW?
 * Runs the live scan with loose thresholds, seller-intel OFF (no SolEnrich
 * spend), and summarizes the signal quality — spread distribution, how many
 * rest on raw_fallback paper (unreliable for graded slabs), net profit.
 */
import "dotenv/config";
import { scanArbitrage } from "../src/lib/insight/arbitrage";

async function main() {
  const scan = await scanArbitrage({
    limit: 50,
    min_spread_percent: 5,
    min_paper_price_usd: 5,
    include_seller_risk: false, // skip SolEnrich — we're testing the price signal
  });

  console.log("listings scanned:", scan.candidate_count_scanned);
  console.log("opportunities (>=5% under paper):", scan.count);
  console.log("");

  const ops = scan.opportunities as any[];
  if (ops.length === 0) {
    console.log("No opportunities at these thresholds.");
    return;
  }

  let rawFallback = 0;
  let realGraded = 0;
  let positiveNet = 0;
  const rows = ops.map((o) => {
    const basis = o.paper_price?.condition_basis ?? "?";
    if (basis === "raw_fallback" || basis === "raw") rawFallback++;
    else realGraded++;
    const net = o.net_profit?.net_usd ?? null;
    if (net != null && net > 0) positiveNet++;
    return {
      card: (o.collectible?.name ?? "?").slice(0, 22),
      grade:
        o.collectible?.grader && o.collectible?.grade
          ? `${o.collectible.grader}${o.collectible.grade}`
          : "raw",
      basis,
      paper: o.paper_price?.median_usd ?? null,
      onchain: o.onchain?.best_ask_usd ?? null,
      spread_pct: o.spread?.percent ?? null,
      net_usd: net,
    };
  });

  console.table(rows);
  console.log("");
  console.log(`paper basis: ${rawFallback} raw_fallback (UNRELIABLE for graded) / ${realGraded} real graded`);
  console.log(`net profit >0 after fees: ${positiveNet} / ${ops.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
