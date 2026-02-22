# CardEx — Design & Architecture Document

## x402 + ERC-8004 Pokémon Card Market Intelligence Agent

**Version:** 0.1 — Concept Architecture
**Author:** Justin
**Date:** February 2026

---

## 1. Vision

CardEx is an autonomous market intelligence agent for the Pokémon TCG collectibles market. It aggregates, analyzes, and resells real-time pricing intelligence across fragmented marketplaces — paying for data via x402 micropayments and monetizing insights the same way.

It is both a **consumer** and **provider** in the x402 agent economy, with an ERC-8004 onchain identity that accumulates verifiable reputation over time.

**One-liner:** *The Bloomberg Terminal for Pokémon cards, powered by autonomous agents and micropayments.*

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HUMAN LAYER                            │
│                                                             │
│   ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│   │  Dashboard    │    │  Telegram /  │   │  Farcaster   │  │
│   │  (Next.js)   │    │  Discord Bot │   │  MiniApp     │  │
│   └──────┬───────┘    └──────┬───────┘   └──────┬───────┘  │
│          │                   │                   │          │
└──────────┼───────────────────┼───────────────────┼──────────┘
           │                   │                   │
           ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY                             │
│              x402 Payment Verification                      │
│         (validates micropayments per request)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT CORE                                │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Orchestrator Agent                      │   │
│   │         (Vercel AI SDK / Daydreams)                  │   │
│   │                                                      │   │
│   │   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│   │   │ Price    │  │ Arbitrage│  │ Grading          │  │   │
│   │   │ Resolver │  │ Scanner  │  │ Probability      │  │   │
│   │   │ Agent    │  │ Agent    │  │ Agent            │  │   │
│   │   └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │   │
│   │        │              │                  │            │   │
│   │   ┌────┴─────┐  ┌────┴─────┐  ┌────────┴─────────┐  │   │
│   │   │ Portfolio │  │ Set      │  │ Trend            │  │   │
│   │   │ Valuation│  │ Advisor  │  │ Forecaster       │  │   │
│   │   │ Agent    │  │ Agent    │  │ Agent            │  │   │
│   │   └──────────┘  └──────────┘  └──────────────────┘  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              ERC-8004 Identity                        │   │
│   │   • Agent wallet (Base)                              │   │
│   │   • Reputation score (accuracy, uptime, freshness)   │   │
│   │   • Service registry (capabilities + pricing)        │   │
│   └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATA ACQUISITION LAYER                      │
│              (x402 micropayments outbound)                   │
│                                                              │
│   ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────────────┐  │
│   │TCGPlayer │ │ eBay     │ │ PSA    │ │ Japanese       │  │
│   │ API      │ │ Sold     │ │ Pop    │ │ Auctions       │  │
│   │          │ │ Listings │ │ Report │ │ (Mercari JP)   │  │
│   └──────────┘ └──────────┘ └────────┘ └────────────────┘  │
│                                                              │
│   ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐   │
│   │ Cardmarket│ │ PriceChar│ │ Social Sentiment         │   │
│   │ (EU)     │ │ ting     │ │ (Twitter/X, Reddit)      │   │
│   └──────────┘ └──────────┘ └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Core Entities

