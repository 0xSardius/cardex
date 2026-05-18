# Phase 8 — RWA Recon

**Status:** Step 0 complete (2026-05-18). Findings drive ingestion adapter choice + reshape Phase 8 polling assumptions.

## TL;DR — read surface decision

**Default to Magic Eden REST + Helius DAS (`getAsset` / `searchAssets`) for MVP.** Collector Crypt is not a custom marketplace — it mints pNFTs under a single update authority and listings settle on Magic Eden's open-source M2 program. Phygitals operates a proprietary frontend marketplace, but its NFTs are also listable on Magic Eden and Tensor (unconfirmed for Phygitals' Pokemon cards specifically — see §2). Magic Eden REST gives us active listings + price + mint in one call.

**Two adapter-shaping caveats:**

1. Magic Eden v2 has a deprecation notice ("winding down support for certain APIs"). v4.0 docs namespace exists. Build the adapter behind an interface; expect to swap implementations within 6 months.
2. The 120 QPM / 2 QPS ceiling is tighter than Phase 8 assumed. See §5 — poll frequency drops to ~20 min, or we pay for a key, or we move to Helius webhooks on the M2 program.

**Direct program indexing (Helius webhook on M2 + MMM filtered by Collector Crypt UA) is the operational fallback.** Build adapter v1 against Magic Eden REST; document the webhook migration path; switch when freshness or QPM bites.

---

## 1. Collector Crypt — Solana, primary target

### Program / marketplace

