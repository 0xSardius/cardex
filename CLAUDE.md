# CardEx — Project Guide

## What is this?

CardEx is an autonomous market intelligence agent for the collectibles market. It aggregates real-time pricing data from fragmented platforms, detects arbitrage opportunities, and serves structured intelligence via x402 micropayment-gated API endpoints. The agent has a verifiable onchain identity via ERC-8004 on Solana.

**One-liner:** The Bloomberg Terminal for collectible cards, powered by autonomous agents and micropayments.

## Strategic Vision

The collectibles market ($400B+ globally) is fragmented across dozens of platforms with no unified real-time pricing. CardEx starts with **Pokémon TCG** (well-defined catalog, passionate community, clear data sources) and expands to **Magic: The Gathering** in Phase 2, architected as a generic collectibles pricing engine from day one.

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
- **Agent on Phala/Railway.** The core agent runs as an always-on process on Phala or Railway — serves x402 API endpoints, runs scheduled ingestion, manages reputation. Not serverless.
- **Site on Vercel.** A separate Next.js frontend for human users to search cards and view prices. Calls the agent's API.
- **Lucid Agents for commerce.** x402 payment gating, bi-directional payment tracking, and spending controls handled by Lucid Agents middleware — not hand-rolled.
- **Daydreams for agent logic.** Composable contexts and memory/persistence for sub-agents (price resolver, arbitrage scanner, grading engine).
- **Solana for payments.** USDC micropayments via `@x402/svm`. ~$0.00025/tx, ~400ms finality. Aligns with solenrich (sibling x402 project).
- **ERC-8004 on Solana.** Agent identity via Metaplex Core NFTs + SATI v2. Onchain reputation (accuracy, uptime, freshness) attached to every response.
- **Neon for data.** PostgreSQL with pgvector for fuzzy card search. Append-only PricePoints; daily MarketSnapshot aggregations.

## Deployment Model

```
┌──────────────────────────────────┐     ┌──────────────────────────┐
│  Phala / Railway                 │     │  Vercel                  │
│  (always-on agent)               │     │  (human-facing site)     │
│                                  │     │                          │
│  x402 API endpoints              │◄────│  Next.js dashboard       │
│  Daydreams orchestrator          │     │  Search + card detail    │
│  Scheduled ingestion jobs        │     │  Price charts            │
│  ERC-8004 reputation updates     │     │                          │
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

- **solenrich** — Sibling x402 project on Solana. Shared chain + payment infrastructure.

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

### Phase 1 — MVP (Pokemon TCG)

1. Seed card database from pokemontcg.io (~19K cards)
2. TCGPlayer price ingestion pipeline
3. `POST /api/v1/price` with x402 gating (Lucid Agents + `@x402/svm`)
4. ERC-8004 agent identity on Solana via `8004-solana` (devnet)
5. Deploy agent on Phala or Railway
6. Minimal Next.js site on Vercel (search + card detail + price chart)

### Phase 2 — MTG Expansion

1. Seed MTG catalog from Scryfall bulk download (~86K printings)
2. Treatment-aware printing model (foil variants, showcase, extended art, etc.)
3. Card Kingdom buylist pipeline (core MTG finance signal)
4. MTGO price tracking (leading indicator for paper prices)
5. Format legality / ban signal tracking
6. All existing x402 endpoints work for MTG with `game: "mtg"` parameter

### Future Work

- Farcaster MiniApp distribution channel
- Telegram bot (`/price Charizard base set`, `/price Black Lotus alpha`)
- Sports cards, sneakers, comics verticals (same pipeline)
- Additional distribution surfaces as demand warrants
