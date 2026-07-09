const path = require("path");
const fs = require("fs");
const { app, safeStorage } = require("electron");

const CONFIG_DIR = path.join(app.getPath("userData"), "SClient");

if (!fs.existsSync(CONFIG_DIR)) {
	fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readConfig(name, defaultVal = "") {
	const p = path.join(CONFIG_DIR, name);
	if (!fs.existsSync(p)) return defaultVal;
	return fs.readFileSync(p, "utf8");
}

function writeConfig(name, val) {
	fs.writeFileSync(path.join(CONFIG_DIR, name), val);
}

function readSecureConfig(name, defaultVal = "") {
	const p = path.join(CONFIG_DIR, name);
	if (!fs.existsSync(p)) return defaultVal;
	try {
		const buffer = fs.readFileSync(p);
		if (safeStorage.isEncryptionAvailable()) {
			return safeStorage.decryptString(buffer);
		}
		return buffer.toString("utf8");
	} catch (e) {
		console.error("[SClient] Failed to read secure config", e);
		return defaultVal;
	}
}

function writeSecureConfig(name, val) {
	const p = path.join(CONFIG_DIR, name);
	try {
		if (safeStorage.isEncryptionAvailable()) {
			fs.writeFileSync(p, safeStorage.encryptString(val));
		} else {
			fs.writeFileSync(p, val);
		}
	} catch (e) {
		console.error("[SClient] Failed to write secure config", e);
	}
}

// state read from disk once at startup
let adblockEnabled = readConfig("adblock.conf") === "true";
let discordRpcEnabled = readConfig("discord_rpc.conf") === "true";
let trayIconEnabled = readConfig("tray_icon.conf") === "true";
let statsApiSyncEnabled = readConfig("stats_api_sync.conf") === "true";
let statsLocalTrackingEnabled =
	readConfig("stats_local_tracking.conf") === "true";

const DEFAULT_CSS = "";
const DEFAULT_JS = "";

if (!fs.existsSync(path.join(CONFIG_DIR, "custom.css"))) {
	writeConfig("custom.css", DEFAULT_CSS);
}
if (!fs.existsSync(path.join(CONFIG_DIR, "custom.js"))) {
	writeConfig("custom.js", DEFAULT_JS);
}

function buildConfigPayload() {
	return {
		css: readConfig("custom.css"),
		js: readConfig("custom.js"),
		lazy_scroll: readConfig("lazy_scroll.conf") === "true",
		hide_decorations: readConfig("hide_decorations.conf") === "true",
		custom_accent: readConfig("custom_accent.conf") === "true",
		accent_color: readConfig("accent_color.conf", "#FF0000"),
		wide_layout: readConfig("wide_layout.conf") === "true",
		wide_layout_width: readConfig("wide_layout_width.conf", "1200"),
		oled_dark_mode: readConfig("oled_dark_mode.conf") === "true",
		adblock: readConfig("adblock.conf") === "true",
		discord_rpc: readConfig("discord_rpc.conf") === "true",
		tray_icon: readConfig("tray_icon.conf") === "true",
		hide_upsell: readConfig("hide_upsell.conf") === "true",
		hide_artists: readConfig("hide_artists.conf") === "true",
		true_shuffle: readConfig("true_shuffle.conf") === "true",
		true_shuffle_mode: readConfig("true_shuffle_mode.conf", "native"),
		region_bypass: readConfig("region_bypass.conf") === "true",
		proxy_url: readConfig("proxy_url.conf"),
		enhanced_header: readConfig("enhanced_header.conf", "true") === "true",
		collapsible_sidebar: readConfig("collapsible_sidebar.conf") === "true",
		listenbrainz: readConfig("listenbrainz.conf") === "true",
		listenbrainz_token: readSecureConfig("listenbrainz_token.conf"),
		lastfm: readConfig("lastfm.conf") === "true",
		lastfm_api_key: readSecureConfig("lastfm_api_key.conf"),
		lastfm_secret: readSecureConfig("lastfm_secret.conf"),
		lastfm_session_key: readSecureConfig("lastfm_session_key.conf"),
		lastfm_username: readConfig("lastfm_username.conf"),
		stats_api_sync: statsApiSyncEnabled,
		stats_local_tracking: statsLocalTrackingEnabled,
	};
}

module.exports = {
	CONFIG_DIR,
	readConfig,
	writeConfig,
	readSecureConfig,
	writeSecureConfig,
	buildConfigPayload,
	get adblockEnabled() {
		return adblockEnabled;
	},
	set adblockEnabled(v) {
		adblockEnabled = v;
	},
	get discordRpcEnabled() {
		return discordRpcEnabled;
	},
	set discordRpcEnabled(v) {
		discordRpcEnabled = v;
	},
	get trayIconEnabled() {
		return trayIconEnabled;
	},
	set trayIconEnabled(v) {
		trayIconEnabled = v;
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
