import { describe, it, expect } from "vitest";
import { parsePublishedPricing } from "./pricing";
const catalog = [{ publicModelId: "v1/sonnet", upstreamModelId: "sonnet" }];
const group = { rate_multiplier: 5, peak_rate_enabled: false, models: [{ name: "sonnet", pricing: { billing_mode: "token", input_price: 0.000003, output_price: 0.000015, cache_read_price: 0.000003, cache_write_price: 0.000003, intervals: [] } }] };
const payload = (groups: unknown[]) => ({ code: 0, data: { groups } });
describe("published v1 pricing", () => {
  it("converts per-token prices to per-million and applies the published multiplier", () => {
    expect(parsePublishedPricing(payload([group]), catalog).prices["v1/sonnet"]).toEqual({input:"15",output:"75",cacheRead:"15",cacheWrite:"15"});
  });
  it("does not invent prices for unmatched models or ambiguous groups", () => {
    expect(parsePublishedPricing(payload([group, group]), catalog).prices).toEqual({});
    expect(parsePublishedPricing(payload([group]), [{publicModelId:"v1/unknown",upstreamModelId:"unknown"}]).prices).toEqual({});
    expect(parsePublishedPricing(null, catalog).prices).toEqual({});
  });
  it("does not present a flat rate for peak or tiered pricing", () => {
    expect(parsePublishedPricing(payload([{...group,peak_rate_enabled:true}]), catalog).prices).toEqual({});
    expect(parsePublishedPricing(payload([{...group,models:[{...group.models[0],pricing:{...group.models[0].pricing, intervals:[{min_tokens:200000}]}}]}]), catalog).prices).toEqual({});
  });
});