```
┌─────────────────────────────────────────┐
│                 Card                     │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ name            string                  │
│ set_id          string (FK → Set)       │
│ set_number      string ("25/102")       │
│ rarity          enum                    │
│ card_type       enum (pokemon|trainer|  │
│                      energy)            │
│ era             enum (wotc|ex|dp|bw|    │
│                      xy|sm|swsh|sv)     │
│ language        enum (en|jp|kr|zh)      │
│ first_edition   boolean                 │
│ shadowless      boolean                 │
│ image_url       string                  │
│ tcgplayer_id    string (nullable)       │
│ psa_cert_lookup string (nullable)       │
│ created_at      timestamp               │
│ updated_at      timestamp               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│                 Set                      │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ name            string                  │
│ code            string ("base1")        │
│ series          string                  │
│ era             enum                    │
│ total_cards     integer                 │
│ release_date    date                    │
│ logo_url        string                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│              PricePoint                  │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ card_id         string (FK → Card)      │
│ source          enum (tcgplayer|ebay|   │
│                      cardmarket|mercari_│
│                      jp|pricecharting)  │
│ condition       enum (raw|psa10|psa9|   │
│                      psa8|psa7|cgc10|   │
│                      cgc9.5|bgs10|...)  │
│ price_usd       decimal                 │
│ price_native    decimal                 │
│ currency        string                  │
│ listing_type    enum (sold|active|bid)  │
│ quantity        integer                 │
│ seller_id       string (nullable)       │
│ listing_url     string                  │
│ observed_at     timestamp               │
│ confidence      float (0-1)             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           MarketSnapshot                 │
│     (aggregated per card per day)        │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ card_id         string (FK → Card)      │
│ condition       enum                    │
│ date            date                    │
│ avg_price       decimal                 │
│ median_price    decimal                 │
│ low_price       decimal                 │
│ high_price      decimal                 │
│ volume          integer                 │
│ spread_pct      float                   │
│ sources_count   integer                 │
│ trend_7d        float (% change)        │
│ trend_30d       float (% change)        │
│ trend_90d       float (% change)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           ArbitrageOpportunity           │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ card_id         string (FK → Card)      │
│ condition       enum                    │
│ buy_source      enum (platform)         │
│ buy_price       decimal                 │
│ buy_url         string                  │
│ sell_source     enum (platform)         │
│ sell_price      decimal                 │
│ spread_usd      decimal                 │
│ spread_pct      float                   │
│ estimated_fees  decimal                 │
│ net_profit_est  decimal                 │
│ confidence      float (0-1)             │
│ detected_at     timestamp               │
│ status          enum (active|expired|   │
│                      executed)          │
│ ttl_minutes     integer                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           GradingEstimate                │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ card_id         string (FK → Card)      │
│ image_hash      string                  │
│ estimated_grade decimal (1-10)          │
│ grade_probs     jsonb                   │
│   { "psa10": 0.15, "psa9": 0.55, ... } │
│ raw_value       decimal                 │
│ graded_ev       decimal (expected value)│
│ grading_cost    decimal                 │
│ roi_estimate    float                   │
│ recommendation  enum (grade|hold|sell_  │
│                      raw)              │
│ created_at      timestamp               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│              Portfolio                   │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ owner_address   string (wallet or user) │
│ name            string                  │
│ created_at      timestamp               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           PortfolioItem                  │
├─────────────────────────────────────────┤
│ id              string (uuid)           │
│ portfolio_id    string (FK → Portfolio) │
│ card_id         string (FK → Card)      │
│ condition       enum                    │
│ quantity        integer                 │
│ cost_basis      decimal (nullable)      │
│ acquired_date   date (nullable)         │
│ notes           string                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│          AgentReputation                 │
│       (ERC-8004 onchain state)           │
├─────────────────────────────────────────┤
│ agent_address   string (Base address)   │
│ token_id        uint256                 │
│ total_queries   uint256                 │
│ accuracy_score  uint256 (basis points)  │
│ uptime_score    uint256 (basis points)  │
│ freshness_avg   uint256 (seconds)       │
│ revenue_total   uint256 (wei)           │
│ last_active     uint256 (block number)  │
│ services        string[] (capability    │
│                          registry)      │
│ metadata_uri    string (IPFS)           │
└─────────────────────────────────────────┘
```

### 3.2 Query/Response Schema (x402 Endpoints)

