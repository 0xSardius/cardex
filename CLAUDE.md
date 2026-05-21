# CardEx — Project Guide

## What is this?

CardEx is a Solana-native pricing oracle for tokenized collectibles. It serves **autonomous trading agents** that arbitrage tokenized cards (Collector Crypt, Phygitals, Magic Eden pNFTs) against the paper market (Scryfall, MTGO, Cardhoarder, eBay/TCGPlayer). Every query is paid per-call via x402 in USDC on Solana. The agent has a verifiable onchain identity via ERC-8004 on Solana.

**One-liner:** The price oracle that tokenized-card trading agents use — paper-market truth + onchain marketplace state, served per-query via x402 on Solana.

## Strategic Vision

The tokenized collectibles market is one of the most successful onchain RWA categories — $124.5M/mo across Collector Crypt + Phygitals (Aug 2025) and growing. The same physical Charizard now lives on multiple chains, listed on multiple marketplaces, with prices that diverge constantly. **Trading bots need a neutral oracle that knows both the onchain and paper sides.** No platform can credibly build it because they're all conflicted.

CardEx is that oracle. Solana-native, x402-gated, agent-first.

### Why this positioning

- **The buyer pays per-query.** Trading bots scanning 10K Magic Eden / Collector Crypt listings/day at $0.001 each ≈ $300/mo per bot. That matches x402 economics. Human collectors and lending protocols don't pay that way.
- **The moat is offchain depth.** Collector Crypt knows what's listed *on Collector Crypt*. It doesn't know what the same card trades for on Cardhoarder, what the MTGO spread implies, or what eBay sold yesterday. CardEx does — and that's unreproducible without the catalog + ingestion work already done.
- **The chain matches the user.** 49% of x402 transactions are on Solana, 77% of AI agent volume is on Solana, and the largest tokenized-card platforms (Collector Crypt, Phygitals) are Solana-native. Bots live where their assets live.
- **Two surfaces, same data.** Same endpoints serve agents (primary, paid) and humans (dashboard demo, free tier). The dashboard exists to prove the API works, not as the product.

### Who CardEx is *not* for

