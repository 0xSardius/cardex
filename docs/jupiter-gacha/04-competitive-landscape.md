# Gacha Landscape & Feature Additions (researched 2026-07-15)

## Key discoveries

### 1. Collector Crypt has an official Gacha Machine API — use it, don't reverse-engineer
[docs.collectorcrypt.com/gacha/api](https://docs.collectorcrypt.com/gacha/api). Partner API key (`x-api-key`) gets:
- `/api/machines` — full config + live stock per machine: **odds per rarity tier** (`{epic: 0.01, rare: 0.04, ...}`), pricing, stock counts by tier, and an `ev` field = "rarity-weighted expected **insured** value"
- `/api/getAllWinners` / `/api/getWinners` — filterable, paginated pull history with timestamps
- NFT metadata incl. **insured values** per card

Since Jupiter Gacha is built with Collector Crypt (Phygitals tech), the same machine infra almost certainly backs it. **Spec 01's pool indexer + odds engine collapse into API calls** for MVP; on-chain reveal indexing becomes a verification layer, not the foundation. Requesting a partner key is also a partnership conversation-starter.

Critical nuance: the platform's `ev` is computed against **its own insured values** — a number the platform sets. CardEx's entire differentiation is EV against *independent* paper truth (eBay sold, TCGPlayer), fee-netted to realizable exits.

### 2. RipIndex — the direct competitor (and possibly the first customer)
[rip-index.com](https://rip-index.com/) — free, no-login tracker of **7 gacha platforms** (Collector Crypt 175K+ pulls, Phygitals, Courtyard, Beezie, GachaPull, Monster, Tilt Rips). Features: live pull feeds, big-hit-rate by hour, EV drift (6h vs 48h), Telegram restock/big-pull alerts, best-pack rankings, published-vs-realized odds, paper-trading sim.

- **Does NOT track Jupiter Gacha yet** (launched 7/13) — speed window
- **No stated valuation methodology** — appears to lean on platform values; no paper-market comps, no fee-netted exit math
- **No API** — pure consumer dashboard
- Implication A: don't build the empirical-odds/pull-feed lane first — RipIndex owns it and it's free
- Implication B: **RipIndex needs exactly what CardEx sells** (independent card valuations). They're a candidate for the Phase 8 "one named design partner" as an x402 API customer, not a rival

### 3. Offerbook is live and explicitly oracle-less
Offerbook ([offerbook.jup.ag](https://offerbook.jup.ag/tokens/borrow)) launched graded-slab collateral in **June 2026**: fixed-term 1–30 day USDC loans, no price-based liquidations, and — per Jupiter's own docs — **"without relying on price oracles."** Every lender is doing their own valuation by hand. That's the Spec 03 lender-terminal wedge, validated: sell valuation to lenders directly; protocol integration comes later. Press coverage already describes the pull → lend/buyback/hold loop that Spec 02 optimizes.

### 4. Non-crypto substitutes
Anime-game gacha calculators ([gachacalc.com](https://gachacalc.com/), pity calculators, etc.) prove the "is this pull worth it" mental model is mainstream, but none touch RWA/tokenized cards or real dollar EV.

## Crowdedness verdict

| Lane | Crowdedness | Occupant |
|---|---|---|
| Pull tracking / observed odds / restock alerts | **Moderate** | RipIndex (free, good, 7 platforms) |
| Platform-published EV | Occupied by definition | Collector Crypt's own API |
| **Independent paper-truth, fee-netted EV** | **Empty** | ← CardEx |
| **Rewards-adjusted EV (Season 1 specific)** | **Empty** | ← CardEx |
| Post-pull exit optimization | **Empty** | ← CardEx (Spec 02) |
| Lender-side collateral valuation for Offerbook | **Empty** | ← CardEx (Spec 03) |
| Jupiter Gacha coverage of any kind | **Empty (days-old)** | first mover available |

## Feature additions (beyond the three specs)

### Differentiation (build into Spec 01)
1. **"Platform EV vs Paper EV" gap meter** — headline metric on every pack page: CC's insured-value EV next to CardEx's fee-netted paper-truth EV, with the delta. The one number neither RipIndex nor the platform can publish. Every divergence is a tweet.
2. **Rewards-adjusted EV** — Season 1 has a $100K rewards pool + battlepass + spend leaderboard. Effective EV = pack EV + expected loyalty/rewards value per dollar. Nobody computes this; it's the honest answer to "should I rip during Season 1 specifically."
3. **Skip empirical odds for MVP** — CC API publishes stated odds; RipIndex owns observed-odds. Revisit only as a verification feature ("API odds vs on-chain reveals") later.

### Distribution (get users)
4. **Discord/Telegram bot** — free `/ev <pack>` and `/verdict <mint>` commands deployable into Jupiter & Collector Crypt community servers. RipIndex's Telegram traction proves the channel. The bot is the dashboard where the users already live.
5. **OG-image endpoints** — every pack EV state and every Spec 02 verdict renders as a shareable image URL. "+EV flip" screenshots and "I saved $40" verdict cards are the acquisition loop; make them one-click.
6. **Grail-pull enriched alerts** — when the winners feed shows a chase-card pull, push an alert with realizable value + best exit attached. Rides every hype moment with CardEx's name on it.
7. **Leaderboard P&L intel** — the spend-ranked leaderboard is public; compute "top rippers: spent vs realizable pulled" using CardEx values + SolEnrich wallet reads. Highly viral; handle diplomatically (transparency framing, not platform-shaming) given the Jupiter partnership goal.
8. **CardEx MCP server** — mirror SolEnrich's shipped MCP. "Is the Gold pack +EV right now?" answerable inside Claude/Cursor. Cheap to build given the sibling precedent; feeds the agent-first narrative and the cross-marketing story.

### Sequencing note
RipIndex-as-customer reframes Phase 8 Step 6 (design-partner outreach): a free consumer tracker with no valuation methodology and no API is the most natural first buyer of `rwa-fair-value` / gacha EV endpoints via x402.
