---
version: 1
name: "{{SHOP_NAME}} – Designsystem"
description: "{{EIN SATZ: wie sich der Shop anfühlt und warum}}"
regler:
  variation: {{1-10}}
  bewegung: {{1-10}}
  dichte: {{1-10}}
colors:
  canvas: "{{#hex}}"          # Seitenhintergrund
  surface: "{{#hex}}"         # Karten, Flächen
  ink: "{{#hex}}"             # Haupttext
  ink-muted: "{{#hex}}"       # Nebentext
  hairline: "{{#hex}}"        # Linien, Rahmen
  accent: "{{#hex}}"          # der EINE Akzent
  on-accent: "{{#hex}}"       # Text auf Akzent
  sale: "{{#hex}}"            # nur falls nötig, sonst entfernen
typography:
  display:  { family: "{{Schrift}}", weight: {{}}, size: "{{clamp(...)}}", lineHeight: {{}}, tracking: "{{}}" }
  heading:  { family: "{{Schrift}}", weight: {{}}, size: "{{}}", lineHeight: {{}} }
  body:     { family: "{{Schrift}}", weight: 400, size: "{{}}", lineHeight: {{}} }
  label:    { family: "{{Schrift}}", weight: 500, size: "{{}}", tracking: "{{}}" }
rounded:
  sm: "{{}}"
  md: "{{}}"
  pill: "999px"   # nur wenn Teil der Sprache
spacing:
  section-y: "{{eng}} / {{normal}} / {{weit}}"
  container: "{{max-width}}"
---

## Überblick
Zwei bis vier Sätze: Atmosphäre, wofür die Marke steht, was man als Erstes spürt.
**Design-Read:** Ich lese das als: <Shop-Art> für <Zielgruppe>, mit <Charakter>, Richtung <Stilfamilie>.

**Kennzeichen (3–6 Punkte):** die Entscheidungen, an denen man den Shop erkennt.

## Brief
- Zielgruppe und Kaufsituation:
- Positionierung / Preisniveau:
- Markencharakter (3 Adjektive):
- Gefällt (Referenzen, mit Grund):
- Gefällt nicht / Abgrenzung:
- Vorhandene Assets (Logo, Farben, Fotos, Schriften):

## Farben
Rolle jeder Farbe in einem Satz (wo ja, wo nie). Akzent-Regel. Farbmodus der Seite.

## Typografie
Familien und warum. Skala mit Einsatzorten (Hero, Section-Titel, Produktname, Preis, Fließtext,
Labels). Hervorhebungs-Regel. Zahlen/Preise (tabellarische Ziffern?).

## Layout und Rhythmus
Container, Raster, Abstandsstufen, welche Layout-Familien der Shop nutzt (z. B. randloses Bild,
asymmetrisches Raster, Liste mit großem Bild, Karussell) und Regeln für die Seitenkomposition.

## Tiefe und Formen
Schattenlogik (getönt?), Radius-System (was rund, was eckig), Linien statt Schatten?

## Bildsprache
Freisteller oder Umgebung, Ausschnitt, Seitenverhältnisse, Licht, Bildbearbeitung, wo randlos.

## Komponenten
- **Buttons:** Formen, Varianten (primär, sekundär, Text), Zustände (Hover, Fokus, deaktiviert).
- **Produktkarte:** Bild, Name, Preis, Badges, Hover, Schnellkauf ja/nein.
- **Navigation / Header:** Aufbau, Verhalten beim Scrollen, Mobilmenü.
- **Formulare:** Felder, Fehlermeldungen, Fokus.
- **Signatur-Komponente:** Was sie ist, wo sie vorkommt, warum sie zur Marke passt.

## Bewegung
Was sich bewegt und warum. Dauer und Kurven. `prefers-reduced-motion`.

## Do's und Don'ts
**Do:** konkrete, prüfbare Regeln.
**Don't:** konkrete Verbote – inklusive bewusst ausgeschlossener KI-Standardmuster.

## Responsive
Breakpoints, was mobil anders ist (Reihenfolge, Größen, Navigation), Touch-Ziele ≥ 44 px.

## Shopify-Umsetzung
Zuordnung Token → Theme-Setting / CSS Custom Property (z. B. `colors.accent` → `--color-accent`
aus `settings.color_accent`). Welche Werte Händler im Theme-Editor ändern dürfen, welche fest sind.

## Iterationshinweise
1. Immer eine Komponente nach der anderen; auf Tokens verweisen, nie neue Werte erfinden.
2. Neue Varianten als eigene Einträge hier ergänzen, bevor sie gebaut werden.
3. Weicht ein Entwurf von diesem Dokument ab, erst das Dokument ändern (mit Zustimmung), dann bauen.
