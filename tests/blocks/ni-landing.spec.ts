import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Tests for the NetImpulse landing sections (sections/ni-hero, ni-intro,
 * ni-deck) on the real home page (plan rule R1: the sections are not part
 * of the QA block page). Hero on scheme-sand, intro on scheme-2 (black).
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("NetImpulse landing blocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero", { timeout: 15_000 });
  });

  test("Hero renders the h1 with serif accent, two CTAs and a figcaption", async ({ page }) => {
    const hero = page.locator("ni-hero").first();
    const title = hero.locator("h1.ni-hero__title");
    await expect(title).toHaveCount(1);
    await expect(title).toContainText("Online-Präsenz für dein Unternehmen");
    await expect(title.locator("em.it")).toHaveText("dein");
    expect(await title.textContent()).not.toContain("*");
    await expect(page.locator("h1")).toHaveCount(1);

    await expect(hero.locator("a.btn.btn--primary.ni-btn--primary")).toContainText("Kostenloses Erstgespräch");
    await expect(hero.locator("a.btn.btn--secondary.ni-btn--ghost")).toBeVisible();
    await expect(hero.locator("figure.ni-hero__media figcaption")).toContainText("NetImpulse-Prinzip");
    // Figcaption instead of the overlay caption and the floating tag
    await expect(hero.locator(".ni-hero__caption")).toHaveCount(0);
    await expect(hero.locator(".ni-hero__book")).toHaveCount(0);
  });

  test("Hero fits the first screen at 1280x800 with the photo right of the h1", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const box = await page.locator("ni-hero").first().evaluate((el) => {
      const r = (sel: string) => {
        const node = el.querySelector(sel);
        if (!node) throw new Error(`missing ${sel}`);
        const b = node.getBoundingClientRect();
        return { left: b.left, right: b.right, bottom: b.bottom };
      };
      return {
        scrollY: window.scrollY,
        actions: r(".ni-hero__actions"),
        photo: r(".ni-hero__photo"),
        caption: r("figcaption"),
        h1: r("h1"),
      };
    });
    expect(box.scrollY).toBe(0);
    expect(box.actions.bottom).toBeLessThanOrEqual(800);
    expect(box.photo.bottom).toBeLessThanOrEqual(800);
    expect(box.caption.bottom).toBeLessThanOrEqual(800);
    expect(box.photo.left).toBeGreaterThan(box.h1.right - 1);
  });

  test("Hero has no animations, no pulse, no reveal; LCP image loads eagerly", async ({ page }) => {
    await page.waitForTimeout(1000);
    const hero = page.locator("ni-hero").first();
    const running = await hero.evaluate((el) => el.getAnimations({ subtree: true }).length);
    expect(running).toBe(0);
    await expect(hero.locator(".ni-pulse")).toHaveCount(0);
    await expect(hero.locator(".ni-reveal")).toHaveCount(0);
    const img = hero.locator("img.ni-hero__img");
    await expect(img).toHaveAttribute("fetchpriority", "high");
    expect(await img.getAttribute("loading")).not.toBe("lazy");
  });

  test("Intro renders the accent heading, principles 01-03 and the image panel on scheme-2", async ({ page }) => {
    const intro = page.locator("ni-intro").first();
    const title = intro.locator("h2.ni-intro__title");
    await expect(title).toContainText("Ein Studio für digitale Auftritte mit System.");
    await expect(title.locator("em.it")).toHaveText("mit System.");
    await expect(intro.locator(".ni-intro-card")).toHaveCount(3);
    await expect(intro.locator(".ni-intro-card__num")).toHaveText(["01", "02", "03"]);
    await expect(intro.locator(".ni-intro-card h3")).toHaveCount(3);
    await expect(intro.locator(".ni-reveal")).toHaveCount(0);
    await expect(intro.locator(".ni-intro__panel")).toBeVisible();
    await expect(intro.locator(".ni-intro__panel-copy h3")).toContainText("laufenden Optimierung");
    // scheme-2 background (#0d0d0d)
    const bg = await intro.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(13, 13, 13)");
    // Principles sit side by side on desktop (three columns)
    const tops = await intro.locator(".ni-intro-card").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
    expect(new Set(tops).size).toBe(1);
  });

  test("Hero stacks in one column at 390px with full-width buttons and no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const layout = await page.locator("ni-hero").first().evaluate((el) => {
      const rect = (sel: string) => el.querySelector(sel)!.getBoundingClientRect();
      return {
        photoTop: rect(".ni-hero__photo").top,
        actionsBottom: rect(".ni-hero__actions").bottom,
        btnWidth: rect(".ni-hero__actions .btn").width,
        actionsWidth: rect(".ni-hero__actions").width,
      };
    });
    expect(layout.photoTop).toBeGreaterThan(layout.actionsBottom - 1);
    expect(Math.abs(layout.btnWidth - layout.actionsWidth)).toBeLessThan(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test("No horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    for (const sel of ["ni-hero", "ni-intro", "ni-deck"]) {
      const el = page.locator(sel).first();
      const overflow = await el.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
      expect(overflow, `${sel} overflow`).toBe(false);
    }
  });

  test("Captures NI block screenshots (desktop + mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.waitForTimeout(500);
    await page.locator("ni-hero").first().scrollIntoViewIfNeeded();
    await page.locator("ni-hero").first().screenshot({ path: "qa-screenshots/ni-hero-desktop.png" });
    await page.locator("ni-intro").first().scrollIntoViewIfNeeded();
    await page.locator("ni-intro").first().screenshot({ path: "qa-screenshots/ni-intro-desktop.png" });
    await page.locator(".ni-deck-card").nth(3).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.locator("ni-deck").first().screenshot({ path: "qa-screenshots/ni-deck-desktop.png" });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await page.locator("ni-hero").first().scrollIntoViewIfNeeded();
    await page.locator("ni-hero").first().screenshot({ path: "qa-screenshots/ni-hero-mobile.png" });
  });
});

