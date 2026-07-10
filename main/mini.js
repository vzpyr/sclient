const { ipcRenderer } = require("electron");

const $ = (id) => document.getElementById(id);

let currentDuration = 0;

function formatTime(secs) {
	if (!secs || isNaN(secs)) return "0:00";
	const m = Math.floor(secs / 60);
	const s = Math.floor(secs % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

// Window Controls
$("btn-close").addEventListener("click", () => ipcRenderer.send("mini_close"));
$("btn-minimize").addEventListener("click", () => ipcRenderer.send("mini_minimize"));
$("btn-fullscreen").addEventListener("click", () => ipcRenderer.send("mini_fullscreen"));

// Playback Controls
let isPlayingLocal = false;
let isShuffledLocal = false;
let isLikedLocal = false;
let loopStateLocal = "none";
let currentAccent = "#f50";

let lyricsOpenLocal = false;
let currentSyncedLyrics = [];
let lyricsTrack = "";
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
		ipcRenderer.send("resize_mini", 700, 480);
		content.classList.add("with-lyrics");
		if (currentArtist && currentTitle) fetchLyrics(currentArtist, currentTitle);
	} else {
		ipcRenderer.send("resize_mini", 480, 180);
		content.classList.remove("with-lyrics");
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

// Seek Bar
$("progress-bar").addEventListener("click", (e) => {
	const rect = $("progress-bar").getBoundingClientRect();
	const percent = (e.clientX - rect.left) / rect.width;
	const seekTo = currentDuration * percent;
	ipcRenderer.send("mini_action", { action: "seek", value: seekTo });
});

// Global Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
	if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
	
	if (e.code === "Space") {
		e.preventDefault(); // Prevents clicking the focused button or scrolling
		$("btn-playpause").click();
	}
});

// State Updates
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
		currentArtist = data.trackData.publisher_metadata?.artist || data.trackData.user?.username || "-";
		
		$("title").textContent = currentTitle;
		$("artist").textContent = currentArtist;
		if (data.trackData.artwork_url) {
			const url = data.trackData.artwork_url.replace("large", "t500x500");
			$("artwork").style.backgroundImage = `url('${url}')`;
			$("bg").style.backgroundImage = `url('${url}')`;
		}

		if (lyricsOpenLocal && (oldTitle !== currentTitle || oldArtist !== currentArtist)) {
			fetchLyrics(currentArtist, currentTitle);
		}
	} else {
			$("artwork").style.backgroundImage = "none";
			$("bg").style.backgroundImage = "none";
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

	if (data.accent && data.accent !== currentAccent) {
		currentAccent = data.accent;
		document.documentElement.style.setProperty("--accent", currentAccent);
	}
});

// Lyrics Logic
function esc(str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

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
	const content = document.getElementById("lyrics-content");
	content.innerHTML = `<div style="opacity:0.5; margin-top:40px;">Fetching lyrics for<br><b>${safe}</b>...</div>`;
	currentSyncedLyrics = [];

	try {
		const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
		if (!res.ok) throw new Error("Not found");
		const data = await res.json();

		if (lyricsTrack !== key) return;
		currentHighlightedIndex = -1;

		if (data.syncedLyrics) {
			const lines = data.syncedLyrics.split('\n');
			let html = `<div style="font-weight:bold; margin-bottom: 30px; color:var(--accent); font-size: 18px;">${safe}<br><span style="font-size:13px; font-weight:normal; color:#aaa;">${esc(artist)}</span></div>`;
			html += `<div id="lyrics-lines" style="display:flex; flex-direction:column; gap:12px; padding: 0 10px 50vh 10px;">`;
			for (const line of lines) {
				const m = line.match(/^\[(\d{2}):(\d{2}\.\d{2,})\](.*)/);
				if (m) {
					const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
					html += `<div class="lyric-line" data-time="${time}">${esc(m[3].trim() || ' ')}</div>`;
					currentSyncedLyrics.push({ time, element: null });
				}
			}
			content.innerHTML = html + `</div>`;
			
			// Cache elements and add click listeners
			const lineElements = content.querySelectorAll(".lyric-line");
			lineElements.forEach((el, i) => {
				currentSyncedLyrics[i].element = el;
				el.addEventListener("click", () => {
					ipcRenderer.send("mini_action", { action: "seek", value: currentSyncedLyrics[i].time });
				});
			});
		} else if (data.plainLyrics) {
			const lines = data.plainLyrics.split('\n');
			let html = `<div style="font-weight:bold; margin-bottom: 30px; color:var(--accent); font-size: 18px;">${safe}<br><span style="font-size:13px; font-weight:normal; color:#aaa;">${esc(artist)}</span></div>`;
			for (const line of lines) html += `<div style="font-size: 15px; margin-bottom: 12px;">${esc(line.trim() || ' ')}</div>`;
			content.innerHTML = html;
		} else {
			renderManual(artist, title);
		}
	} catch (e) {
		if (lyricsTrack === key) renderManual(artist, title);
	}
}

function updateLyricsUI(pos) {
	if (!lyricsOpenLocal || !currentSyncedLyrics.length) return;
	
	const activeIdx = currentSyncedLyrics.findLastIndex(l => pos >= l.time - 0.2);
	if (activeIdx === currentHighlightedIndex) return;
	currentHighlightedIndex = activeIdx;

	currentSyncedLyrics.forEach((l, i) => {
		if (!l.element) return;
		if (i === activeIdx) {
			l.element.className = "lyric-line active";
			l.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		} else if (i < activeIdx) {
			l.element.className = "lyric-line past";
		} else {
			l.element.className = "lyric-line";
		}
	});
}

// Smooth Progress Rendering Loop
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

// ── Artwork size sync ──────────────────────────────────────────────────────
// Both no-lyrics and with-lyrics must show the SAME artwork size.
// We can't hardcode 152px because the actual viewport height varies by OS/DPI.
// Solution: measure window.innerHeight - 28 (padding*2) when in mini mode
// and store it as a CSS variable used by both layouts.
function syncArtworkSize() {
	// Only update while in mini (no-lyrics) mode — the 480×180 window.
	// When lyrics are open the window is 700×480, which would give the wrong size.
	if (!document.querySelector(".content.with-lyrics")) {
		const size = Math.max(60, window.innerHeight - 28);
		document.documentElement.style.setProperty("--mini-art-size", size + "px");
	}
}
syncArtworkSize(); // run immediately so there's no first-frame mismatch
window.addEventListener("resize", syncArtworkSize);
