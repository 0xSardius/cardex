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
// Comprehensive security analysis on a wallet. CardEx consumes the risk summary
// fields per CLAUDE.md Phase 8 spec. Response shape is partially documented;
// fields below are best-effort and any unknown extras pass through via the
// index signature. Tighten once live responses are sampled in Step 4g.

export interface DueDiligenceRequest {
  address: string;
}

export interface DueDiligenceResponse {
  address?: string;
  riskScore?: number;
  riskLevel?: string;
  labels?: string[];
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
