import { afterEach, expect, it, vi } from "vitest";
import { provider } from "../src/lib/providers";
import { configured } from "../src/lib/providers/compatible";
import { upstreamModels } from "../src/lib/providers/catalog";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function setup() {
  for (const [prefix, origin, key] of [
    ["MWAPI", "https://mwapi.example", "mwapi-secret"],
    ["CLAUDE_N_CODEX", "https://cnc.example", "cnc-secret"],
  ]) {
    vi.stubEnv(`${prefix}_BASE_URL`, origin);
    vi.stubEnv(`${prefix}_API_KEY`, key);
    vi.stubEnv(`${prefix}_CHAT_PATH`, "/confirmed/chat");
    vi.stubEnv(`${prefix}_MESSAGES_PATH`, "/confirmed/messages");
    vi.stubEnv(`${prefix}_AUTH_HEADER`, "Authorization");
    vi.stubEnv(`${prefix}_AUTH_PREFIX`, "Bearer");
  }
}
it("Routes exclusively to the selected provider with its own credentials", async () => {
  setup();
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  for (const name of ["mwapi", "claude-n-codex"])
    await provider(name).send(
      "chat/completions",
      { model: "example" },
      new AbortController().signal,
    );
  expect(String(fetcher.mock.calls[0][0])).toBe(
    "https://mwapi.example/confirmed/chat",
  );
  expect(String(fetcher.mock.calls[1][0])).toBe(
    "https://cnc.example/confirmed/chat",
  );
  expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty(
    "Authorization",
    "Bearer mwapi-secret",
  );
  expect(fetcher.mock.calls[1][1]?.headers).toHaveProperty(
    "Authorization",
    "Bearer cnc-secret",
  );
});
it("Supports independent Anthropic authentication configuration", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_AUTH_HEADER", "x-api-key");
  vi.stubEnv("CLAUDE_N_CODEX_AUTH_PREFIX", "");
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  await provider("claude-n-codex").send(
    "messages",
    {},
    new AbortController().signal,
  );
  expect(String(fetcher.mock.calls[0][0])).toBe(
    "https://cnc.example/confirmed/messages",
  );
  expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty(
    "x-api-key",
    "cnc-secret",
  );
  expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty(
    "anthropic-version",
    "2023-06-01",
  );
});
it("Fails closed without a second-provider key and never falls back to MWAPI", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_API_KEY", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(configured("CLAUDE_N_CODEX")).toBe(false);
  await expect(
    provider("claude-n-codex").send(
      "messages",
      {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("not configured");
  expect(fetcher).not.toHaveBeenCalled();
});
it("Rejects cross-origin endpoint paths before sending credentials", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_CHAT_PATH", "https://different.example/chat");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    provider("claude-n-codex").send(
      "chat/completions",
      {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("Invalid provider");
  expect(fetcher).not.toHaveBeenCalled();
});
it("Rejects unknown providers", () => {
  expect(() => provider("unknown")).toThrow("not configured");
});
it("Selects separate Claude and OpenAI credentials by family, not endpoint", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_CLAUDE_API_KEY", "claude-account");
  vi.stubEnv("CLAUDE_N_CODEX_OPENAI_API_KEY", "openai-account");
  const f = vi.fn<typeof fetch>(async () => Response.json({}));
  vi.stubGlobal("fetch", f);
  await provider("claude-n-codex", "CLAUDE").send(
    "chat/completions",
    {},
    new AbortController().signal,
  );
  await provider("claude-n-codex", "OPENAI").send(
    "chat/completions",
    {},
    new AbortController().signal,
  );
  expect(f.mock.calls[0][1]?.headers).toHaveProperty(
    "Authorization",
    "Bearer claude-account",
  );
  expect(f.mock.calls[1][1]?.headers).toHaveProperty(
    "Authorization",
    "Bearer openai-account",
  );
});
it("Does not fall back to a shared credential when a family account is missing", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_CLAUDE_API_KEY", "");
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await expect(
    provider("claude-n-codex", "CLAUDE").send(
      "messages",
      {},
      new AbortController().signal,
    ),
  ).rejects.toThrow("not configured");
  expect(f).not.toHaveBeenCalled();
});
it("Discovers models with the selected account and returns only public catalog fields", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_OPENAI_API_KEY", "openai-account");
  vi.stubEnv("CLAUDE_N_CODEX_MODELS_PATH", "/verified/models");
  const f = vi.fn<typeof fetch>(async () =>
    Response.json({
      data: [
        {
          id: "example-model",
          display_name: "Example",
          internalSecret: "hidden",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", f);
  expect(await upstreamModels("claude-n-codex", "OPENAI")).toEqual({
    models: [{ id: "example-model", name: "Example" }],
  });
  expect(f.mock.calls[0][1]?.headers).toHaveProperty(
    "Authorization",
    "Bearer openai-account",
  );
});
it("Requires a verified second-provider catalog path", async () => {
  setup();
  vi.stubEnv("CLAUDE_N_CODEX_OPENAI_API_KEY", "openai-account");
  vi.stubEnv("CLAUDE_N_CODEX_MODELS_PATH", "");
  await expect(upstreamModels("claude-n-codex", "OPENAI")).rejects.toThrow(
    "MODELS_PATH",
  );
});
