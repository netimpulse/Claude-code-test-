/* Theme store preview — horizontal scroller.
   Scrolls by dragging with the mouse, by trackpad/wheel, or with
   the prev / next arrow buttons. Self-contained custom element so
   it re-initialises automatically on Shopify theme-editor reloads. */
(function () {
  class ThemeStorePreview extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-tsp-track]');
      this.prev = this.querySelector('[data-tsp-prev]');
      this.next = this.querySelector('[data-tsp-next]');
      if (!this.track) {
        if (this.prev) this.prev.disabled = true;
        if (this.next) this.next.disabled = true;
        return;
      }

      this.onPrev = () => this.track.scrollBy({ left: -this.step(), behavior: 'smooth' });
      this.onNext = () => this.track.scrollBy({ left: this.step(), behavior: 'smooth' });
      this.onScroll = () => this.updateButtons();
      this.onResize = () => this.updateButtons();
      this.onKeydown = (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.onNext(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.onPrev(); }
      };

      if (this.prev) this.prev.addEventListener('click', this.onPrev);
      if (this.next) this.next.addEventListener('click', this.onNext);
      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      this.track.addEventListener('keydown', this.onKeydown);
      window.addEventListener('resize', this.onResize);

      this.bindDrag();
      this.updateButtons();
    }

    /* Width of one card incl. gap, for arrow / keyboard paging. */
    step() {
      const item = this.track.querySelector('.tsp__item');
      if (!item) return this.track.clientWidth * 0.8;
      const styles = window.getComputedStyle(this.track);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      return item.getBoundingClientRect().width + gap;
    }

    updateButtons() {
      const max = this.track.scrollWidth - this.track.clientWidth - 1;
      if (this.prev) this.prev.toggleAttribute('disabled', this.track.scrollLeft <= 0);
      if (this.next) this.next.toggleAttribute('disabled', this.track.scrollLeft >= max);
    }

    /* Pointer drag: click-and-drag to scroll, suppressing the link
       click when the user actually dragged. */
    bindDrag() {
      let down = false;
      let moved = false;
      let startX = 0;
      let startScroll = 0;

      this.onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        down = true;
        moved = false;
        startX = e.clientX;
        startScroll = this.track.scrollLeft;
      };
      this.onPointerMove = (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) < 5) return;
        moved = true;
        this.track.classList.add('is-dragging');
        if (this.track.setPointerCapture && e.pointerId != null) {
          try { this.track.setPointerCapture(e.pointerId); } catch (err) {}
        }
        this.track.scrollLeft = startScroll - dx;
      };
      this.onPointerUp = () => {
        down = false;
        if (moved) {
          // Keep links inert until after the click that follows pointerup.
          window.setTimeout(() => this.track.classList.remove('is-dragging'), 0);
        }
      };

      this.track.addEventListener('pointerdown', this.onPointerDown);
      this.track.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
    }

    disconnectedCallback() {
      if (this.prev) this.prev.removeEventListener('click', this.onPrev);
      if (this.next) this.next.removeEventListener('click', this.onNext);
      if (this.track) {
        this.track.removeEventListener('scroll', this.onScroll);
        this.track.removeEventListener('keydown', this.onKeydown);
        this.track.removeEventListener('pointerdown', this.onPointerDown);
        this.track.removeEventListener('pointermove', this.onPointerMove);
      }
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('pointerup', this.onPointerUp);
    }
  }

  if (!customElements.get('theme-store-preview')) {
    customElements.define('theme-store-preview', ThemeStorePreview);
  }
})();
