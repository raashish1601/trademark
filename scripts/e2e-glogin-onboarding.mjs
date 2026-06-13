/**
 * Post-Google-login onboarding path (Google's consent screen can't be driven
 * by Playwright, so we exercise the IDENTICAL POST-AUTH path that a Google user
 * lands on — a fresh signed-in user on /app/onboarding):
 *
 *   fresh signup → onboarding AUTO-provisions (NO mode picker) → "Setting up
 *   your journal…" → SetupForm (broker dropdown + capital) → "Start journaling"
 *   → /app/dashboard. Zero console errors.
 *
 * Also asserts the server Google init works: POST /api/auth/sign-in/social
 * {provider:"google"} returns an accounts.google.com URL.
 *
 * Serve the build with RESEND/EMAIL_FROM unset so requireEmailVerification is
 * false and email/password signup yields a session immediately (same path a
 * Google return takes). Cleans up its own e2e user afterward.
 *
 *   BASE_URL=http://localhost:3700 node scripts/e2e-glogin-onboarding.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3700";
const EMAIL = `e2e-glogin-${Date.now()}@example.com`;
const PASSWORD = "e2e-Passw0rd-123";
const issues = [];
const consoleErrors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const page = await ctx.newPage();

// The first POST /api/db/token returns 404 BY DESIGN — the client uses it to
// detect "not provisioned yet", then provisions and retries. The browser logs
// that 404 as a generic console "Failed to load resource" error, so we track
// the most recent failed response URL and ignore that one expected probe.
let last404Url = "";
page.on("response", (r) => {
  if (r.status() === 404) last404Url = r.url();
});
const isExpectedNoise = (text) =>
  /Failed to load resource/i.test(text) && /\/api\/db\/token/.test(last404Url);

page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${String(e.message).slice(0, 200)}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const text = m.text();
  if (isExpectedNoise(text)) return; // expected token-probe 404
  consoleErrors.push(`[console.error] ${text.slice(0, 200)}`);
});
page.on("dialog", (d) => d.accept());

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    issues.push(`[step] ${name} :: ${String(e.message).slice(0, 200)}`);
    console.log(`  FAIL ${name}: ${String(e.message).slice(0, 200)}`);
  }
};

console.log(`Google-login onboarding path on ${BASE} as ${EMAIL}`);

// ── 1. Server Google init still works (the only Google bit we CAN assert) ──
await step("POST /api/auth/sign-in/social {google} → accounts.google.com URL", async () => {
  const res = await page.request.post(`${BASE}/api/auth/sign-in/social`, {
    data: { provider: "google", callbackURL: "/app/onboarding" },
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) throw new Error(`status ${res.status()}`);
  const body = await res.json();
  const url = body.url ?? body.redirect ?? "";
  if (!String(url).includes("accounts.google.com"))
    throw new Error(`no google URL in response: ${JSON.stringify(body).slice(0, 160)}`);
});

// ── 2. Fresh signup → onboarding AUTO-provisions (mode picker never shows) ──
await step("fresh signup → auto-provision, no mode picker", async () => {
  await page.goto(`${BASE}/app/onboarding`, { waitUntil: "networkidle" });
  await page.getByText("Start free — we host it").click();
  await page.getByText("Create your free account").waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Your name").fill("E2E GLogin");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("8+ characters").fill(PASSWORD);
  await page.getByRole("button", { name: "Create free account" }).click();

  // After auth, the signed-in user must be auto-provisioned and routed to the
  // SetupForm WITHOUT the storage-mode picker ever re-appearing.
  await page.getByText(/set up your journal/i).waitFor({ timeout: 90000 });

  // The three mode cards must NOT be visible at the setup step.
  const pickerVisible = await page
    .getByText("Bring your own database")
    .isVisible()
    .catch(() => false);
  if (pickerVisible) throw new Error("storage-mode picker re-appeared after Google/email auth");
});

// ── 3. SetupForm has the broker dropdown + capital field ──
await step("SetupForm shows broker dropdown + starting capital", async () => {
  await page.getByText("Broker (sets the charges calculator)").waitFor({ timeout: 10000 });
  await page.getByPlaceholder("500000").waitFor({ timeout: 10000 });
  // Open the broker dropdown to confirm it's a real Select with options.
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().waitFor({ timeout: 10000 });
  await page.keyboard.press("Escape");
});

// ── 4. Submit "Start journaling" → /app/dashboard ──
await step('"Start journaling" → /app/dashboard', async () => {
  await page.getByRole("button", { name: "Start journaling" }).click();
  await page.waitForURL("**/app/dashboard", { timeout: 60000 });
  await page.getByText("Net P&L").first().waitFor({ timeout: 30000 });
});

// ── 5. Zero console errors throughout ──
await step("zero console errors", async () => {
  if (consoleErrors.length) throw new Error(consoleErrors.join(" | "));
});

// ── Cleanup: delete the e2e user (purges its hosted DB) ──
// Deletion is double-confirmed via in-app dialogs ("Continue" → "Delete
// everything"), not native window.confirm.
await step("cleanup: delete e2e account", async () => {
  await page.goto(`${BASE}/app/settings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Delete account/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/app"), { timeout: 30000 });
});

await browser.close();
if (failed > 0) {
  console.log("\nIssues:");
  for (const i of issues) console.log("  " + i);
  process.exit(1);
}
console.log("\n✅ Google-login onboarding path passed end to end.");
