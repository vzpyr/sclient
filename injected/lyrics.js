let lyricsOpen = false;
let lyricsTrack = "";
let lastTrack = "";
let currentLyricsUrl = "";
let currentSyncedLyrics = [];
let currentHighlightedIndex = -1;
let lyricsOffset = 0;
let lastKnownPosition = 0;
let currentDuration = 0;
let isPlaying = false;
let lastUpdateTime = Date.now();

if (!document.getElementById("sclient-lyrics-style")) {
  const style = document.createElement("style");
  style.id = "sclient-lyrics-style";
  style.textContent = `
		.sclient-lyric-line:hover { 
			opacity: 0.9 !important; 
			transform: scale(1.05) !important; 
			filter: blur(0px) !important;
		}
	`;
  document.head.appendChild(style);
}

function seekTo(seconds) {
  const audios = document.querySelectorAll("audio");
  for (const audio of audios) {
    if (audio.duration > 0 && Math.abs(audio.duration - currentDuration) < 5) {
      audio.currentTime = seconds;
      return;
    }
  }

  if (!currentDuration) return;
  const progressWrapper = document.querySelector(".playbackTimeline__progressWrapper");
  if (!progressWrapper) return;

  const percentage = Math.min(Math.max(seconds / currentDuration, 0), 1);
  const rect = progressWrapper.getBoundingClientRect();
  const x = rect.left + rect.width * percentage;
  const y = rect.top + rect.height / 2;

  progressWrapper.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y })
  );
  progressWrapper.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y })
  );
}

function updateLyricsUI(pos) {
  if (!lyricsOpen || !currentSyncedLyrics.length) return;

  const effectivePos = pos + lyricsOffset;
  const activeIdx = currentSyncedLyrics.findLastIndex((l) => effectivePos >= l.time - 0.2);
  if (activeIdx === currentHighlightedIndex) return;
  currentHighlightedIndex = activeIdx;

  const accent = getAccent();
  document.querySelectorAll(".sclient-lyric-line").forEach((el, i) => {
    if (i === activeIdx) {
      el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: ${accent}; font-weight: bold; transform: scale(1.1); opacity: 1; filter: blur(0px);`;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (i < activeIdx) {
      el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: #888; font-weight: normal; transform: scale(0.95); opacity: 0.4; filter: blur(2px);`;
    } else {
      el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: #fff; font-weight: normal; transform: scale(0.95); opacity: 1; filter: blur(0px);`;
    }
  });
}

