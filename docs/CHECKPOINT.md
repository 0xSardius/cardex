# CardEx — Development Checkpoint

## Last Completed: Phase 2 — x402 Payment Layer
**Date:** 2026-03-09

### What was built
- **x402 Resource Server** (`src/lib/x402/server.ts`) — Solana SVM payment scheme with route pricing config
- **Payment Proxy** (`src/proxy.ts`) — Next.js 16 proxy.ts intercepting `/api/v1/*` with x402 402 responses
- **Price API** (`src/app/api/v1/price/route.ts`) — `POST /api/v1/price` with card lookup (exact + fuzzy)
- **Payment Ledger** (`src/lib/x402/payments.ts`) — Records payments to `payment_events` table in Neon
- **Schema update** — Added `payment_events` table (9 tables total), migrated to Neon

### x402 Routes Configured
| Endpoint | Price | Description |
|---|---|---|
| `POST /api/v1/price` | $0.001 | Single card price lookup |
| `POST /api/v1/arbitrage` | $0.005 | Cross-platform arbitrage scan |
| `POST /api/v1/grade` | $0.01 | Vision-based grading estimate |
| `POST /api/v1/portfolio/value` | $0.002/card | Portfolio valuation |
| `POST /api/v1/set/complete` | $0.008 | Set completion advisor |

### Packages Added
- `@x402/next` v2.6.0 — Next.js payment proxy + resource server
- `@x402/svm` v2.6.0 — Solana ExactSvmScheme (USDC devnet/mainnet)
- `@x402/core` v2.6.0 — Protocol types
- `@lucid-agents/payments` v2.5.0 — Installed but not used (bundles bun:sqlite, breaks Node builds)
- `@lucid-agents/wallet` v0.6.2 — Installed for future wallet management

### Verified Working
- `npm run build` passes cleanly
- Dev server returns proper `HTTP 402 Payment Required` with x402 v2 payment requirements
- Payment requirements include: Solana devnet, USDC token, $0.001 price, ExactSvm scheme

### Known Issues
- `@lucid-agents/payments` bundles `bun:sqlite` which breaks Next.js builds on Node. Using direct Drizzle insert to `payment_events` instead.
- pokemontcg.io cards fetch still fails from dev environment (Phase 1 issue, non-blocking for MTG-first)

## Previous: Phase 1 — DB Foundation (2026-03-07)
- 9 Drizzle tables (game-agnostic) + pg_trgm fuzzy search
- 1,029 MTG sets, 90,679 MTG cards from Scryfall
- 171 Pokemon sets (cards pending API fix)

## Next Up: Phase 3 — Price API Enhancement
1. Implement remaining API route handlers (arbitrage, grade, portfolio, set)
2. Add TCGPlayer/eBay price ingestion pipeline
3. Wire real price data into the price endpoint

## Roadmap
- [x] Phase 1: DB Foundation
- [x] Phase 2: x402 Payment Layer
- [ ] Phase 3: Price API
- [ ] Phase 4: Agent Registry (ERC-8004)
- [ ] Phase 5: Cron (ingestion pipelines)
- [ ] Phase 6: Dashboard
