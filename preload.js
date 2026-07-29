const { ipcRenderer, webFrame } = require("electron");

const ENDPOINTS = [
  "api-v2.soundcloud.com/resolve",
  "api-v2.soundcloud.com/tracks",
  "api-v2.soundcloud.com/playlists",
  "api-v2.soundcloud.com/media",
];

const proxyCfg = ipcRenderer.sendSync("get-proxy-config");

if (proxyCfg.enabled && proxyCfg.url && proxyCfg.url.startsWith("http")) {
  webFrame.executeJavaScript(`
(function() {
  var proxyUrl = '${proxyCfg.url}'
  var endpoints = ${JSON.stringify(ENDPOINTS)}

  var origFetch = window.fetch
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] instanceof URL ? arguments[0].href : (arguments[0] && arguments[0].url || ''))
    if (endpoints.some(function(d) { return url.indexOf(d) !== -1 })) {
      var p = new URL(proxyUrl)
      p.searchParams.set('url', url)
      if (typeof arguments[0] === 'string' || arguments[0] instanceof URL) arguments[0] = p.toString()
      else if (arguments[0] instanceof Request) arguments[0] = new Request(p.toString(), arguments[0])
    }
    return origFetch.apply(this, arguments)
  }

  var origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function(method, url) {
    var f = typeof url === 'string' ? url : (url instanceof URL ? url.href : '')
    if (f && endpoints.some(function(d) { return f.indexOf(d) !== -1 })) {
      var p = new URL(proxyUrl)
      p.searchParams.set('url', f)
      f = p.toString()
    }
    arguments[1] = f
    return origOpen.apply(this, arguments)
  }
})()`);
}

const ua = navigator.userAgent;
const chromeVersion = (ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/) || [])[1] || "120.0.0.0";
const majorVersion = chromeVersion.split(".")[0];

const PLATFORMS = { win32: "Windows", darwin: "macOS", linux: "Linux" };
const platform = PLATFORMS[process.platform] || "Linux";

webFrame.executeJavaScript(`
(function() {
  var brands = [
    { brand: 'Google Chrome', version: '${majorVersion}' },
    { brand: 'Chromium', version: '${majorVersion}' },
    { brand: 'Not_A Brand', version: '8' }
  ]

  Object.defineProperty(navigator, 'userAgentData', {
    get: function() {
      return {
        brands: brands, mobile: false, platform: '${platform}',
        getHighEntropyValues: function() {
          return Promise.resolve({
            brands: brands, mobile: false, platform: '${platform}',
            platformVersion: '10.0.0', architecture: 'x86', model: '', bitness: '64'
          })
        }
      }
    },
    configurable: true
  })

  Object.defineProperty(navigator, 'webdriver', {
    get: function() { return false },
    configurable: true
  })
})()`);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== "sclient-bridge") return;

  const { action, cmd, args, callbackId } = event.data;
  if (action !== "invoke") return;

  ipcRenderer
    .invoke(cmd, args)
    .then((result) => {
      window.postMessage(
        { source: "sclient-bridge-reply", callbackId, success: true, result },
        "*"
      );
    })
    .catch((err) => {
      window.postMessage(
        {
          source: "sclient-bridge-reply",
          callbackId,
          success: false,
          error: err.message,
        },
        "*"
      );
    });
});

ipcRenderer.on("download_progress", (_event, data) => {
  window.postMessage({ source: "sclient-bridge-event", event: "download_progress", data }, "*");
});

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data && event.data.source === "sclient-mini-update") {
    ipcRenderer.send("mini_update", event.data.data);
  } else if (event.data && event.data.source === "sclient-mini-visualizer") {
    ipcRenderer.send("mini_visualizer", event.data.data);
  } else if (event.data && event.data.source === "sclient-mini-time") {
    ipcRenderer.send("mini_time", event.data.data);
  } else if (event.data && event.data.source === "sclient-mini-toggle") {
    ipcRenderer.send("toggle_miniplayer");
  }
});

ipcRenderer.on("mini_action", (_event, action) => {
  window.postMessage({ source: "sclient-mini-action", action }, "*");
});

