/**
 * Smoke: compute pack EV for a machine from live-ingested data.
 * Usage: npx tsx scripts/smoke-gacha-ev.ts [code]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { computePackEv } from "../src/lib/gacha/ev";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const code = process.argv[2] ?? "pokemon_50";
  const started = Date.now();
  const ev = await computePackEv(sql, code);
  console.log(JSON.stringify(ev, null, 2));
  console.error(`\nelapsed: ${Date.now() - started}ms`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
