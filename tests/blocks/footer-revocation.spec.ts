import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Footer revocation button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "domcontentloaded" });
  });

  test("Stand-alone Widerruf button is rendered in the footer base row", async ({ page }) => {
    const btn = page.locator(".ni-footer__revocation");
    await expect(btn).toHaveCount(1);
    const text = (await btn.textContent()) || "";
    expect(text.trim().length).toBeGreaterThan(0);
    await expect(btn).toBeVisible();
  });

  test("Sits on the right of the footer base row (not inside the legal list)", async ({ page }) => {
    const btn = page.locator(".ni-footer__revocation");
    // 1. Not nested inside any legal list — it is its own thing.
    const inLegal = await btn.evaluate(
      (el) => !!el.closest(".ni-footer__col-list"),
    );
    expect(inLegal).toBe(false);
    // 2. Sits in the base row, to the right of the copyright on desktop.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "domcontentloaded" });
    const baseRect = await page
      .locator(".ni-footer__base")
      .first()
      .boundingBox();
    const btnRect = await page
      .locator(".ni-footer__revocation")
      .boundingBox();
    if (!baseRect || !btnRect) throw new Error("base/button rect missing");
    // Button's right edge should be near the right edge of the base row.
    const rightGap = baseRect.x + baseRect.width - (btnRect.x + btnRect.width);
    expect(rightGap).toBeLessThan(40);
  });

  test("Links to a real URL (own setting or Shopify cancellation policy)", async ({ page }) => {
    const href = await page.locator(".ni-footer__revocation").getAttribute("href");
    expect(href).toBeTruthy();
    expect((href || "").trim().length).toBeGreaterThan(1);
    expect(href).not.toBe("#");
  });
});
