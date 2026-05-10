import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Generische Visual-Checks, die fuer JEDE Section / JEDEN Block laufen.
 * Sie wissen nichts ueber die konkrete Funktionalitaet, sondern pruefen nur,
 * dass die QA-Page ueberhaupt sauber rendert.
 *
 * Block-spezifische Tests legt Claude unter tests/blocks/<name>.spec.ts an.
 */

test.describe("QA Block – Generische Visual-Checks", () => {
  test("Page rendert ohne Konsolen- oder Page-Errors", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    const response = await page.goto("/", { waitUntil: "networkidle" });
    expect(response?.ok(), `HTTP-Status: ${response?.status()}`).toBe(true);

    const dir = "qa-screenshots";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, `${testInfo.project.name}-base.png`),
      fullPage: true,
    });

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Hauptinhalt sichtbar (kein leeres Layout)", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main, [role='main'], #MainContent").first();
    await expect(main).toBeVisible();
    const box = await main.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(50);
  });

  test("Keine offensichtlich kaputten Bilder", async ({ page }) => {
    await page.goto("/");
    const broken = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs
        .filter((img) => img.complete && img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src);
    });
    expect(broken, `Defekte Bilder:\n${broken.join("\n")}`).toEqual([]);
  });
});
