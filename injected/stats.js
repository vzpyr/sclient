// stats — real-time tracking + analytics overlay

function extractOAuthToken() {
	try {
		const cookies = document.cookie.split(";");
		for (const c of cookies) {
			const [key, val] = c.trim().split("=");
			if (key === "oauth_token" && val && val.startsWith("2-")) return val;
		}
	} catch (e) {
		/* cookies may be blocked */
	}
	try {
		const token = localStorage.getItem("oauth_token");
		if (token && token.startsWith("2-")) return token;
	} catch (e) {}
	try {
		const token = sessionStorage.getItem("oauth_token");
		if (token && token.startsWith("2-")) return token;
	} catch (e) {}
	return null;
}

async function extractAndSendCredentials() {
	const clientId = extractClientId();
	const oauthToken = extractOAuthToken();
	if (clientId && oauthToken) {
		await sendBridgeMsg("stats_store_credentials", { clientId, oauthToken });
	}
}

let credRetries = 0;
const credInterval = setInterval(async () => {
	credRetries++;
	if (credRetries > 30) {
		clearInterval(credInterval);
		return;
	}
	await extractAndSendCredentials();
	const cid = extractClientId();
	const tok = extractOAuthToken();
	if (cid && tok) clearInterval(credInterval);
}, 2000);

// --- real-time tracking ---

function setupStatsTracking() {
	if (!statsLocalTrackingEnabled) return;

	let currentTrackId = null;
	let currentTrackData = null;
	let hasRecorded = false;
	let startTime = 0;
	let recordThreshold = 0;

	function updateStatus(text, color) {
		const el = document.getElementById("sclient-stats-status");
		if (el) {
			el.textContent = text;
			el.style.color = color || "#ccc";
		}
	}

	updateStatus("Waiting...", "#ccc");

	async function recordListen(trackData, timestamp) {
		try {
			await sendBridgeMsg("stats_record_listen", {
				played_at: timestamp,
				track_id: trackData.id,
				track: trackData,
			});
			updateStatus("Recorded!", "#5f5");
		} catch (e) {
			updateStatus("Error", "#f55");
		}
	}

	setInterval(async () => {
		if (!statsLocalTrackingEnabled) return;

		const isPlaying =
			navigator.mediaSession &&
			navigator.mediaSession.playbackState === "playing";
		const titleLink = document.querySelector(".playbackSoundBadge__titleLink");

		if (!titleLink) {
			updateStatus("Waiting...", "#ccc");
			currentTrackId = null;
			return;
		}

		const songUrl = titleLink.href.split("?")[0];

		if (songUrl !== currentTrackId) {
			currentTrackId = songUrl;
			hasRecorded = false;
			startTime = Date.now();

			const trackData = await fetchGodModeData(songUrl);
			if (trackData) {
				currentTrackData = trackData;
				recordThreshold = Math.min(trackData.duration / 1000 / 2, 240) * 1000;
				if (isPlaying) updateStatus("Listening...", "#789cff");
			} else {
				currentTrackData = null;
			}
			return;
		}

		if (currentTrackData && isPlaying) {
			const elapsedTime = Date.now() - startTime;
			if (!hasRecorded && elapsedTime >= recordThreshold) {
				await recordListen(currentTrackData, startTime);
				hasRecorded = true;
			}
		} else if (!isPlaying && currentTrackId) {
			updateStatus(
				hasRecorded ? "Recorded!" : "Paused",
				hasRecorded ? "#5f5" : "#f9a826",
			);
		}
	}, 2000);
}

// --- analytics overlay ---

let activeCharts = [];

function destroyAllCharts() {
	activeCharts.forEach((c) => {
		try {
			c.destroy();
		} catch (e) {}
	});
	activeCharts = [];
}

