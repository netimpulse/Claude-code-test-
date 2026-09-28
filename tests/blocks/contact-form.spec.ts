import { test, expect, type Page } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

/**
 * sections/contact-form.liquid – SYS §5/§6 Formular- und Fehlerzustands-Muster (Plan S7b).
 * R1: the section lives on the real contact page /pages/kontakt.
 * Target: scheme-sand, one h1 via accent-heading, fields --r-sm with 1px
 * --c-line-strong and min-height 52px, labels Work Sans 500 --text-small,
 * error 2px --color-error + text with a "Fehler" label, aria-invalid /
 * aria-describedby, visible focus, submit .btn.btn--primary.btn--block,
 * contact info without a card box or shadow.
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

/** Resolves a root token (e.g. --text-small) to computed pixels via a probe element. */
async function tokenPx(page: Page, token: string): Promise<number> {
  return page.evaluate((t) => {
    const probe = document.createElement("span");
    probe.style.fontSize = `var(${t})`;
    document.body.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return px;
  }, token);
}

test.describe("contact-form section (Kontakt)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(withTheme(QA.paths.kontakt), { waitUntil: "load" });
    await passChallenge(page);
    await page.waitForSelector(".contact-form", { timeout: 15_000 });
  });

  test("Section, Heading und Subheading rendern", async ({ page }) => {
    const section = page.locator(".contact-form").first();
    await expect(section).toBeVisible();
    await expect(section.locator(".contact-form__heading")).toContainText("Lass uns reden");
    await expect(section.locator(".contact-form__subheading")).toBeVisible();
  });

  test("Genau ein h1: die Formular-Überschrift, ohne Sternchen, in der Display-Schrift", async ({ page }) => {
    await expect(page.locator("main h1")).toHaveCount(1);
    const h1 = page.locator("main h1");
    await expect(h1).toHaveClass(/contact-form__heading/);
    expect(await h1.textContent()).not.toContain("*");
    const family = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/Bricolage Grotesque/);
    // Info-Überschrift folgt als h2 (heading-order)
    await expect(page.locator(".contact-form__info-heading")).toHaveJSProperty("tagName", "H2");
  });

  test("KEINE Map / Karte im Panel", async ({ page }) => {
    const section = page.locator(".contact-form").first();
    await expect(section.locator("iframe, .map, [class*='map']")).toHaveCount(0);
  });

  test("Form-Felder rendern korrekt (5 Inputs + 1 Textarea + 1 Select)", async ({ page }) => {
    const form = page.locator(".contact-form__form");
    await expect(form.locator("input[type='text']")).toHaveCount(2);
    await expect(form.locator("input[type='email']")).toHaveCount(1);
    await expect(form.locator("input[type='tel']")).toHaveCount(1);
    await expect(form.locator("textarea")).toHaveCount(1);
    await expect(form.locator("select")).toHaveCount(1);
  });

  test("Required-Toggle wirkt: Name/E-Mail/Nachricht haben required, andere nicht", async ({ page }) => {
    const form = page.locator(".contact-form__form");
    await expect(form.locator("input[name='contact[name]']")).toHaveAttribute("required", "");
    await expect(form.locator("input[name='contact[email]']")).toHaveAttribute("required", "");
    await expect(form.locator("textarea[name='contact[body]']")).toHaveAttribute("required", "");
    await expect(form.locator("input[name='contact[phone]']")).not.toHaveAttribute("required", "");
    await expect(form.locator("input[name='contact[company]']")).not.toHaveAttribute("required", "");
  });

  test("Dropdown rendert mit Placeholder und 5 Optionen", async ({ page }) => {
    const select = page.locator(".contact-form__form select[name='contact[topic]']");
    await expect(select).toBeVisible();
    const options = await select.locator("option").count();
    expect(options).toBe(6);
    await expect(select.locator("option").first()).toHaveText("Bitte wählen …");
    await expect(select.locator("option").nth(1)).toContainText("Strategie & Beratung");
  });

  test("Required-Stern wird nur bei Pflichtfeldern angezeigt", async ({ page }) => {
    const requiredStars = await page.locator(".contact-form__required").count();
    expect(requiredStars).toBe(3);
  });

  test("Felder: --r-sm, 1px --c-line-strong, min. 52px; Label Work Sans 500 in --text-small", async ({ page }) => {
    const small = await tokenPx(page, "--text-small");
    const inputs = page.locator(".contact-form__input");
    const count = await inputs.count();
    expect(count).toBe(7);
    for (let i = 0; i < count; i++) {
      const s = await inputs.nth(i).evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          h: el.getBoundingClientRect().height,
          bw: cs.borderTopWidth,
          bs: cs.borderTopStyle,
          bc: cs.borderTopColor,
          r: cs.borderTopLeftRadius,
        };
      });
      expect(s.h, `Feld ${i} Höhe`).toBeGreaterThanOrEqual(52);
      expect(s.bw).toBe("1px");
      expect(s.bs).toBe("solid");
      expect(parseRgb(s.bc)).toEqual([125, 118, 107]); // --c-line-strong #7d766b
      expect(s.r).toBe("4px"); // --r-sm
    }

    const labels = page.locator(".contact-form__label");
    for (let i = 0; i < (await labels.count()); i++) {
      const l = await labels.nth(i).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { w: cs.fontWeight, fs: parseFloat(cs.fontSize), ff: cs.fontFamily };
      });
      expect(l.w).toBe("500");
      expect(Math.abs(l.fs - small)).toBeLessThanOrEqual(0.5);
      expect(l.ff).toMatch(/Work Sans/);
    }
  });

  test("Fokus sichtbar: 2px Outline in --focus-color", async ({ page }) => {
    await page.locator("input[name='contact[name]']").click();
    await page.keyboard.press("Tab");
    const email = page.locator("input[name='contact[email]']");
    await expect(email).toBeFocused();
    const o = await email.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { w: cs.outlineWidth, s: cs.outlineStyle, c: cs.outlineColor, bg: getComputedStyle(el.closest(".contact-form")!).backgroundColor };
    });
    expect(o.w).toBe("2px");
    expect(o.s).toBe("solid");
    expect(parseRgb(o.c)).toEqual([28, 73, 72]); // scheme-sand accent #1c4948
    expect(contrast(o.c, o.bg)).toBeGreaterThanOrEqual(3);
  });

  test("Submit: .btn.btn--primary.btn--block, volle Breite, Kontrast ≥ 4.5", async ({ page }) => {
    const btn = page.locator(".contact-form__submit");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("type", "submit");
    await expect(btn).toContainText("Nachricht senden");
    await expect(btn).toHaveClass(/\bbtn\b/);
    await expect(btn).toHaveClass(/\bbtn--primary\b/);
    await expect(btn).toHaveClass(/\bbtn--block\b/);

    const m = await btn.evaluate((el) => {
      const cs = getComputedStyle(el);
      const form = el.closest("form")!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { h: r.height, w: r.width, fw: form.width, bg: cs.backgroundColor, fg: cs.color, shadow: cs.boxShadow };
    });
    expect(m.h).toBeGreaterThanOrEqual(51);
    expect(Math.abs(m.w - m.fw)).toBeLessThanOrEqual(1);
    expect(parseRgb(m.bg)).toEqual([28, 73, 72]); // --color-btn-bg (scheme-sand), nie accent_color
    expect(contrast(m.fg, m.bg)).toBeGreaterThanOrEqual(4.5);
    expect(m.shadow).toBe("none");
  });

  test("Info-Liste: 3 Einträge mit Label + Content", async ({ page }) => {
    const items = page.locator(".contact-form__info-item");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0).locator(".contact-form__info-label")).toContainText("Adresse");
    await expect(items.nth(1).locator(".contact-form__info-label")).toContainText("Telefon");
    await expect(items.nth(2).locator(".contact-form__info-label")).toContainText("E-Mail");
  });

  test("Kontaktkarte ohne Kasten und Schatten, Labels lesbar", async ({ page }) => {
    const info = page.locator(".contact-form__info-col");
    const s = await info.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        shadow: cs.boxShadow,
        bg: cs.backgroundColor,
        left: cs.borderLeftWidth,
        right: cs.borderRightWidth,
        bottom: cs.borderBottomWidth,
        sectionBg: getComputedStyle(el.closest(".contact-form")!).backgroundColor,
      };
    });
    expect(s.shadow).toBe("none");
    expect(s.bg).toBe("rgba(0, 0, 0, 0)");
    expect([s.left, s.right, s.bottom]).toEqual(["0px", "0px", "0px"]);

    const labels = page.locator(".contact-form__info-label");
    for (let i = 0; i < (await labels.count()); i++) {
      const c = await labels.nth(i).evaluate((el) => getComputedStyle(el).color);
      expect(contrast(c, s.sectionBg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("Desktop: Info-Spalte LINKS, Form RECHTS", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.waitForTimeout(200);
    const info = await page.locator(".contact-form__info-col").boundingBox();
    const form = await page.locator(".contact-form__form-col").boundingBox();
    if (!info || !form) throw new Error("bbox null");
    expect(info.x).toBeLessThan(form.x);
  });

  test("Form Action verweist auf /contact (Shopify contact form)", async ({ page }) => {
    const form = page.locator(".contact-form__form");
    const action = await form.getAttribute("action");
    expect(action).toContain("/contact");
  });

  for (const width of [390, 320]) {
    test(`Mobile (${width}px): kein horizontaler Scroll, Felder werden 1-spaltig`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1600 });
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const name = await page.locator("input[name='contact[name]']").boundingBox();
      const email = await page.locator("input[name='contact[email]']").boundingBox();
      if (!name || !email) throw new Error("bbox null");
      expect(email.y).toBeGreaterThan(name.y);
      expect(Math.abs(email.x - name.x)).toBeLessThanOrEqual(1);
    });
  }

  test("Fehlerzustand: 2px --color-error, Text mit „Fehler“-Label, aria-invalid/aria-describedby", async ({ page }) => {
    // Leeres E-Mail-Feld serverseitig absenden (keine echte Nachricht wird verschickt).
    await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>(".contact-form__form")!;
      form.noValidate = true;
      form.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required"));
    });
    await Promise.all([
      page.waitForEvent("framenavigated", { predicate: (f) => f === page.mainFrame() }),
      page.locator(".contact-form__submit").click(),
    ]);
    await page.waitForLoadState("load");
    test.skip(/challenge/.test(page.url()), "Shopify-Captcha-Challenge statt Formularantwort");
    const themeId = await page.evaluate(() => String((window as any).Shopify?.theme?.id ?? ""));
    test.skip(themeId !== QA.themeId, "Antwortseite rendert nicht das Preview-Theme");
    const errors = page.locator(".contact-form__errors");
    test.skip((await errors.count()) === 0, "Store liefert keine Formularfehler zurück");

    await expect(errors).toHaveAttribute("role", "alert");
    const field = page.locator(".contact-form__field.is-invalid").filter({ has: page.locator("input[name='contact[email]']") });
    await expect(field).toHaveCount(1);
    const input = field.locator("input");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = await input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const message = page.locator(`[id="${describedBy}"]`);
    await expect(message).toBeVisible();
    await expect(message.locator(".label-caps")).toHaveText("Fehler");

    const s = await input.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bw: cs.borderTopWidth, bc: cs.borderTopColor };
    });
    expect(s.bw).toBe("2px");
    expect(parseRgb(s.bc)).toEqual([163, 38, 27]); // --c-error #a3261b
    const msg = await message.evaluate((el) => ({
      c: getComputedStyle(el).color,
      bg: getComputedStyle(el.closest(".contact-form")!).backgroundColor,
    }));
    expect(parseRgb(msg.c)).toEqual([163, 38, 27]);
    expect(contrast(msg.c, msg.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
