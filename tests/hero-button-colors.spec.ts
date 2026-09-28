import { test, expect } from "@playwright/test";
import { QA, withTheme } from "./fixtures";

/**
 * Verifies the ni-hero buttons with the per-section button color settings
 * left blank (plan S5a1, Anhang A): they use the .btn classes and the
 * button roles of scheme-sand (primary bg #1c4948 = --color-btn-bg) and
 * keep a text contrast of at least 4.5:1.
 */
async function passChallenge(page: import("@playwright/test").Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unexpected color ${value}`);
  const [r, g, b] = m[1].split(",").map((n) => parseFloat(n));
  return [r, g, b];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(parseRgb(a));
  const lb = luminance(parseRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test.describe("ni-hero button colors", () => {
  test("Primary uses the scheme-sand button role with contrast >= 4.5:1; secondary is outlined", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("ni-hero .ni-btn--primary", { timeout: 15_000 });

    const primary = page.locator("ni-hero a.btn.btn--primary.ni-btn--primary").first();
    const p = await primary.evaluate((el) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement("span");
      probe.style.color = getComputedStyle(el).getPropertyValue("--color-btn-bg").trim();
      el.appendChild(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      return { bg: cs.backgroundColor, color: cs.color, token };
    });
    // scheme-sand primary_button = #1c4948
    expect(p.bg).toBe("rgb(28, 73, 72)");
    expect(p.bg).toBe(p.token);
    expect(contrast(p.bg, p.color)).toBeGreaterThanOrEqual(4.5);

    const secondary = page.locator("ni-hero a.btn.btn--secondary.ni-btn--ghost").first();
    const s = await secondary.evaluate((el) => {
      const cs = getComputedStyle(el);
      let node: Element | null = el;
      let bg = "rgba(0, 0, 0, 0)";
      while (node && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
        bg = getComputedStyle(node).backgroundColor;
        node = node.parentElement;
      }
      return { border: cs.borderTopColor, borderWidth: cs.borderTopWidth, color: cs.color, surface: bg };
    });
    expect(s.borderWidth).toBe("1px");
    expect(s.border).toBe(s.color);
    expect(contrast(s.color, s.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
