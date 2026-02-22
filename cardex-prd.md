# CardEx — Product Requirements Document

## x402 + ERC-8004 Pokémon Card Market Intelligence Agent

| Field | Detail |
|---|---|
| **Product** | CardEx |
| **Author** | Justin |
| **Version** | 0.1 — MVP Spec |
| **Date** | February 18, 2026 |
| **Status** | Draft |
| **Target Launch** | MVP in 2 weeks |

---

## 1. Executive Summary

CardEx is an autonomous market intelligence agent for the Pokémon TCG collectibles market. It aggregates real-time pricing data from fragmented platforms, analyzes cross-market opportunities, and serves structured intelligence to both human users and other autonomous agents via x402 micropayment-gated API endpoints.

The agent maintains a verifiable onchain identity via ERC-8004 on Base, building trust and reputation through provable accuracy, uptime, and data freshness. CardEx is both a consumer and provider of x402 micropayments — it pays for data acquisition and earns from intelligence distribution.

**Why now:** The x402 protocol and ERC-8004 standard are reaching maturity while the Pokémon TCG market ($12B+ globally) remains fragmented with no agent-native data infrastructure. CardEx captures first-mover advantage as the default pricing oracle in the emerging agent economy.

---

## 2. Problem Statement

### 2.1 Market Pain Points

**Fragmented pricing data.** Pokémon card prices are spread across TCGPlayer, eBay, Cardmarket (EU), Mercari Japan, PriceCharting, and dozens of smaller platforms. No single source provides a unified, real-time cross-market view. Collectors and dealers spend hours manually cross-referencing prices to make informed buy/sell decisions.

**Invisible arbitrage.** Price discrepancies between platforms — especially between US, EU, and Japanese markets — create significant profit opportunities that are nearly impossible to detect manually. A PSA 9 card might be listed at $180 on Mercari JP and $245 on TCGPlayer, but discovering this requires monitoring multiple sites in multiple languages simultaneously.

**Grading ROI is a black box.** Professional grading (PSA, CGC, BGS) costs $20-150 per card and takes weeks to months. Collectors submit cards without data-driven guidance on grade probability or expected return on investment. The delta between raw and graded values can be 2-10x, making this a high-stakes decision with no analytical tooling.

**No agent-native infrastructure.** As autonomous agents proliferate (Discord bots, portfolio trackers, trading assistants), there is no structured, pay-per-query pricing oracle for collectibles. Bot developers either scrape unreliably or hardcode stale data.

### 2.2 Existing Alternatives

| Alternative | Limitation |
|---|---|
| TCGPlayer Market Price | Single platform, US only, no arbitrage detection |
| PriceCharting | Historical focus, no real-time, no cross-market |
| eBay sold listings | Manual search, no aggregation, no API |
| Discord alpha groups | Unstructured, unreliable, human-dependent |
| Spreadsheet tracking | Manual, stale immediately, doesn't scale |

---

## 3. Target Users

### 3.1 Primary: Autonomous Agents

Software agents (Discord bots, Telegram bots, portfolio management tools, trading bots) that need structured, real-time pricing data via API. These agents consume data programmatically and pay per query via x402. They represent the highest-volume, most scalable customer segment.

**Key needs:** Structured JSON responses, low latency, high uptime, verifiable data freshness, no API key management overhead.

### 3.2 Secondary: Serious Collectors & Investors

Individuals with $1K+ Pokémon card portfolios who actively buy, sell, and grade cards. They want a dashboard to track portfolio value, spot buying opportunities, and make data-driven grading decisions.

**Key needs:** Cross-platform price comparison, portfolio tracking, grading ROI calculator, trend alerts.

### 3.3 Tertiary: Card Shop Owners & Dealers

Local and online card shops that need competitive pricing intelligence to set buy/sell prices. They process dozens of pricing decisions daily.

**Key needs:** Bulk pricing lookups, market-relative pricing, inventory valuation.

### 3.4 Early Adopters

Web3-native card collectors active on Farcaster and in card trading Discord communities. Discord/Telegram bot developers building card-related tools. These users understand micropayments natively and provide fast feedback loops.

---

## 4. Product Vision & Principles

### 4.1 Design Principles

**Agent-first, human-friendly.** The core product is the API. The dashboard is a demonstration layer and onramp, not the primary product surface. Every feature must work headlessly before it gets a UI.

