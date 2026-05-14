/**
 * Hero Float — 3D cover-flow carousel.
 *
 * - The active card sits at the configured lock position (0-100% of stage
 *   width). Default ~35% so cards extend further to the right than left.
 * - Side cards rotate outward (cylinder, not fan) and recede in Z.
 * - Cards 2+ steps away from active get progressive blur (depth of field).
 * - Rotation is capped at ±78° so far cards stay front-facing.
 * - Prev / Next buttons + ←/→ keyboard arrows.
 * - Optional auto-rotate with configurable interval; pauses on hover/focus
 *   and when the section is off-screen.
 * - Wraps around (infinite).
 *
 * Editor-safe: rebinds on shopify:section:load.
 */
(function () {
  const SECTION_TYPE = "hero-float";
  const MAX_ROTATION = 78;
  const BLUR_START = 2;
  const BLUR_PER_STEP = 2.5;
  const FADE_OUT_AT = 4;

  class CoverFlow {
    constructor(root) {
      this.root = root;
      this.carousel = root.querySelector("[data-hf-carousel]");
      this.stage = root.querySelector("[data-hf-stage]");
      this.deck = root.querySelector("[data-hf-deck]");
      this.cards = Array.from(root.querySelectorAll("[data-hf-card]"));
      this.prevBtn = root.querySelector("[data-hf-prev]");
      this.nextBtn = root.querySelector("[data-hf-next]");

      this.step = parseInt(root.dataset.hfStep, 10) || 240;
      this.rotate = parseInt(root.dataset.hfRotate, 10) || 32;
      this.lockPosition = parseInt(root.dataset.hfLock, 10);
      if (Number.isNaN(this.lockPosition)) this.lockPosition = 35;
      this.autoEnabled = root.dataset.hfAuto === "true";
      this.autoSeconds = parseInt(root.dataset.hfAutoSeconds, 10) || 5;

      this.active = parseInt(root.dataset.hfInitial, 10) || 0;
      if (this.active < 0 || this.active >= this.cards.length) {
        this.active = Math.floor(this.cards.length / 2);
      }

      this.lockShiftPx = 0;
      this.autoTimer = null;
      this.isHovered = false;
      this.isVisible = true;

      this._onPrev = (e) => {
        e.preventDefault();
        this.move(-1);
        this._restartAutoTimer();
      };
      this._onNext = (e) => {
        e.preventDefault();
        this.move(1);
        this._restartAutoTimer();
      };
      this._onKey = (e) => {
        if (!this.carousel.contains(document.activeElement) && !this.carousel.matches(":hover")) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); this.move(-1); this._restartAutoTimer(); }
        if (e.key === "ArrowRight") { e.preventDefault(); this.move(1); this._restartAutoTimer(); }
      };
      this._onCardClick = (e) => {
        const card = e.currentTarget;
        const idx = parseInt(card.dataset.index, 10);
        if (!Number.isNaN(idx) && idx !== this.active) {
          this.goTo(idx);
          this._restartAutoTimer();
        }
      };
      this._onEnter = () => { this.isHovered = true; this._evalAuto(); };
      this._onLeave = () => { this.isHovered = false; this._evalAuto(); };
      this._onResize = () => { this._recomputeLock(); this.render(); };

      if (this.prevBtn) this.prevBtn.addEventListener("click", this._onPrev);
      if (this.nextBtn) this.nextBtn.addEventListener("click", this._onNext);
      this.cards.forEach((c) => c.addEventListener("click", this._onCardClick));
      document.addEventListener("keydown", this._onKey);
      this.carousel.addEventListener("mouseenter", this._onEnter);
      this.carousel.addEventListener("mouseleave", this._onLeave);
      this.carousel.addEventListener("focusin", this._onEnter);
      this.carousel.addEventListener("focusout", this._onLeave);
      window.addEventListener("resize", this._onResize, { passive: true });

      if ("IntersectionObserver" in window) {
        this._io = new IntersectionObserver(([entry]) => {
          this.isVisible = entry.isIntersecting;
          this._evalAuto();
        }, { threshold: 0 });
        this._io.observe(root);
      }

      this._recomputeLock();
      this.render();
      this._evalAuto();
    }

    _recomputeLock() {
      const stageWidth = this.stage ? this.stage.clientWidth : 0;
      this.lockShiftPx = ((this.lockPosition - 50) / 100) * stageWidth;
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

        const tx = offset * this.step + this.lockShiftPx;
        const tz = -abs * 180;
        // Outward (cylinder) rotation, capped so far cards don't flip past edge
        const rawRy = offset * this.rotate;
        const ry =
          Math.sign(rawRy) * Math.min(Math.abs(rawRy), MAX_ROTATION);
        const blur =
          abs >= BLUR_START ? (abs - BLUR_START + 1) * BLUR_PER_STEP : 0;
        const brightness = isActive ? 1 : 0.94;
        const opacity = abs >= FADE_OUT_AT ? 0 : 1;
        const pointer = abs >= FADE_OUT_AT ? "none" : "auto";

        card.style.transform =
          `translate(-50%, -50%) translate3d(${tx}px, 0, ${tz}px) rotateY(${ry}deg)`;
        card.style.filter = `blur(${blur}px) brightness(${brightness})`;
        card.style.opacity = String(opacity);
        card.style.pointerEvents = pointer;
        card.style.zIndex = String(100 - abs);
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
    }

    _evalAuto() {
      if (!this.autoEnabled) {
        this._stopAuto();
        return;
      }
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduce || this.isHovered || !this.isVisible) {
        this._stopAuto();
      } else {
        this._startAuto();
      }
    }

    _startAuto() {
      if (this.autoTimer) return;
      this.autoTimer = window.setInterval(() => {
        this.move(1);
      }, this.autoSeconds * 1000);
    }

    _stopAuto() {
      if (!this.autoTimer) return;
      window.clearInterval(this.autoTimer);
      this.autoTimer = null;
    }

    _restartAutoTimer() {
      // After manual navigation, restart the auto timer so the user gets a
      // full interval before the next auto-advance.
      if (this.autoTimer) {
        this._stopAuto();
        this._evalAuto();
      }
    }

    destroy() {
      if (this.prevBtn) this.prevBtn.removeEventListener("click", this._onPrev);
      if (this.nextBtn) this.nextBtn.removeEventListener("click", this._onNext);
      this.cards.forEach((c) => c.removeEventListener("click", this._onCardClick));
      document.removeEventListener("keydown", this._onKey);
      this.carousel.removeEventListener("mouseenter", this._onEnter);
      this.carousel.removeEventListener("mouseleave", this._onLeave);
      this.carousel.removeEventListener("focusin", this._onEnter);
      this.carousel.removeEventListener("focusout", this._onLeave);
      window.removeEventListener("resize", this._onResize);
      if (this._io) this._io.disconnect();
      this._stopAuto();
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
