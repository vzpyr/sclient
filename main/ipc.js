const crypto = require("crypto");
const fetch = require("cross-fetch");
const path = require("path");
const fs = require("fs");
const { BrowserWindow, dialog } = require("electron");
const config = require("./config");
const rpc = require("./discord-rpc");
const stats = require("./stats");

function lastfmSig(params, secret) {
	const str =
		Object.keys(params)
			.sort()
			.map((k) => `${k}${params[k]}`)
			.join("") + secret;
	return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

function lastfmCreds() {
	return {
		apiKey: config.getSecure("integrations.lastfm.api_key").trim(),
		secret: config.getSecure("integrations.lastfm.secret").trim(),
		sk: config.getSecure("integrations.lastfm.session_key").trim(),
	};
}

async function lastfmCall(method, extra = {}) {
	try {
		const { apiKey, secret, sk } = lastfmCreds();
		if (!apiKey || !secret || !sk) return { ok: false, code: 0 };
		const params = { method, api_key: apiKey, sk, ...extra };
		const api_sig = lastfmSig(params, secret);
		const res = await fetch("https://ws.audioscrobbler.com/2.0/", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ ...params, api_sig, format: "json" }),
		});
		const data = await res.json();
		if (data.error)
			return { ok: false, code: data.error, message: data.message };
		return { ok: true };
	} catch (e) {
		console.error("[SClient] Last.fm error:", method, e);
		return { ok: false, code: 0, message: e.message };
	}
}

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

	ipcMain.handle("get_custom_files", () => config.buildConfigPayload());

	ipcMain.handle("save_custom_files", (_e, args) => {
		config.setFile("custom.css", args.css);
		config.setFile("custom.js", args.js);
		config.set("features.lazy_scroll", args.lazyScroll ? "true" : "false");
		config.set(
			"features.hide_decorations",
			args.hideDecorations ? "true" : "false",
		);
		config.set("features.custom_accent", args.customAccent ? "true" : "false");
		config.set("features.accent_color", args.accentColor || "#f50");
		config.set("features.custom_font", args.customFont ? "true" : "false");
		config.set("features.custom_font_family", args.customFontFamily || "");
		config.set("features.wide_layout", args.wideLayout ? "true" : "false");
		config.set("features.wide_layout_width", args.wideLayoutWidth || "1200");
		config.set("features.custom_bg_color", args.customBgColor ? "true" : "false");
		config.set("features.bg_color", args.bgColor || "#000000");

		const oldAdblock = config.adblockEnabled;
		config.adblockEnabled = !!args.adblock;
		config.set("features.adblock", args.adblock ? "true" : "false");

		if (
			oldAdblock !== config.adblockEnabled &&
			global._blocker &&
			global._session
		) {
			if (config.adblockEnabled)
				global._blocker.enableBlockingInSession(global._session);
			else global._blocker.disableBlockingInSession(global._session);
		}

		config.set("features.discord_rpc", args.discordRpc ? "true" : "false");
		config.set("features.tray_icon", args.trayIcon ? "true" : "false");
		config.set("features.hide_upsell", args.hideUpsell ? "true" : "false");
		config.set("features.hide_artists", args.hideArtists ? "true" : "false");
		config.set("features.true_shuffle", args.trueShuffle ? "true" : "false");
		config.set("features.true_shuffle_mode", args.trueShuffleMode || "native");
		config.set("features.region_bypass", args.regionBypass ? "true" : "false");
		config.set("features.proxy_url", args.proxyUrl || "");
		config.set(
			"features.enhanced_header",
			args.enhancedHeader ? "true" : "false",
		);
		config.set(
			"features.collapsible_sidebar",
			args.collapsibleSidebar ? "true" : "false",
		);
		config.set(
			"integrations.listenbrainz.enabled",
			args.listenbrainz ? "true" : "false",
		);
		config.setSecure(
			"integrations.listenbrainz.token",
			args.listenbrainzToken || "",
		);
		config.set("integrations.lastfm.enabled", args.lastfm ? "true" : "false");
		config.setSecure("integrations.lastfm.api_key", args.lastfmApiKey || "");
		config.setSecure("integrations.lastfm.secret", args.lastfmSecret || "");

		config.statsApiSyncEnabled = args.statsApiSync || false;
		config.set("stats.api_sync", args.statsApiSync ? "true" : "false");
		config.statsLocalTrackingEnabled = args.statsLocalTracking || false;
		config.set(
			"stats.local_tracking",
			args.statsLocalTracking ? "true" : "false",
		);
	});

	ipcMain.handle("submit_listenbrainz", async (_e, args) => {
		try {
			const token = config.getSecure("integrations.listenbrainz.token").trim();
			if (!token) return { ok: false, code: 0 };
			const res = await fetch("https://api.listenbrainz.org/1/submit-listens", {
				method: "POST",
				headers: {
					Authorization: `Token ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(args),
			});
			const data = await res.json();
			if (data.code) return { ok: false, code: data.code, message: data.error };
			return { ok: true };
		} catch (e) {
			console.error("[SClient] Listenbrainz submit error:", e);
			return { ok: false, code: 0, message: e.message };
		}
	});

	ipcMain.handle("lastfm_authenticate", async () => {
		const apiKey = config.getSecure("integrations.lastfm.api_key").trim();
		const secret = config.getSecure("integrations.lastfm.secret").trim();
		if (!apiKey || !secret) return { error: "Missing API key or secret" };

		return new Promise((resolve) => {
			let settled = false;
			const settle = (v) => {
				if (!settled) {
					settled = true;
					resolve(v);
				}
			};

			const win = new BrowserWindow({
				width: 850,
				height: 650,
				title: "Connect Last.fm",
				webPreferences: { nodeIntegration: false, contextIsolation: true },
			});

			win.loadURL(
				`https://www.last.fm/api/auth/?api_key=${apiKey}&cb=https://soundcloud.com/discover`,
			);

			const handle = async (url) => {
				try {
					const token = new URL(url).searchParams.get("token");
					if (!token) return;
					const sig = lastfmSig(
						{ method: "auth.getSession", api_key: apiKey, token },
						secret,
					);
					const res = await fetch(
						`https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${sig}&format=json`,
					);
					const data = await res.json();
					if (!win.isDestroyed()) win.close();
					if (data.error) {
						settle({ error: data.message });
					} else {
						config.setSecure(
							"integrations.lastfm.session_key",
							data.session.key,
						);
						config.set("integrations.lastfm.username", data.session.name);
						settle({ success: true, username: data.session.name });
					}
				} catch (e) {
					console.error("[SClient] Last.fm auth error:", e);
					settle({ error: e.message });
				}
			};

			win.webContents.on("will-redirect", (_e, url) => handle(url));
			win.webContents.on("will-navigate", (_e, url) => handle(url));
			win.on("closed", () => settle({ error: "cancelled" }));
		});
	});

	ipcMain.handle("lastfm_save_credentials", (_e, args) => {
		config.setSecure("integrations.lastfm.api_key", args.apiKey || "");
		config.setSecure("integrations.lastfm.secret", args.secret || "");
	});

	ipcMain.handle("lastfm_disconnect", () => {
		config.setSecure("integrations.lastfm.session_key", "");
		config.set("integrations.lastfm.username", "");
	});

	ipcMain.handle("lastfm_now_playing", async (_e, args) => {
		return lastfmCall("track.updateNowPlaying", {
			artist: args.artist,
			track: args.title,
		});
	});

	ipcMain.handle("lastfm_scrobble", async (_e, args) => {
		return lastfmCall("track.scrobble", {
			artist: args.artist,
			track: args.title,
			timestamp: args.timestamp.toString(),
		});
	});

	ipcMain.handle("stats_store_credentials", async (_e, args) => {
		stats.storeCredentials(args.clientId, args.oauthToken);
	});

	ipcMain.handle("stats_record_listen", (_e, args) => {
		stats.recordListen(args.played_at, args.track_id, args.track);
	});

	ipcMain.handle("stats_get_data", (_e, args) => {
		return stats.getData(args && args.source);
	});

	ipcMain.handle("stats_wipe_db", () => {
		stats.wipeDb();
	});

	ipcMain.handle("stats_export_db", async (_e) => {
		const res = await dialog.showSaveDialog({
			title: "Export Stats Database",
			defaultPath: "soundcloud-stats.db",
			filters: [{ name: "Database", extensions: ["db", "sqlite", "sqlite3"] }]
		});
		if (res.canceled) throw new Error("cancelled");
		stats.exportDb(res.filePath);
	});

	ipcMain.handle("stats_pick_import_file", async () => {
		const res = await dialog.showOpenDialog({
			title: "Import Stats Database",
			filters: [{ name: "Database", extensions: ["db", "sqlite", "sqlite3"] }],
			properties: ['openFile']
		});
		if (res.canceled || res.filePaths.length === 0) return null;
		return res.filePaths[0];
	});

	ipcMain.handle("stats_execute_import", async (_e, args) => {
		stats.importDb(args.filePath, args.overwrite);
	});

	const ytdlexec = require("youtube-dl-exec");
	let ytdlBin = ytdlexec.constants.YOUTUBE_DL_PATH;
	if (ytdlBin.includes("app.asar"))
		ytdlBin = ytdlBin.replace("app.asar", "app.asar.unpacked");
	const ytdl = ytdlexec.create(ytdlBin);

	ipcMain.handle("download_song", async (_e, args) => {
		return new Promise((resolve, reject) => {
			const proc = ytdl.exec(args.url, {
				extractAudio: true,
				audioFormat: "best",
				noWarnings: true,
				paths: app.getPath("downloads"),
			});

			let stdoutBuf = "";
			proc.stdout.on("data", (data) => {
				stdoutBuf += data.toString();
				const parts = stdoutBuf.split(/[\r\n]+/);
				stdoutBuf = parts.pop();
				for (const part of parts) {
					const match = part.match(/\[download\]\s+([\d\.]+)%/);
					if (match && match[1]) {
						_e.sender.send("download_progress", { url: args.url, percent: match[1] });
					}
				}

				const matchEnd = stdoutBuf.match(/\[download\]\s+([\d\.]+)%/);
				if (matchEnd && matchEnd[1]) {
					_e.sender.send("download_progress", { url: args.url, percent: matchEnd[1] });
				}
			});

			let stderr = "";
			proc.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			proc.on("close", (code) => {
				if (code === 0) {
					resolve();
				} else {
					if (stderr.includes("DRM protected")) {
						reject(new Error("This track is DRM protected and cannot be downloaded."));
					} else {
						const lines = stderr.split("\n").filter((l) => l.includes("ERROR:"));
						reject(new Error(lines.length > 0 ? lines.join(" | ") : `Unknown youtube-dl error. (${stderr})`));
					}
				}
			});

			proc.on("error", (err) => {
				reject(new Error(`Unknown download error: ${err.message || err.toString()}`));
			});
		});
	});

	ipcMain.handle("update_rpc", async (_e, args) => {
		await rpc.updateRpc(args);
	});

	ipcMain.handle("get_active_account", () => config.getActiveAccount());
	ipcMain.handle("set_active_account", (_e, args) =>
		config.setActiveAccount(args.name),
	);

	ipcMain.handle("get_accounts", () => {
		const dir = path.join(app.getPath("userData"), "Partitions");
		if (!fs.existsSync(dir)) return ["main"];
		const accs = [
			"main",
			...fs
				.readdirSync(dir)
				.filter((f) => fs.statSync(path.join(dir, f)).isDirectory()),
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
		app.relaunch({ args: [path.join(__dirname, "..")] });
		app.exit(0);
	});

	ipcMain.handle("clear_data", async () => {
		await session
			.fromPartition(partitionName(config.getActiveAccount()))
			.clearStorageData();
		return "done";
	});

	ipcMain.handle("clear_data_and_restart", async () => {
		await session
			.fromPartition(partitionName(config.getActiveAccount()))
			.clearStorageData();
		app.relaunch({ args: [path.join(__dirname, "..")] });
		app.exit(0);
	});
}

module.exports = { register };
