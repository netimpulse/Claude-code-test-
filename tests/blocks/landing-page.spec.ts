import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";
import * as fs from "fs";
import * as path from "path";

const SHOT_DIR = path.resolve("qa-screenshots/landing");

test.beforeAll(() => {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
});

test.describe("landing page (index.json)", () => {
  test("renders prologue + orbit + portal on desktop", async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "networkidle" });

    // Pause a beat so the rotator can settle on first word + lens animation starts.
    await page.waitForTimeout(800);

    // All three new sections must be present.
    const prologue = page.locator('[data-section-type="landing-prologue"]');
    const orbit = page.locator('[data-section-type="landing-orbit"]');
    const portal = page.locator('[data-section-type="landing-portal"]');

    await expect(prologue).toBeVisible();
    await expect(orbit).toBeVisible();
    await expect(portal).toBeVisible();

    // Hero heading must contain the rotator word region.
    await expect(prologue.locator(".lp__rotator")).toBeVisible();
    const heading = prologue.locator("h1.lp__heading");
    await expect(heading).toContainText("Wir bauen");

    // Mission principles render.
    await expect(prologue.locator(".lp__principle")).toHaveCount(4);

    // Orbit has 6 service nodes.
    await expect(orbit.locator(".lo__node")).toHaveCount(6);
    await expect(orbit.locator(".lo__node.is-active")).toHaveCount(1);

    // Portal renders the heading + CTA.
    await expect(portal.locator(".lpr__heading")).toBeVisible();
    await expect(portal.locator(".lpr__cta")).toBeVisible();

    // Full-page screenshot, desktop.
    await page.screenshot({
      path: path.join(SHOT_DIR, "desktop-full.png"),
      fullPage: true,
    });

    // Per-section screenshots.
    await prologue.screenshot({ path: path.join(SHOT_DIR, "desktop-prologue.png") });
    await orbit.screenshot({ path: path.join(SHOT_DIR, "desktop-orbit.png") });
    await portal.screenshot({ path: path.join(SHOT_DIR, "desktop-portal.png") });
  });

  test("orbit node click swaps the centered title", async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "networkidle" });
    const orbit = page.locator('[data-section-type="landing-orbit"]');
    const nodes = orbit.locator(".lo__node");
    const center = orbit.locator("[data-center-title]");

    const startTitle = (await center.textContent())?.trim() || "";
    // Click the 3rd node (Shopify) and wait for cross-fade.
    await nodes.nth(2).click();
    await page.waitForTimeout(500);
    const newTitle = (await center.textContent())?.trim() || "";
    expect(newTitle).not.toBe(startTitle);
    await expect(nodes.nth(2)).toHaveClass(/is-active/);
  });

  test("renders cleanly on mobile (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // No horizontal overflow at root level.
    const bodyScroll = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(bodyScroll.scroll).toBeLessThanOrEqual(bodyScroll.client + 1);

    await page.screenshot({
      path: path.join(SHOT_DIR, "mobile-full.png"),
      fullPage: true,
    });
  });
});
