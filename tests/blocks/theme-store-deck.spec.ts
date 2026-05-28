import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Theme store deck – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders heading and product-driven theme cards", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".tsd__heading")).toContainText("Themes");
    // Cards come from the Shopify collection (price pulled from product).
    const cards = root.locator(".tsd__scroller .tsd__card");
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first().locator(".tsd__name")).not.toBeEmpty();
    await expect(cards.first().locator(".tsd__price")).not.toBeEmpty();
  });

  test("CTA card is fixed: it lives outside the scroller", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    const cta = root.locator(".tsd__cta");
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Zum Store");
    // The CTA must NOT be inside the scrollable track.
    const insideScroller = await root.locator(".tsd__scroller .tsd__cta").count();
    expect(insideScroller).toBe(0);
    // It is a direct child of the layout, a sibling of the scroller.
    const parentClass = await cta.evaluate((el) => el.parentElement?.className || "");
    expect(parentClass).toContain("tsd__layout");
  });

  test("Scrolling the themes does not move the fixed CTA", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    const cta = root.locator(".tsd__cta");
    const scroller = root.locator(".tsd__scroller");
    const before = await cta.boundingBox();
    await scroller.evaluate((el) => el.scrollBy({ left: 400 }));
    await page.waitForTimeout(300);
    const after = await cta.boundingBox();
    // CTA x-position stays put while the themes scroll underneath.
    expect(Math.abs((after?.x || 0) - (before?.x || 0))).toBeLessThan(2);
  });

  test("Custom card background is applied (not transparent)", async ({ page }) => {
    const card = page.locator("[data-section-type='theme-store-deck'] .tsd__card").first();
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(255, 255, 255)");
  });

  test("Next arrow scrolls the theme track horizontally", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    const scroller = root.locator(".tsd__scroller");
    const next = root.locator("[data-tsd-next]");
    const start = await scroller.evaluate((el) => el.scrollLeft);
    await next.click();
    await expect.poll(async () => scroller.evaluate((el) => el.scrollLeft), { timeout: 3000 }).toBeGreaterThan(start);
  });

  test("Hover lifts a card (transform changes)", async ({ page }) => {
    const card = page.locator("[data-section-type='theme-store-deck'] .tsd__card").first();
    const before = await card.evaluate((el) => getComputedStyle(el).transform);
    await card.hover();
    await page.waitForTimeout(350);
    const after = await card.evaluate((el) => getComputedStyle(el).transform);
    expect(after).not.toBe(before);
    expect(after).not.toBe("none");
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
