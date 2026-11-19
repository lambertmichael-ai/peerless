// @ts-check
const { test, expect } = require("@playwright/test");

const WEDNESDAY = new Date("2026-11-18T09:00:00-05:00");
const SATURDAY = new Date("2026-11-21T09:00:00-05:00");

async function open(page, when = WEDNESDAY, hash = "#today") {
  await page.clock.setFixedTime(when);
  // Keep tests off the network: fonts and Google APIs are stubbed or blocked.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto("/?local=1" + hash);
  await expect(page.locator("#main")).not.toContainText("Loading your record");
}

test.describe("Peerless Daily, local mode", () => {
  test("loads with the four sections and no script errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await open(page);
    await expect(page).toHaveTitle("Peerless Daily");
    for (const t of ["Today", "Week", "Forecasts", "Library"]) await expect(page.locator("nav.tabs a", { hasText: t })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a weekday shows the station strip", async ({ page }) => {
    await open(page);
    await expect(page.locator("#strip")).toBeVisible();
    await expect(page.locator("#strip button")).toHaveCount(5);
    await expect(page.locator("#mast")).toHaveText("Wednesday");
  });

  test("a weekend is a rest day", async ({ page }) => {
    await open(page, SATURDAY);
    await expect(page.locator("#mastsub")).toContainText("Rest day");
  });

  test("a morning check-in survives a reload", async ({ page }) => {
    await open(page);
    await page.locator("#strip button").first().click();
    await page.getByRole("button", { name: "I did it another way" }).click();
    await expect(page.getByRole("button", { name: /Regulation practice/ })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("#main")).not.toContainText("Loading your record");
    await page.locator("#strip button").first().click();
    await expect(page.getByRole("button", { name: /Regulation practice/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("a forecast needs a base rate, then scores a Brier on resolve", async ({ page }) => {
    await open(page, WEDNESDAY, "#forecasts");
    await page.fill("#fq", "The bill gets a markup by Dec 18");
    await page.fill("#fp", "60");
    await page.fill("#fd", "2026-12-18");
    await page.getByRole("button", { name: "Log forecast" }).click();
    await expect(page.locator("#main")).toContainText("State a base rate first");
    await page.fill("#fb", "3 of 10 similar bills got a markup within a month");
    await page.getByRole("button", { name: "Log forecast" }).click();
    await expect(page.locator("#main h3", { hasText: "The bill gets a markup" })).toBeVisible();
    await page.getByRole("button", { name: "It happened" }).click();
    await expect(page.locator("#main")).toContainText("Brier 0.160");
  });

  test("the record export is built for the Monday session", async ({ page }) => {
    await open(page, WEDNESDAY, "#library");
    await page.getByText("Copy the record by hand").click();
    await expect(page.locator("#xp")).toHaveValue(/PEERLESS APP EXPORT/);
    await expect(page.locator("#xp")).toHaveValue(/ITEM LOG/);
    // No Drive in local mode, so the send button stays off.
    await expect(page.getByRole("button", { name: "Send record to Drive now" })).toBeDisabled();
  });

  test("the settings section saves a Gemini key", async ({ page }) => {
    await open(page, WEDNESDAY, "#library");
    const s = page.locator("#settings");
    await expect(s).toContainText("Local mode");
    await expect(s).toContainText("Gemini API key (not set)");
    await expect(s).not.toContainText("null");
    await page.fill("#gkey", "test-key-123");
    await page.getByRole("button", { name: "Save key" }).click();
    await expect(s).toContainText("Gemini API key (saved)");
    expect(await page.evaluate(() => localStorage.getItem("peerless:geminiKey"))).toBe("test-key-123");
  });
});

test.describe("Gemini adapter", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("peerless:geminiKey", "test-key"));
  });

  test("returns the parsed JSON verdict and sends the key in a header", async ({ page }) => {
    let seen = null;
    await page.route(/generativelanguage\.googleapis\.com/, async r => {
      seen = { url: r.request().url(), key: r.request().headers()["x-goog-api-key"], body: r.request().postDataJSON() };
      await r.fulfill({ json: { candidates: [{ finishReason: "STOP", content: { parts: [{ text: '```json\n{"correct":true,"note":"Same diagnosis and reason."}\n```' }] } }] } });
    });
    await open(page);
    const v = await page.evaluate(async () => (await window.Peerless.use("sample")).json("check this", { modelTier: "quick" }));
    expect(v).toEqual({ correct: true, note: "Same diagnosis and reason." });
    expect(seen.key).toBe("test-key");
    expect(seen.url).toContain("gemini-flash-lite-latest");
    expect(seen.body.generationConfig.responseMimeType).toBe("application/json");
  });

  test("maps a 429 to rate_limited and a retired model to the fallback", async ({ page }) => {
    const models = [];
    await page.route(/generativelanguage\.googleapis\.com/, async r => {
      const u = r.request().url();
      models.push(u);
      if (u.includes("gemini-flash-latest")) return r.fulfill({ status: 404, json: { error: { message: "not found" } } });
      if (u.includes("gemini-2.5-flash")) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] } });
      return r.fulfill({ status: 429, json: { error: { message: "quota" } } });
    });
    await open(page);
    const out = await page.evaluate(async () => {
      const s = await window.Peerless.use("sample");
      const a = await s.json("x", {});
      let code = null;
      try { await s.json("x", { modelTier: "quick" }); } catch (e) { code = e.code; }
      return { a, code };
    });
    expect(out.a).toEqual({ ok: 1 });
    expect(out.code).toBe("rate_limited");
    expect(models.some(u => u.includes("gemini-2.5-flash"))).toBe(true);
  });
});

test.describe("PWA", () => {
  test("the manifest is valid and installable", async ({ page, request }) => {
    const r = await request.get("/manifest.webmanifest");
    expect(r.ok()).toBe(true);
    const m = await r.json();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBeTruthy();
    const sizes = m.icons.map(i => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some(i => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect((await request.get("/" + i.src)).ok()).toBe(true);
  });

  test("the service worker installs and serves the shell offline", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium");
    await open(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("nav.tabs")).toBeVisible();
    await context.setOffline(false);
  });

  test("the service worker shows a notification for a push", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium");
    await open(page);
    const src = await (await page.request.get("/sw.js")).text();
    expect(src).toContain('addEventListener("push"');
    expect(src).toContain('addEventListener("notificationclick"');
  });
});
