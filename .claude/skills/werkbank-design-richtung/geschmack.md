# Geschmack – gegen den KI-Einheitslook

Verbindlich für `designer`, Orchestrator und die Design-Prüfung. Auf Shopify/Liquid zugeschnitten,
gilt sinngemäß für jede Weboberfläche. Angelehnt an taste-skill (Leonxlnx, MIT) und das
DESIGN.md-Format (Google Stitch, Sammlung awesome-design-md von VoltAgent, MIT).

Grundsatz: Jede Regel hier ist ein **Standardverbot**, kein absolutes. Ein Muster ist erlaubt,
wenn `DESIGN.md` es ausdrücklich vorsieht und begründet. Ohne `DESIGN.md` keine Gestaltung –
dann zuerst die Design-Richtung festlegen (Skill `werkbank-design-richtung`).

## 1. Design-Read vor jedem Entwurf

Ein Satz, bevor irgendetwas gestaltet wird:
„Ich lese das als: <Shop-Art> für <Zielgruppe>, mit <Markencharakter>, Richtung <Stilfamilie>."
Er muss zu `DESIGN.md` passen. Passt die Aufgabe nicht zur festgelegten Richtung, fragen.

## 2. Drei Regler (stehen in DESIGN.md)

- **Variation** 1–10: 1 streng symmetrisch, 10 experimentell.
- **Bewegung** 1–10: 1 statisch, 10 filmisch.
- **Dichte** 1–10: 1 luftig wie eine Galerie, 10 voll wie ein Fachhandel-Katalog.

Startwerte nach Shop-Art (dann bewusst anpassen):

| Shop-Art | Variation | Bewegung | Dichte |
|---|---|---|---|
| Marke / Premium-DTC, wenige Produkte | 7 | 5 | 3 |
| Mode / Lifestyle | 8 | 6 | 3 |
| Sortiment / Fachhandel, viele Produkte | 4 | 3 | 6 |
| Technik / B2B / Ersatzteile | 4 | 2 | 6 |
| Handwerk / Lokal / Dienstleister | 5 | 3 | 4 |
| Vertrauen zuerst (Gesundheit, Kinder, Finanzen) | 3 | 2 | 5 |

## 3. Standardverbote (die typischen KI-Merkmale)

