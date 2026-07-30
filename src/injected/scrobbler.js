function updateStatus(elId, text, color) {
  const el = document.getElementById(elId);
  if (el) {
    el.textContent = text;
    el.style.color = color || "#ccc";
  }
}

function setupScrobbling() {
  const backends = [];

  if (listenbrainzOn && listenbrainzToken && listenbrainzToken.length >= 10) {
    backends.push({
      elId: "sclient-listenbrainz-status",
      authCodes: new Set([401]),
      nowPlaying(artist, title) {
        return sendBridge("submit_listenbrainz", {
          listen_type: "playing_now",
          payload: [{ track_metadata: { artist_name: artist, track_name: title } }],
        });
      },
      scrobble(artist, title, timestamp) {
        return sendBridge("submit_listenbrainz", {
          listen_type: "single",
          payload: [
            {
              listened_at: timestamp,
              track_metadata: { artist_name: artist, track_name: title },
            },
          ],
        });
      },
    });
  }

  if (lastfmOn && lastfmSessionKey) {
    backends.push({
      elId: "sclient-lastfm-status",
      authCodes: new Set([4, 9, 14]),
      nowPlaying(artist, title) {
        return sendBridge("lastfm_now_playing", { artist, title });
      },
      scrobble(artist, title, timestamp) {
        return sendBridge("lastfm_scrobble", { artist, title, timestamp });
      },
    });
  }

  if (backends.length === 0) return;

  let hasScrobbled = false;
  let startTime = 0;
  let threshold = 0;
  let prevPlaying = false;

  for (const b of backends) updateStatus(b.elId, "Waiting...", "#ccc");

  function broadcast(cmd, artist, title, timestamp) {
    const method = cmd === "nowPlaying" ? "nowPlaying" : "scrobble";
    for (const b of backends) {
      b[method](artist, title, timestamp).then((result) => {
        if (!result || !result.ok) {
          if (result && b.authCodes.has(result.code)) {
            updateStatus(b.elId, "Auth Error", "#f55");
          }
        }
      });
    }
  }

  onPlaybackChange((evt) => {
    if (evt.type === "none") {
      for (const b of backends) updateStatus(b.elId, "Waiting...", "#ccc");
      prevPlaying = false;
      return;
    }

    const artist = evt.trackData ? getArtistFromTrack(evt.trackData) : "";
    const title = evt.trackData ? evt.trackData.title : "";

    if (evt.type === "track_start") {
      hasScrobbled = false;
      startTime = Math.floor(evt.timestamp / 1000);
      threshold = evt.trackData ? Math.min(evt.trackData.duration / 1000 / 2, 240) : 0;
      if (evt.isPlaying && artist && title) {
        broadcast("nowPlaying", artist, title);
        for (const b of backends) updateStatus(b.elId, "Listening...", "#789cff");
      }
      prevPlaying = evt.isPlaying;
      return;
    }

    if (evt.isPlaying && !prevPlaying && !hasScrobbled && artist && title) {
      broadcast("nowPlaying", artist, title);
    }

    if (evt.trackData && evt.isPlaying) {
      const elapsed = Math.floor((evt.timestamp - startTime * 1000) / 1000);
      if (!hasScrobbled && elapsed >= threshold) {
        broadcast("scrobble", artist, title, startTime);
        hasScrobbled = true;
        for (const b of backends) updateStatus(b.elId, "Scrobbled!", "#5f5");
      } else if (!hasScrobbled) {
        for (const b of backends) updateStatus(b.elId, "Listening...", "#789cff");
      }
    } else if (!evt.isPlaying && evt.trackData) {
      const status = hasScrobbled ? "Scrobbled!" : "Paused";
      const color = hasScrobbled ? "#5f5" : "#f9a826";
      for (const b of backends) updateStatus(b.elId, status, color);
    }

    prevPlaying = evt.isPlaying;
  });
}

setupScrobbling();
