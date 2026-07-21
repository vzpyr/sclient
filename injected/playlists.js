const SC_APP_VERSION = "1784113427";
const SC_APP_LOCALE = "en";
const SC_BASE = "https://api-v2.soundcloud.com";

function extractOAuthToken() {
  try {
    for (const c of document.cookie.split(";")) {
      const [key, val] = c.trim().split("=");
      if (key === "oauth_token" && val && val.startsWith("2-")) return val;
    }
  } catch (e) {}
  try {
    const t = localStorage.getItem("oauth_token");
    if (t && t.startsWith("2-")) return t;
  } catch (e) {}
  try {
    const t = sessionStorage.getItem("oauth_token");
    if (t && t.startsWith("2-")) return t;
  } catch (e) {}
  return null;
}

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
    return scReq(`/playlists/${pid}`, "PUT", { playlist: { tracks: trackIds } });
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

let _pmState = {
  userId: null,
  playlists: [],
  hydrated: new Set(),
  selectedId: null,
  sortMode: "name",
  filterText: "",
  trackFilterText: "",
  selection: new Set(),
  anchorId: null,
  dragging: null,
  contextMenu: null,
  editor: null,
  dropTargetId: null,
};

const PLACEHOLDER_ART =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'#444\' stroke-width=\'1\'><rect width=\'24\' height=\'24\' fill=\'#1a1a1a\'/><path d=\'M9 18V5l12-2v13\'/><circle cx=\'6\' cy=\'18\' r=\'3\'/><circle cx=\'18\' cy=\'16\' r=\'3\'/></svg>'
  );

