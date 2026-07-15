# Idea Context — CardEx

## Idea
Solana-native pricing oracle + autonomous trading agent for tokenized collectibles
(Collector Crypt Pokémon pNFTs). Lane A: sell paper-vs-onchain mispricing signal to
humans/agents. Lane B: own deterministic arbitrage trader.

## validation
- go_no_go: pivot (go-validate — test demand before further build/spend)
- confidence: 0.65
- demand_signals:
  - "Tokenized Pokémon market ~$124M/mo, growing YoY (TAM — weak signal)"
  - "Whitespace: no neutral agent-facing card oracle exists (but CC self-serves internally)"
  - "ZERO paying users after full build phase (absence of signal)"
  - "ZERO user conversations / outreach ever done (untested)"
  - "Unfair advantage: cross-market offchain data depth + live x402/SolEnrich/8004 infra + insured-value-as-graded-proxy insight"
- risks:
  - { category: market, description: "Demand unproven for both lanes; never tested", severity: high }
  - { category: market, description: "Agent per-call payment market ~$14k/day real; a 2027 bet. Humans pay sooner", severity: high }
  - { category: market, description: "Thin/concentrated liquidity (82% of CC listings = 1 vault); exit is the binding constraint", severity: med-high }
  - { category: technical, description: "Trader edge unconfirmed; honest gate + insured-value check suggest most deals are artifacts", severity: med }
  - { category: regulatory, description: "Collectibles ruled non-securities; CC US-block avoided via secondary trading", severity: low }
- next_steps:
  - "Free insured-value-anchored gate read (no API spend) — confirm/kill the edge"
  - "Lane A: post demo + mispricing finding in 2-3 channels; measure access requests"
  - "Lane B: talk to 3-5 ME/CC arbitrage bot operators about how they price slabs today"
  - "Pay $9.99 PPT only when someone asks to pay OR free edge read proves real"
  - "Integration-first: composes ME/Tensor/Pyth/SolEnrich/8004 — no custom program/audit"

## landscape (Jupiter Gacha expansion — mapped 2026-07-15)
- direct_competitors:
  - { name: "RipIndex", url: "https://rip-index.com", status: live-free, strength: "7 platforms tracked, 175K+ CC pulls, Telegram alerts, pull feeds, observed-vs-published odds", weakness: "no Jupiter Gacha coverage yet, no paper-market valuation methodology, no API — candidate CUSTOMER for CardEx x402 valuations" }
- substitutes:
  - { name: "Collector Crypt Gacha API `ev` field", approach: "platform-published rarity-weighted EV vs its own insured values", why_users_stay: "zero-effort, in-product — but conflicted (platform sets the insured values)" }
  - { name: "Anime gacha calculators (gachacalc.com etc.)", approach: "pity/odds math for game currencies", why_users_stay: "n/a — no RWA/dollar EV; proves the mental model only" }
- dead_projects: [] (space is days old; RipIndex notes some tracked sites lack full pull feeds)
- crowdedness: "moderate" (pull-tracking lane) / "empty" (paper-truth EV, rewards-adjusted EV, post-pull exits, Offerbook lender valuation, any Jupiter Gacha coverage)
- moat_type: proprietary-data (cross-market paper comps + fee-netted exit model; unreproducible without catalog/ingestion work)
- differentiation: "Platform-insured-value EV vs independent paper-truth EV gap, rewards-adjusted Season-1 EV, and the post-pull exit verdict — don't compete with RipIndex on pull tracking"

## Phase
Validated 2026-06-19. Verdict: go-validate. Proceed to Build only after a demand signal
or a confirmed free edge read.
**Update 2026-07-15:** Jupiter Gacha launch (7/13, built on CC+Phygitals) is the demand-context
shift the validation asked for — compressed Season 1 window, specs in docs/jupiter-gacha/.
Landscape above. CC Gacha Machine API removes most of the indexing build risk.
