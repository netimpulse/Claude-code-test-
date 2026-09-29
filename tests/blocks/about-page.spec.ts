import { test, expect, type Page, type Locator } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Über uns (Plan S7a) – about-intro and about-values-thread.
 * R1: neither section is on the QA page; the specs run on the real page
 * /pages/ueber-uns (templates/page.ueber-uns.json, all scheme-sand).
 * Target: about-intro carries the page's only h1 (accent-heading), body and
 * a `.btn.btn--primary`; without a photo it renders without an image column
 * (no grey placeholder). about-values-thread keeps its thread in
 * --color-accent (#1c4948), nodes are round and sit in the middle of each
 * row. No shadows, gradients or blur; no horizontal scroll at 390/320.
 * Expects the template values from S7a (accent_color "" in both sections).
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

const SAND_BG = "rgb(248, 246, 241)";
const TEAL = "rgb(28, 73, 72)";

async function noShadowsOrGradients(section: Locator) {
  return section.evaluate((root) => {
    const bad: string[] = [];
    const all = [root, ...Array.from(root.querySelectorAll<Element>("*"))];
    for (const el of all) {
      for (const pseudo of [null, "::before", "::after"]) {
        const cs = getComputedStyle(el, pseudo);
        const name = `${el.getAttribute("class") ?? el.tagName}${pseudo ?? ""}`;
        if (cs.boxShadow !== "none") bad.push(`${name} box-shadow`);
        if (cs.backgroundImage.includes("gradient")) bad.push(`${name} gradient`);
        const backdrop = cs.getPropertyValue("backdrop-filter") || "none";
        if (cs.filter !== "none" || backdrop !== "none") bad.push(`${name} filter`);
      }
    }
    return bad;
  });
}

async function horizontalOverflow(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((sec) => {
    const vw = document.documentElement.clientWidth;
    let worst = 0;
    sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const right = el.getBoundingClientRect().right;
      if (right > vw) worst = Math.max(worst, right - vw);
    });
    return worst;
  });
}