- **No custom Collector Crypt program.** Listings settle on Magic Eden M2 (`M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K`) — confirmed via `listingSource: "M2"` on every sampled listing and via Magic Eden help center wording.
- **Auction House PDA:** `E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe` (ME's default, not CC-specific).
- **Collection-wide offers** use Magic Eden's MMM AMM (`mmm3XBJg5gk8XJxEKBvdgptZz6SgK4tXvn36sodowMc`). One sampled listing returned `listingSource: "MMM"`. MMM bid pools = "true bid floor" — worth surfacing in `rwa-fair-value` later, deferred for MVP.
- **M2 instructions to index (when we move to webhooks):** `mip1_sell`, `mip1_cancel_sell`, `mip1_execute_sale_v2` (and the non-MIP1 legacy variants for older inventory).

### SDK / docs

- No public Collector Crypt SDK, GitHub org, or `/api` / `/docs` endpoint at collectorcrypt.com.
- We build against Magic Eden's open-sourced M2 IDL + their REST API + Helius DAS for metadata reads.

### Asset standard — pNFT (MIP-1)

- Programmable NFTs via Token Metadata (`metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`), not Metaplex Core.
- Evidence: M2 routes are `mip1_*`, `sellerFeeBasisPoints: 200` present, Helius DAS returns `interface: "ProgrammableNFT"`.
- **Adapter implication:** use `@solana-program/token-metadata` (Codama client) for account decoding; Helius DAS `getAsset` returns attributes directly.

### Onchain vs offchain metadata

Verified against a real mint (`85zEUF1HmhNXv3ournqfpcgiuHHrGkWFKZGudSufvgvP` — 2023 Arbok ex CGC 9.5):

- **Onchain:** name, symbol, URI, sellerFeeBps, creators only.
- **Offchain JSON (attributes array) carries everything we need for catalog match:**
  - `Category` (`Pokemon`, `Sports`, `Moonbirds`, `One Piece`, etc — **must filter to Pokemon**)
  - `Year`
  - `Set` (e.g. `"Pokémon Card 151 - sv2a - Japanese"`)
  - `Card Name` (e.g. `"Arbok ex"`)
  - `Serial Number` (card number within set)
  - `Grading Company` (`PSA` / `CGC` / `BGS` / `SGC`)
  - `The Grade` (e.g. `"GEM MINT 9.5"`)
  - `Parallel` (e.g. `"Super Rare Holo"`, `"Reverse Holo"`)
  - `Collector Crypt ID`, `Vault ID`, `Status` (operational, not pricing-relevant)
- **Token Metadata `name` field** is itself fully descriptive (`"YEAR #NUMBER NAME GRADER GRADE Pokemon Card SET - SETCODE - LANGUAGE"`) but the attributes array is the safer source of truth.

### Collection identifier

- **Magic Eden slug: `collector_crypt`** — single slug across all categories. Must filter by `Category == "Pokemon"` attribute inside our ingestion.
- **Functional collection key onchain: update authority `DQPERZ9e86pNJ4mhUnCEP8V75yxZofsipoVrRWT5Wdxd`** — confirmed across 3-4 sampled mints. **Action item §7.1: verify across ≥20 mints before relying on it.**
- No Metaplex Certified Collection (MCC) confirmed from ME-side reads (ME strips that field). Helius `getAsset(mint).grouping[0].group_value` would surface it if present.

### Market sizing (as of 2026-05)

- Q1 2026 revenue: $146.9M (gachapon $144.7M, $8.6M gross profit) — [Pine Analytics](https://pineanalytics.substack.com/p/collector-crypt-quarterly-report).
- OKX-reported collection state: 122,220 supply, 7,603 owners, 5,507 listed (~4.5% listed ratio).
- Magic Eden stats: 6,825 listedCount, floor 0.281 SOL (all-categories — Pokemon floor is higher).
- BSC expansion March 2026 — multi-chain now. Phase 8 stays Solana-only.

---

## 2. Phygitals — Solana, secondary

### Status: integration medium-low effort, **but live ME slug not yet found**

- Phygitals operates a proprietary marketplace UI (zero-gas, on-platform settlement). No public program ID, IDL, or GitHub org. phygitals.com returns 403 on `/api`.
- Their Pokemon NFTs are described as listable on Magic Eden and Tensor — but the obvious `phygitals_collectibles` slug returns 0 listed (probably an old launchpad collection).
- OKX has them indexed as collection `phygitals-4` showing 104K supply / 18K listed / 17.91K owners — meaningful scale, but we need to find the Magic Eden slug(s) before the adapter can read them.

### Asset standard — unverified for Pokemon specifically

- FWOG figurines (their non-Pokemon launchpad drop) are explicitly cNFTs (compressed).
- Pokemon cards inferred to be pNFTs based on ecosystem reporting parity with Collector Crypt — **not directly verified.** Action item §7.4.
- Helius DAS `getAsset` handles both standards uniformly, so adapter code path is the same either way.

### Phase 8 v1 decision

**Ship Collector Crypt-only for `rwa-fair-value` v1.** Add Phygitals once §7.3 (find live ME slug) and §7.4 (sample attribute schema) come back clean. If the attribute schema diverges from Collector Crypt's, we need a per-platform attribute mapper — keep that contained in `src/lib/ingestion/phygitals.ts` rather than bleeding into the Collector Crypt path.

---

## 3. Magic Eden REST API (Solana)

### Base + auth

- Base URL: `https://api-mainnet.magiceden.dev/v2`.
- Public read-only endpoints work without auth (all probes in this report used no key).
- **Deprecation notice on the help center: "Magic Eden is winding down support for certain APIs and developer services."** No specific shutdown date for Solana v2. v4.0 docs namespace exists.
- **Architectural response:** wrap all ME calls behind a `MagicEdenClient` interface; treat REST surface as replaceable.

### Rate limits

- **Public: 120 QPM / 2 QPS.** Confirmed in two ME doc sources.
- Paid tier exists (request via form, no published price).
- 429s do happen; `Retry-After: 60` header is honored — implement honor-Retry-After + exponential backoff.

### Endpoints we'll use

| Endpoint | Use |
|---|---|
| `GET /v2/collections/{symbol}/listings` | Primary listings reader — pagination by `offset`/`limit` (max 100) |
| `GET /v2/tokens/{mint}` | Per-mint metadata + current listing if any |
| `GET /v2/tokens/{mint}/listings` | Per-mint active listings array |
| `GET /v2/collections/{symbol}/activities` | Sales history for backtesting |
| `GET /v2/collections/{symbol}/stats` | floorPrice (lamports), listedCount, volumeAll |

**Pagination quirks:**

- No envelope, bare array response. Loop offset until empty.
- Empirical ceiling around ~1500-2000 offset on `collector_crypt` even though `listedCount` says 6,825. **Action item §7.5** — confirm via `sort=updatedAt` windowing whether this is a true ceiling or stale data.
- Prefer `sort=updatedAt&sort_direction=desc` for incremental scans.

### Listing response shape (one sample)

```jsonc
{
  "pdaAddress": "6DC2WcT8Fqjtq6xkjemYP6Qh23gzEaenRZzAETmBz6wX",
  "auctionHouse": "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe",
  "tokenMint": "26b9cnSoE2terkf9YkaLFrcmNsL4kHqLHMJD5k3mvdFJ",
  "seller": "CgB8t76Jnr4zTUF6KbCKyFtpvHoQYGaksKR91WNV45uS",
  "sellerReferral": "...",
  "tokenSize": 1,
  "price": 0.293023,
  "priceInfo": {
    "solPrice": { "rawAmount": "293023000", "address": "So11...112", "decimals": 9 },
    "splPrice": { "rawAmount": "25000000", "address": "EPjF...Dt1v", "decimals": 6, "symbol": "USDC" }
  },
  "expiry": -1,
  "listingSource": "M2"
}
```

- **`tokenMint` present on every listing** — clean join key.
- **Dual-denominated:** when `splPrice` exists, the listing is denominated in USDC and `solPrice` is ME's computed equivalent. For arbitrage math, **prefer `splPrice` when present** — it's the literal asking price.
- `expiry: -1` = no expiration. Other listings have unix timestamps — must check when filtering "active".
- `sellerReferral` = affiliate; identifies which frontend placed the listing.

### Magic Eden slugs we depend on

| Platform | ME slug | Status |
|---|---|---|
| Collector Crypt (all categories) | `collector_crypt` | Confirmed live |
| Collector Crypt Genesis Drop | `tokenized_collectibles_drop1` | Historical only, 0 listed |
| Phygitals (Pokemon) | **TBD** — `phygitals_collectibles` is 0-listed | Action item §7.3 |

Don't hard-code slugs in the adapter. Build a `magic-eden-collections.ts` config map keyed by `(platform, category)` with refresh-quarterly notes.

---

## 4. Mint → card identity mapping

**For Collector Crypt, the pipeline is clean:**

1. `getAsset(mint)` (Helius DAS) or `/v2/tokens/{mint}` (Magic Eden) → returns offchain JSON attributes.
2. Extract attributes: `Category`, `Year`, `Set`, `Card Name`, `Serial Number`, `Grading Company`, `The Grade`, `Parallel`.
3. Filter to `Category == "Pokemon"`.
4. Normalize `The Grade` → numeric (`"GEM MINT 9.5"` → `9.5`).
5. Normalize `Set` → pokemontcg.io `set.id` via lookup table (e.g. `"Pokémon Card 151 - sv2a - Japanese"` → `sv2a`). One-time map, ~50-200 distinct sets across current listings.
6. Join CardEx catalog by `(game=pokemon, set_code, card_number, language)` → `collectible_id`. Cache the `mint → collectible_id` mapping permanently — physical card identity is immutable in the vault.

**Seeding strategy — two paths:**

- **Magic Eden pagination** (`/v2/collections/collector_crypt/listings`, paginate until empty) — gets currently-listed mints only (~5,500).
- **Helius `searchAssets` by `authorityAddress`** (the CC update authority) — gets *all* CC mints whether listed or not (~122K). Authoritative seed. ~122 page calls at limit=1000.

Use Helius for the initial seed, then keep up to date via ME polling of new listings. New mints appearing in ME listings but not yet in our `mint_card_map` trigger a backfill `getAsset` call.

**For Phygitals: same shape expected but unverified.** Action item §7.4 confirms whether trait_type names match Collector Crypt's. If not, build a per-platform attribute key mapper.

---

## 5. Phase 8 polling math — needs adjustment

Phase 8 plan called for 10-min polling. With ME at 2 QPS / 120 QPM ceiling:

- Collector Crypt has ~5,500-6,800 active listings. At max 100/call → 55-68 calls per full scan.
- 10-min polls = 6 scans/hour → 330-410 QPM peak. **2.75-3.4x over the public ceiling.**

**Three options, ranked:**

1. **Drop poll frequency to 20-30 min initially.** 110-200 QPM peak. Fits. Trade-off: 20-min staleness in `rwa-fair-value` responses. For Phase 8 MVP this is acceptable — bots will tolerate it, especially since `Cache-Control: max-age=30` on our endpoint means we're not promising real-time anyway.
2. **Helius webhooks on M2 + MMM filtered by CC update authority.** Push-driven, near-real-time. Operationally heavier (webhook handler, idempotency, replay on outage). Build only if Phase 8 design-partner bot complains about staleness.
3. **Paid Magic Eden key.** Cleanest if we can afford it. No public price — request via form. Defer until we know whether we even need it.

**Phase 8 decision: option (1) for MVP, document option (2) as the migration path.** Updates `docs/PHASE-8-PLAN.md` Step 2 implicitly — adapter scans every 20 min, not 10-15.

---

## 6. SolEnrich cache hit-rate — strong signal

Empirical observation across sampled `collector_crypt` listings pages:

| Page (offset, limit) | Top seller listings | Top seller % |
|---|---|---|
| 0, 20 | 23 (one seller) | ~67% |
| 500, 100 | 38 (`HaRn...UnSq4`) | 76% |
| 1000, 100 | 28 (same `HaRn...`) | 93% |

`HaRn6167N9tRH3XazRYfKmioE4okKhhxJ56FDirUnSq4` is a power-law seller — likely the CC house wallet or a market-maker bot. Holder stats: top 10 holders own 36.3% of supply; top single holder owns 5.8%.

**Implication for `rwa-arbitrage` cost math:**

- 5,500 listings resolve to ~50-100 distinct sellers in practice.
- Per-call SolEnrich cost with cold cache: 50-100 × $0.03 = $1.50-3.00. With warm 6h cache: near zero on repeat scans.
- Endpoint price ($0.005/call) covers the warm-cache cost ~40x over.

**Operational risk:** if CC fragments their storefront wallets, hit-rate collapses. Monitor distinct-seller count weekly post-launch.

**Outreach line item:** lead with this in design-partner conversations — "we resolve thousands of CC listings into ~100 seller-risk lookups thanks to seller concentration; your $0.005/call covers SolEnrich's $0.02/wallet ~40x over."

---

## 7. Action items before / during Step 2 (Listings adapter)

None block starting Step 2 — they're probes worth running as the adapter scaffolds.

1. **Verify CC update authority across ≥20 mints.** Loop `/v2/tokens/{mint}` across 20+ mints from current listings, check `updateAuthority`. Expect single value `DQPERZ9e86pNJ4mhUnCEP8V75yxZofsipoVrRWT5Wdxd`. If 2+, our DAS filter accepts multiple UAs.
2. **Verify Helius `searchAssets` by `authorityAddress` returns CC mints + paginates cleanly.** ~122 page calls at limit=1000. Confirms seeding strategy.
3. **Find live Phygitals ME slug(s).** `GET /v2/collections?q=phygitals` + check OKX-discovered variants (`phygitals-4`, etc).
4. **Sample 5+ Phygitals Pokemon mints' attribute schema.** Confirms whether trait_type names match CC or diverge.
5. **Confirm ME v2 listings pagination ceiling.** Loop offset 0 → 7000 in steps of 100 on `collector_crypt`. If hard ceiling < listedCount, switch to `sort=updatedAt` windowing.
6. **Decode a real `mip1_execute_sale_v2` tx.** Pick a recent sale from `/v2/collections/collector_crypt/activities`, fetch tx via Solana RPC, decode with M2 IDL. Validates our event parser before any webhook work.
7. **Check `paymentMints` distribution on listings.** SOL vs USDC denomination breakdown across full Collector Crypt listings.
8. **Magic Eden v4.0 parity check.** Test whether `/v2/collections/{symbol}/listings` has a v4 equivalent with better pagination or auth requirements.
9. **MMM bid pool read.** `GET /v2/mmm/pools?collectionSymbol=collector_crypt` — bid-side floor for "true market" reporting later.

---

## 8. Confidence

| Claim | Confidence | Severity if wrong |
|---|---|---|
| Collector Crypt listings settle on Magic Eden M2 | High — confirmed across 100+ sampled listings | Would-bite — adapter parses wrong program |
| Collector Crypt update authority is `DQPERZ9...Wdxd` for **all** their mints | Medium — only 3-4 mints sampled | Would-bite — DAS searchAssets filter misses inventory |
| Pokemon cards on both platforms are pNFTs (not Metaplex Core / not cNFTs) | High for CC, **Medium for Phygitals** | Would-bite for Phygitals — cNFT path needs merkle proofs |
| ME public rate limit is 120 QPM / 2 QPS, no auth needed for reads | High — confirmed in two doc sources | Nice-to-confirm |
| ME v2 listings max limit = 100, no pagination envelope | High — confirmed empirically + in docs | Nice-to-confirm |
| OKX-reported CC 122K supply / Phygitals 104K supply | Medium — single source | Sizing only, doesn't affect adapter |
| Seller concentration follows power-law (one wallet 60-93% per page) | High — confirmed across 3 paginated samples | Would-bite if wrong — kills SolEnrich cache margin |
| ME v2 deprecation notice is real and affects Solana | Medium — language is cautious, no shutdown date | Medium-term — adapter must be portable |
| `collector_crypt` slug covers all CC inventory (single slug) | High — confirmed via stats listedCount match | Nice-to-confirm |
| Phygitals' main Pokemon listings are NOT under `phygitals_collectibles` slug | Medium — empty listings but non-zero volumeAll | Would-bite — wrong slug = miss Phygitals entirely |
| Helius DAS `getAsset` covers pNFTs/cNFTs/Core uniformly | High — confirmed in Helius docs | Nice-to-confirm |
| **Phase 8 10-min polling exceeds ME ceiling by 2.75-3.4x** | **High — math is straightforward** | **Schedule revision needed (see §5)** |

---

## Sources

- M2 Marketplace Smart Contract — https://github.com/me-foundation/m2
- MMM AMM Protocol — https://github.com/me-foundation/mmm
- Magic Eden API reference — https://docs.magiceden.io/reference/get_collections-symbol-listings
- ME Solana rate limits — https://docs.magiceden.io/reference/solana-api-keys
- ME Help Center, API access — https://help.magiceden.io/en/articles/6533403-how-to-use-the-magic-eden-api-access-keys-rate-limits-docs
- ME × Collector Crypt integration — https://help.magiceden.io/en/articles/8498560-exploring-magic-eden-x-collector-crypt
- Collector Crypt Q1 2026 report — https://pineanalytics.substack.com/p/collector-crypt-quarterly-report
- OKX Collector Crypt page — https://web3.okx.com/nft/collection/sol/collector-crypt
- OKX Phygitals page — https://web3.okx.com/nft/collection/sol/phygitals-4
- Phygitals FWOG cNFT docs — https://www.phygitals.com/fwog-info
- Helius DAS getAsset — https://www.helius.dev/docs/api-reference/das/getasset
- Metaplex DAS spec — https://github.com/metaplex-foundation/digital-asset-standard-api
