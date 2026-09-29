import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/cta-compact.liquid – SYS §6 "CTA" (Plan S5c, E8 = A).
 * R1: the section lives on the home page and on /pages/leistungen.
 * Target: scheme-3176… (dark teal #1c4948), 1px line + eyebrow, h2 with
 * serif accent left, primary block button (light teal / ink) bottom-aligned
 * on the right, note underneath. No form, no images, no boxes.
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

const PAGES = [
  { name: "Home", path: QA.paths.home },
  { name: "Leistungen", path: QA.paths.leistungen },
];

for (const target of PAGES) {
  test.describe(`cta-compact section (${target.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(withTheme(target.path), { waitUntil: "load" });
      await passChallenge(page);
      await page.waitForSelector(".cta-compact", { timeout: 15_000 });
      await page.locator(".cta-compact").first().scrollIntoViewIfNeeded();
    });

    test("Line, eyebrow, h2 with one serif accent and lead render", async ({ page }) => {
      const section = page.locator(".cta-compact").first();
      await expect(section).toBeVisible();

      const rule = section.locator(".cta-compact__rule");
      const border = await rule.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { width: cs.borderTopWidth, style: cs.borderTopStyle };
      });
      expect(border).toEqual({ width: "1px", style: "solid" });
      await expect(rule.locator(".cta-compact__kicker.eyebrow")).toContainText("Kontakt");

      const heading = section.locator("h2.cta-compact__heading");
      await expect(heading).toContainText("Bereit für planbares");
      const accent = heading.locator("em.it");
      await expect(accent).toHaveCount(1);
      await expect(accent).toHaveText("Wachstum?");
      expect(await heading.textContent()).not.toContain("*");

      await expect(section.locator(".cta-compact__intro")).toBeVisible();
    });

    test("Dark teal surface from the teal scheme", async ({ page }) => {
      const section = page.locator(".cta-compact").first();
      await expect(section).toHaveClass(/\bcolor-scheme-3176272d-e560-4898-86e2-ed9090bb1264\b/);
      const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe("rgb(28, 73, 72)");
    });

    test("No form, no images, no boxes, shadows or gradients", async ({ page }) => {
      const section = page.locator(".cta-compact").first();
      await expect(section.locator("form, input, textarea, select, img")).toHaveCount(0);
      const offenders = await section.evaluate((root) => {
        const bad: string[] = [];
        const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
        for (const el of all) {
          for (const pseudo of [null, "::before", "::after"]) {
            const cs = getComputedStyle(el, pseudo);
            if (cs.boxShadow !== "none") bad.push(`${el.className}${pseudo ?? ""} box-shadow`);
            if (cs.backgroundImage.includes("gradient")) bad.push(`${el.className}${pseudo ?? ""} gradient`);
            const backdrop = cs.getPropertyValue("backdrop-filter") || "none";
            if (cs.filter !== "none" || backdrop !== "none") bad.push(`${el.className}${pseudo ?? ""} filter`);
          }
        }
        return bad;
      });
      expect(offenders).toEqual([]);
    });

    test("Primary block button to the contact page, light teal with ink text (≥ 4.5:1), note below", async ({ page }) => {
      const section = page.locator(".cta-compact").first();
      const btn = section.locator("a.btn.btn--primary.btn--block.cta-compact__btn");
      await expect(btn).toBeVisible();
      await expect(btn).toContainText("Jetzt anfragen");
      expect(await btn.getAttribute("href")).toMatch(/\/pages\/kontakt/);

      const colors = await btn.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color, h: el.getBoundingClientRect().height };
      });
      expect(colors.bg).toBe("rgb(158, 203, 208)");
      expect(colors.fg).toBe("rgb(5, 5, 5)");
      expect(contrast(colors.fg, colors.bg)).toBeGreaterThanOrEqual(4.5);
      expect(colors.h).toBeGreaterThanOrEqual(46); // --btn-h at 90 % content scale

      // Block button: fills its column.
      const actions = await section.locator(".cta-compact__actions").boundingBox();
      const btnBox = await btn.boundingBox();
      if (!actions || !btnBox) throw new Error("bbox null");
      expect(Math.abs(btnBox.width - actions.width)).toBeLessThanOrEqual(1);

      const note = section.locator(".cta-compact__note");
      await expect(note).toHaveText(/^(Kostenlos und unverbindlich\.|Free and without obligation\.)$/);
      const noteBox = await note.boundingBox();
      if (!noteBox) throw new Error("bbox null");
      expect(noteBox.y).toBeGreaterThanOrEqual(btnBox.y + btnBox.height);
    });

    test("Text on teal meets 4.5:1", async ({ page }) => {
      const section = page.locator(".cta-compact").first();
      const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
      for (const sel of [".cta-compact__kicker", ".cta-compact__heading", ".cta-compact__intro", ".cta-compact__note"]) {
        const fg = await section.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
        expect(contrast(fg, bg), `${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("Desktop 1280: text left (1–7), button column right, bottom-aligned", async ({ page }) => {
      const section = page.locator(".cta-compact").first();
      const text = await section.locator(".cta-compact__text").boundingBox();
      const actions = await section.locator(".cta-compact__actions").boundingBox();
      if (!text || !actions) throw new Error("bbox null");
      expect(actions.x).toBeGreaterThan(text.x + text.width);
      expect(Math.abs(actions.y + actions.height - (text.y + text.height))).toBeLessThanOrEqual(2);
    });

    test("Keyboard focus on the button is visible on teal (2px light-teal outline)", async ({ page }) => {
      const btn = page.locator(".cta-compact .cta-compact__btn").first();
      await btn.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(btn).toBeFocused();
      const outline = await btn.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
      });
      expect(outline.style).toBe("solid");
      expect(outline.width).toBe("2px");
      expect(outline.color).toBe("rgb(158, 203, 208)");
      // Outline colour vs. teal surface ≥ 3:1 (non-text contrast).
      expect(contrast(outline.color, "rgb(28, 73, 72)")).toBeGreaterThanOrEqual(3);
    });

    test("Mobile 390: one column, button full width", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
      const section = page.locator(".cta-compact").first();
      const cols = await section
        .locator(".cta-compact__grid")
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      expect(cols).toBe(1);
      const inner = section.locator(".cta-compact__inner");
      const innerBox = await inner.boundingBox();
      const pad = await inner.evaluate(
        (el) => parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight)
      );
      const btnBox = await section.locator(".cta-compact__btn").boundingBox();
      if (!innerBox || !btnBox) throw new Error("bbox null");
      expect(Math.abs(btnBox.width - (innerBox.width - pad))).toBeLessThanOrEqual(1);
    });

    for (const width of [390, 320]) {
      test(`No horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }

    test("Content width follows the page grid (≤ --page-max)", async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.waitForTimeout(200);
      const inner = page.locator(".cta-compact__inner").first();
      const { width, max } = await inner.evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        max: parseFloat(getComputedStyle(el).maxWidth),
      }));
      expect(max).toBeGreaterThan(0);
      expect(width).toBeLessThanOrEqual(max + 0.5);
    });
  });
}
