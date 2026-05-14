/**
 * Hero Float — 3D wheel with JS-driven rotation + drag.
 *
 * The deck rotates via requestAnimationFrame (not CSS) so we can:
 *   - drag in either direction with pointer events
 *   - pick up after a drag without resetting the keyframe clock
 *   - compute each card's blur / opacity from its current world angle
 *     instead of phase-offset animations
 *
 * Editor-safe: rebinds on shopify:section:load.
 */
(function () {
  const SECTION_TYPE = "hero-float";
  // 1 degree of rotation per 3 pixels of drag.
  const DRAG_PX_PER_DEG = 3;

  class HeroWheel {
    constructor(root) {
      this.root = root;
      this.stage = root.querySelector("[data-hf-stage]");
      this.deck = root.querySelector("[data-hf-deck]");
      this.cards = Array.from(root.querySelectorAll("[data-hf-card]"));

      this.radius = parseInt(root.dataset.hfRadius, 10) || 420;
      this.autoEnabled = root.dataset.hfAuto === "true";
      this.direction = root.dataset.hfDirection === "ccw" ? +1 : -1;
      this.spinSeconds = parseFloat(root.dataset.hfSpeed) || 60;
      this.degPerSec = (360 / this.spinSeconds) * this.direction;

      this.wheelAngle = 0;
      this.lastFrameTime = 0;

      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartAngle = 0;
      this.activePointerId = null;

      this.isVisible = true;
      this.reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      this._tick = this._tick.bind(this);
      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);

      this._layoutCards();
      this._bindEvents();
      this._rafId = requestAnimationFrame(this._tick);
    }

    _layoutCards() {
      const n = this.cards.length;
      if (n === 0) return;
      const step = 360 / n;
      this.cards.forEach((card, i) => {
        const angle = i * step;
        card.dataset.cardAngle = String(angle);
        card.style.setProperty("--card-angle", `${angle}deg`);
      });
    }

    _bindEvents() {
      if (this.stage) {
        this.stage.addEventListener("pointerdown", this._onPointerDown);
      }
      window.addEventListener("pointermove", this._onPointerMove, { passive: true });
      window.addEventListener("pointerup", this._onPointerUp);
      window.addEventListener("pointercancel", this._onPointerUp);

      if ("IntersectionObserver" in window) {
        this._io = new IntersectionObserver(([entry]) => {
          this.isVisible = entry.isIntersecting;
        }, { threshold: 0 });
        this._io.observe(this.root);
      }

      this._motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      this._onMotionChange = () => {
        this.reduceMotion = this._motionQuery.matches;
      };
      if (this._motionQuery.addEventListener) {
        this._motionQuery.addEventListener("change", this._onMotionChange);
      }
    }

    _onPointerDown(e) {
      // Only respond to primary pointer button.
      if (e.button !== undefined && e.button !== 0) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartAngle = this.wheelAngle;
      this.activePointerId = e.pointerId;
      this.root.classList.add("is-dragging");
      if (this.stage && this.stage.setPointerCapture) {
        try { this.stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
    }

    _onPointerMove(e) {
      if (!this.isDragging) return;
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      const dx = e.clientX - this.dragStartX;
      this.wheelAngle = this.dragStartAngle - dx / DRAG_PX_PER_DEG;
    }

    _onPointerUp(e) {
      if (!this.isDragging) return;
      if (this.activePointerId !== null && e && e.pointerId !== this.activePointerId) return;
      this.isDragging = false;
      this.activePointerId = null;
      this.root.classList.remove("is-dragging");
    }

    _tick(t) {
      const dtSec = this.lastFrameTime ? (t - this.lastFrameTime) / 1000 : 0;
      this.lastFrameTime = t;

      if (!this.isDragging && this.autoEnabled && this.isVisible && !this.reduceMotion) {
        this.wheelAngle += this.degPerSec * dtSec;
      }

      this._applyDeckTransform();
      this._applyCardDepth();

      this._rafId = requestAnimationFrame(this._tick);
    }

    _applyDeckTransform() {
      this.deck.style.transform = `rotateY(${this.wheelAngle.toFixed(3)}deg)`;
    }

    _applyCardDepth() {
      const wheel = this.wheelAngle;
      for (let i = 0; i < this.cards.length; i++) {
        const card = this.cards[i];
        const cardAngle = parseFloat(card.dataset.cardAngle) || 0;
        // World angle of the card (where it sits relative to the camera).
        let world = (cardAngle + wheel) % 360;
        if (world > 180) world -= 360;
        if (world < -180) world += 360;
        const t = Math.abs(world) / 180; // 0 = front, 1 = back

        // Sharp front zone, then gradual blur into the back.
        let blur;
        if (t < 0.2) blur = 0;
        else if (t < 0.5) blur = ((t - 0.2) / 0.3) * 2;
        else if (t < 0.85) blur = 2 + ((t - 0.5) / 0.35) * 5;
        else blur = 7 + ((t - 0.85) / 0.15) * 2;

        const brightness = 1 - t * 0.2;
        const opacity = 1 - t * 0.45;

        card.style.filter = `blur(${blur.toFixed(2)}px) brightness(${brightness.toFixed(2)})`;
        card.style.opacity = opacity.toFixed(2);
      }
    }

    destroy() {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      if (this.stage) {
        this.stage.removeEventListener("pointerdown", this._onPointerDown);
      }
      window.removeEventListener("pointermove", this._onPointerMove);
      window.removeEventListener("pointerup", this._onPointerUp);
      window.removeEventListener("pointercancel", this._onPointerUp);
      if (this._io) this._io.disconnect();
      if (this._motionQuery && this._motionQuery.removeEventListener) {
        this._motionQuery.removeEventListener("change", this._onMotionChange);
      }
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
