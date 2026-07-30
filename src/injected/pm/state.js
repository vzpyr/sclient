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
  dropTargetId: null,
};

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
  return "";
}

function pmTrackArt(t) {
  return (t && t.artwork_url) || "";
}

function pmCurrent() {
  return _pmState.playlists.find((p) => p.id === _pmState.selectedId) || null;
}

function pmTrackCount(pl) {
  if (!pl) return 0;
  return pl.track_count != null ? pl.track_count : pl.tracks ? pl.tracks.length : 0;
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
      } catch (_) {}
    }
  }

  pl.tracks = ids.map((id) => byId.get(id)).filter(Boolean);
  const sumDur = pl.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  if (sumDur) pl.duration = sumDur;
  _pmState.hydrated.add(pl.id);
}

