/**
 * Scryfall Price Ingestion
 *
 * Fetches current prices from Scryfall for all MTG cards in our DB
 * and inserts them as price_points. Scryfall updates prices daily.
 *
 * Usage: npx tsx src/lib/ingestion/scryfall-prices.ts [startPage]
 *   startPage — optional, resume from this page (default: 1)
 *
 * Requires: DATABASE_URL env var
 *
 * Sources embedded in Scryfall prices:
 *   - usd / usd_foil / usd_etched — TCGPlayer market prices
 *   - eur / eur_foil — CardMarket trend prices
 *   - tix — MTGO (Cardhoarder) prices
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const SCRYFALL_API = "https://api.scryfall.com";
const SQL_BATCH_SIZE = 25; // rows per INSERT statement

interface ScryfallPriceCard {
  id: string;
  prices: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  };
}

interface PriceRow {
  collectibleId: string;
  source: string;
  condition: string;
  priceUsd: string;
  priceNative: string | null;
  currency: string;
  listingType: string;
  confidence: number;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const startPage = parseInt(process.argv[2] ?? "1");
  const sql = neon(process.env.DATABASE_URL);

  console.log("Scryfall Price Ingestion\n");

  // Build lookup map: scryfall_id -> our DB uuid
  console.log("Fetching card IDs from DB...");
  const cards = await sql`
    SELECT id, external_id FROM collectibles WHERE game = 'mtg' AND external_id IS NOT NULL
  `;
  const idMap = new Map<string, string>();
  for (const c of cards) {
    idMap.set(c.external_id, c.id);
  }
  console.log(`Found ${idMap.size} MTG cards in DB\n`);

  // Paginate through Scryfall
  let nextUrl: string | null =
    `${SCRYFALL_API}/cards/search?q=game%3Apaper&unique=prints&order=set&page=${startPage}`;
  let totalProcessed = 0;
  let totalPricePoints = 0;
  let pageNum = startPage;
  let consecutiveErrors = 0;

  while (nextUrl) {
    console.log(`  Page ${pageNum}...`);

    let pageData: any;
    try {
      pageData = await fetchJson(nextUrl);
    } catch (err: any) {
      console.error(`  Scryfall fetch failed on page ${pageNum}: ${err.message}`);
      break;
    }

    const scryfallCards: ScryfallPriceCard[] = pageData.data;
    const rows: PriceRow[] = [];

    for (const sc of scryfallCards) {
      const dbId = idMap.get(sc.id);
      if (!dbId) continue;

      const p = sc.prices;
      if (p.usd) rows.push({ collectibleId: dbId, source: "scryfall_tcgplayer", condition: "nm", priceUsd: p.usd, priceNative: null, currency: "USD", listingType: "active", confidence: 0.9 });
      if (p.usd_foil) rows.push({ collectibleId: dbId, source: "scryfall_tcgplayer", condition: "nm_foil", priceUsd: p.usd_foil, priceNative: null, currency: "USD", listingType: "active", confidence: 0.9 });
      if (p.usd_etched) rows.push({ collectibleId: dbId, source: "scryfall_tcgplayer", condition: "nm_etched", priceUsd: p.usd_etched, priceNative: null, currency: "USD", listingType: "active", confidence: 0.9 });
      if (p.eur) rows.push({ collectibleId: dbId, source: "scryfall_cardmarket", condition: "nm", priceUsd: p.eur, priceNative: p.eur, currency: "EUR", listingType: "active", confidence: 0.85 });
      if (p.eur_foil) rows.push({ collectibleId: dbId, source: "scryfall_cardmarket", condition: "nm_foil", priceUsd: p.eur_foil, priceNative: p.eur_foil, currency: "EUR", listingType: "active", confidence: 0.85 });
      if (p.tix) rows.push({ collectibleId: dbId, source: "scryfall_mtgo", condition: "digital", priceUsd: p.tix, priceNative: p.tix, currency: "TIX", listingType: "active", confidence: 0.95 });
    }

    // Insert in batches using raw SQL with multiple VALUES
    let pageInserted = 0;
    for (let i = 0; i < rows.length; i += SQL_BATCH_SIZE) {
      const batch = rows.slice(i, i + SQL_BATCH_SIZE);
      try {
        const inserted = await insertBatch(sql, batch);
        pageInserted += inserted;
        consecutiveErrors = 0;
      } catch (err: any) {
        consecutiveErrors++;
        console.log(`    Insert batch failed (${consecutiveErrors}): ${err.message?.slice(0, 80)}`);

        if (consecutiveErrors >= 3) {
          // Wait longer and retry once
          console.log(`    Waiting 5s before retry...`);
          await sleep(5000);
          try {
            const inserted = await insertBatch(sql, batch);
            pageInserted += inserted;
            consecutiveErrors = 0;
          } catch {
            console.log(`    Still failing. Resume later with: npm run ingest:prices -- ${pageNum}`);
            console.log(`    Total so far: ${totalPricePoints + pageInserted} price points`);
            process.exit(1);
          }
        }
      }
    }

    totalProcessed += scryfallCards.length;
    totalPricePoints += pageInserted;

    if (pageNum % 10 === 0 || pageNum < 5) {
      console.log(`  ${totalProcessed} cards, ${totalPricePoints} prices (page ${pageNum})`);
    }

    nextUrl = pageData.has_more ? pageData.next_page : null;
    pageNum++;

    // Respect Scryfall rate limit (10 req/sec)
    await sleep(110);
  }

  console.log(`\nDone! Ingested ${totalPricePoints} price points from ${totalProcessed} cards.`);
}

async function insertBatch(
  sql: any,
  rows: PriceRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  // Build a multi-row INSERT using tagged template
  // Neon's tagged template doesn't support dynamic multi-row easily,
  // so we use a single INSERT per row but wrapped in a transaction-like batch
  const promises = rows.map((r) =>
    sql`INSERT INTO price_points (collectible_id, source, condition, price_usd, price_native, currency, listing_type, confidence)
        VALUES (${r.collectibleId}::uuid, ${r.source}, ${r.condition}, ${r.priceUsd}, ${r.priceNative}, ${r.currency}, ${r.listingType}, ${r.confidence})`
  );

  // Execute all inserts concurrently (Neon HTTP supports this)
  await Promise.all(promises);
  return rows.length;
}

async function fetchJson(url: string): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        if (res.status === 429) {
          console.log("  Rate limited, waiting 2s...");
          await sleep(2000);
          continue;
        }
        throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (i === 2) throw err;
      console.log(`  Fetch failed, retrying (${i + 1}/3)...`);
      await sleep(1000 * (i + 1));
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Price ingestion failed:", err);
  process.exit(1);
});
