import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Block-spezifische Tests fuer sections/theme-store.liquid.
 * Erwartet 12 Theme-Produkte verteilt auf 4 Collections (fashion, handwerk,
 * business, shopify), siehe templates/page.qa-block-test.json.
 */
test.describe("Theme Store – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders search bar, sidebar with categories, and product grid", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store']").first();
    await expect(root).toBeVisible();

    await expect(root.locator("[data-ts-search-input]")).toBeVisible();

    // 4 categories + the All entry = 5 sidebar items
    const catItems = root.locator("[data-ts-cat]");
    await expect(catItems).toHaveCount(5);
    await expect(root.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "true");

    // 12 unique products rendered
    const products = root.locator("[data-ts-product]");
    await expect(products).toHaveCount(12);
  });

  test("Category filter shows only matching products and updates URL", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store']").first();

    await root.locator("[data-ts-cat='fashion']").click();

    // URL is updated via pushState
    await expect.poll(() => new URL(page.url()).searchParams.get("cat")).toBe("fashion");

    await expect(root.locator("[data-ts-cat='fashion']")).toHaveAttribute("aria-current", "true");
    await expect(root.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "false");

    const visibleProducts = root.locator("[data-ts-product]:not([hidden])");
    await expect(visibleProducts).toHaveCount(3);

    // Reset to All
    await root.locator("[data-ts-cat='all']").click();
    await expect(root.locator("[data-ts-product]:not([hidden])")).toHaveCount(12);
  });

  test("Predictive search shows results for exact match", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store']").first();
    const input = root.locator("[data-ts-search-input]");

    await input.fill("aurora");
    const results = root.locator("[data-ts-search-results]");
    await expect(results).toBeVisible();

    const titles = results.locator(".theme-store__search-result-title");
    await expect(titles.first()).toContainText(/aurora/i);
  });

  test("Predictive search tolerates typos (fuzzy fallback)", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store']").first();
    const input = root.locator("[data-ts-search-input]");

    // 'auora' is a one-letter deletion of 'aurora'
    await input.fill("auora");
    const results = root.locator("[data-ts-search-results]");
    await expect(results).toBeVisible();

    // Either Aurora is in the rendered list, or a "did you mean" suggestion points to it.
    const html = (await results.innerHTML()).toLowerCase();
    expect(html).toContain("aurora");
  });

  test("Mobile sidebar toggle expands and collapses", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='theme-store']").first();
    const toggle = root.locator("[data-ts-sidebar-toggle]");
    const panel = root.locator("[data-ts-sidebar-panel]");

    await expect(toggle).toBeVisible();
    await expect(panel).not.toBeVisible();

    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await toggle.click();
    await expect(panel).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Color scheme + font pickers feed inline CSS variables", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store']").first();

    const vars = await root.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return {
        accent: cs.getPropertyValue("--ts-accent").trim(),
        bg: cs.getPropertyValue("--ts-bg").trim(),
        text: cs.getPropertyValue("--ts-text").trim(),
        headingFont: cs.getPropertyValue("--ts-heading-font").trim(),
        bodyFont: cs.getPropertyValue("--ts-body-font").trim(),
      };
    });

    expect(vars.accent).toMatch(/^#[0-9A-Fa-f]{3,8}$|^rgb/i);
    expect(vars.bg).toMatch(/^#[0-9A-Fa-f]{3,8}$|^rgb/i);
    expect(vars.text).toMatch(/^#[0-9A-Fa-f]{3,8}$|^rgb/i);
    expect(vars.headingFont.length).toBeGreaterThan(0);
    expect(vars.bodyFont.length).toBeGreaterThan(0);

    const headingFamily = await root.locator(".theme-store__heading").first().evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(headingFamily.length).toBeGreaterThan(0);
  });

  test("No horizontal scroll at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});
