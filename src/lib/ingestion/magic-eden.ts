/**
 * Magic Eden ingestion — Collector Crypt active listings.
 *
 * Paginates ME's Solana REST API for the `collector_crypt` collection,
 * persists each active listing into the `listings` table, and (when
 * we encounter a mint for the first time) resolves the mint's physical
 * card identity via /v2/tokens/{mint} and caches it in `mint_card_map`.
 *
 * Idempotency:
 *   - One active row per (mint_address, pda_address) at a time.
 *   - Sightings update observed_at + current price.
 *   - Listings not seen this run are marked expired_at = NOW().
 *
 * QPM budget:
 *   - ME public ceiling is 2 QPS / 120 QPM.
 *   - Listings pagination: ~55 calls for ~5,500 listings @ limit=100.
 *   - Mint lookups capped per run (MAX_MINT_LOOKUPS_PER_RUN) so a cold start
 *     doesn't blow the budget. mint_card_map fills over multiple runs.
 *
 * Usage:
 *   npx tsx src/lib/ingestion/magic-eden.ts
 *
 * Env:
 *   DATABASE_URL                 — required
 *   ME_MAX_MINT_LOOKUPS_PER_RUN  — optional, default 300
 *   ME_MAX_LISTING_PAGES         — optional, default Infinity
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import {
  MagicEdenV2Client,
  type MagicEdenClient,
  type MagicEdenListing,
} from "./clients/magic-eden-client";
import {
  parseCollectorCryptAttributes,
  normalizeCardNumber,
} from "../games/pokemon/collector-crypt-attributes";

const COLLECTOR_CRYPT_SLUG = "collector_crypt";
const SOURCE = "magic-eden";
const PLATFORM = "collector-crypt";

// Server-side attribute filter for the Collector Crypt slug. The slug is
// multi-category (Pokemon + Basketball + Baseball + Moonbirds + …); without
// this filter the default sort burns our mint-lookup budget on sports cards.
const POKEMON_ONLY_FILTER = [
  [{ traitType: "Category", value: "Pokemon" }],
];

interface IngestOptions {
  maxMintLookups?: number;
  maxListingPages?: number;
  collectionSymbol?: string;
}

export interface IngestReport {
  pagesFetched: number;
  listingsObserved: number;
  listingsInserted: number;
  listingsUpdated: number;
  listingsExpired: number;
  mintsResolvedThisRun: number;
  mintsResolvedToCollectible: number;
  mintLookupsRemainingForNextRun: number;
}

interface ExistingActive {
  id: string;
  mintAddress: string;
  pdaAddress: string | null;
}

interface CollectibleRow {
  id: string;
  set_code: string;
  set_number: string;
}

interface SetRow {
  id: string;
  code: string;
  name: string;
}

export async function ingestMagicEdenListings(
  sql: any,
  client: MagicEdenClient,
  opts: IngestOptions = {}
): Promise<IngestReport> {
  const maxMintLookups = opts.maxMintLookups ?? 300;
  const symbol = opts.collectionSymbol ?? COLLECTOR_CRYPT_SLUG;
  let mintBudget = maxMintLookups;

  // 1. Load Pokemon collectibles for mint→catalog resolution.
  const collectibles = (await sql`
    SELECT c.id, s.code AS set_code, c.set_number
    FROM collectibles c
    JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'pokemon' AND c.set_number IS NOT NULL
  `) as CollectibleRow[];

  const collectibleByKey = new Map<string, string>();
  for (const row of collectibles) {
    collectibleByKey.set(
      `${row.set_code.toLowerCase()}|${row.set_number}`,
      row.id
    );
  }

  // 1b. Load Pokemon sets indexed by lowercased name for the English-set
  // fallback path (CC's Set field is "Brilliant Stars - English", not a code).
  const setRows = (await sql`
    SELECT id, code, name FROM sets WHERE game = 'pokemon'
  `) as SetRow[];
  const setCodeByName = new Map<string, string>();
  for (const row of setRows) {
    setCodeByName.set(row.name.trim().toLowerCase(), row.code);
  }

  // 2. Load known mints so we don't re-resolve.
  const knownMintsRows = (await sql`
    SELECT mint_address FROM mint_card_map WHERE platform = ${PLATFORM}
  `) as Array<{ mint_address: string }>;
  const knownMints = new Set(knownMintsRows.map((r) => r.mint_address));

  // 3. Load currently-active ME listings so we can diff (update vs insert vs expire).
  const activeRows = (await sql`
    SELECT id, mint_address, pda_address
    FROM listings
    WHERE source = ${SOURCE} AND expired_at IS NULL
  `) as Array<{ id: string; mint_address: string; pda_address: string | null }>;
  const activeByKey = new Map<string, ExistingActive>();
  for (const row of activeRows) {
    activeByKey.set(`${row.mint_address}|${row.pda_address ?? ""}`, {
      id: row.id,
      mintAddress: row.mint_address,
      pdaAddress: row.pda_address,
    });
  }

  // 4. Iterate ME listings pages.
  const seenKeys = new Set<string>();
  let pagesFetched = 0;
  let listingsObserved = 0;
  let listingsInserted = 0;
  let listingsUpdated = 0;
  let mintsResolvedThisRun = 0;
  let mintsResolvedToCollectible = 0;

  for await (const batch of client.getCollectionListings(symbol, {
    limit: 100,
    maxPages: opts.maxListingPages,
    attributeFilter: POKEMON_ONLY_FILTER,
  })) {
    pagesFetched++;

    for (const listing of batch) {
      listingsObserved++;
      const key = `${listing.tokenMint}|${listing.pdaAddress ?? ""}`;
      seenKeys.add(key);

      // Resolve mint identity once per mint (capped per run).
      if (!knownMints.has(listing.tokenMint) && mintBudget > 0) {
        mintBudget--;
        mintsResolvedThisRun++;
        const resolved = await resolveAndStoreMint(
          sql,
          client,
          listing.tokenMint,
          collectibleByKey,
          setCodeByName
        );
        if (resolved) mintsResolvedToCollectible++;
        knownMints.add(listing.tokenMint);
      }

      // Insert or update listing.
      const existing = activeByKey.get(key);
      const priceFields = derivePriceFields(listing);
      const collectibleId = await fetchCollectibleIdForMint(sql, listing.tokenMint);

      if (existing) {
        await sql`
          UPDATE listings
          SET observed_at = NOW(),
              price_usd = ${priceFields.priceUsd},
              price_usdc = ${priceFields.priceUsdc},
              price_sol = ${priceFields.priceSol},
              seller = ${listing.seller},
              marketplace = ${listing.listingSource ?? null},
              collectible_id = COALESCE(collectible_id, ${collectibleId ?? null}::uuid),
              raw = ${JSON.stringify(listing)}::jsonb
          WHERE id = ${existing.id}::uuid
        `;
        listingsUpdated++;
      } else {
        await sql`
          INSERT INTO listings (
            source, chain, mint_address, seller,
            price_usd, price_usdc, price_sol,
            marketplace, pda_address,
            listed_at, collectible_id, raw
          ) VALUES (
            ${SOURCE}, 'solana', ${listing.tokenMint}, ${listing.seller},
            ${priceFields.priceUsd}, ${priceFields.priceUsdc}, ${priceFields.priceSol},
            ${listing.listingSource ?? null}, ${listing.pdaAddress ?? null},
            NULL, ${collectibleId ?? null}::uuid, ${JSON.stringify(listing)}::jsonb
          )
        `;
        listingsInserted++;
      }
    }
  }

  // 5. Mark not-seen-this-run active rows as expired.
  let listingsExpired = 0;
  const staleIds: string[] = [];
  for (const [key, row] of activeByKey) {
    if (!seenKeys.has(key)) staleIds.push(row.id);
  }
  if (staleIds.length > 0) {
    // Batch expire in chunks of 100 to keep SQL reasonable.
    for (let i = 0; i < staleIds.length; i += 100) {
      const chunk = staleIds.slice(i, i + 100);
      await sql`
        UPDATE listings SET expired_at = NOW()
        WHERE id = ANY(${chunk}::uuid[]) AND expired_at IS NULL
      `;
      listingsExpired += chunk.length;
    }
  }

  return {
    pagesFetched,
    listingsObserved,
    listingsInserted,
    listingsUpdated,
    listingsExpired,
    mintsResolvedThisRun,
    mintsResolvedToCollectible,
    mintLookupsRemainingForNextRun: mintBudget,
  };
}

function derivePriceFields(listing: MagicEdenListing): {
  priceUsd: string | null;
  priceUsdc: string | null;
  priceSol: string | null;
} {
  let priceSol: string | null = null;
  let priceUsdc: string | null = null;

  if (listing.priceInfo?.solPrice?.rawAmount) {
    const decimals = listing.priceInfo.solPrice.decimals ?? 9;
    priceSol = (
      Number(listing.priceInfo.solPrice.rawAmount) / Math.pow(10, decimals)
    ).toFixed(6);
  } else if (typeof listing.price === "number") {
    priceSol = listing.price.toFixed(6);
  }

  if (listing.priceInfo?.splPrice?.symbol === "USDC") {
    const decimals = listing.priceInfo.splPrice.decimals ?? 6;
    priceUsdc = (
      Number(listing.priceInfo.splPrice.rawAmount) / Math.pow(10, decimals)
    ).toFixed(4);
  }

  // priceUsd: prefer USDC if denominated in USDC; else leave null until a
  // SOL/USD conversion lives somewhere shared. For Step 2 we store what ME
  // explicitly returned.
  const priceUsd = priceUsdc;

  return { priceUsd, priceUsdc, priceSol };
}

async function resolveAndStoreMint(
  sql: any,
  client: MagicEdenClient,
  mintAddress: string,
  collectibleByKey: Map<string, string>,
  setCodeByName: Map<string, string>
): Promise<boolean> {
  const token = await client.getToken(mintAddress);
  const parsed = parseCollectorCryptAttributes(token?.attributes);

  if (!parsed) {
    await sql`
      INSERT INTO mint_card_map (mint_address, platform, raw_attributes)
      VALUES (${mintAddress}, ${PLATFORM}, ${JSON.stringify(token?.attributes ?? [])}::jsonb)
      ON CONFLICT (mint_address) DO NOTHING
    `;
    return false;
  }

  let collectibleId: string | null = null;
  let resolvedSetCode: string | null = parsed.setCode;
  const isPokemon = parsed.category.toLowerCase() === "pokemon";
  const cardNumber = normalizeCardNumber(parsed.serialNumber);

  // Set-code resolution path A: exact name match (lowercased).
  // CC sets like "Brilliant Stars - English" → setName "Brilliant Stars" → swsh9.
  if (isPokemon && !resolvedSetCode && parsed.setName) {
    const nameKey = parsed.setName.trim().toLowerCase();
    resolvedSetCode = setCodeByName.get(nameKey) ?? null;
  }

  // Path B: pg_trgm similarity fallback for set names that don't exact-match.
  // Handles drift like "Steam Siege" vs DB's "XY—Steam Siege" formatting.
  if (isPokemon && !resolvedSetCode && parsed.setName) {
    const fuzzy = (await sql`
      SELECT code FROM sets
      WHERE game = 'pokemon' AND name % ${parsed.setName}
      ORDER BY similarity(name, ${parsed.setName}) DESC
      LIMIT 1
    `) as Array<{ code: string }>;
    if (fuzzy[0]) resolvedSetCode = fuzzy[0].code;
  }

  if (isPokemon && resolvedSetCode && cardNumber) {
    const lookupKey = `${resolvedSetCode.toLowerCase()}|${cardNumber}`;
    collectibleId = collectibleByKey.get(lookupKey) ?? null;
  }

  await sql`
    INSERT INTO mint_card_map (
      mint_address, platform, category, collectible_id,
      card_name, set_code, card_number,
      grader, grade, parallel, language,
      raw_attributes
    ) VALUES (
      ${mintAddress}, ${PLATFORM}, ${parsed.category}, ${collectibleId ?? null}::uuid,
      ${parsed.cardName}, ${resolvedSetCode}, ${cardNumber},
      ${parsed.grader}, ${parsed.grade}, ${parsed.parallel}, ${parsed.language},
      ${JSON.stringify(token?.attributes ?? [])}::jsonb
    )
    ON CONFLICT (mint_address) DO UPDATE SET
      collectible_id = COALESCE(mint_card_map.collectible_id, EXCLUDED.collectible_id),
      category = EXCLUDED.category,
      card_name = EXCLUDED.card_name,
      set_code = EXCLUDED.set_code,
      card_number = EXCLUDED.card_number,
      grader = EXCLUDED.grader,
      grade = EXCLUDED.grade,
      parallel = EXCLUDED.parallel,
      language = EXCLUDED.language,
      raw_attributes = EXCLUDED.raw_attributes
  `;

  return collectibleId != null;
}

async function fetchCollectibleIdForMint(
  sql: any,
  mintAddress: string
): Promise<string | null> {
  const rows = (await sql`
    SELECT collectible_id FROM mint_card_map WHERE mint_address = ${mintAddress}
  `) as Array<{ collectible_id: string | null }>;
  return rows[0]?.collectible_id ?? null;
}

// ─── Standalone script entry point ─────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const client = new MagicEdenV2Client();

  const opts: IngestOptions = {
    maxMintLookups: parseInt(
      process.env.ME_MAX_MINT_LOOKUPS_PER_RUN ?? "300",
      10
    ),
  };
  if (process.env.ME_MAX_LISTING_PAGES) {
    opts.maxListingPages = parseInt(process.env.ME_MAX_LISTING_PAGES, 10);
  }

  console.log("Magic Eden ingestion — Collector Crypt\n");
  console.log(`  maxMintLookups: ${opts.maxMintLookups}`);
  console.log(`  maxListingPages: ${opts.maxListingPages ?? "unlimited"}\n`);

  const startedAt = Date.now();
  const report = await ingestMagicEdenListings(sql, client, opts);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\nDone in ${elapsed}s`);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("magic-eden.ts")) {
  main().catch((err) => {
    console.error("Magic Eden ingestion failed:", err);
    process.exit(1);
  });
}
