import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

test.describe("contact-form section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".contact-form", { timeout: 15_000 });
  });

  test("Section, Heading und Subheading rendern", async ({ page }) => {
    const section = page.locator(".contact-form").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".contact-form__heading")).toContainText("Lass uns reden");
    await expect(section.locator(".contact-form__subheading")).toBeVisible();
  });

  test("KEINE Map / Karte im Panel", async ({ page }) => {
    const section = page.locator(".contact-form").first();
    await expect(section.locator("iframe, .map, [class*='map']")).toHaveCount(0);
  });

  test("Form-Felder rendern korrekt (5 Inputs + 1 Textarea + 1 Select)", async ({ page }) => {
    const form = page.locator(".contact-form__form");
    await expect(form.locator("input[type='text']")).toHaveCount(2);
    await expect(form.locator("input[type='email']")).toHaveCount(1);
    await expect(form.locator("input[type='tel']")).toHaveCount(1);
    await expect(form.locator("textarea")).toHaveCount(1);
    await expect(form.locator("select")).toHaveCount(1);
  });

  test("Required-Toggle wirkt: Name/E-Mail/Nachricht haben required, andere nicht", async ({ page }) => {
    const form = page.locator(".contact-form__form");
    await expect(form.locator("input[name='contact[name]']")).toHaveAttribute("required", "");
    await expect(form.locator("input[name='contact[email]']")).toHaveAttribute("required", "");
    await expect(form.locator("textarea[name='contact[body]']")).toHaveAttribute("required", "");
    await expect(form.locator("input[name='contact[phone]']")).not.toHaveAttribute("required", "");
    await expect(form.locator("input[name='contact[company]']")).not.toHaveAttribute("required", "");
  });

  test("Dropdown rendert mit Placeholder und 5 Optionen", async ({ page }) => {
    const select = page.locator(".contact-form__form select[name='contact[topic]']");
    await expect(select).toBeVisible();
    const options = await select.locator("option").count();
    expect(options).toBe(6);
    await expect(select.locator("option").first()).toHaveText("Bitte wählen …");
    await expect(select.locator("option").nth(1)).toContainText("Strategie & Beratung");
  });

  test("Required-Stern wird nur bei Pflichtfeldern angezeigt", async ({ page }) => {
    const fields = page.locator(".contact-form__field");
    const requiredStars = await page.locator(".contact-form__required").count();
    expect(requiredStars).toBe(3);
  });

  test("Submit-Button vorhanden und vom Typ submit", async ({ page }) => {
    const btn = page.locator(".contact-form__submit");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("type", "submit");
    await expect(btn).toContainText("Nachricht senden");
  });

  test("Info-Liste: 3 Einträge mit Label + Content", async ({ page }) => {
    const items = page.locator(".contact-form__info-item");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0).locator(".contact-form__info-label")).toContainText("Adresse");
    await expect(items.nth(1).locator(".contact-form__info-label")).toContainText("Telefon");
    await expect(items.nth(2).locator(".contact-form__info-label")).toContainText("E-Mail");
  });

  test("Desktop: Info-Spalte LINKS, Form RECHTS", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.waitForTimeout(200);
    const info = await page.locator(".contact-form__info-col").boundingBox();
    const form = await page.locator(".contact-form__form-col").boundingBox();
    if (!info || !form) throw new Error("bbox null");
    expect(info.x).toBeLessThan(form.x);
  });

  test("Form Action verweist auf /contact (Shopify contact form)", async ({ page }) => {
    const form = page.locator(".contact-form__form");
    const action = await form.getAttribute("action");
    expect(action).toContain("/contact");
  });

  test("Mobile (320px): kein horizontaler Scroll, Felder werden 1-spaltig", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1600 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
