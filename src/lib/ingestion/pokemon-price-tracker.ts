/**
 * Pokemon Price Tracker — graded card price ingestion.
 *
 * Closes the graded-vs-raw baseline gap from Phase 8 Step 3 smoke: most
 * Collector Crypt listings are PSA/CGC/BGS graded, but until this adapter
 * lands our paper baseline is TCGPlayer/CardMarket raw — which gives the
 * false 1780% phantom spread we saw on PSA 8 Raichu.
 *
 * API: pokemonpricetracker.com, /api/psa/pricing/{cardId}
 *   - cardId is pokemontcg.io's {setCode}-{cardNumber} (e.g. "base1-4")
 *     — matches our `collectibles.external_id` column exactly.
 *   - Response includes per-grade { market_price, last_sold } for psa_1..psa_10
 *   - Data source: eBay completed listings (real sales, not asks)
 *
 * Tiers / quota:
 *   - Free (no commercial use): 100 credits/day, 60 req/min — dev only
 *   - API ($9.99/mo, no commercial use): 20K credits/day — useless for us
 *   - Business ($99/mo, commercial use OK): 200K credits/day — required
 *     before mainnet flip.
 *
 * Free-tier prioritization: refresh cards that have active CC listings
 * first (that's where graded prices unlock arbitrage signal). Fall back
 * to high-recent-paper-price cards if listings count is low.
 *
 * Usage:
 *   npx tsx src/lib/ingestion/pokemon-price-tracker.ts [maxCards]
 *
 * Env:
 *   POKEMON_PRICE_TRACKER_API_KEY — required
 *   DATABASE_URL                  — required
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const PPT_BASE = "https://www.pokemonpricetracker.com/api";
const FREE_TIER_BUDGET = 80; // leave 20 credits headroom under the 100/day cap
const REQ_DELAY_MS = 1100;   // ≤60 req/min — 1.1s pad keeps us under the cap

interface PptPsaPricingResponse {
  card_id?: string;
  name?: string;
  psa_pricing?: Record<
    `psa_${number}`,
    { market_price?: number | null; last_sold?: number | null } | undefined
  >;
  updated_at?: string;
}

interface PriceRow {
  collectibleId: string;
  source: string;
  condition: string;
  priceUsd: string;
  listingType: string;
  confidence: number;
}

export interface IngestStats {
  cards_attempted: number;
  cards_with_data: number;
  cards_404: number;
  cards_errored: number;
  price_points_inserted: number;
  credits_used: number;
}

export async function ingestPokemonPriceTrackerPsa(opts: {
  maxCards?: number;
  apiKey?: string;
  databaseUrl?: string;
  /** Optional verbose logger. */
  log?: (msg: string) => void;
}): Promise<IngestStats> {
  const apiKey = opts.apiKey ?? process.env.POKEMON_PRICE_TRACKER_API_KEY;
  if (!apiKey) {
    throw new Error("POKEMON_PRICE_TRACKER_API_KEY is required");
  }
  const dbUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  const log = opts.log ?? (() => {});
  const maxCards = Math.min(opts.maxCards ?? FREE_TIER_BUDGET, FREE_TIER_BUDGET * 100);
  const sql = neon(dbUrl);

  // Prioritize cards with active CC listings — that's where graded paper
  // prices unlock arbitrage. Fall back to high-paper-price cards in the
  // same set so the daily run isn't wasted when listings are sparse.
  const targets = (await sql`
    WITH listed AS (
      SELECT DISTINCT mcm.collectible_id, 0 AS tier
      FROM mint_card_map mcm
      JOIN listings l ON l.mint_address = mcm.mint_address
      WHERE l.expired_at IS NULL
        AND mcm.collectible_id IS NOT NULL
    ),
    high_value AS (
      SELECT pp.collectible_id, 1 AS tier
      FROM price_points pp
      WHERE pp.source LIKE 'pokemontcg_%'
        AND pp.observed_at > NOW() - INTERVAL '7 days'
      GROUP BY pp.collectible_id
      HAVING MAX(pp.price_usd::numeric) >= 20
    ),
    union_all AS (
      SELECT collectible_id, tier FROM listed
      UNION
      SELECT collectible_id, tier FROM high_value
    )
    SELECT c.id, c.external_id, c.name, MIN(u.tier) AS tier
    FROM union_all u
    JOIN collectibles c ON c.id = u.collectible_id
    WHERE c.game = 'pokemon' AND c.external_id IS NOT NULL
    GROUP BY c.id, c.external_id, c.name
    ORDER BY MIN(u.tier) ASC, c.name ASC
    LIMIT ${maxCards}
  `) as Array<{ id: string; external_id: string; name: string; tier: number }>;

  log(`Pokemon Price Tracker PSA ingestion — ${targets.length} cards (cap ${maxCards})`);
  const tierCounts = targets.reduce<Record<number, number>>((acc, t) => {
    acc[t.tier] = (acc[t.tier] ?? 0) + 1;
    return acc;
  }, {});
  log(`  Tier 0 (active listings): ${tierCounts[0] ?? 0}`);
  log(`  Tier 1 (high-value fallback): ${tierCounts[1] ?? 0}`);

  const stats: IngestStats = {
    cards_attempted: 0,
    cards_with_data: 0,
    cards_404: 0,
    cards_errored: 0,
    price_points_inserted: 0,
    credits_used: 0,
  };

  for (const target of targets) {
    stats.cards_attempted++;
    try {
      const data = await fetchPsaPricing(target.external_id, apiKey);
      stats.credits_used++;

      if (!data) {
        stats.cards_404++;
        log(`  [${stats.cards_attempted}/${targets.length}] ${target.name} (${target.external_id}) — no data`);
      } else if (data.psa_pricing) {
        const rows = buildPriceRows(target.id, data);
        if (rows.length > 0) {
          await insertBatch(sql, rows);
          stats.cards_with_data++;
          stats.price_points_inserted += rows.length;
          log(`  [${stats.cards_attempted}/${targets.length}] ${target.name} (${target.external_id}) — ${rows.length} grades`);
        } else {
          stats.cards_404++;
          log(`  [${stats.cards_attempted}/${targets.length}] ${target.name} (${target.external_id}) — empty psa_pricing`);
        }
      }
    } catch (err) {
      stats.cards_errored++;
      log(`  [${stats.cards_attempted}/${targets.length}] ${target.name} — ERROR ${(err as Error).message}`);
    }

    if (stats.cards_attempted < targets.length) {
      await sleep(REQ_DELAY_MS);
    }
  }

  return stats;
}

