# Phase 8 — Tokenized RWA Oracle

**Goal:** Ship the smallest credible version of the agentic-commerce wedge — paper-vs-onchain price oracle for Solana-native tokenized cards, with at least one paying bot user.

**Non-goals:** Cross-chain coverage. Lending-protocol push feeds. Dashboard rebuild. Pokemon retail price perfection. We are building for a programmatic consumer that wants a stable JSON response, not a pretty UI.

---

## Definition of Done

Phase 8 is complete when **all** of these are true:

1. Pokemon paper-market prices are ingested daily and stored as `PricePoint` rows alongside MTG.
2. Active Collector Crypt + Phygitals + Magic Eden pNFT listings are indexed continuously into a `listings` table with freshness timestamps.
3. `POST /api/v1/rwa-fair-value` returns paper price, onchain ask, spread %, and freshness for any indexed mint — in <500ms p95.
4. `POST /api/v1/rwa-arbitrage` returns a sorted list of underpriced active listings with net profit after marketplace fees.
5. A batch variant of `rwa-fair-value` accepts up to 50 mints/call.
6. At least one external bot user has paid for ≥100 queries against the mainnet endpoint.
7. Phase 9 (autonomous trading) is unblocked — we have everything our own bot would need to consume.

If any of items 1-5 are shipped without item 6, we haven't validated the wedge yet — that's the gate, not code volume.

---

## Build Sequence

Ordered so each step de-risks the next. Don't skip ahead.

### Step 0 — Recon (1-2 days, no code beyond probes)

Before writing any ingestion adapter, answer these in writing:

- **Collector Crypt:** What program ID handles marketplace listings? Is there a public TypeScript SDK or do we read program logs via Helius `enhanced-transactions`? What does a listing event look like? How are pNFTs linked to physical card metadata (set, number, grade)?
- **Phygitals:** Same questions. Is the volume worth the integration effort, or do we skip MVP?
- **Magic Eden Solana:** Does the public REST API (`api-mainnet.magiceden.dev/v2`) expose active listings for Collector Crypt + Phygitals collections? Confirm the 120 QPM ceiling. Can we filter to a single collection's listings?
- **Mint → card identity:** How do we map a Solana pNFT mint to a row in our `collectibles` table? Is the card name/set in onchain metadata, or do we need a manual mapping table seeded from the platform?

**Output:** a short `docs/RWA-RECON.md` capturing answers. If this step shows that direct program indexing is a multi-week build, fall back to Magic Eden as the sole listings source for MVP — it's the read surface their own users already trust.

### Step 1 — Pokemon paper-price ingestion (2-3 days)

Catalog is already seeded (20,078 cards, 171 sets). We just need prices.

- **Primary candidate:** PriceCharting API — confirm API access, pricing tier, freshness, condition granularity.
- **Fallback:** `pokemontcg.io`'s embedded `tcgplayer` field on each card — already free, may have market/low/mid/high.
- **Aspirational:** eBay Browse API for sold listings (requires app token + title parsing for condition). Defer to Step 5 if needed.

Implementation:
- `src/lib/ingestion/pokemon-pricing.ts` (new) — adapter modeled on existing `cardhoarder.ts`
- Cron route `src/app/api/cron/ingest-pokemon-prices/route.ts`
- Re-run snapshot aggregation cron to roll the new price points into `market_snapshots`

**Exit:** `POST /api/v1/price` with `game=pokemon` returns real prices for ≥80% of seeded cards.

### Step 2 — Listings schema + Magic Eden adapter (3-4 days)

New table `listings` — onchain marketplace state, append-only with `expired_at`:

```
listings
├── id (uuid)
├── source ('magic-eden' | 'collector-crypt' | 'phygitals')
├── chain ('solana')
├── mint_address (text, indexed)
├── seller (text)
├── price_usdc (decimal)
├── price_sol (decimal, nullable)
├── listed_at (timestamp)
├── observed_at (timestamp)
├── expired_at (timestamp, nullable)
├── collectible_id (fk → collectibles, nullable until mapped)
└── raw (jsonb — source-specific payload for debugging)
```

