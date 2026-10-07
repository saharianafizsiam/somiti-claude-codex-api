const importedDescription = "Imported from API catalog. Uses the account family's standard endpoint; generation availability depends on the assigned key.";
// Compatibility for untouched import defaults; explicit admin edits own their flags.
export function importedCapabilities<T extends { provider: string; family: string; description?: string | null; supportsTools: boolean; supportsReasoning: boolean; supportsOpenaiEndpoint: boolean }>(model: T): T {
 if (model.description !== importedDescription || !["mwapi", "claude-n-codex"].includes(model.provider) || !["CLAUDE", "OPENAI"].includes(model.family)) return model;
 return { ...model, supportsTools: true, supportsReasoning: true, supportsOpenaiEndpoint: model.supportsOpenaiEndpoint || model.provider === "claude-n-codex" || model.family === "OPENAI" };
}
