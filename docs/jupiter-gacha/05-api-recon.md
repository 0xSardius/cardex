# CC Gacha API Recon (probed live 2026-07-19)

## Headline: all read endpoints are OPEN — no `x-api-key` required

Probed `https://gacha.collectorcrypt.com` unauthenticated. Everything Spec 01 needs for read-only analytics is public. The partner key is only required for **write** paths (`generatePack`, `openPack`, `buyback`, `submitTransaction`) — i.e. purchasing. Read-only MVP has zero key dependency. (Task 7's partner-key ask is still worth it as a partnership conversation, not a technical blocker.)

## Jupiter Gacha == CC Gacha backend, confirmed

`/api/getAllWinners` rows carry `memo_slug` attribution; live pulls show `"jupiter"`, `"cc"`, `"slabz"` slugs on the **same machines** (`pokemon_50`, `pokemon_250`, …). Jupiter Gacha is a skinned frontend over this exact API. One indexer covers CC + Jupiter + any future white-label (slabz).

## Endpoints (verified live)

| Endpoint | Auth | Returns | Notes |
|---|---|---|---|
| `GET /api/machines` | none | Per machine: `code`, `price`, `instantBuyback` (%), `odds` `{common,uncommon,rare,epic}`, `tierRanges` (insured-value bounds per tier), `stock` (per tier), `ev` (platform's rarity-weighted expected **insured** value), `targetEv` | ~27KB. `pokemon_50`: price 50, buyback 85%, odds .80/.15/.04/.01, platform ev 55.33 |
| `GET /api/stock` | none | Stock per tier for **all** machines incl. non-public | 25+ machines: pokemon_25/50/250/1000/2500, onepiece, sports, comics… |
| `GET /api/getNfts?code=X&rarity=Y` | none | **Top 100 NFTs per tier by insured value** — name, description (full card title incl. grade + language), attributes (Insured Value, Grading Company, The Grade, Year), image, `insured_value`, mint address | Hard cap 100, no pagination (tried limit/offset/page/skip/start/cursor). Sorted desc by insured value → chase-card coverage is complete, tail is not |
| `GET /api/getAllWinners?count=N&packType=X&slug=Y` | none | Pull history: `winner`, `nft_address`, full `nft` metadata, `insuredValue`, `created_at`, `memo_slug`, `pack_type`, `prize_tier` (1=Epic…4=Common) | `count` caps at **200**; `limit` is ignored (default 10). `timestamp` param does NOT page backward — feed is latest-N only. `packType` + `slug` filters work |
| `GET /api/ably/token` | untested | Realtime winner stream token | Poll-forward is fine for MVP; Ably later |

Dev mirror exists at `https://dev-gacha.collectorcrypt.com` (different machine set/stock).

## Volume observed

~200 pulls in ~6.5 min platform-wide (~30 pulls/min) on a Saturday evening. `pokemon_50`-filtered `count=200` window spans ~5–6 min. **Implication:** a 2–3 min polling cron on `getAllWinners` (per tracked packType + one unfiltered) loses nothing; the 200-row cap makes deep history reconstruction impossible except by accumulating forward — start the winners cron early, every day of Season 1 history we don't capture is gone.

## What this means for the EV engine

1. **Pool indexer collapses into API polling** (as predicted in 04-competitive-landscape): machines + stock + top-100/tier + winners accumulation. No scraping, no on-chain parsing for MVP. On-chain reveals become a later verification layer.
2. **Two EV lines, one honest ladder:**
   - **Guaranteed-exit EV (computable day 1):** `instantBuyback% × Σ p(tier) × E[insured | tier]`. Tier means from winners accumulation (a true random within-tier sample) + top-100 + tierRanges bounds. For `pokemon_50`: 0.85 × 55.33 ≈ **$47.0 on a $50 pack ≈ −6%** — the platform's "+EV" headline (`ev` 55.33 > 50) is +10.7% *in insured value*, but the only guaranteed exit nets −6%. That gap is the launch tweet.
   - **Paper-truth EV (the differentiator):** replace insured value with fee-netted best-exit realizable value per card — needs mint→catalog resolution + graded comps (tasks 3, 7).
3. **Winners feed doubles as the resolution corpus:** every pull carries the full NFT name/description ("2024 #232 Mew EX PSA 10 Paf EN-Paldean Fates") — far richer than the sparse attributes that produced the old 16% resolution rate. Parse card identity from `description`/`json_name`.
4. **JP share:** ~23% of top-100 epics are Japanese-named — consistent with the known ~25% JP inventory. JP cards fall back to insured-value pricing (flagged) until a JP paper source lands.

## Sampling caveat (honesty requirement)

`getNfts` truncation means the within-tier tail below the top 100 is invisible from the pool endpoint alone. Tier means must come from **winners accumulation** (unbiased draws) with the top-100 used for chase-card display and upper-tail pricing. Until n is respectable per tier, publish EV with a "sample: n pulls since {date}" caveat, and show the tierRanges-bounded worst/best case.
