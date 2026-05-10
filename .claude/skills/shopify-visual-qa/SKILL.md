---
name: shopify-visual-qa
description: Geschlossener Visual-QA-Workflow für Shopify-Theme-Blocks und -Sections via Shopify CLI + Playwright. Verwende diesen Skill bei jeder Erstellung, Änderung oder Fehlerbehebung an einer Shopify-Section, einem Block, einem Snippet oder einer Theme-Datei. Der Skill funktioniert auch dann, wenn Claude Code Web seine Arbeit auf einer PR-Branch macht (statt direkt auf main), weil das Test-Theme via Shopify CLI direkt aus der Arbeits-Branch heraus aktualisiert wird — unabhängig vom Merge-Status. Trigger automatisch bei .liquid-Dateien, Schemas, Sections, Blocks, Snippets, Storefront-UI, oder wenn der Nutzer Begriffe wie "Block bauen", "Section anpassen", "QA-Schleife", "Visual Test" nutzt.
---

# Shopify Visual QA Workflow (v3 — CLI-Push aus Arbeits-Branch)

## Architektur

Im Dev-Store `dev-store-4ogqgshg.myshopify.com` gibt es zwei Themes mit zwei Aufgaben:

| Theme | ID | Rolle |
|---|---|---|
| `Claude-code-test-/main` | 145380638835 | Synchronisiert via GitHub-Integration mit main. „Spiegel" des fertigen Codes. Wird nicht für QA verwendet. |
| `QA Preview` | **145381884019** | Wird via Shopify CLI aus der jeweils aktuellen Arbeits-Branch gepusht. Ziel der Playwright-Tests. |

Dieser Aufbau entkoppelt den Test von Git-Branches: Selbst wenn Claude Code Web zwingend PRs erzeugt, kann der QA-Loop laufen, weil das Test-Theme den Stand der Arbeits-Branch widerspiegelt, nicht den Stand von main.

Voraussetzungen pro Repo:
- Aus `netimpulse/Theme-Template` erzeugt (Skeleton + Playwright + global-setup + QA-Template + shopify.theme.toml mit Theme-ID 145381884019)
- Im Dev-Store existiert die Page `qa-block-test` mit Template-Suffix `qa-block-test`

## 0 — Umgebungs-Check (einmal pro Session)

```bash
node -v && npm -v && git --version
shopify version
npx playwright --version
echo "Theme-Token: $([ -n "$SHOPIFY_CLI_THEME_TOKEN" ] && echo gesetzt || echo NEIN)"
echo "Storefront-PW: $([ -n "$SHOPIFY_STOREFRONT_PASSWORD" ] && echo gesetzt || echo NEIN)"
```

Beide ENVs sind Pflicht:
- `SHOPIFY_CLI_THEME_TOKEN` — für `shopify theme push` zum QA Preview Theme
- `SHOPIFY_STOREFRONT_PASSWORD` — für den global-setup-Login

Wenn eine Variable fehlt: stoppe, frage den Nutzer einmal in der Session. Niemals in eine committete Datei schreiben.

Wenn Tools fehlen: `npm install`, `npx playwright install chromium`.

## 1 — Workflow pro Block / Section

### 1.1 Komponente implementieren

**Schema**
- Valides `{% schema %}` am Ende der Datei
- Jede Setting hat `default`
- `presets` mit realistischen Werten, falls im Editor hinzufügbar
- Blocks im Schema der Host-Section deklariert

**Block-Wrapper**
- `{{ block.shopify_attributes }}` auf jedem äußeren Block-Element. Ohne das erkennt der Theme-Editor den Block nicht.

**Editor-sicheres JavaScript**
```js
function initFeature(root = document) {
  const items = root.querySelectorAll("[data-section-type='your-section']");
  items.forEach(el => {
    if (el.dataset.initialized === "true") return;
    el.dataset.initialized = "true";
    // Slider, Tabs, Accordion, Video, Buttons initialisieren
  });
}
document.addEventListener("DOMContentLoaded", () => initFeature());
document.addEventListener("shopify:section:load", e => initFeature(e.target));
document.addEventListener("shopify:section:unload", e => { /* cleanup */ });
document.addEventListener("shopify:block:select", e => { /* fokus auf block */ });
```

**CSS**
- Mobile-first
- Kein horizontaler Scroll bei Viewports >= 320px
- Keine harten Pixel-Breiten für das Layout

### 1.2 QA-Template aktualisieren

Überschreibe `templates/page.qa-block-test.json` so, dass die neue Komponente mit realistischen Dummy-Werten platziert ist.

Section direkt:
```json
{
  "sections": {
    "qa": { "type": "your-section-handle", "settings": { } }
  },
  "order": ["qa"]
}
```

Block in Host-Section:
```json
{
  "sections": {
    "qa_host": {
      "type": "host-section-handle",
      "settings": { },
      "blocks": {
        "qa_block": { "type": "your-block-handle", "settings": { } }
      },
      "block_order": ["qa_block"]
    }
  },
  "order": ["qa_host"]
}
```

**Realistische Werte** — keine Lorem-Ipsum, keine "Test Test"-Strings.

### 1.3 Block-spezifischen Playwright-Test schreiben

`tests/blocks/<component-handle>.spec.ts` anlegen oder updaten. Test prüft jede vom Schema implizierte Interaktion:

| Komponente | Was getestet wird |
|---|---|
| Slider | next/prev, Slide-Wechsel, Loop |
| Accordion | open/close pro Item, `aria-expanded` |
| Tabs | Panel-Wechsel, nur eins sichtbar |
| Video | Player initialisiert, Controls vorhanden |
| Button mit Link | href stimmt mit Schema-Setting |
| Form | Felder fillable, Submit erreichbar (nicht echt absenden) |

