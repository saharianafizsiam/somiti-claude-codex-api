const importedDescription = "Imported from API catalog. Uses the account family's standard endpoint; generation availability depends on the assigned key.";
// Compatibility for untouched import defaults; explicit admin edits own their flags.
export function importedCapabilities<T extends { provider: string; family: string; description?: string | null; upstreamModelId?: string; supportsVision?: boolean; supportsTools: boolean; supportsReasoning: boolean; supportsOpenaiEndpoint: boolean }>(model: T): T {
 if (model.description !== importedDescription || !["mwapi", "claude-n-codex"].includes(model.provider) || !["CLAUDE", "OPENAI"].includes(model.family)) return model;
 return { ...model, ...(verifiedVision(model.provider, model.upstreamModelId ?? "") ? { supportsVision: true } : {}), supportsTools: true, supportsReasoning: true, supportsOpenaiEndpoint: model.supportsOpenaiEndpoint || model.provider === "claude-n-codex" || model.family === "OPENAI" };
}

export function verifiedVision(provider: string, id: string) {
 // Verified with image + tool requests against the assigned upstream on 2026-10-09.
 const canonical = id.replace(/^claude-/, "").replaceAll(".", "-");
 return provider === "claude-n-codex" && ["fable-5", "fable-5-1", "opus-4-6", "opus-4-7", "opus-4-8", "opus-5", "opus-5-5", "sonnet-4-6", "sonnet-5"].includes(canonical);
}
