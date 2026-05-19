import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  real,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- Enums as string unions (Drizzle pgEnum is optional, varchar works fine) ---

// game: "pokemon" | "mtg" (extensible)
// rarity: "common" | "uncommon" | "rare" | "holo_rare" | "ultra_rare" | "secret_rare" | "promo" | etc.
// era (pokemon): "wotc" | "ex" | "dp" | "bw" | "xy" | "sm" | "swsh" | "sv"
// era (mtg): "alpha" | "beta" | "revised" | "modern" | "pioneer" | etc.
// source: "tcgplayer" | "ebay" | "cardmarket" | "mercari_jp" | "card_kingdom" | "mtgo" | "pokemontcg_io"
// condition: "raw" | "nm" | "lp" | "mp" | "hp" | "dmg" | "psa10" | "psa9" | ... | "bgs10" | ...
// listing_type: "sold" | "active" | "bid" | "buylist"

// ─── Sets ───────────────────────────────────────────────────────────────────────

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    game: varchar("game", { length: 20 }).notNull(), // "pokemon" | "mtg"
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    series: varchar("series", { length: 255 }),
    era: varchar("era", { length: 50 }),
    totalCards: integer("total_cards"),
    releaseDate: date("release_date"),
    logoUrl: text("logo_url"),
    externalId: varchar("external_id", { length: 100 }), // pokemontcg.io id, scryfall id
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sets_game_code_idx").on(t.game, t.code),
    index("sets_game_idx").on(t.game),
  ]
);

// ─── Collectibles (Cards) ───────────────────────────────────────────────────────

export const collectibles = pgTable(
  "collectibles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    game: varchar("game", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    setId: uuid("set_id").references(() => sets.id),
    setNumber: varchar("set_number", { length: 20 }),
    rarity: varchar("rarity", { length: 50 }),
    cardType: varchar("card_type", { length: 50 }), // pokemon: pokemon|trainer|energy; mtg: creature|instant|sorcery|...
    era: varchar("era", { length: 50 }),
    language: varchar("language", { length: 5 }).notNull().default("en"),
    imageUrl: text("image_url"),
    // Pokemon-specific
    firstEdition: boolean("first_edition").default(false),
    shadowless: boolean("shadowless").default(false),
    // MTG-specific (printing/treatment)
    treatment: varchar("treatment", { length: 50 }), // "regular" | "foil" | "extended_art" | "borderless" | "showcase" | "etched" | "surge" | "galaxy" | "textured"
    foil: boolean("foil").default(false),
    reserved: boolean("reserved").default(false), // MTG Reserved List — supply-constrained, never reprinted
    legalities: jsonb("legalities"), // MTG format legalities: { standard: "legal"|"not_legal"|"banned"|"restricted", ... }
    // External IDs
    externalId: varchar("external_id", { length: 100 }), // pokemontcg.io id, scryfall id
    tcgplayerId: varchar("tcgplayer_id", { length: 50 }),
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("collectibles_game_idx").on(t.game),
    index("collectibles_set_id_idx").on(t.setId),
    index("collectibles_name_idx").on(t.name),
    uniqueIndex("collectibles_external_id_idx").on(t.game, t.externalId),
    // pg_trgm index for fuzzy search — created in raw migration
  ]
);

// ─── Price Points (immutable observations) ──────────────────────────────────────

export const pricePoints = pgTable(
  "price_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectibleId: uuid("collectible_id")
      .notNull()
      .references(() => collectibles.id),
    source: varchar("source", { length: 50 }).notNull(),
    condition: varchar("condition", { length: 20 }).notNull().default("raw"),
    priceUsd: decimal("price_usd", { precision: 12, scale: 2 }).notNull(),
    priceNative: decimal("price_native", { precision: 12, scale: 2 }),
    currency: varchar("currency", { length: 5 }).default("USD"),
    listingType: varchar("listing_type", { length: 20 }).notNull().default("active"),
    quantity: integer("quantity").default(1),
    listingUrl: text("listing_url"),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confidence: real("confidence").default(1.0),
  },
  (t) => [
    index("price_points_collectible_idx").on(t.collectibleId),
    index("price_points_observed_at_idx").on(t.observedAt),
    index("price_points_source_idx").on(t.source),
  ]
);

