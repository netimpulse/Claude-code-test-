import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("addon-services section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".addon-services", { timeout: 15_000 });
  });

  test("section + heading + subheading rendern", async ({ page }) => {
    const section = page.locator(".addon-services").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".addon-services__heading")).toContainText("Zusatzleistungen");
    await expect(section.locator(".addon-services__subheading")).toBeVisible();
  });

  test("drei Karten werden gerendert", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator(".addon-services__card-title")).toContainText("Theme Setup");
    await expect(cards.nth(1).locator(".addon-services__card-title")).toContainText("Bestehendes Theme");
    await expect(cards.nth(2).locator(".addon-services__card-title")).toContainText("Custom Theme");
  });

  test("Preise: Karte 1 hat 'ab 200', Karten 2+3 'Preis auf Anfrage'", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(0).locator(".addon-services__price")).toContainText("200");
    await expect(cards.nth(1).locator(".addon-services__price")).toContainText("Preis auf Anfrage");
    await expect(cards.nth(2).locator(".addon-services__price")).toContainText("Preis auf Anfrage");
  });

  test("nur die mittlere Karte ist hervorgehoben (Badge BELIEBT)", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(0)).not.toHaveClass(/is-highlighted/);
    await expect(cards.nth(1)).toHaveClass(/is-highlighted/);
    await expect(cards.nth(2)).not.toHaveClass(/is-highlighted/);

    await expect(cards.nth(1).locator(".addon-services__badge")).toContainText("BELIEBT");
    await expect(cards.nth(0).locator(".addon-services__badge")).toHaveCount(0);
    await expect(cards.nth(2).locator(".addon-services__badge")).toHaveCount(0);
  });

  test("Show/Hide-Button-Toggle wirkt: Karten 1+2 zeigen Button, Karte 3 nicht", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(0).locator(".addon-services__btn")).toBeVisible();
    await expect(cards.nth(1).locator(".addon-services__btn")).toBeVisible();
    await expect(cards.nth(2).locator(".addon-services__btn")).toHaveCount(0);
  });

  test("hervorgehobene Karte hat Primary-Button-Klasse", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(1).locator(".addon-services__btn")).toHaveClass(/addon-services__btn--primary/);
    await expect(cards.nth(0).locator(".addon-services__btn")).not.toHaveClass(/addon-services__btn--primary/);
  });

  test("Feature-Listen rendern mit Checkmark-Icons", async ({ page }) => {
    const card1 = page.locator(".addon-services__card").nth(0);
    const features = card1.locator(".addon-services__feature");
    await expect(features).toHaveCount(4);
    await expect(card1.locator(".addon-services__feature-icon").first()).toBeVisible();
  });

  test("kein Monatlich/Jährlich-Toggle vorhanden", async ({ page }) => {
    const section = page.locator(".addon-services").first();
    await expect(section.locator("text=Monatlich")).toHaveCount(0);
    await expect(section.locator("text=Jährlich")).toHaveCount(0);
  });

  test("section bleibt bei 320px Viewport ohne horizontalen Scroll", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1400 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("Desktop: Karten liegen nebeneinander (3-Spalten-Grid)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    const cards = page.locator(".addon-services__card");
    const tops = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    // Alle drei Karten teilen sich (innerhalb 5px) die gleiche Top-Position
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(5);
  });
});
