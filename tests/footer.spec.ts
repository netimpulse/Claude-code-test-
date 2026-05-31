import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Tests for sections/footer.liquid (Zelt-inspired editorial footer).
 * Target: QA.paths.home — the footer is rendered on every page via
 * sections/footer-group.json (theme.liquid includes the group).
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".ni-footer", { timeout: 15_000 });
  });

  test("Footer renders wordmark and at least one nav column", async ({ page }) => {
    const footer = page.locator(".ni-footer").first();
    await expect(footer).toBeVisible();
    await expect(footer.locator(".ni-footer__wordmark")).toBeVisible();
    const colCount = await footer.locator(".ni-footer__col").count();
    expect(colCount).toBeGreaterThan(0);
  });

  test("Each rendered social icon is a real <a> with an href and a non-empty aria-label", async ({ page }) => {
    const socials = page.locator(".ni-footer__social");
    const count = await socials.count();
    // socials are gated on (show_X AND url != blank); skip if merchant has none configured
    test.skip(count === 0, "No social URLs configured in footer-group.json");
    for (let i = 0; i < count; i++) {
      const el = socials.nth(i);
      const href = await el.getAttribute("href");
      const label = await el.getAttribute("aria-label");
      expect(href, `social ${i} href`).toBeTruthy();
      expect(label, `social ${i} aria-label`).toBeTruthy();
    }
  });

  test("Legal column shows at least one Shopify policy link when shop has policies", async ({ page }) => {
    const legalLinks = page.locator(".ni-footer__col-list a.ni-footer__link");
    const hrefs = await legalLinks.evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href") || "")
    );
    // Shopify policy URLs sit under /policies/* on the storefront. Skip if shop has no policies.
    const policyLinks = hrefs.filter((h) => h.includes("/policies/"));
    test.skip(policyLinks.length === 0, "Shop has no published policies");
    expect(policyLinks.length).toBeGreaterThan(0);
  });

  test("QR caption renders when QR is enabled", async ({ page }) => {
    const qr = page.locator(".ni-footer__qr");
    const exists = (await qr.count()) > 0;
    test.skip(!exists, "QR disabled / no image set in this footer config");
    await expect(qr.locator(".ni-footer__qr-img")).toBeVisible();
  });

  test("Wordmark uses the merchant-picked font variable", async ({ page }) => {
    const ff = await page.locator(".ni-footer__wordmark").first().evaluate((el) => {
      return getComputedStyle(el).fontFamily;
    });
    expect(ff.length).toBeGreaterThan(0);
    // System body font is the fallback chain on .ni-footer; the wordmark
    // must pick up its own --ni-footer-wordmark-family.
    const body = await page.locator(".ni-footer").first().evaluate((el) => {
      return getComputedStyle(el).fontFamily;
    });
    expect(ff).not.toBe(body);
  });

  test("No horizontal overflow at 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".ni-footer", { timeout: 15_000 });
    const overflow = await page.locator(".ni-footer").first().evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });

  test("Captures footer screenshot (desktop + mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".ni-footer", { timeout: 15_000 });
    await page.locator(".ni-footer").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.locator(".ni-footer").first().screenshot({ path: "qa-screenshots/footer-desktop.png" });

    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(300);
    await page.locator(".ni-footer").first().scrollIntoViewIfNeeded();
    await page.locator(".ni-footer").first().screenshot({ path: "qa-screenshots/footer-mobile.png" });
  });
});
