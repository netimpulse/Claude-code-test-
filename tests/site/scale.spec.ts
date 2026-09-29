import { test, expect, Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Globale Skalierung (snippets/css-variables.liquid):
 *  - Header bleibt bei 100 % (--ui-scale 1, --btn-h 52px).
 *  - #MainContent und Footer-Gruppe laufen mit --ui-scale 0.9; Typo-, Abstands-
 *    und Control-Tokens werden dort neu berechnet.
 *  - Untergrenzen: Fliesstext 16px, Buttons 44px (btn--sm) bzw. 46px.
 */

async function tokensIn(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const host = document.querySelector(sel);
    if (!host) return null;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;font-size:var(--text-h2);height:var(--btn-h)";
    host.appendChild(probe);
    const cs = getComputedStyle(probe);
    const out = {
      scale: getComputedStyle(host).getPropertyValue("--ui-scale").trim(),
      h2: parseFloat(cs.fontSize),
      btnH: parseFloat(cs.height),
    };
    probe.remove();
    return out;
  }, selector);
}

for (const width of [1440, 390]) {
  test.describe(`Skalierung Startseite @ ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
      expect(res?.status()).toBe(200);
    });

    test("Header 100 %, Inhalt 90 %: --ui-scale und --text-h2", async ({ page }) => {
      const header = await tokensIn(page, ".shopify-section-group-header-group");
      const main = await tokensIn(page, "#MainContent");
      expect(header, "Header-Gruppe vorhanden").not.toBeNull();
      expect(main, "#MainContent vorhanden").not.toBeNull();
      expect(Number(header!.scale)).toBe(1);
      expect(Number(main!.scale)).toBeCloseTo(0.9, 5);
      expect(main!.h2 / header!.h2).toBeCloseTo(0.9, 2);
      expect(header!.btnH).toBeGreaterThanOrEqual(51);
      expect(main!.btnH).toBeGreaterThanOrEqual(46);
      expect(main!.btnH).toBeLessThan(header!.btnH);
    });

    test("Header-Buttons behalten volle Groesse (btn >= 51, btn--sm >= 44)", async ({ page }) => {
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".shopify-section-group-header-group .btn")]
          .filter((b) => b.offsetParent !== null)
          .map((b) => ({ sm: b.classList.contains("btn--sm"), h: b.getBoundingClientRect().height, t: b.textContent?.trim() }))
      );
      if (width === 1440) expect(buttons.length, "sichtbarer Header-CTA").toBeGreaterThan(0);
      for (const b of buttons) expect(b.h, `${b.t}`).toBeGreaterThanOrEqual(b.sm ? 44 : 51);
    });

    test("Fliesstext bleibt >= 16px", async ({ page }) => {
      const sizes = await page.evaluate(() => {
        const main = document.getElementById("MainContent")!;
        const probe = document.createElement("p");
        probe.textContent = "Probe";
        main.appendChild(probe);
        const base = parseFloat(getComputedStyle(probe).fontSize);
        probe.remove();
        return { main: parseFloat(getComputedStyle(main).fontSize), p: base };
      });
      expect(sizes.main).toBeGreaterThanOrEqual(16);
      expect(sizes.p).toBeGreaterThanOrEqual(16);
    });

    test("Footer ist mitskaliert", async ({ page }) => {
      const footer = await tokensIn(page, ".shopify-section-group-footer-group");
      expect(footer, "Footer-Gruppe vorhanden").not.toBeNull();
      expect(Number(footer!.scale)).toBeCloseTo(0.9, 5);
      const header = await tokensIn(page, ".shopify-section-group-header-group");
      expect(footer!.h2 / header!.h2).toBeCloseTo(0.9, 2);
    });
  });
}
