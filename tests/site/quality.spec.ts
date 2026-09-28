import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";
import { scrollThrough, runAxe, fontFaceLoaded } from "./helpers";

/**
 * Seitenweite Qualitaets-Checks fuer das Premium-Redesign.
 *
 * ACCEPTED_PAGES waechst Schritt fuer Schritt: Eine Seite wird erst
 * aufgenommen, wenn sie komplett auf das neue Designsystem umgestellt ist.
 * Eintraege werden nie wieder entfernt.
 */
const ACCEPTED_PAGES: { name: string; path: string; home?: boolean }[] = [
  { name: "Startseite", path: QA.paths.home, home: true },
  { name: "Leistungen", path: QA.paths.leistungen },
  { name: "SEO", path: QA.paths.seo },
  { name: "SEA", path: QA.paths.sea },
  { name: "SMM", path: QA.paths.smm },
  { name: "GEO", path: QA.paths.geo },
  { name: "Webdesign", path: QA.paths.webDesign },
  { name: "Kontakt", path: QA.paths.kontakt },
  { name: "Datenschutz", path: QA.paths.policy },
  { name: "404", path: QA.paths.notFound },
  { name: "Blog", path: QA.paths.blog },
];

/** Elemente, die bewusst Verlaeufe bzw. Endlos-Animationen haben duerfen. */
const GRADIENT_ALLOWLIST = [
  "[class*='hero-serp']",
  "[class*='hero-ticker']",
  "[class*='hero-ad-cycler']",
  "[class*='hero-geo']",
  "[class*='hero-web-build']",
  ".contact-form select",
  ".photo",
  "[style*='--ph']",
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const pageDef of ACCEPTED_PAGES) {
  for (const vp of VIEWPORTS) {
    test.describe(`${pageDef.name} @ ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("Struktur, Barrierefreiheit, keine Fehler", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
        page.on("console", (m) => {
          if (m.type() !== "error") return;
          const url = m.location().url || "";
          if (url.includes("myshopify.com") || url.includes("/cdn/shop/t/")) {
            errors.push(`console: ${m.text()}`);
          }
        });

        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(withTheme(pageDef.path), { waitUntil: "networkidle" });
        await scrollThrough(page);

        // Kein horizontaler Scroll
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, "horizontaler Scroll").toBeLessThanOrEqual(0);

        // Genau ein h1
        await expect(page.locator("main h1, header h1")).toHaveCount(1);

        const violations = await runAxe(page, [
          "heading-order",
          "page-has-heading-one",
          "color-contrast",
          "image-alt",
          "link-name",
          "button-name",
          "target-size",
        ]);
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
          "axe-Verstoesse"
        ).toEqual([]);

        expect(errors, errors.join("\n")).toEqual([]);
      });

      test("Designsystem: Schriften, Akzente, keine Verlaeufe/Endlos-Animationen", async ({ page }) => {
        await page.goto(withTheme(pageDef.path), { waitUntil: "networkidle" });
        await scrollThrough(page);

        expect(await fontFaceLoaded(page, "Bricolage Grotesque", 600), "Heading-Schrift").toBe(true);
        expect(await fontFaceLoaded(page, "Work Sans", 400), "Body regular").toBe(true);
        expect(await fontFaceLoaded(page, "Work Sans", 600), "Body strong").toBe(true);

        const accents = await page.evaluate(() => {
          const out: string[] = [];
          document.querySelectorAll("em.it").forEach((em) => {
            const heading = em.closest("h1, h2");
            if (!heading) out.push(`em.it ausserhalb h1/h2: ${em.textContent}`);
            else {
              if (heading.querySelectorAll("em.it").length > 1) out.push(`mehrere Akzente: ${heading.textContent}`);
              const cs = getComputedStyle(em);
              if (cs.fontStyle !== "italic") out.push(`nicht kursiv: ${em.textContent}`);
              if (cs.color !== getComputedStyle(heading).color) out.push(`eingefaerbt: ${em.textContent}`);
            }
          });
          document.querySelectorAll("h1, h2").forEach((h) => {
            if ((h.textContent || "").includes("*")) out.push(`Sternchen in Ueberschrift: ${h.textContent}`);
          });
          return out;
        });
        expect(accents).toEqual([]);
        if ((await page.locator("em.it").count()) > 0) {
          expect(await fontFaceLoaded(page, "Newsreader", 500, "italic"), "Akzent-Schrift").toBe(true);
        }
        const synth = await page.locator("h1").first().evaluate((h) => getComputedStyle(h).fontSynthesisWeight);
        expect(synth).toBe("none");

        const decorative = await page.evaluate((allow) => {
          const bad: string[] = [];
          const allowed = (el: Element) => allow.some((sel) => el.closest(sel));
          document.querySelectorAll("#MainContent *, .shopify-section-group-header-group *, .shopify-section-group-footer-group *").forEach((el) => {
            if (allowed(el)) return;
            for (const pseudo of [null, "::before", "::after"]) {
              const cs = getComputedStyle(el, pseudo);
              if (cs.backgroundImage.includes("gradient") || (cs.backdropFilter && cs.backdropFilter !== "none")) {
                bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}${pseudo ?? ""}`);
              }
            }
          });
          return bad.slice(0, 10);
        }, GRADIENT_ALLOWLIST);
        expect(decorative, "Verlaeufe/Blur").toEqual([]);

        const endless = await page.evaluate((allow) =>
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations === Infinity)
            .map((a) => (a.effect as KeyframeEffect | null)?.target as Element | null)
            .filter((el) => el && !allow.some((sel) => el.closest(sel)))
            .map((el) => `${el!.tagName.toLowerCase()}.${String(el!.className).slice(0, 40)}`)
        , GRADIENT_ALLOWLIST);
        expect(endless, "Endlos-Animationen").toEqual([]);

        const smallButtons = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>(".btn")]
            .filter((b) => b.offsetParent !== null)
            .filter((b) => b.getBoundingClientRect().height < (b.classList.contains("btn--sm") ? 44 : 51))
            .map((b) => b.textContent?.trim())
        );
        expect(smallButtons, "Buttons zu klein").toEqual([]);
      });

      test("Fokus sichtbar und nicht verdeckt", async ({ page }) => {
        await page.goto(withTheme(pageDef.path), { waitUntil: "networkidle" });
        const problems: string[] = [];
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press("Tab");
          const info = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;
            const cs = getComputedStyle(el);
            const visible = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            const obscured = !!top && !el.contains(top) && !top.contains(el);
            return { name: el.textContent?.trim().slice(0, 30) || el.getAttribute("aria-label"), visible, obscured };
          });
          if (info && (!info.visible || info.obscured)) problems.push(JSON.stringify(info));
        }
        expect(problems).toEqual([]);
      });

      if (pageDef.home) {
        test("Hero: LCP-Bild priorisiert, keine Hero-Animationen", async ({ page }) => {
          await page.goto(withTheme(pageDef.path), { waitUntil: "networkidle" });
          const hero = page.locator("[class*='ni-hero']").first();
          const img = hero.locator("img").first();
          await expect(img).toHaveAttribute("fetchpriority", "high");
          expect(await img.getAttribute("loading")).not.toBe("lazy");
          await expect(hero.locator(".ni-reveal")).toHaveCount(0);
          const running = await hero.evaluate((h) => h.getAnimations({ subtree: true }).length);
          expect(running).toBe(0);
        });
      }
    });
  }
}

test("Qualitaets-Spec ist geladen (ACCEPTED_PAGES waechst schrittweise)", () => {
  expect(Array.isArray(ACCEPTED_PAGES)).toBe(true);
  expect(QA.themeId).not.toBe("145381884019");
});
