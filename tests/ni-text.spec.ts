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

/**
 * Design target (Plan S6b) on the real pages: ni-text on /pages/leistungen
 * and /pages/theme-store runs on scheme-sand (stored "" → "scheme-sand"),
 * h2 in --text-h2, padding = min(setting 160, --section-y), no shadows or
 * gradients, 390/320 without horizontal scroll.
 */
for (const target of [
  { name: "Leistungen", path: QA.paths.leistungen, heading: "Wie wird abgerechnet?" },
  { name: "Theme-Store", path: QA.paths.themeStore, heading: "Bald verfügbar" },
]) {
  test.describe(`ni-text – Designsoll (${target.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(withTheme(target.path), { waitUntil: "load" });
      await passChallenge(page);
      await page.waitForSelector(".ni-text", { timeout: 15_000 });
    });

    test("Sand scheme, h2 in --text-h2, padding follows --section-y", async ({ page }) => {
      const section = page.locator(".ni-text").filter({ hasText: target.heading }).first();
      await expect(section).toHaveClass(/\bcolor-scheme-sand\b/);
      const cs = await section.evaluate((el) => {
        const s = getComputedStyle(el);
        const probe = document.createElement("div");
        probe.style.cssText = "padding-top: var(--section-y); font-size: var(--text-h2)";
        el.appendChild(probe);
        const p = getComputedStyle(probe);
        const out = {
          bg: s.backgroundColor,
          padTop: parseFloat(s.paddingTop),
          sectionY: parseFloat(p.paddingTop),
          h2: parseFloat(getComputedStyle(el.querySelector(".ni-text__heading")!).fontSize),
          h2Token: parseFloat(p.fontSize),
        };
        probe.remove();
        return out;
      });
      expect(cs.bg).toBe("rgb(248, 246, 241)");
      expect(Math.abs(cs.padTop - cs.sectionY)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(cs.h2 - cs.h2Token)).toBeLessThanOrEqual(0.5);
    });

    test("Text meets 4.5:1, no shadows or gradients", async ({ page }) => {
      const section = page.locator(".ni-text").filter({ hasText: target.heading }).first();
      const res = await section.evaluate((root) => {
        const rgb = (v: string) => (v.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const lum = (c: number[]) => {
          const [r, g, b] = c.map((x) => {
            const s = x / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a: string, b: string) => {
          const la = lum(rgb(a));
          const lb = lum(rgb(b));
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };
        const bg = getComputedStyle(root).backgroundColor;
        const bad: string[] = [];
        for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
          const cs = getComputedStyle(el);
          if (cs.boxShadow !== "none") bad.push(`${el.className} box-shadow`);
          if (cs.backgroundImage.includes("gradient")) bad.push(`${el.className} gradient`);
        }
        return {
          bad,
          heading: ratio(getComputedStyle(root.querySelector(".ni-text__heading")!).color, bg),
          body: ratio(getComputedStyle(root.querySelector(".ni-text__body")!).color, bg),
        };
      });
      expect(res.bad).toEqual([]);
      expect(res.heading).toBeGreaterThanOrEqual(4.5);
      expect(res.body).toBeGreaterThanOrEqual(4.5);
    });

    for (const width of [390, 320]) {
      test(`Nothing in the section overflows at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(300);
        // Scoped to this section; other sections of the page have their own specs.
        const overflow = await page
          .locator(".ni-text")
          .filter({ hasText: target.heading })
          .first()
          .evaluate((sec) => {
            const vw = document.documentElement.clientWidth;
            let worst = 0;
            [sec, ...Array.from(sec.querySelectorAll<HTMLElement>("*"))].forEach((el) => {
              const r = el.getBoundingClientRect();
              worst = Math.max(worst, r.right - vw, -r.left);
            });
            return worst;
          });
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  });
}
