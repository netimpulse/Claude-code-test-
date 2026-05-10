import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-QA Konfiguration.
 *
 * Die Theme-ID ist pro Repo fix und wird genau einmal gesetzt:
 * - Beim ersten "shopify theme push --unpublished" parst Claude die ID
 *   aus der CLI-Ausgabe und ersetzt den Platzhalter __THEME_ID__ unten.
 * - Danach bleibt diese URL fuer die Lebenszeit des Repos unveraendert.
 *
 * Domain ist konstant, da alle Themes im selben Dev-Store entwickelt werden.
 */
const baseURL =
  "https://dev-store-4ogqgshg.myshopify.com/pages/qa-block-test?preview_theme_id=__THEME_ID__";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
