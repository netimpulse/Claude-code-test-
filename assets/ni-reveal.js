/* Shared scroll-reveal for the NI sections (ni-hero, ni-intro, ni-deck).
   Content is visible without JS; the reveal animation is enabled only
   when JS runs and reduced-motion is not requested. */
(function () {
  class NiReveal extends HTMLElement {
    connectedCallback() {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const items = this.querySelectorAll('.ni-reveal');
      if (reduce || !('IntersectionObserver' in window) || items.length === 0) return;

      this.classList.add('is-ready');
      this._obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              this._obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 }
      );
      items.forEach((el) => this._obs.observe(el));
    }

    disconnectedCallback() {
      if (this._obs) this._obs.disconnect();
    }
  }

  ['ni-hero', 'ni-intro', 'ni-deck'].forEach((tag) => {
    if (!customElements.get(tag)) {
      customElements.define(tag, class extends NiReveal {});
    }
  });
})();
