# CardEx — Development Checkpoint

## Last Session: 2026-05-18

### Phase 8 Steps 0, 1, 2, 3 Shipped (single push to main)

- **Step 0 (recon):** `docs/RWA-RECON.md`. Default to Magic Eden REST + Helius DAS; Helius webhook on M2 as documented fallback. Collector Crypt is plain ME M2 under the hood (no custom program), card identity fully parseable from offchain attributes, seller concentration is power-law (good for SolEnrich cache margin). Polling cadence dropped from 10-15 min to 20-30 min in `docs/PHASE-8-PLAN.md` Step 2 — original cadence exceeded ME's 120 QPM ceiling by ~3x.
- **Step 1 (Pokemon paper prices):** Adapter + cron via pokemontcg.io. TCGPlayer market price (six variant conditions) + CardMarket trend price (EUR). Step 1 smoke (page 1, 250 cards): 933 price_points, 97.6% TCGPlayer coverage, 98.4% CardMarket coverage. Full ingestion completed end of session.
- **Step 2 (ME listings adapter):** New `listings` + `mint_card_map` tables. `MagicEdenClient` interface wraps v2 REST so v4/M2 swap is contained. Pokemon-only attribute filter on the `collector_crypt` slug (default sort is multi-category — first smoke wasted 50 lookups on Moonbirds/Basketball). Cold-run ingestion brought 2,051 active CC Pokemon listings into Neon with 49 unique mints (16%) resolved to catalog. 84% of mints have sparse `Set`/`Card Name` attributes — improvement is Step 4 work.
- **Step 3 (`POST /api/v1/rwa-fair-value`):** $0.002 endpoint. Accepts `{ mint }` or `{ listing_url }`. Joins listings + mint_card_map + collectibles + price_points. Returns paper_price (median over 7d window), onchain best ask, spread %. ETag + Cache-Control: max-age=30. SQL smoke verified the join path produces correct data for Raichu xy8 #49 PSA 8. Known gap: `paper_price.condition_basis: "raw"` — graded-card prices come in Step 4 via PriceCharting.

### Known gaps logged for Step 4

- **Mint→catalog resolution rate is 16%.** Most CC mints have sparse on-chain attribute schemas (missing `Set`/`Card Name`). Step 4 needs: (a) token-`name` field fallback parser, (b) more CC `Set` format variations, (c) Helius DAS fallback for richer metadata.
- **No graded paper prices.** TCGPlayer/CardMarket are raw. CGC 9.5 cards on Collector Crypt comparing to raw paper prices = misleading spread. PriceCharting is the Step 4 integration that closes this.
- **SOL→USD conversion deferred.** Listings denominated in SOL show `best_ask_currency: "SOL_only"`. Step 4 needs a SOL/USD price source.
- **Phygitals slug still unknown.** `phygitals_collectibles` returns 0 listed. Step 4 should resolve live Phygitals ME slug(s) or skip.

### Commits (pushed to `origin/main`)

- `1a2044d` — Phase 8 Step 0 recon: RWA platform read-surface decision
- `e97bd11` — Phase 8 Step 1: Pokemon paper-price ingestion via pokemontcg.io
- `6a93be4` — Phase 8 Step 2: Magic Eden listings adapter + mint_card_map
- (this session, pending) Step 3 commit + checkpoint

### Where to resume

