# Videos für die Leistungs-Heroes mit Google Flow

Kurzanleitung für NetImpulse: So entsteht pro Leistung (SEO, SEA, SMM, GEO, Webdesign) ein kurzes Video, in dem sich
Teile zu einem Objekt zusammensetzen. Das Video läuft in voller Breite im Hero, Headline und Button liegen darauf.
Solange kein Video eingesetzt ist, zeigt der Hero automatisch die Code-Animation.

> Stand Oktober 2026. Flow ändert sich schnell. Alles, was mit „im Konto prüfen" markiert ist, vor dem Einsatz in
> deinem eigenen Flow-Konto nachsehen.

## 1. Vorher klären (einmalig)

- **Abo:** Flow läuft über ein Google-AI-Abo. Wie viele Videos du erzeugen kannst und ob ein Wasserzeichen sichtbar ist,
  hängt vom Abo ab. Laut Drittquellen tragen Exporte in den kleineren Stufen ein sichtbares „Made with Veo"-Wasserzeichen, in
  Google AI Ultra nicht (im Konto prüfen). Ein sichtbares Wasserzeichen gehört nicht in den Hero.
- **Unsichtbares Wasserzeichen:** Jedes Veo-Video enthält SynthID. Das stört die Darstellung nicht.
- **Nutzungsrechte:** Kommerzielle Nutzung ist nach den gängigen Quellen für allgemein verfügbare Funktionen erlaubt.
  Vor dem Livegang die aktuellen Nutzungsbedingungen von Flow/Google AI lesen.
