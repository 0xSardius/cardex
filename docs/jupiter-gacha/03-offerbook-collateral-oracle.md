# CardEx Collateral Oracle
## Fair-value pricing infrastructure for card-backed lending on Jup Offerbook

| Field | Detail |
|---|---|
| **Product** | CardEx Collateral Oracle |
| **Parent** | CardEx + SolEnrich |
| **Ecosystem** | Jup Offerbook (card-collateralized USDC lending), Collector Crypt / Phygitals vaulted NFTs |
| **Author** | Justin |
| **Status** | Sketch v0.1 — July 2026 |
| **Sequencing** | Third to ship, first in strategic value; builds on the credibility of Specs 01–02 |

---

## 1. One-liner

Jupiter's Offerbook lets holders borrow and lend USDC against graded TCG cards — fixed terms, no liquidation, peer-to-peer. Every lender in that market is implicitly answering one question: *what is this card actually worth, and will it still be worth that at term?* CardEx becomes the answer — **the independent fair-value and risk oracle for card-backed credit.**

## 2. Why this is the strategic play

The first two specs are products; this one is infrastructure. Retail query revenue is real but churny — lending-market integration is sticky, B2B-priced, and compounds. Once lenders (or the protocol itself) reference CardEx valuations to price offers, switching costs are high and every loan originated is an implicit endorsement. It's the same structural position the original CardEx PRD identified with ERC-8004 reputation — become the *default pricing oracle* — but pointed at a market where mispricing costs real principal, so willingness to pay is an order of magnitude higher than a hobbyist checking a spread.

The no-liquidation, fixed-term structure raises the stakes in CardEx's favor: a lender can't rely on liquidation bots to save a bad valuation. If the card was overpriced at origination, the lender simply eats it at default. That makes origination-time valuation quality *the* risk control, and there is currently no independent, fee-netted, manipulation-screened source for it. Platform-indexed values exist, but they're produced by parties with inventory and volume incentives. Independence is the product.

## 3. What the oracle answers

**Fair value, three ways.** For any vaulted card NFT: the paper comp (eBay sold, TCGPlayer, CardMarket — CardEx's existing core), the on-chain realizable value (best of buyback quote and fee-netted secondary depth), and a conservative *collateral value* that takes the lower of the two and applies a liquidity haircut. Lenders price against the third number; the gap between the three is itself disclosed, because a card whose on-chain price runs far ahead of paper is exactly the collateral you haircut hardest.

**Volatility and term risk.** A point-in-time price is not enough for a fixed-term loan. CardEx's 380K+ price-point history supports a per-card (or per-card-class) volatility measure: how much has this card's paper comp moved over trailing 30/90 days, and what does that imply for value-at-term at a given confidence? Output a suggested max LTV per card, per term length. This is the feature that turns a price feed into an underwriting tool.

**Collateral integrity, via SolEnrich.** Screen the borrower's wallet and the card's trading history: wash-trade clusters inflating the comp set, cards that have circulated through flagged wallets, borrowers whose on-chain history correlates with default-shaped behavior. "The comp is $400 but $260 of the supporting volume is one cluster trading with itself" is a sentence only the CardEx + SolEnrich combination can produce, and it's worth real basis points to a lender.

## 4. Product surfaces

**Lender terminal (the wedge).** A web view where a prospective Offerbook lender pastes a loan offer or collateral mint and gets the full underwriting card: three-way valuation, suggested max LTV by term, volatility band, integrity flags. Free-tier limited, paid for volume. This builds the user base and the track record before any protocol conversation.

**x402 API.** `GET /collateral/value?mint=…`, `GET /collateral/ltv?mint=…&term=…`, `GET /collateral/integrity?mint=…`. Priced above the retail endpoints (this is underwriting data, not trivia — think $0.01–0.05/query or volume packages). Consumers: lending bots, Offerbook aggregators, and eventually the protocol layer.

**Protocol integration (the prize).** Jupiter surfacing "CardEx fair value" alongside collateral in the Offerbook UI, or referencing it in offer defaults. This is a partnership conversation, not a feature — see go-to-market.

**Track record page.** Public, timestamped valuation history: every card CardEx priced, what it said, what the card actually realized. This is the ERC-8004 reputation thesis executed as a product page — accuracy as marketing. Start logging from day one even before anyone's watching.

## 5. Architecture sketch

The valuation core is again the shared library from Specs 01–02. New components: a **volatility engine** over the existing price-point history (per-card where data is dense, per-class fallback — set/rarity/grade cohorts — where it's thin); an **LTV model** mapping volatility × term × liquidity tier to a suggested haircut (start with a transparent rule-based table, not ML — lenders trust legible models); the **SolEnrich integrity pipeline** applied to comp sets rather than just counterparties; and an **attestation log** (append-only, hash-anchored on-chain periodically) backing the track record page. Signed valuation responses so consumers can prove what CardEx said at origination time.

## 6. Go-to-market sequence

Weeks 1–2: ship the lender terminal scoped to cards currently listed as Offerbook collateral; start the attestation log. Weeks 3–4 (tail end of Gacha Season 1, while CardEx visibility from Spec 01 is peaking): publish a "State of Card-Backed Lending" analysis — LTV distributions, where current offers look mispriced against CardEx values — as the credibility artifact. Then the partnership motion: Jupiter's ecosystem is explicitly agent- and integration-friendly, and you'll be approaching them with a live tool, a public track record, and a season of community visibility rather than a deck.

## 7. Risks and honest caveats

An oracle's failure mode is silent staleness — a valuation pipeline that degrades without alarming will eventually misprice something expensive; invest early in freshness monitoring and refuse-to-quote behavior when comp data is thin (a "no quote" is a feature, not a gap). Legibility matters more than sophistication: a lender who can't reproduce your haircut logic won't trust it with principal. Keep clear that CardEx provides data, not lending advice — disclaim accordingly, since consumers are making credit decisions. And the independence that justifies the product cuts both ways: taking inventory positions in cards CardEx prices would compromise the oracle claim, so keep the autonomous-trading ambitions structurally separate from this product if you pursue both.

## 8. Why third in sequence, first in value

Specs 01 and 02 manufacture the two things this play needs and can't shortcut: public visibility inside the Jupiter community during a compressed season window, and a demonstrated valuation track record. The EV dashboard makes CardEx known; the decision engine makes it trusted at the individual-card level; the oracle converts that trust into infrastructure revenue. One valuation core, three products, ascending stickiness.
