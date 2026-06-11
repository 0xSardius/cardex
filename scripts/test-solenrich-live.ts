/**
 * Live test: CardEx -> SolEnrich agent-to-agent x402 payment on mainnet.
 *
 * Calls enrich-wallet-light directly (the load-bearing SolEnrich composition
 * used by wallet-insight + rwa-arbitrage). Proves the outbound payment works
 * end-to-end without the self-pay wrinkle of calling CardEx's own gated route.
 *
 * Spends ~$0.002 USDC from the agent wallet (SOLANA_PRIVATE_KEY).
 *
 * Usage: npx tsx scripts/test-solenrich-live.ts [walletAddress]
 */
import "dotenv/config";
import { enrichWalletLight } from "../src/lib/solenrich/client";

const addr = process.argv[2] ?? process.env.SOLANA_WALLET_ADDRESS;

async function main() {
  if (!addr) {
    console.error("No address provided and SOLANA_WALLET_ADDRESS unset.");
    process.exit(1);
  }
  console.log("SOLANA_NETWORK:", process.env.SOLANA_NETWORK ?? "(unset -> devnet default)");
  console.log("SOLANA_PRIVATE_KEY set:", !!process.env.SOLANA_PRIVATE_KEY);
  console.log("Calling SolEnrich enrich-wallet-light for:", addr);
  console.log("---");

  const t0 = Date.now();
  const result = await enrichWalletLight(addr);
  const ms = Date.now() - t0;

  if (result === null) {
    console.error(`\n❌ Returned null after ${ms}ms — payment failed, key missing, or SolEnrich unreachable. Check logs above.`);
    process.exit(2);
  }

  console.log(`\n✅ SolEnrich responded in ${ms}ms:\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