Next steps in order:
1. **Verify full Pokemon ingestion ran** — `SELECT COUNT(*) FROM price_points WHERE source LIKE 'pokemontcg_%'`. If <30K, re-run `npm run ingest:pokemon-prices`.
2. **Run `npm run ingest:snapshots`** to populate `market_snapshots` for Pokemon (Step 3 falls back to `price_points`, but snapshots are faster).
3. **Re-run Step 3 smoke** with a real mint that has both an active listing AND paper prices to see a real spread number. Suggested mint: `4Uzajig8c5AuR3UNRrg13ErDqbQiNz5YShZMPyGDUenh` (Raichu xy8 #49 PSA 8).
4. **Start Step 4** — `POST /api/v1/rwa-arbitrage` + SolEnrich `due-diligence`/`wallet-graph` integration + `seller_intel` cache table (6h TTL).

---

## Previous Session: 2026-05-16

### Positioning Sharpened — Agentic-Commerce Wedge

CardEx is repositioned **before launch** as a Solana-native pricing oracle for **tokenized-card trading agents** — not a Bloomberg-for-MTG product for human collectors. Drove the decision: the only buyer that actually pays per-query (x402's natural economics) is a programmatic bot scanning thousands of listings. Lending protocols want push feeds (different sales motion); humans don't pay per call. Bots do.

**Sharpened one-liner:** "The price oracle that tokenized-card trading agents use — paper-market truth + onchain marketplace state, served per-query via x402 on Solana."

**Key consequences:**
- **Pokemon first** for the wedge (only game with meaningful tokenization — $124.5M/mo on Collector Crypt + Phygitals). MTG offchain stays as the moat (no one else has cross-game offchain depth on Solana).
- **No cross-chain in Phase 8.** Polygon (Courtyard), Base (Slab.fun), BNB, Flow are deferred. Bots live on Solana; one paying bot user beats five chains of speculative coverage.
- **No lending-protocol pitch yet.** Revisit Pyth-style feeds at ≥10 paying bot users.
- **Dashboard becomes a demo,** not the product. Phase 8 ships bot-targeted docs/SDK examples instead of new dashboard pages.

**Phase 8 redefined** as "Tokenized RWA Oracle" — see `docs/PHASE-8-PLAN.md`. **Phase 9 stays** as autonomous trading (now framed as dogfood / proof-of-quality, not core revenue).

CLAUDE.md rewritten to match. API endpoints table now distinguishes Live (paper-market) vs Planned (RWA, bot-facing).

### Update (2026-05-17) — SolEnrich Composition Baked Into Phase 8

Checked SolEnrich's current scope: grew from 11 → 25 endpoints, shipped MCP server, lives at solenrich.com (not the old vercel.app subdomain). Several new endpoints fit Phase 8 directly.

**Decided:** SolEnrich `due-diligence` ($0.02) + `wallet-graph` ($0.01) become **load-bearing** in `rwa-arbitrage`, not optional. Each opportunity carries `seller_risk` + `seller_cluster`; wash-trade clusters filtered by default. 6h cache on a new `seller_intel` table is the margin lever — without it the endpoint loses money per call.

**Deferred to on-demand:** bundled `listing-due-diligence` endpoint, `feed-latest` mirror, briefing-format output, webhook variant. All speculative; build only if a specific Phase 8 design-partner bot requests them.

**Updated files:** `docs/PHASE-8-PLAN.md` (Step 4 rewritten with SolEnrich spec + cost math; Step 5 split Required vs On-demand; risks gained 2 SolEnrich rows; timeline moved outreach to Week 1). `CLAUDE.md` Related Projects section split into Live / Phase 8 Load-Bearing / On-Demand tiers. New memory: `reference_solenrich_endpoints.md`.

**Honest caveat logged:** integration polish doesn't validate demand. Step 6 outreach (finding one paying bot user) is still the gate. Don't let SolEnrich work delay the first outreach post.

---

## Previous Session: 2026-04-13

### What Was Completed
- **Deep RWA collectibles research** — corrected chain assumptions, identified Solana-native targets
  - **Courtyard.io is on Polygon** (NOT Ethereum — migrated from ETH to Polygon Aug 2023). No Solana plans.
  - Polygon Registry: `0x251be3a17af4892035c37ebf5890f4a4d889dcad`. $78.4M/mo volume. $30M Series A.
  - **Collector Crypt identified as primary target** — Solana-native pNFTs, $44M/mo volume, tradeable on Magic Eden + Tensor
  - **Phygitals** — smaller Solana competitor, $17.4M total volume, 60K+ tokenized cards
  - **Total tokenized Pokemon market: $124.5M/month** (Aug 2025), 5.5x growth from Jan 2025
- **Solana RWA ecosystem mapped:**
  - $873M tokenized RWAs on Solana (Dec 2025 ATH), projected $2B by 2026
  - BlackRock BUIDL ($2.9B), Franklin FOBXX ($594M) live on Solana
  - Token Extensions, Metaplex Core, Firedancer (600K TPS) as infrastructure
  - Solana processes 77% of AI agent transaction volume
- **Autonomous trading agent concept pivoted to Solana-native:**
  - Collector Crypt (Solana) replaces Courtyard (Polygon) as trading target
  - Magic Eden API (REST, 120 QPM) + Tensor SDK (GraphQL, AMM pools) for execution
  - Three arbitrage vectors: RWA underpriced, paper/RWA spread, cross-platform
  - CardEx (pricing intelligence) + SolEnrich (wallet profiling) + execution = full loop
  - No MTG tokenization anywhere — WotC hostile. Trading agent would be Pokemon-focused.

### Previous Sessions
- **SolEnrich integration** — wallet-insight endpoint, agent-to-agent x402
- **MCP llms-full.txt** — MPP integration research docs
- **MTG-first rebrand** — landing page, metadata, value prop
- **Phase 4-6** — Deploy, Data Enrichment, Dashboard all complete
- **All 7 phases complete** — DB, x402, Price API, Deploy, Data Enrichment, Dashboard, SolEnrich

### Current State
- **All 7 phases complete** + SolEnrich integration
- **8 x402-gated API endpoints** + 2 cron endpoints + 4 dashboard pages
- **55/55 tests passing**
- **Railway deploy** at https://cardex.up.railway.app
- **Mainnet-ready** — `SOLANA_NETWORK=mainnet`, `SOLANA_RPC_URL`, `CRON_SECRET` set on Railway
- **Still needs:** `SOLANA_WALLET_ADDRESS`, `SOLANA_PRIVATE_KEY` on Railway (agent wallet not yet created)
- **Latest code not deployed** — needs `railway up` after wallet setup

### Go-Live Checklist
1. ~~Set `CRON_SECRET` on Railway~~ DONE
2. ~~Set `SOLANA_NETWORK=mainnet` on Railway~~ DONE
3. ~~Set `SOLANA_RPC_URL` (mainnet Helius) on Railway~~ DONE
4. **Create dedicated agent wallet** — new Phantom account, export private key, store in password manager
5. **Set `SOLANA_WALLET_ADDRESS` on Railway** — main Phantom wallet (revenue destination)
6. **Set `SOLANA_PRIVATE_KEY` on Railway** — agent wallet (for outbound x402 + registration)
7. **Fund agent wallet** — ~0.02 SOL for fees + small USDC for SolEnrich calls
8. **`railway up`** — deploy latest code
9. **Run price ingestion cron** — `GET /api/cron/ingest-prices?secret=<CRON_SECRET>` (~5 min)
10. **Run snapshot aggregation** — `GET /api/cron/aggregate-snapshots?secret=<CRON_SECRET>`
11. **Test end-to-end x402 payment** — confirm mainnet payment flow
12. **Agent registration on Solana (8004)** — register, set `AGENT_REGISTRY_ASSET`

### Post-Launch
- **Post on r/mtgfinance** — first marketing push
- **Custom domain** — cardex.gg or similar
- **MPP integration** — llms-full.txt docs ready
- **GitHub auto-deploy on Railway** — or keep using `railway up`

### Phase 8: Autonomous Trading Agent (Solana-Native)
- **Concept:** CardEx uses its own arbitrage signals to buy/sell tokenized Pokemon cards on Solana
- **Platform:** Collector Crypt (Solana pNFTs) via Magic Eden API + Tensor SDK
- **Architecture:** Signal detection (CardEx) → Wallet profiling (SolEnrich) → Evaluation → Execution
- **Single-chain:** Fully Solana — no cross-chain bridging needed
- **Arbitrage vectors:**
  1. RWA underpriced — buy pNFT below 85% FMV, instant-sell to Collector Crypt buyback
  2. Paper/RWA spread — buy pNFT, redeem physical, sell on TCGPlayer/eBay
  3. Cross-platform — Collector Crypt vs Phygitals price differences
- **Execution APIs:** Magic Eden REST (120 QPM, `@magiceden/magiceden-sdk`) + Tensor GraphQL (`@tensor-oss/tensorswap-sdk`)
- **Open questions:** Capital allocation, Collector Crypt collection addresses, typical spreads, Tensor API application
- **Next steps:** 
  1. Research Collector Crypt collection data on Magic Eden (listings, floor prices, volume)
  2. Prototype read-only signal detector (paper price vs pNFT price comparison)
  3. Apply for Tensor API access
- **Revenue model:** x402 API fees (existing) + autonomous trading profits (new)

### Blockers
- **Agent wallet not created yet** — user needs to create in Phantom, export key, set on Railway (must be done outside Claude for security)
- **Price data stale** — last Scryfall ingestion was March. Must run cron after deploy.
- **Railway deploys are manual** — `railway up` required, no GitHub integration

### Key Decisions Made
- **Dedicated agent wallet** — separate from personal wallet for security isolation. Minimally funded, disposable.
- **Wallet architecture:** Main Phantom (revenue) + Agent wallet (signing) + Hardware wallet (cold storage, later)
- **Private key format:** Code accepts both JSON byte array and base58 string
- **Courtyard.io is the best autonomous trading target** — tokenized cards eliminate physical logistics, standard ERC-721s are programmatically tradeable
- **Multi-chain agent confirmed** — Solana for x402/identity, Ethereum for NFT trading

## Roadmap
- [x] Phase 1: DB Foundation
- [x] Phase 2: x402 Payment Layer
- [x] Phase 3: Price API
- [x] Phase 4: Deploy + Agent Registry
- [x] Phase 5: MTG Data Enrichment
- [x] Phase 6: Dashboard
- [x] Phase 7: SolEnrich Integration
- [ ] Go-Live: Agent wallet + deploy + data refresh + e2e test
- [ ] Phase 8: Tokenized RWA Oracle (Collector Crypt + Phygitals + Magic Eden ingestion, rwa-fair-value + rwa-arbitrage endpoints) — see `docs/PHASE-8-PLAN.md`
- [ ] Phase 9 (gated): Autonomous Trading Agent — start only after ≥1 paying bot user on Phase 8 oracle
