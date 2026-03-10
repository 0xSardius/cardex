/**
 * POST /api/v1/arbitrage — Cross-platform arbitrage scan
 *
 * x402-gated: $0.005 per request (USDC on Solana)
 *
 * Request body:
 *   { game?: "mtg" | "pokemon", minSpreadPct?: number, limit?: number }
 *
 * Returns: cards with significant price differences between sources
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { recordPayment } from "@/lib/x402/payments";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const game = body.game ?? "mtg";
  const minSpreadPct = body.minSpreadPct ?? 15;
  const limit = Math.min(body.limit ?? 20, 50);

  recordPayment("/api/v1/arbitrage", "0.005").catch(() => {});

  // Find cards where USD (TCGPlayer) and EUR (CardMarket) prices diverge
  // This catches US/EU arbitrage — the most actionable signal
  const results: any = await db.execute(sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price, observed_at
      FROM price_points
      WHERE source = 'scryfall_tcgplayer'
        AND condition = 'nm'
        AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_eur AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price, observed_at
      FROM price_points
      WHERE source = 'scryfall_cardmarket'
        AND condition = 'nm'
        AND currency = 'EUR'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT
      c.name,
      c.rarity,
      c.treatment,
      s.name as set_name,
      s.code as set_code,
      c.set_number,
      c.image_url,
      u.price as usd_price,
      e.price as eur_price,
      ROUND(ABS(u.price - e.price), 2) as spread,
      ROUND(ABS(u.price - e.price) / LEAST(u.price, e.price) * 100, 1) as spread_pct,
      CASE WHEN u.price > e.price THEN 'buy_eu_sell_us' ELSE 'buy_us_sell_eu' END as direction
    FROM latest_usd u
    JOIN latest_eur e ON e.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE c.game = ${game}
      AND u.price > 0.50
      AND e.price > 0.50
      AND ABS(u.price - e.price) / LEAST(u.price, e.price) * 100 >= ${minSpreadPct}
    ORDER BY spread_pct DESC
    LIMIT ${limit}
  `);

  const rows = results.rows ?? results;

  return NextResponse.json({
    query: { game, minSpreadPct, limit },
    count: rows.length,
    opportunities: rows.map((r: any) => ({
      card: {
        name: r.name,
        set: r.set_name,
        setCode: r.set_code,
        setNumber: r.set_number,
        rarity: r.rarity,
        treatment: r.treatment,
        imageUrl: r.image_url,
      },
      usdPrice: r.usd_price,
      eurPrice: r.eur_price,
      spread: r.spread,
      spreadPct: r.spread_pct,
      direction: r.direction,
    })),
    agent: {
      name: "CardEx",
      version: "0.1.0",
      solanaAddress: process.env.SOLANA_PAY_TO_ADDRESS ?? null,
    },
  });
}
