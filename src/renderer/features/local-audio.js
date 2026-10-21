function localAudioTrackIdFromMediaUrl(url) {
  let parsed;
  try {
    parsed = new URL(url, window.location.origin);
  } catch (e) {
    return null;
  }
  if (parsed.hostname !== "api-v2.soundcloud.com") return null;
  const match = /^\/media\/(?:soundcloud:tracks:)?(\d+)/.exec(parsed.pathname);
  return match ? match[1] : null;
}

function isLocalAudioTrackApiUrl(url) {
  return (
    url.includes("api-v2.soundcloud.com/") &&
    !url.includes("/media/") &&
    (url.includes("track") ||
      url.includes("search") ||
      url.includes("stream") ||
      url.includes("resolve") ||
      url.includes("playlist") ||
      url.includes("like") ||
      url.includes("user"))
  );
}

function localAudioJsonResponse(data, source) {
  const headers = new Headers(source.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

class LocalAudioFeature extends Feature {
  get featureKey() {
    return "features.local_audio_routing";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Local Audio Routing";
  }
  get settingsDescription() {
    return "Route specific songs to local files with matching track IDs";
  }

  settingsCustom() {
    return '<div class="sclient-field-action"><button id="sclient-open-local-tracks-btn" class="sclient-btn sclient-btn-sm">Open Tracks Folder</button></div>';
  }

  settingsInit(overlay) {
    const btn = overlay.querySelector("#sclient-open-local-tracks-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        sendBridge("open_local_tracks_folder");
      });
    }
  }

  init() {
    if (this.enabled) return;
    super.init();
    if (!SCLIENT_CONFIG.localAudioRouting) return;

    this.localPort = SCLIENT_CONFIG.localAudioPort;
    this.localTrackIds = new Set(
      (SCLIENT_CONFIG.localAudioTrackIds || []).map(String),
    );
    if (!this.localPort || this.localTrackIds.size === 0) return;

    this.patchFetch();
    this.patchXhr();
    this.patchSoundCloudModules();
  }

  cleanTrack(track) {
    if (!track || typeof track !== "object") return false;
    if (!this.localTrackIds.has(String(track.id))) return false;

    let changed = false;
    if (track.policy !== "ALLOW") {
      track.policy = "ALLOW";
      changed = true;
    }
    if (track.monetization_model !== "NOT_APPLICABLE") {
      track.monetization_model = "NOT_APPLICABLE";
      changed = true;
    }
    if (track.blocked !== false) {
      track.blocked = false;
      changed = true;
    }
    if (track.snipped !== false) {
      track.snipped = false;
      changed = true;
    }
    if (
      track.full_duration &&
      track.full_duration !== track.duration &&
      track.duration === 30000
    ) {
      track.duration = track.full_duration;
      changed = true;
    }

    if (Array.isArray(track.media?.transcodings)) {
      for (const transcoding of track.media.transcodings) {
        if (transcoding.snipped !== false) {
          transcoding.snipped = false;
          changed = true;
        }
        if (transcoding.duration !== track.duration) {
          transcoding.duration = track.duration;
          changed = true;
        }
        if (transcoding.url && transcoding.url.includes("/preview/")) {
          transcoding.url = transcoding.url.replace(/\/preview\//g, "/stream/");
          changed = true;
        }
      }
    }

    return changed;
  }

  cleanPayload(data, seen = new WeakSet()) {
    if (!data || typeof data !== "object" || seen.has(data)) return false;
    seen.add(data);

    if (Array.isArray(data)) {
      let changed = false;
      for (const item of data) {
        changed = this.cleanPayload(item, seen) || changed;
      }
      return changed;
    }

    let changed = false;

    if (Array.isArray(data.collection)) {
      changed = this.cleanPayload(data.collection, seen) || changed;
    }
    if (Array.isArray(data.tracks)) {
      changed = this.cleanPayload(data.tracks, seen) || changed;
    }

    if (data.track) {
      changed = this.cleanPayload(data.track, seen) || changed;
    } else if (
      !Array.isArray(data.collection) &&
      !Array.isArray(data.tracks) &&
      data.id
    ) {
      changed = this.cleanTrack(data) || changed;
    }

    return changed;
  }

  patchFetch() {
    const feature = this;
    const { localPort, localTrackIds } = this;
    const origFetch = window.fetch;

    window.fetch = async function (...args) {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input?.url || "";
      const trackId = localAudioTrackIdFromMediaUrl(url);

      if (trackId) {
        if (!localTrackIds.has(trackId)) return origFetch.apply(this, args);
        return new Response(
          JSON.stringify({
            url: `http://127.0.0.1:${localPort}/track/${trackId}`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }

      const res = await origFetch.apply(this, args);

      if (isLocalAudioTrackApiUrl(url)) {
        try {
          const json = await res.clone().json();
          if (!feature.cleanPayload(json)) return res;
          return localAudioJsonResponse(json, res);
        } catch (e) {}
      }

      return res;
    };
  }

  patchXhr() {
    const feature = this;
    const { localPort, localTrackIds } = this;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      this._sclientLocalAudioUrl =
        typeof url === "string" ? url : url?.toString() || "";
      return origOpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const url = this._sclientLocalAudioUrl || "";
      const trackId = localAudioTrackIdFromMediaUrl(url);

      if (trackId && localTrackIds.has(trackId)) {
        const body = JSON.stringify({
          url: `http://127.0.0.1:${localPort}/track/${trackId}`,
        });
        Object.defineProperty(this, "responseText", {
          value: body,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(this, "response", {
          value: this.responseType === "json" ? JSON.parse(body) : body,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(this, "status", {
          value: 200,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(this, "statusText", {
          value: "OK",
          writable: true,
          configurable: true,
        });
        Object.defineProperty(this, "readyState", {
          value: 4,
          writable: true,
          configurable: true,
        });
        setTimeout(() => {
          this.dispatchEvent(new Event("readystatechange"));
          this.dispatchEvent(new Event("load"));
        }, 0);
        return;
      }

      if (trackId) return origSend.apply(this, args);

      if (isLocalAudioTrackApiUrl(url)) {
        let patched = false;
        const patch = () => {
          if (
            patched ||
            this.readyState !== 4 ||
            this.status < 200 ||
            this.status >= 300
          )
            return;
          try {
            const raw =
              this.responseType === "json" ? this.response : this.responseText;
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            const changed = feature.cleanPayload(data);
            patched = true;
            if (!changed) return;
            const body = JSON.stringify(data);
            Object.defineProperty(this, "responseText", {
              value: body,
              writable: true,
              configurable: true,
            });
            Object.defineProperty(this, "response", {
              value: this.responseType === "json" ? data : body,
              writable: true,
              configurable: true,
            });
          } catch (e) {}
        };

        this.addEventListener("readystatechange", patch, true);
        this.addEventListener("load", patch, true);
      }

      return origSend.apply(this, args);
    };
  }

  patchSoundCloudModules() {
    const localTrackIds = this.localTrackIds;

    try {
      if (!Array.isArray(window.webpackJsonp)) return;

      const soundId = (sound) =>
        String(sound.id || (sound.attributes && sound.attributes.id) || "");

      window.webpackJsonp.push([
        ["sclient_local_audio_patch"],
        {
          sclient_local_audio_mod: function (m, e, req) {
            try {
              const soundMod =
                req.c["27"]?.exports?.default || req.c["27"]?.exports;
              if (soundMod && soundMod.prototype) {
                const origIsPlayable = soundMod.prototype.isPlayable;
                const origIsBlocked = soundMod.prototype.isBlocked;
                const origIsSnippetized = soundMod.prototype.isSnippetized;
                const origGet = soundMod.prototype.get;

                soundMod.prototype.isPlayable = function () {
                  if (localTrackIds.has(soundId(this))) return true;
                  return origIsPlayable ? origIsPlayable.call(this) : true;
                };

                soundMod.prototype.isBlocked = function () {
                  if (localTrackIds.has(soundId(this))) return false;
                  return origIsBlocked ? origIsBlocked.call(this) : false;
                };

                soundMod.prototype.isSnippetized = function () {
                  if (localTrackIds.has(soundId(this))) return false;
                  return origIsSnippetized
                    ? origIsSnippetized.call(this)
                    : false;
                };

                soundMod.prototype.get = function (attr) {
                  if (localTrackIds.has(soundId(this))) {
                    if (attr === "policy") return "ALLOW";
                    if (attr === "monetization_model") return "NOT_APPLICABLE";
                    if (attr === "blocked") return false;
                    if (attr === "snipped") return false;
                  }
                  return origGet
                    ? origGet.call(this, attr)
                    : this.attributes
                      ? this.attributes[attr]
                      : undefined;
                };

                const baseSoundProto = Object.getPrototypeOf(
                  soundMod.prototype,
                );
                if (
                  baseSoundProto &&
                  baseSoundProto.makeTemporarilyUnavailable
                ) {
                  const origUnavailable =
                    baseSoundProto.makeTemporarilyUnavailable;
                  baseSoundProto.makeTemporarilyUnavailable = function () {
                    if (localTrackIds.has(soundId(this))) {
                      this._temporarilyUnavailable = false;
                      return;
                    }
                    return origUnavailable.call(this);
                  };
                }
              }

              const streamUrlRetrieverMod = req.c["446"]?.exports || req("446");
              if (streamUrlRetrieverMod?.StreamUrlRetriever?.prototype) {
                const origGetUrl =
                  streamUrlRetrieverMod.StreamUrlRetriever.prototype.getUrl;
                streamUrlRetrieverMod.StreamUrlRetriever.prototype.getUrl =
                  function (opts) {
                    const trackId = String(
                      this._trackId ||
                        (this.getTrackId ? this.getTrackId() : ""),
                    );
                    if (localTrackIds.has(trackId)) {
                      if (opts) opts.snippet = false;
                    }
                    return origGetUrl.call(this, opts);
                  };
              }

              const buildPlayerMod = req.c["1294"]?.exports || req("1294");
              if (
                buildPlayerMod &&
                typeof buildPlayerMod.buildPlayer === "function"
              ) {
                const origBuildPlayer = buildPlayerMod.buildPlayer;
                buildPlayerMod.buildPlayer = function (opts) {
                  if (opts && opts.dataPromise) {
                    const origPromise = opts.dataPromise;
                    opts.dataPromise = origPromise.then((data) => {
                      if (data && localTrackIds.has(String(data.trackId))) {
                        data.getPolicy = () => "ALLOW";
                      }
                      return data;
                    });
                  }
                  return origBuildPlayer.call(this, opts);
                };
              }
            } catch (err) {
              console.error(
                "[SClient] Error hooking sound/player modules:",
                err,
              );
            }
          },
        },
        [["sclient_local_audio_mod"]],
      ]);
    } catch (e) {}
  }
}

const LOCAL_AUDIO_FEATURE = new LocalAudioFeature();
FEATURES.push(LOCAL_AUDIO_FEATURE);
