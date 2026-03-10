/**
 * POST /api/v1/set/complete — Set completion advisor
 *
 * x402-gated: $0.008 per request (USDC on Solana)
 *
 * Request body:
 *   { setCode: string, game?: "mtg" | "pokemon", owned?: string[] }
 *
 * Returns: set info, card list with prices, completion stats, estimated cost
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectibles, sets, pricePoints } from "@/lib/db/schema";
import { eq, and, desc, notInArray } from "drizzle-orm";
import { recordPayment } from "@/lib/x402/payments";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.setCode) {
    return NextResponse.json(
      { error: "Missing required field: setCode" },
      { status: 400 }
    );
  }

  const game = body.game ?? "mtg";
  const ownedCards: string[] = body.owned ?? [];

  recordPayment("/api/v1/set/complete", "0.008").catch(() => {});

  // Get the set
  const [set] = await db
    .select()
    .from(sets)
    .where(and(eq(sets.game, game), eq(sets.code, body.setCode.toLowerCase())))
    .limit(1);

  if (!set) {
    return NextResponse.json(
      { error: "Set not found", query: { setCode: body.setCode, game } },
      { status: 404 }
    );
  }

  // Get all cards in the set
  const allCards = await db
    .select({
      id: collectibles.id,
      name: collectibles.name,
      setNumber: collectibles.setNumber,
      rarity: collectibles.rarity,
      treatment: collectibles.treatment,
      foil: collectibles.foil,
      imageUrl: collectibles.imageUrl,
    })
    .from(collectibles)
    .where(eq(collectibles.setId, set.id));

  // Get latest prices for each card
  const cardsWithPrices = await Promise.all(
    allCards.map(async (card) => {
      const [latestPrice] = await db
        .select({
          priceUsd: pricePoints.priceUsd,
          source: pricePoints.source,
        })
        .from(pricePoints)
        .where(eq(pricePoints.collectibleId, card.id))
        .orderBy(desc(pricePoints.observedAt))
        .limit(1);

      const owned = ownedCards.includes(card.setNumber ?? "");

      return {
        name: card.name,
        setNumber: card.setNumber,
        rarity: card.rarity,
        treatment: card.treatment,
        imageUrl: card.imageUrl,
        priceUsd: latestPrice?.priceUsd ?? null,
        source: latestPrice?.source ?? null,
        owned,
      };
    })
  );

  // Calculate stats
  const totalCards = cardsWithPrices.length;
  const ownedCount = cardsWithPrices.filter((c) => c.owned).length;
  const missingCards = cardsWithPrices.filter((c) => !c.owned);
  const missingWithPrices = missingCards.filter((c) => c.priceUsd);
  const estimatedCost = missingWithPrices.reduce(
    (sum, c) => sum + parseFloat(c.priceUsd!),
    0
  );

  return NextResponse.json({
    set: {
      name: set.name,
      code: set.code,
      series: set.series,
      era: set.era,
      totalCards: set.totalCards,
      releaseDate: set.releaseDate,
    },
    completion: {
      total: totalCards,
      owned: ownedCount,
      missing: totalCards - ownedCount,
      pct: totalCards > 0 ? Math.round((ownedCount / totalCards) * 100) : 0,
    },
    estimatedCostToComplete: Math.round(estimatedCost * 100) / 100,
    missingCardsWithPrices: missingWithPrices.length,
    cards: cardsWithPrices.sort((a, b) =>
      (a.setNumber ?? "").localeCompare(b.setNumber ?? "", undefined, { numeric: true })
    ),
    agent: {
      name: "CardEx",
      version: "0.1.0",
      solanaAddress: process.env.SOLANA_PAY_TO_ADDRESS ?? null,
    },
  });
}
