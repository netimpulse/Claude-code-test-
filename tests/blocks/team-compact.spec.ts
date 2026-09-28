import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/team-compact.liquid – SYS §6 "Team" (Plan S5c).
 * R1: the section lives on the home page, not on the QA block page.
 * Target: scheme-1 (sand #efe6d8), eyebrow + h2 with serif accent,
 * portraits 3:4 with 16px radius, empty state = black tile with the
 * initial in Newsreader italic + "photo pending" tag, secondary button.
 * Mobile 390: portraits 2 + 1 (odd last one spans the row at 16:10).
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

  test("Renders eyebrow, h2 with one serif accent, intro, button and at least three members", async ({ page }) => {
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

    const cta = section.locator("a.btn.btn--secondary.team-compact__cta");
    await expect(cta).toHaveText(/Team kennenlernen/);
    expect(await cta.getAttribute("href")).toBeTruthy();

    expect(await section.locator(".team-compact__member").count()).toBeGreaterThanOrEqual(3);
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
      return bad;
    });
    expect(offenders).toEqual([]);
  });

  test("Portraits are 3:4 with 16px radius, names in Bricolage 500", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const photos = section.locator(".team-compact__photo");
    const count = await photos.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const s = await photos.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { ratio: r.height / r.width, radius: getComputedStyle(el).borderTopLeftRadius };
      });
      expect(s.ratio, `photo ${i} ratio`).toBeGreaterThan(4 / 3 - 0.02);
      expect(s.ratio, `photo ${i} ratio`).toBeLessThan(4 / 3 + 0.02);
      expect(s.radius, `photo ${i} radius`).toBe("16px");
    }

    // Three portraits in one row on desktop.
    const tops = await section
      .locator(".team-compact__member")
      .evaluateAll((els) => els.slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);

    const name = await section.locator(".team-compact__name").first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, weight: cs.fontWeight };
    });
    expect(name.family).toMatch(/Bricolage Grotesque/);
    expect(name.weight).toBe("500");
  });

  test("Member without photo shows the black empty state with initial and 'photo pending' tag", async ({ page }) => {
    const empty = page.locator(".team-compact .team-compact__member--empty").first();
    test.skip((await empty.count()) === 0, "Every member has a photo in index.json");

    await expect(empty.locator("img")).toHaveCount(0);
    const photoBg = await empty
      .locator(".team-compact__photo")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(photoBg).toBe("rgb(13, 13, 13)");

    const nameText = ((await empty.locator(".team-compact__name").textContent()) ?? "").trim();
    const initial = empty.locator(".team-compact__initial");
    await expect(initial).toHaveAttribute("aria-hidden", "true");
    await expect(initial).toHaveText(nameText.charAt(0).toUpperCase());
    const initialStyle = await initial.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { family: cs.fontFamily, style: cs.fontStyle, color: cs.color };
    });
    expect(initialStyle.family).toMatch(/Newsreader/);
    expect(initialStyle.style).toBe("italic");
    expect(initialStyle.color).toBe("rgb(158, 203, 208)");

    const tag = empty.locator(".team-compact__tag");
    await expect(tag).toHaveText(/^(Foto folgt|Photo coming soon)$/);
    const tagColors = await tag.evaluate((el) => ({
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el.parentElement as HTMLElement).backgroundColor,
    }));
    expect(contrast(tagColors.fg, tagColors.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("Text and button meet 4.5:1 on sand", async ({ page }) => {
    const section = page.locator(".team-compact").first();
    const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
    for (const sel of [".team-compact__heading", ".team-compact__intro", ".team-compact__name", ".team-compact__cta"]) {
      const fg = await section.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
      expect(contrast(fg, bg), `${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("Keyboard focus on the button is visible (2px teal outline)", async ({ page }) => {
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

  test("Mobile 390: portraits 2 + 1, odd last one spans the row at 16:10, button full width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const section = page.locator(".team-compact").first();
    const list = section.locator(".team-compact__people");
    const cols = await list.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(2);

    const members = section.locator(".team-compact__member");
    const count = await members.count();
    if (count % 2 === 1) {
      const last = members.nth(count - 1);
      const listBox = await list.boundingBox();
      const lastBox = await last.boundingBox();
      if (!listBox || !lastBox) throw new Error("bbox null");
      expect(Math.abs(lastBox.width - listBox.width)).toBeLessThanOrEqual(1);
      const ratio = await last
        .locator(".team-compact__photo")
        .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
      expect(ratio).toBeGreaterThan(1.6 - 0.03);
      expect(ratio).toBeLessThan(1.6 + 0.03);
    }

    const inner = await section.locator(".team-compact__inner").boundingBox();
    const cta = await section.locator(".team-compact__cta").boundingBox();
    if (!inner || !cta) throw new Error("bbox null");
    const pad = await section
      .locator(".team-compact__inner")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight));
    expect(Math.abs(cta.width - (inner.width - pad))).toBeLessThanOrEqual(1);
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
