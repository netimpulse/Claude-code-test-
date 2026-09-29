import { test, expect, type Page, type Locator } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/image-with-text.liquid – Leistungs-Unterseiten (Plan S6c).
 * R1: the section is not on the QA page; it lives on /pages/seo, sea, smm,
 * geo and web-design (7 instances, all scheme-sand).
 * Target: scheme tokens (no lime #b6e84f), h2 via accent-heading (no raw
 * asterisks, at most one serif accent), body in muted, photo with --r-lg and
 * no shadow; without a photo a Tafel graphic (5 % tint, --r-lg − 4px, bars in
 * --color-line, exactly one accent bar in --color-accent #1c4948).
 * Buttons (if a label is set) are `.btn.btn--primary`. No shadows, gradients
 * or blur anywhere. Mobile 390/320 stacks without horizontal scroll.
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
const LINE = "rgb(214, 204, 187)";
const TEAL = "rgb(28, 73, 72)";
const LIME = "182, 232, 79";

type Target = {
  name: string;
  path: string;
  count: number;
  heading: string;
  /** Instances in DOM order: does it have a photo, which side is the media on? */
  instances: { photo: boolean; side: "left" | "right" }[];
};

const PAGES: Target[] = [
  {
    name: "SEO",
    path: QA.paths.seo,
    count: 2,
    heading: "Was ist das NetImpulse-SEO?",
    instances: [
      // templates/page.seo.json references shopify://shop_images/ChatGPT_Image_3._Juni_2026_12_43_48.png,
      // but that file is not in the store's Files (CDN 404), so Shopify resolves the
      // setting to blank and the section correctly renders its Tafel graphic.
      // Set back to photo: true once the image is re-uploaded / re-selected.
      { photo: false, side: "left" },
      { photo: false, side: "right" },
    ],
  },
  { name: "SEA", path: QA.paths.sea, count: 1, heading: "Was ist das NetImpulse SEA?", instances: [{ photo: true, side: "left" }] },
  { name: "SMM", path: QA.paths.smm, count: 1, heading: "Was machen wir im Bereich SMM?", instances: [{ photo: false, side: "left" }] },
  { name: "GEO", path: QA.paths.geo, count: 1, heading: "Unser GEO-Ansatz", instances: [{ photo: true, side: "right" }] },
  {
    name: "Webdesign",
    path: QA.paths.webDesign,
    count: 2,
    heading: "Unser Verständnis von Webdesign",
    instances: [
      { photo: true, side: "left" },
      { photo: false, side: "right" },
    ],
  },
];

async function noShadowsOrGradients(section: Locator) {
  return section.evaluate((root) => {
    const bad: string[] = [];
    const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
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

for (const target of PAGES) {
  test.describe(`image-with-text section (${target.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(withTheme(target.path), { waitUntil: "load" });
      await passChallenge(page);
      await page.waitForSelector(".image-with-text", { timeout: 15_000 });
    });

    test("Renders h2 via accent-heading and body on the light sand scheme", async ({ page }) => {
      const sections = page.locator(".image-with-text");
      await expect(sections).toHaveCount(target.count);

      const first = sections.first();
      await first.scrollIntoViewIfNeeded();
      await expect(first).toHaveClass(/\bcolor-scheme-sand\b/);
      expect(await first.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(SAND_BG);

      const heading = first.locator("h2.image-with-text__heading");
      await expect(heading).toHaveText(target.heading);
      await expect(first.locator(".image-with-text__body")).toBeVisible();

      for (const section of await sections.all()) {
        const h2 = section.locator("h2.image-with-text__heading");
        expect(await h2.textContent()).not.toContain("*");
        expect(await h2.locator("em.it").count()).toBeLessThanOrEqual(1);
      }
    });

    test("No lime, no shadows, gradients or blur", async ({ page }) => {
      for (const section of await page.locator(".image-with-text").all()) {
        expect(await noShadowsOrGradients(section)).toEqual([]);
        const lime = await section.evaluate((root, needle) => {
          const hits: string[] = [];
          for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
            const cs = getComputedStyle(el);
            for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor, cs.fill, cs.stroke]) {
              if (v.includes(needle)) hits.push(`${el.getAttribute("class") ?? el.tagName}: ${v}`);
            }
          }
          return hits;
        }, LIME);
        expect(lime).toEqual([]);
      }
    });

    test("Photo frames are rounded (--r-lg), graphic frames are Tafel graphics with one accent bar", async ({ page }) => {
      const sections = page.locator(".image-with-text");
      for (let i = 0; i < target.instances.length; i++) {
        const section = sections.nth(i);
        await section.scrollIntoViewIfNeeded();
        const frame = section.locator(".image-with-text__frame");
        if (target.instances[i].photo) {
          await expect(frame.locator("img.image-with-text__image")).toHaveCount(1);
          expect(await frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("16px");
          const alt = await frame.locator("img").getAttribute("alt");
          expect(alt ?? "").not.toContain("*");
        } else {
          await expect(frame).toHaveClass(/image-with-text__frame--graphic/);
          const graphic = await frame.evaluate((el) => {
            const cs = getComputedStyle(el);
            const sectionBg = getComputedStyle(el.closest(".image-with-text") as HTMLElement).backgroundColor;
            return { radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, sectionBg };
          });
          expect(graphic.radius).toBe("12px");
          expect(graphic.bg).not.toBe(graphic.sectionBg); // 5 % tint, not the plain surface

          const bars = frame.locator(".image-with-text__bar");
          expect(await bars.count()).toBeGreaterThanOrEqual(4);
          const colours = await bars.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
          expect(colours.filter((c) => c === TEAL)).toHaveLength(1);
          expect(colours.filter((c) => c === LINE)).toHaveLength(colours.length - 1);
          await expect(frame.locator(".image-with-text__graphic")).toHaveAttribute("aria-hidden", "true");
        }
      }
    });

    test("Desktop 1280: media sits on the configured side", async ({ page }) => {
      const sections = page.locator(".image-with-text");
      for (let i = 0; i < target.instances.length; i++) {
        const section = sections.nth(i);
        await section.scrollIntoViewIfNeeded();
        const grid = section.locator(".image-with-text__grid");
        await expect(grid).toHaveClass(new RegExp(`image-with-text--image-${target.instances[i].side}`));
        const media = await section.locator(".image-with-text__media").boundingBox();
        const content = await section.locator(".image-with-text__content").boundingBox();
        if (!media || !content) throw new Error("bbox null");
        if (target.instances[i].side === "right") expect(media.x).toBeGreaterThan(content.x);
        else expect(media.x).toBeLessThan(content.x);
      }
    });

    test("Heading and body text meet 4.5:1", async ({ page }) => {
      for (const section of await page.locator(".image-with-text").all()) {
        const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
        for (const sel of [".image-with-text__heading", ".image-with-text__body"]) {
          const fg = await section.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
          expect(contrast(fg, bg), `${sel} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test("Optional button and badge follow the design system when present", async ({ page }) => {
      const buttons = page.locator(".image-with-text__actions a");
      const badges = page.locator(".image-with-text__badge");
      test.skip(
        (await buttons.count()) + (await badges.count()) === 0,
        "No instance on this page has a button label or the badge switched on."
      );
      for (const btn of await buttons.all()) {
        await expect(btn).toHaveClass(/\bbtn\b/);
        await expect(btn).toHaveClass(/\bbtn--primary\b/);
        const c = await btn.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { bg: cs.backgroundColor, fg: cs.color, h: el.getBoundingClientRect().height };
        });
        expect(c.bg).toBe(TEAL);
        expect(contrast(c.fg, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(c.h).toBeGreaterThanOrEqual(51);
        await btn.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(btn).toBeFocused();
        const outline = await btn.evaluate((el) => getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe("none");
      }
      for (const badge of await badges.all()) {
        const box = await badge.boundingBox();
        const frame = await badge.locator("xpath=..").boundingBox();
        if (!box || !frame) throw new Error("bbox null");
        expect(box.x).toBeGreaterThanOrEqual(frame.x);
        expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
      }
    });

    test("Stacks to a single column on mobile (390), image first", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForTimeout(200);
      for (const section of await page.locator(".image-with-text").all()) {
        const grid = section.locator(".image-with-text__grid");
        const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        expect(cols.split(" ").length).toBe(1);
        const media = await section.locator(".image-with-text__media").boundingBox();
        const content = await section.locator(".image-with-text__content").boundingBox();
        if (!media || !content) throw new Error("bbox null");
        expect(media.y).toBeLessThan(content.y);
      }
    });

    for (const width of [390, 320]) {
      test(`No horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(200);
        for (const section of await page.locator(".image-with-text").all()) {
          const overflow = await section.evaluate((sec) => {
            const vw = document.documentElement.clientWidth;
            let worst = 0;
            sec.querySelectorAll<HTMLElement>("*").forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.right > vw) worst = Math.max(worst, r.right - vw);
              if (r.left < 0) worst = Math.max(worst, -r.left);
            });
            return worst;
          });
          expect(overflow).toBeLessThanOrEqual(1);
        }
      });
    }

    test("Captures desktop + mobile screenshot", async ({ page }) => {
      const slug = target.name.toLowerCase();
      await page.locator(".image-with-text").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `qa-screenshots/image-with-text-${slug}-desktop.png`, fullPage: true });

      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForTimeout(300);
      await page.locator(".image-with-text").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `qa-screenshots/image-with-text-${slug}-mobile.png`, fullPage: true });
    });
  });
}
