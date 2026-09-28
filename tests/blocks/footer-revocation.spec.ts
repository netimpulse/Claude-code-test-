import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("Footer revocation button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.home), { waitUntil: "domcontentloaded" });
  });

  test("Stand-alone Widerruf button is rendered in the footer base row", async ({ page }) => {
    const btn = page.locator(".ni-footer__revocation");
    await expect(btn).toHaveCount(1);
    const text = (await btn.textContent()) || "";
    expect(text.trim().length).toBeGreaterThan(0);
    await expect(btn).toBeVisible();
  });

  for (const width of [1280, 390]) {
    test(`Is a secondary button in the bottom row below the line (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(withTheme(QA.paths.home), { waitUntil: "domcontentloaded" });
      const btn = page.locator(".ni-footer__revocation");
      // 1. Not a list link: it lives in the bottom row, outside the link columns.
      const place = await btn.evaluate((el) => ({
        inLegal: !!el.closest(".ni-footer__col-list, .ni-footer__nav"),
        inBase: !!el.closest(".ni-footer__base"),
        isButton: el.classList.contains("btn") && el.classList.contains("btn--secondary") && el.classList.contains("btn--sm"),
      }));
      expect(place.inLegal).toBe(false);
      expect(place.inBase).toBe(true);
      expect(place.isButton).toBe(true);
      // 2. Geometry: below the 1px line of the bottom row, fully inside it, after
      //    the copyright in reading order, touch target >= 44px.
      const baseRect = await page.locator(".ni-footer__base").first().boundingBox();
      const btnRect = await btn.boundingBox();
      if (!baseRect || !btnRect) throw new Error("base/button rect missing");
      expect(btnRect.y).toBeGreaterThanOrEqual(baseRect.y);
      expect(btnRect.x).toBeGreaterThanOrEqual(baseRect.x - 1);
      expect(btnRect.x + btnRect.width).toBeLessThanOrEqual(baseRect.x + baseRect.width + 1);
      expect(btnRect.height).toBeGreaterThanOrEqual(44);
      const copyright = page.locator(".ni-footer__base .ni-footer__copyright");
      if ((await copyright.count()) > 0) {
        const follows = await btn.evaluate((el) => {
          const c = document.querySelector(".ni-footer__base .ni-footer__copyright");
          return !!c && !!(c.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
        expect(follows).toBe(true);
      }
      if (width <= 390) {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(overflow).toBe(false);
      }
    });
  }

  test("Text and border reach a contrast of at least 4.5:1 against the footer", async ({ page }) => {
    const res = await page.locator(".ni-footer__revocation").evaluate((el) => {
      const parse = (c: string) => {
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
        if (!m) return null;
        return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
      };
      const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
        const ch = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
      };
      // First opaque background from the button upwards (the button itself is transparent).
      let node: Element | null = el;
      let bg: ReturnType<typeof parse> = null;
      while (node) {
        const c = parse(getComputedStyle(node).backgroundColor);
        if (c && c.a >= 0.99) { bg = c; break; }
        node = node.parentElement;
      }
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const border = parse(cs.borderTopColor);
      if (!bg || !fg || !border) return { error: `${cs.color} / ${cs.borderTopColor} / ${bg}` };
      const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
        const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
      };
      return { text: ratio(fg, bg), border: ratio(border, bg) };
    });
    if ("error" in res) throw new Error(`unexpected colors: ${res.error}`);
    expect(res.text).toBeGreaterThanOrEqual(4.5);
    // Border is a non-text UI boundary (WCAG 1.4.11 needs 3:1); it follows currentColor.
    expect(res.border).toBeGreaterThanOrEqual(3);
  });

  test("Focus ring is visible on keyboard focus", async ({ page }) => {
    const btn = page.locator(".ni-footer__revocation");
    await btn.focus();
    const outline = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test("Links to a real URL (own setting or Shopify cancellation policy)", async ({ page }) => {
    const href = await page.locator(".ni-footer__revocation").getAttribute("href");
    expect(href).toBeTruthy();
    expect((href || "").trim().length).toBeGreaterThan(1);
    expect(href).not.toBe("#");
  });

  test("Color setting drives the resting color via --revocation-color", async ({ page }) => {
    const btn = page.locator(".ni-footer__revocation");
    const baseline = await btn.evaluate((el) => getComputedStyle(el).color);

    // Apply the setting the merchant would set in the editor.
    await btn.evaluate((el) => {
      (el as HTMLElement).style.transition = "none";
      (el as HTMLElement).style.setProperty("--revocation-color", "rgb(255, 0, 0)");
    });
    // The computed color must change away from the inherited baseline and the
    // red channel must dominate. Render pipelines can nudge channels by a few
    // values (color-mix / filter on ancestors), so we don't pin exact RGB.
    const next = await btn.evaluate((el) => getComputedStyle(el).color);
    expect(next).not.toBe(baseline);
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(next || "");
    if (!m) throw new Error(`unexpected color format: ${next}`);
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    expect(r).toBeGreaterThanOrEqual(240);
    expect(g).toBeLessThanOrEqual(20);
    expect(b).toBeLessThanOrEqual(20);
    // currentColor flows to the border in the resting state.
    const border = await btn.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(border).toBe(next);
  });
});
