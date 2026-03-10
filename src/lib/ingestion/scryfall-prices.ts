/**
 * Scryfall Price Ingestion
 *
 * Fetches current prices from Scryfall for all MTG cards in our DB
 * and inserts them as price_points. Scryfall updates prices daily.
 *
 * Usage: npx tsx src/lib/ingestion/scryfall-prices.ts
 * Requires: DATABASE_URL env var
 *
 * Sources embedded in Scryfall prices:
 *   - usd / usd_foil / usd_etched — TCGPlayer market prices
 *   - eur / eur_foil — CardMarket trend prices
 *   - tix — MTGO (Cardhoarder) prices
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import { collectibles, pricePoints } from "../db/schema";

const SCRYFALL_API = "https://api.scryfall.com";
const BATCH_SIZE = 50;

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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);

  console.log("Scryfall Price Ingestion\n");

  // Get all MTG card external IDs from our DB
  console.log("Fetching card IDs from DB...");
  const cards = await db
    .select({
      id: collectibles.id,
      externalId: collectibles.externalId,
      foil: collectibles.foil,
    })
    .from(collectibles)
    .where(eq(collectibles.game, "mtg"));

  console.log(`Found ${cards.length} MTG cards in DB\n`);

  // Fetch prices via Scryfall paginated search (same as seed, but only need prices)
  let nextUrl: string | null =
    `${SCRYFALL_API}/cards/search?q=game%3Apaper&unique=prints&order=set&page=1`;
  let totalProcessed = 0;
  let totalPricePoints = 0;
  let pageNum = 1;

  // Build lookup map: scryfall_id -> our DB id
  const idMap = new Map<string, { dbId: string; foil: boolean | null }>();
  for (const c of cards) {
    if (c.externalId) {
      idMap.set(c.externalId, { dbId: c.id, foil: c.foil });
    }
  }

  let priceBatch: Array<typeof pricePoints.$inferInsert> = [];

  while (nextUrl) {
    console.log(`  Page ${pageNum}...`);
    const pageData = await fetchJson(nextUrl);
    const scryfallCards: ScryfallPriceCard[] = pageData.data;

    for (const sc of scryfallCards) {
      const entry = idMap.get(sc.id);
      if (!entry) continue;

      const { dbId, foil } = entry;
      const prices = sc.prices;

      // USD (TCGPlayer market) — regular
      if (prices.usd) {
        priceBatch.push({
          collectibleId: dbId,
          source: "scryfall_tcgplayer",
          condition: "nm",
          priceUsd: prices.usd,
          currency: "USD",
          listingType: "active",
          confidence: 0.9,
        });
      }

      // USD foil
      if (prices.usd_foil) {
        priceBatch.push({
          collectibleId: dbId,
          source: "scryfall_tcgplayer",
          condition: "nm_foil",
          priceUsd: prices.usd_foil,
          currency: "USD",
          listingType: "active",
          confidence: 0.9,
        });
      }

      // USD etched
      if (prices.usd_etched) {
        priceBatch.push({
          collectibleId: dbId,
          source: "scryfall_tcgplayer",
          condition: "nm_etched",
          priceUsd: prices.usd_etched,
          currency: "USD",
          listingType: "active",
          confidence: 0.9,
        });
      }

      // EUR (CardMarket trend)
      if (prices.eur) {
        priceBatch.push({
          collectibleId: dbId,
          source: "scryfall_cardmarket",
          condition: "nm",
          priceUsd: prices.eur, // stored as-is; currency field disambiguates
          priceNative: prices.eur,
          currency: "EUR",
          listingType: "active",
          confidence: 0.85,
        });
      }

      // EUR foil
      if (prices.eur_foil) {
        priceBatch.push({
          collectibleId: dbId,
          source: "scryfall_cardmarket",
          condition: "nm_foil",
          priceUsd: prices.eur_foil,
          priceNative: prices.eur_foil,
          currency: "EUR",
          listingType: "active",
          confidence: 0.85,
        });
      }

      // MTGO tix
      if (prices.tix) {
        priceBatch.push({
          collectibleId: dbId,
          source: "scryfall_mtgo",
          condition: "digital",
          priceUsd: prices.tix, // tix value, not USD
          priceNative: prices.tix,
          currency: "TIX",
          listingType: "active",
          confidence: 0.95,
        });
      }

      if (priceBatch.length >= BATCH_SIZE) {
        const inserted = await flushPriceBatch(db, priceBatch);
        totalPricePoints += inserted;
        priceBatch = [];
      }
    }

    totalProcessed += scryfallCards.length;
    console.log(`  ${totalProcessed} cards processed, ${totalPricePoints} price points so far`);

    nextUrl = pageData.has_more ? pageData.next_page : null;
    pageNum++;

    // Respect Scryfall rate limit
    await sleep(100);
  }

  // Flush remaining
  if (priceBatch.length > 0) {
    const inserted = await flushPriceBatch(db, priceBatch);
    totalPricePoints += inserted;
  }

  console.log(`\nDone! Ingested ${totalPricePoints} price points from ${totalProcessed} cards.`);
}

async function flushPriceBatch(
  db: ReturnType<typeof drizzle>,
  batch: Array<typeof pricePoints.$inferInsert>
): Promise<number> {
  let inserted = 0;
  for (const row of batch) {
    try {
      await db.insert(pricePoints).values(row);
      inserted++;
    } catch (err: any) {
      // Skip on connection errors, log others
      if (!err.message?.includes("fetch failed")) {
        console.error(`  Insert error: ${err.message?.slice(0, 100)}`);
      }
    }
  }
  return inserted;
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
