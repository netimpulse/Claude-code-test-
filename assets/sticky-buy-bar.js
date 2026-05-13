(() => {
  const bars = document.querySelectorAll("[data-section-type='sticky-buy-bar']");
  if (!bars.length) return;

  bars.forEach((bar) => {
    const id = bar.getAttribute("data-section-id");
    const dismissable = bar.getAttribute("data-dismissable") === "true";
    const dismissKey = `stickyBuyBar:dismissed:${id}`;
    const variantId = parseInt(bar.getAttribute("data-variant-id"), 10);
    const trigger = bar.getAttribute("data-trigger") || "immediate";

    if (dismissable && sessionStorage.getItem(dismissKey) === "1") return;

    bar.hidden = false;

    const reveal = () => bar.classList.add("is-visible");
    const conceal = () => bar.classList.remove("is-visible");

    if (trigger === "immediate") {
      requestAnimationFrame(reveal);
    } else if (trigger === "scroll_offset") {
      const offset = parseInt(bar.getAttribute("data-scroll-offset"), 10) || 400;
      const onScroll = () => {
        if (window.scrollY >= offset) reveal();
        else conceal();
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    } else if (trigger === "intersection") {
      const selector = bar.getAttribute("data-intersection-selector");
      const target = selector ? document.querySelector(selector) : null;
      if (!target) {
        requestAnimationFrame(reveal);
      } else if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) reveal();
            else conceal();
          },
          { threshold: 0 }
        );
        io.observe(target);
      } else {
        requestAnimationFrame(reveal);
      }
    }

    if (dismissable) {
      const closeBtn = bar.querySelector("[data-sticky-buy-bar-dismiss]");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          sessionStorage.setItem(dismissKey, "1");
          conceal();
          setTimeout(() => (bar.hidden = true), 300);
        });
      }
    }

    const cta = bar.querySelector("[data-sticky-buy-bar-cta]");
    if (!cta || !variantId) return;

    cta.addEventListener("click", async () => {
      if (cta.classList.contains("is-loading")) return;
      const labelEl = cta.querySelector(".sticky-buy-bar__cta-label");
      const original = labelEl ? labelEl.textContent : "";
      cta.classList.add("is-loading");
      if (labelEl) labelEl.textContent = cta.getAttribute("data-loading-label") || "…";

      try {
        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const cartRes = await fetch("/cart.js", { headers: { Accept: "application/json" } });
        const cart = cartRes.ok ? await cartRes.json() : null;

        cta.classList.remove("is-loading");
        cta.classList.add("is-success");
        if (labelEl) labelEl.textContent = cta.getAttribute("data-success-label") || "✓";

        document.dispatchEvent(
          new CustomEvent("cart:added", {
            detail: { variantId, cart, source: "sticky-buy-bar" },
          })
        );

        updateCartCount(cart);

        setTimeout(() => {
          cta.classList.remove("is-success");
          if (labelEl) labelEl.textContent = original;
        }, 1800);
      } catch (err) {
        cta.classList.remove("is-loading");
        if (labelEl) labelEl.textContent = original;
        console.error("[sticky-buy-bar] add failed", err);
      }
    });
  });

  function updateCartCount(cart) {
    if (!cart) return;
    const count = cart.item_count;
    document
      .querySelectorAll("[data-cart-count], .cart-count, [data-header-cart-count]")
      .forEach((el) => (el.textContent = String(count)));
  }
})();
