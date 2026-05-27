import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Tests for the NetImpulse landing sections (sections/ni-hero, ni-intro,
 * ni-deck) with their "card" section blocks. Rendered on the QA block page
 * as the ni_hero_qa / ni_intro_qa / ni_deck_qa sections (sand color scheme).
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("NetImpulse landing blocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero", { timeout: 15_000 });
  });

  test("Hero renders label, headline, two CTAs and floating tag", async ({ page }) => {
    const hero = page.locator("ni-hero").first();
    await expect(hero.locator(".ni-hero__label")).toContainText("Online Marketing Studio");
    await expect(hero.locator(".ni-hero__title")).toContainText("sichtbar verkauft");
    await expect(hero.locator(".ni-btn--primary")).toContainText("Kostenloses Erstgespräch");
    await expect(hero.locator(".ni-btn--ghost")).toBeVisible();
    await expect(hero.locator(".ni-hero__book")).toContainText("Termin buchen");
    await expect(hero.locator(".ni-hero__caption")).toContainText("NetImpulse Prinzip");
  });

  test("Intro renders header, three cards and the image panel", async ({ page }) => {
    const intro = page.locator("ni-intro").first();
    await expect(intro.locator(".ni-intro__title")).toContainText("digitale Auftritte mit System");
    await expect(intro.locator(".ni-intro-card")).toHaveCount(3);
    await expect(intro.locator(".ni-intro__panel")).toBeVisible();
    await expect(intro.locator(".ni-intro__panel-copy h3")).toContainText("laufenden Optimierung");
    // staggered widths produce distinct rendered widths
    const widths = await intro.locator(".ni-intro-card").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width))
    );
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  test("Deck renders five sticky cards with a dark one", async ({ page }) => {
    const deck = page.locator("ni-deck").first();
    await expect(deck.locator(".ni-deck-card")).toHaveCount(5);
    await expect(deck.locator(".ni-deck-card--dark")).toHaveCount(1);
    const pos = await deck.locator(".ni-deck-card").first().evaluate(
      (el) => getComputedStyle(el).position
    );
    expect(pos).toBe("sticky");
  });

  test("Deck cards stack: later card overlaps the previous when scrolled", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const deck = page.locator("ni-deck").first();
    const first = deck.locator(".ni-deck-card").nth(0);
    const second = deck.locator(".ni-deck-card").nth(1);
    await second.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const firstTop = await first.evaluate((el) => el.getBoundingClientRect().top);
    // first card is stuck near the top offset (24px) while second is in view
    expect(firstTop).toBeLessThan(120);
  });

  test("No horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    for (const sel of ["ni-hero", "ni-intro", "ni-deck"]) {
      const el = page.locator(sel).first();
      const overflow = await el.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
      expect(overflow, `${sel} overflow`).toBe(false);
    }
  });

  test("Captures NI block screenshots (desktop + mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.waitForTimeout(500);
    await page.locator("ni-hero").first().scrollIntoViewIfNeeded();
    await page.locator("ni-hero").first().screenshot({ path: "qa-screenshots/ni-hero-desktop.png" });
    await page.locator("ni-intro").first().scrollIntoViewIfNeeded();
    await page.locator("ni-intro").first().screenshot({ path: "qa-screenshots/ni-intro-desktop.png" });
    await page.locator(".ni-deck-card").nth(3).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.locator("ni-deck").first().screenshot({ path: "qa-screenshots/ni-deck-desktop.png" });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await page.locator("ni-hero").first().scrollIntoViewIfNeeded();
    await page.locator("ni-hero").first().screenshot({ path: "qa-screenshots/ni-hero-mobile.png" });
  });
});
