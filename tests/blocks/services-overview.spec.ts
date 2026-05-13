import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Services Overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    // Wait for the custom element to upgrade and set up nodes.
    await page.waitForSelector("services-overview [data-node].is-active", { timeout: 15_000 });
  });

  test("Renders heading, tabs, orbit nodes and detail panel", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    await expect(section).toBeVisible();

    await expect(section.locator(".services-overview__heading")).toBeVisible();

    // Six service blocks → six tabs and six nodes.
    await expect(section.locator(".services-overview__tab")).toHaveCount(6);
    await expect(section.locator("[data-node]")).toHaveCount(6);
    await expect(section.locator("[data-panel]")).toHaveCount(6);

    // Exactly one panel is active by default.
    await expect(section.locator("[data-panel].is-active")).toHaveCount(1);
    await expect(section.locator("[data-panel][data-index='0']")).toHaveClass(/is-active/);
  });

  test("Clicking a tab activates that service", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    const targetTab = section.locator(".services-overview__tab[data-index='3']");
    await targetTab.click();

    await expect(targetTab).toHaveAttribute("aria-selected", "true");
    await expect(section.locator("[data-panel][data-index='3']")).toHaveClass(/is-active/);
    await expect(section.locator("[data-panel][data-index='0']")).not.toHaveClass(/is-active/);
    await expect(section.locator("[data-node][data-index='3']")).toHaveClass(/is-active/);
  });

  test("Clicking an orbit node activates that service", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    const node = section.locator("[data-node][data-index='2']");
    await node.click();

    await expect(node).toHaveClass(/is-active/);
    await expect(section.locator("[data-panel][data-index='2']")).toHaveClass(/is-active/);
  });

  test("Prev/Next buttons cycle through services", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    const next = section.locator("[data-next]");
    const prev = section.locator("[data-prev]");

    await next.click();
    await expect(section.locator("[data-panel][data-index='1']")).toHaveClass(/is-active/);

    await next.click();
    await expect(section.locator("[data-panel][data-index='2']")).toHaveClass(/is-active/);

    await prev.click();
    await expect(section.locator("[data-panel][data-index='1']")).toHaveClass(/is-active/);
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "qa-screenshots/services-overview-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "qa-screenshots/services-overview-mobile.png",
      fullPage: true,
    });
  });
});
