import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Hero SERP – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, two-tone headline, body, buttons and search mock", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-serp']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-serp__eyebrow")).toContainText("Organic search");
    await expect(root.locator(".hero-serp__heading-accent")).toContainText("search");
    await expect(root.locator(".hero-serp__body")).toContainText("Google");
    await expect(root.locator(".hero-serp__btn--primary")).toContainText("audit");
    await expect(root.locator(".hero-serp__btn--secondary")).toContainText("How we work");
    await expect(root.locator(".hero-serp__searchbar")).toBeVisible();
  });

  test("Tabs render with the first one active", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-serp']").first();
    const tabs = root.locator(".hero-serp__tab");
    await expect(tabs).toHaveCount(5);
    await expect(tabs.first()).toHaveClass(/hero-serp__tab--active/);
  });

  test("All 6 result rows render, brand-flagged row marked correctly", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-serp']").first();
    await expect(root.locator("[data-hs-row]")).toHaveCount(6);
    const brand = root.locator(".hero-serp__row--brand");
    await expect(brand).toHaveCount(1);
    await expect(brand).toContainText("Netimpulse");
  });

  test("Search bar types the configured query over time", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-serp']").first();
    const typed = root.locator("[data-hs-typed]");
    const first = (await typed.textContent()) || "";
    await page.waitForTimeout(800);
    const later = (await typed.textContent()) || "";
    expect(later.length).toBeGreaterThanOrEqual(first.length);
    await expect.poll(async () => (await typed.textContent()) || "", { timeout: 9000 }).toContain("best shopify");
  });

  test("Brand row jumps: its top position varies across the cycle", async ({ page }) => {
    test.slow();
    const root = page.locator("[data-section-type='hero-serp']").first();
    const brand = root.locator(".hero-serp__row--brand");
    const readTop = () => brand.evaluate((el) => parseFloat((el as HTMLElement).style.top || "0"));

    // Sample for >1 full cycle (8s) so we observe both pre- and post-jump positions.
    const seen: number[] = [];
    for (let i = 0; i < 16; i++) {
      seen.push(await readTop());
      await page.waitForTimeout(700);
    }
    const min = Math.min(...seen);
    const max = Math.max(...seen);
    // Pre-jump top is brand_index (3) * row_h (64) = 192. Post-jump is 0.
    expect(max - min).toBeGreaterThan(50);
    expect(min).toBeLessThan(20);
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-serp']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
