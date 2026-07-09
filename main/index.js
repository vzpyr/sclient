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
let mainWindow = null;
let isQuitting = false;

app.name = "sclient";
app.on("before-quit", () => {
	isQuitting = true;
});

function createWindow() {
	const hideDecorations = config.get("features.hide_decorations") === "true";
	const activeAccount = config.getActiveAccount();

	const partition =
		activeAccount === "main" ? "persist:main" : `persist:${activeAccount}`;
	const ses = session.fromPartition(partition);

	// expose for adblock toggle in ipc handlers
	global._activeSession = ses;
	global._blockerInstance = null;

	ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
		.then((blocker) => {
			global._blockerInstance = blocker;
			if (config.adblockEnabled) {
				blocker.enableBlockingInSession(ses);
			}
		})
		.catch((e) => {
			console.error("[SClient] Failed to initialize adblocker:", e);
		});

	// strip electron/chromium from UA
	const defaultUA = ses.getUserAgent();
	const cleanUA = defaultUA
		.replace(/Electron\/\S+\s?/, "")
		.replace(/sclient\/\S+\s?/, "")
		.replace(/SClient\/\S+\s?/, "");
	ses.setUserAgent(cleanUA);
	app.userAgentFallback = cleanUA;

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		frame: !hideDecorations,
		title: "SClient",
		icon: path.join(__dirname, "..", "assets", "tray.png"),
		webPreferences: {
			partition,
			preload: path.join(__dirname, "..", "preload.js"),
			contextIsolation: true,
		},
	});

	mainWindow.setMenu(null);

	mainWindow.on("page-title-updated", (e) => e.preventDefault());

	mainWindow.webContents.on("before-input-event", (event, input) => {
		if (input.key === "F12" && input.type === "keyDown") {
			mainWindow.webContents.toggleDevTools();
			event.preventDefault();
		}
	});

	mainWindow.loadURL("https://soundcloud.com");

	mainWindow.webContents.on("dom-ready", () => {
		const INJECT_FILES = [
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
		let injectedJs = INJECT_FILES.map((file) =>
			fs.readFileSync(path.join(injectedDir, file), "utf8"),
		).join("\n");

		// prepend Chart.js UMD
		const chartPath = path.join(
			__dirname,
			"..",
			"node_modules",
			"chart.js",
			"dist",
			"chart.umd.js",
		);
		injectedJs = fs.readFileSync(chartPath, "utf8") + "\n" + injectedJs;

		const configPayload = config.buildConfigPayload();

		const wrapperJs = `
(function() {
    window.__SCLIENT_CONFIG__ = ${JSON.stringify(configPayload)};
    ${injectedJs}
})();`;

		mainWindow.webContents.executeJavaScript(wrapperJs);
	});

	mainWindow.on("close", (e) => {
		const trayEnabled = config.get("features.tray_icon") === "true";
		if (!isQuitting && trayEnabled && tray) {
			e.preventDefault();
			mainWindow.hide();
		}
	});
}

app.whenReady().then(async () => {
	await components.whenReady();

	// register IPC handlers
	ipc.register({ ipcMain, session, app });

	createWindow();

	const trayEnabled = config.get("features.tray_icon") === "true";
	if (trayEnabled) {
		try {
			tray = new Tray(path.join(__dirname, "..", "assets", "tray.png"));
			const contextMenu = Menu.buildFromTemplate([
				{
					label: "Show",
					click: () => {
						mainWindow.show();
						mainWindow.focus();
					},
				},
				{
					label: "Previous",
					click: () =>
						mainWindow.webContents.executeJavaScript(
							"document.querySelector('.skipControl__previous').click();",
						),
				},
				{
					label: "Pause/Resume",
					click: () =>
						mainWindow.webContents.executeJavaScript(
							"document.querySelector('.playControl').click();",
						),
				},
				{
					label: "Next",
					click: () =>
						mainWindow.webContents.executeJavaScript(
							"document.querySelector('.skipControl__next').click();",
						),
				},
				{
					label: "Exit",
					click: () => {
						app.quit();
					},
				},
			]);
			tray.setToolTip("SClient");
			tray.setContextMenu(contextMenu);
			tray.on("click", () => {
				mainWindow.show();
				mainWindow.focus();
			});
		} catch (e) {
			console.error("[SClient] Failed to create tray:", e);
		}
	}
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
