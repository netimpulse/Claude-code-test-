import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("footer", () => {
  test("renders block columns and bottom bar on home", async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "domcontentloaded" });

    const footer = page.locator("footer.footer");
    await expect(footer).toBeVisible();

    // Block columns from footer-group.json defaults
    await expect(footer.locator(".footer__columns")).toBeVisible();
    await expect(footer.locator(".footer__column")).toHaveCount(6);

    // Newsletter form is functional
    const newsletterInput = footer.locator('input[type="email"][name="contact[email]"]');
    await expect(newsletterInput).toBeVisible();
    await expect(footer.locator('button[name="commit"]')).toBeVisible();

    // Bottom bar with copyright + native Shopify policies
    const bottom = footer.locator(".footer__bottom");
    await expect(bottom).toBeVisible();
    await expect(bottom.locator(".footer__copyright")).toContainText(new Date().getFullYear().toString());
    // Privacy policy is always set on a dev store
    await expect(bottom.locator('a[href="/policies/privacy-policy"]')).toBeVisible();
  });
});
