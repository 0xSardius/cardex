/**
 * POST /api/v1/mtgo-spread — MTGO-to-paper price spread detection
 *
 * x402-gated: $0.005 per request (USDC on Solana)
 *
 * Request body:
 *   {
 *     direction?: "mtgo_high" | "paper_high" | "both", // default: "both"
 *     minRatio?: number,    // minimum tix/usd or usd/tix ratio (default: 3)
 *     minPaperUsd?: number, // minimum paper price to filter noise (default: 1)
 *     minTix?: number,      // minimum tix price to filter noise (default: 0.1)
 *     limit?: number,       // max results (default: 20, max: 50)
 *   }
 *
 * Returns: cards where MTGO (tix) and paper (USD) prices diverge significantly.
 * MTGO prices are a leading indicator — spikes in tix often precede paper price increases.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { recordPayment } from "@/lib/x402/payments";
import { agentMetaSync } from "@/lib/agent-meta";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const direction = body.direction ?? "both";
  const minRatio = body.minRatio ?? 3;
  const minPaperUsd = body.minPaperUsd ?? 1;
  const minTix = body.minTix ?? 0.1;
  const limit = Math.min(body.limit ?? 20, 50);

  recordPayment("/api/v1/mtgo-spread", "0.005").catch(() => {});

  // MTGO-high: tix price is disproportionately high relative to paper
  // This signals MTGO demand — paper may follow
  const mtgoHighResults: any = (direction === "paper_high") ? { rows: [] } : await db.execute(sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT
      c.name, c.rarity, c.treatment, c.reserved,
      c.legalities,
      s.name as set_name, s.code as set_code, c.set_number,
      u.price as paper_usd,
      t.tix as mtgo_tix,
      ROUND(t.tix / u.price, 2) as tix_per_usd,
      'mtgo_high' as signal
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'mtg'
      AND u.price >= ${minPaperUsd}
      AND t.tix >= ${minTix}
      AND t.tix / u.price >= ${minRatio}
    ORDER BY t.tix / u.price DESC
    LIMIT ${limit}
  `);

  // Paper-high: paper price is disproportionately high relative to MTGO
  // This could signal paper-only demand (Commander staples, Reserved List, etc.)
  const paperHighResults: any = (direction === "mtgo_high") ? { rows: [] } : await db.execute(sql`
    WITH latest_usd AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as price
      FROM price_points
      WHERE source = 'scryfall_tcgplayer' AND condition = 'nm' AND currency = 'USD'
      ORDER BY collectible_id, observed_at DESC
    ),
    latest_tix AS (
      SELECT DISTINCT ON (collectible_id)
        collectible_id, price_usd::numeric as tix
      FROM price_points
      WHERE source = 'scryfall_mtgo' AND condition = 'digital'
      ORDER BY collectible_id, observed_at DESC
    )
    SELECT
      c.name, c.rarity, c.treatment, c.reserved,
      c.legalities,
      s.name as set_name, s.code as set_code, c.set_number,
      u.price as paper_usd,
      t.tix as mtgo_tix,
      ROUND(u.price / t.tix, 2) as usd_per_tix,
      'paper_high' as signal
    FROM latest_usd u
    JOIN latest_tix t ON t.collectible_id = u.collectible_id
    JOIN collectibles c ON c.id = u.collectible_id
    LEFT JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'mtg'
      AND u.price >= ${minPaperUsd}
      AND t.tix >= ${minTix}
      AND u.price / t.tix >= ${minRatio}
    ORDER BY u.price / t.tix DESC
    LIMIT ${limit}
  `);

  const mtgoHigh = (mtgoHighResults.rows ?? mtgoHighResults).map((r: any) => ({
    card: {
      name: r.name,
      set: r.set_name,
      setCode: r.set_code,
      setNumber: r.set_number,
      rarity: r.rarity,
      treatment: r.treatment,
      reserved: r.reserved,
      legalities: r.legalities,
    },
    paperUsd: r.paper_usd,
    mtgoTix: r.mtgo_tix,
    ratio: r.tix_per_usd,
    signal: "mtgo_high",
    insight: "MTGO price is elevated relative to paper — paper may follow upward",
  }));

  const paperHigh = (paperHighResults.rows ?? paperHighResults).map((r: any) => ({
    card: {
      name: r.name,
      set: r.set_name,
      setCode: r.set_code,
      setNumber: r.set_number,
      rarity: r.rarity,
      treatment: r.treatment,
      reserved: r.reserved,
      legalities: r.legalities,
    },
    paperUsd: r.paper_usd,
    mtgoTix: r.mtgo_tix,
    ratio: r.usd_per_tix,
    signal: "paper_high",
    insight: "Paper price is elevated relative to MTGO — likely Commander/collector demand or Reserved List premium",
  }));

  return NextResponse.json({
    query: { direction, minRatio, minPaperUsd, minTix, limit },
    mtgoHigh: {
      count: mtgoHigh.length,
      description: "Cards where MTGO tix price is high relative to paper — leading indicator for paper price increase",
      results: mtgoHigh,
    },
    paperHigh: {
      count: paperHigh.length,
      description: "Cards where paper price is high relative to MTGO — Commander/collector/Reserved List demand",
      results: paperHigh,
    },
    agent: agentMetaSync(),
  });
}
