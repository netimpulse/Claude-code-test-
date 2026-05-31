/* about-values-wave.js
 * On click of a value word:
 *   - active class moves to that word + matching detail panel
 *   - the SVG pin/dot drifts to sit directly under the active word,
 *     riding the wave's amplitude at that x-coordinate
 *
 * The wave SVG uses viewBox 0 0 1200 120 with preserveAspectRatio=none,
 * so we compute the pin's normalized x in the viewBox coordinate space
 * from the word's center in the row.
 */

class ValuesWave extends HTMLElement {
  connectedCallback() {
    this.words = Array.from(this.querySelectorAll("[data-avw-word]"));
    this.details = Array.from(this.querySelectorAll("[data-avw-detail]"));
    this.row = this.querySelector(".avw__row");
    this.svg = this.querySelector(".avw__wave");
    this.pin = this.querySelector("[data-avw-pin]");
    this.pinDot = this.querySelector("[data-avw-pin-dot]");

    // Tell the CSS grid how many columns to use
    this.row.style.setProperty("--avw-cols", String(this.words.length));

    this.activeIndex = 0;

    this.onClick = this.onClick.bind(this);
    this.onResize = this.onResize.bind(this);

    this.words.forEach((w) => w.addEventListener("click", this.onClick));
    window.addEventListener("resize", this.onResize, { passive: true });

    // Initial pin position after layout settles
    requestAnimationFrame(() => this.movePin(0, true));
  }

  disconnectedCallback() {
    this.words.forEach((w) => w.removeEventListener("click", this.onClick));
    window.removeEventListener("resize", this.onResize);
  }

  onClick(e) {
    e.preventDefault();
    const idx = Number(e.currentTarget.dataset.index);
    if (idx === this.activeIndex) return;
    this.setActive(idx);
  }

  onResize() {
    this.movePin(this.activeIndex, true);
  }

  setActive(idx) {
    this.activeIndex = idx;
    this.words.forEach((w, i) => {
      const active = i === idx;
      w.classList.toggle("is-active", active);
      w.setAttribute("aria-pressed", active ? "true" : "false");
    });
    this.details.forEach((d, i) => d.classList.toggle("is-active", i === idx));
    this.movePin(idx, false);
  }

  movePin(idx, instant) {
    const word = this.words[idx];
    if (!word || !this.svg) return;
    const wordRect = word.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    if (svgRect.width === 0) return;

    // x in viewBox coordinates (0..1200)
    const centerX = wordRect.left + wordRect.width / 2 - svgRect.left;
    const ratio = Math.max(0, Math.min(1, centerX / svgRect.width));
    const vbX = ratio * 1200;

    // y on the sine wave at this x (matches the visual sine in the SVG path roughly)
    // wave drifts horizontally so we just pick a fixed amplitude for the pin
    const amplitude = 26;
    const phase = (centerX / svgRect.width) * Math.PI * 2;
    const vbY = 60 - Math.sin(phase) * amplitude;

    if (instant) {
      this.pin.style.transition = "none";
      this.pinDot.style.transition = "none";
      requestAnimationFrame(() => {
        this.pin.style.transition = "";
        this.pinDot.style.transition = "";
      });
    }

    this.pin.setAttribute("x1", String(vbX));
    this.pin.setAttribute("x2", String(vbX));
    this.pin.setAttribute("y1", String(vbY - 14));
    this.pin.setAttribute("y2", String(vbY + 36));
    this.pinDot.setAttribute("cx", String(vbX));
    this.pinDot.setAttribute("cy", String(vbY));
  }
}

if (!customElements.get("values-wave")) {
  customElements.define("values-wave", ValuesWave);
}
