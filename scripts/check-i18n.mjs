#!/usr/bin/env node
/**
 * i18n-Check fuer das Theme (ohne Abhaengigkeiten, Node >= 22).
 *
 * Regeln:
 *  1. Locale-Dateien parsen (Kopfkommentar wird entfernt).
 *  2. de.json und en.default.json haben exakt dieselben Keys (inkl. Plural-Keys).
 *  3. Kein leerer Wert; gleiche {{ }}-Platzhalter je Key.
 *  4. Jeder statische 'a.b' | t in Liquid existiert in beiden Dateien.
 *  5. de.json nutzt die du-Form (keine Sie-Form, kein ihr/euch/eure/euer).
 *  6. In STRICT_FILES keine hart codierten, sprachlichen Texte in Attributen,
 *     `| default: '…'` oder Textknoten (Dateien kommen schrittweise dazu).
 *  7. In assets/*.js keine Storefront-Pfade ohne Locale-Praefix
 *     ('/search', '/cart', '/products', '/collections' als Literal).
 *
 * Aufruf: node scripts/check-i18n.mjs [--self-test]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LOCALES = { de: "locales/de.json", en: "locales/en.default.json" };
const LIQUID_DIRS = ["sections", "snippets", "blocks", "layout", "templates"];

/** Dateien, die bereits vollstaendig auf `| t` umgestellt sind (waechst je Schritt). */
const STRICT_FILES = [
  "sections/footer.liquid", // S4c
  "sections/sqe-header.liquid", // S4a1/S4a2
  "snippets/language-switcher.liquid", // S4b
  "sections/ni-hero.liquid", // S5a1
  "sections/ni-intro.liquid", // S5a2
  "sections/ni-deck.liquid", // S5b1
  "snippets/ni-deck-graphic.liquid", // S5b2
  "sections/team-compact.liquid", // S5c
  "sections/cta-compact.liquid", // S5c
];

/** Bekannte Verstoesse gegen Regel 7; die Liste darf nur schrumpfen. */
const PREFIX_EXCEPTIONS = [
  "assets/sticky-buy-bar.js", // Section ungenutzt, nur im Bericht erwaehnt
  "assets/cart.js", // wird in S7d behoben
  "assets/theme-store.js", // wird in S7e behoben
];

/** Erlaubte ihr/euch-Vorkommen in de.json (Key-Pfad). */
const DU_EXCEPTIONS = [];

const errors = [];
const fail = (rule, msg) => errors.push(`[R${rule}] ${msg}`);

export function stripHeader(raw) {
  return raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const placeholders = (s) => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");

function walk(dir, ext, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, ext, out);
    else if (e.name.endsWith(ext)) out.push(rel);
  }
  return out;
}

