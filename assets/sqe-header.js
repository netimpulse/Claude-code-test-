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
          if (document.documentElement.classList.contains("sqe-menu-open")) {
            // Menu panel open: keep the bar visible.
            wrapper.classList.remove("is-hidden");
          } else if (y <= headerH) {
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

    // -------- Mobile menu panel --------
    const drawerToggle = section.querySelector("[data-sqe-drawer-toggle]");
    const drawer = section.querySelector("[data-sqe-drawer]");
    const setDrawer = (open, { returnFocus = false } = {}) => {
      if (!drawerToggle || !drawer) return;
      drawer.hidden = !open;
      drawerToggle.setAttribute("aria-expanded", String(open));
      document.documentElement.classList.toggle("sqe-menu-open", open);
      if (open && wrapper) wrapper.classList.remove("is-hidden");
      if (!open && returnFocus) drawerToggle.focus();
    };
    if (drawerToggle && drawer) {
      drawerToggle.addEventListener("click", () => setDrawer(drawer.hidden));
      // Close panel on link click
      drawer.addEventListener("click", (e) => {
        if (e.target.closest("a")) setDrawer(false);
      });
      // Close when the viewport grows past the menu breakpoint.
      const mq = window.matchMedia("(min-width: 1025px)");
      const onMq = (e) => { if (e.matches) setDrawer(false); };
      mq.addEventListener("change", onMq);
      section._sqeMq = { mq, onMq };
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

    // Esc closes search, then the menu panel
    const onKeydown = (e) => {
      if (e.key !== "Escape") return;
      if (searchPanel && !searchPanel.hidden) closeSearch();
      else if (drawer && !drawer.hidden) setDrawer(false, { returnFocus: true });
    };
    document.addEventListener("keydown", onKeydown);

    // Click outside closes search
    const onDocClick = (e) => {
      if (!searchPanel || searchPanel.hidden) return;
      if (!searchPanel.contains(e.target) && !searchToggle?.contains(e.target)) closeSearch();
    };
    document.addEventListener("click", onDocClick);

    section._sqeCleanup = () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("resize", setVar);
      if (section._sqeMq) section._sqeMq.mq.removeEventListener("change", section._sqeMq.onMq);
      document.documentElement.classList.remove("sqe-menu-open");
    };
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
    if (!node) return;
    if (node._sqeScroll) window.removeEventListener("scroll", node._sqeScroll);
    if (node._sqeCleanup) node._sqeCleanup();
  });
})();
