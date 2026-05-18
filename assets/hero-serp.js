(() => {
  if (window.customElements && window.customElements.get('hero-serp')) return;

  const mql = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  class HeroSerp extends HTMLElement {
    connectedCallback() {
      this.query = this.dataset.query || '';
      this.cycle = parseFloat(this.dataset.cycle) || 8;
      this.typingDuration = parseFloat(this.dataset.typing) || 1.4;
      this.brandIndex = parseInt(this.dataset.brandIndex, 10);
      if (!Number.isFinite(this.brandIndex) || this.brandIndex < 0) this.brandIndex = -1;

      this.typedEl = this.querySelector('[data-hs-typed]');
      this.cursorEl = this.querySelector('[data-hs-cursor]');
      this.rankValueEl = this.querySelector('[data-hs-rank-value]');
      this.rows = Array.from(this.querySelectorAll('[data-hs-row]'));
      this.rowCount = this.rows.length;
      this.rowHeight = 64;

      this.startTime = performance.now();
      this.frame = null;
      this.reducedMotion = !!(mql && mql.matches);

      this._onMotion = this._onMotion.bind(this);
      this._tick = this._tick.bind(this);

      if (mql) {
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', this._onMotion);
        else if (typeof mql.addListener === 'function') mql.addListener(this._onMotion);
      }

      this._layout();
      if (this.reducedMotion) {
        this._renderFinal();
      } else {
        this.frame = requestAnimationFrame(this._tick);
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
        this._renderFinal();
      } else if (!this.reducedMotion && !this.frame) {
        this.startTime = performance.now();
        this.frame = requestAnimationFrame(this._tick);
      }
    }

    _layout() {
      for (let i = 0; i < this.rows.length; i++) {
        this.rows[i].style.top = (i * this.rowHeight) + 'px';
      }
    }

    _renderFinal() {
      if (this.typedEl) this.typedEl.textContent = this.query;
      if (this.cursorEl) this.cursorEl.classList.remove('is-on');
      if (this.brandIndex >= 0) {
        this._applyJump(1);
      }
    }

    _tick() {
      const t = (performance.now() - this.startTime) / 1000;
      const tc = t % this.cycle;
      this._render(tc);
      this.frame = requestAnimationFrame(this._tick);
    }

    _render(tc) {
      // Phase 1: typing
      const typingDur = this.typingDuration;
      const chars = Math.min(this.query.length, Math.floor((tc / typingDur) * this.query.length));
      if (this.typedEl) this.typedEl.textContent = this.query.slice(0, chars);
      const cursorOn = tc < typingDur + 0.4 && Math.floor(tc * 2) % 2 === 0;
      if (this.cursorEl) this.cursorEl.classList.toggle('is-on', cursorOn);

      // Phase 2: jump animation
      const jumpStart = this.cycle * 0.38;
      const jumpEnd = this.cycle * 0.58;
      let p = (tc - jumpStart) / (jumpEnd - jumpStart);
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this._applyJump(eased);
    }

    _applyJump(eased) {
      if (this.brandIndex < 0) return;
      for (let i = 0; i < this.rows.length; i++) {
        const row = this.rows[i];
        let pos = i;
        if (i === this.brandIndex) {
          pos = this.brandIndex - eased * this.brandIndex;
        } else if (i < this.brandIndex) {
          pos = i + eased;
        }
        row.style.top = (pos * this.rowHeight) + 'px';
      }
      const brandRow = this.rows[this.brandIndex];
      if (brandRow) {
        brandRow.classList.toggle('is-lifted', eased > 0.05);
      }
      if (this.rankValueEl) {
        const rank = Math.max(1, Math.round((1 - eased) * this.brandIndex) + 1);
        this.rankValueEl.textContent = '#' + rank;
      }
    }
  }

  customElements.define('hero-serp', HeroSerp);
})();
