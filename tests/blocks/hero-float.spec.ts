import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Float — continuously rotating 3D wheel.
 */
test.describe("Hero Float – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders heading, subheading, halftone and the wheel deck", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".hero-float__heading")).toContainText("world-class");
    await expect(root.locator(".hero-float__subheading")).toBeVisible();
    await expect(root.locator(".hero-float__halftone")).toBeVisible();
    await expect(root.locator(".hero-float__halftone-ring")).toHaveCount(3);
    // The deck is a zero-sized 3D anchor — assert via DOM rather than visibility.
    await expect(root.locator("[data-hf-deck]")).toHaveCount(1);
    await expect(root.locator(".hero-float__stage")).toBeVisible();
  });

  test("All 10 card blocks render inside the deck", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root.locator("[data-hf-card]")).toHaveCount(10);
  });

  test("Each card has a unique --card-angle covering the full circle", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const angles = await root.locator("[data-hf-card]").evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).style.getPropertyValue("--card-angle"))
    );
    expect(angles).toHaveLength(10);
    // 360 / 10 ≈ 51.4° per step
    expect(angles[0]).toMatch(/0deg/);
    // No duplicates
    expect(new Set(angles).size).toBe(10);
    // Last angle should be 9 × (360/10) = 324°
    const last = parseFloat(angles[9]);
    expect(last).toBeGreaterThan(320);
    expect(last).toBeLessThan(330);
  });

  test("Continuous spin: the deck transform changes over time", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toHaveClass(/hero-float--spin/);

    const deck = root.locator("[data-hf-deck]");
    const transformA = await deck.evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(800);
    const transformB = await deck.evaluate((el) => getComputedStyle(el).transform);
    expect(transformA).not.toBe(transformB);
  });

  test("Hover pauses the rotation", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await root.hover();
    await expect(root).toHaveClass(/is-paused/);

    await root.dispatchEvent("mouseleave");
    await expect(root).not.toHaveClass(/is-paused/);
  });

  test("Pulse rings are present and the pulse class is on by default", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root).toHaveClass(/hero-float--pulse/);
    await expect(root.locator(".hero-float__halftone-ring")).toHaveCount(3);
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='hero-float']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
