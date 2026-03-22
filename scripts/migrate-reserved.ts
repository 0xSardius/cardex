import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Adding reserved column...");
  await sql`ALTER TABLE collectibles ADD COLUMN IF NOT EXISTS reserved BOOLEAN DEFAULT false`;

  console.log("Adding partial index...");
  await sql`CREATE INDEX IF NOT EXISTS collectibles_reserved_idx ON collectibles (reserved) WHERE reserved = true`;

  // Verify
  const cols = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'collectibles' AND column_name = 'reserved'
  `;
  console.log("Column verified:", cols[0]);

  // Check current state
  const count = await sql`SELECT COUNT(*) as total FROM collectibles WHERE game = 'mtg'`;
  console.log("Total MTG cards:", count[0].total);

  const reservedCount = await sql`SELECT COUNT(*) as total FROM collectibles WHERE reserved = true`;
  console.log("Currently reserved:", reservedCount[0].total);
}

main().catch(console.error);
