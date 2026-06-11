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
import type {
  TokenDueDiligenceResponse,
  EnrichWalletLightResponse,
  WalletGraphResponse,
} from "./types";

// Official base URL per solenrich.com /.well-known/x402 manifest.
// The older solenrich-production.up.railway.app host still works (verified
// 2026-05-20) but the canonical URL is api.solenrich.com.
const SOLENRICH_BASE_URL = "https://api.solenrich.com/entrypoints";

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

    // Register BOTH networks so outbound payments work regardless of how
    // SOLANA_NETWORK is set locally. SolEnrich's production endpoints
    // require mainnet (CAIP `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`);
    // single-network registration would 4xx with "No network/scheme
    // registered" if the local env var disagreed. Strictly permissive —
    // the same signer pays either network.
    const client = new x402Client()
      .register(SOLANA_MAINNET_CAIP2, new ExactSvmScheme(signer))
      .register(SOLANA_DEVNET_CAIP2, new ExactSvmScheme(signer));

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

    return normalizeEnrichWalletLight(await res.json());
  } catch (err) {
    console.error("[solenrich] enrich-wallet-light error:", err);
    return null;
  }
}

/**
 * SolEnrich's /invoke wraps results in `{ run_id, status, output }` and uses
 * snake_case (`risk_score`, `risk_level`, `labels`, `top_holdings`). Every
 * CardEx consumer expects the flat camelCase EnrichWalletLightResponse, so we
 * normalize here. The previous blind `as` cast silently dropped every field —
 * payment fired, data returned, and downstream reads were all `undefined`
 * (seller_risk null, /demo/wallet blank). Defensive against both the wrapped
 * and unwrapped shapes so a future SolEnrich change degrades, not breaks.
 */
function normalizeEnrichWalletLight(
  raw: unknown
): EnrichWalletLightResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const env = raw as Record<string, unknown>;
  if (typeof env.status === "string" && env.status !== "succeeded") return null;

  const o = (env.output ?? env) as Record<string, unknown>;
  if (!o || typeof o !== "object") return null;

  const holdings = (o.top_holdings ?? o.tokenHoldings) as
    | Array<Record<string, unknown>>
    | undefined;

  return {
    address: (o.address as string) ?? "",
    solBalance: (o.sol_balance ?? o.solBalance ?? 0) as number,
    tokenHoldings: Array.isArray(holdings)
      ? holdings.map((h) => ({
          mint: (h.mint as string) ?? "",
          symbol: (h.symbol as string) ?? "",
          balance: (h.balance as number) ?? 0,
          valueUsd: (h.usd_value ?? h.valueUsd ?? 0) as number,
        }))
      : [],
    behavioralLabels: (o.labels ?? o.behavioralLabels ?? []) as string[],
    riskScore: (o.risk_score ?? o.riskScore ?? 0) as number,
    riskLevel: (o.risk_level ?? o.riskLevel ?? "") as string,
  };
}

/**
 * Call SolEnrich due-diligence endpoint via x402 ($0.020 USDC).
 *
 * IMPORTANT: this endpoint analyzes a **token mint**, not a wallet.
 * It returns "composite risk: token analysis + whale activity + holder
 * concentration" with a SAFE/CAUTION/RISKY verdict per the published
 * OpenAPI spec (api.solenrich.com/openapi.json).
 *
 * NOT used for seller wallet risk in `rwa-arbitrage` — that's
 * `enrichWalletLight` which returns riskScore + riskLevel for ~10x less.
 * Kept here for the future case where we want to vet a tokenized-card
 * mint program's safety (e.g. compromised CC vault wallet authority).
 *
 * Returns null if x402 client is unconfigured, network fails, or
 * SolEnrich returns a non-2xx response.
 */
export async function tokenDueDiligence(
  mint: string
): Promise<TokenDueDiligenceResponse | null> {
  const paidFetch = await getPaymentFetch();
  if (!paidFetch) return null;

  try {
    const res = await paidFetch(
      `${SOLENRICH_BASE_URL}/due-diligence/invoke`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "CardEx/0.1 (https://github.com/0xSardius/cardex)",
        },
        body: JSON.stringify({ mint }),
      }
    );

    if (!res.ok) {
      console.error(
        `[solenrich] due-diligence failed: ${res.status} ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as TokenDueDiligenceResponse;
  } catch (err) {
    console.error("[solenrich] due-diligence error:", err);
    return null;
  }
}

/**
 * Call SolEnrich wallet-graph endpoint via x402 ($0.010 USDC).
 * Detects wash-trade clusters and connected-wallet relationships —
 * CardEx uses for `seller_cluster` + wash-trade filter in Phase 8.
 *
 * Returns null if x402 client is unconfigured, network fails, or
 * SolEnrich returns a non-2xx response.
 */
export async function walletGraph(
  address: string
): Promise<WalletGraphResponse | null> {
  const paidFetch = await getPaymentFetch();
  if (!paidFetch) return null;

  try {
    const res = await paidFetch(
      `${SOLENRICH_BASE_URL}/wallet-graph/invoke`,
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
        `[solenrich] wallet-graph failed: ${res.status} ${res.statusText}`
      );
      return null;
    }

    return (await res.json()) as WalletGraphResponse;
  } catch (err) {
    console.error("[solenrich] wallet-graph error:", err);
    return null;
  }
}
