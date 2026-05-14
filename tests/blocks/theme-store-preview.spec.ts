import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Block-spezifische Tests fuer sections/theme-store-preview.liquid.
 * Erwartet die Section auf der QA-Block-Page, gefuettert mit
 * `qa-test-collection`.
 */
test.describe("Theme Store Preview – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders heading with highlighted accent, subheading, nav, and CTA", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    await expect(root).toBeVisible();

    const heading = root.locator(".tsp__heading");
    await expect(heading).toContainText("Hier geht es zum Theme-Store.");
    await expect(heading.locator(".tsp__heading-accent")).toHaveText("Theme-Store");

    await expect(root.locator(".tsp__subheading")).toContainText(
      "Eine Auswahl unserer Premium-Themes."
    );

    await expect(root.locator("[data-tsp-prev]")).toBeVisible();
    await expect(root.locator("[data-tsp-next]")).toBeVisible();

    const cta = root.locator(".tsp__cta");
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Zum Theme-Store");
  });

  test("Renders compact cards from the linked collection", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const cards = root.locator(".tsp__card");

    // products_to_show = 6; collection may have fewer, so just require >= 1
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(6);

    const first = cards.first();
    await expect(first.locator(".tsp__title")).toBeVisible();
    await expect(first.locator(".tsp__price")).toBeVisible();
    await expect(first.locator(".tsp__details")).toContainText("Details");
  });

  test("Prev is disabled at start, next scrolls the track", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const track = root.locator("[data-tsp-track]");
    const prev = root.locator("[data-tsp-prev]");
    const next = root.locator("[data-tsp-next]");

    // Force a narrow viewport so the track has overflow to scroll
    await page.setViewportSize({ width: 500, height: 800 });

    await expect(prev).toBeDisabled();

    const beforeScroll = await track.evaluate((el) => el.scrollLeft);
    await next.click();
    await page.waitForTimeout(450); // smooth-scroll settle

    const afterScroll = await track.evaluate((el) => el.scrollLeft);
    expect(afterScroll).toBeGreaterThan(beforeScroll);
  });

  test("Card image media respects the configured aspect ratio", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const media = root.locator(".tsp__media").first();

    const ratio = await media.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    // 4 / 3 = ~1.333
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(1.5);
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='theme-store-preview']").first();
    const overflow = await root.evaluate((el) => {
      return el.scrollWidth > el.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});
