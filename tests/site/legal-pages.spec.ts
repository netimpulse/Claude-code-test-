import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Rechtstexte und einfache Seiten (Plan S7b, S7-Tests).
 *
 * - /policies/* rendert Shopify selbst als .shopify-policy__container >
 *   .shopify-policy__title h1 + .shopify-policy__body .rte; das Theme gestaltet
 *   das in assets/critical.css.
 * - /pages/widerruf läuft über sections/page.liquid (.page-prose, gleicher Stil).
 *   Die Seite fehlt im Store eventuell (404) – dann wird der Test übersprungen.
 *
 * Soll: genau ein h1 (--text-h2), Body in --text-body, Textspalte max. 72ch,
 * Innenabstand --section-y, Links unterstrichen, lesbarer Kontrast, kein
 * horizontaler Scroll bei 390/320.
 */

type Target = {
  name: string;
  path: string;
  container: string;
  title: string;
  body: string;
  optional?: boolean;
};

const TARGETS: Target[] = [
  {
    name: "Datenschutz (Policy)",
    path: QA.paths.policy,
    container: ".shopify-policy__container",
    title: ".shopify-policy__title h1",
    body: ".shopify-policy__body .rte",
  },
  {
    name: "Widerruf",
    path: QA.paths.widerruf,
    container: ".page-prose",
    title: ".page-prose__title",
    body: ".page-prose__body",
    optional: true,
  },
];

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (!m) throw new Error(`Unparsable colour: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function contrast(a: string, b: string): number {
  const lum = (rgb: [number, number, number]) => {
    const [r, g, bl] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const la = lum(parseRgb(a));
  const lb = lum(parseRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Resolves a root token to computed pixels via a probe element. */
async function tokenPx(page: Page, token: string, prop: "fontSize" | "paddingTop" = "fontSize"): Promise<number> {
  return page.evaluate(
    ({ t, p }) => {
      const probe = document.createElement("div");
      (probe.style as any)[p] = `var(${t})`;
      (document.getElementById("MainContent") ?? document.body).appendChild(probe);
      const px = parseFloat((getComputedStyle(probe) as any)[p]);
      probe.remove();
      return px;
    },
    { t: token, p: prop }
  );
}

/** Opens the page; returns false (after test.skip) when an optional page is missing. */
async function open(page: Page, target: Target): Promise<void> {
  const response = await page.goto(withTheme(target.path), { waitUntil: "load" });
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
  if (target.optional) {
    test.skip(response?.status() === 404, `${target.path} existiert im Store nicht (404)`);
  }
  expect(response?.status(), "HTTP-Status").toBe(200);
  await page.waitForSelector(target.container, { timeout: 15_000 });
}

for (const target of TARGETS) {
  test.describe(`Rechtstexte: ${target.name}`, () => {
    test("genau ein h1 in --text-h2, Body in --text-body", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, target);

      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator(target.title)).toHaveCount(1);

      const h2 = await tokenPx(page, "--text-h2");
      const body = await tokenPx(page, "--text-body");
      const titlePx = await page.locator(target.title).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(Math.abs(titlePx - h2), `h1 ${titlePx}px vs --text-h2 ${h2}px`).toBeLessThanOrEqual(1);

      const bodyPx = await page.locator(target.body).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(Math.abs(bodyPx - body), `Body ${bodyPx}px vs --text-body ${body}px`).toBeLessThanOrEqual(0.5);

      const firstP = page.locator(`${target.body} p`).first();
      if (await firstP.count()) {
        const pPx = await firstP.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(Math.abs(pPx - body)).toBeLessThanOrEqual(0.5);
      }
    });

    test("Textspalte max. 72ch, Innenabstand --section-y, Kontrast ≥ 4.5", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, target);

      const sectionY = await tokenPx(page, "--section-y", "paddingTop");
      const m = await page.locator(target.container).evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement("span");
        probe.textContent = "0";
        probe.style.cssText = "position:absolute;visibility:hidden;font:inherit";
        el.appendChild(probe);
        const ch = probe.getBoundingClientRect().width;
        probe.remove();
        const content = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        let bgEl: Element | null = el;
        let bg = "rgba(0, 0, 0, 0)";
        while (bgEl && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
          bg = getComputedStyle(bgEl).backgroundColor;
          bgEl = bgEl.parentElement;
        }
        return { ch, content, pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom), color: cs.color, bg };
      });
      expect(m.content, "Textbreite").toBeLessThanOrEqual(72 * m.ch + 1);
      expect(Math.abs(m.pt - sectionY)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.pb - sectionY)).toBeLessThanOrEqual(1);
      expect(contrast(m.color, m.bg)).toBeGreaterThanOrEqual(4.5);
    });

    test("Links im Text sind unterstrichen (.text-link-Stil)", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, target);
      const links = page.locator(`${target.body} a`);
      test.skip((await links.count()) === 0, "keine Links im Text");
      const s = await links.first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { line: cs.textDecorationLine, offset: cs.textUnderlineOffset, weight: cs.fontWeight };
      });
      expect(s.line).toContain("underline");
      expect(s.offset).toBe("6px");
      expect(s.weight).toBe("500");
    });

    for (const width of [390, 320]) {
      test(`kein horizontaler Scroll bei ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await open(page, target);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}
