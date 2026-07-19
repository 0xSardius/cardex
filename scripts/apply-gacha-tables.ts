/**
 * Idempotent DDL apply for the gacha tables (gacha_machines, gacha_pool_nfts,
 * gacha_pulls). Migrations are drifted from live state (see 4b precedent), so
 * schema changes are applied via CREATE IF NOT EXISTS scripts, with schema.ts
 * as the source of truth for Drizzle types.
 *
 * Usage: npx tsx scripts/apply-gacha-tables.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS gacha_machines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(40) NOT NULL,
    name varchar(120),
    price_usd numeric(12,2),
    instant_buyback_pct real,
    odds jsonb,
    tier_ranges jsonb,
    stock jsonb,
    platform_ev numeric(14,4),
    target_ev numeric(14,4),
    is_public boolean DEFAULT true,
    observed_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS gacha_machines_code_observed_idx ON gacha_machines (code, observed_at)`,

  `CREATE TABLE IF NOT EXISTS gacha_pool_nfts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_code varchar(40) NOT NULL,
    mint_address varchar(64) NOT NULL,
    rarity varchar(20) NOT NULL,
    name text,
    description text,
    insured_value numeric(12,2),
    image_url text,
    attributes jsonb,
    collectible_id uuid REFERENCES collectibles(id),
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS gacha_pool_nfts_machine_mint_idx ON gacha_pool_nfts (machine_code, mint_address)`,
  `CREATE INDEX IF NOT EXISTS gacha_pool_nfts_machine_rarity_idx ON gacha_pool_nfts (machine_code, rarity)`,
  `CREATE INDEX IF NOT EXISTS gacha_pool_nfts_collectible_idx ON gacha_pool_nfts (collectible_id)`,

  `CREATE TABLE IF NOT EXISTS gacha_pulls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    winner varchar(64),
    mint_address varchar(64) NOT NULL,
    pack_type varchar(40) NOT NULL,
    prize_tier integer,
    rarity varchar(20),
    insured_value numeric(12,2),
    memo_slug varchar(30),
    nft_name text,
    collectible_id uuid REFERENCES collectibles(id),
    pulled_at timestamptz NOT NULL,
    observed_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS gacha_pulls_mint_pulled_idx ON gacha_pulls (mint_address, pulled_at)`,
  `CREATE INDEX IF NOT EXISTS gacha_pulls_pack_pulled_idx ON gacha_pulls (pack_type, pulled_at)`,
  `CREATE INDEX IF NOT EXISTS gacha_pulls_slug_idx ON gacha_pulls (memo_slug)`,
  `CREATE INDEX IF NOT EXISTS gacha_pulls_collectible_idx ON gacha_pulls (collectible_id)`,
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const sql = neon(process.env.DATABASE_URL);
  for (const stmt of STATEMENTS) {
    console.log("Executing:", stmt.slice(0, 80).replace(/\s+/g, " "), "…");
    await sql.query(stmt);
  }
  for (const table of ["gacha_machines", "gacha_pool_nfts", "gacha_pulls"]) {
    const cols = (await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = ${table} ORDER BY ordinal_position
    `) as Array<{ column_name: string }>;
    console.log(`${table}:`, cols.map((r) => r.column_name).join(", "));
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
