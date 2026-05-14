/**
 * Hero Float — 3D cover-flow carousel.
 *
 * The center card is "locked in": no rotation, sitting on top.
 * Neighbouring cards rotate away with depth so you see their sides.
 * Prev / Next buttons + ←/→ keyboard arrows move the active index.
 * Wraps around (infinite).
 *
 * Editor-safe: rebinds on shopify:section:load, cleans up on unload.
 */
(function () {
  const SECTION_TYPE = "hero-float";

  class CoverFlow {
    constructor(root) {
      this.root = root;
      this.carousel = root.querySelector("[data-hf-carousel]");
      this.deck = root.querySelector("[data-hf-deck]");
      this.cards = Array.from(root.querySelectorAll("[data-hf-card]"));
      this.prevBtn = root.querySelector("[data-hf-prev]");
      this.nextBtn = root.querySelector("[data-hf-next]");
      this.stage = root.querySelector("[data-hf-stage]");

      this.step = parseInt(root.dataset.hfStep, 10) || 210;
      this.rotate = parseInt(root.dataset.hfRotate, 10) || 32;
      this.active = parseInt(root.dataset.hfInitial, 10) || 0;
      if (this.active < 0 || this.active >= this.cards.length) {
        this.active = Math.floor(this.cards.length / 2);
      }

      this._onPrev = (e) => { e.preventDefault(); this.move(-1); };
      this._onNext = (e) => { e.preventDefault(); this.move(1); };
      this._onKey = (e) => {
        if (!this.carousel.contains(document.activeElement) && !this.carousel.matches(":hover")) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); this.move(-1); }
        if (e.key === "ArrowRight") { e.preventDefault(); this.move(1); }
      };
      this._onCardClick = (e) => {
        const card = e.currentTarget;
        const idx = parseInt(card.dataset.index, 10);
        if (!Number.isNaN(idx) && idx !== this.active) {
          this.goTo(idx);
        }
      };

      if (this.prevBtn) this.prevBtn.addEventListener("click", this._onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener("click", this._onNext);
      this.cards.forEach((c) => c.addEventListener("click", this._onCardClick));
      document.addEventListener("keydown", this._onKey);

      this.render();
    }

    move(delta) {
      const n = this.cards.length;
      this.active = (this.active + delta + n) % n;
      this.render();
    }

    goTo(idx) {
      const n = this.cards.length;
      this.active = ((idx % n) + n) % n;
      this.render();
    }

    /**
     * Calculate the shortest signed offset between two indices on a circular
     * list — so wrap-around still picks the nearest visual direction.
     */
    shortestOffset(idx) {
      const n = this.cards.length;
      let raw = idx - this.active;
      if (raw > n / 2) raw -= n;
      if (raw < -n / 2) raw += n;
      return raw;
    }

    render() {
      this.cards.forEach((card, i) => {
        const offset = this.shortestOffset(i);
        const abs = Math.abs(offset);
        const isActive = offset === 0;
        const tx = offset * this.step;
        const tz = -abs * 180;
        const ry = -offset * this.rotate;
        const opacity = abs > 3 ? 0 : 1;
        const pointer = abs > 3 ? "none" : "auto";

        card.style.transform =
          `translate(-50%, -50%) translate3d(${tx}px, 0, ${tz}px) rotateY(${ry}deg)`;
        card.style.opacity = String(opacity);
        card.style.pointerEvents = pointer;
        card.style.zIndex = String(100 - abs);
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
    }

    destroy() {
      if (this.prevBtn) this.prevBtn.removeEventListener("click", this._onPrev);
      if (this.nextBtn) this.nextBtn.removeEventListener("click", this._onNext);
      this.cards.forEach((c) => c.removeEventListener("click", this._onCardClick));
      document.removeEventListener("keydown", this._onKey);
    }
  }

  function init(root) {
    if (!root || root._hfInstance) return;
    if (!root.querySelector("[data-hf-deck]")) return;
    root._hfInstance = new CoverFlow(root);
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
