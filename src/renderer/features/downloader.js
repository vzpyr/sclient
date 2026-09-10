async function resolvePlaylistData(url, cid, tok) {
  if (!cid) return { resolvedUrl: url, playlistTitle: "", tracks: [] };
  const headers = tok ? { Authorization: `OAuth ${tok}` } : {};
  try {
    const res = await fetch(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${cid}`,
      { headers },
    );
    if (!res.ok) return { resolvedUrl: url, playlistTitle: "", tracks: [] };
    const data = await res.json();
    let resolvedUrl = url;
    if (
      data.sharing === "private" &&
      data.secret_token &&
      !resolvedUrl.includes(data.secret_token)
    ) {
      resolvedUrl += "/" + data.secret_token;
    }
    const playlistTitle = data.title || "";
    let tracks = [];
    if (data.tracks && Array.isArray(data.tracks)) {
      const stubIds = data.tracks
        .filter((t) => !t.title && t.id)
        .map((t) => t.id);
      if (stubIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < stubIds.length; i += 50) {
          const chunkIds = stubIds.slice(i, i + 50).join(",");
          chunks.push(
            fetch(
              `https://api-v2.soundcloud.com/tracks?ids=${chunkIds}&client_id=${cid}`,
              { headers },
            )
              .then((r) => r.json())
              .catch(() => []),
          );
        }
        const results = await Promise.all(chunks);
        const map = new Map();
        for (const arr of results) {
          if (Array.isArray(arr)) {
            for (const t of arr) {
              if (t && t.id) map.set(t.id, t);
            }
          }
        }
        data.tracks = data.tracks.map((t) =>
          !t.title && map.has(t.id) ? map.get(t.id) : t,
        );
      }
      tracks = data.tracks.map((track, i) => {
        const account = track.user?.username || "";
        const artist =
          (track.publisher_metadata && track.publisher_metadata.artist) ||
          track.artist ||
          "";
        return {
          id: track.id,
          index: i + 1,
          url: track.permalink_url || "",
          account,
          artist,
          title: track.title || "",
        };
      });
    }
    return { resolvedUrl, playlistTitle, tracks };
  } catch (_) {
    return { resolvedUrl: url, playlistTitle: "", tracks: [] };
  }
}

function createDownloadToast(title) {
  document
    .querySelectorAll(".sclient-download-toast")
    .forEach((t) => t.remove());

  const toast = document.createElement("div");
  toast.className = "sclient-download-toast";
  if (SCLIENT_CONFIG.lazyScroll) toast.classList.add("offset");
  toast.innerHTML = `
    <div class="sclient-toast-body">
      <div class="sclient-toast-top">
        <span class="sclient-toast-title">${title}</span>
        <button class="sclient-toast-close sclient-btn sclient-btn-ghost sclient-btn-icon">${lucideIcon("x")}</button>
      </div>
      <div class="sclient-toast-row">
        <div class="sclient-toast-bar">
          <div class="sclient-toast-progress"></div>
        </div>
        <span class="sclient-toast-percent">0%</span>
      </div>
    </div>
  `;

  const refs = {
    toast,
    progressFill: toast.querySelector(".sclient-toast-progress"),
    percentText: toast.querySelector(".sclient-toast-percent"),
    titleText: toast.querySelector(".sclient-toast-title"),
    closeBtn: toast.querySelector(".sclient-toast-close"),
  };

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("open"));
  return refs;
}

