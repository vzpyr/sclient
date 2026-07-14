const { ipcRenderer } = require("electron");

const $ = (id) => document.getElementById(id);

let currentDuration = 0;
let currentArtworkUrl = null;
let artworkAccentLocked = false;

function formatTime(secs) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

let accentExtractionToken = 0;

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function extractAccentFromArtwork(url) {
  const token = ++accentExtractionToken;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    if (token !== accentExtractionToken) return;
    try {
      const SIZE = 48;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 200) continue;
        const [h, s, l] = rgbToHsl(r, g, b);
        if (l < 0.12 || l > 0.9 || s < 0.18) continue;
        const lWeight = 1 - Math.abs(l - 0.55) * 1.6;
        const sWeight = s;
        const weight = Math.max(0, lWeight) * sWeight;
        if (weight <= 0) continue;
        const key =
          Math.round(h * 12) + "/" + Math.round(s * 4) + "/" + Math.round(l * 5);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.r += r * weight;
          bucket.g += g * weight;
          bucket.b += b * weight;
          bucket.weight += weight;
        } else {
          buckets.set(key, { r: r * weight, g: g * weight, b: b * weight, weight });
        }
      }

      let best = null;
      for (const bucket of buckets.values()) {
        if (!best || bucket.weight > best.weight) best = bucket;
      }
      if (!best) return;

      let r = Math.round(best.r / best.weight);
      let g = Math.round(best.g / best.weight);
      let b = Math.round(best.b / best.weight);

      let [h, s, l] = rgbToHsl(r, g, b);
      s = Math.max(s, 0.55);
      l = Math.min(Math.max(l, 0.42), 0.62);
      [r, g, b] = hslToRgb(h, s, l);

      const hex = rgbToHex(r, g, b);
      currentAccent = hex;
      artworkAccentLocked = true;
      document.documentElement.style.setProperty("--accent", hex);
    } catch (e) {
    }
  };
  img.onerror = () => {};
  img.src = url;
}

$("btn-close").addEventListener("click", () => ipcRenderer.send("mini_close"));

$("offset-slider").addEventListener("input", (e) => {
  lyricsOffset = parseFloat(e.target.value);
  $("offset-val").textContent = (lyricsOffset > 0 ? "+" : "") + lyricsOffset.toFixed(1) + "s";
  currentHighlightedIndex = -999;
  const currentPos = isPlayingLocal
    ? lastKnownPosition + (Date.now() - lastUpdateTime) / 1000
    : lastKnownPosition;
  updateLyricsUI(currentPos);
});
$("btn-minimize").addEventListener("click", () => ipcRenderer.send("mini_minimize"));
$("btn-fullscreen").addEventListener("click", () => ipcRenderer.send("mini_fullscreen"));

let isPlayingLocal = false;
let isShuffledLocal = false;
let isLikedLocal = false;
let loopStateLocal = "none";
let currentAccent = "#f50";

let lyricsOpenLocal = false;
let currentSyncedLyrics = [];
let lyricsTrack = "";
let currentFetchAbort = null;
let lyricsOffset = 0;
let currentHighlightedIndex = -1;
let currentArtist = "";
let currentTitle = "";

$("btn-playpause").addEventListener("click", () => {
  isPlayingLocal = !isPlayingLocal;
  updatePlayPauseUI(isPlayingLocal);
  ipcRenderer.send("mini_action", "playpause");
});
$("btn-next").addEventListener("click", () => ipcRenderer.send("mini_action", "next"));
$("btn-prev").addEventListener("click", () => ipcRenderer.send("mini_action", "prev"));
$("btn-shuffle").addEventListener("click", () => {
  isShuffledLocal = !isShuffledLocal;
  $("btn-shuffle").classList.toggle("active", isShuffledLocal);
  ipcRenderer.send("mini_action", "shuffle");
});
$("btn-lyrics").addEventListener("click", () => {
  lyricsOpenLocal = !lyricsOpenLocal;
  $("btn-lyrics").classList.toggle("active", lyricsOpenLocal);
  const content = document.querySelector(".content");
  if (lyricsOpenLocal) {
    ipcRenderer.send("resize_mini", 800, 450);
    content.classList.add("with-lyrics");
    if (currentArtist && currentTitle) fetchLyrics(currentArtist, currentTitle);
  } else {
    ipcRenderer.send("resize_mini", 480, 180);
    content.classList.remove("with-lyrics");
    $("offset-controls").classList.remove("visible");
    currentSyncedLyrics = [];
  }
});
$("btn-loop").addEventListener("click", () => {
  if (loopStateLocal === "none") loopStateLocal = "all";
  else if (loopStateLocal === "all") loopStateLocal = "one";
  else loopStateLocal = "none";
  updateLoopUI(loopStateLocal);
  ipcRenderer.send("mini_action", "loop");
});
$("btn-like").addEventListener("click", () => {
  isLikedLocal = !isLikedLocal;
  updateLikeUI(isLikedLocal);
  ipcRenderer.send("mini_action", "like");
});

