import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Verifies the user complaint that the homepage hero is too tall to fit
 * the viewport. After the ~22% downscale of all sections, the ni-hero
 * shell must fit within a 1280x800 desktop viewport so the user can see
 * the entire hero without scrolling.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Homepage hero fits viewport", () => {
  test("ni-hero shell height fits within 1280x800 viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero", { timeout: 15_000 });

    const shell = page.locator("ni-hero .ni-hero__shell").first();
    const height = await shell.evaluate((el) => el.getBoundingClientRect().height);
    // viewport is 800; allow header + small bottom margin = up to 760
    expect(height).toBeLessThan(760);
  });

  test("Captures homepage hero screenshot at 1280x800", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero", { timeout: 15_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "qa-screenshots/homepage-hero-viewport.png" });
  });

  test("No horizontal overflow on homepage", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero", { timeout: 15_000 });
    for (const sel of ["ni-hero", "ni-intro", "ni-deck"]) {
      const el = page.locator(sel).first();
      const overflow = await el.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
      expect(overflow, `${sel} overflow`).toBe(false);
    }
  });
});
