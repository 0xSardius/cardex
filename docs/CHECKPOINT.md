# CardEx — Development Checkpoint

## Last Session: 2026-04-10

### What Was Completed
- **Go-live env vars configured on Railway:**
  - `CRON_SECRET` — generated and set (cron endpoints validate via `?secret=` query param)
  - `SOLANA_NETWORK=mainnet` — switched from devnet
  - `SOLANA_RPC_URL` — mainnet RPC (Helius) set
- **Courtyard.io research** — investigated as autonomous trading platform
  - ERC-721 NFTs on Ethereum mainnet (migrated from Polygon 2022)
  - Registry contract: `0xd4ac3CE8e1E14CD60666D49AC34Ff2d2937cF6FA`
  - Checkout/Minter: `0xaD510490474d835606DB31602AE987a115f298b2`
  - Physical cards vaulted in Brink's, 1:1 backed NFTs
  - Covers Pokemon + sports cards, no MTG yet
  - Buys at 90% FMV (instant liquidity floor)
  - No official trading API, but standard ERC-721s tradeable via OpenSea/Blur APIs
- **Autonomous trading agent concept explored** — CardEx as intelligence + execution layer
  - Arbitrage between tokenized (Courtyard/OpenSea) and paper (TCGPlayer) markets
  - Would require multi-chain agent (Solana for x402, Ethereum for NFT trading)
  - Architecture: signal evaluation → risk management → execution → P&L tracking

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
- **Still needs:** `SOLANA_PAY_TO_ADDRESS`, `SOLANA_PRIVATE_KEY` on Railway (agent wallet not yet created)
- **Latest code not deployed** — needs `railway up` after wallet setup

### Go-Live Checklist
1. ~~Set `CRON_SECRET` on Railway~~ DONE
2. ~~Set `SOLANA_NETWORK=mainnet` on Railway~~ DONE
3. ~~Set `SOLANA_RPC_URL` (mainnet Helius) on Railway~~ DONE
4. **Create dedicated agent wallet** — new Phantom account, export private key, store in password manager
5. **Set `SOLANA_PAY_TO_ADDRESS` on Railway** — main Phantom wallet (revenue destination)
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

### Future: Autonomous Trading Agent
- **Concept:** CardEx uses its own arbitrage signals to buy/sell tokenized cards
- **Platform:** Courtyard.io (ERC-721 on Ethereum) via OpenSea/Blur APIs
- **Architecture:** signal evaluation → risk controls → execution → P&L
- **Multi-chain:** Solana (x402 payments) + Ethereum (NFT trading)
- **Open questions:** capital allocation, liquidity depth, spread profitability after fees (~2.5% marketplace + gas)
- **Next research:** Check OpenSea API for current Courtyard listings and typical spreads
- **Revenue model shift:** data sales (x402) + trading profits (arbitrage)

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
- [ ] Phase 8: Autonomous Trading Agent (Courtyard.io / OpenSea integration)
