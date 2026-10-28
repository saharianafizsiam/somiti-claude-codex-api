import { chromium } from "playwright";

const siteUrl = new URL(process.env.CANVA_API_BASE ?? "https://somiti.page");
const workerSecret = process.env.CANVA_WORKER_SECRET;
const cdpUrl = process.env.CANVA_CDP_URL ?? "http://127.0.0.1:9222";
const pollMs = 10_000;

if (!workerSecret || workerSecret.length < 32) {
  throw new Error("CANVA_WORKER_SECRET must contain at least 32 characters.");
}

let browser;

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

async function sendStudentInvitation(email) {
  const page = await canvaPage();
  await page.bringToFront();

  const openInvite = page.getByRole("button", { name: /^Invite students$/i });
  await openInvite.waitFor({ state: "visible", timeout: 15_000 });
  await openInvite.click();

  const emailField = page.getByPlaceholder(/enter email address/i);
  await emailField.waitFor({ state: "visible", timeout: 15_000 });
  await emailField.fill(email);

  const role = page.getByText(/^Student$/i);
  if ((await role.count()) === 0) {
    throw new Error("The Canva Student role was not available.");
  }

  const send = page
    .getByRole("button", { name: /^(Send invite|Send invitation|Invite)$/i })
    .first();
  await send.waitFor({ state: "visible", timeout: 10_000 });
  await send.click();

  const confirmation = page.getByText(
    /invitation (has been )?sent|invited successfully/i,
  );
  await confirmation.waitFor({ state: "visible", timeout: 15_000 });
}

async function processNextJob() {
  // Never reserve an email if the owner session has expired or Canva is closed.
  await canvaPage();
  const { job } = await api("claim");
  if (!job) return;

  let outcome = "REVIEW";
  try {
    await sendStudentInvitation(job.email);
    outcome = "SENT";
  } catch {
    // An uncertain UI result must halt the queue; never risk a duplicate invite.
    console.error("Canva invitation needs manual review.");
  }
  await api("finish", { id: job.id, claimToken: job.claimToken, outcome });
}

async function run() {
  try {
    await processNextJob();
  } catch {
    // Keep the browser session idle if it is disconnected. No job was claimed.
    console.error("Canva worker is waiting for an available signed-in browser.");
  }
}

await run();
setInterval(() => void run(), pollMs);
