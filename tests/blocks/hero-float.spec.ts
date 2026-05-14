import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Block-spezifische Tests fuer sections/hero-float.liquid.
 * Erwartet die Section auf der QA-Block-Page mit 5 Card-Blocks.
 */
test.describe("Hero Float – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders heading, subheading, halftone (no dots), and carousel", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".hero-float__heading")).toContainText("world-class");
    await expect(root.locator(".hero-float__subheading")).toBeVisible();
    await expect(root.locator(".hero-float__halftone")).toBeVisible();
    // Dots removed — only rings + logo
    await expect(root.locator(".hero-float__halftone-dots")).toHaveCount(0);
    await expect(root.locator(".hero-float__halftone-ring")).toHaveCount(3);
    await expect(root.locator("[data-hf-deck]")).toBeVisible();
  });

  test("Pulse class is applied by default", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toHaveClass(/hero-float--pulse/);
  });

  test("Carousel renders 7 cards in DOM (asymmetric visibility window)", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root.locator("[data-hf-card]")).toHaveCount(7);
  });

  test("Middle card (index 3) starts active", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const active = root.locator("[data-hf-card].is-active");
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("data-index", "3");
  });

  test("Asymmetric visibility — only 1 card visible on the left of active", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    // With 7 cards and active at index 3, cards at index 0 and 1 (offsets -3, -2)
    // should be hidden (opacity 0).
    const idx0Opacity = await root
      .locator("[data-hf-card][data-index='0']")
      .evaluate((el) => (el as HTMLElement).style.opacity);
    expect(idx0Opacity).toBe("0");

    const idx1Opacity = await root
      .locator("[data-hf-card][data-index='1']")
      .evaluate((el) => (el as HTMLElement).style.opacity);
    expect(idx1Opacity).toBe("0");

    // Index 2 (offset -1, edge peek) should be visible — slightly dimmed.
    const idx2Opacity = await root
      .locator("[data-hf-card][data-index='2']")
      .evaluate((el) => parseFloat((el as HTMLElement).style.opacity));
    expect(idx2Opacity).toBeGreaterThan(0.5);
  });

  test("Next button advances active card; Prev moves back", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const nextBtn = root.locator("[data-hf-next]");
    const prevBtn = root.locator("[data-hf-prev]");

    await nextBtn.click();
    await expect(root.locator("[data-hf-card].is-active")).toHaveAttribute("data-index", "4");

    await nextBtn.click();
    await expect(root.locator("[data-hf-card].is-active")).toHaveAttribute("data-index", "5");

    await prevBtn.click();
    await expect(root.locator("[data-hf-card].is-active")).toHaveAttribute("data-index", "4");
  });

  test("Far cards have blur applied; active card does not", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const activeFilter = await root
      .locator("[data-hf-card].is-active")
      .evaluate((el) => (el as HTMLElement).style.filter);
    expect(activeFilter).toContain("blur(0px)");

    // Right-side card at index 6 (offset +3 with active=3) should have blur.
    const farFilter = await root
      .locator("[data-hf-card][data-index='6']")
      .evaluate((el) => (el as HTMLElement).style.filter);
    expect(farFilter).toMatch(/blur\((?!0px)\d+(\.\d+)?px\)/);
  });

  test("Active card has zero rotation; neighbours are rotated", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const cards = root.locator("[data-hf-card]");

    const active = cards.filter({ has: page.locator(".is-active") }).or(
      root.locator("[data-hf-card].is-active")
    );
    const activeTransform = await root
      .locator("[data-hf-card].is-active")
      .evaluate((el) => (el as HTMLElement).style.transform);
    expect(activeTransform).toContain("rotateY(0deg)");

    // A card immediately next to the active one must have a non-zero rotation.
    const activeIndex = parseInt(
      (await root.locator("[data-hf-card].is-active").getAttribute("data-index")) || "0",
      10
    );
    const neighbourTransform = await cards
      .nth(activeIndex === 0 ? 1 : activeIndex - 1)
      .evaluate((el) => (el as HTMLElement).style.transform);
    expect(neighbourTransform).not.toContain("rotateY(0deg)");
    expect(neighbourTransform).toMatch(/rotateY\(-?\d+deg\)/);
  });

  test("Wrap-around works on Next from the last card", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const nextBtn = root.locator("[data-hf-next]");
    // 7 cards, starts at index 3. Click next 3 times to land on index 6,
    // one more click wraps to index 0.
    for (let i = 0; i < 3; i++) await nextBtn.click();
    await expect(root.locator("[data-hf-card].is-active")).toHaveAttribute("data-index", "6");
    await nextBtn.click();
    await expect(root.locator("[data-hf-card].is-active")).toHaveAttribute("data-index", "0");
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='hero-float']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
