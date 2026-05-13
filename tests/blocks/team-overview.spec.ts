import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Team Overview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".team-overview");
  });

  test("Renders heading and three member cards", async ({ page }) => {
    const section = page.locator(".team-overview").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".team-overview__card")).toHaveCount(3);
    await expect(section.locator(".team-overview__name").first()).toBeVisible();
  });

  test("Each card shows role, name, bio and tags", async ({ page }) => {
    const first = page.locator(".team-overview__card").first();
    await expect(first.locator(".team-overview__role")).toBeVisible();
    await expect(first.locator(".team-overview__name")).toBeVisible();
    await expect(first.locator(".team-overview__bio")).toBeVisible();
    await expect(first.locator(".team-overview__tag")).toHaveCount(3);
  });

  test("Initials are rendered when no photo is set", async ({ page }) => {
    const first = page.locator(".team-overview__card").first();
    const initials = first.locator(".team-overview__initials");
    await expect(initials).toBeVisible();
    const text = await initials.textContent();
    expect(text?.trim()).toBe("AS");
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.waitForTimeout(400);
    await page.locator(".team-overview").first().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "qa-screenshots/team-overview-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: "qa-screenshots/team-overview-mobile.png",
      fullPage: true,
    });
  });
});
