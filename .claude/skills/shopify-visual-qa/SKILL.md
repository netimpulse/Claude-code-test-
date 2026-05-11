---
name: shopify-visual-qa
description: Geschlossener Visual-QA-Workflow für Shopify-Themes via Shopify CLI + Playwright. Verwende diesen Skill bei jeder Erstellung, Änderung oder Fehlerbehebung an Sections, Blocks, Snippets, Templates oder Storefront-CSS/JS — egal ob für Page-Blocks, Produktseiten, Cart, Collections, Header, Footer oder andere Storefront-Bereiche. Der Skill pickt automatisch die richtige Test-URL anhand der geänderten Datei und funktioniert mit Claude Code Web's PR-Flow, weil das Test-Theme via Shopify CLI direkt aus der Arbeits-Branch heraus aktualisiert wird. Trigger automatisch bei .liquid-Dateien, Schemas, Sections, Blocks, Snippets, Storefront-UI, oder wenn der Nutzer Begriffe wie "Block bauen", "Produktseite anpassen", "Cart umbauen", "Header ändern", "QA-Schleife", "Visual Test" nutzt.
---

# Shopify Visual QA Workflow (v4 — Multi-Template, CLI-Push aus Arbeits-Branch)

## Architektur

Im Dev-Store `dev-store-4ogqgshg.myshopify.com`:

| Theme | ID | Rolle | Genutzt für |
|---|---|---|---|
| `Claude-code-test-/main` | 145380638835 | UNPUBLISHED, GitHub-synced | „Spiegel" von main, nicht für QA |
| `QA Preview` | **145381884019** | UNPUBLISHED, CLI-pushbar | Ziel aller Playwright-Tests |

Test-Fixtures im Store (stabile Handles, dürfen nicht gelöscht werden):

| Fixture | Handle | URL |
|---|---|---|
| Page | `qa-block-test` | `/pages/qa-block-test` |
| Produkt | `qa-test-produkt` | `/products/qa-test-produkt` |
| Collection | `qa-test-collection` | `/collections/qa-test-collection` |

Alle URLs werden via `withTheme()` aus `tests/fixtures.ts` mit `?preview_theme_id=145381884019` versorgt.

## 0 — Umgebungs-Check (einmal pro Session)

```bash
node -v && npm -v && git --version
shopify version
npx playwright --version
echo "Theme-Token: $([ -n "$SHOPIFY_CLI_THEME_TOKEN" ] && echo gesetzt || echo NEIN)"
echo "Storefront-PW: $([ -n "$SHOPIFY_STOREFRONT_PASSWORD" ] && echo gesetzt || echo NEIN)"
```

Beide ENVs sind Pflicht. Wenn etwas fehlt: stoppe und frag den Nutzer in der Session. Niemals in eine Datei schreiben.

## 1 — Welche Test-URL zu welcher Datei?

Wähle pro Auftrag die richtige Ziel-URL anhand der Datei, die geändert wird:

| Geänderte Datei(en) | Block-spezifischer Test geht gegen |
|---|---|
| `sections/header.liquid`, `snippets/meta-tags.liquid`, `layout/theme.liquid` | `QA.paths.home` (Storefront-Root) |
| Section/Block für Page-Templates (custom-hero, faq, …) | `QA.paths.qaBlock` (`/pages/qa-block-test`), nach Update von `templates/page.qa-block-test.json` |
| `sections/product-*.liquid`, `snippets/product-*.liquid`, `templates/product.json` | `QA.paths.product` (`/products/qa-test-produkt`) |
| `sections/cart-*.liquid`, `templates/cart.json` | `QA.paths.cart` (`/cart`) — vorher Produkt in Cart legen, siehe 2.4 |
| `sections/collection-*.liquid`, `templates/collection.json` | `QA.paths.collection` (`/collections/qa-test-collection`) |
| `sections/footer.liquid`, `sections/footer-group.json` | jede beliebige Page; nimm `QA.paths.home` |
| `sections/404.liquid` | `QA.paths.notFound` |
| `sections/search.liquid`, `templates/search.json` | `QA.paths.search` |

Wenn die Datei mehrere Bereiche betrifft (z. B. `snippets/image.liquid`), schreibe mehrere Test-Specs, jede mit ihrer eigenen Ziel-URL.

## 2 — Workflow pro Aufgabe

### 2.1 Komponente implementieren

**Schema, Block-Wrapper, Editor-sicheres JS, Mobile-first CSS** — gleiche Regeln wie in v3:

- `default`-Werte für jede Setting
- `presets` falls hinzufügbar
- `{{ block.shopify_attributes }}` auf Block-Wrappern
- `shopify:section:load`, `shopify:section:unload`, `shopify:block:select` Events
- Kein horizontaler Scroll bei Viewports ≥ 320px

### 2.2 Ziel-Template anpassen (NUR für Page-Blocks)

**Nur wenn** der Auftrag ein neuer Block oder eine Section für die QA-Block-Page ist:

Überschreibe `templates/page.qa-block-test.json` mit realistischen Dummy-Settings. Siehe v3-Beispiele für Section und Block-in-Host-Section.

