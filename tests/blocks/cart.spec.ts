import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Cart-Section Tests.
 *
 * Pro Test:
 *  1. Cart leeren (POST /cart/clear.js)
 *  2. QA-Produkt hinzufuegen (POST /cart/add.js, M/Black Variant)
 *  3. /cart oeffnen
 */
const QA_VARIANT_ID = 44957941268595; // qa-test-produkt, M/Black

async function passChallenge(page: import("@playwright/test").Page) {
  // Cloudflare's Managed Challenge schickt eine Zwischenseite; sie redirected
  // selbststaendig auf die echte Page, wenn JS laufen kann. Wir warten auf ein
  // Shopify-spezifisches Markup, das auf der Challenge-Page nicht existiert.
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

async function seedCart(page: import("@playwright/test").Page, qty = 1) {
  // 1. Home laden, Challenge durchlassen, Cookies etablieren.
  await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
  await passChallenge(page);
  // 2. /cart laden — initialisiert das `cart` Cookie unter genau diesem Host.
  await page.goto(withTheme(QA.paths.cart), { waitUntil: "load" });
  await passChallenge(page);
  // 3. AJAX-Cart-API aus dem Page-Context — laeuft mit den jetzt vollstaendigen Cookies.
  const result = await page.evaluate(
    async ([variantId, quantity]) => {
      const clr = await fetch("/cart/clear.js", { method: "POST" });
      const add = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: [{ id: variantId, quantity }] }),
      });
      const addBody = await add.text();
      return { clr: clr.status, add: add.status, addBody: addBody.slice(0, 400) };
    },
    [QA_VARIANT_ID, qty] as const
  );
  if (result.add !== 200) {
    throw new Error(
      `/cart/add.js returned ${result.add} (clear=${result.clr}) — body=${result.addBody}`
    );
  }
  // 4. /cart erneut laden, jetzt mit Item.
  await page.goto(withTheme(QA.paths.cart), { waitUntil: "load" });
  await passChallenge(page);
}

test.describe("Cart – Section", () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page, 1);
  });

  test("Renders heading, subtitle, line item, summary, checkout button", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();
    await expect(root).toBeVisible();

    await expect(root.locator(".cart-page__title")).toHaveText(/Dein Warenkorb/i);
    await expect(root.locator(".cart-page__subtitle")).toContainText(/Position/);
    await expect(root.locator(".cart-page__subtitle")).toContainText(/digital/);

    await expect(root.locator("[data-cart-item]")).toHaveCount(1);
    await expect(root.locator("[data-cart-subtotal]")).toBeVisible();
    await expect(root.locator("[data-cart-total]")).toBeVisible();
    await expect(root.locator("[data-cart-checkout]")).toBeVisible();
    await expect(root.locator("[data-cart-checkout]")).toContainText(/Zur Kasse/);
  });

  test("Image fallback renders SVG placeholder when product has no image", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();
    const item = root.locator("[data-cart-item]").first();
    const placeholder = item.locator(".cart-item__placeholder svg");
    await expect(placeholder).toBeVisible();
  });

  test("Quantity buttons increment and decrement the input", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();
    const input = root.locator("[data-cart-qty-input]").first();
    const inc = root.locator("[data-cart-qty-increment]").first();
    const dec = root.locator("[data-cart-qty-decrement]").first();

    await expect(input).toHaveValue("1");

    // Decrement clamps at 1 (no change request fires while at min)
    await dec.click();
    await expect(input).toHaveValue("1");

    // Increment: triggers reload via /cart/change.js; just confirm the value flipped client-side first
    await page.route("**/cart/change.js", (route) => route.fulfill({ status: 200, body: "{}" }));
    await inc.click();
    await expect(input).toHaveValue("2");
  });

  test("All four block types render with default settings", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();

    await expect(root.locator("[data-cart-discount]")).toBeVisible();
    await expect(root.locator("[data-cart-discount-input]")).toHaveAttribute(
      "placeholder",
      /Code/
    );

    await expect(root.locator("[data-cart-payments]")).toBeVisible();
    const paymentItems = root.locator("[data-cart-payments] .cart-payment");
    await expect(paymentItems).toContainText(["SEPA", "PayPal", "Rechnung"]);

    await expect(root.locator("[data-cart-trust-badges]")).toBeVisible();
    const badges = root.locator("[data-cart-trust-badges] .cart-badge");
    await expect(badges).toHaveCount(2);
    await expect(badges.first()).toContainText(/SSL/);

    await expect(root.locator(".cart-page__continue")).toBeVisible();
    await expect(root.locator(".cart-page__continue")).toContainText(/Weiter stöbern/);
  });

  test("Empty cart shows fallback message + continue link", async ({ page }) => {
    await page.evaluate(async () => {
      await fetch("/cart/clear.js", { method: "POST" });
    });
    await page.goto(withTheme(QA.paths.cart), { waitUntil: "domcontentloaded" });

    const root = page.locator("[data-section-type='cart']").first();
    await expect(root.locator("[data-cart-empty]")).toBeVisible();
    await expect(root.locator("[data-cart-empty]")).toContainText(/leer/i);
    await expect(root.locator("[data-cart-empty] .cart-page__continue")).toBeVisible();
  });

  test("No horizontal scroll at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.cart), { waitUntil: "domcontentloaded" });

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });

  test("Captures desktop screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.cart), { waitUntil: "domcontentloaded" });
    await page.locator("[data-section-type='cart']").first().waitFor();
    await page.screenshot({ path: "qa-screenshots/cart-desktop.png", fullPage: true });
  });

  test("Captures mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(withTheme(QA.paths.cart), { waitUntil: "domcontentloaded" });
    await page.locator("[data-section-type='cart']").first().waitFor();
    await page.screenshot({ path: "qa-screenshots/cart-mobile.png", fullPage: true });
  });
});
