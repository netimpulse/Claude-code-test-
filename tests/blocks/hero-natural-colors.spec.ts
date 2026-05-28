import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Verifies that the hero mock UIs render their NATURAL colours — hardcoded
 * and independent of the merchant's colour scheme:
 *  - window-control "traffic light" dots: red / amber / green
 *  - Google SERP: multi-colour wordmark, blue active tab, coloured favicons
 *  - dashboard ticker: green positive / red negative deltas + sparklines, red LIVE
 *  - ad cycler: red LIVE test dot, green winner badge
 *  - GEO chat: green "monitoring" (online) dot
 */

const bg = (el: Element) => getComputedStyle(el).backgroundColor;
const fg = (el: Element) => getComputedStyle(el).color;

test.describe("Hero natural colours", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Ticker window-control dots are red / amber / green", async ({ page }) => {
    const dots = page.locator("[data-section-type='hero-ticker'] .hero-ticker__chrome-dots > span");
    await expect(dots).toHaveCount(3);
    expect(await dots.nth(0).evaluate(bg)).toBe("rgb(255, 95, 87)");
    expect(await dots.nth(1).evaluate(bg)).toBe("rgb(254, 188, 46)");
    expect(await dots.nth(2).evaluate(bg)).toBe("rgb(40, 200, 64)");
  });

  test("Ticker deltas/sparklines are green for up, red for down; LIVE is red", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ticker']").first();
    // First metric (Organic clicks) is positive → green.
    expect(await root.locator(".hero-ticker__metric-delta").first().evaluate(fg)).toBe("rgb(22, 163, 74)");
    // Third metric (Cost per acquisition) points down → red.
    const down = root.locator(".hero-ticker__metric--down");
    await expect(down).toHaveCount(1);
    expect(await down.locator(".hero-ticker__metric-delta").evaluate(fg)).toBe("rgb(220, 38, 38)");
    expect(await down.locator(".hero-ticker__spark").evaluate(fg)).toBe("rgb(220, 38, 38)");
    // LIVE indicator is red.
    expect(await root.locator(".hero-ticker__chrome-pulse").evaluate(bg)).toBe("rgb(255, 59, 48)");
  });

  test("SERP wordmark is multi-colour, active tab is Google blue, favicons coloured", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-serp']").first();
    const letters = root.locator(".hero-serp__engine span");
    await expect(letters.first()).toBeVisible();
    expect(await letters.count()).toBeGreaterThanOrEqual(4); // "Google" → 6 letter spans
    expect(await letters.nth(0).evaluate(fg)).toBe("rgb(66, 133, 244)"); // G = blue
    expect(await letters.nth(1).evaluate(fg)).toBe("rgb(234, 67, 53)"); // o = red
    // Active tab uses Google blue.
    expect(await root.locator(".hero-serp__tab--active").evaluate(fg)).toBe("rgb(26, 115, 232)");
    // A non-brand favicon is no longer grey (has a saturated background).
    const fav = root.locator(".hero-serp__favicon--c0").first();
    await expect(fav).toBeVisible();
    expect(await fav.evaluate(bg)).toBe("rgb(66, 133, 244)");
  });

  test("Ad cycler: LIVE test dot is red, winner badge is green", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    expect(await root.locator(".hero-ac__test-dot").evaluate(bg)).toBe("rgb(255, 59, 48)");
    const win = root.locator(".hero-ac__tab-win").first();
    if (await win.count()) {
      expect(await win.evaluate(bg)).toBe("rgb(22, 163, 74)");
    }
  });

  test("GEO monitoring (online) dot is green", async ({ page }) => {
    const dot = page.locator("[data-section-type='hero-geo'] .hero-geo__monitoring-dot").first();
    await expect(dot).toBeAttached();
    expect(await dot.evaluate(bg)).toBe("rgb(22, 163, 74)");
  });

  test("ni-deck window dots are red / amber / green", async ({ page }) => {
    const dots = page.locator(".ni-device__dots span");
    expect(await dots.count()).toBeGreaterThanOrEqual(3);
    expect(await dots.nth(0).evaluate(bg)).toBe("rgb(255, 95, 87)");
    expect(await dots.nth(1).evaluate(bg)).toBe("rgb(254, 188, 46)");
    expect(await dots.nth(2).evaluate(bg)).toBe("rgb(40, 200, 64)");
  });
});
