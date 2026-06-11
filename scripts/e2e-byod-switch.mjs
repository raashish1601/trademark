/**
 * Heavy end-to-end: a real user brings their own Turso DB, uses the whole app,
 * joins the community, then switches storage mode 7 times across byod/hosted/local —
 * verifying data integrity and that every screen works after each switch.
 *
 *   BYOD_URL=libsql://... BYOD_TOKEN=... node scripts/e2e-byod-switch.mjs
 *
 * The app must be serving on BASE_URL with matching BETTER_AUTH_URL.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const BYOD_URL = process.env.BYOD_URL;
const BYOD_TOKEN = process.env.BYOD_TOKEN;
const EMAIL = `e2e-byod-${Date.now()}@example.com`;
const PASSWORD = "e2e-Passw0rd-123";
const POST_MARKER = `BYOD journey ${Date.now()}`;

if (!BYOD_URL || !BYOD_TOKEN) {
  console.error("Set BYOD_URL and BYOD_TOKEN");
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const page = await ctx.newPage();
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${page.url()} :: ${String(e.message).slice(0, 160)}`));

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}: ${String(e.message).slice(0, 200)}`);
    await page.screenshot({ path: `e2e-fail-${name.replace(/\W+/g, "-").slice(0, 40)}.png` }).catch(() => {});
  }
};

// ── building blocks ─────────────────────────────────────────────
async function clearBrowserState() {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    for (const db of await indexedDB.databases?.() ?? []) db.name && indexedDB.deleteDatabase(db.name);
  });
}

async function connectByod() {
  await page.goto(`${BASE}/app/onboarding`, { waitUntil: "networkidle" });
  await page.getByText("Bring your own database").click();
  await page.getByText("Connect your Turso database").waitFor({ timeout: 15000 });
  await page.getByPlaceholder(/libsql:\/\/my-journal/).fill(BYOD_URL);
  await page.getByPlaceholder("eyJhbGciOi…").fill(BYOD_TOKEN);
  await page.getByRole("button", { name: "Connect database" }).click();
}

async function doSetupIfNeeded() {
  // Fresh DB → setup form; already-onboarded DB → straight to dashboard.
  const setup = page.getByText("Set up your journal");
  const dash = page.getByText("Net P&L").first();
  await Promise.race([
    setup.waitFor({ timeout: 60000 }).catch(() => {}),
    page.waitForURL("**/app/dashboard", { timeout: 60000 }).catch(() => {}),
  ]);
  if (await setup.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Start journaling" }).click();
  }
  await page.waitForURL("**/app/dashboard", { timeout: 60000 });
  await dash.waitFor({ timeout: 30000 });
}

async function logEquityTrade(symbol, entry, exit) {
  await page.goto(`${BASE}/app/trades`, { waitUntil: "networkidle" });
  await page.keyboard.press("t");
  await page.getByPlaceholder("NIFTY / RELIANCE").waitFor({ timeout: 10000 });
  await page.getByPlaceholder("NIFTY / RELIANCE").fill(symbol);
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Equity" }).click();
  await page.getByPlaceholder("75").fill("10");
  await page.getByPlaceholder("120.50").fill(String(entry));
  await page.getByPlaceholder("blank = open").fill(String(exit));
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.getByText("Trade saved").waitFor({ timeout: 10000 });
}

async function countTrades() {
  await page.goto(`${BASE}/app/trades`, { waitUntil: "networkidle" });
  await page.locator("table tbody tr, [data-empty]").first().waitFor({ timeout: 20000 }).catch(() => {});
  return page.locator("table tbody tr").count();
}