// ─── Market Snapshots (daily aggregation) ───────────────────────────────────────

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectibleId: uuid("collectible_id")
      .notNull()
      .references(() => collectibles.id),
    condition: varchar("condition", { length: 20 }).notNull().default("raw"),
    date: date("date").notNull(),
    avgPrice: decimal("avg_price", { precision: 12, scale: 2 }),
    medianPrice: decimal("median_price", { precision: 12, scale: 2 }),
    lowPrice: decimal("low_price", { precision: 12, scale: 2 }),
    highPrice: decimal("high_price", { precision: 12, scale: 2 }),
    volume: integer("volume").default(0),
    spreadPct: real("spread_pct"),
    sourcesCount: integer("sources_count").default(0),
    trend7d: real("trend_7d"),
    trend30d: real("trend_30d"),
    trend90d: real("trend_90d"),
  },
  (t) => [
    uniqueIndex("market_snapshots_unique_idx").on(
      t.collectibleId,
      t.condition,
      t.date
    ),
    index("market_snapshots_date_idx").on(t.date),
  ]
);

// ─── Arbitrage Opportunities ────────────────────────────────────────────────────

export const arbitrageOpportunities = pgTable(
  "arbitrage_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectibleId: uuid("collectible_id")
      .notNull()
      .references(() => collectibles.id),
    condition: varchar("condition", { length: 20 }).notNull().default("raw"),
    buySource: varchar("buy_source", { length: 50 }).notNull(),
    buyPrice: decimal("buy_price", { precision: 12, scale: 2 }).notNull(),
    buyUrl: text("buy_url"),
    sellSource: varchar("sell_source", { length: 50 }).notNull(),
    sellPrice: decimal("sell_price", { precision: 12, scale: 2 }).notNull(),
    spreadUsd: decimal("spread_usd", { precision: 12, scale: 2 }).notNull(),
    spreadPct: real("spread_pct").notNull(),
    estimatedFees: decimal("estimated_fees", { precision: 12, scale: 2 }),
    netProfitEst: decimal("net_profit_est", { precision: 12, scale: 2 }),
    confidence: real("confidence").default(0.5),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    ttlMinutes: integer("ttl_minutes").default(60),
  },
  (t) => [
    index("arbitrage_collectible_idx").on(t.collectibleId),
    index("arbitrage_status_idx").on(t.status),
    index("arbitrage_detected_at_idx").on(t.detectedAt),
  ]
);

// ─── Grading Estimates ──────────────────────────────────────────────────────────

export const gradingEstimates = pgTable("grading_estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectibleId: uuid("collectible_id").references(() => collectibles.id),
  imageHash: varchar("image_hash", { length: 64 }),
  estimatedGrade: decimal("estimated_grade", { precision: 3, scale: 1 }),
  gradeProbs: jsonb("grade_probs"), // { "psa10": 0.15, "psa9": 0.55, ... }
  rawValue: decimal("raw_value", { precision: 12, scale: 2 }),
  gradedEv: decimal("graded_ev", { precision: 12, scale: 2 }),
  gradingCost: decimal("grading_cost", { precision: 8, scale: 2 }),
  roiEstimate: real("roi_estimate"),
  recommendation: varchar("recommendation", { length: 20 }), // "grade" | "hold" | "sell_raw"
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Portfolios ─────────────────────────────────────────────────────────────────

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerAddress: varchar("owner_address", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id),
    collectibleId: uuid("collectible_id")
      .notNull()
      .references(() => collectibles.id),
    condition: varchar("condition", { length: 20 }).default("raw"),
    quantity: integer("quantity").notNull().default(1),
    costBasis: decimal("cost_basis", { precision: 12, scale: 2 }),
    acquiredDate: date("acquired_date"),
    notes: text("notes"),
  },
  (t) => [index("portfolio_items_portfolio_idx").on(t.portfolioId)]
);

