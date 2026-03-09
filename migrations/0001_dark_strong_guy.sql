CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"amount_usd" numeric(12, 6) NOT NULL,
	"payer_address" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payment_events_endpoint_idx" ON "payment_events" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "payment_events_created_at_idx" ON "payment_events" USING btree ("created_at");