function pmFmtDur(ms) {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function pmFmtTotal(ms) {
  if (!ms || ms < 0) return "0m";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function pmPlaylistArt(pl) {
  if (pl && pl.artwork_url) return pl.artwork_url;
  const t = pl && pl.tracks && pl.tracks[0];
  if (t && t.artwork_url) return t.artwork_url;
  return PLACEHOLDER_ART;
}

function pmTrackArt(t) {
  return (t && t.artwork_url) || PLACEHOLDER_ART;
}

function pmCurrent() {
  return _pmState.playlists.find((p) => p.id === _pmState.selectedId) || null;
}

function pmTrackCount(pl) {
  if (!pl) return 0;
  return pl.track_count != null ? pl.track_count : (pl.tracks ? pl.tracks.length : 0);
}

async function pmHydrateCurrent() {
  const pl = pmCurrent();
  if (!pl) return;
  if (_pmState.hydrated.has(pl.id)) return;
  let full;
  try {
    full = await api.getPlaylist(pl.id);
  } catch (e) {
    showToast("Couldn't load full track list: " + (e.message || e));
    return;
  }
  if (!full || !Array.isArray(full.tracks)) return;

  Object.assign(pl, full);
  const ids = (pl.tracks || []).map((t) => t && t.id).filter((id) => id != null);
  if (ids.length === 0) {
    _pmState.hydrated.add(pl.id);
    return;
  }

  const byId = new Map();
  for (const t of pl.tracks) if (t && t.id != null && t.title) byId.set(t.id, t);
  const need = ids.filter((id) => !byId.has(id));
  if (need.length > 0) {

    for (let i = 0; i < need.length; i += 50) {
      const chunk = need.slice(i, i + 50);
      try {
        const res = await api.tracks(chunk);
        const list = Array.isArray(res) ? res : res && res.collection ? res.collection : [];
        for (const t of list) if (t && t.id != null) byId.set(t.id, t);
      } catch (_) {

      }
    }
  }

  pl.tracks = ids.map((id) => byId.get(id)).filter(Boolean);
  const sumDur = pl.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  if (sumDur) pl.duration = sumDur;
  _pmState.hydrated.add(pl.id);
}

async function pmSelectPlaylist(pid) {
  if (pid == null) return;
  _pmState.selectedId = pid;
  _pmState.selection = new Set();
  _pmState.anchorId = null;
  pmRenderSidebar();
  await pmHydrateCurrent();
  pmRenderSidebar();
  pmRenderDetail();
}

function pmSortedFiltered() {
  let list = _pmState.playlists.slice();
  const q = _pmState.filterText.trim().toLowerCase();
  if (q) list = list.filter((p) => (p.title || "").toLowerCase().includes(q));
  switch (_pmState.sortMode) {
    case "modified":
      list.sort((a, b) =>
        (b.last_modified || "").localeCompare(a.last_modified || "")
      );
      break;
    case "count":
      list.sort((a, b) => pmTrackCount(b) - pmTrackCount(a));
      break;
    case "name":
    default:
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      break;
  }
  return list;
}

function pmRenderSidebar() {
  const list = document.getElementById("pm-sidebar-list");
  if (!list) return;
  const accent = getAccent();
  const items = pmSortedFiltered();

  if (_pmState.playlists.length === 0) {
    list.innerHTML = `<div style="padding:24px 16px;text-align:center;opacity:0.6;line-height:1.6;">
      You have no playlists yet. Create one with the <b>+ New</b> button above.
    </div>`;
    return;
  }
  if (items.length === 0) {
    list.innerHTML = `<div style="padding:24px 16px;text-align:center;opacity:0.5;">No playlists match "${_pmState.filterText.replace(/</g, "&lt;")}".</div>`;
    return;
  }

  list.innerHTML = items
    .map((p) => {
      const active = p.id === _pmState.selectedId;
      const count = pmTrackCount(p);
      const total = p.duration || 0;
      const badge = p.sharing === "private" ? "🔒" : "🌐";
      const subtitle =
        count === 0
          ? "empty"
          : `${count} track${count === 1 ? "" : "s"} · ${pmFmtTotal(total)}`;
      return `<div class="pm-pl${active ? " pm-pl-active" : ""}" data-pid="${p.id}" data-title="${(p.title || "")
        .replace(/"/g, "&quot;")}" tabindex="0" style="display:flex;gap:10px;align-items:center;padding:10px;border-radius:8px;cursor:pointer;transition:background .15s;${
        active
          ? `background:${accent}22;box-shadow:inset 2px 0 0 ${accent};`
          : ""
      }">
        <div style="width:40px;height:40px;flex-shrink:0;border-radius:6px;overflow:hidden;background:#222;"><img src="${pmPlaylistArt(p)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/></div>
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${badge} ${(p.title || "Untitled").replace(/</g, "&lt;")}</div>
          <div style="font-size:11px;opacity:0.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subtitle}</div>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".pm-pl").forEach((el) => {
    const pid = Number(el.dataset.pid);
    el.addEventListener("click", () => {
      pmSelectPlaylist(pid);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") el.click();
    });

    el.addEventListener("dragover", (e) => {
      if (!_pmState.dragging) return;
      if (pid === _pmState.selectedId) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "move"; } catch (_) {}
      el.classList.add("pm-droptarget");
    });
    el.addEventListener("dragleave", () => el.classList.remove("pm-droptarget"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("pm-droptarget");
      if (!_pmState.dragging || pid === _pmState.selectedId) return;
      const ids = _pmState.dragging.trackIds.slice();
      const target = _pmState.playlists.find((p) => p.id === pid);
      if (target) pmMoveTo(target, ids);
    });
  });
}

function pmRenderDetail() {
  const pane = document.getElementById("pm-detail");
  if (!pane) return;
  const pl = pmCurrent();
  if (!pl) {
    pane.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:0.4;font-size:15px;">Select a playlist on the left.</div>`;
    return;
  }
  pmRenderDetailHeader();
  pmRenderTracks();
}

function _pmEnsureDetailStyle() {
  const accent = getAccent();
  injectStyle(
    "sclient-playlists-detail-style",
    `
    .pm-d-header { display:flex; gap:18px; align-items:center; padding:20px 26px; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; }
    .pm-d-art { width:96px; height:96px; flex-shrink:0; border-radius:10px; overflow:hidden; background:#222; }
    .pm-d-art img { width:100%; height:100%; object-fit:cover; }
    .pm-d-title { font-size:20px; font-weight:700; display:flex; align-items:center; gap:8px; }
    .pm-d-meta { font-size:12px; opacity:0.6; margin-top:4px; }
    .pm-d-meta a { color:${accent}; text-decoration:none; }
    .pm-d-meta a:hover { text-decoration:underline; }
    .pm-d-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .pm-d-toolbar { display:flex; gap:10px; align-items:center; padding:14px 26px 10px; flex-wrap:wrap; border-bottom:1px solid rgba(255,255,255,0.05); }

    .pm-d-bulk { position:absolute; left:26px; right:26px; bottom:16px; z-index:20; display:flex; gap:8px; align-items:center; padding:10px 14px; background:rgba(28,28,28,0.92); border:1px solid rgba(255,255,255,0.14); border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.55); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); animation:pm-bulk-in .12s ease-out; }
    @keyframes pm-bulk-in { from { transform:translateY(8px); opacity:0; } to { transform:translateY(0); opacity:1; } }
    #pm-track-scroll { flex:1; overflow-y:auto; min-height:0; padding:8px 26px 80px; }
    .pm-track { display:flex; align-items:center; gap:12px; padding:8px 10px; border-radius:8px; cursor:default; user-select:none; border:1px solid transparent; border-top:2px solid transparent; border-bottom:2px solid transparent; transition:background .12s; }
    .pm-track:hover { background:rgba(255,255,255,0.05); }
    .pm-track.pm-track-selected { background:${accent}1f; }
    .pm-track.pm-track-selected:hover { background:${accent}2a; }
    .pm-track.pm-drop-before { border-top-color:${accent}; }
    .pm-track.pm-drop-after { border-bottom-color:${accent}; }
    .pm-track-idx { width:28px; text-align:right; color:#888; font-size:12px; font-variant-numeric:tabular-nums; flex-shrink:0; }
    .pm-track-art { width:36px; height:36px; flex-shrink:0; border-radius:5px; overflow:hidden; background:#222; position:relative; }
    .pm-track-art img { width:100%; height:100%; object-fit:cover; }

    .pm-track-play { position:absolute; inset:0; margin:0; padding:0; border:0; background:rgba(0,0,0,0.55); color:#fff; font-size:15px; cursor:pointer; opacity:0; transition:opacity .12s; display:flex; align-items:center; justify-content:center; line-height:1; }
    .pm-track:hover .pm-track-play { opacity:1; }
    .pm-track-play:hover { background:rgba(0,0,0,0.7); transform:scale(1.08); }
    .pm-track-body { min-width:0; flex:1; }
    .pm-track-title { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pm-track-artist { font-size:11px; opacity:0.6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pm-track-dur { font-size:12px; color:#aaa; font-variant-numeric:tabular-nums; flex-shrink:0; }
    .pm-track-handle { color:#666; flex-shrink:0; cursor:grab; font-size:14px; }
    .pm-track-handle:active { cursor:grabbing; }
    .pm-empty-tracks { text-align:center; padding:50px 20px; opacity:0.5; line-height:1.7; }

    .pm-ctx { position:fixed; z-index:9999999; min-width:200px; background:#1e1e1e; border:1px solid rgba(255,255,255,0.14); border-radius:8px; padding:6px; box-shadow:0 10px 30px rgba(0,0,0,0.6); font-family:Inter,sans-serif; font-size:13px; }
    .pm-ctx-item { padding:8px 12px; border-radius:5px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:14px; }
    .pm-ctx-item:hover { background:${accent}33; color:#fff; }
    .pm-ctx-item.pm-ctx-danger { color:#f88; }
    .pm-ctx-item.pm-ctx-danger:hover { background:#3a1515; color:#fcc; }
    .pm-ctx-item.pm-ctx-disabled { opacity:0.4; cursor:default; }
    .pm-ctx-item.pm-ctx-disabled:hover { background:transparent; color:inherit; }
    .pm-ctx-sep { height:1px; background:rgba(255,255,255,0.1); margin:4px 0; }

    .pm-picker-back { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999999; display:flex; align-items:center; justify-content:center; }
    .pm-picker { background:#1e1e1e; border:1px solid rgba(255,255,255,0.14); border-radius:12px; width:360px; max-height:70vh; display:flex; flex-direction:column; }
    .pm-picker-head { padding:16px 18px; border-bottom:1px solid rgba(255,255,255,0.1); font-weight:600; }
    .pm-picker-list { overflow-y:auto; padding:8px; }
    .pm-picker-item { padding:10px; border-radius:8px; cursor:pointer; display:flex; gap:10px; align-items:center; }
    .pm-picker-item:hover { background:rgba(255,255,255,0.08); }
    .pm-picker-foot { padding:12px 18px; border-top:1px solid rgba(255,255,255,0.1); display:flex; justify-content:flex-end; gap:8px; }
    .pm-tag-chips { display:flex; flex-wrap:wrap; gap:6px; padding:6px 4px 2px; min-height:34px; border:1px solid #333; border-radius:6px; background:rgba(0,0,0,0.4); }
    .pm-chip { display:inline-flex; align-items:center; gap:4px; background:${accent}33; color:#fff; padding:2px 8px; border-radius:12px; font-size:12px; }
    .pm-chip-x { cursor:pointer; opacity:0.7; }
    .pm-chip-x:hover { opacity:1; }
    `
  );
}

function pmRenderDetailHeader() {
  _pmEnsureDetailStyle();
  const pane = document.getElementById("pm-detail");
  if (!pane) return;
  const pl = pmCurrent();
  if (!pl) return;
  const accent = getAccent();
  const count = pmTrackCount(pl);
  const total = pl.duration || (pl.tracks || []).reduce((s, t) => s + (t.duration || 0), 0);
  const badge = pl.sharing === "private" ? "🔒" : "🌐";
  const plPermalink = pl.user && pl.permalink ? `/${pl.user.permalink}/sets/${pl.permalink}` : pl.permalink_url || "";
  const secretLink =
    pl.sharing === "private" && pl.secret_token && pl.permalink_url
      ? (pl.permalink_url.endsWith("/" + pl.secret_token) ? pl.permalink_url : pl.permalink_url + "/" + pl.secret_token)
      : null;

  const html = `
    <div id="pm-detail-content" style="display:flex;flex-direction:column;height:100%;position:relative;">
      <div class="pm-d-header">
        <div class="pm-d-art"><img src="${pmPlaylistArt(pl)}"/></div>
        <div style="min-width:0;flex:1;">
          <div class="pm-d-title">${badge} ${(pl.title || "Untitled").replace(/</g, "&lt;")}</div>
          <div class="pm-d-meta">${count} track${count === 1 ? "" : "s"} · ${pmFmtTotal(total)}${
            secretLink ? ` · <span id="pm-secret-link-btn" style="opacity:.85;cursor:pointer;text-decoration:underline;" title="Copy to clipboard">secret link</span>` : ""
          }</div>
          <div class="pm-d-meta" style="margin-top:8px;display:flex;gap:10px;align-items:center;"><span>
            ${
              plPermalink
                ? `permalink: <a href="${pl.permalink_url || "#"}" target="_blank">${plPermalink.replace(/</g, "&lt;")}</a>`
                : ""
            }</span></div>
        </div>
        <div class="pm-d-actions">
          <button id="pm-edit-btn" class="pm-btn pm-btn-primary">✎ Edit</button>
          <button id="pm-export-btn" class="pm-btn">⬇ Export</button>
          <button id="pm-delete-btn" class="pm-btn pm-btn-danger">🗑 Delete</button>
        </div>
      </div>
      <div class="pm-d-toolbar">
        <input id="pm-track-filter" class="pm-input" style="max-width:260px;" type="text" placeholder="Filter tracks by title or artist…" value="${_pmState.trackFilterText.replace(/"/g, "&quot;")}">
        <div style="flex:1;"></div>
        <button id="pm-select-all" class="pm-btn">Select all</button>
        <button id="pm-clear-sel" class="pm-btn">Clear</button>
      </div>
      <div id="pm-d-bulk" class="pm-d-bulk" style="display:none;"></div>
      <div id="pm-track-scroll"></div>
    </div>
  `;
  pane.innerHTML = html;

  const secretLinkBtn = pane.querySelector("#pm-secret-link-btn");
  if (secretLinkBtn && secretLink) {
    secretLinkBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(secretLink).then(
        () => showToast("Secret link copied to clipboard!"),
        () => showToast("Failed to copy secret link.")
      );
    });
  }

  pane.querySelector("#pm-edit-btn").addEventListener("click", pmOpenEditor);
  pane.querySelector("#pm-export-btn").addEventListener("click", () => pmExportPlaylist());
  pane.querySelector("#pm-delete-btn").addEventListener("click", pmDeletePlaylist);
  pane.querySelector("#pm-track-filter").addEventListener("input", (e) => {
    _pmState.trackFilterText = e.target.value;
    pmRenderTracks();
  });
  pane.querySelector("#pm-select-all").addEventListener("click", () => {
    const pl2 = pmCurrent();
    if (!pl2) return;
    for (const t of visibleTracks(pl2)) _pmState.selection.add(t.id);
    _pmState.anchorId = null;
    pmRenderTracksKeepScroll();
    pmRenderBulkBar();
  });
  pane.querySelector("#pm-clear-sel").addEventListener("click", () => {
    _pmState.selection = new Set();
    _pmState.anchorId = null;
    pmRenderTracksKeepScroll();
    pmRenderBulkBar();
  });
  pmRenderBulkBar();
}

function visibleTracks(pl) {
  const q = _pmState.trackFilterText.trim().toLowerCase();
  if (!q) return pl.tracks || [];
  return (pl.tracks || []).filter((t) => {
    const title = (t.title || "").toLowerCase();
    const artist = (getArtistFromTrack(t) || "").toLowerCase();
    return title.includes(q) || artist.includes(q);
  });
}

function pmRenderBulkBar() {
  const bar = document.getElementById("pm-d-bulk");
  if (!bar) return;
  const n = _pmState.selection.size;
  if (n === 0) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "";
  bar.innerHTML = `
    <span style="font-size:12px;opacity:0.7;margin-right:auto;">${n} selected</span>
    <button id="pm-bulk-move" class="pm-btn">↪ Move to…</button>
    <button id="pm-bulk-copy" class="pm-btn">⧉ Copy to…</button>
    <button id="pm-bulk-remove" class="pm-btn pm-btn-danger">✕ Remove</button>
    <button id="pm-bulk-export" class="pm-btn">⬇ Export selected</button>
  `;
  bar.querySelector("#pm-bulk-move").addEventListener("click", () => pmMoveToDialog([..._pmState.selection]));
  bar.querySelector("#pm-bulk-copy").addEventListener("click", () => pmCopyToDialog([..._pmState.selection]));
  bar.querySelector("#pm-bulk-remove").addEventListener("click", () => pmRemoveSelected());
  bar.querySelector("#pm-bulk-export").addEventListener("click", () => pmExportSelectedJSON());
}

function pmRenderTracks() {
  const scroll = document.getElementById("pm-track-scroll");
  const pl = pmCurrent();
  if (!scroll || !pl) return;

  const tracks = visibleTracks(pl);
  if (tracks.length === 0) {
    const emptyMsg =
      (pl.tracks && pl.tracks.length)
        ? `No tracks match "${_pmState.trackFilterText.replace(/</g, "&lt;")}".`
        : "This playlist is empty. Drag tracks here, paste URLs, or import a JSON dump.";
    scroll.innerHTML = `<div class="pm-empty-tracks">${emptyMsg}</div>`;
    return;
  }
  scroll.innerHTML =
    tracks
      .map((t, i) => {
        const sel = _pmState.selection.has(t.id);
        const handlePath = `/${(t.user && t.user.permalink) || ""}/${t.permalink || ""}`;
        return `<div class="pm-track${sel ? " pm-track-selected" : ""}" data-id="${t.id}" data-index="${i}" draggable="true">
          <span class="pm-track-idx">${i + 1}</span>
          <span class="pm-track-art"><img src="${pmTrackArt(t)}" loading="lazy"/><button class="pm-track-play" data-url="${t.permalink_url || ""}" title="Play on SoundCloud (opens in a new tab)">▶</button></span>
          <span class="pm-track-body">
            <span class="pm-track-title" data-loop-data="${t.permalink_url || ""}">${(t.title || "Unknown").replace(/</g, "&lt;")}</span>
            <span class="pm-track-artist">${(getArtistFromTrack(t) || "").replace(/</g, "&lt;")} · ${handlePath}</span>
          </span>
          <span class="pm-track-dur">${pmFmtDur(t.duration)}</span>
          <span class="pm-track-handle" title="Drag to reorder">⋮⋮</span>
        </div>`;
      })
      .join("");
  pmWireTracks();
}

function pmCloneForPut(fullPl) {
  return JSON.parse(JSON.stringify(fullPl));
}

function pmRenderTracksKeepScroll() {
  const scroll = document.getElementById("pm-track-scroll");
  const top = scroll ? scroll.scrollTop : 0;
  pmRenderTracks();
  if (scroll) scroll.scrollTop = top;
}

function pmOrderedSelectedIds(pl) {
  return (pl.tracks || []).map((t) => t.id).filter((id) => _pmState.selection.has(id));
}

function pmWireTracks() {
  const scroll = document.getElementById("pm-track-scroll");
  if (!scroll) return;
  scroll.querySelectorAll(".pm-track").forEach((row) => {
    const id = Number(row.dataset.id);
    const idx = Number(row.dataset.index);

    row.addEventListener("click", (e) => {
      const pl = pmCurrent();
      if (!pl) return;
      const ordered = visibleTracks(pl);
      if (e.ctrlKey || e.metaKey) {
        if (_pmState.selection.has(id)) _pmState.selection.delete(id);
        else _pmState.selection.add(id);
        _pmState.anchorId = id;
      } else if (e.shiftKey && _pmState.anchorId != null) {
        const from = ordered.findIndex((t) => t.id === _pmState.anchorId);
        const to = idx;
        if (from >= 0) {
          const [lo, hi] = from <= to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) _pmState.selection.add(ordered[i].id);
        }
      } else {
        if (_pmState.selection.size === 1 && _pmState.selection.has(id)) {

        } else {
          _pmState.selection = new Set([id]);
        }
        _pmState.anchorId = id;
      }
      pmRenderTracksKeepScroll();
      pmRenderBulkBar();
    });

    row.addEventListener("dblclick", (e) => {
      e.preventDefault();
      pmOpenTrack(id);
    });

    row.addEventListener("click", (e) => {
      const btn = e.target.closest(".pm-track-play");
      if (!btn || !btn.dataset.url) return;
      e.stopPropagation();
      e.preventDefault();
      pmCloseContextMenu();
      pmNavigateInPlace(btn.dataset.url);
    }, true);

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const pl = pmCurrent();
      if (!pl) return;
      if (!_pmState.selection.has(id)) {
        _pmState.selection = new Set([id]);
        _pmState.anchorId = id;
        pmRenderTracksKeepScroll();
        pmRenderBulkBar();
      }
      pmOpenContextMenu(e.clientX, e.clientY);
    });

    row.addEventListener("dragstart", (e) => {
      const pl = pmCurrent();
      if (!pl) return;
      if (!_pmState.selection.has(id)) {

        _pmState.selection = new Set([id]);
        _pmState.anchorId = id;
        const scroll = document.getElementById("pm-track-scroll");
        if (scroll) scroll.querySelectorAll(".pm-track").forEach((r) => {
          r.classList.toggle("pm-track-selected", Number(r.dataset.id) === id);
        });
        pmRenderBulkBar();
      }
      const ids = pmOrderedSelectedIds(pl);
      _pmState.dragging = { trackIds: ids, fromPlaylist: pl.id };
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(ids.join(",")));
      } catch (_) {}
    });
    row.addEventListener("dragend", () => {
      _pmState.dragging = null;
      pmClearDropIndicator();
      document.querySelectorAll(".pm-pl.pm-droptarget").forEach((el) => el.classList.remove("pm-droptarget"));
      _pmState.dropTargetId = null;
    });
  });

  scroll.ondragover = (e) => {
    if (!_pmState.dragging) return;
    e.preventDefault();
    if (_pmState.dragging.fromPlaylist !== (pmCurrent() && pmCurrent().id)) return;
    pmClearDropIndicator();
    const row = e.target.closest(".pm-track");
    if (!row) {

      const all = scroll.querySelectorAll(".pm-track");
      const last = all[all.length - 1];
      if (last) last.classList.add("pm-drop-after");
      return;
    }
    const rect = row.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    row.classList.add(after ? "pm-drop-after" : "pm-drop-before");
  };
  scroll.ondrop = (e) => {
    if (!_pmState.dragging || _pmState.dragging.fromPlaylist !== (pmCurrent() && pmCurrent().id)) return;
    e.preventDefault();
    const pl = pmCurrent();
    if (!pl) return;
    const draggedIds = _pmState.dragging.trackIds.slice();
    const all = pl.tracks.slice();
    const row = e.target.closest(".pm-track");
    let insertRestIndex;
    if (!row) {
      insertRestIndex = all.length - draggedIds.length;
    } else {
      const fullIdx = Number(row.dataset.index);
      const rect = row.getBoundingClientRect();
      const placeAfter = e.clientY > rect.top + rect.height / 2;
      const cutoff = placeAfter ? fullIdx + 1 : fullIdx;
      let rIdx = 0;
      for (let i = 0; i < cutoff; i++) if (!draggedIds.includes(all[i].id)) rIdx++;
      insertRestIndex = rIdx;
    }

    const remaining = all.filter((t) => !draggedIds.includes(t.id));
    const block = all.filter((t) => draggedIds.includes(t.id));
    remaining.splice(insertRestIndex, 0, ...block);
    pmClearDropIndicator();
    pmApplyNewOrder(remaining.map((t) => t.id));
  };
}

function pmClearDropIndicator() {
  document
    .querySelectorAll(".pm-track.pm-drop-before,.pm-track.pm-drop-after")
    .forEach((el) => el.classList.remove("pm-drop-before", "pm-drop-after"));
}

async function pmApplyNewOrder(newIds) {
  const pl = pmCurrent();
    if (!pl) return;
  if (JSON.stringify(newIds) === JSON.stringify((pl.tracks || []).map((t) => t.id))) return;

  const byId = new Map((pl.tracks || []).map((t) => [t.id, t]));

  const prevTracks = pl.tracks.slice();
  const prevDur = pl.duration;
  pl.tracks = newIds.map((id) => byId.get(id)).filter(Boolean);
  pl.duration = pl.tracks.reduce((s, t) => s + (t.duration || 0), 0);

  pmRenderTracksKeepScroll();
  try {
    await api.putTracks(pl.id, newIds);
    showToast("Order updated");
  } catch (e) {

    pl.tracks = prevTracks;
    pl.duration = prevDur;
    pmRenderTracksKeepScroll();
    showToast("Reorder failed: " + (e.message || e));
  }
}

async function pmRemoveSelected(idsArg) {
  const pl = pmCurrent();
  if (!pl) return;
  const ids = Array.isArray(idsArg) ? idsArg : [..._pmState.selection];
  if (ids.length === 0) return;
  if (ids.length > 5) {
    const ok = await showConfirm(`Remove ${ids.length} tracks from "${pl.title || "Untitled"}"?`);
    if (!ok) return;
  }
  const newIds = (pl.tracks || []).map((t) => t.id).filter((id) => !ids.includes(id));
  const byId = new Map((pl.tracks || []).map((t) => [t.id, t]));
  const prevTracks = pl.tracks.slice();
  const prevDur = pl.duration;
  pl.tracks = newIds.map((id) => byId.get(id)).filter(Boolean);
  pl.duration = pl.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  _pmState.selection = new Set();
  _pmState.anchorId = null;

  pmRenderDetailHeader();
  pmRenderTracks();
  pmRenderBulkBar();
  try {
    await api.putTracks(pl.id, newIds);
    showToast(`${ids.length} track${ids.length === 1 ? "" : "s"} removed`);
  } catch (e) {

    pl.tracks = prevTracks;
    pl.duration = prevDur;
    pmRenderDetailHeader();
    pmRenderTracks();
    pmRenderBulkBar();
    showToast("Remove failed: " + (e.message || e));
  }
}

async function pmCopyTo(targetPl, ids) {
  const newIds = (targetPl.tracks || []).map((t) => t.id).filter((id) => !ids.includes(id));
  newIds.push(...ids);
  try {
    await api.putTracks(targetPl.id, newIds);

    targetPl.tracks = newIds.map((id) => {
      const here = (targetPl.tracks || []).find((t) => t.id === id);
      if (here) return here;
      const src = pmCurrent();
      return (src && src.tracks || []).find((t) => t.id === id);
    }).filter(Boolean);
    targetPl.duration = targetPl.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    showToast(`Copied ${ids.length} track${ids.length === 1 ? "" : "s"} to "${targetPl.title}"`);
    pmRenderSidebar();
  } catch (e) {
    showToast("Error: " + (e.message || e));
  }
}

async function pmMoveTo(targetPl, ids) {
  const src = pmCurrent();
  if (!src || src.id === targetPl.id) return;

  const srcNew = (src.tracks || []).map((t) => t.id).filter((id) => !ids.includes(id));
  try {
    await api.putTracks(src.id, srcNew);
  } catch (e) {
    showToast("Error: " + (e.message || e));
    return;
  }

  const srcById = new Map((src.tracks || []).map((t) => [t.id, t]));
  const moved = ids.map((id) => srcById.get(id)).filter(Boolean);
  const srcPrevTracks = src.tracks.slice();
  const srcPrevDur = src.duration;
  const tgtPrevTracks = targetPl.tracks.slice();
  const tgtPrevDur = targetPl.duration;
  src.tracks = srcNew.map((id) => srcById.get(id)).filter(Boolean);
  src.duration = src.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  _pmState.selection = new Set();
  _pmState.anchorId = null;

  const tgtNew = (targetPl.tracks || []).map((t) => t.id).filter((id) => !ids.includes(id));
  tgtNew.push(...ids);
  try {
    await api.putTracks(targetPl.id, tgtNew);
    targetPl.tracks = [...(targetPl.tracks || []), ...moved];
    targetPl.duration = targetPl.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    showToast(`Moved ${ids.length} track${ids.length === 1 ? "" : "s"} to "${targetPl.title}"`);
  } catch (e) {

    showToast("Move failed, restoring source: " + (e.message || e));
    try { await api.putTracks(src.id, srcNew.concat(ids)); } catch (_) {}
    src.tracks = srcPrevTracks;
    src.duration = srcPrevDur;
    targetPl.tracks = tgtPrevTracks;
    targetPl.duration = tgtPrevDur;
    _pmState.hydrated.delete(src.id);
    _pmState.hydrated.delete(targetPl.id);
  }
  pmRenderSidebar();
  pmRenderDetailHeader();
  pmRenderTracks();
  pmRenderBulkBar();
}

function pmOpenContextMenu(x, y) {
  pmCloseContextMenu();
  const menu = document.createElement("div");
  menu.className = "pm-ctx";
  const accent = getAccent();
  const n = _pmState.selection.size;
  const items = [
    { label: `Remove from playlist`, danger: true, act: () => pmRemoveSelected() },
    { label: `Copy to…`, act: () => pmCopyToDialog([..._pmState.selection]) },
    { label: `Move to…`, act: () => pmMoveToDialog([..._pmState.selection]) },
    { label: `Export selected as JSON`, act: pmExportSelectedJSON },
    { sep: true },
    { label: `Open track on SoundCloud`, disabled: n !== 1, act: () => pmOpenTrack([..._pmState.selection][0]) },
  ];
  for (const it of items) {
    if (it.sep) {
      const s = document.createElement("div");
      s.className = "pm-ctx-sep";
      menu.appendChild(s);
      continue;
    }
    const el = document.createElement("div");
    el.className = "pm-ctx-item" + (it.danger ? " pm-ctx-danger" : "") + (it.disabled ? " pm-ctx-disabled" : "");
    el.textContent = it.label;
    if (!it.disabled) el.addEventListener("click", () => { pmCloseContextMenu(); it.act(); });
    menu.appendChild(el);
  }

  menu.style.left = Math.min(x, window.innerWidth - 220) + "px";
  menu.style.top = Math.min(y, window.innerHeight - 240) + "px";
  document.body.appendChild(menu);
  _pmState.contextMenu = menu;

  const dismiss = (ev) => {
    if (_pmState.contextMenu && _pmState.contextMenu.contains(ev.target)) return;
    pmCloseContextMenu();
    document.removeEventListener("mousedown", dismiss, true);
    document.removeEventListener("keydown", dismiss, true);
  };

  setTimeout(() => {
    document.addEventListener("mousedown", dismiss, true);
  }, 0);
}

function pmPickPlaylist(title, excludePid) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "pm-picker-back";
    const list = _pmState.playlists.filter((p) => p.id !== excludePid);
    const dlg = document.createElement("div");
    dlg.className = "pm-picker";
    dlg.innerHTML = `
      <div class="pm-picker-head">${title}</div>
      <div class="pm-picker-list"></div>
      <div class="pm-picker-foot">
        <button class="pm-btn" id="pm-pk-cancel">Cancel</button>
      </div>
    `;
    back.appendChild(dlg);
    document.body.appendChild(back);
    const listEl = dlg.querySelector(".pm-picker-list");
    if (list.length === 0) {
      listEl.innerHTML = `<div style="padding:20px;text-align:center;opacity:0.5;">No other playlists.</div>`;
    }
    list.forEach((p) => {
      const it = document.createElement("div");
      it.className = "pm-picker-item";
      it.innerHTML = `<span style="width:30px;height:30px;border-radius:5px;overflow:hidden;background:#222;flex-shrink:0;"><img src="${pmPlaylistArt(p)}" style="width:100%;height:100%;object-fit:cover;"/></span><span style="min-width:0;"><span style="font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(p.sharing === "private" ? "🔒 " : "🌐 ") + (p.title || "Untitled").replace(/</g, "&lt;")}</span><span style="font-size:11px;opacity:0.6;">${(p.tracks || []).length} tracks</span></span>`;
      it.addEventListener("click", () => { back.remove(); resolve(p.id); });
      listEl.appendChild(it);
    });
    dlg.querySelector("#pm-pk-cancel").addEventListener("click", () => { back.remove(); resolve(null); });
    back.addEventListener("click", (e) => { if (e.target === back) { back.remove(); resolve(null); } });
  });
}

