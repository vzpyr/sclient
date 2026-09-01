function pmNormTitle(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[({[][^)\]}]*[)\]}]/g, " ")
    .replace(/\bfeat\.?\b|\bft\.?\b|\bprod\.? by\b/g, " ")
    .replace(
      /\bfree download\b|\bofficial (audio|video|music video|visualizer)\b/g,
      " ",
    )
    .replace(/\b(remix|edit|live|acoustic|bootleg|mix|radio edit)\b/g, " $1 ")
    .replace(/\s*\bslash\b\s*|\s+\/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pmScoreMatch(spotifyRow, scTrack) {
  let score = 0;
  const tags = [];

  const isrcA = spotifyRow.isrc
    ? spotifyRow.isrc.replace(/[-\s]/g, "").toLowerCase()
    : "";
  const isrcB =
    scTrack.publisher_metadata?.isrc?.replace(/[-\s]/g, "").toLowerCase() || "";
  if (isrcA && isrcB && isrcA === isrcB) return { score: 100, reason: "I" };

  const normA = pmNormTitle(spotifyRow.title);
  const normB = pmNormTitle(scTrack.title);
  if (normA && normB) {
    if (normA === normB) {
      score += 50;
      tags.push("t");
    } else {
      const tokA = normA.split(/\s+/);
      const tokB = normB.split(/\s+/);
      const hit = tokA.filter((t) => tokB.includes(t)).length;
      const all = new Set([...tokA, ...tokB]).size;
      const j = all ? hit / all : 0;
      score += Math.round(j * 40);
      if (j > 0.5) tags.push("~t");
    }
  }

  const splitArtists = (s) =>
    s
      ? s
          .toLowerCase()
          .split(/,|&|\bvs\.?\b|\//)
          .map((x) => x.replace(/[^a-z0-9]/g, "").trim())
          .filter(Boolean)
      : [];
  const artA = splitArtists(spotifyRow.artists.join(", "));
  const artB = splitArtists(getArtistFromTrack(scTrack));
  if (
    artA.some((a) => artB.includes(a)) ||
    artB.some((b) => artA.includes(b))
  ) {
    score += 30;
    tags.push("a");
  }

  const dA = spotifyRow.durationMs;
  const dB = scTrack.duration;
  if (dA && dB && dB !== 30000) {
    const delta = Math.abs(dA - dB);
    if (delta < 2000) {
      score += 15;
      tags.push("d");
    } else if (delta < 5000) score += 8;
  }

  return { score, reason: tags.join("+") || "-" };
}

function pmParseSpotifyCsv(text) {
  if (!text) return [];
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') {
        field += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !inQ) {
      row.push(field);
      if (row.some((f) => f)) rows.push(row);
      row = [];
      field = "";
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((f) => f)) rows.push(row);
  }
  if (rows.length < 2) throw new Error("Empty or invalid CSV");

  const h = rows[0].map((x) => x.toLowerCase());
  const ti = h.findIndex((x) => x.includes("track name"));
  const ai = h.findIndex((x) => x.includes("artist name"));
  if (ti === -1 || ai === -1)
    throw new Error("Not an exportify CSV (missing columns)");

  let di = -1;
  for (let i = 0; i < h.length; i++) {
    if (h[i].includes("duration") && h[i].includes("ms")) {
      di = i;
      break;
    }
  }
  const ii = h.findIndex((x) => x.includes("isrc"));

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[ti] && !r[ai]) continue;
    out.push({
      title: r[ti] || "",
      artists: (r[ai] || "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      durationMs: di !== -1 && r[di] ? parseInt(r[di], 10) : 0,
      isrc: ii !== -1 ? (r[ii] || "").trim() : "",
    });
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const res = [];
  let i = 0;
  await Promise.all(
    Array(limit)
      .fill(0)
      .map(async () => {
        while (i < items.length) {
          const idx = i++;
          res[idx] = await fn(items[idx], idx);
        }
      }),
  );
  return res;
}

let _pmSpotifyState = null;

