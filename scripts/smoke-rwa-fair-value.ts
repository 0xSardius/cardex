import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { getSolUsdRate } from '../src/lib/oracle/sol-usd';

const MINT = process.argv[2] ?? '4Uzajig8c5AuR3UNRrg13ErDqbQiNz5YShZMPyGDUenh';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const sql = neon(process.env.DATABASE_URL);

  const mintRows = (await sql`
    SELECT mint_address, collectible_id, card_name, grader, grade, parallel,
           language, set_code, card_number, category
    FROM mint_card_map
    WHERE mint_address = ${MINT}
    LIMIT 1
  `) as any[];

  if (mintRows.length === 0) {
    console.log(JSON.stringify({ error: 'mint_unknown', mint: MINT }, null, 2));
    process.exit(0);
  }
  const mintRow = mintRows[0];

  let collectible: any = null;
  if (mintRow.collectible_id) {
    const rows = (await sql`
      SELECT c.id, c.name, c.set_number, c.rarity,
             s.name AS set_name, s.code AS set_code
      FROM collectibles c
      LEFT JOIN sets s ON s.id = c.set_id
      WHERE c.id = ${mintRow.collectible_id}::uuid
      LIMIT 1
    `) as any[];
    collectible = rows[0] ?? null;
  }

  // Mirror the production route: graded lookup first if mint is graded,
  // raw fallback if no graded data exists yet.
  let targetCondition: string | null = null;
  if (mintRow.grader && mintRow.grade) {
    const prefix = (mintRow.grader as string).toLowerCase();
    if (['psa', 'cgc', 'bgs', 'sgc'].includes(prefix)) {
      const numeric = parseFloat(mintRow.grade);
      if (Number.isFinite(numeric)) {
        const suffix = Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
        targetCondition = `${prefix}-${suffix}`;
      }
    }
  }

  let paperPrice: any = null;
  if (collectible) {
    if (targetCondition) {
      const gradedRows = (await sql`
        SELECT
          (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))::text AS median_usd,
          COUNT(DISTINCT source)::text AS source_count,
          MAX(observed_at) AS newest_observed_at
        FROM price_points
        WHERE collectible_id = ${collectible.id}::uuid
          AND condition = ${targetCondition}
          AND observed_at > NOW() - INTERVAL '30 days'
      `) as any[];
      const p = gradedRows[0];
      if (p?.median_usd) {
        paperPrice = {
          median_usd: parseFloat(p.median_usd),
          source_count: parseInt(p.source_count),
          fresh_minutes: p.newest_observed_at
            ? Math.floor((Date.now() - new Date(p.newest_observed_at).getTime()) / 60000)
            : null,
          condition_basis: targetCondition,
          requested_condition: targetCondition,
        };
      }
    }
    if (!paperPrice) {
      const rawRows = (await sql`
        SELECT
          (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))::text AS median_usd,
          COUNT(DISTINCT source)::text AS source_count,
          MAX(observed_at) AS newest_observed_at
        FROM price_points
        WHERE collectible_id = ${collectible.id}::uuid
          AND condition NOT LIKE 'psa-%'
          AND condition NOT LIKE 'cgc-%'
          AND condition NOT LIKE 'bgs-%'
          AND condition NOT LIKE 'sgc-%'
          AND observed_at > NOW() - INTERVAL '7 days'
      `) as any[];
      const p = rawRows[0];
      if (p?.median_usd) {
        paperPrice = {
          median_usd: parseFloat(p.median_usd),
          source_count: parseInt(p.source_count),
          fresh_minutes: p.newest_observed_at
            ? Math.floor((Date.now() - new Date(p.newest_observed_at).getTime()) / 60000)
            : null,
          condition_basis: targetCondition ? 'raw_fallback' : 'raw',
          requested_condition: targetCondition,
        };
      }
    }
  }

  const listingRows = (await sql`
    SELECT id, source, marketplace, seller, price_sol, price_usdc, price_usd,
           pda_address, observed_at, expired_at
    FROM listings
    WHERE mint_address = ${MINT}
    ORDER BY observed_at DESC
  `) as any[];

  const activeListings = listingRows.filter((r) => r.expired_at == null);
  const solUsdRate = await getSolUsdRate();

  let bestAskUsd: number | null = null;
  let bestAskCurrency: string | null = null;
  if (activeListings.length > 0) {
    activeListings.sort((a, b) => {
      const av = a.price_usdc
        ? parseFloat(a.price_usdc)
        : a.price_usd
          ? parseFloat(a.price_usd)
          : a.price_sol && solUsdRate
            ? parseFloat(a.price_sol) * solUsdRate.rate
            : Number.POSITIVE_INFINITY;
      const bv = b.price_usdc
        ? parseFloat(b.price_usdc)
        : b.price_usd
          ? parseFloat(b.price_usd)
          : b.price_sol && solUsdRate
            ? parseFloat(b.price_sol) * solUsdRate.rate
            : Number.POSITIVE_INFINITY;
      return av - bv;
    });
    const best = activeListings[0];
    if (best.price_usdc) {
      bestAskUsd = parseFloat(best.price_usdc);
      bestAskCurrency = 'USDC';
    } else if (best.price_usd) {
      bestAskUsd = parseFloat(best.price_usd);
      bestAskCurrency = 'USD';
    } else if (best.price_sol && solUsdRate) {
      bestAskUsd = parseFloat(best.price_sol) * solUsdRate.rate;
      bestAskCurrency = 'SOL→USD (Pyth)';
    } else {
      bestAskCurrency = 'SOL_only';
    }
  }

  let spread: any = null;
  if (paperPrice?.median_usd != null && bestAskUsd != null) {
    const absolute = bestAskUsd - paperPrice.median_usd;
    const pct = (absolute / paperPrice.median_usd) * 100;
    spread = {
      percent: Math.round(pct * 100) / 100,
      absolute_usd: Math.round(absolute * 100) / 100,
      direction: absolute < 0 ? 'onchain_below_paper' : absolute > 0 ? 'onchain_above_paper' : 'even',
    };
  }

  console.log(JSON.stringify({
    mint: MINT,
    mint_row: mintRow,
    collectible,
    paper_price: paperPrice,
    listings_total: listingRows.length,
    active_listings: activeListings.length,
    sol_usd_rate: solUsdRate
      ? { rate: solUsdRate.rate, age_ms: solUsdRate.age_ms, source: solUsdRate.source }
      : null,
    best_ask_usd: bestAskUsd,
    best_ask_currency: bestAskCurrency,
    sample_listings: activeListings.slice(0, 3).map((r) => ({
      source: r.source,
      marketplace: r.marketplace,
      seller: r.seller,
      price_sol: r.price_sol,
      price_usdc: r.price_usdc,
      price_usd: r.price_usd,
      observed_at: r.observed_at,
    })),
    spread,
  }, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
