function injectStyle(id, css) {
	if (document.getElementById(id)) return;
	const style = document.createElement("style");
	style.id = id;
	style.textContent = css;
	if (document.head) {
		document.head.appendChild(style);
	} else {
		document.addEventListener("DOMContentLoaded", () => {
			if (!document.getElementById(id)) document.head.appendChild(style);
		});
	}
}

injectStyle(
	"sclient-scrollbar",
	`
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.4); border-radius: 6px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.7); }
  * { scrollbar-width: thin; scrollbar-color: rgba(128, 128, 128, 0.4) transparent; }
`,
);

injectStyle(
	"sclient-light-theme-overlays",
	`
  body.theme-light #sclient-settings-overlay,
  body.theme-light #sclient-lyrics-sidebar {
    background: rgba(250, 250, 250, 0.95) !important;
    color: #222 !important;
    border-left: 1px solid rgba(0,0,0,0.1) !important;
  }
  body.theme-light #sclient-lyrics-content { color: #444 !important; }
  body.theme-light #sclient-settings-scroll > div[style*="justify-content: space-between"] {
    background: rgba(0,0,0,0.05) !important;
    border-color: rgba(0,0,0,0.1) !important;
  }
  body.theme-light #sclient-accounts-list > div {
    background: rgba(0,0,0,0.05) !important;
    border: 1px solid rgba(0,0,0,0.1) !important;
  }
  body.theme-light #sclient-add-account-btn,
  body.theme-light #sclient-accounts-list button {
    background: #eee !important; color: #333 !important;
    border: 1px solid #ddd !important;
  }
  body.theme-light button#tab-css[style*="rgb(51, 51, 51)"],
  body.theme-light button#tab-css[style*="#333"],
  body.theme-light button#tab-js[style*="rgb(51, 51, 51)"],
  body.theme-light button#tab-js[style*="#333"] {
    background: #eee !important; color: #111 !important;
  }
  body.theme-light input[type="text"],
  body.theme-light textarea:not(#sclient-css-editor):not(#sclient-js-editor) {
    background: #fff !important; color: #333 !important;
    border: 1px solid #ccc !important;
  }
  body.theme-light #sclient-css-container,
  body.theme-light #sclient-js-container {
    border-top: 1px solid rgba(0,0,0,0.1) !important;
  }
  body.theme-light #sclient-trueshuffle-engine,
  body.theme-light #sclient-proxyurl-input {
    background: #fff !important; color: #333 !important;
    border: 1px solid #ccc !important;
  }
  body.theme-light #sclient-trueshuffle-engine option {
    background: #fff; color: #333;
  }
`,
);

const cfg = window.__SCLIENT_CONFIG__ || {};
const customAccentOn = cfg.custom_accent || false;
const accentColor = cfg.accent_color || "#FF0000";
const lazyScrollOn = cfg.lazy_scroll || false;
const hideDecorationsOn = cfg.hide_decorations || false;
const wideLayoutOn = cfg.wide_layout || false;
const wideLayoutWidth = cfg.wide_layout_width || "1200";
const collapsibleSidebarOn = cfg.collapsible_sidebar || false;
const oledDarkOn = cfg.oled_dark_mode || false;
const currentCss = cfg.css || "";
const currentJs = cfg.js || "";
const adblockOn = cfg.adblock || false;
const trueShuffleOn = cfg.true_shuffle || false;
const trueShuffleMode = cfg.true_shuffle_mode || "native";
const discordRpcOn = cfg.discord_rpc || false;
const hideUpsellOn = cfg.hide_upsell || false;
const hideArtistsOn = cfg.hide_artists || false;
const regionBypassOn = cfg.region_bypass || false;
const proxyUrl = cfg.proxy_url || "";
const enhancedHeaderOn = cfg.enhanced_header || false;
const listenbrainzOn = cfg.listenbrainz || false;
const listenbrainzToken = cfg.listenbrainz_token || "";
const lastfmOn = cfg.lastfm || false;
const lastfmSessionKey = cfg.lastfm_session_key || "";
const lastfmUsername = cfg.lastfm_username || "";
const statsApiOn = cfg.stats_api_sync || false;
const statsLocalOn = cfg.stats_local_tracking || false;

