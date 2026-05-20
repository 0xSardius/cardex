/**
 * POST /api/v1/rwa-fair-value — Paper-vs-onchain price oracle for a single mint.
 *
 * x402-gated: $0.002 per request (USDC on Solana)
 *
 * Request body:
 *   { mint?: string, listing_url?: string, currency?: "usd" }
 *
 * Returns:
 *   {
 *     mint,
 *     collectible: { id, name, set, number, grader, grade, parallel } | null,
 *     paper_price: { median_usd, source_count, fresh_minutes, condition_basis },
 *     onchain: { best_ask_usd, source, marketplace, fresh_minutes, all_listings[] },
 *     spread: { percent, absolute_usd, direction },
 *     agent
 *   }
 *
 * Errors:
 *   404 mint_unknown       — mint not in mint_card_map
 *   404 mint_unmapped      — in mint_card_map but no collectible_id resolved
 *   404 no_active_listings — collectible exists but no active onchain listing
 *
 * Caveat (see PHASE-8-PLAN.md Step 4): paper_price reflects raw-card prices.
 * Most CC mints are graded (PSA/CGC/BGS). Until PriceCharting graded prices land
 * in Step 4, the spread for a graded mint understates the true gap. We surface
 * this via `paper_price.condition_basis: "raw"` so bots can filter.
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";
import { getSolUsdRate, type SolUsdRate } from "@/lib/oracle/sol-usd";

interface FairValueRequest {
  mint?: string;
  listing_url?: string;
  currency?: "usd";
}

interface MintRow {
  mint_address: string;
  collectible_id: string | null;
  card_name: string | null;
  grader: string | null;
  grade: string | null;
  parallel: string | null;
  language: string | null;
  set_code: string | null;
  card_number: string | null;
  category: string | null;
}

interface CollectibleRow {
  id: string;
  name: string;
  set_number: string | null;
  rarity: string | null;
  image_url: string | null;
  set_name: string | null;
  set_code: string | null;
}

interface PaperPriceRow {
  median_usd: string | null;
  source_count: string;
  newest_observed_at: Date | null;
}

interface ListingRow {
  id: string;
  source: string;
  marketplace: string | null;
  seller: string | null;
  price_sol: string | null;
  price_usdc: string | null;
  price_usd: string | null;
  pda_address: string | null;
  observed_at: Date;
}

const ME_LISTING_URL_RE =
  /(?:magiceden\.(?:io|us))\/(?:item-details|marketplace)\/([1-9A-HJ-NP-Za-km-z]{32,44})/i;

export async function POST(request: NextRequest) {
  let body: FairValueRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mint = resolveMint(body);
  if (!mint) {
    return NextResponse.json(
      { error: "Missing required field: provide `mint` or a recognized `listing_url`" },
      { status: 400 }
    );
  }

  // Payment already verified by x402 proxy; log for the ledger.
  recordPayment("/api/v1/rwa-fair-value", "0.002").catch(() => {});

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }
  const sql = neon(process.env.DATABASE_URL);

  // 1. Look up mint identity.
  const mintRows = (await sql`
    SELECT mint_address, collectible_id, card_name, grader, grade, parallel,
           language, set_code, card_number, category
    FROM mint_card_map
    WHERE mint_address = ${mint}
    LIMIT 1
  `) as MintRow[];

  if (mintRows.length === 0) {
    return NextResponse.json(
      { error: "mint_unknown", mint, message: "Mint not yet indexed. Retry after the next ingestion cycle." },
      { status: 404 }
    );
  }
  const mintRow = mintRows[0];

  // 2. Fetch collectible details (may be null if unmapped).
  let collectible: CollectibleRow | null = null;
  if (mintRow.collectible_id) {
    const rows = (await sql`
      SELECT c.id, c.name, c.set_number, c.rarity, c.image_url,
             s.name AS set_name, s.code AS set_code
      FROM collectibles c
      LEFT JOIN sets s ON s.id = c.set_id
      WHERE c.id = ${mintRow.collectible_id}::uuid
      LIMIT 1
    `) as CollectibleRow[];
    collectible = rows[0] ?? null;
  }

  // 3. Paper price aggregation. Pull active TCGPlayer/CardMarket points
  //    observed in the last 7 days; aggregate to median.
  let paperPrice: {
    median_usd: number | null;
    source_count: number;
    fresh_minutes: number | null;
    condition_basis: string;
  } | null = null;
  if (collectible) {
    const paperRows = (await sql`
      SELECT
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd::numeric))::text AS median_usd,
        COUNT(DISTINCT source)::text AS source_count,
        MAX(observed_at) AS newest_observed_at
      FROM price_points
      WHERE collectible_id = ${collectible.id}::uuid
        AND observed_at > NOW() - INTERVAL '7 days'
    `) as PaperPriceRow[];
    const p = paperRows[0];
    if (p?.median_usd) {
      paperPrice = {
        median_usd: parseFloat(p.median_usd),
        source_count: parseInt(p.source_count),
        fresh_minutes: p.newest_observed_at
          ? Math.floor((Date.now() - new Date(p.newest_observed_at).getTime()) / 60_000)
          : null,
        condition_basis: "raw", // see Step 4 caveat in module header
      };
    }
  }

  // 4. Active onchain listings for this mint. Sort happens in JS so we can
  //    use the Pyth SOL/USD oracle to rank SOL-only listings against
  //    USDC/USD ones on the same axis.
  const listingRows = (await sql`
    SELECT id, source, marketplace, seller, price_sol, price_usdc, price_usd,
           pda_address, observed_at
    FROM listings
    WHERE mint_address = ${mint}
      AND expired_at IS NULL
    ORDER BY observed_at DESC
  `) as ListingRow[];

  const solUsdRate = await getSolUsdRate();
  const onchain = await buildOnchainSection(listingRows, solUsdRate);

  // 5. Spread calculation.
  let spread: {
    percent: number | null;
    absolute_usd: number | null;
    direction: string;
  } | null = null;
  if (paperPrice?.median_usd != null && onchain.best_ask_usd != null) {
    const absolute = onchain.best_ask_usd - paperPrice.median_usd;
    const pct = (absolute / paperPrice.median_usd) * 100;
    spread = {
      percent: round(pct, 2),
      absolute_usd: round(absolute, 2),
      direction:
        absolute < 0
          ? "onchain_below_paper"
          : absolute > 0
            ? "onchain_above_paper"
            : "even",
    };
  }

  // 6. Build response + ETag/Cache.
  const responseBody = {
    mint,
    collectible: collectible
      ? {
          id: collectible.id,
          name: collectible.name,
          set: collectible.set_name,
          set_code: collectible.set_code,
          number: collectible.set_number,
          grader: mintRow.grader,
          grade: mintRow.grade ? parseFloat(mintRow.grade) : null,
          parallel: mintRow.parallel,
          language: mintRow.language,
          image_url: collectible.image_url,
        }
      : {
          mapped: false,
          card_name_observed: mintRow.card_name,
          set_code_observed: mintRow.set_code,
          number_observed: mintRow.card_number,
          grader: mintRow.grader,
          grade: mintRow.grade ? parseFloat(mintRow.grade) : null,
          parallel: mintRow.parallel,
          language: mintRow.language,
        },
    paper_price: paperPrice,
    onchain,
    spread,
    agent: agentMeta(),
  };

  const etag = buildEtag(mint, onchain.fresh_minutes, paperPrice?.fresh_minutes ?? null);

  // Conditional GET / POST — match against If-None-Match.
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=30",
      },
    });
  }

  return NextResponse.json(responseBody, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=30",
    },
  });
}

function resolveMint(body: FairValueRequest): string | null {
  if (body.mint && typeof body.mint === "string") return body.mint.trim();
  if (body.listing_url) {
    const match = body.listing_url.match(ME_LISTING_URL_RE);
    if (match) return match[1];
  }
  return null;
}

interface EnrichedListing {
  source: string;
  marketplace: string | null;
  seller: string | null;
  price_sol: number | null;
  price_usdc: number | null;
  price_usd: number | null;
  /** USD-equivalent value used for sort + spread math. Pulled from the
   *  best available column, falling back to price_sol × Pyth SOL/USD. */
  effective_usd: number | null;
  pda_address: string | null;
  observed_minutes_ago: number;
}

