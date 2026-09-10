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
        activeMedia =
          media.find((m) => !m.paused && m.duration > 0) || media[0];
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
    const activeIdx = this.currentSyncedLyrics.findLastIndex(
      (l) => effectivePos >= l.start - 0.1,
    );
    const lineEls = document.querySelectorAll(".sclient-lyric-line");

    if (activeIdx !== this.currentHighlightedIndex) {
      this.currentHighlightedIndex = activeIdx;
      lineEls.forEach((el, i) => {
        el.classList.toggle("active", i === activeIdx);
        el.classList.toggle("past", i < activeIdx);
        if (i === activeIdx) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          el.querySelectorAll(".sclient-lyric-word").forEach((w) => {
            w.classList.remove("sung");
            w.style.background = "";
            w.style.webkitBackgroundClip = "";
            w.style.backgroundClip = "";
            w.style.color = "";
          });
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
            wEl.style.background = `linear-gradient(to right, var(--sclient-accent) 0%, var(--sclient-accent) ${pct}%, var(--sclient-text-main) ${pct}%, var(--sclient-text-main) 100%)`;
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

    sidebar.innerHTML = `
    <div class="sclient-lyrics-header">
      <h3 class="sclient-lyrics-title">Lyrics</h3>
      <div class="sclient-lyrics-tools">
        <button id="sclient-lyrics-romanize-btn" class="sclient-icon-btn" title="Romanize lyrics">
          ${lucideIcon("languages", 14)}
        </button>
        <div id="sclient-lyrics-offset-container" class="sclient-lyrics-offset">
           <span id="sclient-lyrics-offset-val" class="sclient-lyrics-offset-val">0.0s</span>
           <input type="range" id="sclient-lyrics-offset-slider" min="-2" max="2" step="0.1" value="0">
        </div>
        <button id="sclient-lyrics-close-btn" class="sclient-icon-btn visible" title="Close">
          ${lucideIcon("x")}
        </button>
      </div>
    </div>
    <div id="sclient-lyrics-content">
      <div class="sclient-lyrics-empty">Open a song to load lyrics</div>
    </div>
  `;

    document.body.appendChild(sidebar);

    this.on(document.getElementById("sclient-lyrics-close-btn"), "click", () =>
      this.toggleLyrics(),
    );

    this.on(
      document.getElementById("sclient-lyrics-offset-slider"),
      "input",
      (e) => {
        this.lyricsOffset = parseFloat(e.target.value);
        document.getElementById("sclient-lyrics-offset-val").innerText =
          (this.lyricsOffset > 0 ? "+" : "") +
          this.lyricsOffset.toFixed(1) +
          "s";
        this.currentHighlightedIndex = -999;
        this.updateLyricsUI(this.currentInterpolatedPos);
      },
    );

    this.on(
      document.getElementById("sclient-lyrics-romanize-btn"),
      "click",
      async () => {
        this.romanizeEnabled = !this.romanizeEnabled;
        document
          .getElementById("sclient-lyrics-romanize-btn")
          .classList.toggle("active", this.romanizeEnabled);
        await this.romanizeAllLines();
      },
    );
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
      results = await sendBridge("romanize", {
        texts: items.map((it) => it.text),
      });
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
    sidebar.classList.toggle("open", this.lyricsOpen);
    if (this.lyricsOpen) this.fetchLyrics();
  }

  renderLineWords(line) {
    if (line.words && line.words.length > 0) {
      return line.words
        .map(
          (w) =>
            `<span class="sclient-lyric-word" data-start="${w.start / 1000}" data-end="${w.end / 1000}">${esc(w.text)}</span>`,
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
      content.innerHTML = `<div class="sclient-lyrics-empty">Fetching lyrics for<br><b>${safeArtist} - ${safe}</b>...<br><button id="sclient-lyrics-manual-now" class="sclient-btn sclient-btn-primary sclient-lyrics-manual-trigger">Enter manually</button></div>`;

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
        { signal: abortCtrl.signal },
      );
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();

      if (content && this.lyricsTrack === key) {
        this.currentSyncedLyrics = [];
        this.currentHighlightedIndex = -1;
        this.lyricsOffset = 0;
        const offsetContainer = document.getElementById(
          "sclient-lyrics-offset-container",
        );

        const hasSync = data.lines?.length > 0 && data.meta?.level !== "none";

        if (hasSync) {
          offsetContainer.classList.add("visible");
          document.getElementById("sclient-lyrics-offset-slider").value = 0;
          document.getElementById("sclient-lyrics-offset-val").innerText =
            "0.0s";
          const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
          if (rBtn) rBtn.classList.add("visible");
          let html = `<div id="sclient-lyrics-lines" class="sclient-lyrics-lines">`;
          for (const line of data.lines) {
            if (line.start === undefined || line.end === undefined) continue;
            const start = line.start / 1000;
            const end = line.end / 1000;
            html += `<div class="sclient-lyric-line" data-start="${start}" data-end="${end}">${this.renderLineWords(line)}</div>`;
            this.currentSyncedLyrics.push({
              start,
              end,
              words: line.words || null,
            });
          }
          content.innerHTML = html + `</div>`;

          document
            .getElementById("sclient-lyrics-lines")
            .addEventListener("click", (e) => {
              const lineEl = e.target.closest(".sclient-lyric-line");
              if (!lineEl) return;
              const wordEl = e.target.closest(".sclient-lyric-word");
              const t = parseFloat(
                wordEl
                  ? wordEl.getAttribute("data-start")
                  : lineEl.getAttribute("data-start"),
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
            .map((l) => `<div>${esc((l.text || "").trim() || " ")}</div>`)
            .join("");
          content.innerHTML = `<div class="sclient-lyrics-plain">${linesHtml}</div>`;
          offsetContainer.classList.remove("visible");
          const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
          if (rBtn) rBtn.classList.remove("visible");
        } else {
          this.renderManual(artist, title);
          offsetContainer.classList.remove("visible");
          const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
          if (rBtn) rBtn.classList.remove("visible");
        }
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
      if (content && this.lyricsTrack === key) {
        const offsetContainer = document.getElementById(
          "sclient-lyrics-offset-container",
        );
        if (offsetContainer) offsetContainer.classList.remove("visible");
        const rBtn = document.getElementById("sclient-lyrics-romanize-btn");
        if (rBtn) rBtn.classList.remove("visible");
        this.renderManual(artist, title);
      }
    }
  }

  renderManual(artist, title) {
    const content = document.getElementById("sclient-lyrics-content");
    if (!content) return;

    content.innerHTML = `
    <div class="sclient-lyrics-empty">No lyrics found for this track.</div>
    <div class="sclient-lyrics-manual">
      <div class="sclient-lyrics-manual-label">Try manually:</div>
      <input type="text" id="sclient-lyrics-manual-artist" class="sclient-input" placeholder="Artist" value="${esc(artist)}">
      <input type="text" id="sclient-lyrics-manual-title" class="sclient-input" placeholder="Title" value="${esc(title)}">
      <button id="sclient-lyrics-manual-search" class="sclient-btn sclient-btn-primary">Search</button>
    </div>
  `;

    document
      .getElementById("sclient-lyrics-manual-search")
      .addEventListener("click", () => {
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
        (current.trackData.publisher_metadata &&
          current.trackData.publisher_metadata.artist) ||
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
    btn.innerHTML = `<div class="sclient-sc-icon">${lucideIcon("mic-vocal")}</div>`;

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
