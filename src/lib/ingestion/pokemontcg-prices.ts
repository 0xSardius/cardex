/**
 * pokemontcg.io Price Ingestion
 *
 * Fetches current TCGPlayer + CardMarket prices for all Pokemon cards
 * in our DB and inserts them as price_points. pokemontcg.io updates daily.
 *
 * Usage: npx tsx src/lib/ingestion/pokemontcg-prices.ts [startPage]
 *   startPage — optional, resume from this page (default: 1)
 *
 * Env:
 *   DATABASE_URL              — required
 *   POKEMONTCG_IO_API_KEY     — optional, raises rate limit (free tier: 1000/day)
 *
 * Sources embedded in pokemontcg.io prices:
 *   - tcgplayer.prices.<variant>.market — TCGPlayer market price (US)
 *   - cardmarket.prices.trendPrice      — CardMarket trend price (EU, EUR)
 *
 * TCGPlayer variants map to our condition codes:
 *   normal                  → nm
 *   holofoil                → nm_foil
 *   reverseHolofoil         → nm_reverse_holo
 *   1stEditionNormal        → nm_1st_ed
 *   1stEditionHolofoil      → nm_1st_ed_foil
 *   unlimitedHolofoil       → nm_unlimited_foil
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const POKEMONTCG_API = "https://api.pokemontcg.io/v2";
const PAGE_SIZE = 250; // pokemontcg.io max
const SQL_BATCH_SIZE = 25;

// TCGPlayer price variant key → our condition code
const TCGP_VARIANT_TO_CONDITION: Record<string, string> = {
  normal: "nm",
  holofoil: "nm_foil",
  reverseHolofoil: "nm_reverse_holo",
  "1stEditionNormal": "nm_1st_ed",
  "1stEditionHolofoil": "nm_1st_ed_foil",
  unlimitedHolofoil: "nm_unlimited_foil",
};

interface PokemonTcgCard {
  id: string;
  tcgplayer?: {
    updatedAt?: string;
    prices?: Record<
      string,
      {
        low?: number | null;
        mid?: number | null;
        high?: number | null;
        market?: number | null;
        directLow?: number | null;
      }
    >;
  };
  cardmarket?: {
    updatedAt?: string;
    prices?: {
      trendPrice?: number | null;
      averageSellPrice?: number | null;
      lowPrice?: number | null;
      reverseHoloTrend?: number | null;
    };
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

  console.log("pokemontcg.io Price Ingestion\n");

  console.log("Fetching Pokemon card IDs from DB...");
  const cards = await sql`
    SELECT id, external_id FROM collectibles WHERE game = 'pokemon' AND external_id IS NOT NULL
  `;
  const idMap = new Map<string, string>();
  for (const c of cards) {
    idMap.set(c.external_id, c.id);
  }
  console.log(`Found ${idMap.size} Pokemon cards in DB\n`);

  let page = startPage;
  let totalProcessed = 0;
  let totalPricePoints = 0;
  let consecutiveErrors = 0;

  while (true) {
    console.log(`  Page ${page}...`);

    const url = `${POKEMONTCG_API}/cards?page=${page}&pageSize=${PAGE_SIZE}&select=id,tcgplayer,cardmarket`;
    let pageData: { data: PokemonTcgCard[]; count: number; totalCount: number };
    try {
      pageData = await fetchJson(url);
    } catch (err: any) {
      console.error(`  pokemontcg.io fetch failed on page ${page}: ${err.message}`);
      break;
    }

    if (!pageData.data || pageData.data.length === 0) break;

    const rows = buildPriceRows(pageData.data, idMap);

    let pageInserted = 0;
    for (let i = 0; i < rows.length; i += SQL_BATCH_SIZE) {
      const batch = rows.slice(i, i + SQL_BATCH_SIZE);
      try {
        await insertBatch(sql, batch);
        pageInserted += batch.length;
        consecutiveErrors = 0;
      } catch (err: any) {
        consecutiveErrors++;
        console.log(`    Insert batch failed (${consecutiveErrors}): ${err.message?.slice(0, 80)}`);

        if (consecutiveErrors >= 3) {
          console.log(`    Waiting 5s before retry...`);
          await sleep(5000);
          try {
            await insertBatch(sql, batch);
            pageInserted += batch.length;
            consecutiveErrors = 0;
          } catch {
            console.log(`    Still failing. Resume later with: npm run ingest:pokemon-prices -- ${page}`);
            console.log(`    Total so far: ${totalPricePoints + pageInserted} price points`);
            process.exit(1);
          }
        }
      }
    }

    totalProcessed += pageData.data.length;
    totalPricePoints += pageInserted;

    console.log(`    ${pageData.data.length} cards, ${pageInserted} prices (cumulative: ${totalPricePoints})`);

    if (pageData.data.length < PAGE_SIZE) break;
    page++;

    // Be polite — pokemontcg.io rate limit is 30/hr unauthenticated, much higher with key
    await sleep(process.env.POKEMONTCG_IO_API_KEY ? 200 : 2000);
  }

  console.log(`\nDone! Ingested ${totalPricePoints} price points from ${totalProcessed} cards.`);
}

function buildPriceRows(cards: PokemonTcgCard[], idMap: Map<string, string>): PriceRow[] {
  const rows: PriceRow[] = [];

  for (const card of cards) {
    const dbId = idMap.get(card.id);
    if (!dbId) continue;

    // TCGPlayer (US, USD) — extract per-variant market price
    if (card.tcgplayer?.prices) {
      for (const [variant, prices] of Object.entries(card.tcgplayer.prices)) {
        const condition = TCGP_VARIANT_TO_CONDITION[variant];
        if (!condition || prices.market == null) continue;

        rows.push({
          collectibleId: dbId,
          source: "pokemontcg_tcgplayer",
          condition,
          priceUsd: prices.market.toFixed(2),
          priceNative: null,
          currency: "USD",
          listingType: "active",
          confidence: 0.9,
        });
      }
    }

    // CardMarket (EU, EUR) — trend price stored under "nm" (we don't yet model variants here)
    const cm = card.cardmarket?.prices;
    if (cm?.trendPrice != null && cm.trendPrice > 0) {
      rows.push({
        collectibleId: dbId,
        source: "pokemontcg_cardmarket",
        condition: "nm",
        priceUsd: cm.trendPrice.toFixed(2),
        priceNative: cm.trendPrice.toFixed(2),
        currency: "EUR",
        listingType: "active",
        confidence: 0.85,
      });
    }
    if (cm?.reverseHoloTrend != null && cm.reverseHoloTrend > 0) {
      rows.push({
        collectibleId: dbId,
        source: "pokemontcg_cardmarket",
        condition: "nm_reverse_holo",
        priceUsd: cm.reverseHoloTrend.toFixed(2),
        priceNative: cm.reverseHoloTrend.toFixed(2),
        currency: "EUR",
        listingType: "active",
        confidence: 0.85,
      });
    }
  }

  return rows;
}

async function insertBatch(sql: any, rows: PriceRow[]): Promise<void> {
  if (rows.length === 0) return;
  const promises = rows.map(
    (r) =>
      sql`INSERT INTO price_points (collectible_id, source, condition, price_usd, price_native, currency, listing_type, confidence)
          VALUES (${r.collectibleId}::uuid, ${r.source}, ${r.condition}, ${r.priceUsd}, ${r.priceNative}, ${r.currency}, ${r.listingType}, ${r.confidence})`
  );
  await Promise.all(promises);
}

async function fetchJson(url: string): Promise<any> {
  const headers: Record<string, string> = {
    "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
    Accept: "application/json",
  };
  if (process.env.POKEMONTCG_IO_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMONTCG_IO_API_KEY;
  }

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 429) {
          console.log("  Rate limited, waiting 60s...");
          await sleep(60_000);
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
  console.error("Pokemon price ingestion failed:", err);
  process.exit(1);
});
