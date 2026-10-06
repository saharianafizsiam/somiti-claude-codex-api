import { z } from "zod";
import { configuration } from "./compatible";
import { AppError } from "../errors";
export async function upstreamModels(
  name: "mwapi" | "claude-n-codex",
  family: "CLAUDE" | "OPENAI",
) {
  const prefix = name === "mwapi" ? "MWAPI" : "CLAUDE_N_CODEX";
  const c = configuration(
    prefix,
    "chat/completions",
    name === "mwapi" ? undefined : family,
  );
  const path =
    process.env[`${prefix}_MODELS_PATH`] ||
    (name === "mwapi" ? "/v1/models" : undefined);
  if (!c.base || !c.key || !path)
    throw new AppError(
      "provider_not_configured",
      "Configure this account credential, API origin, and verified MODELS_PATH on the server before loading its catalog.",
      503,
    );
  const base = new URL(c.base);
  const url = new URL(path, base);
  if (
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol) ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new AppError(
      "provider_not_configured",
      "Invalid catalog endpoint.",
      503,
    );
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { [c.header]: [c.authPrefix, c.key].filter(Boolean).join(" ") },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AppError(
      "provider_error",
      "Could not reach this provider catalog.",
      502,
    );
  }
  if (!response.ok)
    throw new AppError(
      "provider_error",
      `Provider catalog returned HTTP ${response.status}.`,
      502,
    );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AppError(
      "provider_error",
      "Provider did not return a JSON model catalog.",
      502,
    );
  }
  const parsed = z
    .object({
      data: z
        .array(
          z.object({
            id: z.string().min(1).max(200),
            display_name: z.string().max(200).optional(),
          }),
        )
        .max(5000),
    })
    .safeParse(body);
  if (!parsed.success)
    throw new AppError(
      "provider_error",
      "Unsupported provider catalog format.",
      502,
    );
  return {
    models: parsed.data.data
      .filter((m) => !m.id.startsWith("sk-"))
      .map((m) => ({
        id: m.id,
        name:
          m.display_name && !m.display_name.startsWith("sk-")
            ? m.display_name
            : m.id,
      })),
  };
}
