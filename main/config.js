const path = require("path");
const fs = require("fs");
const { app, safeStorage } = require("electron");

const CONFIG_DIR = path.join(app.getPath("userData"), "SClient");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

if (!fs.existsSync(CONFIG_DIR)) {
	fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// --- JSON config store (nested, dot-notation access) ---

let _store = {};

if (fs.existsSync(CONFIG_FILE)) {
	try {
		_store = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
	} catch (e) {
		console.error("[SClient] Failed to parse config.json, starting fresh.");
	}
}

function _save() {
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(_store, null, 2));
}

function _resolve(key) {
	const parts = key.split(".");
	let val = _store;
	for (const part of parts) {
		if (val == null || typeof val !== "object") return undefined;
		val = val[part];
	}
	return val;
}

function _assign(key, val) {
	const parts = key.split(".");
	let obj = _store;
	for (let i = 0; i < parts.length - 1; i++) {
		if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") {
			obj[parts[i]] = {};
		}
		obj = obj[parts[i]];
	}
	obj[parts[parts.length - 1]] = val;
}

function get(key, defaultVal = "") {
	const val = _resolve(key);
	return val !== undefined && val !== null ? val : defaultVal;
}

function set(key, val) {
	_assign(key, val);
	_save();
}

function getSecure(key, defaultVal = "") {
	const raw = _resolve(key);
	if (raw === undefined || raw === null) return defaultVal;
	try {
		if (safeStorage.isEncryptionAvailable()) {
			const buf = Buffer.from(raw, "base64");
			return safeStorage.decryptString(buf);
		}
		return raw;
	} catch (e) {
		console.error("[SClient] Failed to decrypt:", key, e);
		return defaultVal;
	}
}

function setSecure(key, val) {
	try {
		if (safeStorage.isEncryptionAvailable()) {
			_assign(key, safeStorage.encryptString(val).toString("base64"));
		} else {
			_assign(key, val);
		}
		_save();
	} catch (e) {
		console.error("[SClient] Failed to encrypt:", key, e);
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

let adblockEnabled = get("features.adblock") === "true";
let statsApiSyncEnabled = get("stats.api_sync") === "true";
let statsLocalTrackingEnabled = get("stats.local_tracking") === "true";

// --- config payload sent to renderer (flat for injected code compatibility) ---

function buildConfigPayload() {
	return {
		css: getFile("custom.css"),
		js: getFile("custom.js"),
		// features
		lazy_scroll: get("features.lazy_scroll") === "true",
		hide_decorations: get("features.hide_decorations") === "true",
		custom_accent: get("features.custom_accent") === "true",
		accent_color: get("features.accent_color", "#FF0000"),
		wide_layout: get("features.wide_layout") === "true",
		wide_layout_width: get("features.wide_layout_width", "1200"),
		oled_dark_mode: get("features.oled_dark_mode") === "true",
		adblock: get("features.adblock") === "true",
		discord_rpc: get("features.discord_rpc") === "true",
		tray_icon: get("features.tray_icon") === "true",
		hide_upsell: get("features.hide_upsell") === "true",
		hide_artists: get("features.hide_artists") === "true",
		true_shuffle: get("features.true_shuffle") === "true",
		true_shuffle_mode: get("features.true_shuffle_mode", "native"),
		region_bypass: get("features.region_bypass") === "true",
		proxy_url: get("features.proxy_url"),
		enhanced_header: get("features.enhanced_header", "false") === "true",
		collapsible_sidebar: get("features.collapsible_sidebar") === "true",
		// integrations
		listenbrainz: get("integrations.listenbrainz.enabled") === "true",
		listenbrainz_token: getSecure("integrations.listenbrainz.token"),
		lastfm: get("integrations.lastfm.enabled") === "true",
		lastfm_api_key: getSecure("integrations.lastfm.api_key"),
		lastfm_secret: getSecure("integrations.lastfm.secret"),
		lastfm_session_key: getSecure("integrations.lastfm.session_key"),
		lastfm_username: get("integrations.lastfm.username"),
		// stats
		stats_api_sync: statsApiSyncEnabled,
		stats_local_tracking: statsLocalTrackingEnabled,
	};
}

// --- accounts ---

function getActiveAccount() {
	return get("accounts.active", "main");
}

function setActiveAccount(name) {
	set("accounts.active", name);
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
