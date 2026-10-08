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
      if (g.protocol === "responses") expect(models).toEqual([claude, gpt]);
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
            /^https:\/\/api\.somiti\.page\/v2\/(messages|chat\/completions|responses)$/,
          );
          for (const snippet of content.snippets)
            if (snippet.title.includes(".json"))
              expect(() => JSON.parse(snippet.code)).not.toThrow();
        }
  });
  it("does not inject output caps and uses explicit Anthropic SDK base URL", () => {
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
    expect(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS).toBeUndefined();
    expect(result.snippets[1].code).toContain("$env:ANTHROPIC_MODEL");
  });
});

it("Cursor prefers a neutral allowed alias and uses the Somiti route", () => {
  const guide = clientGuides.find((g) => g.id === "cursor")!;
  const alias = {
    id: "v2/sonnet-5",
    name: "Sonnet",
    openai: true,
    anthropic: true,
  };
  expect(
    compatibleModels(guide, [{ ...alias, id: "v2/claude-sonnet-5" }, alias]),
  ).toEqual([alias]);
  const result = connectionGuide(
    guide,
    alias,
    "https://api.somiti.page/v2",
    "YOUR_SOMITI_API_KEY",
    "unix",
  );
  expect(result.fields).toContainEqual({
    label: "Override OpenAI Base URL",
    value: "https://api.somiti.page/v2",
  });
  expect(result.fields).toContainEqual({
    label: "Custom model ID",
    value: alias.id,
  });
});

it("v1 setup keeps customer credentials and models on the assigned route", () => {
  const model = {
    id: "v1/claude-test",
    name: "Claude",
    openai: false,
    anthropic: true,
  };
  const claude = connectionGuide(
    clientGuides.find((g) => g.id === "claude-code")!,
    model,
    "https://api.somiti.page/v1",
    "YOUR_SOMITI_API_KEY",
    "windows",
  );
  expect(JSON.parse(claude.snippets[0].code).env.ANTHROPIC_BASE_URL).toBe(
    "https://api.somiti.page/v1",
  );
  const open = connectionGuide(
    clientGuides.find((g) => g.id === "opencode")!,
    model,
    "https://api.somiti.page/v1",
    "YOUR_SOMITI_API_KEY",
    "unix",
  );
  const config = JSON.parse(open.snippets[0].code);
  expect(config.provider.somiti.options.baseURL).toBe(
    "https://api.somiti.page/v1",
  );
  expect(config.provider.somiti.npm).toBe("@ai-sdk/anthropic");
  expect(config.model).toBe("somiti/v1/claude-test");
});

it("uses the supplied client-specific Anthropic settings", () => {
 const model = {id:"claude-sonnet-5",name:"Sonnet 5",anthropic:true,openai:true};
 const guide = (id: string) => connectionGuide(clientGuides.find(g=>g.id===id)!,model,"https://api.somiti.page/v2","customer-key","unix");
 expect(guide("continue").snippets[0].code).toContain('apiBase: "https://api.somiti.page/v2/v1"');
 expect(guide("aider").snippets[0].code).toContain("ANTHROPIC_API_BASE");
 const config=JSON.parse(guide("copilot").snippets[0].code);
 expect(config[0].apiType).toBe("messages");
 expect(config[0].models[0].url).toBe("https://api.somiti.page/v2");
});