/** Entfernt Bereiche, in denen Texte keine Storefront-Texte sind. */
export function stripNonMarkup(src) {
  return src
    .replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, "")
    .replace(/\{%-?\s*(stylesheet|javascript|style)\s*-?%\}[\s\S]*?\{%-?\s*end\1\s*-?%\}/g, "")
    .replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, "")
    .replace(/\{%-?\s*#[^%]*%\}/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<svg[\s\S]*?<\/svg>/g, "");
}

const looksLikeLanguage = (s) =>
  /[A-Za-zÄÖÜäöüß]{2,}/.test(s) && (/\s/.test(s.trim()) || /[A-ZÄÖÜ]/.test(s) || /[äöüß]/i.test(s)) &&
  !/^#[0-9a-f]{3,8}$/i.test(s) && !/^(https?:|\/|shopify:)/.test(s) && !/%[a-zA-Z]/.test(s);

/** Regel 6: liefert gefundene hart codierte Texte einer Liquid-Quelle. */
export function findHardcoded(src) {
  const code = stripNonMarkup(src);
  const hits = [];
  for (const m of code.matchAll(/\b(aria-label|placeholder|title|alt)="([^"{]*?)"/g)) {
    if (looksLikeLanguage(m[2])) hits.push(`${m[1]}="${m[2]}"`);
  }
  for (const m of code.matchAll(/\|\s*default:\s*'([^']*)'(?!\s*\|\s*t\b)/g)) {
    if (looksLikeLanguage(m[1])) hits.push(`default: '${m[1]}'`);
  }
  const textOnly = code.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, " ");
  for (const m of textOnly.matchAll(/>([^<>]+)</g)) {
    const t = m[1].replace(/&[a-z#0-9]+;/gi, " ").trim();
    if (t && looksLikeLanguage(t)) hits.push(`Text: "${t.slice(0, 40)}"`);
  }
  return hits;
}

/** Regel 7: liefert Storefront-Pfade ohne Locale-Praefix in JS-Quelltext. */
export function findUnprefixedPaths(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const hits = [];
  for (const m of code.matchAll(/(["'`])(\/(?:search|cart|products|collections)\b[^"'`]*)\1/g)) {
    hits.push(m[2]);
  }
  return hits;
}

function selfTest() {
  const cases6 = [
    ['<button aria-label="Menü öffnen">', 1],
    ["{{ x | default: 'Mehr erfahren' }}", 1],
    ["<p>Keine Ergebnisse gefunden</p>", 1],
    ["{%- assign align = 'left' -%}<div class=\"full\"></div>", 0],
    ["<span>{{ 'header.menu' | t }}</span>", 0],
    ["{% schema %}{\"label\": \"Überschrift\"}{% endschema %}<i></i>", 0],
  ];
  const cases7 = [
    ["const url = `/search/suggest.json?q=${q}`;", 1],
    ["fetch('/cart/change.js', {})", 1],
    ["fetch(\"/products/\" + handle + \".js\")", 1],
    ["/* uses '/cart/add.js' in docs */ const a = 1;", 0],
    ["fetch(window.Shopify.routes.root + 'cart/change.js')", 0],
    ["// fetch('/search')\nconst b = 2;", 0],
  ];
  let ok = true;
  for (const [src, n] of cases6) {
    const got = findHardcoded(src).length;
    if ((got > 0) !== (n > 0)) { ok = false; console.error(`Selbsttest R6 falsch (${got}): ${src}`); }
  }
  for (const [src, n] of cases7) {
    const got = findUnprefixedPaths(src).length;
    if ((got > 0) !== (n > 0)) { ok = false; console.error(`Selbsttest R7 falsch (${got}): ${src}`); }
  }
  return ok;
}

function main() {
  if (!selfTest()) process.exit(2);
  if (process.argv.includes("--self-test")) { console.log("Selbsttests ok"); return; }

  // R1
  const data = {};
  for (const [lang, rel] of Object.entries(LOCALES)) {
    try {
      data[lang] = flatten(JSON.parse(stripHeader(fs.readFileSync(path.join(ROOT, rel), "utf8"))));
    } catch (e) {
      fail(1, `${rel}: ${e.message}`);
    }
  }
  if (errors.length) return report();

  // R2 + R3
  const keys = new Set([...Object.keys(data.de), ...Object.keys(data.en)]);
  for (const k of keys) {
    if (!(k in data.de)) fail(2, `fehlt in de.json: ${k}`);
    else if (!(k in data.en)) fail(2, `fehlt in en.default.json: ${k}`);
    else {
      for (const lang of ["de", "en"]) if (String(data[lang][k]).trim() === "") fail(3, `leer in ${lang}: ${k}`);
      if (placeholders(data.de[k]) !== placeholders(data.en[k])) fail(3, `Platzhalter unterschiedlich: ${k}`);
    }
  }

  // R4 + R6
  const liquidFiles = LIQUID_DIRS.flatMap((d) => walk(d, ".liquid"));
  const pluralBase = new Set([...keys].map((k) => k.replace(/\.(one|other|zero|few|many|two)$/, "")));
  for (const rel of liquidFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const m of stripNonMarkup(src).matchAll(/['"]([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"]\s*\|\s*t\b/g)) {
      if (!keys.has(m[1]) && !pluralBase.has(m[1])) fail(4, `${rel}: Key fehlt in Locale-Dateien: ${m[1]}`);
    }
    if (STRICT_FILES.includes(rel)) {
      for (const hit of findHardcoded(src)) fail(6, `${rel}: hart codierter Text ${hit}`);
    }
  }

  // R5
  const sieForm = /\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres)\b/;
  const ihrForm = /\b(ihr|euch|eure|euer|euren|eurem|eurer)\b/i;
  for (const [k, v] of Object.entries(data.de)) {
    if (DU_EXCEPTIONS.includes(k)) continue;
    if (sieForm.test(v)) fail(5, `Sie-Form in de.json: ${k} = ${v}`);
    if (ihrForm.test(v)) fail(5, `ihr/euch-Form in de.json: ${k} = ${v}`);
  }

  // R7
  for (const rel of walk("assets", ".js")) {
    if (PREFIX_EXCEPTIONS.includes(rel)) continue;
    const hits = findUnprefixedPaths(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    for (const h of hits) fail(7, `${rel}: Pfad ohne Locale-Praefix: ${h}`);
  }

  report();
}

function report() {
  if (errors.length) {
    console.error(errors.join("\n"));
    console.error(`\ni18n-Check: ${errors.length} Fehler`);
    process.exit(1);
  }
  console.log("i18n-Check: ok");
}

main();
