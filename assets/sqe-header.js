(() => {
  function init(section) {
    if (!section || section.__sqeInit) return;
    section.__sqeInit = true;

    const sectionId = section.getAttribute("data-section-id");
    const wrapper = document.getElementById(`shopify-section-${sectionId}`);

    // Set --sqe-header-h CSS var to current rendered height, used by sticky transitions.
    const setVar = () => {
      const h = (wrapper || section).offsetHeight;
      document.documentElement.style.setProperty("--sqe-header-h", `${h}px`);
    };
    setVar();
    window.addEventListener("resize", setVar, { passive: true });

    // -------- Sticky --------
    const stickyMode = section.getAttribute("data-sticky") || "none";
    if (wrapper) {
      wrapper.classList.remove("is-sticky", "is-hidden");
      let lastY = 0;
      const onScroll = () => {
        const y = window.scrollY;
        if (stickyMode === "always") {
          wrapper.classList.add("is-sticky");
        } else if (stickyMode === "on-scroll-up") {
          if (y > wrapper.offsetHeight) {
            wrapper.classList.add("is-sticky");
            if (y > lastY) wrapper.classList.add("is-hidden");
            else wrapper.classList.remove("is-hidden");
          } else {
            wrapper.classList.remove("is-sticky", "is-hidden");
          }
        }
        lastY = y;
      };
      onScroll();
      if (section._sqeScroll) window.removeEventListener("scroll", section._sqeScroll);
      section._sqeScroll = onScroll;
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // -------- Mobile drawer --------
    const drawerToggle = section.querySelector("[data-sqe-drawer-toggle]");
    const drawer = section.querySelector("[data-sqe-drawer]");
    if (drawerToggle && drawer) {
      drawerToggle.addEventListener("click", () => {
        const open = !drawer.hidden;
        drawer.hidden = open;
        drawerToggle.setAttribute("aria-expanded", String(!open));
      });
      // Close drawer on link click
      drawer.addEventListener("click", (e) => {
        if (e.target.closest("a")) {
          drawer.hidden = true;
          drawerToggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // -------- Search toggle --------
    const searchToggle = section.querySelector("[data-sqe-search-toggle]");
    const searchPanel = section.querySelector("[data-sqe-search]");
    const searchInput = section.querySelector("[data-sqe-search-input]");
    const searchClose = section.querySelector("[data-sqe-search-close]");

    const closeSearch = () => {
      if (!searchPanel) return;
      searchPanel.hidden = true;
      if (searchToggle) searchToggle.setAttribute("aria-expanded", "false");
      if (searchInput) searchInput.setAttribute("aria-expanded", "false");
    };
    if (searchToggle && searchPanel) {
      searchToggle.addEventListener("click", () => {
        const opening = searchPanel.hidden;
        searchPanel.hidden = !opening;
        searchToggle.setAttribute("aria-expanded", String(opening));
        if (opening && searchInput) {
          requestAnimationFrame(() => searchInput.focus());
        }
      });
    }
    if (searchClose) searchClose.addEventListener("click", closeSearch);

    // Esc closes search
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && searchPanel && !searchPanel.hidden) closeSearch();
    });

    // Click outside closes search
    document.addEventListener("click", (e) => {
      if (!searchPanel || searchPanel.hidden) return;
      if (!searchPanel.contains(e.target) && !searchToggle?.contains(e.target)) closeSearch();
    });
  }

  function bind() {
    document
      .querySelectorAll("[data-section-type='sqe-header']")
      .forEach((el) => init(el));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  // Editor live-reload hooks
  document.addEventListener("shopify:section:load", (e) => {
    const node = e.target.querySelector("[data-section-type='sqe-header']");
    if (node) init(node);
  });
  document.addEventListener("shopify:section:unload", (e) => {
    const node = e.target.querySelector("[data-section-type='sqe-header']");
    if (node && node._sqeScroll) {
      window.removeEventListener("scroll", node._sqeScroll);
    }
  });
})();
