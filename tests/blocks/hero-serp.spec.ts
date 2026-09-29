import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero SERP auf der echten SEO-Seite (R1, Plan S6d). Soll nach der
 * Angleichung ans Designsystem: Eyebrow/Buttons aus den Systemklassen,
 * h1 in --text-mega mit Serif-Akzent (em.it) aus heading_highlight,
 * SERP-Mockup animiert weiter (transform statt top).
 */
const ROOT = "[data-section-type='hero-serp']";

test.describe("Hero SERP – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.seo), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, headline with serif accent, lead, buttons and search mock", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-serp__eyebrow")).toHaveClass(/\beyebrow\b/);
    await expect(root.locator(".hero-serp__eyebrow")).toContainText("SEO");
    const accent = root.locator("h1 em.it.hero-serp__heading-accent");
    await expect(accent).toHaveCount(1);
    await expect(accent).toContainText("sucht");
    await expect(root.locator(".hero-serp__body")).toContainText("Google");
    await expect(root.locator(".hero-serp__btn--primary")).toHaveClass(/\bbtn--primary\b/);
    await expect(root.locator(".hero-serp__btn--primary")).toContainText("Audit");
    await expect(root.locator(".hero-serp__btn--secondary")).toHaveClass(/\bbtn--secondary\b/);
    await expect(root.locator(".hero-serp__btn--secondary")).toContainText("Weitere Leistungen");
    await expect(root.locator(".hero-serp__searchbar")).toBeVisible();
    await expect(page.locator("main h1, header h1")).toHaveCount(1);
  });

  test("Design system: display font, mega size, untinted serif accent, pill buttons", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const h1 = await root.locator("h1").evaluate((el) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement("div");
      probe.style.fontSize = "var(--text-mega)";
      el.appendChild(probe);
      const mega = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return { family: cs.fontFamily, size: parseFloat(cs.fontSize), weight: cs.fontWeight, color: cs.color, mega };
    });
    expect(h1.family).toContain("Bricolage Grotesque");
    expect(h1.weight).toBe("600");
    expect(Math.abs(h1.size - h1.mega)).toBeLessThan(1);
    const accent = await root.locator("h1 em.it").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, style: cs.fontStyle, color: cs.color };
    });
    expect(accent.family).toContain("Newsreader");
    expect(accent.style).toBe("italic");
    // Akzent wird nie eingefaerbt (heading_highlight_color im Template leer).
    expect(accent.color).toBe(h1.color);
    const radius = await root.locator(".hero-serp__btn--primary").evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBeGreaterThan(20);
    // Keine Verlaeufe/Schatten ausserhalb des Mockups.
    const decorated = await root.evaluate((el) =>
      [el, ...Array.from(el.querySelectorAll(".hero-serp__copy, .hero-serp__copy *, .hero-serp__mock"))]
        .filter((n) => {
          const cs = getComputedStyle(n as Element);
          return cs.backgroundImage.includes("gradient") || cs.boxShadow !== "none" || cs.filter !== "none" || cs.backdropFilter !== "none";
        }).length
    );
    expect(decorated).toBe(0);
  });

  test("No reveal animation on copy; mock motion stops with reduced motion", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const animated = await root.locator(".hero-serp__copy, .hero-serp__copy *").evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== "none").length
    );
    expect(animated).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(withTheme(QA.paths.seo), { waitUntil: "networkidle" });
    const typed = page.locator(ROOT).first().locator("[data-hs-typed]");
    await expect(typed).toHaveText("best shopify theme studio");
    const brand = page.locator(ROOT).first().locator(".hero-serp__row--brand");
    const a = await brand.evaluate((el) => el.getBoundingClientRect().top);
    await page.waitForTimeout(1500);
    const b = await brand.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  test("Fits the first screen at 1280×800 including the buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.seo), { waitUntil: "networkidle" });
    const root = page.locator(ROOT).first();
    const bottoms = await root.evaluate((el) => ({
      buttons: Math.max(...Array.from(el.querySelectorAll(".btn")).map((b) => b.getBoundingClientRect().bottom)),
      mock: el.querySelector(".hero-serp__mock")!.getBoundingClientRect().bottom,
    }));
    expect(bottoms.buttons).toBeLessThanOrEqual(800);
    expect(bottoms.mock).toBeLessThanOrEqual(800);
  });

  test("Tabs render with the first one active", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const tabs = root.locator(".hero-serp__tab");
    await expect(tabs).toHaveCount(5);
    await expect(tabs.first()).toHaveClass(/hero-serp__tab--active/);
  });

  test("All 6 result rows render, brand-flagged row marked correctly", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator("[data-hs-row]")).toHaveCount(6);
    const brand = root.locator(".hero-serp__row--brand");
    await expect(brand).toHaveCount(1);
    await expect(brand).toContainText("Netimpulse");
  });

  test("Search bar types the configured query over time", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const typed = root.locator("[data-hs-typed]");
    const first = (await typed.textContent()) || "";
    await page.waitForTimeout(800);
    const later = (await typed.textContent()) || "";
    expect(later.length).toBeGreaterThanOrEqual(first.length);
    await expect.poll(async () => (await typed.textContent()) || "", { timeout: 9000 }).toContain("best shopify");
  });

  test("Brand row jumps via transform: its position varies across the cycle", async ({ page }) => {
    test.slow();
    const root = page.locator(ROOT).first();
    const brand = root.locator(".hero-serp__row--brand");
    // Offset of the brand row inside the results list (moved by translateY, not top).
    const readOffset = () =>
      brand.evaluate((el) => {
        const list = el.parentElement as HTMLElement;
        return el.getBoundingClientRect().top - list.getBoundingClientRect().top;
      });
    expect(await brand.evaluate((el) => (el as HTMLElement).style.transform)).toContain("translateY");

    // Sample for >1 full cycle (8s) so we observe both pre- and post-jump positions.
    const seen: number[] = [];
    for (let i = 0; i < 16; i++) {
      seen.push(await readOffset());
      await page.waitForTimeout(700);
    }
    const min = Math.min(...seen);
    const max = Math.max(...seen);
    // Pre-jump offset is brand_index (3) * row_h (64) = 192. Post-jump is 0.
    expect(max - min).toBeGreaterThan(50);
    expect(min).toBeLessThan(20);
  });

  for (const width of [390, 320]) {
    test(`Section does not overflow at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(withTheme(QA.paths.seo), { waitUntil: "networkidle" });
      const root = page.locator(ROOT).first();
      const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }
});
