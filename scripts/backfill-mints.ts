/**
 * Backfill mint→catalog resolution for ALL active CC listings whose mints have
 * never been looked up (or were stored with no collectible match). Mint-only:
 * fetches /v2/tokens/{mint}, parses, resolves, stores. No listing re-pagination.
 *
 * Reuses the exact production resolution path (resolveAndStoreMint) so the
 * normalized parser applies. ME client throttles to 2 QPS + handles 429.
 *
 * Usage:
 *   npx tsx scripts/backfill-mints.ts            # all unresolved active mints
 *   npx tsx scripts/backfill-mints.ts --limit 50 # smoke a small batch first
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { MagicEdenV2Client } from "../src/lib/ingestion/clients/magic-eden-client";
import {
  buildResolutionContext,
  resolveAndStoreMint,
} from "../src/lib/ingestion/magic-eden";

const PLATFORM = "collector-crypt";

function argInt(flag: string): number | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);
  const client = new MagicEdenV2Client();
  const limit = argInt("--limit");

  // Active-listing mints that are either never resolved (no row) OR have a row
  // but no collectible match yet (re-lookup may now resolve with the fixed parser).
  const allRows = (await sql`
    SELECT DISTINCT l.mint_address
    FROM listings l
    LEFT JOIN mint_card_map m ON m.mint_address = l.mint_address
    WHERE l.source = 'magic-eden' AND l.expired_at IS NULL
      AND (m.mint_address IS NULL OR m.collectible_id IS NULL)
    ORDER BY l.mint_address
  `) as Array<{ mint_address: string }>;
  const rows = limit ? allRows.slice(0, limit) : allRows;

  console.log(`Mints to (re)resolve: ${rows.length}`);
  const ctx = await buildResolutionContext(sql);

  let resolved = 0;
  let processed = 0;
  const startedAt = Date.now();
  for (const { mint_address } of rows) {
    try {
      const ok = await resolveAndStoreMint(
        sql,
        client,
        mint_address,
        ctx.collectibleByKey,
        ctx.setCodeByName
      );
      if (ok) {
        resolved++;
        // back-fill the listing rows for this newly resolved mint
        const id = (
          (await sql`SELECT collectible_id FROM mint_card_map WHERE mint_address = ${mint_address}`) as any[]
        )[0]?.collectible_id;
        if (id)
          await sql`UPDATE listings SET collectible_id = ${id}::uuid
                    WHERE mint_address = ${mint_address} AND collectible_id IS NULL`;
      }
    } catch (e: any) {
      console.warn(`  ${mint_address.slice(0, 8)}… failed: ${e.message}`);
    }
    processed++;
    if (processed % 100 === 0) {
      const rate = (processed / ((Date.now() - startedAt) / 1000)).toFixed(1);
      console.log(`  ${processed}/${rows.length} processed, ${resolved} resolved (${rate}/s)`);
    }
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
  console.log(`\nDone in ${((Date.now() - startedAt) / 1000 / 60).toFixed(1)}min.`);
  console.log(`This run: ${resolved}/${rows.length} resolved to a catalog card.`);
  console.log(`mint_card_map: ${m.resolved}/${m.total} (${((m.resolved / m.total) * 100).toFixed(1)}%)`);
  console.log(`bot vision (active): ${v.resolved}/${v.active} (${((v.resolved / v.active) * 100).toFixed(1)}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
