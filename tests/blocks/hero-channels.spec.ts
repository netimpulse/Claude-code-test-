import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Channels — flow diagram with channel pills feeding a hub
 * that outputs to a revenue node. Animations are SMIL + CSS.
 */
test.describe("Hero Channels – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders heading, lead, CTAs and the diagram container", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".hero-channels__eyebrow")).toContainText("Five channels");
    await expect(root.locator(".hero-channels__heading-line").first()).toContainText("Every channel.");
    await expect(root.locator(".hero-channels__heading-line--accent")).toContainText("One outcome:");
    await expect(root.locator(".hero-channels__lead")).toBeVisible();
    await expect(root.locator(".hero-channels__cta--primary")).toContainText("Get a free audit");
    await expect(root.locator(".hero-channels__cta--secondary")).toContainText("See our process");
    await expect(root.locator(".hero-channels__svg")).toBeVisible();
  });

  test("Renders one pill per channel block (4 default)", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    await expect(root.locator(".hero-channels__pill")).toHaveCount(4);
    await expect(root.locator(".hero-channels__pill-label").first()).toContainText("SEO");
  });

  test("Renders hub, revenue node and bottom caption row", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    await expect(root.locator(".hero-channels__hub-core")).toHaveCount(1);
    await expect(root.locator(".hero-channels__hub-bar")).toHaveCount(5);
    await expect(root.locator(".hero-channels__revenue-bg")).toHaveCount(1);
    await expect(root.locator(".hero-channels__revenue-value")).toContainText("2.4");
    const cells = root.locator(".hero-channels__caption-cell");
    await expect(cells).toHaveCount(3);
    await expect(cells.last()).toHaveClass(/--accent/);
  });

  test("Pulse rings are present and pulse class is on by default", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    await expect(root).toHaveClass(/hero-channels--pulse/);
    await expect(root.locator(".hero-channels__hub-pulse")).toHaveCount(2);
  });

  test("Inbound and outbound particles are present and SMIL-animated", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    // 2 particles per channel × 4 channels + 3 outbound = 11
    await expect(root.locator(".hero-channels__particle")).toHaveCount(11);
    await expect(root.locator(".hero-channels__particle--out")).toHaveCount(3);
    // animateMotion elements live next to circles inside the SVG.
    const motionCount = await root.locator(".hero-channels__svg animateMotion").count();
    expect(motionCount).toBe(11);
  });

  test("SVG flow paths are generated, one per channel + one outbound", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    const paths = root.locator(".hero-channels__path");
    await expect(paths).toHaveCount(5);
    await expect(paths.last()).toHaveClass(/hero-channels__path--out/);
  });

  test("Accent color custom property resolves on the section", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-channels']").first();
    const accent = await root.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--hc-accent").trim()
    );
    expect(accent.length).toBeGreaterThan(0);
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-channels']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
