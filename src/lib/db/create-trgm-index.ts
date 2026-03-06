import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE INDEX IF NOT EXISTS collectibles_name_trgm_idx ON collectibles USING gin (name gin_trgm_ops)`;
  console.log("pg_trgm GIN index created on collectibles.name");
}

main().catch(console.error);
