import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Image with text", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".image-with-text", { timeout: 15_000 });
  });

  test("Renders heading, body and the floating badge", async ({ page }) => {
    const section = page.locator(".image-with-text").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".image-with-text__heading")).toContainText("SEO at Scale");
    await expect(section.locator(".image-with-text__body")).toBeVisible();

    const badge = section.locator(".image-with-text__badge");
    await expect(badge).toBeVisible();
    await expect(badge.locator(".image-with-text__badge-value")).toHaveText("50+");
    await expect(badge.locator(".image-with-text__badge-label")).toHaveText("Industries Served");
  });

  test("Image-right places the media after the text in visual order", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    const grid = page.locator(".image-with-text__grid").first();
    await expect(grid).toHaveClass(/image-with-text--image-right/);

    const mediaOrder = await grid.locator(".image-with-text__media").evaluate(
      (el) => getComputedStyle(el).order
    );
    const contentOrder = await grid.locator(".image-with-text__content").evaluate(
      (el) => getComputedStyle(el).order
    );
    expect(Number(mediaOrder)).toBeGreaterThan(Number(contentOrder));
  });

  test("Stacks to a single column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(200);
    const grid = page.locator(".image-with-text__grid").first();
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(" ").length).toBe(1);
  });

  test("No horizontal overflow within the section at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForTimeout(200);
    const overflow = await page.locator(".image-with-text").first().evaluate((sec) => {
      const vw = document.documentElement.clientWidth;
      let worst = 0;
      sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const right = el.getBoundingClientRect().right;
        if (right > vw) worst = Math.max(worst, right - vw);
      });
      return worst;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.waitForTimeout(300);
    await page.locator(".image-with-text").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/image-with-text-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    await page.locator(".image-with-text").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/image-with-text-mobile.png", fullPage: true });
  });
});
