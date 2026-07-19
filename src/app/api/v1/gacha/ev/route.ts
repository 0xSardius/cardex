/**
 * GET /api/v1/gacha/ev?pack=pokemon_50 — Live pack EV for a gacha machine.
 *
 * x402-gated: $0.001 per request (USDC on Solana)
 *
 * Returns the EV ladder for one machine (see src/lib/gacha/ev.ts):
 *   - ev.platform_insured  — the platform's own expected-insured-value number
 *   - ev.observed_insured  — empirical mean over accumulated pulls (n, CI)
 *   - ev.buyback_floor     — guaranteed instant-buyback exit
 *   - ev.realizable        — fee-netted best-exit per pull
 * plus observed-vs-stated tier shares, pool resolution coverage, chase cards,
 * and explicit caveats. Data freshness is bounded by the ingestion crons
 * (machines/pool ~30 min, pulls ~2-3 min).
 *
 * Errors:
 *   404 machine_unknown — no snapshot for that pack code
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";
import { computePackEv } from "@/lib/gacha/ev";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "service_unconfigured" }, { status: 500 });
  }
  const sql = neon(process.env.DATABASE_URL);
  const pack = (request.nextUrl.searchParams.get("pack") ?? "pokemon_50").trim();

  recordPayment("/api/v1/gacha/ev", "0.001").catch(() => {});

  const ev = await computePackEv(sql, pack);
  if (!ev) {
    return NextResponse.json(
      {
        error: "machine_unknown",
        message: `No machine snapshot for pack '${pack}'. Known packs are ingested from the CC Gacha API — check GET /api/v1/gacha/ev?pack=pokemon_50.`,
        agent: agentMeta(),
      },
      { status: 404 }
    );
  }

  const body = { ...ev, agent: agentMeta() };

  // ETag from the two freshness anchors: machine snapshot + pull sample size.
  const etag = `"gacha-ev:${pack}:${ev.machine.snapshot_at}:${ev.ev.observed_insured.n_pulls}"`;
  const ifNoneMatch = request.headers.get("if-none-match");
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=60",
  };
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json(body, { headers });
}
