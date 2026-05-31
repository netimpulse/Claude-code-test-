import { test } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test("about-values Thread + Wave screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
  await page.waitForSelector(".avt, .avw", { timeout: 15_000 });

  const thread = page.locator(".avt").first();
  await thread.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500); // wait for line drawing animation
  await thread.screenshot({ path: "qa-screenshots/about-values-thread.png" });

  const wave = page.locator(".avw").first();
  await wave.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  // click 3rd word to show pin + detail
  await page.locator(".avw__word").nth(2).click();
  await page.waitForTimeout(600);
  await wave.screenshot({ path: "qa-screenshots/about-values-wave.png" });
});
