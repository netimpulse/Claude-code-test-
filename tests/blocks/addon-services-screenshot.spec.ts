import { test } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test("addon-services Screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
  await page.waitForSelector(".addon-services", { timeout: 15_000 });
  const section = page.locator(".addon-services").first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await section.screenshot({ path: "qa-screenshots/addon-services-desktop.png" });

  await page.setViewportSize({ width: 375, height: 1400 });
  await page.waitForTimeout(300);
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await section.screenshot({ path: "qa-screenshots/addon-services-mobile.png" });
});
