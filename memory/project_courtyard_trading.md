---
name: RWA Collectibles Trading Research
description: Courtyard (Polygon), Collector Crypt (Solana), Phygitals (Solana) — tokenized collectibles platforms and autonomous trading agent concept
type: project
---

## Courtyard.io — CORRECTION (2026-04-13)

Previous research incorrectly stated Courtyard was on Ethereum. Actual history:
- **2022:** Launched on Ethereum mainnet (ERC-721)
- **August 2023:** Migrated FROM Ethereum TO Polygon PoS (gasless, Privy wallets, Gelato gas abstraction)
- **2026:** Still exclusively on Polygon. No signs of Solana expansion.
- Polygon Registry contract: `0x251be3a17af4892035c37ebf5890f4a4d889dcad`
- Monthly volume: $78.4M (Aug 2025), up from $50K in Jan 2024 (~1,600x growth)
- Series A: $30M (July 2025) led by Forerunner/YC/ParaFi/NEA
- 500K+ physical collectibles on-chain, 74K unique owners
- 90% FMV instant buyback, 0% seller fees on their marketplace
- **No public API** — programmatic access only via Reservoir Protocol or OpenSea (secondary market)
- Pokemon + Baseball + NFL + Comics. No MTG.

## Collector Crypt — PRIMARY TARGET for Solana trading agent

- **Chain:** Solana (pNFTs) — native to CardEx's chain
- **Vaulting:** PWCC (climate-controlled facilities)
- **Volume:** $44M/month (Aug 2025), $89M+ total Gacha revenue, 124% MoM growth
- **Buyback:** ~85% of revealed NFT value (instant)
- **Fees:** 2% total (1% tx + 1% royalty)
- **CARDS token:** 2B max supply, FDV hit $450-600M post-launch (Aug 2025). 75% insider allocation is a concern.
- **Secondary markets:** Native marketplace + Magic Eden (launched via ME Launchpad)
- **Grading:** PSA, BGS, CGC certified
- **Programmatic access:** Magic Eden API + Tensor SDK (both documented)

## Phygitals — Smaller Solana competitor

- **Chain:** Solana
- **Volume:** $17.4M total (much smaller)
- **Buyback:** 85% FMV
- **Stats:** 60K+ tokenized cards, 500K+ RWA transactions
- **Unique:** Card vault owners receive 1% royalties on subsequent sales
- **Vaulting:** PSA, Fanatics, Alt

## Total Market

Tokenized Pokemon card market: **$124.5M/month** (Aug 2025), 5.5x increase from Jan 2025.
Global trading card market: $7.43B (2024), projected $15.84B by 2034.
No MTG tokenization exists anywhere — WotC hostile (mtgDAO cease-and-desist).

## Autonomous Trading Agent Concept

**Why:** CardEx pricing intelligence + SolEnrich wallet analysis + Collector Crypt listings = autonomous arbitrage.

**Three arbitrage vectors:**
1. **RWA underpriced** — Buy pNFT on Magic Eden below 85% FMV, instant-sell to Collector Crypt buyback
2. **Paper/RWA spread** — Buy pNFT, redeem physical, sell on TCGPlayer/eBay (highest profit, slowest)
3. **Cross-platform** — Collector Crypt vs Courtyard price differences (requires multi-chain, harder)

**Trading loop:** Signal detection (CardEx) → Wallet profiling (SolEnrich) → Evaluation (profit threshold) → Execution (Magic Eden/Tensor API)

**Programmatic trading stack:**
- Magic Eden API: REST, Bearer auth, 120 QPM, `@magiceden/magiceden-sdk`
- Tensor SDK: `@tensor-oss/tensorswap-sdk`, GraphQL at `api.tensor.so`, AMM pools, requires API application
- Solana Agent Kit (`sendaifun/solana-agent-kit`): 60+ actions, but NO marketplace trading plugins yet (gap/contribution opportunity)

**Revenue model:** x402 API fees (existing) + autonomous trading profits (new)

**Why:** CardEx already has the pricing data. Adding execution turns intelligence into revenue.
**How to apply:** Phase 8 should target Collector Crypt on Solana (not Courtyard on Polygon). Start with read-only signal detection, then add execution.
