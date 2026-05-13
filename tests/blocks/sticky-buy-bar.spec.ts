import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Sticky-Buy-Bar — sichtbar/klickbar auf Storefront-Root.
 * Vorher Cart leeren; Click auf CTA addet qa-test-produkt via AJAX.
 */

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Sticky Buy Bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.evaluate(async () => {
      await fetch("/cart/clear.js", { method: "POST" });
    });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
  });

  test("Bar is visible and shows product title + price + CTA", async ({ page }) => {
    const bar = page.locator("[data-section-type='sticky-buy-bar']").first();
    await expect(bar).toBeVisible();
    await expect(bar).toHaveClass(/is-visible/);

    await expect(bar.locator(".sticky-buy-bar__title")).toBeVisible();
    await expect(bar.locator(".sticky-buy-bar__price")).toBeVisible();
    await expect(bar.locator("[data-sticky-buy-bar-cta]")).toBeVisible();

    // Bonus: capture desktop screenshot from this passing test (bar is on screen).
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "qa-screenshots/sticky-buy-bar-desktop.png", fullPage: false });

    // Then mobile viewport, same page (no re-navigation → bypasses Cloudflare re-challenge).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "qa-screenshots/sticky-buy-bar-mobile.png", fullPage: false });
  });

  test("Add-to-Cart click adds product to cart (no reload)", async ({ page }) => {
    const bar = page.locator("[data-section-type='sticky-buy-bar']").first();
    await expect(bar).toBeVisible();

    const navigations: string[] = [];
    page.on("framenavigated", (f) => navigations.push(f.url()));

    await bar.locator("[data-sticky-buy-bar-cta]").click();

    await expect(bar.locator("[data-sticky-buy-bar-cta]")).toHaveClass(/is-success/);

    const cart = await page.evaluate(async () => {
      const r = await fetch("/cart.js", { headers: { Accept: "application/json" } });
      return r.json();
    });

    expect(cart.item_count).toBe(1);
    expect(navigations.length).toBeLessThanOrEqual(1); // only the initial load
  });

  test("Dismiss button hides bar and persists in sessionStorage", async ({ page }) => {
    const bar = page.locator("[data-section-type='sticky-buy-bar']").first();
    const sectionId = await bar.getAttribute("data-section-id");
    await expect(bar).toBeVisible();

    await bar.locator("[data-sticky-buy-bar-dismiss]").click();

    const flag = await page.evaluate(
      (id) => sessionStorage.getItem(`stickyBuyBar:dismissed:${id}`),
      sectionId
    );
    expect(flag).toBe("1");
  });
});
