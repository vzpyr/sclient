const FEATURES = [];

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
        if (f.enabled && !f.injected && typeof f.injectUI === "function") {
          f.injectUI();
          f.injected = true;
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
    console.error("[SClient] Error executing custom JS:", e);
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
runCustomCss();
runCustomJs();
startObserver();
console.log("[SClient] Successfully injected all modules.");
