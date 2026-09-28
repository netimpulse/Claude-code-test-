import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Blog index (sections/blog.liquid) and article page (sections/article.liquid),
 * plan S7c – design system target:
 *  - scheme tokens (scheme-sand = light), exactly one h1 in Bricolage Grotesque;
 *  - blog and related cards: --color-surface, 1px --color-line, --r-lg (16px),
 *    no shadow; no gradients, blur or endless animations anywhere in the section;
 *  - article header without overlay, photo with --r-lg; reading type in .rte
 *    (--text-body 17px, line-height 1.7, max ~68ch, h2/h3 Bricolage, links underlined);
 *  - pull quotes on the surface card (quote_* empty = design system);
 *  - newsletter/CTA button = scheme primary button (teal, surface text, ≥ 4.5:1);
 *  - fixed UI texts from the active locale file (du form in de.json);
 *  - dates via the locale-aware `format: 'date'`: German month name under DE,
 *    English under /en (only once English is published, see language-switcher.spec);
 *  - 390/320 without horizontal scroll, visible focus.
 *
 * The article test uses the first article of QA.paths.blog and skips itself when
 * the blog is empty.
 */

const SURFACE = "rgb(255, 253, 248)";
const LINE = "rgb(214, 204, 187)";
const TEAL = "rgb(28, 73, 72)";
const OLD_QUOTE_BG = "rgb(236, 228, 207)";

const DE_MONTH =
  /\b(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mär|Apr|Jun|Jul|Aug|Sep|Sept|Okt|Nov|Dez)\b/;
/** Month names that only exist in English (Apr/Aug/… are ambiguous). */
const EN_ONLY_MONTH = /\b(January|February|March|May|June|July|October|December|Mar|Oct|Dec)\b/;
const EN_MONTH =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/;
const DE_ONLY_MONTH = /\b(Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember|Mär|Okt|Dez)\b/;
/** The old stored strftime pattern "%b %d, %Y" (e.g. "Sep 12, 2026"). */
const OLD_EN_PATTERN = /^[A-Z][a-z]{2} \d{2}, \d{4}$/;

function localeValue(file: string, key: string): string {
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "locales", file), "utf8");
  const json = JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ""));
  return key.split(".").reduce((o: any, k) => o[k], json);
}

async function passChallenge(page: Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

// Previewing an unpublished theme on the blog route loops if the
// preview_theme_id cookie isn't primed first; visiting the themed home
// page once sets the cookie so plain paths render the preview theme.
async function primePreview(page: Page) {
  await page.goto(withTheme("/"), { waitUntil: "domcontentloaded" });
  await passChallenge(page);
}

async function openBlog(page: Page, prefix = "") {
  await primePreview(page);
  const resp = await page.goto(`${prefix}${QA.paths.blog}`, { waitUntil: "load" });
  await passChallenge(page);
  return resp;
}

/** Opens the first article of the blog; returns false when the blog is empty. */
async function openFirstArticle(page: Page, prefix = ""): Promise<boolean> {
  await openBlog(page, prefix);
  if ((await page.locator(".blog-card").count()) === 0) return false;
  const href = await page.locator(".blog-card__title a").first().getAttribute("href");
  expect(href, "first article should have a url").toBeTruthy();
  const resp = await page.goto(href as string, { waitUntil: "load" });
  expect(resp?.status(), "article should not 404").toBeLessThan(400);
  await passChallenge(page);
  return true;
}

async function languageCount(page: Page): Promise<number> {
  if (process.env.QA_LANGUAGES) return Number(process.env.QA_LANGUAGES);
  return page.evaluate(() => {
    const langs = new Set<string>();
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => {
      const h = (l.getAttribute("hreflang") || "").toLowerCase();
      if (h && h !== "x-default") langs.add(h.split("-")[0]);
    });
    return Math.max(1, langs.size);
  });
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
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

/** Shadows, gradients, blur (incl. ::before/::after) and endless animations. */
async function forbiddenEffects(root: Locator): Promise<string[]> {
  return root.evaluate((el) => {
    const bad: string[] = [];
    const nodes = [el, ...Array.from(el.querySelectorAll("*"))];
    for (const n of nodes) {
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(n, pseudo);
        const label = `${n.tagName.toLowerCase()}.${(n.getAttribute("class") || "").split(" ")[0]}${pseudo || ""}`;
        if (cs.boxShadow !== "none") bad.push(`${label} box-shadow`);
        if (cs.textShadow !== "none") bad.push(`${label} text-shadow`);
        if (/gradient/.test(cs.backgroundImage)) bad.push(`${label} gradient`);
        if (cs.filter.includes("blur") || (cs as any).backdropFilter?.includes?.("blur")) bad.push(`${label} blur`);
      }
    }
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
      if (target && el.contains(target) && a.effect?.getTiming().iterations === Infinity) {
        bad.push(`endless animation on ${target.tagName.toLowerCase()}`);
      }
    }
    return bad;
  });
}