async function pmCopyToDialog(ids) {
  if (ids.length === 0) return;
  const targetId = await pmPickPlaylist("Copy to playlist…", _pmState.selectedId);
  if (targetId == null) return;
  const target = _pmState.playlists.find((p) => p.id === targetId);
  if (target) await pmCopyTo(target, ids);
}

async function pmMoveToDialog(ids) {
  if (ids.length === 0) return;
  const targetId = await pmPickPlaylist("Move to playlist…", _pmState.selectedId);
  if (targetId == null) return;
  const target = _pmState.playlists.find((p) => p.id === targetId);
  if (target) await pmMoveTo(target, ids);
}

function pmOpenTrack(id) {
  const pl = pmCurrent();
  const t = (pl && pl.tracks || []).find((x) => x.id === id);
  if (!t || !t.permalink_url) return;
  if (_pmState.contextMenu) pmCloseContextMenu();
  const overlay = document.getElementById("sclient-playlists-overlay");
  if (overlay) overlay.style.display = "none";
  window.location.href = t.permalink_url;
}

function pmNavigateInPlace(url) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (_) {
    window.location.href = url;
  }
}

async function pmDeletePlaylist() {
  const pl = pmCurrent();
  if (!pl) return;
  const ok = await showConfirm(`Delete playlist "${pl.title || "Untitled"}"? This cannot be undone.`);
  if (!ok) return;
  try {
    await api.del(pl.id);
    _pmState.playlists = _pmState.playlists.filter((p) => p.id !== pl.id);
    _pmState.selectedId = _pmState.playlists.length ? _pmState.playlists[0].id : null;
    _pmState.selection = new Set();
    _pmState.anchorId = null;
    pmRenderSidebar();
    pmRenderDetail();
    showToast("Playlist deleted");
  } catch (e) {
    showToast("Error: " + (e.message || e));
  }
}

