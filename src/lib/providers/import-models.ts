import { createHash } from "node:crypto";
export function importedModel(
  provider: "mwapi" | "claude-n-codex",
  family: "CLAUDE" | "OPENAI",
  row: { id: string; name: string },
) {
  const route = provider === "mwapi" ? "v1" : "v2";
  const safe = row.id.replace(/[^a-zA-Z0-9._:/-]/g, "-");
  const suffix =
    safe !== row.id || safe.length > 130
      ? `-${createHash("sha256").update(row.id).digest("hex").slice(0, 12)}`
      : "";
  return {
    provider,
    family,
    publicModelId: `${route}/${safe.slice(0, 130)}${suffix}`,
    upstreamModelId: row.id,
    displayName: row.name,
    enabled: false,
    visible: true,
    supportsOpenaiEndpoint: false,
    supportsAnthropicEndpoint: false,
    supportsStreaming: false,
    description:
      "Imported from API catalog. Review endpoint support and limits, then enable.",
  };
}
