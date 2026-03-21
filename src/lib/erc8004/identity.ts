/**
 * ERC-8004 Agent Identity on Solana
 *
 * Provides agent registration and reputation queries via 8004-solana SDK.
 * The agent's Solana keypair is used for both x402 payments and registry identity.
 */

import { SolanaSDK, type EnrichedSummary } from "8004-solana";
import { Keypair, PublicKey } from "@solana/web3.js";

let sdkInstance: SolanaSDK | null = null;

function getSDK(): SolanaSDK {
  if (sdkInstance) return sdkInstance;

  const cluster = process.env.SOLANA_NETWORK === "mainnet" ? "mainnet-beta" : "devnet";
  const rpcUrl = process.env.SOLANA_RPC_URL || undefined;

  // Signer is optional — only needed for write operations (registration)
  let signer: Keypair | undefined;
  if (process.env.SOLANA_PRIVATE_KEY) {
    try {
      const keyBytes = JSON.parse(process.env.SOLANA_PRIVATE_KEY);
      signer = Keypair.fromSecretKey(new Uint8Array(keyBytes));
    } catch {
      // Try base58 format
      const bs58 = require("bs58");
      signer = Keypair.fromSecretKey(bs58.default.decode(process.env.SOLANA_PRIVATE_KEY));
    }
  }

  sdkInstance = new SolanaSDK({
    cluster,
    rpcUrl,
    signer,
  });

  return sdkInstance;
}

/**
 * Register this agent on the Solana Agent Registry.
 * Requires SOLANA_PRIVATE_KEY to be set.
 * Returns the agent's asset public key.
 */
export async function registerAgent(metadataUri?: string): Promise<{ assetAddress: string; signature: string }> {
  const sdk = getSDK();
  const result = await sdk.registerAgent(metadataUri);
  return {
    assetAddress: result.asset!.toBase58(),
    signature: "signature" in result ? (result as any).signature : "",
  };
}

/**
 * Get enriched reputation summary for an agent.
 * Includes ATOM trust tier, feedback count, accuracy metrics.
 */
export async function getReputation(assetAddress: string): Promise<EnrichedSummary | null> {
  const sdk = getSDK();
  const pubkey = new PublicKey(assetAddress);
  return sdk.getEnrichedSummary(pubkey);
}

/**
 * Look up agent by wallet address (via indexer).
 */
export async function getAgentByWallet(walletAddress: string) {
  const sdk = getSDK();
  return sdk.getAgentByWallet(walletAddress);
}
