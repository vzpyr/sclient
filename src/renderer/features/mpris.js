class MprisFeature extends Feature {
  get featureKey() {
    return "features.mpris";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "MPRIS Integration";
  }

  constructor() {
    super();
    this.unsubscribePlayback = null;
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.unsubscribePlayback = onPlaybackChange((evt) => {
      if (evt.type === "none") return;

      const artwork =
        evt.trackData && evt.trackData.artwork_url
          ? evt.trackData.artwork_url.replace(
              /-(t50x50|badge|large|t120x120)\.(jpg|png)/i,
              "-t500x500.$2",
            )
          : "";
      window.postMessage(
        {
          source: "sclient-mpris-update",
          data: {
            title: evt.trackData ? evt.trackData.title : "",
            artist: evt.trackData ? getArtistFromTrack(evt.trackData) : "",
            artwork,
            isPlaying: evt.isPlaying,
            position: evt.position,
            duration: evt.duration,
            songUrl: evt.songUrl || "",
            volume: getActiveMedia()?.volume ?? 1,
          },
        },
        "*",
      );
    });

    const onCommand = (event) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== "sclient-mpris-command"
      )
        return;
      const data = event.data.data;
      if (data) playerCommand(data);
    };
    this.on(window, "message", onCommand);
  }

  destroy() {
    if (this.unsubscribePlayback) {
      this.unsubscribePlayback();
      this.unsubscribePlayback = null;
    }
    super.destroy();
  }
}

const MPRIS_FEATURE = new MprisFeature();
FEATURES.push(MPRIS_FEATURE);