async function pmExportSelectedJSON() {
  const pl = pmCurrent();
  if (!pl) return;
  const ids = [..._pmState.selection];
  const obj = pmBuildExport(pl, ids);
  await pmExportJSON(`${(pl.permalink || "playlist")}-selection.json`, obj);
}

async function pmExportJSON(defaultName, obj) {
  try {
    const content = JSON.stringify(obj, null, 2);
    const res = await sendBridge("playlist_save_file", { defaultName, content });
    if (res && res.canceled) return;
    showToast("Exported " + defaultName);
  } catch (e) {
    if (e && /cancel/i.test(e.message || "")) return;
    showToast("Export failed: " + (e.message || e));
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Delete") return;
  const overlay = document.getElementById("sclient-playlists-overlay");
  if (!overlay || overlay.style.display !== "flex") return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
  if (_pmState.editor || _pmState.contextMenu) return;
  if (_pmState.selection.size > 0) {
    e.preventDefault();
    pmRemoveSelected();
  }
});

async function pmRefresh() {
  const sidebar = document.getElementById("pm-sidebar-list");
  if (sidebar) sidebar.innerHTML = `<div style="padding:20px;text-align:center;opacity:0.5;">Loading…</div>`;
  try {
    if (!_pmState.userId) {
      const me = await api.me();
      _pmState.userId = me && me.id;
    }
    if (!_pmState.userId) {

      const tok = extractOAuthToken() || "";
      const parts = tok.split("-");
      if (parts.length >= 3) _pmState.userId = Number(parts[2]);
    }
    _pmState.playlists = await api.listPlaylists(_pmState.userId);
    _pmState.hydrated = new Set();
    if (_pmState.selectedId && !pmCurrent()) _pmState.selectedId = null;
    if (!_pmState.selectedId && _pmState.playlists.length)
      _pmState.selectedId = _pmState.playlists[0].id;
    pmRenderSidebar();
    if (_pmState.selectedId) await pmHydrateCurrent();
    pmRenderSidebar();
    pmRenderDetail();
  } catch (e) {
    if (sidebar)
      sidebar.innerHTML = `<div style="padding:20px;text-align:center;color:#f88;"></div>`;
    showToast("Error: " + (e.message || e));
    _pmState.playlists = [];
    pmRenderSidebar();
  }
}

function togglePlaylistManager() {
  const settings = document.getElementById("sclient-settings-overlay");
  if (settings) settings.style.right = "-450px";
  const lyrics = document.getElementById("sclient-lyrics-sidebar");
  if (lyrics) lyrics.style.left = "-400px";

  const existing = document.getElementById("sclient-playlists-overlay");
  if (existing) {
    if (existing.style.display === "flex") {
      existing.style.display = "none";
    } else {
      existing.style.display = "flex";
      pmRefresh();
    }
    return;
  }

  createPlaylistManagerOverlay();
  document.getElementById("sclient-playlists-overlay").style.display = "flex";
  pmRefresh();
}

