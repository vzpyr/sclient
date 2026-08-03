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
  } else if (event.data && event.data.source === "sclient-mpris-update") {
    ipcRenderer.send("mpris_update", event.data.data);
  }
});

ipcRenderer.on("mini_action", (_event, action) => {
  window.postMessage({ source: "sclient-mini-action", action }, "*");
});

ipcRenderer.on("mpris_command", (_event, data) => {
  window.postMessage({ source: "sclient-mpris-command", data }, "*");
});

const uiConfig = ipcRenderer.sendSync("get-ui-config");
const isWindows = process.platform === "win32";

if (uiConfig.titlebarStyle === "custom") {
  let fontImport = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block');";
  let fontFamily = "var(--sclient-font-sans, 'Inter', sans-serif)";

  if (uiConfig.customFont && uiConfig.customFontFamily) {
    const familyUrl = uiConfig.customFontFamily.trim().replace(/\s+/g, "+");
    fontImport = `@import url('https://fonts.googleapis.com/css2?family=${familyUrl}:wght@400;500;600;700;800&display=block');`;
    fontFamily = `'${uiConfig.customFontFamily}', var(--sclient-font-sans, sans-serif)`;
  }

  const style = document.createElement("style");
  style.textContent = `
    ${fontImport}
    #sclient-titlebar { font-family: ${fontFamily}; }
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
