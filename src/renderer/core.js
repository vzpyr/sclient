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
  if (SCLIENT_CONFIG.customBackgroundColor) {
    const bgColor = SCLIENT_CONFIG.backgroundColor;
    injectStyle(
      "sclient-custom-background-color",
      `
      :root {
        --mui-palette-background-default: ${bgColor} !important;
        --sclient-bg-surface: ${bgColor} !important;
        --sclient-bg-elevated: ${bgColor} !important;
      }
      body.theme-dark, body.theme-light {
        --background-surface-color: ${bgColor} !important;
        --background-highlight-color: ${bgColor} !important;
        --surface-color: ${bgColor} !important;
        --highlight-color: ${bgColor} !important;
        --button-secondary-background-color: ${bgColor} !important;
        --button-secondary-selected-background-color: ${bgColor} !important;
        --button-secondary-selected-active-background-color: ${bgColor} !important;
        --button-tertiary-background-color: ${bgColor} !important;
        --button-tertiary-selected-background-color: ${bgColor} !important;
        --button-tertiary-selected-active-background-color: ${bgColor} !important;
        --sclient-bg-surface: ${bgColor} !important;
        --sclient-bg-elevated: ${bgColor} !important;
      }
      body.theme-dark *, body.theme-light * {
        --mui-palette-background-default: ${bgColor} !important;
      }
      body.theme-dark div.MuiBox-root.mui-1i9nq8r,
      body.theme-light div.MuiBox-root.mui-1i9nq8r {
        background-color: ${bgColor} !important;
      }
    `
    );

    const syncBackgroundIframes = () => {
      const bgStyle = document.getElementById("sclient-custom-background-color");
      if (!bgStyle) return;
      document.querySelectorAll("iframe").forEach((iframe) => {
        try {
          if (iframe.contentDocument && iframe.contentDocument.head) {
            if (!iframe.contentDocument.getElementById("sclient-custom-background-color")) {
              iframe.contentDocument.head.appendChild(bgStyle.cloneNode(true));
            }
            let force = iframe.contentDocument.getElementById("sclient-custom-background-force");
            if (!force) {
              force = document.createElement("style");
              force.id = "sclient-custom-background-force";
              force.textContent = `
                :root, html, body {
                  --mui-palette-background-default: ${bgColor} !important;
                  --background-surface-color: ${bgColor} !important;
                  --background-highlight-color: ${bgColor} !important;
                  --button-secondary-background-color: ${bgColor} !important;
                  --button-secondary-selected-background-color: ${bgColor} !important;
                  --highlight-color: ${bgColor} !important;
                  --surface-color: ${bgColor} !important;
                }
              `;
              iframe.contentDocument.head.appendChild(force);
            }
          }
        } catch (e) {}
      });
    };

    syncBackgroundIframes();

    const backgroundObs = new MutationObserver((mutations) => {
      let shouldSync = false;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.tagName === "IFRAME") {
            node.addEventListener("load", syncBackgroundIframes);
            shouldSync = true;
          } else if (node.querySelectorAll) {
            const iframes = node.querySelectorAll("iframe");
            if (iframes.length > 0) {
              iframes.forEach((ifr) => ifr.addEventListener("load", syncBackgroundIframes));
              shouldSync = true;
            }
          }
        }
      }
      if (shouldSync) syncBackgroundIframes();
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        backgroundObs.observe(document.documentElement, { childList: true, subtree: true });
      });
    } else {
      backgroundObs.observe(document.documentElement, { childList: true, subtree: true });
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
