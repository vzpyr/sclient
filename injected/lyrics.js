let lyricsSidebarOpen = false;
let currentLyricsTrack = '';

function createLyricsSidebar() {
    if (document.getElementById('sclient-lyrics-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'sclient-lyrics-sidebar';
    sidebar.style.cssText = `
        position: fixed;
        top: 20px;
        bottom: 70px;
        left: -400px;
        width: 350px;
        background: rgba(18, 18, 18, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        box-shadow: 5px 5px 25px rgba(0,0,0,0.5);
        z-index: 999999;
        transition: left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex;
        flex-direction: column;
        color: #fff;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        padding: 20px;
        box-sizing: border-box;
    `;

    sidebar.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: ${customAccentEnabled ? accentColor : '#f50'};">Lyrics</h3>
            <button id="sclient-lyrics-close-btn" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 20px; padding: 5px;">&times;</button>
        </div>
        <div id="sclient-lyrics-content" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #e0e0e0;">
            <div style="opacity:0.5; text-align:center; margin-top:20px;">Open a song to load lyrics</div>
        </div>
    `;

    document.body.appendChild(sidebar);
    // force reflow
    void sidebar.offsetHeight;

    document.getElementById('sclient-lyrics-close-btn').addEventListener('click', toggleLyricsSidebar);
}

function toggleLyricsSidebar() {
    createLyricsSidebar();
    const sidebar = document.getElementById('sclient-lyrics-sidebar');
    lyricsSidebarOpen = !lyricsSidebarOpen;
    if (lyricsSidebarOpen) {
        sidebar.style.left = '20px';
        fetchAndUpdateLyrics();
    } else {
        sidebar.style.left = '-400px';
    }
}

async function fetchAndUpdateLyrics() {
    if (!lyricsSidebarOpen) return;

    let title = '';
    let artist = '';
    if (navigator.mediaSession && navigator.mediaSession.metadata) {
        title = navigator.mediaSession.metadata.title || '';
        artist = navigator.mediaSession.metadata.artist || '';
    }

    if (!title || !artist) return;
    
    const trackKey = artist + ' - ' + title;
    if (currentLyricsTrack === trackKey) return;

    currentLyricsTrack = trackKey;
    const contentDiv = document.getElementById('sclient-lyrics-content');
    if (contentDiv) {
        contentDiv.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">Fetching lyrics for<br><b>${title}</b>...</div>`;
    }

    try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        
        if (contentDiv && currentLyricsTrack === trackKey) {
            if (data.plainLyrics) {
                const escapedLyrics = data.plainLyrics.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                contentDiv.innerHTML = `<div style="font-weight:bold; margin-bottom: 15px; color:${customAccentEnabled ? accentColor : '#f50'};">${title}<br><span style="font-size:12px; font-weight:normal; color:#aaa;">${artist}</span></div>${escapedLyrics}`;
            } else {
                contentDiv.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">No lyrics found for this track.</div>`;
            }
        }
    } catch (e) {
        if (contentDiv && currentLyricsTrack === trackKey) {
            contentDiv.innerHTML = `<div style="opacity:0.5; text-align:center; margin-top:20px;">No lyrics found for this track.</div>`;
        }
    }
}

// poll track
setInterval(() => {
    if (lyricsSidebarOpen) {
        fetchAndUpdateLyrics();
    }
}, 2000);

function injectLyricsButton() {
    if (document.getElementById('sclient-lyrics-btn')) return;

    const dlBtn = document.getElementById('sclient-download-btn');
    if (dlBtn && dlBtn.parentNode) {
        const lyricsBtn = document.createElement('button');
        lyricsBtn.id = 'sclient-lyrics-btn';
        lyricsBtn.className = 'sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x';
        lyricsBtn.title = 'Lyrics';
        lyricsBtn.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"></path></svg></div>`;
        
        lyricsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleLyricsSidebar();
        });

        dlBtn.parentNode.insertBefore(lyricsBtn, dlBtn);
    }
}
