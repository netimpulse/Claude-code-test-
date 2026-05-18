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
    // The wrapper is pinned from the start (position: sticky in CSS), so it never
    // scrolls away in the first place. "on-scroll-up" only adds an `is-hidden`
    // class — translateY(-100%) — when the user is scrolling down.
    const stickyMode = section.getAttribute("data-sticky") || "none";
    if (wrapper) {
      wrapper.classList.remove("is-sticky", "is-hidden");
      if (section._sqeScroll) {
        window.removeEventListener("scroll", section._sqeScroll);
        section._sqeScroll = null;
      }

      if (stickyMode === "always" || stickyMode === "on-scroll-up") {
        wrapper.classList.add("is-sticky");
      }

      if (stickyMode === "on-scroll-up") {
        let lastY = window.scrollY;
        const threshold = 8; // ignore tiny pixel jitters
        const onScroll = () => {
          const y = window.scrollY;
          const headerH = wrapper.offsetHeight;
          if (y <= headerH) {
            // Near the top: never hide.
            wrapper.classList.remove("is-hidden");
          } else if (y - lastY > threshold) {
            // Scrolling down: hide.
            wrapper.classList.add("is-hidden");
            lastY = y;
          } else if (lastY - y > threshold) {
            // Scrolling up: show.
            wrapper.classList.remove("is-hidden");
            lastY = y;
          }
        };
        onScroll();
        section._sqeScroll = onScroll;
        window.addEventListener("scroll", onScroll, { passive: true });
      }
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
