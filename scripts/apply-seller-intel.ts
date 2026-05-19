import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const sql = neon(process.env.DATABASE_URL);
  const path = join(process.cwd(), 'migrations', '0002_warm_sharon_carter.sql');
  const raw = readFileSync(path, 'utf-8');
  // Split on the drizzle statement-breakpoint marker, drop comment-only chunks.
  const statements = raw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s.replace(/--.*$/gm, '').trim()));
  for (const stmt of statements) {
    const cleaned = stmt.replace(/--.*$/gm, '').trim();
    if (!cleaned) continue;
    console.log('Executing:', cleaned.slice(0, 100).replace(/\s+/g, ' '), '…');
    await sql.query(cleaned);
  }
  const verify = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'seller_intel'
    ORDER BY ordinal_position
  ` as any[];
  console.log('\nseller_intel columns:', verify.map((r) => r.column_name).join(', '));
  console.log('Done.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
