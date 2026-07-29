const { app, components, BrowserWindow, session, Menu, Tray, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const fetch = require("cross-fetch");
const { ElectronBlocker } = require("@ghostery/adblocker-electron");
const config = require("./config");
const ipc = require("./ipc");

let tray = null;
let win = null;
let isQuitting = false;

app.name = "sclient";
app.on("before-quit", () => {
  isQuitting = true;
  if (win && !win.isDestroyed() && config.isEnabled("features.load_last_page")) {
    const url = win.webContents.getURL();
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
    win.loadURL(clean);
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
      (a) => typeof a === "string" && (a.startsWith("sclient://") || a.startsWith("sclient:"))
    );
    if (raw) handleSclientUrl(raw);
  });
}

(function () {
  const raw = process.argv.find(
    (a) => typeof a === "string" && (a.startsWith("sclient://") || a.startsWith("sclient:"))
  );
  if (raw) pendingSclientUrl = sanitizeSclientUrl(raw);
})();
app.setAsDefaultProtocolClient("sclient");

function createWindow() {
  const hideFrameConfig = config.isEnabled("features.hide_decorations");
  const isWindows = process.platform === "win32";
  const hideFrame = isWindows || hideFrameConfig;
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
    .catch((e) => console.error("[SClient] Failed to initialize adblocker:", e));

  const cleanUA = ses
    .getUserAgent()
    .replace(/Electron\/\S+\s?/, "")
    .replace(/sclient\/\S+\s?/, "")
    .replace(/SClient\/\S+\s?/, "");
  ses.setUserAgent(cleanUA);
  app.userAgentFallback = cleanUA;

  const customBgEnabled = config.isEnabled("features.custom_bg_color");
  const splashBgColor = customBgEnabled ? config.get("features.bg_color", "#000000") : "#121212";

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: !hideFrame,
    titleBarStyle: isWindows && !hideFrameConfig ? 'hidden' : 'default',
    title: "SClient",
    icon: path.join(__dirname, "..", "assets", "32x32.png"),
    backgroundColor: splashBgColor,
    show: false,
    webPreferences: {
      partition,
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.setMenu(null);
  win.on("page-title-updated", (e) => e.preventDefault());

  let splashCssKey = null;
  let isFirstLoad = true;
  win.webContents.on('did-start-loading', async () => {
    if (!isFirstLoad) return;
    isFirstLoad = false;
    
    try {
      const iconPath = path.join(__dirname, '..', 'icons', '128x128.png');
      const iconBase64 = fs.readFileSync(iconPath).toString('base64');
      
      splashCssKey = await win.webContents.insertCSS(`
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
        html.sclient-loaded::before { opacity: 0; }
      `);
    } catch (e) {
      console.error("[SClient] Failed to inject splash CSS:", e);
    }
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  const lastPageEnabled = config.isEnabled("features.load_last_page");
  const lastPageUrl = config.get("last_page_url", "https://soundcloud.com");
  if (lastPageEnabled && lastPageUrl && lastPageUrl.startsWith("http")) {
    win.loadURL(lastPageUrl);
  } else {
    win.loadURL("https://soundcloud.com");
  }

  win.webContents.on("dom-ready", () => {
    const files = [
      "core.js",
      "effects.js",
      "accent.js",
      "adblock.js",
      "shuffle.js",
      "rpc-bridge.js",
      "downloader.js",
      "lyrics.js",
      "scrobbler.js",
      "stats.js",
      "playlists.js",
      "settings.js",
      "contextmenu.js",
      "init.js",
    ];

    const injectedDir = path.join(__dirname, "..", "injected");
    const injectedJs = files
      .map((f) => fs.readFileSync(path.join(injectedDir, f), "utf8"))
      .join("\n");

    const chartPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "chart.js",
      "dist",
      "chart.umd.js"
    );
    const chartJs = fs.readFileSync(chartPath, "utf8");

    const payload = config.buildConfigPayload();

    win.webContents
      .executeJavaScript(
        `
try {
  (function() {
    window.__SCLIENT_CONFIG__ = ${JSON.stringify(payload)};
    ${chartJs}
    ${injectedJs}
  })()
} catch (e) {
  console.error("[SClient] Injected JS error:", e);
}
`
      )
      .catch((err) => console.error("[SClient] Script execution failed:", err));
  });

  win.on("close", (e) => {
    if (config.isEnabled("features.load_last_page")) {
      const url = win.webContents.getURL();
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
  console.log(`[SClient] Starting v${app.getVersion()}...`);
  await components.whenReady();

  ipc.register({ ipcMain, session, app });

  let miniWin = null;
  ipcMain.on("toggle_miniplayer", () => {
    if (miniWin) {
      miniWin.close();
      return;
    }
    miniWin = new BrowserWindow({
      width: 480,
      height: 180,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      icon: path.join(__dirname, "..", "assets", "32x32.png"),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    miniWin.loadFile(path.join(__dirname, "mini.html"));
    miniWin.on("closed", () => {
      miniWin = null;
      if (win && !win.isDestroyed()) win.show();
    });
    if (win && !win.isDestroyed()) win.hide();
  });

  ipcMain.on("mini_close", () => {
    if (miniWin) miniWin.close();
  });
  ipcMain.on("mini_minimize", () => {
    if (miniWin) miniWin.minimize();
  });
  ipcMain.on("mini_fullscreen", () => {
    if (miniWin && !miniWin.isDestroyed()) {
      const willBeFS = !miniWin.isFullScreen();
      if (willBeFS) {
        miniWin.setResizable(true);
        miniWin.setFullScreen(true);
      } else {
        miniWin.setFullScreen(false);
        setTimeout(() => {
          if (!miniWin.isDestroyed() && !miniWin.isFullScreen()) {
            if (miniWin.desiredSize) {
              miniWin.setResizable(true);
              miniWin.setSize(miniWin.desiredSize.width, miniWin.desiredSize.height);
            }
            miniWin.setResizable(false);
          }
        }, 100);
      }
    }
  });
  ipcMain.on("mini_action", (_e, action) => {
    if (win) win.webContents.send("mini_action", action);
  });
  ipcMain.on("mini_update", (_e, data) => {
    if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send("mini_update", data);
  });
  ipcMain.on("mini_visualizer", (_e, data) => {
    if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send("mini_visualizer", data);
  });
  ipcMain.on("mini_time", (_e, data) => {
    if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send("mini_time", data);
  });
  ipcMain.on("resize_mini", (_e, width, height) => {
    if (miniWin && !miniWin.isDestroyed()) {
      miniWin.desiredSize = { width, height };
      if (miniWin.isFullScreen()) return;
      miniWin.setResizable(true);
      miniWin.setSize(width, height);
      setTimeout(() => {
        if (miniWin && !miniWin.isDestroyed() && !miniWin.isFullScreen()) {
          miniWin.setResizable(false);
        }
      }, 150);
    }
  });

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

  createWindow();

  if (pendingSclientUrl && win && !win.isDestroyed()) {
    win.loadURL(pendingSclientUrl);
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
            },
          },
          {
            label: "Previous",
            click: () =>
              win.webContents.executeJavaScript(
                "document.querySelector('.skipControl__previous').click()"
              ),
          },
          {
            label: "Pause/Resume",
            click: () =>
              win.webContents.executeJavaScript("document.querySelector('.playControl').click()"),
          },
          {
            label: "Next",
            click: () =>
              win.webContents.executeJavaScript(
                "document.querySelector('.skipControl__next').click()"
              ),
          },
          { label: "Exit", click: () => app.quit() },
        ])
      );
      tray.on("click", () => {
        win.show();
        win.focus();
      });
    } catch (e) {
      console.error("[SClient] Failed to create tray:", e);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
