// Discord RPC bridge — subscribes to shared playback observer in core.js

function setupDiscordRpc() {
	if (!discordRpcEnabled) return;

	let lastTitle = "";
	let lastArtist = "";
	let lastIsPlaying = false;
	let lastArtwork = "";
	let lastTimeStart = 0;

	onPlaybackChange((evt) => {
		if (evt.type === "none") return;

		try {
			const meta = navigator.mediaSession && navigator.mediaSession.metadata;
			if (!meta) return;

			const title = meta.title || "";
			const artist = evt.trackData
				? getArtistFromTrack(evt.trackData)
				: meta.artist || "";
			const isPlaying = evt.isPlaying;

			const artworkArr = meta.artwork;
			let artwork = "";
			if (artworkArr && artworkArr.length > 0) {
				artwork = artworkArr[artworkArr.length - 1].src;
			}

			let timeStart = 0;
			let timeEnd = 0;
			if (isPlaying) {
				timeStart = Math.floor(evt.timestamp - evt.position * 1000);
				if (evt.duration > 0)
					timeEnd = Math.floor(timeStart + evt.duration * 1000);
			}

			const timeDrift = Math.abs(timeStart - lastTimeStart);

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
					songUrl: evt.songUrl,
				});
			}
		} catch (e) {
			console.error("[SClient] Discord RPC Error:", e);
		}
	});
}

setupDiscordRpc();
