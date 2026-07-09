const crypto = require("crypto");
const fetch = require("cross-fetch");
const { BrowserWindow } = require("electron");
const config = require("./config");
const rpc = require("./rpc");
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
	const apiKey = config.readSecureConfig("lastfm_api_key.conf").trim();
	const secret = config.readSecureConfig("lastfm_secret.conf").trim();
	const sk = config.readSecureConfig("lastfm_session_key.conf").trim();
	return { apiKey, secret, sk };
}

function register({ ipcMain, session, app }) {
	// proxy config (sync)
	ipcMain.on("get-proxy-config", (event) => {
		event.returnValue = {
			enabled: config.readConfig("region_bypass.conf") === "true",
			url: config.readConfig("proxy_url.conf"),
		};
	});

	// --- Settings ---

	ipcMain.handle("get_custom_files", () => config.buildConfigPayload());

	ipcMain.handle("save_custom_files", (_e, args) => {
		config.writeConfig("custom.css", args.css);
		config.writeConfig("custom.js", args.js);
		config.writeConfig("lazy_scroll.conf", args.lazyScroll ? "true" : "false");
		config.writeConfig(
			"hide_decorations.conf",
			args.hideDecorations ? "true" : "false",
		);
		config.writeConfig(
			"custom_accent.conf",
			args.customAccent ? "true" : "false",
		);
		config.writeConfig("accent_color.conf", args.accentColor || "#f50");
		config.writeConfig("wide_layout.conf", args.wideLayout ? "true" : "false");
		config.writeConfig(
			"wide_layout_width.conf",
			args.wideLayoutWidth ? args.wideLayoutWidth.toString() : "1200",
		);
		config.writeConfig(
			"oled_dark_mode.conf",
			args.oledDarkMode ? "true" : "false",
		);

		const oldAdblock = config.adblockEnabled;
		config.adblockEnabled = !!args.adblock;
		config.writeConfig("adblock.conf", args.adblock ? "true" : "false");

		// notify via global state if needed; blocker toggle handled in index.js
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

		config.writeConfig("discord_rpc.conf", args.discordRpc ? "true" : "false");
		config.writeConfig("tray_icon.conf", args.trayIcon ? "true" : "false");
		config.writeConfig("hide_upsell.conf", args.hideUpsell ? "true" : "false");
		config.writeConfig(
			"hide_artists.conf",
			args.hideArtists ? "true" : "false",
		);
		config.writeConfig(
			"true_shuffle.conf",
			args.true_shuffle || args.trueShuffle ? "true" : "false",
		);
		config.writeConfig(
			"true_shuffle_mode.conf",
			args.true_shuffle_mode || args.trueShuffleMode || "native",
		);
		config.writeConfig(
			"region_bypass.conf",
			args.regionBypass ? "true" : "false",
		);
		config.writeConfig("proxy_url.conf", args.proxyUrl || "");
		config.writeConfig(
			"enhanced_header.conf",
			args.enhancedHeader ? "true" : "false",
		);
		config.writeConfig(
			"collapsible_sidebar.conf",
			args.collapsibleSidebar ? "true" : "false",
		);
		config.writeConfig(
			"listenbrainz.conf",
			args.listenbrainz ? "true" : "false",
		);
		config.writeSecureConfig(
			"listenbrainz_token.conf",
			args.listenbrainzToken || "",
		);
		config.writeConfig("lastfm.conf", args.lastfm ? "true" : "false");
		config.writeSecureConfig("lastfm_api_key.conf", args.lastfmApiKey || "");
		config.writeSecureConfig("lastfm_secret.conf", args.lastfmSecret || "");
		config.statsApiSyncEnabled = args.statsApiSync || false;
		config.writeConfig(
			"stats_api_sync.conf",
			args.statsApiSync ? "true" : "false",
		);
		config.statsLocalTrackingEnabled = args.statsLocalTracking || false;
		config.writeConfig(
			"stats_local_tracking.conf",
			args.statsLocalTracking ? "true" : "false",
		);
	});

	// --- ListenBrainz ---

	ipcMain.handle("submit_listenbrainz", async (_e, args) => {
		try {
			const token = config.readSecureConfig("listenbrainz_token.conf").trim();
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
		const apiKey = config.readSecureConfig("lastfm_api_key.conf").trim();
		const secret = config.readSecureConfig("lastfm_secret.conf").trim();
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

			const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=https://soundcloud.com/discover`;
			authWin.loadURL(authUrl);

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
						config.writeSecureConfig(
							"lastfm_session_key.conf",
							data.session.key,
						);
						config.writeConfig("lastfm_username.conf", data.session.name);
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
		config.writeSecureConfig("lastfm_api_key.conf", args.apiKey || "");
		config.writeSecureConfig("lastfm_secret.conf", args.secret || "");
	});

	ipcMain.handle("lastfm_disconnect", () => {
		config.writeSecureConfig("lastfm_session_key.conf", "");
		config.writeConfig("lastfm_username.conf", "");
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
				throw new Error(
					"This track is DRM protected and cannot be downloaded.",
				);
			}
			if (err.stderr) {
				const errorLines = err.stderr
					.split("\n")
					.filter((line) => line.includes("ERROR:"));
				const cleanError =
					errorLines.length > 0
						? errorLines.join(" | ")
						: `Unknown youtube-dl error. (${err.stderr})`;
				throw new Error(cleanError);
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

	const path = require("path");
	const fs = require("fs");

	ipcMain.handle("get_active_account", () =>
		config.readConfig("active_account.conf", "main"),
	);
	ipcMain.handle("set_active_account", (_e, args) =>
		config.writeConfig("active_account.conf", args.name),
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
		const activeAccount = config.readConfig("active_account.conf", "main");
		const part =
			activeAccount === "main" ? `persist:main` : `persist:${activeAccount}`;
		await session.fromPartition(part).clearStorageData();
		return "done";
	});
	ipcMain.handle("clear_data_and_restart", async () => {
		const activeAccount = config.readConfig("active_account.conf", "main");
		const part =
			activeAccount === "main" ? `persist:main` : `persist:${activeAccount}`;
		await session.fromPartition(part).clearStorageData();
		app.relaunch({ args: [path.join(__dirname, "..")] });
		app.exit(0);
	});
}

module.exports = { register };