```typescript
// === PRICE LOOKUP ===
// Cost: $0.001 per query
POST /api/v1/price
x-402-payment: <payment_header>

Request:
{
  card_name: "Charizard",
  set: "base1",          // optional
  condition: "psa10",    // optional, defaults to all
  sources: ["tcgplayer", "ebay"]  // optional, defaults to all
}

Response:
{
  card: { id, name, set, image_url },
  prices: [
    { source: "tcgplayer", condition: "psa10", price: 42000.00, updated: "..." },
    { source: "ebay_sold", condition: "psa10", avg: 39500.00, last_sold: "..." }
  ],
  market_summary: {
    consensus_price: 40750.00,
    spread_pct: 6.3,
    trend_7d: -2.1,
    volume_7d: 12
  },
  agent: { address: "0x...", reputation_score: 9847 }
}

// === ARBITRAGE SCAN ===
// Cost: $0.005 per scan
POST /api/v1/arbitrage
x-402-payment: <payment_header>

Request:
{
  min_spread_pct: 10,       // minimum spread to report
  max_results: 20,
  era_filter: "wotc",       // optional
  min_value_usd: 50,        // optional floor
  max_value_usd: 5000       // optional ceiling
}

Response:
{
  opportunities: [
    {
      card: { name: "Blastoise", set: "Base Set", condition: "psa9" },
      buy: { source: "mercari_jp", price: 180.00, url: "..." },
      sell: { source: "tcgplayer", price: 245.00, url: "..." },
      spread_pct: 36.1,
      est_fees: 28.50,
      net_profit_est: 36.50,
      confidence: 0.82,
      ttl_minutes: 45
    },
    // ...
  ],
  scan_metadata: { sources_checked: 5, cards_analyzed: 14200, scan_duration_ms: 3200 }
}

// === GRADING ESTIMATE ===
// Cost: $0.01 per estimate (higher — uses vision model)
POST /api/v1/grade
x-402-payment: <payment_header>

Request:
{
  card_id: "...",              // optional if image provided
  image_front: "<base64>",
  image_back: "<base64>"       // optional
}

Response:
{
  card: { name: "...", set: "..." },
  grade_probabilities: {
    "psa10": 0.12, "psa9": 0.58, "psa8": 0.22, "psa7": 0.06, "below": 0.02
  },
  financial_analysis: {
    raw_value: 85.00,
    graded_expected_value: 218.40,
    grading_cost: 22.00,
    expected_roi: 131.1,
    recommendation: "GRADE",
    reasoning: "58% chance of PSA 9 ($280) makes grading +EV at $22 cost"
  }
}

// === PORTFOLIO VALUATION ===
// Cost: $0.002 per card in portfolio
POST /api/v1/portfolio/value
x-402-payment: <payment_header>

Request:
{
  items: [
    { card_name: "Charizard", set: "base1", condition: "psa9", quantity: 1 },
    { card_name: "Pikachu Illustrator", condition: "psa7", quantity: 1 }
  ]
}

Response:
{
  total_value: 485200.00,
  items: [ /* per-card valuation with trends */ ],
  portfolio_metrics: {
    diversification_score: 0.34,
    volatility_30d: 8.2,
    top_concentration_pct: 92.1
  }
}

// === SET COMPLETION ===
// Cost: $0.008 per set analysis
POST /api/v1/set/complete
x-402-payment: <payment_header>

Request:
{
  set: "fossil",
  target_condition: "psa9",
  owned: ["1/62", "3/62", "5/62"]   // cards already owned
}

Response:
{
  set: { name: "Fossil", total: 62 },
  completion_pct: 4.8,
  remaining: [
    { number: "2/62", name: "Articuno", cheapest: { source: "tcgplayer", price: 145.00, url: "..." } },
    // ...
  ],
  total_cost_cheapest_path: 4820.00,
  strategy: "12 cards available cheaper on Cardmarket EU — potential savings of $340"
}
```

---

## 4. Business Model

### 4.1 Revenue Streams

```
┌─────────────────────────────────────────────────────────────┐
│                    REVENUE MATRIX                            │
├──────────────────────┬──────────┬───────────────────────────┤
│ Endpoint             │ Per-Call │ Revenue Driver            │
├──────────────────────┼──────────┼───────────────────────────┤
│ Price Lookup         │ $0.001   │ High volume, commodity    │
│ Arbitrage Scan       │ $0.005   │ High value, trader demand │
│ Grading Estimate     │ $0.01    │ Premium (vision model)    │
│ Portfolio Valuation  │ $0.002/  │ Recurring, sticky         │
│                      │   card   │                           │
│ Set Completion       │ $0.008   │ Collector-focused         │
│ Trend Alerts (push)  │ $0.003   │ Subscription-like via     │
│                      │          │ recurring micropayments   │
├──────────────────────┼──────────┼───────────────────────────┤
│ Agent-to-Agent Bulk  │ 20%      │ Wholesale data licensing  │
│ (>1000 queries/day)  │ discount │ to other agents           │
└──────────────────────┴──────────┴───────────────────────────┘
```

### 4.2 Cost Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    COST PER QUERY                            │
├──────────────────────┬──────────────────────────────────────┤
│ Data acquisition     │ $0.0002 - $0.001 per source per call│
│ (x402 outbound)      │ (varies by source & data freshness) │
├──────────────────────┼──────────────────────────────────────┤
│ LLM inference        │ ~$0.001 per query (Sonnet for       │
│                      │ analysis, Haiku for routing)         │
├──────────────────────┼──────────────────────────────────────┤
│ Vision model (grade) │ ~$0.005 per grading estimate         │
├──────────────────────┼──────────────────────────────────────┤
│ Compute / hosting    │ ~$0.0001 per query (amortized)      │
├──────────────────────┼──────────────────────────────────────┤
│ Base gas fees         │ Negligible (~$0.001 per tx batch)   │
├──────────────────────┴──────────────────────────────────────┤
│ GROSS MARGIN ESTIMATE: 55-70% on standard queries           │
│                        40-50% on grading estimates           │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Unit Economics at Scale

