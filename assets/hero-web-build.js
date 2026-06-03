(() => {
  const CYCLE = 12; // seconds
  const STEPS = [
    { a: 0.2, l: '01 · Grid' },
    { a: 1.4, l: '02 · Header' },
    { a: 2.4, l: '03 · Hero' },
    { a: 3.4, l: '04 · Copy' },
    { a: 4.2, l: '05 · CTA' },
    { a: 5.0, l: '06 · Features' },
    { a: 6.4, l: '07 · Imagery' },
    { a: 7.6, l: '08 · Color' },
    { a: 8.8, l: '09 · Ship' },
  ];

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const phase = (tc, a, b) => clamp01((tc - a) / (b - a));

  class HeroWebBuild extends HTMLElement {
    connectedCallback() {
      this.root = this;
      this.urlEl = this.querySelector('[data-hwb-url]');
      this.caretEl = this.querySelector('[data-hwb-caret]');
      this.stepNumEl = this.querySelector('[data-hwb-step-num]');
      this.stepLabelEl = this.querySelector('[data-hwb-step-label]');
      this.progressEl = this.querySelector('[data-hwb-progress]');
      this.stepEls = Array.from(this.querySelectorAll('.hwb__step'));
      this.urlFull = (this.urlEl && this.urlEl.dataset.urlFull) || 'yourstore.com';

      const animate = this.dataset.animate !== 'false';
      const reduced =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!animate || reduced) {
        this.renderStatic();
        return;
      }

      this.start = performance.now();
      this.onFrame = this.onFrame.bind(this);
      this.raf = window.requestAnimationFrame(this.onFrame);
    }

    disconnectedCallback() {
      if (this.raf) window.cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    renderStatic() {
      // Reduced-motion / disabled — show the final built state.
      const s = this.style;
      ['p-grid', 'p-header', 'p-hero', 'p-headln', 'p-btns', 'p-cards', 'p-image', 'p-color', 'p-polish'].forEach((k) => s.setProperty(`--${k}`, k === 'p-grid' ? '0' : '1'));
      ['card-0', 'card-1', 'card-2', 'nav-0', 'nav-1', 'nav-2', 'nav-3', 'nav-4'].forEach((k) => s.setProperty(`--${k}`, '1'));
      s.setProperty('--wipe', '1');
      s.setProperty('--shimmer-x', '110%');
      if (this.urlEl) this.urlEl.textContent = this.urlFull;
      if (this.stepNumEl) this.stepNumEl.textContent = String(STEPS.length).padStart(2, '0');
      if (this.stepLabelEl) this.stepLabelEl.textContent = STEPS[STEPS.length - 1].l;
      if (this.progressEl) this.progressEl.textContent = '100%';
      this.stepEls.forEach((el) => el.classList.add('is-active'));
      if (this.stepEls.length) this.stepEls[this.stepEls.length - 1].classList.add('is-current');
      const statusRight = this.querySelector('.hwb__statusbar-right');
      if (statusRight) statusRight.classList.add('is-polished');
      if (this.caretEl) this.caretEl.classList.remove('is-blink');
    }

    onFrame(now) {
      const t = (now - this.start) / 1000;
      const tc = t % CYCLE;

      const pGrid   = easeOut(phase(tc, 0.2, 1.4));
      const pHeader = easeOut(phase(tc, 1.4, 2.4));
      const pHero   = easeOut(phase(tc, 2.4, 3.6));
      const pHeadln = easeOut(phase(tc, 3.4, 4.4));
      const pBtns   = easeOut(phase(tc, 4.2, 5.0));
      const pCards  = easeOut(phase(tc, 5.0, 6.6));
      const pImage  = easeOut(phase(tc, 6.4, 7.6));
      const pColor  = easeOut(phase(tc, 7.6, 8.8));
      const pPolish = easeOut(phase(tc, 8.8, 10.0));
      const fade    = phase(tc, 11.6, 12.0);
      const wipe    = 1 - fade;

      const card0 = easeOut(phase(tc, 5.0, 5.8));
      const card1 = easeOut(phase(tc, 5.25, 6.05));
      const card2 = easeOut(phase(tc, 5.5, 6.3));
      const nav0  = easeOut(phase(tc, 1.4, 1.9));
      const nav1  = easeOut(phase(tc, 1.46, 1.96));
      const nav2  = easeOut(phase(tc, 1.52, 2.02));
      const nav3  = easeOut(phase(tc, 1.58, 2.08));
      const nav4  = easeOut(phase(tc, 1.64, 2.14));

      // Shimmer position from -20% to 110% during early build, then static.
      let shimmerX = '-20%';
      if (tc < 6) {
        const s = (Math.sin(t * 2.4) + 1) / 2; // 0..1
        shimmerX = `${(s * 130 - 20).toFixed(1)}%`;
      }

      // URL typing during the first second.
      const typedLen = Math.min(
        this.urlFull.length,
        Math.floor(easeOut(phase(tc, 0, 1.0)) * this.urlFull.length),
      );

      // Write CSS custom properties in one batch.
      const s = this.style;
      s.setProperty('--p-grid',   pGrid.toFixed(3));
      s.setProperty('--p-header', pHeader.toFixed(3));
      s.setProperty('--p-hero',   pHero.toFixed(3));
      s.setProperty('--p-headln', pHeadln.toFixed(3));
      s.setProperty('--p-btns',   pBtns.toFixed(3));
      s.setProperty('--p-cards',  pCards.toFixed(3));
      s.setProperty('--p-image',  pImage.toFixed(3));
      s.setProperty('--p-color',  pColor.toFixed(3));
      s.setProperty('--p-polish', pPolish.toFixed(3));
      s.setProperty('--wipe',     wipe.toFixed(3));
      s.setProperty('--card-0',   card0.toFixed(3));
      s.setProperty('--card-1',   card1.toFixed(3));
      s.setProperty('--card-2',   card2.toFixed(3));
      s.setProperty('--nav-0',    nav0.toFixed(3));
      s.setProperty('--nav-1',    nav1.toFixed(3));
      s.setProperty('--nav-2',    nav2.toFixed(3));
      s.setProperty('--nav-3',    nav3.toFixed(3));
      s.setProperty('--nav-4',    nav4.toFixed(3));
      s.setProperty('--shimmer-x', shimmerX);

      // URL bar
      if (this.urlEl) {
        const next = this.urlFull.slice(0, typedLen);
        if (this.urlEl.textContent !== next) this.urlEl.textContent = next;
        if (this.caretEl) {
          const blink = typedLen < this.urlFull.length;
          this.caretEl.classList.toggle('is-blink', blink);
        }
      }

      // Step labels + progress strip
      let currentStep = -1;
      for (let i = 0; i < STEPS.length; i++) {
        if (tc >= STEPS[i].a) currentStep = i;
      }
      const stepIndex = currentStep < 0 ? 0 : currentStep;
      if (this.stepNumEl) {
        const want = String(stepIndex + 1).padStart(2, '0');
        if (this.stepNumEl.textContent !== want) this.stepNumEl.textContent = want;
      }
      if (this.stepLabelEl) {
        const want = currentStep < 0 ? 'Idle' : STEPS[currentStep].l;
        if (this.stepLabelEl.textContent !== want) this.stepLabelEl.textContent = want;
      }
      if (this.progressEl) {
        const pct = Math.min(100, Math.floor((tc / 10) * 100));
        const want = `${pct}%`;
        if (this.progressEl.textContent !== want) this.progressEl.textContent = want;
      }
      for (let i = 0; i < this.stepEls.length; i++) {
        const el = this.stepEls[i];
        const isActive = i <= stepIndex;
        const isCurrent = i === stepIndex;
        if (el.classList.contains('is-active') !== isActive) el.classList.toggle('is-active', isActive);
        if (el.classList.contains('is-current') !== isCurrent) el.classList.toggle('is-current', isCurrent);
      }
      const statusRight = this.querySelector('.hwb__statusbar-right');
      if (statusRight) statusRight.classList.toggle('is-polished', pPolish > 0.5);

      this.raf = window.requestAnimationFrame(this.onFrame);
    }
  }

  if (!customElements.get('hero-web-build')) {
    customElements.define('hero-web-build', HeroWebBuild);
  }
})();
