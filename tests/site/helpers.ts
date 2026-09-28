import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Gemeinsame Helfer fuer die seitenweiten Qualitaets-Checks (tests/site/*).
 */

/** Scrollt einmal durch die Seite, damit Lazy-Bilder und Scroll-Einblendungen laden. */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
}

/** axe-Lauf ohne die Shopify-Preview-Bar (gehoert nicht zum Theme). */
export async function runAxe(page: Page, rules: string[]) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .exclude("#preview-bar-iframe")
    .exclude("#PBarNextFrameWrapper")
    .analyze();
  return result.violations.filter((v) => rules.includes(v.id));
}

/**
 * Prueft, ob eine echte Schriftdatei (kein synthetischer Schnitt) fuer
 * family/weight/style geladen ist. FontFace.weight ist entweder eine Zahl
 * ("600") oder ein Bereich ("200 800") bei variablen Schriften.
 */
export async function fontFaceLoaded(
  page: Page,
  family: string,
  weight: number,
  style: "normal" | "italic" = "normal"
): Promise<boolean> {
  return page.evaluate(
    async ({ family, weight, style }) => {
      await document.fonts.ready;
      const norm = (f: string) => f.replace(/["']/g, "").trim().toLowerCase();
      for (const face of document.fonts) {
        if (face.status !== "loaded") continue;
        if (norm(face.family) !== norm(family)) continue;
        if (face.style !== style) continue;
        const parts = String(face.weight).split(/\s+/).map(Number);
        const [min, max] = parts.length === 2 ? parts : [parts[0], parts[0]];
        if (weight >= min && weight <= max) return true;
      }
      return false;
    },
    { family, weight, style }
  );
}
