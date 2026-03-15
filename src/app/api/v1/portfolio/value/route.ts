/**
 * POST /api/v1/portfolio/value — Portfolio valuation
 *
 * x402-gated: $0.002 per card (USDC on Solana)
 *
 * Request body:
 *   {
 *     cards: [{ name: string, game?: "mtg" | "pokemon", set?: string, condition?: string, quantity?: number }],
 *   }
 *
 * Returns: per-card valuations + portfolio totals
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectibles, sets, pricePoints, marketSnapshots } from "@/lib/db/schema";
import { eq, ilike, desc, and, sql } from "drizzle-orm";
import { recordPayment } from "@/lib/x402/payments";

interface PortfolioCard {
  name: string;
  game?: "mtg" | "pokemon";
  set?: string;
  condition?: string;
  quantity?: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.cards || !Array.isArray(body.cards) || body.cards.length === 0) {
    return NextResponse.json(
      { error: "Missing required field: cards (non-empty array)" },
      { status: 400 }
    );
  }

  if (body.cards.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 cards per request" },
      { status: 400 }
    );
  }

  const cards: PortfolioCard[] = body.cards;

  recordPayment("/api/v1/portfolio/value", String(0.002 * cards.length)).catch(() => {});

  const valuations = await Promise.all(
    cards.map(async (card) => {
      const game = card.game ?? "mtg";
      const quantity = card.quantity ?? 1;

      // Find the card — exact match first
      const conditions = [
        eq(collectibles.game, game),
        ilike(collectibles.name, card.name),
      ];

      if (card.set) {
        const setResult = await db
          .select({ id: sets.id })
          .from(sets)
          .where(and(eq(sets.game, game), eq(sets.code, card.set.toLowerCase())))
          .limit(1);

        if (setResult.length > 0) {
          conditions.push(eq(collectibles.setId, setResult[0].id));
        }
      }

      const [match] = await db
        .select({
          id: collectibles.id,
          name: collectibles.name,
          game: collectibles.game,
          setNumber: collectibles.setNumber,
          rarity: collectibles.rarity,
          treatment: collectibles.treatment,
          foil: collectibles.foil,
          setName: sets.name,
          setCode: sets.code,
        })
        .from(collectibles)
        .leftJoin(sets, eq(collectibles.setId, sets.id))
        .where(and(...conditions))
        .limit(1);

      if (!match) {
        // Try fuzzy
        const fuzzy: any = await db.execute(
          sql`SELECT c.id, c.name, c.set_number, c.rarity, c.treatment, c.foil,
                     s.name as set_name, s.code as set_code,
                     similarity(c.name, ${card.name}) as sim
              FROM collectibles c
              LEFT JOIN sets s ON c.set_id = s.id
              WHERE c.game = ${game} AND c.name % ${card.name}
              ORDER BY sim DESC
              LIMIT 1`
        );
        const fuzzyRows = fuzzy.rows ?? fuzzy;
        if (fuzzyRows.length === 0) {
          return {
            input: { name: card.name, game, set: card.set, condition: card.condition, quantity },
            found: false,
            error: "Card not found",
          };
        }
        const row = fuzzyRows[0];
        return await buildValuation(row.id, {
          name: row.name,
          game,
          set: row.set_name,
          setCode: row.set_code,
          setNumber: row.set_number,
          rarity: row.rarity,
          treatment: row.treatment,
          foil: row.foil,
        }, card, quantity, true, row.sim);
      }

      return await buildValuation(match.id, {
        name: match.name,
        game: match.game,
        set: match.setName,
        setCode: match.setCode,
        setNumber: match.setNumber,
        rarity: match.rarity,
        treatment: match.treatment,
        foil: match.foil,
      }, card, quantity, false, null);
    })
  );

  // Aggregate totals
  const found = valuations.filter((v) => v.found !== false);
  const totalValue = found.reduce((sum, v: any) => sum + (v.totalValue ?? 0), 0);
  const totalCostBasis = found.reduce((sum, v: any) => sum + (v.costBasis ?? 0), 0);

  return NextResponse.json({
    portfolio: {
      totalCards: cards.reduce((sum, c) => sum + (c.quantity ?? 1), 0),
      resolvedCards: found.length,
      unresolvedCards: valuations.length - found.length,
      totalValue: Math.round(totalValue * 100) / 100,
      totalCostBasis: totalCostBasis > 0 ? Math.round(totalCostBasis * 100) / 100 : null,
      gainLoss: totalCostBasis > 0 ? Math.round((totalValue - totalCostBasis) * 100) / 100 : null,
      gainLossPct: totalCostBasis > 0 ? Math.round(((totalValue - totalCostBasis) / totalCostBasis) * 10000) / 100 : null,
    },
    valuations,
    agent: {
      name: "CardEx",
      version: "0.1.0",
      solanaAddress: process.env.SOLANA_PAY_TO_ADDRESS ?? null,
    },
  });
}

async function buildValuation(
  collectibleId: string,
  card: any,
  input: PortfolioCard,
  quantity: number,
  fuzzy: boolean,
  similarity: number | null,
) {
  // Get latest price
  const [latestPrice] = await db
    .select({
      priceUsd: pricePoints.priceUsd,
      source: pricePoints.source,
      condition: pricePoints.condition,
      observedAt: pricePoints.observedAt,
    })
    .from(pricePoints)
    .where(eq(pricePoints.collectibleId, collectibleId))
    .orderBy(desc(pricePoints.observedAt))
    .limit(1);

  // Get market snapshot for trend data
  const [snapshot] = await db
    .select({
      avgPrice: marketSnapshots.avgPrice,
      trend7d: marketSnapshots.trend7d,
      trend30d: marketSnapshots.trend30d,
    })
    .from(marketSnapshots)
    .where(eq(marketSnapshots.collectibleId, collectibleId))
    .orderBy(desc(marketSnapshots.date))
    .limit(1);

  const unitPrice = latestPrice ? parseFloat(latestPrice.priceUsd) : null;
  const totalValue = unitPrice ? unitPrice * quantity : null;

  return {
    input: { name: input.name, game: input.game ?? "mtg", set: input.set, condition: input.condition, quantity },
    found: true,
    fuzzyMatch: fuzzy,
    ...(similarity !== null ? { similarity } : {}),
    card: {
      name: card.name,
      set: card.set,
      setCode: card.setCode,
      setNumber: card.setNumber,
      rarity: card.rarity,
      treatment: card.treatment,
      foil: card.foil,
    },
    price: latestPrice ? {
      unitPrice: unitPrice,
      source: latestPrice.source,
      condition: latestPrice.condition,
      observedAt: latestPrice.observedAt,
    } : null,
    market: snapshot ? {
      avgPrice: snapshot.avgPrice ? parseFloat(snapshot.avgPrice) : null,
      trend7d: snapshot.trend7d,
      trend30d: snapshot.trend30d,
    } : null,
    quantity,
    totalValue,
    costBasis: null, // No portfolio storage yet — future feature
  };
}
