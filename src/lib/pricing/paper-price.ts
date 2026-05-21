/**
 * Shared paper-price lookup for Phase 8 RWA endpoints.
 *
 * Used by both `rwa-fair-value` and `rwa-arbitrage`. Centralized here so
 * the condition-matching logic stays consistent and bug fixes propagate.
 */

/**
 * Map a mint's grader+grade onto our `price_points.condition` convention.
 * Returns null for raw / ungraded mints — caller queries raw paper prices.
 *
 * Supported graders:
 *   PSA  → psa-1..psa-10
 *   CGC  → cgc-1..cgc-10 (also cgc-8.5, cgc-9.5 — half grades pass through)
 *   BGS  → bgs-1..bgs-10
 *   SGC  → sgc-1..sgc-10
 */
export function gradedConditionFor(mintRow: {
  grader: string | null;
  grade: string | null;
}): string | null {
  if (!mintRow.grader || !mintRow.grade) return null;
  const prefix = mintRow.grader.toLowerCase();
  if (!["psa", "cgc", "bgs", "sgc"].includes(prefix)) return null;
  const numeric = parseFloat(mintRow.grade);
  if (!Number.isFinite(numeric)) return null;
  const suffix = Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
  return `${prefix}-${suffix}`;
}

export interface PaperPrice {
  median_usd: number | null;
  source_count: number;
  fresh_minutes: number | null;
  condition_basis: string;
  requested_condition: string | null;
}

interface PaperPriceRow {
  median_usd: string | null;
  source_count: string;
  newest_observed_at: Date | null;
}

/**
 * Pull paper price for a card.
 *
 *   1. If a graded condition is requested, look for matching-grade rows
 *      observed in the last 30 days. Return graded basis if any.
 *   2. Otherwise fall back to raw rows in the last 7 days.
 *      Tag the basis as 'raw_fallback' when a graded lookup was requested
 *      but no graded rows exist yet — so consumers know the spread
 *      compares grades inconsistently.
 *
 * The 30-day window for graded prices is intentional: the Pokemon Price
 * Tracker free tier refreshes ~80 cards/day, so a given card's PSA points
 * may be a couple of weeks old before re-ingestion.
 */
export async function fetchPaperPrice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  collectibleId: string,
  targetCondition: string | null
): Promise<PaperPrice> {
  if (targetCondition) {
    const rows = (await sql`
      SELECT
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))::text AS median_usd,
        COUNT(DISTINCT source)::text AS source_count,
        MAX(observed_at) AS newest_observed_at
      FROM price_points
      WHERE collectible_id = ${collectibleId}::uuid
        AND condition = ${targetCondition}
        AND observed_at > NOW() - INTERVAL '30 days'
    `) as PaperPriceRow[];
    const p = rows[0];
    if (p?.median_usd) {
      return {
        median_usd: parseFloat(p.median_usd),
        source_count: parseInt(p.source_count),
        fresh_minutes: p.newest_observed_at
          ? Math.floor((Date.now() - new Date(p.newest_observed_at).getTime()) / 60_000)
          : null,
        condition_basis: targetCondition,
        requested_condition: targetCondition,
      };
    }
  }

  const rows = (await sql`
    SELECT
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))::text AS median_usd,
      COUNT(DISTINCT source)::text AS source_count,
      MAX(observed_at) AS newest_observed_at
    FROM price_points
    WHERE collectible_id = ${collectibleId}::uuid
      AND condition NOT LIKE 'psa-%'
      AND condition NOT LIKE 'cgc-%'
      AND condition NOT LIKE 'bgs-%'
      AND condition NOT LIKE 'sgc-%'
      AND observed_at > NOW() - INTERVAL '7 days'
  `) as PaperPriceRow[];
  const p = rows[0];
  if (!p?.median_usd) {
    return {
      median_usd: null,
      source_count: 0,
      fresh_minutes: null,
      condition_basis: "none",
      requested_condition: targetCondition,
    };
  }
  return {
    median_usd: parseFloat(p.median_usd),
    source_count: parseInt(p.source_count),
    fresh_minutes: p.newest_observed_at
      ? Math.floor((Date.now() - new Date(p.newest_observed_at).getTime()) / 60_000)
      : null,
    condition_basis: targetCondition ? "raw_fallback" : "raw",
    requested_condition: targetCondition,
  };
}
