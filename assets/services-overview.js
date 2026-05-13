/* services-overview.js
 * Custom element that powers the interactive orbit:
 *  - distributes nodes evenly around the ring (360 / count)
 *  - on activation, the whole orbit rotates so the chosen node lands
 *    at the bottom (right above the focus rail)
 *  - swaps the right-hand detail panel + focus rail copy
 *  - keyboard nav (arrows), prev/next buttons, optional autoplay
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
      this.focusBadge = this.querySelector('[data-focus-badge]');
      this.focusTitle = this.querySelector('[data-focus-title]');
      this.focusText = this.querySelector('[data-focus-text]');
      this.live = this.querySelector('[data-live]');
      this.prevBtn = this.querySelector('[data-prev]');
      this.nextBtn = this.querySelector('[data-next]');

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

      // Theme editor — react to block selection so the merchant sees the block they edit.
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
      if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.setActive(this.activeIndex - 1));
      if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.setActive(this.activeIndex + 1));

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
      if (!this.isVisible()) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Only react if the user is actually focused inside this component, OR the section is the topmost interactive area.
      // To avoid hijacking unrelated keystrokes, require focus inside the component or its viewport visibility.
      const focusInside = this.contains(document.activeElement);
      if (!focusInside) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActive(this.activeIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActive(this.activeIndex - 1);
      }
    }

    isVisible() {
      const rect = this.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
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
        // Active node at angle 90° (CSS bottom of circle, y positive)
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
      const node = this.nodes[this.activeIndex];
      const panel = this.panels[this.activeIndex];
      const tab = this.tabs[this.activeIndex];
      if (!node || !panel) return;

      // Tabs
      this.tabs.forEach((t, i) => {
        const active = i === this.activeIndex;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      // Panels
      this.panels.forEach((p, i) => {
        const active = i === this.activeIndex;
        p.classList.toggle('is-active', active);
        p.setAttribute('aria-hidden', active ? 'false' : 'true');
      });

      // Focus rail — pull title + focus text from the active panel
      if (this.focusTitle) {
        const title = panel.querySelector('.services-overview__panel-title');
        if (title) this.focusTitle.textContent = title.textContent;
      }
      if (this.focusText && tab) {
        // Use the panel's first paragraph stripped of markup as the focus blurb,
        // falling back to the tab label if no description is present.
        const desc = panel.querySelector('.services-overview__panel-text');
        this.focusText.textContent = desc ? this.firstSentence(desc.textContent) : tab.textContent.trim();
      }
      if (this.focusBadge) {
        const icon = node.querySelector('.services-overview__node-icon');
        if (icon) this.focusBadge.innerHTML = icon.innerHTML;
      }

      if (this.live && tab) {
        const label = tab.querySelector('.services-overview__tab-label');
        this.live.textContent = (label ? label.textContent : tab.textContent).trim() +
          ' — ' + (this.activeIndex + 1) + '/' + this.total;
      }
    }

    firstSentence(text) {
      const trimmed = (text || '').trim().replace(/\s+/g, ' ');
      const match = trimmed.match(/^(.+?[.!?])(\s|$)/);
      return match ? match[1] : trimmed.length > 120 ? trimmed.slice(0, 117) + '…' : trimmed;
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

  // Theme-Editor section reload — custom element disconnect/connect handles cleanup.
  document.addEventListener('shopify:section:unload', () => {});
  document.addEventListener('shopify:section:load', () => {});
})();
