// Keep database IDs stable; expose provider-native IDs on the v2 API boundary.
export function customerModelId(model: { provider: string; publicModelId: string; upstreamModelId: string }) {
  return model.provider === "claude-n-codex" ? model.upstreamModelId : model.publicModelId;
}
export function customerCatalog<T extends { provider: string; publicModelId: string; upstreamModelId: string }>(models: T[]): T[] {
  return models.map(model => ({ ...model, publicModelId: customerModelId(model) }));
}

// Filter presentation only. Authorization and request resolution retain every alias.
export function discoveryCatalog<T extends { provider: string; publicModelId: string; upstreamModelId: string }>(models: T[]): T[] {
  const normalized = (id: string) => id.replace(/^claude-/, "").replace(/(?<=\d)[.-](?=\d)/g, ".");
  const groups = new Map<string, T>();
  for (const model of models) {
    if (model.provider !== "claude-n-codex") { groups.set(model.provider + ":" + model.publicModelId, model); continue; }
    const id = model.upstreamModelId;
    // Floating aliases are redundant when this key exposes versioned members.
    if (["opus", "sonnet", "fable"].includes(id) && models.some(m => m.provider === model.provider && normalized(m.upstreamModelId).startsWith(id + "-"))) continue;
    const key = model.provider + ":" + normalized(id);
    const previous = groups.get(key);
    const rank = (value: string) => (value.startsWith("claude-") ? 2 : 0) + (value.includes(".") ? 0 : 1);
    if (!previous || rank(id) > rank(previous.upstreamModelId)) groups.set(key, model);
  }
  return [...groups.values()];
}
