/**
 * Cron endpoint: Magic Eden ingestion (Collector Crypt listings).
 * Triggered by Railway Cron every 20-30 min (see docs/RWA-RECON.md §5).
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { MagicEdenV2Client } from "@/lib/ingestion/clients/magic-eden-client";
import { ingestMagicEdenListings } from "@/lib/ingestion/magic-eden";

// Cold-start runs hit ~328s (22 listing pages + 300 mint resolutions @ ~1s each).
// Warm runs are <30s because mint_card_map is filled. 600s leaves headroom.
export const maxDuration = 600;

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const client = new MagicEdenV2Client();

  const maxMintLookups = parseInt(
    process.env.ME_MAX_MINT_LOOKUPS_PER_RUN ?? "300",
    10
  );

  const startedAt = Date.now();
  const report = await ingestMagicEdenListings(sql, client, { maxMintLookups });
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({ success: true, elapsedMs, report });
}
