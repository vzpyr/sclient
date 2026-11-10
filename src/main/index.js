const {
  app,
  components,
  BrowserWindow,
  WebContentsView,
  session,
  Menu,
  Tray,
  ipcMain,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { ElectronBlocker } = require("@ghostery/adblocker-electron");
const config = require("./config");
const localAudio = require("./features/local-audio");

if (process.platform === "linux" && config.isEnabled("features.mpris")) {
  app.commandLine.appendSwitch("disable-features", "MediaSessionService");
}
app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");

let tray = null;
let win = null;
let scView = null;
let isQuitting = false;

app.on("before-quit", () => {
  isQuitting = true;
  if (
    scView &&
    !scView.webContents.isDestroyed() &&
    config.isEnabled("features.load_last_page")
  ) {
    const url = scView.webContents.getURL();
    if (url && url.startsWith("http")) config.set("last_page_url", url);
  }
});

let pendingSclientUrl = null;

function sanitizeSclientUrl(raw) {
  if (!raw) return null;
  let url = raw;
  if (url.startsWith("sclient://")) url = url.slice("sclient://".length);
  if (url.startsWith("sclient:")) url = url.slice("sclient:".length);
  const match = url.match(/^redirect\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/?$/);
  if (!match) return null;
  return "https://soundcloud.com/" + match[1] + "/" + match[2];
}

function handleSclientUrl(raw) {
  const clean = sanitizeSclientUrl(raw);
  if (!clean) return;
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    if (scView && !scView.webContents.isDestroyed()) {
      scView.webContents.focus();
      scView.webContents.loadURL(clean);
    }
  } else {
    pendingSclientUrl = clean;
  }
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleSclientUrl(url);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const raw = (argv || []).find(
      (a) =>
        typeof a === "string" &&
        (a.startsWith("sclient://") || a.startsWith("sclient:")),
    );
    if (raw) handleSclientUrl(raw);
  });
}

(function () {
  const raw = process.argv.find(
    (a) =>
      typeof a === "string" &&
      (a.startsWith("sclient://") || a.startsWith("sclient:")),
  );
  if (raw) pendingSclientUrl = sanitizeSclientUrl(raw);
})();
app.setAsDefaultProtocolClient("sclient");

const JS_FILES = [
  "utils.js",
  "icons.js",
  "bridge.js",
  "config.js",
  "features/Feature.js",
  "features/hides.js",
  "features/lazy-scroll.js",
  "features/wide-layout.js",
  "features/collapsible-sidebar.js",
  "features/enhanced-header.js",
  "features/accent.js",
  "features/adblock.js",
  "features/artwork-viewer.js",
  "features/local-audio.js",
  "features/context-menu.js",
  "features/shuffle.js",
  "features/effects.js",
  "features/lyrics.js",
  "features/downloader.js",
  "features/discord-rpc.js",
  "features/mpris.js",
  "features/lastfm.js",
  "features/listenbrainz.js",
  "features/stats.js",
  "features/playlist-manager/api.js",
  "features/playlist-manager/state.js",
  "features/playlist-manager/spotify.js",
  "features/playlist-manager/index.js",
  "features/miniplayer.js",
  "features/settings.js",
  "core.js",
];

const CSS_FILES = ["base.css", "layout.css", "features.css"];

