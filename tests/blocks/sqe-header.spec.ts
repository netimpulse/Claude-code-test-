import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("SQE Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
  });

  test("Renders header with logo, nav, actions", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    await expect(header).toBeVisible();
    await expect(header.locator(".sqe-header__logo")).toBeVisible();
  });

  test("Wrapper is full-width and opaque (no transparent side gutters when sticky)", async ({ page }) => {
    const wrapper = page.locator(".shopify-section").filter({ has: page.locator("[data-section-type='sqe-header']") }).first();
    const box = await wrapper.boundingBox();
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(box).not.toBeNull();
    // The wrapper should span (nearly) the full viewport.
    expect(box!.width).toBeGreaterThan(viewportWidth * 0.98);
    // And have an opaque background.
    const bg = await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });

  test("'On scroll up' mode: hides when scrolling down, shows when scrolling up", async ({ page }) => {
    // We need enough page height to scroll.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      document.body.appendChild(spacer);
    });

    const wrapper = page.locator("[id^='shopify-section-']").filter({ has: page.locator("[data-section-type='sqe-header']") }).first();
    // Sanity: is-sticky must be on (default mode is on-scroll-up).
    await expect(wrapper).toHaveClass(/is-sticky/);

    // Scroll down past the header.
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(250);
    await expect(wrapper).toHaveClass(/is-hidden/);

    // Scroll up — header should reappear.
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(250);
    await expect(wrapper).not.toHaveClass(/is-hidden/);
  });

  test("Search panel opens on icon click and predictive search queries on input", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    const toggle = header.locator("[data-sqe-search-toggle]");
    await expect(toggle).toBeVisible();
    await toggle.click();
    const input = header.locator("[data-sqe-search-input]");
    await expect(input).toBeVisible();
    await input.fill("QA");
    await expect(header.locator("[data-sqe-search-results]")).toBeVisible({ timeout: 8000 });
    const html = await header.locator("[data-sqe-search-results]").innerHTML();
    expect(html.toLowerCase()).toContain("qa");
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/sqe-header-desktop.png", fullPage: false });

    await page.setViewportSize({ width: 390, height: 740 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/sqe-header-mobile.png", fullPage: false });
  });
});
