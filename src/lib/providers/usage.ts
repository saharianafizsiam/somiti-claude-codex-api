import type { NormalizedUsage } from "./types";
import { unavailable } from "./types";
function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function token(v: unknown) {
  return typeof v === "number" &&
    Number.isSafeInteger(v) &&
    v >= 0 &&
    v <= 2147483647
    ? v
    : undefined;
}
export function normalizeUsage(value: unknown): NormalizedUsage {
  const obj = record(value);
  const u = record(obj.usage);
  const details = record(u.prompt_tokens_details);
  const base = token(u.prompt_tokens ?? u.input_tokens);
  const output = token(u.completion_tokens ?? u.output_tokens);
  if (base === undefined || output === undefined) return { ...unavailable };
  const cached = token(details.cached_tokens ?? u.cache_read_input_tokens) ?? 0;
  const input =
    u.prompt_tokens !== undefined
      ? base
      : base + cached + (token(u.cache_creation_input_tokens) ?? 0);
  if (cached > input || input + output > 2147483647) return { ...unavailable };
  return {
    inputTokens: input,
    outputTokens: output,
    cachedTokens: cached,
    totalTokens: input + output,
    status: "CONFIRMED",
  };
}
