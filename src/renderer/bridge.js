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
  if (track.artist) return track.artist;
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

function extractOAuthToken() {
  try {
    for (const c of document.cookie.split(";")) {
      const [key, val] = c.trim().split("=");
      if (key === "oauth_token" && val && val.startsWith("2-")) return val;
    }
  } catch (e) {}
  try {
    const t = localStorage.getItem("oauth_token");
    if (t && t.startsWith("2-")) return t;
  } catch (e) {}
  try {
    const t = sessionStorage.getItem("oauth_token");
    if (t && t.startsWith("2-")) return t;
  } catch (e) {}
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

function onPlaybackChange(cb) {
  playbackListeners.push(cb);
  if (playbackListeners.length === 1) {
    playbackTimer = setInterval(pollPlayback, 1000);
  }
  return () => {
    const idx = playbackListeners.indexOf(cb);
    if (idx !== -1) playbackListeners.splice(idx, 1);
    if (playbackListeners.length === 0 && playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
  };
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
  const now = Date.now();

  const media = getActiveMedia();
  const position = media ? media.currentTime : 0;
  const duration = media ? media.duration || 0 : 0;
  const isPlaying = media ? !media.paused : false;

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
}

function getCurrentTrack() {
  return { songUrl: currentSongUrl, trackData: currentTrackData };
}

function seekTo(seconds) {
  const media = getActiveMedia();
  if (!media) return;
  media.currentTime = Math.max(0, seconds);
}

function getActiveMedia() {
  const tracked = (window.__scMedia || []).find((m) => m.duration > 0);
  if (tracked) return tracked;
  const all = Array.from(document.querySelectorAll("audio, video"));
  return all.find((m) => !m.paused && m.duration > 0) || all.find((m) => m.duration > 0);
}

function playerCommand(action, value) {
  const cmd = typeof action === "object" && action !== null ? action : { action, value };
  const act = cmd.action;
  if (!act) return;

  if (act === "playpause" || act === "play" || act === "pause" || act === "stop") {
    document.querySelector(".playControl")?.click();
  } else if (act === "next") {
    document.querySelector(".skipControl__next")?.click();
  } else if (act === "prev" || act === "previous") {
    document.querySelector(".skipControl__previous")?.click();
  } else if (act === "shuffle") {
    document.querySelector(".shuffleControl")?.click();
  } else if (act === "loop") {
    document.querySelector(".repeatControl")?.click();
  } else if (act === "like") {
    document.querySelector(".playbackSoundBadge__like")?.click();
  } else if (act === "seek") {
    const media = getActiveMedia();
    if (media) {
      if (cmd.offsetMicros !== undefined) {
        media.currentTime = Math.max(0, media.currentTime + cmd.offsetMicros / 1000000);
      } else if (cmd.value !== undefined) {
        media.currentTime = Math.max(0, cmd.value);
      }
    }
  } else if (act === "setPosition") {
    const media = getActiveMedia();
    if (media) media.currentTime = Math.max(0, cmd.positionMicros / 1000000);
  } else if (act === "volume") {
    const media = getActiveMedia();
    if (media) {
      const vol = Math.max(0, Math.min(1, cmd.volume));
      media.volume = vol;
      const volumeEl = document.querySelector(".volume");
      const sliderWrapper = document.querySelector(".volume__sliderWrapper");
      const sliderProgress = document.querySelector(".volume__sliderProgress");
      const sliderHandle = document.querySelector(".volume__sliderHandle");
      if (volumeEl) volumeEl.setAttribute("data-level", Math.round(vol * 10));
      if (sliderWrapper) sliderWrapper.setAttribute("aria-valuenow", vol.toFixed(2));
      if (sliderProgress) sliderProgress.style.height = Math.round(vol * 120) + "px";
      if (sliderHandle) sliderHandle.style.top = Math.round(120 - vol * 120 + 10) + "px";
    }
  }

  setTimeout(() => {
    if (typeof pollPlayback === "function") pollPlayback();
  }, 50);
}

function initBridge() {
  window.__scMedia = window.__scMedia || [];
}
