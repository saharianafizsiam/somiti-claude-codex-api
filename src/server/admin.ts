import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import {
  apiKeys,
  apiKeyModels,
  dashboardShares,
  models,
  modelAliases,
  redeemCodes,
  settings,
} from "@/lib/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { decrypt, encrypt, hash, secret } from "@/lib/security/secrets";
import { addWallet, audit, transfer } from "@/lib/billing/ledger";
import { AppError } from "@/lib/errors";
import { amount, keyInput, modelInput } from "./validation";
import { Decimal } from "@/lib/billing/money";
import { upstreamModels } from "@/lib/providers/catalog";
import presets from "@/lib/providers/model-presets.json";
import { importedModel } from "@/lib/providers/import-models";
async function ownKey(tx: Tx, owner: string, id: string) {
  const [key] = await tx
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.ownerUserId, owner)))
    .for("update");
  if (!key || key.deletedAt)
    throw new AppError("not_found", "API key not found.", 404);
  return key;
}
async function setModels(tx: Tx, id: string, ids: string[]) {
  await tx.delete(apiKeyModels).where(eq(apiKeyModels.apiKeyId, id));
  if (ids.length)
    await tx
      .insert(apiKeyModels)
      .values([...new Set(ids)].map((modelId) => ({ apiKeyId: id, modelId })));
}
async function share(tx: Tx, keyId: string, expiresAt: Date | null = null) {
  const token = secret("sk-myapi_");
  const values = {
    apiKeyId: keyId,
    tokenHash: hash(token),
    tokenPrefix: token.slice(0, 16),
    encryptedToken: encrypt(token),
    enabled: true,
    expiresAt,
  };
  await tx
    .insert(dashboardShares)
    .values(values)
    .onConflictDoUpdate({ target: dashboardShares.apiKeyId, set: values });
  return `${process.env.APP_URL || "http://localhost:3000"}/dashboard/${token}`;
}
export async function adminAction(action: string, input: unknown) {
  const user = await requireUser();
  requireAdmin(user);
  if (
    action.startsWith("redeem.") ||
    action === "wallet.topup" ||
    action === "key.credit"
  )
    throw new AppError(
      "not_supported",
      "Quota is managed on the assigned upstream key.",
      410,
    );
  if (action === "provider.models") {
    requireAdmin(user);
    const data = z
      .object({
        provider: z.enum(["mwapi", "claude-n-codex"]),
        family: z.enum(["CLAUDE", "OPENAI"]),
      })
      .parse(input);
    return upstreamModels(data.provider, data.family);
  }
  if (action === "provider.import") {
    const data = z
      .object({
        provider: z.enum(["mwapi", "claude-n-codex"]),
        family: z.enum(["CLAUDE", "OPENAI"]),
        source: z.enum(["live", "saved"]),
      })
      .parse(input);
    if (data.provider === "mwapi" && data.family !== "CLAUDE")
      throw new AppError("invalid_request", "Select the Claude account.");
    const rows =
      data.source === "live"
        ? (await upstreamModels(data.provider, data.family)).models
        : presets.find(
            (p) => p.provider === data.provider && p.family === data.family,
          )?.models || [];
    return db().transaction(async (tx) => {
      let added = 0;
      let activated = 0;
      for (const row of rows) {
        const existing = await tx
          .select()
          .from(models)
          .where(
            and(
              eq(models.provider, data.provider),
              eq(models.upstreamModelId, row.id),
            ),
          )
          .limit(1);
        if (existing.length) {
          const draft = existing[0];
          if (
            !draft.archivedAt &&
            !draft.enabled &&
            draft.description ===
              "Imported from API catalog. Review endpoint support and limits, then enable."
          ) {
            const defaults = importedModel(data.provider, data.family, row);
            await tx
              .update(models)
              .set({
                enabled: true,
                visible: true,
                supportsOpenaiEndpoint: defaults.supportsOpenaiEndpoint,
                supportsAnthropicEndpoint: defaults.supportsAnthropicEndpoint,
                supportsStreaming: true,
                description: defaults.description,
                updatedAt: new Date(),
              })
              .where(eq(models.id, draft.id));
            activated++;
          }
          // Repair only untouched defaults from the original v2 catalog importer.
          if (
            !draft.archivedAt &&
            draft.enabled &&
            draft.visible &&
            draft.provider === "claude-n-codex" &&
            draft.family === "CLAUDE" &&
            draft.supportsAnthropicEndpoint &&
            !draft.supportsOpenaiEndpoint &&
            draft.description ===
              "Imported from API catalog. Uses the account family's standard endpoint; generation availability depends on the assigned key."
          ) {
            await tx
              .update(models)
              .set({ supportsOpenaiEndpoint: true, updatedAt: new Date() })
              .where(eq(models.id, draft.id));
            activated++;
          }
          continue;
        }
        const inserted = await tx
          .insert(models)
          .values(importedModel(data.provider, data.family, row))
          .onConflictDoNothing()
          .returning({ id: models.id });
        added += inserted.length;
      }
      await audit(tx, user.id, "IMPORT_MODELS", "provider", data.provider);
      return { added, activated };
    });
  }
  if (action === "key.create") {
    const data = keyInput.parse(input);
    if (!data.upstreamKey)
      throw new AppError(
        "invalid_request",
        "Attach the customer's upstream API key.",
      );
    const value = secret("sk-somiti_");
    return db().transaction(async (tx) => {
      const [key] = await tx
        .insert(apiKeys)
        .values({
          ownerUserId: user.id,
          name: data.name,
          keyPrefix: value.slice(0, 20),
          keyHash: hash(value),
          encryptedKey: encrypt(value),
          upstreamProvider: data.upstreamProvider,
          encryptedUpstreamKey: encrypt(data.upstreamKey!),
          modelAccessMode: data.modelAccessMode,
          rateLimitPerMinute: data.rateLimitPerMinute,
          allowedIps: data.allowedIps,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        })
        .returning();
      await setModels(tx, key.id, data.modelIds);
      const dashboardUrl = data.createDashboard
        ? await share(tx, key.id)
        : undefined;
      await audit(tx, user.id, "CREATE_API_KEY", "api_key", key.id);
      return { id: key.id, apiKey: value, dashboardUrl };
    });
  }
  if (action === "key.update") {
    const data = keyInput.extend({ id: z.string().uuid() }).parse(input);
    return db().transaction(async (tx) => {
      const existing = await ownKey(tx, user.id, data.id);
      if (
        !data.upstreamKey &&
        (!existing.encryptedUpstreamKey ||
          existing.upstreamProvider !== data.upstreamProvider)
      )
        throw new AppError(
          "invalid_request",
          "Enter an upstream key when changing provider or configuring this key for the first time.",
        );
      await tx
        .update(apiKeys)
        .set({
          name: data.name,
          upstreamProvider: data.upstreamProvider,
          ...(data.upstreamKey
            ? { encryptedUpstreamKey: encrypt(data.upstreamKey) }
            : {}),
          modelAccessMode: data.modelAccessMode,
          rateLimitPerMinute: data.rateLimitPerMinute,
          allowedIps: data.allowedIps,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, data.id));
      await setModels(tx, data.id, data.modelIds);
      await audit(tx, user.id, "EDIT_API_KEY", "api_key", data.id);
      return { ok: true };
    });
  }
  if (action === "key.credit") {
    const data = z
      .object({
        id: z.string().uuid(),
        amount,
        returning: z.boolean().default(false),
      })
      .parse(input);
    return db().transaction(async (tx) => {
      await transfer(tx, user.id, data.id, data.amount, data.returning);
      return { ok: true };
    });
  }
  if (action.startsWith("key.")) {
    const data = z
      .object({
        id: z.string().uuid(),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(input);
    return db().transaction(async (tx) => {
      const key = await ownKey(tx, user.id, data.id);
      let result: Record<string, unknown> = { ok: true };
      if (action === "key.archive" && new Decimal(key.creditReserved).gt(0))
        throw new AppError(
          "invalid_request",
          "Wait for pending requests and return unused credit before archiving.",
        );
      if (action === "key.reveal") return { apiKey: decrypt(key.encryptedKey) };
      if (action === "key.rotate") {
        const value = secret("sk-somiti_");
        await tx
          .update(apiKeys)
          .set({
            keyHash: hash(value),
            encryptedKey: encrypt(value),
            keyPrefix: value.slice(0, 20),
            updatedAt: new Date(),
          })
          .where(eq(apiKeys.id, key.id));
        result = { apiKey: value };
      } else if (
        action === "key.enable" ||
        action === "key.disable" ||
        action === "key.archive"
      ) {
        await tx
          .update(apiKeys)
          .set({
            status:
              action === "key.enable"
                ? "ACTIVE"
                : action === "key.archive"
                  ? "DELETED"
                  : "DISABLED",
            ...(action === "key.archive"
              ? { deletedAt: new Date(), encryptedUpstreamKey: null }
              : {}),
          })
          .where(eq(apiKeys.id, key.id));
        if (action === "key.archive")
          await tx
            .update(dashboardShares)
            .set({ enabled: false })
            .where(eq(dashboardShares.apiKeyId, key.id));
      } else if (action === "key.share")
        result = {
          dashboardUrl: await share(
            tx,
            key.id,
            data.expiresAt ? new Date(data.expiresAt) : null,
          ),
        };
      else if (action === "key.unshare")
        await tx
          .update(dashboardShares)
          .set({ enabled: false })
          .where(eq(dashboardShares.apiKeyId, key.id));
      else throw new AppError("invalid_request", "Unknown key action.");
      await audit(
        tx,
        user.id,
        action.toUpperCase().replace(".", "_"),
        "api_key",
        key.id,
      );
      return result;
    });
  }
  if (action === "wallet.topup") {
    requireAdmin(user);
    const data = z.object({ amount }).parse(input);
    return db().transaction(async (tx) => {
      await addWallet(tx, user.id, data.amount, "TOPUP");
      return { ok: true };
    });
  }
  if (action === "redeem.use") {
    const data = z.object({ code: z.string().min(10).max(200) }).parse(input);
    return db().transaction(async (tx) => {
      const [code] = await tx
        .select()
        .from(redeemCodes)
        .where(eq(redeemCodes.codeHash, hash(data.code.trim())))
        .for("update");
      if (
        !code ||
        code.status !== "ACTIVE" ||
        (code.expiresAt && code.expiresAt <= new Date())
      )
        throw new AppError(
          "invalid_code",
          "Code is invalid, expired, or already redeemed.",
        );
      await tx
        .update(redeemCodes)
        .set({
          status: "REDEEMED",
          redeemedBy: user.id,
          redeemedAt: new Date(),
        })
        .where(eq(redeemCodes.id, code.id));
      await addWallet(tx, user.id, code.value, "REDEEM", code.id);
      return { ok: true };
    });
  }
  requireAdmin(user);
  if (action === "redeem.create") {
    const data = z
      .object({
        amount,
        quantity: z.coerce.number().int().min(1).max(100),
        expiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(input);
    return db().transaction(async (tx) => {
      const codes: string[] = [];
      for (let i = 0; i < data.quantity; i++) {
        const code = secret("SOMITI-");
        const [r] = await tx
          .insert(redeemCodes)
          .values({
            codeHash: hash(code),
            codePrefix: code.slice(0, 16),
            value: data.amount,
            createdBy: user.id,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          })
          .returning();
        await audit(tx, user.id, "CREATE_REDEEM_CODE", "redeem_code", r.id);
        codes.push(code);
      }
      return { codes };
    });
  }
  if (action === "redeem.disable") {
    const data = z.object({ id: z.string().uuid() }).parse(input);
    await db().transaction(async (tx) => {
      await tx
        .update(redeemCodes)
        .set({ status: "DISABLED" })
        .where(
          and(eq(redeemCodes.id, data.id), eq(redeemCodes.status, "ACTIVE")),
        );
      await audit(tx, user.id, "DISABLE_REDEEM_CODE", "redeem_code", data.id);
    });
    return { ok: true };
  }
  if (action === "model.save") {
    const data = modelInput
      .extend({ id: z.string().uuid().optional() })
      .parse(input);
    const { id, aliases, ...values } = data;
    // An explicit edit owns its capabilities; later catalog refreshes must not reset them.
    if (
      values.description ===
      "Imported from API catalog. Uses the account family's standard endpoint; generation availability depends on the assigned key."
    )
      values.description = "Configured by administrator.";
    return db().transaction(async (tx) => {
      // Serialize catalog edits so public IDs and aliases occupy one namespace.
      await tx.execute(
        (await import("drizzle-orm")).sql`SELECT pg_advisory_xact_lock(735102)`,
      );
      const collision = await tx
        .select()
        .from(modelAliases)
        .where(inArray(modelAliases.alias, [values.publicModelId, ...aliases]));
      const publicCollision = await tx
        .select()
        .from(models)
        .where(
          inArray(models.publicModelId, [values.publicModelId, ...aliases]),
        );
      if (
        collision.some((a) => a.modelId !== id) ||
        publicCollision.some((m) => m.id !== id) ||
        aliases.includes(values.publicModelId)
      )
        throw new AppError(
          "invalid_request",
          "A public model ID or alias is already in use.",
        );
      const [model] = id
        ? await tx
            .update(models)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(models.id, id))
            .returning()
        : await tx.insert(models).values(values).returning();
      if (!model) throw new AppError("not_found", "Model not found.", 404);
      await tx.delete(modelAliases).where(eq(modelAliases.modelId, model.id));
      if (aliases.length)
        await tx.insert(modelAliases).values(
          [...new Set(aliases)].map((alias) => ({
            modelId: model.id,
            alias,
          })),
        );
      await audit(
        tx,
        user.id,
        id ? "EDIT_MODEL_AND_PRICING" : "ADD_MODEL",
        "model",
        model.id,
      );
      return { id: model.id };
    });
  }
  if (
    action === "model.archive" ||
    action === "model.disable" ||
    action === "model.enable"
  ) {
    const data = z.object({ id: z.string().uuid() }).parse(input);
    await db().transaction(async (tx) => {
      await tx
        .update(models)
        .set({
          enabled: action === "model.enable",
          archivedAt: action === "model.archive" ? new Date() : null,
        })
        .where(eq(models.id, data.id));
      await audit(tx, user.id, action.toUpperCase(), "model", data.id);
    });
    return { ok: true };
  }
  if (action === "settings.save") {
    const data = z
      .object({
        applicationName: z.string().min(1).max(100),
        publicApiUrl: z
          .url()
          .refine((value) => {
            const url = new URL(value);
            return (
              ["http:", "https:"].includes(url.protocol) &&
              url.pathname === "/" &&
              !url.search &&
              !url.hash
            );
          }, "Enter an API origin without a path, query, or fragment")
          .transform((value) => value.replace(/\/+$/, "")),
        defaultRateLimit: z.coerce.number().int().min(1).max(10000),
      })
      .parse(input);
    await db().transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ id: "app", ...data })
        .onConflictDoUpdate({ target: settings.id, set: data });
      await audit(tx, user.id, "UPDATE_SETTINGS", "settings", "app");
    });
    return { ok: true };
  }
  throw new AppError("invalid_request", "Unknown action.");
}