function createLyricsSidebar() {
  if (document.getElementById("sclient-lyrics-sidebar")) return;

  const accent = getAccent();
  const sidebar = document.createElement("div");
  sidebar.id = "sclient-lyrics-sidebar";
  sidebar.style.cssText = `
    position: fixed; top: 20px; bottom: 70px; left: -400px; width: 350px;
    background: rgba(18, 18, 18, 0.95); backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
    box-shadow: 5px 5px 25px rgba(0,0,0,0.5); z-index: 999999;
    transition: left 0.3s ease; display: flex; flex-direction: column;
    color: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding: 20px; box-sizing: border-box;
  `;

  sidebar.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: ${accent};">Lyrics</h3>
      <div style="display: flex; align-items: center; gap: 15px;">
        <div id="sclient-lyrics-offset-container" style="display: none; align-items: center; gap: 8px; font-size: 12px; color: #aaa;">
           <span id="sclient-lyrics-offset-val" style="min-width: 32px; text-align: right;">0.0s</span>
           <input type="range" id="sclient-lyrics-offset-slider" min="-2" max="2" step="0.1" value="0" style="width: 70px; accent-color: ${accent}; cursor: pointer;">
        </div>
        <button id="sclient-lyrics-close-btn" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 20px; padding: 5px;">&times;</button>
      </div>
    </div>
    <div id="sclient-lyrics-content" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #e0e0e0;">
      <div style="opacity:0.5; text-align:center; margin-top:20px;">Open a song to load lyrics</div>
    </div>
  `;

  document.body.appendChild(sidebar);

  document.getElementById("sclient-lyrics-close-btn").addEventListener("click", toggleLyrics);

  document.getElementById("sclient-lyrics-offset-slider").addEventListener("input", (e) => {
    lyricsOffset = parseFloat(e.target.value);
    document.getElementById("sclient-lyrics-offset-val").innerText =
      (lyricsOffset > 0 ? "+" : "") + lyricsOffset.toFixed(1) + "s";
    currentHighlightedIndex = -999;
    let currentPos = isPlaying
      ? lastKnownPosition + (Date.now() - lastUpdateTime) / 1000
      : lastKnownPosition;
    updateLyricsUI(currentPos);
  });
}

function toggleLyrics() {
  createLyricsSidebar();
  const sidebar = document.getElementById("sclient-lyrics-sidebar");
  lyricsOpen = !lyricsOpen;
  if (lyricsOpen) {
    void sidebar.offsetWidth;
    sidebar.style.left = "20px";
    fetchLyrics();
  } else {
    sidebar.style.left = "-400px";
  }
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function doFetch(artist, title) {
  lyricsTrack = artist + " - " + title;
  const key = lyricsTrack;
  const accent = getAccent();
  const safe = esc(title);

  const content = document.getElementById("sclient-lyrics-content");
  if (content)
    content.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">Fetching lyrics for<br><b>${safe}</b>...</div>`;

  try {
    const res = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    );
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();

    if (content && lyricsTrack === key) {
      currentSyncedLyrics = [];
      currentHighlightedIndex = -1;
      lyricsOffset = 0;
      const offsetContainer = document.getElementById("sclient-lyrics-offset-container");

      if (data.syncedLyrics) {
        if (offsetContainer) {
          offsetContainer.style.display = "flex";
          document.getElementById("sclient-lyrics-offset-slider").value = 0;
          document.getElementById("sclient-lyrics-offset-val").innerText = "0.0s";
        }
        const lines = data.syncedLyrics.split("\n");
        let html = `<div style="font-weight:bold; margin-bottom: 30px; color:${accent}; font-size: 20px; text-align: center; padding: 0 10px;">${safe}<br><span style="font-size:14px; font-weight:normal; color:#aaa;">${esc(artist)}</span></div>`;
        html += `<div id="sclient-lyrics-lines" style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 0 15px 50vh 15px;">`;
        for (const line of lines) {
          const m = line.match(/^\[(\d{2}):(\d{2}\.\d{2,})\](.*)/);
          if (m) {
            const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
            html += `<div class="sclient-lyric-line" data-time="${time}" style="transition: all 0.4s ease; font-size: 16px; color: #fff; transform: scale(0.95); transform-origin: center; cursor: pointer;">${esc(m[3].trim() || " ")}</div>`;
            currentSyncedLyrics.push({ time });
          }
        }
        content.innerHTML = html + `</div>`;

        document.getElementById("sclient-lyrics-lines").addEventListener("click", (e) => {
          if (e.target.classList.contains("sclient-lyric-line")) {
            const t = parseFloat(e.target.getAttribute("data-time"));
            if (!isNaN(t)) {
              const targetPos = Math.max(0, t - lyricsOffset);
              seekTo(targetPos);
              lastKnownPosition = targetPos;
              lastUpdateTime = Date.now();
              currentHighlightedIndex = -999;
              updateLyricsUI(targetPos);
            }
          }
        });
      } else if (data.plainLyrics) {
        const lines = data.plainLyrics.split("\n");
        let html = `<div style="font-weight:bold; margin-bottom: 30px; color:${accent}; font-size: 20px; text-align: center; padding: 0 10px;">${safe}<br><span style="font-size:14px; font-weight:normal; color:#aaa;">${esc(artist)}</span></div>`;
        html += `<div style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 0 15px 20px 15px;">`;
        for (const line of lines) {
          html += `<div style="font-size: 16px; color: #fff;">${esc(line.trim() || " ")}</div>`;
        }
        content.innerHTML = html + `</div>`;
        if (offsetContainer) offsetContainer.style.display = "none";
      } else {
        renderManual(artist, title);
        if (offsetContainer) offsetContainer.style.display = "none";
      }
    }
  } catch (e) {
    if (content && lyricsTrack === key) {
      const offsetContainer = document.getElementById("sclient-lyrics-offset-container");
      if (offsetContainer) offsetContainer.style.display = "none";
      renderManual(artist, title);
    }
  }
}

