/**
 * Next.js 16 proxy — x402 payment gating.
 * Next.js 16 uses proxy.ts (not middleware.ts) for request interception.
 *
 * Intercepts requests to /api/v1/* and enforces x402 payment.
 */

import { paymentProxy } from "@x402/next";
import { routesConfig, resourceServer } from "./lib/x402/server";

// Initialize the facilitator connection ourselves, guarded. If we let
// paymentProxy do it (syncFacilitatorOnStart defaults to true) and it fails —
// e.g. bad/missing CDP_API_KEY_ID/CDP_API_KEY_SECRET on mainnet — the rejection
// is unhandled and crashes the process (Railway health-check flapping, whole
// site down). Catching it here: log loudly, let the app boot. Gated routes
// won't verify payments until the keys are fixed, but the landing page and any
// free routes stay up.
resourceServer.initialize().then(
  () => console.log("[x402] facilitator initialized — payment verification ready"),
  (err) =>
    console.error(
      "[x402] facilitator init FAILED — x402 payment verification is DOWN until fixed. " +
        "On mainnet, check CDP_API_KEY_ID / CDP_API_KEY_SECRET. Error:",
      err
    )
);

export const proxy = paymentProxy(
  routesConfig,
  resourceServer,
  { appName: "CardEx", testnet: process.env.SOLANA_NETWORK !== "mainnet" },
  undefined, // paywall provider — default
  false, // syncFacilitatorOnStart — handled above, guarded
);
