import { chromium } from "playwright";

// This is the owner-login browser. Customer redemption remains disabled until
// the invitation and removal adapter has been verified against the signed-in UI.
const context = await chromium.launchPersistentContext(
  "/var/lib/somiti-canva/profile",
  {
    headless: false,
    chromiumSandbox: true,
    viewport: null,
    args: [
      "--window-size=1280,800",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
    ],
  },
);
const page = context.pages()[0] ?? (await context.newPage());
await page
  .goto("https://www.canva.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })
  .catch(() => {
    console.error(
      "Canva navigation did not finish. The browser remains available for manual login.",
    );
  });
context.on("close", () => process.exit(0));
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await context.close();
    process.exit(0);
  });
console.log("Owner login browser ready. Invitation delivery is not enabled.");
