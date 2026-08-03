class AdblockFeature extends Feature {
  get featureKey() {
    return "features.adblock";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Ad Blocking";
  }

  init() {
    if (this.enabled) return;
    super.init();
    // This feature patches global fetch/XHR permanently and cannot be unpatched.
    this.applyAdblock();
  }

  applyAdblock() {
    const domains = ["adswizz.com", "doubleclick.net", "/ads"];

    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (domains.some((d) => url.includes(d))) {
        return new Response(JSON.stringify({}), {
          status: 200,
          statusText: "OK",
          headers: new Headers({ "Content-Type": "application/json" }),
        });
      }
      return origFetch.apply(this, args);
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (typeof url === "string" && domains.some((d) => url.includes(d))) {
        this.send = function () {
          Object.defineProperty(this, "readyState", {
            value: 4,
            writable: false,
          });
          Object.defineProperty(this, "status", { value: 200, writable: false });
          Object.defineProperty(this, "responseText", {
            value: "{}",
            writable: false,
          });
          this.dispatchEvent(new Event("readystatechange"));
          this.dispatchEvent(new Event("load"));
        };
      }
      return origOpen.call(this, method, url, ...rest);
    };
  }
}

const ADBLOCK_FEATURE = new AdblockFeature();
FEATURES.push(ADBLOCK_FEATURE);
