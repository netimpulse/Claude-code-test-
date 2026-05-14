/**
 * Hero Float section behavior.
 *
 * - Pause auto-scroll when off-screen (IntersectionObserver) to save cycles
 * - Pause on hover so users can read individual cards
 * - Respect prefers-reduced-motion (CSS handles disabling; JS just doesn't
 *   try to play)
 *
 * Editor-safe: re-binds on shopify:section:load.
 */
(function () {
  const SECTION_TYPE = "hero-float";

  function init(root) {
    if (!root || root.dataset.hfInit === "1") return;
    root.dataset.hfInit = "1";

    if (!root.classList.contains("hero-float--auto")) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) {
      root.classList.add("is-paused");
      return;
    }

    const pause = () => root.classList.add("is-paused");
    const play = () => root.classList.remove("is-paused");

    root.addEventListener("mouseenter", pause);
    root.addEventListener("mouseleave", play);
    root.addEventListener("focusin", pause);
    root.addEventListener("focusout", play);

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) play();
          else pause();
        },
        { threshold: 0 }
      );
      io.observe(root);
      root._hfIO = io;
    }
  }

  function teardown(root) {
    if (!root) return;
    if (root._hfIO) {
      root._hfIO.disconnect();
      root._hfIO = null;
    }
    delete root.dataset.hfInit;
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
