import { test } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

// R1: cta-compact lives on the home page (and /pages/leistungen), not on the QA block page.
for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`cta-compact Screenshot ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await page.waitForSelector(".cta-compact", { timeout: 15_000 });
    const section = page.locator(".cta-compact").first();
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await section.screenshot({ path: `qa-screenshots/cta-compact-${vp.name}.png` });
  });
}
