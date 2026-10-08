import { importedCapabilities } from "../models/imported-capabilities";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  apiKeys,
  apiKeyModels,
  dashboardShares,
  models,
  type ApiKey,
} from "../db/schema";
import { hash } from "../security/secrets";
import { AppError } from "../errors";
import { requestIp } from "../security/ip";
import { canAccess } from "../models/access";
export function validateKey(key: ApiKey | undefined, ip: string | null) {
  if (!key) throw new AppError("invalid_api_key", "Invalid API key.", 401);
  if (key.status !== "ACTIVE" || key.deletedAt)
    throw new AppError("disabled_api_key", "This API key is disabled.", 403);
  if (key.expiresAt && key.expiresAt <= new Date())
    throw new AppError("expired_api_key", "This API key has expired.", 403);
  if (key.allowedIps.length && (!ip || !key.allowedIps.includes(ip)))
    throw new AppError(
      "ip_not_allowed",
      "This IP address is not allowed.",
      403,
    );
  return key;
}
export async function authenticate(req: Request) {
  const value =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-api-key") ||
    "";
  if (!/^sk-somiti_[A-Za-z0-9_-]{43}$/.test(value))
    throw new AppError("invalid_api_key", "Invalid API key.", 401);
  const [key] = await db()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash(value)))
    .limit(1);
  validateKey(key, requestIp(req.headers));
  return key;
}
export async function sharedKey(token: string) {
  if (!/^sk-myapi_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [row] = await db()
    .select({ key: apiKeys, share: dashboardShares })
    .from(dashboardShares)
    .innerJoin(apiKeys, eq(dashboardShares.apiKeyId, apiKeys.id))
    .where(
      and(
        eq(dashboardShares.tokenHash, hash(token)),
        eq(dashboardShares.enabled, true),
      ),
    )
    .limit(1);
  if (
    !row ||
    row.key.deletedAt ||
    (row.share.expiresAt && row.share.expiresAt <= new Date())
  )
    return null;
  return row.key;
}
export async function availableModels(key: ApiKey) {
  const selected = await db()
    .select()
    .from(apiKeyModels)
    .where(eq(apiKeyModels.apiKeyId, key.id));
  return (
    await db()
      .select()
      .from(models)
      .orderBy(models.sortOrder, models.displayName)
  ).map(importedCapabilities).filter(
    (m) =>
      (!key.upstreamProvider || m.provider === key.upstreamProvider) &&
      canAccess(
        key,
        m,
        selected.map((s) => s.modelId),
      ),
  );
}
