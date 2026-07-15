# Jupiter Gacha Expansion — Spec Index

Jupiter launched **Jupiter Gacha** ([jup.ag/gacha](https://jup.ag/gacha)) on **2026-07-13**: a beta where users open digital packs to pull graded Pokemon / One Piece cards tokenized on Solana, backed by physical slabs. Built **in partnership with Collector Crypt, using Phygitals tech** — the same two platforms CardEx's Phase 8 ingestion already targets. Season 1 runs ~4 weeks with a $100K rewards pool and a spend-ranked leaderboard.

Pack tiers observed at launch: `pokemon_25`, `pokemon_50`, `pokemon_250`, `pokemon_2500` (pack prices are dynamic during beta).

## Specs (ship in order)

| # | Spec | One-liner | Revenue shape |
|---|---|---|---|
| 01 | [Pack EV Engine](01-gacha-pack-ev-engine.md) | "Is this pack +EV right now?" — live EV per pack tier, free dashboard + x402 API | Distribution/visibility first, per-query second |
| 02 | [Post-Pull Decision Engine](02-post-pull-decision-engine.md) | "You pulled it. Now what?" — four-way exit optimizer (buyback / list / hold / redeem) | Per-query x402, portfolio premium tier |
| 03 | [Offerbook Collateral Oracle](03-offerbook-collateral-oracle.md) | Fair-value + LTV + integrity oracle for card-backed USDC lending on Jup Offerbook | B2B/infrastructure — the strategic prize |

All three share one **exit-valuation core** (paper comp vs buyback vs fee-netted secondary vs redemption), built once as a library on top of the existing CardEx fair-value machinery.

## Sequencing logic

Spec 01 manufactures visibility during the compressed Season 1 window; Spec 02 monetizes that audience at the individual-card decision moment and becomes the substrate any flipping agent consumes; Spec 03 converts the accumulated track record into sticky lending-infrastructure revenue. One core, three products, ascending stickiness.

## Known dependencies from current CardEx state (2026-07-14)

- **Mint→card resolution is ~16%** (see `docs/CHECKPOINT.md`) — gacha pool pricing requires resolving pool mints to catalog cards; this is the critical-path fix.
- **No graded prices loaded** — gacha cards are graded slabs; Pokemon Price Tracker ingestion (free tier for pool-scoped coverage, Business tier before commercial resale) is required for EV numbers to be honest.
- Positioning rule (all three specs): transparency tooling, not spend inducement. An honest engine frequently says "-EV". Read-only analytics until gacha ToS is reviewed.
