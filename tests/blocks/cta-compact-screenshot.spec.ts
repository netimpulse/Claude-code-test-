import { test } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test("cta-compact Screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
  await page.waitForSelector(".cta-compact", { timeout: 15_000 });
  const section = page.locator(".cta-compact").first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await section.screenshot({ path: "qa-screenshots/cta-compact-desktop.png" });
});