function getAccent() {
	return customAccentOn ? accentColor : "#f50";
}

let bridgeIdCounter = 0;

function sendBridge(cmd, args = {}) {
	return new Promise((resolve, reject) => {
		const cid = cmd + "_" + ++bridgeIdCounter + "_" + Date.now();
		let timeout;
		const handler = (event) => {
			if (
				event.source !== window ||
				!event.data ||
				event.data.source !== "sclient-bridge-reply"
			)
				return;
			if (event.data.callbackId === cid) {
				clearTimeout(timeout);
				window.removeEventListener("message", handler);
				if (event.data.success) resolve(event.data.result);
				else reject(new Error(event.data.error));
			}
		};
		window.addEventListener("message", handler);
		timeout = setTimeout(() => {
			window.removeEventListener("message", handler);
			reject(new Error("Bridge timeout"));
		}, 10000);
		window.postMessage(
			{
				source: "sclient-bridge",
				action: "invoke",
				cmd,
				args,
				callbackId: cid,
			},
			"*",
		);
	});
}

function getArtistFromTrack(track) {
	if (
		track.publisher_metadata &&
		track.publisher_metadata.artist &&
		track.publisher_metadata.artist.trim()
	) {
		return track.publisher_metadata.artist;
	}
	if (track.user && track.user.username) return track.user.username;
	return "Unknown";
}

function extractClientId() {
	for (const r of performance.getEntriesByType("resource")) {
		if (r.name.includes("client_id=")) {
			try {
				const cid = new URL(r.name).searchParams.get("client_id");
				if (cid) return cid;
			} catch (e) {}
		}
	}
	return null;
}

const trackCache = new Map();

async function fetchTrackData(songUrl) {
	if (trackCache.has(songUrl)) return trackCache.get(songUrl);
	const clientId = extractClientId();
	if (!clientId) return null;
	try {
		const res = await fetch(
			`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(songUrl)}&client_id=${clientId}`,
		);
		if (!res.ok) return null;
		const data = await res.json();
		trackCache.set(songUrl, data);
		return data;
	} catch (e) {
		return null;
	}
}

const playbackListeners = [];
let playbackTimer = null;
const PLAYBACK_SEL = ".playbackSoundBadge__titleLink";
let currentSongUrl = null;
let currentTrackData = null;

function parseTime(str) {
	if (!str) return 0;
	const m = str.match(/\d+:\d+(?::\d+)?/);
	if (!m) return 0;
	const parts = m[0].split(":").map(Number);
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return 0;
}

function onPlaybackChange(cb) {
	playbackListeners.push(cb);
	if (playbackListeners.length === 1) {
		playbackTimer = setInterval(pollPlayback, 2000);
	}
}

async function pollPlayback() {
	const titleLink = document.querySelector(PLAYBACK_SEL);

	if (!titleLink) {
		if (currentSongUrl !== null) {
			currentSongUrl = null;
			currentTrackData = null;
			for (const cb of playbackListeners) cb({ type: "none" });
		}
		return;
	}

	const songUrl = titleLink.href.split("?")[0];
	const isPlaying =
		navigator.mediaSession &&
		navigator.mediaSession.playbackState === "playing";
	const now = Date.now();

	const passed = document.querySelector(".playbackTimeline__timePassed");
	const dur = document.querySelector(".playbackTimeline__duration");
	const position = passed ? parseTime(passed.textContent) : 0;
	const duration = dur ? parseTime(dur.textContent) : 0;

	let type = "tick";
	if (songUrl !== currentSongUrl) {
		currentSongUrl = songUrl;
		currentTrackData = await fetchTrackData(songUrl);
		type = "track_start";
	}

	for (const cb of playbackListeners) {
		cb({
			type,
			songUrl,
			trackData: currentTrackData,
			isPlaying,
			timestamp: now,
			position,
			duration,
		});
	}
}