function renderManual(artist, title) {
  const content = document.getElementById("sclient-lyrics-content");
  if (!content) return;

  content.innerHTML = `
    <div style="opacity:0.5; text-align:center; margin-top:20px;">No lyrics found for this track.</div>
    <div style="margin-top: 15px; text-align: center;">
      <div style="margin-bottom: 8px; font-size: 12px; color: #aaa;">Try manually:</div>
      <input type="text" id="sclient-lyrics-manual-artist" placeholder="Artist" value="${esc(artist)}" style="width: 90%; margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.2); border: 1px solid #555; color: #fff; border-radius: 4px; outline: none;">
      <input type="text" id="sclient-lyrics-manual-title" placeholder="Title" value="${esc(title)}" style="width: 90%; margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.2); border: 1px solid #555; color: #fff; border-radius: 4px; outline: none;">
      <button id="sclient-lyrics-manual-search" style="width: 90%; padding: 6px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; transition: background 0.2s;">Search</button>
    </div>
  `;

  document.getElementById("sclient-lyrics-manual-search").addEventListener("click", () => {
    const a = document.getElementById("sclient-lyrics-manual-artist").value;
    const t = document.getElementById("sclient-lyrics-manual-title").value;
    if (a && t) doFetch(a, t);
  });
}

async function fetchLyrics() {
  if (!lyricsOpen) return;

  let title = "";
  let artist = "";
  if (navigator.mediaSession && navigator.mediaSession.metadata) {
    title = navigator.mediaSession.metadata.title || "";
    artist = navigator.mediaSession.metadata.artist || "";
  }

  if (!title || !artist) return;

  const key = artist + " - " + title;
  if (lastTrack === key) return;
  lastTrack = key;
  doFetch(artist, title);
}

function injectLyricsButton() {
  if (document.getElementById("sclient-lyrics-btn")) return;

  const dlBtn = document.getElementById("sclient-download-btn");
  if (!dlBtn || !dlBtn.parentNode) return;

  const btn = document.createElement("button");
  btn.id = "sclient-lyrics-btn";
  btn.className =
    "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
  btn.title = "Lyrics";
  btn.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/></svg></div>';

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleLyrics();
  });

  dlBtn.parentNode.insertBefore(btn, dlBtn);
}

if (typeof onPlaybackChange !== "undefined") {
  onPlaybackChange((evt) => {
    lastKnownPosition = evt.position;
    currentDuration = evt.duration;
    isPlaying = evt.isPlaying;
    lastUpdateTime = Date.now();
    updateLyricsUI(lastKnownPosition);

    if (lyricsOpen && evt.songUrl) {
      if (evt.songUrl !== currentLyricsUrl) {
        currentLyricsUrl = evt.songUrl;
        lastTrack = "";
      }

      if (!lastTrack) {
        fetchLyrics();
      }
    }
  });
}

function renderLoop() {
  if (lyricsOpen && isPlaying && currentSyncedLyrics.length) {
    const estimatedPos = lastKnownPosition + (Date.now() - lastUpdateTime) / 1000;
    updateLyricsUI(estimatedPos);
  }
  requestAnimationFrame(renderLoop);
}
renderLoop();
