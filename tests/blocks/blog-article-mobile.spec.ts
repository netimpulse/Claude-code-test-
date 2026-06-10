import { test, expect, type Page } from "@playwright/test";
import { withTheme } from "../fixtures";

/**
 * Mobile QA for the blog index (sections/blog.liquid) and the article
 * page (sections/article.liquid) at a 375px phone viewport.
 *
 * Asserts the phone-specific layout decisions:
 * - blog feed layout (first post large, rest compact thumbnail rows)
 * - capped article hero height
 * - related-posts row swipes horizontally (scroll snap)
 * - finger-sized share buttons (>= 44px)
 * - 16px form inputs (no iOS focus zoom)
 * - no horizontal page overflow anywhere
 */

const BLOG_PATH = "/blogs/news";
const VIEWPORT = { width: 375, height: 812 };

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
}

// Previewing an unpublished theme loops on plain paths unless the
// preview_theme_id cookie is primed by one themed navigation first.
async function primePreview(page: Page) {
  await page.goto(withTheme("/"), { waitUntil: "domcontentloaded" });
}

test.describe("blog index (mobile)", () => {
  test("feed layout: first post large, rest compact rows", async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await primePreview(page);
    await page.goto(BLOG_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.locator("section.blog")).toBeVisible();
    expect(await hasHorizontalOverflow(page), "no horizontal scroll").toBeFalsy();

    const cards = page.locator(".blog-card");
    const count = await cards.count();
    test.skip(count === 0, "No articles in the News blog of the dev store");

    // First card keeps the stacked layout (media above body).
    const firstDisplay = await cards
      .first()
      .evaluate((el) => getComputedStyle(el).display);
    expect(firstDisplay).toBe("flex");

    if (count > 1) {
      // Following cards collapse into two-column thumbnail rows.
      const second = cards.nth(1);
      const display = await second.evaluate((el) => getComputedStyle(el).display);
      expect(display, "compact cards use a grid row").toBe("grid");

      const columns = await second.evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length
      );
      expect(columns, "thumbnail + text column").toBe(2);

      const excerpt = second.locator(".blog-card__excerpt");
      if ((await excerpt.count()) > 0) {
        await expect(excerpt, "no excerpt in compact rows").toBeHidden();
      }
    }

    await page.screenshot({
      path: "qa-screenshots/blog-index-mobile.png",
      fullPage: true,
    });
  });
});

test.describe("article page (mobile)", () => {
  test("hero, blocks and comments fit a phone", async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await primePreview(page);
    await page.goto(BLOG_PATH, { waitUntil: "domcontentloaded" });

    const cardCount = await page.locator(".blog-card").count();
    test.skip(cardCount === 0, "No articles in the News blog of the dev store");

    const href = await page
      .locator(".blog-card__title a")
      .first()
      .getAttribute("href");
    expect(href, "first article should have a url").toBeTruthy();
    await page.goto(href as string, { waitUntil: "domcontentloaded" });

    await expect(page.locator("article.article")).toBeVisible();
    expect(await hasHorizontalOverflow(page), "no horizontal scroll").toBeFalsy();

    // Image hero must not exceed ~70% of the viewport height even when
    // the desktop setting asks for 600px+.
    const imageHero = page.locator(".article__hero--image");
    if ((await imageHero.count()) > 0) {
      const box = await imageHero.boundingBox();
      expect(box, "hero has a box").toBeTruthy();
      expect(box!.height, "hero capped on phones").toBeLessThanOrEqual(
        VIEWPORT.height * 0.72
      );
    }

    // Share buttons are finger-sized.
    const share = page.locator(".article__share-link").first();
    if ((await share.count()) > 0) {
      await share.scrollIntoViewIfNeeded();
      const box = await share.boundingBox();
      expect(box!.width, "share tap width >= 44").toBeGreaterThanOrEqual(43);
      expect(box!.height, "share tap height >= 44").toBeGreaterThanOrEqual(43);
    }

    // Related posts swipe horizontally instead of stacking.
    const related = page.locator(".article-related__grid");
    if ((await related.count()) > 0) {
      await related.scrollIntoViewIfNeeded();
      const { display, scrollable } = await related.evaluate((el) => ({
        display: getComputedStyle(el).display,
        scrollable: el.scrollWidth > el.clientWidth + 1,
      }));
      expect(display, "related row is a flex carousel").toBe("flex");
      const cardTotal = await page.locator(".article-related__card").count();
      if (cardTotal > 1) {
        expect(scrollable, "related row swipes horizontally").toBeTruthy();
      }
      // The carousel itself must not widen the page.
      expect(await hasHorizontalOverflow(page), "carousel stays clipped").toBeFalsy();
    }

    // Comment inputs use >= 16px so iOS Safari does not zoom on focus.
    const email = page.locator('.article__composer input[type="email"]').first();
    if ((await email.count()) > 0) {
      const fontSize = await email.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize)
      );
      expect(fontSize, "inputs >= 16px on phones").toBeGreaterThanOrEqual(16);
    }

    await page.screenshot({
      path: "qa-screenshots/article-mobile.png",
      fullPage: true,
    });
  });
});