**Layout**
- Zentrierter Hero über Farbverlauf oder Vollbild-Overlay mit Überschrift, Untertitel und zwei Buttons.
- Drei gleich breite Karten mit Icon, Titel, Satz als Feature-Reihe.
- Jede Section im selben Container mit identischem Innenabstand oben und unten.
- Drei und mehr aufeinanderfolgende Bild-Text-Wechsel (Zickzack).
- Kleine Versalien-Labels („Eyebrows") über fast jeder Überschrift – höchstens eins pro drei Sections.
- Trust-Leiste oder Logo-Reihe im Hero; Scroll-Hinweise („Scroll ↓").
- Überall dieselbe Produktkarte aus dem Basistheme, unverändert.

**Farbe**
- Lila-/Blau-Verläufe und Neon-Glow als „modern".
- „Premium" = Creme/Beige-Hintergrund + Messing/Terrakotta/Ochsenblut + Espresso-Text. Das ist
  die häufigste KI-Premium-Palette; Alternativen: kühles Grau + Chrom, tiefes Grün + Knochenweiß,
  Schwarz + ein klarer Akzent, Pastell mit dunkler Typo, gesättigte Markenfarbe als Fläche.
- Mehr als ein Akzent. Warme und kalte Grautöne gemischt.
- Einzelne dunkle Section in einer hellen Seite ohne System dahinter.

**Typografie**
- Inter oder Systemschrift als Standardwahl ohne Begründung.
- Eine Serifenschrift als Abkürzung für „hochwertig" (besonders Fraunces, Instrument Serif,
  Playfair Display) – nur, wenn die Marke wirklich redaktionell/traditionell ist.
- Hervorhebung durch eine fremde Schriftfamilie im selben Satz statt kursiv/fett derselben Schrift.
- Nur Regular und Bold; keine Zwischenstufen (500/600).
- Gedankenstrich-Kaskaden („—") in Überschriften und Texten.

**Inhalt**
- Platzhalter wie „Lorem ipsum", „Max Mustermann", „Jane Doe", „Acme".
- Erfundene Bewertungen, Kundenzahlen, Siegel oder Testimonials. In Deutschland zusätzlich
  wettbewerbsrechtlich riskant – nur echte Inhalte oder klar markierte Platzhalter-Slots.
- Floskeln („Qualität, die begeistert", „Mit Liebe gemacht") statt konkreter Vorteile.
- Emojis als Gestaltungsmittel.

**Bewegung**
- Animation ohne Zweck; mehr als ein Laufband pro Seite; Parallax überall.
- Jede Bewegung muss in einem Satz begründbar sein (Hierarchie, Rückmeldung, Zustandswechsel).

## 4. Was Charakter gibt

- **Eine Signatur-Komponente** pro Shop, die es so nur dort gibt (z. B. eigene Produktkarte,
  Kategorie-Navigation, Material-/Herkunftsmodul). In DESIGN.md benannt.
- **Typografie mit Absicht:** Display-Schrift passend zum Charakter, feste Skala, Gewichte 400/500/600,
  enges Tracking bei großen Größen, Zeilenlänge im Fließtext ~65 Zeichen.
- **Bildsprache festlegen:** Freisteller oder Umgebung, Ausschnitte, Seitenverhältnisse, randlos
  oder eingefasst. Bilder tragen die Seite, nicht Verläufe und Deko-Formen.
- **Rhythmus:** Seitenkomposition mit mindestens 3–4 verschiedenen Layout-Familien auf 8 Sections;
  Abstände bewusst variieren (eng/weit), unten oft etwas mehr als oben.
- **Ein Akzent, konsequent** – auf der ganzen Seite derselbe. Graustufen in einer Temperatur.
- **Ein Radius-System**, eine Schattenlogik (getönt statt Grau-Schwarz), eine Lichtrichtung.
- **Text:** konkret, aus Sicht der Marke, kurze Sätze, echte Produktvorteile.

## 5. Shopify-Umsetzung

- Tokens aus DESIGN.md werden CSS Custom Properties (über `settings_schema.json` / Theme-Settings).
  Section-CSS benutzt nur Tokens, keine festen Hex-Werte.
- Die Block-Bibliothek liefert die Mechanik, DESIGN.md die Haut: Varianten über Section-Settings
  (Layout-Variante, Dichte), nicht über kopierte Sections.
- Schriften über die Shopify-Schriftbibliothek (`font_picker`) oder selbst gehostet mit
  `font-display: swap`; keine Google-Fonts-Links (DSGVO).
- Bilder mit `image_url` + `srcset`/`sizes`; das größte Bild über dem Falz nicht lazy laden.

## 6. Pre-Flight (vor dem Zeigen von Varianten und vor dem Abschluss)

Jeder Punkt muss ehrlich mit Ja beantwortet sein, sonst ist der Entwurf nicht fertig:
- [ ] Design-Read genannt und passend zu DESIGN.md?
- [ ] Nur Tokens aus DESIGN.md (Farben, Schriften, Radien, Abstände), keine Einzelwerte?
- [ ] Ein Akzent auf der ganzen Seite, eine Grau-Temperatur, ein Radius-System?
- [ ] Ein Farbmodus für die ganze Seite (kein zufälliger Dunkel-Block)?
- [ ] Kontrast AA (4.5:1) für Text, Buttons, Formularfelder, Platzhalter, Fokus?
- [ ] Hero: Überschrift ≤ 2 Zeilen am Desktop, CTA ohne Scrollen sichtbar (Desktop und 375 px mobil),
      höchstens 4 Textelemente?
- [ ] Mindestens 3 Layout-Familien auf der Seite, kein Zickzack über 3 Sections, keine zwei
      Sections mit identischem Aufbau direkt hintereinander?
- [ ] Keine zwei CTAs mit gleicher Absicht auf derselben Ansicht?
- [ ] Echte Bilder oder klar markierte Platzhalter-Slots; keine erfundenen Bewertungen oder Zahlen?
- [ ] Kein Standardverbot aus Abschnitt 3 ohne Begründung in DESIGN.md?
- [ ] Signatur-Komponente erkennbar eingesetzt (bei Seiten, nicht bei Einzel-Snippets)?
- [ ] Texte gegengelesen: Rechtschreibung, keine Floskeln, keine Gedankenstrich-Kaskaden?
- [ ] Mobil bei 375 px geprüft; Navigation einzeilig am Desktop?
- [ ] Bewegung begründet und `prefers-reduced-motion` beachtet?

## 7. Referenzen nutzen, nicht kopieren

Die DESIGN.md-Analysen bekannter Marken (github.com/VoltAgent/awesome-design-md, Rohdatei:
`https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<name>/DESIGN.md`)
zeigen, wie genau ein gutes Designsystem beschrieben ist. Nutze sie für **Struktur, Detailtiefe
und Prinzipien** („eine Signatur-Schriftstärke", „Fotografie randlos, nie in Karten"). Übernimm
nie die Identität einer fremden Marke (Logo, Kombination aus markanten Farben und Schrift,
Signatur-Komponenten): Der Kundenshop soll eigen aussehen, und Nachahmung bekannter Marken kann
wettbewerbsrechtlich heikel sein. Höchstens 2 Referenzen pro Richtung, Prinzipien in eigenen Worten.