async function expectMobileSafe(page: Page) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(200);
    expect(await hasHorizontalOverflow(page), `no horizontal scroll at ${width}px`).toBeFalsy();
  }
}

async function expectCard(card: Locator, name: string) {
  const st = await card.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      border: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      radius: cs.borderTopLeftRadius,
      shadow: cs.boxShadow,
    };
  });
  expect(st.bg, `${name}: --color-surface`).toBe(SURFACE);
  expect(st.border, `${name}: 1px line`).toBe("1px");
  expect(st.borderColor, `${name}: --color-line`).toBe(LINE);
  expect(st.radius, `${name}: --r-lg`).toBe("16px");
  expect(st.shadow, `${name}: no shadow`).toBe("none");
}

async function expectOneBricolageH1(page: Page) {
  await expect(page.locator("h1")).toHaveCount(1);
  const h1 = page.locator("h1").first();
  expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Bricolage Grotesque/);
  expect(await h1.evaluate((el) => el.textContent || "")).not.toContain("*");
}

test.describe("blog index", () => {
  test("design system: one h1, cards, tokens, mobile-safe", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const resp = await openBlog(page);
    expect(resp?.status(), "blog index should not 404").toBeLessThan(400);

    const section = page.locator("section.blog");
    await expect(section).toBeVisible();
    await expect(section).toHaveClass(/color-scheme-sand/);
    await expectOneBricolageH1(page);

    const cards = page.locator(".blog-card");
    const n = await cards.count();
    for (let i = 0; i < Math.min(n, 3); i++) await expectCard(cards.nth(i), `blog card ${i + 1}`);
    if (n > 0) {
      const title = cards.first().locator(".blog-card__title");
      expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Bricolage Grotesque/);
      // Visible focus on the card link
      const link = title.locator("a");
      await link.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      const outline = await link.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThanOrEqual(2);
    }

    expect(await forbiddenEffects(section), "no shadows/gradients/blur/endless animations").toEqual([]);

    await page.screenshot({ path: "qa-screenshots/blog-index-desktop.png", fullPage: true });
    await expectMobileSafe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "qa-screenshots/blog-index-mobile.png", fullPage: true });
  });
});

