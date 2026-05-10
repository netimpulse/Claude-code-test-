import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-QA Konfiguration.
 *
 * Die baseURL zeigt auf das QA-Preview-Theme im Dev-Store. Dieses Theme wird
 * im Skill-Workflow vor jedem Testlauf via Shopify CLI aus der aktuellen
 * Arbeits-Branch gepusht — damit funktioniert die QA-Schleife auch dann,
 * wenn der Code noch auf einer PR-Branch liegt und main noch nicht gemerged
 * wurde.
 *
 * Theme-ID 145381884019 ist pro Repo gleich, weil alle Themes im selben
 * Dev-Store testen.
 *
 * Storefront-Passwort-Auth via tests/global-setup.ts und storageState.
 */
const baseURL =
  "https://dev-store-4ogqgshg.myshopify.com/pages/qa-block-test?preview_theme_id=145381884019";

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
    video: "retain-on-failure"