Plus a mapping helper `mint_card_map` for mint → collectible_id resolution. Seed with whatever per-platform identity hooks Step 0 surfaced.

Adapter:
- `src/lib/ingestion/magic-eden.ts` — pulls active listings for Collector Crypt + Phygitals collection mint authorities, paginated
- Runs every **20-30 min** via Railway cron — Step 0 recon found the 10-15 min cadence exceeds ME's 120 QPM ceiling by 2.75-3.4x (see `docs/RWA-RECON.md` §5). Helius webhook on M2 is the documented migration path if freshness becomes a complaint.
- Wrap ME calls behind a `MagicEdenClient` interface — v2 has a deprecation notice; expect v4 swap within 6 months.
- Slugs to start with: `collector_crypt` (filter by `Category == "Pokemon"` attribute). Phygitals slug TBD — `phygitals_collectibles` returns 0 listed; live slug not yet found (recon action item §7.3).
- Seed initial `mint_card_map` via Helius `searchAssets` by `authorityAddress: DQPERZ9e86pNJ4mhUnCEP8V75yxZofsipoVrRWT5Wdxd` (CC update authority — gets all 122K mints, listed or not), not by paginating ME (only ~5,500 listed at any time).

**Exit:** `listings` table populated with ≥1K active rows; manual SQL verifies a few mints resolve to known cards.

### Step 3 — `rwa-fair-value` endpoint (2-3 days)

`POST /api/v1/rwa-fair-value` — $0.002 USDC on Solana.

Request:
```json
{ "mint": "...", "listing_url": "...", "currency": "usd" }
```

Response shape (stable — bots will hardcode this):
```json
{
  "mint": "...",
  "collectible": { "id": "...", "name": "...", "set": "...", "number": "..." },
  "paper_price": { "median_usd": 1234.56, "source_count": 4, "fresh_minutes": 240 },
  "onchain": {
    "best_ask_usd": 1100.00,
    "source": "magic-eden",
    "fresh_minutes": 12,
    "all_listings": [...]
  },
  "spread": { "percent": -10.85, "absolute_usd": -134.56, "direction": "onchain_below_paper" },
  "agent": { ... existing agentMeta() ... }
}
```

- Reuses `agentMeta()` and existing x402 gating
- Adds ETag + `Cache-Control: public, max-age=30` to make polling cheap for bots
- Returns 404 with `{ error: "mint_unknown" }` if mint isn't mapped — bots should retry later

**Exit:** Mainnet endpoint returns valid responses for 100 random sampled mints with <500ms p95.

### Step 4 — `rwa-arbitrage` endpoint + SolEnrich enrichment (3-4 days)

`POST /api/v1/rwa-arbitrage` — $0.005 USDC.

Request:
```json
{ "min_spread_percent": 10, "min_paper_price_usd": 50, "limit": 50, "include_seller_risk": true }
```

Response: array of underpriced listings sorted by **net profit after marketplace fees** (Magic Eden 2%, etc. — encode as a fees table per source). Each item carries the same fair-value payload as Step 3 plus:
- `net_profit_usd` — paper price minus onchain ask minus fees
- `seller_risk` — `{ score, level, labels }` from SolEnrich `due-diligence` (REQUIRED in response when `include_seller_risk` true)
- `seller_cluster` — `{ cluster_id, member_count, wash_trade_flag }` from SolEnrich `wallet-graph` (REQUIRED)

Pure SQL query against `listings` ⋈ `market_snapshots`, then enriched by SolEnrich calls — see SolEnrich integration block below.

