import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/theme-store-preview.liquid in the design system, on the real home page
 * (index.json, between the service slabs "ni-deck" and the team row).
 * Target: light surface (scheme-sand #f8f6f1), eyebrow + h2 with exactly one serif
 * accent (<em class="it">, never tinted), muted intro. Theme cards: flat, 1px line,
 * 16px radius, no shadow, no lift; image area 4:3 with 12px radius; name in
 * Bricolage 500 + price, category muted, tags as pills. Store CTA: dark slab
 * (--c-ink, text --c-surface, 16px radius) with the primary button in its dark
 * variant (light teal), outside the scroller. Theme blocks without a product are
 * hidden in the storefront (placeholder only in the theme editor).
 */
const SEL = "[data-section-type='theme-store-preview']";

async function passChallenge(page: Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

async function openHome(page: Page, width = 1280, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
  await passChallenge(page);
  await page.waitForSelector(SEL, { timeout: 15_000 });
  await page.locator(SEL).first().scrollIntoViewIfNeeded();
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

test.describe("Theme Store Preview – home page", () => {
  test.beforeEach(async ({ page }) => {
    await openHome(page);
  });

  test("Sits between the service slabs and the team row on a light surface", async ({ page }) => {
    const order = await page.evaluate((sel) => {
      const all = Array.from(document.querySelectorAll(".ni-deck, " + sel + ", .team-compact"));
      return all.map((el) => (el.matches(sel) ? "tsp" : el.classList.contains("ni-deck") ? "deck" : "team"));
    }, SEL);
    const i = order.indexOf("tsp");
    expect(i).toBeGreaterThan(-1);
    expect(order[i - 1]).toBe("deck");
    expect(order[i + 1]).toBe("team");

    const root = page.locator(SEL).first();
    await expect(root).toHaveClass(/\bcolor-scheme-sand\b/);
    expect(await root.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(248, 246, 241)");
  });

  test("Head: eyebrow, h2 with exactly one untinted serif accent, muted intro", async ({ page }) => {
    const root = page.locator(SEL).first();
    await expect(root.locator(".tsp__kicker.eyebrow")).toBeVisible();

    const heading = root.locator("h2.tsp__heading");
    await expect(heading).toBeVisible();
    expect(await heading.textContent()).not.toContain("*");
    const accent = heading.locator("em.it");
    await expect(accent).toHaveCount(1);
    await expect(root.locator(".tsp__heading-accent")).toHaveCount(0);
    const colors = await accent.evaluate((el) => ({
      em: getComputedStyle(el).color,
      h2: getComputedStyle(el.parentElement as HTMLElement).color,
      family: getComputedStyle(el).fontFamily,
      style: getComputedStyle(el).fontStyle,
    }));
    expect(colors.em).toBe(colors.h2);
    expect(colors.family).toMatch(/Newsreader/);
    expect(colors.style).toBe("italic");

    const h2Family = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h2Family).toMatch(/Bricolage Grotesque/);

    const sub = root.locator(".tsp__subheading");
    await expect(sub).toBeVisible();
    expect(await sub.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(87, 82, 74)");
  });

  test("No empty product placeholder in the storefront", async ({ page }) => {
    const root = page.locator(SEL).first();
    await expect(root.locator(".tsp__card--placeholder")).toHaveCount(0);
    await expect(root.locator(".tsp__empty")).toHaveCount(0);
    const text = (await root.textContent()) ?? "";
    expect(text).not.toMatch(/Select a theme product|Theme-Produkt auswählen/);
    // Every rendered theme card links to a real product.
    const hrefs = await root.locator(".tsp__card--theme").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    for (const href of hrefs) expect(href).toMatch(/\/products\//);
  });

  test("Theme cards: flat, 1px line, 16px radius, 4:3 image area, Bricolage 500 name, price, pills", async ({ page }) => {
    const root = page.locator(SEL).first();
    const cards = root.locator(".tsp__card--theme");
    const count = await cards.count();
    expect(count, "at least one theme card with an existing product").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const s = await card.evaluate((el) => {
        const cs = getComputedStyle(el);
        const prev = el.querySelector<HTMLElement>(".tsp__preview")!;
        const pr = prev.getBoundingClientRect();
        return {
          bg: cs.backgroundColor,
          border: cs.borderTopWidth,
          radius: cs.borderTopLeftRadius,
          shadow: cs.boxShadow,
          bgImage: cs.backgroundImage,
          ratio: pr.width / pr.height,
          prevRadius: getComputedStyle(prev).borderTopLeftRadius,
        };
      });
      expect(s.bg).not.toBe("rgba(0, 0, 0, 0)");
      expect(s.border, `card ${i} border`).toBe("1px");
      expect(s.radius, `card ${i} radius`).toBe("14.4px");
      expect(s.shadow, `card ${i} shadow`).toBe("none");
      expect(s.bgImage).not.toContain("gradient");
      expect(s.ratio, `card ${i} preview ratio`).toBeGreaterThan(4 / 3 - 0.02);
      expect(s.ratio, `card ${i} preview ratio`).toBeLessThan(4 / 3 + 0.02);
      expect(s.prevRadius, `card ${i} preview radius`).toBe("10.4px");

      const name = await card.locator(".tsp__name").evaluate((el) => ({
        family: getComputedStyle(el).fontFamily,
        weight: getComputedStyle(el).fontWeight,
        text: (el.textContent ?? "").trim(),
      }));
      expect(name.family).toMatch(/Bricolage Grotesque/);
      expect(name.weight).toBe("500");
      expect(name.text.length).toBeGreaterThan(0);
      await expect(card.locator(".tsp__price")).toHaveText(/\d/);

      const tags = card.locator(".tsp__tag");
      for (let t = 0; t < (await tags.count()); t++) {
        const pill = await tags.nth(t).evaluate((el) => ({
          radius: parseFloat(getComputedStyle(el).borderTopLeftRadius),
          border: getComputedStyle(el).borderTopWidth,
        }));
        expect(pill.radius).toBeGreaterThanOrEqual(100);
        expect(pill.border).toBe("1px");
      }
    }
  });

  test("Cards do not lift or cast a shadow on hover", async ({ page }) => {
    const card = page.locator(`${SEL} .tsp__card--theme`).first();
    test.skip((await card.count()) === 0, "No theme card rendered");
    await card.hover();
    await page.waitForTimeout(400);
    const s = await card.evaluate((el) => ({ t: getComputedStyle(el).transform, sh: getComputedStyle(el).boxShadow }));
    expect(s.t).toBe("none");
    expect(s.sh).toBe("none");
  });

  test("Text on cards and in the head meets 4.5:1", async ({ page }) => {
    const root = page.locator(SEL).first();
    const sectionBg = await root.evaluate((el) => getComputedStyle(el).backgroundColor);
    for (const sel of [".tsp__kicker", ".tsp__heading", ".tsp__subheading"]) {
      const fg = await root.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
      expect(contrast(fg, sectionBg), `${sel}`).toBeGreaterThanOrEqual(4.5);
    }
    const card = root.locator(".tsp__card--theme").first();
    if ((await card.count()) === 0) return;
    const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    for (const sel of [".tsp__name", ".tsp__price", ".tsp__category", ".tsp__tag"]) {
      const el = card.locator(sel).first();
      if ((await el.count()) === 0) continue;
      const fg = await el.evaluate((n) => getComputedStyle(n).color);
      expect(contrast(fg, cardBg), `${sel} ${fg} on ${cardBg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("Store CTA is a dark slab with the light-teal primary button", async ({ page }) => {
    const root = page.locator(SEL).first();
    const cta = root.locator(".tsp__store .tsp__card--cta");
    await expect(cta).toHaveCount(1);
    await expect(root.locator("[data-tsp-track] .tsp__card--cta")).toHaveCount(0);

    const slab = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, bgImage: cs.backgroundImage };
    });
    expect(slab.bg).toBe("rgb(13, 13, 13)");
    expect(slab.fg).toBe("rgb(255, 253, 248)");
    expect(slab.radius).toBe("14.4px");
    expect(slab.shadow).toBe("none");
    expect(slab.bgImage).not.toContain("gradient");

    const heading = cta.locator(".tsp__cta-heading");
    await expect(heading).toHaveText(/Alle Themes und Packs ansehen/);
    const hColor = await heading.evaluate((el) => getComputedStyle(el).color);
    expect(contrast(hColor, slab.bg)).toBeGreaterThanOrEqual(4.5);
    const label = cta.locator(".tsp__cta-label");
    if ((await label.count()) > 0) {
      const lColor = await label.evaluate((el) => getComputedStyle(el).color);
      expect(contrast(lColor, slab.bg)).toBeGreaterThanOrEqual(4.5);
    }

    const btn = cta.locator("a.btn.btn--primary.tsp__cta-btn");
    await expect(btn).toContainText("Zum Store");
    expect(await btn.getAttribute("href")).toBeTruthy();
    const b = await btn.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
    expect(b.bg).toBe("rgb(158, 203, 208)");
    expect(contrast(b.fg, b.bg)).toBeGreaterThanOrEqual(4.5);

    // Visible keyboard focus in the dark variant (2px light teal).
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
  });

  test("Keyboard focus on a theme card is visible and not clipped", async ({ page }) => {
    const card = page.locator(`${SEL} .tsp__card--theme`).first();
    test.skip((await card.count()) === 0, "No theme card rendered");
    await card.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(card).toBeFocused();
    const s = await card.evaluate((el) => {
      const cs = getComputedStyle(el);
      const track = el.closest("[data-tsp-track]") as HTMLElement;
      const pad = parseFloat(getComputedStyle(track).paddingLeft);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), offset: parseFloat(cs.outlineOffset), pad };
    });
    expect(s.style).toBe("solid");
    expect(s.width).toBe(2);
    expect(s.pad).toBeGreaterThanOrEqual(s.width + s.offset);
  });

  test("Store CTA stays fixed while the themes scroll (mobile)", async ({ page }) => {
    await openHome(page, 390, 844);
    const root = page.locator(SEL).first();
    const cards = await root.locator(".tsp__card--theme").count();
    test.skip(cards < 2, "Needs two or more theme cards to overflow");
    const track = root.locator("[data-tsp-track]");
    const cta = root.locator(".tsp__card--cta");
    const ctaXBefore = (await cta.boundingBox())!.x;
    const scrollBefore = await track.evaluate((el) => el.scrollLeft);
    await track.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await page.waitForTimeout(250);
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(scrollBefore);
    expect(Math.abs((await cta.boundingBox())!.x - ctaXBefore)).toBeLessThan(2);
  });

  test("Themes scroll via arrow and pointer drag when they overflow", async ({ page }) => {
    await openHome(page, 500, 800);
    const root = page.locator(SEL).first();
    const cards = await root.locator(".tsp__card--theme").count();
    test.skip(cards < 2, "Needs two or more theme cards to overflow");
    const track = root.locator("[data-tsp-track]");
    const next = root.locator("[data-tsp-next]");
    await expect(next).toBeVisible();
    const radius = await next.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(radius).toBe("50%");

    const start = await track.evaluate((el) => el.scrollLeft);
    await next.click();
    await page.waitForTimeout(450);
    const afterArrow = await track.evaluate((el) => el.scrollLeft);
    expect(afterArrow).toBeGreaterThan(start);

    const box = await track.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 60, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 60, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
    expect(await track.evaluate((el) => el.scrollLeft)).toBeLessThan(afterArrow);
  });

  for (const width of [390, 320]) {
    test(`No horizontal page overflow at ${width}px`, async ({ page }) => {
      await openHome(page, width, 800);
      const root = page.locator(SEL).first();
      expect(await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(false);
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    const root = page.locator(SEL).first();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await root.scrollIntoViewIfNeeded();
    await root.screenshot({ path: "qa-screenshots/theme-store-preview-desktop.png" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await root.scrollIntoViewIfNeeded();
    await root.screenshot({ path: "qa-screenshots/theme-store-preview-mobile.png" });
  });
});
