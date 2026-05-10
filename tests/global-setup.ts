import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Globaler Setup-Schritt vor allen Playwright-Tests.
 *
 * Ein Shopify Development Store erzwingt einen Storefront-Passwortschutz, der
 * sich nicht deaktivieren laesst. Damit die Tests die Storefront erreichen,
 * loggen wir uns hier einmal ueber /password ein und persistieren die
 * resultierenden Cookies als Storage-State. Alle Test-Workers verwenden
 * danach diesen authentifizierten State (siehe `use.storageState` in
 * playwright.config.ts).
 *
 * Erwartete ENV-Variable:
 *   SHOPIFY_STOREFRONT_PASSWORD  – aktuelles Storefront-Passwort des Dev-Stores
 */
export default async function globalSetup(_config: FullConfig) {
  const STORE_BASE = "https://dev-store-4ogqgshg.myshopify.com";
  const password = process.env.SHOPIFY_STOREFRONT_PASSWORD;

  if (!password) {
    throw new Error(
      "SHOPIFY_STOREFRONT_PASSWORD ist nicht gesetzt. Setze die ENV-Variable " +
        "mit dem Storefront-Passwort des Dev-Stores, bevor Playwright laeuft."
    );
  }

  const authDir = path.resolve("playwright/.auth");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const statePath = path.join(authDir, "storefront.json");

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${STORE_BASE}/password`, { waitUntil: "networkidle" });

  // Robuste Selektoren: sowohl Skeleton als auch Dawn nutzen input[type=password]
  // im einzigen Formular der Password-Page.
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form button[type="submit"]').first().click();

  // Warte bis Shopify uns von /password wegredirected hat
  await page.waitForURL((url) => !url.pathname.startsWith("/password"), {
    timeout: 15_000,
  });

  await context.storageState({ path: statePath });
  await browser.close();
}