$("progress-bar").addEventListener("click", (e) => {
  const rect = $("progress-bar").getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const seekTo = currentDuration * percent;
  ipcRenderer.send("mini_action", { action: "seek", value: seekTo });
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (e.code === "Space") {
    e.preventDefault();
    $("btn-playpause").click();
  }
});

let lastKnownPosition = 0;
let lastUpdateTime = Date.now();

function updatePlayPauseUI(playing) {
  if (playing) {
    $("icon-play").style.display = "none";
    $("icon-pause").style.display = "block";
  } else {
    $("icon-play").style.display = "block";
    $("icon-pause").style.display = "none";
  }
  $("eq-indicator").classList.toggle("paused", !playing);
}

function updateLikeUI(liked) {
  $("btn-like").classList.toggle("active", liked);
  $("btn-like").innerHTML = liked
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
}

function updateLoopUI(state) {
  if (state === "none") {
    $("btn-loop").classList.remove("active");
    $("icon-loop-all").style.display = "block";
    $("icon-loop-one").style.display = "none";
  } else if (state === "all") {
    $("btn-loop").classList.add("active");
    $("icon-loop-all").style.display = "block";
    $("icon-loop-one").style.display = "none";
  } else if (state === "one") {
    $("btn-loop").classList.add("active");
    $("icon-loop-all").style.display = "none";
    $("icon-loop-one").style.display = "block";
  }
}

ipcRenderer.on("mini_update", (_e, data) => {
  if (data.trackData) {
    const oldTitle = currentTitle;
    const oldArtist = currentArtist;

    currentTitle = data.trackData.title || "Unknown";
    currentArtist =
      data.trackData.publisher_metadata?.artist || data.trackData.user?.username || "-";

    $("title").textContent = currentTitle;
    $("artist").textContent = currentArtist;
    if (data.trackData.artwork_url) {
      const url = data.trackData.artwork_url.replace("large", "t500x500");
      currentArtworkUrl = url;
      $("artwork").style.backgroundImage = `url('${url}')`;
      $("bg").style.backgroundImage = `url('${url}')`;
      extractAccentFromArtwork(url);
    }

    if (lyricsOpenLocal && (oldTitle !== currentTitle || oldArtist !== currentArtist)) {
      fetchLyrics(currentArtist, currentTitle);
    }
  } else {
    $("artwork").style.backgroundImage = "none";
    $("bg").style.backgroundImage = "none";
    currentArtworkUrl = null;
  }

  if (data.isPlaying !== undefined) {
    isPlayingLocal = data.isPlaying;
    updatePlayPauseUI(isPlayingLocal);
  }

  if (data.position !== undefined && data.duration !== undefined) {
    currentDuration = data.duration;
    lastKnownPosition = data.position;
    lastUpdateTime = Date.now();
    $("time-duration").textContent = formatTime(data.duration);
  }

  if (data.isLiked !== undefined) {
    isLikedLocal = data.isLiked;
    updateLikeUI(isLikedLocal);
  }

  if (data.isShuffled !== undefined) {
    isShuffledLocal = data.isShuffled;
    $("btn-shuffle").classList.toggle("active", isShuffledLocal);
  }

  if (data.loopState !== undefined) {
    loopStateLocal = data.loopState;
    updateLoopUI(loopStateLocal);
  }

  if (data.accent && data.accent !== currentAccent && !artworkAccentLocked) {
    currentAccent = data.accent;
    document.documentElement.style.setProperty("--accent", currentAccent);
  }
});

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderManual(artist, title) {
  const content = document.getElementById("lyrics-content");
  content.innerHTML = `
		<div style="opacity:0.5; margin-top:40px;">No lyrics found.</div>
		<div style="margin-top: 15px;">
			<div style="margin-bottom: 8px; font-size: 12px; color: #aaa;">Try manually:</div>
			<input type="text" id="manual-artist" placeholder="Artist" value="${esc(artist)}" style="width: 80%; margin-bottom: 8px; padding: 6px; background: rgba(0,0,0,0.4); border: 1px solid #555; color: #fff; border-radius: 4px;">
			<input type="text" id="manual-title" placeholder="Title" value="${esc(title)}" style="width: 80%; margin-bottom: 12px; padding: 6px; background: rgba(0,0,0,0.4); border: 1px solid #555; color: #fff; border-radius: 4px;">
			<br><button id="manual-search" style="padding: 6px 16px; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Search</button>
		</div>
	`;
  document.getElementById("manual-search").addEventListener("click", () => {
    const a = document.getElementById("manual-artist").value;
    const t = document.getElementById("manual-title").value;
    if (a && t) fetchLyrics(a, t);
  });
}

