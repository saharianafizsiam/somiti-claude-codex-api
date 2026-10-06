import { beforeAll, describe, expect, it } from "vitest";
import { canAccess } from "../src/lib/models/access";
import { cost, money, prices } from "../src/lib/billing/money";
import { decrypt, encrypt, hash, secret } from "../src/lib/security/secrets";
import { normalizeUsage } from "../src/lib/providers/mwapi";
import { UsageCollector } from "../src/lib/providers/sse";
import { validateKey } from "../src/lib/api-keys";
import type { ApiKey, Model } from "../src/lib/db/schema";
beforeAll(() => {
  process.env.AUTH_SECRET = "a".repeat(64);
  process.env.API_KEY_ENCRYPTION_SECRET = "12".repeat(32);
});
const model = {
  id: "m",
  enabled: true,
  visible: true,
  archivedAt: null,
  autoFamilyAccess: true,
  family: "CLAUDE",
} as Model;
describe("Dynamic family authorization", () => {
  it.each([
    ["CLAUDE_ONLY", "CLAUDE", true],
    ["CLAUDE_ONLY", "OPENAI", false],
    ["OPENAI_ONLY", "CLAUDE", false],
    ["OPENAI_ONLY", "OPENAI", true],
    ["CLAUDE_AND_OPENAI", "CLAUDE", true],
    ["CLAUDE_AND_OPENAI", "OPENAI", true],
    ["CLAUDE_AND_OPENAI", "GEMINI", false],
  ])("%s -> %s = %s", (mode, family, allowed) => {
    expect(canAccess({ modelAccessMode: mode }, { ...model, family })).toBe(
      allowed,
    );
  });
  it("Custom keys receive only selected models and never newly added ones", () => {
    expect(canAccess({ modelAccessMode: "CUSTOM" }, model, ["m"])).toBe(true);
    expect(
      canAccess({ modelAccessMode: "CUSTOM" }, { ...model, id: "new" }, ["m"]),
    ).toBe(false);
  });
  it("New family models are immediately allowed unless auto access is off", () => {
    expect(
      canAccess({ modelAccessMode: "CLAUDE_ONLY" }, { ...model, id: "new" }),
    ).toBe(true);
    expect(
      canAccess(
        { modelAccessMode: "CLAUDE_ONLY" },
        { ...model, autoFamilyAccess: false },
      ),
    ).toBe(false);
  });
  it.each([{ enabled: false }, { visible: false }, { archivedAt: new Date() }])(
    "Unavailable models cannot be accessed",
    (override) => {
      expect(
        canAccess({ modelAccessMode: "CUSTOM" }, { ...model, ...override }, [
          "m",
        ]),
      ).toBe(false);
    },
  );
});
describe("Credentials", () => {
  it("Uses separate 256-bit secrets and authenticated encryption", () => {
    const api = secret("sk-somiti_");
    const dashboard = secret("sk-myapi_");
    expect(api).toMatch(/^sk-somiti_[\w-]{43}$/);
    expect(dashboard).toMatch(/^sk-myapi_[\w-]{43}$/);
    expect(hash(api)).not.toBe(hash(dashboard));
    expect(decrypt(encrypt(api))).toBe(api);
    const encoded = encrypt(api).split(".");
    encoded[2] = Buffer.from("tamper").toString("base64url");
    expect(() => decrypt(encoded.join("."))).toThrow();
  });
  const key = {
    status: "ACTIVE",
    expiresAt: null,
    allowedIps: [],
  } as unknown as ApiKey;
  it("Rejects invalid, disabled, expired and IP-restricted keys", () => {
    expect(() => validateKey(undefined, null)).toThrow("Invalid API key");
    expect(() => validateKey({ ...key, status: "DISABLED" }, null)).toThrow(
      "disabled",
    );
    expect(() => validateKey({ ...key, expiresAt: new Date(0) }, null)).toThrow(
      "expired",
    );
    expect(() =>
      validateKey({ ...key, allowedIps: ["1.2.3.4"] }, "5.6.7.8"),
    ).toThrow("not allowed");
    expect(
      validateKey({ ...key, allowedIps: ["1.2.3.4"] }, "1.2.3.4"),
    ).toBeTruthy();
  });
});
describe("Decimal billing and usage", () => {
  it("Calculates exact prices without float arithmetic", () => {
    expect(cost(12000, 3000, "3", "15")).toBe("0.08100000");
    expect(money("0.30000000")).toBe("0.30000000");
    expect(
      prices({
        ...model,
        pricingMode: "UPSTREAM_PLUS_MARKUP",
        markupPercentage: "20",
        upstreamInputPricePerMillion: "3",
        upstreamOutputPricePerMillion: "15",
      }),
    ).toEqual({ input: "3.60000000", output: "18.00000000" });
  });
  it("Does not invent absent or malformed usage", () => {
    expect(normalizeUsage({}).status).toBe("UNAVAILABLE");
    expect(
      normalizeUsage({ usage: { prompt_tokens: -1, completion_tokens: 1 } })
        .status,
    ).toBe("UNAVAILABLE");
  });
  it("Normalizes OpenAI and Anthropic cache usage", () => {
    expect(
      normalizeUsage({
        usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
          prompt_tokens_details: { cached_tokens: 20 },
        },
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 10,
      cachedTokens: 20,
      totalTokens: 110,
      status: "CONFIRMED",
    });
    expect(
      normalizeUsage({
        usage: {
          input_tokens: 50,
          output_tokens: 10,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 5,
        },
      }).inputTokens,
    ).toBe(75);
  });
  it("Reads chunk-split streaming usage", () => {
    const s = new UsageCollector();
    const text =
      'data: {"usage":{"prompt_tokens":123,"completion_tokens":7}}\n\ndata: [DONE]\n\n';
    for (const char of text) s.push(new TextEncoder().encode(char));
    expect(s.usage.totalTokens).toBe(130);
  });
  it("Merges Anthropic start and delta usage", () => {
    const s = new UsageCollector();
    s.push(
      new TextEncoder().encode(
        'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}\n\nevent: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":20}}\n\n',
      ),
    );
    expect(s.usage.totalTokens).toBe(120);
  });
});
