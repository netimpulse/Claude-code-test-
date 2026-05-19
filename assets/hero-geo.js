(() => {
  if (window.customElements && window.customElements.get('hero-geo')) return;

  const mql = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  class HeroGeo extends HTMLElement {
    connectedCallback() {
      this.question = this.dataset.question || '';
      this.answer = this.dataset.answer || '';
      this.highlight = this.dataset.highlight || '';
      this.cycle = parseFloat(this.dataset.cycle) || 14;
      this.qDur = parseFloat(this.dataset.questionDuration) || 1.4;
      this.thinkDur = parseFloat(this.dataset.thinkingDuration) || 1.2;
      this.aDur = parseFloat(this.dataset.answerDuration) || 7;

      this.questionEl = this.querySelector('[data-hg-question]');
      this.questionCursor = this.querySelector('[data-hg-question-cursor]');
      this.thinkingEl = this.querySelector('[data-hg-thinking]');
      this.answerEl = this.querySelector('[data-hg-answer]');
      this.answerCursor = this.querySelector('[data-hg-answer-cursor]');
      this.citationsEl = this.querySelector('[data-hg-citations]');

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

    _renderFinal() {
      if (this.questionEl) this.questionEl.textContent = this.question;
      if (this.questionCursor) this.questionCursor.classList.remove('is-on');
      if (this.thinkingEl) this.thinkingEl.hidden = true;
      if (this.answerEl) this.answerEl.innerHTML = this._highlightAnswer(this.answer);
      if (this.answerCursor) this.answerCursor.classList.remove('is-on');
      if (this.citationsEl) this.citationsEl.hidden = false;
    }

    _tick() {
      const t = (performance.now() - this.startTime) / 1000;
      const tc = t % this.cycle;
      this._render(tc);
      this.frame = requestAnimationFrame(this._tick);
    }

    _render(tc) {
      // Phase 1: question types in
      const qChars = Math.min(this.question.length, Math.floor((tc / this.qDur) * this.question.length));
      if (this.questionEl) this.questionEl.textContent = this.question.slice(0, qChars);
      const qCursorOn = tc < this.qDur + 0.2 && Math.floor(tc * 2) % 2 === 0;
      if (this.questionCursor) this.questionCursor.classList.toggle('is-on', qCursorOn);

      // Phase 2: thinking
      const thinkStart = this.qDur + 0.2;
      const thinkEnd = thinkStart + this.thinkDur;
      const thinking = tc >= thinkStart && tc < thinkEnd;
      if (this.thinkingEl) {
        this.thinkingEl.hidden = !thinking;
        if (thinking) {
          const step = Math.floor((tc - thinkStart) * 4) % 3;
          this.thinkingEl.setAttribute('data-step', String(step));
        }
      }

      // Phase 3: answer streams
      const aStart = thinkEnd;
      const aEnd = aStart + this.aDur;
      const aProgress = Math.max(0, (tc - aStart) / this.aDur);
      const aChars = Math.min(this.answer.length, Math.floor(aProgress * this.answer.length));
      const shown = this.answer.slice(0, aChars);
      if (this.answerEl) {
        if (aChars === 0) {
          this.answerEl.textContent = '';
        } else {
          this.answerEl.innerHTML = this._highlightAnswer(shown);
        }
      }
      const aCursorOn = tc >= aStart && tc < aEnd && Math.floor(tc * 2) % 2 === 0;
      if (this.answerCursor) this.answerCursor.classList.toggle('is-on', aCursorOn);

      // Citations appear once a meaningful chunk has streamed
      if (this.citationsEl) {
        this.citationsEl.hidden = aChars <= Math.min(40, this.answer.length / 4);
      }
    }

    _highlightAnswer(text) {
      const safe = escapeHtml(text);
      if (!this.highlight) return safe;
      const target = escapeHtml(this.highlight);
      const idx = safe.indexOf(target);
      if (idx === -1) return safe;
      const end = idx + target.length;
      return safe.slice(0, idx) + '<mark>' + safe.slice(idx, end) + '</mark>' + safe.slice(end);
    }
  }

  customElements.define('hero-geo', HeroGeo);
})();
