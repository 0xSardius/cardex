/**
 * POST /api/v1/wallet-insight — Wallet intelligence via SolEnrich + CardEx
 *
 * x402-gated: $0.005 per request (USDC on Solana)
 *
 * Demonstrates agent-to-agent commerce: caller pays CardEx via x402,
 * CardEx pays SolEnrich via x402 for wallet enrichment, then combines
 * with CardEx payment history and portfolio data.
 *
 * Composition logic lives in src/lib/insight/wallet.ts so the SSR
 * /demo/wallet page shares one code path with this route.
 */

import { NextRequest, NextResponse } from "next/server";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";
import { composeWalletInsight } from "@/lib/insight/wallet";

interface WalletInsightRequest {
  address: string;
}

export async function POST(request: NextRequest) {
  const body: WalletInsightRequest = await request.json();

  if (!body.address) {
    return NextResponse.json(
      { error: "Missing required field: address" },
      { status: 400 }
    );
  }

  recordPayment("/api/v1/wallet-insight", "0.005").catch(() => {});

  const composed = await composeWalletInsight(body.address);

  return NextResponse.json({ ...composed, agent: agentMeta() });
}
