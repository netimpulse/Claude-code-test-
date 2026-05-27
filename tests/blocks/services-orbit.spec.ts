import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Services Orbit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("services-orbit [data-node].is-active", { timeout: 15_000 });
  });

  test("Renders head, six nodes with labels and exactly one active panel", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".services-orbit__title")).toBeVisible();

    await expect(section.locator("[data-node]")).toHaveCount(6);
    await expect(section.locator(".services-orbit__node-label")).toHaveCount(6);
    await expect(section.locator("[data-node].is-active")).toHaveCount(1);
    await expect(section.locator(".services-orbit__detail-panel.is-active")).toHaveCount(1);
  });

  test("Center title + counter reflect the active service and update on click", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const center = section.locator("[data-center-title]");
    const count = section.locator("[data-count]");

    await expect(center).toHaveText("Suchmaschinenoptimierung");
    await expect(count).toHaveText("01 / 06");

    // Activate the Shopify node (index 4) and confirm content swaps.
    await section.locator("[data-node][data-index='4']").click();
    await page.waitForTimeout(500);

    await expect(center).toHaveText("Shopify Entwicklung");
    await expect(count).toHaveText("05 / 06");
    await expect(section.locator(".services-orbit__detail-panel[data-index='4']")).toHaveClass(/is-active/);
    await expect(section.locator("[data-node][data-index='4']")).toHaveClass(/is-active/);
  });

  test("Ring rotates so the active node lands at the top slot", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const rotator = section.locator("[data-rotator]");

    const initial = await rotator.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--rotation").trim()
    );
    expect(initial).toBe("0deg");

    // SEA sits at angle -30 → rotation should become -90 - (-30) = -60deg.
    await section.locator("[data-node][data-index='1']").click();
    await page.waitForTimeout(500);
    const next = await rotator.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--rotation").trim()
    );
    expect(next).toBe("-60deg");
  });

  test("Section stays within the viewport at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForTimeout(300);
    // Scope the check to this section; other QA-page sections (e.g. the
    // hero-float carousel) intentionally bleed past the viewport.
    const overflow = await page.locator(".services-orbit").first().evaluate((sec) => {
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
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.waitForTimeout(400);
    await page.locator(".services-orbit").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/services-orbit-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await page.locator(".services-orbit").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/services-orbit-mobile.png", fullPage: true });
  });
});
