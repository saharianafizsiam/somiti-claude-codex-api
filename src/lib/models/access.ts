import type { ApiKey, Model } from "../db/schema";
export function canAccess(
  key: Pick<ApiKey, "modelAccessMode">,
  model: Pick<
    Model,
    "id" | "enabled" | "visible" | "archivedAt" | "autoFamilyAccess" | "family"
  >,
  selected: string[] = [],
) {
  if (!model.enabled || !model.visible || model.archivedAt) return false;
  if (key.modelAccessMode === "CUSTOM") return selected.includes(model.id);
  if (!model.autoFamilyAccess) return false;
  return (
    (model.family === "CLAUDE" &&
      ["CLAUDE_ONLY", "CLAUDE_AND_OPENAI"].includes(key.modelAccessMode)) ||
    (model.family === "OPENAI" &&
      ["OPENAI_ONLY", "CLAUDE_AND_OPENAI"].includes(key.modelAccessMode))
  );
}
