import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
import { QA, withTheme } from "../fixtures";

/**
 * Tests fuer sections/theme-store.liquid + assets/theme-store.js.
 *
 * Soll nach S7e (R1): Die Section wird auf ihrer echten Seite geprueft
 * (QA.paths.themeStore, templates/page.theme-store.json), nicht mehr auf der
 * QA-Block-Seite – dort ist sie nicht eingebunden. Auf der echten Seite ist
 * die Section bis zum Launch des Theme-Stores deaktiviert; die Storefront-Tests
 * der Section laufen deshalb nur, wenn sie gerendert wird, und leiten ihre
 * Erwartungen aus dem gerenderten Markup ab (keine festen Produktzahlen).
 *
 * Immer aktiv sind:
 *  - Template-Soll (Farbschema scheme-sand, Section deaktiviert),
 *  - i18n-Soll (keine hart codierten UI-Texte in Liquid/JS, Keys in beiden Locales),
 *  - Verhalten von theme-store.js gegen eine lokale Fixture-Seite unter /en/
 *    (Locale-Praefix fuer /search/suggest.json, uebersetzter Leertext).
 */

const SECTION = "[data-section-type='theme-store']";

function readJson(rel: string) {
  const raw = fs.readFileSync(rel, "utf8").replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  return JSON.parse(raw);
}

function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v as Record<string, unknown>, key, out);
    else out[key] = v;
  }
  return out;
}

/** Oeffnet die echte Theme-Store-Seite; ueberspringt, solange die Section deaktiviert ist. */
async function openStore(page: Page) {
  await page.goto(withTheme(QA.paths.themeStore), { waitUntil: "networkidle" });
  const count = await page.locator(SECTION).count();
  test.skip(count === 0, "theme-store ist in page.theme-store.json deaktiviert (bis zum Launch)");
  return page.locator(SECTION).first();
}

