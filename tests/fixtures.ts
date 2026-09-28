/**
 * Stabile Test-Fixtures fuer den Visual-QA-Workflow.
 *
 * Alle Werte hier sind im Dev-Store `dev-store-4ogqgshg` fest angelegt:
 * - Produkt "QA Test Produkt" mit Handle qa-test-produkt
 * - Collection "QA Test Collection" mit Handle qa-test-collection
 * - Page "QA Block Test" mit Handle qa-block-test, Template qa-block-test
 *
 * Diese Datei wird von block-spezifischen Tests importiert.
 */

export const QA = {
  /**
   * ID des Themes, gegen das die Tests laufen. Default ist das unveroeffentlichte
   * Redesign-Theme "NetImpulse Redesign". Achtung: 145381884019 ("QA Preview")
   * ist im Dev-Store aktuell LIVE geschaltet und daher kein Test-Default mehr.
   * Ueberschreibbar per ENV QA_THEME_ID.
   */
  themeId: process.env.QA_THEME_ID ?? "164085104755",

  /** Bekannte Fixtures im Dev-Store. */
  product: {
    handle: "qa-test-produkt",
    id: "8267391139955",
    firstVariantSku: "QA-S-BLACK",
  },
  collection: {
    handle: "qa-test-collection",
    id: "317774135411",
  },

  /** Mapping: Template-Typ -> Pfad ohne Query-String. */
  paths: {
    home: "/",
    qaBlock: "/pages/qa-block-test",
    product: "/products/qa-test-produkt",
    collection: "/collections/qa-test-collection",
    cart: "/cart",
    search: "/search?q=qa",
    notFound: "/this-page-does-not-exist",
    leistungen: "/pages/leistungen",
    seo: "/pages/seo",
    sea: "/pages/sea",
    smm: "/pages/smm",
    geo: "/pages/geo",
    webDesign: "/pages/web-design",
    ueberUns: "/pages/ueber-uns",
    kontakt: "/pages/kontakt",
    themeStore: "/pages/theme-store",
    widerruf: "/pages/widerruf",
    blog: "/blogs/news",
    policy: "/policies/privacy-policy",
  },
} as const;

/**
 * Haengt preview_theme_id korrekt an einen Pfad an (egal ob er schon
 * einen Query-String hat oder nicht).
 *
 * @example
 *   await page.goto(withTheme(QA.paths.product));
 *   // -> /products/qa-test-produkt?preview_theme_id=145381884019
 */
export function withTheme(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}preview_theme_id=${QA.themeId}`;
}