test.describe("article page", () => {
  test("design system: header, reading type, quote, blocks, mobile-safe", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const found = await openFirstArticle(page);
    test.skip(!found, "No articles in the blog of the dev store");

    const article = page.locator("article.article");
    await expect(article).toBeVisible();
    await expect(article).toHaveClass(/color-scheme-sand/);
    await expect(page.locator(".article__hero")).toBeVisible();
    await expect(page.locator(".article__hero-title")).toBeVisible();
    await expectOneBricolageH1(page);

    // No overlay; the photo (if any) is a --r-lg photo
    await expect(page.locator(".article__hero-overlay")).toHaveCount(0);
    const heroImg = page.locator(".article__hero-img");
    if ((await heroImg.count()) > 0) {
      expect(await heroImg.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("16px");
    }

    // Reading type
    const body = page.locator(".article__body");
    await expect(body).toBeAttached();
    const type = await body.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        size: parseFloat(cs.fontSize),
        lh: parseFloat(cs.lineHeight),
        maxW: parseFloat(cs.maxWidth),
        family: cs.fontFamily,
      };
    });
    expect(type.size, "--text-body 1.0625rem").toBeCloseTo(17, 0);
    expect(type.lh / type.size, "line-height 1.7").toBeCloseTo(1.7, 1);
    expect(type.maxW / type.size, "max ~68ch").toBeGreaterThan(25);
    expect(type.maxW / type.size, "max ~68ch").toBeLessThan(45);
    expect(type.family).toMatch(/Work Sans/);
    for (const h of await body.locator("h2, h3").all()) {
      expect(await h.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Bricolage Grotesque/);
    }
    for (const a of (await body.locator("a").all()).slice(0, 3)) {
      expect(await a.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
    }

    // Pull quotes in the system (quote_* empty)
    for (const q of (await body.locator("blockquote").all()).slice(0, 2)) {
      const bg = await q.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, "quote not on the old #ece4cf").not.toBe(OLD_QUOTE_BG);
      expect(bg, "quote on --color-surface").toBe(SURFACE);
    }

    // Newsletter/CTA: scheme primary button, texts from the locale file
    const cta = page.locator(".article-cta");
    if ((await cta.count()) > 0) {
      await expectCard(cta.first(), "CTA block");
      const btn = cta.first().locator(".btn.btn--primary");
      await expect(btn).toBeVisible();
      const colors = await btn.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color, h: el.getBoundingClientRect().height };
      });
      expect(colors.bg, "primary button = scheme teal").toBe(TEAL);
      expect(contrast(colors.fg, colors.bg)).toBeGreaterThanOrEqual(4.5);
      expect(colors.h).toBeGreaterThanOrEqual(51);
      const email = cta.first().locator('input[type="email"]');
      if ((await email.count()) > 0) {
        await expect(email).toHaveAttribute("placeholder", localeValue("de.json", "blog.newsletter_placeholder"));
      }
    }

    // Related posts: cards in the system
    const related = page.locator(".article-related__card");
    for (let i = 0; i < Math.min(await related.count(), 3); i++) await expectCard(related.nth(i), `related ${i + 1}`);

    // Comments (only when enabled for the blog)
    const commentEmail = page.locator(".article__composer input[type='email']");
    if ((await commentEmail.count()) > 0) {
      await expect(commentEmail).toHaveAttribute("placeholder", localeValue("de.json", "blog.email_placeholder"));
      const textarea = page.locator(".article__composer textarea");
      const id = await textarea.getAttribute("id");
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
      const submit = page.locator(".article__composer .btn.btn--primary");
      await expect(submit).toContainText(localeValue("de.json", "blog.comment_form_submit"));
    }

    // Visible focus on the first tag/share link
    const focusable = page.locator(".article__tag, .article__share-link").first();
    if ((await focusable.count()) > 0) {
      await focusable.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(focusable).toBeFocused();
      const outline = await focusable.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThanOrEqual(2);
    }

    expect(await forbiddenEffects(article), "no shadows/gradients/blur/endless animations").toEqual([]);

    await page.screenshot({ path: "qa-screenshots/article-desktop.png", fullPage: true });
    await expectMobileSafe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "qa-screenshots/article-mobile.png", fullPage: true });
  });
});

test.describe("dates (locale-aware format)", () => {
  test("DE: time elements show a German month name", async ({ page }) => {
    await openBlog(page);
    expect(await page.locator("html").getAttribute("lang")).toMatch(/^de/);

    const texts: string[] = await page.locator(".blog-card time").allTextContents();
    if (await openFirstArticle(page)) {
      texts.push(...(await page.locator("time.article__date").allTextContents()));
    }
    test.skip(texts.length === 0, "No articles in the blog of the dev store");

    for (const raw of texts) {
      const t = raw.trim();
      expect(t, `"${t}" contains a German month name`).toMatch(DE_MONTH);
      expect(t, `"${t}" has no English-only month name`).not.toMatch(EN_ONLY_MONTH);
      expect(t, `"${t}" is not the old "%b %d, %Y" pattern`).not.toMatch(OLD_EN_PATTERN);
    }
  });

  test("EN: time elements show an English month name", async ({ page }) => {
    await openBlog(page);
    test.skip((await languageCount(page)) < 2, "Nur eine Sprache veroeffentlicht (A2 offen)");

    await openBlog(page, "/en");
    expect(await page.locator("html").getAttribute("lang")).toMatch(/^en/);
    const texts: string[] = await page.locator(".blog-card time").allTextContents();
    if (await openFirstArticle(page, "/en")) {
      texts.push(...(await page.locator("time.article__date").allTextContents()));
    }
    test.skip(texts.length === 0, "No articles in the blog of the dev store");

    for (const raw of texts) {
      const t = raw.trim();
      expect(t, `"${t}" contains an English month name`).toMatch(EN_MONTH);
      expect(t, `"${t}" has no German-only month name`).not.toMatch(DE_ONLY_MONTH);
    }
  });
});
