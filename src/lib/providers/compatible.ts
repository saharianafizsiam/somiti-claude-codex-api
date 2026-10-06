import { AppError } from "../errors";
import type { AIProvider, Endpoint } from "./types";
import { normalizeUsage } from "./usage";
type Prefix = "MWAPI" | "CLAUDE_N_CODEX";
export function configuration(
  prefix: Prefix,
  endpoint: Endpoint,
  family?: string,
) {
  const env = (suffix: string) => process.env[`${prefix}_${suffix}`];
  return {
    base: env("BASE_URL"),
    key:
      prefix === "CLAUDE_N_CODEX" && family
        ? ["CLAUDE", "OPENAI"].includes(family)
          ? env(`${family}_API_KEY`)
          : undefined
        : env("API_KEY"),
    path: env(endpoint === "messages" ? "MESSAGES_PATH" : "CHAT_PATH"),
    header: env("AUTH_HEADER") || "Authorization",
    authPrefix: env("AUTH_PREFIX") ?? "Bearer",
  };
}
export function configured(
  prefix: Prefix,
  endpoint?: Endpoint,
  family?: string,
): boolean {
  if (!endpoint)
    return (
      configured(prefix, "messages", family) ||
      configured(prefix, "chat/completions", family)
    );
  const c = configuration(prefix, endpoint, family);
  return Boolean(c.base && c.key && c.path);
}
export function compatibleProvider(
  prefix: Prefix,
  family?: string,
): AIProvider {
  return {
    normalizeUsage,
    async send(endpoint, body, signal) {
      const c = configuration(prefix, endpoint, family);
      if (!configured(prefix, endpoint, family) || !c.path || !c.base)
        throw new AppError(
          "provider_not_configured",
          "The selected upstream endpoint is not configured.",
          503,
        );
      // Paths are operator-confirmed; never assume this site's homepage is its API origin.
      const base = new URL(c.base);
      const url = new URL(c.path, base);
      if (
        url.origin !== base.origin ||
        url.username ||
        url.password ||
        !["https:", "http:"].includes(url.protocol) ||
        (url.protocol !== "https:" && process.env.NODE_ENV === "production")
      )
        throw new AppError(
          "provider_not_configured",
          "Invalid provider endpoint configuration.",
          503,
        );
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [c.header]: [c.authPrefix, c.key].filter(Boolean).join(" "),
          ...(endpoint === "messages"
            ? { "anthropic-version": "2023-06-01" }
            : {}),
        },
        body: JSON.stringify(body),
        signal,
        redirect: "error",
        cache: "no-store",
      });
    },
  };
}
