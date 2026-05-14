/**
 * Product Detail section behavior.
 *
 * - Quantity +/- buttons (clamp to >= 1)
 * - Variant select updates the hidden id input + price display when available
 * - Sofortkauf (buy-now) button: POST to /cart/add.js, then redirect to /checkout
 *
 * Editor-safe: re-initializes via Custom Elements on shopify:section:load.
 */
(function () {
  const ROOT_URL =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";

  function cartAddUrl() {
    return ROOT_URL.replace(/\/?$/, "/") + "cart/add.js";
  }

  function checkoutUrl() {
    return ROOT_URL.replace(/\/?$/, "/") + "checkout";
  }

  class ProductDetail extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector("form");
      this.qtyInput = this.querySelector("[data-pd-qty-input]");
      this.qtyDec = this.querySelector("[data-pd-qty-dec]");
      this.qtyInc = this.querySelector("[data-pd-qty-inc]");
      this.buyNow = this.querySelector("[data-pd-buy-now]");
      this.addBtn = this.querySelector("[data-pd-add]");
      this.variantSelect = this.querySelector("[data-pd-variant-select]");
      this.variantId = this.querySelector("[data-pd-variant-id]");
      this.priceEl = this.closest("section")?.querySelector(".product-detail__price");
      this.compareEl = this.closest("section")?.querySelector(".product-detail__price-compare s");

      this._onDec = () => this._stepQty(-1);
      this._onInc = () => this._stepQty(1);
      this._onBuyNow = (e) => this._buyNow(e);
      this._onVariantChange = () => this._onVariantSwitched();

      if (this.qtyDec) this.qtyDec.addEventListener("click", this._onDec);
      if (this.qtyInc) this.qtyInc.addEventListener("click", this._onInc);
      if (this.buyNow) this.buyNow.addEventListener("click", this._onBuyNow);
      if (this.variantSelect)
        this.variantSelect.addEventListener("change", this._onVariantChange);
    }

    disconnectedCallback() {
      if (this.qtyDec) this.qtyDec.removeEventListener("click", this._onDec);
      if (this.qtyInc) this.qtyInc.removeEventListener("click", this._onInc);
      if (this.buyNow) this.buyNow.removeEventListener("click", this._onBuyNow);
      if (this.variantSelect)
        this.variantSelect.removeEventListener("change", this._onVariantChange);
    }

    _stepQty(delta) {
      if (!this.qtyInput) return;
      const val = parseInt(this.qtyInput.value, 10) || 1;
      const next = Math.max(1, val + delta);
      this.qtyInput.value = next;
      this.qtyInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    _onVariantSwitched() {
      if (!this.variantSelect) return;
      const opt = this.variantSelect.selectedOptions[0];
      if (!opt) return;
      const id = opt.value;
      if (this.variantId) this.variantId.value = id;

      const price = opt.getAttribute("data-price");
      const compare = opt.getAttribute("data-compare");
      const available = opt.getAttribute("data-available") === "true";

      if (this.priceEl && price) this.priceEl.textContent = price;
      if (this.compareEl && compare) this.compareEl.textContent = compare;

      [this.addBtn, this.buyNow].forEach((btn) => {
        if (!btn) return;
        if (available) btn.removeAttribute("disabled");
        else btn.setAttribute("disabled", "");
      });
    }

    async _buyNow(e) {
      e.preventDefault();
      if (!this.form || this.buyNow.disabled) return;
      this.buyNow.disabled = true;
      this.buyNow.classList.add("is-loading");
      try {
        const fd = new FormData(this.form);
        const res = await fetch(cartAddUrl(), {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          window.location.href = checkoutUrl();
          return;
        }
      } catch (err) {
        /* swallow; reset UI below */
      }
      this.buyNow.disabled = false;
      this.buyNow.classList.remove("is-loading");
    }
  }

  if (!customElements.get("product-detail")) {
    customElements.define("product-detail", ProductDetail);
  }
})();
