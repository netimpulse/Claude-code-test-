/* landing-prologue.js
 * Hero rotator (crossfading word) + broadcast timer.
 * Respects prefers-reduced-motion (no rotation, no timer).
 * Re-inits per shopify:section:load.
 */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initSection(root) {
    if (!root || root.dataset.lpInited === '1') return;
    root.dataset.lpInited = '1';

    const intervalMs = parseInt(root.dataset.rotatorInterval || '2400', 10);
    const rotator = root.querySelector('[data-lp-rotator]');
    const words = rotator ? Array.from(rotator.querySelectorAll('[data-rotator-word]')) : [];
    const timer = root.querySelector('[data-lp-timer]');

    let rotatorId = null;
    let timerId = null;

    if (rotator && words.length > 1 && !reduceMotion) {
      const setMinWidth = () => {
        let maxW = 0;
        words.forEach((w) => {
          const prev = w.style.cssText;
          w.style.cssText = 'position:relative;opacity:1;visibility:hidden;display:inline-block';
          maxW = Math.max(maxW, w.offsetWidth);
          w.style.cssText = prev;
        });
        if (maxW) rotator.style.minWidth = Math.ceil(maxW) + 'px';
      };
      setMinWidth();
      window.addEventListener('resize', setMinWidth);

      let index = 0;
      const advance = () => {
        const current = words[index];
        index = (index + 1) % words.length;
        const next = words[index];
        current.classList.remove('is-active');
        current.classList.add('is-leaving');
        current.setAttribute('aria-hidden', 'true');
        next.classList.remove('is-leaving');
        next.classList.add('is-active');
        next.setAttribute('aria-hidden', 'false');
        window.setTimeout(() => {
          current.classList.remove('is-leaving');
        }, 520);
      };
      rotatorId = window.setInterval(advance, intervalMs);
    }

    if (timer && !reduceMotion) {
      const start = performance.now();
      const tick = () => {
        const elapsed = (performance.now() - start) / 1000;
        const m = Math.floor(elapsed / 60);
        const s = Math.floor(elapsed % 60);
        timer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        timerId = window.setTimeout(tick, 1000);
      };
      tick();
    }

    root.__lpCleanup = () => {
      if (rotatorId) window.clearInterval(rotatorId);
      if (timerId) window.clearTimeout(timerId);
    };
  }

  function unloadSection(root) {
    if (!root) return;
    if (typeof root.__lpCleanup === 'function') root.__lpCleanup();
    delete root.dataset.lpInited;
  }

  function bootAll() {
    document.querySelectorAll('[data-section-type="landing-prologue"]').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else {
    bootAll();
  }

  document.addEventListener('shopify:section:load', (e) => {
    const root = e.target.querySelector('[data-section-type="landing-prologue"]');
    if (root) initSection(root);
  });
  document.addEventListener('shopify:section:unload', (e) => {
    const root = e.target.querySelector('[data-section-type="landing-prologue"]');
    if (root) unloadSection(root);
  });
})();
