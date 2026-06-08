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
  async function suggest(q, limit, types) {
    const url =
      `/search/suggest.json?q=${encodeURIComponent(q)}` +
      `&resources[type]=${types || RESOURCE_TYPES}` +
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

  function highlight(title, q) {
    if (!title || !q) return title || "";
    const idx = title.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return escapeHTML(title);
    return (
      escapeHTML(title.slice(0, idx)) +
      "<mark>" + escapeHTML(title.slice(idx, idx + q.length)) + "</mark>" +
      escapeHTML(title.slice(idx + q.length))
    );
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderItem(it, q) {
    const img = it.image
      ? `<div class="sqe-search-result__media"><img src="${escapeHTML(it.image)}" alt=""></div>`
      : `<div class="sqe-search-result__media"></div>`;
    const price = it.price ? `<div class="sqe-search-result__price">${escapeHTML(it.price)}</div>` : "";
    const meta = it.vendor || it.product_type || "";
    const metaHTML = meta ? `<div class="sqe-search-result__meta">${escapeHTML(meta)}</div>` : "";
    return `
      <a class="sqe-search-result" role="option" href="${escapeHTML(it.url || "#")}">
        ${img}
        <div>
          <div class="sqe-search-result__title">${highlight(it.title, q)}</div>
          ${metaHTML}
        </div>
        ${price}
      </a>`;
  }

  function renderGroup(label, items, q) {
    if (!items.length) return "";
    return `
      <div class="sqe-search-group" data-sqe-group="${escapeHTML(label)}">
        <h3 class="sqe-search-group__heading">${escapeHTML(label)}</h3>
        ${items.map((it) => renderItem(it, q)).join("")}
      </div>`;
  }

  function render(container, q, items, opts = {}) {
    const products = items.filter((i) => i._type === "product");
    const pages = items.filter((i) => i._type === "page");
    const articles = items.filter((i) => i._type === "article");

    let html = "";
    if (opts.didYouMean) {
      html += `<div class="sqe-search-typo">Meintest du <button type="button" data-sqe-suggest="${escapeHTML(opts.didYouMean)}">${escapeHTML(opts.didYouMean)}</button>?</div>`;
    }
    html += renderGroup("Produkte", products, q);
    html += renderGroup("Seiten", pages, q);
    html += renderGroup("Artikel", articles, q);

    if (!items.length && !opts.didYouMean) {
      html = `<div class="sqe-search-empty">Keine Treffer fuer "${escapeHTML(q)}".</div>`;
    }
    container.innerHTML = html;
    container.hidden = false;
  }

  // -------- Per-section setup --------
  function bindSection(section) {
    if (section.__sqeSearchInit) return;
    section.__sqeSearchInit = true;
    const input = section.querySelector("[data-sqe-search-input]");
    const results = section.querySelector("[data-sqe-search-results]");
    if (!input || !results) return;

    // Optional per-section resource scope, e.g. data-sqe-types="article".
    const types = section.getAttribute("data-sqe-types") || RESOURCE_TYPES;

    let lastReq = 0;
    let timer;

    async function run(q) {
      if (q.length < MIN_QUERY) {
        results.hidden = true;
        results.innerHTML = "";
        input.setAttribute("aria-expanded", "false");
        return;
      }
      const seq = ++lastReq;

      const [primary, ...relatedSets] = await Promise.all([
        suggest(q, LIMIT_PRIMARY, types),
        ...relatedQueries(q).map((t) => suggest(t, LIMIT_RELATED, types)),
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
          const r = await suggest(v, LIMIT_PRIMARY, types);
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
      render(results, q, items, { didYouMean });
      input.setAttribute("aria-expanded", String(items.length > 0 || !!didYouMean));
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      timer = setTimeout(() => run(q), DEBOUNCE_MS);
    });

    // Click on "Meintest du" suggestion → rerun
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

  const ROOT_SELECTOR = "[data-section-type='sqe-header'], [data-sqe-search-root]";

  function bindAll() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(bindSection);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll);
  } else {
    bindAll();
  }
  document.addEventListener("shopify:section:load", (e) => {
    if (e.target.matches && e.target.matches(ROOT_SELECTOR)) bindSection(e.target);
    const n = e.target.querySelector && e.target.querySelector(ROOT_SELECTOR);
    if (n) bindSection(n);
  });
})();
