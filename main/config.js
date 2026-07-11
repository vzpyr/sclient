const path = require("path");
const fs = require("fs");
const { app, safeStorage } = require("electron");

const DIR = path.join(app.getPath("userData"), "SClient");
const FILE = path.join(DIR, "config.json");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

let store = {};

if (fs.existsSync(FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    console.error("[SClient] Failed to parse config.json, starting fresh.");
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
  const raw = resolvePath(key);
  if (raw === undefined || raw === null) return fallback;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(raw, "base64"));
    }
    return raw;
  } catch (e) {
    console.error("[SClient] Failed to decrypt:", key, e);
    return fallback;
  }
}

function setSecure(key, val) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      assignPath(key, safeStorage.encryptString(val).toString("base64"));
    } else {
      assignPath(key, val);
    }
    save();
  } catch (e) {
    console.error("[SClient] Failed to encrypt:", key, e);
  }
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
    hide_decorations: isEnabled("features.hide_decorations"),
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
