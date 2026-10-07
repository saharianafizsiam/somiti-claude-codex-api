import { describe, it, expect } from "vitest";
import { UsageCollector, PublicStream } from "./sse";
import { normalizeUsage } from "./usage";
describe("Responses protocol", () => {
  const response = {
    model: "private-model",
    usage: {
      input_tokens: 100,
      output_tokens: 10,
      input_tokens_details: { cached_tokens: 80 },
    },
  };
  it("counts cached input once", () =>
    expect(normalizeUsage(response)).toMatchObject({
      inputTokens: 100,
      cachedTokens: 80,
      totalTokens: 110,
      status: "CONFIRMED",
    }));
  it("collects nested final usage across split stream chunks", () => {
    const bytes = new TextEncoder().encode(
      `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response })}\n\n`,
    );
    const usage = new UsageCollector();
    const stream = new PublicStream("v2/public");
    let result = "";
    for (const b of bytes) {
      const chunk = new Uint8Array([b]);
      usage.push(chunk);
      result += new TextDecoder().decode(stream.push(chunk));
    }
    expect(usage.usage.totalTokens).toBe(110);
    expect(usage.responseCompleted).toBe(true);
    expect(result).toContain("v2/public");
    expect(result).not.toContain("private-model");
  });
  it("marks failed streams and redacts provider errors", () => {
    const bytes = new TextEncoder().encode(
      'event: response.failed\ndata: {"type":"response.failed","response":{"error":{"message":"private credential"}}}\n\n',
    );
    const collector = new UsageCollector();
    collector.push(bytes);
    expect(collector.failed).toBe(true);
    expect(
      new TextDecoder().decode(new PublicStream("public").push(bytes)),
    ).not.toContain("private credential");
  });
});
