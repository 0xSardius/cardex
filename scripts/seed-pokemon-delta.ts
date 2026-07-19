/**
 * Delta-seed Pokemon sets + cards that exist upstream (pokemon-tcg-data on
 * GitHub) but not in our catalog — e.g. the 2026 Mega Evolution era (me1…me5)
 * released after the original seed. Idempotent; only touches missing sets.
 *
 * Usage: npx tsx scripts/seed-pokemon-delta.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const GITHUB_BASE =
  "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master";
const GAME = "pokemon";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "user-agent": "cardex-seeder" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const sql = neon(process.env.DATABASE_URL);

  const dbSets = (await sql`
    SELECT code FROM sets WHERE game = ${GAME}
  `) as Array<{ code: string }>;
  const have = new Set(dbSets.map((r) => r.code));

  const upstreamSets: any[] = await fetchJson(`${GITHUB_BASE}/sets/en.json`);
  const missing = upstreamSets.filter((s) => !have.has(s.id));
  console.log(
    `DB sets: ${have.size}; upstream: ${upstreamSets.length}; missing: ${missing.length}`,
    missing.map((s) => `${s.id} (${s.name})`).join(", ") || "(none)"
  );

  let totalCards = 0;
  for (const s of missing) {
    const inserted = (await sql`
      INSERT INTO sets (game, name, code, series, total_cards, release_date, logo_url, external_id)
      VALUES (${GAME}, ${s.name}, ${s.id}, ${s.series ?? null}, ${s.total ?? null},
              ${s.releaseDate ?? null}, ${s.images?.logo ?? null}, ${s.id})
      ON CONFLICT (game, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `) as Array<{ id: string }>;
    const setId = inserted[0].id;

    let cards: any[];
    try {
      cards = await fetchJson(`${GITHUB_BASE}/cards/en/${s.id}.json`);
    } catch (err: any) {
      console.log(`  ${s.id}: no card file (${err.message?.slice(0, 50)})`);
      continue;
    }

    for (const c of cards) {
      const rarity = c.rarity?.toLowerCase().replace(/\s+/g, "_") ?? null;
      await sql`
        INSERT INTO collectibles (game, name, set_id, set_number, rarity, card_type, language, image_url, external_id)
        VALUES (${GAME}, ${c.name}, ${setId}::uuid, ${c.number}, ${rarity},
                ${c.supertype?.toLowerCase() ?? null}, 'en',
                ${c.images?.large ?? c.images?.small ?? null}, ${c.id})
        ON CONFLICT (game, external_id) DO NOTHING
      `;
      totalCards++;
    }
    console.log(`  ${s.id} (${s.name}): ${cards.length} cards`);
  }

  console.log(`\nSeeded ${missing.length} sets, ${totalCards} cards.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