- Lending protocols wanting a Pyth-style push feed (different sales motion, different SLA — revisit when there are ≥10 paying bot users)
- Human collectors browsing prices (they're the demo audience, not the customer)
- Pure digital NFT pricing (NBA Top Shot, Candy Digital — out of scope)

### Game priority

- **Pokemon first** for the agentic-commerce wedge — it's the only game with meaningful tokenized volume ($124.5M/mo). All RWA arbitrage opportunity is here.
- **MTG offchain remains the moat** — Scryfall + Cardhoarder + (future) eBay/TCGPlayer give CardEx the only cross-game offchain pricing depth on Solana. When MTG tokenization eventually arrives (WotC is currently hostile), CardEx is already positioned.
- **No cross-chain in Phase 8.** Polygon (Courtyard), Base (Slab.fun), BNB, Flow are real but deferred — bots live on Solana, and one paying bot user beats five chains of speculative coverage.

### Game-specific data sources

| Source | Pokemon | MTG | Shared |
|---|---|---|---|
| Catalog seed | pokemontcg.io | Scryfall (bulk download) | — |
| TCGPlayer pricing (raw) | Yes (via pokemontcg.io) | Yes (via Scryfall) | — |
| CardMarket trend (raw) | Yes (via pokemontcg.io) | Yes (via Scryfall) | — |
| PSA graded prices | Yes (Pokemon Price Tracker) | — | — |
| CGC / BGS graded | Planned (Pokemon Price Tracker) | — | — |
| eBay sold listings | Planned | Planned | Yes |
| Card Kingdom buylist | — | Deferred (needs scraping) | — |
| MTGO prices | — | Yes (Cardhoarder CSV) | — |
| Japanese market | Mercari JP | Hareruya (scrape) | — |

#### Pokemon Price Tracker (graded prices) — tier policy

[pokemonpricetracker.com](https://www.pokemonpricetracker.com/pokemon-card-price-api) is the source for graded PSA/CGC/BGS Pokemon prices, sourced from eBay completed listings. The endpoint shape matches our schema: `card_id` = `{set_code}-{card_number}` = our `collectibles.external_id`. Adapter lives at `src/lib/ingestion/pokemon-price-tracker.ts`.

| Tier | Cost | Daily credits | Req/min | Commercial use | When |
|---|---|---|---|---|---|
| Free | $0 | 100 | 60 | **No** | Dev / smoke testing only |
| API | $9.99/mo | 20,000 | 60 | **No** | Never — non-commercial blocks our use case |
| Business | $99/mo | 200,000 | 500 | Yes (with licensing) | **Required before mainnet flip** |

**Key constraints:**
- Free-tier coverage is sparse (80 lookups/day under a 100/day cap leaves 20 for ad-hoc). The cron prioritizes cards with active Collector Crypt listings — meaningful coverage will track listings, not catalog breadth.
- The adapter does **not** call this API on the hot path. Graded prices are pre-ingested into `price_points` with `source='pokemonpricetracker_psa'` and queried locally from `rwa-fair-value` / `rwa-arbitrage`. Bot latency is unaffected by upstream throttling.
- **Known gap:** the v0 adapter only wired the PSA endpoint. The vendor advertises PSA + CGC + BGS support; the CGC/BGS endpoint shapes were not in the public docs at integration time. Until they're added, CGC- and BGS-graded mints fall back to raw paper pricing in `rwa-fair-value` and are surfaced as `condition_basis: "raw_fallback"`.
- On the Business tier, full nightly refresh of the 16,380 Pokemon catalog takes ~33 min at 500 req/min. Stale by up to 24h — acceptable for the arbitrage cadence we sell, not for a millisecond push feed.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Agent Runtime | Lucid Agents (Daydreams) — commerce SDK with built-in x402/ERC-8004 support |
| Database | PostgreSQL via Neon (+ pgvector for fuzzy search) |
| Cache | Redis via Upstash |
| Chain | Solana (USDC payments) |
| Payments | x402 via `@x402/svm` + Lucid Agents payment policies |
| Agent Identity | ERC-8004 on Solana via `8004-solana` (Metaplex Core NFTs + SATI v2) |
| AI | Vercel AI SDK (via Daydreams), Claude Sonnet 4.5 (analysis/vision), Claude Haiku 4.5 (routing) |
| Scraping | Playwright + Browserbase |
| Jobs | Inngest or Trigger.dev |
| Agent Hosting | Phala or Railway (always-on agent process) |
| Site Hosting | Vercel (Next.js dashboard for human users) |
| Monitoring | Helicone + OpenTelemetry |

## Key Packages

- `@daydreamsai/core` — Daydreams agent framework (composable contexts, memory, MCP)
- `lucid-agents` — Commerce SDK (x402 gating, payment tracking, spending controls)
- `@x402/svm` — Solana x402 payment verification
- `8004-solana` — ERC-8004 agent identity on Solana (Metaplex Core NFTs)
- `ai` — Vercel AI SDK (underlying provider for Daydreams)
- `@neondatabase/serverless` — Neon PostgreSQL client

## Architecture

- **API-first, agent-first.** Every feature works headlessly via API before it gets a UI.
- **Agent on Railway.** The core agent runs as an always-on process on Railway — serves x402 API endpoints, runs scheduled ingestion via Railway Cron, manages reputation. Not serverless. No cold starts for agent-to-agent calls.
- **Site on Vercel.** A separate Next.js frontend for human users to search cards and view prices. Calls the agent's Railway API.
- **x402 via @x402/next + @x402/svm.** Payment gating handled by Coinbase's x402 SDK directly (not Lucid Agents — their packages bundle bun:sqlite and break Node builds). Payment events tracked in Neon `payment_events` table.
- **Split deploy confirmed.** Railway for agent (x402 API + cron), Vercel for dashboard (Phase 6). This matches the existing deployment diagram below.
- **Solana for payments.** USDC micropayments via `@x402/svm`. ~$0.00025/tx, ~400ms finality. Aligns with solenrich (sibling x402 project).
- **ERC-8004 on Solana.** Agent identity via Metaplex Core NFTs + SATI v2. Onchain reputation (accuracy, uptime, freshness) attached to every response.
- **Neon for data.** PostgreSQL with pgvector for fuzzy card search. Append-only PricePoints; daily MarketSnapshot aggregations.

## Deployment Model

```
┌──────────────────────────────────┐     ┌──────────────────────────┐
│  Railway                         │     │  Vercel                  │
│  (always-on agent)               │     │  (human-facing site)     │
│                                  │     │                          │
│  x402 API endpoints              │◄────│  Next.js dashboard       │
│  Railway Cron (daily ingestion)  │     │  Search + card detail    │
│  ERC-8004 reputation updates     │     │  Price charts            │
│                                  │     │                          │
└──────────────────────────────────┘     └──────────────────────────┘
         │                │
         ▼                ▼
  ┌────────────┐   ┌────────────┐
  │ Neon PG    │   │ Upstash    │
  │ + pgvector │   │ Redis      │
  └────────────┘   └────────────┘
```

## Project Structure (Target)

```
cardex/
├── src/
│   ├── app/                  # Next.js App Router — human-facing site (Vercel)
│   │   ├── (dashboard)/      # Dashboard pages (search, card detail, charts)
│   │   └── layout.tsx
│   ├── server/               # Agent server (Phala/Railway)
│   │   ├── index.ts          # Agent entrypoint
│   │   ├── routes/           # x402-gated API endpoints
│   │   │   ├── price.ts
│   │   │   ├── arbitrage.ts
│   │   │   ├── grade.ts
│   │   │   ├── portfolio.ts
│   │   │   └── set.ts
│   │   └── jobs/             # Scheduled ingestion pipelines
│   ├── lib/
│   │   ├── db/               # Neon client, queries, migrations
│   │   ├── cache/            # Upstash Redis helpers
│   │   ├── agent/            # Daydreams agent setup, contexts, memory
│   │   ├── x402/             # Lucid Agents payment config + policies
│   │   ├── erc8004/          # 8004-solana identity + reputation
│   │   ├── agents/           # Sub-agent logic (price resolver, arbitrage, grading)
│   │   ├── games/            # Game-specific config (catalog sources, field mappings)
│   │   │   ├── pokemon/      # pokemontcg.io seeding, Pokemon-specific normalization
│   │   │   └── mtg/          # Scryfall seeding, printing/treatment model, Card Kingdom
│   │   ├── ingestion/        # Shared data acquisition pipelines (TCGPlayer, eBay, etc.)
│   │   └── utils/            # Shared utilities
│   └── types/                # TypeScript type definitions
├── migrations/               # Neon SQL migration files
├── public/
├── cardex-prd.md             # Product requirements
├── cardex-design.md          # Architecture & data model
└── cardex-lean-canvas.jsx    # Lean canvas visualization
```

## Key Data Models

All models are **game-agnostic** — a `game` field (e.g. `pokemon`, `mtg`) scopes every entity.

- **Collectible** — Card metadata (name, set, rarity, era, image, game). For MTG: includes printing/treatment variants as sub-entities.
- **Set** — Card set info (code, series, era, release date, game)
- **PricePoint** — Immutable price observation (source, condition, price, timestamp)
- **MarketSnapshot** — Daily aggregation per card+condition (avg, median, low, high, trends)
- **ArbitrageOpportunity** — Cross-platform price gap with confidence + TTL
- **GradingEstimate** — Vision-based grade probabilities + ROI analysis
- **AgentReputation** — ERC-8004 onchain state via SATI v2 (queries served, accuracy, uptime)

### MTG catalog complexity note

MTG has ~86K unique printings (vs Pokemon's ~19K) and 1M+ SKUs when counting foil treatments (regular, foil, extended art, borderless, showcase, etched, surge, galaxy, textured). The data model must be **treatment-aware** — a `Printing` sub-entity links a card name to a specific set + treatment + foil status, each with independent pricing.

## API Endpoints (x402-gated)

All endpoints accept a `game` parameter (`pokemon` | `mtg`).

**Live (paper-market):**

| Endpoint | Price | Description |
|---|---|---|
| `POST /api/v1/price` | $0.001 | Single card price lookup |
| `POST /api/v1/arbitrage` | $0.005 | Cross-platform arbitrage scan (US/EU paper spread) |
| `POST /api/v1/grade` | $0.01 | Vision-based grading estimate |
| `POST /api/v1/portfolio/value` | $0.002/card | Portfolio valuation |
| `POST /api/v1/set/complete` | $0.008 | Set completion advisor |
| `POST /api/v1/wallet-insight` | $0.005 | Wallet intelligence via SolEnrich (agent-to-agent x402) |

**Planned (Phase 8 — tokenized RWA, bot-facing):**

| Endpoint | Price | Description |
|---|---|---|
| `POST /api/v1/rwa-fair-value` | $0.002 | Paper-vs-pNFT fair value for a single mint or listing |
| `POST /api/v1/rwa-arbitrage` | $0.005 | Scan onchain listings under paper market by ≥X% |
| `POST /api/v1/rwa-fair-value/batch` | $0.0015/mint | Batch fair-value for up to 50 mints/call (volume discount) |

## Development Conventions

- Use `src/` directory with App Router for the site; `src/server/` for the agent
- Server Components by default; `"use client"` only when needed
- All API responses include `agent` field with ERC-8004 Solana address + reputation
- Environment variables prefixed: `DATABASE_`, `UPSTASH_`, `SOLANA_`, `ANTHROPIC_`
- Price values stored as decimals in USD; native currency + conversion rate preserved
- All timestamps in UTC ISO 8601
- x402 payment verification via `@x402/next` + `@x402/svm` (Lucid Agents bundles `bun:sqlite`, do not use)
- Solana wallet keypair stored securely; never committed to repo

## Related Projects

- **solenrich** — Sibling x402 agent on Solana. Solana data enrichment (wallet profiling, token analysis, whale tracking, risk scoring, DeFi positions, alerts, smart-money flow). Live at [solenrich.com](https://solenrich.com). **25 x402 endpoints** (as of 2026-05), MCP server shipped for Claude Desktop + Cursor, 8004-solana registered. Same builder as CardEx — these are the "two halves of a Solana intelligence stack for trading agents."

### CardEx × SolEnrich Integration (Live)
- **`POST /api/v1/wallet-insight`** — Demo of agent-to-agent commerce via x402. CardEx calls SolEnrich `enrich-wallet-light` ($0.002) and combines with CardEx payment history + portfolio data. Caller pays CardEx $0.005, CardEx pays SolEnrich $0.002.
- **Implementation:** `src/lib/solenrich/client.ts` (x402 payment client), `src/lib/solenrich/types.ts` (TypeScript types), `src/app/api/v1/wallet-insight/route.ts` (endpoint)
- **Graceful degradation pattern:** If `SOLANA_PRIVATE_KEY` is not set or SolEnrich is unreachable, endpoint returns CardEx-only data with `solenrich.unavailable: true`. **Reuse this pattern for all future SolEnrich integrations** — CardEx SLA must not depend on SolEnrich uptime.

### Phase 8 SolEnrich Integration (Load-Bearing, Required)
The agentic-commerce wedge depends on composing SolEnrich into the RWA oracle responses. These are **not** optional integrations — they're the differentiated value vs. Magic Eden's raw API.

**Base URL:** `https://api.solenrich.com/entrypoints` (official, per the `/.well-known/x402` manifest). The older `solenrich-production.up.railway.app` host still serves the same endpoints but is not the canonical URL.

**Endpoint choice for seller intel (corrected 2026-05-20):**
- **`enrich-wallet-light`** ($0.002) — wallet risk. Returns `riskScore` + `riskLevel`. Originally the plan called for `due-diligence` here, but the OpenAPI spec confirms `due-diligence` takes a **token mint** and returns SAFE/CAUTION/RISKY on a token — not a wallet. CardEx already used `enrich-wallet-light` in `wallet-insight`; same wrapper feeds `seller_intel`.
- **`wallet-graph`** ($0.010) — suspicious-cluster detection on a wallet address. Powers the wash-trade filter.
- **`due-diligence`** ($0.020) — reserved for future tokenized-mint program vetting (e.g. flagging a compromised CC vault authority). Wrapper is `tokenDueDiligence(mint)`, not currently called in any hot path.

**Architecture details:**
- **`rwa-arbitrage` enrichment** — Each opportunity carries `seller_risk` (`enrich-wallet-light`) and `seller_cluster` (`wallet-graph`). Wash-trade clusters are filtered out by default.
- **`seller_intel` cache table** — 6h TTL on seller wallet enrichment. Same seller across 50 listings = 1 SolEnrich call. Cold cost per seller = $0.012 ($0.002 light + $0.010 graph). The cache is the margin lever; see `docs/PHASE-8-PLAN.md` Step 4 for the cost math and per-call-vs-per-result pricing decision.
- **Extended client** — `src/lib/solenrich/client.ts` exports `enrichWalletLight`, `walletGraph`, `tokenDueDiligence`. All graceful-degrade on missing `SOLANA_PRIVATE_KEY` or non-2xx responses.

See `docs/PHASE-8-PLAN.md` Step 4 for full integration spec.

### On-Demand SolEnrich Composition (Build When Asked)
These are speculative — build only if a Phase 8 design-partner bot specifically requests them. Don't add to roadmap until validated.

- **`POST /api/v1/listing-due-diligence`** ($0.015-0.025) — Single-call bundle: CardEx fair-value + SolEnrich `enrich-wallet-light` + `wallet-graph`. Convenience pitch, demand unproven. Originally scoped against `due-diligence` for the seller side (wrong endpoint — that's token-mint analysis); revised cost reflects the corrected seller-risk source.
- **`/api/v1/feed-latest`** — Mirror of SolEnrich's daily brief, scoped to tokenized cards.
- **Natural-language briefing output format** — Mirror SolEnrich's JSON / briefing / hybrid response modes. Only add when there's a non-bot consumer (LLM agent in Claude/Cursor).

### Cross-Marketing & Discovery
- Both on Solana Agent Registry (8004), same x402 infra, same builder — narratively coherent stack
- Both available as MCP servers → Claude Desktop / Cursor users can query "what tokenized Pokemon does this wallet hold + is the seller safe" in one conversation
- Mutual link in landing pages: SolEnrich for wallet/token intel, CardEx for collectibles intel

## Claude Code Skills

Use these skills during development:

| Skill | When to use |
|---|---|
| `solana-dev` | Solana client code, RPC, transactions, wallet-standard, @solana/kit |
| `solana-anchor-claude-skill` | Anchor programs (Rust), TypeScript tests, Anchor.toml |
| `x402` | x402 payment integration, bazaar search, paid API calls |
| `authenticate-wallet` | Wallet sign-in, connection setup, auth errors |
| `fund` | Adding USDC to wallet, onramp, insufficient balance |
| `send-usdc` | Sending USDC, paying addresses, transfers |
| `trade` | Token swaps (USDC/SOL) |
| `ai-sdk-core` | Vercel AI SDK backend — Output API, embeddings, tool use |
| `ai-sdk-ui` | React chat UI — useChat, useCompletion, useObject hooks |
| `vercel-react-best-practices` | React/Next.js performance patterns |
| `frontend-design` | Dashboard UI, landing pages, web components |
| `railway-docs` | Railway deployment, features, configuration |
| `search-for-service` | Discover x402 bazaar services |
| `pay-for-service` | Call paid x402 endpoints |
| `query-onchain-data` | Onchain data queries via CDP SQL API |
| `find-skills` | Discover new skills when needed |

## Phased Roadmap

### Phase 1 — DB Foundation (COMPLETE)

1. ~~Drizzle schema: 9 game-agnostic tables (+ payment_events)~~
2. ~~Neon DB client + migrations + pg_trgm fuzzy search~~
3. ~~MTG catalog seeded from Scryfall (90,679 cards, 1,029 sets)~~
4. ~~Pokemon catalog seeded from GitHub bulk data (20,078 cards, 171 sets)~~
5. ~~Treatment-aware printing model (foil, showcase, extended art, etc.)~~

### Phase 2 — x402 Payment Layer (COMPLETE)

1. ~~x402 resource server via @x402/next + @x402/svm (not Lucid Agents)~~
2. ~~Solana SVM scheme with USDC devnet/mainnet~~
3. ~~Next.js 16 proxy.ts for payment gating~~
4. ~~5 x402-priced routes ($0.001–$0.01)~~
5. ~~Payment events tracked in Neon payment_events table~~

### Phase 3 — Price API (COMPLETE)

1. ~~Scryfall price ingestion (322K+ price points from 93K cards)~~
2. ~~Market snapshot aggregation (134K daily snapshots)~~
3. ~~POST /api/v1/price — exact + fuzzy lookup with real prices~~
4. ~~POST /api/v1/arbitrage — US/EU price spread detection~~
5. ~~POST /api/v1/set/complete — missing cards + cost estimator~~

### Phase 4 — Deploy + Agent Registry (COMPLETE)

1. ~~Deploy to Railway via CLI (always-on Next.js, x402 API)~~
2. ~~Cron API routes for daily price refresh + snapshot aggregation~~
3. ~~8004-solana SDK integration (register, reputation, identity)~~
4. ~~Shared agentMeta() with ERC-8004 fields across all routes~~
5. ~~AGENT_REGISTRY_ASSET env var for onchain identity~~

### Phase 5 — MTG Data Enrichment

1. ~~Reserved List flag on collectibles table (571 cards, 734 printings flagged from Scryfall)~~
2. ~~Format legality JSONB (Standard, Modern, Pioneer, Commander, Legacy, Vintage + 15 more formats from Scryfall)~~
3. Card Kingdom buylist pipeline (core MTG finance signal) — **deferred**: requires Playwright + Browserbase scraping (no public API). Consider Option A (Scryfall `purchase_uris` for CK retail links) as a quick win before full scraping. Full pipeline needs headless browser infra + ongoing maintenance.
4. ~~Cardhoarder MTGO price ingestion (free CSV bulk data, leading indicator for paper prices)~~

### Phase 6 — Dashboard (COMPLETE)

1. ~~Search page with fuzzy matching (pg_trgm) + latest prices~~
2. ~~Card detail page (prices by source, market snapshot, trends, format legality, reserved badge)~~
3. ~~Arbitrage scanner page (US/EU spread, 15%+ threshold)~~
4. ~~MTGO-paper spread page (leading indicator + Commander/RL demand)~~
5. ~~Shared dashboard layout with nav (Search, Arbitrage, MTGO Spread)~~

### Phase 7 — SolEnrich Integration (COMPLETE)

1. ~~x402 payment client for outbound agent-to-agent calls (`@x402/fetch` + `ExactSvmScheme`)~~
2. ~~POST /api/v1/wallet-insight — SolEnrich enrichment + CardEx payment history + portfolio~~
3. ~~Graceful degradation when SolEnrich unavailable~~
4. ~~`@x402/fetch` added as direct dependency~~

### Phase 8 — Tokenized RWA Oracle (the agentic-commerce wedge)

**Goal:** Stand up the paper-vs-onchain pricing surface that trading bots actually pay for. Solana-only — Collector Crypt + Phygitals + Magic Eden pNFT listings. Defer all cross-chain work.

**Detailed plan:** see `docs/PHASE-8-PLAN.md`.

**Build order:**
1. Recon — read Collector Crypt + Phygitals programs, decide whether to index marketplace events directly or use Magic Eden's API as the read surface
2. Pokemon paper-price ingestion — pokemontcg.io for raw TCGPlayer/CardMarket + Pokemon Price Tracker for graded PSA/CGC/BGS (see `Pokemon Price Tracker` notes below). PriceCharting was an earlier candidate; dropped because their commercial-use terms are unclear and Pokemon Price Tracker's Business tier explicitly authorizes resale via x402.
3. Onchain listings ingestion adapter — `src/lib/ingestion/collector-crypt.ts`, `src/lib/ingestion/phygitals.ts`, `src/lib/ingestion/magic-eden.ts`
4. Listings table + freshness scoring in DB schema
5. `POST /api/v1/rwa-fair-value` — input: mint or listing URL → paper-market price, onchain ask, spread %, freshness, grading distribution
6. `POST /api/v1/rwa-arbitrage` — scan all active onchain listings under paper market by ≥X%, sorted by net profit after fees
7. Bot-friendly affordances — stable response shape, ETag/freshness headers, batch endpoint
8. Design-partner outreach — one named bot user before scaling. Targets: Magic Eden floor-sniping bots, Collector Crypt arbitrage bots in Solana trading Discords

**Out of scope for Phase 8:**
- Cross-chain (Polygon Courtyard, Base Slab.fun, BNB, Flow) — defer to Phase 10
- Pyth-style push feed for lending protocols — revisit at ≥10 paying bot users
- Dashboard rebuild — current dashboard is fine as demo; new endpoints get bot-targeted docs instead

### Phase 9 — Eat Our Own Dogfood (Autonomous Trading)

**Concept:** CardEx consumes its own `rwa-arbitrage` signals to buy/sell tokenized Pokemon on Solana. Acts as proof-of-quality for the oracle pitch ("we trade on our own numbers") and adds a second revenue stream.

- **Platform:** Collector Crypt + Magic Eden pNFTs (Solana)
- **Architecture:** Signal (CardEx) → Wallet risk (SolEnrich) → Evaluation → Execution (Magic Eden REST + Tensor)
- **Arbitrage vectors:** RWA underpriced vs paper, paper/RWA spread on redemption, cross-platform onchain
- **Execution APIs:** Magic Eden REST (120 QPM), Tensor GraphQL/AMM pools
- **Revenue model:** x402 oracle fees (Phase 8) + trading P&L (Phase 9)
- **Gating decision:** only start if Phase 8 has ≥1 paying agent user and arbitrage signals show consistent post-fee margin in backtest

### Future Work

- MPP integration (MCP docs added to `docs/llms-full.txt`)
- Farcaster MiniApp / Telegram bot (`/price Black Lotus alpha`)
- Format ban/unban event history (track price impact of format changes)
- Japanese market integration (Hareruya scraping for US/JP arbitrage)
- Sports cards, sneakers, comics verticals (same pipeline)
