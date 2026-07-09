// unified scrobbling — subscribes to shared playback observer in core.js
// handles both Last.fm and ListenBrainz from a single state machine.

function updateStatus(elId, text, color) {
	const el = document.getElementById(elId);
	if (el) {
		el.textContent = text;
		el.style.color = color || "#ccc";
	}
}

function setupScrobbling() {
	// --- collect enabled backends ---
	const backends = [];

	if (
		listenbrainzEnabled &&
		listenbrainzToken &&
		listenbrainzToken.length >= 10
	) {
		backends.push({
			statusElId: "sclient-listenbrainz-status",
			authErrorCodes: new Set([401]),
			nowPlaying(artist, title) {
				return sendBridgeMsg("submit_listenbrainz", {
					listen_type: "playing_now",
					payload: [
						{ track_metadata: { artist_name: artist, track_name: title } },
					],
				});
			},
			scrobble(artist, title, timestamp) {
				return sendBridgeMsg("submit_listenbrainz", {
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

	if (lastfmEnabled && lastfmSessionKey) {
		backends.push({
			statusElId: "sclient-lastfm-status",
			authErrorCodes: new Set([4, 9, 14]),
			nowPlaying(artist, title) {
				return sendBridgeMsg("lastfm_now_playing", { artist, title });
			},
			scrobble(artist, title, timestamp) {
				return sendBridgeMsg("lastfm_scrobble", {
					artist,
					title,
					timestamp,
				});
			},
		});
	}

	if (backends.length === 0) return;

	// --- scrobbling state (shared across all backends) ---
	let hasScrobbled = false;
	let startTime = 0;
	let scrobbleThreshold = 0;
	let prevIsPlaying = false;

	for (const b of backends) updateStatus(b.statusElId, "Waiting...", "#ccc");

	function broadcast(cmd, artist, title, timestamp) {
		const method = cmd === "nowPlaying" ? "nowPlaying" : "scrobble";
		for (const b of backends) {
			b[method](artist, title, timestamp).then((result) => {
				if (!result || !result.ok) {
					if (result && b.authErrorCodes.has(result.code)) {
						updateStatus(b.statusElId, "Auth Error", "#f55");
					} else if (!result || result.code === 0) {
						/* network error, keep current status */
					} else {
						updateStatus(b.statusElId, "Error", "#f55");
					}
				}
			});
		}
	}

	onPlaybackChange((evt) => {
		if (evt.type === "none") {
			for (const b of backends)
				updateStatus(b.statusElId, "Waiting...", "#ccc");
			prevIsPlaying = false;
			return;
		}

		const artist = evt.trackData ? getArtistFromTrack(evt.trackData) : "";
		const title = evt.trackData ? evt.trackData.title : "";

		if (evt.type === "track_start") {
			hasScrobbled = false;
			startTime = Math.floor(evt.timestamp / 1000);
			scrobbleThreshold = evt.trackData
				? Math.min(evt.trackData.duration / 1000 / 2, 240)
				: 0;

			if (evt.isPlaying && artist && title) {
				broadcast("nowPlaying", artist, title);
			}
			prevIsPlaying = evt.isPlaying;
			return;
		}

		// tick — same track
		if (evt.isPlaying && !prevIsPlaying && !hasScrobbled && artist && title) {
			// resumed after pause
			broadcast("nowPlaying", artist, title);
		}

		if (evt.trackData && evt.isPlaying) {
			const elapsed = Math.floor((evt.timestamp - startTime * 1000) / 1000);
			if (!hasScrobbled && elapsed >= scrobbleThreshold) {
				broadcast("scrobble", artist, title, startTime);
				hasScrobbled = true;
				for (const b of backends)
					updateStatus(b.statusElId, "Scrobbled!", "#5f5");
			}
		} else if (!evt.isPlaying && evt.trackData) {
			const status = hasScrobbled ? "Scrobbled!" : "Paused";
			const color = hasScrobbled ? "#5f5" : "#f9a826";
			for (const b of backends) updateStatus(b.statusElId, status, color);
		}

		prevIsPlaying = evt.isPlaying;
	});
}

setupScrobbling();
