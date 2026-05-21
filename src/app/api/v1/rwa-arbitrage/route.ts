/**
 * POST /api/v1/rwa-arbitrage — Underpriced onchain listings vs paper-market.
 *
 * x402-gated: $0.005 per request (USDC on Solana). Per-call pricing
 * (not per-result) — x402 doesn't natively support dynamic pricing,
 * and bots prefer predictable cost. Margin lever is the seller_intel
 * cache hit rate, NOT per-row revenue.
 *
 * Request body (all optional):
 *   {
 *     min_spread_percent?: number   // default 10. Onchain ask must be at
 *                                   // least this % below paper median.
 *     min_paper_price_usd?: number  // default 25. Skip tiny opportunities.
 *     limit?: number                // default 20, max 50.
 *     include_seller_risk?: boolean // default true. seller_risk +
 *                                   // seller_cluster fields are populated;
 *                                   // false to skip and save SolEnrich cost.
 *     include_wash_trades?: boolean // default false. Wash-trade-flagged
 *                                   // clusters drop from results by default.
 *     honor_royalties?: boolean     // default false. Net profit math
 *                                   // assumes the buyer opts out of
 *                                   // optional royalties (ME default).
 *   }
 *
 * Response shape (stable — bots will hardcode):
 *   {
 *     query: { min_spread_percent, min_paper_price_usd, limit, ... },
 *     count,
 *     opportunities: [
 *       {
 *         mint, listing_id, marketplace, source, listing_url,
 *         collectible: { id, name, set, number, grader, grade },
 *         paper_price: { median_usd, condition_basis, ... },
 *         onchain:     { best_ask_usd, currency, fresh_minutes, ... },
 *         spread:      { percent, absolute_usd },
 *         net_profit:  { gross_usd, taker_fee_usd, royalty_usd, net_usd,
 *                        fee_config: { source, marketplace, taker_fee_pct,
 *                                      royalty_pct, source_doc } },
 *         seller_risk:    { ... } | { unavailable: true },
 *         seller_cluster: { ... } | { unavailable: true }
 *       },
 *       ...
 *     ],
 *     sol_usd_rate: { rate, age_ms, source } | null,
 *     agent: { ... }
 *   }
 *
 * Step 4f scope: seller_risk + seller_cluster return { unavailable: true }
 * placeholders. Step 4g wires the live SolEnrich calls via seller_intel
 * cache. Step 4h adds wash-trade filtering against the cluster payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";
import { getSolUsdRate } from "@/lib/oracle/sol-usd";
import { fetchPaperPrice, gradedConditionFor } from "@/lib/pricing/paper-price";
import { computeNetProfit } from "@/lib/marketplace/fees";
import {
  getSellerIntelBatch,
  isWashTradeCluster,
  type SellerIntel,
} from "@/lib/solenrich/seller-intel";

interface ArbitrageRequest {
  min_spread_percent?: number;
  min_paper_price_usd?: number;
  limit?: number;
  include_seller_risk?: boolean;
  include_wash_trades?: boolean;
  honor_royalties?: boolean;
}

interface CandidateRow {
  listing_id: string;
  listing_url: string | null;
  source: string;
  marketplace: string | null;
  seller: string | null;
  price_sol: string | null;
  price_usdc: string | null;
  price_usd: string | null;
  pda_address: string | null;
  observed_at: Date;
  mint_address: string;
  collectible_id: string;
  collectible_name: string;
  set_number: string | null;
  set_name: string | null;
  set_code: string | null;
  image_url: string | null;
  grader: string | null;
  grade: string | null;
  parallel: string | null;
}

const DEFAULTS = {
  min_spread_percent: 10,
  min_paper_price_usd: 25,
  limit: 20,
  max_limit: 50,
} as const;

export async function POST(request: NextRequest) {
  let body: ArbitrageRequest;
  try {
    body = (await request.json().catch(() => ({}))) as ArbitrageRequest;
  } catch {
    body = {};
  }

  const minSpread = body.min_spread_percent ?? DEFAULTS.min_spread_percent;
  const minPaper = body.min_paper_price_usd ?? DEFAULTS.min_paper_price_usd;
  const limit = Math.min(body.limit ?? DEFAULTS.limit, DEFAULTS.max_limit);
  const includeSellerRisk = body.include_seller_risk ?? true;
  const honorRoyalties = body.honor_royalties ?? false;
  // include_wash_trades is forwarded to Step 4h; harmless to keep here.
  const includeWashTrades = body.include_wash_trades ?? false;

  recordPayment("/api/v1/rwa-arbitrage", "0.005").catch(() => {});

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }
  const sql = neon(process.env.DATABASE_URL);

  // Pyth oracle once per request — small refresh window, used to convert
  // SOL-denominated listings into USD-equivalent asks.
  const solUsdRate = await getSolUsdRate();

  // Pull every active listing that has a resolved collectible. Joining
  // listings ⋈ mint_card_map ⋈ collectibles avoids any orphan rows.
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
      l.pda_address,
      l.observed_at,
      l.mint_address,
      c.id AS collectible_id,
      c.name AS collectible_name,
      c.set_number,
      c.image_url,
      s.name AS set_name,
      s.code AS set_code,
      mcm.grader,
      mcm.grade,
      mcm.parallel
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE l.expired_at IS NULL
      AND mcm.collectible_id IS NOT NULL
  `) as CandidateRow[];

  // Score each candidate. Skip those without a USD-equivalent ask
  // (SOL-only with no oracle) or without paper data for the condition.
  type Scored = {
    row: CandidateRow;
    askUsd: number;
    askCurrency: string;
    paperPrice: Awaited<ReturnType<typeof fetchPaperPrice>>;
    spreadPct: number;
    profit: ReturnType<typeof computeNetProfit>;
  };

  const scored: Scored[] = [];

  for (const row of candidates) {
    const askUsd = resolveAskUsd(row, solUsdRate?.rate ?? null);
    if (askUsd == null) continue;
    const askCurrency = askCurrencyLabel(row, solUsdRate ? true : false);

    const targetCondition = gradedConditionFor({
      grader: row.grader,
      grade: row.grade,
    });
    const paperPrice = await fetchPaperPrice(sql, row.collectible_id, targetCondition);
    if (paperPrice.median_usd == null) continue;
    if (paperPrice.median_usd < minPaper) continue;

    const spreadPct =
      ((askUsd - paperPrice.median_usd) / paperPrice.median_usd) * 100;
    // We want onchain BELOW paper — negative spread.
    if (spreadPct > -minSpread) continue;

    const profit = computeNetProfit({
      paperPriceUsd: paperPrice.median_usd,
      askUsd,
      source: row.source,
      marketplace: row.marketplace,
      honorRoyalties,
    });
    if (profit.net_usd <= 0) continue;

    scored.push({ row, askUsd, askCurrency, paperPrice, spreadPct, profit });
  }

  scored.sort((a, b) => b.profit.net_usd - a.profit.net_usd);

  // Enrich up to `limit × 2` candidates with seller intel — buffer so
  // wash-trade filtering still leaves us close to the requested limit.
  // Floor at `limit` so we never enrich less than what we'd return.
  // Hard ceiling at 50 to keep SolEnrich cost predictable.
  const enrichBudget = Math.min(
    Math.max(limit, limit * 2),
    Math.max(limit, 50)
  );
  const enrichmentSlice = scored.slice(0, enrichBudget);

  // Batch-fetch seller intel (cache-first, 6h TTL). Skipped when the
  // caller opted out via include_seller_risk=false.
  let intelMap: Map<string, SellerIntel> = new Map();
  let intelUnavailable = false;
  if (includeSellerRisk && enrichmentSlice.length > 0) {
    const sellers = enrichmentSlice
      .map((s) => s.row.seller)
      .filter((x): x is string => !!x);
    intelMap = await getSellerIntelBatch(sellers);
    // If every intel returned `unavailable`, treat the whole feature as
    // degraded for the response so the bot can see why.
    intelUnavailable =
      intelMap.size > 0 && Array.from(intelMap.values()).every((v) => v.unavailable);
  }

  // Wash-trade filter pass. We drop opportunities where wallet-graph
  // flags the seller's cluster as washy, unless the caller opted in via
  // include_wash_trades=true. `null` (unknown) is treated as "do not
  // drop" — we'd rather surface a possibly-noisy opportunity than hide
  // it on a missing signal.
  const kept: typeof enrichmentSlice = [];
  let washTradeDropped = 0;
  for (const s of enrichmentSlice) {
    const intel = s.row.seller ? intelMap.get(s.row.seller) : undefined;
    const washy = intel?.cluster ? isWashTradeCluster(intel.cluster) : null;
    if (washy === true && !includeWashTrades) {
      washTradeDropped++;
      continue;
    }
    kept.push(s);
    if (kept.length >= limit) break;
  }

  const opportunities = kept.map((s) => {
    const intel = s.row.seller ? intelMap.get(s.row.seller) : undefined;
    const washy = intel?.cluster ? isWashTradeCluster(intel.cluster) : null;
    return {
      mint: s.row.mint_address,
      listing_id: s.row.listing_id,
      marketplace: s.row.marketplace,
      source: s.row.source,
      listing_url: s.row.listing_url,
      collectible: {
        id: s.row.collectible_id,
        name: s.row.collectible_name,
        set: s.row.set_name,
        set_code: s.row.set_code,
        number: s.row.set_number,
        grader: s.row.grader,
        grade: s.row.grade ? parseFloat(s.row.grade) : null,
        parallel: s.row.parallel,
        image_url: s.row.image_url,
      },
      paper_price: s.paperPrice,
      onchain: {
        best_ask_usd: round2(s.askUsd),
        best_ask_currency: s.askCurrency,
        price_sol: s.row.price_sol ? parseFloat(s.row.price_sol) : null,
        price_usdc: s.row.price_usdc ? parseFloat(s.row.price_usdc) : null,
        seller: s.row.seller,
        pda_address: s.row.pda_address,
        observed_minutes_ago: Math.floor(
          (Date.now() - new Date(s.row.observed_at).getTime()) / 60_000
        ),
      },
      spread: {
        percent: round2(s.spreadPct),
        absolute_usd: round2(s.askUsd - (s.paperPrice.median_usd ?? 0)),
        direction: "onchain_below_paper",
      },
      net_profit: s.profit,
      seller_risk: buildSellerRisk(intel, includeSellerRisk),
      seller_cluster: buildSellerCluster(intel, washy, includeSellerRisk),
    };
  });

  const responseBody = {
    query: {
      min_spread_percent: minSpread,
      min_paper_price_usd: minPaper,
      limit,
      include_seller_risk: includeSellerRisk,
      include_wash_trades: includeWashTrades,
      honor_royalties: honorRoyalties,
    },
    count: opportunities.length,
    candidate_count_scanned: candidates.length,
    wash_trade_dropped: washTradeDropped,
    seller_intel_unavailable: intelUnavailable,
    opportunities,
    sol_usd_rate: solUsdRate
      ? { rate: solUsdRate.rate, age_ms: solUsdRate.age_ms, source: solUsdRate.source }
      : null,
    agent: agentMeta(),
  };

  // ETag changes when the top opportunity set changes. 60s cache window
  // is bot-friendly for polling cadences.
  const etag = buildEtag(opportunities, minSpread, minPaper, limit);
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  return NextResponse.json(responseBody, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=60",
    },
  });
}

/**
 * Build the seller_risk response object. Three states:
 *   - Caller opted out                  → { unavailable, reason }
 *   - Caller opted in but no payload    → { unavailable, reason }
 *   - Caller opted in and SolEnrich OK  → flattened risk score + level + raw
 */
