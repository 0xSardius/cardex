/**
 * Classify the too-good-to-be-true "deals": for each, dump the raw CC attributes
 * (what card/grade the pNFT ACTUALLY claims) + listing price/expiry/freshness.
 * Tells us: match error vs wrong grade vs ghost listing vs real. Read-only.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`
    SELECT c.name AS matched_card, mcm.grader, mcm.grade, mcm.card_number, mcm.set_code,
           l.mint_address, l.price_sol, l.listed_at, l.expired_at,
           EXTRACT(EPOCH FROM (NOW() - l.observed_at))/3600 AS hrs_since_seen,
           mcm.raw_attributes
    FROM listings l
    JOIN mint_card_map mcm ON mcm.mint_address = l.mint_address
    JOIN collectibles c ON c.id = mcm.collectible_id
    WHERE l.expired_at IS NULL AND mcm.collectible_id IS NOT NULL
      AND l.price_sol IS NOT NULL
      AND l.price_sol::numeric <= 1.0
    ORDER BY l.price_sol::numeric ASC
    LIMIT 8
  `) as any[];

  for (const r of rows) {
    const attrs: any[] = Array.isArray(r.raw_attributes) ? r.raw_attributes : [];
    const get = (t: string) =>
      attrs.find((a) => a.trait_type?.toLowerCase() === t.toLowerCase())?.value ?? "—";
    console.log(`\n${r.price_sol} SOL — matched to: ${r.matched_card} [${r.grader}${r.grade}] (${r.set_code} #${r.card_number})`);
    console.log(`  mint ${r.mint_address.slice(0, 10)}…  seen ${Number(r.hrs_since_seen).toFixed(1)}h ago`);
    console.log(`  CC attrs → Card Name: "${get("Card Name")}" | Set: "${get("Set")}" | Serial: "${get("Serial Number")}" | Grade: "${get("The Grade")}" ${get("Grading Company")} | Insured: ${get("Insured Value")}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
