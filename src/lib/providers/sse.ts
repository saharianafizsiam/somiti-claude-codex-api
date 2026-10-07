import { normalizeUsage } from "./usage";
import { unavailable, type NormalizedUsage } from "./types";
export class UsageCollector {
  private buffer = "";
  private decoder = new TextDecoder();
  private anthropic: Record<string, unknown> = {};
  usage: NormalizedUsage = { ...unavailable };
  failed = false;
  responseCompleted = false;
  push(chunk: Uint8Array) {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    if (this.buffer.length > 2_000_000) throw new Error("Oversized SSE frame");
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.buffer))) {
      const frame = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const data = frame
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        const value = JSON.parse(data);
        if (
          value.type === "response.failed" ||
          value.type === "error" ||
          value.error ||
          value.response?.error
        )
          this.failed = true;
        if (
          value.type === "response.completed" ||
          value.type === "response.incomplete"
        )
          this.responseCompleted = true;
        if (value.type === "message_start")
          this.anthropic = value.message?.usage ?? {};
        if (value.type === "message_delta") {
          this.anthropic = { ...this.anthropic, ...value.usage };
          this.usage = normalizeUsage({ usage: this.anthropic });
        } else {
          const usage = normalizeUsage(value);
          if (usage.status === "CONFIRMED") this.usage = usage;
        }
      } catch {
        /* Non-JSON SSE frames do not supply billable usage. */
      }
    }
  }
}
export class PublicStream {
  private buffer = "";
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  constructor(private model: string) {}
  push(chunk: Uint8Array) {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    if (this.buffer.length > 2_000_000) throw new Error("Oversized SSE frame");
    let match: RegExpExecArray | null;
    let result = "";
    while ((match = /\r?\n\r?\n/.exec(this.buffer))) {
      const frame = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const lines = frame.split(/\r?\n/);
      const data = lines
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") {
        result += frame + "\n\n";
        continue;
      }
      try {
        const value = JSON.parse(data);
        if (
          ["codex.response.metadata", "responsesapi.websocket_timing"].includes(
            value.type,
          )
        )
          continue;
        if (value.model) value.model = this.model;
        if (value.message?.model) value.message.model = this.model;
        if (value.response?.model) value.response.model = this.model;
        if (
          value.error ||
          value.response?.error ||
          value.type === "error" ||
          value.type === "response.failed"
        ) {
          result +=
            'event: error\ndata: {"error":{"type":"provider_error","message":"Upstream stream failed."}}\n\n';
          continue;
        }
        result +=
          lines.filter((l) => !l.startsWith("data:")).join("\n") +
          "\ndata: " +
          JSON.stringify(value) +
          "\n\n";
      } catch {
        throw new Error("Invalid provider SSE data");
      }
    }
    return this.encoder.encode(result);
  }
}