function createPlaylistManagerOverlay() {
  if (document.getElementById("sclient-playlists-overlay")) return;

  const accent = getAccent();

  injectStyle(
    "sclient-playlists-style",
    `
    #sclient-playlists-overlay { position:fixed; inset:0; background:rgba(10,10,10,0.97); backdrop-filter:blur(15px); z-index:9999998; display:none; flex-direction:column; color:#fff; font-family:'Inter',system-ui,-apple-system,sans-serif; }
    #sclient-playlists-overlay * { box-sizing:border-box; }
    .pm-head { display:flex; justify-content:space-between; align-items:center; padding:18px 28px; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; }
    .pm-body { flex:1; display:flex; min-height:0; }
    .pm-sidebar { width:300px; flex-shrink:0; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; min-height:0; background:rgba(0,0,0,0.25); }
    .pm-sidebar-tools { padding:14px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:10px; }
    .pm-sidebar-list { flex:1; overflow-y:auto; padding:8px; }
    .pm-pl:hover { background:rgba(255,255,255,0.06) !important; }
    .pm-pl.pm-pl-active:hover { background:${accent}22 !important; }
    .pm-pl.pm-droptarget { box-shadow:inset 0 0 0 2px ${accent} !important; background:${accent}18 !important; }
    .pm-detail { flex:1; display:flex; flex-direction:column; min-width:0; min-height:0; }
    .pm-input { width:100%; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; border-radius:6px; padding:7px 10px; font-family:Inter,sans-serif; font-size:12px; outline:none; transition:border-color .2s; }
    .pm-input:focus { border-color:${accent}; }
    .pm-btn { padding:7px 12px; font-size:12px; font-family:Inter,sans-serif; cursor:pointer; border-radius:6px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); color:#ddd; transition:all .15s; }
    .pm-btn:hover { background:rgba(255,255,255,0.14); color:#fff; }
    .pm-btn-primary { border:none; background:${accent}; color:#fff; }
    .pm-btn-primary:hover { filter:brightness(1.1); color:#fff; }
    .pm-btn-danger { border:1px solid #5a2020; background:#3a1515; color:#f88; }
    .pm-btn-danger:hover { background:#5a2020; color:#fcc; }
    .pm-select { background:rgba(0,0,0,0.5); border:1px solid #333; color:#ddd; border-radius:6px; padding:6px 8px; font-family:Inter,sans-serif; font-size:12px; outline:none; cursor:pointer; }
    `
  );

  const overlay = document.createElement("div");
  overlay.id = "sclient-playlists-overlay";

  overlay.innerHTML = `
    <div class="pm-head">
      <h2 style="margin:0;font-size:22px;font-weight:700;color:${accent};display:flex;align-items:center;gap:10px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        Playlist Manager
      </h2>
      <div style="display:flex;align-items:center;gap:10px;">
        <button id="pm-refresh-btn" class="pm-btn" title="Refresh">↻ Refresh</button>
        <button id="pm-close-btn" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#aaa;cursor:pointer;font-size:18px;padding:8px 14px;border-radius:8px;" onmouseover="this.style.background='rgba(255,255,255,0.15)';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='#aaa';">&times; Close</button>
      </div>
    </div>
    <div class="pm-body">
      <aside class="pm-sidebar">
        <div class="pm-sidebar-tools">
          <div style="display:flex;gap:8px;">
            <input id="pm-filter" class="pm-input" placeholder="Filter playlists…" type="text">
          </div>
          <div style="display:flex;gap:8px;">
            <select id="pm-sort" class="pm-select" style="flex:1;">
              <option value="name">Name A–Z</option>
              <option value="modified">Recently modified</option>
              <option value="count">Track count</option>
            </select>
            <button id="pm-new-btn" class="pm-btn-primary pm-btn" title="New playlist">+ New</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="pm-import-btn" class="pm-btn" style="flex:1;">⬇ Import</button>
            <button id="pm-spotify-btn" class="pm-btn" style="flex:1;">⬇ Spotify CSV</button>
          </div>
        </div>
        <div id="pm-sidebar-list" class="pm-sidebar-list"></div>
      </aside>
      <section id="pm-detail" class="pm-detail"></section>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.display = "none";
    pmCloseContextMenu();
    pmCloseEditor();
    document.removeEventListener("keydown", _pmEsc);
  };
  function _pmEsc(e) {
    if (e.key !== "Escape") return;
    if (_pmState.contextMenu) {
      pmCloseContextMenu();
    } else if (_pmState.editor) {
      pmCloseEditor();
    }

  }

  document.getElementById("pm-close-btn").addEventListener("click", close);
  document.getElementById("pm-refresh-btn").addEventListener("click", pmRefresh);
  document.getElementById("pm-sort").value = _pmState.sortMode;
  document.getElementById("pm-sort").addEventListener("change", (e) => {
    _pmState.sortMode = e.target.value;
    pmRenderSidebar();
  });
  const filter = document.getElementById("pm-filter");
  filter.value = _pmState.filterText;
  filter.addEventListener("input", (e) => {
    _pmState.filterText = e.target.value;
    pmRenderSidebar();
  });
  document.getElementById("pm-new-btn").addEventListener("click", pmNewPlaylist);
  document.getElementById("pm-import-btn").addEventListener("click", pmImport);
  document.getElementById("pm-spotify-btn").addEventListener("click", pmSpotifyImport);

  document.addEventListener("keydown", _pmEsc);
}

async function pmNewPlaylist() {
  if (!navigator.onLine && !_pmState.userId) {
    showToast("Opening the manager first to load your user id…");
    await pmRefresh();
  }
  try {
    const created = await api.create("New Playlist", "private", []);
    _pmState.playlists.unshift(created);
    _pmState.hydrated.add(created.id);
    _pmState.selectedId = created.id;
    _pmState.selection = new Set();
    pmRenderSidebar();
    pmRenderDetail();
    showToast("Playlist created");

    setTimeout(() => pmOpenEditor(), 50);
  } catch (e) {
    showToast("Error: " + (e.message || e));
  }
}

function pmCloseContextMenu() {
  if (_pmState.contextMenu) {
    _pmState.contextMenu.remove();
    _pmState.contextMenu = null;
  }
}
function pmCloseEditor() {
  if (_pmState.editor) {
    _pmState.editor.remove();
    _pmState.editor = null;
  }
}

const PM_LICENSES = [
  "all-rights-reserved", "no-rights-reserved", "cc-by", "cc-by-nc", "cc-by-nc-sa",
  "cc-by-sa", "cc-by-nd", "cc-by-nc-nd", "cc-sampling+", "cc-zero",
];
const PM_SET_TYPES = ["", "album", "ep", "single", "compilation"];
const PM_EMBEDDABLE = ["all", "me", "none"];

function pmOpenEditor() {
  const pl = pmCurrent();
  if (!pl) return;
  pmCloseEditor();
  pmCloseContextMenu();
  _pmEnsureDetailStyle();
  const accent = getAccent();
  const back = document.createElement("div");
  back.className = "pm-picker-back";
  back.style.zIndex = "9999999";
  const dlg = document.createElement("div");
  dlg.style.cssText = `background:#1e1e1e;border:1px solid rgba(255,255,255,0.14);border-radius:12px;width:480px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.7);`;

  const releaseDate = pl.release_date ? String(pl.release_date).slice(0, 10) : "";
  dlg.innerHTML = `
    <div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:16px;font-weight:600;">Edit playlist details</div>
      <button id="pm-ed-x" class="pm-btn" style="padding:4px 10px;">✕</button>
    </div>
    <div style="padding:20px;overflow-y:auto;">
      <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Title</label>
      <input id="pm-ed-title" class="pm-input" type="text" style="margin-bottom:14px;" value="${(pl.title || "").replace(/"/g, "&quot;")}">

      <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Description</label>
      <textarea id="pm-ed-description" class="pm-input" style="margin-bottom:14px;min-height:70px;resize:vertical;font-family:Inter,sans-serif;" placeholder="Add a description…">${(pl.description || "").replace(/</g, "&lt;")}</textarea>

      <div id="pm-ed-adv-toggle" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;cursor:pointer;color:${accent};font-size:13px;font-weight:600;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);">
        <span>▸ Advanced details</span>
      </div>
      <div id="pm-ed-adv" style="display:none;padding-top:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <label style="font-size:12px;opacity:0.7;">Sharing</label>
          <select id="pm-ed-sharing" class="pm-select">
            <option value="public" ${pl.sharing === "public" ? "selected" : ""}>🌐 Public</option>
            <option value="private" ${pl.sharing === "private" ? "selected" : ""}>🔒 Private</option>
          </select>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Tags (press Enter/space/comma to add)</label>
          <div id="pm-ed-tags" class="pm-tag-chips"></div>
          <input id="pm-ed-tag-input" class="pm-input" style="margin-top:6px;" type="text" placeholder="tag">
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Genre</label>
          <input id="pm-ed-genre" class="pm-input" type="text" value="${(pl.genre || "").replace(/"/g, "&quot;")}">
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Label name</label>
          <input id="pm-ed-label" class="pm-input" type="text" value="${(pl.label_name || "").replace(/"/g, "&quot;")}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div><label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">License</label>
            <select id="pm-ed-license" class="pm-select" style="width:100%;">${PM_LICENSES.map((l) => `<option value="${l}" ${pl.license === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          <div><label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Set type</label>
            <select id="pm-ed-settype" class="pm-select" style="width:100%;">${PM_SET_TYPES.map((s) => `<option value="${s}" ${pl.set_type === s ? "selected" : ""}>${s || "(none)"}</option>`).join("")}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div><label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Release date</label>
            <input id="pm-ed-release" class="pm-input" type="date" value="${releaseDate}"></div>
          <div><label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Embeddable by</label>
            <select id="pm-ed-embed" class="pm-select" style="width:100%;">${PM_EMBEDDABLE.map((e) => `<option value="${e}" ${pl.embeddable_by === e ? "selected" : ""}>${e}</option>`).join("")}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div><label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Purchase URL</label>
            <input id="pm-ed-purl" class="pm-input" type="text" value="${(pl.purchase_url || "").replace(/"/g, "&quot;")}"></div>
          <div><label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Purchase title</label>
            <input id="pm-ed-ptitle" class="pm-input" type="text" value="${(pl.purchase_title || "").replace(/"/g, "&quot;")}"></div>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Artwork</label>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">
            <div style="width:48px;height:48px;border-radius:6px;overflow:hidden;background:#222;"><img id="pm-ed-art-preview" src="${pmPlaylistArt(pl)}" style="width:100%;height:100%;object-fit:cover;"/></div>
            <button id="pm-ed-art-clear" class="pm-btn pm-btn-danger" type="button">Clear artwork</button>
          </div>
          <div style="font-size:11px;opacity:0.5;">Cover images can’t be changed in SClient yet — you can only clear the current one.</div>
          <div id="pm-ed-secret-wrap" style="margin-top:10px;display:none;">
            <label style="font-size:12px;opacity:0.7;display:block;margin-bottom:6px;">Secret share link</label>
            <div style="display:flex;gap:8px;">
              <input id="pm-ed-secret" class="pm-input" type="text" readonly>
              <button id="pm-ed-secret-copy" class="pm-btn" type="button">Copy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:flex-end;gap:10px;">
      <button id="pm-ed-cancel" class="pm-btn" type="button">Cancel</button>
      <button id="pm-ed-save" class="pm-btn pm-btn-primary" type="button">Save</button>
    </div>
  `;
  back.appendChild(dlg);
  document.body.appendChild(back);
  _pmState.editor = back;

  const close = () => pmCloseEditor();
  dlg.querySelector("#pm-ed-x").addEventListener("click", close);
  dlg.querySelector("#pm-ed-cancel").addEventListener("click", close);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });

  const advWrap = dlg.querySelector("#pm-ed-adv");
  const advToggle = dlg.querySelector("#pm-ed-adv-toggle");
  advToggle.addEventListener("click", () => {
    const open = advWrap.style.display !== "none";
    advWrap.style.display = open ? "none" : "block";
    advToggle.firstChild.textContent = open ? "▸ Advanced details" : "▾ Advanced details";
  });

  let chips = (pl.tag_list || "").trim().split(/\s+/).filter(Boolean).map((s) => s.replace(/^#/, ""));
  const renderChips = () => {
    const wrap = dlg.querySelector("#pm-ed-tags");
    wrap.innerHTML = chips
      .map((c, i) => `<span class="pm-chip">#${c}<span class="pm-chip-x" data-i="${i}">✕</span></span>`)
      .join("");
    wrap.querySelectorAll(".pm-chip-x").forEach((x) => {
      x.addEventListener("click", () => {
        chips.splice(Number(x.dataset.i), 1);
        renderChips();
      });
    });
  };
  renderChips();
  const tagInput = dlg.querySelector("#pm-ed-tag-input");
  const addChip = (raw) => {
    const v = raw.trim().replace(/^#/, "");
    if (v && !chips.includes(v)) chips.push(v);
    tagInput.value = "";
    renderChips();
  };
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(tagInput.value);
    } else if (e.key === " " && tagInput.value.trim()) {
      e.preventDefault();
      addChip(tagInput.value);
    } else if (e.key === "Backspace" && tagInput.value === "" && chips.length) {
      chips.pop();
      renderChips();
    }
  });

  let artworkCleared = false;
  const artPreview = dlg.querySelector("#pm-ed-art-preview");
  dlg.querySelector("#pm-ed-art-clear").addEventListener("click", () => {
    artworkCleared = true;
    artPreview.src = PLACEHOLDER_ART;
  });

  const secretWrap = dlg.querySelector("#pm-ed-secret-wrap");
  const secretInput = dlg.querySelector("#pm-ed-secret");
  const sharingSel = dlg.querySelector("#pm-ed-sharing");
  const currentSecretLink = () => {
    if (!pl.permalink_url || !pl.secret_token) return "";
    return pl.permalink_url.endsWith("/" + pl.secret_token)
      ? pl.permalink_url
      : pl.permalink_url + "/" + pl.secret_token;
  };
  const refreshSecret = () => {
    if (sharingSel.value === "private") {
      secretWrap.style.display = "";
      const link = currentSecretLink();
      secretInput.value = link || "(available after saving as private)";
    } else {
      secretWrap.style.display = "none";
    }
  };
  refreshSecret();
  sharingSel.addEventListener("change", refreshSecret);
  dlg.querySelector("#pm-ed-secret-copy").addEventListener("click", () => {
    if (secretInput.value && !secretInput.value.startsWith("(")) {
      navigator.clipboard.writeText(secretInput.value).then(
        () => showToast("Secret link copied"),
        () => showToast("Copy failed")
      );
    }
  });

  dlg.querySelector("#pm-ed-save").addEventListener("click", async () => {
    const saveBtn = dlg.querySelector("#pm-ed-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    const payload = {
      title: dlg.querySelector("#pm-ed-title").value.trim() || "Untitled",
      sharing: sharingSel.value,
      description: dlg.querySelector("#pm-ed-description").value,
      genre: dlg.querySelector("#pm-ed-genre").value,
      tag_list: chips.join(" "),
      label_name: dlg.querySelector("#pm-ed-label").value,
      license: dlg.querySelector("#pm-ed-license").value,
      set_type: dlg.querySelector("#pm-ed-settype").value,
      purchase_url: dlg.querySelector("#pm-ed-purl").value || null,
      purchase_title: dlg.querySelector("#pm-ed-ptitle").value || null,
      embeddable_by: dlg.querySelector("#pm-ed-embed").value,
      tracks: (pl.tracks || []).map((t) => t.id),
    };
    const relVal = dlg.querySelector("#pm-ed-release").value;
    payload.release_date = relVal ? `${relVal}T00:00:00Z` : null;
    if (artworkCleared) payload.artwork_url = null;
    try {
      const merged = await api.putFull(pl.id, payload);

      Object.assign(pl, merged || {});

      if (!pl.tracks) pl.tracks = [];
      pl.duration = pl.duration || (pl.tracks.reduce((s, t) => s + (t.duration || 0), 0));
      pmRenderSidebar();
      pmRenderDetail();
      pmCloseEditor();
      showToast("Playlist updated");
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      showToast("Error: " + (e.message || e));
    }
  });
}

