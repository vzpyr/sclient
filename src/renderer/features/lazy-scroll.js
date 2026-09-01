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
    btn.className = "sclient-floating-btn";
    btn.style.bottom = "68px";
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/></svg>';

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
