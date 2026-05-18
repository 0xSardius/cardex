/**
 * Cron endpoint: pokemontcg.io price ingestion
 * Triggered by Railway Cron daily. Protected by CRON_SECRET.
 *
 * Paginates through pokemontcg.io v2 cards endpoint, extracts TCGPlayer +
 * CardMarket prices, upserts as price_points. ~80 calls for full catalog.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const POKEMONTCG_API = "https://api.pokemontcg.io/v2";
const PAGE_SIZE = 250;
const SQL_BATCH_SIZE = 25;

const TCGP_VARIANT_TO_CONDITION: Record<string, string> = {
  normal: "nm",
  holofoil: "nm_foil",
  reverseHolofoil: "nm_reverse_holo",
  "1stEditionNormal": "nm_1st_ed",
  "1stEditionHolofoil": "nm_1st_ed_foil",
  unlimitedHolofoil: "nm_unlimited_foil",
};

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

export const maxDuration = 300; // 5 min — full catalog takes ~3-5 min with API key

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);

  const cards = await sql`
    SELECT id, external_id FROM collectibles WHERE game = 'pokemon' AND external_id IS NOT NULL
  `;
  const idMap = new Map<string, string>();
  for (const c of cards) {
    idMap.set(c.external_id, c.id);
  }

  const headers: Record<string, string> = {
    "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
    Accept: "application/json",
  };
  if (process.env.POKEMONTCG_IO_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMONTCG_IO_API_KEY;
  }

  let page = 1;
  let totalProcessed = 0;
  let totalPricePoints = 0;

  while (true) {
    const url = `${POKEMONTCG_API}/cards?page=${page}&pageSize=${PAGE_SIZE}&select=id,tcgplayer,cardmarket`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      break;
    }

    const pageData = await res.json();
    if (!pageData.data || pageData.data.length === 0) break;

    const rows: PriceRow[] = [];
    for (const card of pageData.data) {
      const dbId = idMap.get(card.id);
      if (!dbId) continue;

      if (card.tcgplayer?.prices) {
        for (const [variant, prices] of Object.entries<any>(card.tcgplayer.prices)) {
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

    for (let i = 0; i < rows.length; i += SQL_BATCH_SIZE) {
      const batch = rows.slice(i, i + SQL_BATCH_SIZE);
      const promises = batch.map(
        (r) =>
          sql`INSERT INTO price_points (collectible_id, source, condition, price_usd, price_native, currency, listing_type, confidence)
              VALUES (${r.collectibleId}::uuid, ${r.source}, ${r.condition}, ${r.priceUsd}, ${r.priceNative}, ${r.currency}, ${r.listingType}, ${r.confidence})`
      );
      await Promise.all(promises);
      totalPricePoints += batch.length;
    }

    totalProcessed += pageData.data.length;
    if (pageData.data.length < PAGE_SIZE) break;
    page++;
    await new Promise((r) => setTimeout(r, process.env.POKEMONTCG_IO_API_KEY ? 200 : 2000));
  }

  return NextResponse.json({
    success: true,
    cardsProcessed: totalProcessed,
    pricePointsInserted: totalPricePoints,
    pages: page,
  });
}
