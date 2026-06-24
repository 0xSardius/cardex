/**
 * Diagnose v2 — drill into the two dominant failure buckets:
 *   - bucket 2 (302): has number, no set_code → what does the raw "Set" trait say?
 *   - bucket 4 (73):  has both, no catalog match → how many does stripping
 *                     leading zeros from card_number recover?
 * Read-only. Usage: npx tsx scripts/diagnose-mint-resolution-2.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const PLATFORM = "collector-crypt";

// jsonb path helper: pull a trait value (case-insensitive trait_type) from the
// raw_attributes array.
const TRAIT = (col: string, name: string) => `
  (SELECT a.value->>'value' FROM jsonb_array_elements(${col}) a
   WHERE lower(a.value->>'trait_type') = lower('${name}') LIMIT 1)`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);

  // ── Histogram of raw "Set" trait among ALL unresolved Pokemon mints ───────
  const setHist = (await sql.query(
    `SELECT ${TRAIT("raw_attributes", "Set")} AS set_raw, COUNT(*)::int AS n
     FROM mint_card_map
     WHERE platform = $1 AND collectible_id IS NULL
       AND lower(coalesce(category,'')) = 'pokemon'
     GROUP BY 1 ORDER BY n DESC LIMIT 35`,
    [PLATFORM]
  )) as any[];
  console.log("═══ raw 'Set' trait value among UNRESOLVED Pokemon mints ═══");
  for (const r of setHist) console.log(`  ${String(r.n).padStart(3)}  ${r.set_raw ?? "(no Set trait)"}`);

  // ── Bucket 2 full examples: Set + Serial Number + Card Name + Year ────────
  const b2 = (await sql.query(
    `SELECT ${TRAIT("raw_attributes", "Set")} AS set_raw,
            ${TRAIT("raw_attributes", "Serial Number")} AS serial,
            ${TRAIT("raw_attributes", "Card Name")} AS card_name,
            ${TRAIT("raw_attributes", "Year")} AS year
     FROM mint_card_map
     WHERE platform = $1 AND collectible_id IS NULL
       AND card_number IS NOT NULL AND set_code IS NULL
     LIMIT 12`,
    [PLATFORM]
  )) as any[];
  console.log("\n═══ bucket 2 examples (number present, set_code null) ═══");
  for (const r of b2)
    console.log(`  Set="${r.set_raw}"  Serial="${r.serial}"  Name="${r.card_name}"  Yr=${r.year}`);

  // ── Bucket 4 ROI: how many recover if we strip leading zeros on the number? ─
  const [b4] = (await sql.query(
    `WITH miss AS (
       SELECT set_code, card_number,
              regexp_replace(card_number, '^0+(?=\\d)', '') AS no_lead
       FROM mint_card_map
       WHERE platform = $1 AND collectible_id IS NULL
         AND set_code IS NOT NULL AND card_number IS NOT NULL
     )
     SELECT
       COUNT(*)::int AS total_b4,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM collectibles c JOIN sets s ON s.id = c.set_id
         WHERE c.game='pokemon' AND lower(s.code)=lower(miss.set_code)
           AND c.set_number = miss.no_lead))::int AS recovered_by_leadzero
     FROM miss`,
    [PLATFORM]
  )) as any[];
  console.log("\n═══ bucket 4 leading-zero recovery ═══");
  console.log(`  total bucket 4: ${b4.total_b4}`);
  console.log(`  would resolve after stripping leading zeros: ${b4.recovered_by_leadzero}`);

  // ── How many DISTINCT set codes are in bucket 2/4 and do they exist in catalog?
  const codes = (await sql.query(
    `SELECT set_code,
            EXISTS(SELECT 1 FROM sets s WHERE s.game='pokemon' AND lower(s.code)=lower(set_code)) AS in_catalog,
            COUNT(*)::int AS n
     FROM mint_card_map
     WHERE platform = $1 AND collectible_id IS NULL AND set_code IS NOT NULL
     GROUP BY 1,2 ORDER BY n DESC LIMIT 25`,
    [PLATFORM]
  )) as any[];
  console.log("\n═══ parsed set_codes in unresolved mints — in catalog? ═══");
  for (const r of codes)
    console.log(`  ${String(r.n).padStart(3)}  ${r.set_code.padEnd(10)} in_catalog=${r.in_catalog}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
