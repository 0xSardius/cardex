# CardEx — Project Guide

## What is this?

CardEx is an autonomous market intelligence agent for the collectibles market. It aggregates real-time pricing data from fragmented platforms, detects arbitrage opportunities, and serves structured intelligence via x402 micropayment-gated API endpoints. The agent has a verifiable onchain identity via ERC-8004 on Solana.

**One-liner:** The Bloomberg Terminal for Magic: The Gathering, powered by autonomous agents and micropayments.

## Strategic Vision

The collectibles market ($400B+ globally) is fragmented across dozens of platforms with no unified real-time pricing. CardEx leads with **Magic: The Gathering** (largest singles market, highest arbitrage signal density, strong developer community) and is architected as a generic collectibles pricing engine that can expand to Pokémon TCG and other verticals.

The same pipeline (scraping → normalization → x402 serving) works for any card game — and eventually sports cards, sneakers, comics, and other collectibles verticals.

### Why multi-game from the start

- **Shared infrastructure.** TCGPlayer, eBay, CardMarket integrations are game-agnostic. x402 layer, agent identity, and DB infra are 100% reusable.
- **MTG adds ~60-100% API revenue** for ~35-45% incremental effort over Pokemon-only.
- **MTG has a larger singles market** ($800M+ annual) with higher arbitrage signal density and a developer community ready to pay (r/mtgfinance 200K+, MTGStocks premium, TCGPlayer API closed to new apps).
- **Pokemon wins on grading** (dominant grading market, grading ROI calculator is a killer feature). MTG wins on arbitrage (Reserved List buyouts, format ban/unban cycles, US/EU spreads).

### Game-specific data sources

| Source | Pokemon | MTG | Shared |
|---|---|---|---|
| Catalog seed | pokemontcg.io | Scryfall (bulk download) | — |
| TCGPlayer pricing | Yes | Yes | Yes |
| eBay sold listings | Yes | Yes | Yes |
| CardMarket (EU) | Yes | Yes | Yes |
| Card Kingdom buylist | — | Yes (MTG-specific) | — |
| MTGO prices | — | Yes (MTG-specific) | — |
| Japanese market | Mercari JP | Hareruya (scrape) | — |

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

## API Endpoints (x402-gated via Lucid Agents)

All endpoints accept a `game` parameter (`pokemon` | `mtg`). Defaults to `pokemon` in Phase 1.

| Endpoint | Price | Description |
|---|---|---|
| `POST /api/v1/price` | $0.001 | Single card price lookup |
| `POST /api/v1/arbitrage` | $0.005 | Cross-platform arbitrage scan |
| `POST /api/v1/grade` | $0.01 | Vision-based grading estimate |
| `POST /api/v1/portfolio/value` | $0.002/card | Portfolio valuation |
| `POST /api/v1/set/complete` | $0.008 | Set completion advisor |

## Development Conventions

- Use `src/` directory with App Router for the site; `src/server/` for the agent
- Server Components by default; `"use client"` only when needed
- All API responses include `agent` field with ERC-8004 Solana address + reputation
- Environment variables prefixed: `DATABASE_`, `UPSTASH_`, `SOLANA_`, `ANTHROPIC_`
- Price values stored as decimals in USD; native currency + conversion rate preserved
- All timestamps in UTC ISO 8601
- x402 payment verification via Lucid Agents middleware, not custom code
- Solana wallet keypair stored securely; never committed to repo

## Related Projects

- **solenrich** — Sibling x402 agent on Solana. Solana data enrichment (wallet profiling, token analysis, whale tracking, risk scoring). Live at [solenrich.vercel.app](https://solenrich.vercel.app). 11 x402 endpoints, MCP integration, 8004-solana registered.

### CardEx × SolEnrich Integration Opportunities
- **Shared buyer reputation:** CardEx calls SolEnrich `enrich-wallet-light` ($0.002) on payer wallet → behavioral labels, risk scoring for premium data tiers
- **Agent-to-agent commerce demo:** Agent evaluates MTG portfolio held by Solana wallet → SolEnrich for wallet profile → CardEx for card valuations → combined report. Killer x402 showcase.
- **Cross-marketing:** Link between sites, both on Solana Agent Registry (8004), same x402 infra, same builder
- **MCP integration:** Both agents as MCP tools → Claude/Cursor users query cards + wallets in same conversation

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

### Future Work

- Farcaster MiniApp / Telegram bot (`/price Black Lotus alpha`)
- Format ban/unban event history (track price impact of format changes)
- Japanese market integration (Hareruya scraping for US/JP arbitrage)
- Pokemon TCG vertical (architecture supports it, deprioritized for now)
- Sports cards, sneakers, comics verticals (same pipeline)
