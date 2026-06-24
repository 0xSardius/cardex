/**
 * Honest round-trip P&L for the two trader edges.
 *
 * The rwa-arbitrage scan's `computeNetProfit` nets ONLY the 2% Magic Eden buy
 * fee and assumes you exit at the full paper price — optimistic by ~18-20% for
 * the paper-arbitrage exit. This module models the FULL exit stack so the
 * backtest gate tells the truth before any capital is risked.
 *
 * Two edges (see docs / strategy 2026-06):
 *   - Edge A (paper arbitrage): buy pNFT on ME below paper value, redeem the
 *     physical card, sell on eBay/TCGPlayer. Big per-trade spread, ~20% cost
 *     stack, weeks to realize. Our data moat; the sellable alerts signal.
 *   - Edge B (secondary mispricing): buy pNFT below its ME/Tensor resale value,
 *     relist on ME/Tensor. ~4-6% round trip, US-clean, but needs an onchain
 *     resale-value comp (built separately).
 *
 * All costs are configurable; defaults are conservative (favor NOT trading).
 */

// ── Edge A: paper-arbitrage cost stack ───────────────────────────────────────

export interface PaperArbitrageCosts {
  /** ME taker fee paid on the onchain BUY. */
  buyTakerPct: number;
  /** Enforced pNFT royalty on transfer (CC ≈ 1%). Conservatively separate from taker. */
  royaltyPct: number;
  /** CC vault withdrawal fee on insured (≈ paper) value when redeeming the physical. */
  redemptionPct: number;
  /** Flat logistics: insured shipping of the slab (vault→you and/or you→buyer). */
  shippingFlatUsd: number;
  /** Paper-side resale fee — eBay final-value ≈ 13.25%, TCGPlayer ≈ 12.5%. */
  paperResalePct: number;
}

export const DEFAULT_PAPER_ARB_COSTS: PaperArbitrageCosts = {
  buyTakerPct: 0.02,
  royaltyPct: 0.01,
  redemptionPct: 0.02,
  shippingFlatUsd: 20,
  paperResalePct: 0.13,
};

export interface RoundTripResult {
  /** Realized profit after the full stack. */
  netUsd: number;
  /** net / cost_in. */
  roiPct: number;
  /** ask + buy-side fees (capital deployed). */
  costInUsd: number;
  /** paper proceeds net of resale fee + exit logistics. */
  proceedsUsd: number;
  breakdownUsd: {
    ask: number;
    buyTaker: number;
    royalty: number;
    redemption: number;
    shipping: number;
    paperResaleFee: number;
  };
  /** Max ask that still breaks even, given the paper price. */
  breakevenAskUsd: number;
  /** How far below paper the ask must sit to break even (%). */
  breakevenDiscountPct: number;
}

/**
 * Edge A realized P&L: buy onchain at `askUsd`, redeem, sell physical at
 * `paperPriceUsd` on a paper venue. Insured value for redemption is taken as
 * the paper price (CC insures at its indexed value).
 */
export function computePaperArbitrageProfit(opts: {
  paperPriceUsd: number;
  askUsd: number;
  costs?: Partial<PaperArbitrageCosts>;
}): RoundTripResult {
  const c = { ...DEFAULT_PAPER_ARB_COSTS, ...opts.costs };
  const { paperPriceUsd: paper, askUsd: ask } = opts;

  const buyTaker = ask * c.buyTakerPct;
  const royalty = ask * c.royaltyPct;
  const redemption = paper * c.redemptionPct;
  const shipping = c.shippingFlatUsd;
  const paperResaleFee = paper * c.paperResalePct;

  const costInUsd = ask + buyTaker + royalty;
  const proceedsUsd = paper - paperResaleFee - redemption - shipping;
  const netUsd = proceedsUsd - costInUsd;

  // Break-even ask: solve proceeds = ask·(1 + buyTaker + royalty) for ask.
  const buyMultiplier = 1 + c.buyTakerPct + c.royaltyPct;
  const breakevenAskUsd = proceedsUsd / buyMultiplier;
  const breakevenDiscountPct = ((paper - breakevenAskUsd) / paper) * 100;

  return {
    netUsd: round2(netUsd),
    roiPct: round2((netUsd / costInUsd) * 100),
    costInUsd: round2(costInUsd),
    proceedsUsd: round2(proceedsUsd),
    breakdownUsd: {
      ask: round2(ask),
      buyTaker: round2(buyTaker),
      royalty: round2(royalty),
      redemption: round2(redemption),
      shipping: round2(shipping),
      paperResaleFee: round2(paperResaleFee),
    },
    breakevenAskUsd: round2(breakevenAskUsd),
    breakevenDiscountPct: round2(breakevenDiscountPct),
  };
}

// ── Edge B: secondary-resale cost stack ──────────────────────────────────────

export interface SecondaryResaleCosts {
  buyTakerPct: number;
  sellTakerPct: number;
  royaltyPct: number; // enforced on each transfer
}

export const DEFAULT_SECONDARY_COSTS: SecondaryResaleCosts = {
  buyTakerPct: 0.02,
  sellTakerPct: 0.02,
  royaltyPct: 0.01,
};

/**
 * Edge B realized P&L: buy at `askUsd`, relist + sell at `resaleValueUsd` on
 * the same onchain venue. US-clean; ~5-6% round trip. `resaleValueUsd` must
 * come from an onchain comp model (recent ME/Tensor sales for the card).
 */
export function computeSecondaryResaleProfit(opts: {
  resaleValueUsd: number;
  askUsd: number;
  costs?: Partial<SecondaryResaleCosts>;
}): { netUsd: number; roiPct: number; breakevenAskUsd: number } {
  const c = { ...DEFAULT_SECONDARY_COSTS, ...opts.costs };
  const { resaleValueUsd: resale, askUsd: ask } = opts;

  const costIn = ask * (1 + c.buyTakerPct + c.royaltyPct);
  const proceeds = resale * (1 - c.sellTakerPct - c.royaltyPct);
  const netUsd = proceeds - costIn;
  const breakevenAskUsd = proceeds / (1 + c.buyTakerPct + c.royaltyPct);

  return {
    netUsd: round2(netUsd),
    roiPct: round2((netUsd / costIn) * 100),
    breakevenAskUsd: round2(breakevenAskUsd),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
