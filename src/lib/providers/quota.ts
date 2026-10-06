import type { ApiKey } from "../db/schema";
import { decrypt } from "../security/secrets";
import { z } from "zod";

const decimal = z
  .union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number().finite()])
  .transform(String);
const mw = z.object({
  quota: z.object({
    limit: decimal,
    used: decimal,
    remaining: decimal,
    unit: z.literal("USD"),
  }),
});
const cnc = z.object({
  usd_allocation: decimal,
  used_usd: decimal,
  remaining_usd: decimal,
});
export async function keyQuota(
  key: Pick<ApiKey, "upstreamProvider" | "encryptedUpstreamKey">,
) {
  const unavailable = {
    object: "balance",
    status: "unavailable",
    currency: "USD",
    allocated: null,
    used: null,
    remaining: null,
    checkedAt: null,
  } as const;
  if (!key.encryptedUpstreamKey) return unavailable;
  try {
    const credential = decrypt(key.encryptedUpstreamKey);
    let url: URL;
    const headers: Record<string, string> = {};
    if (key.upstreamProvider === "mwapi") {
      url = new URL("https://api.mwapi.dev/v1/usage");
      headers.Authorization = `Bearer ${credential}`;
    } else if (key.upstreamProvider === "claude-n-codex") {
      url = new URL("https://claude-n-codex.com/api/backend/key-dashboard-v1");
      url.searchParams.set("api_key", credential);
      url.searchParams.set("include_requests", "false");
    } else return unavailable;
    const response = await fetch(url, {
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailable;
    const body: unknown = await response.json();
    const values =
      key.upstreamProvider === "mwapi"
        ? mw.parse(body).quota
        : (() => {
            const q = cnc.parse(body);
            return {
              limit: q.usd_allocation,
              used: q.used_usd,
              remaining: q.remaining_usd,
            };
          })();
    return {
      object: "balance",
      status: "available",
      currency: "USD",
      allocated: values.limit,
      used: values.used,
      remaining: values.remaining,
      checkedAt: new Date().toISOString(),
    } as const;
  } catch {
    return unavailable;
  } // Never log upstream URLs or response bodies containing credentials.
}
