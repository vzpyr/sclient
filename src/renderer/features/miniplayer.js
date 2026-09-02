class MiniplayerFeature extends Feature {
  get featureKey() {
    return "features.show_miniplayer";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Mini Player";
  }

  constructor() {
    super();
    this.unsubscribePlayback = null;
    this.liveTimeTimer = null;
    this.cachedMedia = null;
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.unsubscribePlayback = onPlaybackChange((evt) => {
      if (evt.type === "none") return;

      const likeBtn = document.querySelector(".playbackSoundBadge__like");
      const shuffleBtn = document.querySelector(".shuffleControl");
      const repeatBtn = document.querySelector(".repeatControl");

      let loopState = "none";
      if (repeatBtn) {
        if (repeatBtn.classList.contains("m-one")) loopState = "one";
        else if (repeatBtn.classList.contains("m-all")) loopState = "all";
      }

      window.postMessage(
        {
          source: "sclient-mini-update",
          data: {
            trackData: evt.trackData,
            isPlaying: evt.isPlaying,
            position: evt.position,
            duration: evt.duration,
            isLiked: likeBtn
              ? likeBtn.classList.contains("sc-button-selected")
              : false,
            isShuffled: shuffleBtn
              ? shuffleBtn.classList.contains("m-shuffling")
              : false,
            loopState: loopState,
            accent: getAccent(),
            playbackRate: window.sclient_effects
              ? window.sclient_effects.speed
              : 1,
            showVisualizer: SCLIENT_CONFIG.showVisualizer,
          },
        },
        "*",
      );
    });

    const onAction = (event) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== "sclient-mini-action"
      )
        return;
      playerCommand(event.data.action);
    };
    this.on(window, "message", onAction);

    const sendLiveTime = () => {
      let media = window.__scMedia || [];
      if (media.length === 0) {
        if (!this.cachedMedia) {
          this.cachedMedia = Array.from(
            document.querySelectorAll("audio, video"),
          );
        }
        media = this.cachedMedia;
      }
      const activeMedia =
        media.find((m) => !m.paused && m.duration > 0) || media[0];

      if (activeMedia && !activeMedia.paused) {
        window.postMessage(
          {
            source: "sclient-mini-time",
            data: { position: activeMedia.currentTime, isPlaying: true },
          },
          "*",
        );
      }
    };
    this.liveTimeTimer = setInterval(sendLiveTime, 100);
  }
  checkInjected() {
    return !!document.getElementById("sclient-mini-btn");
  }

  injectUI() {
    if (document.getElementById("sclient-mini-btn")) return;

    const target = document.querySelector(".playbackSoundBadge__showQueue");
    if (!target || !target.parentNode) {
      this.injected = false;
      return;
    }

    const btn = document.createElement("button");
    btn.id = "sclient-mini-btn";
    btn.className =
      "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
    btn.title = "Mini Player";
    btn.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-turntable-icon lucide-turntable"><path d="M10 12.01h.01"/><path d="M18 8v4a8 8 0 0 1-1.07 4"/><circle cx="10" cy="12" r="4"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg></div>';

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      window.postMessage({ source: "sclient-mini-toggle" }, "*");
    });

    target.parentNode.insertBefore(btn, target);
    this.cleanup.push(() => {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    });
  }

  destroy() {
    if (this.unsubscribePlayback) {
      this.unsubscribePlayback();
      this.unsubscribePlayback = null;
    }
    if (this.liveTimeTimer) {
      clearInterval(this.liveTimeTimer);
      this.liveTimeTimer = null;
    }
    this.cachedMedia = null;
    super.destroy();
  }
}

const MINIPLAYER_FEATURE = new MiniplayerFeature();
FEATURES.push(MINIPLAYER_FEATURE);
