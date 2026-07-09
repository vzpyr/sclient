const crypto = require("crypto");
const fetch = require("cross-fetch");
const path = require("path");
const fs = require("fs");
const { BrowserWindow } = require("electron");
const config = require("./config");
const rpc = require("./discord-rpc");
const stats = require("./stats");

// --- Last.fm helpers ---

function generateLastFmSig(params, secret) {
	const str =
		Object.keys(params)
			.sort()
			.map((k) => `${k}${params[k]}`)
			.join("") + secret;
	return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

function getLastFmCreds() {
	return {
		apiKey: config.getSecure("lastfm_api_key").trim(),
		secret: config.getSecure("lastfm_secret").trim(),
		sk: config.getSecure("lastfm_session_key").trim(),
	};
}

function register({ ipcMain, session, app }) {
	// proxy config (sync)
	ipcMain.on("get-proxy-config", (event) => {
		event.returnValue = {
			enabled: config.get("region_bypass") === "true",
			url: config.get("proxy_url"),
		};
	});

	// --- Settings ---

	ipcMain.handle("get_custom_files", () => config.buildConfigPayload());

	ipcMain.handle("save_custom_files", (_e, args) => {
		config.setFile("custom.css", args.css);
		config.setFile("custom.js", args.js);
		config.set("lazy_scroll", args.lazyScroll ? "true" : "false");
		config.set("hide_decorations", args.hideDecorations ? "true" : "false");
		config.set("custom_accent", args.customAccent ? "true" : "false");
		config.set("accent_color", args.accentColor || "#f50");
		config.set("wide_layout", args.wideLayout ? "true" : "false");
		config.set("wide_layout_width", args.wideLayoutWidth || "1200");
		config.set("oled_dark_mode", args.oledDarkMode ? "true" : "false");

		const oldAdblock = config.adblockEnabled;
		config.adblockEnabled = !!args.adblock;
		config.set("adblock", args.adblock ? "true" : "false");

		if (
			oldAdblock !== config.adblockEnabled &&
			global._blockerInstance &&
			global._activeSession
		) {
			if (config.adblockEnabled) {
				global._blockerInstance.enableBlockingInSession(global._activeSession);
			} else {
				global._blockerInstance.disableBlockingInSession(global._activeSession);
			}
		}

		config.set("discord_rpc", args.discordRpc ? "true" : "false");
		config.set("tray_icon", args.trayIcon ? "true" : "false");
		config.set("hide_upsell", args.hideUpsell ? "true" : "false");
		config.set("hide_artists", args.hideArtists ? "true" : "false");
		config.set("true_shuffle", (args.true_shuffle || args.trueShuffle) ? "true" : "false");
		config.set("true_shuffle_mode", args.true_shuffle_mode || args.trueShuffleMode || "native");
		config.set("region_bypass", args.regionBypass ? "true" : "false");
		config.set("proxy_url", args.proxyUrl || "");
		config.set("enhanced_header", args.enhancedHeader ? "true" : "false");
		config.set("collapsible_sidebar", args.collapsibleSidebar ? "true" : "false");
		config.set("listenbrainz", args.listenbrainz ? "true" : "false");
		config.setSecure("listenbrainz_token", args.listenbrainzToken || "");
		config.set("lastfm", args.lastfm ? "true" : "false");
		config.setSecure("lastfm_api_key", args.lastfmApiKey || "");
		config.setSecure("lastfm_secret", args.lastfmSecret || "");

		config.statsApiSyncEnabled = args.statsApiSync || false;
		config.set("stats_api_sync", args.statsApiSync ? "true" : "false");
		config.statsLocalTrackingEnabled = args.statsLocalTracking || false;
		config.set("stats_local_tracking", args.statsLocalTracking ? "true" : "false");
	});

	// --- ListenBrainz ---

	ipcMain.handle("submit_listenbrainz", async (_e, args) => {
		try {
			const token = config.getSecure("listenbrainz_token").trim();
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
		} catch (err) {
			console.error("[SClient] Listenbrainz submit error:", err);
			return { ok: false, code: 0, message: err.message };
		}
	});

	// --- Last.fm ---

	ipcMain.handle("lastfm_authenticate", async () => {
		const apiKey = config.getSecure("lastfm_api_key").trim();
		const secret = config.getSecure("lastfm_secret").trim();
		if (!apiKey || !secret) return { error: "Missing API key or secret" };

		return new Promise((resolve) => {
			let settled = false;
			const settle = (value) => {
				if (settled) return;
				settled = true;
				resolve(value);
			};

			const authWin = new BrowserWindow({
				width: 850,
				height: 650,
				title: "Connect Last.fm",
				webPreferences: { nodeIntegration: false, contextIsolation: true },
			});

			authWin.loadURL(
				`https://www.last.fm/api/auth/?api_key=${apiKey}&cb=https://soundcloud.com/discover`,
			);

			const handleUrl = async (url) => {
				try {
					const urlObj = new URL(url);
					const token = urlObj.searchParams.get("token");
					if (!token) return;
					const sig = generateLastFmSig(
						{ method: "auth.getSession", api_key: apiKey, token },
						secret,
					);
					const res = await fetch(
						`https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${sig}&format=json`,
					);
					const data = await res.json();
					if (!authWin.isDestroyed()) authWin.close();
					if (data.error) {
						settle({ error: data.message });
					} else {
						config.setSecure("lastfm_session_key", data.session.key);
						config.set("lastfm_username", data.session.name);
						settle({ success: true, username: data.session.name });
					}
				} catch (err) {
					settle({ error: err.message });
				}
			};

			authWin.webContents.on("will-redirect", (_event, url) => handleUrl(url));
			authWin.webContents.on("will-navigate", (_event, url) => handleUrl(url));
			authWin.on("closed", () => settle({ error: "cancelled" }));
		});
	});

	ipcMain.handle("lastfm_save_credentials", (_e, args) => {
		config.setSecure("lastfm_api_key", args.apiKey || "");
		config.setSecure("lastfm_secret", args.secret || "");
	});

	ipcMain.handle("lastfm_disconnect", () => {
		config.setSecure("lastfm_session_key", "");
		config.set("lastfm_username", "");
	});

	ipcMain.handle("lastfm_now_playing", async (_e, args) => {
		try {
			const { apiKey, secret, sk } = getLastFmCreds();
			if (!apiKey || !secret || !sk) return { ok: false, code: 0 };
			const params = {
				method: "track.updateNowPlaying",
				api_key: apiKey,
				sk,
				artist: args.artist,
				track: args.title,
			};
			const api_sig = generateLastFmSig(params, secret);
			const res = await fetch("https://ws.audioscrobbler.com/2.0/", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ ...params, api_sig, format: "json" }),
			});
			const data = await res.json();
			if (data.error)
				return { ok: false, code: data.error, message: data.message };
			return { ok: true };
		} catch (err) {
			console.error("[SClient] Last.fm now playing error:", err);
			return { ok: false, code: 0, message: err.message };
		}
	});

	ipcMain.handle("lastfm_scrobble", async (_e, args) => {
		try {
			const { apiKey, secret, sk } = getLastFmCreds();
			if (!apiKey || !secret || !sk) return { ok: false, code: 0 };
			const params = {
				method: "track.scrobble",
				api_key: apiKey,
				sk,
				artist: args.artist,
				track: args.title,
				timestamp: args.timestamp.toString(),
			};
			const api_sig = generateLastFmSig(params, secret);
			const res = await fetch("https://ws.audioscrobbler.com/2.0/", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ ...params, api_sig, format: "json" }),
			});
			const data = await res.json();
			if (data.error)
				return { ok: false, code: data.error, message: data.message };
			return { ok: true };
		} catch (err) {
			console.error("[SClient] Last.fm scrobble error:", err);
			return { ok: false, code: 0, message: err.message };
		}
	});

	// --- Stats ---

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

	// --- Download ---

	const ytdlexec = require("youtube-dl-exec");
	let ytdlBin = ytdlexec.constants.YOUTUBE_DL_PATH;
	if (ytdlBin.includes("app.asar"))
		ytdlBin = ytdlBin.replace("app.asar", "app.asar.unpacked");
	const ytdlExec = ytdlexec.create(ytdlBin);

	ipcMain.handle("download_song", async (_e, args) => {
		const dlDir = app.getPath("downloads");
		try {
			await ytdlExec(args.url, {
				extractAudio: true,
				audioFormat: "best",
				noProgress: true,
				noWarnings: true,
				paths: dlDir,
			});
		} catch (err) {
			if (err.stderr && err.stderr.includes("DRM protected")) {
				throw new Error("This track is DRM protected and cannot be downloaded.");
			}
			if (err.stderr) {
				const errorLines = err.stderr
					.split("\n")
					.filter((line) => line.includes("ERROR:"));
				throw new Error(
					errorLines.length > 0
						? errorLines.join(" | ")
						: `Unknown youtube-dl error. (${err.stderr})`,
				);
			}
			throw new Error(
				`Unknown download error occurred: ${err.message || err.toString()}`,
			);
		}
	});

	// --- RPC ---

	ipcMain.handle("update_rpc", async (_e, args) => {
		await rpc.updateRpc(args);
	});

	// --- Accounts ---

	ipcMain.handle("get_active_account", () => config.getActiveAccount());
	ipcMain.handle("set_active_account", (_e, args) =>
		config.setActiveAccount(args.name),
	);
	ipcMain.handle("get_accounts", () => {
		const partitionsDir = path.join(app.getPath("userData"), "Partitions");
		if (!fs.existsSync(partitionsDir)) return ["main"];
		const accs = [
			"main",
			...fs
				.readdirSync(partitionsDir)
				.filter((f) => fs.statSync(path.join(partitionsDir, f)).isDirectory()),
		];
		return [...new Set(accs)];
	});
	ipcMain.handle("create_account", (_e, args) => {
		fs.mkdirSync(path.join(app.getPath("userData"), "Partitions", args.name), {
			recursive: true,
		});
	});
	ipcMain.handle("delete_account", (_e, args) => {
		const partitionDir = path.join(
			app.getPath("userData"),
			"Partitions",
			args.name,
		);
		if (fs.existsSync(partitionDir))
			fs.rmSync(partitionDir, { recursive: true, force: true });
	});
	ipcMain.handle("restart_app", () => {
		app.relaunch({ args: [path.join(__dirname, "..")] });
		app.exit(0);
	});
	ipcMain.handle("clear_data", async () => {
		const activeAccount = config.getActiveAccount();
		const part =
			activeAccount === "main" ? `persist:main` : `persist:${activeAccount}`;
		await session.fromPartition(part).clearStorageData();
		return "done";
	});
	ipcMain.handle("clear_data_and_restart", async () => {
		const activeAccount = config.getActiveAccount();
		const part =
			activeAccount === "main" ? `persist:main` : `persist:${activeAccount}`;
		await session.fromPartition(part).clearStorageData();
		app.relaunch({ args: [path.join(__dirname, "..")] });
		app.exit(0);
	});
}

module.exports = { register };
