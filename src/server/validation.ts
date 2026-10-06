import { z } from "zod";
import { isIP } from "node:net";
export const amount = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,8})?$/, "Use a positive decimal with up to 8 places")
  .refine((v) => /[1-9]/.test(v), "Amount must be positive");
const price = z.string().regex(/^\d{1,8}(\.\d{1,8})?$/);
export const accessMode = z.enum([
  "CLAUDE_ONLY",
  "OPENAI_ONLY",
  "CLAUDE_AND_OPENAI",
  "CUSTOM",
]);
export const keyInput = z.object({
  name: z.string().min(1).max(100),
  upstreamProvider: z.enum(["mwapi", "claude-n-codex"]),
  upstreamKey: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .regex(/^[\x21-\x7e]+$/)
    .optional(),
  amount: amount.optional(),
  modelAccessMode: accessMode,
  modelIds: z.array(z.string().uuid()).max(500).default([]),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(10000),
  allowedIps: z
    .array(z.string().refine((ip) => isIP(ip) !== 0, "Invalid IP address"))
    .max(100)
    .default([]),
  expiresAt: z.string().datetime().nullable().optional(),
  createDashboard: z.boolean().default(true),
});
export const modelInput = z.object({
  displayName: z.string().min(1).max(100),
  description: z.string().max(2000).default(""),
  publicModelId: z.string().regex(/^[a-zA-Z0-9._:/-]{1,150}$/),
  upstreamModelId: z.string().min(1).max(200),
  family: z.enum(["CLAUDE", "OPENAI", "GEMINI", "GROK", "DEEPSEEK", "CUSTOM"]),
  provider: z.enum(["mwapi", "claude-n-codex"]).default("mwapi"),
  enabled: z.boolean().default(true),
  visible: z.boolean().default(true),
  autoFamilyAccess: z.boolean().default(true),
  supportsOpenaiEndpoint: z.boolean().default(true),
  supportsAnthropicEndpoint: z.boolean().default(false),
  supportsStreaming: z.boolean().default(true),
  supportsTools: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsReasoning: z.boolean().default(false),
  supportsImages: z.boolean().default(false),
  supportsStructuredOutput: z.boolean().default(false),
  contextWindow: z.coerce.number().int().min(1).max(2000000),
  maxOutputTokens: z.coerce.number().int().min(1).max(2000000),
  pricingMode: z.enum(["UPSTREAM_PLUS_MARKUP", "MANUAL_CUSTOMER_PRICE"]),
  upstreamInputPricePerMillion: price,
  upstreamOutputPricePerMillion: price,
  upstreamCachedInputPricePerMillion: price.default("0"),
  customerInputPricePerMillion: price.default("0"),
  customerOutputPricePerMillion: price.default("0"),
  markupPercentage: price.default("0"),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  aliases: z
    .array(z.string().regex(/^[a-zA-Z0-9._:/-]{1,150}$/))
    .max(30)
    .default([]),
});
