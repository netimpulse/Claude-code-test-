(() => {
  const sections = document.querySelectorAll('[data-section-type="cart"]');
  if (!sections.length) return;

  sections.forEach((section) => {
    const form = section.querySelector('[data-cart-form]');
    if (!form) return;

    form.addEventListener('click', (e) => {
      const dec = e.target.closest('[data-cart-qty-decrement]');
      const inc = e.target.closest('[data-cart-qty-increment]');
      if (!dec && !inc) return;
      e.preventDefault();
      const wrap = (dec || inc).closest('[data-cart-qty]');
      const input = wrap && wrap.querySelector('[data-cart-qty-input]');
      if (!input) return;
      const current = parseInt(input.value, 10) || 1;
      const next = inc ? current + 1 : Math.max(1, current - 1);
      if (next === current) return;
      input.value = String(next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    form.addEventListener('change', (e) => {
      if (!e.target.matches('[data-cart-qty-input]')) return;
      const itemEl = e.target.closest('[data-cart-item]');
      if (!itemEl) return;
      const line = parseInt(itemEl.getAttribute('data-line'), 10);
      const quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
      e.target.value = String(quantity);

      fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, quantity }),
      })
        .then((r) => r.json())
        .then(() => window.location.reload())
        .catch(() => window.location.reload());
    });

    form.querySelectorAll('[data-cart-item-remove]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const itemEl = link.closest('[data-cart-item]');
        if (!itemEl) return;
        e.preventDefault();
        const line = parseInt(itemEl.getAttribute('data-line'), 10);
        fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ line, quantity: 0 }),
        })
          .then(() => window.location.reload())
          .catch(() => (window.location.href = link.href));
      });
    });
  });
})();
