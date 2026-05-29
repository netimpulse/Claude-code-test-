import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Tests for the rebuilt sections/theme-store-preview.liquid.
 * Block-based: each theme is a "theme" block with a product picker
 * (no collection); the product's image/title/price are used (an
 * editorial browser mock is shown when the product has no image).
 * Cards sit directly on the background; the card lifts on hover; the
 * deck scrolls via arrows, wheel and pointer drag. An optional dark
 * "cta" card closes the deck.
 *
 * Expects the section on the QA block page, hosted with three "theme"
 * blocks (product = qa-test-produkt) and one "cta" block.
 */
test.describe("Theme Store Preview – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    await page.waitForSelector("[data-section-type='theme-store-preview']", { timeout: 15_000 });
  });

  test("Renders heading with accent, subheading and nav", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".tsp__heading")).toContainText("Themes");
    await expect(root.locator(".tsp__heading-accent")).toHaveText("Packs");
    await expect(root.locator(".tsp__subheading")).toBeVisible();
    await expect(root.locator("[data-tsp-prev]")).toBeVisible();
    await expect(root.locator("[data-tsp-next]")).toBeVisible();
  });

  test("Renders one theme card per block with name, price and preview", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    await expect(root.locator(".tsp__card--theme")).toHaveCount(3);
    const first = root.locator(".tsp__card--theme").first();
    await expect(first.locator(".tsp__name")).not.toBeEmpty();
    await expect(first.locator(".tsp__price")).toBeVisible();
    await expect(first.locator(".tsp__preview")).toBeVisible();
  });

  test("Theme cards sit directly on the background (no card-on-card panel)", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const card = root.locator(".tsp__card--theme").first();
    const style = await card.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderTopWidth };
    });
    expect(style.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(style.border).toBe("0px");
    // only the framed preview window carries a border
    const previewBorder = await root.locator(".tsp__preview").first()
      .evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(parseFloat(previewBorder)).toBeGreaterThan(0);
  });

  test("Card lifts on hover", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const card = root.locator(".tsp__card--theme").first();
    const before = await card.evaluate((el) => getComputedStyle(el).transform);
    await card.hover();
    await page.waitForTimeout(350);
    const after = await card.evaluate((el) => getComputedStyle(el).transform);
    expect(after).not.toBe(before);
    expect(after).not.toBe("none");
  });

  test("Closes with a dark store CTA card", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const cta = root.locator(".tsp__card--cta");
    await expect(cta).toHaveCount(1);
    await expect(cta.locator(".tsp__cta-btn")).toContainText("Zum Store");
  });

  test("Arrow scrolls the track and drag scrolls it back", async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 800 });
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const track = root.locator("[data-tsp-track]");

    const start = await track.evaluate((el) => el.scrollLeft);
    await root.locator("[data-tsp-next]").click();
    await page.waitForTimeout(450);
    const afterArrow = await track.evaluate((el) => el.scrollLeft);
    expect(afterArrow).toBeGreaterThan(start);

    const box = await track.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 60, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
    const afterDrag = await track.evaluate((el) => el.scrollLeft);
    expect(afterDrag).toBeLessThan(afterArrow);
  });

  test("No horizontal overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
