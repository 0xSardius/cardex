/**
 * Cron endpoint: Scryfall price ingestion
 * Triggered by Railway Cron daily. Protected by CRON_SECRET.
 *
 * This is a long-running operation (~5 min) that paginates through
 * Scryfall's full card catalog and upserts price points.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const SCRYFALL_API = "https://api.scryfall.com";
const SQL_BATCH_SIZE = 25;

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);

  // Build lookup map: scryfall_id -> our DB uuid
  const cards = await sql`
    SELECT id, external_id FROM collectibles WHERE game = 'mtg' AND external_id IS NOT NULL
  `;
  const idMap = new Map<string, string>();
  for (const c of cards) {
    idMap.set(c.external_id, c.id);
  }

  let nextUrl: string | null = `${SCRYFALL_API}/cards/search?q=game%3Apaper&unique=prints&order=set&page=1`;
  let totalProcessed = 0;
  let totalPricePoints = 0;
  let pageNum = 1;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: {
        "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }

    const pageData = await res.json();
    const scryfallCards = pageData.data;

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

    for (let i = 0; i < rows.length; i += SQL_BATCH_SIZE) {
      const batch = rows.slice(i, i + SQL_BATCH_SIZE);
      const promises = batch.map((r) =>
        sql`INSERT INTO price_points (collectible_id, source, condition, price_usd, price_native, currency, listing_type, confidence)
            VALUES (${r.collectibleId}::uuid, ${r.source}, ${r.condition}, ${r.priceUsd}, ${r.priceNative}, ${r.currency}, ${r.listingType}, ${r.confidence})`
      );
      await Promise.all(promises);
      totalPricePoints += batch.length;
    }

    totalProcessed += scryfallCards.length;
    nextUrl = pageData.has_more ? pageData.next_page : null;
    pageNum++;
    await new Promise((r) => setTimeout(r, 110));
  }

  return NextResponse.json({
    success: true,
    cardsProcessed: totalProcessed,
    pricePointsInserted: totalPricePoints,
    pages: pageNum - 1,
  });
}
