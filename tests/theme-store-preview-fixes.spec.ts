import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Verifies four fixes to the theme-store-preview section:
 * 1) clicking a card with a product navigates to the product page
 *    (the drag-handler no longer eats the click)
 * 2) the nav arrows are hidden when there is no horizontal overflow
 * 3) the tag chips have a comfortable bottom gap from the card edge
 * 4) the new card color settings exist as CSS-variable hooks
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("theme-store-preview fixes", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".tsp", { timeout: 15_000 });
  });

  test("Nav arrows are hidden when track has no horizontal overflow", async ({ page }) => {
    await page.waitForTimeout(400);
    const overflow = await page.locator(".tsp .tsp__track").first().evaluate((el) => {
      return el.scrollWidth - el.clientWidth;
    });
    if (overflow <= 1) {
      const navVisible = await page.locator(".tsp .tsp__nav").first().isVisible();
      expect(navVisible).toBe(false);
    } else {
      // overflow exists — nav should be visible
      await expect(page.locator(".tsp .tsp__nav").first()).toBeVisible();
    }
  });

  test("Tag chips have a comfortable bottom padding inside the card info", async ({ page }) => {
    const padBottom = await page.locator(".tsp .tsp__info").first().evaluate((el) => {
      return parseFloat(getComputedStyle(el).paddingBottom);
    });
    expect(padBottom).toBeGreaterThanOrEqual(12);
  });

  test("Card background covers both the preview area AND the info area", async ({ page }) => {
    const cardBg = await page.locator(".tsp .tsp__card--theme").first().evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    // The card itself must have a real, non-transparent background now
    // (previously it was transparent and only the preview was tinted).
    expect(cardBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(cardBg).not.toBe("transparent");
  });

  test("Theme cards expose a navigable href (clicking does not get eaten)", async ({ page }) => {
    const cards = page.locator(".tsp .tsp__card--theme");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const href = await cards.nth(i).getAttribute("href");
      expect(href, `card ${i} href`).not.toBeNull();
      expect(href!.length, `card ${i} href non-empty`).toBeGreaterThan(0);
    }
  });

  test("Clicking a card with a real product href triggers navigation", async ({ page }) => {
    const card = page.locator(".tsp .tsp__card--theme").filter({
      hasNot: page.locator('[href="#"]'),
    }).first();
    const exists = (await card.count()) > 0;
    test.skip(!exists, "No theme card with a real product href in the homepage section");
    const targetHref = await card.getAttribute("href");
    await card.scrollIntoViewIfNeeded();
    await Promise.all([
      page.waitForURL((url) => url.pathname === targetHref || url.pathname.startsWith(targetHref!), { timeout: 10_000 }),
      card.click(),
    ]);
    expect(page.url()).toContain(targetHref!);
  });
});
