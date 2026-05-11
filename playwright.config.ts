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
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: "https://dev-store-4ogqgshg.myshopify.com",
    storageState: "playwright/.auth/storefront.json",
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        channel: "chromium",
        launchOptions: {
          args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
          ],
        },
      },
    },
  ],
});
