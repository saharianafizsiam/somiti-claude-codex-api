import { afterEach, describe, expect, it, vi } from "vitest";
import { keyQuota } from "../src/lib/providers/quota";
import { encrypt } from "../src/lib/security/secrets";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Customer quota", () => {
  it("uses only the assigned credential and returns an allowlisted balance", async () => {
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "12".repeat(32));
    const mock = vi.fn(async () =>
      Response.json({
        quota: { limit: 10, used: 3, remaining: 7, unit: "USD" },
        api_key: "private",
        provider: "mwapi",
      }),
    );
    vi.stubGlobal("fetch", mock);
    const result = await keyQuota({
      upstreamProvider: "mwapi",
      encryptedUpstreamKey: encrypt("customer-A"),
    });
    expect(result.remaining).toBe("7");
    expect(JSON.stringify(result)).not.toMatch(/private|mwapi|customer-A/);
    expect(mock.mock.calls[0]).toBeDefined();
  });
  it("reads second-provider quota without returning its credential or metadata", async () => {
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "12".repeat(32));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        expect(url.searchParams.get("api_key")).toBe("customer-B");
        return Response.json({
          usd_allocation: "5",
          used_usd: "2",
          remaining_usd: "3",
          provider_kind: "private",
        });
      }),
    );
    const result = await keyQuota({
      upstreamProvider: "claude-n-codex",
      encryptedUpstreamKey: encrypt("customer-B"),
    });
    expect(result.remaining).toBe("3");
    expect(JSON.stringify(result)).not.toMatch(/private|customer-B/);
  });
  it("does not invent zero balance when quota is unavailable", async () => {
    vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "12".repeat(32));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("secret error", { status: 500 })),
    );
    expect(
      (
        await keyQuota({
          upstreamProvider: "mwapi",
          encryptedUpstreamKey: encrypt("customer-A"),
        })
      ).remaining,
    ).toBeNull();
  });
});
