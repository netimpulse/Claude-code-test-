(function () {
  if (customElements.get('theme-store-deck')) return;

  class ThemeStoreDeck extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-tsd-track]');
      this.prevBtn = this.querySelector('[data-tsd-prev]');
      this.nextBtn = this.querySelector('[data-tsd-next]');
      if (!this.track) return;

      this._onScroll = this.update.bind(this);
      this._onResize = this.update.bind(this);
      this._onPrev = function () { this.scrollByCard(-1); }.bind(this);
      this._onNext = function () { this.scrollByCard(1); }.bind(this);

      this.track.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onResize);
      if (this.prevBtn) this.prevBtn.addEventListener('click', this._onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener('click', this._onNext);

      this.bindDrag();
      this.update();
    }

    disconnectedCallback() {
      if (this.track) this.track.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onResize);
      if (this.prevBtn) this.prevBtn.removeEventListener('click', this._onPrev);
      if (this.nextBtn) this.nextBtn.removeEventListener('click', this._onNext);
    }

    cardStep() {
      var item = this.track.querySelector('.tsd__card');
      if (!item) return this.track.clientWidth * 0.8;
      var styles = window.getComputedStyle(this.track);
      var gap = parseFloat(styles.columnGap || styles.gap || 0) || 0;
      return item.getBoundingClientRect().width + gap;
    }

    scrollByCard(dir) {
      this.track.scrollBy({ left: dir * this.cardStep(), behavior: 'smooth' });
    }

    update() {
      if (!this.track) return;
      var max = this.track.scrollWidth - this.track.clientWidth - 1;
      if (this.prevBtn) this.prevBtn.toggleAttribute('disabled', this.track.scrollLeft <= 0);
      if (this.nextBtn) this.nextBtn.toggleAttribute('disabled', this.track.scrollLeft >= max);
    }

    bindDrag() {
      var track = this.track;
      var down = false;
      var moved = false;
      var startX = 0;
      var startLeft = 0;

      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        down = true;
        moved = false;
        startX = e.clientX;
        startLeft = track.scrollLeft;
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
      });

      track.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 4) {
          moved = true;
          track.classList.add('is-dragging');
        }
        track.scrollLeft = startLeft - dx;
      });

      var end = function (e) {
        if (!down) return;
        down = false;
        track.classList.remove('is-dragging');
        try {
          if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
        } catch (err) {}
      };
      track.addEventListener('pointerup', end);
      track.addEventListener('pointercancel', end);

      // Swallow the click that follows a drag so it does not navigate.
      track.addEventListener('click', function (e) {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
        }
        moved = false;
      }, true);
    }
  }

  customElements.define('theme-store-deck', ThemeStoreDeck);
})();
