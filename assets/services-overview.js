/* services-overview.js
 * Custom element that powers the interactive orbit:
 *  - distributes nodes evenly around the ring (360 / count)
 *  - on activation, the whole orbit rotates so the chosen node lands
 *    at the bottom of the ring, just above the description below
 *  - swaps the active detail panel under the orbit
 *  - keyboard nav (arrow keys), optional gentle autoplay
 *  - Theme-Editor: re-inits on shopify:section:load + block:select
 */
(function () {
  if (window.customElements && customElements.get('services-overview')) return;

  class ServicesOverview extends HTMLElement {
    constructor() {
      super();
      this.activeIndex = 0;
      this.autoplayTimer = null;
      this.onResize = this.onResize.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onMouseEnter = this.stopAutoplay.bind(this);
      this.onMouseLeave = this.startAutoplay.bind(this);
      this.onFocusIn = this.stopAutoplay.bind(this);
      this.onFocusOut = this.startAutoplay.bind(this);
      this.onVisibility = this.onVisibility.bind(this);
      this.onBlockSelect = this.onBlockSelect.bind(this);
    }

    connectedCallback() {
      this.orbit = this.querySelector('[data-orbit]');
      this.connector = this.querySelector('[data-connector]');
      this.progress = this.querySelector('[data-progress]');
      this.live = this.querySelector('[data-live]');

      this.nodes = Array.from(this.querySelectorAll('[data-node]'));
      this.tabs = Array.from(this.querySelectorAll('.services-overview__tab'));
      this.panels = Array.from(this.querySelectorAll('[data-panel]'));

      this.total = parseInt(this.dataset.total || this.nodes.length, 10);
      if (!this.total) return;
      this.slotAngleDeg = 360 / this.total;
      this.autoplayEnabled = this.dataset.autoplay === 'true';
      this.autoplayMs = parseInt(this.dataset.autoplayMs || '7000', 10);

      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.bindEvents();
      this.setActive(0, { silent: true });
      this.startAutoplay();

      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    disconnectedCallback() {
      this.stopAutoplay();
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('visibilitychange', this.onVisibility);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
      this.removeEventListener('mouseenter', this.onMouseEnter);
      this.removeEventListener('mouseleave', this.onMouseLeave);
      this.removeEventListener('focusin', this.onFocusIn);
      this.removeEventListener('focusout', this.onFocusOut);
    }

    bindEvents() {
      this.nodes.forEach((node, i) => {
        node.addEventListener('click', () => this.setActive(i));
      });
      this.tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => this.setActive(i));
      });

      this.addEventListener('mouseenter', this.onMouseEnter);
      this.addEventListener('mouseleave', this.onMouseLeave);
      this.addEventListener('focusin', this.onFocusIn);
      this.addEventListener('focusout', this.onFocusOut);

      document.addEventListener('keydown', this.onKeydown);
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('resize', this.onResize);
    }

    onResize() {
      this.updateOrbit();
    }

    onVisibility() {
      if (document.hidden) this.stopAutoplay();
      else this.startAutoplay();
    }

    onBlockSelect(e) {
      if (!this.contains(e.target)) return;
      const idx = this.nodes.findIndex((n) => n.contains(e.target) || n === e.target);
      const pIdx = this.panels.findIndex((p) => p.contains(e.target) || p === e.target);
      const tIdx = this.tabs.findIndex((t) => t.contains(e.target) || t === e.target);
      const target = [idx, pIdx, tIdx].find((i) => i >= 0);
      if (target !== undefined && target >= 0) this.setActive(target);
    }

    onKeydown(e) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!this.contains(document.activeElement)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActive(this.activeIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActive(this.activeIndex - 1);
      }
    }

    getRadiusPx() {
      const ring = this.orbit.getBoundingClientRect().width;
      return ring * 0.4;
    }

    updateOrbit() {
      if (!this.orbit || !this.nodes.length) return;
      const radius = this.getRadiusPx();
      const ringSize = this.orbit.getBoundingClientRect().width || 1;

      this.nodes.forEach((node, index) => {
        const relative = (index - this.activeIndex + this.total) % this.total;
        const angleRad = (90 + relative * this.slotAngleDeg) * (Math.PI / 180);
        const x = Math.cos(angleRad) * radius;
        const y = Math.sin(angleRad) * radius;
        const isActive = relative === 0;

        node.style.setProperty('--x', x + 'px');
        node.style.setProperty('--y', y + 'px');
        node.style.setProperty('--scale', isActive ? '1.18' : '1');
        node.classList.toggle('is-active', isActive);
        node.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        node.setAttribute('tabindex', isActive ? '0' : '-1');

        if (isActive && this.connector) {
          const xPct = 50 + (x / ringSize) * 100;
          const yPct = 50 + (y / ringSize) * 100;
          this.connector.setAttribute('x2', xPct.toFixed(2));
          this.connector.setAttribute('y2', yPct.toFixed(2));
        }
      });

      if (this.progress) {
        const circumference = 2 * Math.PI * 48;
        const ratio = (this.activeIndex + 1) / this.total;
        this.progress.style.strokeDasharray = circumference + '';
        this.progress.style.strokeDashoffset = (circumference * (1 - ratio)) + '';
      }
    }

    renderContent() {
      this.tabs.forEach((t, i) => {
        const active = i === this.activeIndex;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      this.panels.forEach((p, i) => {
        const active = i === this.activeIndex;
        p.classList.toggle('is-active', active);
        p.setAttribute('aria-hidden', active ? 'false' : 'true');
      });

      const tab = this.tabs[this.activeIndex];
      if (this.live && tab) {
        const label = tab.querySelector('.services-overview__tab-label');
        this.live.textContent = (label ? label.textContent : tab.textContent).trim() +
          ' — ' + (this.activeIndex + 1) + '/' + this.total;
      }
    }

    setActive(index, opts) {
      const safe = ((index % this.total) + this.total) % this.total;
      this.activeIndex = safe;
      this.updateOrbit();
      this.renderContent();
      if (!opts || !opts.silent) this.restartAutoplay();
    }

    startAutoplay() {
      this.stopAutoplay();
      if (!this.autoplayEnabled || this.prefersReducedMotion) return;
      if (this.total <= 1) return;
      this.autoplayTimer = window.setTimeout(() => this.setActive(this.activeIndex + 1), this.autoplayMs);
    }

    restartAutoplay() {
      this.startAutoplay();
    }

    stopAutoplay() {
      if (this.autoplayTimer) {
        clearTimeout(this.autoplayTimer);
        this.autoplayTimer = null;
      }
    }
  }

  customElements.define('services-overview', ServicesOverview);
})();
