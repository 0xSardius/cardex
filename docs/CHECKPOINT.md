# CardEx — Development Checkpoint

## Last Completed: Phase 6 — Dashboard
**Date:** 2026-03-24

### What was built (this session)
- **MTG-first rebrand** — landing page, metadata, value prop all lead with Magic: The Gathering
- **Railway deployment** — CardEx live on Railway (always-on Next.js)
- **Phase 4: Deploy + Agent Registry** — cron routes, 8004-solana SDK, shared agentMeta
- **Phase 5.1: Reserved List** — 571 cards (734 printings) flagged, in API responses
- **Phase 5.2: Format Legality** — JSONB column, 90K cards with 22 formats from Scryfall
- **Phase 5.3: MTGO-Paper Spread** — new endpoint detecting tix/paper divergence
- **Phase 6: Dashboard** — 4 pages (search, card detail, arbitrage, MTGO spread)

### Data in Neon DB
| Metric | Count |
|---|---|
| MTG cards | 90,679 (100% with legalities, 734 Reserved List) |
| Pokemon cards | 20,078 (deprioritized) |
| Price Points | 322,888 (USD, EUR, MTGO tix) |
| Market Snapshots | 134,573 |
| MTGO/paper overlap | 50,648 cards |

### API Routes (x402-gated)
| Endpoint | Price | Status |
|---|---|---|
| `POST /api/v1/price` | $0.001 | Live — reserved + legalities included |
| `POST /api/v1/arbitrage` | $0.005 | Live — US/EU spread + reserved flag |
| `POST /api/v1/mtgo-spread` | $0.005 | Live — MTGO-paper leading indicator |
| `POST /api/v1/set/complete` | $0.008 | Live — completion advisor |
| `POST /api/v1/portfolio/value` | $0.002 | Live — portfolio valuation |
| `POST /api/v1/grade` | $0.01 | Live — AI vision grading |
| `GET /api/cron/ingest-prices` | — | Cron-ready |
| `GET /api/cron/aggregate-snapshots` | — | Cron-ready |

### Dashboard Pages
| Page | Route | Description |
|---|---|---|
| Search | `/search` | Fuzzy card search with prices |
| Card Detail | `/card/[id]` | Prices, market snapshot, legality, reserved |
| Arbitrage | `/arbitrage` | Top US/EU spread opportunities |
| MTGO Spread | `/mtgo-spread` | MTGO-high + paper-high signals |

### Tests
- Reserved List: 19/19
- Format Legality: 25/25
- MTGO Spread: 11/11
- **Total: 55/55 passing**

### Still needs manual setup
1. CRON_SECRET on Railway + cron schedule
2. SOLANA_PRIVATE_KEY for agent registration
3. AGENT_REGISTRY_ASSET after registration

## Roadmap
- [x] Phase 1: DB Foundation
- [x] Phase 2: x402 Payment Layer
- [x] Phase 3: Price API
- [x] Phase 4: Deploy + Agent Registry
- [x] Phase 5: MTG Data Enrichment (Reserved List, Legality, MTGO Spread)
- [x] Phase 6: Dashboard
