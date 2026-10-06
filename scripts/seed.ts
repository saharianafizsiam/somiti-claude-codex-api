import { db } from "../src/lib/db";
import {
  apiKeys,
  apiRequests,
  balanceTransactions,
  dashboardShares,
  models,
  redeemCodes,
  users,
  wallets,
} from "../src/lib/db/schema";
import { encrypt, hash, secret } from "../src/lib/security/secrets";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEV_SEED !== "true"
)
  throw new Error("Set ALLOW_DEV_SEED=true in a development database only.");
if (
  !process.env.OWNER_EMAIL ||
  !process.env.OWNER_PASSWORD ||
  process.env.OWNER_PASSWORD.length < 14
)
  throw new Error(
    "Set OWNER_EMAIL and a development OWNER_PASSWORD of at least 14 characters",
  );
await db().transaction(async (tx) => {
  let [owner] = await tx
    .select()
    .from(users)
    .where(eq(users.email, process.env.OWNER_EMAIL!.toLowerCase()));
  if (!owner) {
    [owner] = await tx
      .insert(users)
      .values({
        email: process.env.OWNER_EMAIL!.toLowerCase(),
        name: "Development owner",
        role: "OWNER",
        passwordHash: await bcrypt.hash(process.env.OWNER_PASSWORD!, 12),
      })
      .returning();
    await tx.insert(wallets).values({ userId: owner.id });
  }
  const [existing] = await tx
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.ownerUserId, owner.id))
    .limit(1);
  if (existing)
    throw new Error(
      "Seed requires an owner with no API keys; use a separate development database.",
    );
  await tx
    .insert(models)
    .values(
      ["CLAUDE", "OPENAI"].flatMap((family) =>
        ["standard", "fast"].map((tier) => ({
          displayName: `Example ${family} ${tier}`,
          publicModelId: `example-${family.toLowerCase()}-${tier}`,
          upstreamModelId: "CONFIGURE_WITH_VERIFIED_PROVIDER_MODEL_ID",
          family,
          enabled: false,
          supportsOpenaiEndpoint: family === "OPENAI",
          supportsAnthropicEndpoint: family === "CLAUDE",
          upstreamInputPricePerMillion: "3",
          upstreamOutputPricePerMillion: "15",
          markupPercentage: "20",
        })),
      ),
    )
    .onConflictDoNothing();
  const catalog = await tx.select().from(models);
  const [wallet] = await tx
    .update(wallets)
    .set({
      balance: "350",
      allocatedBalance: "149.919",
      totalAdded: "500",
      totalSpent: "0.081",
    })
    .where(eq(wallets.userId, owner.id))
    .returning();
  await tx.insert(balanceTransactions).values({
    walletId: wallet.id,
    type: "TOPUP",
    amount: "500",
    balanceBefore: "0",
    balanceAfter: "500",
    description: "Development fixture top-up",
  });
  for (let i = 0; i < 3; i++) {
    const value = secret("sk-somiti_");
    const token = secret("sk-myapi_");
    const [key] = await tx
      .insert(apiKeys)
      .values({
        ownerUserId: owner.id,
        name: [
          "Development Claude",
          "Development OpenAI",
          "Development combined",
        ][i],
        keyPrefix: value.slice(0, 20),
        keyHash: hash(value),
        encryptedKey: encrypt(value),
        allocatedCredit: "50",
        totalAllocatedCredit: "50",
        creditUsed: i === 0 ? "0.081" : "0",
        modelAccessMode: ["CLAUDE_ONLY", "OPENAI_ONLY", "CLAUDE_AND_OPENAI"][i],
      })
      .returning();
    await tx.insert(dashboardShares).values({
      apiKeyId: key.id,
      tokenPrefix: token.slice(0, 16),
      tokenHash: hash(token),
      encryptedToken: encrypt(token),
    });
    await tx.insert(balanceTransactions).values({
      walletId: wallet.id,
      apiKeyId: key.id,
      type: "API_ALLOCATION",
      amount: "50",
      balanceBefore: String(500 - i * 50),
      balanceAfter: String(450 - i * 50),
      description: "Development fixture allocation",
    });
    if (i === 0) {
      const model = catalog[0];
      await tx.insert(apiRequests).values({
        apiKeyId: key.id,
        requestId: crypto.randomUUID(),
        modelId: model.id,
        publicModelIdSnapshot: model.publicModelId,
        modelFamilySnapshot: model.family,
        upstreamModelIdSnapshot: model.upstreamModelId,
        endpoint: "messages",
        inputTokens: 12000,
        outputTokens: 3000,
        totalTokens: 15000,
        inputPriceSnapshot: "3",
        outputPriceSnapshot: "15",
        customerCost: "0.081",
        upstreamEstimatedCost: "0.0675",
        estimatedProfit: "0.0135",
        status: "COMPLETED",
        httpStatus: 200,
        latencyMs: 850,
        usageStatus: "ESTIMATED",
        settledAt: new Date(),
        errorCode: "development_fixture",
      });
      await tx.insert(balanceTransactions).values({
        apiKeyId: key.id,
        type: "API_USAGE",
        amount: "0.081",
        balanceBefore: "50",
        balanceAfter: "49.919",
        description: "Development fixture usage",
      });
    }
  }
  const code = secret("SOMITI-");
  await tx.insert(redeemCodes).values({
    createdBy: owner.id,
    codeHash: hash(code),
    codePrefix: code.slice(0, 16),
    value: "25",
  });
});
console.log(
  "Development owner, disabled example models, three keys, sample accounting and hashed redeem code created. Reveal keys/links from the owner console. Generate a fresh redeem code in the UI to test redemption.",
);
process.exit(0);
