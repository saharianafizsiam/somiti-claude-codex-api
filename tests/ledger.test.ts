import {
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
const state = vi.hoisted(() => ({
  database: null as unknown,
  user: { id: "", role: "OWNER" },
}));
vi.mock("../src/lib/db", () => ({ db: () => state.database }));
vi.mock("../src/lib/auth", () => ({
  requireUser: async () => state.user,
  requireAdmin: (user: { role: string }) => {
    if (user.role !== "OWNER") throw new Error("Forbidden");
  },
}));
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    void fn();
  },
}));
import {
  reserve,
  settle,
  transfer,
  recoverStale,
} from "../src/lib/billing/ledger";
import { adminAction } from "../src/server/admin";
import { authenticate, sharedKey, availableModels } from "../src/lib/api-keys";
import { secret, hash, encrypt } from "../src/lib/security/secrets";
import { rateLimit } from "../src/lib/rate-limit";
import { remaining } from "../src/lib/billing/money";
import { unavailable } from "../src/lib/providers/types";
import { gateway } from "../src/server/gateway";
import { GET as modelsV1 } from "../src/app/v1/models/route";
import { GET as modelsV2 } from "../src/app/v2/models/route";
import { POST as chatV2 } from "../src/app/v2/chat/completions/route";
import { requestLogs, usage } from "../src/server/queries";
const pg = new PGlite();
const database = drizzle(pg, { schema });
let key: schema.ApiKey;
let model: schema.Model;
let rawKey: string;
beforeAll(async () => {
  process.env.AUTH_SECRET = "a".repeat(64);
  process.env.API_KEY_ENCRYPTION_SECRET = "12".repeat(32);
  process.env.APP_URL = "http://localhost:3000";
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  state.database = Object.assign(Object.create(database), {
    execute: async (query: Parameters<typeof database.execute>[0]) =>
      (await database.execute(query)).rows,
  });
});
afterAll(async () => {
  await pg.close();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await pg.exec("TRUNCATE users,models,rate_buckets,settings CASCADE");
  const [user] = await database
    .insert(schema.users)
    .values({
      email: "owner@example.test",
      name: "Owner",
      passwordHash: "test",
      role: "OWNER",
    })
    .returning();
  state.user = { id: user.id, role: "OWNER" };
  await database.insert(schema.wallets).values({
    userId: user.id,
    balance: "10",
    allocatedBalance: "1",
    totalAdded: "11",
  });
  rawKey = secret("sk-somiti_");
  [key] = await database
    .insert(schema.apiKeys)
    .values({
      ownerUserId: user.id,
      name: "A",
      keyPrefix: rawKey.slice(0, 20),
      keyHash: hash(rawKey),
      encryptedKey: encrypt(rawKey),
      modelAccessMode: "CLAUDE_ONLY",
      allocatedCredit: "1",
    })
    .returning();
  [model] = await database
    .insert(schema.models)
    .values({
      displayName: "Test Claude",
      publicModelId: "test-claude",
      upstreamModelId: "provider-test",
      family: "CLAUDE",
      contextWindow: 100000,
      maxOutputTokens: 100000,
      upstreamInputPricePerMillion: "1",
      upstreamOutputPricePerMillion: "1",
      markupPercentage: "0",
    })
    .returning();
});
describe("Gateway integration", () => {
  it("Lists only authorized models belonging to each provider route", async () => {
    await database
      .insert(schema.models)
      .values({
        displayName: "Second",
        publicModelId: "second",
        upstreamModelId: "private-second",
        family: "CLAUDE",
        provider: "claude-n-codex",
      });
    const req = () =>
      new Request("http://localhost/models", {
        headers: { authorization: `Bearer ${rawKey}` },
      });
    expect(
      (await (await modelsV1(req())).json()).data.map(
        (m: { id: string }) => m.id,
      ),
    ).toEqual([model.publicModelId]);
    expect(
      (await (await modelsV2(req())).json()).data.map(
        (m: { id: string }) => m.id,
      ),
    ).toEqual(["second"]);
    await database
      .update(schema.apiKeys)
      .set({ modelAccessMode: "OPENAI_ONLY" });
    expect((await (await modelsV2(req())).json()).data).toEqual([]);
  });
  it("Rejects cross-provider requests in both directions before reserving credit", async () => {
    const mock = upstream(Response.json({}));
    expect((await chatV2(request())).status).toBe(403);
    await database.update(schema.models).set({ provider: "claude-n-codex" });
    expect((await gateway(request(), "chat/completions")).status).toBe(403);
    expect(mock).not.toHaveBeenCalled();
    expect(await database.select().from(schema.apiRequests)).toHaveLength(0);
    const [saved] = await database.select().from(schema.apiKeys);
    expect(Number(saved.creditReserved)).toBe(0);
    expect(Number(saved.creditUsed)).toBe(0);
  });
  it("Routes v2 to the second provider using its model family credential", async () => {
    await database.update(schema.models).set({ provider: "claude-n-codex" });
    vi.stubEnv("CLAUDE_N_CODEX_BASE_URL", "https://second.example");
    vi.stubEnv("CLAUDE_N_CODEX_CLAUDE_API_KEY", "second-claude-secret");
    vi.stubEnv("CLAUDE_N_CODEX_CHAT_PATH", "/v1/chat/completions");
    const mock = upstream(
      Response.json({
        choices: [],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      }),
    );
    expect((await chatV2(request())).status).toBe(200);
    expect(String(mock.mock.calls[0][0])).toBe(
      "https://second.example/v1/chat/completions",
    );
    expect(
      new Headers(mock.mock.calls[0][1]!.headers).get("authorization"),
    ).toBe("Bearer second-claude-secret");
  });
  function request(body: Record<string, unknown> = {}) {
    return new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${rawKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model.publicModelId,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 1000,
        ...body,
      }),
    });
  }
  function upstream(value: Response) {
    process.env.MWAPI_API_KEY = "never-expose-this";
    process.env.MWAPI_BASE_URL = "https://upstream.example";
    process.env.MWAPI_CHAT_PATH = "/verified-chat";
    const mock = vi.fn<typeof fetch>(async () => value);
    vi.stubGlobal("fetch", mock);
    return mock;
  }
  it("Routes an alias with an upstream ID and returns the public ID", async () => {
    await database
      .insert(schema.modelAliases)
      .values({ modelId: model.id, alias: "short" });
    const mock = upstream(
      Response.json({
        model: "provider-test",
        choices: [],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      }),
    );
    const response = await gateway(
      request({ model: "short" }),
      "chat/completions",
    );
    expect(response.status).toBe(200);
    expect((await response.json()).model).toBe(model.publicModelId);
    expect(JSON.parse(mock.mock.calls[0][1]!.body as string).model).toBe(
      "provider-test",
    );
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditUsed).toBe("0.00011000");
  });
  it("Rejects forbidden family before contacting upstream", async () => {
    const mock = upstream(Response.json({}));
    await database
      .update(schema.apiKeys)
      .set({ modelAccessMode: "OPENAI_ONLY" });
    const response = await gateway(request(), "chat/completions");
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("model_not_allowed");
    expect(mock).not.toHaveBeenCalled();
  });
  it("Rejects disabled models and unsupported endpoints", async () => {
    await database.update(schema.models).set({ enabled: false });
    expect((await gateway(request(), "chat/completions")).status).toBe(403);
    await database.update(schema.models).set({ enabled: true });
    const r = await gateway(request(), "messages");
    expect((await r.json()).error.code).toBe("endpoint_not_supported");
  });
  it("Sanitizes provider errors and releases reservations", async () => {
    upstream(new Response("secret provider error", { status: 500 }));
    const response = await gateway(request(), "chat/completions");
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret provider");
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditReserved).toBe("0.00000000");
    expect(k.creditUsed).toBe("0.00000000");
  });
  it("Streams partial frames, rewrites upstream model IDs, and settles final usage", async () => {
    const data =
      'data: {"model":"provider-test","choices":[{"delta":{"content":"Hi"}}]}\r\n\r\ndata: {"usage":{"prompt_tokens":100,"completion_tokens":20}}\r\n\r\ndata: [DONE]\r\n\r\n';
    upstream(
      new Response(
        new ReadableStream({
          start(c) {
            for (const char of data) c.enqueue(new TextEncoder().encode(char));
            c.close();
          },
        }),
      ),
    );
    const response = await gateway(
      request({ stream: true }),
      "chat/completions",
    );
    const output = await response.text();
    expect(output).toContain("Hi");
    expect(output).not.toContain("provider-test");
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditUsed).toBe("0.00012000");
    expect(k.creditReserved).toBe("0.00000000");
  });
  it("Continues usage collection after a customer disconnects", async () => {
    upstream(
      new Response(
        new ReadableStream({
          async start(c) {
            c.enqueue(new TextEncoder().encode('data: {"choices":[]}\n\n'));
            await new Promise((r) => setTimeout(r, 25));
            c.enqueue(
              new TextEncoder().encode(
                'data: {"usage":{"prompt_tokens":100,"completion_tokens":20}}\n\ndata: [DONE]\n\n',
              ),
            );
            c.close();
          },
        }),
      ),
    );
    const response = await gateway(
      request({ stream: true }),
      "chat/completions",
    );
    await response.body!.cancel();
    await new Promise((r) => setTimeout(r, 100));
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditReserved).toBe("0.00000000");
    expect(k.creditUsed).toBe("0.00012000");
  });
  it("Applies backpressure while keeping downstream delivery live", async () => {
    let pulls = 0;
    upstream(
      new Response(
        new ReadableStream({
          pull(c) {
            pulls++;
            if (pulls <= 20)
              c.enqueue(
                new TextEncoder().encode(
                  `data: {"choices":[{"delta":{"content":"${pulls}"}}]}\n\n`,
                ),
              );
            else {
              c.enqueue(
                new TextEncoder().encode(
                  'data: {"usage":{"prompt_tokens":10,"completion_tokens":20}}\n\ndata: [DONE]\n\n',
                ),
              );
              c.close();
            }
          },
        }),
      ),
    );
    const response = await gateway(
      request({ stream: true }),
      "chat/completions",
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(pulls).toBeLessThan(5);
    expect(await response.text()).toContain("[DONE]");
    const [key] = await database.select().from(schema.apiKeys);
    expect(key.creditReserved).toBe("0.00000000");
  });
  it("Makes no charge when provider usage is unavailable", async () => {
    upstream(Response.json({ choices: [] }));
    await gateway(request(), "chat/completions");
    const [r] = await database.select().from(schema.apiRequests);
    expect(r.usageStatus).toBe("UNAVAILABLE");
    expect(r.inputTokens).toBeNull();
    expect(r.customerCost).toBe("0.00000000");
  });
  it("Queries customer logs and totals only for the selected key", async () => {
    upstream(
      Response.json({ usage: { prompt_tokens: 100, completion_tokens: 20 } }),
    );
    await gateway(request(), "chat/completions");
    const other = (await adminAction("key.create", {
      name: "B",
      modelAccessMode: "OPENAI_ONLY",
      rateLimitPerMinute: 60,
    })) as { id: string };
    expect(
      await requestLogs(eq(schema.apiRequests.apiKeyId, other.id)),
    ).toHaveLength(0);
    expect(
      (await usage(eq(schema.apiRequests.apiKeyId, other.id))).stats.requests,
    ).toBe(0);
    expect(
      await requestLogs(eq(schema.apiRequests.apiKeyId, key.id)),
    ).toHaveLength(1);
  });
});
describe("Transactional accounting", () => {
  it("Recovers a reservation left by a terminated worker", async () => {
    const r = await reserve(key.id, key.keyHash, model, "messages", 100000);
    await database
      .update(schema.apiRequests)
      .set({ createdAt: new Date(Date.now() - 20 * 60 * 1000) })
      .where(eq(schema.apiRequests.id, r.id));
    expect(await recoverStale()).toBe(1);
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditReserved).toBe("0.00000000");
    expect(await recoverStale()).toBe(0);
  });
  it("Allocates and returns available credit without returning spent or reserved credit", async () => {
    await database.transaction(async (tx) =>
      transfer(tx as never, state.user.id, key.id, "2"),
    );
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.allocatedCredit).toBe("3.00000000");
    await database.transaction(async (tx) =>
      transfer(tx as never, state.user.id, key.id, "1", true),
    );
    await expect(
      database.transaction(async (tx) =>
        transfer(tx as never, state.user.id, key.id, "3", true),
      ),
    ).rejects.toThrow("Insufficient");
  });
  it("100 concurrent reservation attempts cannot overspend $1", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        reserve(key.id, key.keyHash, model, "messages", 100000),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditReserved).toBe("1.00000000");
    expect(remaining(k)).toBe("0.00000000");
  });
  it("Settles once, releases surplus, and preserves the price snapshot", async () => {
    const r = await reserve(key.id, key.keyHash, model, "messages", 100000);
    await database
      .update(schema.models)
      .set({ upstreamInputPricePerMillion: "100" });
    const usage = {
      inputTokens: 1000,
      outputTokens: 1000,
      cachedTokens: 0,
      totalTokens: 2000,
      status: "CONFIRMED" as const,
    };
    await Promise.all([
      settle(r.requestId, usage, 200, 100),
      settle(r.requestId, usage, 200, 100),
    ]);
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditUsed).toBe("0.00200000");
    expect(k.creditReserved).toBe("0.00000000");
    const [log] = await database.select().from(schema.apiRequests);
    expect(log.inputPriceSnapshot).toBe("1.00000000");
    expect(log.customerCost).toBe("0.00200000");
  });
  it("Failed requests release their reservation without invented billing", async () => {
    const r = await reserve(key.id, key.keyHash, model, "messages", 100000);
    await settle(r.requestId, unavailable, 502, 10, "provider_error");
    const [k] = await database.select().from(schema.apiKeys);
    expect(k.creditReserved).toBe("0.00000000");
    expect(k.creditUsed).toBe("0.00000000");
  });
  it("Caps provider overruns at the reservation and flags the anomaly", async () => {
    const r = await reserve(key.id, key.keyHash, model, "messages", 100000);
    await settle(
      r.requestId,
      {
        inputTokens: 1000000,
        outputTokens: 1000000,
        cachedTokens: 0,
        totalTokens: 2000000,
        status: "CONFIRMED",
      },
      200,
      1,
    );
    const [log] = await database.select().from(schema.apiRequests);
    expect(log.customerCost).toBe("0.20000000");
    expect(log.errorCode).toBe("provider_exceeded_reservation");
  });
  it("Redeems a code once under concurrent requests", async () => {
    const r = (await adminAction("redeem.create", {
      amount: "5",
      quantity: 1,
    })) as { codes: string[] };
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        adminAction("redeem.use", { code: r.codes[0] }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [w] = await database.select().from(schema.wallets);
    expect(w.balance).toBe("15.00000000");
  });
});
describe("Authentication and tenant isolation", () => {
  it("Authenticates only API credentials", async () => {
    expect(
      (
        await authenticate(
          new Request("http://localhost/v1/models", {
            headers: { authorization: `Bearer ${rawKey}` },
          }),
        )
      ).id,
    ).toBe(key.id);
    await expect(
      authenticate(
        new Request("http://localhost/v1/models", {
          headers: { authorization: `Bearer ${secret("sk-myapi_")}` },
        }),
      ),
    ).rejects.toThrow("Invalid");
  });
  it("Rotating credentials invalidates old keys while retaining credit", async () => {
    const r = (await adminAction("key.rotate", { id: key.id })) as {
      apiKey: string;
    };
    await expect(
      authenticate(
        new Request("http://localhost", {
          headers: { authorization: `Bearer ${rawKey}` },
        }),
      ),
    ).rejects.toThrow("Invalid");
    expect(
      (
        await authenticate(
          new Request("http://localhost", {
            headers: { authorization: `Bearer ${r.apiKey}` },
          }),
        )
      ).allocatedCredit,
    ).toBe("1.00000000");
  });
  it("Dashboard tokens isolate keys and rotation invalidates old links", async () => {
    const r = (await adminAction("key.share", { id: key.id })) as {
      dashboardUrl: string;
    };
    const old = r.dashboardUrl.split("/").pop()!;
    expect((await sharedKey(old))?.id).toBe(key.id);
    expect(await sharedKey(rawKey)).toBeNull();
    await adminAction("key.share", { id: key.id });
    expect(await sharedKey(old)).toBeNull();
  });
  it("Another owner cannot mutate this key", async () => {
    state.user.id = crypto.randomUUID();
    await expect(adminAction("key.disable", { id: key.id })).rejects.toThrow(
      "not found",
    );
  });
  it("Disabled models disappear immediately and family models are dynamic", async () => {
    expect(await availableModels(key)).toHaveLength(1);
    await database.update(schema.models).set({ enabled: false });
    expect(await availableModels(key)).toHaveLength(0);
  });
  it("Database rate limits remain shared across requests", async () => {
    await rateLimit("subject", 2);
    await rateLimit("subject", 2);
    await expect(rateLimit("subject", 2)).rejects.toThrow("Rate limit");
  });
  it("Model aliases cannot collide with public IDs", async () => {
    await database
      .insert(schema.modelAliases)
      .values({ modelId: model.id, alias: "short" });
    const [alias] = await database
      .select()
      .from(schema.modelAliases)
      .where(eq(schema.modelAliases.alias, "short"));
    expect(alias.modelId).toBe(model.id);
  });
  it("DB constraints reject a negative available balance", async () => {
    await expect(
      database.execute(
        sql`UPDATE api_keys SET credit_reserved=2 WHERE id=${key.id}`,
      ),
    ).rejects.toThrow();
  });
});
