// Client-facing Anthropic names resolve only within the key's allowed catalog.
export function resolveClientAlias<
  T extends {
    provider: string;
    family: string;
    upstreamModelId: string;
    publicModelId: string;
  },
>(id: string, provider: string, catalog: T[]): T | undefined {
  if (!id.startsWith("anthropic/")) return undefined;
  const requested = id.slice("anthropic/".length).toLowerCase();
  const normalize = (v: string) =>
    v
      .toLowerCase()
      .replace(/^claude-/, "")
      .replace(/^(opus|sonnet|fable)-/, "$1")
      .replace(/(?<=\d)-(?=\d)/g, ".");
  if (!/^(?:claude-)?(?:opus|sonnet|fable)[a-z0-9.\[\]-]*$/.test(requested))
    return undefined;
  return catalog.find(
    (m) =>
      m.provider === provider &&
      m.family === "CLAUDE" &&
      normalize(m.upstreamModelId) === normalize(requested),
  );
}
