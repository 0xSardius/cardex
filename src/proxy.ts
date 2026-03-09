/**
 * Next.js 16 proxy — x402 payment gating.
 * Next.js 16 uses proxy.ts (not middleware.ts) for request interception.
 *
 * Intercepts requests to /api/v1/* and enforces x402 payment.
 */

import { paymentProxy } from "@x402/next";
import { routesConfig, resourceServer } from "./lib/x402/server";

export const proxy = paymentProxy(routesConfig, resourceServer, {
  appName: "CardEx",
  testnet: process.env.SOLANA_NETWORK !== "mainnet",
});
