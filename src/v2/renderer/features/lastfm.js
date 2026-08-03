class LastfmFeature extends Feature {
  get featureKey() {
    return "integrations.lastfm.enabled";
  }
  get settingsCategory() {
    return "integrations";
  }
  get settingsLabel() {
    return "Last.fm Scrobbling";
  }
  get settingsFields() {
    return [
      { type: "text", key: "integrations.lastfm.api_key", label: "API Key" },
      { type: "text", key: "integrations.lastfm.secret", label: "Secret" },
    ];
  }
  settingsCustom() {
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
        <button id="sclient-lastfm-connect-btn" class="sclient-btn sclient-btn-primary">Connect Last.fm Account</button>
        <span id="sclient-lastfm-status" style="font-size:11px;font-weight:bold;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#ccc;">Waiting...</span>
      </div>
    `;
  }

  constructor() {
    super();
    this.elId = "sclient-lastfm-status";
    this.authCodes = new Set([4, 9, 14]);
    this.unsubscribePlayback = null;
    this.hasScrobbled = false;
    this.startTime = 0;
    this.threshold = 0;
    this.prevPlaying = false;
  }

  isEnabled() {
    return !!SCLIENT_CONFIG.lastfmEnabled;
  }

  updateStatus(elId, text, color) {
    const el = document.getElementById(elId);
    if (el) {
      el.textContent = text;
      el.style.color = color || "#ccc";
    }
  }

  broadcast(cmd, artist, title, timestamp) {
    const p =
      cmd === "nowPlaying"
        ? sendBridge("lastfm_now_playing", { artist, title })
        : sendBridge("lastfm_scrobble", { artist, title, timestamp });
    p.then((result) => {
      if (!result || !result.ok) {
        if (result && this.authCodes.has(result.code)) {
          this.updateStatus(this.elId, "Auth Error", "#f55");
        }
      }
    });
  }

  init() {
    if (this.enabled) return;
    super.init();
    if (!SCLIENT_CONFIG.lastfmSessionKey) return;
    this.hasScrobbled = false;
    this.startTime = 0;
    this.threshold = 0;
    this.prevPlaying = false;
    this.updateStatus(this.elId, "Waiting...", "#ccc");
    this.unsubscribePlayback = onPlaybackChange((evt) => {
      if (evt.type === "none") {
        this.updateStatus(this.elId, "Waiting...", "#ccc");
        this.prevPlaying = false;
        return;
      }

      const artist = evt.trackData ? getArtistFromTrack(evt.trackData) : "";
      const title = evt.trackData ? evt.trackData.title : "";

      if (evt.type === "track_start") {
        this.hasScrobbled = false;
        this.startTime = Math.floor(evt.timestamp / 1000);
        this.threshold = evt.trackData ? Math.min(evt.trackData.duration / 1000 / 2, 240) : 0;
        if (evt.isPlaying && artist && title) {
          this.broadcast("nowPlaying", artist, title);
          this.updateStatus(this.elId, "Listening...", "#789cff");
        }
        this.prevPlaying = evt.isPlaying;
        return;
      }

      if (evt.isPlaying && !this.prevPlaying && !this.hasScrobbled && artist && title) {
        this.broadcast("nowPlaying", artist, title);
      }

      if (evt.trackData && evt.isPlaying) {
        const elapsed = Math.floor((evt.timestamp - this.startTime * 1000) / 1000);
        if (!this.hasScrobbled && elapsed >= this.threshold) {
          this.broadcast("scrobble", artist, title, this.startTime);
          this.hasScrobbled = true;
          this.updateStatus(this.elId, "Scrobbled!", "#5f5");
        } else if (!this.hasScrobbled) {
          this.updateStatus(this.elId, "Listening...", "#789cff");
        }
      } else if (!evt.isPlaying && evt.trackData) {
        const status = this.hasScrobbled ? "Scrobbled!" : "Paused";
        const color = this.hasScrobbled ? "#5f5" : "#f9a826";
        this.updateStatus(this.elId, status, color);
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

const LASTFM_FEATURE = new LastfmFeature();
FEATURES.push(LASTFM_FEATURE);
