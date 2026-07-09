function setupDiscordRpc() {
	if (!discordRpcOn) return;

	let last = {
		title: "",
		artist: "",
		playing: false,
		artwork: "",
		timeStart: 0,
	};

	onPlaybackChange((evt) => {
		if (evt.type === "none") return;

		try {
			const meta = navigator.mediaSession && navigator.mediaSession.metadata;
			if (!meta) return;

			const title = meta.title || "";
			const artist = evt.trackData
				? getArtistFromTrack(evt.trackData)
				: meta.artist || "";
			const playing = evt.isPlaying;

			let artwork = "";
			const art = meta.artwork;
			if (art && art.length > 0) artwork = art[art.length - 1].src;

			let timeStart = 0;
			let timeEnd = 0;
			if (playing) {
				timeStart = Math.floor(evt.timestamp - evt.position * 1000);
				if (evt.duration > 0)
					timeEnd = Math.floor(timeStart + evt.duration * 1000);
			}

			const drift = Math.abs(timeStart - last.timeStart);
			const changed =
				title !== last.title ||
				artist !== last.artist ||
				playing !== last.playing ||
				artwork !== last.artwork ||
				(playing && drift > 2000);

			if (changed) {
				last = { title, artist, playing, artwork, timeStart };
				sendBridge("update_rpc", {
					title,
					artist,
					isPlaying: playing,
					artwork,
					timeStart,
					timeEnd,
					songUrl: evt.songUrl,
				});
			}
		} catch (e) {
			console.error("[SClient] Discord RPC bridge error:", e);
		}
	});
}

setupDiscordRpc();
