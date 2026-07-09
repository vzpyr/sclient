const {
	app,
	components,
	BrowserWindow,
	session,
	Menu,
	Tray,
	ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const fetch = require("cross-fetch");
const { ElectronBlocker } = require("@ghostery/adblocker-electron");
const config = require("./config");
const ipc = require("./ipc");

let tray = null;
let win = null;
let isQuitting = false;

app.name = "sclient";
app.on("before-quit", () => {
	isQuitting = true;
});

function createWindow() {
	const hideFrame = config.isEnabled("features.hide_decorations");
	const account = config.getActiveAccount();
	const partition = account === "main" ? "persist:main" : `persist:${account}`;
	const ses = session.fromPartition(partition);

	global._session = ses;
	global._blocker = null;

	ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
		.then((blocker) => {
			global._blocker = blocker;
			if (config.adblockEnabled) blocker.enableBlockingInSession(ses);
		})
		.catch((e) =>
			console.error("[SClient] Failed to initialize adblocker:", e),
		);

	const cleanUA = ses
		.getUserAgent()
		.replace(/Electron\/\S+\s?/, "")
		.replace(/sclient\/\S+\s?/, "")
		.replace(/SClient\/\S+\s?/, "");
	ses.setUserAgent(cleanUA);
	app.userAgentFallback = cleanUA;

	win = new BrowserWindow({
		width: 1280,
		height: 800,
		frame: !hideFrame,
		title: "SClient",
		icon: path.join(__dirname, "..", "assets", "tray.png"),
		webPreferences: {
			partition,
			preload: path.join(__dirname, "..", "preload.js"),
			contextIsolation: true,
		},
	});

	win.setMenu(null);
	win.on("page-title-updated", (e) => e.preventDefault());

	win.webContents.on("before-input-event", (event, input) => {
		if (input.key === "F12" && input.type === "keyDown") {
			win.webContents.toggleDevTools();
			event.preventDefault();
		}
	});

	win.loadURL("https://soundcloud.com");

	win.webContents.on("dom-ready", () => {
		const files = [
			"core.js",
			"accent.js",
			"adblock.js",
			"shuffle.js",
			"rpc-bridge.js",
			"downloader.js",
			"lyrics.js",
			"scrobbler.js",
			"stats.js",
			"settings.js",
			"init.js",
		];

		const injectedDir = path.join(__dirname, "..", "injected");
		const injectedJs = files
			.map((f) => fs.readFileSync(path.join(injectedDir, f), "utf8"))
			.join("\n");

		const chartPath = path.join(
			__dirname,
			"..",
			"node_modules",
			"chart.js",
			"dist",
			"chart.umd.js",
		);
		const chartJs = fs.readFileSync(chartPath, "utf8");

		const payload = config.buildConfigPayload();

		win.webContents.executeJavaScript(`
(function() {
  window.__SCLIENT_CONFIG__ = ${JSON.stringify(payload)};
  ${chartJs}
  ${injectedJs}
})()`);
	});

	win.on("close", (e) => {
		if (!isQuitting && config.isEnabled("features.tray_icon") && tray) {
			e.preventDefault();
			win.hide();
		}
	});
}

app.whenReady().then(async () => {
	await components.whenReady();

	ipc.register({ ipcMain, session, app });

	createWindow();

	if (config.isEnabled("features.tray_icon")) {
		try {
			tray = new Tray(path.join(__dirname, "..", "assets", "tray.png"));
			tray.setToolTip("SClient");
			tray.setContextMenu(
				Menu.buildFromTemplate([
					{
						label: "Show",
						click: () => {
							win.show();
							win.focus();
						},
					},
					{
						label: "Previous",
						click: () =>
							win.webContents.executeJavaScript(
								"document.querySelector('.skipControl__previous').click()",
							),
					},
					{
						label: "Pause/Resume",
						click: () =>
							win.webContents.executeJavaScript(
								"document.querySelector('.playControl').click()",
							),
					},
					{
						label: "Next",
						click: () =>
							win.webContents.executeJavaScript(
								"document.querySelector('.skipControl__next').click()",
							),
					},
					{ label: "Exit", click: () => app.quit() },
				]),
			);
			tray.on("click", () => {
				win.show();
				win.focus();
			});
		} catch (e) {
			console.error("[SClient] Failed to create tray:", e);
		}
	}
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
