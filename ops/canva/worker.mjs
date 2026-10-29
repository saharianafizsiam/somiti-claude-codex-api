import { chromium } from "playwright";
import { sentConfirmation } from "./confirmation.mjs";

const siteUrl = new URL(process.env.CANVA_API_BASE ?? "https://somiti.page");
const workerSecret = process.env.CANVA_WORKER_SECRET;
const cdpUrl = process.env.CANVA_CDP_URL ?? "http://127.0.0.1:9222";
const pollMs = 10_000;

if (!workerSecret || workerSecret.length < 32) {
  throw new Error("CANVA_WORKER_SECRET must contain at least 32 characters.");
}

let browser;
let stage = "idle";

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
  // Start watching before clicking: transient notices can disappear during click completion.
  // first() also avoids strict-mode errors when a toast has an accessible duplicate.
  const confirmation = page.getByText(sentConfirmation).first();
  if (await confirmation.isVisible())
    throw new Error("Stale confirmation is visible before sending.");
  const confirmed = confirmation
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(
      () => true,
      () => false,
    );
  await send.click();
  if (!(await confirmed))
    throw new Error("No explicit send confirmation appeared.");
}

async function processNextJob() {
  // Never reserve an email if the owner session has expired or Canva is closed.
  await canvaPage();
  const { jobs } = await api("claim-batch");
  if (!jobs?.length) return;

  let outcome = "REVIEW";
  try {
    await sendStudentInvitations([...new Set(jobs.map((job) => job.email))]);
    outcome = "SENT";
  } catch (error) {
    // An uncertain UI result must halt the queue; never risk a duplicate invite.
    console.error(
      `Canva invitation needs manual review at ${stage} (${error?.name ?? "Error"}).`,
    );
  }
  for (const job of jobs) {
    await api("finish", { id: job.id, claimToken: job.claimToken, outcome });
  }
}

let running = false;
async function run() {
  if (running) return;
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