- **Kennzeichnung:** KI-generierte Bilder/Videos können nach EU-AI-Act (Art. 50) kennzeichnungspflichtig sein. Bei
  rein illustrativen, erkennbar abstrakten Animationen ist das meist unkritisch, im Zweifel rechtlich prüfen lassen. Ein
  dezenter Hinweis im Impressum oder Footer („Visualisierungen teilweise KI-generiert") ist eine einfache Lösung.

## 2. Bildsprache (gilt für alle Videos)

- **Farben:** heller Sand-Hintergrund `#f8f6f1` bzw. `#efe6d8`, Objekte in Petrol `#1c4948`, Sand, Creme und wenig
  Schwarz `#0d0d0d`. Keine Neonfarben, keine Lila-/Blauverläufe.
- **Stil:** ruhig, edel, aufgeräumt. Matte Oberflächen, weiches Studiolicht von oben links, leichte Schatten.
  Keine Menschen, kein Text, keine Logos, keine Bildschirme mit Schrift (Flow verfälscht Text).
- **Kamera:** fest (statisch), leicht von oben, isometrisch wirkend. Keine Kamerafahrten, kein Zoom.
- **Komposition:** Das Objekt steht **rechts der Mitte**. Unten links bleibt eine ruhige, freie Fläche, denn dort liegen
  im Hero die Headline und der Button.
- **Ablauf:** Die Teile schweben anfangs auseinander (Explosionszeichnung) und fahren dann auf geraden Achsen zusammen,
  rasten ein, kurz nachgefedert, dann Stillstand. Das Video endet auf dem fertigen Objekt.

## 3. Ablauf in Flow (pro Leistung)

1. **Endbild erzeugen:** das fertige Objekt als Standbild (Bildfunktion in Flow oder ein anderes Bild-Tool).
   Prompt-Vorlage siehe Abschnitt 4. Mehrere Versuche machen und das ruhigste Bild nehmen.
2. **Startbild erzeugen:** dasselbe Objekt, aber in Einzelteile zerlegt („exploded view"). Am besten mit dem Endbild als
   Referenz, damit Farben, Licht und Perspektive identisch bleiben.
3. **Video erzeugen:** „Frames to Video": Startbild als ersten, Endbild als letzten Frame. Dazu den Bewegungs-Prompt
   aus Abschnitt 4. Querformat **16:9** für Desktop wählen.
4. **Handy-Version (optional):** dasselbe im Hochformat **9:16** erzeugen. Hier das Objekt in die **obere Hälfte** setzen,
   denn unten liegt der Text. Ohne Handy-Version zeigt die Seite auf dem Handy die Code-Animation.
5. **Kontrolle:** Kein Morphing (Teile dürfen sich nicht verformen), keine Schrift, kein sichtbares Wasserzeichen,
   ruhige Fläche unten links, letzter Frame ist ein sauberes Standbild.
6. **Export** in der höchsten verfügbaren Auflösung (1080p reicht).

## 4. Prompt-Vorlagen

Allgemeiner Bewegungs-Prompt (für „Frames to Video"):

> Locked-off static camera, slightly elevated isometric view. Matte objects in deep petrol green, warm sand and cream on a
> plain warm sand background. The separate parts float apart, then glide along straight axes and snap precisely into place,
> with a soft, short settle. Then everything holds still. Soft studio light from the upper left, subtle soft shadows.
> Calm, elegant, premium. No text, no logos, no people, no camera movement, no audio.

Objekte je Leistung (für End- und Startbild, jeweils hinten anhängen: „…, object placed right of center, empty calm space
in the lower left, plain warm sand background #f8f6f1, matte materials, soft studio light, isometric, no text"):

| Leistung | Objekt (Endbild) |
|---|---|
| SEO | A large magnifying glass resting on a layered search-index platform made of stacked petrol and cream plates |
| SEA | Three rising campaign blocks in sand, petrol and cream on a flat base, like steps building up |
| SMM | A stack of floating content cards and a phone-like slab, arranged neatly in an isometric grid |
| GEO | A speech-bubble shaped answer panel assembled from several small citation tiles and a small pedestal |
| Webdesign | An abstract website layout assembled from flat modules (header bar, image block, text blocks) on a platform |

Für das Startbild denselben Text verwenden und ergänzen: „exploded view, the same parts separated and floating apart
along straight axes, evenly spaced, nothing deformed".

## 5. Für das Web aufbereiten (ffmpeg)

Videos ohne Ton, kompakt und schnell startend:

```bash
# Desktop 16:9, 1080p, ohne Ton, schnell startend
ffmpeg -i flow-seo.mp4 -an -vf "scale=-2:1080" -c:v libx264 -pix_fmt yuv420p -crf 27 -preset slow -movflags +faststart seo-1080.mp4

# Handy 9:16, 720p
ffmpeg -i flow-seo-9x16.mp4 -an -vf "scale=720:-2" -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow -movflags +faststart seo-mobil.mp4

# Posterbild = letzter Frame (wird bei reduzierter Bewegung und vor dem Start gezeigt)
ffmpeg -sseof -0.1 -i seo-1080.mp4 -frames:v 1 -q:v 3 seo-poster.jpg
```

Zielgrößen: Desktop unter ca. 5 MB, Handy unter ca. 2–3 MB. Länge 4–8 Sekunden.

## 6. Einsetzen im Shop

1. Shopify-Admin → Inhalte → Dateien: Video(s) und Posterbild hochladen.
2. Onlineshop → Themes → Redesign-Theme → Anpassen → die jeweilige Leistungsseite öffnen.
3. Im Hero-Abschnitt: „Video" (Desktop), optional „Video Handy" und „Posterbild" auswählen. Speichern.
4. Prüfen: Text gut lesbar über allen Frames? Pause-Knopf sichtbar? Auf dem Handy getestet?

Das Video spielt einmal ab und bleibt auf dem fertigen Objekt stehen. Bei „reduzierter Bewegung" im Betriebssystem
und im Datensparmodus wird nur das Posterbild gezeigt.

## Quellen

- Google: [Introducing Veo 3.1 and advanced capabilities in Flow](https://blog.google/technology/ai/veo-updates-flow/) – „Frames to Video", „Ingredients to Video", „Extend".
- Drittquellen zu Wasserzeichen/Abo (im Konto prüfen): [Google Flow Review 2026](https://aivideopicks.com/posts/google-flow-review-2026.html), [Flow Watermark Guide 2026](https://whiskailabs.net/google-flow-veo-watermark-guide-2026/).
