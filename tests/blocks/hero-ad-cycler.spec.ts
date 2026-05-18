import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Hero Ad Cycler – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, three-line headline, body, CTAs and stat strip", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-ac__eyebrow")).toContainText("Paid social");
    await expect(root.locator(".hero-ac__heading-accent")).toContainText("converts");
    await expect(root.locator(".hero-ac__btn--primary")).toContainText("Plan a campaign");
    await expect(root.locator(".hero-ac__stat")).toHaveCount(3);
    await expect(root.locator(".hero-ac__stat").first()).toContainText("Variants live");
  });

  test("Post header shows brand name, sub, and avatar initials", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    await expect(root.locator(".hero-ac__post-name")).toContainText("Netimpulse");
    await expect(root.locator(".hero-ac__post-sub")).toContainText("Sponsored");
    await expect(root.locator(".hero-ac__post-avatar")).toContainText("NI");
  });

  test("All four variants render with patterns and tabs with CTRs", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    await expect(root.locator("[data-ac-slide]")).toHaveCount(4);
    await expect(root.locator("[data-ac-tab]")).toHaveCount(4);
    await expect(root.locator(".hero-ac__tab-ctr").first()).toContainText("1.8%");
  });

  test("Winner (highest CTR) is marked with WIN", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    const winners = root.locator(".hero-ac__tab.is-winner");
    await expect(winners).toHaveCount(1);
    await expect(winners.locator(".hero-ac__tab-ctr")).toContainText("4.7%");
    await expect(winners.locator(".hero-ac__tab-win")).toContainText("WIN");
  });

  test("Active slide cycles over time", async ({ page }) => {
    test.slow();
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    const active = () =>
      root.locator("[data-ac-slide].is-active").evaluate((el) =>
        parseInt(el.getAttribute("data-index") || "0", 10)
      );
    const a = await active();
    await page.waitForTimeout(3500);
    const b = await active();
    expect(b).not.toBe(a);
  });

  test("CTA text in the card footer updates with the active variant", async ({ page }) => {
    test.slow();
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    const cta = root.locator("[data-ac-cta]");
    const a = (await cta.textContent()) || "";
    await page.waitForTimeout(3500);
    const b = (await cta.textContent()) || "";
    expect(a).not.toBe(b);
  });

  test("Impressions counter ticks up over time", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    const imp = root.locator("[data-ac-impressions]");
    const parse = (s: string | null) => parseInt((s || "").replace(/[^0-9]/g, ""), 10);
    const a = parse(await imp.textContent());
    await page.waitForTimeout(1500);
    const b = parse(await imp.textContent());
    expect(b).toBeGreaterThan(a);
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-ad-cycler']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
