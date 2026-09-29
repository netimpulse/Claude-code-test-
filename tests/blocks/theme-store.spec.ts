import { test, expect, Page, Locator } from "@playwright/test";
import fs from "node:fs";
import { QA, withTheme } from "../fixtures";

/**
 * Tests fuer sections/theme-store.liquid + assets/theme-store.js.
 *
 * Soll nach dem Premium-Redesign (Variante B mit Kopf + Empfehlungs-Tafel aus C):
 *  - Die Section ist auf ihrer echten Seite aktiv (templates/page.theme-store.json),
 *    der "Bald verfuegbar"-Text (ni-text) ist deaktiviert; genau ein h1.
 *  - Kompakter Kopf (Eyebrow, h1 mit Serif-Akzent, Lead), schwarze Empfehlungs-Tafel
 *    (nur mit featured_product), Feature-Band, Filterleiste mit Kategorie-Pills
 *    inkl. "Alle Themes" + Anzahl, Trefferanzahl, Suchfeld, 2-Spalten-Raster.
 *  - Filter ohne Reload mit ?cat= + history; Suche filtert direkt das Raster mit
 *    Tippfehler-Toleranz und "Meintest du …"; Leerzustand; Loeschen-Button/Escape.
 *  - Mobil (390/320) kein Seiten-Scroll; Pills scrollen im eigenen Container.
 *  - Alle Texte via `| t` (de/en), Fetches mit Locale-Praefix.
 * Erwartungen zu Produktzahlen werden aus dem gerenderten Markup abgeleitet.
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

function storeEntry() {
  const tpl = readJson("templates/page.theme-store.json");
  return Object.values<any>(tpl.sections).find((s) => s.type === "theme-store");
}

async function openStore(page: Page, path = QA.paths.themeStore) {
  const res = await page.goto(withTheme(path), { waitUntil: "load" });
  expect(res?.status()).toBe(200);
  const root = page.locator(SECTION).first();
  await expect(root).toBeVisible();
  return root;
}

/** WCAG-Kontrast des Textes gegen den ersten deckenden Hintergrund der Vorfahren. */
async function contrastOf(loc: Locator) {
  return loc.evaluate((el) => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = "1"] = m[1].split(/[\s,\/]+/).filter(Boolean);
      return { r: +r, g: +g, b: +b, a: +a };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const fg = parse(getComputedStyle(el).color)!;
    let node: Element | null = el;
    let bg = null as ReturnType<typeof parse>;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.9) { bg = c; break; }
      node = node.parentElement;
    }
    bg = bg || { r: 255, g: 255, b: 255, a: 1 };
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  });
}

