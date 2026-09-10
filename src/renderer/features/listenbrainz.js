class ListenbrainzFeature extends Feature {
  get featureKey() {
    return "integrations.listenbrainz.enabled";
  }
  get settingsCategory() {
    return "integrations";
  }
  get settingsLabel() {
    return "ListenBrainz Scrobbling";
  }
  get settingsFields() {
    return [
      {
        type: "password",
        key: "integrations.listenbrainz.token",
        label: "Token",
      },
    ];
  }
  settingsCustom() {
    return `
      <div class="sclient-card-custom-row">
        <span id="sclient-listenbrainz-status" class="sclient-status-pill" data-tone="idle">Waiting...</span>
      </div>
    `;
  }

  constructor() {
    super();
    this.elId = "sclient-listenbrainz-status";
    this.authCodes = new Set([401]);
    this.unsubscribePlayback = null;
    this.hasScrobbled = false;
    this.startTime = 0;
    this.threshold = 0;
    this.prevPlaying = false;
  }

  isEnabled() {
    return !!SCLIENT_CONFIG.listenbrainzEnabled;
  }

  updateStatus(elId, text, tone) {
    const el = document.getElementById(elId);
    if (el) {
      el.textContent = text;
      el.dataset.tone = tone || "idle";
    }
  }

  broadcast(cmd, artist, title, timestamp) {
    const payload =
      cmd === "nowPlaying"
        ? {
            listen_type: "playing_now",
            payload: [
              { track_metadata: { artist_name: artist, track_name: title } },
            ],
          }
        : {
            listen_type: "single",
            payload: [
              {
                listened_at: timestamp,
                track_metadata: { artist_name: artist, track_name: title },
              },
            ],
          };
    sendBridge("submit_listenbrainz", payload)
      .then((result) => {
        if (!result || !result.ok) {
          if (result && this.authCodes.has(result.code)) {
            this.updateStatus(this.elId, "Auth Error", "error");
          }
        }
      })
      .catch(() => {});
  }

  init() {
    if (this.enabled) return;
    super.init();
    const token = SCLIENT_CONFIG.listenbrainzToken;
    if (!token || token.length < 10) return;
    this.hasScrobbled = false;
    this.startTime = 0;
    this.threshold = 0;
    this.prevPlaying = false;
    this.updateStatus(this.elId, "Waiting...", "idle");
    this.unsubscribePlayback = onPlaybackChange((evt) => {
      if (evt.type === "none") {
        this.updateStatus(this.elId, "Waiting...", "idle");
        this.prevPlaying = false;
        return;
      }

      const artist = evt.trackData ? getArtistFromTrack(evt.trackData) : "";
      const title = evt.trackData ? evt.trackData.title : "";

      if (evt.type === "track_start") {
        this.hasScrobbled = false;
        this.startTime = Math.floor(evt.timestamp / 1000);
        this.threshold = evt.trackData
          ? Math.min(evt.trackData.duration / 1000 / 2, 240)
          : 0;
        if (evt.isPlaying && artist && title) {
          this.broadcast("nowPlaying", artist, title);
          this.updateStatus(this.elId, "Listening...", "listening");
        }
        this.prevPlaying = evt.isPlaying;
        return;
      }

      if (
        evt.isPlaying &&
        !this.prevPlaying &&
        !this.hasScrobbled &&
        artist &&
        title
      ) {
        this.broadcast("nowPlaying", artist, title);
      }

      if (evt.trackData && evt.isPlaying) {
        const elapsed = Math.floor(
          (evt.timestamp - this.startTime * 1000) / 1000,
        );
        if (!this.hasScrobbled && elapsed >= this.threshold) {
          this.broadcast("scrobble", artist, title, this.startTime);
          this.hasScrobbled = true;
          this.updateStatus(this.elId, "Scrobbled!", "recorded");
        } else if (!this.hasScrobbled) {
          this.updateStatus(this.elId, "Listening...", "listening");
        }
      } else if (!evt.isPlaying && evt.trackData) {
        const status = this.hasScrobbled ? "Scrobbled!" : "Paused";
        const tone = this.hasScrobbled ? "recorded" : "paused";
        this.updateStatus(this.elId, status, tone);
      }

      this.prevPlaying = evt.isPlaying;
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

const LISTENBRAINZ_FEATURE = new ListenbrainzFeature();
FEATURES.push(LISTENBRAINZ_FEATURE);
