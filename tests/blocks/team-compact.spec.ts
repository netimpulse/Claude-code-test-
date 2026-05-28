import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Team compact", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".team-compact__panel", { timeout: 15_000 });
  });

  test("Renders heading, intro, CTA and at least three members", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".team-compact__heading")).toContainText("Agentur");
    await expect(section.locator(".team-compact__intro")).toBeVisible();
    await expect(section.locator(".team-compact__cta")).toHaveText(/Team kennenlernen/);

    const members = section.locator(".team-compact__member");
    const count = await members.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("Avatars are circular, panel has square corners", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const section = page.locator(".team-compact").first();

    const avatar = section.locator(".team-compact__avatar").first();
    const avatarStyle = await avatar.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { radius: cs.borderRadius, w: Math.round(r.width), h: Math.round(r.height) };
    });
    // Circular avatar: radius 50% computes to half the box; w == h.
    expect(avatarStyle.w).toBe(avatarStyle.h);
    expect(avatarStyle.radius).not.toBe("0px");

    // Panel + name pill must be square (border-radius: 0).
    const panelRadius = await section
      .locator(".team-compact__panel")
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(panelRadius).toBe("0px");

    const pillRadius = await section
      .locator(".team-compact__name")
      .first()
      .evaluate((el) => getComputedStyle(el).borderRadius);
    expect(pillRadius).toBe("0px");
  });

  test("Initials are derived from the name when not set", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const initials = await section
      .locator(".team-compact__initials")
      .first()
      .textContent();
    // First member is "Niklas" → "N".
    expect(initials?.trim()).toBe("N");
  });

  test("Stacks cleanly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(200);
    const panel = page.locator(".team-compact__panel").first();
    const cols = await panel.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(" ").length).toBe(1);
  });

  test("No horizontal overflow within the section at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.waitForTimeout(200);
    const overflow = await page.locator(".team-compact").first().evaluate((sec) => {
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    await page.locator(".team-compact").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/team-compact-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    await page.locator(".team-compact").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/team-compact-mobile.png", fullPage: true });
  });
});
