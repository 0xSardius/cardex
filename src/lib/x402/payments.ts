/**
 * Payment tracking — records x402 payments to Neon DB.
 * Uses Drizzle directly instead of @lucid-agents/payments
 * (which bundles bun:sqlite and breaks Next.js builds on Node).
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Record an incoming x402 payment.
 * Lightweight — fire and forget, no await needed in hot path.
 */
export async function recordPayment(
  endpoint: string,
  amountUsd: string,
  payerAddress?: string
) {
  try {
    await db.execute(
      sql`INSERT INTO payment_events (endpoint, amount_usd, payer_address, created_at)
          VALUES (${endpoint}, ${amountUsd}, ${payerAddress ?? null}, now())`
    );
  } catch {
    // Don't fail the request if payment tracking fails
    console.error("Failed to record payment event");
  }
}
