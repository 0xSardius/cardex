/**
 * Marketplace fee table for net-profit math in `rwa-arbitrage`.
 *
 * What's covered:
 *   - Onchain marketplace taker fee (the fee a buyer effectively pays when
 *     they later sell the same NFT on the same venue).
 *   - Optional creator royalty (buyer's choice on Magic Eden Solana).
 *
 * What's NOT covered (deliberately):
 *   - Paper-side resale fees (TCGPlayer ~12.5%, eBay ~13%). The bot picks
 *     its resale venue; we surface the marketplace-side net and let the
 *     bot apply its own paper-side discount.
 *   - Collector Crypt physical redemption fee. That's a Phase 9 concern
 *     when CardEx actually redeems; for the oracle response, the bot is
 *     responsible for modeling redemption if they intend to vault → paper.
 *   - Solana network fees (~$0.0005/tx — negligible).
 *
 * Sources verified 2026-05-20:
 *   - Magic Eden: 2% taker, 0% listing, optional royalties
 *     https://help.magiceden.io/en/articles/5858632
 *   - Collector Crypt: listings route through Magic Eden M2 program
 *     (per docs/RWA-RECON.md), so ME fees apply directly.
 *   - Phygitals: unverified. Defaults to ME-equivalent until 4i recon.
 */

export interface MarketplaceFeeConfig {
  /** Matches `listings.source` column. */
  source: string;
  /** Matches `listings.marketplace` (ME's listingSource field — e.g. "M2"). null = default for source. */
  marketplace: string | null;
  /** Taker fee as a fraction (0.02 = 2%). Applied to the ask price. */
  takerFeePct: number;
  /** Default royalty applied when the buyer opts to honor it. As a fraction. */
  defaultRoyaltyPct: number;
  /** Free-form pointer to the source-of-truth for these numbers. */
  sourceDoc: string;
}

const FEES: MarketplaceFeeConfig[] = [
  {
    source: "magic-eden",
    marketplace: "M2",
    takerFeePct: 0.02,
    defaultRoyaltyPct: 0,
    sourceDoc: "https://help.magiceden.io/en/articles/5858632 (2% taker, royalties optional)",
  },
  {
    source: "magic-eden",
    marketplace: "MMM",
    takerFeePct: 0.02,
    defaultRoyaltyPct: 0,
    sourceDoc: "ME MMM pools — same 2% taker as M2",
  },
  {
    source: "magic-eden",
    marketplace: null,
    takerFeePct: 0.02,
    defaultRoyaltyPct: 0,
    sourceDoc: "ME default (any listingSource)",
  },
  {
    source: "collector-crypt",
    marketplace: null,
    takerFeePct: 0.02,
    defaultRoyaltyPct: 0,
    sourceDoc: "CC listings route through ME M2 — ME fees apply",
  },
  {
    source: "phygitals",
    marketplace: null,
    takerFeePct: 0.02,
    defaultRoyaltyPct: 0,
    sourceDoc: "TBD — defaulting to ME-equivalent; verify in Step 4i",
  },
];

const FALLBACK: MarketplaceFeeConfig = {
  source: "unknown",
  marketplace: null,
  takerFeePct: 0.02,
  defaultRoyaltyPct: 0,
  sourceDoc: "Unmapped source — conservative ME-equivalent default",
};

/**
 * Resolve fees for a given listing. Prefers the most specific match:
 *   1. (source, marketplace) exact
 *   2. (source, null) default for source
 *   3. global fallback
 */
export function getMarketplaceFees(
  source: string | null | undefined,
  marketplace: string | null | undefined
): MarketplaceFeeConfig {
  if (!source) return FALLBACK;
  const specific = FEES.find(
    (f) => f.source === source && f.marketplace === (marketplace ?? null)
  );
  if (specific) return specific;
  const sourceDefault = FEES.find(
    (f) => f.source === source && f.marketplace === null
  );
  if (sourceDefault) return sourceDefault;
  return FALLBACK;
}

export interface ProfitBreakdown {
  /** paper_price - ask (no fees applied) */
  gross_usd: number;
  /** ask × takerFeePct */
  taker_fee_usd: number;
  /** ask × royaltyPct (zero unless honor_royalties=true and source has nonzero royalty) */
  royalty_usd: number;
  /** gross - taker_fee - royalty. Onchain-side net only; paper-side resale fees not included. */
  net_usd: number;
  /** Applied fee config for transparency in the response. */
  fee_config: {
    source: string;
    marketplace: string | null;
    taker_fee_pct: number;
    royalty_pct: number;
    source_doc: string;
  };
}

export function computeNetProfit(opts: {
  paperPriceUsd: number;
  askUsd: number;
  source: string | null | undefined;
  marketplace: string | null | undefined;
  /** When true, apply the marketplace's default royalty. Default false (most arbitrage bots opt out). */
  honorRoyalties?: boolean;
}): ProfitBreakdown {
  const cfg = getMarketplaceFees(opts.source, opts.marketplace);
  const royaltyPct = opts.honorRoyalties ? cfg.defaultRoyaltyPct : 0;

  const takerFee = opts.askUsd * cfg.takerFeePct;
  const royalty = opts.askUsd * royaltyPct;
  const gross = opts.paperPriceUsd - opts.askUsd;
  const net = gross - takerFee - royalty;

  return {
    gross_usd: round2(gross),
    taker_fee_usd: round2(takerFee),
    royalty_usd: round2(royalty),
    net_usd: round2(net),
    fee_config: {
      source: cfg.source,
      marketplace: cfg.marketplace,
      taker_fee_pct: cfg.takerFeePct,
      royalty_pct: royaltyPct,
      source_doc: cfg.sourceDoc,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
