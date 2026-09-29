import { test, expect } from "@playwright/test";
import { QA, withTheme, activeLocaleValue } from "./fixtures";

/**
 * Tests the multi-variant add-on flow.
 * The QA product has two recommended add-ons:
 *  - QA Setup Service (fixed_price, 3 variants: 149/249/399)
 *  - Theme Customizing (interest_only)
 * So the snippet must render one item with the variant radio group and
 * one without. The JS must pick the variant id from the radio when the
 * multi-variant addon is checked.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Product add-on variants", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.product), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".pd-addons", { timeout: 15_000 });
  });

  test("Multi-variant addon renders a hidden radio fieldset and 'ab' price label", async ({ page }) => {
    const item = page.locator(".pd-addons__item--has-variants").first();
    await expect(item).toBeVisible();
    // "from {{ price }}" (en) / "ab {{ price }}" (de) — prefix from the active shop locale.
    const fromPrefix = (await activeLocaleValue(page, "product_addons.price_from_html")).split("{{")[0];
    await expect(item.locator(".pd-addons__price").first()).toContainText(fromPrefix);
    const fieldset = item.locator(".pd-addons__variants");
    await expect(fieldset).toBeAttached();
    await expect(fieldset).not.toBeVisible();
    const variants = fieldset.locator(".pd-addons__variant");
    await expect(variants).toHaveCount(3);
  });

  test("Variant fieldset appears when the addon checkbox is checked", async ({ page }) => {
    const item = page.locator(".pd-addons__item--has-variants").first();
    await item.locator(".pd-addons__label").click();
    await expect(item.locator(".pd-addons__variants")).toBeVisible();
  });

  test("Single-variant interest_only addon has no variant fieldset", async ({ page }) => {
    const item = page.locator(".pd-addons__item--interest_only").first();
    await expect(item.locator(".pd-addons__variants")).toHaveCount(0);
  });

  test("Picking a variant + submitting adds the chosen variant id as a cart line item", async ({ page }) => {
    await page.evaluate(() => fetch(`${((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/")}cart/clear.js`, { method: "POST" }));
    const item = page.locator(".pd-addons__item--has-variants").first();
    await item.locator(".pd-addons__label").click();
    // pick the middle tier (51-200 Produkte, $249)
    const radios = item.locator(".pd-addons__variant");
    await radios.nth(1).click();
    const expectedId = await item
      .locator(".pd-addons__variant-radio")
      .nth(1)
      .evaluate((el) => (el as HTMLInputElement).value);

    // Wait for the /cart/add.js response, then for the JS-triggered
    // navigation to /cart. The add response body is discarded by the browser
    // once the page navigates, so the cart itself (cart.js) is the source of truth.
    const [addResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/cart/add.js")),
      page.evaluate(() => {
        const form = document.querySelector(".product-detail__form") as HTMLFormElement | null;
        if (!form) throw new Error("form not found");
        form.requestSubmit();
      }),
    ]);
    expect(addResp.ok()).toBe(true);
    await page.waitForURL(/\/cart(\?|$)/, { timeout: 15_000 });
    const cart = await page.evaluate(() =>
      fetch(`${((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/")}cart.js`, { headers: { Accept: "application/json" } }).then((r) => r.json())
    );
    const ids = (cart.items ?? []).map((i: any) => String(i.variant_id ?? i.id));
    expect(ids, "expected addon variant in the cart").toContain(expectedId);
  });
});