async function fetchLyrics(artist, title) {
  lyricsTrack = artist + " - " + title;
  const key = lyricsTrack;
  const safe = esc(title);
  const safeArtist = esc(artist);
  const content = document.getElementById("lyrics-content");
  content.innerHTML = `<div style="opacity:0.5; margin-top:40px;">Fetching lyrics for<br><b>${safeArtist} - ${safe}</b>...<br><button id="sclient-mini-manual-now" style="margin-top:14px; padding:6px 16px; background:#333; color:#fff; border:1px solid #555; border-radius:4px; cursor:pointer;">Enter manually</button></div>`;
  currentSyncedLyrics = [];

  const abortCtrl = new AbortController();
  currentFetchAbort = abortCtrl;
  document.getElementById("sclient-mini-manual-now").addEventListener("click", () => {
    abortCtrl.abort();
    currentFetchAbort = null;
    $("offset-controls").classList.remove("visible");
    renderManual(artist, title);
  });

  try {
    const res = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { signal: abortCtrl.signal }
    );
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();

    if (lyricsTrack !== key) return;
    currentHighlightedIndex = -1;
    lyricsOffset = 0;
    $("offset-slider").value = 0;
    $("offset-val").textContent = "0.0s";

    if (data.syncedLyrics) {
      const lines = data.syncedLyrics.split("\n");
      let html = `<div id="lyrics-lines" style="display:flex; flex-direction:column; gap:12px; padding: 50vh 10px 50vh 10px;">`;
      for (const line of lines) {
        const m = line.match(/^\[(\d{2}):(\d{2}\.\d{2,})\](.*)/);
        if (m) {
          const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
          html += `<div class="lyric-line" data-time="${time}">${esc(m[3].trim() || " ")}</div>`;
          currentSyncedLyrics.push({ time, element: null });
        }
      }
      content.innerHTML = html + `</div>`;
      $("offset-controls").classList.add("visible");

      const lineElements = content.querySelectorAll(".lyric-line");
      lineElements.forEach((el, i) => {
        currentSyncedLyrics[i].element = el;
        el.addEventListener("click", () => {
          const t = currentSyncedLyrics[i].time;
          const seekTo = Math.max(0, t - lyricsOffset);
          ipcRenderer.send("mini_action", { action: "seek", value: seekTo });
          lastKnownPosition = seekTo;
          lastUpdateTime = Date.now();
          currentHighlightedIndex = -999;
          updateLyricsUI(seekTo);
        });
      });
    } else if (data.plainLyrics) {
      const lines = data.plainLyrics.split("\n");
      let html = `<div style="display:flex; flex-direction:column; gap:12px; padding: 0 10px 20vh 10px;">`;
      for (const line of lines)
        html += `<div style="font-size: 15px; margin-bottom: 12px;">${esc(line.trim() || " ")}</div>`;
      content.innerHTML = html + `</div>`;
      $("offset-controls").classList.remove("visible");
    } else {
      $("offset-controls").classList.remove("visible");
      renderManual(artist, title);
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
    if (lyricsTrack === key) {
      $("offset-controls").classList.remove("visible");
      renderManual(artist, title);
    }
  }
}

function updateLyricsUI(pos) {
  if (!lyricsOpenLocal || !currentSyncedLyrics.length) return;

  const effectivePos = pos + lyricsOffset;
  const activeIdx = currentSyncedLyrics.findLastIndex((l) => effectivePos >= l.time - 0.2);
  if (activeIdx === currentHighlightedIndex) return;
  currentHighlightedIndex = activeIdx;

  currentSyncedLyrics.forEach((l, i) => {
    if (!l.element) return;
    if (i === activeIdx) {
      l.element.className = "lyric-line active";
      l.element.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (i < activeIdx) {
      l.element.className = "lyric-line past";
    } else {
      l.element.className = "lyric-line";
    }
  });
}

function renderLoop() {
  if (currentDuration > 0) {
    let currentPos = lastKnownPosition;
    if (isPlayingLocal) {
      currentPos += (Date.now() - lastUpdateTime) / 1000;
      if (currentPos > currentDuration) currentPos = currentDuration;
    }

    $("time-current").textContent = formatTime(currentPos);
    const percent = (currentPos / currentDuration) * 100;
    $("progress-fill").style.width = `${Math.max(0, Math.min(100, percent))}%`;

    updateLyricsUI(currentPos);
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();

function syncArtworkSize() {
  if (document.querySelector(".content.with-lyrics")) return;
  if (window.innerHeight > 250) return;
  const size = Math.max(60, window.innerHeight - 28);
  document.documentElement.style.setProperty("--mini-art-size", size + "px");
}
syncArtworkSize();
window.addEventListener("resize", syncArtworkSize);