function pmBuildExport(pl, onlyIds) {
  const allIds = (pl.tracks || []).map((t) => t.id);
  const ids = onlyIds && onlyIds.length ? onlyIds : allIds;
  return {
    title: pl.title || "Untitled",
    sharing: pl.sharing || "private",
    description: pl.description || "",
    tracks: ids,
  };
}

async function pmExportPlaylist() {
  const pl = pmCurrent();
  if (!pl) return;
  const name = `${pl.permalink || "playlist"}.json`;
  await pmExportJSON(name, pmBuildExport(pl));
}

async function pmExportAll() {
  if (_pmState.playlists.length === 0) {
    showToast("No playlists to export");
    return;
  }
  const dump = {
    exported_at: new Date().toISOString(),
    playlists: _pmState.playlists.map((p) => pmBuildExport(p)),
  };
  await pmExportJSON("sclient-playlists-export.json", dump);
}

async function pmImport() {
  let fileText;
  try {
    fileText = await sendBridge("playlist_pick_import_file");
  } catch (e) {
    showToast("Import failed: " + (e.message || e));
    return;
  }
  if (!fileText) return;
  let data;
  try {
    data = JSON.parse(fileText);
  } catch (e) {
    showToast("Invalid JSON file");
    return;
  }

  let title = "Imported Playlist";
  let tracks = [];
  let sharing = "private";
  if (Array.isArray(data)) {
    tracks = data;
  } else if (data && typeof data === "object" && Array.isArray(data.tracks)) {
    title = data.title || title;
    sharing = data.sharing || sharing;
    tracks = data.tracks;
  } else if (data && Array.isArray(data.playlists)) {
    showToast("Multi-playlist exports aren’t supported for import — pick a single-playlist JSON.");
    return;
  } else {
    showToast("Unrecognized playlist JSON (expected {title, tracks:[ids]})");
    return;
  }

  const trackIds = [];
  const seen = new Set();
  let dropped = 0;
  for (const t of tracks) {
    let id;
    if (typeof t === "number" && Number.isFinite(t)) id = t;
    else if (typeof t === "string" && /^\d+$/.test(t.trim())) id = Number(t.trim());
    else { dropped++; continue; }
    if (!seen.has(id)) { trackIds.push(id); seen.add(id); }
  }
  if (trackIds.length === 0) {
    showToast(dropped ? `No importable track ids found (${dropped} entries skipped)` : "No importable tracks found");
    return;
  }
  if (dropped > 0) showToast(`Skipped ${dropped} non-id entr${dropped === 1 ? "y" : "ies"}`);

  const mode = await showConfirm(
    `Import ${trackIds.length} track${trackIds.length === 1 ? "" : "s"} as a new playlist, or merge into an existing one?`,
    [
      { id: "cancel", text: "Cancel", type: "secondary" },
      { id: "new", text: "New playlist", type: "primary" },
      { id: "merge", text: "Merge into existing…", type: "secondary" },
    ]
  );
  if (mode === "cancel" || mode === false) return;

  if (mode === "new") {
    let created;
    try {
      created = await api.create(title, sharing, trackIds);
    } catch (e) {
      showToast("Error: " + (e.message || e));
      return;
    }

    _pmState.playlists.unshift(created);
    _pmState.selectedId = created.id;
    _pmState.selection = new Set();
    pmRenderSidebar();
    await pmHydrateCurrent();
    pmRenderSidebar();
    pmRenderDetail();
    showToast(`Imported as "${created.title}"`);
    return;
  }

  const targetId = await pmPickPlaylist("Merge into playlist…", _pmState.selectedId);
  if (targetId == null) return;
  const target = _pmState.playlists.find((p) => p.id === targetId);
  if (!target) return;
  const replace = await showConfirm(
    `Replace the contents of "${target.title}" with ${trackIds.length} imported tracks, or append them?`,
    [
      { id: "cancel", text: "Cancel", type: "secondary" },
      { id: "append", text: "Append", type: "primary" },
      { id: "replace", text: "Replace", type: "danger" },
    ]
  );
  if (replace === "cancel" || replace === false) return;
  let newIds;
  if (replace === "replace") newIds = trackIds.slice();
  else {
    const existing = (target.tracks || []).map((t) => t.id);
    newIds = existing.filter((id) => !trackIds.includes(id));
    newIds.push(...trackIds.filter((id) => !existing.includes(id)));
  }
  try {
    await api.putTracks(target.id, newIds);

    const byId = new Map((target.tracks || []).map((t) => [t.id, t]));
    target.tracks = newIds.map((id) => byId.get(id)).filter(Boolean);
    target.duration = target.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    target.track_count = newIds.length;
    _pmState.hydrated.delete(target.id);
    showToast(`Merged into "${target.title}"`);
    if (_pmState.selectedId === target.id) {
      await pmHydrateCurrent();
      pmRenderDetail();
    }
    pmRenderSidebar();
  } catch (e) {
    showToast("Error: " + (e.message || e));
  }
}

