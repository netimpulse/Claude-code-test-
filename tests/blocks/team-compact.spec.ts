import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/team-compact.liquid – SYS §6 "Team", compact teaser (user request:
 * "minimalistisch und nicht so riesig").
 * R1: the section lives on the home page, not on the QA block page.
 * Target: scheme-1 (sand #efe6d8), one calm row without a box: eyebrow + h2
 * with serif accent + text link on the left, muted intro (≤ 48ch) in the
 * middle, a row of small round avatars (≤ 72px, slightly overlapping, 2px
 * ring in the surface colour) with a name label line on the right.
 * Empty state: ink circle with the initial in Newsreader italic (accent).
 * Section height at 1280 ≤ 420px. Mobile: stacked, avatars stay one row.
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

test.describe("Team compact", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(withTheme(QA.paths.home), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".team-compact", { timeout: 15_000 });
    await page.locator(".team-compact").first().scrollIntoViewIfNeeded();
  });

  test("Renders eyebrow, h2 with one serif accent, intro, text link and at least three members", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".team-compact__kicker.eyebrow")).toHaveText(/Team/);

    const heading = section.locator("h2.team-compact__heading");
    await expect(heading).toContainText("Direkt. Klar.");
    const accent = heading.locator("em.it");
    await expect(accent).toHaveCount(1);
    await expect(accent).toHaveText("Ohne Umwege.");
    expect(await heading.textContent()).not.toContain("*");

    await expect(section.locator(".team-compact__intro")).toBeVisible();

    const cta = section.locator("a.text-link.team-compact__cta");
    await expect(cta).toHaveText(/Team kennenlernen\s*→/);
    expect(await cta.getAttribute("href")).toBeTruthy();
    await expect(section.locator(".btn")).toHaveCount(0);

    expect(await section.locator(".team-compact__member").count()).toBeGreaterThanOrEqual(3);
    const names = section.locator(".team-compact__names .team-compact__name");
    expect(await names.count()).toBeGreaterThanOrEqual(3);
    await expect(names.first()).not.toBeEmpty();
  });

  test("Compact: section at most ~420px high at 1280, head · intro · avatars in one row", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const box = await section.boundingBox();
    if (!box) throw new Error("bbox null");
    expect(box.height, `section height ${box.height}`).toBeLessThanOrEqual(420);

    const cols = await section.evaluate((root) => {
      const pick = (sel: string) => root.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
      const h = pick(".team-compact__head");
      const i = pick(".team-compact__intro");
      const c = pick(".team-compact__crew");
      return { h, i, c };
    });
    // Left → middle → right, horizontally side by side and vertically overlapping.
    expect(cols.h.right).toBeLessThanOrEqual(cols.i.left + 1);
    expect(cols.i.right).toBeLessThanOrEqual(cols.c.left + 1);
    expect(cols.i.top).toBeLessThan(cols.h.bottom);
    expect(cols.c.top).toBeLessThan(cols.h.bottom);

    // h2 stays small: between --text-h3 and 2.75rem (44px).
    const fs = await section
      .locator(".team-compact__heading")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThanOrEqual(24);
    expect(fs).toBeLessThanOrEqual(44.5);

    // Intro width ≤ ~48ch.
    const intro = await section.locator(".team-compact__intro").evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;width:48ch";
      el.appendChild(probe);
      const limit = probe.getBoundingClientRect().width;
      probe.remove();
      return { width: el.getBoundingClientRect().width, limit, color: getComputedStyle(el).color };
    });
    expect(intro.width).toBeLessThanOrEqual(intro.limit + 1);
    expect(intro.color).toBe("rgb(87, 82, 74)");

    // Section padding is capped well below --section-y.
    const pad = await section.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(pad).toBeLessThanOrEqual(96);
  });

  test("Sand surface from scheme-1, no boxes, shadows or gradients", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    await expect(section).toHaveClass(/\bcolor-scheme-1\b/);
    const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgb(239, 230, 216)");

    const offenders = await section.evaluate((root) => {
      const bad: string[] = [];
      const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
      for (const el of all) {
        for (const pseudo of [null, "::before", "::after"]) {
          const cs = getComputedStyle(el, pseudo);
          if (cs.boxShadow !== "none") bad.push(`${el.className}${pseudo ?? ""} box-shadow`);
          if (cs.backgroundImage.includes("gradient")) bad.push(`${el.className}${pseudo ?? ""} gradient`);
          const backdrop = cs.getPropertyValue("backdrop-filter") || "none";
          if (cs.filter !== "none" || backdrop !== "none") bad.push(`${el.className}${pseudo ?? ""} filter`);
        }
      }
      // No card/box around the content: head, intro and crew carry no border or own surface.
      for (const sel of [".team-compact__inner", ".team-compact__head", ".team-compact__intro", ".team-compact__crew"]) {
        const el = root.querySelector<HTMLElement>(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        if (parseFloat(cs.borderTopWidth) > 0) bad.push(`${sel} border`);
        if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") bad.push(`${sel} background`);
      }
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test("Avatars are small circles (≤ 72px), slightly overlapping, with a 2px ring in the surface colour", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
    const avatars = section.locator(".team-compact__photo");
    const count = await avatars.count();
    expect(count).toBeGreaterThanOrEqual(3);

    const boxes = await avatars.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: r.left,
          right: r.right,
          top: Math.round(r.top),
          w: r.width,
          h: r.height,
          radius: cs.borderTopLeftRadius,
          ring: cs.borderTopWidth,
          ringStyle: cs.borderTopStyle,
          ringColor: cs.borderTopColor,
        };
      })
    );
    for (const [i, b] of boxes.entries()) {
      expect(b.w, `avatar ${i} width`).toBeLessThanOrEqual(72);
      expect(b.w, `avatar ${i} width`).toBeGreaterThanOrEqual(48);
      expect(Math.abs(b.w - b.h), `avatar ${i} square`).toBeLessThanOrEqual(1);
      expect(b.radius, `avatar ${i} round`).toBe("50%");
      expect(b.ring, `avatar ${i} ring`).toBe("2px");
      expect(b.ringStyle).toBe("solid");
      expect(b.ringColor).toBe(bg);
    }
    // One row, each next avatar overlaps the previous one slightly (1–24px).
    expect(new Set(boxes.map((b) => b.top)).size).toBe(1);
    for (let i = 1; i < boxes.length; i++) {
      const overlap = boxes[i - 1].right - boxes[i].x;
      expect(overlap, `overlap ${i}`).toBeGreaterThan(1);
      expect(overlap, `overlap ${i}`).toBeLessThanOrEqual(24);
    }

    // Names as a small label line under the avatars.
    const label = await section.locator(".team-compact__names").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fs: parseFloat(cs.fontSize), transform: cs.textTransform, top: el.getBoundingClientRect().top };
    });
    expect(label.fs).toBeLessThanOrEqual(14);
    expect(label.transform).toBe("uppercase");
    expect(label.top).toBeGreaterThanOrEqual(boxes[0].top + boxes[0].h - 1);
  });

  test("Member without photo shows an ink circle with the initial in Newsreader italic", async ({ page }) => {
    const empty = page.locator(".team-compact .team-compact__member--empty").first();
    test.skip((await empty.count()) === 0, "Every member has a photo in index.json");

    await expect(empty.locator("img")).toHaveCount(0);
    const circle = await empty.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, w: r.width };
    });
    expect(circle.bg).toBe("rgb(13, 13, 13)");
    expect(circle.radius).toBe("50%");
    expect(circle.w).toBeLessThanOrEqual(72);

    // Position of the empty avatar = position of its name in the label line.
    const index = await empty.evaluate((el) => Array.from(el.parentElement!.children).indexOf(el));
    const nameText = (
      (await page.locator(".team-compact .team-compact__names .team-compact__name").nth(index).textContent()) ?? ""
    ).trim();
    const initial = empty.locator(".team-compact__initial");
    await expect(initial).toHaveText(nameText.charAt(0).toUpperCase());
    const initialStyle = await initial.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, style: cs.fontStyle, color: cs.color };
    });
    expect(initialStyle.family).toMatch(/Newsreader/);
    expect(initialStyle.style).toBe("italic");
    expect(initialStyle.color).toBe("rgb(158, 203, 208)");
    expect(contrast(initialStyle.color, circle.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("Text and link meet 4.5:1 on sand", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
    for (const sel of [
      ".team-compact__kicker",
      ".team-compact__heading",
      ".team-compact__intro",
      ".team-compact__names",
      ".team-compact__cta",
    ]) {
      const fg = await section.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
      expect(contrast(fg, bg), `${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("Keyboard focus on the link is visible (2px teal outline)", async ({ page }) => {
    const cta = page.locator(".team-compact .team-compact__cta").first();
    await cta.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(cta).toBeFocused();
    const outline = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expect(outline.color).toBe("rgb(28, 73, 72)");
  });

  test("R4: --fs-heading and --fs-text scale the h2 and the intro", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const sizes = await section.evaluate((el) => {
      const h = el.querySelector<HTMLElement>(".team-compact__heading")!;
      const p = el.querySelector<HTMLElement>(".team-compact__intro")!;
      const before = [parseFloat(getComputedStyle(h).fontSize), parseFloat(getComputedStyle(p).fontSize)];
      (el as HTMLElement).style.setProperty("--fs-heading", "2");
      (el as HTMLElement).style.setProperty("--fs-text", "2");
      const after = [parseFloat(getComputedStyle(h).fontSize), parseFloat(getComputedStyle(p).fontSize)];
      return { before, after };
    });
    expect(sizes.after[0] / sizes.before[0]).toBeGreaterThan(1.96);
    expect(sizes.after[0] / sizes.before[0]).toBeLessThan(2.04);
    expect(sizes.after[1] / sizes.before[1]).toBeGreaterThan(1.96);
    expect(sizes.after[1] / sizes.before[1]).toBeLessThan(2.04);
  });

  test("Mobile 390: stacked head → intro → avatars, avatars stay one row", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const section = page.locator(".team-compact").first();
    const r = await section.evaluate((root) => {
      const pick = (sel: string) => root.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
      const tops = Array.from(root.querySelectorAll<HTMLElement>(".team-compact__photo")).map((el) =>
        Math.round(el.getBoundingClientRect().top)
      );
      const widths = Array.from(root.querySelectorAll<HTMLElement>(".team-compact__photo")).map(
        (el) => el.getBoundingClientRect().width
      );
      return { h: pick(".team-compact__head"), i: pick(".team-compact__intro"), c: pick(".team-compact__crew"), tops, widths };
    });
    expect(r.i.top).toBeGreaterThanOrEqual(r.h.bottom - 1);
    expect(r.c.top).toBeGreaterThanOrEqual(r.i.bottom - 1);
    expect(new Set(r.tops).size).toBe(1);
    for (const w of r.widths) expect(w).toBeLessThanOrEqual(72);
  });

  for (const width of [390, 320]) {
    test(`No horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const overflow = await page.locator(".team-compact").first().evaluate((sec) => {
        const vw = document.documentElement.clientWidth;
        let worst = 0;
        sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const right = el.getBoundingClientRect().right;
          if (right > vw) worst = Math.max(worst, right - vw);
        });
        return worst;
      });
      expect(overflow).toBeLessThanOrEqual(1);
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(pageOverflow).toBeLessThanOrEqual(0);
    });
  }

  test("Captures desktop + mobile screenshot", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: "qa-screenshots/team-compact-desktop.png" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: "qa-screenshots/team-compact-mobile.png" });
  });
});
