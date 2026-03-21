/**
 * Shared agent metadata for all API responses.
 * Includes ERC-8004 identity when configured.
 */

import { getReputation } from "./erc8004/identity";

// Cache reputation for 5 minutes to avoid hammering the indexer
let cachedReputation: { data: any; expiry: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function agentMeta() {
  const base = {
    name: "CardEx",
    version: "0.1.0",
    description: "MTG market intelligence agent",
    solanaAddress: process.env.SOLANA_PAY_TO_ADDRESS ?? null,
    registryAsset: process.env.AGENT_REGISTRY_ASSET ?? null,
    reputation: null as any,
  };

  // Fetch reputation if we have a registered asset address
  if (process.env.AGENT_REGISTRY_ASSET) {
    try {
      const now = Date.now();
      if (cachedReputation && now < cachedReputation.expiry) {
        base.reputation = cachedReputation.data;
      } else {
        const rep = await getReputation(process.env.AGENT_REGISTRY_ASSET);
        if (rep) {
          base.reputation = {
            trustTier: rep.trustTier,
            feedbackCount: rep.totalFeedbacks,
            averageScore: rep.averageScore,
            qualityScore: rep.qualityScore,
          };
          cachedReputation = { data: base.reputation, expiry: now + CACHE_TTL };
        }
      }
    } catch {
      // Reputation fetch is non-critical — don't fail the response
    }
  }

  return base;
}

/**
 * Synchronous version for routes that don't need reputation data.
 * Faster — no network calls.
 */
export function agentMetaSync() {
  return {
    name: "CardEx",
    version: "0.1.0",
    description: "MTG market intelligence agent",
    solanaAddress: process.env.SOLANA_PAY_TO_ADDRESS ?? null,
    registryAsset: process.env.AGENT_REGISTRY_ASSET ?? null,
  };
}
