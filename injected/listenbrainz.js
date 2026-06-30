function setupListenbrainz() {
    if (!listenbrainzEnabled) return;

    let currentTrackId = null;
    let currentTrackData = null;
    let elapsedTime = 0;
    let hasScrobbled = false;
    let startTime = 0;
    let scrobbleThreshold = 0;
    
    function updateStatus(text, color) {
        const el = document.getElementById('sclient-listenbrainz-status');
        if (el) {
            el.innerText = text;
            el.style.color = color || '#ccc';
        }
    }

    if (!listenbrainzToken || listenbrainzToken.length < 10) {
        setInterval(() => updateStatus('Invalid Key', '#f55'), 2000);
        return;
    }

    updateStatus('Waiting...', '#ccc');


    function submitListenbrainz(payload) {
        window.postMessage({
            source: 'sclient-bridge',
            action: 'invoke',
            cmd: 'submit_listenbrainz',
            args: payload,
            callbackId: 'lb_' + Date.now()
        }, '*');
    }

    async function sendNowPlaying(artist, title) {
        submitListenbrainz({
            listen_type: 'playing_now',
            payload: [{ track_metadata: { artist_name: artist, track_name: title } }]
        });
    }

    async function sendFinalScrobble(artist, title, timestamp) {
        submitListenbrainz({
            listen_type: 'single',
            payload: [{ listened_at: timestamp, track_metadata: { artist_name: artist, track_name: title } }]
        });
    }

    setInterval(async () => {
        const isPlaying = navigator.mediaSession && navigator.mediaSession.playbackState === 'playing';
        
        const titleLink = document.querySelector('.playbackSoundBadge__titleLink');
        if (!titleLink) {
            updateStatus('Waiting...', '#ccc');
            currentTrackId = null;
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
                    const artist = trackData.publisher_metadata && trackData.publisher_metadata.artist ? trackData.publisher_metadata.artist : trackData.user.username;
                    sendNowPlaying(artist, trackData.title);
                    updateStatus('Now Playing', '#789cff');
                }
            } else {
                currentTrackData = null;
            }
        }

        // Active playback tracking
        if (currentTrackData && isPlaying) {
            elapsedTime += 2;
            
            if (!hasScrobbled && elapsedTime < scrobbleThreshold) {
                updateStatus('Now Playing', '#789cff');
            }

            if (elapsedTime >= scrobbleThreshold && !hasScrobbled) {
                const artist = currentTrackData.publisher_metadata && currentTrackData.publisher_metadata.artist ? currentTrackData.publisher_metadata.artist : currentTrackData.user.username;
                sendFinalScrobble(artist, currentTrackData.title, startTime);
                hasScrobbled = true;
                updateStatus('Scrobbled!', '#5f5');
            }
        } else if (!isPlaying && currentTrackId) {
            // Keep status visually the same if scrobbled, otherwise show Paused
            if (hasScrobbled) updateStatus('Scrobbled!', '#5f5');
            else updateStatus('Paused', '#f9a826');
        }
    }, 2000);
}

setupListenbrainz();
