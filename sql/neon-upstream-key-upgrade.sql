-- Run once on the EXISTING SOMITI database, before deploying this update.
BEGIN;
ALTER TABLE "api_keys" ADD COLUMN "upstream_provider" text;

ALTER TABLE "api_keys" ADD COLUMN "encrypted_upstream_key" text;

ALTER TABLE "api_requests" ADD COLUMN "upstream_billed" boolean DEFAULT false NOT NULL;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('c2e2d20d07c2c0cc3e641bd8271799ee14654cf2a872c9e4847a125ba69114a8', 1791309918642);
COMMIT;
