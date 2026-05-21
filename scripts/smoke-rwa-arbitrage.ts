/**
 * Smoke for rwa-arbitrage — exercises the same SQL + scoring pipeline
 * the route runs, without spinning up the dev server or the x402 gate.
 *
 * Usage:
 *   npx tsx scripts/smoke-rwa-arbitrage.ts [min_spread] [min_paper_usd] [limit]
 *   defaults: min_spread=10, min_paper_usd=25, limit=20
 *
 * Caveat: paper-price data is sparse pre-graded-ingestion (free tier 4d
 * needs the Pokemon Price Tracker key + a run). Expect zero results
 * until then, but the scan should report the candidate count.
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { getSolUsdRate } from '../src/lib/oracle/sol-usd';
import { fetchPaperPrice, gradedConditionFor } from '../src/lib/pricing/paper-price';
import { computeNetProfit } from '../src/lib/marketplace/fees';

const minSpread = parseFloat(process.argv[2] ?? '10');
const minPaper = parseFloat(process.argv[3] ?? '25');
const limit = parseInt(process.argv[4] ?? '20', 10);

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const sql = neon(process.env.DATABASE_URL);

  const solUsdRate = await getSolUsdRate();
  console.log('sol_usd_rate:', solUsdRate);

  const candidates = (await sql`
    SELECT
      l.id AS listing_id,
      l.listing_url,
      l.source,
      l.marketplace,
      l.seller,
      l.price_sol,
      l.price_usdc,
      l.price_usd,
      l.observed_at,
      l.mint_address,
      c.id AS collectible_id,
      c.name AS collectible_name,
      c.set_number,
      s.name AS set_name,
      s.code AS set_code,
      mcm.grader,
      mcm.grade
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE l.expired_at IS NULL
      AND mcm.collectible_id IS NOT NULL
  `) as any[];

  console.log(`\nScanning ${candidates.length} active listings with resolved collectibles\n`);

  let withAsk = 0;
  let withPaper = 0;
  let aboveMinPaper = 0;
  let belowMinSpread = 0;
  let positiveProfit = 0;

  const scored: any[] = [];
  for (const row of candidates) {
    const askUsd = row.price_usdc
      ? parseFloat(row.price_usdc)
      : row.price_usd
        ? parseFloat(row.price_usd)
        : row.price_sol && solUsdRate
          ? parseFloat(row.price_sol) * solUsdRate.rate
          : null;
    if (askUsd == null) continue;
    withAsk++;

    const targetCondition = gradedConditionFor({ grader: row.grader, grade: row.grade });
    const paperPrice = await fetchPaperPrice(sql, row.collectible_id, targetCondition);
    if (paperPrice.median_usd == null) continue;
    withPaper++;
    if (paperPrice.median_usd < minPaper) continue;
    aboveMinPaper++;

    const spreadPct = ((askUsd - paperPrice.median_usd) / paperPrice.median_usd) * 100;
    if (spreadPct > -minSpread) continue;
    belowMinSpread++;

    const profit = computeNetProfit({
      paperPriceUsd: paperPrice.median_usd,
      askUsd,
      source: row.source,
      marketplace: row.marketplace,
      honorRoyalties: false,
    });
    if (profit.net_usd <= 0) continue;
    positiveProfit++;

    scored.push({
      name: row.collectible_name,
      set: row.set_code,
      number: row.set_number,
      grader: row.grader,
      grade: row.grade,
      ask_usd: Math.round(askUsd * 100) / 100,
      paper_usd: paperPrice.median_usd,
      basis: paperPrice.condition_basis,
      spread_pct: Math.round(spreadPct * 100) / 100,
      net_usd: profit.net_usd,
      seller: row.seller,
    });
  }

  scored.sort((a, b) => b.net_usd - a.net_usd);

  console.log(`Funnel:
  candidates_with_resolved_collectible: ${candidates.length}
  with_usd_equivalent_ask:               ${withAsk}
  with_paper_price:                      ${withPaper}
  above_min_paper_${minPaper}:                  ${aboveMinPaper}
  below_${minSpread}%_spread:                       ${belowMinSpread}
  positive_net_after_fees:               ${positiveProfit}
`);

  console.log(`Top ${limit} opportunities:`);
  console.log(JSON.stringify(scored.slice(0, limit), null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
