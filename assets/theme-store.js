/**
 * Theme Store section behavior (sections/theme-store.liquid):
 * - Category filter via ?cat=<handle> URL param + history.pushState, no reload.
 * - Search filters the grid directly:
 *     1) local fuzzy matcher over the inline JSON catalog (normalized,
 *        transposition-aware edit distance) so typos still find themes and
 *        a "did you mean …" hint can be offered;
 *     2) Shopify's predictive search (/search/suggest.json, locale-prefixed via
 *        window.Shopify.routes.root) adds matches on vendor / tags / body.
 * - Clear button and Escape reset the search; empty state with reset actions.
 *
 * All UI strings come from data-i18n-* attributes (rendered via `| t`).
 * Editor-safe: re-initializes on shopify:section:load, no globals.
 */
(function () {
  const SECTION_TYPE = 'theme-store';
  const EXACT = 0.8; // substring / prefix / token-prefix hit
  const FUZZY = 0.45; // "close enough" (typo tolerance)

  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Optimal string alignment distance (Damerau-Levenshtein with adjacent
  // transpositions): "nvoa" -> "nova" costs 1.
  function editDistance(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;

    let prev2 = new Array(bl + 1).fill(0); // row i-2
    let prev = new Array(bl + 1);          // row i-1
    let curr = new Array(bl + 1);          // row i
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
          curr[j] = Math.min(curr[j], prev2[j - 2] + 1); // transposition
        }
      }
      const recycled = prev2;
      prev2 = prev;
      prev = curr;
      curr = recycled;
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

  function haystacksFor(item) {
    return [
      normalize(item.title),
      normalize(item.type),
      normalize(item.category),
      normalize(item.vendor),
      normalize(Array.isArray(item.tags) ? item.tags.join(' ') : item.tags)
    ].filter(Boolean);
  }

  function scoreItem(q, item) {
    let best = 0;
    for (const h of item._hay) {
      const s = fuzzyScore(q, h);
      if (s > best) best = s;
    }
    return best;
  }

  // Suggest a "did you mean" alternative when the query has no strong matches.
  function suggestAlternative(items, q) {
    if (!q || q.length < 3) return null;
    let best = null;
    let bestSim = 0;
    for (const item of items) {
      const sim = fuzzyScore(q, normalize(item.title));
      if (sim > bestSim && sim >= 0.4 && sim < 0.85) {
        bestSim = sim;
        best = item.title;
      }
    }
    return best;
  }

  // Locale-aware storefront root (e.g. "/" or "/en/"), same pattern as
  // assets/product-detail.js.
  const ROOT_URL =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function fetchPredictive(query) {
    const url = `${ROOT_URL.replace(/\/?$/, '/')}search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=10&resources[options][unavailable_products]=last`;
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const products = (data && data.resources && data.resources.results && data.resources.results.products) || [];
        const keys = new Set();
        products.forEach(p => {
          if (p.handle) keys.add(String(p.handle));
          if (p.id) keys.add(String(p.id));
        });
        return keys;
      })
      .catch(() => new Set());
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
      return new URLSearchParams(window.location.search).get('cat') || 'all';
    } catch (_) { return 'all'; }
  }

  // Replace the __N__ / __QUERY__ / __CATEGORY__ tokens that Liquid passes
  // into the translated templates (data-i18n-*).
  function fmt(tpl, vars) {
    return String(tpl || '').replace(/__(N|QUERY|CATEGORY)__/g, (m, k) => {
      const key = k.toLowerCase();
      return key in vars ? String(vars[key]) : m;
    });
  }

  function initSection(root) {
    if (!root || root.dataset.tsInitialized === 'true') return;
    root.dataset.tsInitialized = 'true';

    const sectionId = root.dataset.sectionId;
    const i18n = root.dataset;
    const $ = (s) => root.querySelector(s);
    const input = $('[data-ts-search-input]');
    const clearBtn = $('[data-ts-search-clear]');
    const countEl = $('[data-ts-count]');
    const hint = $('[data-ts-hint]');
    const empty = $('[data-ts-empty]');
    const emptyTitle = $('[data-ts-empty-title]');
    const resetBtn = $('[data-ts-reset-q]');
    const cards = Array.from(root.querySelectorAll('[data-ts-product]'));
    const extras = Array.from(root.querySelectorAll('[data-ts-extra]'));
    const catLinks = Array.from(root.querySelectorAll('[data-ts-cat]'));

    // Catalog (title, type, vendor, tags, category label) keyed by product id.
    let catalog = [];
    const catalogScript = document.querySelector(`script[data-ts-catalog="${sectionId}"]`);
    if (catalogScript) {
      try { catalog = JSON.parse(catalogScript.textContent) || []; } catch (_) { catalog = []; }
    }
    const byId = new Map(catalog.map(item => [String(item.id), item]));
    const entries = cards.map(el => {
      const item = byId.get(String(el.dataset.productId)) || {
        id: el.dataset.productId,
        handle: el.dataset.productHandle,
        title: el.dataset.title || '',
      };
      item._hay = haystacksFor(item);
      return {
        el,
        item,
        handle: String(el.dataset.productHandle || item.handle || ''),
        id: String(el.dataset.productId || item.id || ''),
        cats: (el.dataset.cats || '').split(/\s+/).filter(Boolean),
      };
    });

    const state = { cat: getActiveCat(), q: '', remote: new Set(), remoteQ: '' };
    if (state.cat !== 'all' && !catLinks.some(a => a.dataset.tsCat === state.cat)) state.cat = 'all';

    function catLabel(cat) {
      const link = catLinks.find(a => a.dataset.tsCat === cat);
      return link ? (link.dataset.tsCatLabel || '') : '';
    }

    function setCount(main, subParts) {
      if (!countEl) return;
      const nodes = [document.createTextNode(main)];
      const sub = subParts.filter(Boolean).join(' ');
      if (sub) {
        const span = document.createElement('span');
        span.className = 'theme-store__count-sub';
        span.textContent = ' ' + sub;
        nodes.push(span);
      }
      countEl.replaceChildren(...nodes);
    }

    function renderHint(raw, suggestion) {
      if (!hint) return;
      if (!suggestion) { hint.hidden = true; hint.replaceChildren(); return; }
      const lead = document.createElement('span');
      lead.textContent = fmt(i18n.i18nNoExact, { query: raw }) + ' ' + (i18n.i18nDidYouMean || '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-store__hint-btn';
      btn.dataset.tsSuggest = suggestion;
      btn.textContent = suggestion;
      const end = document.createElement('span');
      end.textContent = '?';
      hint.replaceChildren(lead, btn, end);
      hint.hidden = false;
    }

    function apply(push) {
      const raw = state.q.trim();
      const q = normalize(raw);
      const inCat = entries.filter(e => state.cat === 'all' || e.cats.includes(state.cat));
      let shown = inCat;
      let mode = inCat.length ? 'list' : 'none';
      let suggestion = null;

      if (q) {
        const remote = state.remoteQ === q ? state.remote : null;
        const scored = inCat.map(e => ({ e, s: scoreItem(q, e.item) }));
        const exact = scored.filter(x => x.s >= EXACT || (remote && (remote.has(x.e.handle) || remote.has(x.e.id))));
        if (exact.length) {
          shown = exact.map(x => x.e);
          mode = 'hits';
        } else if (q.length >= 3) {
          const fuzzy = scored.filter(x => x.s >= FUZZY).sort((a, b) => b.s - a.s);
          shown = fuzzy.map(x => x.e);
          mode = shown.length ? 'fuzzy' : 'none';
          suggestion = shown.length ? shown[0].item.title : suggestAlternative(inCat.map(e => e.item), q);
          if (!shown.length && suggestion) mode = 'none';
        } else {
          shown = [];
          mode = 'none';
        }
      }

      const visible = new Set(shown.map(e => e.el));
      entries.forEach(e => { e.el.hidden = !visible.has(e.el); });
      extras.forEach(x => { x.hidden = mode === 'none'; });

      catLinks.forEach(link => {
        const active = link.dataset.tsCat === state.cat;
        link.classList.toggle('is-active', active);
        link.setAttribute('aria-current', active ? 'true' : 'false');
      });

      const n = shown.length;
      const inTxt = state.cat === 'all' ? '' : fmt(i18n.i18nInCategory, { category: catLabel(state.cat) });
      if (!q) {
        setCount(fmt(n === 1 ? i18n.i18nCountOne : i18n.i18nCountOther, { n }), [inTxt]);
      } else if (mode === 'fuzzy') {
        setCount(fmt(n === 1 ? i18n.i18nSimilarOne : i18n.i18nSimilarOther, { n }), [inTxt]);
      } else {
        setCount(fmt(n === 1 ? i18n.i18nResultsOne : i18n.i18nResultsOther, { n }), [fmt(i18n.i18nForQuery, { query: raw }), inTxt]);
      }

      renderHint(raw, suggestion);

      if (empty) {
        empty.hidden = mode !== 'none';
        if (mode === 'none' && emptyTitle) {
          emptyTitle.textContent = q ? fmt(i18n.i18nEmptyQuery, { query: raw }) : (i18n.i18nEmptyCategory || '');
        }
        if (resetBtn) resetBtn.hidden = !q;
      }

      if (clearBtn) clearBtn.hidden = !state.q;
      if (input && input.value !== state.q) input.value = state.q;

      if (push) {
        try {
          const url = new URL(window.location.href);
          if (state.cat === 'all') url.searchParams.delete('cat');
          else url.searchParams.set('cat', state.cat);
          window.history.pushState({ cat: state.cat }, '', url.toString());
        } catch (_) { /* noop */ }
      }
    }

    let seq = 0;
    const runRemote = debounce((value) => {
      const q = normalize(value);
      if (q.length < 2) return;
      const mine = ++seq;
      fetchPredictive(value.trim()).then(keys => {
        if (mine !== seq || normalize(state.q) !== q) return;
        state.remote = keys;
        state.remoteQ = q;
        apply(false);
      });
    }, 200);

    function setQuery(value) {
      state.q = value;
      apply(false);
      runRemote(value);
    }

    if (input) {
      input.addEventListener('input', () => setQuery(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.q) { e.preventDefault(); setQuery(''); }
      });
    }
    const form = $('[data-ts-search-form]');
    const grid = $('[data-ts-product-grid]');
    const bar = $('.theme-store__bar');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Enter/"Search" on a phone: close the keyboard and bring the results
        // into view. A single hit is not opened automatically.
        if (input) input.blur();
        const target = empty && !empty.hidden ? empty : grid;
        if (!target) return;
        // Keep the results clear of the sticky filter bar.
        const barStyle = bar ? getComputedStyle(bar) : null;
        const offset = barStyle && barStyle.position === 'sticky' ? bar.offsetHeight : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - offset - 16;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', () => { setQuery(''); if (input) input.focus(); });
    }

    catLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        state.cat = link.dataset.tsCat;
        apply(true);
      });
    });

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-ts-suggest],[data-ts-reset-q],[data-ts-show-all]');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-ts-suggest')) {
        setQuery(t.dataset.tsSuggest || '');
        if (input) input.focus();
      } else if (t.hasAttribute('data-ts-reset-q')) {
        setQuery('');
        if (input) input.focus();
      } else if (t.hasAttribute('data-ts-show-all')) {
        state.cat = 'all';
        state.q = '';
        apply(true);
        if (input) input.focus();
      }
    });

    root._tsSync = () => {
      state.cat = getActiveCat();
      if (state.cat !== 'all' && !catLinks.some(a => a.dataset.tsCat === state.cat)) state.cat = 'all';
      apply(false);
    };

    apply(false);
  }

  function initAll(scope) {
    (scope || document).querySelectorAll(`[data-section-type="${SECTION_TYPE}"]`).forEach(initSection);
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

  window.addEventListener('popstate', () => {
    document.querySelectorAll(`[data-section-type="${SECTION_TYPE}"]`).forEach(root => {
      if (typeof root._tsSync === 'function') root._tsSync();
    });
  });
})();
