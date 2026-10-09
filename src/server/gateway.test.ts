import { beforeEach, it, expect, vi } from "vitest";
const f = vi.hoisted(() => ({
  model: {
    id: "m",
    provider: "claude-n-codex",
    family: "OPENAI",
    enabled: true,
    visible: true,
    archivedAt: null,
    publicModelId: "v2/gpt-test",
    upstreamModelId: "gpt-test",
    supportsOpenaiEndpoint: true,
    supportsAnthropicEndpoint: false,
    supportsStreaming: true,
    supportsTools: true,
    supportsReasoning: true,
    supportsVision: false,
    supportsStructuredOutput: false,
    maxOutputTokens: 100,
  },
  send: vi.fn(),
  settle: vi.fn(),
  allowed: true,
  lookupFound: true,
  done: [] as Promise<void>[],
}));
vi.mock("@/lib/api-keys", () => ({
  authenticate: async () => ({
    id: "k",
    keyHash: "h",
    upstreamProvider: "claude-n-codex",
    encryptedUpstreamKey: "encrypted",
  }),
  availableModels: async () => (f.allowed ? [f.model] : []),
}));
vi.mock("@/lib/db", () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({ limit: async () => f.lookupFound ? [{ model: f.model }] : [] }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/billing/ledger", () => ({
  reserve: async () => ({ requestId: "r" }),
  settle: f.settle,
}));
vi.mock("@/lib/security/secrets", () => ({
  decrypt: () => "bound-customer-key",
}));
vi.mock("@/lib/providers/compatible", async () => {
  const { normalizeUsage } = await import("@/lib/providers/usage");
  return { compatibleProvider: () => ({ send: f.send, normalizeUsage }) };
});
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => f.done.push(cb()),
}));
import { gateway } from "./gateway";
beforeEach(() => {
  f.send.mockReset();
  f.settle.mockReset();
  f.allowed = true;
  f.lookupFound = true;
  f.done = [];
  f.model.supportsTools = true;
  f.model.supportsVision = false;
});
const request = (body: object) =>
  new Request("https://api.example/v2/responses", {
    method: "POST",
    body: JSON.stringify(body),
  });