function pmParseSpotifyCsv(text) {
  if (!text) return [];
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      row.push(field);
      if (row.some(f => f)) rows.push(row);
      row = [];
      field = "";
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(f => f)) rows.push(row);
  }

  if (rows.length < 2) throw new Error("Empty or invalid CSV");

  const headers = rows[0].map(h => h.toLowerCase());
  const trackIdx = headers.findIndex(h => h.includes("track name"));
  const artistIdx = headers.findIndex(h => h.includes("artist name"));

  let durIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if ((h.includes("track duration") && h.includes("ms")) || (h.includes("duration") && h.includes("ms"))) {
      durIdx = i;
      break;
    }
  }

  const isrcIdx = headers.findIndex(h => h.includes("isrc"));

  if (trackIdx === -1 || artistIdx === -1) {
    throw new Error("Not an exportify CSV (missing Track Name / Artist columns)");
  }

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[trackIdx] && !r[artistIdx]) continue;

    const rawArtists = r[artistIdx] || "";
    const artists = rawArtists.split(",").map(a => a.trim()).filter(Boolean);

    result.push({
      title: r[trackIdx] || "",
      artists: artists,
      durationMs: durIdx !== -1 && r[durIdx] ? parseInt(r[durIdx], 10) : 0,
      isrc: isrcIdx !== -1 ? (r[isrcIdx] || "").trim() : ""
    });
  }
  return result;
}

