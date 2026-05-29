import { test, expect, Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * Verifies the per-block font-size controls added to every active theme
 * block. Each block exposes a "Typography" range (Heading size / Text size)
 * that is written to an inline CSS custom property on the block root and
 * consumed by the static stylesheet via `calc(<base> * var(--…-scale, 1))`.
 *
 * Rendered on the QA block page (templates/page.qa-block-test.json) where
 * the landingpage section hosts every lp-* block plus the generic text and
 * group blocks, each seeded with non-default scale values.
 */

async function passChallenge(page: Page) {
  await page.waitForSelector('link[rel="canonical"]', { state: "attached", timeout: 45_000 });
}

/** Read a CSS custom property as set on the matched element. */
async function readVar(page: Page, selector: string, prop: string): Promise<string> {
  return page.locator(selector).first().evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p).trim(),
    prop
  );
}

/**
 * Proves the stylesheet's calc() is actually bound to the scale variable:
 * force the variable to 1 then to 2 on the element and assert the computed
 * font-size roughly doubles. Independent of the underlying clamp() value.
 */
async function expectScaleBinding(page: Page, selector: string, varName: string) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  const small = await el.evaluate((node, v) => {
    (node as HTMLElement).style.setProperty(v, "1");
    return parseFloat(getComputedStyle(node).fontSize);
  }, varName);
  const big = await el.evaluate((node, v) => {
    (node as HTMLElement).style.setProperty(v, "2");
    return parseFloat(getComputedStyle(node).fontSize);
  }, varName);
  expect(small).toBeGreaterThan(0);
  expect(big).toBeGreaterThan(small * 1.8);
}

test.describe("Block font-size controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(withTheme(QA.paths.qaBlock), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector('[data-section-type="landingpage"]', { timeout: 15_000 });
  });

  test("Template scale settings reach the block roots as CSS variables", async ({ page }) => {
    // lp-hero: heading 130 / text 90
    expect(await readVar(page, ".lp-hero", "--lp-heading-scale")).toBe("1.3");
    expect(await readVar(page, ".lp-hero", "--lp-text-scale")).toBe("0.9");
    // lp-cta: heading 80 / text 120
    expect(await readVar(page, ".lp-cta", "--lp-heading-scale")).toBe("0.8");
    expect(await readVar(page, ".lp-cta", "--lp-text-scale")).toBe("1.2");
    // lp-themes inner element carries the scale vars
    expect(await readVar(page, ".lp-themes__inner", "--lp-heading-scale")).toBe("1.25");
    // generic text block: font 150
    expect(await readVar(page, ".text", "--text-scale")).toBe("1.5");
    // group block: font 120
    expect(await readVar(page, ".group", "--group-font-scale")).toBe("1.2");
  });

  test("Heading scale drives every block heading via calc()", async ({ page }) => {
    await expectScaleBinding(page, ".lp-hero__title", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-cta__heading", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-bento__heading", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-bento__card-title", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-case__heading", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-metrics__heading", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-metrics__figure", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-themes__heading", "--lp-heading-scale");
    await expectScaleBinding(page, ".lp-testimonial__quote", "--lp-heading-scale");
  });

  test("Text scale drives body copy via calc()", async ({ page }) => {
    await expectScaleBinding(page, ".lp-hero__body", "--lp-text-scale");
    await expectScaleBinding(page, ".lp-cta__text", "--lp-text-scale");
    await expectScaleBinding(page, ".lp-bento__intro", "--lp-text-scale");
    await expectScaleBinding(page, ".lp-case__text", "--lp-text-scale");
    await expectScaleBinding(page, ".lp-metrics__label", "--lp-text-scale");
    await expectScaleBinding(page, ".lp-themes__subheading", "--lp-text-scale");
    await expectScaleBinding(page, ".lp-testimonial__role", "--lp-text-scale");
  });

  test("Generic text block scales its title via font_scale", async ({ page }) => {
    await expectScaleBinding(page, ".text--title", "--text-scale");
  });

  test("Captures scaled-typography screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.waitForTimeout(500);
    const lp = page.locator('[data-section-type="landingpage"]').first();
    await lp.locator(".lp-hero").scrollIntoViewIfNeeded();
    await lp.locator(".lp-hero").first().screenshot({ path: "qa-screenshots/font-size-hero.png" });
    await lp.locator(".lp-metrics").first().scrollIntoViewIfNeeded();
    await lp.locator(".lp-metrics").first().screenshot({ path: "qa-screenshots/font-size-metrics.png" });
    await lp.locator(".lp-cta").first().scrollIntoViewIfNeeded();
    await lp.locator(".lp-cta").first().screenshot({ path: "qa-screenshots/font-size-cta.png" });
  });
});
