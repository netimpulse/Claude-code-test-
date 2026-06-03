import { test, expect } from "@playwright/test";
import { withTheme } from "../fixtures";

const SEA_PAGE = "/pages/sea";
const SEO_PAGE = "/pages/seo";

test.describe("Hero ticker — secondary button + play icon defaults", () => {
  test("Renders the secondary button with the play SVG by default", async ({ page }) => {
    await page.goto(withTheme(SEA_PAGE), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-ticker']").first();
    await expect(root).toBeVisible();
    const secondary = root.locator(".hero-ticker__btn--secondary");
    await expect(secondary).toBeVisible();
    await expect(secondary.locator("svg")).toHaveCount(1);
    const label = (await secondary.locator("span").textContent()) || "";
    expect(label.trim().length).toBeGreaterThan(0);
  });
});

test.describe("Hero SERP — heading parts separated by a space", () => {
  test("Heading text does not stick the highlight to the surrounding words", async ({ page }) => {
    await page.goto(withTheme(SEO_PAGE), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-serp']").first();
    await expect(root).toBeVisible();
    const heading = root.locator(".hero-serp__heading").first();
    const text = (await heading.textContent()) || "";
    const accent = (await root.locator(".hero-serp__heading-accent").first().textContent()) || "";
    expect(accent.trim().length).toBeGreaterThan(0);
    // The accent word must not be glued to the preceding word: " <accent>" must appear in the heading
    // (with a leading space) for the German "Zielgruppe sucht." case to read correctly.
    const needle = ` ${accent.trim()}`;
    expect(text).toContain(needle);
  });

  test("Heading-accent honours --hs-highlight custom property when set", async ({ page }) => {
    await page.goto(withTheme(SEO_PAGE), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-serp']").first();
    // Force the override at runtime to simulate a merchant choosing a highlight color.
    await root.evaluate((el) => {
      (el as HTMLElement).style.setProperty("--hs-highlight", "rgb(255, 0, 0)");
    });
    const color = await root
      .locator(".hero-serp__heading-accent")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(255, 0, 0)");
  });
});