**SolEnrich integration (load-bearing, not optional):**
- Extend `src/lib/solenrich/client.ts` with `walletGraph(address)` + `tokenDueDiligence(mint)` wrappers (mirror existing `enrichWalletLight` pattern). **Endpoint choice corrected 2026-05-20:** seller risk uses `enrich-wallet-light` (already in the client), NOT `due-diligence`. The OpenAPI spec confirms `due-diligence` takes a **token mint** and returns SAFE/CAUTION/RISKY on a token — wrong signal for a seller wallet. `tokenDueDiligence` is kept as a future hook for tokenized-mint program vetting (e.g. a compromised CC vault authority).
- Extend `src/lib/solenrich/types.ts` with response types
- New `seller_intel` cache table: `(wallet_address PK, risk_payload jsonb, risk_fetched_at, cluster_payload jsonb, cluster_fetched_at, created_at)` with 6h TTL. Per-payload `fetched_at` so a failed risk fetch ($0.002) doesn't burn the wallet-graph cache ($0.010) and vice versa.
- Cache-first lookup — same seller across 50 listings should hit SolEnrich once. **This is the margin lever.** Without caching, cost per cold-only scan exceeds per-call revenue.
- Graceful degradation — if SolEnrich is down or `SOLANA_PRIVATE_KEY` unset, response includes the listings but seller_risk/seller_cluster come back as `{ unavailable: true }`. Mirror the pattern from `wallet-insight`.
- Wash-trade filter — when `seller_cluster.wash_trade_flag === true` (or whatever the live shape ends up calling it — schema not in the public OpenAPI), drop the opportunity from results by default; add `include_wash_trades: true` request flag to expose them anyway.

**Cost math** (revised against the corrected endpoint choice):
- Cold seller: $0.002 (`enrich-wallet-light`) + $0.010 (`wallet-graph`) = **$0.012 SolEnrich cost** (down from the original $0.030 plan against `due-diligence`)
- Per-call revenue on `rwa-arbitrage`: $0.005 (one POST = one price)
- 50-listing scan, all unique sellers, all cold: 50 × $0.012 = $0.60 cost / $0.005 revenue = **loss of $0.595**. Cache is mandatory.
- 50-listing scan, 5 unique sellers (typical recurrence), all cold: 5 × $0.012 = $0.060 cost / $0.005 revenue = still a loss. Cache is mandatory across calls too.
- 50-listing scan, 5 unique sellers, warm cache: ~$0 cost / $0.005 revenue = $0.005 profit per call. The cache hit rate is the entire business — without ≥90% hit rate on cold seller calls, raise the per-call price or move to per-result pricing.
- **Decision deferred to Step 4f:** per-call vs per-result pricing. Per-result (e.g. $0.0015 per opportunity returned) scales revenue with SolEnrich costs and matches the original plan math; per-call is simpler for bots. Choose at endpoint-build time based on real seller-recurrence sampling.

**Exit:** Returns ≥5 plausible opportunities in any 24h window at 10% threshold, wash-trade cluster correctly filtered in ≥1 documented case.

### Step 5 — Bot-friendly affordances (2-3 days)

These are what separate "API" from "infrastructure":

**Required:**
- **Batch endpoint** `POST /api/v1/rwa-fair-value/batch` — accepts up to 50 mints, charges $0.0015/mint
- **ETag + If-None-Match** on all RWA endpoints
- **Public OpenAPI spec** at `/api/openapi.json` covering RWA endpoints
- **TypeScript SDK example** in `examples/rwa-bot.ts` — a 50-line script that polls `rwa-arbitrage`, prints opportunities, pays via `@x402/fetch`, and shows the `seller_risk` filtering