async function tourScreens() {
  for (const [path, marker] of [
    ["/app/journal", "Pre-market plan"],
    ["/app/calendar", "Calendar"],
    ["/app/analytics", "Analytics"],
    ["/app/rules", "Today's rules"],
    ["/app/playbooks", "Playbooks"],
    ["/app/reports", "review"],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.getByText(new RegExp(marker, "i")).first().waitFor({ timeout: 20000 });
  }
}

/** Switch storage mode via Settings. target = 'hosted' | 'byod' | 'local'. */
async function switchMode(target) {
  await page.goto(`${BASE}/app/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Switch storage mode" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Switch storage mode").waitFor({ timeout: 10000 });
  const title =
    target === "hosted" ? "Move to hosted" : target === "byod" ? "Move to your own database" : "Move to this browser";
  // Scope to the dialog — the Settings page copy also mentions "move to your own database".
  await dialog.getByText(title, { exact: true }).click();

  if (target === "byod") {
    await page.getByLabel("Your Turso database URL").fill(BYOD_URL);
    await page.getByLabel("Auth token").fill(BYOD_TOKEN);
    await page.getByRole("button", { name: /Copy my data/ }).click();
  } else if (target === "hosted") {
    // If not signed in yet, the auth form appears inside the wizard.
    const authVisible = await page
      .getByRole("button", { name: "Create free account" })
      .isVisible()
      .catch(() => false);
    if (authVisible) {
      await page.getByPlaceholder("Your name").fill("BYOD Tester");
      await page.getByPlaceholder("you@example.com").fill(EMAIL);
      await page.getByPlaceholder("8+ characters").fill(PASSWORD);
      await page.getByRole("button", { name: "Create free account" }).click();
    }
  }
  await page.getByText(/Verified & switched/).waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "Reload app" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 60000 });
  await page.getByText("Net P&L").first().waitFor({ timeout: 30000 });
}

// ── the journey ─────────────────────────────────────────────────
console.log(`BYOD multi-switch journey on ${BASE}`);
let expectedTrades = 0;

await step("clear browser state (new user)", clearBrowserState);

await step("connect BYOD + setup", async () => {
  await connectByod();
  await doSetupIfNeeded();
});

await step("log 3 trades", async () => {
  await logEquityTrade("RELIANCE", 2400, 2460);
  await logEquityTrade("TCS", 3800, 3760);
  await logEquityTrade("INFY", 1500, 1545);
  expectedTrades = 3;
  const n = await countTrades();
  if (n < 3) throw new Error(`expected >=3 trades, got ${n}`);
});

await step("tour every screen (BYOD)", tourScreens);

await step("join community + post (creates account while in BYOD)", async () => {
  await page.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Write a post" }).first().click();
  await page.getByLabel("Your post").fill(`${POST_MARKER} — loving this journal in BYOD mode.`);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.getByText("Join the conversation").waitFor({ timeout: 10000 });
  await page.getByPlaceholder("Your name").fill("BYOD Tester");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("8+ characters").fill(PASSWORD);
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.getByText("Posted to the community").waitFor({ timeout: 30000 });
});

// Seven switches across all three modes.
const journey = [
  ["hosted", "switch 1: BYOD → hosted"],
  ["local", "switch 2: hosted → browser"],
  ["byod", "switch 3: browser → BYOD"],
  ["local", "switch 4: BYOD → browser"],
  ["hosted", "switch 5: browser → hosted"],
  ["byod", "switch 6: hosted → BYOD"],
  ["hosted", "switch 7: BYOD → hosted"],
];

for (const [target, label] of journey) {
  await step(label, async () => {
    await switchMode(target);
  });
  await step(`${label} — data + screens intact`, async () => {
    const n = await countTrades();
    if (n !== expectedTrades) throw new Error(`trade count drifted: expected ${expectedTrades}, got ${n}`);
    await tourScreens();
  });
}

await step("community post still present (central, survives switches)", async () => {
  await page.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  await page.getByText(POST_MARKER).first().waitFor({ timeout: 20000 });
});

await browser.close();
console.log(`\n${failed === 0 ? "✅ All passed" : `❌ ${failed} failed`}`);
if (errors.length) {
  console.log("\nRuntime errors:");
  for (const e of [...new Set(errors)]) console.log("  " + e);
}
if (failed || errors.length) process.exit(1);
