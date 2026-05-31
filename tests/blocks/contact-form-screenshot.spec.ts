import { test } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test("contact-form Screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
  await page.waitForSelector(".contact-form", { timeout: 15_000 });
  const section = page.locator(".contact-form").first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await section.screenshot({ path: "qa-screenshots/contact-form-desktop.png" });
});
