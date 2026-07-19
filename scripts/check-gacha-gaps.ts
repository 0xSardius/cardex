import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const staleness = await sql`
    SELECT source, MAX(observed_at) AS latest, COUNT(*)::int AS n
    FROM price_points pp
    JOIN collectibles c ON c.id = pp.collectible_id
    WHERE c.game = 'pokemon'
    GROUP BY source ORDER BY latest DESC
  `;
  console.log("Pokemon price sources:");
  for (const r of staleness as any[]) console.log(` ${r.source}: latest ${new Date(r.latest).toISOString().slice(0, 10)}, ${r.n} pts`);

  console.log("\nUnresolved COMMON-tier descriptions (sample):");
  const commons = await sql`
    SELECT g.description, m.language, m.category FROM gacha_pool_nfts g
    LEFT JOIN mint_card_map m ON m.mint_address = g.mint_address
    WHERE g.machine_code = 'pokemon_50' AND g.rarity = 'common' AND g.collectible_id IS NULL
    LIMIT 20
  `;
  for (const r of commons as any[]) console.log(` [${r.language}]`, r.description);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
