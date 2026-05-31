/* about-values-thread.js
 * Triggers the line-drawing animation when the stage scrolls into view.
 * Reduced-motion users skip the animation entirely (CSS handles end state).
 */

class ValuesThread extends HTMLElement {
  connectedCallback() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.classList.add("is-drawn");
      return;
    }

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
