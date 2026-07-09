function setupDiscordRpc() {
	let lastTitle = "";
	let lastArtist = "";
	let lastIsPlaying = false;
	let lastArtwork = "";
	let lastTimeStart = 0;

	let currentTrackId = null;
	let currentTrackData = null;

	setInterval(async () => {
		if (!discordRpcEnabled) return;

		try {
			if (!navigator.mediaSession || !navigator.mediaSession.metadata) return;

			const title = navigator.mediaSession.metadata.title || "";
			let artist = navigator.mediaSession.metadata.artist || "";
			const isPlaying = navigator.mediaSession.playbackState === "playing";

			const artworkArr = navigator.mediaSession.metadata.artwork;
			let artwork = "";
			if (artworkArr && artworkArr.length > 0) {
				artwork = artworkArr[artworkArr.length - 1].src;
			}

			function parseTimeStr(str) {
				if (!str) return 0;
				const match = str.match(/\d+:\d+(?::\d+)?/);
				if (!match) return 0;
				const parts = match[0].split(":").map(Number);
				if (parts.length === 3)
					return parts[0] * 3600 + parts[1] * 60 + parts[2];
				if (parts.length === 2) return parts[0] * 60 + parts[1];
				return 0;
			}

			const passedEl = document.querySelector(".playbackTimeline__timePassed");
			const durationEl = document.querySelector(".playbackTimeline__duration");
			const position = passedEl ? parseTimeStr(passedEl.textContent) : 0;
			const duration = durationEl ? parseTimeStr(durationEl.textContent) : 0;

			let timeStart = 0;
			let timeEnd = 0;
			if (isPlaying) {
				timeStart = Math.floor(Date.now() - position * 1000);
				if (duration > 0) timeEnd = Math.floor(timeStart + duration * 1000);
			}

			const timeDrift = Math.abs(timeStart - lastTimeStart);

			const titleLink = document.querySelector(
				".playbackSoundBadge__titleLink",
			);
			let songUrl = "";
			if (titleLink && titleLink.href) {
				songUrl = titleLink.href.split("?")[0];
			}

			if (songUrl && songUrl !== currentTrackId) {
				currentTrackId = songUrl;
				const trackData = await fetchGodModeData(songUrl);
				currentTrackData = trackData;
			} else if (!songUrl) {
				currentTrackId = null;
				currentTrackData = null;
			}

			if (currentTrackData) {
				artist = getArtistFromTrack(currentTrackData);
			}

			const changed =
				title !== lastTitle ||
				artist !== lastArtist ||
				isPlaying !== lastIsPlaying ||
				artwork !== lastArtwork ||
				(isPlaying && timeDrift > 2000);

			if (changed) {
				lastTitle = title;
				lastArtist = artist;
				lastIsPlaying = isPlaying;
				lastArtwork = artwork;
				lastTimeStart = timeStart;
				sendBridgeMsg("update_rpc", {
					title,
					artist,
					isPlaying,
					artwork,
					timeStart,
					timeEnd,
					songUrl,
				});
			}
		} catch (e) {
			console.error("[SClient] Discord RPC Error:", e);
		}
	}, 2000);
}

setupDiscordRpc();
