const path = require("path");
const fs = require("fs");
const { BrowserWindow, clipboard } = require("electron");
const config = require("./config");
const romanize = require("./romanize");

const SECURE_KEYS = [
  "integrations.listenbrainz.token",
  "integrations.lastfm.api_key",
  "integrations.lastfm.secret",
  "integrations.lastfm.session_key",
];

function partitionName(active) {
  return active === "main" ? "persist:main" : `persist:${active}`;
}

function register({ ipcMain, session, app }) {
  ipcMain.on("get-proxy-config", (event) => {
    event.returnValue = {
      enabled: config.isEnabled("features.region_bypass"),
      url: config.get("features.proxy_url"),
    };
  });

  ipcMain.on("get-ui-config", (event) => {
    event.returnValue = {
      titlebarStyle: config.get("features.titlebar_style", "custom"),
      customBackgroundColor: config.isEnabled("features.custom_bg_color"),
      backgroundColor: config.get("features.bg_color", "#000000"),
      customFont: config.isEnabled("features.custom_font"),
      customFontFamily: config.get("features.custom_font_family", ""),
    };
  });

  ipcMain.handle("clipboard_readText", () => {
    return clipboard.readText() || "";
  });

  ipcMain.handle("clipboard_writeText", (_e, args) => {
    clipboard.writeText(args.text || "");
  });

  ipcMain.handle("webcontents_paste", (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w && !w.isDestroyed()) w.webContents.paste();
  });

  ipcMain.handle("webcontents_copy", (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w && !w.isDestroyed()) w.webContents.copy();
  });

  ipcMain.handle("webcontents_cut", (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w && !w.isDestroyed()) w.webContents.cut();
  });

  ipcMain.handle("webcontents_selectAll", (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w && !w.isDestroyed()) w.webContents.selectAll();
  });

  ipcMain.handle("get_custom_files", () => config.buildConfigPayload());

  ipcMain.handle("save_custom_files", (_e, args) => {
    const files = args.files || {};
    config.setFile("custom.css", files.css || "");
    config.setFile("custom.js", files.js || "");
    for (const [key, value] of Object.entries(args.pairs || {})) {
      if (SECURE_KEYS.includes(key)) {
        config.setSecure(key, String(value));
      } else if (key === "features.adblock") {
        const oldAdblock = config.adblockEnabled;
        config.adblockEnabled = !!value;
        config.set("features.adblock", String(Boolean(value)));
        if (oldAdblock !== config.adblockEnabled && global._blocker && global._session) {
          if (config.adblockEnabled) global._blocker.enableBlockingInSession(global._session);
          else global._blocker.disableBlockingInSession(global._session);
        }
      } else {
        config.set(key, typeof value === "boolean" ? String(value) : value);
        if (key === "stats.api_sync") config.statsApiSyncEnabled = Boolean(value);
        if (key === "stats.local_tracking") config.statsLocalTrackingEnabled = Boolean(value);
      }
    }
  });

  ipcMain.handle("get_active_account", () => config.getActiveAccount());
  ipcMain.handle("set_active_account", (_e, args) => config.setActiveAccount(args.name));

  ipcMain.handle("get_accounts", () => {
    const dir = path.join(app.getPath("userData"), "Partitions");
    if (!fs.existsSync(dir)) return ["main"];
    const accs = [
      "main",
      ...fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()),
    ];
    return [...new Set(accs)];
  });

  ipcMain.handle("create_account", (_e, args) => {
    fs.mkdirSync(path.join(app.getPath("userData"), "Partitions", args.name), {
      recursive: true,
    });
  });

  ipcMain.handle("delete_account", (_e, args) => {
    const d = path.join(app.getPath("userData"), "Partitions", args.name);
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  });

  ipcMain.handle("restart_app", () => {
    app.relaunch({ args: [path.join(__dirname, "..", "..")] });
    app.exit(0);
  });

  ipcMain.handle("clear_data", async () => {
    await session.fromPartition(partitionName(config.getActiveAccount())).clearStorageData();
    return "done";
  });

  ipcMain.handle("clear_data_and_restart", async () => {
    await session.fromPartition(partitionName(config.getActiveAccount())).clearStorageData();
    app.relaunch({ args: [path.join(__dirname, "..", "..")] });
    app.exit(0);
  });

  ipcMain.handle("romanize", async (_e, args) => {
    const texts = (args && args.texts) || [];
    return romanize.romanizeLines(texts);
  });
}

module.exports = { register };
