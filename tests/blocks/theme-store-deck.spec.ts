import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Theme store deck – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders heading, theme cards and the CTA card on the background", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".tsd__heading")).toContainText("Themes");
    // 4 theme cards + 1 CTA card from the QA template.
    await expect(root.locator(".tsd__card--theme")).toHaveCount(4);
    await expect(root.locator(".tsd__card--cta")).toHaveCount(1);
    await expect(root.locator(".tsd__card--theme").first()).toContainText("Meridian");
    await expect(root.locator(".tsd__card--theme").first()).toContainText("149 €");
    await expect(root.locator(".tsd__card--cta")).toContainText("Zum Store");
  });

  test("Cards lie directly on the background (no outer container card)", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    // The track is a direct grid of items; there is no wrapping card element.
    const trackParent = await root.locator("[data-tsd-track]").evaluate(
      (el) => (el.parentElement?.className || "")
    );
    expect(trackParent).toContain("tsd__inner");
  });

  test("Tags render as pills and dark variant is applied", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    await expect(root.locator(".tsd__card--theme").first().locator(".tsd__tag")).toHaveCount(2);
    // Second card (Loom) is the dark preview variant.
    await expect(root.locator(".tsd__card--dark")).toHaveCount(1);
    await expect(root.locator(".tsd__card--dark")).toContainText("Loom");
  });

  test("Hover lifts the card (transform changes)", async ({ page }) => {
    const card = page.locator("[data-section-type='theme-store-deck'] .tsd__card--theme").first();
    const before = await card.evaluate((el) => getComputedStyle(el).transform);
    await card.hover();
    await page.waitForTimeout(350);
    const after = await card.evaluate((el) => getComputedStyle(el).transform);
    expect(after).not.toBe(before);
    expect(after).not.toBe("none");
  });

  test("Next arrow scrolls the track horizontally", async ({ page }) => {
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    const track = root.locator("[data-tsd-track]");
    const next = root.locator("[data-tsd-next]");
    const start = await track.evaluate((el) => el.scrollLeft);
    await next.click();
    await expect.poll(async () => track.evaluate((el) => el.scrollLeft), { timeout: 3000 }).toBeGreaterThan(start);
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='theme-store-deck']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
