import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Block-spezifische Tests fuer sections/product.liquid (Product Detail Page).
 * Laeuft gegen QA.paths.product (/products/qa-test-produkt).
 */
test.describe("Product Detail – Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.product), { waitUntil: "networkidle" });
  });

  test("Renders eyebrow, title, price, media card, qty, and add-to-cart", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".product-detail__eyebrow")).toContainText("AUDIT");
    await expect(root.locator(".product-detail__title")).toContainText("QA Test Produkt");
    await expect(root.locator(".product-detail__price")).toBeVisible();
    await expect(root.locator(".product-detail__media-card")).toBeVisible();

    await expect(root.locator("[data-pd-qty-input]")).toHaveValue("1");
    await expect(root.locator("[data-pd-add]")).toBeEnabled();
  });

  test("Media card contains only the figure (no meta strip, no eyebrow)", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    const card = root.locator(".product-detail__media-card");
    await expect(card).toBeVisible();
    await expect(card.locator(".product-detail__media-figure")).toBeVisible();
    await expect(root.locator(".product-detail__media-meta")).toHaveCount(0);
    await expect(root.locator(".product-detail__media-eyebrow")).toHaveCount(0);
  });

  test("Qty +/- buttons increment and clamp at 1", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    const input = root.locator("[data-pd-qty-input]");
    const dec = root.locator("[data-pd-qty-dec]");
    const inc = root.locator("[data-pd-qty-inc]");

    await inc.click();
    await expect(input).toHaveValue("2");
    await inc.click();
    await expect(input).toHaveValue("3");
    await dec.click();
    await expect(input).toHaveValue("2");
    await dec.click();
    await dec.click();
    await dec.click();
    await expect(input).toHaveValue("1");
  });

  test("Variant select updates hidden id and price", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    const select = root.locator("[data-pd-variant-select]");
    await expect(select).toBeVisible();

    const hidden = root.locator("[data-pd-variant-id]");
    const initialId = await hidden.inputValue();

    const options = select.locator("option");
    const optCount = await options.count();
    expect(optCount).toBeGreaterThan(1);

    const secondValue = await options.nth(1).getAttribute("value");
    const secondPrice = await options.nth(1).getAttribute("data-price");
    if (secondValue && secondPrice) {
      await select.selectOption(secondValue);
      await expect(hidden).toHaveValue(secondValue);
      expect(secondValue).not.toBe(initialId);
      await expect(root.locator(".product-detail__price")).toContainText(secondPrice);
    }
  });

  test("Rating section is hidden by default (optional)", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    await expect(root.locator(".product-detail__rating")).toHaveCount(0);
  });

  test("Consultation button is hidden by default (optional)", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    await expect(root.locator(".product-detail__consultation")).toHaveCount(0);
  });

  test("Buy-now button exists and triggers redirect to checkout", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    const buyNow = root.locator("[data-pd-buy-now]");
    await expect(buyNow).toBeVisible();
    await expect(buyNow).toContainText("Sofortkauf");

    // Intercept the cart/add and checkout navigation so we don't actually
    // complete a purchase in the dev store.
    await page.route("**/cart/add.js", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 44957941235827, quantity: 1 }),
      })
    );

    const checkoutNav = page.waitForRequest((req) => req.url().includes("/checkout"));
    await buyNow.click();
    const req = await checkoutNav;
    expect(req.url()).toContain("/checkout");
  });

  test("Trust strip renders configured items", async ({ page }) => {
    const root = page.locator("[data-section-type='product-detail']").first();
    const trust = root.locator(".product-detail__trust");
    await expect(trust).toBeVisible();
    await expect(trust).toContainText("SSL-gesichert");
    await expect(trust).toContainText("30-Tage Geld-zurück");
    await expect(trust).toContainText("Rechnung");
  });

  test("Section does not overflow horizontally at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.product), { waitUntil: "networkidle" });

    const root = page.locator("[data-section-type='product-detail']").first();
    const overflow = await root.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
