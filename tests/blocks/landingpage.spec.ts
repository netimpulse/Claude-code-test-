import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Tests for sections/landingpage.liquid and the lp-* theme blocks.
 * Rendered on the QA block page (templates/page.qa-block-test.json) as
 * the "landingpage_qa" section, fed with the qa-test-collection for the
 * theme-store preview block.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Landingpage section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector('[data-section-type="landingpage"]', { timeout: 15_000 });
  });

  test("Renders all seven landing-page blocks", async ({ page }) => {
    const lp = page.locator('[data-section-type="landingpage"]').first();
    await expect(lp).toBeVisible();
    await expect(lp.locator(".lp-hero")).toHaveCount(1);
    await expect(lp.locator(".lp-metrics")).toHaveCount(1);
    await expect(lp.locator(".lp-bento")).toHaveCount(1);
    await expect(lp.locator(".lp-themes")).toHaveCount(1);
    await expect(lp.locator(".lp-case")).toHaveCount(1);
    await expect(lp.locator(".lp-testimonial")).toHaveCount(1);
    await expect(lp.locator(".lp-cta")).toHaveCount(1);
  });

  test("Hero shows headline, rotating word, CTAs and chips", async ({ page }) => {
    const hero = page.locator(".lp-hero").first();
    await expect(hero.locator(".lp-hero__title")).toContainText("Wir bauen digitales");
    const word = hero.locator(".lp-hero__rotator-word");
    await expect(word).toBeVisible();
    expect((await word.textContent())?.trim().length || 0).toBeGreaterThan(0);
    await expect(hero.locator(".lp-hero__btn--primary")).toContainText("Kostenloses Audit");
    await expect(hero.locator(".lp-hero__chip")).toHaveCount(3);
  });

  test("Metrics renders four figures and counts up to target", async ({ page }) => {
    const metrics = page.locator(".lp-metrics").first();
    await metrics.scrollIntoViewIfNeeded();
    await expect(metrics.locator(".lp-metrics__item")).toHaveCount(4);
    const firstValue = metrics.locator(".lp-metrics__value").first();
    await expect.poll(async () => (await firstValue.textContent())?.trim()).toBe("143");
  });

  test("Bento grid has five cards including a feature tile", async ({ page }) => {
    const bento = page.locator(".lp-bento").first();
    await expect(bento.locator(".lp-bento__card")).toHaveCount(5);
    await expect(bento.locator(".lp-bento__card--feature")).toHaveCount(1);
  });

  test("Themes preview lists products and supports next", async ({ page }) => {
    const themes = page.locator(".lp-themes").first();
    const cards = themes.locator(".lp-themes__card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(8);
    await expect(cards.first().locator(".lp-themes__title")).toBeVisible();

    await page.setViewportSize({ width: 500, height: 900 });
    const track = themes.locator("[data-track]");
    const before = await track.evaluate((el) => el.scrollLeft);
    // Trigger the handler directly: the fixed Shopify preview bar can
    // intercept real pointer clicks on the nav button in this test env.
    await themes.locator("[data-next]").evaluate((el: HTMLButtonElement) => el.click());
    await page.waitForTimeout(500);
    const after = await track.evaluate((el) => el.scrollLeft);
    expect(after).toBeGreaterThan(before);
  });

  test("Case compare slider moves the divider on input", async ({ page }) => {
    const compare = page.locator("lp-compare").first();
    await compare.scrollIntoViewIfNeeded();
    await expect(compare.locator(".lp-case__tag--before")).toContainText("Vorher");
    await expect(compare.locator(".lp-case__tag--after")).toContainText("Nachher");

    const range = compare.locator(".lp-case__range");
    await range.evaluate((el: HTMLInputElement) => {
      el.value = "80";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const pos = await compare.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--pos").trim()
    );
    expect(pos).toBe("80%");
  });

  test("Testimonial shows quote, author and five stars", async ({ page }) => {
    const t = page.locator(".lp-testimonial").first();
    await expect(t.locator(".lp-testimonial__quote")).toContainText("zusammen denkt");
    await expect(t.locator(".lp-testimonial__name")).toContainText("Sarah König");
    await expect(t.locator(".lp-testimonial__star.is-on")).toHaveCount(5);
  });

  test("CTA shows heading and both buttons", async ({ page }) => {
    const cta = page.locator(".lp-cta").first();
    await expect(cta.locator(".lp-cta__heading")).toContainText("planbares Wachstum");
    await expect(cta.locator(".lp-cta__btn--primary")).toBeVisible();
    await expect(cta.locator(".lp-cta__btn--secondary")).toBeVisible();
  });

  test("No horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    const lp = page.locator('[data-section-type="landingpage"]').first();
    const overflow = await lp.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("Captures desktop + mobile screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.waitForTimeout(600);
    const lpDesktop = page.locator('[data-section-type="landingpage"]').first();
    await lpDesktop.scrollIntoViewIfNeeded();
    await lpDesktop.screenshot({ path: "qa-screenshots/landingpage-desktop.png" });

    await page.locator(".lp-bento").first().screenshot({ path: "qa-screenshots/lp-bento-desktop.png" });
    await page.locator(".lp-case").first().screenshot({ path: "qa-screenshots/lp-case-desktop.png" });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(600);
    const lpMobile = page.locator('[data-section-type="landingpage"]').first();
    await lpMobile.scrollIntoViewIfNeeded();
    await lpMobile.screenshot({ path: "qa-screenshots/landingpage-mobile.png" });
  });
});