function formatDuration(ms) {
	const totalSec = Math.floor(ms / 1000);
	const hours = Math.floor(totalSec / 3600);
	const minutes = Math.floor((totalSec % 3600) / 60);
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

function formatNumber(n) {
	if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
	if (n >= 1000) return (n / 1000).toFixed(1) + "K";
	return n.toString();
}

function getGenre(track) {
	return track.genre && track.genre.trim() ? track.genre : "Unknown";
}

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

let currentSource = "";
let currentLimit = 20;
let currentDays = null;

function renderFilterBar() {
	const accent = getAccent();
	const makeBtn = (label, source) => {
		const active = currentSource === source;
		return `<button class="sclient-stats-filter-btn" data-source="${source}" style="padding: 6px 14px; background: ${active ? accent : "rgba(255,255,255,0.06)"}; color: ${active ? "#fff" : "#aaa"}; border: ${active ? "none" : "1px solid rgba(255,255,255,0.1)"}; border-radius: 6px; font-size: 12px; font-family: Inter, sans-serif; cursor: pointer; font-weight: ${active ? "600" : "400"};">${label}</button>`;
	};
	return `<div style="display: flex; gap: 8px; margin-bottom: 20px;">${makeBtn("All", "")}${makeBtn("History", "api")}${makeBtn("Local", "local")}</div>`;
}

function wireFilterButtons() {
	document.querySelectorAll(".sclient-stats-filter-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			currentSource = btn.dataset.source;
			renderAnalytics();
		});
	});
}

function toggleAnalyticsOverlay() {
	const settingsOverlay = document.getElementById("sclient-settings-overlay");
	if (settingsOverlay) settingsOverlay.style.right = "-450px";

	const lyricsSidebar = document.getElementById("sclient-lyrics-sidebar");
	if (lyricsSidebar) lyricsSidebar.style.left = "-400px";

	const overlay = document.getElementById("sclient-stats-overlay");
	if (overlay) {
		overlay.style.display = overlay.style.display === "flex" ? "none" : "flex";
		if (overlay.style.display === "flex") {
			currentSource = "";
			renderAnalytics();
		}
		return;
	}

	createAnalyticsOverlay();
	document.getElementById("sclient-stats-overlay").style.display = "flex";
	currentSource = "";
	renderAnalytics();
}

function createAnalyticsOverlay() {
	if (document.getElementById("sclient-stats-overlay")) return;

	const accent = getAccent();
	const overlay = document.createElement("div");
	overlay.id = "sclient-stats-overlay";
	overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(10, 10, 10, 0.97); backdrop-filter: blur(15px);
    z-index: 9999998; display: none; flex-direction: column;
    color: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif;
  `;

	overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 30px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;">
      <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: ${accent}; display: flex; align-items: center; gap: 10px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        Listening Analytics
      </h2>
      <div style="display: flex; align-items: center; gap: 12px;">
        <select id="sclient-stats-days-select" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #aaa; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-family: Inter, sans-serif; cursor: pointer; outline: none;">
          <option value="">All time</option>
          <option value="1">Last 24h</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="365">Last year</option>
        </select>
        <button id="sclient-stats-close-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #aaa; cursor: pointer; font-size: 18px; padding: 8px 14px; border-radius: 8px; transition: all 0.2s;"
          onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';"
          onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='#aaa';">&times; Close</button>
      </div>
    </div>
    <div id="sclient-stats-content" style="flex: 1; overflow-y: auto; padding: 20px 30px 30px;">
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.5; font-size: 16px;">Loading data...</div>
    </div>
  `;

	document.body.appendChild(overlay);

	const closeOverlay = () => {
		overlay.style.display = "none";
		destroyAllCharts();
		document.removeEventListener("keydown", escHandler);
	};

	document
		.getElementById("sclient-stats-close-btn")
		.addEventListener("click", closeOverlay);

	document
		.getElementById("sclient-stats-days-select")
		.addEventListener("change", () => {
			const val = document.getElementById("sclient-stats-days-select").value;
			currentDays = val ? parseInt(val) : null;
			renderAnalytics();
		});

	const escHandler = (e) => {
		if (e.key === "Escape") closeOverlay();
	};
	document.addEventListener("keydown", escHandler);
}

function upsertChart(id, index, config) {
	const existing = index < activeCharts.length ? activeCharts[index] : null;
	if (existing && existing.canvas && existing.canvas.id === id) {
		existing.data = config.data;
		existing.options = config.options;
		existing.update();
		return existing;
	}
	const ctx = document.getElementById(id);
	if (!ctx) return null;
	const chart = new Chart(ctx, config);
	if (index < activeCharts.length) {
		activeCharts[index].destroy();
		activeCharts[index] = chart;
	} else {
		activeCharts.push(chart);
	}
	return chart;
}

