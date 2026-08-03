const CHART_COLORS = [
  "#33b5e5",
  "#6699cc",
  "#9977aa",
  "#bb66aa",
  "#dd5588",
  "#00C851",
  "#007E33",
  "#ffbb33",
  "#ff8800",
  "#CC0000",
  "#ff7733",
  "#ff9966",
  "#ffbb99",
  "#ffddcc",
];

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function getGenre(track) {
  return track.genre && track.genre.trim() ? track.genre : "Unknown";
}

class StatsFeature extends Feature {
  get featureKey() {
    return "stats.local_tracking";
  }
  get settingsCategory() {
    return "stats";
  }
  get settingsLabel() {
    return "Listening Stats";
  }
  get apiSyncEnabled() {
    return !!SCLIENT_CONFIG.statsApiSync;
  }
  settingsCustom() {
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
        <button id="sclient-stats-open-btn" class="sclient-btn sclient-btn-primary">Open Stats</button>
        <span id="sclient-stats-status" style="font-size:10px;font-weight:bold;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#666;">--</span>
      </div>
    `;
  }

  constructor() {
    super();
    this.unsubscribePlayback = null;
    this.credTimer = null;
    this.credRetries = 0;
    this.activeCharts = [];
    this.currentSource = "";
    this.currentLimit = 20;
    this.currentDays = null;
    this.trackData = null;
    this.hasRecorded = false;
    this.startTime = 0;
    this.threshold = 0;
    this.lastText = "Waiting...";
    this.lastColor = "#ccc";
  }

  isEnabled() {
    return !!(SCLIENT_CONFIG.statsLocalTracking || SCLIENT_CONFIG.statsApiSync);
  }

  destroyCharts() {
    this.activeCharts.forEach((c) => {
      try {
        c.destroy();
      } catch (e) {}
    });
    this.activeCharts = [];
  }

  setStatus(text, color) {
    this.lastText = text;
    this.lastColor = color || "#ccc";
    const el = document.getElementById("sclient-stats-status");
    if (el) {
      el.textContent = text;
      el.style.color = this.lastColor;
    }
  }

  refreshStatus() {
    this.setStatus(this.lastText, this.lastColor);
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.credRetries = 0;
    this.credTimer = setInterval(async () => {
      this.credRetries++;
      if (this.credRetries > 30) {
        clearInterval(this.credTimer);
        this.credTimer = null;
        return;
      }
      await this.extractAndSendCredentials();
      if (extractClientId() && extractOAuthToken()) {
        clearInterval(this.credTimer);
        this.credTimer = null;
      }
    }, 2000);

    if (SCLIENT_CONFIG.statsLocalTracking) {
      this.trackData = null;
      this.hasRecorded = false;
      this.startTime = 0;
      this.threshold = 0;
      this.lastText = "Waiting...";
      this.lastColor = "#ccc";

      this.unsubscribePlayback = onPlaybackChange((evt) => {
        if (evt.type === "none") {
          this.setStatus("Waiting...", "#ccc");
          return;
        }

        if (evt.type === "track_start") {
          this.trackData = evt.trackData;
          this.hasRecorded = false;
          this.startTime = evt.timestamp;
          if (evt.trackData) {
            this.threshold = Math.min(evt.trackData.duration / 1000 / 2, 240) * 1000;
            if (evt.isPlaying) this.setStatus("Listening...", "#789cff");
          } else {
            this.trackData = null;
          }
          return;
        }

        if (this.trackData && evt.isPlaying) {
          if (!this.hasRecorded && evt.timestamp - this.startTime >= this.threshold) {
            this.record(this.trackData, Date.now());
            this.hasRecorded = true;
          } else if (!this.hasRecorded) {
            this.setStatus("Listening...", "#789cff");
          }
        } else if (!evt.isPlaying && this.trackData) {
          this.setStatus(this.hasRecorded ? "Recorded!" : "Paused", this.hasRecorded ? "#5f5" : "#f9a826");
        }
      });
    }
  }

  destroy() {
    if (this.unsubscribePlayback) {
      this.unsubscribePlayback();
      this.unsubscribePlayback = null;
    }
    if (this.credTimer) {
      clearInterval(this.credTimer);
      this.credTimer = null;
    }
    this.credRetries = 0;
    this.destroyCharts();
    const overlay = document.getElementById("sclient-stats-overlay");
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    super.destroy();
  }

  async extractAndSendCredentials() {
    const cid = extractClientId();
    const tok = extractOAuthToken();
    if (cid && tok)
      await sendBridge("stats_store_credentials", {
        clientId: cid,
        oauthToken: tok,
      });
  }

  async record(t, ts) {
    try {
      const artist = getArtistFromTrack(t);
      const publisher =
        (t.publisher_metadata &&
          (t.publisher_metadata.publisher || t.publisher_metadata.writer_composer)) ||
        (t.user && (t.user.username || t.user.full_name)) ||
        t.label_name ||
        (t.publisher_metadata && t.publisher_metadata.artist) ||
        null;

      await sendBridge("stats_record_listen", {
        played_at: ts,
        track_id: t.id,
        track: {
          id: t.id,
          title: t.title || null,
          genre: getGenre(t),
          duration: t.duration || 0,
          artist: artist !== "Unknown" ? artist : null,
          publisher: publisher,
        },
      });
      this.setStatus("Recorded!", "#5f5");
    } catch (e) {
      console.error("[SClient] Stats record listen failed:", e);
      this.setStatus("Error", "#f55");
    }
  }

  renderFilterBar() {
    const btn = (label, source) => {
      const active = this.currentSource === source;
      return `<button class="sclient-btn ${active ? "sclient-btn-primary" : ""}" data-source="${source}">${label}</button>`;
    };
    return `<div style="display: flex; gap: 8px; margin-bottom: 20px;">${btn("All", "")}${btn("History", "api")}${btn("Local", "local")}</div>`;
  }

  wireFilters() {
    document.querySelectorAll("#sclient-stats-content .sclient-btn[data-source]").forEach((b) => {
      b.addEventListener("click", () => {
        this.currentSource = b.dataset.source;
        this.renderAnalytics();
      });
    });
  }

  upsertChart(id, index, config) {
    const existing = index < this.activeCharts.length ? this.activeCharts[index] : null;
    if (existing && existing.canvas && existing.canvas.id === id) {
      existing.data = config.data;
      existing.options = config.options;
      existing.update();
      return existing;
    }
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    const chart = new Chart(ctx, config);
    if (index < this.activeCharts.length) {
      this.activeCharts[index].destroy();
      this.activeCharts[index] = chart;
    } else this.activeCharts.push(chart);
    return chart;
  }

  async renderAnalytics() {
    const content = document.getElementById("sclient-stats-content");
    if (!content) return;

    let data;
    try {
      data = await sendBridge("stats_get_data", {
        source: this.currentSource || undefined,
      });
    } catch (e) {
      content.innerHTML =
        this.renderFilterBar() +
        `<div style="text-align:center; margin-top:60px; opacity:0.6;">Failed to load stats: ${e.message}</div>`;
      this.wireFilters();
      return;
    }

    if (!data || data.length === 0) {
      content.innerHTML =
        this.renderFilterBar() +
        `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; margin-top:80px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-column-icon lucide-chart-column" style="opacity:0.3; margin-bottom:16px;"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        <div style="font-size:18px; font-weight:600; margin-bottom:8px; opacity:0.7;">No listening data yet</div>
        <div style="font-size:13px; opacity:0.4;">Play some music and it'll show up here!</div>
      </div>`;
      this.wireFilters();
      return;
    }

    let entries = data.map((d) => {
      let track;
      try {
        track = typeof d.track_json === "string" ? JSON.parse(d.track_json) : d.track_json;
      } catch (e) {
        track = {};
      }
      return { played_at: d.played_at, track_id: d.track_id, track };
    });

    if (this.currentDays) {
      const cutoff = Date.now() - this.currentDays * 86400000;
      entries = entries.filter((e) => e.played_at >= cutoff);
    }

    if (entries.length === 0) {
      content.innerHTML =
        this.renderFilterBar() +
        `
      <div style="text-align:center; margin-top:80px;">
        <div style="font-size:18px; font-weight:600; margin-bottom:8px; opacity:0.7;">No data in selected time range</div>
        <div style="font-size:13px; opacity:0.4;">Try a wider time range</div>
      </div>`;
      this.wireFilters();
      return;
    }

    const totalPlays = entries.length;
    const totalDuration = entries.reduce((s, e) => s + (e.track.duration || 0), 0);
    const uniqueArtists = new Set(entries.map((e) => getArtistFromTrack(e.track))).size;
    const uniqueTracks = new Set(entries.map((e) => e.track_id)).size;

    const artistCounts = {};
    entries.forEach((e) => {
      const a = getArtistFromTrack(e.track);
      artistCounts[a] = (artistCounts[a] || 0) + 1;
    });
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const trackCounts = {};
    entries.forEach((e) => {
      const k = e.track_id;
      if (!trackCounts[k])
        trackCounts[k] = {
          count: 0,
          title: e.track.title || "Unknown",
          artist: getArtistFromTrack(e.track),
        };
      trackCounts[k].count++;
    });
    const topTracks = Object.values(trackCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const genreCounts = {};
    entries.forEach((e) => {
      const g = getGenre(e.track);
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    const hourCounts = new Array(24).fill(0);
    entries.forEach((e) => {
      hourCounts[new Date(e.played_at).getHours()]++;
    });

    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts = new Array(7).fill(0);
    entries.forEach((e) => {
      dayCounts[new Date(e.played_at).getDay()]++;
    });

    const recent = this.currentLimit === "all" ? entries : entries.slice(0, this.currentLimit);
    const accent = getAccent();
    const colors = [accent, ...CHART_COLORS];

    const html = `
    <style>
      #sclient-stats-content { scrollbar-width: thin; scrollbar-color: var(--sclient-border) transparent; }
      #sclient-stats-content::-webkit-scrollbar { width: 6px; }
      #sclient-stats-content::-webkit-scrollbar-track { background: transparent; }
      #sclient-stats-content::-webkit-scrollbar-thumb { background: var(--sclient-border); border-radius: 3px; }
      .stats-card { background: var(--sclient-btn-bg); border: 1px solid var(--sclient-border); border-radius: var(--sclient-radius-xl); padding: 18px 20px; }
      .stats-card-value { font-size: 28px; font-weight: 700; color: var(--sclient-accent); font-family: var(--sclient-font-sans); }
      .stats-card-label { font-size: var(--sclient-text-xs); color: var(--sclient-text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-family: var(--sclient-font-sans); }
      .stats-chart-box { background: var(--sclient-btn-bg); border: 1px solid var(--sclient-border); border-radius: var(--sclient-radius-xl); padding: 20px; }
      .stats-chart-title { font-size: var(--sclient-text-base); font-weight: 600; color: var(--sclient-text-main); margin-bottom: 14px; font-family: var(--sclient-font-sans); }
      .stats-table { width: 100%; border-collapse: collapse; font-size: var(--sclient-text-base); font-family: var(--sclient-font-sans); }
      .stats-table th { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--sclient-border); color: var(--sclient-text-muted); font-weight: 600; font-size: var(--sclient-text-xs); text-transform: uppercase; letter-spacing: 0.5px; }
      .stats-table td { padding: 8px 12px; border-bottom: 1px solid var(--sclient-border); }
      .stats-table tr:hover td { background: var(--sclient-btn-bg-hover); }
    </style>
    ${this.renderFilterBar()}
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
      <div class="stats-card"><div class="stats-card-value">${fmtCount(totalPlays)}</div><div class="stats-card-label">Total Plays</div></div>
      <div class="stats-card"><div class="stats-card-value">${fmtDuration(totalDuration)}</div><div class="stats-card-label">Listening Time</div></div>
      <div class="stats-card"><div class="stats-card-value">${fmtCount(uniqueArtists)}</div><div class="stats-card-label">Unique Artists</div></div>
      <div class="stats-card"><div class="stats-card-value">${fmtCount(uniqueTracks)}</div><div class="stats-card-label">Unique Tracks</div></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
      <div class="stats-chart-box"><div class="stats-chart-title">Top Artists</div><div style="height: 350px;"><canvas id="sclient-chart-artists"></canvas></div></div>
      <div class="stats-chart-box"><div class="stats-chart-title">Top Tracks</div><div style="height: 350px;"><canvas id="sclient-chart-tracks"></canvas></div></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
      <div class="stats-chart-box"><div class="stats-chart-title">Top Genres</div><div style="height: 300px; display: flex; align-items: center; justify-content: center;"><canvas id="sclient-chart-genres" style="max-width: 300px; max-height: 300px;"></canvas></div></div>
      <div class="stats-chart-box"><div class="stats-chart-title">Listening by Hour</div><div style="height: 300px;"><canvas id="sclient-chart-hours"></canvas></div></div>
    </div>
    <div class="stats-chart-box" style="margin-bottom: 24px;"><div class="stats-chart-title">Listening by Day</div><div style="height: 200px;"><canvas id="sclient-chart-days"></canvas></div></div>
    <div class="stats-chart-box">
      <div class="stats-chart-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Recent Plays</span>
        <select id="sclient-stats-limit-select" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #aaa; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-family: Inter, sans-serif; cursor: pointer; outline: none;">
          <option value="20" ${this.currentLimit === 20 ? "selected" : ""}>20</option>
          <option value="50" ${this.currentLimit === 50 ? "selected" : ""}>50</option>
          <option value="100" ${this.currentLimit === 100 ? "selected" : ""}>100</option>
          <option value="all" ${this.currentLimit === "all" ? "selected" : ""}>All</option>
        </select>
      </div>
      <div style="overflow-x: auto;">
        <table class="stats-table">
          <thead><tr><th>Time</th><th>Track</th><th>Artist</th><th>Genre</th><th>Duration</th></tr></thead>
          <tbody>
            ${recent
              .map(
                (e) => `
              <tr>
                <td style="white-space: nowrap; color: #888;">${new Date(e.played_at).toLocaleString()}</td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.track.title || "Unknown"}</td>
                <td style="color: #aaa;">${getArtistFromTrack(e.track)}</td>
                <td style="color: #888;">${getGenre(e.track)}</td>
                <td style="color: #888;">${fmtDuration(e.track.duration || 0)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

    this.destroyCharts();
    content.innerHTML = html;
    this.wireFilters();

    const limitSel = document.getElementById("sclient-stats-limit-select");
    if (limitSel) {
      limitSel.addEventListener("change", () => {
        this.currentLimit = limitSel.value === "all" ? "all" : parseInt(limitSel.value);
        this.renderAnalytics();
      });
    }

    if (typeof Chart === "undefined") return;

    const isLight = document.body.classList.contains("theme-light");
    Chart.defaults.color = isLight ? "#444" : "#888";
    Chart.defaults.borderColor = isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.06)";
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";

    this.upsertChart("sclient-chart-artists", 0, {
      type: "bar",
      indexAxis: "y",
      data: {
        labels: topArtists.map((a) => a[0]),
        datasets: [
          {
            label: "Plays",
            data: topArtists.map((a) => a[1]),
            backgroundColor: topArtists.map((_, i) => colors[i % colors.length] + "99"),
            borderColor: topArtists.map((_, i) => colors[i % colors.length]),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: { precision: 0 },
          },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });

    this.upsertChart("sclient-chart-tracks", 1, {
      type: "bar",
      indexAxis: "y",
      data: {
        labels: topTracks.map((t) => (t.title.length > 30 ? t.title.slice(0, 30) + "..." : t.title)),
        datasets: [
          {
            label: "Plays",
            data: topTracks.map((t) => t.count),
            backgroundColor: topTracks.map((_, i) => colors[i % colors.length] + "99"),
            borderColor: topTracks.map((_, i) => colors[i % colors.length]),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: { precision: 0 },
          },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });

    const otherSum = topGenres.slice(10).reduce((s, g) => s + g[1], 0);
    const genreLabels = topGenres.slice(0, 10).map((g) => g[0]);
    const genreData = topGenres.slice(0, 10).map((g) => g[1]);
    if (otherSum > 0) {
      genreLabels.push("Other");
      genreData.push(otherSum);
    }

    this.upsertChart("sclient-chart-genres", 2, {
      type: "doughnut",
      data: {
        labels: genreLabels,
        datasets: [
          {
            data: genreData,
            backgroundColor: genreLabels.map((_, i) => colors[i % colors.length] + "CC"),
            borderColor: "rgba(10,10,10,0.5)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "right",
            labels: {
              padding: 12,
              font: { size: 11 },
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
        },
      },
    });

    this.upsertChart("sclient-chart-hours", 3, {
      type: "bar",
      data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [
          {
            label: "Plays",
            data: hourCounts,
            backgroundColor: accent + "88",
            borderColor: accent,
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, maxTicksLimit: 12 },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: { precision: 0 },
          },
        },
      },
    });

    this.upsertChart("sclient-chart-days", 4, {
      type: "bar",
      data: {
        labels: DAYS,
        datasets: [
          {
            label: "Plays",
            data: dayCounts,
            backgroundColor: DAYS.map((_, i) => colors[i % colors.length] + "88"),
            borderColor: DAYS.map((_, i) => colors[i % colors.length]),
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: { precision: 0 },
          },
        },
      },
    });
  }

  toggle() {
    const settings = document.getElementById("sclient-settings-overlay");
    if (settings) settings.style.right = "-450px";

    const lyrics = document.getElementById("sclient-lyrics-sidebar");
    if (lyrics) lyrics.style.left = "-400px";

    const overlay = document.getElementById("sclient-stats-overlay");
    if (overlay) {
      overlay.style.display = overlay.style.display === "flex" ? "none" : "flex";
      if (overlay.style.display === "flex") {
        this.currentSource = "";
        this.renderAnalytics();
      }
      return;
    }

    this.createAnalyticsOverlay();
    document.getElementById("sclient-stats-overlay").style.display = "flex";
    this.currentSource = "";
    this.renderAnalytics();
  }

  createAnalyticsOverlay() {
    if (document.getElementById("sclient-stats-overlay")) return;

    const accent = getAccent();
    const overlay = document.createElement("div");
    overlay.id = "sclient-stats-overlay";
    overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: var(--sclient-bg-surface); backdrop-filter: blur(15px);
    z-index: 9999998; display: none; flex-direction: column;
    color: var(--sclient-text-main); font-family: var(--sclient-font-sans);
  `;

    overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;">
      <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: ${accent}; display: flex; align-items: center; gap: 10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-column-icon lucide-chart-column"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        Listening Analytics
      </h2>
      <div style="display: flex; align-items: center; gap: 12px;">
        <select id="sclient-stats-days-select" class="sclient-select">
          <option value="">All time</option>
          <option value="1">Last 24h</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="365">Last year</option>
        </select>
        <button id="sclient-stats-export-btn" class="sclient-btn" title="Export Stats DB">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database-arrow-down"><path d="m16 19 3 3 3-3"/><path d="M19 16v6"/><path d="M21 12.536V5"/><path d="M3 12A9 3 0 0 0 15.182 14.806"/><path d="M3 5V19A9 3 0 0 0 13.318 21.968"/><ellipse cx="12" cy="5" rx="9" ry="3"/></svg>
        </button>
        <button id="sclient-stats-import-btn" class="sclient-btn" title="Import Stats DB">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-database-arrow-up"><path d="M19 22v-6"/><path d="M21 12.536V5"/><path d="m22 19-3-3-3 3"/><path d="M3 12A9 3 0 0 0 14.457 14.886"/><path d="M3 5V19A9 3 0 0 0 13.318 21.968"/><ellipse cx="12" cy="5" rx="9" ry="3"/></svg>
        </button>
        <button id="sclient-stats-close-btn" class="sclient-btn" style="display:flex;align-items:center;gap:6px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Close</button>
      </div>
    </div>
    <div id="sclient-stats-content" style="flex: 1; overflow-y: auto; padding: 20px 30px 30px;">
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.5; font-size: 16px;">Loading data...</div>
    </div>
  `;

    document.body.appendChild(overlay);

    const onEsc = (e) => {
      if (e.key === "Escape") close();
    };
    this.on(document, "keydown", onEsc);

    const close = () => {
      overlay.style.display = "none";
      this.destroyCharts();
      document.removeEventListener("keydown", onEsc);
    };

    document.getElementById("sclient-stats-close-btn").addEventListener("click", close);

    document.getElementById("sclient-stats-days-select").addEventListener("change", () => {
      const val = document.getElementById("sclient-stats-days-select").value;
      this.currentDays = val ? parseInt(val) : null;
      this.renderAnalytics();
    });

    document.getElementById("sclient-stats-export-btn").addEventListener("click", async () => {
      try {
        await sendBridge("stats_export_db");
        if (typeof showToast !== "undefined") showToast("Stats exported successfully");
      } catch (e) {
        if (e.message !== "cancelled" && e.message !== "Error: cancelled") {
          if (typeof showToast !== "undefined") showToast("Export failed: " + e.message);
        }
      }
    });

    document.getElementById("sclient-stats-import-btn").addEventListener("click", async () => {
      try {
        const filePath = await sendBridge("stats_pick_import_file");
        if (!filePath) return;

        let overwrite = false;
        if (typeof showConfirm !== "undefined") {
          const choice = await showConfirm(
            "You selected a database file to import.\n\nDo you want to completely overwrite your existing stats, or merge them together?",
            [
              { id: "cancel", text: "Cancel", type: "secondary" },
              { id: "merge", text: "Merge", type: "primary" },
              { id: "overwrite", text: "Overwrite", type: "danger" },
            ]
          );
          if (choice === "cancel" || choice === false) return;
          overwrite = choice === "overwrite";
        }

        await sendBridge("stats_execute_import", { filePath, overwrite });
        if (typeof showToast !== "undefined") showToast("Stats imported successfully");
        this.renderAnalytics();
      } catch (e) {
        if (e.message !== "cancelled" && e.message !== "Error: cancelled") {
          if (typeof showToast !== "undefined") showToast("Import failed: " + e.message);
        }
      }
    });
  }
}

const STATS_FEATURE = new StatsFeature();
FEATURES.push(STATS_FEATURE);
