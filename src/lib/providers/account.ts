import { z } from "zod";
import { decrypt } from "../security/secrets";
import type { ApiKey } from "../db/schema";
const num = z.number().finite().nonnegative();
const money = z
  .union([z.string().regex(/^\d+(\.\d+)?$/), num])
  .transform(String);
const row = z.object({
  created_at: z.string(),
  model: z.string(),
  status: z.number().int(),
  input_tokens: num.nullable(),
  output_tokens: num.nullable(),
  cache_read_tokens: num.nullable(),
  cache_write_tokens: num.nullable(),
  charged_usd: money.nullable(),
  ttft_ms: num.nullable(),
  duration_ms: num.nullable(),
});
const historySchema = z.object({ total: num, requests: z.array(row).max(100) });
const statsSchema = z.object({
  unit: z.literal("usd"),
  latency: z.object({ p50_ms: num.nullable(), p95_ms: num.nullable() }),
  today: z.object({ requests: num, charged_usd: money }),
  cache: z.object({ hit_rate: num.nullable() }),
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        requests: num,
        errors: num,
        charged_usd: money,
        input_tokens: num.optional(),
        output_tokens: num.optional(),
        cache_read_tokens: num.optional(),
        cache_write_tokens: num.optional(),
      }),
    )
    .max(366),
});
const pricesSchema = z.object({
  models: z
    .array(
      z.object({
        model: z.string(),
        input_usd_per_mtok: money,
        output_usd_per_mtok: money,
        cache_read_usd_per_mtok: money,
        cache_write_usd_per_mtok: money,
      }),
    )
    .max(5000),
});
type BoundKey = Pick<ApiKey, "upstreamProvider" | "encryptedUpstreamKey">;
type Catalog = { publicModelId: string; upstreamModelId: string }[];
export type AccountLog = {
  id: string;
  model: string;
  created: string;
  status: string;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  charged: string | null;
  ttft: number | null;
  latency: number | null;
};
export type AccountInfo = {
  history: { total: number; logs: AccountLog[] } | null;
  stats: {
    requests: number;
    success: number | null;
    latency: number | null;
    p95: number | null;
    cacheHit: number | null;
    today: number;
    todaySpend: string;
    tokens: {
      input: number | null;
      output: number | null;
      cacheRead: number | null;
      cacheWrite: number | null;
    };
    days: { date: string; spend: string; requests: number; errors: number }[];
  } | null;
  prices: Record<
    string,
    { input: string; output: string; cacheRead: string; cacheWrite: string }
  >;
};
async function readAccount(key: BoundKey, path: string) {
  if (key.upstreamProvider !== "claude-n-codex" || !key.encryptedUpstreamKey)
    return null;
  try {
    const url = new URL(
      `https://claude-n-codex.com/api/backend/key-dashboard-v1${path}`,
    );
    url.searchParams.set("api_key", decrypt(key.encryptedUpstreamKey));
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } // Do not log URLs, raw responses or credentials.
}
export function parseAccountHistory(
  body: unknown,
  catalog: Catalog,
  offset = 0,
) {
  const parsed = historySchema.safeParse(body);
  if (!parsed.success) return null;
  const logs: AccountLog[] = parsed.data.requests.map((r, i) => {
    const validId =
      /^[a-zA-Z0-9._:/\[\]-]{1,150}$/.test(r.model) &&
      !/sk-|https?:|mwapi|claude-n-codex/i.test(r.model);
    const name =
      catalog.find((m) => m.upstreamModelId === r.model)?.publicModelId ||
      (validId ? `v2/${r.model}` : "Unknown model");
    const timestamp = Date.parse(
      /(?:Z|[+-]\d\d:\d\d)$/.test(r.created_at)
        ? r.created_at
        : `${r.created_at}Z`,
    );
    return {
      id: `account-${offset + i}`,
      model: name,
      created: Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : "",
      status: String(r.status),
      input: r.input_tokens,
      output: r.output_tokens,
      cacheRead: r.cache_read_tokens,
      cacheWrite: r.cache_write_tokens,
      charged: r.charged_usd,
      ttft: r.ttft_ms,
      latency: r.duration_ms,
    };
  });
  return { total: parsed.data.total, logs };
}
export async function accountHistory(
  key: BoundKey,
  catalog: Catalog,
  page = 1,
) {
  const offset = (page - 1) * 25;
  return parseAccountHistory(
    await readAccount(key, `/requests?offset=${offset}&limit=25`),
    catalog,
    offset,
  );
}
export function parseAccountStats(body: unknown): AccountInfo["stats"] {
  const parsed = statsSchema.safeParse(body);
  if (!parsed.success) return null;
  const s = parsed.data,
    requests = s.days.reduce((n, d) => n + d.requests, 0),
    errors = s.days.reduce((n, d) => n + d.errors, 0);
  return {
    requests,
    success: requests
      ? Math.max(0, ((requests - errors) / requests) * 100)
      : null,
    latency: s.latency.p50_ms,
    p95: s.latency.p95_ms,
    cacheHit:
      s.cache.hit_rate === null ? null : Math.min(100, s.cache.hit_rate * 100),
    today: s.today.requests,
    todaySpend: s.today.charged_usd,
    tokens: {
      input: s.days.every((d) => d.input_tokens !== undefined)
        ? s.days.reduce((n, d) => n + d.input_tokens!, 0)
        : null,
      output: s.days.every((d) => d.output_tokens !== undefined)
        ? s.days.reduce((n, d) => n + d.output_tokens!, 0)
        : null,
      cacheRead: s.days.every((d) => d.cache_read_tokens !== undefined)
        ? s.days.reduce((n, d) => n + d.cache_read_tokens!, 0)
        : null,
      cacheWrite: s.days.every((d) => d.cache_write_tokens !== undefined)
        ? s.days.reduce((n, d) => n + d.cache_write_tokens!, 0)
        : null,
    },
    days: s.days
      .map((d) => ({
        date: d.date,
        spend: d.charged_usd,
        requests: d.requests,
        errors: d.errors,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
export async function keyAccount(
  key: BoundKey,
  catalog: Catalog,
): Promise<AccountInfo | null> {
  if (key.upstreamProvider !== "claude-n-codex") return null;
  const [history, stats, priceBody] = await Promise.all([
    accountHistory(key, catalog),
    readAccount(key, "/stats?days=30&tz_offset=0"),
    readAccount(key, "?include_requests=false"),
  ]);
  const prices: AccountInfo["prices"] = {};
  const parsed = pricesSchema.safeParse(priceBody);
  if (parsed.success)
    for (const m of catalog) {
      const price = parsed.data.models.find(
        (p) => p.model === m.upstreamModelId,
      );
      if (price)
        prices[m.publicModelId] = {
          input: price.input_usd_per_mtok,
          output: price.output_usd_per_mtok,
          cacheRead: price.cache_read_usd_per_mtok,
          cacheWrite: price.cache_write_usd_per_mtok,
        };
    }
  return { history, stats: parseAccountStats(stats), prices };
}
