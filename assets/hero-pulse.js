(() => {
  if (window.customElements && window.customElements.get('hero-pulse')) return;

  const reducedQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  class HeroPulse extends HTMLElement {
    connectedCallback() {
      this.bars = Array.from(this.querySelectorAll('[data-hp-bar]'));
      this.timerEl = this.querySelector('[data-hp-timer]');
      this.counterEls = Array.from(this.querySelectorAll('[data-hp-counter]'));

      const speedAttr = parseFloat(this.dataset.speed);
      this.speed = Number.isFinite(speedAttr) && speedAttr > 0 ? speedAttr : 1.3;
      this.showTimer = this.dataset.showTimer !== 'false';

      this.counters = this.counterEls.map((el) => {
        const base = parseInt(el.getAttribute('data-base'), 10);
        const rate = parseFloat(el.getAttribute('data-rate'));
        return {
          el,
          base: Number.isFinite(base) ? base : 0,
          rate: Number.isFinite(rate) ? rate : 3,
        };
      });

      this.startTime = performance.now();
      this.frame = null;
      this.reducedMotion = !!(reducedQuery && reducedQuery.matches);

      this._onMotion = this._onMotion.bind(this);
      this._tick = this._tick.bind(this);

      if (reducedQuery) {
        if (typeof reducedQuery.addEventListener === 'function') {
          reducedQuery.addEventListener('change', this._onMotion);
        } else if (typeof reducedQuery.addListener === 'function') {
          reducedQuery.addListener(this._onMotion);
        }
      }

      this._renderStaticBars();

      if (this.reducedMotion) {
        this._render(0);
      } else {
        this.frame = requestAnimationFrame(this._tick);
      }
    }

    disconnectedCallback() {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
      }
      if (reducedQuery) {
        if (typeof reducedQuery.removeEventListener === 'function') {
          reducedQuery.removeEventListener('change', this._onMotion);
        } else if (typeof reducedQuery.removeListener === 'function') {
          reducedQuery.removeListener(this._onMotion);
        }
      }
    }

    _onMotion(event) {
      this.reducedMotion = event.matches;
      if (this.reducedMotion && this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
        this._render(0);
      } else if (!this.reducedMotion && !this.frame) {
        this.startTime = performance.now();
        this.frame = requestAnimationFrame(this._tick);
      }
    }

    _renderStaticBars() {
      for (let i = 0; i < this.bars.length; i++) {
        this.bars[i].style.transform = 'scaleY(0.06)';
      }
    }

    _tick() {
      const t = (performance.now() - this.startTime) / 1000;
      this._render(t);
      this.frame = requestAnimationFrame(this._tick);
    }

    _render(t) {
      const speed = this.speed;
      const bars = this.bars;
      for (let i = 0; i < bars.length; i++) {
        const phase = t * speed - i * 0.18;
        const v =
          Math.sin(phase) * 0.5 +
          Math.sin(phase * 2.3 + 1) * 0.25 +
          Math.sin(phase * 0.7) * 0.3;
        let h = Math.abs(v);
        if (h < 0.06) h = 0.06;
        if (h > 1) h = 1;
        bars[i].style.transform = `scaleY(${h.toFixed(3)})`;
      }

      if (this.showTimer && this.timerEl) {
        const totalMs = Math.floor(t * 1000);
        const secs = Math.floor(t) % 60;
        const ms = totalMs % 1000;
        this.timerEl.textContent = `00:${this._pad(secs, 2)}.${this._pad(ms, 3)}`;
      }

      for (let j = 0; j < this.counters.length; j++) {
        const c = this.counters[j];
        const value = c.base + Math.floor(t * c.rate);
        c.el.textContent = value.toLocaleString();
      }
    }

    _pad(n, width) {
      let s = String(n);
      while (s.length < width) s = '0' + s;
      return s;
    }
  }

  customElements.define('hero-pulse', HeroPulse);
})();
