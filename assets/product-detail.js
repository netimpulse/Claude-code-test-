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

  function cartUpdateUrl() {
    return ROOT_URL.replace(/\/?$/, "/") + "cart/update.js";
  }

  function checkoutUrl() {
    return ROOT_URL.replace(/\/?$/, "/") + "checkout";
  }

  function cartUrl() {
    return ROOT_URL.replace(/\/?$/, "/") + "cart";
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
      this._onSubmit = (e) => this._onFormSubmit(e);
      this._onVariantChange = () => this._onVariantSwitched();

      if (this.qtyDec) this.qtyDec.addEventListener("click", this._onDec);
      if (this.qtyInc) this.qtyInc.addEventListener("click", this._onInc);
      if (this.buyNow) this.buyNow.addEventListener("click", this._onBuyNow);
      if (this.form && this._hasAddons()) this.form.addEventListener("submit", this._onSubmit);
      if (this.variantSelect)
        this.variantSelect.addEventListener("change", this._onVariantChange);
    }

    disconnectedCallback() {
      if (this.qtyDec) this.qtyDec.removeEventListener("click", this._onDec);
      if (this.qtyInc) this.qtyInc.removeEventListener("click", this._onInc);
      if (this.buyNow) this.buyNow.removeEventListener("click", this._onBuyNow);
      if (this.form) this.form.removeEventListener("submit", this._onSubmit);
      if (this.variantSelect)
        this.variantSelect.removeEventListener("change", this._onVariantChange);
    }

    _hasAddons() {
      return this.querySelectorAll("[data-pd-addon]").length > 0;
    }

    /**
     * Returns { items: [{id, quantity}], attributes: {key: value} }
     * built from the currently checked add-on checkboxes.
     * - fixed_price → extra cart item. For multi-variant addons the
     *   variant id comes from the selected radio inside the addon's
     *   sibling fieldset; for single-variant addons it comes from
     *   data-addon-variant-id on the checkbox itself.
     * - interest_only → cart attribute the merchant sees on the order
     */
    _collectAddons() {
      const items = [];
      const attributes = {};
      this.querySelectorAll("[data-pd-addon]:checked").forEach((cb) => {
        const mode = cb.getAttribute("data-addon-mode");
        const title = cb.getAttribute("data-addon-title") || "";
        if (mode === "fixed_price") {
          let id = cb.getAttribute("data-addon-variant-id");
          const li = cb.closest(".pd-addons__item");
          if (li) {
            const picked = li.querySelector("[data-pd-addon-variant]:checked");
            if (picked) id = picked.value;
          }
          if (id) items.push({ id: Number(id), quantity: 1 });
        } else if (mode === "interest_only") {
          attributes[`Service auf Anfrage: ${title}`] = "Ja";
        }
      });
      return { items, attributes };
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
        await this._addMainAndAddons();
        window.location.href = checkoutUrl();
        return;
      } catch (err) {
        /* swallow; reset UI below */
      }
      this.buyNow.disabled = false;
      this.buyNow.classList.remove("is-loading");
    }

    async _onFormSubmit(e) {
      const { items: addonItems, attributes } = this._collectAddons();
      if (addonItems.length === 0 && Object.keys(attributes).length === 0) {
        // No add-ons selected — let the form submit normally.
        return;
      }
      // Intercept: do AJAX so we can add the main product + the add-ons
      // in one request and write cart attributes for interest_only ones.
      e.preventDefault();
      if (!this.addBtn || this.addBtn.disabled) return;
      this.addBtn.disabled = true;
      try {
        await this._addMainAndAddons();
        window.location.href = cartUrl();
      } catch (err) {
        this.addBtn.disabled = false;
      }
    }

    async _addMainAndAddons() {
      const variantId = this.variantId ? Number(this.variantId.value) : null;
      const qty = this.qtyInput ? Math.max(1, parseInt(this.qtyInput.value, 10) || 1) : 1;
      const { items: addonItems, attributes } = this._collectAddons();
      const items = [];
      if (variantId) items.push({ id: variantId, quantity: qty });
      addonItems.forEach((a) => items.push(a));

      const addRes = await fetch(cartAddUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!addRes.ok) throw new Error("cart add failed");

      if (Object.keys(attributes).length > 0) {
        await fetch(cartUpdateUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ attributes }),
        });
      }
    }
  }

  if (!customElements.get("product-detail")) {
    customElements.define("product-detail", ProductDetail);
  }
})();
