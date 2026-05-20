/* landing-orbit.js
 * Custom element for the landing orbit.
 * - Distributes nodes around the ring (active lands at bottom)
 * - Cross-fades the center title and details panel
 * - Keyboard arrow navigation
 * - Editor: re-inits on shopify:section:load + block:select
 */
(function () {
  if (window.customElements && customElements.get('landing-orbit')) return;

  class LandingOrbit extends HTMLElement {
    constructor() {
      super();
      this.activeIndex = 0;
      this.onResize = this.onResize.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onBlockSelect = this.onBlockSelect.bind(this);
    }

    connectedCallback() {
      this.orbit = this.querySelector('[data-orbit]');
      this.connector = this.querySelector('[data-connector]');
      this.centerTitle = this.querySelector('[data-center-title]');
      this.live = this.querySelector('[data-live]');
      this.nodes = Array.from(this.querySelectorAll('[data-node]'));
      this.panels = Array.from(this.querySelectorAll('[data-panel]'));

      this.total = parseInt(this.dataset.total || this.nodes.length, 10);
      if (!this.total) return;
      this.slotAngleDeg = 360 / this.total;
      this.titles = this.nodes.map((n) => n.getAttribute('aria-label') || '');

      this.bindEvents();
      this.setActive(0, { silent: true });

      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    disconnectedCallback() {
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
    }

    bindEvents() {
      this.nodes.forEach((node, i) => {
        node.addEventListener('click', () => this.setActive(i));
      });
      document.addEventListener('keydown', this.onKeydown);
      window.addEventListener('resize', this.onResize);
    }

    onResize() {
      this.updateOrbit();
    }

    onBlockSelect(e) {
      if (!this.contains(e.target)) return;
      const nIdx = this.nodes.findIndex((n) => n.contains(e.target) || n === e.target);
      const pIdx = this.panels.findIndex((p) => p.contains(e.target) || p === e.target);
      const target = [nIdx, pIdx].find((i) => i >= 0);
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
      return ring * 0.39;
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
    }

    swapCenterTitle(newTitle) {
      if (!this.centerTitle) return;
      this.centerTitle.classList.add('is-fading');
      window.setTimeout(() => {
        this.centerTitle.textContent = newTitle;
        this.centerTitle.classList.remove('is-fading');
      }, 220);
    }

    renderContent() {
      this.panels.forEach((p, i) => {
        const active = i === this.activeIndex;
        p.classList.toggle('is-active', active);
        p.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      const title = this.titles[this.activeIndex] || '';
      this.swapCenterTitle(title);
      if (this.live) {
        this.live.textContent = title + ' — ' + (this.activeIndex + 1) + '/' + this.total;
      }
    }

    setActive(index, opts) {
      const safe = ((index % this.total) + this.total) % this.total;
      const changed = safe !== this.activeIndex || (opts && opts.silent);
      this.activeIndex = safe;
      this.updateOrbit();
      if (changed) this.renderContent();
    }
  }

  customElements.define('landing-orbit', LandingOrbit);
})();
