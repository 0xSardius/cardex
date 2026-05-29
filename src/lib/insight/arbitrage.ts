/**
 * Core scan logic for /api/v1/rwa-arbitrage, factored out so the route
 * handler and the SSR demo page share one implementation. The route
 * handler still owns x402 payment recording and ETag/304 negotiation.
 */

import { neon } from "@neondatabase/serverless";
import { getSolUsdRate } from "@/lib/oracle/sol-usd";
import { fetchPaperPrice, gradedConditionFor } from "@/lib/pricing/paper-price";
import { computeNetProfit } from "@/lib/marketplace/fees";
import {
  getSellerIntelBatch,
  isWashTradeCluster,
  type SellerIntel,
} from "@/lib/solenrich/seller-intel";

export interface ArbitrageScanOptions {
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

export type ArbitrageScanResult = Awaited<ReturnType<typeof scanArbitrage>>;

export async function scanArbitrage(opts: ArbitrageScanOptions = {}) {
  const minSpread = opts.min_spread_percent ?? DEFAULTS.min_spread_percent;
  const minPaper = opts.min_paper_price_usd ?? DEFAULTS.min_paper_price_usd;
  const limit = Math.min(opts.limit ?? DEFAULTS.limit, DEFAULTS.max_limit);
  const includeSellerRisk = opts.include_seller_risk ?? true;
  const honorRoyalties = opts.honor_royalties ?? false;
  const includeWashTrades = opts.include_wash_trades ?? false;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }
  const sql = neon(process.env.DATABASE_URL);

  const solUsdRate = await getSolUsdRate();

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

  const enrichBudget = Math.min(
    Math.max(limit, limit * 2),
    Math.max(limit, 50)
  );
  const enrichmentSlice = scored.slice(0, enrichBudget);

  let intelMap: Map<string, SellerIntel> = new Map();
  let intelUnavailable = false;
  if (includeSellerRisk && enrichmentSlice.length > 0) {
    const sellers = enrichmentSlice
      .map((s) => s.row.seller)
      .filter((x): x is string => !!x);
    intelMap = await getSellerIntelBatch(sellers);
    intelUnavailable =
      intelMap.size > 0 &&
      Array.from(intelMap.values()).every((v) => v.unavailable);
  }

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

  return {
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
  };
}

export function buildArbitrageEtag(
  opps: Array<{ listing_id: string; net_profit: { net_usd: number } }>,
  minSpread: number,
  minPaper: number,
  limit: number
): string {
  const fingerprint = opps
    .slice(0, 3)
    .map((o) => `${o.listing_id.slice(0, 8)}:${Math.floor(o.net_profit.net_usd)}`)
    .join("|");
  return `"${minSpread}-${minPaper}-${limit}-${opps.length}-${fingerprint}"`;
}

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
