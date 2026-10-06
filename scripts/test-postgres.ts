import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import { generateSecret, generateSync } from "otplib";
import { encrypt as encryptTotp } from "../src/lib/security/secrets";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
const port = 15432;
const password = randomBytes(24).toString("hex");
const totpSecret = generateSecret();
const directory = resolve(".tmp", `postgres-${Date.now()}`);
await mkdir(directory, { recursive: true });
const cluster = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password,
  port,
  persistent: true,
  onLog: () => {},
  onError: () => {},
});
let client: ReturnType<typeof postgres> | undefined;
let server: ReturnType<typeof spawn> | undefined;
try {
  await cluster.initialise();
  await cluster.start();
  await cluster.createDatabase("somiti_test");
  process.env.DATABASE_URL = `postgres://postgres:${password}@localhost:${port}/somiti_test`;
  process.env.AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.API_KEY_ENCRYPTION_SECRET = randomBytes(32).toString("hex");
  process.env.APP_URL = "http://localhost:3100";
  process.env.API_URL = "http://localhost:3100";
  client = postgres(process.env.DATABASE_URL, { max: 20, prepare: false });
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: "drizzle" });
  const [user] = await database
    .insert(schema.users)
    .values({
      email: "test@example.test",
      name: "Integration owner",
      passwordHash: await bcrypt.hash(password, 12),
      username: "integration-admin",
      totpSecret: encryptTotp(totpSecret),
      role: "OWNER",
    })
    .returning();
  await database.insert(schema.wallets).values({
    userId: user.id,
    balance: "10",
    allocatedBalance: "1",
    totalAdded: "11",
  });
  const { hash, encrypt, secret } = await import("../src/lib/security/secrets");
  const { reserve, settle } = await import("../src/lib/billing/ledger");
  const credential = secret("sk-somiti_");
  const [key] = await database
    .insert(schema.apiKeys)
    .values({
      ownerUserId: user.id,
      name: "Concurrency test",
      keyPrefix: credential.slice(0, 20),
      keyHash: hash(credential),
      encryptedKey: encrypt(credential),
      allocatedCredit: "1",
      modelAccessMode: "CLAUDE_ONLY",
    })
    .returning();
  const [model] = await database
    .insert(schema.models)
    .values({
      displayName: "Test model",
      publicModelId: "test-model",
      upstreamModelId: "private-upstream",
      family: "CLAUDE",
      contextWindow: 100000,
      maxOutputTokens: 100000,
      upstreamInputPricePerMillion: "1",
      upstreamOutputPricePerMillion: "1",
    })
    .returning();
  const result = await Promise.allSettled(
    Array.from({ length: 100 }, () =>
      reserve(key.id, key.keyHash, model, "messages", 100000),
    ),
  );
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 5);
  const [lockedKey] = await database
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.id, key.id));
  assert.equal(lockedKey.creditReserved, "1.00000000");
  const success = result.filter(
    (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>> =>
      r.status === "fulfilled",
  );
  await Promise.all(
    success.flatMap(({ value: r }) =>
      Array.from({ length: 5 }, () =>
        settle(
          r.requestId,
          {
            inputTokens: 1000,
            outputTokens: 1000,
            cachedTokens: 0,
            totalTokens: 2000,
            status: "CONFIRMED",
          },
          200,
          100,
        ),
      ),
    ),
  );
  const [settled] = await database
    .select()
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.id, key.id));
  assert.equal(settled.creditUsed, "0.01000000");
  assert.equal(settled.creditReserved, "0.00000000");
  console.log(
    "PASS: real PostgreSQL concurrent reservations and idempotent settlement (100 requests, 25 settlements).",
  );
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", "3100"],
    { env: process.env, stdio: "pipe", windowsHide: true },
  );
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch("http://localhost:3100/login");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready, "Next server did not start");
  for (const attempt of [
    { username: "integration-admin", password },
    { username: "integration-admin", password, totp: "invalid" },
    {
      username: "integration-admin",
      password: "wrong-password",
      totp: generateSync({ secret: totpSecret }),
    },
  ]) {
    const rejected = await fetch("http://localhost:3100/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3100",
      },
      body: JSON.stringify(attempt),
    });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get("set-cookie"), null);
  }
  console.log(
    "PASS: missing/invalid 2FA and incorrect passwords cannot create an admin session.",
  );
  const login = await fetch("http://localhost:3100/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3100",
    },
    body: JSON.stringify({
      username: "integration-admin",
      password,
      totp: generateSync({ secret: totpSecret }),
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  for (const path of [
    "/dashboard",
    "/dashboard/keys",
    "/dashboard/keys/" + key.id,
    "/dashboard/models",
    "/dashboard/models/" + model.id,
    "/dashboard/usage",
    "/dashboard/logs",
    "/dashboard/transactions",
    "/dashboard/audit",
    "/dashboard/settings",
    "/dashboard/redeem",
  ]) {
    const r = await fetch("http://localhost:3100" + path, {
      headers: { cookie },
    });
    assert.equal(r.status, 200, path);
    const html = await r.text();
    assert(!html.includes("NEXT_HTTP_ERROR_FALLBACK;500"), path);
  }
  const list = await fetch("http://localhost:3100/v1/models", {
    headers: { authorization: `Bearer ${credential}` },
  });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).data[0].id, "test-model");
  const secondList = await fetch("http://localhost:3100/v2/models", {
    headers: { authorization: `Bearer ${credential}` },
  });
  assert.equal(secondList.status, 200);
  assert.deepEqual((await secondList.json()).data, []);
  const wrongProvider = await fetch(
    "http://localhost:3100/v2/chat/completions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
      }),
    },
  );
  assert.equal(wrongProvider.status, 403);
  for (const endpoint of ["balance", "usage"]) {
    const response = await fetch(`http://localhost:3100/v2/${endpoint}`, {
      headers: { authorization: `Bearer ${credential}` },
    });
    assert.equal(response.status, 200);
  }
  const share = await fetch("http://localhost:3100/api/admin/key.share", {
    method: "POST",
    headers: {
      cookie,
      origin: process.env.APP_URL,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: key.id }),
  });
  assert.equal(share.status, 200);
  const { dashboardUrl } = await share.json();
  const customer = await fetch(dashboardUrl);
  assert.equal(customer.status, 200);
  const html = await customer.text();
  assert(html.includes("API v1 base URL"));
  assert(html.includes("API v2 base URL"));
  assert(
    !/mwapi|claude-n-codex/i.test(html),
    "Customer HTML exposes upstream identity",
  );
  assert(!html.includes("private-upstream"));
  assert(!html.includes("Estimated profit"));
  assert(!html.includes(password));
  const forbidden = await fetch("http://localhost:3100/api/admin/key.disable", {
    method: "POST",
    headers: {
      origin: process.env.APP_URL,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: key.id }),
  });
  assert.equal(forbidden.status, 401);
  console.log(
    "PASS: production HTTP login, 11 owner routes, API model listing, private customer dashboard, and unauthenticated mutation rejection.",
  );
  if (process.env.UI_TEST === "1") {
    await database.insert(schema.models).values({
      displayName: "Second provider fixture",
      publicModelId: "second-provider-test",
      upstreamModelId: "second-private",
      family: "OPENAI",
      provider: "claude-n-codex",
      enabled: false,
    });
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await mkdir(".tmp/screenshots", { recursive: true });
      await page.goto("http://localhost:3100/");
      assert(
        !/mwapi|claude-n-codex/i.test(await page.content()),
        "Homepage exposes upstream identity",
      );
      for (const script of await page
        .locator("script[src]")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLScriptElement).src),
        )) {
        const source = await (await context.request.get(script)).text();
        assert(
          !/mwapi|claude-n-codex/i.test(source),
          "Homepage JavaScript exposes upstream identity",
        );
      }
      await page.getByRole("heading", { name: /Your next idea/ }).waitFor();
      await page.getByRole("button", { name: "API v2", exact: true }).click();
      assert(
        (await page.locator(".connection-console code").innerText()).includes(
          "/v2/models",
        ),
      );
      await page.getByRole("button", { name: "API v1", exact: true }).click();
      assert(
        (await page.locator(".connection-console code").innerText()).includes(
          "/v1/models",
        ),
      );
      await page.screenshot({
        path: ".tmp/screenshots/home-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        "Homepage mobile overflow",
      );
      await page.screenshot({
        path: ".tmp/screenshots/home-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto("http://localhost:3100/login");
      await page.screenshot({
        path: ".tmp/screenshots/login-desktop.png",
        fullPage: true,
      });
      await page.getByLabel("Username or email").fill("integration-admin");
      await page
        .getByLabel("2FA code")
        .fill(generateSync({ secret: totpSecret }));
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "Sign in to your workspace" })
        .click();
      await page.waitForURL("**/dashboard");
      await page
        .getByRole("heading", { name: "Overview", exact: true })
        .waitFor();
      await mkdir(".tmp/screenshots", { recursive: true });
      await page.screenshot({
        path: ".tmp/screenshots/owner-desktop.png",
        fullPage: true,
      });
      await page
        .getByRole("link", { name: "Create API key", exact: true })
        .click();
      await page.getByLabel("API key name").fill("Browser customer");
      await page.getByLabel("Initial credit").fill("2");
      await page
        .getByRole("button", { name: "Create API key", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "API key created" })
        .waitFor();
      await page.goto("http://localhost:3100/dashboard/models");
      await page.getByRole("heading", { name: "MWAPI setup" }).waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Second provider fixture", exact: true })
          .count(),
        0,
      );
      await page
        .getByLabel("Upstream provider", { exact: true })
        .selectOption("claude-n-codex");
      await page
        .getByRole("heading", { name: "claude-n-codex.com setup" })
        .waitFor();
      await page
        .getByRole("link", { name: "Second provider fixture", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Test model", exact: true })
          .count(),
        0,
      );
      await page.getByRole("link", { name: "Add model", exact: true }).click();
      assert.equal(
        await page
          .getByLabel("Upstream provider", { exact: true })
          .inputValue(),
        "claude-n-codex",
      );
      await page
        .getByLabel("Upstream provider", { exact: true })
        .selectOption("mwapi");
      await page.getByRole("heading", { name: "MWAPI setup" }).waitFor();
      console.log(
        "PASS: provider selector filters model catalog, preserves new-model selection, and switches setup instructions.",
      );
      await page.goto(dashboardUrl);
      await page.getByRole("heading", { name: "API configuration" }).waitFor();
      await page.screenshot({
        path: ".tmp/screenshots/customer-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("http://localhost:3100/dashboard");
      await page
        .getByRole("heading", { name: "Overview", exact: true })
        .waitFor();
      await page.screenshot({
        path: ".tmp/screenshots/owner-mobile.png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        "Mobile page overflow",
      );
      assert.deepEqual(errors, [], "Browser runtime errors");
      console.log(
        "PASS: browser login, key creation, customer rendering, responsive viewport, and no runtime errors. Screenshots: .tmp/screenshots.",
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  server?.kill();
  await client?.end();
  await cluster.stop();
}
process.exit(0);