function pmNormTitle(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[({[][^)\]}]*[)\]}]/g, " ")
    .replace(/\bfeat\.?\b|\bft\.?\b|\bprod\.? by\b/g, " ")
    .replace(/\bfree download\b|\bofficial (audio|video|music video|visualizer)\b/g, " ")
    .replace(/\b(remix|edit|live|acoustic|bootleg|mix|radio edit)\b/g, " $1 ")
    .replace(/\s*\bslash\b\s*|\s+\/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pmExtractMixType(title) {
  const m = title.toLowerCase().match(/\b(original|remix|live|acoustic|edit|bootleg|mix|radio edit)\b/);
  return m ? m[1] : "";
}

function pmScoreMatch(spotifyRow, scTrack) {
  const isrcA = spotifyRow.isrc ? spotifyRow.isrc.replace(/[-\s]/g, "").toLowerCase() : "";
  const isrcB = scTrack.publisher_metadata && scTrack.publisher_metadata.isrc ? scTrack.publisher_metadata.isrc.replace(/[-\s]/g, "").toLowerCase() : "";

  if (isrcA && isrcB && isrcA === isrcB) {
    return { confidence: "high", score: 100, reason: "ISRC exact", tier: 1 };
  }

  const normA = pmNormTitle(spotifyRow.title);
  const normB = pmNormTitle(scTrack.title);

  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);

  const getArtistTokens = (str) => {
    if (!str) return [];
    return str.toLowerCase().split(/,|&|\bvs\.?\b|\//).map(s => s.replace(/[^a-z0-9]/g, "").trim()).filter(Boolean);
  };

  const artistsA = getArtistTokens(spotifyRow.artists.join(", "));
  const artistsB = getArtistTokens(getArtistFromTrack(scTrack));
  const artistOverlap = artistsA.some(a => artistsB.includes(a)) || artistsB.some(b => artistsA.includes(b));

  const durA = spotifyRow.durationMs;
  const durB = scTrack.duration;
  const durDelta = durB === 30000 ? 0 : Math.abs(durA - durB);

  const mixA = pmExtractMixType(spotifyRow.title);
  const mixB = pmExtractMixType(scTrack.title);
  let mixPenalty = 0;
  if (mixA !== mixB && (mixA === "remix" || mixB === "remix" || mixA === "live" || mixB === "live" || mixA === "acoustic" || mixB === "acoustic")) {
    mixPenalty = 25;
  }

  if (normA === normB && artistOverlap && durDelta <= 2000) {
    let score = 95 - mixPenalty;
    if (score >= 85) {
      return { confidence: "high", score, reason: "title+dur", tier: 2 };
    }
  }

  const intersection = tokensA.filter(t => tokensB.includes(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const lev = (a, b) => {
    if(!a.length) return b.length;
    if(!b.length) return a.length;
    const matrix = [];
    for(let i=0; i<=b.length; i++) matrix[i] = [i];
    for(let j=0; j<=a.length; j++) matrix[0][j] = j;
    for(let i=1; i<=b.length; i++) {
      for(let j=1; j<=a.length; j++) {
        if(b.charAt(i-1) == a.charAt(j-1)) matrix[i][j] = matrix[i-1][j-1];
        else matrix[i][j] = Math.min(matrix[i-1][j-1]+1, Math.min(matrix[i][j-1]+1, matrix[i-1][j]+1));
      }
    }
    return matrix[b.length][a.length];
  };
  const levDist = lev(normA, normB);
  const levNorm = Math.max(normA.length, normB.length) === 0 ? 0 : levDist / Math.max(normA.length, normB.length);

  if ((jaccard >= 0.6 || levNorm <= 0.3) && artistOverlap) {
    let baseScore = Math.floor(jaccard * 100);
    if (baseScore > 84) baseScore = 84;
    let score = baseScore - mixPenalty;
    if (score < 40) score = 40;
    return { confidence: "review", score, reason: "fuzzy", tier: 3 };
  }

  return { confidence: "skip", score: 0, reason: "no match", tier: 4 };
}

async function mapLimit(items, limit, asyncFn) {
  const results = [];
  let i = 0;
  const workers = Array(limit).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await asyncFn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

async function pmSpotifyImport() {
  const draftStr = localStorage.getItem("sclient_spotify_draft");
  if (draftStr) {
    const ok = await showConfirm("You have an unfinished Spotify import. Do you want to resume it?", [
      { id: "new", text: "Start New", type: "secondary" },
      { id: "resume", text: "Resume", type: "primary" }
    ]);
    if (ok === "resume") {
      try {
        const state = JSON.parse(draftStr);
        pmOpenSpotifyReviewModal(null, state);
        return;
      } catch (e) {
        showToast("Failed to load draft, starting fresh.");
        localStorage.removeItem("sclient_spotify_draft");
      }
    } else {
      localStorage.removeItem("sclient_spotify_draft");
    }
  }

  let fileText;
  try {
    fileText = await sendBridge("playlist_pick_import_file");
  } catch (e) {
    showToast("Import failed: " + (e.message || e));
    return;
  }
  if (!fileText) return;
  let spotifyRows;
  try {
    spotifyRows = pmParseSpotifyCsv(fileText);
  } catch (e) {
    showToast(e.message || "Failed to parse CSV");
    return;
  }
  pmOpenSpotifyReviewModal(spotifyRows);
}

let _pmSpotifyState = null;

function pmOpenSpotifyReviewModal(spotifyRows, resumedState = null) {
  const accent = getAccent();
  injectStyle("sclient-playlists-spotify-style", `
    .pm-sp-row { display: flex; align-items: stretch; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 12px; gap: 12px; font-size:12px; }
    .pm-sp-row.high { background: rgba(50, 200, 50, 0.05); }
    .pm-sp-row.review { background: rgba(200, 200, 50, 0.05); }
    .pm-sp-row.skip { background: rgba(200, 50, 50, 0.05); opacity: 0.7; }
    .pm-sp-left { flex: 1; min-width: 0; }
    .pm-sp-right { flex: 1; min-width: 0; }
    .pm-sp-score { width: 50px; text-align: right; flex-shrink: 0; font-weight: bold; }
    .pm-sp-actions { width: 140px; flex-shrink: 0; display:flex; flex-direction:column; gap:6px; }
  `);

  const back = document.createElement("div");
  back.className = "pm-picker-back";
  back.style.zIndex = "9999999";

  const dlg = document.createElement("div");
  dlg.style.cssText = `background:#1e1e1e;border:1px solid rgba(255,255,255,0.14);border-radius:12px;width:90vw;max-width:900px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.7);`;

  dlg.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div id="pm-sp-head" style="font-size:16px;font-weight:600;flex:1;">Spotify CSV Import · resolved 0 / ${resumedState ? resumedState.total : spotifyRows.length}</div>
      <input type="text" id="pm-sp-title" class="pm-input" value="Spotify Import" style="width:200px;font-size:14px;padding:6px 10px;" />
      <select id="pm-sp-sharing" class="pm-select" style="width:100px;font-size:14px;padding:6px 10px;">
        <option value="private">Private</option>
        <option value="public">Public</option>
      </select>
    </div>
    <div style="padding:8px 12px;display:flex;font-size:12px;opacity:0.6;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="flex:1;">Spotify track</div>
      <div style="flex:1;">SoundCloud match</div>
      <div style="width:50px;text-align:right;">Cnf</div>
      <div style="width:140px;padding-left:12px;">Action</div>
    </div>
    <div id="pm-sp-list" style="flex:1;overflow-y:auto;min-height:0;"></div>
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:flex-end;align-items:center;">
      <div style="display:flex;gap:10px;">
        <button id="pm-sp-cancel" class="pm-btn">Cancel</button>
        <button id="pm-sp-confirm" class="pm-btn pm-btn-primary" disabled>Confirm: import 0 tracks</button>
      </div>
    </div>
  `;
  back.appendChild(dlg);
  document.body.appendChild(back);

  dlg.querySelector("#pm-sp-cancel").addEventListener("click", () => back.remove());
  dlg.querySelector("#pm-sp-confirm").addEventListener("click", async () => {
    const needReview = _pmSpotifyState.rows.filter(r => r.resolved && r.confidence === "review" && r.action === "review").length;
    if (needReview > 0) {
      showToast(`Please accept or skip the ${needReview} track(s) marked 'Review' before importing!`);
      return;
    }

    const confirmBtn = dlg.querySelector("#pm-sp-confirm");
    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Importing...";

      const validRows = _pmSpotifyState.rows.filter(r => r.action !== "skip" && r.match);
      const skippedCount = _pmSpotifyState.rows.filter(r => r.action === "skip").length;
      const trackIds = validRows.map(r => r.match.id);

      if (trackIds.length === 0) {
        showToast("No tracks to import.");
        back.remove();
        return;
      }

      const chunks = [];
      for (let i = 0; i < trackIds.length; i += 500) {
        chunks.push(trackIds.slice(i, i + 500));
      }

      const createdPlaylists = [];
      let successCount = 0;

      const baseTitle = dlg.querySelector("#pm-sp-title").value.trim() || "Spotify Import";
      const sharing = dlg.querySelector("#pm-sp-sharing").value || "private";

      for (let i = 0; i < chunks.length; i++) {
        const chunkIds = chunks[i];
        const titleSuffix = i === 0 ? "" : ` (${i + 1})`;
        const title = `${baseTitle}${titleSuffix}`;

        try {
          const created = await api.create(title, sharing, chunkIds);
          if (created && created.id) {
            createdPlaylists.push(created);
            _pmState.playlists.unshift(created);
            successCount += chunkIds.length;
          } else {
            throw new Error("Invalid playlist response from API");
          }
        } catch (err) {
          const ok = await showConfirm(`Failed to create playlist chunk ${i + 1}. Continue with remaining?`, [
            { id: "cancel", text: "Cancel remaining", type: "secondary" },
            { id: "continue", text: "Continue", type: "primary" }
          ]);
          if (ok !== "continue") {
            break;
          }
        }
      }

      if (createdPlaylists.length > 0) {
        await pmSelectPlaylist(createdPlaylists[0].id);
      }

      showToast(`Imported ${successCount} tracks across ${createdPlaylists.length} playlist(s) (${skippedCount} skipped)`);
      localStorage.removeItem("sclient_spotify_draft");
      back.remove();
    } catch (e) {
      showToast("Error during import: " + (e.message || e));
      console.error(e);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm (Error)";
    }
  });

  if (resumedState) {
    _pmSpotifyState = resumedState;
  } else {
    _pmSpotifyState = {
      rows: spotifyRows.map((r, i) => ({
        idx: i,
        original: r,
        match: null,
        candidates: [],
        confidence: "skip",
        reason: "",
        score: 0,
        resolved: false,
        action: "skip"
      })),
      total: spotifyRows.length,
      resolved: 0
    };
  }

  const listEl = dlg.querySelector("#pm-sp-list");

  const updateProgress = () => {
    const resolvedCount = _pmSpotifyState.rows.filter(r => r.resolved).length;
    const needReview = _pmSpotifyState.rows.filter(r => r.resolved && r.confidence === "review" && r.action === "review").length;
    const skippedCount = _pmSpotifyState.rows.filter(r => r.resolved && r.action === "skip").length;
    const readyCount = resolvedCount - needReview - skippedCount;

    let headText = `Spotify CSV Import · resolved ${resolvedCount} / ${_pmSpotifyState.total}`;
    if (resolvedCount === _pmSpotifyState.total) {
      headText = `Spotify CSV Import · ❗ ${needReview} need review · ⏭ ${skippedCount} skipped · ✓ ${readyCount} ready`;
    }
    dlg.querySelector("#pm-sp-head").textContent = headText;

    const confirmBtn = dlg.querySelector("#pm-sp-confirm");
    if (resolvedCount === _pmSpotifyState.total) {
      confirmBtn.disabled = false;
      if (needReview > 0) {
        confirmBtn.textContent = `Confirm (${needReview} need review)`;
      } else {
        confirmBtn.textContent = `Confirm: import ${readyCount} tracks`;
      }
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `Confirm: import ${readyCount} tracks`;
    }
    localStorage.setItem("sclient_spotify_draft", JSON.stringify(_pmSpotifyState));
  };

  const renderRow = (r) => {
    let existing = listEl.querySelector(`#pm-sp-row-${r.idx}`);
    if (!existing) {
      existing = document.createElement("div");
      existing.id = `pm-sp-row-${r.idx}`;
      existing.dataset.idx = r.idx;

      const siblings = Array.from(listEl.children);
      const insertBefore = siblings.find(sib => Number(sib.dataset.idx) > r.idx);
      if (insertBefore) {
        listEl.insertBefore(existing, insertBefore);
      } else {
        listEl.appendChild(existing);
      }
    }

    if (!r.resolved) {
      existing.className = "pm-sp-row";
      existing.innerHTML = `<div style="opacity:0.5;width:100%;padding:10px;">Searching "${r.original.title}"...</div>`;
      return;
    }

    existing.className = `pm-sp-row ${r.confidence}`;

    const origStr = `${r.original.artists.join(", ")} – ${r.original.title}`;
    const origMeta = `${pmFmtDur(r.original.durationMs)} · ISRC ${r.original.isrc || "(none)"}`;

    let matchTitle = "(skip)";
    let matchMeta = "";
    let thumb = PLACEHOLDER_ART;

    if (r.match) {
      matchTitle = `${r.match.title} · ${getArtistFromTrack(r.match)}`;
      const deltaMs = r.original.durationMs ? r.match.duration - r.original.durationMs : 0;
      let deltaStr = "";
      if (r.match.duration === 30000) {
        deltaStr = "(GO+ snippet)";
      } else {
        const deltaS = (deltaMs / 1000).toFixed(1);
        deltaStr = deltaMs > 0 ? `+${deltaS}s` : `${deltaS}s`;
        if (Math.abs(deltaMs) > 2000) deltaStr += " ⚠";
      }
      matchMeta = `${pmFmtDur(r.match.duration)} · ${deltaStr}`;
      if (r.match.artwork_url) thumb = r.match.artwork_url;
    }

    const confEmoji = r.confidence === "high" ? "🟢" : (r.confidence === "review" ? "🟡" : "🔴");

    existing.innerHTML = `
      <div class="pm-sp-left">
        <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${origStr}">${origStr.replace(/</g, "&lt;")}</div>
        <div style="opacity:0.6;margin-top:4px;">${origMeta}</div>
      </div>
      <div class="pm-sp-right" style="display:flex;gap:10px;">
        ${r.match ? `<img src="${thumb}" style="width:32px;height:32px;border-radius:4px;flex-shrink:0;">` : ""}
        <div style="min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${matchTitle.replace(/</g, "&lt;")}</div>
          <div style="opacity:0.6;margin-top:4px;">${matchMeta}</div>
        </div>
      </div>
      <div class="pm-sp-score">
        <div>${confEmoji} ${r.score}</div>
        <div style="font-size:10px;opacity:0.5;white-space:nowrap;overflow:visible;margin-top:2px;">${r.reason}</div>
      </div>
      <div class="pm-sp-actions"></div>
    `;

    const actSelect = document.createElement("select");
    actSelect.className = "pm-select";
    actSelect.style.width = "100%";

    if (r.action === "review") {
      actSelect.innerHTML += `<option value="review" selected>Review ▾ pick match</option>`;
    }
    if (r.match && r.action !== "review") {
      actSelect.innerHTML += `<option value="accept" ${r.action === "accept" ? "selected" : ""}>Accept ▾</option>`;
    }

    r.candidates.forEach((c, i) => {
      if (c.id !== (r.match ? r.match.id : -1)) {
        actSelect.innerHTML += `<option value="alt_${i}">Match: ${c.title.slice(0,25)}</option>`;
      }
    });

    actSelect.innerHTML += `<option value="manual">Manual search…</option>`;
    actSelect.innerHTML += `<option value="skip" ${r.action === "skip" ? "selected" : ""}>Skip</option>`;

    actSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "skip") {
        r.action = "skip";
        r.match = null;
        r.confidence = "skip";
        renderRow(r);
        updateProgress();
      } else if (val === "accept") {
        r.action = "accept";
        renderRow(r);
        updateProgress();
      } else if (val.startsWith("alt_")) {
        const altIdx = parseInt(val.split("_")[1], 10);
        r.match = r.candidates[altIdx];
        r.confidence = "review";
        r.action = "accept";
        renderRow(r);
        updateProgress();
      } else if (val === "manual") {
        const searchUI = document.createElement("div");
        searchUI.style.cssText = "display:flex;gap:4px;margin-top:6px;";
        const qInput = document.createElement("input");
        qInput.type = "text";
        qInput.className = "pm-input";
        qInput.value = `${r.original.artists[0] || ""} ${r.original.title}`.trim();
        const goBtn = document.createElement("button");
        goBtn.className = "pm-btn";
        goBtn.textContent = "Go";
        searchUI.appendChild(qInput);
        searchUI.appendChild(goBtn);

        goBtn.addEventListener("click", async () => {
          goBtn.disabled = true;
          try {
            const candidates = await api.search(qInput.value);
            r.candidates = candidates;
            if (candidates.length > 0) {
              r.match = candidates[0];
              r.confidence = "review";
              r.action = "accept";
            } else {
              r.match = null;
              r.confidence = "skip";
              r.action = "skip";
            }
            renderRow(r);
            updateProgress();
          } catch (err) {
            showToast("Search failed");
            goBtn.disabled = false;
          }
        });
        existing.querySelector(".pm-sp-actions").appendChild(searchUI);
        qInput.focus();
      }
    });

    existing.querySelector(".pm-sp-actions").appendChild(actSelect);
  };

  const searchTrack = async (rowOrig) => {
    let retries = 4;
    let backoff = 800;
    const qArtist = rowOrig.artists[0] ? rowOrig.artists[0] : "";
    const qTitle = pmNormTitle(rowOrig.title) + " " + pmExtractMixType(rowOrig.title);
    const q = `${qArtist} ${qTitle}`.trim();

    while (retries >= 0) {
      try {
        const candidates = await api.search(q);
        let best = { confidence: "skip", score: 0, reason: "no match", tier: 4, match: null };
        for (const sc of candidates) {
          const res = pmScoreMatch(rowOrig, sc);
          if (res.score > best.score) {
            best = { ...res, match: sc };
          }
        }
        return { candidates, best };
      } catch (e) {
        if (e.message && e.message.includes("429") && retries > 0) {
          await new Promise(res => setTimeout(res, backoff));
          backoff = Math.min(backoff * 2, 8000);
          retries--;
        } else {
          return { error: "rate-limited; retry manually" };
        }
      }
    }
    return { error: "rate-limited; retry manually" };
  };

  _pmSpotifyState.rows.forEach(r => renderRow(r));
  updateProgress();

  const unresolved = _pmSpotifyState.rows.filter(r => !r.resolved);
  mapLimit(unresolved, 5, async (r) => {
    renderRow(r);
    const res = await searchTrack(r.original);
    r.resolved = true;
    if (res.error) {
      r.confidence = "skip";
      r.reason = res.error;
      r.score = 0;
      r.action = "skip";
    } else {
      r.candidates = res.candidates;
      r.confidence = res.best.confidence;
      r.score = res.best.score;
      r.reason = res.best.reason;
      r.match = res.best.match;

      if (r.confidence === "high") {
        r.action = "accept";
      } else if (r.confidence === "review") {
        r.action = "review";
      } else {
        r.action = "skip";
      }
    }
    renderRow(r);
    updateProgress();
  });
}
