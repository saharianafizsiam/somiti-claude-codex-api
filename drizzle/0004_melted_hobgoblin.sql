ALTER TABLE "api_keys" ADD COLUMN "upstream_provider" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "encrypted_upstream_key" text;--> statement-breakpoint
ALTER TABLE "api_requests" ADD COLUMN "upstream_billed" boolean DEFAULT false NOT NULL;