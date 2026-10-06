import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "../db";
import {
  apiKeys,
  apiRequests,
  auditLogs,
  balanceTransactions,
  wallets,
  type Model,
} from "../db/schema";
import { AppError } from "../errors";
import { cost, Decimal, money, prices, remaining } from "./money";
import type { NormalizedUsage } from "../providers/types";
import { canAccess } from "../models/access";
import { apiKeyModels } from "../db/schema";
import { validateKey } from "../api-keys";
export async function audit(
  tx: Tx,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
) {
  await tx.insert(auditLogs).values({ userId, action, entityType, entityId });
}
export async function transfer(
  tx: Tx,
  ownerId: string,
  keyId: string,
  amount: string,
  returning = false,
) {
  // All ledger operations lock wallet before key, avoiding lock-order deadlocks.
  const [wallet] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.userId, ownerId))
    .for("update");
  const [key] = await tx
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .for("update");
  if (!wallet || !key || key.ownerUserId !== ownerId || key.deletedAt)
    throw new AppError("not_found", "API key not found.", 404);
  const value = new Decimal(amount);
  if (!value.isPositive())
    throw new AppError("invalid_request", "Amount must be positive.");
  if (value.gt(returning ? remaining(key) : wallet.balance))
    throw new AppError(
      "insufficient_balance",
      "Insufficient available credit.",
      402,
    );
  const signed = returning ? value.negated() : value;
  const balance = money(new Decimal(wallet.balance).minus(signed));
  await tx
    .update(wallets)
    .set({
      balance,
      allocatedBalance: money(
        new Decimal(wallet.allocatedBalance).plus(signed),
      ),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, wallet.id));
  await tx
    .update(apiKeys)
    .set({
      allocatedCredit: money(new Decimal(key.allocatedCredit).plus(signed)),
      totalAllocatedCredit: returning
        ? key.totalAllocatedCredit
        : money(new Decimal(key.totalAllocatedCredit).plus(value)),
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, key.id));
  await tx.insert(balanceTransactions).values({
    walletId: wallet.id,
    apiKeyId: key.id,
    type: returning ? "API_RETURN" : "API_ALLOCATION",
    amount: money(value),
    balanceBefore: wallet.balance,
    balanceAfter: balance,
    description: returning
      ? "Unused key credit returned to wallet"
      : "Wallet credit allocated to key",
  });
  await audit(
    tx,
    ownerId,
    returning ? "RETURN_BALANCE" : "ALLOCATE_BALANCE",
    "api_key",
    key.id,
  );
}
export async function addWallet(
  tx: Tx,
  userId: string,
  amount: string,
  type: "TOPUP" | "REDEEM",
  referenceId?: string,
) {
  const [wallet] = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .for("update");
  if (!wallet) throw new AppError("not_found", "Wallet not found.", 404);
  const after = money(new Decimal(wallet.balance).plus(amount));
  await tx
    .update(wallets)
    .set({
      balance: after,
      totalAdded: money(new Decimal(wallet.totalAdded).plus(amount)),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, wallet.id));
  await tx.insert(balanceTransactions).values({
    walletId: wallet.id,
    type,
    amount,
    balanceBefore: wallet.balance,
    balanceAfter: after,
    description:
      type === "TOPUP" ? "Manual administrator top-up" : "Redeem code top-up",
    referenceId,
  });
  await audit(tx, userId, type, "wallet", wallet.id);
}
export async function reserve(
  keyId: string,
  expectedHash: string,
  model: Model,
  endpoint: string,
  maxOutput: number,
  ip: string | null = null,
  binding?: { provider: string; encryptedKey: string },
) {
  return db().transaction(async (tx) => {
    const [key] = await tx
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .for("update");
    validateKey(key, ip);
    if (
      binding &&
      (key.upstreamProvider !== binding.provider ||
        key.encryptedUpstreamKey !== binding.encryptedKey)
    )
      throw new AppError(
        "key_changed",
        "Key configuration changed; retry your request.",
        409,
      );
    if (
      !key ||
      key.status !== "ACTIVE" ||
      key.keyHash !== expectedHash ||
      (key.expiresAt && key.expiresAt <= new Date())
    )
      throw new AppError(
        "disabled_api_key",
        "API key is no longer active.",
        403,
      );
    const [freshModel] = await tx
      .select()
      .from(modelsTable)
      .where(eq(modelsTable.id, model.id))
      .for("share");
    if (!freshModel?.enabled || freshModel.archivedAt)
      throw new AppError(
        "model_unavailable",
        "This model is currently unavailable.",
        403,
      );
    const selected = await tx
      .select()
      .from(apiKeyModels)
      .where(eq(apiKeyModels.apiKeyId, keyId));
    if (
      !canAccess(
        key,
        freshModel,
        selected.map((s) => s.modelId),
      )
    )
      throw new AppError(
        "model_not_allowed",
        "This API key does not have access to this model.",
        403,
      );
    if (freshModel.updatedAt.getTime() !== model.updatedAt.getTime())
      throw new AppError(
        "model_unavailable",
        "Model configuration changed; retry the request.",
        409,
      );
    const p = prices(freshModel);
    // The entire configured context is a conservative bound, not a token estimate.
    const amount = binding
      ? "0"
      : cost(freshModel.contextWindow, maxOutput, p.input, p.output);
    if (new Decimal(remaining(key)).lt(amount))
      throw new AppError(
        "insufficient_balance",
        "Insufficient credit for the maximum request reservation.",
        402,
      );
    await tx
      .update(apiKeys)
      .set({
        creditReserved: money(new Decimal(key.creditReserved).plus(amount)),
        lastUsedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));
    const [request] = await tx
      .insert(apiRequests)
      .values({
        requestId: crypto.randomUUID(),
        apiKeyId: keyId,
        modelId: model.id,
        publicModelIdSnapshot: model.publicModelId,
        modelFamilySnapshot: model.family,
        upstreamModelIdSnapshot: model.upstreamModelId,
        endpoint,
        upstreamBilled: Boolean(binding),
        inputPriceSnapshot: p.input,
        outputPriceSnapshot: p.output,
        upstreamInputSnapshot: model.upstreamInputPricePerMillion,
        upstreamOutputSnapshot: model.upstreamOutputPricePerMillion,
        upstreamCachedSnapshot: model.upstreamCachedInputPricePerMillion,
        reservedAmount: amount,
      })
      .returning();
    if (!binding)
      await tx.insert(balanceTransactions).values({
        apiKeyId: key.id,
        type: "RESERVATION",
        amount,
        balanceBefore: remaining(key),
        balanceAfter: money(new Decimal(remaining(key)).minus(amount)),
        description: "Maximum request cost reserved",
        referenceId: request.requestId,
      });
    return request;
  });
}
import { models as modelsTable } from "../db/schema";
export async function settle(
  requestId: string,
  usage: NormalizedUsage,
  httpStatus: number,
  latencyMs: number,
  errorCode?: string,
) {
  return db().transaction(async (tx) => {
    const [initial] = await tx
      .select({ owner: apiKeys.ownerUserId })
      .from(apiRequests)
      .innerJoin(apiKeys, eq(apiRequests.apiKeyId, apiKeys.id))
      .where(eq(apiRequests.requestId, requestId));
    if (!initial) return;
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, initial.owner))
      .for("update");
    const [r] = await tx
      .select()
      .from(apiRequests)
      .where(eq(apiRequests.requestId, requestId))
      .for("update");
    if (r.settledAt) return;
    const [key] = await tx
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, r.apiKeyId))
      .for("update");
    const confirmed = usage.status === "CONFIRMED";
    const actual =
      confirmed && !r.upstreamBilled
        ? cost(
            usage.inputTokens,
            usage.outputTokens,
            r.inputPriceSnapshot,
            r.outputPriceSnapshot,
          )
        : "0";
    // The reseller absorbs any provider overrun beyond the reserved contract bound.
    const charge = money(Decimal.min(actual, r.reservedAmount));
    const upstream = confirmed
      ? money(
          new Decimal(
            cost(
              Math.max(0, usage.inputTokens - usage.cachedTokens),
              usage.outputTokens,
              r.upstreamInputSnapshot,
              r.upstreamOutputSnapshot,
            ),
          ).plus(
            new Decimal(usage.cachedTokens)
              .mul(r.upstreamCachedSnapshot)
              .div(1_000_000),
          ),
        )
      : money(0);
    await tx
      .update(apiKeys)
      .set({
        creditReserved: money(
          new Decimal(key.creditReserved).minus(r.reservedAmount),
        ),
        creditUsed: money(new Decimal(key.creditUsed).plus(charge)),
      })
      .where(eq(apiKeys.id, key.id));
    if (!r.upstreamBilled)
      await tx
        .update(wallets)
        .set({
          totalSpent: money(new Decimal(wallet.totalSpent).plus(charge)),
          allocatedBalance: money(
            new Decimal(wallet.allocatedBalance).minus(charge),
          ),
        })
        .where(eq(wallets.id, wallet.id));
    await tx
      .update(apiRequests)
      .set({
        inputTokens: confirmed ? usage.inputTokens : null,
        outputTokens: confirmed ? usage.outputTokens : null,
        cachedTokens: confirmed ? usage.cachedTokens : null,
        totalTokens: confirmed ? usage.totalTokens : null,
        customerCost: charge,
        upstreamEstimatedCost: upstream,
        estimatedProfit: r.upstreamBilled
          ? money(0)
          : money(new Decimal(charge).minus(upstream)),
        status: errorCode ? "FAILED" : "COMPLETED",
        usageStatus: usage.status,
        httpStatus,
        latencyMs,
        errorCode: new Decimal(actual).gt(r.reservedAmount)
          ? "provider_exceeded_reservation"
          : errorCode,
        settledAt: new Date(),
      })
      .where(eq(apiRequests.id, r.id));
    if (!r.upstreamBilled)
      await tx.insert(balanceTransactions).values([
        {
          apiKeyId: key.id,
          type: "RESERVATION_RELEASE",
          amount: r.reservedAmount,
          balanceBefore: remaining(key),
          balanceAfter: money(
            new Decimal(remaining(key)).plus(r.reservedAmount),
          ),
          description: "Request reservation released",
          referenceId: requestId,
        },
        {
          apiKeyId: key.id,
          type: "API_USAGE",
          amount: charge,
          balanceBefore: money(
            new Decimal(remaining(key)).plus(r.reservedAmount),
          ),
          balanceAfter: money(
            new Decimal(remaining(key)).plus(r.reservedAmount).minus(charge),
          ),
          description: confirmed
            ? "Confirmed provider usage"
            : "Usage unavailable; no customer charge",
          referenceId: requestId,
        },
      ]);
  });
}
export async function recoverStale() {
  const stale = await db()
    .select({ requestId: apiRequests.requestId })
    .from(apiRequests)
    .where(
      sql`${apiRequests.settledAt} IS NULL AND ${apiRequests.createdAt} < now() - interval '15 minutes'`,
    )
    .limit(500);
  for (const r of stale)
    await settle(
      r.requestId,
      {
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        status: "UNAVAILABLE",
      },
      504,
      900000,
      "interrupted_request",
    );
  return stale.length;
}
