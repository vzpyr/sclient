class DiscordRpcFeature extends Feature {
  get featureKey() {
    return "features.discord_rpc";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Discord Rich Presence";
  }
  get settingsFields() {
    return [
      {
        type: "select",
        key: "features.discord_rpc_activity_type",
        label: "Activity Type",
        options: [
          { value: "2", label: "Music" },
          { value: "0", label: "Game" },
        ],
      },
    ];
  }

  constructor() {
    super();
    this.last = {
      title: "",
      artist: "",
      playing: false,
      artwork: "",
      timeStart: 0,
      activityType: "",
    };
    this.unsubscribePlayback = null;
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.unsubscribePlayback = onPlaybackChange((evt) => {
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

        const drift = Math.abs(timeStart - this.last.timeStart);
        const activityType = SCLIENT_CONFIG.discordRpcActivityType;
        const changed =
          title !== this.last.title ||
          artist !== this.last.artist ||
          playing !== this.last.playing ||
          artwork !== this.last.artwork ||
          activityType !== this.last.activityType ||
          (playing && drift > 2000);

        if (changed) {
          this.last = {
            title,
            artist,
            playing,
            artwork,
            timeStart,
            activityType,
          };
          const td = evt.trackData;
          sendBridge("update_rpc", {
            title,
            artist,
            isPlaying: playing,
            artwork,
            timeStart,
            timeEnd,
            songUrl: evt.songUrl,
            trackId: td && td.id ? td.id : null,
            artistSlug: td && td.user ? td.user.permalink : null,
            trackSlug: td ? td.permalink : null,
            activityType,
          }).catch(() => {});
        }
      } catch (e) {
        console.error("[SClient] Couldn't update Discord RPC:", e);
      }
    });
  }

  destroy() {
    if (this.unsubscribePlayback) {
      this.unsubscribePlayback();
      this.unsubscribePlayback = null;
    }
    super.destroy();
  }
}

const DISCORD_RPC_FEATURE = new DiscordRpcFeature();
FEATURES.push(DISCORD_RPC_FEATURE);
