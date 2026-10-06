-- SOMITI API: initial schema for a NEW, empty Neon database only.

-- Paste the entire file into Neon SQL Editor and run it once.

-- Includes migration history so future npm run db:migrate calls remain compatible.

-- Does not create an administrator or configure two-factor authentication.

BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);

CREATE TABLE "api_key_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"model_id" uuid NOT NULL
);



CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"allocated_credit" numeric(20, 8) DEFAULT '0' NOT NULL,
	"credit_used" numeric(20, 8) DEFAULT '0' NOT NULL,
	"credit_reserved" numeric(20, 8) DEFAULT '0' NOT NULL,
	"model_access_mode" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"allowed_ips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "key_credit_valid" CHECK ("api_keys"."credit_used" >= 0 AND "api_keys"."credit_reserved" >= 0 AND "api_keys"."allocated_credit" >= "api_keys"."credit_used" + "api_keys"."credit_reserved")
);



CREATE TABLE "api_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"public_model_id_snapshot" text NOT NULL,
	"model_family_snapshot" text NOT NULL,
	"upstream_model_id_snapshot" text NOT NULL,
	"endpoint" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"total_tokens" integer,
	"input_price_snapshot" numeric(20, 8) DEFAULT '0' NOT NULL,
	"output_price_snapshot" numeric(20, 8) DEFAULT '0' NOT NULL,
	"upstream_input_snapshot" numeric(20, 8) DEFAULT '0' NOT NULL,
	"upstream_output_snapshot" numeric(20, 8) DEFAULT '0' NOT NULL,
	"upstream_cached_snapshot" numeric(20, 8) DEFAULT '0' NOT NULL,
	"reserved_amount" numeric(20, 8) DEFAULT '0' NOT NULL,
	"customer_cost" numeric(20, 8) DEFAULT '0' NOT NULL,
	"upstream_estimated_cost" numeric(20, 8) DEFAULT '0' NOT NULL,
	"estimated_profit" numeric(20, 8) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'RESERVED' NOT NULL,
	"http_status" integer,
	"latency_ms" integer,
	"usage_status" text DEFAULT 'UNAVAILABLE' NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "api_requests_request_id_unique" UNIQUE("request_id")
);



CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE "balance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid,
	"api_key_id" uuid,
	"type" text NOT NULL,
	"amount" numeric(20, 8) DEFAULT '0' NOT NULL,
	"balance_before" numeric(20, 8) DEFAULT '0' NOT NULL,
	"balance_after" numeric(20, 8) DEFAULT '0' NOT NULL,
	"description" text NOT NULL,
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);



CREATE TABLE "dashboard_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"token_prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	CONSTRAINT "dashboard_shares_api_key_id_unique" UNIQUE("api_key_id"),
	CONSTRAINT "dashboard_shares_token_hash_unique" UNIQUE("token_hash")
);



CREATE TABLE "model_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_aliases_alias_unique" UNIQUE("alias")
);



CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"public_model_id" text NOT NULL,
	"upstream_model_id" text NOT NULL,
	"family" text NOT NULL,
	"provider" text DEFAULT 'mwapi' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"auto_family_access" boolean DEFAULT true NOT NULL,
	"supports_openai_endpoint" boolean DEFAULT true NOT NULL,
	"supports_anthropic_endpoint" boolean DEFAULT false NOT NULL,
	"supports_streaming" boolean DEFAULT true NOT NULL,
	"supports_tools" boolean DEFAULT false NOT NULL,
	"supports_vision" boolean DEFAULT false NOT NULL,
	"supports_reasoning" boolean DEFAULT false NOT NULL,
	"supports_images" boolean DEFAULT false NOT NULL,
	"supports_structured_output" boolean DEFAULT false NOT NULL,
	"context_window" integer DEFAULT 32768 NOT NULL,
	"max_output_tokens" integer DEFAULT 4096 NOT NULL,
	"pricing_mode" text DEFAULT 'UPSTREAM_PLUS_MARKUP' NOT NULL,
	"upstream_input_price_per_million" numeric(20, 8) DEFAULT '0' NOT NULL,
	"upstream_output_price_per_million" numeric(20, 8) DEFAULT '0' NOT NULL,
	"upstream_cached_input_price_per_million" numeric(20, 8) DEFAULT '0' NOT NULL,
	"customer_input_price_per_million" numeric(20, 8) DEFAULT '0' NOT NULL,
	"customer_output_price_per_million" numeric(20, 8) DEFAULT '0' NOT NULL,
	"markup_percentage" numeric(20, 8) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "models_public_model_id_unique" UNIQUE("public_model_id")
);