Für **Product-, Cart-, Collection-, Header-, Footer-Änderungen** wird dieses Template **nicht** angefasst. Die Komponente landet automatisch im passenden Storefront-Render, weil sie im jeweiligen Template-File (product.json, cart.json, etc.) oder im Layout (theme.liquid) eingebunden ist.

### 2.3 Block-spezifischen Playwright-Test schreiben

`tests/blocks/<component-handle>.spec.ts`. Importiere `fixtures`:

```ts
import { test, expect } from "@playwright/test";
import { QA, withTheme } from "../fixtures";

test.describe("<component-handle>", () => {
  test("…", async ({ page }) => {
    await page.goto(withTheme(QA.paths.product)); // oder qaBlock, cart, collection, …
    // Assertions
  });
});
```

Testpattern nach Komponente:

| Komponente | Was getestet wird |
|---|---|
| Slider | next/prev, Slide-Wechsel, Loop |
| Accordion | open/close pro Item, `aria-expanded` |
| Tabs | nur ein Panel sichtbar, Tab-Wechsel |
| Variant-Switcher (Product) | Klick auf Variante ändert Preis/SKU |
| Add-to-Cart Button | Klick ergibt `cart.added`-Toast oder Cart-Drawer |
| Cart-Item | Quantity hoch/runter, Remove, Subtotal aktualisiert |
| Collection-Filter | Filter aktivieren reduziert sichtbare Produkte |
| Form | Felder fillable, Submit erreichbar (nicht echt absenden) |

### 2.4 Cart-Tests speziell

Cart braucht einen Vorzustand: ein Produkt muss drin sein. Mache das **im Test**, nicht außerhalb, damit jeder Test-Run reproduzierbar bleibt:

```ts
test.beforeEach(async ({ page, context }) => {
  // Add QA-Produkt zur Session via Cart-API
  await context.request.post(withTheme("/cart/add.js"), {
    headers: { "Content-Type": "application/json" },
    data: { items: [{ id: 44957941268595, quantity: 1 }] }, // QA-M-BLACK variant
  });
});
```

Wichtig: Storage-State aus dem global-setup wird automatisch geteilt. Cart-Cookies bleiben innerhalb des Tests stabil.

### 2.5 Push zum QA Preview Theme + Tests

```bash
shopify theme check
shopify theme push -e development --nodelete
npx playwright test
```

`--nodelete` schützt vor versehentlichen Löschungen, wenn die Branch unvollständig ist.

### 2.6 Korrekturschleife

Bei rotem Test:
- Screenshots aus `qa-screenshots/` ansehen
- HTML-Report unter `playwright-report/index.html`
- Konsole + DOM des fehlschlagenden Elements

Maximal **drei** Iterationen. Danach Stopp + Statusbericht.

Niemals mit roten Tests committen.

### 2.7 Git-Commit und Push

```bash
git add .
git commit -m "<type>: <komponente> - <kurzbeschreibung>"
git push
```

Claude Code Web öffnet einen PR. Das ist gewollt — der Nutzer reviewt und mergt.

Commit-Typen: `feat`, `fix`, `refactor`, `chore`, `style`, `perf`.

## 3 — Production-Push (nur auf explizite Anforderung)

Wie v3. Production-Push passiert nie automatisch.

`ignore`-Liste in `shopify.theme.toml` muss QA-Pfade ausschließen:
```
templates/page.qa-*.json
tests/**
playwright.config.ts
playwright/**
qa-screenshots/**
playwright-report/**
test-results/**
package.json
package-lock.json
node_modules/**
.env*
README.md
```

## 4 — Sicherheitsregeln

- `SHOPIFY_CLI_THEME_TOKEN` und `SHOPIFY_STOREFRONT_PASSWORD` niemals in committete Files, Commit-Messages, Logs
- Wenn fehlt: in Session beim Nutzer erfragen, in `.env` (gitignored) oder per `export` setzen
- `playwright/.auth/` ist gitignored
- Test-Fixtures (`qa-test-produkt`, `qa-test-collection`) **nicht löschen oder umbenennen** — sonst brechen alle Tests

## 5 — Schnellreferenz

| Situation | Aktion |
|---|---|
| Neue Section/Block für Page | 1, 2.1, 2.2, 2.3 (→ `QA.paths.qaBlock`), 2.5–2.7 |
| Product-Page-Anpassung | 1, 2.1, 2.3 (→ `QA.paths.product`), 2.5–2.7 |
| Cart-Anpassung | 1, 2.1, 2.3 + 2.4 beforeEach (→ `QA.paths.cart`), 2.5–2.7 |
| Collection-Anpassung | 1, 2.1, 2.3 (→ `QA.paths.collection`), 2.5–2.7 |
| Header/Footer/Layout-Änderung | 1, 2.1, 2.3 (→ `QA.paths.home`), 2.5–2.7 |
| Search/404 | 1, 2.1, 2.3 (→ `QA.paths.search`/`notFound`), 2.5–2.7 |
| Production-Deploy | 3, nur auf Anforderung |
| ENV-Variable fehlt | 0, Nutzer fragen |
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       