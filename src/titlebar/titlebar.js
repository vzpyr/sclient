const { ipcRenderer } = require("electron");

const backBtn = document.getElementById("sclient-back-btn");
const fwdBtn = document.getElementById("sclient-fwd-btn");
const minBtn = document.getElementById("sclient-min-btn");
const maxBtn = document.getElementById("sclient-max-btn");
const closeBtn = document.getElementById("sclient-close-btn");
const maxIcon = document.getElementById("sclient-max-icon");

backBtn.addEventListener("click", () => ipcRenderer.send("window_back"));
fwdBtn.addEventListener("click", () => ipcRenderer.send("window_forward"));
minBtn.addEventListener("click", () => ipcRenderer.send("window_minimize"));
maxBtn.addEventListener("click", () => ipcRenderer.send("window_maximize"));
closeBtn.addEventListener("click", () => ipcRenderer.send("window_close"));

ipcRenderer.on("window_nav_state", (_event, { canGoBack, canGoForward }) => {
  backBtn.disabled = !canGoBack;
  fwdBtn.disabled = !canGoForward;
});

const MAXIMIZE_SVG = `<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>`;
const RESTORE_SVG = `<rect width="14" height="14" x="8" y="8" rx="2" stroke-width="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" stroke-width="2"/>`;

ipcRenderer.on("window_state", (_event, { isMaximized }) => {
  if (maxIcon) {
    maxIcon.innerHTML = isMaximized ? RESTORE_SVG : MAXIMIZE_SVG;
    maxBtn.title = isMaximized ? "Restore" : "Maximize";
  }
});

try {
  const uiConfig = ipcRenderer.sendSync("get-ui-config");
  if (uiConfig) {
    if (uiConfig.customBackgroundColor && uiConfig.backgroundColor) {
      document.documentElement.style.setProperty(
        "--sclient-bg-surface",
        uiConfig.backgroundColor,
      );
    }
    if (uiConfig.customFont && uiConfig.customFontFamily) {
      const familyUrl = uiConfig.customFontFamily.trim().replace(/\s+/g, "+");
      const style = document.createElement("style");
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=${familyUrl}:wght@400;500;600;700;800&display=block');
        #sclient-titlebar { font-family: '${uiConfig.customFontFamily}', var(--sclient-font-sans, sans-serif); }
      `;
      document.head.appendChild(style);
    }
  }
} catch (e) {
  console.error("[SClient] Failed to apply UI config to titlebar:", e);
}