Generika aus `_base.spec.ts` nicht duplizieren.

### 1.4 Push zum QA Preview Theme + Tests

In dieser Reihenfolge — **ohne** Git-Push dazwischen:

```bash
shopify theme check
shopify theme push -e development --nodelete
npx playwright test
```

`shopify theme check`: catches Liquid-/Schema-Fehler vor dem Push. Errors blockieren — fixen oder Hypothese verwerfen. Warnings möglichst beheben, aber nicht zwingend.

`shopify theme push -e development --nodelete`: pusht die lokalen Files zum QA Preview Theme (ID 145381884019). `--nodelete` verhindert, dass Files aus dem Theme gelöscht werden, die nicht im aktuellen Branch sind (Schutz für den Fall, dass die Branch unvollständig ist).

`npx playwright test`: global-setup loggt sich via Storefront-Passwort ein, dann laufen `_base.spec.ts` + alle Tests in `tests/blocks/`.

### 1.5 Korrekturschleife bei Fehlern

Sammle bei rotem Test:
- Exakte Fehlermeldung
- Screenshots aus `qa-screenshots/`
- Konsolenfehler aus dem Playwright-Report
- DOM via `page.locator(...).innerHTML()` für das fehlschlagende Element

Korrigiere den Code, starte erneut bei 1.4. **Maximal drei Iterationen** pro Aufgabe. Wenn nach drei Zyklen immer noch rot: stoppe, schreibe Statusbericht (was probiert, welche Fehler hartnäckig, welche Hypothesen offen), übergib an den Nutzer.

Niemals mit roten Tests committen.

### 1.6 Git-Commit + Push

Erst wenn alle Tests grün sind:

```bash
git add .
git commit -m "<type>: <komponente> - <kurzbeschreibung>"
git push
```

Claude Code Web öffnet bzw. aktualisiert daraus automatisch einen Pull Request gegen `main`. Das ist **erwünschtes Verhalten**, kein Bug — der Nutzer reviewed im PR die Änderung, mergt sie, und die GitHub-Integration synct danach das `Claude-code-test-/main` Theme.

**Wichtig:** Der Stand des QA Preview Theme wurde bereits in 1.4 aktualisiert. Das ist unabhängig vom Git-Push. Wenn dem Nutzer das Ergebnis im PR gefällt, brauchst du nichts mehr Richtung Shopify zu pushen.

Commit-Typen: `feat`, `fix`, `refactor`, `chore`, `style`.

## 2 — Production-Push (nur auf explizite Anforderung)

Production-Push passiert nicht automatisch. Nur wenn der Nutzer explizit darum bittet.

1. Prüfen: `[environments.production]` in `shopify.theme.toml` existiert mit `store` und `theme` für den Kundenshop
2. Eigenes Theme-Access-Token für den Kundenshop muss verfügbar sein (anderer Token als Dev-Store)
3. `ignore`-Liste in `shopify.theme.toml` schließt QA-Pfade aus (`templates/page.qa-*.json`, `tests/`, `playwright.config.ts`, `playwright/`, `package.json`, `qa-screenshots/`, `.env*`)
4. `shopify theme push -e production`
5. Nutzer ausdrücklich darauf hinweisen, die Live-Site selbst kurz zu prüfen — Produktionsdaten können Verhalten brechen, das im Dev-Store grün war

## 3 — Sicherheitsregeln

- `SHOPIFY_CLI_THEME_TOKEN` und `SHOPIFY_STOREFRONT_PASSWORD` niemals in committete Files, Commit-Messages, Logs, Echos
- Wenn ein Wert fehlt: in laufender Session beim Nutzer einmal erfragen, in `.env` (gitignored) ablegen oder per export setzen — niemals in vorhandene Files schreiben
- GitHub-Auth läuft über die App-eigene Anbindung — keine PATs in URLs oder Files
- `playwright/.auth/` ist gitignored, dort darf nichts committed werden

## 4 — Was dieser Skill NICHT tut

- Generiert nicht das visuelle Design selbst (dafür: `shopify-liquid` Skill)
- Pushed nicht automatisch nach Production
- Legt keine Pages oder Templates im Shop-Admin an (Einmal-Setup pro Dev-Store)
- Verändert das GitHub-verbundene Theme nicht — das spiegelt main weiterhin via GitHub-Sync wider
- Versucht nicht, Claude Code Web's PR-Verhalten zu umgehen — der QA-Loop ist absichtlich Git-unabhängig

## 5 — Schnellreferenz

| Situation | Aktion |
|---|---|
| Neue Section | 1.1–1.6 |
| Neuer Block | 1.1–1.6 mit Host-Section im QA-Template |
| Section-Edit | 1.1–1.6 |
| Bugfix | 1.1–1.6 mit Fokus auf den fehlschlagenden Test |
| Production-Deploy | 2, nur auf explizite Anforderung |
| ENV-Variable fehlt | 0, Nutzer fragen |
| Test-Theme hat alten Stand | `shopify theme push -e development --nodelete` erneut |

## 6 — Bekannte Einschränkung

Das QA Preview Theme ist **shared** zwischen allen Repos. Wenn zwei Claude-Sessions zeitgleich pushen, überschreiben sie sich gegenseitig. Für Solo-Arbeit unkritisch; für Team-Arbeit müsste jeder Entwickler ein eigenes QA Preview Theme bekommen (via `themeDuplicate` aus 145380638835 erzeugbar).
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     