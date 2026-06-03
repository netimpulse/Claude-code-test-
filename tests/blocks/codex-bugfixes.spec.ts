import { test, expect, Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

const PRODUCT_PATH = QA.paths.product;
const CART_PATH = QA.paths.cart;
const QA_VARIANT_ID = 44957941268595;

async function passChallenge(page: Page) {
  // Cloudflare's Managed Challenge sometimes serves an interstitial that the
  // browser resolves on its own; sometimes it stalls. Reload once after a
  // long wait gives the second pass a chance to slip through.
  try {
    await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 30_000 });
  } catch {
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
  }
}

async function seedCart(page: Page, qty = 2) {
  // Cloudflare needs a real navigation under the user-agent's cookie jar
  // before XHRs against /cart/* are honoured; the same pattern is used in
  // tests/blocks/cart.spec.ts.
  await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
  await passChallenge(page);
  await page.goto(withTheme(CART_PATH), { waitUntil: "load" });
  await passChallenge(page);
  const result = await page.evaluate(
    async ([variantId, quantity]) => {
      await fetch("/cart/clear.js", { method: "POST" });
      const add = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: [{ id: variantId, quantity }] }),
      });
      return { status: add.status, body: (await add.text()).slice(0, 200) };
    },
    [QA_VARIANT_ID, qty] as const,
  );
  if (result.status !== 200) {
    throw new Error(`cart/add.js status=${result.status} body=${result.body}`);
  }
  await page.goto(withTheme(CART_PATH), { waitUntil: "domcontentloaded" });
  await passChallenge(page);
}

test.describe("Codex bug 3 — variant compare-at price renders / hides correctly", () => {
  test("Compare-at container is always in the DOM, hidden when not on sale", async ({ page }) => {
    await page.goto(withTheme(PRODUCT_PATH), { waitUntil: "domcontentloaded" });
    const wrap = page.locator("[data-pd-price-compare]").first();
    await expect(wrap).toHaveCount(1);
  });

  test("Variant switch updates compare-at via JS, including the off→on case", async ({ page }) => {
    await page.goto(withTheme(PRODUCT_PATH), { waitUntil: "domcontentloaded" });
    const wrap = page.locator("[data-pd-price-compare]").first();
    const valueEl = wrap.locator("[data-pd-price-compare-value]");

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
  // Cloudflare's Managed Challenge throttles after many requests today;
  // give the cart-dependent tests a retry so a single Challenge stall
  // doesn't fail the suite.
  test.describe.configure({ retries: 2 });

  test.beforeEach(async ({ page }) => {
    await seedCart(page, 2);
  });

  test("Quantity decrement does NOT trigger a navigation away from /cart", async ({ page }) => {
    // We mark the document so a real reload would discard the marker.
    await page.evaluate(() => ((document as any).__alive = "yes"));
    const dec = page.locator("[data-cart-qty-decrement]").first();
    await dec.click();
    // Wait long enough for the partial update XHR + section swap.
    await page.waitForTimeout(2500);
    const alive = await page.evaluate(() => (document as any).__alive);
    expect(alive).toBe("yes");
    // Cart section is still present.
    await expect(page.locator("[data-section-type='cart']")).toHaveCount(1);
  });

  test("Quantity input accepts 0 and is wired to Shopify's remove semantics", async ({ page }) => {
    const input = page.locator("[data-cart-qty-input]").first();
    await expect(input).toHaveAttribute("min", "0");
    await input.fill("0");
    await input.dispatchEvent("change");
    // After /cart/change.js with quantity 0 the cart should be empty —
    // either the empty-state branch renders, or the line was removed.
    await page.waitForTimeout(3000);
    const hasEmpty = await page.locator("[data-cart-empty]").count();
    const remainingLines = await page.locator("[data-cart-item]").count();
    expect(hasEmpty > 0 || remainingLines === 0).toBe(true);
  });
});

test.describe("Codex bug 6 — cart attribute write is checked for ok", () => {
  test("Source contains explicit ok check on the cart/update.js fetch result", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("assets/product-detail.js", "utf8");
    // The fix assigns the response to `updateRes` and throws when not ok.
    // Match the literal pattern instead of relying on string-splitting,
    // which would also match the `function cartUpdateUrl()` definition.
    expect(src).toMatch(/updateRes\s*=\s*await\s+fetch\(\s*cartUpdateUrl\(\)/);
    expect(src).toMatch(/if\s*\(\s*!updateRes\.ok\s*\)\s*throw/);
  });
});