**Pay-per-use, not subscribe.** x402 micropayments eliminate subscription fatigue, API key management, and billing relationships. Users and agents pay exactly for what they consume. This lowers the barrier to first use to near-zero.

**Trust through transparency.** The ERC-8004 identity makes accuracy, uptime, and freshness verifiable onchain. Data quality isn't claimed — it's proven. Every price point carries a confidence score and source attribution.

**Lean data acquisition.** CardEx only pays for data when there's demand. No bulk data licensing deals, no upfront API subscriptions. Outbound x402 micropayments to data sources keep variable costs proportional to revenue.

**Composability over completeness.** Build atomic, well-defined endpoints that other agents and tools can compose. Don't try to build the entire trading workflow — be the best pricing oracle and let the ecosystem build on top.

### 4.2 Non-Goals (MVP)

- CardEx does NOT facilitate purchases or trades directly
- CardEx does NOT provide financial advice or trade recommendations
- CardEx does NOT authenticate or grade physical cards
- CardEx does NOT handle custody of cards or funds
- CardEx does NOT support non-Pokémon TCG collectibles in v1

---

## 5. Feature Specification

### 5.1 Phase 1 — MVP (Weeks 1–2)

The MVP delivers a single, working x402-gated price lookup endpoint backed by a seeded card database and one primary data source. This is the minimum viable product for hackathon submission and early feedback.

#### F1.1: Card Database

**Description:** A comprehensive, searchable database of Pokémon TCG cards seeded from the pokemontcg.io API.

**Requirements:**
- Ingest all cards from pokemontcg.io (15,000+ unique cards across all sets)
- Store: name, set, set number, rarity, card type, era, language, image URL
- Support search by name (fuzzy match), set code, set number, and rarity
- Include first edition and shadowless variant flags for WOTC-era cards
- Index for fast lookup by name + set combination

**Acceptance Criteria:**
- Database contains all cards from pokemontcg.io
- Search returns relevant results in < 200ms
- Fuzzy name matching handles common misspellings ("Charzard" → "Charizard")

#### F1.2: TCGPlayer Price Ingestion

**Description:** Automated price data collection from TCGPlayer for all cards in the database.

**Requirements:**
- Fetch current market price, low price, and mid price for each card
- Support condition variants: Near Mint, Lightly Played, raw, 1st Edition
- Update prices on a scheduled cadence (minimum every 4 hours for MVP)
- Store each price observation as an immutable PricePoint with timestamp
- Calculate and store daily MarketSnapshot aggregations

**Acceptance Criteria:**
- Price data available for 90%+ of cards with active TCGPlayer listings
- Price points include source attribution and observation timestamp
- Data freshness is queryable per card

#### F1.3: Price Lookup API with x402 Gating

**Description:** A public API endpoint that returns structured price data for a given card, gated behind x402 micropayment verification.

**Endpoint:** `POST /api/v1/price`

**Request Schema:**
```json
{
  "card_name": "Charizard",
  "set": "base1",
  "condition": "psa10",
  "sources": ["tcgplayer"]
}
```

**Response Schema:**
```json
{
  "card": {
    "id": "uuid",
    "name": "Charizard",
    "set": "Base Set",
    "set_number": "4/102",
    "image_url": "https://..."
  },
  "prices": [
    {
      "source": "tcgplayer",
      "condition": "Near Mint",
      "price_usd": 420.00,
      "observed_at": "2026-02-18T14:30:00Z"
    }
  ],
  "market_summary": {
    "consensus_price": 420.00,
    "sources_count": 1,
    "data_freshness_seconds": 3600
  },
  "agent": {
    "address": "0x...",
    "reputation_score": 8000
  }
}
```

**Requirements:**
- x402 payment header required on all requests (price: $0.001/query)
- Payment verification via Coinbase x402 SDK on Base network
- Response includes agent ERC-8004 address and current reputation score
- Latency target: < 500ms p95 (cache-hit), < 2s p95 (cache-miss)
- Rate limiting: 100 requests/second per agent address

**Acceptance Criteria:**
- Endpoint returns accurate price data for any card in the database
- Requests without valid x402 payment header receive 402 Payment Required
- Successful payment is verifiable onchain

#### F1.4: ERC-8004 Agent Identity

**Description:** Deploy an ERC-8004 agent identity contract on Base that represents CardEx onchain.

