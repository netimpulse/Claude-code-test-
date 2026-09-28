import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Hero Web Build auf der echten Web-Design-Seite (R1, Plan S6e). Soll nach
 * der Angleichung: Eyebrow/Buttons aus den Systemklassen, h1 in --text-mega,
 * heading_highlight als Serif-Akzent (em.it), Browser-Mockup baut sich
 * weiter auf; Mockup-Beschriftungen kommen aus den Locale-Dateien.
 */
const ROOT = "[data-section-type='hero-web-build']";

test.describe("Hero Web Build — Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.webDesign), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, headline with serif accent (with spaces) and both buttons", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await expect(root).toBeVisible();
    await expect(root.locator(".hwb__eyebrow")).toHaveClass(/\beyebrow\b/);
    await expect(root.locator(".hwb__eyebrow")).toContainText("Webdesign");

    const accent = root.locator("h1 em.it.hwb__heading-accent").first();
    await expect(accent).toContainText("verkaufen");

    const headingText = (await root.locator(".hwb__heading").first().textContent()) || "";
    // accent must not be glued to the preceding word
    expect(headingText).toContain(" verkaufen");
    // the dash follows the accent with a space
    expect(headingText).toMatch(/verkaufen [–—]/);

    await expect(root.locator(".hwb__btn--primary")).toHaveClass(/\bbtn--primary\b/);
    await expect(root.locator(".hwb__btn--primary")).toContainText("Projekt starten");
    await expect(root.locator(".hwb__btn--secondary")).toHaveClass(/\bbtn--secondary\b/);
    await expect(root.locator(".hwb__btn--secondary")).toBeVisible();
    await expect(root.locator(".hwb__btn--secondary")).toContainText("Arbeiten ansehen");
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
      [el, ...Array.from(el.querySelectorAll(".hwb__copy, .hwb__copy *, .hwb__browser"))]
        .filter((n) => {
          const cs = getComputedStyle(n as Element);
          return cs.backgroundImage.includes("gradient") || cs.boxShadow !== "none" || cs.filter !== "none";
        }).length
    );
    expect(decorated).toBe(0);
  });

  test("No reveal animation on copy; reduced motion shows the finished build", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const animated = await root.locator(".hwb__copy, .hwb__copy *").evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== "none").length
    );
    expect(animated).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(withTheme(QA.paths.webDesign), { waitUntil: "networkidle" });
    const r = page.locator(ROOT).first();
    await expect(r.locator("[data-hwb-progress]")).toHaveText("100%");
    const polish = await r.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--p-polish")));
    expect(polish).toBe(1);
    // Headline bars grow via transform, not width.
    const line = await r.locator(".hwb__hero-line--1").evaluate((el) => ({
      width: parseFloat(getComputedStyle(el).width),
      transform: getComputedStyle(el).transform,
    }));
    expect(line.width).toBeGreaterThan(100);
    expect(line.transform).not.toBe("none");
  });

  test("Mockup labels come from the locale (step label, status text)", async ({ page }) => {
    const root = page.locator(ROOT).first();
    const steps = (await root.getAttribute("data-steps")) || "";
    expect(steps.split("|")).toHaveLength(9);
    await page.waitForTimeout(2500);
    const label = ((await root.locator("[data-hwb-step-label]").textContent()) || "").trim();
    const labels = steps.split("|").map((s) => s.trim());
    expect(labels.some((l) => label.endsWith(l))).toBe(true);
    await expect(root.locator(".hwb__status-text")).toContainText("/ ");
  });

  test("Fits the first screen at 1280×800 including the buttons", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(withTheme(QA.paths.webDesign), { waitUntil: "networkidle" });
    const bottoms = await page.locator(ROOT).first().evaluate((el) => ({
      buttons: Math.max(...Array.from(el.querySelectorAll(".btn")).map((b) => b.getBoundingClientRect().bottom)),
      mock: el.querySelector(".hwb__browser")!.getBoundingClientRect().bottom,
    }));
    expect(bottoms.buttons).toBeLessThanOrEqual(800);
    expect(bottoms.mock).toBeLessThanOrEqual(800);
  });

  test("Stats block from the legacy mock is not rendered", async ({ page }) => {
    const root = page.locator(ROOT).first();
    // explicit anti-regression: the new section must not carry the WBStat strip
    await expect(root.locator(":text('Conversion-Lift')")).toHaveCount(0);
    await expect(root.locator(":text('Lighthouse')")).toHaveCount(0);
    await expect(root.locator(":text('Time-to-Launch')")).toHaveCount(0);
  });

  test("Browser-frame mock builds itself: phase variables advance over time", async ({ page }) => {
    const root = page.locator(ROOT).first();
    // Sample two phase values at start and after >1s — they must grow.
    const readPhases = async () =>
      root.evaluate((el) => {
        const s = getComputedStyle(el as HTMLElement);
        return {
          header: parseFloat(s.getPropertyValue("--p-header")) || 0,
          hero: parseFloat(s.getPropertyValue("--p-hero")) || 0,
          color: parseFloat(s.getPropertyValue("--p-color")) || 0,
        };
      });
    const a = await readPhases();
    await page.waitForTimeout(3500);
    const b = await readPhases();
    expect(b.header + b.hero + b.color).toBeGreaterThan(a.header + a.hero + a.color);
  });

  test("Step progress strip advances and progress label is not 0%", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await page.waitForTimeout(2500);
    const activeCount = await root.locator(".hwb__step.is-active").count();
    expect(activeCount).toBeGreaterThan(0);
    const progress = (await root.locator("[data-hwb-progress]").textContent()) || "";
    expect(progress).not.toBe("0%");
  });

  test("Highlight color picks up the --hwb-highlight override", async ({ page }) => {
    const root = page.locator(ROOT).first();
    await root.evaluate((el) =>
      (el as HTMLElement).style.setProperty("--hwb-highlight", "rgb(255, 0, 0)"),
    );
    const color = await root
      .locator(".hwb__heading-accent")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(255, 0, 0)");
  });

  for (const width of [390, 320]) {
    test(`Section does not overflow at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(withTheme(QA.paths.webDesign), { waitUntil: "networkidle" });
      const root = page.locator(ROOT).first();
      const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }
});