// ─── Listings (onchain marketplace state — Phase 8) ──────────────────────────
//
// Append-only observations of active onchain listings on Solana marketplaces.
// Each row is a point-in-time snapshot of what was visible on a marketplace
// for a given mint. `expired_at` is set when the listing is no longer seen.

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 30 }).notNull(), // "magic-eden" | "collector-crypt" | "phygitals"
    chain: varchar("chain", { length: 20 }).notNull().default("solana"),
    mintAddress: varchar("mint_address", { length: 64 }).notNull(),
    seller: varchar("seller", { length: 64 }),
    priceUsd: decimal("price_usd", { precision: 14, scale: 4 }), // ME-computed USD equivalent at observation time
    priceUsdc: decimal("price_usdc", { precision: 14, scale: 4 }), // null unless splPrice.symbol == "USDC"
    priceSol: decimal("price_sol", { precision: 14, scale: 6 }), // null unless solPrice present
    marketplace: varchar("marketplace", { length: 30 }), // listingSource from ME: "M2" | "MMM" | etc
    pdaAddress: varchar("pda_address", { length: 64 }),
    listingUrl: text("listing_url"),
    listedAt: timestamp("listed_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    collectibleId: uuid("collectible_id").references(() => collectibles.id),
    raw: jsonb("raw"),
  },
  (t) => [
    index("listings_mint_idx").on(t.mintAddress),
    index("listings_source_idx").on(t.source),
    index("listings_observed_at_idx").on(t.observedAt),
    index("listings_expired_at_idx").on(t.expiredAt),
    index("listings_collectible_idx").on(t.collectibleId),
    // Active listings query covered by partial expression elsewhere if needed
  ]
);

// ─── Mint → Collectible Map (Phase 8) ─────────────────────────────────────────
//
// Cache of mint→identity lookups. Physical card identity is immutable in the
// vault, so we resolve each mint at most once and reuse forever.
// `collectible_id` is nullable for mints we couldn't match (unknown set, etc).

export const mintCardMap = pgTable(
  "mint_card_map",
  {
    mintAddress: varchar("mint_address", { length: 64 }).primaryKey(),
    chain: varchar("chain", { length: 20 }).notNull().default("solana"),
    platform: varchar("platform", { length: 30 }).notNull(), // "collector-crypt" | "phygitals"
    category: varchar("category", { length: 30 }), // "Pokemon" | "Basketball" | "Moonbirds" | etc — null if unparsed
    collectibleId: uuid("collectible_id").references(() => collectibles.id),
    cardName: varchar("card_name", { length: 255 }),
    setCode: varchar("set_code", { length: 30 }),
    cardNumber: varchar("card_number", { length: 20 }),
    grader: varchar("grader", { length: 30 }), // "PSA" | "CGC" | "BGS" | "SGC" | longer custom labels | null (raw)
    grade: decimal("grade", { precision: 3, scale: 1 }), // 9.5, 10.0, null
    parallel: varchar("parallel", { length: 120 }),
    language: varchar("language", { length: 5 }).default("en"),
    rawAttributes: jsonb("raw_attributes"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mint_card_map_collectible_idx").on(t.collectibleId),
    index("mint_card_map_platform_idx").on(t.platform),
  ]
);

// ─── Payment Events (x402 ledger) ─────────────────────────────────────────────

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    amountUsd: decimal("amount_usd", { precision: 12, scale: 6 }).notNull(),
    payerAddress: varchar("payer_address", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payment_events_endpoint_idx").on(t.endpoint),
    index("payment_events_created_at_idx").on(t.createdAt),
  ]
);
