import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("about-values fluid variations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".avt, .avw", { timeout: 15_000 });
  });

  test("Beide Variationen rendern", async ({ page }) => {
    await expect(page.locator(".avt")).toHaveCount(1);
    await expect(page.locator(".avw")).toHaveCount(1);
  });

  // ---- Variation 1: Thread ----
  test("Thread: 4 Werte mit alternierender L/R-Positionierung", async ({ page }) => {
    const items = page.locator(".avt__item");
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toHaveClass(/avt__item--left/);
    await expect(items.nth(1)).toHaveClass(/avt__item--right/);
    await expect(items.nth(2)).toHaveClass(/avt__item--left/);
    await expect(items.nth(3)).toHaveClass(/avt__item--right/);
  });

  test("Thread: SVG-Path mit zigzag-Bezier-Daten existiert", async ({ page }) => {
    const drawPath = page.locator(".avt__path--draw");
    await expect(drawPath).toHaveCount(1);
    const d = await drawPath.getAttribute("d");
    expect(d).toBeTruthy();
    expect(d!.length).toBeGreaterThan(40);
    expect(d).toContain("C");
  });

  test("Thread: 4 Knotenpunkte werden gerendert", async ({ page }) => {
    const nodes = page.locator(".avt__node");
    await expect(nodes).toHaveCount(4);
  });

  test("Thread: Linie wird gezeichnet (is-drawn class) wenn im Viewport", async ({ page }) => {
    await page.locator(".avt").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const stage = page.locator(".avt__stage");
    await expect(stage).toHaveClass(/is-drawn/);
  });

  // ---- Variation 2: Wave ----
  test("Wave: 4 Wörter in einer Reihe, erstes ist initial aktiv", async ({ page }) => {
    const words = page.locator(".avw__word");
    await expect(words).toHaveCount(4);
    await expect(words.nth(0)).toHaveClass(/is-active/);
    await expect(words.nth(0)).toHaveAttribute("aria-pressed", "true");
  });

  test("Wave: SVG-Welle mit 2 Layern (back + front)", async ({ page }) => {
    await expect(page.locator(".avw__wave-line--back")).toHaveCount(1);
    await expect(page.locator(".avw__wave-line--front")).toHaveCount(1);
  });

  test("Wave: Pin + Pin-Dot existieren auf der Welle", async ({ page }) => {
    await expect(page.locator(".avw__pin")).toHaveCount(1);
    await expect(page.locator(".avw__pin-dot")).toHaveCount(1);
  });

  test("Wave: Klick auf 3. Wort aktiviert es + Detail-Panel", async ({ page }) => {
    const words = page.locator(".avw__word");
    const details = page.locator(".avw__detail");
    await words.nth(2).click();
    await page.waitForTimeout(400);
    await expect(words.nth(2)).toHaveClass(/is-active/);
    await expect(words.nth(0)).not.toHaveClass(/is-active/);
    await expect(details.nth(2)).toHaveClass(/is-active/);
  });

  test("Wave: Pin bewegt sich beim Klick (cx-Attribut ändert sich)", async ({ page }) => {
    const pinDot = page.locator(".avw__pin-dot");
    await page.waitForTimeout(500);
    const cx1 = await pinDot.getAttribute("cx");
    await page.locator(".avw__word").nth(3).click();
    await page.waitForTimeout(500);
    const cx2 = await pinDot.getAttribute("cx");
    expect(cx1).not.toBe(cx2);
  });

  // ---- General ----
  test("Mobile (320px): keine der 2 Variationen verursacht horizontalen Scroll", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 2400 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