**Requirements:**
- Deploy ERC-8004 token on Base (mainnet or testnet for MVP)
- Token metadata includes: agent name, service capabilities, pricing schedule
- Contract tracks: total queries served, uptime percentage, data freshness average
- Agent wallet holds USDC for x402 outbound payments (data acquisition)
- Agent wallet receives USDC from x402 inbound payments (query revenue)

**Acceptance Criteria:**
- ERC-8004 token deployed and verifiable on Base block explorer
- Metadata URI resolves to valid JSON describing CardEx capabilities
- Query count increments with each served request

#### F1.5: Dashboard (Minimal)

**Description:** A Next.js web interface for human users to search cards and view prices.

**Requirements:**
- Search bar with autocomplete for card names
- Card detail page showing: image, current prices by condition, price chart (7/30/90 day)
- Mobile responsive
- Connection to the same data layer as the API (not a separate pipeline)

**Acceptance Criteria:**
- Users can search and find any card in the database
- Price data matches API responses exactly
- Page load < 2 seconds on 4G connection

---

### 5.2 Phase 2 — Multi-Source & Arbitrage (Weeks 3–4)

Phase 2 expands data coverage and introduces the first high-value analytical feature.

#### F2.1: eBay Sold Listings Integration

**Requirements:**
- Ingest eBay "sold" listings for Pokémon cards (completed sales, not active)
- Parse listing titles to match against card database (name, set, condition, graded/raw)
- Store as PricePoints with eBay as source
- Handle condition inference from listing titles (e.g., "PSA 10" in title → psa10 condition)
- Update cadence: every 6 hours minimum

#### F2.2: Arbitrage Detection Engine

**Endpoint:** `POST /api/v1/arbitrage`

**Requirements:**
- Compare prices across all integrated sources for identical card + condition combinations
- Calculate gross spread, estimated platform fees (seller fees per platform), and net profit estimate
- Filter by minimum spread percentage, price range, era, and condition
- Assign confidence score based on: data freshness, listing count, and price consistency
- TTL on each opportunity (estimated time before the gap closes)
- x402 price: $0.005 per scan

**Acceptance Criteria:**
- Returns opportunities sorted by net profit estimate descending
- Confidence score correlates with actual exploitability (track retrospectively)
- Zero false opportunities from stale data (> 24hr old prices excluded)

#### F2.3: Portfolio Valuation

**Endpoint:** `POST /api/v1/portfolio/value`

**Requirements:**
- Accept a list of cards with conditions and quantities
- Return per-card valuation using consensus price across all sources
- Return portfolio-level metrics: total value, concentration %, 7/30/90d trend, volatility
- x402 price: $0.002 per card in portfolio

#### F2.4: Reputation System v1

**Requirements:**
- Track accuracy: compare CardEx consensus prices against actual eBay sold prices (ground truth)
- Track freshness: average age of price data served per query
- Track uptime: percentage of successful responses vs. errors
- Update ERC-8004 onchain reputation weekly (batch update to save gas)
- Expose reputation data in every API response

---

### 5.3 Phase 3 — Premium Features (Weeks 5–6)

Phase 3 introduces the highest-margin features and expands market coverage.

#### F3.1: Grading Probability Engine

**Endpoint:** `POST /api/v1/grade`

**Requirements:**
- Accept front (required) and back (optional) card images as base64
- Use Claude Sonnet 4.5 vision to assess: centering, surface condition, edge wear, corner sharpness
- Output probability distribution across grades: PSA 10, 9, 8, 7, below 7
- Cross-reference grade probabilities with market prices to calculate expected ROI of grading
- Factor in current grading costs by service level (PSA: $22-$150, CGC: $15-$75)
- Output recommendation: GRADE, HOLD, or SELL RAW with reasoning
- x402 price: $0.01 per estimate

**Acceptance Criteria:**
- Grade probability distribution sums to 1.0
- ROI calculation accounts for grading cost, shipping, and insurance
- Recommendation logic is explainable in response

#### F3.2: Japanese Market Data

**Requirements:**
- Integrate Mercari Japan listings for Japanese Pokémon cards
- Currency conversion (JPY → USD) using live exchange rates
- Cross-market arbitrage detection: Japan ↔ US, Japan ↔ EU
- Handle Japanese card names with English card database mapping

#### F3.3: Set Completion Advisor

**Endpoint:** `POST /api/v1/set/complete`

