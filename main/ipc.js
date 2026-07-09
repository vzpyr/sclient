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
		apiKey: config.getSecure("integrations.lastfm.api_key").trim(),
		secret: config.getSecure("integrations.lastfm.secret").trim(),
		sk: config.getSecure("integrations.lastfm.session_key").trim(),
	};
}

function register({ ipcMain, session, app }) {
	// proxy config (sync)
	ipcMain.on("get-proxy-config", (event) => {
		event.returnValue = {
			enabled: config.get("features.region_bypass") === "true",
			url: config.get("features.proxy_url"),
		};
	});

	// --- Settings ---

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
		config.set("features.wide_layout", args.wideLayout ? "true" : "false");
		config.set("features.wide_layout_width", args.wideLayoutWidth || "1200");
		config.set("features.oled_dark_mode", args.oledDarkMode ? "true" : "false");

		const oldAdblock = config.adblockEnabled;
		config.adblockEnabled = !!args.adblock;
		config.set("features.adblock", args.adblock ? "true" : "false");

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

	// --- ListenBrainz ---

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

	// --- Last.fm ---

	ipcMain.handle("lastfm_authenticate", async () => {
		const apiKey = config.getSecure("integrations.lastfm.api_key").trim();
		const secret = config.getSecure("integrations.lastfm.secret").trim();
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

			authWin.webContents.on("will-redirect", (_event, url) => handleUrl(url));
			authWin.webContents.on("will-navigate", (_event, url) => handleUrl(url));
			authWin.on("closed", () => settle({ error: "cancelled" }));
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
		} catch (e) {
			console.error("[SClient] Last.fm now playing error:", e);
			return { ok: false, code: 0, message: e.message };
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
		} catch (e) {
			console.error("[SClient] Last.fm scrobble error:", e);
			return { ok: false, code: 0, message: e.message };
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
		} catch (e) {
			console.error("[SClient] Download error:", e.message || e);
			if (e.stderr && e.stderr.includes("DRM protected")) {
				throw new Error(
					"This track is DRM protected and cannot be downloaded.",
				);
			}
			if (e.stderr) {
				const errorLines = e.stderr
					.split("\n")
					.filter((line) => line.includes("ERROR:"));
				throw new Error(
					errorLines.length > 0
						? errorLines.join(" | ")
						: `Unknown youtube-dl error. (${e.stderr})`,
				);
			}
			throw new Error(
				`Unknown download error occurred: ${e.message || e.toString()}`,
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