const uiConfig = ipcRenderer.sendSync("get-ui-config");
const isWindows = process.platform === "win32";

if (uiConfig.titlebarStyle === "custom") {
  const bgSurfaceVal = uiConfig.customBgColor ? uiConfig.bgColor : "var(--sc-bg-surface, #121212)";

  let fontImport = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block');";
  let fontFamily = "var(--sc-font-sans, 'Inter', sans-serif)";

  if (uiConfig.customFont && uiConfig.customFontFamily) {
    const familyUrl = uiConfig.customFontFamily.trim().replace(/\s+/g, "+");
    fontImport = `@import url('https://fonts.googleapis.com/css2?family=${familyUrl}:wght@400;500;600;700;800&display=block');`;
    fontFamily = `'${uiConfig.customFontFamily}', var(--sc-font-sans, sans-serif)`;
  }

  const style = document.createElement("style");
  style.textContent = `
    ${fontImport}
    #sclient-titlebar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 32px;
      background: var(--sc-bg-surface, ${bgSurfaceVal});
      z-index: 9999999;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
      -webkit-app-region: drag;
      border-bottom: 1px solid var(--sc-border, rgba(255,255,255,0.05));
      box-sizing: border-box;
      padding: 0 10px;
      font-family: ${fontFamily};
    }
    
    #sclient-titlebar .nav-area {
      display: flex;
      align-items: center;
      height: 100%;
      -webkit-app-region: no-drag;
    }
    #sclient-titlebar .title-area {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--sc-text-main, #fff);
      opacity: 0;
      transition: opacity 0.2s ease;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
    }
    #sclient-titlebar.font-ready .title-area {
      opacity: 1;
    }
    #sclient-titlebar .controls-area {
      display: flex;
      align-items: center;
      height: 100%;
      -webkit-app-region: no-drag;
    }
    #sclient-titlebar button {
      background: transparent;
      border: none;
      color: var(--sc-text-muted, rgba(255,255,255,0.65));
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.15s ease;
      padding: 0;
      margin: 0;
    }
    #sclient-titlebar button:hover {
      color: var(--sc-text-main, #fff);
    }
    header, .header, .header__wrapper {
      top: 32px !important;
    }
    #content, .l-main {
      padding-top: 32px !important;
    }
    .l-sidebar-right, 
    .sclient-floating-btn,
    #sclient-sidebar-toggle,
    #sclient-lyrics-sidebar {
      margin-top: 32px !important;
    }
    #sclient-settings-overlay,
    #sclient-stats-overlay,
    iframe.webiIframe {
      top: 32px !important;
      height: calc(100% - 32px) !important;
    }
  `;

  const injectTitlebar = () => {
    if (document.head) document.head.appendChild(style);
    else document.documentElement.appendChild(style);

    const titlebar = document.createElement("div");
    titlebar.id = "sclient-titlebar";
    titlebar.innerHTML = `
      <div class="nav-area">
        <button id="sclient-back-btn" title="Back"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <button id="sclient-fwd-btn" title="Forward"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
      <div class="title-area"><span>SClient</span></div>
      <div class="controls-area">
        <button id="sclient-min-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg></button>
        <button id="sclient-max-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>
        <button id="sclient-close-btn" class="close-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
    `;
    
    document.body.appendChild(titlebar);

    document.getElementById("sclient-back-btn").onclick = () => window.history.back();
    document.getElementById("sclient-fwd-btn").onclick = () => window.history.forward();
    document.getElementById("sclient-min-btn").onclick = () => ipcRenderer.send("window_minimize");
    document.getElementById("sclient-max-btn").onclick = () => ipcRenderer.send("window_maximize");
    document.getElementById("sclient-close-btn").onclick = () => ipcRenderer.send("window_close");

    document.fonts.ready.then(() => {
      titlebar.classList.add('font-ready');
    });
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectTitlebar);
  } else {
    injectTitlebar();
  }
}

window.addEventListener('load', () => {
  setTimeout(() => {
    if (document.documentElement) document.documentElement.classList.add('sclient-loaded');
    setTimeout(() => {
      if (document.documentElement) document.documentElement.classList.add('sclient-ready');
    }, 1000);
  }, 500);
});
