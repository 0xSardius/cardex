# CardEx — Development Checkpoint

## Last Completed: Phase 4 — Deploy + Agent Registry
**Date:** 2026-03-21

### What was built
- **Railway deployment** — CardEx live on Railway (always-on Next.js, x402 API)
- **Cron API routes** — `GET /api/cron/ingest-prices` + `GET /api/cron/aggregate-snapshots` (CRON_SECRET protected)
- **ERC-8004 identity module** (`src/lib/erc8004/identity.ts`) — 8004-solana SDK integration for agent registration + reputation queries
- **Shared agentMeta** (`src/lib/agent-meta.ts`) — unified agent metadata with cached reputation, replaces 5 duplicated inline objects
- **MTG-first rebrand** — landing page, metadata, and messaging all lead with Magic: The Gathering

### Data in Neon DB
| Metric | Count |
|---|---|
| Sets | 1,200 (1,029 MTG + 171 Pokemon) |
| Cards | 110,757 (90,679 MTG + 20,078 Pokemon) |
| Price Points | 322,888 (USD, EUR, MTGO) |
| Market Snapshots | 134,573 |

### API Routes (x402-gated)
| Endpoint | Price | Status |
|---|---|---|
| `POST /api/v1/price` | $0.001 | **Live** — exact + fuzzy lookup with prices |
| `POST /api/v1/arbitrage` | $0.005 | **Live** — US/EU spread detection |
| `POST /api/v1/set/complete` | $0.008 | **Live** — completion advisor |
| `POST /api/v1/grade` | $0.01 | **Live** — AI vision grading |
| `POST /api/v1/portfolio/value` | $0.002 | **Live** — portfolio valuation |
| `GET /api/cron/ingest-prices` | — | **Live** — CRON_SECRET protected |
| `GET /api/cron/aggregate-snapshots` | — | **Live** — CRON_SECRET protected |

### Deployment
- **Railway:** Cardex service (always-on)
- **Domain:** Set via Railway dashboard
- **Env vars:** DATABASE_URL, SOLANA_NETWORK, SOLANA_RPC_URL, X402_FACILITATOR_URL

### Still needed for full Phase 4
- Set SOLANA_PRIVATE_KEY + register agent on Solana Agent Registry
- Set CRON_SECRET on Railway + configure Railway Cron schedule
- Set AGENT_REGISTRY_ASSET after registration

### Known Issues
- `@lucid-agents/payments` bundles `bun:sqlite` — using direct Drizzle inserts instead
- pokemontcg.io API still blocked — using GitHub bulk data as workaround
- Pokemon cards have no price data (deprioritized, MTG-first strategy)

## Roadmap
- [x] Phase 1: DB Foundation
- [x] Phase 2: x402 Payment Layer
- [x] Phase 3: Price API
- [x] Phase 4: Deploy + Agent Registry
- [ ] Phase 5: MTG Data Enrichment (Reserved List, format legality, Card Kingdom buylist)
- [ ] Phase 6: Dashboard
