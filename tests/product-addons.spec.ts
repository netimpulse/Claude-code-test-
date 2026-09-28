import { test, expect } from "@playwright/test";
import { QA, withTheme, activeLocaleValue } from "./fixtures";

/**
 * Tests for snippets/product-addons.liquid + the add-on handling in
 * assets/product-detail.js. The QA test product (qa-test-produkt) has
 * two products attached via metafields.custom.recommended_addons:
 * "QA Setup Service" (fixed_price, multi-variant) and "Theme Customizing"
 * (custom.addon_mode = "interest_only" plus an info text). So the storefront
 * renders the Theme Customizing row in "price on request" mode and the
 * interest_only hint paragraph below the list. UI texts are read from the
 * active shop locale (html[lang]) via activeLocaleValue.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Product add-ons", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.product), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".product-detail", { timeout: 15_000 });
  });

  test("Renders the addons block with the Theme Customizing entry", async ({ page }) => {
    const addons = page.locator(".pd-addons");
    await expect(addons).toBeVisible();
    await expect(addons.locator(".pd-addons__title")).toHaveText(
      await activeLocaleValue(page, "product_addons.title")
    );
    const entry = addons.locator(".pd-addons__item").filter({
      has: page.locator(".pd-addons__name", { hasText: "Theme Customizing" }),
    });
    await expect(entry).toHaveCount(1);
  });

  test("Interest-only addon shows 'Preis auf Anfrage' instead of a price", async ({ page }) => {
    const item = page.locator(".pd-addons__item--interest_only").first();
    await expect(item).toBeVisible();
    await expect(item.locator(".pd-addons__price--quote")).toHaveText(
      await activeLocaleValue(page, "product_addons.price_on_request")
    );
  });

  test("Interest hint paragraph appears when at least one interest_only addon exists", async ({ page }) => {
    await expect(page.locator(".pd-addons__hint")).toBeVisible();
  });

  test("Add-on texts come from the de locale (S7d i18n)", async ({ page }) => {
    const de = (await activeLocaleValue(page, "product_addons")) as unknown as Record<string, string>;
    await expect(page.locator(".pd-addons__title")).toHaveText(de.title);
    await expect(page.locator(".pd-addons__price--quote").first()).toHaveText(de.price_on_request);
    await expect(page.locator(".pd-addons__hint")).toHaveText(de.interest_hint);
  });

  test("Addon checkbox carries the correct data-attributes for the JS hook", async ({ page }) => {
    // The QA product also carries a fixed_price add-on, so target the interest_only row explicitly.
    const cb = page.locator(".pd-addons__item--interest_only .pd-addons__check").first();
    const mode = await cb.getAttribute("data-addon-mode");
    const title = await cb.getAttribute("data-addon-title");
    const variantId = await cb.getAttribute("data-addon-variant-id");
    expect(mode).toBe("interest_only");
    expect(title).toContain("Theme Customizing");
    // interest_only addons do not need a variant id — the JS only reads it for fixed_price
    expect(variantId).toBeNull();
  });

  test("Toggling the checkbox shows the visual checked state", async ({ page }) => {
    const label = page.locator(".pd-addons__label").first();
    await label.click();
    const isChecked = await page.locator(".pd-addons__check").first().isChecked();
    expect(isChecked).toBe(true);
  });

  test("Add-to-cart with interest_only addon sets the cart attribute", async ({ page }) => {
    // Reset the cart so this run is reproducible. /cart/clear.js works
    // via fetch from the page context (cookies + password auth flow
    // already in place).
    await page.evaluate(() =>
      fetch(`${((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/")}cart/clear.js`, { method: "POST" }).then((r) => r.text())
    );

    await page.locator(".pd-addons__item--interest_only .pd-addons__label").first().click();

    // The JS adds the main product, writes the interest attribute via
    // /cart/update.js and then navigates to /cart. Wait for the attribute
    // write and the navigation (aborting the navigation would leave the tab
    // on a chrome-error page where same-origin fetches fail).
    const [updateResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/cart/update.js")),
      page.evaluate(() => {
        const form = document.querySelector(".product-detail__form") as HTMLFormElement | null;
        if (!form) throw new Error("form not found");
        form.requestSubmit();
      }),
    ]);
    expect(updateResp.ok(), "cart/update.js").toBe(true);
    await page.waitForURL(/\/cart(\?|$)/, { timeout: 15_000 });

    const cart = await page.evaluate(() =>
      fetch(`${((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/")}cart.js`, { headers: { Accept: "application/json" } }).then((r) => r.json())
    );
    expect(cart.attributes, "cart attributes").toBeTruthy();
    const hasInterest = Object.keys(cart.attributes || {}).some((k) =>
      k.startsWith("Service auf Anfrage:")
    );
    expect(hasInterest, "interest attribute should be set").toBe(true);
  });
});
