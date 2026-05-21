/**
 * SolEnrich API types — Solana wallet enrichment service.
 * https://solenrich.vercel.app
 *
 * Used by CardEx to demonstrate agent-to-agent commerce via x402.
 */

export interface EnrichWalletLightRequest {
  address: string;
}

export interface EnrichWalletLightResponse {
  address: string;
  solBalance: number;
  tokenHoldings: TokenHolding[];
  behavioralLabels: string[];
  riskScore: number;
  riskLevel: string;
}

export interface TokenHolding {
  mint: string;
  symbol: string;
  balance: number;
  valueUsd: number;
}

export interface SolEnrichErrorResponse {
  error: string;
  message?: string;
}

// ─── due-diligence ($0.020) ─────────────────────────────────────────────────────
// Token-mint risk analysis (NOT wallet risk). Per the OpenAPI spec the
// required input is `mint`, and the operation returns "composite risk:
// token analysis + whale activity + holder concentration" with a
// SAFE/CAUTION/RISKY verdict. Reserved here for future mint-program
// vetting; seller wallet risk uses EnrichWalletLightResponse instead.

export interface TokenDueDiligenceRequest {
  mint: string;
  format?: "json" | "llm" | "both";
}

export interface TokenDueDiligenceResponse {
  mint?: string;
  verdict?: "SAFE" | "CAUTION" | "RISKY" | string;
  riskScore?: number;
  riskLevel?: string;
  findings?: unknown[];
  [k: string]: unknown;
}

// ─── wallet-graph ($0.010) ──────────────────────────────────────────────────────
// Transaction-cluster detection for wash-trade / sybil identification. CardEx
// consumes cluster identity + wash-trade flag per CLAUDE.md Phase 8 spec.

export interface WalletGraphRequest {
  address: string;
}

export interface WalletGraphResponse {
  address?: string;
  clusterId?: string;
  memberCount?: number;
  washTradeFlag?: boolean;
  members?: string[];
  [k: string]: unknown;
}
