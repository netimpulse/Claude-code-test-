import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Service aspects", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".service-aspects__grid", { timeout: 15_000 });
  });

  test("Renders heading and six equal-size tiles", async ({ page }) => {
    const section = page.locator(".service-aspects").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".service-aspects__heading")).toContainText("SEO-Projekt");

    const tiles = section.locator(".service-aspects__tile");
    await expect(tiles).toHaveCount(6);
    await expect(tiles.first().locator(".service-aspects__tile-title")).toHaveText("Audit");

    // Equal size: every tile shares the same width and height.
    const boxes = await tiles.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      })
    );
    const first = boxes[0];
    for (const b of boxes) {
      expect(Math.abs(b.w - first.w)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.h - first.h)).toBeLessThanOrEqual(1);
    }
  });

  test("Columns are staggered on desktop (not one straight row)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.waitForTimeout(300);
    const tiles = page.locator(".service-aspects").first().locator(".service-aspects__tile");

    const tops = await tiles.evaluateAll((els) =>
      els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().top))
    );
    // The first three tiles (the three columns) must sit at different heights.
    const unique = new Set(tops);
    expect(unique.size).toBeGreaterThan(1);
  });

  test("Stacks to a single column with no stagger on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    const grid = page.locator(".service-aspects__grid").first();
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(" ").length).toBe(1);

    const transform = await grid
      .locator(".service-aspects__tile")
      .first()
      .evaluate((el) => getComputedStyle(el).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  });

  test("No horizontal overflow within the section at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForTimeout(200);
    const overflow = await page.locator(".service-aspects").first().evaluate((sec) => {
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
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.waitForTimeout(300);
    await page.locator(".service-aspects").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/service-aspects-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    await page.locator(".service-aspects").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/service-aspects-mobile.png", fullPage: true });
  });
});