```
Scenario: 10,000 queries/day (mix across endpoints)

  Avg revenue per query:    $0.004
  Daily revenue:            $40
  Monthly revenue:          $1,200
  
  Avg cost per query:       $0.0015
  Daily cost:               $15
  Monthly cost:             $450
  
  Monthly gross profit:     $750
  Gross margin:             62.5%

Scenario: 100,000 queries/day (agent-to-agent + human)

  Monthly revenue:          $12,000
  Monthly cost:             $4,500
  Monthly gross profit:     $7,500

Note: The flywheel — as more agents come online in the x402
ecosystem, query volume scales without marketing spend.
Agent-to-agent commerce is the growth engine.
```

### 4.4 The Flywheel

```
  More accurate data
        │
        ▼
  Higher reputation score (ERC-8004)
        │
        ▼
  More agents trust & query CardEx
        │
        ▼
  More revenue → reinvest in more data sources
        │
        ▼
  More accurate data (repeat)
```

### 4.5 Competitive Moat

1. **Data aggregation breadth** — No single platform has cross-market pricing. CardEx stitches them together.
2. **ERC-8004 reputation** — Trust is earned and onchain. New entrants start at zero.
3. **x402 network effects** — First agent in this niche captures the default routing from other agents seeking card data.
4. **Historical depth** — Every price point is stored. Over time, CardEx becomes the de facto pricing oracle for Pokémon cards.
5. **Multi-language/market** — Japanese market data is the biggest arbitrage edge and hardest to replicate.

---

## 5. Technical Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Agent Runtime      | Vercel AI SDK + Daydreams (optional)    |
| Framework          | Next.js 15 (App Router)                |
| Language           | TypeScript                              |
| Database           | Postgres (Supabase) + pgvector          |
| Cache              | Redis (Upstash) — hot price data        |
| x402 Payments      | Coinbase x402 SDK (Base network)        |
| Agent Identity     | ERC-8004 on Base                        |
| LLM                | Claude Sonnet 4.5 (analysis)            |
|                    | Claude Haiku 4.5 (routing/classification)|
| Vision             | Claude Sonnet 4.5 (grading estimates)   |
| Scraping           | Playwright / Browserbase               |
| Job Scheduling     | Trigger.dev or Inngest                  |
| Hosting            | Vercel (API + frontend)                 |
| Monitoring         | OpenTelemetry + Helicone                |

---

## 6. MVP Scope (v0.1)

### Must Have (Week 1-2)
- [ ] Card database seeded (pokemontcg.io API — free)
- [ ] TCGPlayer price ingestion (primary source)
- [ ] Single-card price lookup endpoint with x402 gate
- [ ] ERC-8004 agent identity deployed on Base
- [ ] Basic Next.js dashboard (search → price result)

### Should Have (Week 3-4)
- [ ] eBay sold listings integration
- [ ] Arbitrage detection (TCGPlayer vs eBay)
- [ ] Portfolio valuation endpoint
- [ ] Reputation tracking (accuracy scoring)

### Nice to Have (Week 5-6)
- [ ] Grading probability engine (vision-based)
- [ ] Japanese market data (Mercari JP)
- [ ] Set completion advisor
- [ ] Trend alerts (push notifications via x402)
- [ ] Farcaster MiniApp or Telegram bot

---

## 7. Key Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| TCGPlayer/eBay API access restrictions | High | Use official APIs where possible; Browserbase for scraping fallback; cache aggressively |
| Low initial query volume | Medium | Seed demand via human dashboard; Farcaster community; target Discord bot integrators |
| Pricing data staleness | Medium | Freshness scoring per data point; TTL-based cache invalidation; transparent staleness indicators |
| x402 ecosystem too early | Medium | Support traditional API keys as fallback; x402 as premium/discount tier |
| Grading estimate liability | Low | Always present as estimates with confidence intervals; never guarantee grades |

---

## 8. Success Metrics

| Metric | Target (Month 1) | Target (Month 6) |
|--------|-------------------|-------------------|
| Daily queries | 500 | 25,000 |
| Unique agents consuming data | 3 | 50 |
| ERC-8004 reputation score | 8,000 | 9,500+ |
| Price sources integrated | 2 | 6 |
| Arbitrage accuracy (detected vs. actual) | 70% | 85% |
| Revenue (monthly) | $60 | $3,000 |
| Gross margin | 50% | 65% |

---

## Next Steps

- [ ] Confirm architecture → move to PRD
- [ ] Validate TCGPlayer API access and rate limits
- [ ] Prototype single-card price lookup with x402 gate
- [ ] Deploy ERC-8004 identity contract on Base testnet
