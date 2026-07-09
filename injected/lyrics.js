let lyricsSidebarOpen = false;
let currentLyricsTrack = "";
let lastMediaSessionTrack = "";

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
      <button id="sclient-lyrics-close-btn" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 20px; padding: 5px;">&times;</button>
    </div>
    <div id="sclient-lyrics-content" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #e0e0e0;">
      <div style="opacity:0.5; text-align:center; margin-top:20px;">Open a song to load lyrics</div>
    </div>
  `;

	document.body.appendChild(sidebar);
	void sidebar.offsetHeight;

	document
		.getElementById("sclient-lyrics-close-btn")
		.addEventListener("click", toggleLyricsSidebar);
}

function toggleLyricsSidebar() {
	createLyricsSidebar();
	const sidebar = document.getElementById("sclient-lyrics-sidebar");
	lyricsSidebarOpen = !lyricsSidebarOpen;
	if (lyricsSidebarOpen) {
		sidebar.style.left = "20px";
		fetchAndUpdateLyrics();
	} else {
		sidebar.style.left = "-400px";
	}
}

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

async function doFetch(artist, title) {
	currentLyricsTrack = artist + " - " + title;
	const trackKey = currentLyricsTrack;
	const accent = getAccent();
	const safeTitle = escapeHtml(title);

	const contentDiv = document.getElementById("sclient-lyrics-content");
	if (contentDiv) {
		contentDiv.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">Fetching lyrics for<br><b>${safeTitle}</b>...</div>`;
	}

	try {
		const res = await fetch(
			`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
		);
		if (!res.ok) throw new Error("Not found");
		const data = await res.json();

		if (contentDiv && currentLyricsTrack === trackKey) {
			if (data.plainLyrics) {
				contentDiv.innerHTML = `<div style="font-weight:bold; margin-bottom: 15px; color:${accent};">${safeTitle}<br><span style="font-size:12px; font-weight:normal; color:#aaa;">${escapeHtml(artist)}</span></div>${escapeHtml(data.plainLyrics)}`;
			} else {
				renderManualSearch(artist, title);
			}
		}
	} catch (e) {
		if (contentDiv && currentLyricsTrack === trackKey) {
			renderManualSearch(artist, title);
		}
	}
}

function renderManualSearch(artist, title) {
	const contentDiv = document.getElementById("sclient-lyrics-content");
	if (!contentDiv) return;

	contentDiv.innerHTML = `
    <div style="opacity:0.5; text-align:center; margin-top:20px;">No lyrics found for this track.</div>
    <div style="margin-top: 15px; text-align: center;">
      <div style="margin-bottom: 8px; font-size: 12px; color: #aaa;">Try manually:</div>
      <input type="text" id="sclient-lyrics-manual-artist" placeholder="Artist" value="${escapeHtml(artist)}" style="width: 90%; margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.2); border: 1px solid #555; color: #fff; border-radius: 4px; outline: none;">
      <input type="text" id="sclient-lyrics-manual-title" placeholder="Title" value="${escapeHtml(title)}" style="width: 90%; margin-bottom: 5px; padding: 5px; background: rgba(0,0,0,0.2); border: 1px solid #555; color: #fff; border-radius: 4px; outline: none;">
      <button id="sclient-lyrics-manual-search" style="width: 90%; padding: 6px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; transition: background 0.2s;">Search</button>
    </div>
  `;

	document
		.getElementById("sclient-lyrics-manual-search")
		.addEventListener("click", () => {
			const newArtist = document.getElementById(
				"sclient-lyrics-manual-artist",
			).value;
			const newTitle = document.getElementById(
				"sclient-lyrics-manual-title",
			).value;
			if (newArtist && newTitle) doFetch(newArtist, newTitle);
		});
}

async function fetchAndUpdateLyrics() {
	if (!lyricsSidebarOpen) return;

	let title = "";
	let artist = "";
	if (navigator.mediaSession && navigator.mediaSession.metadata) {
		title = navigator.mediaSession.metadata.title || "";
		artist = navigator.mediaSession.metadata.artist || "";
	}

	if (!title || !artist) return;

	const trackKey = artist + " - " + title;
	if (lastMediaSessionTrack === trackKey) return;
	lastMediaSessionTrack = trackKey;
	doFetch(artist, title);
}

setInterval(() => {
	if (lyricsSidebarOpen) fetchAndUpdateLyrics();
}, 2000);

function injectLyricsButton() {
	if (document.getElementById("sclient-lyrics-btn")) return;

	const dlBtn = document.getElementById("sclient-download-btn");
	if (!dlBtn || !dlBtn.parentNode) return;

	const lyricsBtn = document.createElement("button");
	lyricsBtn.id = "sclient-lyrics-btn";
	lyricsBtn.className =
		"sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
	lyricsBtn.title = "Lyrics";
	lyricsBtn.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/></svg></div>`;

	lyricsBtn.addEventListener("click", (e) => {
		e.preventDefault();
		toggleLyricsSidebar();
	});

	dlBtn.parentNode.insertBefore(lyricsBtn, dlBtn);
}
