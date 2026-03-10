# CardEx — Development Checkpoint

## Last Completed: Phase 3 — Price API
**Date:** 2026-03-10

### What was built
- **Scryfall price ingestion** (`src/lib/ingestion/scryfall-prices.ts`) — concurrent HTTP inserts, resume support
- **Market snapshot aggregation** (`src/lib/ingestion/aggregate-snapshots.ts`) — daily avg/median/low/high
- **Arbitrage API** (`src/app/api/v1/arbitrage/route.ts`) — US/EU price spread detection
- **Set completion API** (`src/app/api/v1/set/complete/route.ts`) — missing cards + cost estimate
- **Pokemon TCG seed** (`src/lib/db/seed-pokemon.ts`) — GitHub bulk data bypass for pokemontcg.io

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
| `POST /api/v1/grade` | $0.01 | Route configured, needs AI impl |
| `POST /api/v1/portfolio/value` | $0.002 | Route configured, needs handler |

### Known Issues
- `@lucid-agents/payments` bundles `bun:sqlite` — using direct Drizzle inserts instead
- pokemontcg.io API still blocked — using GitHub bulk data as workaround
- Pokemon cards have no price data (pokemontcg.io prices not in GitHub data)

## Roadmap
- [x] Phase 1: DB Foundation
- [x] Phase 2: x402 Payment Layer
- [x] Phase 3: Price API
- [ ] Phase 4: Agent Registry (ERC-8004)
- [ ] Phase 5: Cron (ingestion pipelines)
- [ ] Phase 6: Dashboard
