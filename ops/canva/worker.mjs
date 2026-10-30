import { chromium } from "playwright";
import { sentConfirmation, watchConfirmation } from "./confirmation.mjs";

const siteUrl = new URL(process.env.CANVA_API_BASE ?? "https://somiti.page");
const workerSecret = process.env.CANVA_WORKER_SECRET;
const cdpUrl = process.env.CANVA_CDP_URL ?? "http://127.0.0.1:9222";
const pollMs = 10_000;
// Back off when Canva blocks sends (security error, rate limit, etc.)
const cooldownMs = 5 * 60_000;

if (!workerSecret || workerSecret.length < 32) {
  throw new Error("CANVA_WORKER_SECRET must contain at least 32 characters.");
}

let browser;
let stage = "idle";
let cooldownUntil = 0;

async function rotateProxy() {
  if (process.env.CANVA_PROXY_ROTATOR !== "true") return;
  try {
    await fetch(new URL("http://127.0.0.1:8888/_rotate"));
  } catch {}
}

async function api(action, body) {
  const response = await fetch(
    new URL(`/api/canva/worker/${action}`, siteUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (!response.ok) throw new Error(`Worker API returned ${response.status}.`);
  return response.json();
}

async function connectedBrowser() {
  if (browser?.isConnected()) return browser;
  browser = await chromium.connectOverCDP(cdpUrl);
  browser.on("disconnected", () => {
    browser = undefined;
  });
  return browser;
}

async function canvaPage() {
  const currentBrowser = await connectedBrowser();
  const pages = currentBrowser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) =>
    /^https:\/\/(www\.)?canva\.com\//.test(candidate.url()),
  );
  if (!page || /\/login(?:[/?#]|$)/.test(page.url())) {
    throw new Error("The owner is not signed in to Canva.");
  }
  return page;
}

// Detect Canva-side security/rate blocks that prevent all invitations.
const securityBlock =
  /security reasons|error code RRS|connect to a different Wi-Fi/i;

async function sendStudentInvitations(emails) {
  stage = "open-browser";
  const page = await canvaPage();
  await page.bringToFront();
  // Discard stale form contents from a prior attempt before filling this batch.
  await page.reload({ waitUntil: "domcontentloaded" });
  stage = "open-invitation-form";

  const openInvite = page.getByRole("button", { name: /^Invite students$/i });
  await openInvite.waitFor({ state: "visible", timeout: 15_000 });
  await openInvite.click();

  const fields = page.getByPlaceholder(/enter email address/i);
  stage = "fill-and-verify-recipients";
  for (let index = 0; index < emails.length; index++) {
    const field = fields.nth(index);
    await field.waitFor({ state: "visible", timeout: 15_000 });
    await field.fill(emails[index]);
  }
  // Verify every populated row and role before submitting the entire batch.
  for (let index = 0; index < (await fields.count()); index++) {
    const value = (await fields.nth(index).inputValue()).trim();
    if (value !== (emails[index] ?? ""))
      throw new Error("Unexpected email in invitation form.");
  }
  const roles = page.getByText(/^Student$/i);
  if ((await roles.count()) !== (await fields.count()))
    throw new Error(
      "Student roles could not be verified for every invitation row.",
    );

  const send = page
    .getByRole("button", {
      name: /^(Send invites?|Send invitations?|Invite)$/i,
    })
    .first();
  await send.waitFor({ state: "visible", timeout: 10_000 });
  stage = "await-send-confirmation";
  const watcher = await page.evaluateHandle(watchConfirmation, sentConfirmation.source);
  try {
    let clickError;
    try {
      await send.click();
    } catch (error) {
      // A successful browser action can still reject after the page updates.
      // Keep observing the fresh confirmation before treating delivery as uncertain.
      clickError = error;
    }
    const deadline = Date.now() + 30_000;
    do {
      if (await watcher.evaluate((state) => state.confirmed)) return;
      // Check for a security block so we can back off instead of retrying.
      const blocked = await page.evaluate((pattern) => {
        const re = new RegExp(pattern, "i");
        return re.test(document.body.innerText);
      }, securityBlock.source);
      if (blocked) {
        // Rotate proxy immediately when blocked so next job gets a fresh IP
        await rotateProxy();
        throw new Error("Canva blocked invitation for security reasons. Rotated proxy.");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    } while (Date.now() < deadline);
    if (clickError) throw clickError;
    throw new Error("No fresh send confirmation appeared.");
  } finally {
    await watcher.evaluate((state) => state.stop()).catch(() => {});
    await watcher.dispose();
  }
}

async function processNextJob() {
  // Never reserve an email if the owner session has expired or Canva is closed.
  await canvaPage();
  const { job } = await api("claim");
  if (!job) return;

  let outcome = "REVIEW";
  try {
    await sendStudentInvitations([job.email]);
    outcome = "SENT";
  } catch (error) {
    // An uncertain UI result must halt the queue; never risk a duplicate invite.
    console.error(
      `Canva invitation needs manual review at ${stage} (${error?.message ?? error?.name ?? "Error"}).`,
    );
  }
  await api("finish", { id: job.id, claimToken: job.claimToken, outcome });
  // Rotate to next proxy for each invite (use them 1 by 1)
  await rotateProxy();
}

let running = false;
async function run() {
  if (running) return;
  if (Date.now() < cooldownUntil) return;
  running = true;
  try {
    await processNextJob();
  } catch {
    // Keep the browser session idle if it is disconnected. No job was claimed.
    console.error(
      "Canva worker is waiting for an available signed-in browser.",
    );
  } finally {
    running = false;
  }
}

await run();
setInterval(() => void run(), pollMs);