**Requirements:**
- Accept: target set, target condition, list of already-owned cards
- Return: remaining cards with cheapest source per card, total completion cost
- Optimize for cheapest path (may mix sources per card)
- Identify "bottleneck" cards (rarest/most expensive remaining)
- x402 price: $0.008 per set analysis

#### F3.4: Trend Alerts (Push)

**Requirements:**
- Users/agents register interest in specific cards or conditions
- CardEx monitors for: price drops > X%, new arbitrage opportunities, significant volume spikes
- Push alerts via webhook URL (agent-to-agent) or Telegram/Discord (human)
- Each alert delivery is a x402 micropayment: $0.003 per alert
- Users set budget caps to control spend

#### F3.5: Distribution Channels

**Requirements:**
- Farcaster MiniApp: card search + price lookup in-frame
- Telegram bot: `/price Charizard base set` → inline price response
- Both channels authenticate via x402 or fall back to free tier (limited queries)

---

## 6. Technical Architecture

### 6.1 System Overview

```
Human Layer          API Gateway (x402)          Agent Core
─────────────       ─────────────────          ──────────────
Next.js Dashboard    Payment Verification       Orchestrator Agent
Telegram Bot         Rate Limiting              ├─ Price Resolver
Farcaster MiniApp    Request Routing            ├─ Arbitrage Scanner
                                                ├─ Grading Engine
                                                ├─ Portfolio Valuator
                                                └─ Set Advisor

                     ERC-8004 Identity          Data Acquisition Layer
                     ─────────────────          ─────────────────────
                     Agent Wallet (Base)         TCGPlayer API
                     Reputation Tracking         eBay Sold Listings
                     Service Registry            Mercari JP
                                                 PSA Pop Reports
                                                 PriceCharting
```

### 6.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js / Vercel AI SDK | Justin's primary stack, excellent agent tooling |
| Framework | Next.js 15 (App Router) | API routes + dashboard in single deploy |
| Language | TypeScript | Type safety across agent logic |
| Database | PostgreSQL (Supabase) | Relational + pgvector for fuzzy search |
| Cache | Redis (Upstash) | Hot price data, rate limiting |
| Payments | Coinbase x402 SDK | Native x402 support on Base |
| Identity | ERC-8004 on Base | Agent reputation standard |
| LLM (Analysis) | Claude Sonnet 4.5 | Complex reasoning for arbitrage/grading |
| LLM (Routing) | Claude Haiku 4.5 | Fast classification and query routing |
| Vision | Claude Sonnet 4.5 | Card grading image analysis |
| Scraping | Playwright + Browserbase | Headless browser for eBay/Mercari |
| Jobs | Inngest or Trigger.dev | Scheduled price ingestion pipelines |
| Hosting | Vercel | Serverless, auto-scaling, edge network |
| Monitoring | Helicone + OpenTelemetry | LLM observability + system tracing |

### 6.3 Data Flow

**Inbound (Data Acquisition):**
1. Scheduled jobs trigger every N hours per source
2. Agent pays x402 micropayment to data source (or scrapes if no x402 source)
3. Raw price data is normalized into PricePoint schema
4. PricePoints are written to Postgres with source + timestamp
5. MarketSnapshot aggregations are computed and cached in Redis
6. Arbitrage detection runs against fresh snapshots

**Outbound (Intelligence Serving):**
1. External agent or user sends request with x402 payment header
2. API gateway verifies payment on Base
3. Request is routed to appropriate sub-agent
4. Sub-agent queries cached data (Redis) or falls back to Postgres
5. Response is structured, signed with agent identity, and returned
6. ERC-8004 reputation counters are incremented

### 6.4 x402 Payment Flow

```
Inbound Query:
  Agent/User → x402 payment (USDC on Base) → CardEx API
  CardEx verifies payment → Serves response → Increments reputation

Outbound Acquisition:
  CardEx → x402 payment (USDC on Base) → Data Source API
  Source verifies payment → Returns raw data → CardEx ingests
```

For MVP, outbound data acquisition may use traditional API keys where x402 sources don't exist yet. The architecture supports both, with x402 as the preferred path.

---

## 7. Data Model

*Reference: Full entity definitions in CardEx Architecture Document v0.1*

**Core entities:** Card, Set, PricePoint, MarketSnapshot, ArbitrageOpportunity, GradingEstimate, Portfolio, PortfolioItem, AgentReputation.

**Key design decisions:**
- PricePoints are append-only (immutable historical record)
- MarketSnapshots are computed daily aggregations (queryable for trends)
- ArbitrageOpportunities have TTLs and status tracking
- AgentReputation mirrors onchain ERC-8004 state

