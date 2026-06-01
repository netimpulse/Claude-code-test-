import { test } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test("service-aspects chaos screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
  await page.waitForSelector(".service-aspects", { timeout: 15_000 });
  const section = page.locator(".service-aspects").first();
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await section.screenshot({ path: "qa-screenshots/service-aspects-chaos.png" });
});
