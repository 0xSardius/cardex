/**
 * Seller intel cache — the margin lever for Phase 8 `rwa-arbitrage`.
 *
 * SolEnrich charges per call. A 50-listing arbitrage scan with no cache
 * would burn ~$0.60 in SolEnrich fees against $0.25 of CardEx revenue.
 * Caching the same seller across listings flips that math.
 *
 * Endpoint choice (corrected post-4d):
 *   - risk    → enrich-wallet-light ($0.002). Returns riskScore + riskLevel.
 *               Originally planned as due-diligence ($0.020), but that
 *               endpoint takes a token mint, not a wallet — wrong signal.
 *               enrich-wallet-light is the documented wallet-risk endpoint.
 *   - cluster → wallet-graph ($0.010). Suspicious-cluster detection.
 *
 * Cold seller cost: $0.012. Warm cache (most sellers seen in last 6h):
 * near-zero. Endpoint revenue is $0.005, so net margin is positive even
 * on a cold-only scan (cache hit rate just sets how much).
 *
 * TTL: 6h. Per-payload `fetched_at` lets us refresh risk and cluster
 * independently — a failed risk fetch doesn't burn the wallet-graph
 * cache and vice versa.
 *
 * Graceful degradation: if SOLANA_PRIVATE_KEY is unset or SolEnrich is
 * unreachable, returns `{ risk: null, cluster: null, unavailable: true }`.
 * Consumers attach `{ unavailable: true }` to their response per CLAUDE.md
 * SLA isolation pattern.
 */

import { neon } from "@neondatabase/serverless";
import { enrichWalletLight, walletGraph } from "./client";
import type { EnrichWalletLightResponse, WalletGraphResponse } from "./types";

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface SellerIntel {
  risk: EnrichWalletLightResponse | null;
  cluster: WalletGraphResponse | null;
  risk_fetched_at: Date | null;
  cluster_fetched_at: Date | null;
  /** True when SolEnrich is unconfigured/unreachable AND we had no cached row. */
  unavailable: boolean;
}

interface SellerIntelRow {
  wallet_address: string;
  risk_payload: EnrichWalletLightResponse | null;
  risk_fetched_at: string | null;
  cluster_payload: WalletGraphResponse | null;
  cluster_fetched_at: string | null;
}

function isFresh(fetchedAt: string | Date | null): boolean {
  if (!fetchedAt) return false;
  const t = fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();
  return Date.now() - t < TTL_MS;
}

/**
 * Get cached or fresh seller intel for a wallet.
 *
 * Strategy:
 *   1. Read existing row (if any).
 *   2. For each payload that is missing or stale, call SolEnrich.
 *   3. Upsert any newly-fetched payloads (preserve cached payloads on failure).
 */
