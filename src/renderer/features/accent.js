class AccentFeature extends Feature {
  get featureKey() {
    return "features.custom_accent";
  }
  get settingsCategory() {
    return "appearance";
  }
  get settingsLabel() {
    return "Custom Accent";
  }
  get settingsFields() {
    return [{ type: "color", key: "features.accent_color", label: "Accent Color" }];
  }

  init() {
    if (this.enabled) return;
    super.init();
    if (SCLIENT_CONFIG.customAccent) {
      document.documentElement.style.setProperty("--sclient-accent", SCLIENT_CONFIG.accentColor);
      this.applyCustomAccentColor(SCLIENT_CONFIG.accentColor);
    }
  }

  applyCustomAccentColor(newColor) {
    const targetHex = ["#f50", "#ff5500"];
    const processed = new Set();

    function hexToRgb(hex) {
      let c = hex.substring(1).split("");
      if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      c = "0x" + c.join("");
      return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(",");
    }
    const rgbVal = hexToRgb(newColor);

    async function processCss(cssText, originalNode) {
      const selCss = `::selection { background: ${newColor} !important; color: #fff !important; }`;
      if (typeof injectStyle === "function") injectStyle("sclient-selection-accent", selCss);
      if (typeof injectToIframes === "function")
        injectToIframes("sclient-selection-accent", selCss);

      if (!cssText) return;
      let modified = false;
      let newText = cssText;

      for (const color of targetHex) {
        const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(escaped + "(?![a-fA-F0-9])", "gi");
        if (re.test(newText)) {
          newText = newText.replace(re, newColor);
          modified = true;
        }
      }

      if (/rgb\(\s*255\s*,\s*85\s*,\s*0\s*\)/gi.test(newText)) {
        newText = newText.replace(/rgb\(\s*255\s*,\s*85\s*,\s*0\s*\)/gi, `rgb(${rgbVal})`);
        modified = true;
      }
      if (/255\s*,\s*85\s*,\s*0/gi.test(newText)) {
        newText = newText.replace(/255\s*,\s*85\s*,\s*0/gi, rgbVal);
        modified = true;
      }

      if (modified) {
        const style = document.createElement("style");
        style.setAttribute("data-sc-custom-accent", "true");
        style.textContent = newText;
        if (originalNode && originalNode.parentNode) {
          originalNode.parentNode.insertBefore(style, originalNode.nextSibling);
        } else {
          document.head.appendChild(style);
        }
      }
    }

    async function processNode(node) {
      if (node.hasAttribute("data-sc-custom-accent") || processed.has(node)) return;
      processed.add(node);
      try {
        if (
          node.tagName === "LINK" &&
          node.rel === "stylesheet" &&
          node.href &&
          node.href.includes("sndcdn.com")
        ) {
          const text = await fetch(node.href).then((r) => r.text());
          await processCss(text, node);
        } else if (node.tagName === "STYLE") {
          await processCss(node.textContent, node);
        }
      } catch (e) {}
    }

    const run = () => {
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(processNode);
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();

    const observer = new MutationObserver((mutations) => {
      let should = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if ((node.tagName === "LINK" && node.rel === "stylesheet") || node.tagName === "STYLE") {
            should = true;
          }
        }
      }
      if (should) setTimeout(run, 50);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

const ACCENT_FEATURE = new AccentFeature();
FEATURES.push(ACCENT_FEATURE);
