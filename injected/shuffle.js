function resolveUrl(arg) {
  if (typeof arg === "string") return arg;
  if (arg instanceof URL) return arg.href;
  if (arg && arg.url) return arg.url;
  return "";
}

const origFetch = window.fetch;
window.fetch = async function (...args) {
  const url = resolveUrl(args[0]);

  if (
    trueShuffleOn &&
    url &&
    url.includes("api-v2.soundcloud.com/playlists/") &&
    url.includes("representation=full")
  ) {
    try {
      const response = await origFetch.apply(this, args);
      const clone = response.clone();
      const data = await clone.json();

      if (data && data.tracks && Array.isArray(data.tracks)) {
        const stubIds = data.tracks.filter((t) => !t.title && t.id).map((t) => t.id);

        if (stubIds.length > 0) {
          const clientId = new URL(url).searchParams.get("client_id");
          if (clientId) {
            const chunks = [];
            for (let i = 0; i < stubIds.length; i += 50) {
              chunks.push(
                window
                  .fetch(
                    `https://api-v2.soundcloud.com/tracks?ids=${stubIds.slice(i, i + 50).join(",")}&client_id=${clientId}`
                  )
                  .then((r) => r.json())
                  .catch(() => [])
              );
            }
            const results = await Promise.all(chunks);
            const map = {};
            results.forEach((arr) => {
              if (Array.isArray(arr))
                arr.forEach((t) => {
                  map[t.id] = t;
                });
            });

            data.tracks = data.tracks.map((t) => (!t.title && map[t.id] ? map[t.id] : t));
          }
        }
      }
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (e) {
      console.error("[SClient] Fetch interception error:", e);
      return origFetch.apply(this, args);
    }
  }

  return origFetch.apply(this, args);
};

const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function (method, url) {
  const finalUrl = resolveUrl(url);
  this._scMethod = method;
  this._scUrl = finalUrl;
  this._scHeaders = {};
  return origOpen.call(this, method, finalUrl);
};

XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
  this._scHeaders[header] = value;
  return origSetHeader.call(this, header, value);
};

XMLHttpRequest.prototype.send = function (body) {
  if (
    trueShuffleOn &&
    this._scUrl &&
    this._scUrl.includes("api-v2.soundcloud.com/playlists/") &&
    this._scUrl.includes("representation=full")
  ) {
    fetch(this._scUrl, {
      method: this._scMethod,
      headers: this._scHeaders,
      body,
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (data && data.tracks && Array.isArray(data.tracks)) {
          const stubIds = data.tracks.filter((t) => !t.title && t.id).map((t) => t.id);

          if (stubIds.length > 0) {
            const clientId = new URL(this._scUrl, window.location.origin).searchParams.get(
              "client_id"
            );
            if (clientId) {
              const chunks = [];
              for (let i = 0; i < stubIds.length; i += 50) {
                chunks.push(
                  fetch(
                    `https://api-v2.soundcloud.com/tracks?ids=${stubIds.slice(i, i + 50).join(",")}&client_id=${clientId}`
                  )
                    .then((r) => r.json())
                    .catch(() => [])
                );
              }
              const results = await Promise.all(chunks);
              const map = {};
              results.forEach((arr) => {
                if (Array.isArray(arr))
                  arr.forEach((t) => {
                    map[t.id] = t;
                  });
              });
              data.tracks = data.tracks.map((t) => (!t.title && map[t.id] ? map[t.id] : t));
            }
          }
        }

        if (trueShuffleOn && trueShuffleMode === "api" && data.tracks && data.tracks.length > 1) {
          for (let i = data.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [data.tracks[i], data.tracks[j]] = [data.tracks[j], data.tracks[i]];
          }
        }

        const text = JSON.stringify(data);

        Object.defineProperty(this, "responseText", { get: () => text });
        Object.defineProperty(this, "response", { get: () => text });
        Object.defineProperty(this, "readyState", { get: () => 4 });
        Object.defineProperty(this, "status", { get: () => 200 });
        Object.defineProperty(this, "statusText", { get: () => "OK" });
        Object.defineProperty(this, "getAllResponseHeaders", {
          value: () => "content-type: application/json; charset=utf-8\r\n",
        });
        Object.defineProperty(this, "getResponseHeader", {
          value: (hdr) =>
            hdr.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null,
        });

        if (this.onreadystatechange) this.onreadystatechange();
        this.dispatchEvent(new Event("readystatechange"));
        if (this.onload) this.onload();
        this.dispatchEvent(new Event("load"));
        if (this.onloadend) this.onloadend();
        this.dispatchEvent(new Event("loadend"));
      })
      .catch((err) => {
        console.error("[SClient] XHR Hydration failed:", err);
        origSend.call(this, body);
      });
    return;
  }
  return origSend.call(this, body);
};

async function forceLoadQueue() {
  const queueBtn = document.querySelector(".playbackSoundBadge__showQueue");
  if (!queueBtn) return;

  const queueOpen = !!document.querySelector(".playControls__queue .queue.m-visible");

  const hideFallback = document.createElement("style");
  hideFallback.textContent = ".queue__fallback { display: none !important; }";
  document.head.appendChild(hideFallback);

  if (!queueOpen) {
    queueBtn.click();
    await new Promise((r) => setTimeout(r, 250));
  }

  let scrollable = null;
  for (let i = 0; i < 20; i++) {
    scrollable = document.querySelector(".queue__scrollable");
    if (scrollable) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (scrollable) {
    let same = 0;
    let blank = 0;
    let lastTransform = "";

    for (;;) {
      const rect = scrollable.getBoundingClientRect();
      scrollable.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 1000,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          cancelable: true,
        })
      );

      await new Promise((r) => setTimeout(r, 80));

      const items = document.querySelectorAll(".queue__itemWrapper:not(.queue__fallback)");
      if (items.length === 0) {
        blank++;
        if (blank > 10) break;
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }
      blank = 0;

      const transform = items[items.length - 1].style.transform;
      if (transform === lastTransform) {
        same++;
        if (same === 4) await new Promise((r) => setTimeout(r, 400));
        if (same > 8) break;
      } else {
        same = 0;
      }
      lastTransform = transform;
    }
  }

  await new Promise((r) => setTimeout(r, 400));
  if (!queueOpen) queueBtn.click();
  if (hideFallback.parentNode) hideFallback.remove();
}

window.addEventListener(
  "click",
  async (e) => {
    if (!trueShuffleOn || trueShuffleMode !== "native" || !e.isTrusted) return;

    const shuffleBtn = e.target.closest(".shuffleControl");
    if (shuffleBtn && !shuffleBtn.classList.contains("m-shuffling")) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showToast("True Shuffle (Native Mode): Loading full playlist...");
      await forceLoadQueue();
      shuffleBtn.click();
    }
  },
  true
);
