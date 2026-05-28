import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("About — Perspectives", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".about-perspectives", { timeout: 15_000 });
  });

  test("Head, feature card and three perspectives render", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".about-perspectives__heading")).toContainText("Drei Perspektiven");
    await expect(section.locator(".about-perspectives__feature")).toBeVisible();
    await expect(section.locator(".about-perspectives__feature-heading")).toContainText("anonyme");

    await expect(section.locator(".about-perspectives__card")).toHaveCount(3);
    await expect(section.locator(".about-perspectives__name").nth(0)).toHaveText("Niklas");
    await expect(section.locator(".about-perspectives__name").nth(1)).toHaveText("Tom");
    await expect(section.locator(".about-perspectives__name").nth(2)).toHaveText("Lara");
  });

  test("Category tag is shown for every perspective", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    const cats = section.locator(".about-perspectives__category");
    await expect(cats).toHaveCount(3);
    await expect(cats.nth(0)).toHaveText(/Strategie/i);
    await expect(cats.nth(2)).toHaveText(/Umsetzung/i);
  });

  test("Clean design — no letter avatars, no per-name numbers, no numbered list in feature card", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    // The earlier draft had `.about-perspectives__avatar` / `__number` elements; these must NOT exist.
    await expect(section.locator(".about-perspectives__avatar")).toHaveCount(0);
    await expect(section.locator(".about-perspectives__number")).toHaveCount(0);
    await expect(section.locator(".about-perspectives__feature-list")).toHaveCount(0);

    // And no "01" / "02" / "03" badge next to a name.
    const card = section.locator(".about-perspectives__card").first();
    const text = (await card.innerText()).trim();
    expect(text).not.toMatch(/\b0[123]\b/);
  });

  test("Focus tags render and all cards have square corners", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    await expect(section.locator(".about-perspectives__focus-label").first()).toHaveText(/Fokusbereiche/);
    const tags = section.locator(".about-perspectives__tag");
    const count = await tags.count();
    expect(count).toBeGreaterThanOrEqual(8);

    const radii = await section
      .locator(".about-perspectives__card, .about-perspectives__feature, .about-perspectives__tag, .about-perspectives__category")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderRadius));
    for (const r of radii) expect(r).toBe("0px");
  });

  test("Stacks to a single column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1100 });
    await page.waitForTimeout(200);
    const grid = page.locator(".about-perspectives__grid").first();
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(" ").length).toBe(1);
  });

  test("No horizontal overflow inside the section at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForTimeout(200);
    const overflow = await page.locator(".about-perspectives").first().evaluate((sec) => {
      const vw = document.documentElement.clientWidth;
      let worst = 0;
      sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const right = el.getBoundingClientRect().right;
        if (right > vw) worst = Math.max(worst, right - vw);
      });
      return worst;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1100 });
    await page.waitForTimeout(300);
    await page.locator(".about-perspectives").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/about-perspectives-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 1100 });
    await page.waitForTimeout(300);
    await page.locator(".about-perspectives").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/about-perspectives-mobile.png", fullPage: true });
  });
});
