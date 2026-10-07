import { z } from "zod";
import Decimal from "decimal.js";
import type { AccountInfo } from "./account";
const amount = z.number().finite().nonnegative();
const schema = z.object({ code: z.literal(0), data: z.object({ groups: z.array(z.object({
  rate_multiplier: amount, peak_rate_enabled: z.boolean(),
  models: z.array(z.object({ name: z.string(), time_pricing: z.unknown().optional(), pricing: z.object({
    billing_mode: z.literal("token"), input_price: amount, output_price: amount,
    cache_read_price: amount, cache_write_price: amount,
    intervals: z.array(z.unknown()),
  }).passthrough() })).max(5000),
})).max(100) }) });
export type PublishedPricing = { prices: AccountInfo["prices"]; note: string };
export function parsePublishedPricing(raw: unknown, catalog: { publicModelId: string; upstreamModelId: string }[]): PublishedPricing {
  const result = schema.safeParse(raw);
  const prices: AccountInfo["prices"] = {};
  if (result.success && result.data.data.groups.length === 1) {
    const group = result.data.data.groups[0];
    if (!group.peak_rate_enabled) for (const model of catalog) {
      const row = group.models.find(m => m.name === model.upstreamModelId);
      if (!row || row.time_pricing || row.pricing.intervals.length) continue;
      const rate = (value: number) => new Decimal(value).mul(1000000).mul(group.rate_multiplier).toFixed();
      prices[model.publicModelId] = { input: rate(row.pricing.input_price), output: rate(row.pricing.output_price), cacheRead: rate(row.pricing.cache_read_price), cacheWrite: rate(row.pricing.cache_write_price) };
    }
  }
  return { prices, note: "Published API v1 rates per 1 million tokens, including the published group multiplier. Account discounts or special pricing may differ. Your balance reflects actual charges. Missing or variable rates are shown as unavailable." };
}
export async function publishedPricing(provider: string | null, catalog: { publicModelId: string; upstreamModelId: string }[]): Promise<PublishedPricing | null> {
  if (provider !== "mwapi") return null;
  try {
    const response = await fetch("https://api.mwapi.dev/api/v1/model-plaza", { signal: AbortSignal.timeout(8000), redirect: "error", next: { revalidate: 300 } });
    if (!response.ok) return parsePublishedPricing(null, catalog);
    return parsePublishedPricing(await response.json(), catalog);
  } catch { return parsePublishedPricing(null, catalog); }
}