test.describe("Theme Store – Template & i18n (S7e)", () => {
  test("page.theme-store.json: theme-store uses scheme-sand and stays disabled", () => {
    const tpl = readJson("templates/page.theme-store.json");
    const entry = Object.values<any>(tpl.sections).find((s) => s.type === "theme-store");
    expect(entry, "theme-store section in template").toBeTruthy();
    expect(entry.settings.color_scheme).toBe("scheme-sand");
    expect(entry.disabled).toBe(true);
  });

  test("Real page renders without the disabled section and shows the coming-soon text", async ({ page }) => {
    const res = await page.goto(withTheme(QA.paths.themeStore), { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    const tpl = readJson("templates/page.theme-store.json");
    const entry = Object.values<any>(tpl.sections).find((s) => s.type === "theme-store");
    if (entry?.disabled) {
      await expect(page.locator(SECTION)).toHaveCount(0);
    }
    await expect(page.locator("main, #MainContent").first()).toContainText(/Bald verfügbar|Coming soon/i);
  });

  test("Liquid has no literal UI fallbacks; all theme_store keys exist in both locales", () => {
    const src = fs.readFileSync("sections/theme-store.liquid", "utf8").replace(
      /\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/,
      ""
    );
    for (const literal of ["'Filters'", "'All themes'", "'Search themes'", "'Clear search'", "'No themes match this filter yet.'"]) {
      expect(src, `literal ${literal}`).not.toContain(literal);
    }
    expect(src).toMatch(/data-i18n-no-matches="\{\{\s*'theme_store\.no_matches'\s*\|\s*t\s*\|\s*escape\s*\}\}"/);
    expect(src).toMatch(/data-i18n-did-you-mean="\{\{\s*'theme_store\.did_you_mean'\s*\|\s*t\s*\|\s*escape\s*\}\}"/);

    const used = [...src.matchAll(/'(theme_store\.[a-z_]+)'\s*\|\s*t\b/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(5);
    const de = flatten(readJson("locales/de.json"));
    const en = flatten(readJson("locales/en.default.json"));
    for (const key of new Set(used)) {
      expect(String(de[key] ?? "").trim(), `de: ${key}`).not.toBe("");
      expect(String(en[key] ?? "").trim(), `en: ${key}`).not.toBe("");
    }
  });

  test("theme-store.js has no hard-coded UI texts and no unprefixed storefront paths", () => {
    const code = fs
      .readFileSync("assets/theme-store.js", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toContain("No matches found.");
    expect(code).not.toContain("Did you mean");
    expect(code).not.toMatch(/(["'`])\/search\//);
    expect(code).toContain("window.Shopify.routes.root");
  });
});

test.describe("Theme Store – JS behaviour under /en/ (local fixture)", () => {
  const ORIGIN = "https://theme-store.fixture.test";

  async function mountFixture(page: Page, labels: { noMatches: string; didYouMean: string }) {
    const js = fs.readFileSync("assets/theme-store.js", "utf8");
    const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>
      <section data-section-type="theme-store" data-section-id="fx"
        data-i18n-no-matches="${attr(labels.noMatches)}"
        data-i18n-did-you-mean="${attr(labels.didYouMean)}">
        <div data-ts-search-root>
          <input data-ts-search-input aria-expanded="false">
          <button type="button" data-ts-search-clear hidden>x</button>
          <div data-ts-search-results role="listbox" hidden></div>
        </div>
        <ul data-ts-product-grid></ul>
      </section>
      <script type="application/json" data-ts-catalog="fx">[{"id":1,"title":"Aurora","type":"","url":"/en/products/aurora","price":"€1","img":"","vendor":"","tags":[]}]</script>
      <script>window.Shopify = { routes: { root: "/en/" } };</script>
      <script src="/theme-store.js"></script>
    </body></html>`;

    const suggestPaths: string[] = [];
    await page.route(`${ORIGIN}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/theme-store.js")) {
        return route.fulfill({ status: 200, contentType: "application/javascript", body: js });
      }
      if (url.pathname.includes("search/suggest.json")) {
        suggestPaths.push(url.pathname);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ resources: { results: { products: [] } } }),
        });
      }
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto(`${ORIGIN}/en/pages/theme-store`);
    return suggestPaths;
  }

  test("Predictive search requests /en/search/suggest.json", async ({ page }) => {
    const paths = await mountFixture(page, { noMatches: "No matches found.", didYouMean: "Did you mean" });
    await page.locator("[data-ts-search-input]").fill("aurora");
    await expect.poll(() => paths.length).toBeGreaterThan(0);
    expect(paths[0]).toBe("/en/search/suggest.json");
  });

  test("Empty result uses the translated label from data-i18n-no-matches as plain text", async ({ page }) => {
    const label = "<b>Keine Treffer.</b>";
    await mountFixture(page, { noMatches: label, didYouMean: "Meintest du" });
    await page.locator("[data-ts-search-input]").fill("qqqqqq");
    const empty = page.locator("[data-ts-search-results] .theme-store__search-empty");
    await expect(empty).toHaveText(label);
    await expect(page.locator("[data-ts-search-results] b")).toHaveCount(0);
  });
});

test.describe("Theme Store – Section on its real page", () => {
  test("Renders search bar, sidebar with categories, and product grid", async ({ page }) => {
    const root = await openStore(page);
    await expect(root).toBeVisible();

    await expect(root.locator("[data-ts-search-input]")).toBeVisible();

    // At least one category plus the All entry.
    const catItems = root.locator("[data-ts-cat]");
    expect(await catItems.count()).toBeGreaterThanOrEqual(2);
    await expect(root.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "true");

    // The All count equals the number of unique rendered products.
    const allCount = Number((await root.locator("[data-ts-cat='all'] .theme-store__cat-count").innerText()).trim());
    await expect(root.locator("[data-ts-product]")).toHaveCount(allCount);
  });

  test("Category filter shows only matching products and updates URL", async ({ page }) => {
    const root = await openStore(page);
    const firstCat = root.locator("[data-ts-cat]:not([data-ts-cat='all'])").first();
    const handle = (await firstCat.getAttribute("data-ts-cat")) as string;
    const expected = await root.locator(`[data-ts-product][data-cats~='${handle}']`).count();

    await firstCat.click();

    // URL is updated via pushState
    await expect.poll(() => new URL(page.url()).searchParams.get("cat")).toBe(handle);

    await expect(firstCat).toHaveAttribute("aria-current", "true");
    await expect(root.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "false");
    await expect(root.locator("[data-ts-product]:not([hidden])")).toHaveCount(expected);

    // Reset to All
    const total = await root.locator("[data-ts-product]").count();
    await root.locator("[data-ts-cat='all']").click();
    await expect(root.locator("[data-ts-product]:not([hidden])")).toHaveCount(total);
  });

  test("Predictive search shows results for an exact product title", async ({ page }) => {
    const root = await openStore(page);
    const firstTitle = (await root.locator(".theme-store__product-title").first().innerText()).trim();
    test.skip(!firstTitle, "No products rendered");
    const input = root.locator("[data-ts-search-input]");

    await input.fill(firstTitle);
    const results = root.locator("[data-ts-search-results]");
    await expect(results).toBeVisible();
    await expect(results.locator(".theme-store__search-result-title").first()).toBeVisible();
  });

  test("Predictive search tolerates typos (fuzzy fallback)", async ({ page }) => {
    const root = await openStore(page);
    const firstTitle = (await root.locator(".theme-store__product-title").first().innerText()).trim();
    test.skip(firstTitle.length < 5, "Needs a product title with 5+ characters");
    const input = root.locator("[data-ts-search-input]");

    // One-letter deletion of the title
    const typo = firstTitle.slice(0, 2) + firstTitle.slice(3);
    await input.fill(typo);
    const results = root.locator("[data-ts-search-results]");
    await expect(results).toBeVisible();

    // Either the product is in the rendered list, or a "did you mean" suggestion points to it.
    await expect
      .poll(async () => (await results.innerHTML()).toLowerCase())
      .toContain(firstTitle.toLowerCase().slice(0, 4));
  });

  test("Mobile sidebar toggle expands and collapses", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const root = await openStore(page);
    const toggle = root.locator("[data-ts-sidebar-toggle]");
    const panel = root.locator("[data-ts-sidebar-panel]");

    await expect(toggle).toBeVisible();
    await expect(panel).not.toBeVisible();

    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await toggle.click();
    await expect(panel).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Color scheme + font pickers feed inline CSS variables (scheme-sand)", async ({ page }) => {
    const root = await openStore(page);
    await expect(root).toHaveClass(/color-scheme-sand/);

    const vars = await root.evaluate((el) => {
      const cs = getComputedStyle(el as HTMLElement);
      return {
        accent: cs.getPropertyValue("--ts-accent").trim(),
        bg: cs.getPropertyValue("--ts-bg").trim(),
        text: cs.getPropertyValue("--ts-text").trim(),
        headingFont: cs.getPropertyValue("--ts-heading-font").trim(),
        bodyFont: cs.getPropertyValue("--ts-body-font").trim(),
      };
    });

    expect(vars.accent.toLowerCase()).toBe("#1c4948");
    expect(vars.bg.toLowerCase()).toBe("#f8f6f1");
    expect(vars.text.toLowerCase()).toBe("#0d0d0d");
    expect(vars.headingFont.length).toBeGreaterThan(0);
    expect(vars.bodyFont.length).toBeGreaterThan(0);

    const headingFamily = await root.locator(".theme-store__heading").first().evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(headingFamily.length).toBeGreaterThan(0);
  });

  test("No horizontal scroll at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.themeStore), { waitUntil: "networkidle" });

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});
