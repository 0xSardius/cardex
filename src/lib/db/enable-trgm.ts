import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  console.log("pg_trgm extension enabled");
}

main().catch(console.error);
