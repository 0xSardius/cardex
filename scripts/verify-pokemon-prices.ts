import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const totalRow = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM price_points WHERE source LIKE 'pokemontcg_%'`
  );
  const bySourceRows = await db.execute(
    sql`SELECT source, COUNT(*)::int AS n FROM price_points WHERE source LIKE 'pokemontcg_%' GROUP BY source ORDER BY n DESC`
  );
  const latestRow = await db.execute(
    sql`SELECT MAX(observed_at) AS latest FROM price_points WHERE source LIKE 'pokemontcg_%'`
  );
  const distinctCards = await db.execute(
    sql`SELECT COUNT(DISTINCT collectible_id)::int AS n FROM price_points WHERE source LIKE 'pokemontcg_%'`
  );

  console.log('Total pokemontcg price_points:', (totalRow as any).rows?.[0]?.n ?? (totalRow as any)[0]?.n);
  console.log('Distinct collectibles covered:', (distinctCards as any).rows?.[0]?.n ?? (distinctCards as any)[0]?.n);
  console.log('Latest observed_at:', (latestRow as any).rows?.[0]?.latest ?? (latestRow as any)[0]?.latest);
  console.log('By source:');
  const rows = (bySourceRows as any).rows ?? bySourceRows;
  for (const r of rows) console.log(`  ${r.source}: ${r.n}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
