/**
 * SolEnrich x402 client — agent-to-agent commerce.
 *
 * CardEx pays SolEnrich via x402 (USDC on Solana) to enrich wallet data.
 * Uses @x402/fetch to automatically handle 402 Payment Required flows.
 *
 * Requires SOLANA_PRIVATE_KEY env var for signing payments.
 * Gracefully returns null if key is missing or SolEnrich is unreachable.
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2 } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/signers";
import { base58 } from "@scure/base";
import type { EnrichWalletLightResponse } from "./types";

const SOLENRICH_BASE_URL =
  "https://solenrich-production.up.railway.app/entrypoints";

let paymentFetch: typeof globalThis.fetch | null = null;

/**
 * Lazily initialize the x402 payment-enabled fetch.
 * Returns null if SOLANA_PRIVATE_KEY is not configured.
 */
async function getPaymentFetch(): Promise<typeof globalThis.fetch | null> {
  if (paymentFetch) return paymentFetch;

  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) {
    console.warn(
      "[solenrich] SOLANA_PRIVATE_KEY not set — SolEnrich calls disabled"
    );
    return null;
  }

  try {
    // Parse key bytes (supports JSON array or base58)
    let keyBytes: Uint8Array;
    try {
      keyBytes = new Uint8Array(JSON.parse(privateKey));
    } catch {
      keyBytes = base58.decode(privateKey);
    }

    const signer = await createKeyPairSignerFromBytes(keyBytes);

    const network =
      process.env.SOLANA_NETWORK === "mainnet"
        ? SOLANA_MAINNET_CAIP2
        : SOLANA_DEVNET_CAIP2;

    const client = new x402Client().register(
      network,
      new ExactSvmScheme(signer)
    );

    paymentFetch = wrapFetchWithPayment(fetch, client);
    return paymentFetch;
  } catch (err) {
    console.error("[solenrich] Failed to initialize x402 client:", err);
    return null;
  }
}

/**
 * Call SolEnrich enrich-wallet-light endpoint via x402.
 * Returns enriched wallet data or null on failure.
 */
export async function enrichWalletLight(
  address: string
): Promise<EnrichWalletLightResponse | null> {
  const paidFetch = await getPaymentFetch();
  if (!paidFetch) return null;

  try {
    const res = await paidFetch(
      `${SOLENRICH_BASE_URL}/enrich-wallet-light/invoke`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
        },
        body: JSON.stringify({ address }),
      }
    );

    if (!res.ok) {
      console.error(
        `[solenrich] enrich-wallet-light failed: ${res.status} ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as EnrichWalletLightResponse;
  } catch (err) {
    console.error("[solenrich] enrich-wallet-light error:", err);
    return null;
  }
}
