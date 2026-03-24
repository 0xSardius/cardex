"use server";

import { db } from "@/lib/db";
import { collectibles, sets, pricePoints } from "@/lib/db/schema";
import { eq, ilike, desc, and, sql } from "drizzle-orm";

export interface SearchResult {
  id: string;
  name: string;
  setName: string | null;
  setCode: string | null;
  rarity: string | null;
  treatment: string | null;
  foil: boolean | null;
  reserved: boolean | null;
  priceUsd: string | null;
  similarity?: number;
}

export async function searchCards(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim();

  // Try exact match first
  const exact = await db
    .select({
      id: collectibles.id,
      name: collectibles.name,
      setName: sets.name,
      setCode: sets.code,
      rarity: collectibles.rarity,
      treatment: collectibles.treatment,
      foil: collectibles.foil,
      reserved: collectibles.reserved,
    })
    .from(collectibles)
    .leftJoin(sets, eq(collectibles.setId, sets.id))
    .where(and(eq(collectibles.game, "mtg"), ilike(collectibles.name, trimmed)))
    .limit(20);

  if (exact.length > 0) {
    // Get latest USD price for each card
    return Promise.all(
      exact.map(async (card) => {
        const [price] = await db
          .select({ priceUsd: pricePoints.priceUsd })
          .from(pricePoints)
          .where(
            and(
              eq(pricePoints.collectibleId, card.id),
              eq(pricePoints.source, "scryfall_tcgplayer"),
              eq(pricePoints.condition, "nm")
            )
          )
          .orderBy(desc(pricePoints.observedAt))
          .limit(1);

        return { ...card, priceUsd: price?.priceUsd ?? null };
      })
    );
  }

  // Fuzzy fallback
  const fuzzyResults: any = await db.execute(
    sql`SELECT c.id, c.name, c.rarity, c.treatment, c.foil, c.reserved,
               s.name as set_name, s.code as set_code,
               similarity(c.name, ${trimmed}) as sim
        FROM collectibles c
        LEFT JOIN sets s ON c.set_id = s.id
        WHERE c.game = 'mtg' AND c.name % ${trimmed}
        ORDER BY sim DESC
        LIMIT 20`
  );

  const rows = fuzzyResults.rows ?? fuzzyResults;

  return Promise.all(
    rows.map(async (row: any) => {
      const [price] = await db
        .select({ priceUsd: pricePoints.priceUsd })
        .from(pricePoints)
        .where(
          and(
            eq(pricePoints.collectibleId, row.id),
            eq(pricePoints.source, "scryfall_tcgplayer"),
            eq(pricePoints.condition, "nm")
          )
        )
        .orderBy(desc(pricePoints.observedAt))
        .limit(1);

      return {
        id: row.id,
        name: row.name,
        setName: row.set_name,
        setCode: row.set_code,
        rarity: row.rarity,
        treatment: row.treatment,
        foil: row.foil,
        reserved: row.reserved,
        priceUsd: price?.priceUsd ?? null,
        similarity: row.sim,
      };
    })
  );
}
