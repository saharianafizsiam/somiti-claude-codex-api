// Keep database IDs stable; expose provider-native IDs on the v2 API boundary.
export function customerModelId(model: { provider: string; publicModelId: string; upstreamModelId: string }) {
  return model.provider === "claude-n-codex" ? model.upstreamModelId : model.publicModelId;
}
export function customerCatalog<T extends { provider: string; publicModelId: string; upstreamModelId: string }>(models: T[]): T[] {
  return models.map(model => ({ ...model, publicModelId: customerModelId(model) }));
}
