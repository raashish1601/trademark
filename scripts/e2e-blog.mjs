/**
 * Blog submission + admin approval e2e. Requires ADMIN_EMAILS to include the
 * admin account this test signs in as.
 *
 *   ADMIN_EMAIL=raashish1601@gmail.com ADMIN_PASSWORD=... node scripts/e2e-blog.mjs
 *
 * If ADMIN_EMAIL isn't set, only the submission half runs (with a throwaway user).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TITLE = `E2E blog post ${Date.now()}`;

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1380, height: 900 } }).then((c) => c.newPage());
page.on("dialog", (d) => d.accept());
let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}: ${String(e.message).slice(0, 160)}`);
  }
};

const signUp = async (email, password) => {
  await page.goto(`${BASE}/app/onboarding`, { waitUntil: "networkidle" });
  await page.getByText("Start free — we host it").click();
  await page.getByText("Create your free account").waitFor({ timeout: 15000 });
  await page.getByPlaceholder("Your name").fill("E2E Admin");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("8+ characters").fill(password);
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.waitForTimeout(3000);
};

console.log(`Blog e2e on ${BASE}`);

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  await step("admin signs up", async () => {
    await signUp(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  await step("submit a blog post via rich editor", async () => {
    await page.goto(`${BASE}/blog/write`, { waitUntil: "networkidle" });
    await page.getByLabel("Title").fill(TITLE);
    await page.getByLabel("Summary").fill("An end-to-end test article about disciplined trading and journaling habits.");
    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.pressSequentially("This is the body of the test article. ".repeat(3));
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page.getByText("Submitted for review").waitFor({ timeout: 20000 });
  });

  await step("admin sees it pending and approves", async () => {
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.getByText(TITLE).waitFor({ timeout: 20000 });
    await page
      .locator("article", { hasText: TITLE })
      .getByRole("button", { name: "Approve" })
      .click();
    await page.getByText("Published").waitFor({ timeout: 15000 });
  });

  await step("approved post appears on the public blog", async () => {
    await page.goto(`${BASE}/blog`, { waitUntil: "networkidle" });
    await page.getByText(TITLE).waitFor({ timeout: 20000 });
  });
} else {
  console.log("  (no ADMIN_EMAIL/ADMIN_PASSWORD — skipping; set them to run the full flow)");
}

await browser.close();
console.log(failed === 0 ? "\n✅ Blog e2e passed." : `\n${failed} failed`);
if (failed) process.exit(1);
