const LASTFM_AUTH_ERRORS = new Set([4, 9, 14]);

function setupLastFm() {
    if (!lastfmEnabled) return;

    let currentTrackId = null;
    let currentTrackData = null;
    let elapsedTime = 0;
    let hasScrobbled = false;
    let startTime = 0;
    let scrobbleThreshold = 0;
    let prevIsPlaying = false;

    function updateStatus(text, color) {
        const el = document.getElementById('sclient-lastfm-status');
        if (el) {
            el.innerText = text;
            el.style.color = color || '#ccc';
        }
    }

    if (!lastfmSessionKey) {
        updateStatus('Not Connected', '#f55');
        return;
    }

    updateStatus('Waiting...', '#ccc');

    function sendBridgeCall(cmd, args) {
        return new Promise((resolve) => {
            const callbackId = 'lfm_' + cmd + '_' + Date.now();
            const handler = (event) => {
                if (event.source !== window || !event.data || event.data.source !== 'sclient-bridge-reply') return;
                if (event.data.callbackId !== callbackId) return;
                window.removeEventListener('message', handler);
                resolve(event.data.result || {});
            };
            window.addEventListener('message', handler);
            window.postMessage({ source: 'sclient-bridge', action: 'invoke', cmd, args, callbackId }, '*');
        });
    }

    function handleApiResult(result, text, color) {
        if (!result || !result.ok) {
            if (result && LASTFM_AUTH_ERRORS.has(result.code)) {
                updateStatus('Auth Error', '#f55');
            } else if (!result || result.code === 0) {
                // no session key or network error — don't change status
            } else {
                updateStatus('Error', '#f55');
            }
            return false;
        }
        updateStatus(text, color);
        return true;
    }

    async function sendNowPlaying(artist, title) {
        const result = await sendBridgeCall('lastfm_now_playing', { artist, title });
        handleApiResult(result, 'Now Playing', '#789cff');
    }

    async function sendScrobble(artist, title, timestamp) {
        const result = await sendBridgeCall('lastfm_scrobble', { artist, title, timestamp });
        handleApiResult(result, 'Scrobbled!', '#5f5');
    }

    setInterval(async () => {
        const isPlaying = navigator.mediaSession && navigator.mediaSession.playbackState === 'playing';

        const titleLink = document.querySelector('.playbackSoundBadge__titleLink');
        if (!titleLink) {
            updateStatus('Waiting...', '#ccc');
            currentTrackId = null;
            prevIsPlaying = false;
            return;
        }

        const songUrl = titleLink.href.split('?')[0];

        // Song changed
        if (songUrl !== currentTrackId) {
            currentTrackId = songUrl;
            elapsedTime = 0;
            hasScrobbled = false;
            startTime = Math.floor(Date.now() / 1000);

            const trackData = await fetchGodModeData(songUrl);
            if (trackData) {
                currentTrackData = trackData;
                scrobbleThreshold = Math.min((trackData.duration / 1000) / 2, 240);

                if (isPlaying) {
                    const artist = trackData.publisher_metadata && trackData.publisher_metadata.artist
                        ? trackData.publisher_metadata.artist
                        : trackData.user.username;
                    sendNowPlaying(artist, trackData.title);
                    updateStatus('Now Playing', '#789cff');
                }
            } else {
                currentTrackData = null;
            }
            prevIsPlaying = isPlaying;
            return;
        }

        // Resume detection: was paused, now playing on same track
        if (currentTrackData && isPlaying && !prevIsPlaying && !hasScrobbled) {
            const artist = currentTrackData.publisher_metadata && currentTrackData.publisher_metadata.artist
                ? currentTrackData.publisher_metadata.artist
                : currentTrackData.user.username;
            sendNowPlaying(artist, currentTrackData.title);
            updateStatus('Now Playing', '#789cff');
        }

        // Active playback tracking
        if (currentTrackData && isPlaying) {
            elapsedTime += 2;

            if (!hasScrobbled && elapsedTime < scrobbleThreshold) {
                updateStatus('Now Playing', '#789cff');
            }

            if (elapsedTime >= scrobbleThreshold && !hasScrobbled) {
                const artist = currentTrackData.publisher_metadata && currentTrackData.publisher_metadata.artist
                    ? currentTrackData.publisher_metadata.artist
                    : currentTrackData.user.username;
                sendScrobble(artist, currentTrackData.title, startTime);
                hasScrobbled = true;
                updateStatus('Scrobbled!', '#5f5');
            }
        } else if (!isPlaying && currentTrackId) {
            if (hasScrobbled) updateStatus('Scrobbled!', '#5f5');
            else updateStatus('Paused', '#f9a826');
        }

        prevIsPlaying = isPlaying;
    }, 2000);
}

setupLastFm();
