/**
 * Theme Store section behavior:
 * - Predictive search dropdown with two layers:
 *     1) live call to Shopify's /search/suggest.json (covers vendor / tags / partial matches)
 *     2) local fuzzy matcher over the inline JSON catalog using a normalized
 *        Levenshtein-distance score, so typos still surface "close enough" themes.
 * - Sidebar category filter via ?cat=<handle> URL param, no page reload.
 * - Mobile sidebar accordion toggle.
 *
 * Editor-safe: re-initializes on shopify:section:load, no globals.
 */
(function () {
  const SECTION_TYPE = 'theme-store';

  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Damerau-Levenshtein-ish (transposition aware) - small implementation.
  function editDistance(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;

    const prev = new Array(bl + 1);
    const curr = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) prev[j] = j;

    for (let i = 1; i <= al; i++) {
      curr[0] = i;
      for (let j = 1; j <= bl; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,        // insertion
          prev[j] + 1,            // deletion
          prev[j - 1] + cost      // substitution
        );
        if (
          i > 1 && j > 1 &&
          a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
          a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
        ) {
          curr[j] = Math.min(curr[j], prev[j - 1] - 1 + cost + 1); // transposition
        }
      }
      for (let j = 0; j <= bl; j++) prev[j] = curr[j];
    }
    return prev[bl];
  }

  // Score 0..1 (higher better). Considers exact substring, prefix, token starts, and edit distance.
  function fuzzyScore(needle, hay) {
    if (!needle) return 0;
    if (!hay) return 0;
    if (hay === needle) return 1;
    if (hay.startsWith(needle)) return 0.95;
    if (hay.includes(needle)) return 0.85;

    // Per-token check
    const tokens = hay.split(' ');
    let bestToken = 0;
    for (const t of tokens) {
      if (!t) continue;
      if (t.startsWith(needle)) { bestToken = Math.max(bestToken, 0.8); continue; }
      const d = editDistance(needle, t);
      const len = Math.max(needle.length, t.length);
      if (len === 0) continue;
      const sim = 1 - d / len;
      // small needles need a tighter bound
      const minSim = needle.length <= 3 ? 0.75 : 0.6;
      if (sim >= minSim) bestToken = Math.max(bestToken, sim * 0.75);
    }

    // Whole-string distance fallback
    const d = editDistance(needle, hay);
    const len = Math.max(needle.length, hay.length);
    const whole = len === 0 ? 0 : 1 - d / len;
    return Math.max(bestToken, whole * 0.55);
  }

  function searchCatalog(catalog, rawQuery, limit) {
    const q = normalize(rawQuery);
    if (!q) return [];

    const scored = [];
    for (const item of catalog) {
      const haystacks = [
        normalize(item.title),
        normalize(item.type),
        normalize(item.vendor),
        normalize(Array.isArray(item.tags) ? item.tags.join(' ') : item.tags)
      ].filter(Boolean);

      let best = 0;
      for (const h of haystacks) {
        const s = fuzzyScore(q, h);
        if (s > best) best = s;
      }
      if (best >= 0.45) scored.push({ item, score: best });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.item);
  }

  // Suggest a "did you mean" alternative when the query has no strong matches.
  function suggestAlternative(catalog, rawQuery) {
    const q = normalize(rawQuery);
    if (!q || q.length < 3) return null;

    let best = null;
    let bestSim = 0;
    for (const item of catalog) {
      const t = normalize(item.title);
      const sim = fuzzyScore(q, t);
      if (sim > bestSim && sim >= 0.4 && sim < 0.85) {
        bestSim = sim;
        best = item.title;
      }
    }
    return best;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderResults(container, items, suggestion, onSuggest) {
    if (!items.length && !suggestion) {
      container.innerHTML =
        '<div class="theme-store__search-empty">No matches found.</div>';
      container.hidden = false;
      return;
    }

    const parts = items.map(item => `
      <a class="theme-store__search-result" href="${escapeHtml(item.url)}" role="option">
        ${item.img ? `<img class="theme-store__search-result-img" src="${escapeHtml(item.img)}" alt="" loading="lazy">` : '<span class="theme-store__search-result-img" aria-hidden="true"></span>'}
        <span>
          <span class="theme-store__search-result-title">${escapeHtml(item.title)}</span><br>
          <span class="theme-store__search-result-meta">${escapeHtml(item.type || item.vendor || '')}</span>
        </span>
        <span class="theme-store__search-result-price">${escapeHtml(item.price || '')}</span>
      </a>
    `);

    if (suggestion) {
      parts.unshift(`
        <div class="theme-store__search-suggest">
          Did you mean
          <button type="button" data-ts-suggest="${escapeHtml(suggestion)}">${escapeHtml(suggestion)}</button>?
        </div>
      `);
    }

    container.innerHTML = parts.join('');
    container.hidden = false;

    if (suggestion) {
      const btn = container.querySelector('[data-ts-suggest]');
      if (btn) btn.addEventListener('click', () => onSuggest(btn.dataset.tsSuggest));
    }
  }

  // Merge Shopify suggest results with fuzzy results, preserving order, dedupe by id.
  function mergeResults(primary, secondary, limit) {
    const seen = new Set();
    const out = [];
    for (const list of [primary, secondary]) {
      for (const item of list) {
        const key = item.id || item.url;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  function fetchPredictive(query) {
    const url = `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=6&resources[options][unavailable_products]=last`;
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const products = data?.resources?.results?.products || [];
        return products.map(p => ({
          id: p.id || p.handle,
          title: p.title,
          url: p.url,
          type: p.product_type || '',
          vendor: p.vendor || '',
          price: p.price ? new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: window.Shopify?.currency?.active || 'USD' }).format(parseFloat(p.price)) : '',
          img: p.featured_image?.url || p.image || ''
        }));
      })
      .catch(() => []);
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function getActiveCat() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('cat') || 'all';
    } catch (_) { return 'all'; }
  }

  function applyFilter(root, cat) {
    const products = root.querySelectorAll('[data-ts-product]');
    let visible = 0;
    products.forEach(el => {
      const cats = (el.dataset.cats || '').split(/\s+/).filter(Boolean);
      const show = cat === 'all' || cats.includes(cat);
      el.hidden = !show;
      if (show) visible += 1;
    });

    root.querySelectorAll('[data-ts-cat]').forEach(link => {
      const isActive = link.dataset.tsCat === cat;
      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    const empty = root.querySelector('[data-ts-empty]');
    if (empty) empty.hidden = visible !== 0;
  }

  function setCat(root, cat, push) {
    if (push) {
      try {
        const url = new URL(window.location.href);
        if (cat === 'all') url.searchParams.delete('cat');
        else url.searchParams.set('cat', cat);
        window.history.pushState({ cat }, '', url.toString());
      } catch (_) { /* noop */ }
    }
    applyFilter(root, cat);
  }

  function initSidebarToggle(root) {
    const btn = root.querySelector('[data-ts-sidebar-toggle]');
    const panel = root.querySelector('[data-ts-sidebar-panel]');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function initCategoryLinks(root) {
    root.querySelectorAll('[data-ts-cat]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        setCat(root, link.dataset.tsCat, true);
      });
    });
  }

  function initSearch(root, sectionId) {
    const input = root.querySelector('[data-ts-search-input]');
    const results = root.querySelector('[data-ts-search-results]');
    const clearBtn = root.querySelector('[data-ts-search-clear]');
    const catalogScript = document.querySelector(`script[data-ts-catalog="${sectionId}"]`);

    let catalog = [];
    if (catalogScript) {
      try { catalog = JSON.parse(catalogScript.textContent); }
      catch (_) { catalog = []; }
    }

    if (!input || !results) return;

    function close() {
      results.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }

    function open() {
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    const runSearch = debounce(async (q) => {
      if (!q || q.length < 2) { close(); return; }

      const fuzzy = searchCatalog(catalog, q, 8);
      // Render fuzzy first for instant feedback
      renderResults(results, fuzzy, null, (s) => { input.value = s; runSearch.flush ? runSearch.flush() : runSearch(s); });
      open();

      // Then enhance with Shopify suggest
      const primary = await fetchPredictive(q);
      const merged = mergeResults(primary, fuzzy, 8);
      const suggestion = merged.length === 0 ? suggestAlternative(catalog, q) : null;
      renderResults(results, merged, suggestion, (s) => { input.value = s; runSearch(s); });
    }, 180);

    input.addEventListener('input', () => {
      const v = input.value;
      clearBtn.hidden = !v;
      runSearch(v);
    });

    input.addEventListener('focus', () => {
      if (input.value && input.value.length >= 2) open();
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      close();
      input.focus();
    });

    document.addEventListener('click', (e) => {
      if (!root.contains(e.target)) close();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
      const items = Array.from(results.querySelectorAll('.theme-store__search-result'));
      if (!items.length) return;
      let idx = items.findIndex(i => i.classList.contains('is-focused'));
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); }
      else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].click(); return; }
      items.forEach(i => i.classList.remove('is-focused'));
      if (idx >= 0) items[idx].classList.add('is-focused');
    });
  }

  function initSection(root) {
    if (!root || root.dataset.tsInitialized === 'true') return;
    root.dataset.tsInitialized = 'true';

    const sectionId = root.dataset.sectionId;
    initSidebarToggle(root);
    initCategoryLinks(root);
    initSearch(root, sectionId);

    applyFilter(root, getActiveCat());
  }

  function initAll(scope) {
    const containers = (scope || document).querySelectorAll(`[data-section-type="${SECTION_TYPE}"]`);
    containers.forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(document));
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', (e) => {
    if (e.target) initAll(e.target);
  });
  document.addEventListener('shopify:section:unload', (e) => {
    if (e.target) {
      e.target.querySelectorAll(`[data-section-type="${SECTION_TYPE}"]`).forEach(el => {
        delete el.dataset.tsInitialized;
      });
    }
  });
  document.addEventListener('shopify:block:select', (e) => {
    const root = e.target.closest(`[data-section-type="${SECTION_TYPE}"]`);
    if (root) {
      const panel = root.querySelector('[data-ts-sidebar-panel]');
      const btn = root.querySelector('[data-ts-sidebar-toggle]');
      if (panel && !panel.classList.contains('is-open')) {
        panel.classList.add('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'true');
      }
    }
  });

  window.addEventListener('popstate', () => {
    document.querySelectorAll(`[data-section-type="${SECTION_TYPE}"]`).forEach(root => {
      applyFilter(root, getActiveCat());
    });
  });
})();
