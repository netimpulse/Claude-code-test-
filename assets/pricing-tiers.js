(() => {
  function bind(section) {
    if (section.__pricingInit) return;
    section.__pricingInit = true;

    const toggleBtns = section.querySelectorAll("[data-pricing-toggle] [data-period]");
    const amounts = section.querySelectorAll("[data-pricing-amount]");
    if (!toggleBtns.length || !amounts.length) return;

    function setPeriod(period) {
      toggleBtns.forEach((btn) => {
        const active = btn.getAttribute("data-period") === period;
        btn.setAttribute("aria-pressed", String(active));
      });
      amounts.forEach((el) => {
        const val = el.getAttribute(`data-${period}`);
        if (val != null) el.textContent = val;
      });
      section.setAttribute("data-default-period", period);
    }

    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        setPeriod(btn.getAttribute("data-period"));
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const list = [...toggleBtns];
        const idx = list.indexOf(btn);
        const next = e.key === "ArrowRight"
          ? list[(idx + 1) % list.length]
          : list[(idx - 1 + list.length) % list.length];
        next.focus();
        setPeriod(next.getAttribute("data-period"));
      });
    });
  }

  function bindAll() {
    document
      .querySelectorAll("[data-section-type='pricing-tiers']")
      .forEach(bind);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAll);
  } else {
    bindAll();
  }
  document.addEventListener("shopify:section:load", (e) => {
    const n = e.target.querySelector("[data-section-type='pricing-tiers']");
    if (n) bind(n);
  });
})();
