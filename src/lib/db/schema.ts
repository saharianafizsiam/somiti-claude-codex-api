import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
const id = () => uuid("id").defaultRandom().primaryKey();
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const money = (n: string) =>
  numeric(n, { precision: 20, scale: 8 }).notNull().default("0");
export const users = pgTable("users", {
  id: id(),
  email: text().notNull().unique(),
  username: text().unique(),
  name: text().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text().notNull().default("RESELLER"),
  totpSecret: text("totp_secret"),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const wallets = pgTable(
  "wallets",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    balance: money("balance"),
    allocatedBalance: money("allocated_balance"),
    totalAdded: money("total_added"),
    totalSpent: money("total_spent"),
    currency: text().notNull().default("USD"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "wallet_nonnegative",
      sql`${t.balance} >= 0 AND ${t.allocatedBalance} >= 0`,
    ),
  ],
);
export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    upstreamProvider: text("upstream_provider"),
    encryptedUpstreamKey: text("encrypted_upstream_key"),
    allocatedCredit: money("allocated_credit"),
    totalAllocatedCredit: money("total_allocated_credit"),
    creditUsed: money("credit_used"),
    creditReserved: money("credit_reserved"),
    modelAccessMode: text("model_access_mode").notNull(),
    status: text().notNull().default("ACTIVE"),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    allowedIps: jsonb("allowed_ips").$type<string[]>().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("key_hash_idx").on(t.keyHash),
    index("key_owner_idx").on(t.ownerUserId),
    check(
      "key_credit_valid",
      sql`${t.creditUsed} >= 0 AND ${t.creditReserved} >= 0 AND ${t.allocatedCredit} >= ${t.creditUsed} + ${t.creditReserved}`,
    ),
  ],
);
export const models = pgTable("models", {
  id: id(),
  displayName: text("display_name").notNull(),
  description: text(),
  publicModelId: text("public_model_id").notNull().unique(),
  upstreamModelId: text("upstream_model_id").notNull(),
  family: text().notNull(),
  provider: text().notNull().default("mwapi"),
  enabled: boolean().notNull().default(true),
  visible: boolean().notNull().default(true),
  autoFamilyAccess: boolean("auto_family_access").notNull().default(true),
  supportsOpenaiEndpoint: boolean("supports_openai_endpoint")
    .notNull()
    .default(true),
  supportsAnthropicEndpoint: boolean("supports_anthropic_endpoint")
    .notNull()
    .default(false),
  supportsStreaming: boolean("supports_streaming").notNull().default(true),
  supportsTools: boolean("supports_tools").notNull().default(false),
  supportsVision: boolean("supports_vision").notNull().default(false),
  supportsReasoning: boolean("supports_reasoning").notNull().default(false),
  supportsImages: boolean("supports_images").notNull().default(false),
  supportsStructuredOutput: boolean("supports_structured_output")
    .notNull()
    .default(false),
  contextWindow: integer("context_window").notNull().default(32768),
  maxOutputTokens: integer("max_output_tokens").notNull().default(4096),
  pricingMode: text("pricing_mode").notNull().default("UPSTREAM_PLUS_MARKUP"),
  upstreamInputPricePerMillion: money("upstream_input_price_per_million"),
  upstreamOutputPricePerMillion: money("upstream_output_price_per_million"),
  upstreamCachedInputPricePerMillion: money(
    "upstream_cached_input_price_per_million",
  ),
  customerInputPricePerMillion: money("customer_input_price_per_million"),
  customerOutputPricePerMillion: money("customer_output_price_per_million"),
  markupPercentage: money("markup_percentage"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
export const modelAliases = pgTable("model_aliases", {
  id: id(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => models.id),
  alias: text().notNull().unique(),
  createdAt: created(),
});
export const apiKeyModels = pgTable(
  "api_key_models",
  {
    id: id(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    modelId: uuid("model_id")
      .notNull()
      .references(() => models.id),
  },
  (t) => [uniqueIndex("key_model_unique").on(t.apiKeyId, t.modelId)],
);
export const dashboardShares = pgTable("dashboard_shares", {
  id: id(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .unique()
    .references(() => apiKeys.id),
  tokenPrefix: text("token_prefix").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  encryptedToken: text("encrypted_token").notNull(),
  enabled: boolean().notNull().default(true),
  createdAt: created(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
});
export const apiRequests = pgTable(
  "api_requests",
  {
    id: id(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id),
    requestId: uuid("request_id").notNull().unique(),
    modelId: uuid("model_id")
      .notNull()
      .references(() => models.id),
    publicModelIdSnapshot: text("public_model_id_snapshot").notNull(),
    modelFamilySnapshot: text("model_family_snapshot").notNull(),
    upstreamModelIdSnapshot: text("upstream_model_id_snapshot").notNull(),
    endpoint: text().notNull(),
    upstreamBilled: boolean("upstream_billed").notNull().default(false),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedTokens: integer("cached_tokens"),
    totalTokens: integer("total_tokens"),
    inputPriceSnapshot: money("input_price_snapshot"),
    outputPriceSnapshot: money("output_price_snapshot"),
    upstreamInputSnapshot: money("upstream_input_snapshot"),
    upstreamOutputSnapshot: money("upstream_output_snapshot"),
    upstreamCachedSnapshot: money("upstream_cached_snapshot"),
    reservedAmount: money("reserved_amount"),
    customerCost: money("customer_cost"),
    upstreamEstimatedCost: money("upstream_estimated_cost"),
    estimatedProfit: money("estimated_profit"),
    status: text().notNull().default("RESERVED"),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    usageStatus: text("usage_status").notNull().default("UNAVAILABLE"),
    errorCode: text("error_code"),
    createdAt: created(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    index("request_key_date_idx").on(t.apiKeyId, t.createdAt),
    index("request_date_idx").on(t.createdAt),
    index("request_model_idx").on(t.modelId),
  ],
);
export const balanceTransactions = pgTable(
  "balance_transactions",
  {
    id: id(),
    walletId: uuid("wallet_id").references(() => wallets.id),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
    type: text().notNull(),
    amount: money("amount"),
    balanceBefore: money("balance_before"),
    balanceAfter: money("balance_after"),
    description: text().notNull(),
    referenceId: text("reference_id"),
    createdAt: created(),
  },
  (t) => [
    index("transaction_key_idx").on(t.apiKeyId),
    index("transaction_date_idx").on(t.createdAt),
  ],
);
export const redeemCodes = pgTable("redeem_codes", {
  id: id(),
  codeHash: text("code_hash").notNull().unique(),
  codePrefix: text("code_prefix").notNull(),
  value: money("value"),
  currency: text().notNull().default("USD"),
  status: text().notNull().default("ACTIVE"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  redeemedBy: uuid("redeemed_by").references(() => users.id),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: created(),
});
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  action: text().notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb().notNull().default({}),
  createdAt: created(),
});
export const rateBuckets = pgTable("rate_buckets", {
  id: text().primaryKey(),
  count: integer().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const settings = pgTable("settings", {
  id: text().primaryKey().default("app"),
  applicationName: text("application_name").notNull().default("Somiti API"),
  publicApiUrl: text("public_api_url")
    .notNull()
    .default("https://api.somiti.page"),
  defaultRateLimit: integer("default_rate_limit").notNull().default(60),
  currency: text().notNull().default("USD"),
});
export type ApiKey = typeof apiKeys.$inferSelect;
export type Model = typeof models.$inferSelect;
export const canvaCodes = pgTable("canva_codes", {
  id: id(),
  codeHash: text("code_hash").notNull().unique(),
  encryptedCode: text("encrypted_code").notNull(),
  email: text(),
  status: text().notNull().default("UNUSED"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: created(),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
export const canvaQueueLock = pgTable("canva_queue_lock", {
  id: integer().primaryKey(),
});
export const canvaJobs = pgTable(
  "canva_jobs",
  {
    id: id(),
    sequence: integer().generatedAlwaysAsIdentity().notNull().unique(),
    codeId: uuid("code_id")
      .notNull()
      .unique()
      .references(() => canvaCodes.id),
    email: text().notNull(),
    status: text().notNull().default("QUEUED"),
    claimToken: text("claim_token"),
    createdAt: created(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("canva_jobs_queue_idx").on(t.status, t.sequence),
    check(
      "canva_job_status",
      sql`${t.status} in ('QUEUED', 'PROCESSING', 'SENT', 'REVIEW')`,
    ),
  ],
);
