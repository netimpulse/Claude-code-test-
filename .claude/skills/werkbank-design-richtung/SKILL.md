---
name: werkbank-design-richtung
description: Legt für einen Shop oder eine Website die eigene Design-Richtung fest und schreibt sie als DESIGN.md (Designsystem für alle Agenten) – mit Brief, Design-Read, Reglern, zwei Richtungsentwürfen zur Wahl und Regeln gegen den KI-Einheitslook. Nutzen vor der ersten Oberflächenarbeit in einem Projekt ohne DESIGN.md, bei einem Redesign oder wenn Ergebnisse generisch aussehen. Aufruf auch direkt, z. B. /werkbank-design-richtung.
---

# Design-Richtung festlegen

Zusatzhinweise vom Nutzer: $ARGUMENTS

Ziel: Bevor eine Section gebaut wird, steht fest, **wie dieser eine Shop aussehen soll und warum** –
in `DESIGN.md` im Projektstamm. Ohne das greifen Modelle zu ihren Standardmustern, und jeder Shop
sieht gleich aus. Lies zuerst `${CLAUDE_SKILL_DIR}/geschmack.md` vollständig.

## 0. Ausgangslage

- Gibt es `DESIGN.md` schon? Lesen. Will der Nutzer nichts ändern: fertig, nur die Kurzfassung nennen.
- Ist es ein bestehender Shop mit Gestaltung (Redesign)? Dann zuerst **Audit**: aktuelle Startseite,
  eine Kollektion und eine Produktseite ansehen (QA-Workflow/Vorschau des Projekts, sonst Code), die
  Standardverbote aus `geschmack.md` Abschnitt 3 auflisten, die gefunden wurden, und festhalten, was
  bleiben muss (Logo, Markenfarben, bekannte Elemente). Danach fragen: **behutsam weiterentwickeln**
  oder **neu ausrichten**.

## 1. Bestandsaufnahme (ohne Nutzer)

Aus dem Repo ermitteln: vorhandene Theme-Settings (`config/settings_schema.json`,
`config/settings_data.json` – Farben, Schriften), CSS Custom Properties, Logo und Bilder in `assets/`,
`README.md`, `CLAUDE.md`, vorhandene Sections. Nur fragen, was sich daraus nicht ergibt.

## 2. Brief (eine gebündelte Frage)

Mit AskUserQuestion, höchstens 4 Fragen, jeweils mit Optionen und „Andere" für freien Text:
1. **Shop-Art und Zielgruppe** (z. B. Premium-Marke mit wenigen Produkten / großes Sortiment /
   lokales Handwerk / B2B) – bestimmt die Startwerte der Regler.
2. **Markencharakter** (Mehrfachauswahl, z. B. ruhig, verspielt, technisch, handgemacht, mutig,
   seriös, luxuriös, nahbar) – drei Begriffe sind ideal.
3. **Referenzen und Abgrenzung:** Welche Shops/Marken gefallen (warum), welche ausdrücklich nicht.
4. **Feste Vorgaben:** Logo und Markenfarben verbindlich / nur Logo verbindlich / frei.

Läuft die Sitzung unbeaufsichtigt: Brief aus der Bestandsaufnahme ableiten, Annahmen kennzeichnen.

## 3. Design-Read und Regler

Formuliere den Design-Read (ein Satz, siehe `geschmack.md` 1) und setze die drei Regler aus der
Tabelle in `geschmack.md` 2, bewusst angepasst an den Brief. Optional: höchstens zwei passende
Referenzen aus der DESIGN.md-Sammlung lesen (`geschmack.md` 7) – nur Prinzipien übernehmen.

## 4. Zwei Richtungen zur Wahl

Starte den `designer` mit Brief, Design-Read, Reglern, dem Pfad zu `${CLAUDE_SKILL_DIR}/geschmack.md`
und dem Auftrag „Richtungsentwurf": **zwei** klar verschiedene Richtungen (Grundhaltung, nicht nur
Farbe), je **eine** HTML-Datei als Mini-Styleguide mit: Farbpalette mit Rollen, Typo-Skala, Buttons,
Produktkarte, Hero, einer Inhalts-Section, der Signatur-Komponente und einer Mobilansicht (375 px).
Ablage: eingerichtet `docs/werkbank/design/richtung/`, sonst `.werkbank-tmp/design/richtung/`.
Beide müssen den Pre-Flight aus `geschmack.md` 6 bestehen.

Öffne beide für den Nutzer (Windows `explorer.exe "<pfad>"`, macOS `open`, Linux `xdg-open`; in
der Cloud den Vorschau-Weg des Projekts) und frag mit AskUserQuestion: Richtung A / Richtung B /
Mischung (was von welcher) / beide verwerfen (mit kurzer Begründung → neue Runde).

## 5. DESIGN.md schreiben

Aus der gewählten Richtung `DESIGN.md` im Projektstamm erstellen, Vorlage:
`${CLAUDE_SKILL_DIR}/vorlagen/DESIGN.md`. Alle Platzhalter füllen, nichts Unklares stehen lassen.
Pflicht: Brief, Design-Read, Regler, Token mit Rollen, Signatur-Komponente, Do's und Don'ts
(inklusive der bewusst ausgeschlossenen Standardmuster) und die Zuordnung Token → Shopify-Setting.

Die technische Umsetzung der Tokens im Theme (Settings, CSS Custom Properties) ist eine eigene
Aufgabe: als nächsten Schritt vorschlagen, nicht stillschweigend mit erledigen.

Committen (Git): nur `DESIGN.md` und die Richtungsentwürfe, Message `docs: add design direction`.

## 6. Abschluss

Drei Sätze an den Nutzer: welche Richtung, woran man den Shop künftig erkennt (Signatur), was
als Nächstes kommt. Ab jetzt lesen Designer, Planer und Prüfer `DESIGN.md` bei jeder
Oberflächenaufgabe.
