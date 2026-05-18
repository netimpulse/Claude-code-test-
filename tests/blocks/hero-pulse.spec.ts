import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Pulse — signal waveform hero with stat blocks.
 *
 * Rendered on the QA block test page. The section ships with three
 * stat blocks (lift, sessions, channels) and a JS-driven waveform.
 */
test.describe("Hero Pulse – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, both headline parts, body, and CTAs", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".hero-pulse__eyebrow")).toContainText("Listening to your market");
    await expect(root.locator(".hero-pulse__heading-strong")).toContainText("Signal that sells");
    await expect(root.locator(".hero-pulse__heading-muted")).toContainText("Not noise");
    await expect(root.locator(".hero-pulse__body")).toContainText("Shopify themes");
    await expect(root.locator(".hero-pulse__btn--primary")).toContainText("Get a free audit");
    await expect(root.locator(".hero-pulse__btn--secondary")).toContainText("See recent work");
  });

  test("Status row shows the signal label, blinking dot and running timer", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    await expect(root.locator(".hero-pulse__status")).toContainText("Signal");
    await expect(root.locator(".hero-pulse__dot")).toBeVisible();
    const timer = root.locator("[data-hp-timer]");
    await expect(timer).toBeVisible();
    await expect(timer).toHaveText(/^00:\d{2}\.\d{3}$/);
  });

  test("Timer advances over time", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    const timer = root.locator("[data-hp-timer]");
    const a = await timer.textContent();
    await page.waitForTimeout(700);
    const b = await timer.textContent();
    expect(a).not.toBe(b);
  });

  test("Waveform renders 56 bars with the last 10 marked as accent", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    const bars = root.locator("[data-hp-bar]");
    await expect(bars).toHaveCount(56);
    await expect(root.locator(".hero-pulse__bar--accent")).toHaveCount(10);
  });

  test("Bars animate: their transform changes between frames", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    const bars = root.locator("[data-hp-bar]");

    // Wait until JS has painted at least one animated frame.
    await expect
      .poll(async () => {
        return bars.first().evaluate(
          (el) => (el as HTMLElement).style.transform,
        );
      })
      .not.toBe("scaleY(0.06)");

    const before = await bars.evaluateAll((els) =>
      els.slice(0, 8).map((el) => (el as HTMLElement).style.transform),
    );
    await page.waitForTimeout(400);
    const after = await bars.evaluateAll((els) =>
      els.slice(0, 8).map((el) => (el as HTMLElement).style.transform),
    );
    expect(before.join("|")).not.toBe(after.join("|"));
  });

  test("All three stat blocks render with their configured values", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    const stats = root.locator(".hero-pulse__stat");
    await expect(stats).toHaveCount(3);

    await expect(root.locator(".hero-pulse__stat--accent .hero-pulse__stat-value")).toContainText("2.4×");
    await expect(root.locator(".hero-pulse__stat--default .hero-pulse__stat-value")).toContainText("4 / 4");
    await expect(root.locator(".hero-pulse__stat--mono")).toBeVisible();
  });

  test("Live counter increments the sessions value", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    const counter = root.locator("[data-hp-counter]").first();

    const parseNum = (s: string | null) => parseInt((s || "").replace(/[^0-9]/g, ""), 10);

    const a = parseNum(await counter.textContent());
    await page.waitForTimeout(1200);
    const b = parseNum(await counter.textContent());
    expect(b).toBeGreaterThan(a);
  });

  test("Section uses the color-scheme class and reads --hp-bg", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    await expect(root).toHaveClass(/color-scheme/);
    const bg = await root.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--hp-bg").trim()
    );
    expect(bg.length).toBeGreaterThan(0);
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='hero-pulse']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });

  test("Signal panel is aria-hidden — purely decorative", async ({ page }) => {
    const root = page.locator("[data-section-type='hero-pulse']").first();
    const panel = root.locator(".hero-pulse__panel");
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });
});
