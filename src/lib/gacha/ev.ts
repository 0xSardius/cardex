/**
 * Gacha Pack EV composer — the exit-valuation core for Spec 01.
 *
 * Publishes a LADDER of EV lines, each with an explicit basis, most→least
 * flattering, so consumers can see exactly where the platform's headline
 * number and spendable reality diverge:
 *
 *   1. platform_insured — CC's own `ev` field (rarity-weighted expected
 *      INSURED value). Their number, republished with a timestamp.
 *   2. observed_insured — empirical mean insured value over accumulated
 *      pulls (unbiased draws from gacha_pulls), with n + 95% CI. The
 *      "observed vs stated" transparency check.
 *   3. buyback_floor — instantBuyback% × platform EV: the only GUARANTEED
 *      exit (standing offer, 72h window). The honest floor.
 *   4. realizable — mean best-exit value per pull, fee-netted:
 *        max( buyback% × insured,
 *             marketValue × (1 − ME taker fee) )
 *      where marketValue = graded paper median when we have it, else
 *      insured × SECONDARY_REALIZATION (median realized/insured 0.93 from
 *      the 2026-06 onchain sale-comps study, n=19 — noisy, documented).
 *
 * Paper-truth EV (per-card graded comps replacing insured values entirely)
 * lights up automatically as graded price_points land — the join is already
 * here; coverage stats say how much of the pool it reaches.
 */

import { gradedConditionFor, fetchPaperPrice, type PaperPrice } from "../pricing/paper-price";
import { getMarketplaceFees } from "../marketplace/fees";

const SECONDARY_REALIZATION = parseFloat(process.env.GACHA_SECONDARY_REALIZATION ?? "0.93");
const ME_TAKER = getMarketplaceFees("magic-eden", "M2").takerFeePct;

export interface EvLine {
  value_usd: number | null;
  vs_price_pct: number | null; // (value / pack price) − 1, as percent
  basis: string;
}

export interface PackEv {
  machine: {
    code: string;
    name: string | null;
    price_usd: number;
    instant_buyback_pct: number | null;
    odds: Record<string, number> | null;
    stock: Record<string, number> | null;
    platform_ev_usd: number | null;
    target_ev_usd: number | null;
    snapshot_at: string;
  };
  ev: {
    platform_insured: EvLine;
    observed_insured: EvLine & {
      n_pulls: number;
      ci95_usd: number | null;
      window: { since: string | null; until: string | null };
    };
    buyback_floor: EvLine;
    realizable: EvLine & {
      n_pulls: number;
      graded_paper_used_pct: number;
      assumptions: Record<string, number | string>;
    };
  };
  paper_truth: {
    status: "unavailable" | "partial";
    pool_resolved_pct: Record<string, number>; // by rarity, count-weighted
    graded_priced_pulls_pct: number;
    note: string;
  };
  observed_vs_stated: {
    tier_shares_observed: Record<string, number> | null;
    tier_odds_stated: Record<string, number> | null;
    n_pulls: number;
  };
  jupiter_share_of_pulls: number | null;
  chase_cards: Array<{
    name: string | null;
    insured_value_usd: number | null;
    grader: string | null;
    grade: number | null;
    resolved: boolean;
    paper: PaperPrice | null;
  }>;
  caveats: string[];
  as_of: string;
}

