import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-QA Konfiguration.
 *
 * Die baseURL ist nur der Host des Dev-Stores. Pfad und preview_theme_id
 * werden pro Test individuell gesetzt — siehe tests/fixtures.ts und die
 * Helper-Funktion withTheme().
 *
 * Damit kann derselbe Test-Runner sowohl die QA-Block-Page als auch
 * Product-, Collection-, Cart- und andere Storefront-Routen testen.
 *
 * Storefront-Passwort-Auth via tests/global-setup.ts und storageState.
 */
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/global-setup.ts", "**/fixtures.ts"],
  timeout: 30_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "https://dev-store-4ogqgshg.myshopify.com",
    storageState: "playwright/.auth/storefront.json",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { widt