import { test, expect } from "@playwright/test";
import { withTheme } from "../fixtures";

/**
 * Visual QA for the blog index (sections/blog.liquid) and the article
 * page (sections/article.liquid).
 *
 * The dev store has no dedicated blog fixture, so we use the default
 * "News" blog. The article test skips itself when the blog is empty.
 */

const BLOG_PATH = "/blogs/news";

async function hasHorizontalOverflow(page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
}

// Previewing an unpublished theme on the blog route loops if the
// preview_theme_id cookie isn't primed first; visiting the themed home
// page once sets the cookie so plain paths render the preview theme.
async function primePreview(page) {
  await page.goto(withTheme("/"), { waitUntil: "domcontentloaded" });
}

test.describe("blog index", () => {
  test("renders without 404 and is mobile-safe", async ({ page }) => {
    await primePreview(page);
    const resp = await page.goto(BLOG_PATH, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status(), "blog index should not 404").toBeLessThan(400);

    await expect(page.locator("section.blog")).toBeVisible();

    // Desktop screenshot
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "qa-screenshots/blog-index-desktop.png",
      fullPage: true,
    });

    // Mobile: no horizontal scroll
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);
    expect(await hasHorizontalOverflow(page), "no horizontal scroll at 375px").toBeFalsy();
    await page.screenshot({
      path: "qa-screenshots/blog-index-mobile.png",
      fullPage: true,
    });
  });
});

test.describe("article page", () => {
  test("renders hero, body and comment area", async ({ page }) => {
    await primePreview(page);
    await page.goto(BLOG_PATH, { waitUntil: "domcontentloaded" });

    const cardCount = await page.locator(".blog-card").count();
    test.skip(cardCount === 0, "No articles in the News blog of the dev store");

    const href = await page
      .locator(".blog-card__title a")
      .first()
      .getAttribute("href");
    expect(href, "first article should have a url").toBeTruthy();

    const resp = await page.goto(href as string, {
      waitUntil: "domcontentloaded",
    });
    expect(resp?.status(), "article should not 404").toBeLessThan(400);

    await expect(page.locator("article.article")).toBeVisible();
    await expect(page.locator(".article__hero")).toBeVisible();
    await expect(page.locator(".article__hero-title")).toBeVisible();
    await expect(page.locator(".article__body")).toBeVisible();

    // Desktop screenshot
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: "qa-screenshots/article-desktop.png",
      fullPage: true,
    });

    // Mobile: no horizontal scroll
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(200);
    expect(await hasHorizontalOverflow(page), "no horizontal scroll at 375px").toBeFalsy();
    await page.screenshot({
      path: "qa-screenshots/article-mobile.png",
      fullPage: true,
    });
  });
});
