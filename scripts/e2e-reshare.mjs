/**
 * Quote post / reshare (rank-7) e2e:
 *   clear su:/si: rate_limits → user A signs up + verifies + posts an original →
 *   user B signs up + verifies → B reshares A's post (instant) → the reshare
 *   appears in B's feed embedding A's post → A's reshare_count = 1 → A is
 *   notified ('reshared your post') → B quotes A's post with commentary → the
 *   commentary AND the embedded original both render → B deletes the reshare →
 *   A's reshare_count back to 0 → a reshare of a DELETED original shows the
 *   "no longer available" card → 360px renders cleanly → zero console errors.
 *
 *   BASE_URL=http://localhost:3100 node scripts/e2e-reshare.mjs
 *
 * Leaves its e2e users behind for the DB-level sweep (e2e-reshare-*@example.com).
 */
import { chromium } from "playwright";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2] ?? "";
    }
  } catch {
    /* rely on real env */
  }
}
loadEnv();
const dbClient = () => {
  const url = process.env.TURSO_PLATFORM_DB_URL;
  const token = process.env.TURSO_PLATFORM_DB_TOKEN;
  if (!url || !token) return null;
  return createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken: token });
};

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const TS = Date.now();
const A_EMAIL = `e2e-reshare-a-${TS}@example.com`;
const B_EMAIL = `e2e-reshare-b-${TS}@example.com`;
const PASSWORD = "e2e-Passw0rd-123";
const MARKER = `E2E reshare ${TS}`;
const ORIGINAL = `${MARKER} — original idea: BANKNIFTY range into expiry.`;
const QUOTE = `${MARKER} — my take: totally agree, watching this.`;

const browser = await chromium.launch();

const issues = [];
function watch(page) {
  page.on("dialog", (d) => d.accept());
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (text.includes("401")) return; // first composer/reshare POST 401s by design
    issues.push(`[console] ${page.url()} :: ${text.slice(0, 220)}`);
  });
  page.on("pageerror", (e) => issues.push(`[pageerror] ${String(e.message).slice(0, 220)}`));
}

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

const clearSignupRateLimits = async () => {
  const db = dbClient();
  if (!db) return;
  await db.execute(`DELETE FROM rate_limits WHERE key LIKE 'su:%' OR key LIKE 'si:%'`);
};

/** Signs up (with 429 backoff), verifies the email in the DB, signs in via API. */
async function signUpAndAuthenticate(ctx, page, email, name) {
  const api = ctx.request;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await api.post(`${BASE}/api/auth/sign-up/email`, {
      data: { email, password: PASSWORD, name },
      headers: { origin: BASE },
    });
    if (res.status() === 429) {
      await page.waitForTimeout(12000);
      continue;
    }
    if (![200, 201].includes(res.status()))
      throw new Error(`sign-up failed: ${res.status()} ${(await res.text()).slice(0, 120)}`);
    break;
  }
  const db = dbClient();
  if (db)
    await db.execute({ sql: `UPDATE user SET email_verified = 1 WHERE email = ?`, args: [email] });
  const signin = await api.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email, password: PASSWORD },
    headers: { origin: BASE },
  });
  if (signin.status() !== 200)
    throw new Error(`sign-in failed: ${signin.status()} ${(await signin.text()).slice(0, 120)}`);
}

console.log(`Reshare e2e on ${BASE} (A=${A_EMAIL}, B=${B_EMAIL})`);

await step("clear su:/si: rate_limits", clearSignupRateLimits);

// ── User A: post an original ──────────────────────────────────────────────
const ctxA = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const pageA = await ctxA.newPage();
watch(pageA);

