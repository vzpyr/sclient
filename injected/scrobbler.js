// unified scrobbling engine — handles both Last.fm and ListenBrainz

const BACKENDS = [];

function updateStatus(elId, text, color) {
	const el = document.getElementById(elId);
	if (el) {
		el.textContent = text;
		el.style.color = color || "#ccc";
	}
}

// common scrobbling state machine
function createScrobbler({
	enabled,
	statusElId,
	validate,
	sendNowPlaying,
	sendScrobble,
	authErrorCodes,
}) {
	if (!enabled) return;

	let currentTrackId = null;
	let currentTrackData = null;
	let elapsedTime = 0;
	let hasScrobbled = false;
	let startTime = 0;
	let scrobbleThreshold = 0;
	let prevIsPlaying = false;

	const validation = validate();
	if (!validation.ok) {
		updateStatus(statusElId, validation.reason || "Not Connected", "#f55");
		return;
	}

	updateStatus(statusElId, "Waiting...", "#ccc");

	function handleResult(result, text, color) {
		if (!result || !result.ok) {
			if (result && authErrorCodes && authErrorCodes.has(result.code)) {
				updateStatus(statusElId, "Auth Error", "#f55");
			} else if (!result || result.code === 0) {
				// network error or no credentials, keep current status
			} else {
				updateStatus(statusElId, "Error", "#f55");
			}
			return false;
		}
		updateStatus(statusElId, text, color);
		return true;
	}

	async function nowPlaying(artist, title) {
		const result = await sendNowPlaying(artist, title);
		handleResult(result, "Now Playing", "#789cff");
	}

	async function doScrobble(artist, title, timestamp) {
		const result = await sendScrobble(artist, title, timestamp);
		handleResult(result, "Scrobbled!", "#5f5");
	}

	setInterval(async () => {
		const isPlaying =
			navigator.mediaSession &&
			navigator.mediaSession.playbackState === "playing";

		const titleLink = document.querySelector(".playbackSoundBadge__titleLink");
		if (!titleLink) {
			updateStatus(statusElId, "Waiting...", "#ccc");
			currentTrackId = null;
			prevIsPlaying = false;
			return;
		}

		const songUrl = titleLink.href.split("?")[0];

		// track changed
		if (songUrl !== currentTrackId) {
			currentTrackId = songUrl;
			elapsedTime = 0;
			hasScrobbled = false;
			startTime = Math.floor(Date.now() / 1000);

			const trackData = await fetchGodModeData(songUrl);
			if (trackData) {
				currentTrackData = trackData;
				scrobbleThreshold = Math.min(trackData.duration / 1000 / 2, 240);

				if (isPlaying) {
					const artist = getArtistFromTrack(trackData);
					nowPlaying(artist, trackData.title);
				}
			} else {
				currentTrackData = null;
			}
			prevIsPlaying = isPlaying;
			return;
		}

		// resume: was paused, now playing, same track, not yet scrobbled
		if (currentTrackData && isPlaying && !prevIsPlaying && !hasScrobbled) {
			const artist = getArtistFromTrack(currentTrackData);
			nowPlaying(artist, currentTrackData.title);
		}

		// active playback
		if (currentTrackData && isPlaying) {
			elapsedTime += 2;

			if (!hasScrobbled && elapsedTime >= scrobbleThreshold) {
				const artist = getArtistFromTrack(currentTrackData);
				doScrobble(artist, currentTrackData.title, startTime);
				hasScrobbled = true;
			}
		} else if (!isPlaying && currentTrackId) {
			if (hasScrobbled) updateStatus(statusElId, "Scrobbled!", "#5f5");
			else updateStatus(statusElId, "Paused", "#f9a826");
		}

		prevIsPlaying = isPlaying;
	}, 2000);
}

// --- ListenBrainz backend ---

const LB_AUTH_ERRORS = new Set([401]);

function setupListenbrainz() {
	createScrobbler({
		enabled: listenbrainzEnabled,
		statusElId: "sclient-listenbrainz-status",
		validate() {
			if (!listenbrainzToken || listenbrainzToken.length < 10) {
				return { ok: false, reason: "Invalid Key" };
			}
			return { ok: true };
		},
		async sendNowPlaying(artist, title) {
			return await sendBridgeMsg("submit_listenbrainz", {
				listen_type: "playing_now",
				payload: [
					{ track_metadata: { artist_name: artist, track_name: title } },
				],
			});
		},
		async sendScrobble(artist, title, timestamp) {
			return await sendBridgeMsg("submit_listenbrainz", {
				listen_type: "single",
				payload: [
					{
						listened_at: timestamp,
						track_metadata: { artist_name: artist, track_name: title },
					},
				],
			});
		},
		authErrorCodes: LB_AUTH_ERRORS,
	});
}

// --- Last.fm backend ---

const LASTFM_AUTH_ERRORS = new Set([4, 9, 14]);

function setupLastfm() {
	createScrobbler({
		enabled: lastfmEnabled,
		statusElId: "sclient-lastfm-status",
		validate() {
			if (!lastfmSessionKey) {
				return { ok: false, reason: "Not Connected" };
			}
			return { ok: true };
		},
		async sendNowPlaying(artist, title) {
			return await sendBridgeMsg("lastfm_now_playing", { artist, title });
		},
		async sendScrobble(artist, title, timestamp) {
			return await sendBridgeMsg("lastfm_scrobble", {
				artist,
				title,
				timestamp,
			});
		},
		authErrorCodes: LASTFM_AUTH_ERRORS,
	});
}

setupListenbrainz();
setupLastfm();
