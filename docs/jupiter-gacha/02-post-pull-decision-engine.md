# CardEx Post-Pull Decision Engine
## The four-way exit optimizer for every ripped card

| Field | Detail |
|---|---|
| **Product** | Post-Pull Decision Engine ("You pulled it. Now what?") |
| **Parent** | CardEx + SolEnrich |
| **Ecosystem** | Jupiter Gacha, Collector Crypt, Magic Eden, Jup Offerbook |
| **Author** | Justin |
| **Status** | Sketch v0.1 — July 2026 |
| **Sequencing** | Ships after Pack EV Engine; shares its exit-valuation core |

---

## 1. One-liner

The instant a card is revealed, the holder faces a four-way decision — take the buyback, list it, hold it, or redeem the physical — under time pressure and with asymmetric information. This product answers it in one call: **realizable value across all four exits, net of every fee, with a recommendation.**

## 2. The moment it serves

The buyback offer is the platform's edge: a standing quote at 85–90% of indexed value, presented immediately after the reveal, engineered so users take the discount and re-roll. It creates a soft floor, but it also means every acceptance leaves 10–15% on the table *if* a better exit exists. Sometimes the buyback genuinely is the best exit (illiquid card, thin secondary, redemption costs eat the spread). Sometimes it's a 12% donation. Nobody currently tells the user which case they're in — every platform knows one side of the market; CardEx knows both. That asymmetry, resolved at the exact moment of decision, is the whole product.

## 3. The four exits, priced honestly

**Buyback:** read the standing on-chain quote directly. This is the baseline — instant, certain, zero friction.

**List on secondary (Magic Eden / Collector Crypt marketplace):** CardEx fair value adjusted for current floor/ask depth on comparable listings, net of marketplace fees, discounted by expected time-to-fill (a card with three stale listings at fantasy prices is not "worth" its lowest ask). SolEnrich adds the counterparty layer here: flag when the visible "comps" propping up a price come from wash-trade clusters, so the user doesn't anchor on manufactured floors.

**Redeem physical:** raw paper comp (eBay sold / TCGPlayer) minus vault withdrawal fee, shipping, insurance, and the seller-side friction of moving a physical card. Usually the worst exit for mid-value cards, occasionally the best for grails where paper collectors pay a physical premium.

**Hold:** not a price but a signal — CardEx trend data on the card's paper trajectory plus, where relevant, its usability as Offerbook collateral (a card you can borrow USDC against without selling changes the hold calculus; this is the bridge to Spec 03).

Output is a single ranked verdict with the spread quantified: *"Buyback: $212. Best listing exit: $241 net (est. 3–6 day fill). Redemption: $228 net. Verdict: LIST — you're leaving $29 (13.7%) on the table taking the buyback."*

## 4. Product surfaces

**Web tool:** paste a mint address (or connect wallet and auto-detect the freshest reveal), get the verdict card. Verdict cards are designed to be screenshot-shareable — every "I saved $40 by not smashing buyback" post is free acquisition.

**Browser extension (v2, high leverage):** overlay the verdict directly on the reveal screen. This is the killer form factor — the decision support appears inside the decision moment — but it's also the most ToS-sensitive surface, so it ships only after reviewing platform terms on page augmentation.

**x402 API:** `GET /decide?mint=…` returning the full four-exit breakdown. This endpoint is what an autonomous flipping agent would consume — meaning the agent play from the original brainstorm becomes a *customer* of this product rather than a separate build. Other people's bots pay per call; your capital stays out of thin markets.

**Portfolio mode:** run the decision engine across a wallet's whole vaulted-card holding. "Your 14 cards: 3 should be listed, 1 has a buyback above its realistic fill price, 10 are fine to hold." This is the retention product for serious collectors and a natural premium tier.

## 5. Architecture sketch

Almost everything is composition. The exit-valuation core is shared with the Pack EV Engine (Spec 01, section 3) — build it once as a library. New pieces: a buyback-quote reader (on-chain), a listing-depth scanner for Magic Eden/Collector Crypt comps, the SolEnrich comp-screening hook, and the verdict/ranking layer. Latency target matters here: the verdict must return in a couple of seconds or it misses the decision window; pre-warm caches for the card pools of currently-live gacha packs (which the Spec 01 pool indexer already enumerates — the two products feed each other).

## 6. MVP scope

Web tool + x402 endpoint, buyback vs secondary vs paper comparison only (defer redemption math and hold signals), scoped to cards from live Jupiter Gacha pools so the cache stays small. Extension and portfolio mode follow adoption.

## 7. Risks and caveats

Time-to-fill estimates are the soft spot — a wrong "list it" call that strands a user for two weeks damages trust faster than a conservative "take the buyback" ever will, so bias the verdict toward certainty-adjusted value and show the fill-time assumption explicitly. Marketplace fee schedules and buyback percentages change; treat them as config, not constants. And the same positioning rule as Spec 01: this is a decision tool, not encouragement to keep ripping — its credibility is the asset.

## 8. Why this slots second

It inherits the Spec 01 valuation core, it monetizes the exact audience the EV dashboard attracts, and its API becomes the substrate for any future autonomous agent — yours or paying customers'. Value chain: EV engine gets them before the rip, decision engine gets them after, Offerbook oracle (Spec 03) gets the whole ecosystem's lending layer.
