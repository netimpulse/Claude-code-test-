/*
 * SQE Predictive Search
 *
 * Sucht ueber Shopifys /search/suggest.json — gleichzeitig nach Produkten,
 * Seiten und Blog-Artikeln. Zusaetzlich:
 *  - Typo-Toleranz via Levenshtein-Abstand auf den Trefferstrings.
 *  - "Verwandte" Treffer: nach jedem Resultat wird der Hauptbegriff in
 *    Tokens zerlegt, einzelne Tokens werden als zusaetzliche Queries
 *    abgesetzt, Resultate gemerged + dedupliziert.
 *  - "Did-you-mean": wenn die Primaerabfrage 0 Treffer hat, werden
 *    kleinere Edit-Variants (Buchstabe loeschen, swap, ersetzen) probiert.
 *    Erster Variant mit >0 Treffern wird als Suggestion angezeigt.
 */
(() => {
  const RESOURCE_TYPES = "product,page,article";
  const LIMIT_PRIMARY = 6;
  const LIMIT_RELATED = 3;
  const MIN_QUERY = 2;
  const DEBOUNCE_MS = 200;

  // -------- Levenshtein (iterative, no recursion) --------
  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const m = a.length;
    const n = b.length;
    const dp = new Uint16Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  }

  // Generate a few cheap edit variants for the "did you mean" fallback.
  function editVariants(q) {
    const out = new Set();
    const s = q.toLowerCase();
    if (s.length < 3) return [];
    // Drop one char
    for (let i = 0; i < s.length; i++) {
      out.add(s.slice(0, i) + s.slice(i + 1));
    }
    // Swap adjacent
    for (let i = 0; i < s.length - 1; i++) {
      out.add(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2));
    }
    return [...out].filter((v) => v.length >= MIN_QUERY && v !== s);
  }

  // Split query into tokens to broaden related lookups.
  function relatedQueries(q) {
    const tokens = q
      .toLowerCase()
      .split(/[\s,\-_/]+/)
      .filter((t) => t.length >= 3);
    return tokens.slice(0, 3);
  }

  // -------- Shopify suggest fetch --------
  // Locale-aware root (e.g. "/en/") so suggestions come from the active language.
  const ROOT_URL =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";

  function suggestUrl() {
    return ROOT_URL.replace(/\/?$/, "/") + "search/suggest.json";
  }

  async function suggest(q, limit) {
    const url =
      `${suggestUrl()}?q=${encodeURIComponent(q)}` +
      `&resources[type]=${RESOURCE_TYPES}` +
      `&resources[limit]=${limit}` +
      `&resources[options][fields]=title,product_type,vendor,tag,body`;
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const j = await r.json();
      return j.resources && j.resources.results;
    } catch {
      return null;
    }
  }

  function flatten(results) {
    const items = [];
    if (!results) return items;
    (results.products || []).forEach((p) => items.push({ ...p, _type: "product" }));
    (results.pages || []).forEach((p) => items.push({ ...p, _type: "page" }));
    (results.articles || []).forEach((p) => items.push({ ...p, _type: "article" }));
    return items;
  }

  function dedupe(items) {
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const key = `${it._type}:${it.url || it.handle || it.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }

  // Rank items by Levenshtein distance against the query (lower = better).
  function rank(items, q) {
    const ql = q.toLowerCase();
    return items
      .map((it) => {
        const t = (it.title || "").toLowerCase();
        // Exact substring match → distance 0; otherwise prefix-aware lev.
        const dist = t.includes(ql) ? 0 : lev(ql, t.slice(0, ql.length + 2));
        return { ...it, _dist: dist };
      })
      .sort((a, b) => a._dist - b._dist);
  }

  // -------- Rendering (DOM only, all texts via textContent) --------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function highlight(title, q) {
    const frag = document.createDocumentFragment();
    const t = title || "";
    const idx = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (idx < 0) {
      frag.append(document.createTextNode(t));
      return frag;
    }
    frag.append(
      document.createTextNode(t.slice(0, idx)),
      el("mark", "", t.slice(idx, idx + q.length)),
      document.createTextNode(t.slice(idx + q.length))
    );
    return frag;
  }

  function safeUrl(u) {
    // Only same-origin/relative links from suggest.json; anything else falls back to "#".
    try {
      const url = new URL(u || "#", window.location.href);
      return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "#";
    } catch {
      return "#";
    }
  }

  function renderItem(it, q) {
    const a = el("a", "sqe-search-result");
    a.setAttribute("role", "option");
    a.href = safeUrl(it.url);

    const media = el("div", "sqe-search-result__media");
    if (it.image) {
      const img = document.createElement("img");
      img.src = String(it.image);
      img.alt = "";
      img.loading = "lazy";
      media.append(img);
    }
    a.append(media);

    const body = el("div");
    const title = el("div", "sqe-search-result__title");
    title.append(highlight(it.title, q));
    body.append(title);
    const meta = it.vendor || it.product_type || "";
    if (meta) body.append(el("div", "sqe-search-result__meta", meta));
    a.append(body);

    if (it.price) a.append(el("div", "sqe-search-result__price", String(it.price)));
    return a;
  }

  function renderGroup(label, items, q) {
    if (!items.length) return null;
    const group = el("div", "sqe-search-group");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    // Visual label only; the group is named via aria-label (no heading inside the listbox).
    const heading = el("div", "sqe-search-group__heading", label);
    heading.setAttribute("aria-hidden", "true");
    group.append(heading);
    items.forEach((it) => group.append(renderItem(it, q)));
    return group;
  }

  function render(container, q, items, texts, opts = {}) {
    const products = items.filter((i) => i._type === "product");
    const pages = items.filter((i) => i._type === "page");
    const articles = items.filter((i) => i._type === "article");
    const nodes = [];

    if (opts.didYouMean) {
      const typo = el("div", "sqe-search-typo");
      const btn = el("button", "", opts.didYouMean);
      btn.type = "button";
      btn.setAttribute("data-sqe-suggest", opts.didYouMean);
      typo.append(document.createTextNode(`${texts.didYouMean} `), btn, document.createTextNode("?"));
      nodes.push(typo);
    }
    nodes.push(
      renderGroup(texts.products, products, q),
      renderGroup(texts.pages, pages, q),
      renderGroup(texts.articles, articles, q)
    );

    if (!items.length && !opts.didYouMean) {
      nodes.length = 0;
      nodes.push(el("div", "sqe-search-empty", texts.noResults.replace("{q}", q)));
    }
    container.replaceChildren(...nodes.filter(Boolean));
    container.hidden = false;
  }

  // -------- Per-section setup --------
  function bindSection(section) {
    if (section.__sqeSearchInit) return;
    section.__sqeSearchInit = true;
    const panel = section.querySelector("[data-sqe-search]");
    const input = section.querySelector("[data-sqe-search-input]");
    const results = section.querySelector("[data-sqe-search-results]");
    if (!panel || !input || !results) return;

    // Localised labels come from Liquid (| t | escape) as data attributes.
    const texts = {
      products: panel.getAttribute("data-i18n-products") || "",
      pages: panel.getAttribute("data-i18n-pages") || "",
      articles: panel.getAttribute("data-i18n-articles") || "",
      didYouMean: panel.getAttribute("data-i18n-did-you-mean") || "",
      noResults: panel.getAttribute("data-i18n-no-results") || "{q}",
    };

    let lastReq = 0;
    let timer;

    async function run(q) {
      if (q.length < MIN_QUERY) {
        results.hidden = true;
        results.replaceChildren();
        input.setAttribute("aria-expanded", "false");
        return;
      }
      const seq = ++lastReq;

      const [primary, ...relatedSets] = await Promise.all([
        suggest(q, LIMIT_PRIMARY),
        ...relatedQueries(q).map((t) => suggest(t, LIMIT_RELATED)),
      ]);
      if (seq !== lastReq) return;

      let items = dedupe([
        ...flatten(primary),
        ...relatedSets.flatMap((r) => flatten(r)),
      ]);

      // Typo fallback: nothing matched → try edit variants.
      let didYouMean = null;
      if (!items.length) {
        for (const v of editVariants(q)) {
          const r = await suggest(v, LIMIT_PRIMARY);
          if (seq !== lastReq) return;
          const flat = flatten(r);
          if (flat.length) {
            items = flat;
            didYouMean = v;
            break;
          }
        }
      }

      items = rank(items, didYouMean || q).slice(0, 12);
      render(results, q, items, texts, { didYouMean });
      input.setAttribute("aria-expanded", String(items.length > 0 || !!didYouMean));
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      timer = setTimeout(() => run(q), DEBOUNCE_MS);
    });

    // Click on the "did you mean" suggestion → rerun
    results.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sqe-suggest]");
      if (!btn) return;
      e.preventDefault();
      input.value = btn.getAttribute("data-sqe-suggest");
      run(input.value);
      input.focus();
    });

    // Keyboard nav over results
    input.addEventListener("keydown", (e) => {
      if (results.hidden) return;
      const links = [...results.querySelectorAll(".sqe-search-result")];
      if (!links.length) return;
      const cur = results.querySelector(".sqe-search-result.is-focused");
      let idx = cur ? links.indexOf(cur) : -1;
      if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(links.length - 1, idx + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); }
      else if (e.key === "Enter" && cur) { e.preventDefault(); cur.click(); return; }
      else return;
      links.forEach((a) => a.classList.remove("is-focused"));
      if (links[idx]) {
        links[idx].classList.add("is-focused");
        links[idx].scrollIntoView({ block: "nearest" });
      }
    });
  }

  function bindAll() {
    document
      .querySelectorAll("[data-section-type='sqe-header']")
      .forEach(bindSection);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll);
  } else {
    bindAll();
  }
  document.addEventListener("shopify:section:load", (e) => {
    const n = e.target.querySelector("[data-section-type='sqe-header']");
    if (n) bindSection(n);
  });
})();
