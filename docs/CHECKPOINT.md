# CardEx — Development Checkpoint

## Last Session: 2026-04-07

### What Was Completed
- **SolEnrich integration (agent-to-agent x402)** — New `POST /api/v1/wallet-insight` endpoint ($0.005). CardEx pays SolEnrich `enrich-wallet-light` ($0.002) via x402, combines with CardEx payment history + portfolio data. Graceful degradation when SolEnrich unavailable.
  - `src/lib/solenrich/client.ts` — x402 payment client using `@x402/fetch` + `ExactSvmScheme`
  - `src/lib/solenrich/types.ts` — SolEnrich API types
  - `src/app/api/v1/wallet-insight/route.ts` — endpoint handler
  - Added `@x402/fetch` as direct dependency
- **MCP llms-full.txt** — Added MCP docs to `docs/llms-full.txt` for MPP integration research

### Previous Sessions
- **MTG-first rebrand** — landing page, metadata, value prop all lead with Magic: The Gathering
- **Railway deployment** — CardEx live at https://cardex.up.railway.app (CLI deploy, not GitHub auto-deploy)
- **Phase 4: Deploy + Agent Registry** — cron API routes, 8004-solana SDK, shared agentMeta across all routes
- **Phase 5.1: Reserved List** — 571 cards (734 printings) flagged from Scryfall, surfaced in API responses
- **Phase 5.2: Format Legality** — JSONB column, 90,679 cards with 22 formats, 100% coverage
- **Phase 5.3: MTGO-Paper Spread** — new POST /api/v1/mtgo-spread endpoint detecting tix/paper divergence
- **Phase 6: Dashboard** — 4 pages (search, card detail, arbitrage, MTGO spread) + shared nav layout
- **Strategy page** at /strategy — lean canvas comparison for token launch decision
- **Value prop page** at /value-prop — full product overview for marketing
- **Landing page polish** — "TCGPlayer closed their API" hook, audience section, documentation link fixed
- **SolEnrich cross-marketing** — integration opportunities documented in CLAUDE.md

### Current State
- **All 6 phases complete** + SolEnrich integration — DB, x402, Price API, Deploy, Data Enrichment, Dashboard
- **8 x402-gated API endpoints** (added wallet-insight) + 2 cron endpoints
- **55/55 tests passing** (Reserved List 19, Legality 25, MTGO Spread 11)
- **Railway deploy** needs `railway up` for each update (no GitHub auto-deploy)
- **Dashboard pages** deployed but Railway may need a fresh `railway up` to pick up latest commits
- **Price data** is from March — needs a cron run to refresh
- **SolEnrich integration** needs `SOLANA_PRIVATE_KEY` on Railway for outbound x402 payments

### Go-Live Checklist
1. **Set `CRON_SECRET` on Railway** — enable daily price refresh
2. **Run cron endpoint once** — refresh price data (stale since March)
3. **Verify `SOLANA_PAY_TO_ADDRESS` on Railway** — needed for x402 to accept payments
4. **Set `SOLANA_PRIVATE_KEY` on Railway** — needed for wallet-insight (outbound x402 to SolEnrich) and agent registration (8004)
5. **Test end-to-end x402 payment** — confirm a real payment goes through
6. **`railway up`** — deploy latest code (SolEnrich integration + MCP docs)
7. **Agent registration on Solana (8004)** — register, set `AGENT_REGISTRY_ASSET`

### Post-Launch
- **Post on r/mtgfinance** — first marketing push
- **Set up GitHub auto-deploy on Railway** — or keep using `railway up`
- **Custom domain** — cardex.gg or similar
- **MPP integration** — explore using llms-full.txt docs

### Blockers
- **Price data staleness** — last Scryfall ingestion was March. Must run cron before public launch.
- **Railway env vars unverified** — `SOLANA_PAY_TO_ADDRESS`, `SOLANA_PRIVATE_KEY`, `CRON_SECRET` may not be set
- **Railway deploys are manual** — `railway up` required, no GitHub integration set up

### Key Decisions Made
- **MTG-first strategy** — Pokemon deprioritized. MTG has better data (Scryfall), bigger market ($800M+), no competitors in x402 space
- **No token for CardEx** — would dilute SolEnrich token. CardEx is a product play, SolEnrich gets the token.
- **Single Railway deploy** — no Vercel split. Simpler for now, add Vercel later if needed.
- **Card Kingdom buylist deferred** — requires Playwright + Browserbase scraping. Not worth the complexity yet.
- **JSONB for legalities** — flexible, matches Scryfall format, no migration when new formats are added
- **Cardhoarder CSV skipped** — pivoted to MTGO-paper spread detection using existing Scryfall tix data instead

## Roadmap
- [x] Phase 1: DB Foundation
- [x] Phase 2: x402 Payment Layer
- [x] Phase 3: Price API
- [x] Phase 4: Deploy + Agent Registry
- [x] Phase 5: MTG Data Enrichment
- [x] Phase 6: Dashboard