interface MachineRow {
  code: string;
  name: string | null;
  price_usd: string | null;
  instant_buyback_pct: number | null;
  odds: Record<string, number> | null;
  stock: Record<string, number> | null;
  platform_ev: string | null;
  target_ev: string | null;
  observed_at: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computePackEv(sql: any, code: string): Promise<PackEv | null> {
  const machines = (await sql`
    SELECT code, name, price_usd, instant_buyback_pct, odds, stock,
           platform_ev, target_ev, observed_at
    FROM gacha_machines WHERE code = ${code}
    ORDER BY observed_at DESC LIMIT 1
  `) as MachineRow[];
  const m = machines[0];
  if (!m || m.price_usd == null) return null;

  const price = parseFloat(m.price_usd);
  const platformEv = m.platform_ev != null ? parseFloat(m.platform_ev) : null;
  const buybackPct = m.instant_buyback_pct;

  // ── Observed pulls (empirical EV basis) ─────────────────────────────────
  const pulls = (await sql`
    SELECT p.insured_value, p.rarity, p.memo_slug, p.pulled_at, p.collectible_id,
           mc.grader, mc.grade
    FROM gacha_pulls p
    LEFT JOIN mint_card_map mc ON mc.mint_address = p.mint_address
    WHERE p.pack_type = ${code} AND p.pulled_at > NOW() - INTERVAL '30 days'
    ORDER BY p.pulled_at DESC
    LIMIT 5000
  `) as Array<{
    insured_value: string | null;
    rarity: string | null;
    memo_slug: string | null;
    pulled_at: Date;
    collectible_id: string | null;
    grader: string | null;
    grade: string | null;
  }>;

  const insuredVals = pulls
    .map((p) => (p.insured_value != null ? parseFloat(p.insured_value) : NaN))
    .filter(Number.isFinite);
  const n = insuredVals.length;
  const mean = n > 0 ? insuredVals.reduce((a, b) => a + b, 0) / n : null;
  const stddev =
    n > 1 && mean != null
      ? Math.sqrt(insuredVals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
      : null;
  const ci95 = stddev != null ? (1.96 * stddev) / Math.sqrt(n) : null;

  // ── Realizable EV: per-pull best exit, fee-netted ───────────────────────
  // Graded paper median per distinct (collectible, condition) pair — cached,
  // capped so a huge pull history can't fan out unboundedly.
  const paperCache = new Map<string, number | null>();
  let paperLookups = 0;
  const PAPER_LOOKUP_CAP = 200;

  async function gradedPaperFor(p: (typeof pulls)[number]): Promise<number | null> {
    if (!p.collectible_id) return null;
    const condition = gradedConditionFor({ grader: p.grader, grade: p.grade });
    if (!condition) return null;
    const key = `${p.collectible_id}|${condition}`;
    if (paperCache.has(key)) return paperCache.get(key)!;
    if (paperLookups >= PAPER_LOOKUP_CAP) return null;
    paperLookups++;
    const paper = await fetchPaperPrice(sql, p.collectible_id, condition);
    const val = paper.condition_basis === condition ? paper.median_usd : null;
    paperCache.set(key, val);
    return val;
  }

  let realizableSum = 0;
  let realizableN = 0;
  let gradedUsed = 0;
  for (const p of pulls) {
    const insured = p.insured_value != null ? parseFloat(p.insured_value) : NaN;
    if (!Number.isFinite(insured)) continue;
    const gradedPaper = await gradedPaperFor(p);
    const marketValue = gradedPaper ?? insured * SECONDARY_REALIZATION;
    if (gradedPaper != null) gradedUsed++;
    const buyback = buybackPct != null ? insured * (buybackPct / 100) : 0;
    const secondaryNet = marketValue * (1 - ME_TAKER);
    realizableSum += Math.max(buyback, secondaryNet);
    realizableN++;
  }
  const realizableMean = realizableN > 0 ? realizableSum / realizableN : null;

  // ── Observed tier shares vs stated odds ─────────────────────────────────
  const tierCounts: Record<string, number> = {};
  for (const p of pulls) {
    if (p.rarity) tierCounts[p.rarity] = (tierCounts[p.rarity] ?? 0) + 1;
  }
  const tierShares =
    pulls.length > 0
      ? Object.fromEntries(
          Object.entries(tierCounts).map(([k, v]) => [k, round4(v / pulls.length)])
        )
      : null;

  const jupiterShare =
    pulls.length > 0
      ? round4(pulls.filter((p) => p.memo_slug === "jupiter").length / pulls.length)
      : null;

  // ── Pool resolution coverage (honesty metrics) ──────────────────────────
  const coverage = (await sql`
    SELECT rarity, COUNT(*)::int AS nfts, COUNT(collectible_id)::int AS resolved
    FROM gacha_pool_nfts WHERE machine_code = ${code}
    GROUP BY rarity
  `) as Array<{ rarity: string; nfts: number; resolved: number }>;
  const poolResolvedPct: Record<string, number> = {};
  for (const c of coverage) {
    poolResolvedPct[c.rarity] = c.nfts > 0 ? round4(c.resolved / c.nfts) : 0;
  }

  // ── Chase cards (top epic pool by insured value) ────────────────────────
  const chase = (await sql`
    SELECT g.name, g.insured_value, g.collectible_id, mc.grader, mc.grade
    FROM gacha_pool_nfts g
    LEFT JOIN mint_card_map mc ON mc.mint_address = g.mint_address
    WHERE g.machine_code = ${code} AND g.rarity = 'epic'
      AND g.last_seen_at > NOW() - INTERVAL '24 hours'
    ORDER BY g.insured_value DESC NULLS LAST
    LIMIT 10
  `) as Array<{
    name: string | null;
    insured_value: string | null;
    collectible_id: string | null;
    grader: string | null;
    grade: string | null;
  }>;

  const chaseCards = [];
  for (const c of chase) {
    let paper: PaperPrice | null = null;
    if (c.collectible_id) {
      const condition = gradedConditionFor({ grader: c.grader, grade: c.grade });
      paper = await fetchPaperPrice(sql, c.collectible_id, condition);
    }
    chaseCards.push({
      name: c.name,
      insured_value_usd: c.insured_value != null ? parseFloat(c.insured_value) : null,
      grader: c.grader,
      grade: c.grade != null ? parseFloat(c.grade) : null,
      resolved: c.collectible_id != null,
      paper,
    });
  }

  const gradedPulledPct = realizableN > 0 ? round4(gradedUsed / realizableN) : 0;

  const caveats = [
    "insured values are set by the platform, not by an independent market",
    `realizable EV assumes secondary sale at ${SECONDARY_REALIZATION}× insured (median realized/insured, n=19 onchain sales, 2026-06 — noisy per-card) unless a graded paper comp exists`,
    "pool visibility is capped at the top 100 NFTs per tier by insured value; tier means come from observed pulls",
  ];
  if (n < 100) {
    caveats.push(`observed-pull sample is small (n=${n}) — CI is wide, treat empirical lines as provisional`);
  }
  if (gradedPulledPct === 0) {
    caveats.push("no graded paper comps loaded yet — paper-truth EV unavailable, realizable EV leans on the insured-value haircut");
  }

  return {
    machine: {
      code: m.code,
      name: m.name,
      price_usd: price,
      instant_buyback_pct: buybackPct,
      odds: m.odds,
      stock: m.stock,
      platform_ev_usd: platformEv != null ? round2(platformEv) : null,
      target_ev_usd: m.target_ev != null ? round2(parseFloat(m.target_ev)) : null,
      snapshot_at: new Date(m.observed_at).toISOString(),
    },
    ev: {
      platform_insured: evLine(platformEv, price, "platform's rarity-weighted expected insured value (their number)"),
      observed_insured: {
        ...evLine(mean, price, "empirical mean insured value over observed pulls"),
        n_pulls: n,
        ci95_usd: ci95 != null ? round2(ci95) : null,
        window: {
          since: n > 0 ? new Date(pulls[pulls.length - 1].pulled_at).toISOString() : null,
          until: n > 0 ? new Date(pulls[0].pulled_at).toISOString() : null,
        },
      },
      buyback_floor: evLine(
        platformEv != null && buybackPct != null ? platformEv * (buybackPct / 100) : null,
        price,
        `guaranteed exit: ${buybackPct ?? "?"}% instant buyback on insured value`
      ),
      realizable: {
        ...evLine(realizableMean, price, "mean best-exit per pull, fee-netted (buyback vs secondary)"),
        n_pulls: realizableN,
        graded_paper_used_pct: gradedPulledPct,
        assumptions: {
          secondary_realization: SECONDARY_REALIZATION,
          me_taker_fee: ME_TAKER,
          buyback_pct: buybackPct ?? "unknown",
        },
      },
    },
    paper_truth: {
      status: gradedPulledPct > 0 ? "partial" : "unavailable",
      pool_resolved_pct: poolResolvedPct,
      graded_priced_pulls_pct: gradedPulledPct,
      note:
        gradedPulledPct > 0
          ? "graded comps cover a fraction of pulls; remainder uses the insured-value haircut"
          : "graded paper ingestion pending — all realizable values derive from insured × haircut",
    },
    observed_vs_stated: {
      tier_shares_observed: tierShares,
      tier_odds_stated: m.odds,
      n_pulls: pulls.length,
    },
    jupiter_share_of_pulls: jupiterShare,
    chase_cards: chaseCards,
    caveats,
    as_of: new Date().toISOString(),
  };
}

function evLine(value: number | null, price: number, basis: string): EvLine {
  return {
    value_usd: value != null ? round2(value) : null,
    vs_price_pct: value != null && price > 0 ? round2((value / price - 1) * 100) : null,
    basis,
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
