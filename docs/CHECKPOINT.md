# CardEx — Development Checkpoint

## Last Completed: Phase 1 — DB Foundation
**Date:** 2026-03-07

### What was built
- **Drizzle ORM schema** (`src/lib/db/schema.ts`) — 8 game-agnostic tables:
  - `sets`, `collectibles`, `price_points`, `market_snapshots`
  - `arbitrage_opportunities`, `grading_estimates`, `portfolios`, `portfolio_items`
- **Neon DB client** (`src/lib/db/index.ts`) — HTTP transport via `@neondatabase/serverless`
- **Migrations** — auto-generated DDL + pg_trgm fuzzy search index
- **Seed scripts:**
  - `seed-mtg.ts` — Scryfall API, **93,132 MTG cards** across 1,029 sets (COMPLETE)
  - `seed.ts` — pokemontcg.io, 171 Pokemon sets seeded, cards pending (API connectivity issue from dev env)
- **Test suite** (`test-db.ts`) — connection, counts, joins, fuzzy search, era distribution

### Data in Neon DB
| Game | Sets | Cards |
|------|------|-------|
| MTG | 1,029 | 90,679 |
| Pokemon | 171 | 0 (API blocked) |
| **Total** | **1,200** | **90,679** |

### Known Issues
- pokemontcg.io cards fetch fails from dev environment (Cloudflare TLS renegotiation + Node undici). Sets seed fine. Retry from a different network or use `node:https` transport (already implemented, still times out).

## Next Up: Phase 2 — Lucid x402 Layer
1. Install `@lucid-agents/next`, `@lucid-agents/payments`, `@x402/svm`
2. Set up Solana wallet + USDC payment verification
3. Create x402-gated `/api/v1/price` endpoint
4. Wire payment middleware to Neon ledger

## Roadmap
- [x] Phase 1: DB Foundation
- [ ] Phase 2: Lucid x402 Layer
- [ ] Phase 3: Price API
- [ ] Phase 4: Agent Registry (ERC-8004)
- [ ] Phase 5: Cron (ingestion pipelines)
- [ ] Phase 6: Dashboard
