import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero GEO auf der echten GEO-Seite (R1, Plan S6d). Soll nach der
 * Angleichung: Eyebrow/Buttons aus den Systemklassen, h1 in --text-mega,
 * zweiter Teil (heading_accent) als Serif-Akzent (em.it), Chat-Mockup
 * animiert weiter.
 */
const ROOT = "[data-section-type='hero-geo']";

test.describe("Hero GEO – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.geo), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, headline with serif accent, lead, CTAs and platform pills", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hero-geo__eyebrow")).toHaveClass(/\beyebrow\b/);
    await expect(root.locator(".hero-geo__eyebrow")).toContainText("Generative engine optimization");
    await expect(root.locator(".hero-geo__heading-strong")).toContainText("Gefunden werden");
    await expect(root.locator(".hero-geo__heading-accent em.it")).toContainText("KI Antworten");
    await expect(root.locator(".hero-geo__btn--primary")).toHaveClass(/\bbtn--primary\b/);
    await expect(root.locator(".hero-geo__btn--primary")).toContainText("Sichtbarkeit prüfen");
    await expect(root.locator(".hero-geo__btn--secondary")).toHaveClass(/\bbtn--secondary\b/);
    await expect(root.locator(".hero-geo__platform")).toHaveCount(4);
    await expect(root.locator(".hero-geo__platform").first()).toContainText("ChatGPT");
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
      [el, ...Array.from(el.querySelectorAll(".hero-geo__copy, .hero-geo__copy *, .hero-geo__chat"))]
        .filter((n) => {
          const cs = getComputedStyle(n as Element);
          return cs.backgroundImage.includes("gradient") || cs.boxShadow !== "none" || cs.filter !== "none";
        }).length
    );
    expect(decorated).toBe(0);
  });

  test("No reveal animation on copy; chat shows the final state with reduced motion", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const animated = await root.locator(".hero-geo__copy, .hero-geo__copy *").evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== "none").length
    );
    expect(animated).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(withTheme(QA.paths.geo), { waitUntil: "networkidle" });
    const r = page.locator(ROOT).first();
    await expect(r.locator("[data-hg-answer] mark")).toContainText("NetImpulse", { ignoreCase: true });
    await expect(r.locator(".hero-geo__citations")).toBeVisible();
    expect(await r.locator(".hero-geo__monitoring-dot").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("Fits the first screen at 1280×800 including the buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.geo), { waitUntil: "networkidle" });
    const bottoms = await page.locator(ROOT).first().evaluate((el) => ({
      buttons: Math.max(...Array.from(el.querySelectorAll(".btn")).map((b) => b.getBoundingClientRect().bottom)),
      mock: el.querySelector(".hero-geo__chat")!.getBoundingClientRect().bottom,
    }));
    expect(bottoms.buttons).toBeLessThanOrEqual(800);
    expect(bottoms.mock).toBeLessThanOrEqual(800);
  });

  test("Chat header shows assistant name and monitoring indicator", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root.locator(".hero-geo__assistant")).toContainText("ChatGPT");
    await expect(root.locator(".hero-geo__monitoring")).toContainText("Monitoring");
    await expect(root.locator(".hero-geo__monitoring-dot")).toBeVisible();
  });

  test("Question types in, then answer streams with highlight", async ({ page }) => {
    test.slow();
    const root = page.locator(ROOT).first();
    const q = root.locator("[data-hg-question]");
    const a = root.locator("[data-hg-answer]");

    await expect.poll(async () => (await q.textContent()) || "", { timeout: 6000 }).toContain("Welche Agentur");

    await expect.poll(
      async () => ((await a.textContent()) || "").toLowerCase(),
      { timeout: 15000 }
    ).toContain("netimpulse");

    await expect(a.locator("mark")).toContainText("NetImpulse", { ignoreCase: true });
  });

  test("Citations appear once enough of the answer has streamed", async ({ page }) => {
    test.slow();
    const root = page.locator(ROOT).first();
    await expect(root.locator(".hero-geo__citations")).toBeVisible({ timeout: 15000 });
    await expect(root.locator(".hero-geo__citation--brand")).toContainText("netimpulse.com");
  });

  for (const width of [390, 320]) {
    test(`Section does not overflow at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(withTheme(QA.paths.geo), { waitUntil: "networkidle" });
      const root = page.locator(ROOT).first();
      const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }
});
