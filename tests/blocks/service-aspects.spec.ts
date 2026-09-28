import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/service-aspects.liquid – Leistungs-Unterseiten (Plan S6c).
 * R1: the section is not on the QA page; it lives on /pages/sea (6 tiles)
 * and /pages/smm (3 tiles), both scheme-sand, 3 columns.
 * Target: eyebrow + h2 via accent-heading, scheme tokens (no blue #4a7cff),
 * equal-size cards without shadow (--r-lg, 1px --color-line), numbers and
 * icons in --color-accent (#1c4948), staggered columns on desktop, single
 * column without stagger on mobile, no horizontal scroll at 390/320.
 */
async function passChallenge(page: Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

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

const SAND_BG = "rgb(248, 246, 241)";
const SURFACE = "rgb(255, 253, 248)";
const LINE = "rgb(214, 204, 187)";
const TEAL = "rgb(28, 73, 72)";
const BLUE = "74, 124, 255";

const PAGES = [
  { name: "SEA", path: QA.paths.sea, kicker: "SEA", heading: "Die wichtigsten Bausteine eines SEA-Projekts.", tiles: 6, firstTitle: "Suchbegriffe und Keywords" },
  { name: "SMM", path: QA.paths.smm, kicker: "SMM", heading: "Was in einem SMM-Projekt steckt.", tiles: 3, firstTitle: "Strategie" },
];

for (const target of PAGES) {
  test.describe(`service-aspects section (${target.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 1100 });
      await page.goto(withTheme(target.path), { waitUntil: "load" });
      await passChallenge(page);
      await page.waitForSelector(".service-aspects__grid", { timeout: 15_000 });
      await page.locator(".service-aspects").first().scrollIntoViewIfNeeded();
    });

    test("Eyebrow, h2 via accent-heading and equal-size tiles render", async ({ page }) => {
      const section = page.locator(".service-aspects").first();
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/\bcolor-scheme-sand\b/);
      expect(await section.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(SAND_BG);

      await expect(section.locator(".service-aspects__kicker.eyebrow")).toHaveText(target.kicker);
      const heading = section.locator("h2.service-aspects__heading");
      await expect(heading).toHaveText(target.heading);
      expect(await heading.textContent()).not.toContain("*");
      expect(await heading.locator("em.it").count()).toBeLessThanOrEqual(1);

      const tiles = section.locator(".service-aspects__tile");
      await expect(tiles).toHaveCount(target.tiles);
      await expect(tiles.first().locator("h3.service-aspects__tile-title")).toHaveText(target.firstTitle);

      // Equal size: every tile shares the same width and height.
      const boxes = await tiles.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        })
      );
      const first = boxes[0];
      for (const b of boxes) {
        expect(Math.abs(b.w - first.w)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.h - first.h)).toBeLessThanOrEqual(1);
      }
    });

    test("Tiles are cards without shadow: --r-lg, 1px line, surface colour", async ({ page }) => {
      const tiles = page.locator(".service-aspects").first().locator(".service-aspects__tile");
      const styles = await tiles.evaluateAll((els) =>
        els.map((el) => {
          const cs = getComputedStyle(el);
          return {
            radius: cs.borderTopLeftRadius,
            width: cs.borderTopWidth,
            color: cs.borderTopColor,
            bg: cs.backgroundColor,
            shadow: cs.boxShadow,
          };
        })
      );
      for (const s of styles) {
        expect(s).toEqual({ radius: "16px", width: "1px", color: LINE, bg: SURFACE, shadow: "none" });
      }

      // Hover must not add a shadow either.
      await tiles.first().hover();
      await page.waitForTimeout(400);
      expect(await tiles.first().evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
    });

    test("Numbers and icons use the scheme accent, no blue, no gradients", async ({ page }) => {
      const section = page.locator(".service-aspects").first();
      const numbers = section.locator(".service-aspects__number");
      await expect(numbers).toHaveCount(target.tiles);
      await expect(numbers.first()).toHaveText("01");
      for (const c of await numbers.evaluateAll((els) => els.map((el) => getComputedStyle(el).color))) {
        expect(c).toBe(TEAL);
        expect(contrast(c, SURFACE)).toBeGreaterThanOrEqual(4.5);
      }
      const icons = section.locator(".service-aspects__icon");
      for (const c of await icons.evaluateAll((els) => els.map((el) => getComputedStyle(el).color))) {
        expect(c).toBe(TEAL);
      }

      const offenders = await section.evaluate((root, needle) => {
        const bad: string[] = [];
        for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
          for (const pseudo of [null, "::before", "::after"]) {
            const cs = getComputedStyle(el, pseudo);
            const name = `${el.getAttribute("class") ?? el.tagName}${pseudo ?? ""}`;
            if (cs.boxShadow !== "none") bad.push(`${name} box-shadow`);
            if (cs.backgroundImage.includes("gradient")) bad.push(`${name} gradient`);
            const backdrop = cs.getPropertyValue("backdrop-filter") || "none";
            if (cs.filter !== "none" || backdrop !== "none") bad.push(`${name} filter`);
            for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor]) {
              if (v.includes(needle)) bad.push(`${name} blue ${v}`);
            }
          }
        }
        return bad;
      }, BLUE);
      expect(offenders).toEqual([]);
    });

    test("Text meets 4.5:1", async ({ page }) => {
      const section = page.locator(".service-aspects").first();
      const checks: [string, string][] = [
        [".service-aspects__kicker", SAND_BG],
        [".service-aspects__heading", SAND_BG],
        [".service-aspects__intro", SAND_BG],
        [".service-aspects__tile-title", SURFACE],
        [".service-aspects__tile-text", SURFACE],
      ];
      for (const [sel, bg] of checks) {
        const el = section.locator(sel).first();
        if ((await el.count()) === 0) continue;
        const fg = await el.evaluate((node) => getComputedStyle(node).color);
        expect(contrast(fg, bg), `${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("Columns are staggered on desktop (not one straight row)", async ({ page }) => {
      const tiles = page.locator(".service-aspects").first().locator(".service-aspects__tile");
      const tops = await tiles.evaluateAll((els) =>
        els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().top))
      );
      // The first three tiles (the three columns) must sit at different heights.
      expect(new Set(tops).size).toBeGreaterThan(1);
    });

    test("Stacks to a single column with no stagger on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForTimeout(300);
      const grid = page.locator(".service-aspects__grid").first();
      const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
      expect(cols.split(" ").length).toBe(1);

      const transforms = await grid
        .locator(".service-aspects__tile")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
      for (const t of transforms) expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(t);
    });

    for (const width of [390, 320]) {
      test(`No horizontal overflow within the section at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(200);
        const overflow = await page.locator(".service-aspects").first().evaluate((sec) => {
          const vw = document.documentElement.clientWidth;
          let worst = 0;
          sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > vw) worst = Math.max(worst, r.right - vw);
            if (r.left < 0) worst = Math.max(worst, -r.left);
          });
          return worst;
        });
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }

    test("Captures desktop + mobile screenshot", async ({ page }) => {
      const slug = target.name.toLowerCase();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `qa-screenshots/service-aspects-${slug}-desktop.png`, fullPage: true });

      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForTimeout(300);
      await page.locator(".service-aspects").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `qa-screenshots/service-aspects-${slug}-mobile.png`, fullPage: true });
    });
  });
}
