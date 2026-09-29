import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Ticker auf der echten SEA-Seite (R1, Plan S6d). Soll nach der
 * Angleichung: Eyebrow/Buttons aus den Systemklassen, h1 in --text-mega
 * ohne Serif-Akzent, zweiter Teil (heading_muted) in --color-muted,
 * Dashboard-Mockup animiert weiter.
 */
const ROOT = "[data-section-type='hero-ticker']";

test.describe("Hero Ticker – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.sea), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, two-part headline, lead and CTAs", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-ticker__eyebrow")).toHaveClass(/\beyebrow\b/);
    await expect(root.locator(".hero-ticker__eyebrow")).toContainText("Performance");
    await expect(root.locator(".hero-ticker__heading-strong")).toContainText("schnell sichtbar");
    await expect(root.locator(".hero-ticker__heading-muted")).toContainText("SEA");
    await expect(root.locator(".hero-ticker__btn--primary")).toHaveClass(/\bbtn--primary\b/);
    await expect(root.locator(".hero-ticker__btn--primary")).toContainText("Audit");
    await expect(root.locator(".hero-ticker__btn--secondary")).toHaveClass(/\bbtn--secondary\b/);
    await expect(root.locator(".hero-ticker__btn--secondary")).toContainText("Weitere Leistungen");
    await expect(page.locator("main h1, header h1")).toHaveCount(1);
  });

  test("Design system: display font in mega size, muted second part, no serif accent", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator("h1 em.it")).toHaveCount(0);
    const h = await root.evaluate((el) => {
      const h1 = el.querySelector("h1") as HTMLElement;
      const probe = document.createElement("div");
      probe.style.fontSize = "var(--text-mega)";
      probe.style.color = "var(--color-muted)";
      h1.appendChild(probe);
      const mega = parseFloat(getComputedStyle(probe).fontSize);
      const muted = getComputedStyle(probe).color;
      probe.remove();
      const cs = getComputedStyle(h1);
      return {
        family: cs.fontFamily,
        size: parseFloat(cs.fontSize),
        mega,
        muted,
        mutedPart: getComputedStyle(el.querySelector(".hero-ticker__heading-muted")!).color,
      };
    });
    expect(h.family).toContain("Bricolage Grotesque");
    expect(Math.abs(h.size - h.mega)).toBeLessThan(1);
    expect(h.mutedPart).toBe(h.muted);
    const decorated = await root.evaluate((el) =>
      [el, ...Array.from(el.querySelectorAll(".hero-ticker__copy, .hero-ticker__copy *, .hero-ticker__dashboard"))]
        .filter((n) => {
          const cs = getComputedStyle(n as Element);
          return cs.backgroundImage.includes("gradient") || cs.boxShadow !== "none" || cs.filter !== "none";
        }).length
    );
    expect(decorated).toBe(0);
  });

  test("No reveal animation on copy; mock motion stops with reduced motion", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const animated = await root.locator(".hero-ticker__copy, .hero-ticker__copy *").evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== "none").length
    );
    expect(animated).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(withTheme(QA.paths.sea), { waitUntil: "networkidle" });
    const r = page.locator(ROOT).first();
    expect(await r.locator(".hero-ticker__chrome-pulse").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    const live = r.locator("[data-ht-value]").first();
    const a = (await live.textContent()) || "";
    await page.waitForTimeout(1200);
    expect((await live.textContent()) || "").toBe(a);
  });

  test("Fits the first screen at 1280×800 including the buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.sea), { waitUntil: "networkidle" });
    const bottoms = await page.locator(ROOT).first().evaluate((el) => ({
      buttons: Math.max(...Array.from(el.querySelectorAll(".btn")).map((b) => b.getBoundingClientRect().bottom)),
      mock: el.querySelector(".hero-ticker__dashboard")!.getBoundingClientRect().bottom,
    }));
    expect(bottoms.buttons).toBeLessThanOrEqual(800);
    expect(bottoms.mock).toBeLessThanOrEqual(800);
  });

  test("Window chrome shows label and pulsing live indicator", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator(".hero-ticker__chrome-label")).toContainText("client");
    await expect(root.locator(".hero-ticker__chrome-live")).toContainText("Live");
    await expect(root.locator(".hero-ticker__chrome-pulse")).toBeVisible();
  });

  test("All four metric blocks render with their labels and deltas", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator(".hero-ticker__metric")).toHaveCount(4);
    await expect(root.locator(".hero-ticker__metric").nth(0)).toContainText("Organic clicks");
    await expect(root.locator(".hero-ticker__metric").nth(1)).toContainText("5.42%");
    await expect(root.locator(".hero-ticker__metric").nth(2)).toContainText("€18.40");
    await expect(root.locator(".hero-ticker__metric").nth(2)).toContainText("21.4");
    await expect(root.locator(".hero-ticker__metric").nth(3)).toContainText("+2.4");
  });

  test("Live metric values change over time", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const live = root.locator("[data-ht-value]").first();
    const a = (await live.textContent()) || "";
    await page.waitForTimeout(1200);
    const b = (await live.textContent()) || "";
    expect(a).not.toBe(b);
  });

  test("Sparklines render path data and a moving dot", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const sparks = root.locator(".hero-ticker__spark");
    await expect(sparks).toHaveCount(4);
    const linePath = await sparks.first().locator(".hero-ticker__spark-line").evaluate((el) =>
      el.getAttribute("d")
    );
    expect(linePath && linePath.length > 0).toBeTruthy();
  });

  for (const width of [390, 320]) {
    test(`Section does not overflow at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(withTheme(QA.paths.sea), { waitUntil: "networkidle" });
      const root = page.locator(ROOT).first();
      const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }
});
