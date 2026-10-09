import { describe, it, expect } from "vitest";
import { parseAccountHistory, parseAccountStats, filterHistoryPage, type AccountLog } from "./account";

it("filters used models across pages before pagination", () => {
  const logs = Array.from({length:80},(_,i)=>({id:String(i),model:i%2 ? "sonnet" : "opus"}) as AccountLog);
  const page = filterHistoryPage(logs,2,"sonnet");
  expect(page.total).toBe(40);
  expect(page.logs).toHaveLength(15);
  expect(page.logs.every(l=>l.model==="sonnet")).toBe(true);
  expect(page.models).toEqual(["opus","sonnet"]);
  expect(filterHistoryPage(logs,1,"unused").logs).toEqual([]);
});
describe("account dashboard data", () => {
  const request = {
    created_at: "2026-10-06T17:02:46",
    model: "claude-test",
    status: 200,
    input_tokens: 254,
    output_tokens: 98,
    cache_read_tokens: 86195,
    cache_write_tokens: 1335,
    charged_usd: "0.0221",
    ttft_ms: 1910,
    duration_ms: 4010,
    error_message: "private credential",
    api_key: "secret",
  };
  it("maps history and exposes only public fields", () => {
    const result = parseAccountHistory({ total: 1549, requests: [request] }, [
      { upstreamModelId: "claude-test", publicModelId: "v2/claude-test" },
    ])!;
    expect(result.total).toBe(1549);
    expect(result.logs[0]).toMatchObject({
      model: "v2/claude-test",
      charged: "0.0221",
      cacheRead: 86195,
      ttft: 1910,
      created: "2026-10-06T17:02:46.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /credential|secret|api_key|error_message/,
    );
  });
  it("redacts suspicious model values and handles invalid responses", () => {
    const result = parseAccountHistory(
      { total: 1, requests: [{ ...request, model: "sk-private-secret" }] },
      [],
    )!;
    expect(result.logs[0].model).toBe("Unknown model");
    expect(parseAccountHistory({ error: "failed" }, [])).toBeNull();
    expect(parseAccountStats({})).toBeNull();
  });
  it("derives full-period metrics from stats, not a 25-row history sample", () => {
    const stats = parseAccountStats({
      unit: "usd",
      latency: { p50_ms: 11400, p95_ms: 148000 },
      today: { requests: 0, charged_usd: "0" },
      cache: { hit_rate: 0.985 },
      days: [
        { date: "2026-10-06", requests: 1000, errors: 2, charged_usd: "95.05" },
      ],
    })!;
    expect(stats.success).toBe(99.8);
    expect(stats.cacheHit).toBe(98.5);
    expect(stats.requests).toBe(1000);
    expect(stats.days[0]).toEqual({
      date: "2026-10-06",
      spend: "95.05",
      requests: 1000,
      errors: 2,
    });
    expect(stats.latency).toBe(11400);
    expect(stats.tokens.input).toBeNull();
  });
  it("sums each token category across daily account statistics", () => {
    const day = {
      date: "2026-10-06",
      requests: 1,
      errors: 0,
      charged_usd: "1",
      input_tokens: 150,
      output_tokens: 190,
      cache_read_tokens: 10150,
      cache_write_tokens: 860,
    };
    const stats = parseAccountStats({
      unit: "usd",
      latency: { p50_ms: 1, p95_ms: 1 },
      today: { requests: 0, charged_usd: "0" },
      cache: { hit_rate: 0.985 },
      days: [day, { ...day, date: "2026-10-07" }],
    })!;
    expect(stats.tokens).toEqual({
      input: 300,
      output: 380,
      cacheRead: 20300,
      cacheWrite: 1720,
    });
  });
});
