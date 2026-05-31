import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Tests for sections/ni-text.liquid — a simple text block with
 * independent heading and body alignment selects. The QA template
 * (templates/page.qa-block-test.json) renders the section with
 * heading_align="right" and text_align="center" so we can verify that
 * the alignment classes really land on the correct elements
 * independently.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("ni-text", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".ni-text", { timeout: 15_000 });
  });

  test("Renders heading and body", async ({ page }) => {
    const section = page.locator(".ni-text").first();
    await expect(section.locator(".ni-text__heading")).toContainText("QA: text block heading");
    await expect(section.locator(".ni-text__body")).toContainText("body");
  });

  test("Heading and body alignment are controlled independently", async ({ page }) => {
    const section = page.locator(".ni-text").first();
    const headingAlign = await section.locator(".ni-text__heading").evaluate(
      (el) => getComputedStyle(el).textAlign
    );
    const bodyAlign = await section.locator(".ni-text__body").evaluate(
      (el) => getComputedStyle(el).textAlign
    );
    // Template sets heading=right, text=center
    expect(headingAlign).toBe("right");
    expect(bodyAlign).toBe("center");
    expect(headingAlign).not.toBe(bodyAlign);
  });

  test("Alignment utility classes are present on the right elements", async ({ page }) => {
    const section = page.locator(".ni-text").first();
    await expect(section.locator(".ni-text__heading.ni-text--align-right")).toBeVisible();
    await expect(section.locator(".ni-text__body.ni-text--align-center")).toBeVisible();
  });

  test("No horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".ni-text", { timeout: 15_000 });
    const overflow = await page.locator(".ni-text").first().evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });
});
