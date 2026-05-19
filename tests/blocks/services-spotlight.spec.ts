import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Services Spotlight", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("services-spotlight [data-node].is-active", { timeout: 15_000 });
  });

  test("Renders heading, six nodes with permanent labels and one active", async ({ page }) => {
    const section = page.locator(".services-spotlight").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".services-spotlight__heading")).toBeVisible();

    await expect(section.locator("[data-node]")).toHaveCount(6);
    await expect(section.locator(".services-spotlight__node-label")).toHaveCount(6);
    await expect(section.locator("[data-node].is-active")).toHaveCount(1);

    // No tabs row
    await expect(section.locator(".services-spotlight__tabs")).toHaveCount(0);
  });

  test("Center title reflects the active service", async ({ page }) => {
    const section = page.locator(".services-spotlight").first();
    const title = section.locator("[data-center-title]");
    await expect(title).toBeVisible();
    const initial = await title.textContent();
    expect(initial?.trim()).toBe("Strategie & Beratung");

    await section.locator("[data-node][data-index='2']").click();
    await page.waitForTimeout(400);
    const next = await title.textContent();
    expect(next?.trim()).toBe("Shopify & Entwicklung");
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.waitForTimeout(400);
    await page.locator(".services-spotlight").first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "qa-screenshots/services-spotlight-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await page.locator(".services-spotlight").first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "qa-screenshots/services-spotlight-mobile.png",
      fullPage: true,
    });
  });
});
