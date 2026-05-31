import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Verifies the ni-hero buttons still render correctly when the new
 * per-section button color settings are left blank — they must fall
 * back to the color scheme exactly like before.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("ni-hero button color overrides", () => {
  test("Buttons render with a non-transparent background and a contrasting text color by default", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero .ni-btn--primary", { timeout: 15_000 });

    const primaryStyle = await page.locator("ni-hero .ni-btn--primary").first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    // Defaults: --ni-sand (#ebe3d4) bg, --ni-text (~#050505) color
    expect(primaryStyle.bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(primaryStyle.bg).not.toBe(primaryStyle.color);

    const ghostStyle = await page.locator("ni-hero .ni-btn--ghost").first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { borderColor: cs.borderTopColor, color: cs.color };
    });
    expect(ghostStyle.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(ghostStyle.color).not.toBe("rgba(0, 0, 0, 0)");
  });
});
