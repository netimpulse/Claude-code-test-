import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("cta-compact section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".cta-compact", { timeout: 15_000 });
  });

  test("Section + kicker + heading + intro rendern", async ({ page }) => {
    const section = page.locator(".cta-compact").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".cta-compact__kicker")).toContainText("Kontakt");
    await expect(section.locator(".cta-compact__heading")).toContainText("planbares Wachstum");
    await expect(section.locator(".cta-compact__intro")).toBeVisible();
  });

  test("KEIN Avatar / Bilder im Panel", async ({ page }) => {
    const section = page.locator(".cta-compact").first();
    await expect(section.locator(".team-compact__avatars, .cta-compact__avatars, img")).toHaveCount(0);
  });

  test("Button existiert und ist zentriert", async ({ page }) => {
    const section = page.locator(".cta-compact").first();
    const btn = section.locator(".cta-compact__btn");
    await expect(btn).toBeVisible();
    await expect(btn).toContainText("Jetzt anfragen");

    const wrap = section.locator(".cta-compact__actions");
    const wrapBox = await wrap.boundingBox();
    const btnBox = await btn.boundingBox();
    if (!wrapBox || !btnBox) throw new Error("bbox null");
    const wrapCenter = wrapBox.x + wrapBox.width / 2;
    const btnCenter = btnBox.x + btnBox.width / 2;
    expect(Math.abs(wrapCenter - btnCenter)).toBeLessThanOrEqual(2);
  });

  test("Desktop: Header-Spalte links, Intro-Spalte rechts (gleiche Höhe)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(200);
    const headerCol = page.locator(".cta-compact__column--header").first();
    const introCol = page.locator(".cta-compact__column--intro").first();
    const h = await headerCol.boundingBox();
    const i = await introCol.boundingBox();
    if (!h || !i) throw new Error("bbox null");
    expect(i.x).toBeGreaterThan(h.x + h.width - 5);
  });

  test("Mobile (320px): kein horizontaler Scroll", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("Panel-Breite entspricht team-compact-Dimensionen (max 1280px Inner)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(200);
    const inner = page.locator(".cta-compact__inner").first();
    const box = await inner.boundingBox();
    if (!box) throw new Error("bbox null");
    expect(box.width).toBeLessThanOrEqual(1280);
  });
});