---

## 8. Business Model

### 8.1 Pricing

| Endpoint | Price per Call | Rationale |
|---|---|---|
| Price Lookup | $0.001 | High volume, low compute |
| Arbitrage Scan | $0.005 | High value, multi-source compute |
| Grading Estimate | $0.01 | Vision model cost + high value |
| Portfolio Valuation | $0.002/card | Scales with portfolio size |
| Set Completion | $0.008 | Complex multi-card analysis |
| Trend Alert (push) | $0.003 | Per-delivery, budget-capped |

### 8.2 Unit Economics

**Gross margin target:** 55–70% on standard queries, 40–50% on grading estimates.

**Cost per query breakdown:**
- Data acquisition: $0.0002–$0.001 per source per call
- LLM inference: ~$0.001 per query (Sonnet for analysis, Haiku for routing)
- Vision model (grading only): ~$0.005 per estimate
- Infrastructure (amortized): ~$0.0001 per query

### 8.3 Revenue Projections

| Metric | Month 1 | Month 3 | Month 6 | Month 12 |
|---|---|---|---|---|
| Daily queries | 500 | 3,000 | 25,000 | 100,000 |
| Avg revenue/query | $0.003 | $0.004 | $0.004 | $0.005 |
| Monthly revenue | $45 | $360 | $3,000 | $15,000 |
| Gross margin | 50% | 58% | 65% | 70% |

Revenue growth is driven primarily by agent-to-agent adoption, which scales without marketing spend as the x402 ecosystem expands.

---

## 9. Success Metrics & KPIs

### 9.1 North Star Metric

**Daily unique agents consuming data** — this measures adoption in the agent economy, which is the primary growth driver. Human dashboard users are a secondary indicator.

### 9.2 KPI Dashboard

| Category | Metric | MVP Target | 6-Month Target |
|---|---|---|---|
| **Adoption** | Daily queries | 500 | 25,000 |
| **Adoption** | Unique consuming agents | 3 | 50 |
| **Adoption** | Dashboard MAU | 50 | 2,000 |
| **Quality** | Price accuracy vs. eBay sold (ground truth) | 85% within 10% | 95% within 5% |
| **Quality** | Data freshness (avg seconds since last update) | < 14,400 (4hr) | < 3,600 (1hr) |
| **Quality** | ERC-8004 reputation score | 8,000 | 9,500 |
| **Quality** | API uptime | 99% | 99.9% |
| **Revenue** | Monthly revenue | $45 | $3,000 |
| **Revenue** | Gross margin | 50% | 65% |
| **Engagement** | Queries per agent per day (top 10 agents) | 50 | 500 |

---

## 10. Risks & Mitigations

| # | Risk | Severity | Probability | Mitigation |
|---|---|---|---|---|
| R1 | TCGPlayer restricts API access or changes terms | High | Medium | Use official API within ToS; Browserbase scraping as fallback; aggressive caching reduces call frequency |
| R2 | eBay blocks scraping | High | Medium | Use eBay Browse API (official); Browserbase with rotating proxies as fallback; focus on sold listings (less protected) |
| R3 | Low initial query volume | Medium | High | Seed demand via human dashboard and Farcaster community; offer free tier (10 queries/day) to onboard bot developers; target Discord communities directly |
| R4 | x402 ecosystem too nascent | Medium | Medium | Support traditional API keys as fallback; position x402 as premium tier with lower pricing; document clearly for bot developers |
| R5 | Price data staleness causing bad arbitrage signals | High | Low | Freshness scoring on every data point; TTL-based cache invalidation; exclude stale data from arbitrage calculations; transparent staleness indicators in responses |
| R6 | Grading estimate inaccuracy causing user losses | Medium | Medium | Always present as probability distributions, never guarantees; include confidence intervals; track accuracy retrospectively and publish results; clear disclaimer in responses |
| R7 | Competitor launches similar agent | Low | Low | First-mover ERC-8004 reputation is compounding moat; Japanese market data is hard to replicate; historical data depth increases over time |

---

## 11. Milestones & Timeline

### Phase 1: MVP (Weeks 1–2)

