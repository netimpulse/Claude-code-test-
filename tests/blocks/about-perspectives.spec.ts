import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/about-perspectives.liquid – Über uns (Plan S7a).
 * R1: the section is not on the QA page; it runs on /pages/ueber-uns.
 * Target: section on scheme-sand, h2 via accent-heading; the feature card
 * sits on the black surface (class color-scheme-2, #0d0d0d – feature_bg /
 * feature_text emptied in the template, no more #0c1c24); perspective
 * cards with --r-lg, 1px line, no shadow; portrait 4:5 with the category on
 * top; a card without photo shows the monogram tile with "Foto folgt".
 * Four columns from 1101px, two on tablet, one on mobile; no horizontal
 * scroll at 390/320; contrast ≥ 4.5:1.
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
const INK = "rgb(13, 13, 13)";
const OLD_FEATURE_BG = "rgb(12, 28, 36)";

test.describe("About — Perspectives (S7a)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.ueberUns), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".about-perspectives", { timeout: 15_000 });
  });

  test("Head, feature card and three perspectives render", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveClass(/\bcolor-scheme-sand\b/);
    expect(await section.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(SAND_BG);

    const h2 = section.locator("h2.about-perspectives__heading");
    await expect(h2).toContainText("Drei Perspektiven");
    expect(await h2.textContent()).not.toContain("*");
    expect(await h2.locator("em.it").count()).toBeLessThanOrEqual(1);

    await expect(section.locator(".about-perspectives__feature")).toBeVisible();
    await expect(section.locator(".about-perspectives__feature-heading")).toContainText("anonyme");

    await expect(section.locator(".about-perspectives__card")).toHaveCount(3);
    await expect(section.locator(".about-perspectives__name").nth(0)).toHaveText("Niklas");
    await expect(section.locator(".about-perspectives__name").nth(1)).toHaveText("Luca");
    await expect(section.locator(".about-perspectives__name").nth(2)).toHaveText("Tom");
  });

  test("Feature card sits on the black surface (color-scheme-2), readable", async ({ page }) => {
    const feature = page.locator(".about-perspectives__feature").first();
    await expect(feature).toHaveClass(/\bcolor-scheme-2\b/);
    const c = await feature.evaluate((el) => {
      const q = (s: string) => el.querySelector(s)!;
      return {
        bg: getComputedStyle(el).backgroundColor,
        heading: getComputedStyle(q(".about-perspectives__feature-heading")).color,
        text: getComputedStyle(q(".about-perspectives__feature-text")).color,
        kicker: getComputedStyle(q(".about-perspectives__feature-kicker")).color,
        radius: getComputedStyle(el).borderTopLeftRadius,
      };
    });
    expect(c.bg).toBe(INK);
    expect(c.bg).not.toBe(OLD_FEATURE_BG);
    for (const fg of [c.heading, c.text, c.kicker]) expect(contrast(fg, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(c.radius).toBe("16px");
    // Line breaks of the stored text survive (escaped + newline_to_br).
    expect(await feature.locator(".about-perspectives__feature-text br").count()).toBeGreaterThan(0);
  });

  test("Category tag on every portrait", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    const cats = section.locator(".about-perspectives__media .about-perspectives__category");
    await expect(cats).toHaveCount(3);
    await expect(cats.nth(0)).toHaveText(/Founder/i);
    await expect(cats.nth(2)).toHaveText(/CEO/i);
    const c = await cats.first().evaluate((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("Portraits 4:5 – photo cards and a monogram tile for the card without photo", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator(".about-perspectives__card--has-photo")).toHaveCount(2);
    await expect(section.locator("img.about-perspectives__photo")).toHaveCount(2);
    const empty = section.locator(".about-perspectives__card--no-photo");
    await expect(empty).toHaveCount(1);
    await expect(empty.locator(".about-perspectives__initial")).toHaveText("T");
    await expect(empty.locator(".about-perspectives__pending")).toHaveText(/Foto folgt/i);
    expect(await empty.locator(".about-perspectives__monogram").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(INK);

    const ratios = await section.locator(".about-perspectives__media").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.height / r.width;
      })
    );
    for (const r of ratios) expect(r).toBeCloseTo(1.25, 1);
  });

  test("Clean design — no letter avatars, no per-name numbers, no numbered list in feature card", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    await expect(section.locator(".about-perspectives__avatar")).toHaveCount(0);
    await expect(section.locator(".about-perspectives__number")).toHaveCount(0);
    await expect(section.locator(".about-perspectives__feature-list")).toHaveCount(0);
    const text = (await section.locator(".about-perspectives__card").first().innerText()).trim();
    expect(text).not.toMatch(/\b0[123]\b/);
  });

  test("Cards: --r-lg, 1px line, no shadows, gradients or blur", async ({ page }) => {
    const section = page.locator(".about-perspectives").first();
    const cards = await section.locator(".about-perspectives__card").evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return { radius: cs.borderTopLeftRadius, border: cs.borderTopWidth };
      })
    );
    for (const c of cards) {
      expect(c.radius).toBe("16px");
      expect(c.border).toBe("1px");
    }
    const bad = await section.evaluate((root) => {
      const out: string[] = [];
      for (const el of [root, ...Array.from(root.querySelectorAll<Element>("*"))]) {
        for (const pseudo of [null, "::before", "::after"]) {
          const cs = getComputedStyle(el, pseudo);
          const name = `${el.getAttribute("class") ?? el.tagName}${pseudo ?? ""}`;
          if (cs.boxShadow !== "none") out.push(`${name} box-shadow`);
          if (cs.backgroundImage.includes("gradient")) out.push(`${name} gradient`);
          const backdrop = cs.getPropertyValue("backdrop-filter") || "none";
          if (cs.filter !== "none" || backdrop !== "none") out.push(`${name} filter`);
        }
      }
      return out;
    });
    expect(bad).toEqual([]);
  });

  test("Body copy meets 4.5:1 on the card surface", async ({ page }) => {
    const pairs = await page.locator(".about-perspectives__card").evaluateAll((els) =>
      els.flatMap((card) => {
        const bg = getComputedStyle(card).backgroundColor;
        return Array.from(card.querySelectorAll(".about-perspectives__name, .about-perspectives__role, .about-perspectives__text")).map(
          (el) => ({ fg: getComputedStyle(el).color, bg })
        );
      })
    );
    expect(pairs.length).toBeGreaterThanOrEqual(9);
    for (const p of pairs) expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("Desktop: feature + three perspectives in one row of four columns", async ({ page }) => {
    const cols = await page.locator(".about-perspectives__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(4);
  });

  test("Stacks to a single column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1100 });
    await page.waitForTimeout(200);
    const cols = await page.locator(".about-perspectives__grid").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(cols.split(" ").length).toBe(1);
  });

  for (const width of [390, 320]) {
    test(`No horizontal overflow inside the section at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const overflow = await page.locator(".about-perspectives").first().evaluate((sec) => {
        const vw = document.documentElement.clientWidth;
        let worst = 0;
        sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const right = el.getBoundingClientRect().right;
          if (right > vw) worst = Math.max(worst, right - vw);
        });
        return worst;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1100 });
    await page.waitForTimeout(300);
    await page.locator(".about-perspectives").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/about-perspectives-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 1100 });
    await page.waitForTimeout(300);
    await page.locator(".about-perspectives").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-screenshots/about-perspectives-mobile.png", fullPage: true });
  });
});
