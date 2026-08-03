const path = require("path");
const fs = require("fs");
const { app } = require("electron");
let keytar = null;
try {
  keytar = require("keytar");
} catch (e) {
  console.error("[SClient] keytar unavailable, storing secrets in config.json:", e.message);
}

const DIR = path.join(app.getPath("userData"), "SClient");
const FILE = path.join(DIR, "config.json");
const SERVICE = "SClient";

const SECURE_KEYS = [
  "integrations.listenbrainz.token",
  "integrations.lastfm.api_key",
  "integrations.lastfm.secret",
  "integrations.lastfm.session_key",
];

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

let store = {};

if (fs.existsSync(FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    console.error("[SClient] Failed to parse config.json, starting fresh.");
  }
}

const secureCache = {};

async function initSecure() {
  for (const key of SECURE_KEYS) {
    let stored = null;
    if (keytar) {
      try {
        stored = await keytar.getPassword(SERVICE, key);
      } catch (e) {
        console.error("[SClient] keytar read failed:", key, e);
      }
      if (stored !== null) {
        secureCache[key] = stored;
        clearRaw(key);
        continue;
      }
    }
    const raw = resolvePath(key);
    if (typeof raw === "string" && raw !== "") {
      secureCache[key] = raw;
      if (!keytar) continue;
      try {
        await keytar.setPassword(SERVICE, key, raw);
        clearRaw(key);
      } catch (e) {
        console.error("[SClient] keytar migrate failed:", key, e);
      }
    }
  }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function resolvePath(key) {
  const parts = key.split(".");
  let val = store;
  for (const part of parts) {
    if (val == null || typeof val !== "object") return undefined;
    val = val[part];
  }
  return val;
}

function assignPath(key, val) {
  const parts = key.split(".");
  let obj = store;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = val;
}

function clearRaw(key) {
  assignPath(key, undefined);
  save();
}

function get(key, fallback = "") {
  const val = resolvePath(key);
  return val !== undefined && val !== null ? val : fallback;
}

function set(key, val) {
  assignPath(key, val);
  save();
}

function isEnabled(key) {
  return get(key) === "true";
}

function getSecure(key, fallback = "") {
  const val = secureCache[key];
  return val !== undefined && val !== null && val !== "" ? val : fallback;
}

function setSecure(key, val) {
  if (val === "" || val === null || val === undefined) {
    delete secureCache[key];
    clearRaw(key);
    if (keytar) keytar.deletePassword(SERVICE, key).catch(() => {});
    return;
  }
  secureCache[key] = val;
  if (!keytar) {
    assignPath(key, val);
    save();
    return;
  }
  keytar
    .setPassword(SERVICE, key, val)
    .then(() => clearRaw(key))
    .catch((e) => {
      console.error("[SClient] keytar write failed:", key, e);
      assignPath(key, val);
      save();
    });
}

function getFile(name) {
  const p = path.join(DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function setFile(name, val) {
  fs.writeFileSync(path.join(DIR, name), val);
}

if (!fs.existsSync(path.join(DIR, "custom.css"))) setFile("custom.css", "");
if (!fs.existsSync(path.join(DIR, "custom.js"))) setFile("custom.js", "");

let adblockOn = isEnabled("features.adblock");
let statsApiOn = isEnabled("stats.api_sync");
let statsLocalOn = isEnabled("stats.local_tracking");

function buildPayload() {
  return {
    css: getFile("custom.css"),
    js: getFile("custom.js"),
    lazy_scroll: isEnabled("features.lazy_scroll"),
    titlebar_style: get("features.titlebar_style", "custom"),
    custom_accent: isEnabled("features.custom_accent"),
    accent_color: get("features.accent_color", "#FF0000"),
    custom_font: isEnabled("features.custom_font"),
    custom_font_family: get("features.custom_font_family", ""),
    wide_layout: isEnabled("features.wide_layout"),
    wide_layout_width: get("features.wide_layout_width", "1200"),
    custom_bg_color: isEnabled("features.custom_bg_color"),
    bg_color: get("features.bg_color", "#000000"),
    adblock: isEnabled("features.adblock"),
    discord_rpc: isEnabled("features.discord_rpc"),
    tray_icon: isEnabled("features.tray_icon"),
    hide_upsell: isEnabled("features.hide_upsell"),
    hide_artists: isEnabled("features.hide_artists"),
    show_lyrics: isEnabled("features.show_lyrics"),
    show_miniplayer: isEnabled("features.show_miniplayer"),
    show_downloader: isEnabled("features.show_downloader"),
    show_effects: isEnabled("features.show_effects"),
    show_visualizer: isEnabled("features.show_visualizer"),
    true_shuffle: isEnabled("features.true_shuffle"),
    true_shuffle_mode: get("features.true_shuffle_mode", "native"),
    region_bypass: isEnabled("features.region_bypass"),
    proxy_url: get("features.proxy_url"),
    enhanced_header: isEnabled("features.enhanced_header"),
    collapsible_sidebar: isEnabled("features.collapsible_sidebar"),
    listenbrainz: isEnabled("integrations.listenbrainz.enabled"),
    listenbrainz_token: getSecure("integrations.listenbrainz.token"),
    lastfm: isEnabled("integrations.lastfm.enabled"),
    lastfm_api_key: getSecure("integrations.lastfm.api_key"),
    lastfm_secret: getSecure("integrations.lastfm.secret"),
    lastfm_session_key: getSecure("integrations.lastfm.session_key"),
    lastfm_username: get("integrations.lastfm.username"),
    load_last_page: isEnabled("features.load_last_page"),
    mpris: isEnabled("features.mpris"),
    stats_api_sync: statsApiOn,
    stats_local_tracking: statsLocalOn,
  };
}

function getActiveAccount() {
  return get("accounts.active", "main");
}

function setActiveAccount(name) {
  set("accounts.active", name);
}

module.exports = {
  CONFIG_DIR: DIR,
  CONFIG_FILE: FILE,
  get,
  set,
  getSecure,
  setSecure,
  getFile,
  setFile,
  isEnabled,
  initSecure,
  getActiveAccount,
  setActiveAccount,
  buildConfigPayload: buildPayload,
  get adblockEnabled() {
    return adblockOn;
  },
  set adblockEnabled(v) {
    adblockOn = v;
  },
  get statsApiSyncEnabled() {
    return statsApiOn;
  },
  set statsApiSyncEnabled(v) {
    statsApiOn = v;
  },
  get statsLocalTrackingEnabled() {
    return statsLocalOn;
  },
  set statsLocalTrackingEnabled(v) {
    statsLocalOn = v;
  },
};
