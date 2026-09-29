import { test, expect } from "@playwright/test";
import { QA, withTheme, activeLocaleValue } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("SQE Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
  });

  test("Renders header with logo, nav, actions", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    await expect(header).toBeVisible();
    await expect(header.locator(".sqe-header__logo")).toBeVisible();
  });

  test("Wrapper is full-width and opaque (no transparent side gutters when sticky)", async ({ page }) => {
    const wrapper = page.locator(".shopify-section").filter({ has: page.locator("[data-section-type='sqe-header']") }).first();
    const box = await wrapper.boundingBox();
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(box).not.toBeNull();
    // The wrapper should span (nearly) the full viewport.
    expect(box!.width).toBeGreaterThan(viewportWidth * 0.98);
    // And have an opaque background.
    const bg = await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });

  test("'On scroll up' mode: hides when scrolling down, shows when scrolling up", async ({ page }) => {
    // We need enough page height to scroll.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      document.body.appendChild(spacer);
    });

    const wrapper = page.locator("[id^='shopify-section-']").filter({ has: page.locator("[data-section-type='sqe-header']") }).first();
    // Sanity: is-sticky must be on (default mode is on-scroll-up).
    await expect(wrapper).toHaveClass(/is-sticky/);

    // Scroll down past the header.
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(120);
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(250);
    await expect(wrapper).toHaveClass(/is-hidden/);

    // Scroll up — header should reappear.
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(250);
    await expect(wrapper).not.toHaveClass(/is-hidden/);
  });

  test("Search panel opens on icon click and predictive search queries on input", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    const toggle = header.locator("[data-sqe-search-toggle]");
    await expect(toggle).toBeVisible();
    await toggle.click();
    const input = header.locator("[data-sqe-search-input]");
    await expect(input).toBeVisible();
    await input.fill("QA");
    await expect(header.locator("[data-sqe-search-results]")).toBeVisible({ timeout: 8000 });
    const html = await header.locator("[data-sqe-search-results]").innerHTML();
    expect(html.toLowerCase()).toContain("qa");
  });

  test("Account icon is gone; search and cart stay visible (desktop + mobile)", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    await expect(header.locator(".sqe-header__icon--account")).toHaveCount(0);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(header.locator("[data-sqe-search-toggle]")).toBeVisible();
      const cart = header.locator(".sqe-header__icon--cart");
      await expect(cart).toBeVisible();
      await expect(cart).toHaveAttribute("aria-label", /\S/);
      for (const el of [header.locator("[data-sqe-search-toggle]"), cart]) {
        const box = await el.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("Wordmark 'NetImpulse' in Work Sans 600 with matching aria-label", async ({ page }) => {
    const link = page.locator(".sqe-header__logo-link").first();
    await expect(link).toHaveAttribute("aria-label", "NetImpulse");
    const text = link.locator(".sqe-header__logo-text");
    await expect(text).toHaveText("NetImpulse");
    const style = await text.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, weight: cs.fontWeight };
    });
    expect(style.family.replace(/["']/g, "")).toMatch(/^Work Sans/i);
    expect(style.weight).toBe("600");
    await expect(link.locator(".sqe-header__wordmark-dot")).toHaveAttribute("aria-hidden", "true");
  });

  test("Home has exactly one h1 and the header has none", async ({ page }) => {
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("[data-section-type='sqe-header'] h1")).toHaveCount(0);
  });

  test("Header height follows the header_height setting (80px desktop, 68px ≤1024px)", async ({ page }) => {
    const inner = page.locator(".sqe-header__inner").first();
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(Math.round((await inner.boundingBox())!.height)).toBe(80);
    const desktopVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--header-h").trim());
    expect(desktopVar).toBe("80px");
    await page.setViewportSize({ width: 390, height: 800 });
    expect(Math.round((await inner.boundingBox())!.height)).toBe(68);
  });

  test("Desktop: labelled nav visible, CTA is a small primary button, no menu button", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const header = page.locator("[data-section-type='sqe-header']").first();
    await expect(header.locator(".sqe-header__nav")).toBeVisible();
    await expect(header.locator(".sqe-header__nav")).toHaveAttribute("aria-label", /\S/);
    await expect(header.locator("[data-sqe-drawer-toggle]")).toBeHidden();
    const cta = header.locator(".sqe-header__cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveClass(/btn--primary/);
    await expect(cta).toHaveClass(/btn--sm/);
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test("Mobile: menu button opens the panel below the header, Escape closes it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const header = page.locator("[data-section-type='sqe-header']").first();
    await expect(header.locator(".sqe-header__nav")).toBeHidden();
    await expect(header.locator(".sqe-header__cta")).toBeHidden();
    const toggle = header.locator("[data-sqe-drawer-toggle]");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAccessibleName(/\S/);
    const tBox = (await toggle.boundingBox())!;
    expect(tBox.width).toBeGreaterThanOrEqual(44);
    expect(tBox.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = header.locator("[data-sqe-drawer]");
    await expect(panel).toBeVisible();
    const pBox = (await panel.boundingBox())!;
    const headerH = (await header.locator(".sqe-header__inner").boundingBox())!;
    expect(Math.abs(pBox.y - (headerH.y + headerH.height))).toBeLessThanOrEqual(2);
    expect(pBox.y + pBox.height).toBeGreaterThanOrEqual(844 - 2);
    await expect(panel.locator(".sqe-header__drawer-cta")).toBeVisible();
    await expect(panel.locator(".sqe-header__drawer-cta")).toHaveClass(/btn--block/);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });

  test("Predictive search shows localised group labels (no hard-coded strings)", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    const panel = header.locator("[data-sqe-search]");
    for (const attr of ["data-i18n-products", "data-i18n-pages", "data-i18n-articles", "data-i18n-did-you-mean", "data-i18n-no-results"]) {
      await expect(panel).toHaveAttribute(attr, /\S/);
    }
    await header.locator("[data-sqe-search-toggle]").click();
    const input = header.locator("[data-sqe-search-input]");
    await expect(input).toHaveAttribute("placeholder", /\S/);
    const suggest = page.waitForRequest((r) => /\/search\/suggest\.json\?/.test(r.url()));
    await input.fill("zzqxj");
    await suggest;
    await expect(header.locator("[data-sqe-search-results]")).toBeVisible({ timeout: 8000 });
    // Labels must be the active shop locale's strings (html[lang]).
    const labels = {
      products: await activeLocaleValue(page, "header.search_products"),
      pages: await activeLocaleValue(page, "header.search_pages"),
      articles: await activeLocaleValue(page, "header.search_articles"),
    };
    await expect(panel).toHaveAttribute("data-i18n-products", labels.products);
    await expect(panel).toHaveAttribute("data-i18n-pages", labels.pages);
    await expect(panel).toHaveAttribute("data-i18n-articles", labels.articles);
    const noResults = (await panel.getAttribute("data-i18n-no-results"))!;
    const results = header.locator("[data-sqe-search-results]");
    // Shopify's suggest endpoint is fuzzy: even a nonsense term can return
    // products (observed: the dev store answers "zzqxj" with "Theme Customizing").
    // Groups present -> their labels come from the locale; otherwise the
    // empty state uses the localised no-results text.
    const groups = results.locator(".sqe-search-group");
    const hasTypo = await results.locator(".sqe-search-typo").count();
    if ((await groups.count()) > 0) {
      const allowed = Object.values(labels);
      for (const g of await groups.all()) {
        const heading = (await g.locator(".sqe-search-group__heading").textContent())?.trim() ?? "";
        expect(allowed).toContain(heading);
        await expect(g).toHaveAttribute("aria-label", heading);
      }
    } else if (!hasTypo) {
      await expect(results.locator(".sqe-search-empty")).toHaveText(noResults.replace("__Q__", "zzqxj"));
    }
  });

  test("Predictive search formats product prices in the active currency and language", async ({ page }) => {
    const header = page.locator("[data-section-type='sqe-header']").first();
    await header.locator("[data-sqe-search-toggle]").click();
    const input = header.locator("[data-sqe-search-input]");
    const suggest = page.waitForResponse((r) => /\/search\/suggest\.json\?/.test(r.url()));
    await input.fill("theme");
    const res = await suggest;
    const data = await res.json().catch(() => ({}));
    const products = data?.resources?.results?.products ?? [];
    test.skip(products.length === 0, "Store liefert fuer 'theme' keine Produkte");
    // The JS dedupes and re-ranks results, so match the first rendered result
    // to its product by title instead of relying on the response order.
    const first = header.locator(".sqe-search-result").filter({ has: page.locator(".sqe-search-result__price") }).first();
    await expect(first).toBeVisible({ timeout: 8000 });
    const title = ((await first.locator(".sqe-search-result__title").textContent()) ?? "").trim();
    const text = ((await first.locator(".sqe-search-result__price").textContent()) ?? "").trim();
    const product = products.find((p: { title?: string }) => (p.title ?? "").trim() === title);
    expect(product, `rendered title "${title}" is one of the suggested products`).toBeTruthy();
    // Expected: exactly what Intl produces for that product in the shop currency.
    const expected = await page.evaluate((raw) => {
      const currency = (window as any).Shopify?.currency?.active || "EUR";
      return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency }).format(Number(raw));
    }, String(product.price));
    expect(text).toBe(expected);
    expect(text, "no bare decimal").not.toMatch(/^\d+\.\d{2}$/);
  });

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/sqe-header-desktop.png", fullPage: false });

    await page.setViewportSize({ width: 390, height: 740 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "qa-screenshots/sqe-header-mobile.png", fullPage: false });
  });
});
