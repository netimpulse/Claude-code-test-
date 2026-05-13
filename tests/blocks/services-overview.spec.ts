import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Services Overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("services-overview [data-node].is-active", { timeout: 15_000 });
  });

  test("Renders heading, tabs, orbit nodes and detail panel", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".services-overview__heading")).toBeVisible();

    await expect(section.locator(".services-overview__tab")).toHaveCount(6);
    await expect(section.locator("[data-node]")).toHaveCount(6);
    await expect(section.locator("[data-panel]")).toHaveCount(6);

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

  test("Heading is centered and intro/eyebrow are absent", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    await expect(section.locator(".services-overview__eyebrow")).toHaveCount(0);
    await expect(section.locator(".services-overview__intro")).toHaveCount(0);

    const textAlign = await section
      .locator(".services-overview__heading")
      .evaluate((el) => getComputedStyle(el).textAlign);
    expect(textAlign).toBe("center");
  });

  test("Description sits below the orbit", async ({ page }) => {
    const section = page.locator(".services-overview").first();
    const orbitBox = await section.locator(".services-overview__orbit").boundingBox();
    const panelBox = await section.locator("[data-panel].is-active").boundingBox();
    expect(orbitBox && panelBox).toBeTruthy();
    expect(panelBox!.y).toBeGreaterThan(orbitBox!.y + orbitBox!.height - 10);
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
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
