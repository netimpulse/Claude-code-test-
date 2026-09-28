import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Sprachumschalter (snippets/language-switcher.liquid, eingebunden in sections/sqe-header.liquid).
 *
 * Die Sprachanzahl kommt aus QA_LANGUAGES oder aus link[rel=alternate][hreflang].
 *  - 1 Sprache: kein Umschalter-Markup.
 *  - ≥ 2 Sprachen: Umschalter im Header (1280) und im Menue-Panel (390), Wechsel DE ↔ EN
 *    mit erhaltener Preview-Theme-ID, Storefront-Requests mit Locale-Praefix.
 */

async function passChallenge(page: Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
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

function localeValue(file: string, key: string): string {
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "locales", file), "utf8");
  const json = JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ""));
  return key.split(".").reduce((o: any, k) => o[k], json);
}

async function themeId(page: Page): Promise<string> {
  return page.evaluate(() => String((window as any).Shopify?.theme?.id ?? ""));
}

async function open(page: Page, p: string) {
  await page.goto(withTheme(p), { waitUntil: "load" });
  await passChallenge(page);
}

test.describe("Language switcher", () => {
  test("1 language: no switcher markup", async ({ page }) => {
    await open(page, QA.paths.home);
    test.skip((await languageCount(page)) > 1, "Mehr als eine Sprache veroeffentlicht");
    await expect(page.locator('form[action*="localization"]')).toHaveCount(0);
    await expect(page.locator(".lang-switch")).toHaveCount(0);
  });

  test.describe("≥ 2 languages", () => {
    test.beforeEach(async ({ page }) => {
      await open(page, QA.paths.home);
      test.skip((await languageCount(page)) < 2, "Nur eine Sprache veroeffentlicht (A2 offen)");
    });

    test("Desktop 1280: visible in header tools, lang + aria-current + label-in-name", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const sw = page.locator(".sqe-header__lang .lang-switch");
      await expect(sw).toBeVisible();
      await expect(sw.locator('[role="group"]')).toHaveAttribute("aria-label", /\S/);

      const options = sw.locator(".lang-switch__option");
      const n = await options.count();
      expect(n).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < n; i++) await expect(options.nth(i)).toHaveAttribute("lang", /^[a-z]{2}/);

      const active = sw.locator('[aria-current="true"]');
      await expect(active).toHaveCount(1);
      const htmlLang = await page.locator("html").getAttribute("lang");
      await expect(active).toHaveAttribute("lang", htmlLang!);

      const en = sw.getByRole("button", { name: /^EN\b.*English/ });
      await expect(en).toBeVisible();
      await expect(en).toHaveText(/^EN/);

      // Target size and visible focus
      const box = (await en.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(32);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await en.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(en).toBeFocused();
      const outline = await en.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThanOrEqual(2);
    });

    test("Mobile 390: visible in the menu panel with ≥ 44×44 targets", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator(".sqe-header__lang .lang-switch")).toBeHidden();
      await page.locator("[data-sqe-drawer-toggle]").first().click();
      const sw = page.locator(".sqe-header__panel-lang .lang-switch--panel");
      await expect(sw).toBeVisible();
      await expect(sw.locator('[aria-current="true"]')).toHaveCount(1);
      const en = sw.getByRole("button", { name: /^EN\b.*English/ });
      await expect(en).toBeVisible();
      const box = (await en.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    });

    test("Switch DE → EN → DE keeps the page and the preview theme", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, QA.paths.kontakt);
      expect(await themeId(page)).toBe(String(QA.themeId));

      await page.locator(".sqe-header__lang").getByRole("button", { name: /^EN\b.*English/ }).click();
      await page.waitForURL(/\/en\/pages\/kontakt/);
      await passChallenge(page);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator(".skip-link")).toHaveText(localeValue("en.default.json", "general.skip_to_content"));
      expect(await themeId(page)).toBe(String(QA.themeId));

      await page.locator(".sqe-header__lang").getByRole("button", { name: /^DE\b.*Deutsch/ }).click();
      await page.waitForURL((u) => /\/pages\/kontakt/.test(u.pathname) && !u.pathname.startsWith("/en"));
      await passChallenge(page);
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
      await expect(page.locator(".skip-link")).toHaveText(localeValue("de.json", "general.skip_to_content"));
      expect(await themeId(page)).toBe(String(QA.themeId));
    });

    test("Routes under /en: header search requests /en/search/suggest.json", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, "/en/");
      await page.locator("[data-sqe-search-toggle]").first().click();
      const req = page.waitForRequest((r) => new URL(r.url()).pathname === "/en/search/suggest.json");
      await page.locator("[data-sqe-search-input]").first().fill("qa");
      await req;
    });

    // Seit S7d: assets/cart.js ruft cart/change.js mit window.Shopify.routes.root auf.
    test("Routes under /en: cart quantity change requests /en/cart/change.js", async ({ page }) => {
      await open(page, "/en/");
      const added = await page.evaluate(async (handle) => {
        const root = ((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/");
        const product = await (await fetch(`${root}products/${handle}.js`)).json();
        await fetch(`${root}cart/clear.js`, { method: "POST" });
        const r = await fetch(`${root}cart/add.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: [{ id: product.variants[0].id, quantity: 1 }] }),
        });
        return r.status;
      }, QA.product.handle);
      expect(added).toBe(200);
      await open(page, "/en/cart");
      const req = page.waitForRequest((r) => new URL(r.url()).pathname === "/en/cart/change.js");
      await page.locator("[data-cart-qty-increment]").first().click();
      await req;
    });
  });
});
