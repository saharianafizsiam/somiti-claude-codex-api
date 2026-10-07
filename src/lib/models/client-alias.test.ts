import { it, expect } from "vitest";
import { resolveClientAlias } from "./client-alias";
it("resolves Anthropic client spelling only inside the allowed provider catalog", () => {
  const model = {
    provider: "claude-n-codex",
    family: "CLAUDE",
    upstreamModelId: "claude-opus-5.5",
    publicModelId: "v2/claude-opus-5.5",
  };
  expect(
    resolveClientAlias("anthropic/opus5.5", "claude-n-codex", [model]),
  ).toBe(model);
  expect(
    resolveClientAlias("anthropic/opus5.5", "mwapi", [model]),
  ).toBeUndefined();
  expect(
    resolveClientAlias("anthropic/opus5.5", "claude-n-codex", []),
  ).toBeUndefined();
  expect(
    resolveClientAlias("anthropic/gpt-5.5", "claude-n-codex", [model]),
  ).toBeUndefined();
});