test.describe("Theme Store – Template & i18n", () => {
  test("page.theme-store.json: theme-store active (scheme-sand, featured theme), coming-soon text disabled", () => {
    const tpl = readJson("templates/page.theme-store.json");
    const entry = storeEntry();
    expect(entry, "theme-store section in template").toBeTruthy();
    expect(entry.disabled).toBeFalsy();
    expect(entry.settings.color_scheme).toBe("scheme-sand");
    expect(entry.settings.heading).toMatch(/\*[^*]+\*/);
    expect(String(entry.settings.featured_product || "")).not.toBe("");
    const niText = Object.values<any>(tpl.sections).find((s) => s.type === "ni-text");
    if (niText) expect(niText.disabled).toBe(true);
    const cats = Object.values<any>(entry.blocks).filter((b) => b.type === "category" && b.settings.collection);
    expect(cats.length).toBeGreaterThanOrEqual(1);
  });

  test("Liquid has no literal UI fallbacks; all theme_store keys exist in both locales", () => {
    const src = fs.readFileSync("sections/theme-store.liquid", "utf8").replace(
      /\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/,
      ""
    );
    for (const literal of ["'Filters'", "'All themes'", "'Search themes'", "'Clear search'", "Vorschau folgt", "Keine Treffer", "Meintest du", "Empfohlen"]) {
      expect(src, `literal ${literal}`).not.toContain(literal);
    }
    expect(src).toMatch(/data-i18n-did-you-mean="\{\{\s*'theme_store\.did_you_mean'\s*\|\s*t\s*\|\s*escape\s*\}\}"/);
    expect(src).toMatch(/'theme_store\.empty_query'\s*\|\s*t:\s*query:/);
    expect(src).toMatch(/\|\s*money/);

    const used = [...src.matchAll(/'(theme_store\.[a-z_]+)'\s*\|\s*t\b/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(15);
    const de = flatten(readJson("locales/de.json"));
    const en = flatten(readJson("locales/en.default.json"));
    for (const key of new Set(used)) {
      expect(String(de[key] ?? "").trim(), `de: ${key}`).not.toBe("");
      expect(String(en[key] ?? "").trim(), `en: ${key}`).not.toBe("");
    }
    // du-Form in the German empty-state copy
    expect(String(de["theme_store.empty_text"])).not.toMatch(/\bSie\b|\bIhr(e|en)?\b/);
  });

  test("theme-store.js has no hard-coded UI texts and no unprefixed storefront paths", () => {
    const code = fs
      .readFileSync("assets/theme-store.js", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const s of ["No matches", "Did you mean", "Meintest", "Keine", "Treffer", "themes"]) {
      expect(code, s).not.toContain(s);
    }
    expect(code).not.toMatch(/(["'`])\/search\//);
    expect(code).toContain("window.Shopify.routes.root");
  });
});

test.describe("Theme Store – JS behaviour under /en/ (local fixture)", () => {
  const ORIGIN = "https://theme-store.fixture.test";

  type Item = { id: number; handle: string; title: string; cats: string; type: string; category: string };
  const DEFAULT_ITEMS: Item[] = [
    { id: 1, handle: "aurora", title: "Aurora", cats: "business", type: "Business Theme", category: "Business" },
    { id: 2, handle: "quartz", title: "Quartz", cats: "business", type: "Business Theme", category: "Business" },
    { id: 3, handle: "vienna", title: "Vienna", cats: "fashion", type: "Fashion Theme", category: "Fashion" },
  ];

  async function mountFixture(
    page: Page,
    labels: Partial<Record<string, string>> = {},
    items: Item[] = DEFAULT_ITEMS
  ) {
    const js = fs.readFileSync("assets/theme-store.js", "utf8");
    const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const l = {
      countOne: "__N__ theme",
      countOther: "__N__ themes",
      resultsOne: "__N__ result",
      resultsOther: "__N__ results",
      similarOne: "__N__ similar theme",
      similarOther: "__N__ similar themes",
      forQuery: "for “__QUERY__”",
      inCategory: "in __CATEGORY__",
      noExact: "No exact matches for “__QUERY__”.",
      didYouMean: "Did you mean",
      emptyQuery: "No theme matches “__QUERY__”.",
      emptyCategory: "No themes match this filter yet.",
      ...labels,
    };
    const card = (id: number, handle: string, title: string, cats: string) =>
      `<li data-ts-product data-product-id="${id}" data-product-handle="${handle}" data-cats="${cats}" data-title="${title}">
         <a href="/en/products/${handle}"><h3 class="theme-store__product-title">${title}</h3></a></li>`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>
      <section data-section-type="theme-store" data-section-id="fx"
        data-i18n-count-one="${attr(l.countOne)}" data-i18n-count-other="${attr(l.countOther)}"
        data-i18n-results-one="${attr(l.resultsOne)}" data-i18n-results-other="${attr(l.resultsOther)}"
        data-i18n-similar-one="${attr(l.similarOne)}" data-i18n-similar-other="${attr(l.similarOther)}"
        data-i18n-for-query="${attr(l.forQuery)}" data-i18n-in-category="${attr(l.inCategory)}"
        data-i18n-no-exact="${attr(l.noExact)}" data-i18n-did-you-mean="${attr(l.didYouMean)}"
        data-i18n-empty-query="${attr(l.emptyQuery)}" data-i18n-empty-category="${attr(l.emptyCategory)}">
        <nav><ul>
          <li><a href="/en/pages/theme-store" data-ts-cat="all" data-ts-cat-label="All themes" aria-current="true">All <span>3</span></a></li>
          <li><a href="/en/pages/theme-store?cat=business" data-ts-cat="business" data-ts-cat-label="Business" aria-current="false">Business <span>2</span></a></li>
          <li><a href="/en/pages/theme-store?cat=fashion" data-ts-cat="fashion" data-ts-cat-label="Fashion" aria-current="false">Fashion <span>1</span></a></li>
        </ul></nav>
        <p data-ts-count aria-live="polite">3 themes</p>
        <form data-ts-search-form role="search" action="/en/search">
          <input type="search" name="q" data-ts-search-input>
          <button type="button" data-ts-search-clear aria-label="Clear search" hidden>x</button>
        </form>
        <p data-ts-hint hidden></p>
        <ul data-ts-product-grid>
          ${items.map((it) => card(it.id, it.handle, it.title, it.cats)).join("\n")}
          <li data-ts-extra>CTA</li>
        </ul>
        <div data-ts-empty hidden>
          <h2 data-ts-empty-title>No themes match this filter yet.</h2>
          <button type="button" data-ts-reset-q hidden>Reset search</button>
          <button type="button" data-ts-show-all>Show all</button>
        </div>
      </section>
      <script type="application/json" data-ts-catalog="fx">${JSON.stringify(
        items.map(({ id, handle, title, type, category }) => ({ id, handle, title, type, category, vendor: "NetImpulse", tags: [] }))
      ).replace(/<\//g, "<\\/")}</script>
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
        const q = url.searchParams.get("q") || "";
        // Shopify finds "Vienna" via its vendor/body text for "elegant".
        const products = q === "elegant" ? [{ id: 3, handle: "vienna", title: "Vienna" }] : [];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ resources: { results: { products } } }),
        });
      }
      return route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto(`${ORIGIN}/en/pages/theme-store`);
    return suggestPaths;
  }

  const visible = (page: Page) => page.locator("[data-ts-product]:not([hidden])");

  test("Search requests the locale-prefixed /en/search/suggest.json", async ({ page }) => {
    const paths = await mountFixture(page);
    await page.locator("[data-ts-search-input]").fill("aurora");
    await expect.poll(() => paths.length).toBeGreaterThan(0);
    expect(paths[0]).toBe("/en/search/suggest.json");
  });

  test("Category filter without reload: ?cat=, aria-current, count, back button", async ({ page }) => {
    await mountFixture(page);
    await expect(page.locator("[data-ts-count]")).toHaveText("3 themes");
    await page.locator("[data-ts-cat='fashion']").click();
    await expect.poll(() => new URL(page.url()).searchParams.get("cat")).toBe("fashion");
    await expect(visible(page)).toHaveCount(1);
    await expect(visible(page)).toHaveAttribute("data-title", "Vienna");
    await expect(page.locator("[data-ts-cat='fashion']")).toHaveAttribute("aria-current", "true");
    await expect(page.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "false");
    await expect(page.locator("[data-ts-count]")).toHaveText("1 theme in Fashion");

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get("cat")).toBe(null);
    await expect(visible(page)).toHaveCount(3);
    await expect(page.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "true");
  });

  test("Search filters the grid directly; clear button and Escape reset it", async ({ page }) => {
    await mountFixture(page);
    const input = page.locator("[data-ts-search-input]");
    await input.fill("quartz");
    await expect(visible(page)).toHaveCount(1);
    await expect(page.locator("[data-ts-count]")).toHaveText("1 result for “quartz”");
    await expect(page.locator("[data-ts-hint]")).toBeHidden();

    const clear = page.locator("[data-ts-search-clear]");
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(visible(page)).toHaveCount(3);
    await expect(clear).toBeHidden();

    await input.fill("vienna");
    await expect(visible(page)).toHaveCount(1);
    await input.press("Escape");
    await expect(input).toHaveValue("");
    await expect(visible(page)).toHaveCount(3);
  });

  test("Typo tolerance: 'Qarz' shows Quartz with a 'did you mean' hint that applies the title", async ({ page }) => {
    await mountFixture(page);
    await page.locator("[data-ts-search-input]").fill("Qarz");
    await expect(visible(page)).toHaveCount(1);
    await expect(visible(page)).toHaveAttribute("data-title", "Quartz");
    await expect(page.locator("[data-ts-count]")).toHaveText("1 similar theme");
    const hint = page.locator("[data-ts-hint]");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("No exact matches for “Qarz”. Did you mean");
    await hint.locator("button").click();
    await expect(page.locator("[data-ts-search-input]")).toHaveValue("Quartz");
    await expect(page.locator("[data-ts-count]")).toHaveText("1 result for “Quartz”");
    await expect(hint).toBeHidden();
  });

  test("Transposed letters: 'Nvoa' finds Nova (optimal string alignment distance 1)", async ({ page }) => {
    await mountFixture(page, {}, [
      ...DEFAULT_ITEMS,
      { id: 4, handle: "nova", title: "Nova", cats: "fashion", type: "Fashion Theme", category: "Fashion" },
    ]);
    await page.locator("[data-ts-search-input]").fill("Nvoa");
    await expect(visible(page)).toHaveCount(1);
    await expect(visible(page)).toHaveAttribute("data-title", "Nova");
    await expect(page.locator("[data-ts-hint] button")).toHaveText("Nova");
  });

  test("Submit (Enter) on desktop keeps focus in the search and the page; a single hit is not opened", async ({ page }) => {
    await mountFixture(page);
    const input = page.locator("[data-ts-search-input]");
    const before = page.url();
    await input.fill("quartz");
    await expect(visible(page)).toHaveCount(1);
    await input.press("Enter");
    await expect(input).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    await expect(visible(page)).toHaveCount(1);
    expect(page.url()).toBe(before);
    await expect(input).toHaveValue("quartz");
  });

  test("Submit on a touch device closes the keyboard; focus moves to the result count, not to body", async ({ browser }) => {
    const ctx = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    try {
      await mountFixture(page);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      const input = page.locator("[data-ts-search-input]");
      await input.fill("quartz");
      await input.press("Enter");
      await expect(input).not.toBeFocused();
      await expect(page.locator("[data-ts-count]")).toBeFocused();
      await expect(visible(page)).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });

  test("Empty catalogue: no cards → empty state with the category message is visible", async ({ page }) => {
    await mountFixture(page, {}, []);
    await expect(page.locator("[data-ts-product]")).toHaveCount(0);
    await expect(page.locator("[data-ts-empty]")).toBeVisible();
    await expect(page.locator("[data-ts-empty-title]")).toHaveText("No themes match this filter yet.");
    await expect(page.locator("[data-ts-extra]")).toBeHidden();
    await expect(page.locator("[data-ts-reset-q]")).toBeHidden();
    await expect(page.locator("[data-ts-count]")).toHaveText("0 themes");
  });

  test("Predictive search results (locale-prefixed) add matches to the grid", async ({ page }) => {
    await mountFixture(page);
    await page.locator("[data-ts-search-input]").fill("elegant");
    await expect(visible(page)).toHaveCount(1);
    await expect(visible(page)).toHaveAttribute("data-title", "Vienna");
  });

  test("Empty state: translated title as plain text, CTA tile hidden, reset + show all", async ({ page }) => {
    const label = "<b>Kein Theme passt zu „__QUERY__“.</b>";
    await mountFixture(page, { emptyQuery: label });
    await page.locator("[data-ts-search-input]").fill("qqqqqq");
    await expect(visible(page)).toHaveCount(0);
    const empty = page.locator("[data-ts-empty]");
    await expect(empty).toBeVisible();
    await expect(page.locator("[data-ts-empty-title]")).toHaveText("<b>Kein Theme passt zu „qqqqqq“.</b>");
    await expect(page.locator("[data-ts-empty] b")).toHaveCount(0);
    await expect(page.locator("[data-ts-extra]")).toBeHidden();
    await expect(page.locator("[data-ts-count]")).toHaveText("0 results for “qqqqqq”");

    await page.locator("[data-ts-reset-q]").click();
    await expect(visible(page)).toHaveCount(3);
    await expect(empty).toBeHidden();
    await expect(page.locator("[data-ts-extra]")).toBeVisible();

    await page.locator("[data-ts-cat='fashion']").click();
    await page.locator("[data-ts-search-input]").fill("quartz");
    await expect(empty).toBeVisible();
    await page.locator("[data-ts-show-all]").click();
    await expect(page.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "true");
    await expect(visible(page)).toHaveCount(3);
  });
});

test.describe("Theme Store – Section on its real page", () => {
  test("Head, featured slab, feature band, pills with counts and grid render; exactly one h1", async ({ page }) => {
    const root = await openStore(page);

    await expect(page.locator("h1")).toHaveCount(1);
    const h1 = root.locator("h1.theme-store__heading");
    await expect(h1).toBeVisible();
    await expect(h1.locator("em.it")).toHaveCount(1);
    expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Bricolage/);
    await expect(root.locator(".theme-store__kicker")).toBeVisible();

    const feature = root.locator(".theme-store__feature");
    await expect(feature).toBeVisible();
    await expect(feature.locator("h2")).not.toBeEmpty();
    await expect(feature.locator(".theme-store__feature-price")).toContainText(/\d/);
    await expect(feature.locator("a.btn")).toHaveAttribute("href", /\/products\//);

    await expect(root.locator(".theme-store__feat").first()).toBeVisible();

    await expect(root.locator("[data-ts-search-input]")).toBeVisible();
    expect(await root.locator("[data-ts-cat]").count()).toBeGreaterThanOrEqual(2);
    await expect(root.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "true");
    const allCount = Number((await root.locator("[data-ts-cat='all'] [data-ts-cat-count]").innerText()).trim());
    await expect(root.locator("[data-ts-product]")).toHaveCount(allCount);
    await expect(root.locator("[data-ts-count]")).toContainText(String(allCount));

    // Every card: title, price, category; cards without an image show the initial + preview note.
    const cards = root.locator("[data-ts-product]");
    for (let i = 0; i < (await cards.count()); i++) {
      const c = cards.nth(i);
      await expect(c.locator(".theme-store__product-title")).not.toBeEmpty();
      await expect(c.locator(".theme-store__price")).toContainText(/\d/);
      await expect(c.locator(".theme-store__card-cat")).not.toBeEmpty();
      if ((await c.locator("img").count()) === 0) {
        await expect(c.locator(".theme-store__noimg-initial")).toHaveText(/^\S$/);
        await expect(c.locator(".theme-store__noimg-tag")).not.toBeEmpty();
      }
    }

    // Desktop: two-column grid, sticky filter bar.
    await page.setViewportSize({ width: 1440, height: 900 });
    const cols = await root.locator("[data-ts-product-grid]").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(2);
    expect(await root.locator(".theme-store__bar").evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  });

  test("Sticky filter bar follows the header: flush to the top while scrolling down, below the header after scrolling up", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const root = await openStore(page);
    const bar = root.locator(".theme-store__bar");
    const header = page.locator(".shopify-section-group-header-group").first();
    const barTop = () => bar.evaluate((el) => el.getBoundingClientRect().top);
    const headerBottom = () => header.evaluate((el) => el.getBoundingClientRect().bottom);

    await page.mouse.move(720, 450);
    // Scroll down well past the bar's natural position.
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 250);
    await expect(header).toHaveClass(/is-hidden/);
    await expect.poll(barTop, { timeout: 5000 }).toBeLessThanOrEqual(1);
    expect(await barTop()).toBeGreaterThanOrEqual(-1);

    // Scroll up a little: the header comes back, the bar sits right below it.
    for (let i = 0; i < 2; i++) await page.mouse.wheel(0, -150);
    await expect(header).not.toHaveClass(/is-hidden/);
    await expect
      .poll(async () => Math.abs((await barTop()) - (await headerBottom())), { timeout: 5000 })
      .toBeLessThan(0.5); // no 1px gap from the header's bottom border
    expect(await headerBottom()).toBeGreaterThan(40);
  });

  test("Enter scrolls the results into view below header + filter bar (desktop), focus stays off body", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const root = await openStore(page);
    const firstTitle = (await root.locator(".theme-store__product-title").first().innerText()).trim();
    const input = root.locator("[data-ts-search-input]");
    await input.fill(firstTitle);
    await expect(root.locator("[data-ts-product]:not([hidden])").first()).toBeVisible();
    await input.press("Enter");
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);

    const geometry = () =>
      page.evaluate(() => {
        const card = document.querySelector<HTMLElement>("[data-ts-product]:not([hidden])")
          ?? document.querySelector<HTMLElement>("[data-ts-empty]:not([hidden])");
        const bar = document.querySelector(".theme-store__bar")!.getBoundingClientRect();
        const header = document.querySelector(".shopify-section-group-header-group")!;
        const hb = header.classList.contains("is-hidden") ? 0 : header.getBoundingClientRect().bottom;
        return { top: card!.getBoundingClientRect().top, cover: Math.max(bar.bottom, hb), vh: innerHeight, y: scrollY };
      });
    await expect.poll(async () => (await geometry()).y, { timeout: 5000 }).toBeGreaterThan(100);
    await page.waitForTimeout(800); // smooth scroll + header transition settle
    const g = await geometry();
    expect(g.top, `card top ${g.top} vs covered ${g.cover}`).toBeGreaterThanOrEqual(g.cover - 1);
    expect(g.top).toBeLessThan(g.vh - 100);
  });

  test("Category filter shows only matching products and updates URL; ?cat= deep link works", async ({ page }) => {
    const root = await openStore(page);
    const firstCat = root.locator("[data-ts-cat]:not([data-ts-cat='all'])").first();
    const handle = (await firstCat.getAttribute("data-ts-cat")) as string;
    const expected = await root.locator(`[data-ts-product][data-cats~='${handle}']`).count();
    const urlBefore = page.url();

    await firstCat.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("cat")).toBe(handle);
    expect(new URL(page.url()).pathname).toBe(new URL(urlBefore).pathname);
    await expect(firstCat).toHaveAttribute("aria-current", "true");
    await expect(root.locator("[data-ts-cat='all']")).toHaveAttribute("aria-current", "false");
    await expect(root.locator("[data-ts-product]:not([hidden])")).toHaveCount(expected);

    const total = await root.locator("[data-ts-product]").count();
    await root.locator("[data-ts-cat='all']").click();
    await expect(root.locator("[data-ts-product]:not([hidden])")).toHaveCount(total);

    const deep = await openStore(page, `${QA.paths.themeStore}?cat=${handle}`);
    await expect(deep.locator(`[data-ts-cat='${handle}']`)).toHaveAttribute("aria-current", "true");
    await expect(deep.locator("[data-ts-product]:not([hidden])")).toHaveCount(expected);
  });

  // Smoke test on live data: Shopify's own predictive search may already
  // return the typo, so the "did you mean" hint is not deterministic here.
  // The hint itself is covered by the fixture tests above ('Qarz', 'Nvoa').
  test("Smoke: search filters the real grid, tolerates a missing letter, empty state", async ({ page }) => {
    const root = await openStore(page);
    const titles = (await root.locator(".theme-store__product-title").allInnerTexts()).map((t) => t.trim());
    const title = titles.find((t) => t.length >= 5);
    test.skip(!title, "Needs a product title with 5+ characters");
    const input = root.locator("[data-ts-search-input]");

    await input.fill(title!);
    await expect(root.locator(`[data-ts-product][data-title="${title}"]`)).toBeVisible();
    await expect(root.locator("[data-ts-count]")).toContainText(title!);

    // One-letter deletion inside the title
    const typo = title!.slice(0, 2) + title!.slice(3);
    await input.fill(typo);
    await expect(root.locator(`[data-ts-product][data-title="${title}"]`)).toBeVisible();

    // No match at all → empty state with reset.
    await input.fill("zzqxwv");
    await expect(root.locator("[data-ts-product]:not([hidden])")).toHaveCount(0);
    await expect(root.locator("[data-ts-empty]")).toBeVisible();
    await expect(root.locator("[data-ts-empty-title]")).toContainText("zzqxwv");
    await root.locator("[data-ts-reset-q]").click();
    await expect(root.locator("[data-ts-empty]")).toBeHidden();
    await expect(input).toHaveValue("");
  });

  test("Colour scheme, text contrast >= 4.5:1 and targets >= 44px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const root = await openStore(page);
    await expect(root).toHaveClass(/color-scheme-sand/);

    const selectors = [
      ".theme-store__lead",
      ".theme-store__kicker",
      ".theme-store__feature-title",
      ".theme-store__feature-text",
      ".theme-store__feature-type",
      ".theme-store__feature-price small",
      ".theme-store__feature-btn",
      ".theme-store__feat span",
      ".theme-store__pill[aria-current='true'] .theme-store__pill-count",
      ".theme-store__pill[aria-current='false'] .theme-store__pill-count",
      "[data-ts-count]",
      ".theme-store__card-cat",
      ".theme-store__noimg-tag",
      ".theme-store__cta-text",
      ".theme-store__cta-label",
      ".theme-store__cta-btn",
    ];
    for (const sel of selectors) {
      const loc = root.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      expect(await contrastOf(loc), sel).toBeGreaterThanOrEqual(4.5);
    }

    for (const sel of ["[data-ts-cat]", "[data-ts-search-input]", ".theme-store__feature-btn", ".theme-store__cta-btn"]) {
      const locs = root.locator(sel);
      for (let i = 0; i < (await locs.count()); i++) {
        const box = await locs.nth(i).boundingBox();
        expect(box!.height, `${sel} #${i} height`).toBeGreaterThanOrEqual(44);
      }
    }
    await root.locator("[data-ts-search-input]").fill("x");
    const clear = await root.locator("[data-ts-search-clear]").boundingBox();
    expect(clear!.width).toBeGreaterThanOrEqual(44);
    expect(clear!.height).toBeGreaterThanOrEqual(44);
  });

  for (const width of [390, 320]) {
    test(`Mobile ${width}px: no horizontal page scroll, pills scroll in their own container, one column`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const root = await openStore(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      expect(overflow).toBe(false);

      const pills = root.locator(".theme-store__pills");
      expect(await pills.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
      await expect(root.locator("[data-ts-cat='all']")).toBeVisible();
      const cols = await root.locator("[data-ts-product-grid]").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      expect(cols).toBe(1);
      expect(await root.locator(".theme-store__bar").evaluate((el) => getComputedStyle(el).position)).toBe("static");

      // Filter still works on mobile.
      const cat = root.locator("[data-ts-cat]:not([data-ts-cat='all'])").last();
      await cat.scrollIntoViewIfNeeded();
      await cat.click();
      await expect(cat).toHaveAttribute("aria-current", "true");
      const stillNoOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      );
      expect(stillNoOverflow).toBe(true);
    });
  }
});
