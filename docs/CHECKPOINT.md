# CardEx — Development Checkpoint

## Last Session: 2026-04-03

### What Was Completed
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
- **All 6 phases complete** — DB, x402, Price API, Deploy, Data Enrichment, Dashboard
- **7 x402-gated API endpoints** + 2 cron endpoints
- **55/55 tests passing** (Reserved List 19, Legality 25, MTGO Spread 11)
- **Railway deploy** needs `railway up` for each update (no GitHub auto-deploy)
- **Dashboard pages** deployed but Railway may need a fresh `railway up` to pick up latest commits
- **Price data** is from March — needs a cron run to refresh

### Next Steps (Prioritized)
1. **Set CRON_SECRET on Railway** — enable daily price refresh
2. **Run cron endpoint once** — refresh price data before sharing publicly
3. **Verify SOLANA_PAY_TO_ADDRESS** is set on Railway — needed for x402 to work
4. **Test end-to-end x402 payment** — confirm a real payment goes through
5. **Post on r/mtgfinance** — first marketing push
6. **Set up GitHub auto-deploy on Railway** — so pushes auto-deploy (or just keep using `railway up`)
7. **Agent registration on Solana (8004)** — set SOLANA_PRIVATE_KEY, register, set AGENT_REGISTRY_ASSET
8. **Custom domain** — cardex.gg or similar

### Blockers
- **Price data staleness** — last Scryfall ingestion was March. Must run cron before public launch.
- **Railway deploys are manual** — `railway up` required, no GitHub integration set up
- **SOLANA_PAY_TO_ADDRESS** — unverified whether this is set on Railway. x402 won't work without it.

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
