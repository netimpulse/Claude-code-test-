import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Tests for snippets/product-addons.liquid + the add-on handling in
 * assets/product-detail.js. The QA test product (qa-test-produkt) has
 * the "Theme Customizing" product attached via
 * metafields.custom.recommended_addons, and Theme Customizing carries
 * metafields.custom.addon_mode = "interest_only" plus an info text.
 * So the storefront should render one addon row in "Preis auf Anfrage"
 * mode and the interest_only hint paragraph below the list.
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
    await expect(addons.locator(".pd-addons__title")).toContainText("Zusatzleistungen");
    const items = addons.locator(".pd-addons__item");
    await expect(items).toHaveCount(1);
    await expect(items.first().locator(".pd-addons__name")).toContainText("Theme Customizing");
  });

  test("Interest-only addon shows 'Preis auf Anfrage' instead of a price", async ({ page }) => {
    const item = page.locator(".pd-addons__item--interest_only").first();
    await expect(item).toBeVisible();
    await expect(item.locator(".pd-addons__price--quote")).toContainText("Preis auf Anfrage");
  });

  test("Interest hint paragraph appears when at least one interest_only addon exists", async ({ page }) => {
    await expect(page.locator(".pd-addons__hint")).toBeVisible();
  });

  test("Addon checkbox carries the correct data-attributes for the JS hook", async ({ page }) => {
    const cb = page.locator(".pd-addons__check").first();
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
    await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }).then((r) => r.text()));

    await page.locator(".pd-addons__label").first().click();

    // Intercept the navigation that the JS triggers on success so the
    // test doesn't follow it; we just need the side-effect (cart write).
    await page.route("**/cart", (route) => route.abort());

    await page.evaluate(() => {
      const form = document.querySelector(".product-detail__form") as HTMLFormElement | null;
      if (!form) throw new Error("form not found");
      form.requestSubmit();
    });
    await page.waitForTimeout(2000);

    const cart = await page.evaluate(() =>
      fetch("/cart.js", { headers: { Accept: "application/json" } }).then((r) => r.json())
    );
    expect(cart.attributes, "cart attributes").toBeTruthy();
    const hasInterest = Object.keys(cart.attributes || {}).some((k) =>
      k.startsWith("Service auf Anfrage:")
    );
    expect(hasInterest, "interest attribute should be set").toBe(true);
  });
});
