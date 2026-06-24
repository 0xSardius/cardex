/**
 * Diagnose WHY mint→catalog resolution is stuck (~16%).
 *
 * Buckets every Collector Crypt mint in mint_card_map by failure reason so we
 * know whether the fix is data-acquisition (Helius DAS / name parsing) or
 * matching (set-code / card-number normalization). Read-only.
 *
 * Usage: npx tsx scripts/diagnose-mint-resolution.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const PLATFORM = "collector-crypt";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);

  // ── 1. Headline: mint_card_map resolution rate ───────────────────────────
  const [tot] = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(collectible_id)::int AS resolved,
      COUNT(*) FILTER (WHERE jsonb_typeof(raw_attributes) = 'array'
                        AND jsonb_array_length(raw_attributes) = 0)::int AS empty_attrs,
      COUNT(*) FILTER (WHERE raw_attributes IS NULL)::int AS null_attrs,
      COUNT(*) FILTER (WHERE category IS NULL)::int AS no_category,
      COUNT(*) FILTER (WHERE lower(category) = 'pokemon')::int AS pokemon
    FROM mint_card_map WHERE platform = ${PLATFORM}
  `) as any[];

  console.log("═══ mint_card_map (all CC mints ever resolved) ═══");
  console.log(tot);
  console.log(
    `  resolution rate: ${((tot.resolved / tot.total) * 100).toFixed(1)}%`
  );

  // ── 2. The number that actually matters: bot's vision over ACTIVE listings ─
  const [vision] = (await sql`
    SELECT
      COUNT(DISTINCT l.mint_address)::int AS active_mints,
      COUNT(DISTINCT l.mint_address) FILTER (WHERE m.collectible_id IS NOT NULL)::int AS active_resolved,
      COUNT(DISTINCT l.mint_address) FILTER (WHERE m.mint_address IS NULL)::int AS active_never_looked_up
    FROM listings l
    LEFT JOIN mint_card_map m ON m.mint_address = l.mint_address
    WHERE l.source = 'magic-eden' AND l.expired_at IS NULL
  `) as any[];
  console.log("\n═══ ACTIVE listings (what the bot can actually see) ═══");
  console.log(vision);
  console.log(
    `  bot vision: ${((vision.active_resolved / vision.active_mints) * 100).toFixed(1)}% of active mints priceable`
  );

  // ── 3. Bucket UNRESOLVED Pokemon mints by failure stage ──────────────────
  const buckets = (await sql`
    SELECT
      CASE
        WHEN lower(category) <> 'pokemon' OR category IS NULL THEN '0_non_pokemon'
        WHEN card_number IS NULL AND set_code IS NULL THEN '1_no_set_no_number'
        WHEN set_code IS NULL THEN '2_has_number_no_setcode'
        WHEN card_number IS NULL THEN '3_has_setcode_no_number'
        ELSE '4_has_both_but_no_catalog_match'
      END AS bucket,
      COUNT(*)::int AS n
    FROM mint_card_map
    WHERE platform = ${PLATFORM} AND collectible_id IS NULL
    GROUP BY 1 ORDER BY 1
  `) as any[];
  console.log("\n═══ UNRESOLVED mints by failure stage ═══");
  for (const b of buckets) console.log(`  ${b.bucket}: ${b.n}`);

  // ── 4. Bucket 4 is the most fixable: set_code+number present but no match.
  //     Show samples so we can see if catalog uses different set codes.
  const catalogMiss = (await sql`
    SELECT set_code, card_number, card_name, grader, grade
    FROM mint_card_map
    WHERE platform = ${PLATFORM} AND collectible_id IS NULL
      AND set_code IS NOT NULL AND card_number IS NOT NULL
    LIMIT 15
  `) as any[];
  console.log("\n═══ Bucket 4 samples (set_code|number present, no catalog hit) ═══");
  for (const r of catalogMiss) {
    // Probe whether ANY collectible exists for that set_code (wrong number?)
    const hits = (await sql`
      SELECT c.set_number FROM collectibles c JOIN sets s ON s.id = c.set_id
      WHERE c.game = 'pokemon' AND lower(s.code) = lower(${r.set_code}) LIMIT 5
    `) as any[];
    console.log(
      `  ${r.set_code} #${r.card_number} (${r.card_name ?? "?"}) [${r.grader ?? ""}${r.grade ?? ""}]` +
        ` — set exists in catalog: ${hits.length > 0 ? `yes (e.g. #${hits.map((h) => h.set_number).join(",#")})` : "NO"}`
    );
  }

  // ── 5. Sample raw_attributes for the "no set/number" bucket — is data
  //     simply absent (need Helius/name parse) or present-but-unparsed?
  const sparse = (await sql`
    SELECT mint_address, raw_attributes
    FROM mint_card_map
    WHERE platform = ${PLATFORM} AND collectible_id IS NULL
      AND set_code IS NULL AND card_number IS NULL
      AND lower(coalesce(category,'')) = 'pokemon'
    LIMIT 6
  `) as any[];
  console.log("\n═══ 'no set/number' Pokemon mints — raw attributes ═══");
  for (const r of sparse) {
    const attrs = r.raw_attributes;
    const n = Array.isArray(attrs) ? attrs.length : 0;
    console.log(`  ${r.mint_address.slice(0, 8)}… (${n} attrs):`);
    if (Array.isArray(attrs)) {
      for (const a of attrs.slice(0, 12))
        console.log(`     ${a.trait_type} = ${a.value}`);
    }
  }

  // ── 6. Peek at a listings.raw to see if the token NAME field carries
  //     identity we're currently ignoring.
  const [rawListing] = (await sql`
    SELECT raw FROM listings
    WHERE source = 'magic-eden' AND expired_at IS NULL AND raw IS NOT NULL
    LIMIT 1
  `) as any[];
  console.log("\n═══ sample listings.raw keys (look for token name) ═══");
  if (rawListing?.raw) {
    console.log("  keys:", Object.keys(rawListing.raw));
    console.log("  name:", rawListing.raw.name ?? rawListing.raw.title ?? "(none)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
