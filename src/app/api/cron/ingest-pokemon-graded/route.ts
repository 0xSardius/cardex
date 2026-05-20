/**
 * Cron endpoint: Pokemon Price Tracker PSA graded prices.
 * Triggered by Railway Cron daily. Protected by CRON_SECRET.
 *
 * Default budget: 80 lookups/run (free-tier-safe). Raise via
 * ?maxCards=N once on Business tier ($99/mo).
 */

import { NextResponse } from "next/server";
import { ingestPokemonPriceTrackerPsa } from "@/lib/ingestion/pokemon-price-tracker";

export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.POKEMON_PRICE_TRACKER_API_KEY) {
    return NextResponse.json(
      { error: "POKEMON_PRICE_TRACKER_API_KEY not set" },
      { status: 500 }
    );
  }

  const maxCardsRaw = url.searchParams.get("maxCards");
  const maxCards = maxCardsRaw ? parseInt(maxCardsRaw, 10) : undefined;

  try {
    const stats = await ingestPokemonPriceTrackerPsa({ maxCards });
    return NextResponse.json({ success: true, ...stats });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
