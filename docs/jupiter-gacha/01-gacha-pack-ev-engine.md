# CardEx Pack EV Engine
## Live expected-value pricing for Jupiter Gacha packs

| Field | Detail |
|---|---|
| **Product** | CardEx Pack EV Engine ("Is this pack +EV?") |
| **Parent** | CardEx (cardex.up.railway.app) |
| **Ecosystem** | Jupiter Gacha (jup.ag/gacha), Season 1 |
| **Author** | Justin |
| **Status** | Sketch v0.1 — July 2026 |
| **Target ship** | Weekend build (reuses CardEx fair-value core) |

---

## 1. One-liner

A public, live dashboard and x402 API that computes the expected value of every Jupiter Gacha pack tier by pricing the entire card pool against fee-netted paper-market truth — answering the question every ripper has before they click: **"Is this pack +EV right now?"**

## 2. Why this wins

Jupiter Gacha launched with a four-week Season 1, a battlepass, and a spend-ranked leaderboard. Every user on that page is making a repeated financial decision (open another pack or don't) with zero pricing transparency. Comparable platforms in this exact ecosystem market their gachas as "+5 to +10% EV," but nobody independently verifies that claim in real time, and pack EV drifts constantly as paper prices move and the card pool depletes. CardEx already holds the two ingredients nobody else has together: fair value for 110K+ indexed cards priced against TCGPlayer/CardMarket/eBay comps, and the fee-netting logic that turns headline value into realizable value.

This is also the visibility engine for everything else. An EV dashboard is inherently shareable — "the $250 Legendary pack just flipped to +EV" is a tweet, a Discord ping, and a reason for the Jupiter community to know the CardEx name before you pitch them the oracle play (Spec 03).

## 3. Core mechanic

EV per pack is a weighted sum: for each card `i` in the pack's pool, take pull probability `p(i)` times realizable value `v(i)`, minus pack cost.

The interesting engineering is in `v(i)`, and it's exactly the CardEx thesis. Realizable value is not the sticker price — it's the best of three exits, each netted differently: the instant buyback quote (a standing on-chain offer, typically 85–90% of indexed value in this ecosystem), the Magic Eden secondary listing net of marketplace fees and expected time-to-fill, and physical redemption net of vault withdrawal, shipping, and insurance against the raw paper comp. CardEx's fair-value endpoint already produces the paper comp; this product adds the exit-comparison layer and the probability weighting.

Where pull odds are published on-chain or in pack metadata, ingest them directly. Where they aren't, estimate them empirically: index reveal transactions from the gacha program and build observed pull-frequency tables per pack tier. The empirical approach is actually a moat — it self-corrects if published odds and observed odds diverge, and "observed odds vs stated odds" is itself a killer transparency feature.

## 4. Product surfaces

**Public dashboard (free, the growth engine).** One page per pack tier showing current EV (absolute and %), sparkline of EV over the season, top-10 chase cards in the pool with live paper comps, observed pull-rate table, and a "last flipped +EV at…" timestamp. Free because its job is distribution, not revenue.

**Alerts.** Discord/Telegram webhook and bot: "Pokemon Gold pack crossed +EV," "chase card X just repriced +18% on paper — pool EV up." This is the retention loop and drives users back during the four-week season window.

**x402 API (the revenue layer).** Per-query endpoints consistent with existing CardEx pricing (~$0.001/query): `GET /gacha/ev?pack=pokemon_50`, `GET /gacha/pool?pack=…` (full priced card pool), `GET /gacha/odds?pack=…` (observed vs stated). Consumers are trading agents, Discord bot devs, and content creators — the same early-adopter segment identified in the original CardEx PRD.

## 5. Architecture sketch

Three new components on top of the existing CardEx stack. A **pool indexer** that maps each gacha pack to its card pool (scrape pack pages + parse on-chain metadata from the gacha program; refresh on restocks). An **odds engine** that ingests reveal transactions via a Solana RPC/webhook subscription and maintains per-tier pull-frequency tables. An **EV composer** that joins pool × odds × CardEx fair-value and exposes the dashboard and x402 endpoints. Everything downstream of the join is existing CardEx machinery: fee netting, paper comps, caching, x402 gating.

## 6. MVP scope (ship this weekend)

Version one is a single pack tier (the $50 Pokemon pack — highest volume, most relatable), manual pool ingestion if on-chain parsing is slow, stated odds only (empirical odds in v1.1), one dashboard page, and one x402 endpoint. Ship, tweet the first "+EV window" screenshot, then widen to all tiers.

## 7. Risks and honest caveats

Pack pools and odds can change without notice mid-season — the indexer needs restock detection, and every EV figure should carry a "pool as of" timestamp. Empirical odds need sample size before they're publishable; show confidence intervals or hold until n is respectable. And position the product carefully: this is transparency tooling for a randomized-purchase product, not an inducement to spend — an honest EV engine will frequently say "this pack is -EV right now," and that honesty is precisely what builds the CardEx reputation the oracle play depends on. Check the gacha ToS before any feature that automates purchasing; read-only analytics is the safe lane.

## 8. Success metrics (Season 1 window)

Dashboard uniques during the four-week season, alert subscribers, x402 query volume on the gacha endpoints, and at least one organic share by a Jupiter-ecosystem account. Secondary: inbound interest that converts to Spec 02/03 conversations.
