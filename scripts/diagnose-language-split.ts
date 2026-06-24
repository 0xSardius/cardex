/**
 * Size the trader's addressable universe: of CC's tokenized Pokemon mints, how
 * many are English (priceable on our catalog) vs Japanese (need a JP source)?
 * Uses parsed language + a raw-attribute "Japanese" check for robustness.
 * Read-only. Usage: npx tsx scripts/diagnose-language-split.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const PLATFORM = "collector-crypt";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Japanese signal = parsed lang 'ja' OR the raw Set string mentions Japanese.
  const [r] = (await sql`
    WITH m AS (
      SELECT mint_address, collectible_id, language,
        (language = 'ja'
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(raw_attributes) a
           WHERE lower(a.value->>'trait_type') = 'set'
             AND a.value->>'value' ILIKE '%japanese%'
         )) AS is_japanese,
        (jsonb_typeof(raw_attributes) = 'array' AND jsonb_array_length(raw_attributes) > 0) AS has_attrs
      FROM mint_card_map
      WHERE platform = ${PLATFORM} AND lower(coalesce(category,'')) = 'pokemon'
    )
    SELECT
      COUNT(*)::int AS total_pokemon_mints,
      COUNT(*) FILTER (WHERE is_japanese)::int AS japanese,
      COUNT(*) FILTER (WHERE NOT is_japanese)::int AS english_or_other,
      COUNT(*) FILTER (WHERE collectible_id IS NOT NULL)::int AS resolved,
      COUNT(*) FILTER (WHERE is_japanese AND collectible_id IS NOT NULL)::int AS japanese_resolved,
      COUNT(*) FILTER (WHERE NOT is_japanese AND collectible_id IS NOT NULL)::int AS english_resolved
    FROM m
  `) as any[];

  console.log("═══ CC tokenized Pokemon — language split (looked-up mints) ═══");
  console.log(r);
  const jpPct = ((r.japanese / r.total_pokemon_mints) * 100).toFixed(1);
  const enResPct = ((r.english_resolved / r.english_or_other) * 100).toFixed(1);
  console.log(`\n  Japanese: ${jpPct}% of looked-up Pokemon mints (un-priceable on English catalog)`);
  console.log(`  English resolution rate: ${enResPct}% (${r.english_resolved}/${r.english_or_other})`);
  console.log(`  → addressable English universe currently priced: ${r.english_resolved} cards`);
  console.log(`  (${r.japanese_resolved} Japanese wrongly still resolved — should be ~0 after language gate)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