function setDownloadFailed(refs, err) {
  refs.titleText.textContent = "Failed: " + (err.message || err);
  refs.titleText.classList.add("failed");
}

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

  checkInjected() {
    const hasTrackBtn = !!document.getElementById("sclient-download-btn");
    if (!hasTrackBtn) return false;

    const isPlaylist = !!document.querySelector(".listenDetails__trackList");
    if (isPlaylist) {
      const buttonGroup = document.querySelector(
        ".listenEngagement__footer .sc-button-group",
      );
      if (
        !buttonGroup ||
        !buttonGroup.querySelector("#sclient-playlist-download-btn")
      ) {
        return false;
      }
    }

    return true;
  }

  injectDownloadButton() {
    if (document.getElementById("sclient-download-btn")) return;

    const queueBtn = document.querySelector(".playbackSoundBadge__showQueue");
    if (!queueBtn || !queueBtn.parentNode) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = "sclient-download-btn";
    btn.className =
      "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
    btn.title = "Download";
    btn.innerHTML = `<div class="sclient-sc-icon">${lucideIcon("download")}</div>`;

    this.on(btn, "click", (e) => {
      e.preventDefault();
      const current = getCurrentTrack();
      if (!current || !current.songUrl) return;
      const fullUrl = current.songUrl;
      const trackData = current.trackData;
      const singleTrack = trackData
        ? {
            id: trackData.id,
            url: fullUrl,
            account: trackData.user?.username || "",
            artist:
              (trackData.publisher_metadata &&
                trackData.publisher_metadata.artist) ||
              trackData.artist ||
              "",
            title: trackData.title || "",
          }
        : null;

      const refs = createDownloadToast("Downloading...");
      const { toast, progressFill, percentText, titleText, closeBtn } = refs;

      closeBtn.addEventListener("click", () => {
        sendBridge("cancel_download", { url: fullUrl });
        titleText.textContent = "Download cancelled.";
        toast.classList.remove("open");
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

      sendBridge("download_song", { url: fullUrl, track: singleTrack })
        .then(() => {
          window.removeEventListener("message", progressHandler);
          if (titleText.textContent === "Download cancelled.") return;
          progressFill.style.width = "100%";
          percentText.textContent = "100%";
          titleText.textContent = "Download finished.";
        })
        .catch((err) => {
          window.removeEventListener("message", progressHandler);
          setDownloadFailed(refs, err);
        });
    });

    queueBtn.parentNode.insertBefore(btn, queueBtn);

    this.cleanup.push(() => {
      if (btn.parentNode) btn.parentNode.removeChild(btn);
    });
  }

  injectPlaylistDownloadButton() {
    if (!document.querySelector(".listenDetails__trackList")) {
      return;
    }

    const buttonGroup = document.querySelector(
      ".listenEngagement__footer .sc-button-group",
    );
    if (!buttonGroup) {
      return;
    }

    if (document.getElementById("sclient-playlist-download-btn")) {
      if (buttonGroup.querySelector("#sclient-playlist-download-btn")) return;
      const oldBtn = document.getElementById("sclient-playlist-download-btn");
      if (oldBtn) oldBtn.remove();
    }

    const btn = document.createElement("button");
    btn.id = "sclient-playlist-download-btn";
    btn.className =
      "sc-button-secondary sc-button sc-button-medium sc-button-icon sc-button-responsive";
    btn.title = "Download Playlist";
    btn.innerHTML = `<div>${lucideIcon("folder-down")}</div>`;

    this.on(btn, "click", async (e) => {
      e.preventDefault();
      let fullUrl = window.location.href.split("?")[0];

      const refs = createDownloadToast("Downloading Playlist...");
      const { toast, progressFill, percentText, titleText, closeBtn } = refs;

      closeBtn.addEventListener("click", () => {
        sendBridge("cancel_download", { url: fullUrl });
        titleText.textContent = "Download cancelled.";
        toast.classList.remove("open");
        setTimeout(() => toast.remove(), 300);
      });

      const cid = extractClientId();
      const tok = extractOAuthToken();
      const { resolvedUrl, playlistTitle, tracks } = await resolvePlaylistData(
        fullUrl,
        cid,
        tok,
      );
      fullUrl = resolvedUrl;

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

      sendBridge("download_song", {
        url: fullUrl,
        isPlaylist: true,
        playlistTitle,
        tracks,
      })
        .then(() => {
          window.removeEventListener("message", progressHandler);
          if (titleText.textContent === "Download cancelled.") return;
          progressFill.style.width = "100%";
          percentText.textContent = "100%";
          titleText.textContent = "Playlist download finished.";
        })
        .catch((err) => {
          window.removeEventListener("message", progressHandler);
          setDownloadFailed(refs, err);
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
