-- Phase 8 Step 4b: seller_intel cache table for SolEnrich enrichment.
-- 6h TTL cache, per-payload fetched_at so a failure on one endpoint
-- doesn't burn freshness on the other.
--
-- NOTE: This migration intentionally excludes listings / mint_card_map /
-- collectibles.reserved / collectibles.legalities — those were applied
-- earlier via `db:push` and already exist in production. drizzle-kit
-- regenerates them here because the migrations history was bypassed,
-- but re-applying would error on CREATE TABLE.

CREATE TABLE IF NOT EXISTS "seller_intel" (
	"wallet_address" varchar(64) PRIMARY KEY NOT NULL,
	"risk_payload" jsonb,
	"risk_fetched_at" timestamp with time zone,
	"cluster_payload" jsonb,
	"cluster_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_intel_risk_fetched_at_idx" ON "seller_intel" USING btree ("risk_fetched_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_intel_cluster_fetched_at_idx" ON "seller_intel" USING btree ("cluster_fetched_at");