function buildSellerRisk(
  intel: SellerIntel | undefined,
  includeSellerRisk: boolean
): Record<string, unknown> {
  if (!includeSellerRisk) {
    return { unavailable: true, reason: "include_seller_risk=false" };
  }
  if (!intel || intel.unavailable || !intel.risk) {
    return {
      unavailable: true,
      reason: intel?.unavailable
        ? "solenrich_unavailable"
        : "no_cached_payload",
    };
  }
  const risk = intel.risk;
  return {
    score: risk.riskScore ?? null,
    level: risk.riskLevel ?? null,
    labels: risk.behavioralLabels ?? [],
    sol_balance: risk.solBalance ?? null,
    fetched_at: intel.risk_fetched_at?.toISOString() ?? null,
  };
}

/**
 * Build the seller_cluster response object. Same three states as
 * seller_risk, plus surfaces our wash_trade_flag derivation.
 */
function buildSellerCluster(
  intel: SellerIntel | undefined,
  washTradeFlag: boolean | null,
  includeSellerRisk: boolean
): Record<string, unknown> {
  if (!includeSellerRisk) {
    return { unavailable: true, reason: "include_seller_risk=false" };
  }
  if (!intel || intel.unavailable || !intel.cluster) {
    return {
      unavailable: true,
      reason: intel?.unavailable
        ? "solenrich_unavailable"
        : "no_cached_payload",
    };
  }
  const cluster = intel.cluster;
  return {
    cluster_id:
      cluster.clusterId ??
      (cluster as Record<string, unknown>).cluster_id ??
      null,
    member_count:
      cluster.memberCount ??
      (cluster as Record<string, unknown>).member_count ??
      null,
    wash_trade_flag: washTradeFlag,
    fetched_at: intel.cluster_fetched_at?.toISOString() ?? null,
  };
}

function resolveAskUsd(row: CandidateRow, solUsdRate: number | null): number | null {
  if (row.price_usdc) return parseFloat(row.price_usdc);
  if (row.price_usd) return parseFloat(row.price_usd);
  if (row.price_sol && solUsdRate) return parseFloat(row.price_sol) * solUsdRate;
  return null;
}

function askCurrencyLabel(row: CandidateRow, hasOracle: boolean): string {
  if (row.price_usdc) return "USDC";
  if (row.price_usd) return "USD";
  if (row.price_sol && hasOracle) return "SOL→USD (Pyth)";
  return "SOL_only";
}

function buildEtag(
  opps: Array<{ listing_id: string; net_profit: { net_usd: number } }>,
  minSpread: number,
  minPaper: number,
  limit: number
): string {
  // Hash a cheap fingerprint: top 3 listing IDs + their net_profit buckets +
  // the query params. Changes when either the result set rotates or the
  // top opportunities' margins move a non-trivial amount.
  const fingerprint = opps
    .slice(0, 3)
    .map((o) => `${o.listing_id.slice(0, 8)}:${Math.floor(o.net_profit.net_usd)}`)
    .join("|");
  return `"${minSpread}-${minPaper}-${limit}-${opps.length}-${fingerprint}"`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
