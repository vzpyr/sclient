function initFeatures() {
  for (const f of FEATURES) {
    if (f.isEnabled()) f.init();
  }
}

let obsTimer = null;

function startObserver() {
  const observer = new MutationObserver(() => {
    clearTimeout(obsTimer);
    obsTimer = setTimeout(() => {
      for (const f of FEATURES) {
        if (!f.enabled) continue;
        if (f.injected && typeof f.checkInjected === "function" && !f.checkInjected()) {
          f.injected = false;
        }
        if (!f.injected && typeof f.injectUI === "function") {
          f.injected = true;
          f.injectUI();
        }
      }
    }, 100);
  });

  const begin = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin);
  } else {
    begin();
  }
}

function applyAppearance() {
  if (SCLIENT_CONFIG.customFont && SCLIENT_CONFIG.customFontFamily) {
    const familyUrl = SCLIENT_CONFIG.customFontFamily.trim().replace(/\s+/g, "+");
    const css = `
      @import url('https://fonts.googleapis.com/css2?family=${familyUrl}:wght@400;500;700&display=swap');
      html, body, * {
        font-family: '${SCLIENT_CONFIG.customFontFamily}', var(--sclient-font-sans, sans-serif) !important;
      }
    `;
    injectStyle("sclient-global-font", css);
    injectToIframes("sclient-global-font", css);
  }
  if (SCLIENT_CONFIG.customBgColor) {
    const bgColor = SCLIENT_CONFIG.bgColor;
    document.documentElement.style.setProperty("--sclient-bg-surface", bgColor);
    document.documentElement.style.setProperty("--sclient-bg-elevated", bgColor);
    injectStyle(
      "sclient-custom-bg-color",
      `
      .theme-dark {
        --background-surface-color: ${bgColor} !important;
        --button-secondary-background-color: ${bgColor} !important;
        --button-secondary-selected-background-color: ${bgColor} !important;
        --highlight-color: ${bgColor} !important;
        --surface-color: ${bgColor} !important;
      }
      .theme-dark div.MuiBox-root.mui-1i9nq8r { background-color: ${bgColor} !important; }
      .theme-dark, .theme-dark *, .theme-dark body, .theme-dark html {
        --mui-palette-background-default: ${bgColor} !important;
      }
    `
    );

    const syncIframeTheme = () => {
      const isDark = document.body && document.body.classList.contains("theme-dark");
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          if (iframe.contentDocument && iframe.contentDocument.head) {
            if (!iframe.contentDocument.getElementById("sclient-custom-bg-color")) {
              const el = document.getElementById("sclient-custom-bg-color");
              if (el) iframe.contentDocument.head.appendChild(el.cloneNode(true));
            }
            let fs = iframe.contentDocument.getElementById("sclient-custom-bg-iframe-force");
            if (!fs) {
              fs = document.createElement("style");
              fs.id = "sclient-custom-bg-iframe-force";
              fs.textContent = `
                :root, html, body {
                  --mui-palette-background-default: ${bgColor} !important;
                  --background-surface-color: ${bgColor} !important;
                  --button-secondary-background-color: ${bgColor} !important;
                  --button-secondary-selected-background-color: ${bgColor} !important;
                  --highlight-color: ${bgColor} !important;
                  --surface-color: ${bgColor} !important;
                }
              `;
              iframe.contentDocument.head.appendChild(fs);
            }
            fs.disabled = !isDark;
          }
        } catch (e) {}
      });
    };

    syncIframeTheme();

    const iframeObs = new MutationObserver((mutations) => {
      let shouldSync = false;
      for (const mut of mutations) {
        if (
          mut.type === "attributes" &&
          mut.target === document.body &&
          mut.attributeName === "class"
        ) {
          shouldSync = true;
          break;
        }
        for (const node of mut.addedNodes) {
          if (node.tagName === "IFRAME") {
            node.addEventListener("load", syncIframeTheme);
            shouldSync = true;
          } else if (node.querySelectorAll) {
            const iframes = node.querySelectorAll("iframe");
            if (iframes.length > 0) {
              iframes.forEach((ifr) => ifr.addEventListener("load", syncIframeTheme));
              shouldSync = true;
            }
          }
        }
      }
      if (shouldSync) syncIframeTheme();
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        iframeObs.observe(document.documentElement, { childList: true, subtree: true });
        iframeObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      });
    } else {
      iframeObs.observe(document.documentElement, { childList: true, subtree: true });
      if (document.body)
        iframeObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }
}

function runCustomCss() {
  if (SCLIENT_CONFIG.customCss) injectStyle("sclient-custom-css", SCLIENT_CONFIG.customCss);
}

function runCustomJs() {
  try {
    if (SCLIENT_CONFIG.customJs) {
      const run = () => {
        const s = document.createElement("script");
        s.textContent = SCLIENT_CONFIG.customJs;
        document.body.appendChild(s);
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
      else run();
    }
  } catch (e) {
    console.error("[SClient] Couldn't run custom JS:", e);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
    e.preventDefault();
    window.location.reload();
  }
});

initBridge();
initFeatures();
applyAppearance();
runCustomCss();
runCustomJs();
startObserver();
console.log("[SClient] Injection complete.");
