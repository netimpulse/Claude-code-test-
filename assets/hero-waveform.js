(() => {
  if (window.customElements && window.customElements.get('hero-waveform')) return;

  const mql = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  class HeroWaveform extends HTMLElement {
    connectedCallback() {
      this.bars = Array.from(this.querySelectorAll('[data-wt-bar]'));
      this.barCount = this.bars.length;
      this.speed = parseFloat(this.dataset.speed) || 0.9;
      this.accentZone = parseFloat(this.dataset.accentZone) || 0.18;

      const half = this.barCount / 2;
      for (let i = 0; i < this.bars.length; i++) {
        const d = Math.abs(i - half) / half;
        if (d < this.accentZone) {
          this.bars[i].classList.add('is-accent');
        } else {
          const alpha = 0.85 - d * 0.55;
          this.bars[i].style.opacity = alpha.toFixed(2);
        }
      }

      this.startTime = performance.now();
      this.frame = null;
      this.reducedMotion = !!(mql && mql.matches);
      this._onMotion = this._onMotion.bind(this);
      this._tick = this._tick.bind(this);

      if (mql) {
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', this._onMotion);
        else if (typeof mql.addListener === 'function') mql.addListener(this._onMotion);
      }

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
        this._render(0);
      } else if (!this.reducedMotion && !this.frame) {
        this.startTime = performance.now();
        this.frame = requestAnimationFrame(this._tick);
      }
    }

    _tick() {
      const t = (performance.now() - this.startTime) / 1000;
      this._render(t);
      this.frame = requestAnimationFrame(this._tick);
    }

    _render(t) {
      const bars = this.bars;
      const speed = this.speed;
      for (let i = 0; i < bars.length; i++) {
        const phase = t * speed - i * 0.10;
        const v =
          Math.sin(phase) * 0.42 +
          Math.sin(phase * 2.1 + 1) * 0.22 +
          Math.sin(phase * 0.6) * 0.30;
        let h = Math.abs(v);
        if (h < 0.05) h = 0.05;
        if (h > 1) h = 1;
        bars[i].style.transform = 'scaleY(' + h.toFixed(3) + ')';
      }
    }
  }

  customElements.define('hero-waveform', HeroWaveform);
})();
