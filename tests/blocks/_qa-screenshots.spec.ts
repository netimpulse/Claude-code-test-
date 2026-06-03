import { test } from "@playwright/test";
import { withTheme } from "../fixtures";

test("screenshot: hero-ticker default (SEA page)", async ({ page }) => {
  await page.goto(withTheme("/pages/sea"), { waitUntil: "networkidle" });
  const root = page.locator("[data-section-type='hero-ticker']").first();
  await root.scrollIntoViewIfNeeded();
  await root.screenshot({ path: "qa-screenshots/hero-ticker-default.png" });
});

test("screenshot: hero-serp default (SEO page)", async ({ page }) => {
  await page.goto(withTheme("/pages/seo"), { waitUntil: "networkidle" });
  const root = page.locator("[data-section-type='hero-serp']").first();
  await root.scrollIntoViewIfNeeded();
  await root.screenshot({ path: "qa-screenshots/hero-serp-default.png" });
});