function luminance(hex) {
  const rgb = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(rgb.slice(i, i + 2), 16) / 255,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function createWindow() {
  const titlebarStyle = config.get("features.titlebar_style", "custom");
  const isWindows = process.platform === "win32";
  const account = config.getActiveAccount();
  const partition = account === "main" ? "persist:main" : `persist:${account}`;
  const ses = session.fromPartition(partition);

  global._session = ses;
  global._blocker = null;

  ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
    .then((blocker) => {
      global._blocker = blocker;
      if (config.adblockEnabled) blocker.enableBlockingInSession(ses);
    })
    .catch((e) => console.error("[SClient] Couldn't initialize adblocker:", e));

  const cleanUA = ses
    .getUserAgent()
    .replace(/Electron\/\S+\s?/g, "")
    .replace(/sclient\/\S+\s?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  ses.setUserAgent(cleanUA);
  app.userAgentFallback = cleanUA;

  const chromeMajor = process.versions.chrome
    ? process.versions.chrome.split(".")[0]
    : "134";
  const chromeFull = process.versions.chrome || "134.0.0.0";

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };

    if (headers["User-Agent"]) {
      headers["User-Agent"] = headers["User-Agent"]
        .replace(/Electron\/\S+\s?/g, "")
        .replace(/sclient\/\S+\s?/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const cleanHints = (str, version) => {
      let cleaned = str
        .replace(/"Electron";v="[^"]*"/g, `"Google Chrome";v="${version}"`)
        .replace(/,?\s*"Electron";v="[^"]*"/g, "")
        .replace(/,\s*,/g, ",");
      if (!cleaned.includes("Google Chrome")) {
        cleaned = `${cleaned}, "Google Chrome";v="${version}"`;
      }
      return cleaned;
    };

    for (const key of ["sec-ch-ua", "Sec-CH-UA"]) {
      if (headers[key]) headers[key] = cleanHints(headers[key], chromeMajor);
    }
    for (const key of [
      "sec-ch-ua-full-version-list",
      "Sec-CH-UA-Full-Version-List",
    ]) {
      if (headers[key]) headers[key] = cleanHints(headers[key], chromeFull);
    }

    callback({ requestHeaders: headers });
  });

  ses.webRequest.onBeforeRequest(
    {
      urls: ["*://*.adswizz.com/*", "*://*.doubleclick.net/*"],
    },
    (details, callback) => {
      if (config.adblockEnabled) {
        callback({ cancel: true });
      } else {
        callback({ cancel: false });
      }
    },
  );

  function cleanTrack(track, localTrackIds) {
    if (!track || typeof track !== "object") return false;
    if (!localTrackIds.has(String(track.id))) return false;

    let changed = false;
    if (track.policy !== "ALLOW") {
      track.policy = "ALLOW";
      changed = true;
    }
    if (track.monetization_model !== "NOT_APPLICABLE") {
      track.monetization_model = "NOT_APPLICABLE";
      changed = true;
    }
    if (track.blocked !== false) {
      track.blocked = false;
      changed = true;
    }
    if (track.snipped !== false) {
      track.snipped = false;
      changed = true;
    }
    if (
      track.full_duration &&
      track.full_duration !== track.duration &&
      track.duration === 30000
    ) {
      track.duration = track.full_duration;
      changed = true;
    }

    if (Array.isArray(track.media?.transcodings)) {
      for (const transcoding of track.media.transcodings) {
        if (transcoding.snipped !== false) {
          transcoding.snipped = false;
          changed = true;
        }
        if (transcoding.duration !== track.duration) {
          transcoding.duration = track.duration;
          changed = true;
        }
        if (transcoding.url && transcoding.url.includes("/preview/")) {
          transcoding.url = transcoding.url.replace(/\/preview\//g, "/stream/");
          changed = true;
        }
      }
    }

    return changed;
  }

  function cleanPayload(data, localTrackIds, seen = new WeakSet()) {
    if (!data || typeof data !== "object" || seen.has(data)) return false;
    seen.add(data);

    if (Array.isArray(data)) {
      let changed = false;
      for (const item of data) {
        changed = cleanPayload(item, localTrackIds, seen) || changed;
      }
      return changed;
    }

    let changed = false;

    if (Array.isArray(data.collection)) {
      changed = cleanPayload(data.collection, localTrackIds, seen) || changed;
    }
    if (Array.isArray(data.tracks)) {
      changed = cleanPayload(data.tracks, localTrackIds, seen) || changed;
    }

    if (data.track) {
      changed = cleanPayload(data.track, localTrackIds, seen) || changed;
    } else if (
      !Array.isArray(data.collection) &&
      !Array.isArray(data.tracks) &&
      data.id
    ) {
      changed = cleanTrack(data, localTrackIds) || changed;
    }

    return changed;
  }

  function mediaTrackId(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return null;
    }
    if (parsed.hostname !== "api-v2.soundcloud.com") return null;
    const match = /^\/media\/(?:soundcloud:tracks:)?(\d+)/.exec(
      parsed.pathname,
    );
    return match ? match[1] : null;
  }

  function isTrackApi(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return false;
    }
    if (parsed.hostname !== "api-v2.soundcloud.com") return false;
    if (parsed.pathname.startsWith("/media/")) return false;
    return /track|search|stream|resolve|playlist|like|user/.test(
      parsed.pathname,
    );
  }

  function rebuildResponse(body, source) {
    const headers = new Headers(source.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("transfer-encoding");
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(body, {
      status: source.status,
      statusText: source.statusText,
      headers,
    });
  }

  function forward(request) {
    return ses.fetch(request, { bypassCustomProtocolHandlers: true });
  }

  if (config.isEnabled("features.local_audio_routing")) {
    ses.protocol.handle("https", async (request) => {
      const url = request.url;

      const trackId = mediaTrackId(url);

      if (trackId) {
        const localTrackIds = new Set(
          localAudio.getAvailableLocalTrackIds().map(String),
        );
        if (!localTrackIds.has(trackId)) return forward(request);
        const port = localAudio.startServer();
        if (!port) return forward(request);
        return new Response(
          JSON.stringify({
            url: `http://127.0.0.1:${port}/track/${trackId}`,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "access-control-allow-origin": "*",
            },
          },
        );
      }

      if (isTrackApi(url)) {
        const localTrackIds = new Set(
          localAudio.getAvailableLocalTrackIds().map(String),
        );
        if (localTrackIds.size === 0) return forward(request);
        try {
          const res = await forward(request);
          try {
            const json = await res.clone().json();
            if (!cleanPayload(json, localTrackIds)) return res;
            return rebuildResponse(JSON.stringify(json), res);
          } catch (e) {
            return res;
          }
        } catch (e) {
          return new Response("Bad Gateway", { status: 502 });
        }
      }

      return forward(request);
    });
  }

  const customBgEnabled = config.isEnabled("features.custom_bg_color");
  const splashBgColor = customBgEnabled
    ? config.get("features.bg_color", "#000000")
    : "#121212";
  const splashTextColor =
    customBgEnabled && luminance(splashBgColor) > 0.45
      ? "rgba(0, 0, 0, 0.4)"
      : "rgba(255, 255, 255, 0.35)";

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: titlebarStyle === "native",
    titleBarStyle: titlebarStyle === "custom" ? "hidden" : "default",
    title: "SClient",
    icon: path.join(__dirname, "..", "assets", "32x32.png"),
    backgroundColor: splashBgColor,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  scView = new WebContentsView({
    webPreferences: {
      partition,
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
    },
  });
  scView.setBackgroundColor(splashBgColor);
  win.contentView.addChildView(scView);

  function updateViewBounds() {
    if (!win || win.isDestroyed() || !scView) return;
    const [w, h] = win.getContentSize();
    const titlebarH =
      titlebarStyle === "custom" && !win.isFullScreen() ? 32 : 0;
    scView.setBounds({
      x: 0,
      y: titlebarH,
      width: w,
      height: Math.max(0, h - titlebarH),
    });
  }

  win.on("resize", updateViewBounds);
  win.on("maximize", () => {
    updateViewBounds();
    if (!win.isDestroyed()) {
      win.webContents.send("window_state", { isMaximized: true });
    }
  });
  win.on("unmaximize", () => {
    updateViewBounds();
    if (!win.isDestroyed()) {
      win.webContents.send("window_state", { isMaximized: false });
    }
  });
  win.on("enter-full-screen", updateViewBounds);
  win.on("leave-full-screen", updateViewBounds);

  updateViewBounds();

  if (titlebarStyle === "custom") {
    win.loadFile(path.join(__dirname, "..", "titlebar", "index.html"));
  }

  win.once("ready-to-show", () => {
    updateViewBounds();
    win.show();
    if (scView && !scView.webContents.isDestroyed()) {
      scView.webContents.focus();
    }
    if (win.isMaximized()) {
      win.webContents.send("window_state", { isMaximized: true });
    }
  });

  win.setMenu(null);
  win.on("page-title-updated", (e) => e.preventDefault());

  const sendNavState = () => {
    if (
      win &&
      !win.isDestroyed() &&
      scView &&
      !scView.webContents.isDestroyed()
    ) {
      const nh = scView.webContents.navigationHistory;
      const canGoBack = nh ? nh.canGoBack() : scView.webContents.canGoBack();
      const canGoForward = nh
        ? nh.canGoForward()
        : scView.webContents.canGoForward();
      win.webContents.send("window_nav_state", { canGoBack, canGoForward });
    }
  };

  scView.webContents.on("did-navigate", sendNavState);
  scView.webContents.on("did-navigate-in-page", sendNavState);

  let splashCssKey = null;
  let isFirstLoad = true;
  scView.webContents.on("did-start-loading", async () => {
    if (!isFirstLoad) return;
    isFirstLoad = false;

    try {
      const iconPath = path.join(__dirname, "..", "assets", "128x128.png");
      const iconBase64 = fs.readFileSync(iconPath).toString("base64");
      const appVersion = app.getVersion();

      splashCssKey = await scView.webContents.insertCSS(`
        html:not(.sclient-ready) { background: ${splashBgColor} !important; overflow: hidden !important; }
        html:not(.sclient-loaded) body { opacity: 0 !important; overflow: hidden !important; }
        html:not(.sclient-ready) ::-webkit-scrollbar { display: none !important; }
        html::before {
          content: ""; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background-color: ${splashBgColor}; 
          background-image: url('data:image/png;base64,${iconBase64}');
          background-repeat: no-repeat;
          background-position: center center;
          background-size: 80px 80px;
          z-index: 9999999999; pointer-events: none;
          opacity: 1; transition: opacity 1.0s ease-out;
        }
        html::after {
          content: "v${appVersion}"; position: fixed; bottom: 24px; left: 0; right: 0;
          text-align: center; color: ${splashTextColor};
          font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 0.5px;
          z-index: 9999999999; pointer-events: none;
          opacity: 1; transition: opacity 1.0s ease-out;
        }
        html.sclient-loaded::before, html.sclient-loaded::after { opacity: 0; }
      `);
    } catch (e) {
      console.error("[SClient] Couldn't inject splash CSS:", e);
    }
  });

  const toggleDevTools = (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      if (scView && !scView.webContents.isDestroyed()) {
        scView.webContents.toggleDevTools();
      }
      event.preventDefault();
    }
  };
  scView.webContents.on("before-input-event", toggleDevTools);
  win.webContents.on("before-input-event", toggleDevTools);

  const lastPageEnabled = config.isEnabled("features.load_last_page");
  const lastPageUrl = config.get("last_page_url", "https://soundcloud.com");
  if (lastPageEnabled && lastPageUrl && lastPageUrl.startsWith("http")) {
    scView.webContents.loadURL(lastPageUrl);
  } else {
    scView.webContents.loadURL("https://soundcloud.com");
  }

  scView.webContents.on("dom-ready", () => {
    const rendererDir = path.join(__dirname, "..", "renderer");
    const injectedJs = JS_FILES.map((f) =>
      fs.readFileSync(path.join(rendererDir, f), "utf8"),
    ).join("\n");

    const chartPath = path.join(
      __dirname,
      "..",
      "..",
      "node_modules",
      "chart.js",
      "dist",
      "chart.umd.js",
    );
    const chartJs = fs.readFileSync(chartPath, "utf8");

    const payload = config.buildConfigPayload();

    const stylesDir = path.join(rendererDir, "styles");
    Promise.all(
      CSS_FILES.map((f) =>
        scView.webContents.insertCSS(
          fs.readFileSync(path.join(stylesDir, f), "utf8"),
        ),
      ),
    ).catch((err) => console.error("[SClient] Couldn't inject styles:", err));

    scView.webContents
      .executeJavaScript(
        `
try {
  (function() {
    window.__SCLIENT_CONFIG__ = ${JSON.stringify(payload)};
    ${chartJs}
    ${injectedJs}
  })()
} catch (e) {
  console.error("[SClient] Couldn't run injected JS:", e);
}
`,
      )
      .catch((err) => console.error("[SClient] Couldn't run scripts:", err));
  });

  win.on("close", (e) => {
    if (config.isEnabled("features.load_last_page")) {
      const url =
        scView && !scView.webContents.isDestroyed()
          ? scView.webContents.getURL()
          : null;
      if (url && url.startsWith("http")) config.set("last_page_url", url);
    }
    if (!isQuitting && config.isEnabled("features.tray_icon") && tray) {
      e.preventDefault();
      win.hide();
    }
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  await config.initSecure();
  console.log(`[SClient] Starting v${app.getVersion()}.`);
  await components.whenReady();

  require("./ipc").register({ ipcMain, session, app, config });
  require("./features/downloader").register({ ipcMain, app });
  require("./features/discord-rpc").register({ ipcMain, config });
  require("./features/lastfm").register({ ipcMain, config });
  require("./features/listenbrainz").register({ ipcMain, config });
  require("./features/stats").register({ ipcMain, dialog, config });
  require("./features/playlist-manager").register({ ipcMain, dialog });
  localAudio.startServer();

  ipcMain.on("window_minimize", () => {
    if (win) win.minimize();
  });
  ipcMain.on("window_maximize", () => {
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });
  ipcMain.on("window_close", () => {
    if (win) win.close();
  });
  ipcMain.on("window_back", () => {
    if (scView && !scView.webContents.isDestroyed()) {
      const nh = scView.webContents.navigationHistory;
      if (nh ? nh.canGoBack() : scView.webContents.canGoBack()) {
        if (nh) nh.goBack();
        else scView.webContents.goBack();
      }
    }
  });
  ipcMain.on("window_forward", () => {
    if (scView && !scView.webContents.isDestroyed()) {
      const nh = scView.webContents.navigationHistory;
      if (nh ? nh.canGoForward() : scView.webContents.canGoForward()) {
        if (nh) nh.goForward();
        else scView.webContents.goForward();
      }
    }
  });

  createWindow();

  require("./features/miniplayer").register({
    ipcMain,
    BrowserWindow,
    win,
    scView,
    app,
  });

  if (process.platform === "linux" && config.isEnabled("features.mpris")) {
    require("./features/mpris").init({ ipcMain, win, scView });
  }

  if (pendingSclientUrl && scView && !scView.webContents.isDestroyed()) {
    scView.webContents.loadURL(pendingSclientUrl);
    pendingSclientUrl = null;
  }

  if (config.isEnabled("features.tray_icon")) {
    try {
      tray = new Tray(path.join(__dirname, "..", "assets", "32x32.png"));
      tray.setToolTip("SClient");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: "Show",
            click: () => {
              win.show();
              win.focus();
              if (scView && !scView.webContents.isDestroyed()) {
                scView.webContents.focus();
              }
            },
          },
          {
            label: "Previous",
            click: () => {
              const target =
                scView && !scView.webContents.isDestroyed()
                  ? scView.webContents
                  : win && !win.isDestroyed()
                    ? win.webContents
                    : null;
              if (target) {
                target.executeJavaScript(
                  "document.querySelector('.skipControl__previous').click()",
                );
              }
            },
          },
          {
            label: "Pause/Resume",
            click: () => {
              const target =
                scView && !scView.webContents.isDestroyed()
                  ? scView.webContents
                  : win && !win.isDestroyed()
                    ? win.webContents
                    : null;
              if (target) {
                target.executeJavaScript(
                  "document.querySelector('.playControl').click()",
                );
              }
            },
          },
          {
            label: "Next",
            click: () => {
              const target =
                scView && !scView.webContents.isDestroyed()
                  ? scView.webContents
                  : win && !win.isDestroyed()
                    ? win.webContents
                    : null;
              if (target) {
                target.executeJavaScript(
                  "document.querySelector('.skipControl__next').click()",
                );
              }
            },
          },
          { label: "Exit", click: () => app.quit() },
        ]),
      );
      tray.on("click", () => {
        win.show();
        win.focus();
        if (scView && !scView.webContents.isDestroyed()) {
          scView.webContents.focus();
        }
      });
    } catch (e) {
      console.error("[SClient] Couldn't create tray:", e);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
