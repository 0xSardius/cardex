/**
 * POST /api/v1/price — Single card price lookup
 *
 * x402-gated: $0.001 per request (USDC on Solana)
 *
 * Request body:
 *   { name: string, game?: "mtg" | "pokemon", set?: string }
 *
 * Returns: card metadata + latest price data from all sources
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectibles, sets, pricePoints, marketSnapshots } from "@/lib/db/schema";
import { eq, ilike, desc, and, sql } from "drizzle-orm";
import { agentMetaSync as agentMeta } from "@/lib/agent-meta";
import { recordPayment } from "@/lib/x402/payments";

interface PriceRequest {
  name: string;
  game?: "mtg" | "pokemon";
  set?: string;
}

export async function POST(request: NextRequest) {
  const body: PriceRequest = await request.json();

  if (!body.name) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 }
    );
  }

  const game = body.game ?? "mtg";

  // Record payment (x402 proxy already verified payment before we get here)
  recordPayment("/api/v1/price", "0.001").catch(() => {});

  // Build query conditions
  const conditions = [
    eq(collectibles.game, game),
    ilike(collectibles.name, body.name),
  ];

  // If set code provided, filter by it
  if (body.set) {
    const setResult = await db
      .select({ id: sets.id })
      .from(sets)
      .where(and(eq(sets.game, game), eq(sets.code, body.set.toLowerCase())))
      .limit(1);

    if (setResult.length > 0) {
      conditions.push(eq(collectibles.setId, setResult[0].id));
    }
  }

  // Find matching cards
  const cards = await db
    .select({
      id: collectibles.id,
      name: collectibles.name,
      game: collectibles.game,
      setNumber: collectibles.setNumber,
      rarity: collectibles.rarity,
      cardType: collectibles.cardType,
      treatment: collectibles.treatment,
      foil: collectibles.foil,
      imageUrl: collectibles.imageUrl,
      externalId: collectibles.externalId,
      tcgplayerId: collectibles.tcgplayerId,
      setName: sets.name,
      setCode: sets.code,
      setEra: sets.era,
    })
    .from(collectibles)
    .leftJoin(sets, eq(collectibles.setId, sets.id))
    .where(and(...conditions))
    .limit(10);

  if (cards.length === 0) {
    // Try fuzzy search as fallback
    const fuzzyResults: any = await db.execute(
      sql`SELECT c.id, c.name, c.set_number, c.rarity, c.treatment, c.foil, c.image_url,
                 c.external_id, c.tcgplayer_id, s.name as set_name, s.code as set_code, s.era as set_era,
                 similarity(c.name, ${body.name}) as sim
          FROM collectibles c
          LEFT JOIN sets s ON c.set_id = s.id
          WHERE c.game = ${game} AND c.name % ${body.name}
          ORDER BY sim DESC
          LIMIT 10`
    );

    const fuzzyRows = fuzzyResults.rows ?? fuzzyResults;
    if (fuzzyRows.length === 0) {
      return NextResponse.json(
        { error: "Card not found", query: { name: body.name, game } },
        { status: 404 }
      );
    }

    // Enrich fuzzy results with prices
    const enriched = await Promise.all(
      fuzzyRows.map(async (row: any) => {
        const prices = await db
          .select()
          .from(pricePoints)
          .where(eq(pricePoints.collectibleId, row.id))
          .orderBy(desc(pricePoints.observedAt))
          .limit(5);

        return {
          ...formatCardResult(row),
          prices: prices.map((p) => ({
            source: p.source,
            condition: p.condition,
            priceUsd: p.priceUsd,
            currency: p.currency,
            listingType: p.listingType,
            observedAt: p.observedAt,
          })),
        };
      })
    );

    return NextResponse.json({
      exact: false,
      query: { name: body.name, game, set: body.set },
      results: enriched,
      agent: agentMeta(),
    });
  }

  // Get latest prices and market snapshot for each card
  const results = await Promise.all(
    cards.map(async (card) => {
      const [prices, snapshot] = await Promise.all([
        db
          .select()
          .from(pricePoints)
          .where(eq(pricePoints.collectibleId, card.id))
          .orderBy(desc(pricePoints.observedAt))
          .limit(10),
        db
          .select()
          .from(marketSnapshots)
          .where(eq(marketSnapshots.collectibleId, card.id))
          .orderBy(desc(marketSnapshots.date))
          .limit(1),
      ]);

      return {
        card: {
          name: card.name,
          game: card.game,
          set: card.setName,
          setCode: card.setCode,
          setNumber: card.setNumber,
          era: card.setEra,
          rarity: card.rarity,
          cardType: card.cardType,
          treatment: card.treatment,
          foil: card.foil,
          imageUrl: card.imageUrl,
          externalId: card.externalId,
          tcgplayerId: card.tcgplayerId,
        },
        prices: prices.map((p) => ({
          source: p.source,
          condition: p.condition,
          priceUsd: p.priceUsd,
          currency: p.currency,
          listingType: p.listingType,
          observedAt: p.observedAt,
        })),
        market: snapshot[0]
          ? {
              date: snapshot[0].date,
              avgPrice: snapshot[0].avgPrice,
              medianPrice: snapshot[0].medianPrice,
              lowPrice: snapshot[0].lowPrice,
              highPrice: snapshot[0].highPrice,
              trend7d: snapshot[0].trend7d,
              trend30d: snapshot[0].trend30d,
            }
          : null,
      };
    })
  );

  return NextResponse.json({
    exact: true,
    query: { name: body.name, game, set: body.set },
    results,
    agent: agentMeta(),
  });
}

function formatCardResult(row: any) {
  return {
    card: {
      name: row.name,
      set: row.set_name,
      setCode: row.set_code,
      setNumber: row.set_number,
      era: row.set_era,
      rarity: row.rarity,
      treatment: row.treatment,
      foil: row.foil,
      imageUrl: row.image_url,
      externalId: row.external_id,
      tcgplayerId: row.tcgplayer_id,
    },
    similarity: row.sim,
    prices: []
  };
}

