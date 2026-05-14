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

  test("Renders heading, subheading, halftone, and carousel", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".hero-float__heading")).toContainText("world-class");
    await expect(root.locator(".hero-float__subheading")).toBeVisible();
    await expect(root.locator(".hero-float__halftone")).toBeVisible();
    await expect(root.locator(".hero-float__halftone-dots")).toBeVisible();
    await expect(root.locator("[data-hf-track]")).toBeVisible();
  });

  test("Halftone has 3 pulsing rings and the pulse class is applied by default", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toHaveClass(/hero-float--pulse/);

    const rings = root.locator(".hero-float__halftone-ring");
    await expect(rings).toHaveCount(3);
  });

  test("Carousel renders cards doubled for seamless loop", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const cards = root.locator(".hero-float__card");
    // 5 configured blocks * 2 for the duplicated set
    await expect(cards).toHaveCount(10);
  });

  test("Track has 3D rotateY transform applied", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const transform = await root.locator("[data-hf-track]").evaluate(
      (el) => getComputedStyle(el).transform
    );
    // matrix3d -> 3D transform actually applied (not 'none')
    expect(transform).not.toBe("none");
    expect(transform).toContain("matrix");
  });

  test("Auto-scroll pauses on hover and resumes on mouseleave", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toHaveClass(/hero-float--auto/);

    await root.hover();
    await expect(root).toHaveClass(/is-paused/);

    await root.dispatchEvent("mouseleave");
    await expect(root).not.toHaveClass(/is-paused/);
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='hero-float']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
