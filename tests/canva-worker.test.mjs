import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { sentConfirmation, watchConfirmation } from "../ops/canva/confirmation.mjs";

// Run one worker cycle with fake browser/API boundaries. No Canva connection,
// credentials, timers, or real invitations are used.
const source = readFileSync(new URL("../ops/canva/worker.mjs", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "");

async function cycle({ confirmed = true, clickError = false, empty = false } = {}) {
  const job = { id: "job-1", email: "test@ysscripts.dev", claimToken: "claim-1" };
  const watcher = {
    evaluate: vi.fn(async (fn) => fn({ confirmed, stop() {} })),
    dispose: vi.fn(async () => {}),
  };
  const field = {
    waitFor: vi.fn(async () => {}),
    fill: vi.fn(async () => {}),
    inputValue: vi.fn(async () => job.email),
  };
  const send = {
    waitFor: vi.fn(async () => {}),
    click: vi.fn(async () => {
      if (clickError) throw new Error("Click failed after page update");
    }),
  };
  const page = {
    url: () => "https://www.canva.com/team/people",
    bringToFront: async () => {},
    reload: async () => {},
    getByRole: (_role, { name }) => name.test("Invite students")
      ? { waitFor: async () => {}, click: async () => {} }
      : { first: () => send },
    getByPlaceholder: () => ({ nth: () => field, count: async () => 1 }),
    getByText: () => ({ count: async () => 1 }),
    evaluateHandle: vi.fn(async () => watcher),
  };
  const fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () => url.pathname.endsWith("/claim")
      ? { job: empty ? null : job }
      : { ok: true },
  }));
  let now = 0;
  await runInNewContext(`(async () => { ${source}\n })()`, {
    chromium: { connectOverCDP: async () => ({
      isConnected: () => true,
      contexts: () => [{ pages: () => [page] }],
      on() {},
    }) },
    sentConfirmation,
    watchConfirmation,
    process: { env: { CANVA_WORKER_SECRET: "fixture-secret".repeat(4) } },
    URL,
    fetch,
    console: { error: vi.fn() },
    Date: { now: () => { now += 10_000; return now; } },
    setTimeout: (fn) => { fn(); },
    setInterval: vi.fn(),
  });
  const requests = fetch.mock.calls.map(([url, options]) => ({
    action: url.pathname.split("/").at(-1),
    body: options.body ? JSON.parse(options.body) : undefined,
  }));
  return { requests, job, field, send, watcher };
}

describe("Canva single-invitation worker", () => {
  it("claims and finishes only one job after a fresh confirmation", async () => {
    const result = await cycle();
    expect(result.requests).toEqual([
      { action: "claim", body: undefined },
      { action: "finish", body: {
        id: result.job.id, claimToken: result.job.claimToken, outcome: "SENT",
      } },
    ]);
    expect(result.field.fill).toHaveBeenCalledExactlyOnceWith(result.job.email);
    expect(result.send.click).toHaveBeenCalledTimes(1);
    expect(result.watcher.dispose).toHaveBeenCalledTimes(1);
  });
  it("preserves confirmation even when the click rejects after the page updates", async () => {
    const result = await cycle({ clickError: true });
    expect(result.requests[1].body.outcome).toBe("SENT");
    expect(result.send.click).toHaveBeenCalledTimes(1);
  });
  it("keeps unconfirmed delivery in review without clicking again", async () => {
    const result = await cycle({ confirmed: false });
    expect(result.requests[1].body.outcome).toBe("REVIEW");
    expect(result.send.click).toHaveBeenCalledTimes(1);
    expect(result.watcher.dispose).toHaveBeenCalledTimes(1);
  });
  it("does not send or finish anything when the queue has no claim", async () => {
    const result = await cycle({ empty: true });
    expect(result.requests).toEqual([{ action: "claim", body: undefined }]);
    expect(result.send.click).not.toHaveBeenCalled();
  });
});
