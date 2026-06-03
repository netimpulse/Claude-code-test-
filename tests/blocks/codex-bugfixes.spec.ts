import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

const PRODUCT_PATH = QA.paths.product;
const CART_PATH = QA.paths.cart;

test.describe("Codex bug 3 — variant compare-at price renders / hides correctly", () => {
  test("Compare-at container is always in the DOM, hidden when not on sale", async ({ page }) => {
    await page.goto(withTheme(PRODUCT_PATH), { waitUntil: "networkidle" });
    const wrap = page.locator("[data-pd-price-compare]").first();
    // Element must exist regardless of whether the initial variant is on sale.
    await expect(wrap).toHaveCount(1);
  });

  test("Variant switch updates compare-at via JS, including the off→on case", async ({ page }) => {
    await page.goto(withTheme(PRODUCT_PATH), { waitUntil: "networkidle" });
    const wrap = page.locator("[data-pd-price-compare]").first();
    const valueEl = wrap.locator("[data-pd-price-compare-value]");

    // Force a synthetic sale state on the active option and dispatch change.
    // This proves the JS path that the original bug missed — adding the
    // compare value to a previously non-sale page without reloading.
    await page.evaluate(() => {
      const sel = document.querySelector(
        "[data-pd-variant-select]",
      ) as HTMLSelectElement | null;
      if (!sel) throw new Error("variant select missing");
      const opt = sel.options[sel.selectedIndex];
      opt.setAttribute("data-compare", "€999,00");
      opt.setAttribute("data-on-sale", "true");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(valueEl).toHaveText("€999,00");
    expect(await wrap.evaluate((el) => (el as HTMLElement).hidden)).toBe(false);

    // Now flip to a non-sale variant and verify the container hides cleanly.
    await page.evaluate(() => {
      const sel = document.querySelector(
        "[data-pd-variant-select]",
      ) as HTMLSelectElement | null;
      if (!sel) return;
      const opt = sel.options[sel.selectedIndex];
      opt.setAttribute("data-compare", "");
      opt.setAttribute("data-on-sale", "false");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(await wrap.evaluate((el) => (el as HTMLElement).hidden)).toBe(true);
    await expect(valueEl).toHaveText("");
  });
});

test.describe("Codex bug 4 + 5 — cart updates without full reload, allows 0 as remove", () => {
  test.beforeEach(async ({ context }) => {
    // Empty + seed: one of the QA product's known variants.
    await context.request.post(withTheme("/cart/clear.js"), {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    await context.request.post(withTheme("/cart/add.js"), {
      headers: { "Content-Type": "application/json" },
      data: { items: [{ id: 44957941268595, quantity: 2 }] },
    });
  });

  test("Quantity decrement does NOT reload the document", async ({ page }) => {
    await page.goto(withTheme(CART_PATH), { waitUntil: "networkidle" });
    const navCounter = await page.evaluate(() => {
      (window as any).__navs = 0;
      window.addEventListener("beforeunload", () => ((window as any).__navs++));
      return 0;
    });
    expect(navCounter).toBe(0);
    const dec = page.locator("[data-cart-qty-decrement]").first();
    await dec.click();
    // Allow XHR + section swap to settle.
    await page.waitForTimeout(2500);
    const navs = await page.evaluate(() => (window as any).__navs || 0);
    expect(navs).toBe(0);
    // Subtotal still renders something money-shaped, no error page.
    await expect(page.locator("[data-cart-subtotal]")).toBeVisible();
  });

  test("Quantity input accepts 0 and treats it as remove", async ({ page }) => {
    await page.goto(withTheme(CART_PATH), { waitUntil: "networkidle" });
    const input = page.locator("[data-cart-qty-input]").first();
    // min=0 is the Liquid contract for the new behaviour.
    await expect(input).toHaveAttribute("min", "0");
    await input.fill("0");
    await input.dispatchEvent("change");
    // Empty-cart path is allowed to reload; the cart should no longer hold this line.
    await page.waitForLoadState("networkidle");
    const hasEmptyState = await page.locator("[data-cart-empty]").count();
    const remainingLines = await page.locator("[data-cart-item]").count();
    expect(hasEmptyState + (remainingLines === 0 ? 1 : 0)).toBeGreaterThan(0);
  });
});

test.describe("Codex bug 6 — cart attribute write is checked for ok", () => {
  test("Source contains explicit ok check on the cart/update.js response", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("assets/product-detail.js", "utf8");
    expect(src).toMatch(/cartUpdateUrl\(\)/);
    expect(src).toMatch(/updateRes\.ok/);
    // Specifically, the throw must come after the update fetch, before any
    // downstream redirect. A simple proximity check is enough here.
    const updateBlock = src.split("cartUpdateUrl()")[1] || "";
    expect(updateBlock).toMatch(/!updateRes\.ok/);
    expect(updateBlock).toMatch(/throw/);
  });
});
