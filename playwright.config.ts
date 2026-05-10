import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-QA Konfiguration.
 *
 * Die Theme-ID ist pro Repo fix und wird genau einmal gesetzt:
 * - Beim ersten Setup parst Claude die ID aus dem Shopify-Connector
 *   (oder aus der CLI-Ausgabe) und ersetzt den Platzhalter __THEME_ID__.
 * - Danach bleibt diese URL fuer die Lebenszeit des Repos unveraendert.
 *
 * Domain ist konstant, da alle Themes im selben Dev-Store entwickelt werden.
 *
 * Authentifizierung gegen den Storefront-Passwortschutz erfolgt einmal in
 * tests/global-setup.ts und wird via storageState an alle Tests vererbt.
 */
const baseURL =
  "https://dev-store-4ogqgshg.myshopify.com/pages/qa-block-test?preview_theme_id=__THEME_ID__";

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/global-setup.ts"],
  timeout: 30_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL,
    storageState: "playwright/.auth/storefront.json",
    screenshot: "only-on-failure",
    