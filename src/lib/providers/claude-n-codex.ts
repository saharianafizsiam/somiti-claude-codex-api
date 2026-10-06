import { compatibleProvider, configured } from "./compatible";
import type { Endpoint } from "./types";
export const claudeNCodex = compatibleProvider("CLAUDE_N_CODEX");
export const claudeNCodexConfigured = (endpoint?: Endpoint) =>
  configured("CLAUDE_N_CODEX", endpoint);