async function fetchPsaPricing(
  cardId: string,
  apiKey: string
): Promise<PptPsaPricingResponse | null> {
  const url = `${PPT_BASE}/psa/pricing/${cardId}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
    },
  });
  if (res.status === 404) return null;
  if (res.status === 429) {
    // Soft back-off — caller retries next run; don't burn credits in a tight loop.
    throw new Error(`rate-limited (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as PptPsaPricingResponse;
}

function buildPriceRows(
  collectibleId: string,
  data: PptPsaPricingResponse
): PriceRow[] {
  const rows: PriceRow[] = [];
  const pricing = data.psa_pricing ?? {};
  for (const [key, grade] of Object.entries(pricing)) {
    if (!grade) continue;
    const match = key.match(/^psa_(\d+)$/);
    if (!match) continue;
    const n = parseInt(match[1], 10);
    if (n < 1 || n > 10) continue;
    const condition = `psa-${n}`;

    // Prefer last_sold (real sale price); fall back to market_price (their
    // computed market estimate).
    const price = grade.last_sold ?? grade.market_price;
    if (price == null || price <= 0) continue;

    rows.push({
      collectibleId,
      source: "pokemonpricetracker_psa",
      condition,
      priceUsd: price.toFixed(2),
      listingType: grade.last_sold != null ? "sold" : "active",
      confidence: grade.last_sold != null ? 0.95 : 0.85,
    });
  }
  return rows;
}

async function insertBatch(
  // Wider than ReturnType<typeof neon> on purpose — matches the convention
  // in src/lib/ingestion/pokemontcg-prices.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: any,
  rows: PriceRow[]
): Promise<void> {
  await Promise.all(
    rows.map(
      (r) =>
        sql`INSERT INTO price_points (collectible_id, source, condition, price_usd, currency, listing_type, confidence)
            VALUES (${r.collectibleId}::uuid, ${r.source}, ${r.condition}, ${r.priceUsd}, 'USD', ${r.listingType}, ${r.confidence})`
    )
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

if (require.main === module) {
  const maxCards = parseInt(process.argv[2] ?? `${FREE_TIER_BUDGET}`);
  ingestPokemonPriceTrackerPsa({ maxCards, log: console.log })
    .then((stats) => {
      console.log("\nDone:", stats);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Pokemon Price Tracker PSA ingestion failed:", err);
      process.exit(1);
    });
}
