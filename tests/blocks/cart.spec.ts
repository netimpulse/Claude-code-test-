import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { QA, withTheme } from "../fixtures";

function localeValue(file: string, key: string): string {
  const raw = fs.readFileSync(`locales/${file}`, "utf8").replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  return key.split(".").reduce((o: any, k) => o?.[k], JSON.parse(raw));
}

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
  // Pfade mit Locale-Root (window.Shopify.routes.root), wie assets/cart.js.
  const result = await page.evaluate(
    async ([variantId, quantity]) => {
      const root = ((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/");
      const clr = await fetch(`${root}cart/clear.js`, { method: "POST" });
      const add = await fetch(`${root}cart/add.js`, {
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

    // Stub the change endpoint so the line stays in the DOM, and record requests.
    const bodies: { quantity?: number }[] = [];
    await page.route("**/cart/change.js", (route) => {
      bodies.push(JSON.parse(route.request().postData() || "{}"));
      return route.fulfill({ status: 200, body: "{}" });
    });

    // Increment flips the value client-side and requests quantity 2.
    await inc.click();
    await expect(input).toHaveValue("2");
    await expect.poll(() => bodies.at(-1)?.quantity).toBe(2);

    // Decrement from 1 goes to 0, which Shopify treats as remove (Codex bug 5).
    await input.evaluate((el: HTMLInputElement) => (el.value = "1"));
    await dec.click();
    await expect(input).toHaveValue("0");
    await expect.poll(() => bodies.at(-1)?.quantity).toBe(0);
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
      const root = ((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/");
      await fetch(`${root}cart/clear.js`, { method: "POST" });
    });
    await page.goto(withTheme(QA.paths.cart), { waitUntil: "domcontentloaded" });

    const root = page.locator("[data-section-type='cart']").first();
    await expect(root.locator("[data-cart-empty]")).toBeVisible();
    await expect(root.locator("[data-cart-empty]")).toContainText(/leer/i);
    await expect(root.locator("[data-cart-empty] .cart-page__continue")).toBeVisible();
  });

  test("UI texts come from the de locale (S7d i18n)", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();
    const item = root.locator("[data-cart-item]").first();
    await expect(root.locator(".cart-page__subtitle")).toContainText(
      localeValue("de.json", "cart.items_count.one").replace("{{ count }}", "1")
    );
    await expect(item.locator("[data-cart-qty-decrement]")).toHaveAttribute("aria-label", localeValue("de.json", "cart.qty_decrease"));
    await expect(item.locator("[data-cart-qty-increment]")).toHaveAttribute("aria-label", localeValue("de.json", "cart.qty_increase"));
    await expect(item.locator("[data-cart-qty-input]")).toHaveAttribute("aria-label", localeValue("de.json", "cart.quantity"));
    await expect(item.locator("[data-cart-item-remove]")).toHaveText(localeValue("de.json", "cart.remove"));
    const summary = root.locator("[data-cart-summary]");
    await expect(summary).toContainText(localeValue("de.json", "cart.subtotal"));
    await expect(summary).toContainText(localeValue("de.json", "cart.total"));
    await expect(summary).toContainText(localeValue("de.json", "cart.tax_included"));
  });

  test("Checkout button uses the scheme-sand primary button colors (contrast >= 4.5)", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();
    await expect(root).toHaveClass(/color-scheme-sand/);
    const colors = await root.locator("[data-cart-checkout]").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color };
    });
    expect(colors.bg).toBe("rgb(28, 73, 72)"); // #1c4948
    expect(colors.fg).toBe("rgb(255, 253, 248)"); // #fffdf8
  });

  test("Quantity change posts to cart/change.js under the locale root", async ({ page }) => {
    const root = page.locator("[data-section-type='cart']").first();
    const expected = await page.evaluate(
      () => ((window as any).Shopify?.routes?.root || "/").replace(/\/?$/, "/") + "cart/change.js"
    );
    const req = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === expected);
    await page.route("**/cart/change.js", (route) => route.fulfill({ status: 200, body: "{}" }));
    await root.locator("[data-cart-qty-increment]").first().click();
    await req;
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
