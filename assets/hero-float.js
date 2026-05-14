/**
 * Hero Float — continuously rotating 3D wheel.
 *
 * Each card sits on the perimeter of a circle in 3D space (angle = i × 360/N).
 * A CSS keyframe animation spins the deck around the Y axis forever.
 * JS only needs to:
 *   - calculate per-card --card-angle on init / when blocks change
 *   - pause on hover, focus, off-screen, and prefers-reduced-motion
 *
 * Editor-safe: rebinds on shopify:section:load.
 */
(function () {
  const SECTION_TYPE = "hero-float";

  class HeroWheel {
    constructor(root) {
      this.root = root;
      this.deck = root.querySelector("[data-hf-deck]");
      this.cards = Array.from(root.querySelectorAll("[data-hf-card]"));

      this._onEnter = () => this.root.classList.add("is-paused");
      this._onLeave = () => this.root.classList.remove("is-paused");
      this._onMotionChange = () => this._evalMotion();

      this.layout();

      this.root.addEventListener("mouseenter", this._onEnter);
      this.root.addEventListener("mouseleave", this._onLeave);
      this.root.addEventListener("focusin", this._onEnter);
      this.root.addEventListener("focusout", this._onLeave);

      this._motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (this._motionQuery.addEventListener) {
        this._motionQuery.addEventListener("change", this._onMotionChange);
      }
      this._evalMotion();

      if ("IntersectionObserver" in window) {
        this._io = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) this.root.classList.remove("is-paused");
          else this.root.classList.add("is-paused");
        }, { threshold: 0 });
        this._io.observe(this.root);
      }
    }

    layout() {
      const n = this.cards.length;
      if (n === 0) return;
      const step = 360 / n;
      this.cards.forEach((card, i) => {
        card.style.setProperty("--card-angle", `${i * step}deg`);
      });
    }

    _evalMotion() {
      if (this._motionQuery && this._motionQuery.matches) {
        this.root.classList.add("is-paused");
      }
    }

    destroy() {
      this.root.removeEventListener("mouseenter", this._onEnter);
      this.root.removeEventListener("mouseleave", this._onLeave);
      this.root.removeEventListener("focusin", this._onEnter);
      this.root.removeEventListener("focusout", this._onLeave);
      if (this._motionQuery && this._motionQuery.removeEventListener) {
        this._motionQuery.removeEventListener("change", this._onMotionChange);
      }
      if (this._io) this._io.disconnect();
    }
  }

  function init(root) {
    if (!root || root._hfInstance) return;
    if (!root.querySelector("[data-hf-deck]")) return;
    root._hfInstance = new HeroWheel(root);
  }

  function teardown(root) {
    if (!root || !root._hfInstance) return;
    root._hfInstance.destroy();
    root._hfInstance = null;
  }

  function initAll() {
    document
      .querySelectorAll(`[data-section-type='${SECTION_TYPE}']`)
      .forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("shopify:section:load", (e) => {
    const root = e.target.querySelector(
      `[data-section-type='${SECTION_TYPE}']`
    );
    if (root) init(root);
  });
  document.addEventListener("shopify:section:unload", (e) => {
    const root = e.target.querySelector(
      `[data-section-type='${SECTION_TYPE}']`
    );
    if (root) teardown(root);
  });
})();
