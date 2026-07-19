/**
 * Cron endpoint: full gacha ingestion — machine snapshots + pool NFTs + pulls.
 * Suggested cadence: every 30 min (pool top-100s + odds/stock drift slowly).
 * Protected by CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { GachaClient } from "@/lib/ingestion/clients/gacha-client";
import {
  ingestGachaMachines,
  ingestGachaPool,
  ingestGachaPulls,
} from "@/lib/ingestion/gacha";

export const maxDuration = 300;

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
  const machines = await ingestGachaMachines(sql, client);
  const pool = await ingestGachaPool(sql, client);
  const pulls = await ingestGachaPulls(sql, client);
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({ success: true, elapsedMs, machines, pool, pulls });
}
