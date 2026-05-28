import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("About page blocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".about-intro", { timeout: 15_000 });
  });

  test("All four About sections render", async ({ page }) => {
    await expect(page.locator(".about-intro").first()).toBeVisible();
    await expect(page.locator(".about-stats").first()).toBeVisible();
    await expect(page.locator(".about-values").first()).toBeVisible();
    await expect(page.locator(".about-timeline").first()).toBeVisible();
  });

  test("about-intro: headline, body and both chips render", async ({ page }) => {
    const section = page.locator(".about-intro").first();
    await expect(section.locator(".about-intro__heading")).toContainText("digitale Strukturen");
    await expect(section.locator(".about-intro__body")).toBeVisible();
    await expect(section.locator(".about-intro__chip")).toHaveCount(2);
  });

  test("about-stats: four stats with values and labels", async ({ page }) => {
    const section = page.locator(".about-stats").first();
    const stats = section.locator(".about-stats__stat");
    await expect(stats).toHaveCount(4);
    await expect(stats.first().locator(".about-stats__value")).toBeVisible();
    await expect(stats.first().locator(".about-stats__label")).toBeVisible();
  });

  test("about-values: four cards, all with square corners", async ({ page }) => {
    const section = page.locator(".about-values").first();
    const cards = section.locator(".about-values__card");
    await expect(cards).toHaveCount(4);
    const radius = await cards.first().evaluate((el) => getComputedStyle(el).borderRadius);
    expect(radius).toBe("0px");
  });

  test("about-timeline: four milestones, dots are circular", async ({ page }) => {
    const section = page.locator(".about-timeline").first();
    const steps = section.locator(".about-timeline__step");
    await expect(steps).toHaveCount(4);
    const dot = steps.first().locator(".about-timeline__dot");
    const dotInfo = await dot.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { radius: getComputedStyle(el).borderRadius, w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(dotInfo.w).toBe(dotInfo.h);
    expect(dotInfo.radius).not.toBe("0px");
  });

  test("All About sections stay within viewport at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1200 });
    await page.waitForTimeout(300);
    for (const sel of [".about-intro", ".about-stats", ".about-values", ".about-timeline"]) {
      const overflow = await page.locator(sel).first().evaluate((sec) => {
        const vw = document.documentElement.clientWidth;
        let worst = 0;
        sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const right = el.getBoundingClientRect().right;
          if (right > vw) worst = Math.max(worst, right - vw);
        });
        return worst;
      });
      expect(overflow, sel).toBeLessThanOrEqual(1);
    }
  });

  test("Captures full About-page composition screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    // Scroll through all four sections
    for (const sel of [".about-intro", ".about-stats", ".about-values", ".about-timeline"]) {
      await page.locator(sel).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
    }
    await page.screenshot({ path: "qa-screenshots/about-page-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "qa-screenshots/about-page-mobile.png", fullPage: true });
  });
});
