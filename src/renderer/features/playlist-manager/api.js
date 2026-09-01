const SC_APP_VERSION = "1784113427";
const SC_APP_LOCALE = "en";
const SC_BASE = "https://api-v2.soundcloud.com";

async function scReq(path, method = "GET", bodyObj = null) {
  const cid = extractClientId();
  const tok = extractOAuthToken();
  if (!cid || !tok) throw new Error("Missing SoundCloud credentials");
  const sep = path.includes("?") ? "&" : "?";
  const url =
    path.startsWith("http") || path.startsWith(SC_BASE)
      ? path
      : `${SC_BASE}${path}${sep}client_id=${cid}&app_version=${SC_APP_VERSION}&app_locale=${SC_APP_LOCALE}`;
  const opts = {
    method,
    headers: {
      Authorization: `OAuth ${tok}`,
      Accept: "application/json, text/javascript, */*; q=0.01",
    },
  };
  if (bodyObj) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(bodyObj);
  }
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function scCollectPages(firstHref) {
  const all = [];
  let href = firstHref;
  let guard = 0;
  while (href && guard < 100) {
    guard++;
    const page = await scReq(href);
    if (!page) break;
    if (Array.isArray(page.collection)) all.push(...page.collection);
    href = page.next_href || null;
  }
  return all;
}

const api = {
  me() {
    return scReq("/me");
  },

  async listPlaylists(uid) {
    const first = `/users/${uid}/playlists?limit=50&offset=0&linked_partitioning=1`;
    return scCollectPages(first);
  },

  create(title, sharing, trackIds) {
    return scReq("/playlists", "POST", {
      playlist: { title, sharing, tracks: trackIds },
    });
  },

  putTracks(pid, trackIds) {
    return scReq(`/playlists/${pid}`, "PUT", {
      playlist: { tracks: trackIds },
    });
  },

  putFull(pid, fullObj) {
    return scReq(`/playlists/${pid}`, "PUT", { playlist: fullObj });
  },

  del(pid) {
    return scReq(`/playlists/${pid}`, "DELETE");
  },

  getPlaylist(pid) {
    return scReq(`/playlists/${pid}`);
  },

  resolve(trackUrl) {
    return scReq(`/resolve?url=${encodeURIComponent(trackUrl)}`);
  },

  tracks(ids) {
    return scReq(`/tracks?ids=${ids.join(",")}`);
  },

  async search(query) {
    const q = encodeURIComponent(query);
    const page = await scReq(`/search?linked_partitioning=1&limit=20&q=${q}`);
    const c = (page && page.collection) || [];
    return c.filter((t) => t && t.kind === "track");
  },
};