async function pmSpotifyImport() {
  const draft = localStorage.getItem("sclient_spotify_draft");
  if (draft) {
    const ok = await showConfirm("Resume unfinished import?", [
      { id: "new", text: "Start New", type: "secondary" },
      { id: "resume", text: "Resume", type: "primary" },
    ]);
    if (ok === "resume") {
      try {
        pmOpenSpotifyModal(null, JSON.parse(draft));
        return;
      } catch {
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

  let rows;
  try {
    rows = pmParseSpotifyCsv(fileText);
  } catch (e) {
    showToast(e.message);
    return;
  }

  pmOpenSpotifyModal(rows);
}

function pmOpenSpotifyModal(spotifyRows, resumed = null) {
  injectStyle(
    "sclient-pm-spotify",
    `
    .spm-row { display:flex; align-items:stretch; padding:8px 12px; gap:12px; font-size:var(--sclient-text-sm); border-bottom:1px solid var(--sclient-border); }
    .spm-row.matched { background:rgba(50,200,50,0.05); }
    .spm-row.skipped { background:rgba(200,50,50,0.05); opacity:0.6; }
    .spm-left, .spm-right { flex:1; min-width:0; }
    .spm-score { width:50px; flex-shrink:0; text-align:right; font-weight:600; }
    .spm-actions { width:200px; flex-shrink:0; }
    .spm-title { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .spm-meta { color:var(--sclient-text-muted); margin-top:4px; }
    .spm-thumb { width:32px; height:32px; border-radius:var(--sclient-radius-sm); flex-shrink:0; }
    .spm-header { padding:16px 20px; border-bottom:1px solid var(--sclient-border); display:flex; justify-content:space-between; align-items:center; gap:16px; }
    .spm-cols { padding:8px 12px; display:flex; font-size:var(--sclient-text-xs); color:var(--sclient-text-muted); border-bottom:1px solid var(--sclient-border); }
    .spm-footer { padding:14px 20px; border-top:1px solid var(--sclient-border); display:flex; justify-content:flex-end; gap:10px; }
    .spm-search { display:flex; gap:4px; }
    .spm-search input { flex:1; min-width:0; font-size:var(--sclient-text-xs); }
    .spm-search button { font-size:var(--sclient-text-xs); }
  `,
  );

  const back = document.createElement("div");
  back.className = "sclient-modal-backdrop";

  const dlg = document.createElement("div");
  dlg.className = "sclient-modal-surface";
  dlg.style.cssText =
    "width:90vw;max-width:900px;max-height:85vh;display:flex;flex-direction:column;";

  const total = resumed ? resumed.total : spotifyRows.length;

  dlg.innerHTML = `
    <div class="spm-header">
      <div id="spm-head" class="sclient-text-h2" style="flex:1">Spotify Import · 0 / ${total}</div>
      <input id="spm-title" class="sclient-input" value="Spotify Import" style="width:200px" />
      <select id="spm-sharing" class="sclient-select" style="width:100px">
        <option value="private">Private</option>
        <option value="public">Public</option>
      </select>
    </div>
    <div class="spm-cols">
      <div style="flex:1">Spotify</div>
      <div style="flex:1">SoundCloud</div>
      <div style="width:50px;text-align:right">Score</div>
      <div style="width:200px;padding-left:12px">Match</div>
    </div>
    <div id="spm-list" style="flex:1;overflow-y:auto;min-height:0"></div>
    <div class="spm-footer">
      <button id="spm-cancel" class="sclient-btn">Cancel</button>
      <button id="spm-confirm" class="sclient-btn sclient-btn-primary" disabled>Import 0 tracks</button>
    </div>
  `;
  back.appendChild(dlg);
  document.body.appendChild(back);

  requestAnimationFrame(() => {
    back.style.opacity = "1";
    dlg.style.transform = "scale(1)";
  });

  dlg.querySelector("#spm-cancel").onclick = () => {
    back.style.opacity = "0";
    dlg.style.transform = "scale(0.95)";
    setTimeout(() => back.remove(), 200);
  };
  dlg.querySelector("#spm-confirm").onclick = async () => {
    const btn = dlg.querySelector("#spm-confirm");
    btn.disabled = true;
    btn.textContent = "Importing...";

    const valid = _pmSpotifyState.rows.filter(
      (r) => r.action !== "skip" && r.match,
    );
    const ids = valid.map((r) => r.match.id);
    if (!ids.length) {
      showToast("No tracks to import.");
      back.style.opacity = "0";
      dlg.style.transform = "scale(0.95)";
      setTimeout(() => back.remove(), 200);
      return;
    }

    const chunks = [];
    for (let i = 0; i < ids.length; i += 500)
      chunks.push(ids.slice(i, i + 500));

    const created = [];
    let ok = 0;
    const title =
      dlg.querySelector("#spm-title").value.trim() || "Spotify Import";
    const sharing = dlg.querySelector("#spm-sharing").value;

    for (let i = 0; i < chunks.length; i++) {
      const name = i === 0 ? title : `${title} (${i + 1})`;
      try {
        const pl = await api.create(name, sharing, chunks[i]);
        if (pl?.id) {
          created.push(pl);
          _pmState.playlists.unshift(pl);
          ok += chunks[i].length;
        } else throw new Error("Bad response");
      } catch {
        const cont = await showConfirm(
          `Playlist chunk ${i + 1} failed. Continue?`,
          [
            { id: "no", text: "Cancel", type: "secondary" },
            { id: "yes", text: "Continue", type: "primary" },
          ],
        );
        if (cont !== "yes") break;
      }
    }

    if (created.length) await pmSelectPlaylist(created[0].id);
    const skipped = _pmSpotifyState.rows.filter(
      (r) => r.action === "skip",
    ).length;
    showToast(`Imported ${ok} tracks (${skipped} skipped)`);
    localStorage.removeItem("sclient_spotify_draft");
    back.style.opacity = "0";
    dlg.style.transform = "scale(0.95)";
    setTimeout(() => back.remove(), 200);
  };

  _pmSpotifyState = resumed || {
    rows: spotifyRows.map((r, i) => ({
      idx: i,
      original: r,
      match: null,
      candidates: [],
      score: 0,
      reason: "",
      resolved: false,
      action: "skip",
    })),
    total: spotifyRows.length,
  };

  const list = dlg.querySelector("#spm-list");

  const updateHead = () => {
    const done = _pmSpotifyState.rows.filter((r) => r.resolved).length;
    const skip = _pmSpotifyState.rows.filter(
      (r) => r.resolved && r.action === "skip",
    ).length;
    const ready = done - skip;
    const head = dlg.querySelector("#spm-head");
    head.textContent =
      done === _pmSpotifyState.total
        ? `Spotify Import · ${skip} skipped · ${ready} matched`
        : `Spotify Import · ${done} / ${_pmSpotifyState.total}`;
    const btn = dlg.querySelector("#spm-confirm");
    btn.disabled = done < _pmSpotifyState.total;
    btn.textContent = `Import ${ready} tracks`;
    localStorage.setItem(
      "sclient_spotify_draft",
      JSON.stringify(_pmSpotifyState),
    );
  };

  const renderRow = (r) => {
    let el = list.querySelector(`#spm-r-${r.idx}`);
    if (!el) {
      el = document.createElement("div");
      el.id = `spm-r-${r.idx}`;
      el.dataset.idx = r.idx;
      const before = Array.from(list.children).find(
        (c) => +c.dataset.idx > r.idx,
      );
      before ? list.insertBefore(el, before) : list.appendChild(el);
    }

    if (!r.resolved) {
      el.className = "spm-row";
      el.innerHTML = `<div style="opacity:0.5;padding:10px">Searching "${r.original.title}"...</div>`;
      return;
    }

    el.className = `spm-row ${r.action === "skip" ? "skipped" : "matched"}`;

    const orig = `${r.original.artists.join(", ")} – ${r.original.title}`;
    const origMeta = `${pmFmtDur(r.original.durationMs)} · ISRC ${r.original.isrc || "-"}`;

    let matchTitle = "(skip)";
    let matchMeta = "";
    let thumb = "";

    if (r.match) {
      matchTitle = `${r.match.title} · ${getArtistFromTrack(r.match)}`;
      const d = r.original.durationMs
        ? r.match.duration - r.original.durationMs
        : 0;
      const dStr =
        r.match.duration === 30000
          ? "GO+"
          : `${d > 0 ? "+" : ""}${(d / 1000).toFixed(1)}s`;
      matchMeta = `${pmFmtDur(r.match.duration)} · ${dStr}`;
      thumb = r.match.artwork_url || "";
    }

    el.innerHTML = `
      <div class="spm-left">
        <div class="spm-title" title="${orig}">${orig.replace(/</g, "&lt;")}</div>
        <div class="spm-meta">${origMeta}</div>
      </div>
      <div class="spm-right" style="display:flex;gap:10px">
        ${thumb ? `<img src="${thumb}" class="spm-thumb">` : ""}
        <div style="min-width:0">
          <div class="spm-title">${matchTitle.replace(/</g, "&lt;")}</div>
          <div class="spm-meta">${matchMeta}</div>
        </div>
      </div>
      <div class="spm-score">
        <div>${r.score}</div>
        <div class="spm-meta">${r.reason}</div>
      </div>
      <div class="spm-actions"></div>
    `;

    const act = el.querySelector(".spm-actions");
    const sel = document.createElement("select");
    sel.className = "sclient-select";
    sel.style.cssText = "width:100%;font-size:var(--sclient-text-xs)";

    r.candidates.forEach((c, i) => {
      const sel2 = r.match && c.id === r.match.id ? "selected" : "";
      sel.innerHTML += `<option value="p_${i}" ${sel2}>${c.title.slice(0, 30)} · ${getArtistFromTrack(c).slice(0, 20)}</option>`;
    });
    sel.innerHTML += `<option value="skip" ${!r.match ? "selected" : ""}>Skip</option>`;
    sel.innerHTML += `<option value="manual">Manual search…</option>`;

    sel.onchange = () => {
      const v = sel.value;
      if (v === "skip") {
        r.action = "skip";
        r.match = null;
      } else if (v === "manual") {
        const box = document.createElement("div");
        box.className = "spm-search";
        const inp = document.createElement("input");
        inp.className = "sclient-input";
        inp.value = `${r.original.artists[0] || ""} ${r.original.title}`.trim();
        const go = document.createElement("button");
        go.className = "sclient-btn";
        go.textContent = "Go";
        box.append(inp, go);
        go.onclick = async () => {
          go.disabled = true;
          try {
            const cands = await api.search(inp.value);
            r.candidates = cands;
            if (cands.length) {
              r.match = cands[0];
              r.action = "accept";
              const s = pmScoreMatch(r.original, cands[0]);
              r.score = s.score;
              r.reason = "m";
            } else {
              r.match = null;
              r.action = "skip";
            }
            renderRow(r);
            updateHead();
          } catch {
            showToast("Search failed");
            go.disabled = false;
          }
        };
        act.innerHTML = "";
        act.appendChild(box);
        inp.focus();
        return;
      } else if (v.startsWith("p_")) {
        const i = +v.slice(2);
        r.match = r.candidates[i];
        r.action = "accept";
        const s = pmScoreMatch(r.original, r.match);
        r.score = s.score;
        r.reason = s.reason;
      }
      renderRow(r);
      updateHead();
    };

    act.appendChild(sel);
  };

  _pmSpotifyState.rows.forEach(renderRow);
  updateHead();

  const pending = _pmSpotifyState.rows.filter((r) => !r.resolved);
  mapLimit(pending, 5, async (r) => {
    renderRow(r);
    let retries = 4,
      backoff = 800;
    const q =
      `${r.original.artists[0] || ""} ${pmNormTitle(r.original.title)}`.trim();
    let res;
    while (retries >= 0) {
      try {
        const cands = await api.search(q);
        let best = { score: -1, match: null };
        for (const c of cands) {
          const s = pmScoreMatch(r.original, c);
          if (s.score > best.score) best = { ...s, match: c };
        }
        if (!best.match && cands.length)
          best = { score: 0, reason: "-", match: cands[0] };
        res = { candidates: cands, best };
        break;
      } catch (e) {
        if (e.message?.includes("429") && retries > 0) {
          await new Promise((r) => setTimeout(r, backoff));
          backoff = Math.min(backoff * 2, 8000);
          retries--;
        } else {
          res = { error: true };
          break;
        }
      }
    }

    r.resolved = true;
    if (res?.error || !res) {
      r.reason = res ? "rate-limited" : "failed";
      r.action = "skip";
    } else {
      r.candidates = res.candidates;
      r.match = res.best.match;
      r.score = res.best.score;
      r.reason = res.best.reason;
      r.action = r.match ? "accept" : "skip";
    }
    renderRow(r);
    updateHead();
  });
}
