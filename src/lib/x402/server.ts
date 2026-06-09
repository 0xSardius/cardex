/**
 * x402 Resource Server configuration.
 * Sets up the payment verification layer with Solana SVM scheme.
 */

import { x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator as cdpFacilitator } from "@coinbase/x402";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2 } from "@x402/svm";

// Payment destination — your Solana wallet that receives USDC.
// Missing this env var makes @x402/next throw an opaque 500 on EVERY gated
// route (it can't build a payment challenge without a payTo). Fail loud here
// so the cause shows up in logs instead of a blank "Internal Server Error".
if (!process.env.SOLANA_WALLET_ADDRESS) {
  console.error(
    "[x402] SOLANA_WALLET_ADDRESS is not set — all x402-gated routes will 500. " +
      "Set it in the environment (Railway dashboard / .env) and redeploy."
  );
}
const PAY_TO = process.env.SOLANA_WALLET_ADDRESS ?? "";

// Use devnet by default, mainnet in production
type Network = `${string}:${string}`;
const NETWORK: Network = (process.env.SOLANA_NETWORK === "mainnet"
  ? SOLANA_MAINNET_CAIP2
  : SOLANA_DEVNET_CAIP2) as Network;

// The default facilitator (facilitator.x402.org) supports Solana DEVNET "exact"
// but NOT mainnet — on mainnet every gated route 500s at proxy init with
// "Facilitator does not support scheme \"exact\" on network solana:5eykt4...".
// The Coinbase CDP facilitator supports Solana mainnet "exact" (it reads
// CDP_API_KEY_ID + CDP_API_KEY_SECRET from env). Mirror SolEnrich's setup.
// Devnet/local keeps the default facilitator so dev needs no CDP keys.
const resourceServer =
  process.env.SOLANA_NETWORK === "mainnet"
    ? new x402ResourceServer(new HTTPFacilitatorClient(cdpFacilitator))
    : new x402ResourceServer();

// Register Solana payment scheme
registerExactSvmScheme(resourceServer);

// Route configuration — x402-gated endpoints
export const routesConfig = {
  "POST /api/v1/price": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.001",
      network: NETWORK,
    },
    description: "Single card price lookup across all sources",
  },
  "POST /api/v1/arbitrage": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.005",
      network: NETWORK,
    },
    description: "Cross-platform arbitrage opportunity scan",
  },
  "POST /api/v1/grade": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.01",
      network: NETWORK,
    },
    description: "Vision-based card grading estimate",
  },
  "POST /api/v1/portfolio/value": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.002",
      network: NETWORK,
    },
    description: "Portfolio valuation (per card)",
  },
  "POST /api/v1/set/complete": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.008",
      network: NETWORK,
    },
    description: "Set completion advisor",
  },
  "POST /api/v1/mtgo-spread": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.005",
      network: NETWORK,
    },
    description: "MTGO-to-paper price spread detection (leading indicator)",
  },
  "POST /api/v1/wallet-insight": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.005",
      network: NETWORK,
    },
    description:
      "Wallet intelligence via SolEnrich integration (agent-to-agent x402)",
  },
  "POST /api/v1/rwa-fair-value": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.002",
      network: NETWORK,
    },
    description:
      "Paper-vs-onchain fair value for a single tokenized card mint",
  },
  "POST /api/v1/rwa-arbitrage": {
    accepts: {
      scheme: "exact",
      payTo: PAY_TO,
      price: "$0.005",
      network: NETWORK,
    },
    description:
      "Sorted list of active onchain listings underpriced vs paper-market median, with optional seller risk + cluster enrichment",
  },
};

export { resourceServer, NETWORK, PAY_TO };
