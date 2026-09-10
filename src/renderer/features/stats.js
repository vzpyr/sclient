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
      <div class="sclient-card-custom-row">
        <button id="sclient-stats-open-btn" class="sclient-btn sclient-btn-primary">Open Stats</button>
        <span id="sclient-stats-status" class="sclient-status-pill" data-tone="idle">--</span>
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
    this.lastTone = "idle";
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

  setStatus(text, tone) {
    this.lastText = text;
    this.lastTone = tone || "idle";
    const el = document.getElementById("sclient-stats-status");
    if (el) {
      el.textContent = text;
      el.dataset.tone = this.lastTone;
    }
  }

  refreshStatus() {
    this.setStatus(this.lastText, this.lastTone);
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
      this.lastTone = "idle";

      this.unsubscribePlayback = onPlaybackChange((evt) => {
        if (evt.type === "none") {
          this.setStatus("Waiting...", "idle");
          return;
        }

        if (evt.type === "track_start") {
          this.trackData = evt.trackData;
          this.hasRecorded = false;
          this.startTime = evt.timestamp;
          if (evt.trackData) {
            this.threshold =
              Math.min(evt.trackData.duration / 1000 / 2, 240) * 1000;
            if (evt.isPlaying) this.setStatus("Listening...", "listening");
          } else {
            this.trackData = null;
          }
          return;
        }

        if (this.trackData && evt.isPlaying) {
          if (
            !this.hasRecorded &&
            evt.timestamp - this.startTime >= this.threshold
          ) {
            this.record(this.trackData, Date.now());
            this.hasRecorded = true;
          } else if (!this.hasRecorded) {
            this.setStatus("Listening...", "listening");
          }
        } else if (!evt.isPlaying && this.trackData) {
          this.setStatus(
            this.hasRecorded ? "Recorded!" : "Paused",
            this.hasRecorded ? "recorded" : "paused",
          );
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
          (t.publisher_metadata.publisher ||
            t.publisher_metadata.writer_composer)) ||
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
      this.setStatus("Recorded!", "recorded");
    } catch (e) {
      console.error("[SClient] Couldn't record stats:", e);
      this.setStatus("Error", "error");
    }
  }

  renderFilterBar() {
    const btn = (label, source) => {
      const active = this.currentSource === source;
      return `<button class="sclient-btn ${active ? "sclient-btn-primary" : ""}" data-source="${source}">${label}</button>`;
    };
    return `<div class="stats-filters">${btn("All", "")}${btn("History", "api")}${btn("Local", "local")}</div>`;
  }

  wireFilters() {
    document
      .querySelectorAll("#sclient-stats-content .sclient-btn[data-source]")
      .forEach((b) => {
        b.addEventListener("click", () => {
          this.currentSource = b.dataset.source;
          this.renderAnalytics();
        });
      });
  }

  upsertChart(id, index, config) {
    const existing =
      index < this.activeCharts.length ? this.activeCharts[index] : null;
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
        `<div class="stats-error">Failed to load stats: ${e.message}</div>`;
      this.wireFilters();
      return;
    }

    if (!data || data.length === 0) {
      content.innerHTML =
        this.renderFilterBar() +
        `
      <div class="stats-empty">
        ${lucideIcon("chart-column", 24)}
        <div class="stats-empty-title">No listening data yet</div>
        <div class="stats-empty-sub">Play some music and it'll show up here!</div>
      </div>`;
      this.wireFilters();
      return;
    }

    let entries = data.map((d) => {
      let track;
      try {
        track =
          typeof d.track_json === "string"
            ? JSON.parse(d.track_json)
            : d.track_json;
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
      <div class="stats-empty compact">
        <div class="stats-empty-title">No data in selected time range</div>
        <div class="stats-empty-sub">Try a wider time range</div>
      </div>`;
      this.wireFilters();
      return;
    }

    const totalPlays = entries.length;
    const totalDuration = entries.reduce(
      (s, e) => s + (e.track.duration || 0),
      0,
    );
    const uniqueArtists = new Set(
      entries.map((e) => getArtistFromTrack(e.track)),
    ).size;
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

    const recent =
      this.currentLimit === "all"
        ? entries
        : entries.slice(0, this.currentLimit);
    const accent = getAccent();
    const colors = [accent, ...CHART_COLORS];

    const html = `
    ${this.renderFilterBar()}
    <div class="stats-grid">
      <div class="stats-card"><div class="stats-card-value">${fmtCount(totalPlays)}</div><div class="stats-card-label">Total Plays</div></div>
      <div class="stats-card"><div class="stats-card-value">${fmtDuration(totalDuration)}</div><div class="stats-card-label">Listening Time</div></div>
      <div class="stats-card"><div class="stats-card-value">${fmtCount(uniqueArtists)}</div><div class="stats-card-label">Unique Artists</div></div>
      <div class="stats-card"><div class="stats-card-value">${fmtCount(uniqueTracks)}</div><div class="stats-card-label">Unique Tracks</div></div>
    </div>
    <div class="stats-grid half">
      <div class="stats-chart-box"><div class="stats-chart-title">Top Artists</div><div class="stats-chart-lg"><canvas id="sclient-chart-artists"></canvas></div></div>
      <div class="stats-chart-box"><div class="stats-chart-title">Top Tracks</div><div class="stats-chart-lg"><canvas id="sclient-chart-tracks"></canvas></div></div>
    </div>
    <div class="stats-grid half">
      <div class="stats-chart-box"><div class="stats-chart-title">Top Genres</div><div class="stats-chart-md centered"><canvas id="sclient-chart-genres" class="stats-chart-canvas"></canvas></div></div>
      <div class="stats-chart-box"><div class="stats-chart-title">Listening by Hour</div><div class="stats-chart-md"><canvas id="sclient-chart-hours"></canvas></div></div>
    </div>
    <div class="stats-chart-box"><div class="stats-chart-title">Listening by Day</div><div class="stats-chart-sm"><canvas id="sclient-chart-days"></canvas></div></div>
    <div class="stats-chart-box">
      <div class="stats-chart-title">
        <span>Recent Plays</span>
        <select id="sclient-stats-limit-select" class="sclient-select sclient-select-sm">
          <option value="20" ${this.currentLimit === 20 ? "selected" : ""}>20</option>
          <option value="50" ${this.currentLimit === 50 ? "selected" : ""}>50</option>
          <option value="100" ${this.currentLimit === 100 ? "selected" : ""}>100</option>
          <option value="all" ${this.currentLimit === "all" ? "selected" : ""}>All</option>
        </select>
      </div>
      <div class="stats-table-wrap">
        <table class="stats-table">
          <thead><tr><th>Time</th><th>Track</th><th>Artist</th><th>Genre</th><th>Duration</th></tr></thead>
          <tbody>
            ${recent
              .map(
                (e) => `
              <tr>
                <td class="nowrap">${new Date(e.played_at).toLocaleString()}</td>
                <td class="track">${e.track.title || "Unknown"}</td>
                <td>${getArtistFromTrack(e.track)}</td>
                <td>${getGenre(e.track)}</td>
                <td class="nowrap">${fmtDuration(e.track.duration || 0)}</td>
              </tr>`,
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
        this.currentLimit =
          limitSel.value === "all" ? "all" : parseInt(limitSel.value);
        this.renderAnalytics();
      });
    }

    if (typeof Chart === "undefined") return;

    const css = getComputedStyle(document.documentElement);
    Chart.defaults.color = css.getPropertyValue("--sclient-chart-text").trim();
    Chart.defaults.borderColor = css
      .getPropertyValue("--sclient-chart-grid")
      .trim();
    Chart.defaults.font.family = css
      .getPropertyValue("--sclient-font-sans")
      .trim();

    this.upsertChart("sclient-chart-artists", 0, {
      type: "bar",
      indexAxis: "y",
      data: {
        labels: topArtists.map((a) => a[0]),
        datasets: [
          {
            label: "Plays",
            data: topArtists.map((a) => a[1]),
            backgroundColor: topArtists.map(
              (_, i) => colors[i % colors.length] + "99",
            ),
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
            grid: {
              color: css.getPropertyValue("--sclient-chart-grid").trim(),
            },
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
        labels: topTracks.map((t) =>
          t.title.length > 30 ? t.title.slice(0, 30) + "..." : t.title,
        ),
        datasets: [
          {
            label: "Plays",
            data: topTracks.map((t) => t.count),
            backgroundColor: topTracks.map(
              (_, i) => colors[i % colors.length] + "99",
            ),
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
            grid: {
              color: css.getPropertyValue("--sclient-chart-grid").trim(),
            },
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
            backgroundColor: genreLabels.map(
              (_, i) => colors[i % colors.length] + "CC",
            ),
            borderColor: css.getPropertyValue("--sclient-chart-border").trim(),
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
            grid: {
              color: css.getPropertyValue("--sclient-chart-grid").trim(),
            },
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
            backgroundColor: DAYS.map(
              (_, i) => colors[i % colors.length] + "88",
            ),
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
            grid: {
              color: css.getPropertyValue("--sclient-chart-grid").trim(),
            },
            ticks: { precision: 0 },
          },
        },
      },
    });
  }

  toggle() {
    closeSettingsDrawer();
    closeLyricsSidebar();

    const overlay = document.getElementById("sclient-stats-overlay");
    if (overlay) {
      overlay.classList.toggle("open");
      if (overlay.classList.contains("open")) {
        this.currentSource = "";
        this.renderAnalytics();
      } else {
        this.destroyCharts();
      }
      return;
    }

    this.createAnalyticsOverlay();
    document.getElementById("sclient-stats-overlay").classList.add("open");
    this.currentSource = "";
    this.renderAnalytics();
  }

  createAnalyticsOverlay() {
    if (document.getElementById("sclient-stats-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "sclient-stats-overlay";

    overlay.innerHTML = `
    <div class="stats-header">
      <h2 class="stats-header-title">
        ${lucideIcon("chart-column", 24)}
        Listening Analytics
      </h2>
      <div class="stats-header-actions">
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
          ${lucideIcon("database-arrow-down")}
        </button>
        <button id="sclient-stats-import-btn" class="sclient-btn" title="Import Stats DB">
          ${lucideIcon("database-arrow-up")}
        </button>
        <button id="sclient-stats-close-btn" class="sclient-btn">${lucideIcon("x")} Close</button>
      </div>
    </div>
    <div id="sclient-stats-content">
      <div class="stats-loading">Loading data...</div>
    </div>
  `;

    document.body.appendChild(overlay);

    const onEsc = (e) => {
      if (e.key === "Escape") close();
    };
    this.on(document, "keydown", onEsc);

    const close = () => {
      overlay.classList.remove("open");
      this.destroyCharts();
      document.removeEventListener("keydown", onEsc);
    };

    document
      .getElementById("sclient-stats-close-btn")
      .addEventListener("click", close);

    document
      .getElementById("sclient-stats-days-select")
      .addEventListener("change", () => {
        const val = document.getElementById("sclient-stats-days-select").value;
        this.currentDays = val ? parseInt(val) : null;
        this.renderAnalytics();
      });

    document
      .getElementById("sclient-stats-export-btn")
      .addEventListener("click", async () => {
        try {
          await sendBridge("stats_export_db");
          if (typeof showToast !== "undefined")
            showToast("Stats exported successfully");
        } catch (e) {
          if (e.message !== "cancelled" && e.message !== "Error: cancelled") {
            if (typeof showToast !== "undefined")
              showToast("Export failed: " + e.message);
          }
        }
      });

    document
      .getElementById("sclient-stats-import-btn")
      .addEventListener("click", async () => {
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
              ],
            );
            if (choice === "cancel" || choice === false) return;
            overwrite = choice === "overwrite";
          }

          await sendBridge("stats_execute_import", { filePath, overwrite });
          if (typeof showToast !== "undefined")
            showToast("Stats imported successfully");
          this.renderAnalytics();
        } catch (e) {
          if (e.message !== "cancelled" && e.message !== "Error: cancelled") {
            if (typeof showToast !== "undefined")
              showToast("Import failed: " + e.message);
          }
        }
      });
  }
}

const STATS_FEATURE = new StatsFeature();
FEATURES.push(STATS_FEATURE);