function showToast(message) {
	const toast = document.createElement("div");
	toast.textContent = message;
	const isLight = document.body.classList.contains("theme-light");
	toast.style.cssText = `
    position: fixed; bottom: 20px; left: 20px;
    background: ${isLight ? "rgba(250, 250, 250, 0.95)" : "rgba(18, 18, 18, 0.95)"};
    color: ${isLight ? "#222" : "#fff"}; padding: 12px 24px; border-radius: 8px;
    font-family: 'Inter', system-ui, sans-serif; font-size: 14px; font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"};
    z-index: 9999999; opacity: 0; transform: translateY(10px);
    transition: all 0.3s ease;
  `;
	document.body.appendChild(toast);
	requestAnimationFrame(() => {
		toast.style.opacity = "1";
		toast.style.transform = "translateY(0)";
	});
	setTimeout(() => {
		toast.style.opacity = "0";
		toast.style.transform = "translateY(10px)";
		setTimeout(() => toast.remove(), 300);
	}, 3500);
}

function showConfirm(message) {
	return new Promise((resolve) => {
		const isLight = document.body.classList.contains("theme-light");
		const bg = isLight ? "#fff" : "#1e1e1e";
		const textColor = isLight ? "#111" : "#fff";
		const borderColor = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)";

		const backdrop = document.createElement("div");
		backdrop.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; backdrop-filter: blur(2px);`;

		const modal = document.createElement("div");
		modal.style.cssText = `background: ${bg}; color: ${textColor}; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; font-family: 'Inter', system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid ${borderColor}; transform: scale(0.9); transition: transform 0.2s;`;

		const msg = document.createElement("div");
		msg.textContent = message;
		msg.style.cssText =
			"font-size: 16px; font-weight: 500; margin-bottom: 24px;";
		modal.appendChild(msg);

		const btnRow = document.createElement("div");
		btnRow.style.cssText = "display: flex; gap: 12px; justify-content: center;";

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "Cancel";
		cancelBtn.style.cssText = `padding: 8px 16px; background: transparent; border: 1px solid ${borderColor}; color: ${textColor}; border-radius: 6px; cursor: pointer; font-weight: 500;`;

		const okBtn = document.createElement("button");
		okBtn.textContent = "Confirm";
		okBtn.style.cssText =
			"padding: 8px 16px; background: #d32f2f; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: 500;";

		btnRow.appendChild(cancelBtn);
		btnRow.appendChild(okBtn);
		modal.appendChild(btnRow);
		backdrop.appendChild(modal);
		document.body.appendChild(backdrop);

		requestAnimationFrame(() => {
			backdrop.style.opacity = "1";
			modal.style.transform = "scale(1)";
		});

		const cleanup = (res) => {
			backdrop.style.opacity = "0";
			modal.style.transform = "scale(0.9)";
			setTimeout(() => {
				backdrop.remove();
				resolve(res);
			}, 200);
		};
		cancelBtn.onclick = () => cleanup(false);
		okBtn.onclick = () => cleanup(true);
	});
}

function applyWideLayout() {
	const width = wideLayoutWidth || "1200";
	const maxWidthRule =
		width === "unlimited"
			? "max-width: none !important;"
			: `max-width: ${width}px !important;`;
	injectStyle(
		"sclient-fluid-viewport",
		`
    .l-container {
      min-width: 720px !important;
      ${maxWidthRule}
      width: 100% !important;
    }
    header .l-container,
    .playControls .l-container {
      max-width: none !important;
      padding: 0 24px !important;
    }
  `,
	);
}

function applyLayoutFixes() {
	injectStyle(
		"sclient-layout-fixes",
		`
    .mixedSelectionModule, .mixedSelectionGallery, .tileGallery,
    .tileGallery__sliderPeekContainer, .tileGallery__sliderPanel {
      height: auto !important; min-height: min-content !important;
    }
    .tileGallery__slider {
      height: auto !important; min-height: min-content !important;
      padding: 0 !important;
    }
    .playableTile {
      height: auto !important; padding-bottom: 10px !important;
      margin-bottom: 0 !important;
    }
    .systemPlaylistTile { height: auto !important; }
  `,
	);
}

function applyCollapsibleSidebar() {
	injectStyle(
		"sclient-collapsible-sidebar",
		`
    .l-fluid-fixed .l-main { margin-right: 0 !important; }
    .l-sidebar-right {
      position: fixed !important; top: 46px !important; bottom: 46px !important;
      right: -360px !important; width: 360px !important;
      background-color: var(--background-surface-color, #fff) !important;
      z-index: 100 !important; transition: right 0.3s ease !important;
      box-sizing: border-box !important; box-shadow: -5px 0 25px rgba(0,0,0,0.5) !important;
      overflow-y: auto !important; overflow-x: hidden !important;
      padding-top: 20px !important;
    }
    body.sclient-sidebar-open .l-sidebar-right { right: 0 !important; }
    #sclient-sidebar-toggle { display: none !important; top: 60px; }
    body:has(.l-sidebar-right) #sclient-sidebar-toggle { display: flex !important; }
  `,
	);
}

function injectFloatingButtonStyles() {
	injectStyle(
		"sclient-floating-btn-styles",
		`
    .sclient-floating-btn {
      position: fixed; right: 20px; z-index: 101;
      background: var(--background-surface-color, #f2f2f2);
      color: #333; border: 1px solid #ccc !important;
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: right 0.3s ease, background 0.2s, color 0.2s, border-color 0.2s;
      padding: 0; outline: none !important;
    }
    .sclient-floating-btn:focus { outline: none !important; }
    .sclient-floating-btn:hover { background: #e0e0e0; }
    .theme-dark .sclient-floating-btn { color: #fff; border: 1px solid #333 !important; }
    .theme-dark .sclient-floating-btn:hover { background: #333; }
    .sclient-download-toast {
      position: fixed; bottom: 68px; z-index: 99999;
      background: var(--background-surface-color, #f2f2f2);
      color: #333; border: 1px solid #ccc; border-radius: 50px;
      min-height: 40px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
      padding: 8px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease, right 0.3s ease;
      font-family: 'Inter', system-ui, sans-serif; font-size: 13px;
      font-weight: 500; pointer-events: none; opacity: 0;
      white-space: pre-line; text-align: center;
    }
    .theme-dark .sclient-download-toast { color: #fff; border: 1px solid #333; }
    body button.sclient-floating-btn.active,
    .theme-dark body button.sclient-floating-btn.active {
      color: #f50 !important; border: 1px solid #f50 !important;
    }
    body button.sclient-floating-btn.active svg,
    .theme-dark body button.sclient-floating-btn.active svg {
      color: #f50 !important; stroke: #f50 !important;
    }
  `,
	);
}

function setupLazyScroll() {
	if (document.getElementById("sclient-lazy-scroll")) return;
	const btn = document.createElement("button");
	btn.id = "sclient-lazy-scroll";
	btn.className = "sclient-floating-btn";
	btn.style.bottom = "68px";
	btn.innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/></svg>';

	let scrolling = false;
	let interval = null;

	btn.addEventListener("click", () => {
		scrolling = !scrolling;
		if (scrolling) {
			btn.classList.add("active");
			interval = setInterval(
				() => window.scrollBy({ top: 300, behavior: "auto" }),
				16,
			);
		} else {
			btn.classList.remove("active");
			clearInterval(interval);
		}
	});
	document.body.appendChild(btn);
}

document.addEventListener("keydown", (e) => {
	if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
		e.preventDefault();
		window.location.reload();
	}
});
