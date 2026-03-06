CREATE TABLE "arbitrage_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collectible_id" uuid NOT NULL,
	"condition" varchar(20) DEFAULT 'raw' NOT NULL,
	"buy_source" varchar(50) NOT NULL,
	"buy_price" numeric(12, 2) NOT NULL,
	"buy_url" text,
	"sell_source" varchar(50) NOT NULL,
	"sell_price" numeric(12, 2) NOT NULL,
	"spread_usd" numeric(12, 2) NOT NULL,
	"spread_pct" real NOT NULL,
	"estimated_fees" numeric(12, 2),
	"net_profit_est" numeric(12, 2),
	"confidence" real DEFAULT 0.5,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ttl_minutes" integer DEFAULT 60
);
--> statement-breakpoint
CREATE TABLE "collectibles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"set_id" uuid,
	"set_number" varchar(20),
	"rarity" varchar(50),
	"card_type" varchar(50),
	"era" varchar(50),
	"language" varchar(5) DEFAULT 'en' NOT NULL,
	"image_url" text,
	"first_edition" boolean DEFAULT false,
	"shadowless" boolean DEFAULT false,
	"treatment" varchar(50),
	"foil" boolean DEFAULT false,
	"external_id" varchar(100),
	"tcgplayer_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collectible_id" uuid,
	"image_hash" varchar(64),
	"estimated_grade" numeric(3, 1),
	"grade_probs" jsonb,
	"raw_value" numeric(12, 2),
	"graded_ev" numeric(12, 2),
	"grading_cost" numeric(8, 2),
	"roi_estimate" real,
	"recommendation" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collectible_id" uuid NOT NULL,
	"condition" varchar(20) DEFAULT 'raw' NOT NULL,
	"date" date NOT NULL,
	"avg_price" numeric(12, 2),
	"median_price" numeric(12, 2),
	"low_price" numeric(12, 2),
	"high_price" numeric(12, 2),
	"volume" integer DEFAULT 0,
	"spread_pct" real,
	"sources_count" integer DEFAULT 0,
	"trend_7d" real,
	"trend_30d" real,
	"trend_90d" real
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"collectible_id" uuid NOT NULL,
	"condition" varchar(20) DEFAULT 'raw',
	"quantity" integer DEFAULT 1 NOT NULL,
	"cost_basis" numeric(12, 2),
	"acquired_date" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_address" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collectible_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"condition" varchar(20) DEFAULT 'raw' NOT NULL,
	"price_usd" numeric(12, 2) NOT NULL,
	"price_native" numeric(12, 2),
	"currency" varchar(5) DEFAULT 'USD',
	"listing_type" varchar(20) DEFAULT 'active' NOT NULL,
	"quantity" integer DEFAULT 1,
	"listing_url" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confidence" real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(20) NOT NULL,
	"series" varchar(255),
	"era" varchar(50),
	"total_cards" integer,
	"release_date" date,
	"logo_url" text,
	"external_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arbitrage_opportunities" ADD CONSTRAINT "arbitrage_opportunities_collectible_id_collectibles_id_fk" FOREIGN KEY ("collectible_id") REFERENCES "public"."collectibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collectibles" ADD CONSTRAINT "collectibles_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_estimates" ADD CONSTRAINT "grading_estimates_collectible_id_collectibles_id_fk" FOREIGN KEY ("collectible_id") REFERENCES "public"."collectibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_collectible_id_collectibles_id_fk" FOREIGN KEY ("collectible_id") REFERENCES "public"."collectibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_collectible_id_collectibles_id_fk" FOREIGN KEY ("collectible_id") REFERENCES "public"."collectibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_collectible_id_collectibles_id_fk" FOREIGN KEY ("collectible_id") REFERENCES "public"."collectibles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arbitrage_collectible_idx" ON "arbitrage_opportunities" USING btree ("collectible_id");--> statement-breakpoint
CREATE INDEX "arbitrage_status_idx" ON "arbitrage_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "arbitrage_detected_at_idx" ON "arbitrage_opportunities" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "collectibles_game_idx" ON "collectibles" USING btree ("game");--> statement-breakpoint
CREATE INDEX "collectibles_set_id_idx" ON "collectibles" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "collectibles_name_idx" ON "collectibles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "collectibles_external_id_idx" ON "collectibles" USING btree ("game","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_snapshots_unique_idx" ON "market_snapshots" USING btree ("collectible_id","condition","date");--> statement-breakpoint
CREATE INDEX "market_snapshots_date_idx" ON "market_snapshots" USING btree ("date");--> statement-breakpoint
CREATE INDEX "portfolio_items_portfolio_idx" ON "portfolio_items" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "price_points_collectible_idx" ON "price_points" USING btree ("collectible_id");--> statement-breakpoint
CREATE INDEX "price_points_observed_at_idx" ON "price_points" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "price_points_source_idx" ON "price_points" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "sets_game_code_idx" ON "sets" USING btree ("game","code");--> statement-breakpoint
CREATE INDEX "sets_game_idx" ON "sets" USING btree ("game");