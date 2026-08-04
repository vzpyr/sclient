class LyricsFeature extends Feature {
  get featureKey() {
    return "features.show_lyrics";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Show Lyrics Button";
  }

  constructor() {
    super();
    this.lyricsOpen = false;
    this.lyricsTrack = "";
    this.lastTrack = "";
    this.currentLyricsUrl = "";
    this.currentSyncedLyrics = [];
    this.currentHighlightedIndex = -1;
    this.lyricsOffset = 0;
    this.lastKnownPosition = 0;
    this.currentDuration = 0;
    this.isPlaying = false;
    this.lastUpdateTime = Date.now();
    this.currentFetchAbort = null;
    this.romanizeEnabled = false;
    this.currentInterpolatedPos = 0;
    this.rafId = null;
    this.unsubscribePlayback = null;
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.addStyle(
      "sclient-lyrics-style",
      `
		.sclient-lyric-line:hover { 
			opacity: 0.9 !important; 
			transform: scale(1.05) !important; 
			filter: blur(0px) !important;
		}
		.sclient-lyric-word.sung {
			color: var(--sclient-accent, #f50) !important;
		}
		#sclient-lyrics-romanize-btn {
			color: rgba(255,255,255,0.5);
			background: transparent;
		}
		#sclient-lyrics-romanize-btn:hover {
			background: rgba(255,255,255,0.1);
		}
		#sclient-lyrics-romanize-btn.active {
			color: var(--sclient-accent);
		}
	`
    );
    this.unsubscribePlayback = onPlaybackChange((evt) => {
      this.lastKnownPosition = evt.position;
      this.currentDuration = evt.duration;
      this.isPlaying = evt.isPlaying;
      this.lastUpdateTime = Date.now();

      if (this.lyricsOpen && evt.songUrl) {
        if (evt.songUrl !== this.currentLyricsUrl) {
          this.currentLyricsUrl = evt.songUrl;
          this.lastTrack = "";
        }

        if (!this.lastTrack) {
          this.fetchLyrics();
        }
      }
    });
    this.rafId = requestAnimationFrame(() => this.renderLoop());
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.currentFetchAbort) {
      this.currentFetchAbort.abort();
      this.currentFetchAbort = null;
    }
    if (this.unsubscribePlayback) {
      this.unsubscribePlayback();
      this.unsubscribePlayback = null;
    }
    const sidebar = document.getElementById("sclient-lyrics-sidebar");
    if (sidebar && sidebar.parentNode) sidebar.parentNode.removeChild(sidebar);
    this.lyricsOpen = false;
    super.destroy();
  }

  injectUI() {
    this.injectLyricsButton();
  }

  checkInjected() {
    return !!document.getElementById("sclient-lyrics-btn");
  }

  renderLoop() {
    if (this.lyricsOpen && this.currentSyncedLyrics.length) {
      let activeMedia = getActiveMedia();
      if (!activeMedia) {
        const media = Array.from(document.querySelectorAll("audio, video"));
        activeMedia = media.find((m) => !m.paused && m.duration > 0) || media[0];
      }

      if (activeMedia) {
        const liveTime = activeMedia.currentTime;
        if (Math.abs(liveTime - this.currentInterpolatedPos) > 0.4) {
          this.currentInterpolatedPos = liveTime;
        } else if (liveTime > this.currentInterpolatedPos) {
          this.currentInterpolatedPos = liveTime;
        }
      }

      this.updateLyricsUI(this.currentInterpolatedPos);
    }
    this.rafId = requestAnimationFrame(() => this.renderLoop());
  }

  updateLyricsUI(pos) {
    if (!this.lyricsOpen || !this.currentSyncedLyrics.length) return;

    const effectivePos = pos + this.lyricsOffset;
    const activeIdx = this.currentSyncedLyrics.findLastIndex((l) => effectivePos >= l.start - 0.1);
    const lineEls = document.querySelectorAll(".sclient-lyric-line");
    const accent = getAccent();

    if (activeIdx !== this.currentHighlightedIndex) {
      this.currentHighlightedIndex = activeIdx;
      lineEls.forEach((el, i) => {
        if (i === activeIdx) {
          const hasWords = el.querySelector(".sclient-lyric-word");
          el.style.cssText = `transition: transform 0.4s ease, font-size 0.4s ease, opacity 0.4s ease, filter 0.4s ease; font-size: 16px; transform-origin: center; color: ${hasWords ? "var(--sclient-text-main)" : accent}; font-weight: bold; transform: scale(1.1); opacity: 1; filter: blur(0px);`;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          el.querySelectorAll(".sclient-lyric-word").forEach((w) => {
            w.classList.remove("sung");
            w.style.background = "";
            w.style.webkitBackgroundClip = "";
            w.style.backgroundClip = "";
            w.style.color = "";
          });
          if (i < activeIdx) {
            el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: var(--sclient-text-muted); font-weight: normal; transform: scale(0.95); opacity: 0.4; filter: blur(2px);`;
          } else {
            el.style.cssText = `transition: all 0.4s ease; font-size: 16px; transform-origin: center; color: var(--sclient-text-main); font-weight: normal; transform: scale(0.95); opacity: 1; filter: blur(0px);`;
          }
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
            wEl.style.background = `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, var(--sclient-text-main) ${pct}%, var(--sclient-text-main) 100%)`;
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

  createLyricsSidebar() {
    if (document.getElementById("sclient-lyrics-sidebar")) return;

    const sidebar = document.createElement("div");
    sidebar.id = "sclient-lyrics-sidebar";
    sidebar.style.cssText = `
    position: fixed; top: 20px; bottom: 70px; left: -400px; width: 350px;
    background: var(--sclient-bg-surface); backdrop-filter: blur(10px);
    border: 1px solid var(--sclient-border); border-radius: 12px;
    box-shadow: 5px 5px 25px rgba(0,0,0,0.5); z-index: 999999;
    transition: left 0.3s ease; display: flex; flex-direction: column;
    color: var(--sclient-text-main); font-family: var(--sclient-font-sans);
    padding: 20px; box-sizing: border-box;
  `;

    sidebar.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--sclient-border); padding-bottom: 10px;">
      <h3 style="margin: 0; font-size: var(--sclient-text-xl); font-weight: 600; color: var(--sclient-accent);">Lyrics</h3>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="sclient-lyrics-romanize-btn" title="Romanize lyrics" style="display:none; border: none; border-radius: 50%; width: 28px; height: 28px; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background 0.18s;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
        </button>
        <div id="sclient-lyrics-offset-container" style="display: none; align-items: center; gap: 8px; font-size: var(--sclient-text-sm); color: var(--sclient-text-muted);">
           <span id="sclient-lyrics-offset-val" style="min-width: 32px; text-align: right;">0.0s</span>
           <input type="range" id="sclient-lyrics-offset-slider" min="-2" max="2" step="0.1" value="0" style="width: 70px; accent-color: var(--sclient-accent); cursor: pointer;">
        </div>
        <button id="sclient-lyrics-close-btn" class="sclient-btn sclient-btn-ghost" title="Close" style="padding:4px; display:flex; align-items:center; justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
    <div id="sclient-lyrics-content" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; font-size: var(--sclient-text-base); line-height: 1.6; white-space: pre-wrap; color: var(--sclient-text-main);">
      <div style="opacity:0.5; text-align:center; margin-top:20px;">Open a song to load lyrics</div>
    </div>
  `;

    document.body.appendChild(sidebar);

    this.on(document.getElementById("sclient-lyrics-close-btn"), "click", () =>
      this.toggleLyrics()
    );

    this.on(document.getElementById("sclient-lyrics-offset-slider"), "input", (e) => {
      this.lyricsOffset = parseFloat(e.target.value);
      document.getElementById("sclient-lyrics-offset-val").innerText =
        (this.lyricsOffset > 0 ? "+" : "") + this.lyricsOffset.toFixed(1) + "s";
      this.currentHighlightedIndex = -999;
      this.updateLyricsUI(this.currentInterpolatedPos);
    });

    this.on(document.getElementById("sclient-lyrics-romanize-btn"), "click", async () => {
      this.romanizeEnabled = !this.romanizeEnabled;
      document
        .getElementById("sclient-lyrics-romanize-btn")
        .classList.toggle("active", this.romanizeEnabled);
      await this.romanizeAllLines();
    });
  }

  async romanizeAllLines() {
    const content = document.getElementById("sclient-lyrics-content");
    if (!content) return;
    const lineEls = content.querySelectorAll(".sclient-lyric-line");
    if (!lineEls.length) return;

    if (!this.romanizeEnabled) {
      lineEls.forEach((el) => {
        const wordEls = el.querySelectorAll(".sclient-lyric-word");
        if (wordEls.length > 0) {
          wordEls.forEach((wEl) => {
            const orig = wEl.getAttribute("data-orig-text");
            if (orig != null) {
              wEl.textContent = orig;
              wEl.removeAttribute("data-orig-text");
            }
          });
        } else {
          const origText = el.getAttribute("data-orig-text");
          if (origText != null) {
            el.textContent = origText;
            el.removeAttribute("data-orig-text");
          }
        }
      });
      return;
    }

    const items = [];
    lineEls.forEach((el) => {
      const wordEls = el.querySelectorAll(".sclient-lyric-word");
      if (wordEls.length > 0) {
        wordEls.forEach((wEl) => {
          const orig =
            wEl.getAttribute("data-orig-text") != null
              ? wEl.getAttribute("data-orig-text")
              : wEl.textContent;
          wEl.setAttribute("data-orig-text", orig);
          items.push({ wEl, text: orig });
        });
      } else {
        const origText =
          el.getAttribute("data-orig-text") != null
            ? el.getAttribute("data-orig-text")
            : el.textContent;
        el.setAttribute("data-orig-text", origText);
        items.push({ el, text: origText });
      }
    });

    if (!items.length) return;

    let results;
    try {
      results = await sendBridge("romanize", { texts: items.map((it) => it.text) });
    } catch (e) {
      results = items.map((it) => it.text);
    }

    items.forEach((it, i) => {
      const out = results && results[i] != null ? results[i] : it.text;
      if (it.wEl) it.wEl.textContent = out;
      else it.el.textContent = out;
    });
  }

  toggleLyrics() {
    this.createLyricsSidebar();
    const sidebar = document.getElementById("sclient-lyrics-sidebar");
    this.lyricsOpen = !this.lyricsOpen;
    if (this.lyricsOpen) {
      void sidebar.offsetWidth;
      sidebar.style.left = "20px";
      this.fetchLyrics();
    } else {
      sidebar.style.left = "-400px";
    }
  }

  renderLineWords(line) {
    if (line.words && line.words.length > 0) {
      return line.words
        .map(
          (w) =>
            `<span class="sclient-lyric-word" data-start="${w.start / 1000}" data-end="${w.end / 1000}">${esc(w.text)}</span>`
        )
        .join("");
    }
    return esc((line.text || "").trim() || " ");
  }

  async doFetch(artist, title) {
    this.lyricsTrack = artist + " - " + title;
    const key = this.lyricsTrack;
    const safe = esc(title);
    const safeArtist = esc(artist);

    const content = document.getElementById("sclient-lyrics-content");
    if (content)
      content.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">Fetching lyrics for<br><b>${safeArtist} - ${safe}</b>...<br><button id="sclient-lyrics-manual-now" class="sclient-btn sclient-btn-primary" style="margin-top:14px;">Enter manually</button></div>`;

    const abortCtrl = new AbortController();
    this.currentFetchAbort = abortCtrl;
    const manualNow = document.getElementById("sclient-lyrics-manual-now");
    if (manualNow)
      manualNow.addEventListener("click", () => {
        abortCtrl.abort();
        this.currentFetchAbort = null;
        this.renderManual(artist, title);
      });

    try {
      const res = await fetch(
        `https://api.lrcmux.dev/get?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&level=word&format=json`,
        { signal: abortCtrl.signal }
      );
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();

      if (content && this.lyricsTrack === key) {
        this.currentSyncedLyrics = [];
        this.currentHighlightedIndex = -1;
        this.lyricsOffset = 0;
        const offsetContainer = document.getElementById("sclient-lyrics-offset-container");

        const hasSync = data.lines?.length > 0 && data.meta?.level !== "none";

        if (hasSync) {
          if (offsetContainer) {
            offsetContainer.style.display = "flex";
            document.getElementById("sclient-lyrics-offset-slider").value = 0;
            document.getElementById("sclient-lyrics-offset-val").innerText = "0.0s";
          }
          const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
          if (rBtn) rBtn.style.display = "flex";
          let html = `<div id="sclient-lyrics-lines" style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 50vh 15px 50vh 15px;">`;
          for (const line of data.lines) {
            if (line.start === undefined || line.end === undefined) continue;
            const start = line.start / 1000;
            const end = line.end / 1000;
            html += `<div class="sclient-lyric-line" data-start="${start}" data-end="${end}" style="transition: transform 0.4s ease, font-size 0.4s ease, opacity 0.4s ease, filter 0.4s ease; font-size: 16px; color: var(--sclient-text-main); transform: scale(0.95); transform-origin: center; cursor: pointer;">${this.renderLineWords(line)}</div>`;
            this.currentSyncedLyrics.push({ start, end, words: line.words || null });
          }
          content.innerHTML = html + `</div>`;

          document.getElementById("sclient-lyrics-lines").addEventListener("click", (e) => {
            const lineEl = e.target.closest(".sclient-lyric-line");
            if (!lineEl) return;
            const wordEl = e.target.closest(".sclient-lyric-word");
            const t = parseFloat(
              wordEl ? wordEl.getAttribute("data-start") : lineEl.getAttribute("data-start")
            );
            if (!isNaN(t)) {
              const targetPos = Math.max(0, t - this.lyricsOffset);
              seekTo(targetPos);
              this.lastKnownPosition = targetPos;
              this.lastUpdateTime = Date.now();
              this.currentHighlightedIndex = -999;
              this.updateLyricsUI(targetPos);
            }
          });
          if (this.romanizeEnabled) this.romanizeAllLines();
        } else if (data.lines && data.lines.length > 0) {
          const linesHtml = data.lines
            .map(
              (l) =>
                `<div style="font-size: 16px; color: var(--sclient-text-main);">${esc((l.text || "").trim() || " ")}</div>`
            )
            .join("");
          content.innerHTML = `<div style="display: flex; flex-direction: column; gap: 16px; text-align: center; padding: 0 15px 20px 15px;">${linesHtml}</div>`;
          if (offsetContainer) offsetContainer.style.display = "none";
          const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
          if (rBtn) rBtn.style.display = "none";
        } else {
          this.renderManual(artist, title);
          if (offsetContainer) offsetContainer.style.display = "none";
          const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
          if (rBtn) rBtn.style.display = "none";
        }
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
      if (content && this.lyricsTrack === key) {
        const offsetContainer = document.getElementById("sclient-lyrics-offset-container");
        if (offsetContainer) offsetContainer.style.display = "none";
        const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
        if (rBtn) rBtn.style.display = "none";
        this.renderManual(artist, title);
      }
    }
  }

  renderManual(artist, title) {
    const content = document.getElementById("sclient-lyrics-content");
    if (!content) return;

    content.innerHTML = `
    <div style="opacity:0.5; text-align:center; margin-top:20px;">No lyrics found for this track.</div>
    <div style="margin-top: 15px; text-align: center;">
      <div style="margin-bottom: 8px; font-size: 12px; color: #aaa;">Try manually:</div>
      <input type="text" id="sclient-lyrics-manual-artist" class="sclient-input" placeholder="Artist" value="${esc(artist)}" style="width: 90%; margin-bottom: 5px; font-size:var(--sclient-text-sm);">
      <input type="text" id="sclient-lyrics-manual-title" class="sclient-input" placeholder="Title" value="${esc(title)}" style="width: 90%; margin-bottom: 5px; font-size:var(--sclient-text-sm);">
      <button id="sclient-lyrics-manual-search" class="sclient-btn sclient-btn-primary" style="width: 90%;">Search</button>
    </div>
  `;

    document.getElementById("sclient-lyrics-manual-search").addEventListener("click", () => {
      const a = document.getElementById("sclient-lyrics-manual-artist").value;
      const t = document.getElementById("sclient-lyrics-manual-title").value;
      if (a && t) this.doFetch(a, t);
    });
  }

  fetchLyrics() {
    if (!this.lyricsOpen) return;

    let title = "";
    let artist = "";

    const current = getCurrentTrack();
    if (current.trackData) {
      title = current.trackData.title || "";
      artist =
        (current.trackData.publisher_metadata && current.trackData.publisher_metadata.artist) ||
        (current.trackData.user && current.trackData.user.username) ||
        "";
    }

    if (!title || !artist) return;

    const key = artist + " - " + title;
    if (this.lastTrack === key) return;
    this.lastTrack = key;
    this.doFetch(artist, title);
  }

  injectLyricsButton() {
    if (document.getElementById("sclient-lyrics-btn")) return;

    const target = document.querySelector(".playbackSoundBadge__showQueue");
    if (!target || !target.parentNode) {
      this.injected = false;
      return;
    }

    const btn = document.createElement("button");
    btn.id = "sclient-lyrics-btn";
    btn.className =
      "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
    btn.title = "Lyrics";
    btn.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/></svg></div>';

    this.on(btn, "click", (e) => {
      e.preventDefault();
      this.toggleLyrics();
    });

    target.parentNode.insertBefore(btn, target);

    this.cleanup.push(() => {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    });
  }
}

const LYRICS_FEATURE = new LyricsFeature();
FEATURES.push(LYRICS_FEATURE);
