/**
 * Corrective local re-resolve (NO Magic Eden calls). Re-derives each CC mint's
 * collectible match from its STORED set_code + card_number + language, applying:
 *   - leading-zero / alpha-prefix number normalization
 *   - the English-only language gate (Japanese sets reuse English codes →
 *     matching them produces the wrong card; null those)
 * Adds correct English matches AND removes wrong non-English matches, then
 * syncs listings.collectible_id to match.
 *
 * Usage: npx tsx scripts/reresolve-mints.ts          (dry run)
 *        npx tsx scripts/reresolve-mints.ts --write   (persist)
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import {
  normalizeCardNumber,
  parseCollectorCryptAttributes,
} from "../src/lib/games/pokemon/collector-crypt-attributes";

const PLATFORM = "collector-crypt";
const WRITE = process.argv.includes("--write");

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const collectibles = (await sql`
    SELECT c.id, s.code AS set_code, c.set_number
    FROM collectibles c JOIN sets s ON s.id = c.set_id
    WHERE c.game = 'pokemon' AND c.set_number IS NOT NULL
  `) as Array<{ id: string; set_code: string; set_number: string }>;
  const byKey = new Map<string, string>();
  for (const r of collectibles)
    byKey.set(`${r.set_code.toLowerCase()}|${r.set_number.toLowerCase()}`, r.id);

  // Every CC mint with its stored parse + raw attrs (to re-derive language with
  // the current parser) + current match.
  const rows = (await sql`
    SELECT mint_address, set_code, card_number, category, collectible_id, raw_attributes
    FROM mint_card_map WHERE platform = ${PLATFORM}
  `) as Array<{
    mint_address: string;
    set_code: string | null;
    card_number: string | null;
    category: string | null;
    collectible_id: string | null;
    raw_attributes: any;
  }>;

  let added = 0;
  let removed = 0;
  const updates: Array<{ mint: string; id: string | null }> = [];

  for (const r of rows) {
    let desired: string | null = null;
    const isPokemon = (r.category ?? "").toLowerCase() === "pokemon";
    // Re-derive language from stored attributes so parser fixes apply without ME.
    const parsed = parseCollectorCryptAttributes(r.raw_attributes);
    const lang = parsed?.language ?? "en";
    if (isPokemon && lang === "en" && r.set_code && r.card_number) {
      const num = normalizeCardNumber(r.card_number);
      if (num)
        desired = byKey.get(`${r.set_code.toLowerCase()}|${num.toLowerCase()}`) ?? null;
    }
    if (desired !== r.collectible_id) {
      if (desired && !r.collectible_id) added++;
      else if (!desired && r.collectible_id) removed++;
      else added++; // changed one match to another
      updates.push({ mint: r.mint_address, id: desired });
    }
  }

  console.log(`mints examined: ${rows.length}`);
  console.log(`matches added/changed: ${added}`);
  console.log(`wrong matches removed (non-English / bad): ${removed}`);

  if (WRITE) {
    for (const u of updates) {
      await sql`UPDATE mint_card_map SET collectible_id = ${u.id}::uuid WHERE mint_address = ${u.mint}`;
      await sql`UPDATE listings SET collectible_id = ${u.id}::uuid WHERE mint_address = ${u.mint}`;
    }
    console.log(`\nPersisted ${updates.length} updates.`);
  } else {
    console.log(`\n(dry run — re-run with --write to persist)`);
  }

  const [m] = (await sql`
    SELECT COUNT(*)::int total, COUNT(collectible_id)::int resolved
    FROM mint_card_map WHERE platform = ${PLATFORM}
  `) as any[];
  const [v] = (await sql`
    SELECT COUNT(DISTINCT l.mint_address)::int active,
           COUNT(DISTINCT l.mint_address) FILTER (WHERE mm.collectible_id IS NOT NULL)::int resolved
    FROM listings l LEFT JOIN mint_card_map mm ON mm.mint_address = l.mint_address
    WHERE l.source='magic-eden' AND l.expired_at IS NULL
  `) as any[];
  console.log(`mint_card_map: ${m.resolved}/${m.total} (${((m.resolved / m.total) * 100).toFixed(1)}%)`);
  console.log(`bot vision (active): ${v.resolved}/${v.active} (${((v.resolved / v.active) * 100).toFixed(1)}%)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
