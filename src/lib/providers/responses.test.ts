import { describe, it, expect } from "vitest";
import { UsageCollector, PublicStream } from "./sse";
import { normalizeUsage } from "./usage";
describe("Responses protocol", () => {
  it("preserves required Anthropic tool arguments across byte-split streams", () => {
    for (const input of [
      { file_path: "/tmp/sheet-005.jpg" },
      { to: "evidence-agent", message: "Check frame 5." },
    ]) {
      const json = JSON.stringify(input);
      const events = [
        {
          type: "content_block_start",
          index: 0,
          content_block: {
            type: "tool_use",
            id: "tool_1",
            name: "diagnostic",
            input: {},
          },
        },
        ...[json.slice(0, 9), json.slice(9)].map((partial_json) => ({
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json },
        })),
        { type: "content_block_stop", index: 0 },
      ];
      const stream = new PublicStream("public");
      const bytes = new TextEncoder().encode(
        events
          .map((e) => `event: ${e.type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`)
          .join(""),
      );
      let output = "";
      for (const byte of bytes)
        output += new TextDecoder().decode(stream.push(new Uint8Array([byte])));
      const parsed = output
        .split("\n\n")
        .filter(Boolean)
        .map((frame) =>
          JSON.parse(
            frame
              .split("\n")
              .find((l) => l.startsWith("data:"))!
              .slice(5),
          ),
        );
      expect(parsed).toEqual(events);
      expect(
        JSON.parse(
          parsed
            .filter((e) => e.delta)
            .map((e) => e.delta.partial_json)
            .join(""),
        ),
      ).toEqual(input);
    }
  });
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
