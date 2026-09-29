/* about-values-thread.js
 * Draws the values thread once when the stage scrolls into view.
 * Progressive enhancement: the markup shows the finished line and all
 * values; only when this script runs (and motion is allowed) the stage
 * is "armed" (hidden start state) and then revealed via .is-drawn.
 * Reduced-motion users skip the animation entirely.
 */

class ValuesThread extends HTMLElement {
  connectedCallback() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      this.classList.add("is-drawn");
      return;
    }

    this.classList.add("is-armed");
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.classList.add("is-drawn");
          this.observer.disconnect();
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });

    this.observer.observe(this);
  }

  disconnectedCallback() {
    if (this.observer) this.observer.disconnect();
  }
}

if (!customElements.get("values-thread")) {
  customElements.define("values-thread", ValuesThread);
}