async function buildOnchainSection(
  rows: ListingRow[],
  solUsdRate: SolUsdRate | null
): Promise<{
  best_ask_usd: number | null;
  best_ask_currency: string | null;
  source: string | null;
  marketplace: string | null;
  fresh_minutes: number | null;
  active_count: number;
  sol_usd_rate: {
    rate: number;
    age_ms: number;
    source: string;
  } | null;
  all_listings: EnrichedListing[];
}> {
  if (rows.length === 0) {
    return {
      best_ask_usd: null,
      best_ask_currency: null,
      source: null,
      marketplace: null,
      fresh_minutes: null,
      active_count: 0,
      sol_usd_rate: solUsdRate
        ? { rate: solUsdRate.rate, age_ms: solUsdRate.age_ms, source: solUsdRate.source }
        : null,
      all_listings: [],
    };
  }

  const enriched: EnrichedListing[] = rows.map((r) => {
    const priceSol = r.price_sol ? parseFloat(r.price_sol) : null;
    const priceUsdc = r.price_usdc ? parseFloat(r.price_usdc) : null;
    const priceUsd = r.price_usd ? parseFloat(r.price_usd) : null;
    const effective =
      priceUsdc ??
      priceUsd ??
      (priceSol != null && solUsdRate ? priceSol * solUsdRate.rate : null);
    return {
      source: r.source,
      marketplace: r.marketplace,
      seller: r.seller,
      price_sol: priceSol,
      price_usdc: priceUsdc,
      price_usd: priceUsd,
      effective_usd: effective,
      pda_address: r.pda_address,
      observed_minutes_ago: Math.floor(
        (Date.now() - new Date(r.observed_at).getTime()) / 60_000
      ),
    };
  });

  // Sort cheapest-first on effective USD; nulls last.
  enriched.sort((a, b) => {
    const av = a.effective_usd ?? Number.POSITIVE_INFINITY;
    const bv = b.effective_usd ?? Number.POSITIVE_INFINITY;
    return av - bv;
  });

  const best = enriched[0];
  let bestCurrency: string;
  if (best.price_usdc != null) bestCurrency = "USDC";
  else if (best.price_usd != null) bestCurrency = "USD";
  else if (best.price_sol != null && solUsdRate)
    bestCurrency = "SOL→USD (Pyth)";
  else bestCurrency = "SOL_only";

  return {
    best_ask_usd: best.effective_usd,
    best_ask_currency: bestCurrency,
    source: best.source,
    marketplace: best.marketplace,
    fresh_minutes: best.observed_minutes_ago,
    active_count: rows.length,
    sol_usd_rate: solUsdRate
      ? { rate: solUsdRate.rate, age_ms: solUsdRate.age_ms, source: solUsdRate.source }
      : null,
    all_listings: enriched.slice(0, 10), // cap response payload
  };
}

function buildEtag(
  mint: string,
  onchainFresh: number | null,
  paperFresh: number | null
): string {
  // ETag changes when either side's freshness bucket changes.
  // 30s cache window means we don't need second-level granularity.
  const onchainBucket = onchainFresh == null ? "none" : Math.floor(onchainFresh / 1);
  const paperBucket = paperFresh == null ? "none" : Math.floor(paperFresh / 60);
  return `"${mint.slice(0, 8)}-${onchainBucket}-${paperBucket}"`;
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
