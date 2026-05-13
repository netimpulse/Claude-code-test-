import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Pricing Tiers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
  });

  test("Renders 3 tiers with heading + middle highlighted", async ({ page }) => {
    const section = page.locator("[data-section-type='pricing-tiers']").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".pricing-tiers__heading")).toHaveText(/Plan/i);
    const tiers = section.locator("[data-pricing-tier]");
    await expect(tiers).toHaveCount(3);
    await expect(tiers.nth(1)).toHaveClass(/pricing-tier--highlight/);
    await expect(tiers.nth(1).locator(".pricing-tier__badge")).toContainText(/Beliebt/);
  });

  test("Toggle switches monthly/yearly prices", async ({ page }) => {
    const section = page.locator("[data-section-type='pricing-tiers']").first();
    const yearlyBtn = section.locator("[data-pricing-toggle] [data-period='yearly']");
    const proAmount = section.locator("[data-pricing-tier]").nth(1).locator("[data-pricing-amount]");

    await expect(proAmount).toHaveText("29");
    await yearlyBtn.click();
    await expect(proAmount).toHaveText("24");
    await expect(yearlyBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("Mobile: no horizontal scroll at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test("Captures desktop + mobile screenshots", async ({ page }) => {
    const section = page.locator("[data-section-type='pricing-tiers']").first();
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    await page.setViewportSize({ width: 1280, height: 1000 });
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/pricing-tiers-desktop.png", fullPage: false });

    await page.setViewportSize({ width: 390, height: 1500 });
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/pricing-tiers-mobile.png", fullPage: false });
  });
});