**On-demand (build only if outreach surfaces a bot user who asks for it):**
- **Bundled `POST /api/v1/listing-due-diligence`** ($0.03-0.04) — single-call wrapper combining fair-value + SolEnrich due-diligence + wallet-graph for one listing. Margin is tight; this is a convenience pitch ("one call, one decision"), not a moat. Don't build until a specific bot operator says they want it.
- **Webhook variant** — bot registers a callback, gets pushed arbitrage events. Real-time push is operationally heavier than polling; defer until ≥3 bots ask.
- **Output format flexibility** — JSON / natural-language briefing / hybrid (mirror SolEnrich's pattern). Cheap to add, but unproven demand from bot consumers. Add when there's a non-bot consumer (LLM agent in Claude/Cursor) asking.
- **`feed-latest` daily brief** ($0.005) — mirror SolEnrich's pattern for cards. Easy build, unclear demand. Park here.

### Step 6 — Design-partner outreach (parallel to Step 1-5)

The gate on calling Phase 8 done. Start now, not at the end.

- **Targets:** Magic Eden floor-sniping bot operators, Collector Crypt arbitrage bots, Solana NFT trading Discords, r/CryptoCurrency tokenized-RWA threads.
- **Pitch:** "I'm building a paper-vs-onchain price oracle for tokenized Pokemon on Solana. Free credits for the first 5 users in exchange for feedback. Here's a 50-line example script that scans Collector Crypt for underpriced listings."
- **Goal:** one named user paying for ≥100 mainnet calls. That's the signal that the wedge works.
- **Anti-goal:** generic 'come check us out' posts. We want one design partner, not 50 lurkers.

---

## Open Questions (must answer before Step 1)

1. **PriceCharting access** — do they have a public API, pricing tier we can afford, and a usage license that allows redistribution via paid API? If not, fallback chain is `pokemontcg.io tcgplayer field` → `eBay Browse` → manual.
2. **Collector Crypt program access** — is there public documentation, a TS SDK, or do we have to reverse-engineer from a known listing tx? Magic Eden is the cheap fallback if recon is too deep.
3. **Phygitals MVP inclusion** — they're small (~$2M/mo). Skip for MVP if Step 0 shows integration is more than 2 days of work.
4. **Mint identity** — does Collector Crypt encode card metadata (set, name, number, grade) onchain in the pNFT metadata, or only via offchain JSON? If offchain, we need their CDN to be reliable or build our own indexer.
5. **SolEnrich cache hit rate** — in practice, how often do the same seller wallets recur across an arbitrage scan? If recurrence is low, margin compresses fast. Sample real Collector Crypt listing data in Step 0 recon to estimate.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Magic Eden rate-limits us into incompleteness | Medium | Stagger polls per collection, cache aggressively, fall back to direct program indexing if it bites |
| PriceCharting too expensive or rate-limited | Medium | Use `pokemontcg.io` embedded prices for MVP; revisit at scale |
| No bot users respond to outreach | High | This is the wedge gate — if no one bites, the positioning needs rethinking before Phase 9. Better to learn now than after building autonomous trading. |
| Collector Crypt builds the same oracle internally | Low | Our moat is offchain depth (Cardhoarder, Scryfall, future eBay/TCGPlayer) — they'd have to replicate the catalog work. Also: conflict of interest as a platform pricing its own inventory. |
| Tokenized card market cools off | Medium | Phase 9 dogfood + existing paper-market endpoints keep the business going. The oracle becomes a wedge for adjacent verticals (sports cards once they tokenize). |
| SolEnrich downtime degrades `rwa-arbitrage` premium signal | Medium | Graceful degradation pattern from `wallet-insight` — return listings with `seller_risk: { unavailable: true }`. Don't fail the call. CardEx SLA is now bounded by SolEnrich's; accept that consciously. |
| SolEnrich margin compression on `rwa-arbitrage` | Medium | Aggressive 6h cache on seller intel. If real-world hit rate <60%, either raise endpoint price to $0.008 or extend TTL. Worst case: make seller_risk opt-in via `include_seller_risk: false` default. |

---

## Timeline (calendar weeks, single operator with Claude Code)

| Week | Step | Output |
|---|---|---|
| 1 | Step 0 + Step 1 kickoff + **Step 6 outreach starts** | `docs/RWA-RECON.md`, Pokemon pricing adapter scaffold, first outreach posts in Solana trading Discords |
| 2 | Step 1 finish + Step 2 | Pokemon prices live, listings table + Magic Eden adapter running |
| 3 | Step 3 | `rwa-fair-value` shipped on mainnet |
| 4 | Step 4 (with SolEnrich enrichment) | `rwa-arbitrage` + seller_risk + cluster filter |
| 5 | Step 5 required affordances | Batch endpoint + ETag + OpenAPI + SDK example |
| 6 | Outreach push + on-demand Step 5 stretches | First paying bot user, OR positioning rethink if no traction |

Anything past Week 6 with no paying user is a signal to step back, not push harder. On-demand Step 5 items (`listing-due-diligence`, webhook, briefing format, `feed-latest`) are built *only when a specific bot operator requests them* — not on speculation.
