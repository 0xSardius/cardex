/**
 * Core composition for /api/v1/wallet-insight. Returns SolEnrich risk
 * payload + CardEx payment history + portfolio for a Solana wallet.
 * Shared between the x402 route handler and the SSR /demo/wallet page.
 */

import { db } from "@/lib/db";
import {
  paymentEvents,
  portfolios,
  portfolioItems,
  collectibles,
} from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { enrichWalletLight } from "@/lib/solenrich/client";

export async function composeWalletInsight(address: string) {
  const [solenrichData, paymentHistory, portfolio] = await Promise.all([
    enrichWalletLight(address),
    getPaymentHistory(address),
    getPortfolio(address),
  ]);

  return {
    address,
    solenrich: solenrichData ?? {
      unavailable: true,
      reason:
        "SolEnrich enrichment unavailable — wallet key not configured or service unreachable",
    },
    cardex: {
      paymentHistory,
      portfolio,
    },
  };
}

export type WalletInsightResult = Awaited<ReturnType<typeof composeWalletInsight>>;

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
