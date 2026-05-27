/* services-orbit.js
 * Custom element for the rotating services orbit:
 *  - service nodes sit at fixed angles around the ring
 *  - activating a node spins the whole ring so that node lands at the
 *    top slot, while each node counter-rotates to stay upright
 *  - swaps the active detail panel, the centered title, the counter
 *    and the progress bar
 *  - keyboard nav (arrow keys), no autoplay
 *  - re-inits on shopify:section:load + block:select
 */
(function () {
  if (window.customElements && customElements.get('services-orbit')) return;

  var ACTIVE_ANGLE = -90; // top slot

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  class ServicesOrbit extends HTMLElement {
    constructor() {
      super();
      this.activeIndex = 0;
      this.currentRotation = 0;
      this.onKeydown = this.onKeydown.bind(this);
      this.onBlockSelect = this.onBlockSelect.bind(this);
    }

    connectedCallback() {
      this.rotator = this.querySelector('[data-rotator]');
      this.centerTitle = this.querySelector('[data-center-title]');
      this.countEl = this.querySelector('[data-count]');
      this.progressEl = this.querySelector('[data-progress]');
      this.live = this.querySelector('[data-live]');

      this.nodes = Array.from(this.querySelectorAll('[data-node]'));
      this.panels = Array.from(this.querySelectorAll('[data-panel]'));

      this.total = parseInt(this.dataset.total || this.nodes.length, 10);
      if (!this.total) return;

      this.angles = this.nodes.map(function (n) {
        return parseFloat(n.dataset.angle || '0');
      });
      this.centers = this.nodes.map(function (n) {
        return n.dataset.center || (n.getAttribute('aria-label') || '');
      });

      this.bindEvents();
      this.setActive(0, { silent: true });

      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
    }

    bindEvents() {
      var self = this;
      this.nodes.forEach(function (node, i) {
        node.addEventListener('click', function () {
          self.setActive(i);
        });
      });
      document.addEventListener('keydown', this.onKeydown);
    }

    onBlockSelect(e) {
      if (!this.contains(e.target)) return;
      var idx = this.nodes.findIndex(function (n) {
        return n === e.target || n.contains(e.target);
      });
      var pIdx = this.panels.findIndex(function (p) {
        return p === e.target || p.contains(e.target);
      });
      var target = [idx, pIdx].find(function (i) {
        return i >= 0;
      });
      if (target !== undefined && target >= 0) this.setActive(target);
    }

    onKeydown(e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!this.contains(document.activeElement)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.setActive(this.activeIndex + 1, { focus: true });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.setActive(this.activeIndex - 1, { focus: true });
      }
    }

    normalizeRotation(target) {
      var adjusted = target;
      while (adjusted - this.currentRotation > 180) adjusted -= 360;
      while (adjusted - this.currentRotation < -180) adjusted += 360;
      return adjusted;
    }

    swapCenterTitle(newTitle) {
      if (!this.centerTitle) return;
      if (this.centerTitle.textContent === newTitle) return;
      this.centerTitle.classList.add('is-fading');
      var el = this.centerTitle;
      window.setTimeout(function () {
        el.textContent = newTitle;
        el.classList.remove('is-fading');
      }, 220);
    }

    setActive(index, opts) {
      opts = opts || {};
      var safe = ((index % this.total) + this.total) % this.total;
      this.activeIndex = safe;

      var activeAngle = this.angles[safe] || 0;
      this.currentRotation = this.normalizeRotation(ACTIVE_ANGLE - activeAngle);

      if (this.rotator) {
        this.rotator.style.setProperty('--rotation', this.currentRotation + 'deg');
      }

      var self = this;
      this.nodes.forEach(function (node, i) {
        var isActive = i === safe;
        node.classList.toggle('is-active', isActive);
        node.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        node.setAttribute('tabindex', isActive ? '0' : '-1');
        node.style.setProperty(
          '--counter-rotation',
          -(self.angles[i] + self.currentRotation) + 'deg'
        );
        if (isActive && opts.focus) node.focus();
      });

      this.panels.forEach(function (panel, i) {
        var isActive = i === safe;
        panel.classList.toggle('is-active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });

      this.swapCenterTitle(this.centers[safe] || '');

      if (this.countEl) {
        this.countEl.textContent = pad(safe + 1) + ' / ' + pad(this.total);
      }
      if (this.progressEl) {
        var pct = ((safe + 1) / this.total) * 100;
        this.progressEl.style.setProperty('--progress', pct + '%');
      }
      if (this.live) {
        this.live.textContent = (this.centers[safe] || '') + ' — ' + (safe + 1) + '/' + this.total;
      }
    }
  }

  customElements.define('services-orbit', ServicesOrbit);
})();
