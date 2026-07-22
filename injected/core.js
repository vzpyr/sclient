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

function injectToIframes(id, css) {
  const applyToIframe = (ifr) => {
    try {
      if (!ifr.contentDocument) return;
      if (ifr.contentDocument.getElementById(id + "-iframe")) return;
      const style = ifr.contentDocument.createElement("style");
      style.id = id + "-iframe";
      style.textContent = css;
      ifr.contentDocument.head.appendChild(style);
    } catch (e) {}
  };

  document.querySelectorAll("iframe").forEach(applyToIframe);

  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.tagName === "IFRAME") {
          node.addEventListener("load", () => applyToIframe(node));
          applyToIframe(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll("iframe").forEach((ifr) => {
            ifr.addEventListener("load", () => applyToIframe(ifr));
            applyToIframe(ifr);
          });
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

const scDesignSystem = `
:root {
  --sc-accent: #f50;
  --sc-bg-surface: #1e1e1e;
  --sc-bg-overlay: rgba(0, 0, 0, 0.75);
  --sc-bg-elevated: #2a2a2a;
  --sc-text-main: #ffffff;
  --sc-text-muted: rgba(255, 255, 255, 0.65);
  --sc-border: rgba(255, 255, 255, 0.12);
  --sc-border-hover: rgba(255, 255, 255, 0.25);
  --sc-btn-bg: rgba(255, 255, 255, 0.08);
  --sc-btn-bg-hover: rgba(255, 255, 255, 0.16);
  --sc-danger: #e53935;
  --sc-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --sc-text-xs: 11px;
  --sc-text-sm: 12px;
  --sc-text-base: 13px;
  --sc-text-lg: 16px;
  --sc-text-xl: 18px;
  --sc-text-xxl: 22px;
  --sc-radius-sm: 4px;
  --sc-radius-md: 6px;
  --sc-radius-lg: 8px;
  --sc-radius-xl: 12px;
}
body.theme-light {
  --sc-bg-surface: #f2f2f2;
  --sc-bg-overlay: rgba(255, 255, 255, 0.85);
  --sc-bg-elevated: #ffffff;
  --sc-text-main: #111111;
  --sc-text-muted: rgba(0, 0, 0, 0.6);
  --sc-border: rgba(0, 0, 0, 0.12);
  --sc-border-hover: rgba(0, 0, 0, 0.25);
  --sc-btn-bg: rgba(0, 0, 0, 0.06);
  --sc-btn-bg-hover: rgba(0, 0, 0, 0.12);
}
.sc-text-h1 { font-family: var(--sc-font-sans); font-size: var(--sc-text-xxl); font-weight: 700; color: var(--sc-text-main); }
.sc-text-h2 { font-family: var(--sc-font-sans); font-size: var(--sc-text-xl); font-weight: 600; color: var(--sc-text-main); }
.sc-text-body { font-family: var(--sc-font-sans); font-size: var(--sc-text-base); color: var(--sc-text-main); line-height: 1.5; }
.sc-text-sub { font-family: var(--sc-font-sans); font-size: var(--sc-text-sm); color: var(--sc-text-muted); }

.sc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--sc-btn-bg);
  color: var(--sc-text-main);
  border: 1px solid var(--sc-border);
  border-radius: var(--sc-radius-md);
  cursor: pointer;
  font-family: var(--sc-font-sans);
  font-size: var(--sc-text-base);
  font-weight: 500;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease, filter 0.2s ease;
  outline: none;
  box-sizing: border-box;
}
.sc-btn:hover {
  background: var(--sc-btn-bg-hover);
  border-color: var(--sc-border-hover);
  filter: brightness(1.15);
}
.sc-btn:active {
  transform: scale(0.97);
}
.sc-btn-primary {
  background: var(--sc-accent);
  color: #ffffff;
  border-color: transparent;
}
.sc-btn-primary:hover {
  background: var(--sc-accent);
  border-color: transparent;
  filter: brightness(1.15);
}
.sc-btn-danger {
  background: var(--sc-danger);
  color: #ffffff;
  border-color: transparent;
}
.sc-btn-danger:hover {
  background: var(--sc-danger);
  border-color: transparent;
  filter: brightness(1.15);
}
.sc-btn-ghost {
  background: transparent;
  border-color: transparent;
}
.sc-btn-ghost:hover {
  background: var(--sc-btn-bg-hover);
  border-color: transparent;
  filter: brightness(1.15);
}

.sc-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--sc-bg-overlay);
  z-index: 9999999;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.2s ease;
}
.sc-modal-surface {
  background: var(--sc-bg-elevated);
  color: var(--sc-text-main);
  padding: 24px;
  border-radius: var(--sc-radius-xl);
  max-width: 400px;
  width: 90%;
  border: 1px solid var(--sc-border);
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  font-family: var(--sc-font-sans);
  transform: scale(0.95);
  transition: transform 0.2s ease;
}
.sc-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--sc-bg-surface);
  border: 1px solid var(--sc-border);
  color: var(--sc-text-main);
  border-radius: var(--sc-radius-md);
  padding: 8px 12px;
  font-family: var(--sc-font-sans);
  font-size: var(--sc-text-base);
  outline: none;
  transition: border-color 0.2s ease;
}
.sc-input:focus {
  border-color: var(--sc-accent);
}
`;
injectStyle("sclient-design-system", scDesignSystem);
injectToIframes("sclient-design-system", scDesignSystem);

const sclientScrollbarCss = `
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.4); border-radius: 6px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.7); }
  * { scrollbar-width: thin; scrollbar-color: rgba(128, 128, 128, 0.4) transparent; }
`;

injectStyle("sclient-scrollbar", sclientScrollbarCss);
injectToIframes("sclient-scrollbar", sclientScrollbarCss);

injectStyle(
  "sclient-light-theme-overlays",
  `
  body.theme-light #sclient-settings-overlay,
  body.theme-light #sclient-lyrics-sidebar,
  body.theme-light #sclient-stats-overlay,
  body.theme-light #sclient-playlists-overlay {
    background: var(--sc-bg-surface) !important;
    color: var(--sc-text-main) !important;
  }
  body.theme-light .pm-sidebar {
    background: var(--sc-bg-elevated) !important;
    border-right: 1px solid var(--sc-border) !important;
  }
  body.theme-light #sclient-lyrics-content {
    color: var(--sc-text-main) !important;
  }
  body.theme-light #sclient-settings-scroll > div[style*="justify-content: space-between"],
  body.theme-light .stats-card,
  body.theme-light .stats-chart-box {
    background: var(--sc-bg-elevated) !important;
    border: 1px solid var(--sc-border) !important;
    color: var(--sc-text-main) !important;
  }
  body.theme-light .stats-chart-title {
    color: var(--sc-text-main) !important;
  }
  body.theme-light .stats-table th {
    color: var(--sc-text-muted) !important;
    border-bottom: 1px solid var(--sc-border) !important;
  }
  body.theme-light .stats-table td {
    color: var(--sc-text-main) !important;
    border-bottom: 1px solid var(--sc-border) !important;
  }
  body.theme-light #sclient-accounts-list > div {
    background: var(--sc-bg-elevated) !important;
    border: 1px solid var(--sc-border) !important;
  }
  body.theme-light #sclient-css-container,
  body.theme-light #sclient-js-container {
    border-top: 1px solid var(--sc-border) !important;
  }
  body.theme-light .pm-picker,
  body.theme-light .pm-picker-item {
    background: var(--sc-bg-elevated) !important;
    color: var(--sc-text-main) !important;
    border-color: var(--sc-border) !important;
  }
  body.theme-light .pm-track-row:hover {
    background: var(--sc-btn-bg-hover) !important;
  }
  `
);

const cfg = window.__SCLIENT_CONFIG__ || {};
const customAccentOn = cfg.custom_accent || false;
const accentColor = cfg.accent_color || "#FF0000";
const customFontOn = cfg.custom_font || false;
const customFontFamily = cfg.custom_font_family || "";

if (customFontOn && customFontFamily) {
  const familyUrl = customFontFamily.trim().replace(/\s+/g, "+");
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=${familyUrl}:wght@400;500;700&display=swap');
  html, body, * {
    font-family: '${customFontFamily}', monospace !important;
  }
`;
  injectStyle("sclient-global-font", css);
  injectToIframes("sclient-global-font", css);
}

const lazyScrollOn = cfg.lazy_scroll || false;
const hideDecorationsOn = cfg.hide_decorations || false;
const wideLayoutOn = cfg.wide_layout || false;
const wideLayoutWidth = cfg.wide_layout_width || "1200";
const collapsibleSidebarOn = cfg.collapsible_sidebar || false;
const customBgColorOn = cfg.custom_bg_color || false;
const bgColor = cfg.bg_color || "#000000";
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
      if (event.source !== window || !event.data || event.data.source !== "sclient-bridge-reply")
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
    }, 300000);
    window.postMessage(
      {
        source: "sclient-bridge",
        action: "invoke",
        cmd,
        args,
        callbackId: cid,
      },
      "*"
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
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(songUrl)}&client_id=${clientId}`
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
  const isPlaying = navigator.mediaSession && navigator.mediaSession.playbackState === "playing";
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
  } else if (!currentTrackData) {
    currentTrackData = await fetchTrackData(songUrl);
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

  if (typeof window !== "undefined") {
    const likeBtn = document.querySelector(".playbackSoundBadge__like");
    const shuffleBtn = document.querySelector(".shuffleControl");
    const repeatBtn = document.querySelector(".repeatControl");

    let loopState = "none";
    if (repeatBtn) {
      if (repeatBtn.classList.contains("m-one")) loopState = "one";
      else if (repeatBtn.classList.contains("m-all")) loopState = "all";
    }

    window.postMessage(
      {
        source: "sclient-mini-update",
        data: {
          trackData: currentTrackData,
          isPlaying: isPlaying,
          position: position,
          duration: duration,
          isLiked: likeBtn ? likeBtn.classList.contains("sc-button-selected") : false,
          isShuffled: shuffleBtn ? shuffleBtn.classList.contains("m-shuffling") : false,
          loopState: loopState,
          accent: typeof getAccent === "function" ? getAccent() : "#f50",
        },
      },
      "*"
    );
  }
}

function injectMiniplayerButton() {
  if (document.getElementById("sclient-mini-btn")) return;

  const dlBtn = document.getElementById("sclient-download-btn");
  if (!dlBtn || !dlBtn.parentNode) return;

  const btn = document.createElement("button");
  btn.id = "sclient-mini-btn";
  btn.className =
    "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
  btn.title = "Mini Player";
  btn.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-turntable-icon lucide-turntable"><path d="M10 12.01h.01"/><path d="M18 8v4a8 8 0 0 1-1.07 4"/><circle cx="10" cy="12" r="4"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg></div>';

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    window.postMessage({ source: "sclient-mini-toggle" }, "*");
  });

  dlBtn.parentNode.insertBefore(btn, dlBtn);
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.source !== "sclient-mini-action") return;
  const { action } = event.data;
  if (action === "playpause") document.querySelector(".playControl")?.click();
  if (action === "next") document.querySelector(".skipControl__next")?.click();
  if (action === "prev") document.querySelector(".skipControl__previous")?.click();
  if (action === "shuffle") document.querySelector(".shuffleControl")?.click();
  if (action === "loop") document.querySelector(".repeatControl")?.click();
  if (action === "like") document.querySelector(".playbackSoundBadge__like")?.click();
  if (action && action.action === "seek") {
    if (typeof seekTo === "function") seekTo(action.value);
  }

  setTimeout(() => {
    if (typeof pollPlayback === "function") pollPlayback();
  }, 50);
});

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = "sc-modal-surface";
  toast.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; width: auto; max-width: 360px;
    border-radius: var(--sc-radius-xl); min-height: 40px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    padding: 10px 20px; pointer-events: none; z-index: 9999999; opacity: 0; transform: translateY(10px);
    transition: all 0.3s ease; white-space: pre-line; text-align: center; font-size: var(--sc-text-base);
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