| Week | Deliverable | Owner |
|---|---|---|
| W1 Day 1–2 | Seed card database from pokemontcg.io, set up Supabase schema | Justin |
| W1 Day 3–4 | TCGPlayer price ingestion pipeline (scheduled via Inngest) | Justin |
| W1 Day 5 | x402 payment verification middleware (Coinbase SDK) | Justin |
| W2 Day 1–2 | Price lookup API endpoint with x402 gating | Justin |
| W2 Day 3 | Deploy ERC-8004 identity on Base (testnet) | Justin |
| W2 Day 4–5 | Minimal Next.js dashboard (search + card detail) | Justin |

**Phase 1 exit criteria:** A developer can send an x402 payment and receive structured price data for any Pokémon card in the database. Dashboard shows the same data for human users.

### Phase 2: Multi-Source & Arbitrage (Weeks 3–4)

| Week | Deliverable |
|---|---|
| W3 Day 1–3 | eBay sold listings integration |
| W3 Day 4–5 | Arbitrage detection engine |
| W4 Day 1–2 | Portfolio valuation endpoint |
| W4 Day 3–4 | Reputation system v1 (accuracy tracking + onchain update) |
| W4 Day 5 | Dashboard updates: multi-source prices, arbitrage tab |

**Phase 2 exit criteria:** Arbitrage scan returns cross-platform opportunities with confidence scores. Portfolio valuation works for collections of 100+ cards.

### Phase 3: Premium Features (Weeks 5–6)

| Week | Deliverable |
|---|---|
| W5 Day 1–3 | Grading probability engine (vision + financial analysis) |
| W5 Day 4–5 | Japanese market data integration (Mercari JP) |
| W6 Day 1–2 | Set completion advisor |
| W6 Day 3 | Trend alerts (webhook push) |
| W6 Day 4–5 | Farcaster MiniApp or Telegram bot |

**Phase 3 exit criteria:** All six x402 endpoints operational. Grading estimates produce actionable ROI recommendations. Cross-market arbitrage includes Japan.

---

## 12. Open Questions

| # | Question | Decision Needed By | Owner |
|---|---|---|---|
| Q1 | TCGPlayer API access — official partner program or scraping? | Phase 1 start | Justin |
| Q2 | Base mainnet vs. testnet for MVP ERC-8004 deployment? | Phase 1 W2 | Justin |
| Q3 | Free tier structure — how many free queries before x402 required? | Phase 1 launch | Justin |
| Q4 | Should grading estimates include CGC and BGS or PSA-only for MVP? | Phase 3 start | Justin |
| Q5 | Farcaster MiniApp vs. Telegram bot — which distribution channel first? | Phase 3 W6 | Justin |
| Q6 | Hackathon target — ETH Global HackMoney or Encode? | Immediate | Justin |
| Q7 | Should portfolio data persist (user accounts) or be stateless per query? | Phase 2 start | Justin |

---

## 13. Appendices

### A. Competitive Landscape

| Product | Pricing | Cross-Market | Agent API | x402 | Grading AI |
|---|---|---|---|---|---|
| TCGPlayer | Free (own data only) | No | Limited | No | No |
| PriceCharting | Free/Premium | No | No | No | No |
| PokeData | Subscription | No | Yes | No | No |
| PSA Pop Report | Free | N/A | No | No | No |
| **CardEx** | **Pay-per-query** | **Yes (US/EU/JP)** | **Yes (native)** | **Yes** | **Yes** |

### B. Card Database Scope (MVP)

| Era | Example Sets | Card Count (est.) |
|---|---|---|
| WOTC (1999–2003) | Base, Jungle, Fossil, Team Rocket | ~1,500 |
| ex (2003–2007) | Ruby & Sapphire, FireRed & LeafGreen | ~2,000 |
| Diamond & Pearl (2007–2011) | Diamond & Pearl, Platinum | ~2,500 |
| Black & White (2011–2013) | Black & White, Boundaries Crossed | ~2,000 |
| XY (2013–2017) | XY, Evolutions | ~2,500 |
| Sun & Moon (2017–2020) | Sun & Moon, Cosmic Eclipse | ~3,000 |
| Sword & Shield (2020–2023) | Sword & Shield, Brilliant Stars | ~3,500 |
| Scarlet & Violet (2023–present) | Scarlet & Violet, Obsidian Flames | ~2,000+ |
| **Total** | | **~19,000+** |

### C. Reference Documents

- CardEx Architecture Document v0.1
- CardEx Lean Canvas v0.1
- x402 Protocol Specification
- ERC-8004 Standard
- Coinbase x402 SDK Documentation
