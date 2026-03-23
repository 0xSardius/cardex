import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Adding legalities column...");
  await sql`ALTER TABLE collectibles ADD COLUMN IF NOT EXISTS legalities JSONB`;

  // Verify
  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'collectibles' AND column_name = 'legalities'
  `;
  console.log("Column verified:", cols[0]);
}

main().catch(console.error);
