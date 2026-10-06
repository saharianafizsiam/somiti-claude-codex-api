import { compatibleProvider, configured } from "./compatible";
import type { Endpoint } from "./types";
export { normalizeUsage } from "./usage";
export const mwapi = compatibleProvider("MWAPI");
export const providerConfigured = (endpoint?: Endpoint) =>
  configured("MWAPI", endpoint);