async function renderAnalytics() {
	const content = document.getElementById("sclient-stats-content");
	if (!content) return;

	let data;
	try {
		data = await sendBridgeMsg("stats_get_data", {
			source: currentSource || undefined,
		});
	} catch (e) {
		content.innerHTML =
			renderFilterBar() +
			`<div style="text-align:center; margin-top:60px; opacity:0.6;">Failed to load stats: ${e.message}</div>`;
		wireFilterButtons();
		return;
	}

	if (!data || data.length === 0) {
		content.innerHTML =
			renderFilterBar() +
			`
      <div style="text-align:center; margin-top:80px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3; margin-bottom:16px;"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        <div style="font-size:18px; font-weight:600; margin-bottom:8px; opacity:0.7;">No listening data yet</div>
        <div style="font-size:13px; opacity:0.4;">Play some music and it'll show up here!</div>
      </div>`;
		wireFilterButtons();
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

	if (currentDays) {
		const cutoff = Date.now() - currentDays * 86400000;
		entries = entries.filter((e) => e.played_at >= cutoff);
	}

	if (entries.length === 0) {
		content.innerHTML =
			renderFilterBar() +
			`
      <div style="text-align:center; margin-top:80px;">
        <div style="font-size:18px; font-weight:600; margin-bottom:8px; opacity:0.7;">No data in selected time range</div>
        <div style="font-size:13px; opacity:0.4;">Try a wider time range</div>
      </div>`;
		wireFilterButtons();
		return;
	}

	const totalPlays = entries.length;
	const totalDuration = entries.reduce(
		(sum, e) => sum + (e.track.duration || 0),
		0,
	);
	const uniqueArtists = new Set(entries.map((e) => getArtistFromTrack(e.track)))
		.size;
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
		const key = e.track_id;
		if (!trackCounts[key])
			trackCounts[key] = {
				count: 0,
				title: e.track.title || "Unknown",
				artist: getArtistFromTrack(e.track),
			};
		trackCounts[key].count++;
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

	const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const dayCounts = new Array(7).fill(0);
	entries.forEach((e) => {
		dayCounts[new Date(e.played_at).getDay()]++;
	});

	const recentPlays =
		currentLimit === "all" ? entries : entries.slice(0, currentLimit);

	const accent = getAccent();
	const chartColors = [accent, ...CHART_COLORS];

	const html = `
    <style>
      #sclient-stats-content { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
      #sclient-stats-content::-webkit-scrollbar { width: 6px; }
      #sclient-stats-content::-webkit-scrollbar-track { background: transparent; }
      #sclient-stats-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
      .stats-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px 20px; }
      .stats-card-value { font-size: 28px; font-weight: 700; color: ${accent}; }
      .stats-card-label { font-size: 12px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
      .stats-chart-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; }
      .stats-chart-title { font-size: 14px; font-weight: 600; color: #ccc; margin-bottom: 14px; }
      .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .stats-table th { text-align: left; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); color: #888; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      .stats-table td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .stats-table tr:hover td { background: rgba(255,255,255,0.02); }
    </style>
    ${renderFilterBar()}
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
      <div class="stats-card"><div class="stats-card-value">${formatNumber(totalPlays)}</div><div class="stats-card-label">Total Plays</div></div>
      <div class="stats-card"><div class="stats-card-value">${formatDuration(totalDuration)}</div><div class="stats-card-label">Listening Time</div></div>
      <div class="stats-card"><div class="stats-card-value">${formatNumber(uniqueArtists)}</div><div class="stats-card-label">Unique Artists</div></div>
      <div class="stats-card"><div class="stats-card-value">${formatNumber(uniqueTracks)}</div><div class="stats-card-label">Unique Tracks</div></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
      <div class="stats-chart-box"><div class="stats-chart-title">🎤 Top Artists</div><div style="height: 350px;"><canvas id="sclient-chart-artists"></canvas></div></div>
      <div class="stats-chart-box"><div class="stats-chart-title">🎵 Top Tracks</div><div style="height: 350px;"><canvas id="sclient-chart-tracks"></canvas></div></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
      <div class="stats-chart-box"><div class="stats-chart-title">🎧 Top Genres</div><div style="height: 300px; display: flex; align-items: center; justify-content: center;"><canvas id="sclient-chart-genres" style="max-width: 300px; max-height: 300px;"></canvas></div></div>
      <div class="stats-chart-box"><div class="stats-chart-title">🕐 Listening by Hour</div><div style="height: 300px;"><canvas id="sclient-chart-hours"></canvas></div></div>
    </div>
    <div class="stats-chart-box" style="margin-bottom: 24px;"><div class="stats-chart-title">📅 Listening by Day</div><div style="height: 200px;"><canvas id="sclient-chart-days"></canvas></div></div>
    <div class="stats-chart-box">
      <div class="stats-chart-title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>🕒 Recent Plays</span>
        <select id="sclient-stats-limit-select" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #aaa; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-family: Inter, sans-serif; cursor: pointer; outline: none;">
          <option value="20" ${currentLimit === 20 ? "selected" : ""}>20</option>
          <option value="50" ${currentLimit === 50 ? "selected" : ""}>50</option>
          <option value="100" ${currentLimit === 100 ? "selected" : ""}>100</option>
          <option value="all" ${currentLimit === "all" ? "selected" : ""}>All</option>
        </select>
      </div>
      <div style="overflow-x: auto;">
        <table class="stats-table">
          <thead><tr><th>Time</th><th>Track</th><th>Artist</th><th>Genre</th><th>Duration</th></tr></thead>
          <tbody>
            ${recentPlays
							.map(
								(e) => `
              <tr>
                <td style="white-space: nowrap; color: #888;">${new Date(e.played_at).toLocaleString()}</td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.track.title || "Unknown"}</td>
                <td style="color: #aaa;">${getArtistFromTrack(e.track)}</td>
                <td style="color: #888;">${getGenre(e.track)}</td>
                <td style="color: #888;">${formatDuration(e.track.duration || 0)}</td>
              </tr>`,
							)
							.join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

	destroyAllCharts();
	content.innerHTML = html;

	wireFilterButtons();

	const limitSelect = document.getElementById("sclient-stats-limit-select");
	if (limitSelect) {
		limitSelect.addEventListener("change", () => {
			currentLimit =
				limitSelect.value === "all" ? "all" : parseInt(limitSelect.value);
			renderAnalytics();
		});
	}

	if (typeof Chart === "undefined") return;

	Chart.defaults.color = "#888";
	Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
	Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";

	// top artists — horizontal bar
	upsertChart("sclient-chart-artists", 0, {
		type: "bar",
		indexAxis: "y",
		data: {
			labels: topArtists.map((a) => a[0]),
			datasets: [
				{
					label: "Plays",
					data: topArtists.map((a) => a[1]),
					backgroundColor: topArtists.map(
						(_, i) => chartColors[i % chartColors.length] + "99",
					),
					borderColor: topArtists.map(
						(_, i) => chartColors[i % chartColors.length],
					),
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

	// top tracks
	upsertChart("sclient-chart-tracks", 1, {
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
						(_, i) => chartColors[i % chartColors.length] + "99",
					),
					borderColor: topTracks.map(
						(_, i) => chartColors[i % chartColors.length],
					),
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

	// genres — doughnut
	const otherSum = topGenres.slice(10).reduce((s, g) => s + g[1], 0);
	const genreLabels = topGenres.slice(0, 10).map((g) => g[0]);
	const genreData = topGenres.slice(0, 10).map((g) => g[1]);
	if (otherSum > 0) {
		genreLabels.push("Other");
		genreData.push(otherSum);
	}

	upsertChart("sclient-chart-genres", 2, {
		type: "doughnut",
		data: {
			labels: genreLabels,
			datasets: [
				{
					data: genreData,
					backgroundColor: genreLabels.map(
						(_, i) => chartColors[i % chartColors.length] + "CC",
					),
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

	// hours
	const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
	upsertChart("sclient-chart-hours", 3, {
		type: "bar",
		data: {
			labels: hourLabels,
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

	// days
	upsertChart("sclient-chart-days", 4, {
		type: "bar",
		data: {
			labels: DAY_NAMES,
			datasets: [
				{
					label: "Plays",
					data: dayCounts,
					backgroundColor: DAY_NAMES.map(
						(_, i) => chartColors[i % chartColors.length] + "88",
					),
					borderColor: DAY_NAMES.map(
						(_, i) => chartColors[i % chartColors.length],
					),
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

// init
if (statsLocalTrackingEnabled) {
	setupStatsTracking();
}