it("preserves a full-size screenshot payload above the old 2 MB limit", async () => {
  f.model.supportsVision = true;
  const image = "data:image/png;base64," + "A".repeat(3_666_316);
  f.send.mockResolvedValue(Response.json({model:"gpt-test",output:[],usage:{input_tokens:1,output_tokens:1}}));
  const r = await gateway(request({model:"gpt-test",input:[{role:"user",content:[{type:"input_image",image_url:image}]}]}),"responses","claude-n-codex");
  expect(r.status).toBe(200);
  expect(f.send.mock.calls[0][1].input[0].content[0].image_url).toBe(image);
});
it("rejects media beyond the hosting payload budget before forwarding", async () => {
  const r = await gateway(request({model:"gpt-test",input:"x".repeat(4_400_000)}),"responses","claude-n-codex");
  expect(r.status).toBe(413);
  expect(f.send).not.toHaveBeenCalled();
});
it("forwards Responses input, tools and output limit with stateless storage", async () => {
  f.send.mockResolvedValue(
    Response.json({
      model: "gpt-test",
      output: [],
      usage: { input_tokens: 3, output_tokens: 2 },
    }),
  );
  const r = await gateway(
    request({
      model: "v2/gpt-test",
      input: "Hi",
      tools: [
        { type: "function", name: "ping", parameters: { type: "object" } },
      ],
      max_output_tokens: 32,
    }),
    "responses",
    "claude-n-codex",
  );
  expect(r.status).toBe(200);
  expect((await r.json()).model).toBe("gpt-test");
  expect(f.send.mock.calls[0][1]).toMatchObject({
    model: "gpt-test",
    input: "Hi",
    max_output_tokens: 32,
    store: false,
  });
  expect(f.send.mock.calls[0][1]).not.toHaveProperty("max_tokens");
  expect(f.settle).toHaveBeenCalled();
});
it("rejects denied models, tools and stateful requests before upstream", async () => {
  f.allowed = false;
  expect(
    (
      await gateway(
        request({ model: "v2/gpt-test", input: "Hi" }),
        "responses",
        "claude-n-codex",
      )
    ).status,
  ).toBe(403);
  f.allowed = true;
  f.model.supportsTools = false;
  expect(
    (
      await gateway(
        request({ model: "v2/gpt-test", input: "Hi", tools: [{}] }),
        "responses",
        "claude-n-codex",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await gateway(
        request({ model: "v2/gpt-test", input: "Hi", background: true }),
        "responses",
        "claude-n-codex",
      )
    ).status,
  ).toBe(400);
  expect(f.send).not.toHaveBeenCalled();
});
it("streams tool events and settles nested final usage", async () => {
  const events = [
    {
      type: "response.output_item.added",
      item: { type: "function_call", name: "ping", arguments: "{}" },
    },
    {
      type: "response.completed",
      response: {
        model: "gpt-test",
        usage: {
          input_tokens: 10,
          output_tokens: 2,
          input_tokens_details: { cached_tokens: 5 },
        },
      },
    },
  ];
  f.send.mockResolvedValue(
    new Response(events.map((v) => `data: ${JSON.stringify(v)}\n\n`).join("")),
  );
  const r = await gateway(
    request({ model: "v2/gpt-test", input: "Hi", stream: true }),
    "responses",
    "claude-n-codex",
  );
  const text = await r.text();
  await Promise.all(f.done);
  expect(text).toContain("function_call");
  expect(text).toContain("gpt-test");
  expect(f.settle.mock.calls[0][1]).toMatchObject({
    inputTokens: 10,
    outputTokens: 2,
    cachedTokens: 5,
  });
});
it("distinguishes exhausted quota from a temporary rate limit without leaking provider text", async () => {
  f.send.mockResolvedValue(
    Response.json(
      { code: "API_KEY_QUOTA_EXHAUSTED", message: "private account detail" },
      { status: 429 },
    ),
  );
  const r = await gateway(
    request({ model: "v2/gpt-test", input: "Hi" }),
    "responses",
    "claude-n-codex",
  );
  expect(r.status).toBe(402);
  const body = await r.json();
  expect(body.error.code).toBe("quota_exhausted");
  expect(JSON.stringify(body)).not.toContain("private account detail");
  expect(r.headers.get("retry-after")).toBeNull();
});

it("accepts a native v2 ID without a database alias and forwards it unchanged", async () => {
 f.lookupFound = false;
 f.send.mockResolvedValue(Response.json({ model: "gpt-test", output: [], usage: { input_tokens: 1, output_tokens: 1 } }));
 const r = await gateway(request({model:"gpt-test", input:"Hi"}), "responses", "claude-n-codex");
 expect(r.status).toBe(200);
 expect((await r.json()).model).toBe("gpt-test");
 expect(f.send).toHaveBeenCalled();
});
it("rejects native IDs absent from the key's allowed catalog", async () => {
 f.lookupFound = false; f.allowed = false;
 const r = await gateway(request({model:"gpt-test", input:"Hi"}), "responses", "claude-n-codex");
 expect(r.status).toBe(404); expect(f.send).not.toHaveBeenCalled();
});

it("preserves safe configuration errors instead of masking them as 502", async () => {
 const { AppError } = await import("@/lib/errors");
 f.send.mockRejectedValue(new AppError("provider_not_configured", "The selected upstream endpoint is not configured.",503));
 const r = await gateway(request({model:"gpt-test",input:"Hi"}),"responses","claude-n-codex");
 expect(r.status).toBe(503); expect((await r.json()).error.code).toBe("provider_not_configured");
});
it("does not expose transport errors containing credentials", async () => {
 f.send.mockRejectedValue(new Error("secret-key-at-private-url"));
 const r = await gateway(request({model:"gpt-test",input:"Hi"}),"responses","claude-n-codex");
 expect(r.status).toBe(502); const body = await r.text(); expect(body).toContain("provider_connection_failed"); expect(body).not.toContain("secret-key");
});

it("forwards requested output unchanged for upstream enforcement", async () => {
 f.send.mockResolvedValue(Response.json({model:"gpt-test",output:[],usage:{input_tokens:1,output_tokens:1}}));
 const r = await gateway(request({model:"gpt-test",input:"Hi",max_output_tokens:10000}),"responses","claude-n-codex");
 expect(r.status).toBe(200);
 expect(f.send.mock.calls[0][1].max_output_tokens).toBe(10000);
});
it("forwards thinking budgets without a local output cap", async () => {
 f.send.mockResolvedValue(Response.json({model:"gpt-test",output:[]}));
 const r = await gateway(request({model:"gpt-test",input:"Hi",max_output_tokens:10000,thinking:{type:"enabled",budget_tokens:1000}}),"responses","claude-n-codex");
 expect(r.status).toBe(200); expect(f.send.mock.calls[0][1].thinking.budget_tokens).toBe(1000);
});

it("does not inject a model output default when the client omits it", async () => {
 f.send.mockResolvedValue(Response.json({model:"gpt-test",output:[]}));
 const r = await gateway(request({model:"gpt-test",input:"Hi"}),"responses","claude-n-codex");
 expect(r.status).toBe(200); expect(f.send.mock.calls[0][1]).not.toHaveProperty("max_output_tokens");
});
