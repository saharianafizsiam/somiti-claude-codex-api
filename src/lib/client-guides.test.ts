import { describe, expect, it } from "vitest";
import {
  clientGuides,
  compatibleModels,
  connectionGuide,
} from "./client-guides";
describe("v2 client guides", () => {
  const claude = {
    id: "v2/claude-example",
    name: "Claude",
    openai: false,
    anthropic: true,
    tools: true,
    contextWindow: 64000,
    maxOutputTokens: 2048,
  };
  const gpt = {
    ...claude,
    id: "v2/gpt-example",
    name: "GPT",
    openai: true,
    anthropic: false,
  };
  it("contains all 38 unique entries and restricts protocols", () => {
    expect(clientGuides).toHaveLength(38);
    expect(new Set(clientGuides.map((g) => g.id)).size).toBe(38);
    for (const g of clientGuides) {
      const models = compatibleModels(g, [claude, gpt]);
      if (g.protocol === "responses") expect(models).toHaveLength(0);
      if (g.protocol === "anthropic") expect(models).toEqual([claude]);
      if (g.protocol === "openai") expect(models).toEqual([gpt]);
    }
  });
  it("uses only Somiti connection values and renders valid JSON configs", () => {
    for (const guide of clientGuides)
      for (const model of compatibleModels(guide, [claude, gpt]))
        for (const os of ["unix", "windows"] as const) {
          const content = connectionGuide(
            guide,
            model,
            "https://api.somiti.page/v2",
            "sk-somiti_TEST",
            os,
          );
          expect(JSON.stringify(content)).not.toMatch(
            /mwapi|claude-n-codex|freemodel|sk-myapi/i,
          );
          expect(content.endpoint).toMatch(
            /^https:\/\/api\.somiti\.page\/v2\/(messages|chat\/completions)$/,
          );
          for (const snippet of content.snippets)
            if (snippet.title.includes(".json"))
              expect(() => JSON.parse(snippet.code)).not.toThrow();
        }
  });
  it("uses model-specific limits and explicit Anthropic SDK base URL", () => {
    const guide = clientGuides.find((g) => g.id === "claude-code")!;
    const result = connectionGuide(
      guide,
      claude,
      "https://api.somiti.page/v2/",
      "YOUR_SOMITI_API_KEY",
      "windows",
    );
    const env = JSON.parse(result.snippets[0].code).env;
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.somiti.page/v2");
    expect(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBe("2048");
    expect(result.snippets[1].code).toContain("$env:ANTHROPIC_MODEL");
  });
});
