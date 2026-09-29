import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/services-orbit.liquid – Leistungsbühne (Plan S6a).
 * R1: the section is not on the QA page, it lives on /pages/leistungen.
 * Target: scheme-sand surface, eyebrow + h1 on Leistungen (heading_tag) (--text-display, accent-heading),
 * a card with 1px line / --r-lg / no shadow, the orbit on a 5 % tinted board,
 * buttons from the scheme roles (.btn), no endless animation, reduced motion
 * respected, 390/320 without horizontal scroll.
 */
async function passChallenge(page: Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  if (!m) throw new Error(`Unparsable colour: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function contrast(a: string, b: string): number {
  const lum = (rgb: [number, number, number]) => {
    const [r, g, bl] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const la = lum(parseRgb(a));
  const lb = lum(parseRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test.describe("Services Orbit (Leistungen)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.leistungen), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("services-orbit [data-node].is-active", { timeout: 15_000 });
    await page.locator(".services-orbit").first().scrollIntoViewIfNeeded();
  });

  test("Renders eyebrow, h1 (page heading), six nodes with labels and exactly one active panel", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".services-orbit__kicker.eyebrow")).toContainText("Unsere Leistungen");
    const title = section.locator("h1.services-orbit__title");
    await expect(title).toBeVisible();
    expect(await title.textContent()).not.toContain("*");
    expect(await title.locator("em.it").count()).toBeLessThanOrEqual(1);

    await expect(section.locator("[data-node]")).toHaveCount(6);
    await expect(section.locator(".services-orbit__node-label")).toHaveCount(6);
    await expect(section.locator("[data-node].is-active")).toHaveCount(1);
    await expect(section.locator(".services-orbit__detail-panel.is-active")).toHaveCount(1);
  });

  test("Sand scheme surface and h1 in the display size", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    await expect(section).toHaveClass(/\bcolor-scheme-sand\b/);
    expect(await section.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(248, 246, 241)");

    const sizes = await section.locator(".services-orbit__title").evaluate((el) => {
      const probe = document.createElement("div");
      probe.style.fontSize = "var(--text-display)";
      el.parentElement!.appendChild(probe);
      const expected = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      return { actual: parseFloat(getComputedStyle(el).fontSize), expected };
    });
    expect(Math.abs(sizes.actual - sizes.expected)).toBeLessThanOrEqual(0.5);
  });

  test("Card: 1px line, --r-lg, surface; board tinted with a smaller radius", async ({ page }) => {
    const panel = page.locator(".services-orbit__panel").first();
    const card = await panel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bw: cs.borderTopWidth, bs: cs.borderTopStyle, r: cs.borderTopLeftRadius, bg: cs.backgroundColor };
    });
    expect(card).toEqual({ bw: "1px", bs: "solid", r: "14.4px", bg: "rgb(255, 253, 248)" });

    const board = await page.locator(".services-orbit__stage").first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { r: cs.borderTopLeftRadius, bg: cs.backgroundColor };
    });
    expect(board.r).toBe("10.4px");
    expect(board.bg).not.toBe(card.bg);
    expect(board.bg).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  });

  test("No shadows, gradients, filters or endless animations", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const offenders = await section.evaluate((root) => {
      const bad: string[] = [];
      const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
      for (const el of all) {
        for (const pseudo of [null, "::before", "::after"]) {
          const cs = getComputedStyle(el, pseudo);
          const name = `${el.className}${pseudo ?? ""}`;
          if (cs.boxShadow !== "none") bad.push(`${name} box-shadow`);
          if (cs.backgroundImage.includes("gradient")) bad.push(`${name} gradient`);
          const backdrop = cs.getPropertyValue("backdrop-filter") || "none";
          if (cs.filter !== "none" || backdrop !== "none") bad.push(`${name} filter`);
          if (cs.animationName !== "none") bad.push(`${name} animation ${cs.animationName}`);
        }
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test("Center title + counter reflect the active service and update on click", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const center = section.locator("[data-center-title]");
    const count = section.locator("[data-count]");

    await expect(center).toHaveText("Suchmaschinenoptimierung");
    await expect(count).toHaveText("01 / 06");

    // Activate the Shopify node (index 4) and confirm content swaps.
    await section.locator("[data-node][data-index='4']").click();
    await page.waitForTimeout(500);

    await expect(center).toHaveText("Shopify-Entwicklung");
    await expect(count).toHaveText("05 / 06");
    await expect(section.locator(".services-orbit__detail-panel[data-index='4']")).toHaveClass(/is-active/);
    await expect(section.locator("[data-node][data-index='4']")).toHaveClass(/is-active/);

    // Progress is drawn via transform (scaleX), not width.
    const scale = await section
      .locator("[data-progress]")
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--progress-scale").trim());
    expect(Number(scale)).toBeCloseTo(5 / 6, 3);
  });

  test("Ring rotates so the active node lands at the top slot", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const rotator = section.locator("[data-rotator]");

    const initial = await rotator.evaluate((el) => getComputedStyle(el).getPropertyValue("--rotation").trim());
    expect(initial).toBe("0deg");

    // SEA sits at angle -30 → rotation should become -90 - (-30) = -60deg.
    await section.locator("[data-node][data-index='1']").click();
    await page.waitForTimeout(500);
    const next = await rotator.evaluate((el) => getComputedStyle(el).getPropertyValue("--rotation").trim());
    expect(next).toBe("-60deg");
  });

  test("Active node and buttons use the scheme roles (teal / surface, ≥ 4.5:1)", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const node = await section.locator("[data-node].is-active").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color };
    });
    expect(node.bg).toBe("rgb(28, 73, 72)");
    expect(contrast(node.fg, node.bg)).toBeGreaterThanOrEqual(4.5);

    const panel = section.locator(".services-orbit__detail-panel.is-active");
    const secondary = panel.locator("a.btn.btn--secondary.services-orbit__btn--secondary");
    await expect(secondary).toBeVisible();
    expect(await secondary.getAttribute("href")).toMatch(/\/pages\/kontakt/);

    const primary = panel.locator("a.btn.btn--primary.services-orbit__btn--primary");
    if (await primary.count()) {
      const href = await primary.getAttribute("href");
      expect(href).not.toBe("#");
      const c = await primary.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color, h: el.getBoundingClientRect().height };
      });
      expect(c.bg).toBe("rgb(28, 73, 72)");
      expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(c.h).toBeGreaterThanOrEqual(46);
    }
    // No dead "#" links anywhere in the section.
    await expect(section.locator('a[href="#"]')).toHaveCount(0);
  });

  test("Benefit dots and progress follow the design accent (no stored one-off colour)", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const dot = await section
      .locator(".services-orbit__detail-panel.is-active .services-orbit__benefits li")
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
    expect(dot).toBe("rgb(28, 73, 72)");
  });

  test("Keyboard: arrows move the selection, focus ring is visible", async ({ page }) => {
    const section = page.locator(".services-orbit").first();
    const first = section.locator("[data-node][data-index='0']");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    const second = section.locator("[data-node][data-index='1']");
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    const outline = await second.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expect(outline.color).toBe("rgb(28, 73, 72)");
  });

  test("Reduced motion: no rotation transition", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(withTheme(QA.paths.leistungen), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector("services-orbit [data-node].is-active", { timeout: 15_000 });
    const durations = await page.locator(".services-orbit").first().evaluate((root) =>
      [".services-orbit__rotator", ".services-orbit__node", ".services-orbit__progress span"].map(
        (sel) => getComputedStyle(root.querySelector(sel)!).transitionDuration
      )
    );
    for (const d of durations) expect(d.split(",").every((v) => parseFloat(v) === 0)).toBe(true);
    await context.close();
  });

  for (const width of [390, 320]) {
    test(`No horizontal scroll at ${width}px, nodes stay on the board`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const outside = await page.locator(".services-orbit__stage").first().evaluate((stage) => {
        const box = stage.getBoundingClientRect();
        const bad: string[] = [];
        stage.querySelectorAll<HTMLElement>("[data-node], .services-orbit__center").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
            bad.push(el.className);
          }
        });
        return bad;
      });
      expect(outside).toEqual([]);
    });
  }

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.waitForTimeout(400);
    const section = page.locator(".services-orbit").first();
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: "qa-screenshots/services-orbit-desktop.png" });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(400);
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: "qa-screenshots/services-orbit-mobile.png" });
  });
});
