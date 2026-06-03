import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Hero Web Build — Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, two-tone headline (with space) and both buttons", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-web-build']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hwb__eyebrow")).toContainText("Webdesign");

    const accent = root.locator(".hwb__heading-accent").first();
    await expect(accent).toContainText("verkaufen");

    const headingText = (await root.locator(".hwb__heading").first().textContent()) || "";
    // accent must not be glued to the preceding word
    expect(headingText).toContain(" verkaufen");
    // "—" follows accent with a space
    expect(headingText).toContain("verkaufen —");

    await expect(root.locator(".hwb__btn--primary")).toContainText("Projekt starten");
    await expect(root.locator(".hwb__btn--secondary")).toBeVisible();
    await expect(root.locator(".hwb__btn--secondary")).toContainText("Arbeiten ansehen");
  });

  test("Stats block from the legacy mock is not rendered", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-web-build']").first();
    // explicit anti-regression: the new section must not carry the WBStat strip
    await expect(root.locator(":text('Conversion-Lift')")).toHaveCount(0);
    await expect(root.locator(":text('Lighthouse')")).toHaveCount(0);
    await expect(root.locator(":text('Time-to-Launch')")).toHaveCount(0);
  });

  test("Browser-frame mock builds itself: phase variables advance over time", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-web-build']").first();
    // Sample two phase values at start and after >1s — they must grow.
    const readPhases = async () =>
      root.evaluate((el) => {
        const s = getComputedStyle(el as HTMLElement);
        return {
          header: parseFloat(s.getPropertyValue("--p-header")) || 0,
          hero: parseFloat(s.getPropertyValue("--p-hero")) || 0,
          color: parseFloat(s.getPropertyValue("--p-color")) || 0,
        };
      });
    const a = await readPhases();
    await page.waitForTimeout(3500);
    const b = await readPhases();
    expect(b.header + b.hero + b.color).toBeGreaterThan(a.header + a.hero + a.color);
  });

  test("Step progress strip advances and progress label is not 0%", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-web-build']").first();
    await page.waitForTimeout(2500);
    const activeCount = await root.locator(".hwb__step.is-active").count();
    expect(activeCount).toBeGreaterThan(0);
    const progress = (await root.locator("[data-hwb-progress]").textContent()) || "";
    expect(progress).not.toBe("0%");
  });

  test("Highlight color picks up the --hwb-highlight override", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-web-build']").first();
    await root.evaluate((el) =>
      (el as HTMLElement).style.setProperty("--hwb-highlight", "rgb(255, 0, 0)"),
    );
    const color = await root
      .locator(".hwb__heading-accent")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(255, 0, 0)");
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-web-build']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
