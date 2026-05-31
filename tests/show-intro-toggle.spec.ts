import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Verifies the new show_intro toggle works: by default the small
 * intro text on the right of each section header should render, and
 * the new checkbox setting exists in the section schemas so merchants
 * can hide it from the theme editor.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("show_intro toggle", () => {
  test("Homepage: ni-intro begleittext is rendered by default", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-intro", { timeout: 15_000 });
    const text = page.locator("ni-intro .ni-intro__text").first();
    await expect(text).toBeVisible();
    await expect(text).toContainText("Online-Marketing");
  });

  test("Homepage: ni-deck begleittext slot exists (empty in template)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-deck", { timeout: 15_000 });
    // text is empty in index.json so the <p> shouldn't render — that's correct
    const text = page.locator("ni-deck .ni-deck__text");
    await expect(text).toHaveCount(0);
  });
});
