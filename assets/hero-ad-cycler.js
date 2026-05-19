(() => {
  if (window.customElements && window.customElements.get('hero-ad-cycler')) return;

  const mql = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  class HeroAdCycler extends HTMLElement {
    connectedCallback() {
      this.variantDur = parseFloat(this.dataset.variantDur) || 3;
      this.impBase = parseFloat(this.dataset.impressionBase) || 0;
      this.impRate = parseFloat(this.dataset.impressionRate) || 0;

      this.slides = Array.from(this.querySelectorAll('[data-ac-slide]'));
      this.tabs = Array.from(this.querySelectorAll('[data-ac-tab]'));
      this.impEl = this.querySelector('[data-ac-impressions]');
      this.ctaEl = this.querySelector('[data-ac-cta]');
      this.ctaBtnEl = this.querySelector('[data-ac-cta-btn]');
      this.currentIndex = -1;

      this.startTime = performance.now();
      this.frame = null;
      this.reducedMotion = !!(mql && mql.matches);
      this._onMotion = this._onMotion.bind(this);
      this._tick = this._tick.bind(this);

      if (mql) {
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', this._onMotion);
        else if (typeof mql.addListener === 'function') mql.addListener(this._onMotion);
      }

      if (this.slides.length > 0) this._setActive(0);

      if (!this.reducedMotion) {
        this.frame = requestAnimationFrame(this._tick);
      } else {
        this._renderImpressions(0);
      }
    }

    disconnectedCallback() {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
      }
      if (mql) {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', this._onMotion);
        else if (typeof mql.removeListener === 'function') mql.removeListener(this._onMotion);
      }
    }

    _onMotion(e) {
      this.reducedMotion = e.matches;
      if (this.reducedMotion && this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
      } else if (!this.reducedMotion && !this.frame) {
        this.startTime = performance.now();
        this.frame = requestAnimationFrame(this._tick);
      }
    }

    _tick() {
      const t = (performance.now() - this.startTime) / 1000;
      if (this.slides.length > 0) {
        const idx = Math.floor(t / this.variantDur) % this.slides.length;
        if (idx !== this.currentIndex) this._setActive(idx);
      }
      this._renderImpressions(t);
      this.frame = requestAnimationFrame(this._tick);
    }

    _setActive(idx) {
      this.currentIndex = idx;
      for (let i = 0; i < this.slides.length; i++) {
        this.slides[i].classList.toggle('is-active', i === idx);
      }
      for (let i = 0; i < this.tabs.length; i++) {
        this.tabs[i].classList.toggle('is-active', i === idx);
      }
      const slide = this.slides[idx];
      if (slide) {
        const cta = slide.getAttribute('data-cta') || '';
        if (this.ctaEl) this.ctaEl.textContent = cta;
        if (this.ctaBtnEl) this.ctaBtnEl.textContent = cta;
      }
    }

    _renderImpressions(t) {
      if (!this.impEl) return;
      const v = Math.floor(this.impBase + t * this.impRate);
      this.impEl.textContent = v.toLocaleString('en-US');
    }
  }

  customElements.define('hero-ad-cycler', HeroAdCycler);
})();
