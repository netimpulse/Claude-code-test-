import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/addon-services.liquid (Plan S6b).
 * Block behaviour (cards, prices, highlight, button toggle) runs on the QA
 * page, where the section is seeded; the design target runs on the real
 * page /pages/leistungen (scheme-sand, cleared accent colour).
 */
async function passChallenge(page: import("@playwright/test").Page) {
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

test.describe("addon-services section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".addon-services", { timeout: 15_000 });
  });

  test("section + heading + subheading rendern", async ({ page }) => {
    const section = page.locator(".addon-services").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".addon-services__heading")).toContainText("Zusatzleistungen");
    await expect(section.locator(".addon-services__subheading")).toBeVisible();
  });

  test("drei Karten werden gerendert", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator(".addon-services__card-title")).toContainText("Theme Setup");
    await expect(cards.nth(1).locator(".addon-services__card-title")).toContainText("Bestehendes Theme");
    await expect(cards.nth(2).locator(".addon-services__card-title")).toContainText("Custom Theme");
  });

  test("Preise: Karte 1 hat 'ab 200', Karten 2+3 'Preis auf Anfrage'", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(0).locator(".addon-services__price")).toContainText("200");
    await expect(cards.nth(1).locator(".addon-services__price")).toContainText("Preis auf Anfrage");
    await expect(cards.nth(2).locator(".addon-services__price")).toContainText("Preis auf Anfrage");
  });

  test("nur die mittlere Karte ist hervorgehoben (Badge BELIEBT)", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(0)).not.toHaveClass(/is-highlighted/);
    await expect(cards.nth(1)).toHaveClass(/is-highlighted/);
    await expect(cards.nth(2)).not.toHaveClass(/is-highlighted/);

    await expect(cards.nth(1).locator(".addon-services__badge")).toContainText("BELIEBT");
    await expect(cards.nth(0).locator(".addon-services__badge")).toHaveCount(0);
    await expect(cards.nth(2).locator(".addon-services__badge")).toHaveCount(0);
  });

  test("Show/Hide-Button-Toggle wirkt: Karten 1+2 zeigen Button, Karte 3 nicht", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(0).locator(".addon-services__btn")).toBeVisible();
    await expect(cards.nth(1).locator(".addon-services__btn")).toBeVisible();
    await expect(cards.nth(2).locator(".addon-services__btn")).toHaveCount(0);
  });

  test("hervorgehobene Karte hat Primary-Button-Klasse", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards.nth(1).locator(".addon-services__btn")).toHaveClass(/addon-services__btn--primary/);
    await expect(cards.nth(1).locator(".addon-services__btn")).toHaveClass(/\bbtn--primary\b/);
    await expect(cards.nth(0).locator(".addon-services__btn")).not.toHaveClass(/addon-services__btn--primary/);
    await expect(cards.nth(0).locator(".addon-services__btn")).toHaveClass(/\bbtn--secondary\b/);
  });

  test("Feature-Listen rendern mit Checkmark-Icons", async ({ page }) => {
    const card1 = page.locator(".addon-services__card").nth(0);
    const features = card1.locator(".addon-services__feature");
    await expect(features).toHaveCount(4);
    await expect(card1.locator(".addon-services__feature-icon").first()).toBeVisible();
  });

  test("kein Monatlich/Jährlich-Toggle vorhanden", async ({ page }) => {
    const section = page.locator(".addon-services").first();
    await expect(section.locator("text=Monatlich")).toHaveCount(0);
    await expect(section.locator("text=Jährlich")).toHaveCount(0);
  });

  test("section bleibt bei 320px Viewport ohne horizontalen Scroll", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1400 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("Desktop: Karten liegen nebeneinander (3-Spalten-Grid)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    const cards = page.locator(".addon-services__card");
    const tops = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    // Alle drei Karten teilen sich (innerhalb 5px) die gleiche Top-Position
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(5);
  });
});

test.describe("addon-services section – Designsoll (Leistungen)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.leistungen), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".addon-services", { timeout: 15_000 });
    await page.locator(".addon-services").first().scrollIntoViewIfNeeded();
  });

  test("Sand scheme surface, h2 in --text-h2, heading without stray asterisks", async ({ page }) => {
    const section = page.locator(".addon-services").first();
    await expect(section).toHaveClass(/\bcolor-scheme-sand\b/);
    expect(await section.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(248, 246, 241)");
    const heading = section.locator("h2.addon-services__heading");
    await expect(heading).toContainText("Zusatzleistungen");
    expect(await heading.textContent()).not.toContain("*");
    const sizes = await heading.evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.fontSize = "var(--text-h2)";
      el.parentElement!.appendChild(probe);
      const expected = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return { actual: parseFloat(getComputedStyle(el).fontSize), expected };
    });
    expect(Math.abs(sizes.actual - sizes.expected)).toBeLessThanOrEqual(0.5);
  });

  test("Cards: surface, 1px line, radius 16px, no shadow, gradient or hover lift", async ({ page }) => {
    const cards = page.locator(".addon-services__card");
    await expect(cards).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const cs = await cards.nth(i).evaluate((el) => {
        const s = getComputedStyle(el);
        return { bw: s.borderTopWidth, r: s.borderTopLeftRadius, bg: s.backgroundColor, sh: s.boxShadow };
      });
      expect(cs).toEqual({ bw: "1px", r: "16px", bg: "rgb(255, 253, 248)", sh: "none" });
    }
    await cards.nth(0).hover();
    await page.waitForTimeout(400);
    const after = await cards.nth(0).evaluate((el) => ({
      t: getComputedStyle(el).transform,
      sh: getComputedStyle(el).boxShadow,
    }));
    expect(after).toEqual({ t: "none", sh: "none" });

    const offenders = await page.locator(".addon-services").first().evaluate((root) => {
      const bad: string[] = [];
      for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
        for (const pseudo of [null, "::before", "::after"]) {
          const cs = getComputedStyle(el, pseudo);
          if (cs.boxShadow !== "none") bad.push(`${el.className} box-shadow`);
          if (cs.backgroundImage.includes("gradient")) bad.push(`${el.className} gradient`);
        }
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test("Highlight: teal border, badge and primary button from the scheme roles (≥ 4.5:1)", async ({ page }) => {
    const card = page.locator(".addon-services__card.is-highlighted").first();
    expect(await card.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe("rgb(28, 73, 72)");

    const badge = await card.locator(".addon-services__badge").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color };
    });
    expect(contrast(badge.fg, badge.bg)).toBeGreaterThanOrEqual(4.5);

    const btn = card.locator("a.btn.btn--primary.addon-services__btn");
    const c = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color, h: el.getBoundingClientRect().height };
    });
    expect(c.bg).toBe("rgb(28, 73, 72)");
    expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(c.h).toBeGreaterThanOrEqual(51);
  });

  test("Buttons without a link go to the contact page, never to #", async ({ page }) => {
    const section = page.locator(".addon-services").first();
    await expect(section.locator('a[href="#"]')).toHaveCount(0);
    const hrefs = await section.locator("a.addon-services__btn").evaluateAll((els) =>
      els.map((el) => el.getAttribute("href") || "")
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/\/pages\/kontakt/);
  });

  test("Keyboard focus on a card button is visible (2px teal outline)", async ({ page }) => {
    const btn = page.locator(".addon-services .addon-services__btn").first();
    await btn.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(btn).toBeFocused();
    const outline = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
    });
    expect(outline).toEqual({ style: "solid", width: "2px", color: "rgb(28, 73, 72)" });
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
});
