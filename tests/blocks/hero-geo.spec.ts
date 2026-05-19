import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Hero GEO – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, two-tone headline, body, CTAs and platform pills", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-geo']").first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-geo__eyebrow")).toContainText("Generative engine optimization");
    await expect(root.locator(".hero-geo__heading-strong")).toContainText("Be the answer");
    await expect(root.locator(".hero-geo__heading-accent")).toContainText("ChatGPT");
    await expect(root.locator(".hero-geo__btn--primary")).toContainText("AI visibility");
    await expect(root.locator(".hero-geo__platform")).toHaveCount(4);
    await expect(root.locator(".hero-geo__platform").first()).toContainText("ChatGPT");
  });

  test("Chat header shows assistant name and monitoring indicator", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-geo']").first();
    await expect(root.locator(".hero-geo__assistant")).toContainText("ChatGPT");
    await expect(root.locator(".hero-geo__monitoring")).toContainText("Monitoring");
    await expect(root.locator(".hero-geo__monitoring-dot")).toBeVisible();
  });

  test("Question types in, then answer streams with highlight", async ({ page, browserName }) => {
    test.slow();
    const root = page.locator("[data-section-type='hero-geo']").first();
    const q = root.locator("[data-hg-question]");
    const a = root.locator("[data-hg-answer]");

    await expect.poll(async () => (await q.textContent()) || "", { timeout: 6000 }).toContain("Which agencies");

    await expect.poll(
      async () => (await a.textContent()) || "",
      { timeout: 15000 }
    ).toContain("Netimpulse");

    await expect(a.locator("mark")).toContainText("Netimpulse");
  });

  test("Citations appear once enough of the answer has streamed", async ({ page }) => {
    test.slow();
    const root = page.locator("[data-section-type='hero-geo']").first();
    await expect(root.locator(".hero-geo__citations")).toBeVisible({ timeout: 15000 });
    await expect(root.locator(".hero-geo__citation--brand")).toContainText("netimpulse.com");
  });

  test("Section does not overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
    const root = page.locator("[data-section-type='hero-geo']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
