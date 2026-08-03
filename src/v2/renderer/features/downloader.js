class DownloaderFeature extends Feature {
  get featureKey() {
    return "features.show_downloader";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Download Button";
  }

  injectUI() {
    this.injectDownloadButton();
    this.injectPlaylistDownloadButton();
  }

  injectDownloadButton() {
    if (document.getElementById("sclient-download-btn")) return;

    const queueBtn = document.querySelector(".playbackSoundBadge__showQueue");
    if (!queueBtn || !queueBtn.parentNode) {
      this.injected = false;
      return;
    }

    const btn = document.createElement("button");
    btn.id = "sclient-download-btn";
    btn.className =
      "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
    btn.title = "Download";
    btn.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg></div>';

    this.on(btn, "click", (e) => {
      e.preventDefault();
      const current = getCurrentTrack();
      if (!current || !current.songUrl) return;
      const fullUrl = current.songUrl;

      document.querySelectorAll(".sclient-download-toast").forEach((t) => t.remove());

      const toast = document.createElement("div");
      toast.className = "sclient-download-toast";
      toast.innerHTML = `
			<div style="display:flex; flex-direction:column; width:200px;">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span class="sclient-toast-title" style="font-weight:600; font-size:var(--sclient-text-base);">Downloading...</span>
					<button class="sclient-toast-close sclient-btn sclient-btn-ghost" style="padding:2px 4px;">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				</div>
				<div style="display:flex; align-items:center; gap:8px;">
					<div style="flex-grow:1; height:6px; background-color:var(--sclient-border); border-radius:10px; overflow:hidden; display:flex;">
						<div class="sclient-toast-progress" style="width: 0%; background-color: var(--sclient-accent); transition: width 0.2s;"></div>
					</div>
					<span class="sclient-toast-percent" style="font-size:var(--sclient-text-sm); min-width:32px; text-align:right; color:var(--sclient-text-muted);">0%</span>
				</div>
			</div>
		`;
      toast.style.right = SCLIENT_CONFIG.lazyScroll ? "70px" : "20px";
      toast.style.padding = "6px 10px";
      toast.style.textAlign = "left";
      toast.style.pointerEvents = "auto";

      const progressFill = toast.querySelector(".sclient-toast-progress");
      const percentText = toast.querySelector(".sclient-toast-percent");
      const titleText = toast.querySelector(".sclient-toast-title");
      const closeBtn = toast.querySelector(".sclient-toast-close");

      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
      });

      closeBtn.addEventListener("click", () => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      });

      const progressHandler = (event) => {
        if (
          event.data &&
          event.data.source === "sclient-bridge-event" &&
          event.data.event === "download_progress"
        ) {
          if (event.data.data.url === fullUrl) {
            const pct = event.data.data.percent;
            progressFill.style.width = pct + "%";
            percentText.textContent = Math.round(parseFloat(pct)) + "%";
          }
        }
      };
      window.addEventListener("message", progressHandler);

      sendBridge("download_song", { url: fullUrl })
        .then(() => {
          window.removeEventListener("message", progressHandler);
          progressFill.style.width = "100%";
          percentText.textContent = "100%";
          titleText.textContent = "Download finished.";
        })
        .catch((err) => {
          window.removeEventListener("message", progressHandler);
          titleText.textContent = "Failed: " + (err.message || err);
          titleText.style.color = "var(--sclient-danger)";
        });
    });

    queueBtn.parentNode.insertBefore(btn, queueBtn);

    this.cleanup.push(() => {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    });
  }

  injectPlaylistDownloadButton() {
    if (!document.querySelector(".listenDetails__trackList")) {
      this.injected = false;
      return;
    }

    const buttonGroup = document.querySelector(".listenEngagement__footer .sc-button-group");
    if (!buttonGroup) {
      this.injected = false;
      return;
    }

    if (document.getElementById("sclient-playlist-download-btn")) {
      if (buttonGroup.querySelector("#sclient-playlist-download-btn")) return;
      const oldBtn = document.getElementById("sclient-playlist-download-btn");
      if (oldBtn) oldBtn.remove();
    }

    const btn = document.createElement("button");
    btn.id = "sclient-playlist-download-btn";
    btn.className = "sc-button-secondary sc-button sc-button-medium sc-button-icon sc-button-responsive";
    btn.title = "Download Playlist";
    btn.innerHTML = '<div><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-down-icon lucide-folder-down"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m15 13-3 3-3-3"/></svg></div>';

    this.on(btn, "click", async (e) => {
      e.preventDefault();
      let fullUrl = window.location.href.split("?")[0];

      document.querySelectorAll(".sclient-download-toast").forEach((t) => t.remove());

      const toast = document.createElement("div");
      toast.className = "sclient-download-toast";
      toast.innerHTML = `
			<div style="display:flex; flex-direction:column; width:200px;">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span class="sclient-toast-title" style="font-weight:600; font-size:var(--sclient-text-base);">Downloading Playlist...</span>
					<button class="sclient-toast-close sclient-btn sclient-btn-ghost" style="padding:2px 4px;">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				</div>
				<div style="display:flex; align-items:center; gap:8px;">
					<div style="flex-grow:1; height:6px; background-color:var(--sclient-border); border-radius:10px; overflow:hidden; display:flex;">
						<div class="sclient-toast-progress" style="width: 0%; background-color: var(--sclient-accent); transition: width 0.2s;"></div>
					</div>
					<span class="sclient-toast-percent" style="font-size:var(--sclient-text-sm); min-width:32px; text-align:right; color:var(--sclient-text-muted);">0%</span>
				</div>
			</div>
		`;
      toast.style.right = SCLIENT_CONFIG.lazyScroll ? "70px" : "20px";
      toast.style.padding = "6px 10px";
      toast.style.textAlign = "left";
      toast.style.pointerEvents = "auto";

      const progressFill = toast.querySelector(".sclient-toast-progress");
      const percentText = toast.querySelector(".sclient-toast-percent");
      const titleText = toast.querySelector(".sclient-toast-title");
      const closeBtn = toast.querySelector(".sclient-toast-close");

      document.body.appendChild(toast);
      requestAnimationFrame(() => (toast.style.opacity = "1"));

      closeBtn.addEventListener("click", () => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      });

      try {
        const cid = extractClientId();
        const tok = extractOAuthToken();
        if (cid && tok) {
          const res = await fetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(fullUrl)}&client_id=${cid}`, {
            headers: { Authorization: `OAuth ${tok}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.sharing === "private" && data.secret_token && !fullUrl.includes(data.secret_token)) {
              fullUrl += "/" + data.secret_token;
            }
          }
        }
      } catch (_) {}

      const progressHandler = (event) => {
        if (event.data && event.data.source === "sclient-bridge-event" && event.data.event === "download_progress") {
          if (event.data.data.url === fullUrl) {
            const pct = event.data.data.percent;
            progressFill.style.width = pct + "%";
            percentText.textContent = Math.round(parseFloat(pct)) + "%";
          }
        }
      };
      window.addEventListener("message", progressHandler);

      sendBridge("download_song", { url: fullUrl, isPlaylist: true })
        .then(() => {
          window.removeEventListener("message", progressHandler);
          progressFill.style.width = "100%";
          percentText.textContent = "100%";
          titleText.textContent = "Playlist downloaded.";
        })
        .catch((err) => {
          window.removeEventListener("message", progressHandler);
          titleText.textContent = "Failed: " + (err.message || err);
          titleText.style.color = "var(--sclient-danger)";
        });
    });
    buttonGroup.appendChild(btn);

    this.cleanup.push(() => {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    });
  }
}

const DOWNLOADER_FEATURE = new DownloaderFeature();
FEATURES.push(DOWNLOADER_FEATURE);
