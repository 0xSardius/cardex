/**
 * Cron endpoint: gacha pulls (winners feed) only.
 * The feed serves the latest ~200 pulls (~5-6 min window at observed volume);
 * missed windows are unrecoverable. Suggested cadence: every 2-3 min.
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { GachaClient } from "@/lib/ingestion/clients/gacha-client";
import { ingestGachaPulls } from "@/lib/ingestion/gacha";

export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);
  const client = new GachaClient();

  const startedAt = Date.now();
  const pulls = await ingestGachaPulls(sql, client);
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({ success: true, elapsedMs, pulls });
}
