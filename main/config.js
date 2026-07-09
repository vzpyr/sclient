const path = require("path");
const fs = require("fs");
const { app, safeStorage } = require("electron");

const CONFIG_DIR = path.join(app.getPath("userData"), "SClient");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

if (!fs.existsSync(CONFIG_DIR)) {
	fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// --- JSON config store ---

let _store = {};

if (fs.existsSync(CONFIG_FILE)) {
	try {
		_store = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
	} catch (e) {
		console.error("[SClient] Failed to parse config.json, starting fresh");
	}
}

function _save() {
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(_store, null, 2));
}

function get(key, defaultVal = "") {
	return key in _store ? _store[key] : defaultVal;
}

function set(key, val) {
	_store[key] = val;
	_save();
}

function getSecure(key, defaultVal = "") {
	if (!(key in _store)) return defaultVal;
	try {
		if (safeStorage.isEncryptionAvailable()) {
			const buf = Buffer.from(_store[key], "base64");
			return safeStorage.decryptString(buf);
		}
		return _store[key];
	} catch (e) {
		console.error("[SClient] Failed to decrypt", key, e);
		return defaultVal;
	}
}

function setSecure(key, val) {
	try {
		if (safeStorage.isEncryptionAvailable()) {
			_store[key] = safeStorage.encryptString(val).toString("base64");
		} else {
			_store[key] = val;
		}
		_save();
	} catch (e) {
		console.error("[SClient] Failed to encrypt", key, e);
	}
}

// --- css / js are stored as separate files (content, not config) ---

function getFile(name) {
	const p = path.join(CONFIG_DIR, name);
	return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function setFile(name, val) {
	fs.writeFileSync(path.join(CONFIG_DIR, name), val);
}

if (!fs.existsSync(path.join(CONFIG_DIR, "custom.css"))) {
	setFile("custom.css", "");
}
if (!fs.existsSync(path.join(CONFIG_DIR, "custom.js"))) {
	setFile("custom.js", "");
}

// --- runtime state (synced to disk but also held in memory for performance) ---

let adblockEnabled = get("adblock") === "true";
let statsApiSyncEnabled = get("stats_api_sync") === "true";
let statsLocalTrackingEnabled = get("stats_local_tracking") === "true";

// --- config payload sent to renderer ---

function buildConfigPayload() {
	return {
		css: getFile("custom.css"),
		js: getFile("custom.js"),
		lazy_scroll: get("lazy_scroll") === "true",
		hide_decorations: get("hide_decorations") === "true",
		custom_accent: get("custom_accent") === "true",
		accent_color: get("accent_color", "#FF0000"),
		wide_layout: get("wide_layout") === "true",
		wide_layout_width: get("wide_layout_width", "1200"),
		oled_dark_mode: get("oled_dark_mode") === "true",
		adblock: get("adblock") === "true",
		discord_rpc: get("discord_rpc") === "true",
		tray_icon: get("tray_icon") === "true",
		hide_upsell: get("hide_upsell") === "true",
		hide_artists: get("hide_artists") === "true",
		true_shuffle: get("true_shuffle") === "true",
		true_shuffle_mode: get("true_shuffle_mode", "native"),
		region_bypass: get("region_bypass") === "true",
		proxy_url: get("proxy_url"),
		enhanced_header: get("enhanced_header", "false") === "true",
		collapsible_sidebar: get("collapsible_sidebar") === "true",
		listenbrainz: get("listenbrainz") === "true",
		listenbrainz_token: getSecure("listenbrainz_token"),
		lastfm: get("lastfm") === "true",
		lastfm_api_key: getSecure("lastfm_api_key"),
		lastfm_secret: getSecure("lastfm_secret"),
		lastfm_session_key: getSecure("lastfm_session_key"),
		lastfm_username: get("lastfm_username"),
		stats_api_sync: statsApiSyncEnabled,
		stats_local_tracking: statsLocalTrackingEnabled,
	};
}

// --- accounts (uses separate files for partition dirs — legit use case) ---

function getActiveAccount() {
	return get("active_account", "main");
}

function setActiveAccount(name) {
	set("active_account", name);
}

module.exports = {
	CONFIG_DIR,
	CONFIG_FILE,
	get,
	set,
	getSecure,
	setSecure,
	getFile,
	setFile,
	getActiveAccount,
	setActiveAccount,
	buildConfigPayload,
	get adblockEnabled() {
		return adblockEnabled;
	},
	set adblockEnabled(v) {
		adblockEnabled = v;
	},
	get statsApiSyncEnabled() {
		return statsApiSyncEnabled;
	},
	set statsApiSyncEnabled(v) {
		statsApiSyncEnabled = v;
	},
	get statsLocalTrackingEnabled() {
		return statsLocalTrackingEnabled;
	},
	set statsLocalTrackingEnabled(v) {
		statsLocalTrackingEnabled = v;
	},
};
