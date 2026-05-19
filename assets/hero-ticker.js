(() => {
  if (window.customElements && window.customElements.get('hero-ticker')) return;

  const mql = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  const SPARK_W = 220;
  const SPARK_H = 42;
  const SPARK_PTS = 36;

  class HeroTicker extends HTMLElement {
    connectedCallback() {
      this.values = Array.from(this.querySelectorAll('[data-ht-value]')).map((el) => ({
        el,
        base: parseFloat(el.getAttribute('data-base')) || 0,
        rate: parseFloat(el.getAttribute('data-rate')) || 0,
        prefix: el.getAttribute('data-prefix') || '',
        suffix: el.getAttribute('data-suffix') || '',
        short: el.getAttribute('data-short') === 'true',
      }));
      this.sparks = Array.from(this.querySelectorAll('[data-ht-spark]')).map((svg) => ({
        svg,
        seed: parseFloat(svg.getAttribute('data-seed')) || 0,
        trend: parseFloat(svg.getAttribute('data-trend')) || 0.5,
        area: svg.querySelector('[data-ht-area]'),
        line: svg.querySelector('[data-ht-line]'),
        dot: svg.querySelector('[data-ht-dot]'),
      }));

      this.startTime = performance.now();
      this.frame = null;
      this.reducedMotion = !!(mql && mql.matches);
      this._onMotion = this._onMotion.bind(this);
      this._tick = this._tick.bind(this);

      if (mql) {
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', this._onMotion);
        else if (typeof mql.addListener === 'function') mql.addListener(this._onMotion);
      }

      this._render(0);
      if (!this.reducedMotion) {
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

    _fmt(n, short) {
      if (!short) return Math.floor(n).toLocaleString('en-US');
      if (n > 1000) return (n / 1000).toFixed(1) + 'k';
      return String(Math.floor(n));
    }

    _render(t) {
      for (const v of this.values) {
        const live = v.base + t * v.rate;
        v.el.textContent = v.prefix + this._fmt(live, v.short) + v.suffix;
      }
      for (const s of this.sparks) this._drawSpark(s, t);
    }

    _drawSpark(s, t) {
      const data = new Array(SPARK_PTS);
      let max = -Infinity;
      let min = Infinity;
      for (let i = 0; i < SPARK_PTS; i++) {
        const x = (i + t * 4 + s.seed * 13) * 0.35;
        const v =
          Math.sin(x) * 0.35 +
          Math.sin(x * 2.1 + s.seed) * 0.18 +
          Math.sin(x * 0.5) * 0.2;
        const val = 0.5 + v * 0.3 + (i / SPARK_PTS - 0.5) * s.trend;
        data[i] = val;
        if (val > max) max = val;
        if (val < min) min = val;
      }
      const range = max - min || 1;
      let pathD = '';
      let lastX = 0;
      let lastY = 0;
      for (let i = 0; i < SPARK_PTS; i++) {
        const x = (i / (SPARK_PTS - 1)) * SPARK_W;
        const y = SPARK_H - ((data[i] - min) / range) * (SPARK_H - 4) - 2;
        pathD += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
        lastX = x;
        lastY = y;
      }
      const areaD = pathD + 'L' + SPARK_W + ',' + SPARK_H + ' L0,' + SPARK_H + ' Z';
      if (s.line) s.line.setAttribute('d', pathD.trim());
      if (s.area) s.area.setAttribute('d', areaD.trim());
      if (s.dot) {
        s.dot.setAttribute('cx', lastX.toFixed(2));
        s.dot.setAttribute('cy', lastY.toFixed(2));
      }
    }
  }

  customElements.define('hero-ticker', HeroTicker);
})();