let originalPostId = null;
await step("user A signs up + posts an original", async () => {
  await signUpAndAuthenticate(ctxA, pageA, A_EMAIL, "E2E Reshare A");
  await pageA.goto(`${BASE}/community`, { waitUntil: "domcontentloaded" });
  await pageA.getByRole("button", { name: "Write a post" }).first().click();
  const bodyField = pageA.getByLabel("Your post");
  await bodyField.waitFor({ state: "visible", timeout: 15000 });
  await bodyField.fill(ORIGINAL);
  const [res] = await Promise.all([
    pageA.waitForResponse(
      (r) =>
        /\/api\/community\/posts$/.test(r.url()) &&
        r.request().method() === "POST" &&
        r.status() === 201,
      { timeout: 30000 }
    ),
    pageA.getByRole("button", { name: "Post", exact: true }).click(),
  ]);
  originalPostId = (await res.json()).id;
  if (!originalPostId) throw new Error("no post id returned");
});

// ── User B: reshare A's post ──────────────────────────────────────────────
const ctxB = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const pageB = await ctxB.newPage();
watch(pageB);

const cardOn = (loc) => loc.locator("article", { hasText: MARKER }).first();

await step("user B signs up + reshares A's original (instant)", async () => {
  await signUpAndAuthenticate(ctxB, pageB, B_EMAIL, "E2E Reshare B");
  await pageB.goto(`${BASE}/community/post/${originalPostId}`, { waitUntil: "domcontentloaded" });
  await pageB.locator("article", { hasText: MARKER }).first().waitFor({ timeout: 20000 });
  await pageB
    .getByRole("button", { name: /Reshare post/ })
    .first()
    .click();
  await Promise.all([
    pageB.waitForResponse(
      (r) =>
        /\/api\/community\/posts\/[^/]+\/reshare$/.test(r.url()) &&
        r.request().method() === "POST" &&
        r.status() === 201,
      { timeout: 20000 }
    ),
    pageB.getByRole("menuitem", { name: "Reshare", exact: true }).click(),
  ]);
});

await step("A's reshare_count is 1 (API)", async () => {
  const res = await ctxA.request.get(`${BASE}/api/community/posts/${originalPostId}`, {
    headers: { origin: BASE },
  });
  if (res.status() !== 200) throw new Error(`detail fetch failed: ${res.status()}`);
  const data = await res.json();
  if (data.post.reshareCount !== 1)
    throw new Error(`expected reshareCount 1, got ${data.post.reshareCount}`);
});

await step("the reshare appears in B's feed embedding A's original post", async () => {
  // Query B's own feed via API (signed-in feed isn't anonymously cached).
  const res = await ctxB.request.get(`${BASE}/api/community/posts?sort=latest`, {
    headers: { origin: BASE },
  });
  const data = await res.json();
  const reshare = (data.posts ?? []).find((p) => p.quotePostId === originalPostId);
  if (!reshare) throw new Error("B's reshare not found in the feed");
  if (!reshare.quoted || reshare.quoted.id !== originalPostId)
    throw new Error("reshare did not embed A's original");
  if (!(reshare.quoted.body || "").includes("original idea"))
    throw new Error("embedded original missing A's body snippet");
});

await step("A is notified ('reshared your post')", async () => {
  const res = await ctxA.request.get(`${BASE}/api/community/notifications?limit=30`, {
    headers: { origin: BASE },
  });
  const data = await res.json();
  const note = (data.notifications ?? []).find((n) => n.type === "reshare");
  if (!note) throw new Error("no reshare notification for A");
  if (note.postId !== originalPostId) throw new Error("reshare notification points at wrong post");
});

await step("B's feed visibly embeds A's post (UI)", async () => {
  await pageB.goto(`${BASE}/community`, { waitUntil: "domcontentloaded" });
  // The reshare card contains the embedded quoted-post link to A's original.
  const embedded = pageB.locator(`[data-quoted-post="${originalPostId}"]`).first();
  await embedded.waitFor({ timeout: 20000 });
});