function showConfirm(message, options) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "sc-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "sc-modal-surface";
    modal.style.textAlign = "center";

    const msg = document.createElement("div");
    msg.textContent = message;
    msg.className = "sc-text-body";
    msg.style.cssText = "font-weight: 500; margin-bottom: 24px; font-size: var(--sc-text-lg);";
    modal.appendChild(msg);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 12px; justify-content: center;";

    let buttons = [];
    if (Array.isArray(options)) {
      buttons = options;
    } else {
      buttons = [
        { id: false, text: arguments[2] || "Cancel", type: "secondary" },
        { id: true, text: arguments[1] || "Confirm", type: "danger" },
      ];
    }

    const cleanup = (res) => {
      backdrop.style.opacity = "0";
      modal.style.transform = "scale(0.95)";
      setTimeout(() => {
        backdrop.remove();
        resolve(res);
      }, 200);
    };

    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.text;
      btn.className = "sc-btn";
      if (b.type === "danger") {
        btn.classList.add("sc-btn-danger");
      } else if (b.type === "primary") {
        btn.classList.add("sc-btn-primary");
      }
      btn.onclick = () => cleanup(b.id);
      btnRow.appendChild(btn);
    });

    modal.appendChild(btnRow);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.style.opacity = "1";
      modal.style.transform = "scale(1)";
    });
  });
}

