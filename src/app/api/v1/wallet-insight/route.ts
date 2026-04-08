/**
 * POST /api/v1/wallet-insight — Wallet intelligence via SolEnrich + CardEx
 *
 * x402-gated: $0.005 per request (USDC on Solana)
 *
 * Demonstrates agent-to-agent commerce: caller pays CardEx via x402,
 * CardEx pays SolEnrich via x402 for wallet enrichment, then combines
 * with CardEx payment history and portfolio data.
 *
 * Request body:
 *   { address: string }  (Solana wallet address)
 *
 * Returns: SolEnrich wallet profile + CardEx payment history + portfolio
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  paymentEvents,
  portfolios,
  portfolioItems,
  collectibles,
} from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";
import { enrichWalletLight } from "@/lib/solenrich/client";

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

  const { address } = body;

  // Record payment (x402 proxy already verified payment before we get here)
  recordPayment("/api/v1/wallet-insight", "0.005").catch(() => {});

  // Run SolEnrich enrichment + CardEx DB lookups in parallel
  const [solenrichData, paymentHistory, portfolio] = await Promise.all([
    enrichWalletLight(address),
    getPaymentHistory(address),
    getPortfolio(address),
  ]);

  return NextResponse.json({
    address,
    solenrich: solenrichData ?? {
      unavailable: true,
      reason: "SolEnrich enrichment unavailable — wallet key not configured or service unreachable",
    },
    cardex: {
      paymentHistory,
      portfolio,
    },
    agent: agentMeta(),
  });
}

async function getPaymentHistory(address: string) {
  const result = await db
    .select({
      totalPayments: sql<number>`count(*)::int`,
      totalSpent: sql<string>`coalesce(sum(${paymentEvents.amountUsd}), 0)::text`,
      firstSeen: sql<string>`min(${paymentEvents.createdAt})::text`,
      lastSeen: sql<string>`max(${paymentEvents.createdAt})::text`,
    })
    .from(paymentEvents)
    .where(eq(paymentEvents.payerAddress, address));

  const row = result[0];
  if (!row || row.totalPayments === 0) return null;

  return {
    totalPayments: row.totalPayments,
    totalSpentUsd: row.totalSpent,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
  };
}

async function getPortfolio(address: string) {
  const userPortfolios = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.ownerAddress, address))
    .limit(1);

  if (userPortfolios.length === 0) return null;

  const portfolio = userPortfolios[0];

  const items = await db
    .select({
      cardName: collectibles.name,
      condition: portfolioItems.condition,
      quantity: portfolioItems.quantity,
      costBasis: portfolioItems.costBasis,
      acquiredDate: portfolioItems.acquiredDate,
    })
    .from(portfolioItems)
    .leftJoin(collectibles, eq(portfolioItems.collectibleId, collectibles.id))
    .where(eq(portfolioItems.portfolioId, portfolio.id))
    .orderBy(desc(portfolioItems.acquiredDate))
    .limit(50);

  return {
    name: portfolio.name,
    itemCount: items.length,
    items,
  };
}
