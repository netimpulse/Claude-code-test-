import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Hero Waveform Takeover – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders pill, big headline, body, CTAs and bottom strip", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-waveform']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-wt__pill")).toContainText("Live across");
    await expect(root.locator(".hero-wt__heading")).toContainText("Signal that sells");
    await expect(root.locator(".hero-wt__body")).toContainText("Shopify");
    await expect(root.locator(".hero-wt__btn--primary")).toContainText("audit");
    await expect(root.locator(".hero-wt__btn--secondary")).toContainText("recent work");
    await expect(root.locator(".hero-wt__strip-item")).toHaveCount(5);
  });

  test("Bottom strip accent flag works", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-waveform']").first();
    const accents = root.locator(".hero-wt__strip-item--accent");
    await expect(accents).toHaveCount(1);
    await expect(accents).toContainText("REVENUE");
  });

  test("Waveform renders 140 bars and center bars are tagged as accent", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-waveform']").first();
    await expect(root.locator("[data-wt-bar]")).toHaveCount(140);
    const accentCount = await root.locator(".hero-wt__bar.is-accent").count();
    expect(accentCount).toBeGreaterThan(20);
    expect(accentCount).toBeLessThan(60);
  });

  test("Bars animate: transforms change between frames", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-waveform']").first();
    const bars = root.locator("[data-wt-bar]");

    await expect
      .poll(async () =>
        bars.first().evaluate((el) => (el as HTMLElement).style.transform),
      )
      .not.toBe("scaleY(0.05)");

    const before = await bars.evaluateAll((els) =>
      els.slice(60, 70).map((el) => (el as HTMLElement).style.transform),
    );
    await page.waitForTimeout(400);
    const after = await bars.evaluateAll((els) =>
      els.slice(60, 70).map((el) => (el as HTMLElement).style.transform),
    );
    expect(before.join("|")).not.toBe(after.join("|"));
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-waveform']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
