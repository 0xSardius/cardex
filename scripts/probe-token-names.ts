/**
 * Probe: do ME token `name` fields carry card identity for the no-Set-trait
 * mints? Decides whether a name-parser is worth building. Read-only-ish
 * (fetches a handful of tokens). Usage: npx tsx scripts/probe-token-names.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { MagicEdenV2Client } from "../src/lib/ingestion/clients/magic-eden-client";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);
  const client = new MagicEdenV2Client();

  // no-Set-trait unresolved mints (the 235 cohort) that are on active listings
  const rows = (await sql`
    SELECT DISTINCT l.mint_address
    FROM listings l
    JOIN mint_card_map m ON m.mint_address = l.mint_address
    WHERE l.source='magic-eden' AND l.expired_at IS NULL
      AND m.collectible_id IS NULL AND m.set_code IS NULL
    LIMIT 10
  `) as Array<{ mint_address: string }>;

  for (const { mint_address } of rows) {
    const t = await client.getToken(mint_address);
    const setAttr = t?.attributes?.find(
      (a) => a.trait_type?.toLowerCase() === "set"
    )?.value;
    console.log(`name="${t?.name ?? "(none)"}"  | Set attr=${setAttr ?? "(none)"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