CREATE TABLE "rate_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);



CREATE TABLE "redeem_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"code_prefix" text NOT NULL,
	"value" numeric(20, 8) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_by" uuid NOT NULL,
	"redeemed_by" uuid,
	"redeemed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redeem_codes_code_hash_unique" UNIQUE("code_hash")
);



CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);



CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"application_name" text DEFAULT 'Somiti API' NOT NULL,
	"public_api_url" text DEFAULT 'https://api.somiti.page' NOT NULL,
	"default_rate_limit" integer DEFAULT 60 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL
);



CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'RESELLER' NOT NULL,
	"totp_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);



CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" numeric(20, 8) DEFAULT '0' NOT NULL,
	"allocated_balance" numeric(20, 8) DEFAULT '0' NOT NULL,
	"total_added" numeric(20, 8) DEFAULT '0' NOT NULL,
	"total_spent" numeric(20, 8) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "wallet_nonnegative" CHECK ("wallets"."balance" >= 0 AND "wallets"."allocated_balance" >= 0)
);



ALTER TABLE "api_key_models" ADD CONSTRAINT "api_key_models_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "api_key_models" ADD CONSTRAINT "api_key_models_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "api_requests" ADD CONSTRAINT "api_requests_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "balance_transactions" ADD CONSTRAINT "balance_transactions_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "model_aliases" ADD CONSTRAINT "model_aliases_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_redeemed_by_users_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;


CREATE UNIQUE INDEX "key_model_unique" ON "api_key_models" USING btree ("api_key_id","model_id");


CREATE UNIQUE INDEX "key_hash_idx" ON "api_keys" USING btree ("key_hash");


CREATE INDEX "key_owner_idx" ON "api_keys" USING btree ("owner_user_id");


CREATE INDEX "request_key_date_idx" ON "api_requests" USING btree ("api_key_id","created_at");


CREATE INDEX "request_date_idx" ON "api_requests" USING btree ("created_at");


CREATE INDEX "request_model_idx" ON "api_requests" USING btree ("model_id");


CREATE INDEX "transaction_key_idx" ON "balance_transactions" USING btree ("api_key_id");


CREATE INDEX "transaction_date_idx" ON "balance_transactions" USING btree ("created_at");

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('447574ad8052a2843591ae5c28d80679eb3d46a04555dc12e529d08b78e47fec', 1791281357240);

ALTER TABLE "api_keys" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;


ALTER TABLE "models" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;


ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;


ALTER TABLE "wallets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('a6a737f20a0b3035e9996beca67eeb29c0a4f0e909fb029bdaee533d7fe6fc0a', 1791281532565);

ALTER TABLE "api_keys" ADD COLUMN "total_allocated_credit" numeric(20, 8) DEFAULT '0' NOT NULL;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('2db5e85c3f05680ad0e77cce2463ac170d42c0f67513fd46cde9576180ce1a8f', 1791281897334);

ALTER TABLE "users" ADD COLUMN "username" text;


ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");



DELETE FROM "sessions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "role" IN ('OWNER', 'ADMIN'));


INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('8b2c430712728a0be5655d891a2a2c64341bd1a45d8e5a8ade1a269295b30ee9', 1791294984442);

ALTER TABLE "api_keys" ADD COLUMN "upstream_provider" text;


ALTER TABLE "api_keys" ADD COLUMN "encrypted_upstream_key" text;


ALTER TABLE "api_requests" ADD COLUMN "upstream_billed" boolean DEFAULT false NOT NULL;

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('c2e2d20d07c2c0cc3e641bd8271799ee14654cf2a872c9e4847a125ba69114a8', 1791309918642);

COMMIT;