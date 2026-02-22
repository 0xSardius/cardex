# CardEx — Project Guide

## What is this?

CardEx is an autonomous market intelligence agent for the Pokémon TCG collectibles market. It aggregates real-time pricing data from fragmented platforms, detects arbitrage opportunities, and serves structured intelligence via x402 micropayment-gated API endpoints. The agent has a verifiable onchain identity via ERC-8004 on Solana.

**One-liner:** The Bloomberg Terminal for Pokémon cards, powered by autonomous agents and micropayments.

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
│   │   ├── ingestion/        # Data acquisition pipelines (TCGPlayer, eBay, etc.)
│   │   └── utils/            # Shared utilities
│   └── types/                # TypeScript type definitions
├── migrations/               # Neon SQL migration files
├── public/
├── cardex-prd.md             # Product requirements
├── cardex-design.md          # Architecture & data model
└── cardex-lean-canvas.jsx    # Lean canvas visualization
```

## Key Data Models

- **Card** — Pokemon TCG card metadata (name, set, rarity, era, image)
- **Set** — Card set info (code, series, era, release date)
- **PricePoint** — Immutable price observation (source, condition, price, timestamp)
- **MarketSnapshot** — Daily aggregation per card+condition (avg, median, low, high, trends)
- **ArbitrageOpportunity** — Cross-platform price gap with confidence + TTL
- **GradingEstimate** — Vision-based grade probabilities + ROI analysis
- **AgentReputation** — ERC-8004 onchain state via SATI v2 (queries served, accuracy, uptime)

## API Endpoints (x402-gated via Lucid Agents)

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

## Future Work (Post-MVP)

- Farcaster MiniApp distribution channel
- Telegram bot (`/price Charizard base set`)
- Additional distribution surfaces as demand warrants

## MVP Scope (Phase 1)

1. Seed card database from pokemontcg.io (~19K cards)
2. TCGPlayer price ingestion pipeline
3. `POST /api/v1/price` with x402 gating (Lucid Agents + `@x402/svm`)
4. ERC-8004 agent identity on Solana via `8004-solana` (devnet)
5. Deploy agent on Phala or Railway
6. Minimal Next.js site on Vercel (search + card detail + price chart)
