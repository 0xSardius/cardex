# CardEx — Market Validation

## Tweet Thread (2026-03-10)

> I just tried to make a bull post about pokemon and the broader TCG market, but I simply wasn't able to. Not because the market isn't exciting, it is. Probably one of the most exciting asset classes out right now. But because I literally spent hours trying to find basic market data and couldn't.
>
> How big is the market? Depends which research firm you ask, estimates range from $8b to $50b. No one actually knows. Daily volume? Doesn't even exist as a metric. Price of a specific card right now? Check eBay, TCGPlayer, CardMarket, three Japanese platforms plus a Discord group and you'll get 6 different answers.
>
> This is a market where authentication means mailing your card in an envelope and waiting 3 months. Where a $20k transaction goes through PayPal and a handshake. Where counterfeits make up an estimated 15-20% of online sales. And there's no reliable way to verify what you're buying.
>
> Tens of billions flowing through infrastructure like the internet was invented about 2 weeks ago, in a market growing double digits YoY. If that doesn't scream opportunity, I don't know what does.

## Pain Point → CardEx Mapping

| Pain Point | CardEx Feature | Endpoint | Status |
|---|---|---|---|
| 6 different prices across platforms | Unified multi-source price aggregation | `POST /api/v1/price` | Live |
| No one knows market size | Market snapshots with volume tracking | `POST /api/v1/price` (market field) | Pipeline built |
| Daily volume doesn't exist | `market_snapshots.volume` + `sources_count` | Aggregation script | Schema ready |
| Counterfeits 15-20% of online sales | Vision-based AI authentication + grading | `POST /api/v1/grade` | Route configured |
| Authentication = mail + wait 3 months | Instant AI grade estimate with confidence | `POST /api/v1/grade` | Needs AI impl |
| $20k via PayPal handshake | USDC micropayments on Solana (x402) | All endpoints | Live |
| No reliable verification | Agent reputation via ERC-8004 (onchain) | Phase 4 | Planned |

## Key Takeaway

This person would pay for CardEx today. The frustration is real, the market is massive ($8-50B estimates), and zero infrastructure exists for programmatic access to unified card pricing data. CardEx is building exactly the "Bloomberg Terminal for collectible cards" that this market needs.

## Audience Segments Validated

1. **Investors/analysts** — trying to write market reports, need aggregate data
2. **Traders** — need real-time cross-platform arbitrage signals
3. **Collectors** — need authentication and fair pricing before $20k purchases
4. **Developers/bots** — need API access to build on top of (our x402 agent-to-agent play)
