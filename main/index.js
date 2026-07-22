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
});

let pendingSclientUrl = null;

function sanitizeSclientUrl(raw) {
  if (!raw) return null;
  let url = raw;
  if (url.startsWith('sclient://')) url = url.slice('sclient://'.length);
  if (url.startsWith('sclient:')) url = url.slice('sclient:'.length);
  const match = url.match(/^redirect\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/?$/);
  if (!match) return null;
  return 'https://soundcloud.com/' + match[1] + '/' + match[2];
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

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleSclientUrl(url);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const raw = (argv || []).find(a => typeof a === 'string' && (a.startsWith('sclient://') || a.startsWith('sclient:')));
    if (raw) handleSclientUrl(raw);
  });
}

(function () {
  const raw = process.argv.find(a => typeof a === 'string' && (a.startsWith('sclient://') || a.startsWith('sclient:')));
  if (raw) pendingSclientUrl = sanitizeSclientUrl(raw);
})();
app.setAsDefaultProtocolClient('sclient');

function createWindow() {
  const hideFrame = config.isEnabled("features.hide_decorations");
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

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: !hideFrame,
    title: "SClient",
    icon: path.join(__dirname, "..", "assets", "32x32.png"),
    webPreferences: {
      partition,
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
    },
  });

  win.setMenu(null);
  win.on("page-title-updated", (e) => e.preventDefault());

  win.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.loadURL("https://soundcloud.com");

  win.webContents.on("dom-ready", () => {
    const files = [
      "core.js",
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

    win.webContents.executeJavaScript(`
try {
  (function() {
    window.__SCLIENT_CONFIG__ = ${JSON.stringify(payload)};
    ${chartJs}
    ${injectedJs}
  })()
} catch (e) {
  console.error('[SClient Injected JS Error]:', e);
}
`).catch((err) => console.error('[SClient executeJavaScript Rejection]:', err));
  });

  win.on("close", (e) => {
    if (!isQuitting && config.isEnabled("features.tray_icon") && tray) {
      e.preventDefault();
      win.hide();
    }
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
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
    if (miniWin) miniWin.webContents.send("mini_update", data);
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
