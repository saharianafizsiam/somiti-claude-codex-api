import { describe, expect, it } from "vitest";
import { importedModel } from "./import-models";
describe("catalog imports", () => {
  it("separates routes and preserves the exact upstream ID", () => {
    const row = { id: "claude-opus-5", name: "Claude Opus 5" };
    const a = importedModel("mwapi", "CLAUDE", row);
    const b = importedModel("claude-n-codex", "CLAUDE", row);
    expect(a.publicModelId).not.toBe(b.publicModelId);
    expect(a.upstreamModelId).toBe(row.id);
    expect(a.enabled).toBe(false);
    expect(a.supportsOpenaiEndpoint).toBe(false);
  });
  it("does not collapse IDs when sanitizing or truncating", () => {
    const make = (id: string) =>
      importedModel("mwapi", "CLAUDE", { id, name: id }).publicModelId;
    expect(make("model[1m]")).not.toBe(make("model-1m-"));
    expect(make("a".repeat(200))).toHaveLength(146);
  });
});
