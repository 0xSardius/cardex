/**
 * POST /api/v1/rwa-arbitrage — Underpriced onchain listings vs paper-market.
 *
 * x402-gated: $0.005 per request (USDC on Solana). Per-call pricing
 * (not per-result) — x402 doesn't natively support dynamic pricing,
 * and bots prefer predictable cost. Margin lever is the seller_intel
 * cache hit rate, NOT per-row revenue.
 *
 * Request body (all optional):
 *   {
 *     min_spread_percent?: number   // default 10. Onchain ask must be at
 *                                   // least this % below paper median.
 *     min_paper_price_usd?: number  // default 25. Skip tiny opportunities.
 *     limit?: number                // default 20, max 50.
 *     include_seller_risk?: boolean // default true. seller_risk +
 *                                   // seller_cluster fields are populated;
 *                                   // false to skip and save SolEnrich cost.
 *     include_wash_trades?: boolean // default false. Wash-trade-flagged
 *                                   // clusters drop from results by default.
 *     honor_royalties?: boolean     // default false. Net profit math
 *                                   // assumes the buyer opts out of
 *                                   // optional royalties (ME default).
 *   }
 *
 * Core scan logic lives in src/lib/insight/arbitrage.ts so the SSR
 * /demo/arbitrage page can call the same code path without going
 * through the x402 proxy.
 */

import { NextRequest, NextResponse } from "next/server";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";
import {
  scanArbitrage,
  buildArbitrageEtag,
  type ArbitrageScanOptions,
} from "@/lib/insight/arbitrage";

export async function POST(request: NextRequest) {
  let body: ArbitrageScanOptions;
  try {
    body = (await request.json().catch(() => ({}))) as ArbitrageScanOptions;
  } catch {
    body = {};
  }

  recordPayment("/api/v1/rwa-arbitrage", "0.005").catch(() => {});

  let scan;
  try {
    scan = await scanArbitrage(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "scan failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const responseBody = { ...scan, agent: agentMeta() };

  const etag = buildArbitrageEtag(
    scan.opportunities,
    scan.query.min_spread_percent,
    scan.query.min_paper_price_usd,
    scan.query.limit
  );
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  return NextResponse.json(responseBody, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=60",
    },
  });
}
