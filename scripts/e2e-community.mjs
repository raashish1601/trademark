/**
 * Community end-to-end: read logged-out → sign-in gate → post with tags →
 * like (optimistic) → comment → profile → delete. Cleans up its own user.
 *
 *   node scripts/e2e-community.mjs          (app on :3000)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = `e2e-community-${Date.now()}@example.com`;
const PASSWORD = "e2e-Passw0rd-123";
const MARKER = `E2E post ${Date.now()}`;

const browser = await chromium.launch();
const page = await browser
  .newContext({ viewport: { width: 1380, height: 900 } })
  .then((c) => c.newPage());
page.on("dialog", (d) => d.accept());
const issues = [];
page.on("pageerror", (e) => issues.push(`[pageerror] ${String(e.message).slice(0, 200)}`));

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    issues.push(`[step] ${name} :: ${String(e.message).slice(0, 180)}`);
    console.log(`  FAIL ${name}: ${String(e.message).slice(0, 180)}`);
  }
};

console.log(`Community e2e on ${BASE} as ${EMAIL}`);

await step("feed renders logged-out", async () => {
  await page.goto(`${BASE}/community`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByText("House rules").waitFor({ timeout: 60000 });
});

await step("compose → sign-in gate → sign up → posts", async () => {
  await page.getByRole("button", { name: "Write a post" }).first().click();
  await page
    .getByLabel("Your post")
    .fill(`${MARKER} — testing the community end to end. NIFTY looked great today.`);
  await page.getByRole("button", { name: "#nifty" }).click();
  await page.getByRole("button", { name: "Post", exact: true }).click();
  // not signed in → gate appears
  await page.getByText("Join the conversation").waitFor({ timeout: 10000 });
  await page.getByPlaceholder("Your name").fill("E2E Community");
  await page.getByPlaceholder("you@example.com").fill(EMAIL);
  await page.getByPlaceholder("8+ characters").fill(PASSWORD);
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.getByText("Posted to the community").waitFor({ timeout: 30000 });
});

await step("post appears in feed with tag", async () => {
  await page.getByText(MARKER).first().waitFor({ timeout: 20000 });
  await page.getByRole("link", { name: "#nifty" }).first().waitFor();
});

await step("like is optimistic", async () => {
  const likeBtn = page.getByRole("button", { name: "Like" }).first();
  await likeBtn.click();
  await page.getByRole("button", { name: "Unlike" }).first().waitFor({ timeout: 10000 });
});

await step("post page + comment", async () => {
  await page
    .getByRole("link", { name: /comments?$/ })
    .first()
    .click();
  await page.waitForURL("**/community/post/**", { timeout: 20000 });
  await page.getByLabel("Write a comment").fill("Nice one — what was the SL?");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await page.getByText("Nice one — what was the SL?").waitFor({ timeout: 15000 });
});

await step("v2: like a comment (optimistic)", async () => {
  await page.getByLabel("Like comment").first().click();
  await page.getByLabel("Unlike comment").first().waitFor({ timeout: 10000 });
});

await step("v2: threaded reply", async () => {
  // The LAST "Reply" button is the comment's action (composer submit comes first in DOM).
  await page.getByRole("button", { name: "Reply" }).last().click();
  await page.getByText(/Replying to @/).waitFor({ timeout: 5000 });
  await page
    .getByLabel("Write a comment")
    .fill("Replying to my own take — SL was below the range.");
  await page.getByRole("button", { name: "Reply", exact: true }).first().click();
  await page.getByText("Replying to my own take").waitFor({ timeout: 15000 });
});

await step("v2: bookmark → appears under Saved", async () => {
  await page.goto(`${BASE}/community`, { waitUntil: "networkidle" });
  await page.getByLabel("Save post").first().click();
  await page.getByText("Saved — find it under Saved").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Saved", exact: true }).first().click();
  await page.getByText(MARKER).first().waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Latest", exact: true }).first().click();
});

await step("v2: notifications bell renders for signed-in user", async () => {
  await page.locator('header button[aria-label^="Notifications"]').waitFor({ timeout: 10000 });
});

await step("profile page shows the post", async () => {
  await page
    .getByRole("link", { name: /profile$/ })
    .first()
    .click();
  await page.waitForURL("**/community/u/**", { timeout: 20000 });
  await page.getByText(MARKER).first().waitFor({ timeout: 15000 });
});

await step("author can delete the post", async () => {
  await page.getByLabel("Post options").first().click();
  await page.getByText("Delete post").click();
  await page.getByText("Post deleted").waitFor({ timeout: 15000 });
});

await browser.close();
console.log(failed === 0 ? "\n✅ Community e2e passed." : `\n${failed} failed`);
if (issues.length) {
  for (const i of issues) console.log("  " + i);
  process.exit(1);
}
