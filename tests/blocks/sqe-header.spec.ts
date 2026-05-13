import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("SQE Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
  });

  test("Renders header with logo, nav, actions", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    await expect(header).toBeVisible();
    await expect(header.locator(".sqe-header__logo")).toBeVisible();
  });

  test("Search panel opens on icon click and predictive search queries on input", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    const toggle = header.locator("[data-sqe-search-toggle]");
    await expect(toggle).toBeVisible();
    await toggle.click();
    const input = header.locator("[data-sqe-search-input]");
    await expect(input).toBeVisible();
    // Fire a query that should match the QA test product
    await input.fill("QA");
    // Wait for results panel to populate (debounce 200ms + network)
    await expect(header.locator("[data-sqe-search-results]")).toBeVisible({ timeout: 8000 });
    const html = await header.locator("[data-sqe-search-results]").innerHTML();
    expect(html.toLowerCase()).toContain("qa");
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/sqe-header-desktop.png", fullPage: false });

    await page.setViewportSize({ width: 390, height: 740 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/sqe-header-mobile.png", fullPage: false });
  });
});
