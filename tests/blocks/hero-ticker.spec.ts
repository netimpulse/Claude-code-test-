import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Hero Ticker – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, two-tone headline, body and CTAs", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ticker']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-ticker__eyebrow")).toContainText("Performance");
    await expect(root.locator(".hero-ticker__heading-strong")).toContainText("Numbers tied to revenue");
    await expect(root.locator(".hero-ticker__heading-muted")).toContainText("Not clicks");
    await expect(root.locator(".hero-ticker__btn--primary")).toContainText("audit");
    await expect(root.locator(".hero-ticker__btn--secondary")).toContainText("demo");
  });

  test("Window chrome shows label and pulsing live indicator", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ticker']").first();
    await expect(root.locator(".hero-ticker__chrome-label")).toContainText("client");
    await expect(root.locator(".hero-ticker__chrome-live")).toContainText("Live");
    await expect(root.locator(".hero-ticker__chrome-pulse")).toBeVisible();
  });

  test("All four metric blocks render with their labels and deltas", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ticker']").first();
    await expect(root.locator(".hero-ticker__metric")).toHaveCount(4);
    await expect(root.locator(".hero-ticker__metric").nth(0)).toContainText("Organic clicks");
    await expect(root.locator(".hero-ticker__metric").nth(1)).toContainText("5.42%");
    await expect(root.locator(".hero-ticker__metric").nth(2)).toContainText("€18.40");
    await expect(root.locator(".hero-ticker__metric").nth(2)).toContainText("21.4");
    await expect(root.locator(".hero-ticker__metric").nth(3)).toContainText("+2.4");
  });

  test("Live metric values change over time", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ticker']").first();
    const live = root.locator("[data-ht-value]").first();
    const a = (await live.textContent()) || "";
    await page.waitForTimeout(1200);
    const b = (await live.textContent()) || "";
    expect(a).not.toBe(b);
  });

  test("Sparklines render path data and a moving dot", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ticker']").first();
    const sparks = root.locator(".hero-ticker__spark");
    await expect(sparks).toHaveCount(4);
    const linePath = await sparks.first().locator(".hero-ticker__spark-line").evaluate((el) =>
      el.getAttribute("d")
    );
    expect(linePath && linePath.length > 0).toBeTruthy();
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-ticker']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
