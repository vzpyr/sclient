class LazyScrollFeature extends Feature {
  get featureKey() {
    return "features.lazy_scroll";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Lazy Scroll";
  }

  constructor() {
    super();
    this.interval = null;
  }

  injectUI() {
    if (document.getElementById("sclient-lazy-scroll")) return;
    if (!document.body) return;

    const btn = document.createElement("button");
    btn.id = "sclient-lazy-scroll";
    btn.className = "sclient-floating-btn sclient-btn-above-bar";
    btn.innerHTML = lucideIcon("chevrons-down", 24, 'stroke-width="1.5"');

    let scrolling = false;

    btn.addEventListener("click", () => {
      scrolling = !scrolling;
      if (scrolling) {
        btn.classList.add("active");
        this.interval = setInterval(
          () => window.scrollBy({ top: 300, behavior: "auto" }),
          16,
        );
      } else {
        btn.classList.remove("active");
        clearInterval(this.interval);
        this.interval = null;
      }
    });
    document.body.appendChild(btn);
  }

  destroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    super.destroy();
  }
}

const LAZY_SCROLL_FEATURE = new LazyScrollFeature();
FEATURES.push(LAZY_SCROLL_FEATURE);
