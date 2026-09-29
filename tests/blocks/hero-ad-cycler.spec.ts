import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Ad Cycler auf der echten SMM-Seite (R1, Plan S6e). Soll nach der
 * Angleichung: Eyebrow/Buttons aus den Systemklassen, h1 in --text-mega,
 * heading_accent als Serif-Akzent (em.it), Anzeigen-Mockup rotiert weiter.
 */
const ROOT = "[data-section-type='hero-ad-cycler']";

test.describe("Hero Ad Cycler – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.smm), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, headline with serif accent, lead, CTAs and stat strip", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-ac__eyebrow")).toHaveClass(/\beyebrow\b/);
    await expect(root.locator(".hero-ac__eyebrow")).toContainText("Paid social");
    await expect(root.locator("h1 em.it.hero-ac__heading-accent")).toContainText("nicht einfach nur postet");
    await expect(root.locator(".hero-ac__btn--primary")).toHaveClass(/\bbtn--primary\b/);
    await expect(root.locator(".hero-ac__btn--primary")).toContainText("Kampagne planen");
    await expect(root.locator(".hero-ac__btn--secondary")).toHaveClass(/\bbtn--secondary\b/);
    await expect(root.locator(".hero-ac__stat")).toHaveCount(3);
    await expect(root.locator(".hero-ac__stat").first()).toContainText("Posts Live");
    await expect(page.locator("main h1, header h1")).toHaveCount(1);
  });

  test("Design system: display font in mega size, untinted serif accent, no gradients/shadows", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const h = await root.evaluate((el) => {
      const h1 = el.querySelector("h1") as HTMLElement;
      const probe = document.createElement("div");
      probe.style.fontSize = "var(--text-mega)";
      h1.appendChild(probe);
      const mega = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      const em = getComputedStyle(h1.querySelector("em.it")!);
      const cs = getComputedStyle(h1);
      return { family: cs.fontFamily, size: parseFloat(cs.fontSize), mega, color: cs.color, emFamily: em.fontFamily, emStyle: em.fontStyle, emColor: em.color };
    });
    expect(h.family).toContain("Bricolage Grotesque");
    expect(Math.abs(h.size - h.mega)).toBeLessThan(1);
    expect(h.emFamily).toContain("Newsreader");
    expect(h.emStyle).toBe("italic");
    expect(h.emColor).toBe(h.color);
    const decorated = await root.evaluate((el) =>
      [el, ...Array.from(el.querySelectorAll(".hero-ac__copy, .hero-ac__copy *, .hero-ac__card"))]
        .filter((n) => {
          const cs = getComputedStyle(n as Element);
          return cs.backgroundImage.includes("gradient") || cs.boxShadow !== "none" || cs.filter !== "none";
        }).length
    );
    expect(decorated).toBe(0);
  });

  test("No reveal animation on copy; slides stop cycling with reduced motion", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const animated = await root.locator(".hero-ac__copy, .hero-ac__copy *").evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== "none").length
    );
    expect(animated).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(withTheme(QA.paths.smm), { waitUntil: "networkidle" });
    const r = page.locator(ROOT).first();
    const active = () => r.locator("[data-ac-slide].is-active").getAttribute("data-index");
    const a = await active();
    await page.waitForTimeout(3500);
    expect(await active()).toBe(a);
    expect(await r.locator(".hero-ac__test-dot").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("Fits the first screen at 1280×800 including the buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.smm), { waitUntil: "networkidle" });
    const bottoms = await page.locator(ROOT).first().evaluate((el) => ({
      buttons: Math.max(...Array.from(el.querySelectorAll(".btn")).map((b) => b.getBoundingClientRect().bottom)),
      card: el.querySelector(".hero-ac__card")!.getBoundingClientRect().bottom,
    }));
    expect(bottoms.buttons).toBeLessThanOrEqual(800);
    expect(bottoms.card).toBeLessThanOrEqual(800);
  });

  test("Post header shows brand name, sub, and avatar initials", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator(".hero-ac__post-name")).toContainText("Netimpulse");
    await expect(root.locator(".hero-ac__post-sub")).toContainText("Sponsored");
    await expect(root.locator(".hero-ac__post-avatar")).toContainText("NI");
  });

  test("All four variants render with patterns and tabs with CTRs", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator("[data-ac-slide]")).toHaveCount(4);
    await expect(root.locator("[data-ac-tab]")).toHaveCount(4);
    await expect(root.locator(".hero-ac__tab-ctr").first()).toContainText("1.8%");
  });

  test("Winner (highest CTR) is marked with WIN", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const winners = root.locator(".hero-ac__tab.is-winner");
    await expect(winners).toHaveCount(1);
    await expect(winners.locator(".hero-ac__tab-ctr")).toContainText("4.7%");
    await expect(winners.locator(".hero-ac__tab-win")).toContainText("WIN");
  });

  test("Active slide cycles over time", async ({ page }) => {
    test.slow();
    const root = page.locator(ROOT).first();
    const active = () =>
      root.locator("[data-ac-slide].is-active").evaluate((el) =>
        parseInt(el.getAttribute("data-index") || "0", 10)
      );
    const a = await active();
    await page.waitForTimeout(3500);
    const b = await active();
    expect(b).not.toBe(a);
  });

  test("CTA text in the card footer follows the active variant", async ({ page }) => {
    test.slow();
    const root = page.locator(ROOT).first();
    const read = () =>
      root.evaluate((el) => ({
        index: el.querySelector("[data-ac-slide].is-active")!.getAttribute("data-index"),
        want: el.querySelector("[data-ac-slide].is-active")!.getAttribute("data-cta") || "",
        cta: (el.querySelector("[data-ac-cta]")!.textContent || "").trim(),
        btn: (el.querySelector("[data-ac-cta-btn]")!.textContent || "").trim(),
      }));
    const a = await read();
    expect(a.cta).toBe(a.want.trim());
    expect(a.btn).toBe(a.want.trim());
    await page.waitForTimeout(3500);
    const b = await read();
    expect(b.index).not.toBe(a.index);
    expect(b.cta).toBe(b.want.trim());
    expect(b.btn).toBe(b.want.trim());
  });

  test("Impressions counter ticks up over time", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const imp = root.locator("[data-ac-impressions]");
    const parse = (s: string | null) => parseInt((s || "").replace(/[^0-9]/g, ""), 10);
    const a = parse(await imp.textContent());
    await page.waitForTimeout(1500);
    const b = parse(await imp.textContent());
    expect(b).toBeGreaterThan(a);
  });

  for (const width of [390, 320]) {
    test(`Section does not overflow at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(withTheme(QA.paths.smm), { waitUntil: "networkidle" });
      const root = page.locator(ROOT).first();
      const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }
});