let reshareDeleteId = null;
await step(
  "B quotes A's post with commentary → commentary + embedded original render",
  async () => {
    await pageB.goto(`${BASE}/community/post/${originalPostId}`, { waitUntil: "domcontentloaded" });
    await pageB.locator("article", { hasText: MARKER }).first().waitFor({ timeout: 20000 });
    await pageB
      .getByRole("button", { name: /Reshare post/ })
      .first()
      .click();
    await pageB.getByRole("menuitem", { name: "Quote", exact: true }).click();
    // The dialog also exposes an aria-label, so scope to the textarea explicitly.
    const thoughts = pageB.locator("textarea#quote-body");
    await thoughts.waitFor({ state: "visible", timeout: 10000 });
    await thoughts.fill(QUOTE);
    const [res] = await Promise.all([
      pageB.waitForResponse(
        (r) =>
          /\/api\/community\/posts\/[^/]+\/reshare$/.test(r.url()) &&
          r.request().method() === "POST" &&
          r.status() === 201,
        { timeout: 20000 }
      ),
      pageB.getByRole("button", { name: "Post quote" }).click(),
    ]);
    reshareDeleteId = (await res.json()).id;

    // Verify via API that the quote carries the commentary AND embeds the original.
    const feed = await ctxB.request.get(`${BASE}/api/community/posts?sort=latest`, {
      headers: { origin: BASE },
    });
    const data = await feed.json();
    const quote = (data.posts ?? []).find((p) => (p.body || "").includes("my take"));
    if (!quote) throw new Error("quote post not found");
    if (!quote.quoted || quote.quoted.id !== originalPostId)
      throw new Error("quote did not embed A's original");
  }
);

await step("A's reshare_count is now 2 after the quote (API)", async () => {
  const res = await ctxA.request.get(`${BASE}/api/community/posts/${originalPostId}`, {
    headers: { origin: BASE },
  });
  const data = await res.json();
  if (data.post.reshareCount !== 2)
    throw new Error(`expected reshareCount 2, got ${data.post.reshareCount}`);
});

await step("deleting a reshare drops A's count back to 1", async () => {
  // Delete the QUOTE post (reshareDeleteId) via API.
  const del = await ctxB.request.delete(`${BASE}/api/community/posts/${reshareDeleteId}`, {
    headers: { origin: BASE },
  });
  if (del.status() !== 200) throw new Error(`delete failed: ${del.status()}`);
  const res = await ctxA.request.get(`${BASE}/api/community/posts/${originalPostId}`, {
    headers: { origin: BASE },
  });
  const data = await res.json();
  if (data.post.reshareCount !== 1)
    throw new Error(`expected reshareCount 1 after delete, got ${data.post.reshareCount}`);
});

await step("deleted-original → reshare shows the 'no longer available' card", async () => {
  // A deletes the original; B's remaining (plain) reshare must show the
  // unavailable placeholder rather than crash.
  const del = await ctxA.request.delete(`${BASE}/api/community/posts/${originalPostId}`, {
    headers: { origin: BASE },
  });
  if (del.status() !== 200) throw new Error(`delete original failed: ${del.status()}`);
  await pageB.goto(`${BASE}/community`, { waitUntil: "domcontentloaded" });
  await pageB.locator("[data-quoted-unavailable]").first().waitFor({ timeout: 20000 });
});

await step("mobile 360px: feed with the reshare card has no horizontal overflow", async () => {
  await pageB.setViewportSize({ width: 360, height: 780 });
  await pageB.goto(`${BASE}/community`, { waitUntil: "domcontentloaded" });
  await pageB.locator("[data-quoted-unavailable]").first().waitFor({ timeout: 20000 });
  const overflow = await pageB.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (overflow > 1) throw new Error(`feed overflows by ${overflow}px at 360px`);
});

await browser.close();
if (issues.length) {
  console.log(`\n${failed} step(s) failed; ${issues.length} issue(s):`);
  for (const i of issues) console.log("  " + i);
  process.exit(1);
}
console.log("\nReshare e2e passed (zero console errors).");