export async function getSellerIntel(address: string): Promise<SellerIntel> {
  if (!process.env.DATABASE_URL) {
    return { risk: null, cluster: null, risk_fetched_at: null, cluster_fetched_at: null, unavailable: true };
  }
  const sql = neon(process.env.DATABASE_URL);

  const rows = (await sql`
    SELECT wallet_address, risk_payload, risk_fetched_at,
           cluster_payload, cluster_fetched_at
    FROM seller_intel
    WHERE wallet_address = ${address}
    LIMIT 1
  `) as SellerIntelRow[];
  const cached = rows[0] ?? null;

  const needRisk = !cached || !isFresh(cached.risk_fetched_at);
  const needCluster = !cached || !isFresh(cached.cluster_fetched_at);

  let risk: EnrichWalletLightResponse | null = cached?.risk_payload ?? null;
  let cluster: WalletGraphResponse | null = cached?.cluster_payload ?? null;
  let riskFetchedAt: Date | null = cached?.risk_fetched_at ? new Date(cached.risk_fetched_at) : null;
  let clusterFetchedAt: Date | null = cached?.cluster_fetched_at ? new Date(cached.cluster_fetched_at) : null;

  let attemptedRemote = false;
  let anySuccess = false;

  if (needRisk || needCluster) {
    attemptedRemote = true;
    const [riskRes, clusterRes] = await Promise.all([
      needRisk ? enrichWalletLight(address) : Promise.resolve(null),
      needCluster ? walletGraph(address) : Promise.resolve(null),
    ]);
    const now = new Date();
    if (needRisk && riskRes) {
      risk = riskRes;
      riskFetchedAt = now;
      anySuccess = true;
    }
    if (needCluster && clusterRes) {
      cluster = clusterRes;
      clusterFetchedAt = now;
      anySuccess = true;
    }

    if (anySuccess) {
      await sql`
        INSERT INTO seller_intel (
          wallet_address, risk_payload, risk_fetched_at,
          cluster_payload, cluster_fetched_at
        )
        VALUES (
          ${address},
          ${risk as unknown as string}::jsonb,
          ${riskFetchedAt},
          ${cluster as unknown as string}::jsonb,
          ${clusterFetchedAt}
        )
        ON CONFLICT (wallet_address) DO UPDATE SET
          risk_payload      = COALESCE(EXCLUDED.risk_payload, seller_intel.risk_payload),
          risk_fetched_at   = COALESCE(EXCLUDED.risk_fetched_at, seller_intel.risk_fetched_at),
          cluster_payload   = COALESCE(EXCLUDED.cluster_payload, seller_intel.cluster_payload),
          cluster_fetched_at = COALESCE(EXCLUDED.cluster_fetched_at, seller_intel.cluster_fetched_at)
      `;
    }
  }

  // Unavailable only when remote was needed, remote attempt failed entirely,
  // AND we have no cached payloads at all.
  const unavailable = attemptedRemote && !anySuccess && !cached;

  return {
    risk,
    cluster,
    risk_fetched_at: riskFetchedAt,
    cluster_fetched_at: clusterFetchedAt,
    unavailable,
  };
}

/**
 * Batch variant — fetches intel for a set of wallets, deduplicating.
 * Used by `rwa-arbitrage` to enrich N opportunities with at most one call
 * per unique seller.
 */
export async function getSellerIntelBatch(
  addresses: string[]
): Promise<Map<string, SellerIntel>> {
  const unique = Array.from(new Set(addresses.filter(Boolean)));
  const results = new Map<string, SellerIntel>();
  // Run in parallel but cap concurrency conservatively to respect SolEnrich.
  const concurrency = 4;
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const intel = await Promise.all(batch.map((addr) => getSellerIntel(addr)));
    batch.forEach((addr, j) => results.set(addr, intel[j]));
  }
  return results;
}

/**
 * Heuristic check for wash-trade flags on a wallet-graph payload.
 *
 * The wallet-graph OpenAPI spec confirms the endpoint detects "suspicious
 * clusters" but doesn't document the response field names. We probe the
 * obvious candidates — camelCase + snake_case, boolean flags + string
 * verdicts. Tighten once live responses are sampled (Step 4i or first
 * real bot query).
 *
 * Returns true if any flag indicator is present; false if not; null if
 * the cluster payload is missing entirely (caller treats as unknown).
 */
export function isWashTradeCluster(
  cluster: WalletGraphResponse | null
): boolean | null {
  if (!cluster) return null;
  // Direct boolean flags — most likely shape per CLAUDE.md plan.
  if (cluster.washTradeFlag === true) return true;
  const raw = cluster as Record<string, unknown>;
  if (raw.wash_trade_flag === true) return true;
  if (raw.washTrade === true) return true;
  if (raw.wash_trade === true) return true;
  if (raw.suspicious === true) return true;
  // String verdict variants.
  const verdict =
    (typeof raw.verdict === "string" && raw.verdict.toLowerCase()) ||
    (typeof raw.cluster_type === "string" && raw.cluster_type.toLowerCase()) ||
    (typeof raw.clusterType === "string" && raw.clusterType.toLowerCase()) ||
    "";
  if (verdict.includes("wash")) return true;
  if (verdict === "suspicious") return true;
  return false;
}
