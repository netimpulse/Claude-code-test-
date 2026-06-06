(() => {
  const sections = document.querySelectorAll('[data-section-type="cart"]');
  if (!sections.length) return;

  sections.forEach((section) => initCart(section));

  function initCart(section) {
    const form = section.querySelector('[data-cart-form]');
    if (!form) return;
    const sectionId = section.getAttribute('data-section-id') || '';

    // Per-line in-flight tracking to avoid race conditions when the user
    // hammers the +/- buttons. Keyed by line index.
    const inflight = new Map();

    section.addEventListener('click', onClick);
    section.addEventListener('change', onChange);

    function onClick(e) {
      const removeLink = e.target.closest('[data-cart-item-remove]');
      if (removeLink) {
        const itemEl = removeLink.closest('[data-cart-item]');
        const line = itemEl && parseInt(itemEl.getAttribute('data-line'), 10);
        if (!itemEl || !Number.isFinite(line)) return;
        e.preventDefault();
        changeLine(line, 0, itemEl, removeLink.href);
        return;
      }

      const dec = e.target.closest('[data-cart-qty-decrement]');
      const inc = e.target.closest('[data-cart-qty-increment]');
      if (!dec && !inc) return;
      e.preventDefault();
      const wrap = (dec || inc).closest('[data-cart-qty]');
      const input = wrap && wrap.querySelector('[data-cart-qty-input]');
      if (!input) return;
      // Floor at 0 — Shopify treats `quantity: 0` as remove. The remove link
      // is still available as a one-click shortcut for the same operation.
      const current = parseInt(input.value, 10);
      const base = Number.isFinite(current) ? current : 1;
      const next = inc ? base + 1 : Math.max(0, base - 1);
      if (next === base) return;
      input.value = String(next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function onChange(e) {
      if (!e.target.matches('[data-cart-qty-input]')) return;
      const itemEl = e.target.closest('[data-cart-item]');
      if (!itemEl) return;
      const line = parseInt(itemEl.getAttribute('data-line'), 10);
      if (!Number.isFinite(line)) return;
      // Allow 0 to align with Shopify's /cart/change.js semantics
      // (quantity: 0 removes the line). Non-numeric input falls back to 1.
      const raw = parseInt(e.target.value, 10);
      const quantity = Math.max(0, Number.isFinite(raw) ? raw : 1);
      e.target.value = String(quantity);
      const fallback = itemEl
        .querySelector('[data-cart-item-remove]')
        ?.getAttribute('href');
      changeLine(line, quantity, itemEl, fallback);
    }

    function changeLine(line, quantity, itemEl, fallbackHref) {
      if (inflight.get(line)) return; // ignore rapid double-clicks
      inflight.set(line, true);
      setLineBusy(itemEl, true);

      const body = { line, quantity };
      if (sectionId) body.sections = sectionId;

      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (!res.ok) throw new Error('cart/change failed');
          return res.json();
        })
        .then((data) => {
          inflight.delete(line);
          // Empty cart → reload to render the empty-state branch in Liquid
          // instead of trying to patch it from JS.
          if (!data || data.item_count === 0) {
            window.location.reload();
            return;
          }
          // Prefer the Section Rendering API result. Falls back to /cart.js
          // shape if `sections` wasn't honoured for some reason.
          const html = data.sections && sectionId ? data.sections[sectionId] : null;
          if (html) {
            replaceSection(section, html);
          } else {
            applyCartSnapshot(section, data);
          }
        })
        .catch(() => {
          inflight.delete(line);
          // Network failure: degrade to a hard navigation. Prefer the
          // remove URL when we have one, otherwise reload.
          if (fallbackHref && quantity === 0) {
            window.location.href = fallbackHref;
          } else {
            window.location.reload();
          }
        });
    }

    function setLineBusy(itemEl, busy) {
      if (!itemEl) return;
      itemEl.classList.toggle('is-busy', busy);
      const targets = itemEl.querySelectorAll(
        '[data-cart-qty-decrement], [data-cart-qty-increment], [data-cart-qty-input], [data-cart-item-remove]',
      );
      targets.forEach((el) => {
        if (busy) {
          el.setAttribute('aria-busy', 'true');
          if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') el.disabled = true;
        } else {
          el.removeAttribute('aria-busy');
          if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') el.disabled = false;
        }
      });
    }

    function replaceSection(currentSection, sectionHtml) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = sectionHtml.trim();
      const fresh = wrapper.querySelector('[data-section-type="cart"]');
      if (!fresh) {
        window.location.reload();
        return;
      }
      currentSection.replaceWith(fresh);
      initCart(fresh);
      updateCartCount(fresh);
    }

    function applyCartSnapshot(currentSection, cart) {
      // Fallback path when Section Rendering didn't return HTML. We update
      // the bits that visibly drift: subtotal, total, per-line price, and
      // remove any lines that the API dropped (quantity 0 removes shift
      // subsequent line indices, so reload is safer).
      const totalEl = currentSection.querySelector('[data-cart-total]');
      const subtotalEl = currentSection.querySelector('[data-cart-subtotal]');
      if (totalEl && typeof cart.total_price === 'number') {
        totalEl.textContent = formatMoney(cart.total_price);
      }
      if (subtotalEl && typeof cart.items_subtotal_price === 'number') {
        subtotalEl.textContent = formatMoney(cart.items_subtotal_price);
      }
      // If line counts no longer match, reload — keeping indices in sync
      // without re-rendering would be brittle.
      const renderedLines = currentSection.querySelectorAll('[data-cart-item]').length;
      if (renderedLines !== (cart.items || []).length) {
        window.location.reload();
        return;
      }
      (cart.items || []).forEach((item, i) => {
        const itemEl = currentSection.querySelector(`[data-cart-item][data-line="${i + 1}"]`);
        if (!itemEl) return;
        const priceEl = itemEl.querySelector('[data-cart-item-price]');
        if (priceEl && typeof item.final_line_price === 'number') {
          priceEl.textContent = formatMoney(item.final_line_price);
        }
        const qtyInput = itemEl.querySelector('[data-cart-qty-input]');
        if (qtyInput) qtyInput.value = String(item.quantity);
      });
      updateCartCount(currentSection, cart.item_count);
    }

    function updateCartCount(currentSection, count) {
      const target = currentSection.querySelector('[data-cart-count]');
      if (target && typeof count === 'number') target.textContent = String(count);
    }

    function formatMoney(cents) {
      // Best-effort fallback. Section Rendering is the primary path and
      // returns server-formatted money, so we only get here when sections
      // aren't available. Uses Shopify's helper if the theme loaded it.
      if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
        const fmt =
          (window.Shopify.currency && window.Shopify.currency.format) || undefined;
        return window.Shopify.formatMoney(cents, fmt);
      }
      const value = (cents / 100).toFixed(2).replace('.', ',');
      return `${value} €`;
    }
  }
})();
