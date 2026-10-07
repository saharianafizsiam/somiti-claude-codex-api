import { describe, expect, it } from "vitest";
import { importedModel } from "./import-models";
describe("catalog imports", () => {
  it("separates routes and preserves the exact upstream ID", () => {
    const row = { id: "claude-opus-5", name: "Claude Opus 5" };
    const a = importedModel("mwapi", "CLAUDE", row);
    const b = importedModel("claude-n-codex", "CLAUDE", row);
    expect(a.publicModelId).not.toBe(b.publicModelId);
    expect(b.supportsOpenaiEndpoint).toBe(true);
    expect(b.supportsAnthropicEndpoint).toBe(true);
    expect(b.supportsTools).toBe(true);
    expect(b.supportsReasoning).toBe(true);
    expect(a.supportsTools).toBe(true);
    expect(a.upstreamModelId).toBe(row.id);
    expect(a.enabled).toBe(true);
    expect(a.supportsOpenaiEndpoint).toBe(false);
    expect(a.supportsAnthropicEndpoint).toBe(true);
    const gpt = importedModel("claude-n-codex", "OPENAI", {
      id: "gpt-test",
      name: "GPT",
    });
    expect(gpt.supportsOpenaiEndpoint).toBe(true);
    expect(gpt.supportsAnthropicEndpoint).toBe(false);
  });
  it("does not collapse IDs when sanitizing or truncating", () => {
    const make = (id: string) =>
      importedModel("mwapi", "CLAUDE", { id, name: id }).publicModelId;
    expect(make("model[1m]")).not.toBe(make("model-1m-"));
    expect(make("a".repeat(200))).toHaveLength(146);
  });
});
