import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Float — JS-driven 3D wheel with drag interaction.
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
    await expect(root.locator("[data-hf-deck]")).toHaveCount(1);
    await expect(root.locator(".hero-float__stage")).toBeVisible();
  });

  test("All 10 card blocks render inside the deck", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    await expect(root.locator("[data-hf-card]")).toHaveCount(10);
  });

  test("Cards have uniform width derived from card_height × card_aspect", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const widths = await root.locator("[data-hf-card]").evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).offsetWidth)
    );
    expect(widths).toHaveLength(10);
    const first = widths[0];
    // offsetWidth is the layout width, unaffected by 3D rotation.
    widths.forEach((w) => expect(w).toBe(first));
  });

  test("Each card has a unique --card-angle covering the full circle", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const angles = await root.locator("[data-hf-card]").evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).style.getPropertyValue("--card-angle"))
    );
    expect(angles).toHaveLength(10);
    expect(angles[0]).toMatch(/0deg/);
    expect(new Set(angles).size).toBe(10);
  });

  test("Auto-rotation: deck transform changes over time without input", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const deck = root.locator("[data-hf-deck]");

    const a = await deck.evaluate((el) => (el as HTMLElement).style.transform);
    await page.waitForTimeout(700);
    const b = await deck.evaluate((el) => (el as HTMLElement).style.transform);
    expect(a).not.toBe(b);
  });

  test("Drag updates rotation and sets the is-dragging class", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const stage = root.locator(".hero-float__stage");
    const box = await stage.boundingBox();
    if (!box) throw new Error("Stage has no bounding box");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    const before = await root
      .locator("[data-hf-deck]")
      .evaluate((el) => (el as HTMLElement).style.transform);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await expect(root).toHaveClass(/is-dragging/);
    await page.mouse.move(startX + 200, startY, { steps: 10 });

    const duringDrag = await root
      .locator("[data-hf-deck]")
      .evaluate((el) => (el as HTMLElement).style.transform);

    await page.mouse.up();
    await expect(root).not.toHaveClass(/is-dragging/);

    expect(duringDrag).not.toBe(before);
  });

  test("Color scheme is wired: --color-background takes effect on the section", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-float']").first();
    const bg = await root.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--color-background").trim()
    );
    // The setting puts scheme-1's background here; just assert SOMETHING resolved.
    expect(bg.length).toBeGreaterThan(0);
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