/**
 * ni-deck (S5b1/S5b2) on the real homepage (R1: the QA block page has no
 * ni-deck). Sticky stacking only from 1101×760, static below.
 */
test.describe("NetImpulse deck (home)", () => {
  async function openHome(page: import("@playwright/test").Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-deck .ni-deck-card", { timeout: 15_000 });
    return page.locator("ni-deck").first();
  }
  const position = (el: Element) => getComputedStyle(el).position;

  test("Deck renders five sticky slabs incl. one dark and one teal (1280×900)", async ({ page }) => {
    const deck = await openHome(page, 1280, 900);
    await expect(deck.locator(".ni-deck-card")).toHaveCount(5);
    await expect(deck.locator(".ni-deck-card--dark")).toHaveCount(1);
    await expect(deck.locator(".ni-deck-card--teal")).toHaveCount(1);
    expect(await deck.locator(".ni-deck-card").first().evaluate(position)).toBe("sticky");
  });

  test("Deck slabs stack: first slab sticks near the top when scrolled (1280×900)", async ({ page }) => {
    const deck = await openHome(page, 1280, 900);
    const first = deck.locator(".ni-deck-card").nth(0);
    const second = deck.locator(".ni-deck-card").nth(1);
    await second.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const firstTop = await first.evaluate((el) => el.getBoundingClientRect().top);
    // sticky top = header height + 16px
    expect(firstTop).toBeLessThan(120);
  });

  for (const [w, h] of [[1280, 720], [390, 844]] as const) {
    test(`Deck slabs are static below the sticky breakpoint (${w}×${h})`, async ({ page }) => {
      const deck = await openHome(page, w, h);
      const positions = await deck.locator(".ni-deck-card").evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).position)
      );
      expect(positions.length).toBe(5);
      for (const p of positions) expect(p).toBe("static");
    });
  }

  test("Deck heading, arrows, tags and graphics (1280×900)", async ({ page }) => {
    const deck = await openHome(page, 1280, 900);
    await expect(deck.locator("h2.ni-deck__title em.it")).toHaveCount(1);
    await expect(deck.locator(".ni-deck-card h3")).toHaveCount(5);
    const arrows = deck.locator(".ni-deck-card__link");
    await expect(arrows).toHaveCount(5);
    for (const label of await arrows.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""))) {
      expect(label.trim().length).toBeGreaterThan(3);
    }
    const box = await arrows.first().boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(56);
    const pillRadius = await deck.locator(".ni-deck-card__tags li").first().evaluate(
      (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius)
    );
    expect(pillRadius).toBeGreaterThan(100);
    await expect(deck.locator(".ni-deck-card__visual [aria-hidden='true']")).toHaveCount(5);
    await expect(deck.locator(".ni-device")).toHaveCount(0);
    for (const cls of ["search", "campaign", "social", "web", "shop"]) {
      await expect(deck.locator(`.ni-deck-g--${cls}`)).toHaveCount(1);
    }
    // no shadows or gradients on slabs
    const styles = await deck.locator(".ni-deck-card").evaluateAll((els) =>
      els.map((el) => [getComputedStyle(el).boxShadow, getComputedStyle(el).backgroundImage])
    );
    for (const [shadow, image] of styles) {
      expect(shadow).toBe("none");
      expect(image).toBe("none");
    }
  });

  test("Deck text contrast ≥ 4.5:1 on all slab tones (1280×900)", async ({ page }) => {
    const deck = await openHome(page, 1280, 900);
    const ratios = await deck.locator(".ni-deck-card").evaluateAll((els) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (c: string) => {
        const [r, g, b] = rgb(c).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: string, b: string) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
      };
      return els.flatMap((card) => {
        const bg = getComputedStyle(card).backgroundColor;
        return [".ni-deck-card__title", ".ni-deck-card__text", ".ni-deck-card__number", ".ni-deck-card__tags li"]
          .map((sel) => card.querySelector(sel))
          .filter((el): el is Element => el !== null)
          .map((el) => ({ cls: card.className, sel: el.className || el.tagName, r: ratio(getComputedStyle(el).color, bg) }));
      });
    });
    for (const { cls, sel, r } of ratios) expect(r, `${cls} ${sel}`).toBeGreaterThanOrEqual(4.5);
  });

  test("Deck has no horizontal overflow at 390px", async ({ page }) => {
    const deck = await openHome(page, 390, 844);
    const overflow = await deck.evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    expect(overflow).toBe(false);
    const docOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(docOverflow).toBe(false);
  });
});