function applyWideLayout() {
  const width = wideLayoutWidth || "1200";
  const maxWidthRule =
    width === "unlimited" ? "max-width: none !important;" : `max-width: ${width}px !important;`;
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
  `
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
  `
  );
}

function applyCollapsibleSidebar() {
  const bgStyle = customBgColorOn ? bgColor : "var(--surface-color, var(--sc-bg-surface))";
  injectStyle(
    "sclient-collapsible-sidebar",
    `
    .l-fluid-fixed .l-main { margin-right: 0 !important; }
    .l-sidebar-right {
      position: fixed !important; top: 46px !important; bottom: 46px !important;
      right: -360px !important; width: 360px !important;
      background-color: ${bgStyle} !important;
      z-index: 100 !important; transition: right 0.3s ease !important;
      box-sizing: border-box !important; box-shadow: -5px 0 25px rgba(0,0,0,0.5) !important;
      overflow-y: auto !important; overflow-x: hidden !important;
      padding-top: 20px !important;
    }
    body.sclient-sidebar-open .l-sidebar-right { right: 0 !important; }
    #sclient-sidebar-toggle { display: none !important; top: 60px; }
    body:has(.l-sidebar-right) #sclient-sidebar-toggle { display: flex !important; }
  `
  );
}

function injectFloatingButtonStyles() {
  const bgStyle = customBgColorOn ? bgColor : "var(--sc-bg-elevated)";
  injectStyle(
    "sclient-floating-btn-styles",
    `
    .sclient-floating-btn {
      position: fixed; right: 20px; z-index: 101;
      background: ${bgStyle};
      color: var(--sc-text-main); border: 1px solid var(--sc-border) !important;
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: right 0.3s ease, background 0.2s, color 0.2s, border-color 0.2s, transform 0.15s ease, filter 0.2s ease;
      padding: 0; outline: none !important;
    }
    .sclient-floating-btn:focus { outline: none !important; }
    .sclient-floating-btn:hover { background: ${bgStyle} !important; filter: brightness(1.25); border-color: var(--sc-border-hover) !important; }
    .sclient-floating-btn:active { transform: scale(0.95); }
    .sclient-download-toast {
      position: fixed; bottom: 68px; z-index: 99999;
      background: ${bgStyle};
      color: var(--sc-text-main); border: 1px solid var(--sc-border); border-radius: var(--sc-radius-xl);
      min-height: 40px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
      padding: 8px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease, right 0.3s ease;
      font-family: var(--sc-font-sans); font-size: var(--sc-text-base);
      font-weight: 500; pointer-events: none; opacity: 0;
      white-space: pre-line; text-align: center;
    }
    body button.sclient-floating-btn.active,
    .theme-dark body button.sclient-floating-btn.active {
      color: var(--sc-accent) !important; border: 1px solid var(--sc-accent) !important;
    }
    body button.sclient-floating-btn.active svg,
    .theme-dark body button.sclient-floating-btn.active svg {
      color: var(--sc-accent) !important; stroke: var(--sc-accent) !important;
    }
  `
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
      interval = setInterval(() => window.scrollBy({ top: 300, behavior: "auto" }), 16);
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

document.addEventListener("click", (e) => {
  const avatarLink = e.target.closest(".playbackSoundBadge__avatar");
  if (avatarLink) {
    e.preventDefault();
    e.stopPropagation();

    const span = avatarLink.querySelector("span.sc-artwork");
    if (!span) return;

    const bg = span.style.backgroundImage;
    if (!bg) return;

    let imgUrl = bg.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');

    imgUrl = imgUrl.replace(/-(t50x50|badge|large|t120x120)\.(jpg|png)/i, '-t500x500.$2');

    const overlay = document.createElement("div");
    overlay.className = "sc-modal-backdrop";

    const img = document.createElement("img");
    img.src = imgUrl;
    img.style.cssText = "max-width: 90vw; max-height: 90vh; border-radius: var(--sc-radius-lg); box-shadow: 0 10px 40px rgba(0,0,0,0.5); object-fit: contain; transform: scale(0.95); transition: transform 0.2s ease;";

    overlay.appendChild(img);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      img.style.transform = "scale(1)";
    });

    overlay.addEventListener("click", () => {
      overlay.style.opacity = "0";
      img.style.transform = "scale(0.95)";
      setTimeout(() => overlay.remove(), 200);
    });
  }
}, true);
