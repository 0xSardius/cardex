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
