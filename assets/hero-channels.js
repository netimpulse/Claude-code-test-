/**
 * <hero-channels> — Custom element wrapper.
 *
 * Most of the animation lives in SVG/CSS. This element only:
 * - Pauses SMIL animations when the visitor prefers reduced motion.
 * - Re-evaluates the preference when the user toggles it at runtime.
 *
 * Theme-editor friendly: nothing global, no listeners that survive
 * `shopify:section:unload`.
 */
(function () {
  if (customElements.get('hero-channels')) return;

  class HeroChannels extends HTMLElement {
    constructor() {
      super();
      this._mql = null;
      this._onMotionChange = null;
    }

    connectedCallback() {
      if (typeof window === 'undefined' || !window.matchMedia) return;

      this._mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      this._onMotionChange = () => this._applyMotionPreference();

      this._applyMotionPreference();

      if (typeof this._mql.addEventListener === 'function') {
        this._mql.addEventListener('change', this._onMotionChange);
      } else if (typeof this._mql.addListener === 'function') {
        this._mql.addListener(this._onMotionChange);
      }
    }

    disconnectedCallback() {
      if (!this._mql || !this._onMotionChange) return;
      if (typeof this._mql.removeEventListener === 'function') {
        this._mql.removeEventListener('change', this._onMotionChange);
      } else if (typeof this._mql.removeListener === 'function') {
        this._mql.removeListener(this._onMotionChange);
      }
      this._mql = null;
      this._onMotionChange = null;
    }

    _applyMotionPreference() {
      const reduce = !!(this._mql && this._mql.matches);
      const svg = this.querySelector('.hero-channels__svg');
      if (!svg) return;

      const animations = svg.querySelectorAll('animateMotion, animate, animateTransform');
      animations.forEach((node) => {
        try {
          if (reduce) {
            if (typeof node.endElement === 'function') node.endElement();
          } else {
            if (typeof node.beginElement === 'function') node.beginElement();
          }
        } catch (err) {
          /* SMIL not supported in this browser — fall through silently. */
        }
      });

      this.classList.toggle('hero-channels--reduced-motion', reduce);
    }
  }

  customElements.define('hero-channels', HeroChannels);
})();
