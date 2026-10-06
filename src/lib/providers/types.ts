export type Endpoint = "chat/completions" | "messages";
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  status: "CONFIRMED" | "ESTIMATED" | "UNAVAILABLE";
}
export const unavailable: NormalizedUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  totalTokens: 0,
  status: "UNAVAILABLE",
};
export interface AIProvider {
  send(
    endpoint: Endpoint,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<Response>;
  normalizeUsage(value: unknown): NormalizedUsage;
}
