import { mwapi } from "./mwapi";
import { AppError } from "../errors";
import { claudeNCodex } from "./claude-n-codex";
import { compatibleProvider } from "./compatible";
export function provider(name: string, family?: string) {
  if (name === "claude-n-codex")
    return family ? compatibleProvider("CLAUDE_N_CODEX", family) : claudeNCodex;
  if (name !== "mwapi")
    throw new AppError(
      "provider_not_configured",
      "Provider adapter not configured.",
      503,
    );
  return mwapi;
}
