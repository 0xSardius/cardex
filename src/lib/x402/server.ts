/**
 * x402 Resource Server configuration.
 * Sets up the payment verification layer with Solana SVM scheme.
 */

import { x402ResourceServer } from "@x402/next";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import { SOLANA_DEVNET_CAIP2, SOLANA_MAINNET_CAIP2 } from "@x402/svm";

// Payment destination — your Solana wallet that receives USDC
const PAY_TO = process.env.SOLANA_PAY_TO_ADDRESS!;

// Use devnet by default, mainnet in production
type Network = `${string}:${string}`;
const NETWORK: Network = (process.env.SOLANA_NETWORK === "mainnet"
  ? SOLANA_MAINNET_CAIP2
  : SOLANA_DEVNET_CAIP2) as Network;

// Create the resource server (facilitator handled internally by @x402/next)
const resourceServer = new x402ResourceServer();

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
};

export { resourceServer, NETWORK, PAY_TO };
