import "dotenv/config";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`
    SELECT m.language, m.category, (m.set_code IS NOT NULL) AS has_set, (m.card_number IS NOT NULL) AS has_num,
           (m.collectible_id IS NOT NULL) AS resolved, COUNT(*)::int AS n
    FROM gacha_pool_nfts g JOIN mint_card_map m ON m.mint_address = g.mint_address
    GROUP BY 1,2,3,4,5 ORDER BY n DESC
  `;
  console.table(rows);

  console.log("\nUnresolved EN Pokemon with set_code (number mismatch?):");
  const a = await sql`
    SELECT DISTINCT m.set_code, m.card_number, g.description
    FROM gacha_pool_nfts g JOIN mint_card_map m ON m.mint_address = g.mint_address
    WHERE m.collectible_id IS NULL AND m.language = 'en' AND m.category = 'Pokemon' AND m.set_code IS NOT NULL
    LIMIT 15
  `;
  a.forEach((r: any) => console.log(` [${r.set_code} #${r.card_number}]`, r.description));

  console.log("\nUnresolved EN Pokemon WITHOUT set_code:");
  const b = await sql`
    SELECT g.description FROM gacha_pool_nfts g
    JOIN mint_card_map m ON m.mint_address = g.mint_address
    WHERE m.collectible_id IS NULL AND m.language = 'en' AND m.category = 'Pokemon' AND m.set_code IS NULL
    LIMIT 25
  `;
  b.forEach((r: any) => console.log(" -", r.description));
}
main();
