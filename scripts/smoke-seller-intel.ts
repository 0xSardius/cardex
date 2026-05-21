/**
 * Smoke for the seller_intel pipeline.
 *
 * Without SOLANA_PRIVATE_KEY in env: should print unavailable=true for
 * the test address, no crash, no SolEnrich spend.
 *
 * With key + a real wallet: should fetch live, cache, and return again
 * with the cached payload (no second SolEnrich call). Run twice to see
 * the cache kick in.
 */

import 'dotenv/config';
import { getSellerIntel, isWashTradeCluster } from '../src/lib/solenrich/seller-intel';

const TEST_ADDRESS = process.argv[2] ?? 'HaRn6167N9tRH3XazRYfKmioE4okKhhxJ56FDirUnSq4';

async function main() {
  const t0 = Date.now();
  console.log(`Querying seller intel for ${TEST_ADDRESS}…`);
  console.log(`  SOLANA_PRIVATE_KEY set: ${!!process.env.SOLANA_PRIVATE_KEY}`);
  const intel = await getSellerIntel(TEST_ADDRESS);
  const elapsed = Date.now() - t0;

  console.log(`\nResult (${elapsed}ms):`);
  console.log(JSON.stringify({
    unavailable: intel.unavailable,
    risk: intel.risk ? '<payload>' : null,
    cluster: intel.cluster ? '<payload>' : null,
    risk_fetched_at: intel.risk_fetched_at,
    cluster_fetched_at: intel.cluster_fetched_at,
    wash_trade_flag: isWashTradeCluster(intel.cluster),
  }, null, 2));

  if (intel.risk) {
    console.log('\nRisk payload sample:');
    console.log(JSON.stringify(intel.risk, null, 2).slice(0, 1000));
  }
  if (intel.cluster) {
    console.log('\nCluster payload sample:');
    console.log(JSON.stringify(intel.cluster, null, 2).slice(0, 1000));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
