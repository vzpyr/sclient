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
let currentFetchAbort = null;

if (!document.getElementById("sclient-lyrics-style")) {
  const style = document.createElement("style");
  style.id = "sclient-lyrics-style";
  style.textContent = `
		.sclient-lyric-line:hover { 
			opacity: 0.9 !important; 
			transform: scale(1.05) !important; 
			filter: blur(0px) !important;
		}
		.sclient-lyric-word.sung {
			color: var(--sclient-accent, #f50) !important;
		}
	`;
  document.head.appendChild(style);
  document.documentElement.style.setProperty("--sclient-accent", getAccent());
}

function seekTo(seconds) {
  if (!currentDuration) return;
  const bar = document.querySelector(".playbackTimeline__progressWrapper");
  if (!bar) return;

  const percentage = Math.min(Math.max(seconds / currentDuration, 0), 1);
  const rect = bar.getBoundingClientRect();
  const x = rect.left + rect.width * percentage;
  const y = rect.top + rect.height / 2;

  bar.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y })
  );
  bar.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y })
  );
}

function updateLyricsUI(pos) {
  if (!lyricsOpen || !currentSyncedLyrics.length) return;

  const effectivePos = pos + lyricsOffset;
  const activeIdx = currentSyncedLyrics.findLastIndex((l) => effectivePos >= l.start - 0.1);
  const lineEls = document.querySelectorAll(".sclient-lyric-line");
  const accent = getAccent();

  if (activeIdx !== currentHighlightedIndex) {
    if (currentHighlightedIndex >= 0 && currentHighlightedIndex < lineEls.length) {
      lineEls[currentHighlightedIndex].querySelectorAll(".sclient-lyric-word").forEach((w) => {
        w.classList.remove("sung");
        w.style.background = "";
        w.style.webkitBackgroundClip = "";
        w.style.backgroundClip = "";
        w.style.color = "";
      });
    }
    currentHighlightedIndex = activeIdx;
    lineEls.forEach((el, i) => {
      if (i === activeIdx) {
        const hasWords = el.querySelector(".sclient-lyric-word");
        el.style.cssText = `transition: transform 0.4s ease, font-size 0.4s ease, opacity 0.4s ease, filter 0.4s ease; font-size: 16px; transform-origin: center; color: ${hasWords ? "#fff" : accent}; font-weight: bold; transform: scale(1.1); opacity: 1; filter: blur(0px);`;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (i < activeIdx) {
        el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: #888; font-weight: normal; transform: scale(0.95); opacity: 0.4; filter: blur(2px);`;
      } else {
        el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: #fff; font-weight: normal; transform: scale(0.95); opacity: 1; filter: blur(0px);`;
      }
    });
  }

  if (activeIdx >= 0 && activeIdx < lineEls.length) {
    const lineEl = lineEls[activeIdx];
    const words = lineEl.querySelectorAll(".sclient-lyric-word");

    if (words.length > 0) {
      words.forEach((wEl) => {
        const wStart = parseFloat(wEl.getAttribute("data-start"));
        const wEnd = parseFloat(wEl.getAttribute("data-end"));
        if (effectivePos >= wEnd) {
          wEl.classList.add("sung");
          wEl.style.background = "";
          wEl.style.webkitBackgroundClip = "";
          wEl.style.backgroundClip = "";
          wEl.style.color = "";
        } else if (effectivePos >= wStart) {
          wEl.classList.remove("sung");
          const wp = Math.min(1, (effectivePos - wStart) / (wEnd - wStart));
          const pct = (wp * 100).toFixed(1);
          wEl.style.background = `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, #fff ${pct}%, #fff 100%)`;
          wEl.style.webkitBackgroundClip = "text";
          wEl.style.backgroundClip = "text";
          wEl.style.color = "transparent";
        } else {
          wEl.classList.remove("sung");
          wEl.style.background = "";
          wEl.style.webkitBackgroundClip = "";
          wEl.style.backgroundClip = "";
          wEl.style.color = "";
        }
      });
    }
  }
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--sc-border); padding-bottom: 10px;">
      <h3 style="margin: 0; font-size: var(--sc-text-xl); font-weight: 600; color: var(--sc-accent);">Lyrics</h3>
      <div style="display: flex; align-items: center; gap: 15px;">
        <div id="sclient-lyrics-offset-container" style="display: none; align-items: center; gap: 8px; font-size: var(--sc-text-sm); color: var(--sc-text-muted);">
           <span id="sclient-lyrics-offset-val" style="min-width: 32px; text-align: right;">0.0s</span>
           <input type="range" id="sclient-lyrics-offset-slider" min="-2" max="2" step="0.1" value="0" style="width: 70px; accent-color: var(--sc-accent); cursor: pointer;">
        </div>
        <button id="sclient-lyrics-close-btn" class="sc-btn sc-btn-ghost" style="padding: 4px 8px; font-size: var(--sc-text-xl);">&times;</button>
      </div>
    </div>
    <div id="sclient-lyrics-content" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; font-size: var(--sc-text-base); line-height: 1.6; white-space: pre-wrap; color: var(--sc-text-main);">
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

function renderLineWords(line) {
  if (line.words && line.words.length > 0) {
    return line.words
      .map((w) => `<span class="sclient-lyric-word" data-start="${w.start / 1000}" data-end="${w.end / 1000}">${esc(w.text)}</span>`)
      .join("");
  }
  return esc((line.text || "").trim() || " ");
}

async function doFetch(artist, title) {
  lyricsTrack = artist + " - " + title;
  const key = lyricsTrack;
  const safe = esc(title);
  const safeArtist = esc(artist);

  const content = document.getElementById("sclient-lyrics-content");
  if (content)
    content.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">Fetching lyrics for<br><b>${safeArtist} - ${safe}</b>...<br><button id="sclient-lyrics-manual-now" class="sc-btn sc-btn-primary" style="margin-top:14px;">Enter manually</button></div>`;

  const abortCtrl = new AbortController();
  currentFetchAbort = abortCtrl;
  const manualNow = document.getElementById("sclient-lyrics-manual-now");
  if (manualNow)
    manualNow.addEventListener("click", () => {
      abortCtrl.abort();
      currentFetchAbort = null;
      renderManual(artist, title);
    });

  try {
    const res = await fetch(
      `https://api.lrcmux.dev/get?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&level=word&format=json`,
      { signal: abortCtrl.signal }
    );
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();

    if (content && lyricsTrack === key) {
      currentSyncedLyrics = [];
      currentHighlightedIndex = -1;
      lyricsOffset = 0;
      const offsetContainer = document.getElementById("sclient-lyrics-offset-container");

      const hasSync = data.lines?.length > 0 && data.meta?.level !== "none";

      if (hasSync) {
        if (offsetContainer) {
          offsetContainer.style.display = "flex";
          document.getElementById("sclient-lyrics-offset-slider").value = 0;
          document.getElementById("sclient-lyrics-offset-val").innerText = "0.0s";
        }
        let html = `<div id="sclient-lyrics-lines" style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 50vh 15px 50vh 15px;">`;
        for (const line of data.lines) {
          if (line.start === undefined || line.end === undefined) continue;
          const start = line.start / 1000;
          const end = line.end / 1000;
          html += `<div class="sclient-lyric-line" data-start="${start}" data-end="${end}" style="transition: transform 0.4s ease, font-size 0.4s ease, opacity 0.4s ease, filter 0.4s ease; font-size: 16px; color: #fff; transform: scale(0.95); transform-origin: center; cursor: pointer;">${renderLineWords(line)}</div>`;
          currentSyncedLyrics.push({ start, end, words: line.words || null });
        }
        content.innerHTML = html + `</div>`;

        document.getElementById("sclient-lyrics-lines").addEventListener("click", (e) => {
          const lineEl = e.target.closest(".sclient-lyric-line");
          if (!lineEl) return;
          const wordEl = e.target.closest(".sclient-lyric-word");
          const t = parseFloat(wordEl ? wordEl.getAttribute("data-start") : lineEl.getAttribute("data-start"));
          if (!isNaN(t)) {
            const targetPos = Math.max(0, t - lyricsOffset);
            seekTo(targetPos);
            lastKnownPosition = targetPos;
            lastUpdateTime = Date.now();
            currentHighlightedIndex = -999;
            updateLyricsUI(targetPos);
          }
        });
      } else if (data.lines && data.lines.length > 0) {
        const linesHtml = data.lines
          .map((l) => `<div style="font-size: 16px; color: #fff;">${esc((l.text || "").trim() || " ")}</div>`)
          .join("");
        content.innerHTML = `<div style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 0 15px 20px 15px;">${linesHtml}</div>`;
        if (offsetContainer) offsetContainer.style.display = "none";
      } else {
        renderManual(artist, title);
        if (offsetContainer) offsetContainer.style.display = "none";
      }
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
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
      <input type="text" id="sclient-lyrics-manual-artist" class="sc-input" placeholder="Artist" value="${esc(artist)}" style="width: 90%; margin-bottom: 5px; font-size:var(--sc-text-sm);">
      <input type="text" id="sclient-lyrics-manual-title" class="sc-input" placeholder="Title" value="${esc(title)}" style="width: 90%; margin-bottom: 5px; font-size:var(--sc-text-sm);">
      <button id="sclient-lyrics-manual-search" class="sc-btn sc-btn-primary" style="width: 90%;">Search</button>
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

  if (typeof currentTrackData !== "undefined" && currentTrackData) {
    title = currentTrackData.title || "";
    artist =
      (currentTrackData.publisher_metadata && currentTrackData.publisher_metadata.artist) ||
      (currentTrackData.user && currentTrackData.user.username) ||
      "";
  }

  if (!title || !artist) {
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      title = title || navigator.mediaSession.metadata.title || "";
      artist = artist || navigator.mediaSession.metadata.artist || "";
    }
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
