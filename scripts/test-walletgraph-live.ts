/**
 * Live capture of SolEnrich wallet-graph raw response shape ($0.010).
 * Reveals the envelope + field names so we can normalize like we did for
 * enrich-wallet-light. Usage: npx tsx scripts/test-walletgraph-live.ts [addr]
 */
import "dotenv/config";
import { walletGraph } from "../src/lib/solenrich/client";

const addr = process.argv[2] ?? process.env.SOLANA_WALLET_ADDRESS;

async function main() {
  if (!addr) {
    console.error("No address provided.");
    process.exit(1);
  }
  console.log("Calling SolEnrich wallet-graph for:", addr);
  const t0 = Date.now();
  const result = await walletGraph(addr);
  const ms = Date.now() - t0;
  if (result === null) {
    console.error(`\n❌ null after ${ms}ms — payment failed / key missing / unreachable.`);
    process.exit(2);
  }
  console.log(`\n✅ wallet-graph raw response in ${ms}ms:\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error("Unhandled:", e); process.exit(1); });