test.describe("Über uns – about-intro and about-values-thread (S7a)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.ueberUns), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".about-intro", { timeout: 15_000 });
  });

  test("Both sections render on the light sand scheme", async ({ page }) => {
    for (const sel of [".about-intro", ".avt"]) {
      const section = page.locator(sel).first();
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/\bcolor-scheme-sand\b/);
      expect(await section.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(SAND_BG);
    }
  });

  test("Exactly one h1 on the page – the about-intro headline", async ({ page }) => {
    await expect(page.locator("h1")).toHaveCount(1);
    const h1 = page.locator(".about-intro h1.about-intro__heading");
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText("digitale Strukturen");
    expect(await h1.textContent()).not.toContain("*");
    expect(await h1.locator("em.it").count()).toBeLessThanOrEqual(1);
    const ff = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(ff).toMatch(/Bricolage/);
  });

  test("about-intro: eyebrow, body and primary button from the scheme", async ({ page }) => {
    const section = page.locator(".about-intro").first();
    await expect(section.locator(".about-intro__kicker.eyebrow")).toHaveText(/Über uns/i);
    await expect(section.locator(".about-intro__body")).toBeVisible();

    const btn = section.locator("a.btn.btn--primary.about-intro__btn");
    await expect(btn).toHaveCount(1);
    await expect(btn).toContainText("Projekt anfragen");
    const { bg, fg, h, radius } = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, fg: cs.color, h: el.getBoundingClientRect().height, radius: parseFloat(cs.borderTopLeftRadius) };
    });
    expect(bg).toBe(TEAL);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    expect(h).toBeGreaterThanOrEqual(46); // --btn-h at 90 % content scale
    expect(radius).toBeGreaterThan(20);

    const bodyColors = await section.locator(".about-intro__body p").evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).color)
    );
    expect(bodyColors.length).toBeGreaterThan(0);
    for (const c of bodyColors) expect(contrast(c, SAND_BG)).toBeGreaterThanOrEqual(4.5);
  });

  test("about-intro without photo: no image column and no grey placeholder", async ({ page }) => {
    const section = page.locator(".about-intro").first();
    await expect(section).toHaveClass(/about-intro--text-only/);
    await expect(section.locator(".about-intro__frame")).toHaveCount(0);
    await expect(section.locator(".about-intro__placeholder")).toHaveCount(0);
    await expect(section.locator("svg")).toHaveCount(0);
    // The editor hint only exists inside the theme editor.
    await expect(section.locator(".about-intro__editor-hint")).toHaveCount(0);

    // Editorial layout: the body starts right of the page middle on desktop.
    const { bodyLeft, sectionMid } = await section.evaluate((el) => {
      const body = el.querySelector(".about-intro__content")!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { bodyLeft: body.left, sectionMid: r.left + r.width / 2 };
    });
    expect(bodyLeft).toBeGreaterThan(sectionMid - 120);
  });

  test("about-intro: button focus is visible", async ({ page }) => {
    const btn = page.locator(".about-intro__btn").first();
    await btn.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    const outline = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test("about-values-thread: h2, four alternating values, thread in the accent colour", async ({ page }) => {
    const section = page.locator(".avt").first();
    await section.scrollIntoViewIfNeeded();
    const h2 = section.locator("h2.avt__heading");
    await expect(h2).toHaveText(/Werte, die sich durchziehen/);
    expect(await h2.textContent()).not.toContain("*");

    const items = section.locator(".avt__item");
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toHaveClass(/avt__item--left/);
    await expect(items.nth(1)).toHaveClass(/avt__item--right/);
    await expect(section.locator(".avt__title").nth(0)).toHaveText("Klarheit");
    await expect(section.locator(".avt__title").nth(3)).toHaveText("Tempo");

    const d = await section.locator(".avt__path--draw").getAttribute("d");
    expect(d).toContain("C");
    const stroke = await section.locator(".avt__path--draw").evaluate((el) => getComputedStyle(el).stroke);
    expect(stroke).toBe(TEAL);
    const numColor = await section.locator(".avt__num").first().evaluate((el) => getComputedStyle(el).color);
    expect(numColor).toBe(TEAL);

    const textColor = await section.locator(".avt__text").first().evaluate((el) => getComputedStyle(el).color);
    expect(contrast(textColor, SAND_BG)).toBeGreaterThanOrEqual(4.5);
  });

  test("about-values-thread: draws once in view, nodes are round and centred on their row", async ({ page }) => {
    const section = page.locator(".avt").first();
    await section.locator(".avt__stage").scrollIntoViewIfNeeded();
    await expect(section.locator(".avt__stage")).toHaveClass(/is-drawn/, { timeout: 5_000 });
    await page.waitForTimeout(3_200); // let the one-off draw finish

    const nodes = section.locator(".avt__node");
    await expect(nodes).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const info = await page.evaluate((idx) => {
        const node = document.querySelectorAll<HTMLElement>(".avt__node")[idx];
        const item = document.querySelectorAll<HTMLElement>(".avt__item")[idx];
        const n = node.getBoundingClientRect();
        const it = item.getBoundingClientRect();
        const cs = getComputedStyle(node);
        return {
          w: Math.round(n.width),
          h: Math.round(n.height),
          radius: cs.borderTopLeftRadius,
          border: cs.borderTopColor,
          opacity: Number(cs.opacity),
          dy: Math.abs(n.top + n.height / 2 - (it.top + it.height / 2)),
        };
      }, i);
      expect(info.w).toBe(info.h);
      expect(info.radius).toBe("50%");
      expect(info.border).toBe(TEAL);
      expect(info.opacity).toBe(1);
      expect(info.dy).toBeLessThanOrEqual(4);
    }
    // Nothing loops forever.
    const infinite = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity).length
    );
    expect(infinite).toBe(0);
  });

  test("about-values-thread: values stay visible with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(withTheme(QA.paths.ueberUns), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".avt__stage", { timeout: 15_000 });
    await expect(page.locator(".avt__stage")).toHaveClass(/is-drawn/);
    await expect(page.locator(".avt__stage")).not.toHaveClass(/is-armed/);
    const opacities = await page.locator(".avt__card").evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
    for (const o of opacities) expect(o).toBe("1");
    await context.close();
  });

  test("No shadows, gradients or blur in either section", async ({ page }) => {
    for (const sel of [".about-intro", ".avt"]) {
      expect(await noShadowsOrGradients(page.locator(sel).first()), sel).toEqual([]);
    }
  });

  test("Mobile 390: thread on the left, all values in one column", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    const cols = await page.locator(".avt__stage").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(2);
    const lefts = await page.locator(".avt__item").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
  });

  for (const width of [390, 320]) {
    test(`No horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1200 });
      await page.waitForTimeout(300);
      for (const sel of [".about-intro", ".avt"]) {
        expect(await horizontalOverflow(page, sel), sel).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test("Captures full About-page composition screenshot", async ({ page }) => {
    for (const sel of [".about-intro", ".avt", ".about-perspectives"]) {
      await page.locator(sel).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: "qa-screenshots/about-page-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "qa-screenshots/about-page-mobile.png", fullPage: true });
  });
});

/**
 * about-stats, about-values and about-timeline are not used on any live
 * page (plan "Nicht dabei"; about_timeline is disabled on /pages/ueber-uns and
 * none of them is on the QA page any more). The old expectations stay here
 * as a record and are marked fixme instead of deleted – they fail in the
 * baseline for lack of a host page, not because of a regression.
 */
test.describe("Unused About sections (not on any page)", () => {
  test.fixme(true, "about-stats / about-values / about-timeline have no host page (plan: unused sections, report only)");

  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
  });

  test("about-stats: four stats with values and labels", async ({ page }) => {
    const stats = page.locator(".about-stats").first().locator(".about-stats__stat");
    await expect(stats).toHaveCount(4);
    await expect(stats.first().locator(".about-stats__value")).toBeVisible();
    await expect(stats.first().locator(".about-stats__label")).toBeVisible();
  });

  test("about-values: four cards, all with square corners", async ({ page }) => {
    const cards = page.locator(".about-values").first().locator(".about-values__card");
    await expect(cards).toHaveCount(4);
    expect(await cards.first().evaluate((el) => getComputedStyle(el).borderRadius)).toBe("0px");
  });

  test("about-timeline: four milestones, dots are circular", async ({ page }) => {
    const steps = page.locator(".about-timeline").first().locator(".about-timeline__step");
    await expect(steps).toHaveCount(4);
    const dotInfo = await steps.first().locator(".about-timeline__dot").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { radius: getComputedStyle(el).borderRadius, w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(dotInfo.w).toBe(dotInfo.h);
    expect(dotInfo.radius).not.toBe("0px");
  });
});
