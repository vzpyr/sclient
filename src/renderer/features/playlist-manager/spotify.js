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
    } else if (c === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
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

  const headers = rows[0].map((h) => h.toLowerCase());
  const trackIdx = headers.findIndex((h) => h.includes("track name"));
  const artistIdx = headers.findIndex((h) => h.includes("artist name"));

  let durIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (
      (h.includes("track duration") && h.includes("ms")) ||
      (h.includes("duration") && h.includes("ms"))
    ) {
      durIdx = i;
      break;
    }
  }

  const isrcIdx = headers.findIndex((h) => h.includes("isrc"));

  if (trackIdx === -1 || artistIdx === -1) {
    throw new Error("Not an exportify CSV (missing Track Name / Artist columns)");
  }

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[trackIdx] && !r[artistIdx]) continue;

    const rawArtists = r[artistIdx] || "";
    const artists = rawArtists
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    result.push({
      title: r[trackIdx] || "",
      artists: artists,
      durationMs: durIdx !== -1 && r[durIdx] ? parseInt(r[durIdx], 10) : 0,
      isrc: isrcIdx !== -1 ? (r[isrcIdx] || "").trim() : "",
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
  const m = title
    .toLowerCase()
    .match(/\b(original|remix|live|acoustic|edit|bootleg|mix|radio edit)\b/);
  return m ? m[1] : "";
}

function pmScoreMatch(spotifyRow, scTrack) {
  let score = 0;
  const reasons = [];

  // ISRC match = instant high score
  const isrcA = spotifyRow.isrc ? spotifyRow.isrc.replace(/[-\s]/g, "").toLowerCase() : "";
  const isrcB = scTrack.publisher_metadata?.isrc ? scTrack.publisher_metadata.isrc.replace(/[-\s]/g, "").toLowerCase() : "";
  if (isrcA && isrcB && isrcA === isrcB) {
    return { score: 100, reason: "ISRC" };
  }

  // Title similarity
  const normA = pmNormTitle(spotifyRow.title);
  const normB = pmNormTitle(scTrack.title);
  if (normA === normB) {
    score += 50;
    reasons.push("title");
  } else if (normA && normB) {
    const tokensA = normA.split(/\s+/).filter(Boolean);
    const tokensB = normB.split(/\s+/).filter(Boolean);
    const intersection = tokensA.filter((t) => tokensB.includes(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    const jaccard = union === 0 ? 0 : intersection / union;
    score += Math.floor(jaccard * 40);
    if (jaccard > 0.5) reasons.push("~title");
  }

  // Artist overlap
  const getArtistTokens = (str) => {
    if (!str) return [];
    return str.toLowerCase().split(/,|&|\bvs\.?\b|\//).map((s) => s.replace(/[^a-z0-9]/g, "").trim()).filter(Boolean);
  };
  const artistsA = getArtistTokens(spotifyRow.artists.join(", "));
  const artistsB = getArtistTokens(getArtistFromTrack(scTrack));
  if (artistsA.some((a) => artistsB.includes(a)) || artistsB.some((b) => artistsA.includes(b))) {
    score += 30;
    reasons.push("artist");
  }

  // Duration similarity (skip if 30s = GO+ snippet)
  const durA = spotifyRow.durationMs;
  const durB = scTrack.duration;
  if (durA && durB && durB !== 30000) {
    const delta = Math.abs(durA - durB);
    if (delta < 2000) { score += 15; reasons.push("dur"); }
    else if (delta < 5000) { score += 8; }
  }

  return { score, reason: reasons.join("+") || "best guess" };
}

async function mapLimit(items, limit, asyncFn) {
  const results = [];
  let i = 0;
  const workers = Array(limit)
    .fill(0)
    .map(async () => {
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
    const ok = await showConfirm(
      "You have an unfinished Spotify import. Do you want to resume it?",
      [
        { id: "new", text: "Start New", type: "secondary" },
        { id: "resume", text: "Resume", type: "primary" },
      ]
    );
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
  injectStyle(
    "sclient-playlists-spotify-style",
    `
    .pm-sp-row { display: flex; align-items: stretch; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 12px; gap: 12px; font-size:12px; }
    .pm-sp-row.high { background: rgba(50, 200, 50, 0.05); }
    .pm-sp-row.skip { background: rgba(200, 50, 50, 0.05); opacity: 0.7; }
    .pm-sp-left { flex: 1; min-width: 0; }
    .pm-sp-right { flex: 1; min-width: 0; }
    .pm-sp-score { width: 50px; text-align: right; flex-shrink: 0; font-weight: bold; }
    .pm-sp-actions { width: 200px; flex-shrink: 0; display:flex; gap:6px; align-items:center; }
  `
  );

  const back = document.createElement("div");
  back.className = "pm-picker-back";
  back.style.zIndex = "9999999";

  const dlg = document.createElement("div");
  dlg.style.cssText = `background:var(--sclient-bg-elevated);border:1px solid var(--sclient-border);border-radius:12px;width:90vw;max-width:900px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.7);`;

  dlg.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;gap:16px;">
      <div id="pm-sp-head" style="font-size:16px;font-weight:600;flex:1;">Spotify CSV Import · resolved 0 / ${resumedState ? resumedState.total : spotifyRows.length}</div>
      <input type="text" id="pm-sp-title" class="sclient-input" value="Spotify Import" style="width:200px;font-size:14px;padding:6px 10px;" />
      <select id="pm-sp-sharing" class="sclient-select" style="width:100px;font-size:14px;padding:6px 10px;">
        <option value="private">Private</option>
        <option value="public">Public</option>
      </select>
    </div>
    <div style="padding:8px 12px;display:flex;font-size:12px;opacity:0.6;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="flex:1;">Spotify track</div>
      <div style="flex:1;">SoundCloud match</div>
      <div style="width:50px;text-align:right;">Score</div>
      <div style="width:200px;padding-left:12px;">Action</div>
    </div>
    <div id="pm-sp-list" style="flex:1;overflow-y:auto;min-height:0;"></div>
    <div style="padding:14px 20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:flex-end;align-items:center;">
      <div style="display:flex;gap:10px;">
        <button id="pm-sp-cancel" class="sclient-btn">Cancel</button>
        <button id="pm-sp-confirm" class="sclient-btn sclient-btn-primary" disabled>Confirm: import 0 tracks</button>
      </div>
    </div>
  `;
  back.appendChild(dlg);
  document.body.appendChild(back);

  dlg.querySelector("#pm-sp-cancel").addEventListener("click", () => back.remove());
  dlg.querySelector("#pm-sp-confirm").addEventListener("click", async () => {


    const confirmBtn = dlg.querySelector("#pm-sp-confirm");
    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Importing...";

      const validRows = _pmSpotifyState.rows.filter((r) => r.action !== "skip" && r.match);
      const skippedCount = _pmSpotifyState.rows.filter((r) => r.action === "skip").length;
      const trackIds = validRows.map((r) => r.match.id);

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
          const ok = await showConfirm(
            `Failed to create playlist chunk ${i + 1}. Continue with remaining?`,
            [
              { id: "cancel", text: "Cancel remaining", type: "secondary" },
              { id: "continue", text: "Continue", type: "primary" },
            ]
          );
          if (ok !== "continue") {
            break;
          }
        }
      }

      if (createdPlaylists.length > 0) {
        await pmSelectPlaylist(createdPlaylists[0].id);
      }

      showToast(
        `Imported ${successCount} tracks across ${createdPlaylists.length} playlist(s) (${skippedCount} skipped)`
      );
      localStorage.removeItem("sclient_spotify_draft");
      back.remove();
    } catch (e) {
      showToast("Error during import: " + (e.message || e));
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
        action: "skip",
      })),
      total: spotifyRows.length,
      resolved: 0,
    };
  }

  const listEl = dlg.querySelector("#pm-sp-list");

  const updateProgress = () => {
    const resolvedCount = _pmSpotifyState.rows.filter((r) => r.resolved).length;
    const skippedCount = _pmSpotifyState.rows.filter(
      (r) => r.resolved && r.action === "skip"
    ).length;
    const readyCount = resolvedCount - skippedCount;

    let headText = `Spotify CSV Import · resolved ${resolvedCount} / ${_pmSpotifyState.total}`;
    if (resolvedCount === _pmSpotifyState.total) {
      headText = `Spotify CSV Import · ${skippedCount} skipped · ${readyCount} matched`;
    }
    dlg.querySelector("#pm-sp-head").textContent = headText;

    const confirmBtn = dlg.querySelector("#pm-sp-confirm");
    if (resolvedCount === _pmSpotifyState.total) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = `Import ${readyCount} tracks`;
    } else {
      confirmBtn.disabled = true;
      confirmBtn.textContent = `Import ${readyCount} tracks`;
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
      const insertBefore = siblings.find((sib) => Number(sib.dataset.idx) > r.idx);
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
    let thumb = "";

    if (r.match) {
      matchTitle = `${r.match.title} · ${getArtistFromTrack(r.match)}`;
      const deltaMs = r.original.durationMs ? r.match.duration - r.original.durationMs : 0;
      let deltaStr = "";
      if (r.match.duration === 30000) {
        deltaStr = "GO+";
      } else {
        const deltaS = (deltaMs / 1000).toFixed(1);
        deltaStr = deltaMs > 0 ? `+${deltaS}s` : `${deltaS}s`;
      }
      matchMeta = `${pmFmtDur(r.match.duration)} · ${deltaStr}`;
      if (r.match.artwork_url) thumb = r.match.artwork_url;
    }

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
        <div>${r.score}</div>
        <div style="font-size:10px;opacity:0.5;white-space:nowrap;overflow:visible;margin-top:2px;">${r.reason}</div>
      </div>
      <div class="pm-sp-actions"></div>
    `;

    const actionsEl = existing.querySelector(".pm-sp-actions");
    actionsEl.innerHTML = "";

    const actSelect = document.createElement("select");
    actSelect.className = "sclient-select";
    actSelect.style.cssText = "width:100%;font-size:11px;";

    // Top candidates
    r.candidates.forEach((c, i) => {
      const isSelected = r.match && c.id === r.match.id;
      const label = `${c.title.slice(0, 30)} · ${getArtistFromTrack(c).slice(0, 20)}`;
      actSelect.innerHTML += `<option value="pick_${i}" ${isSelected ? "selected" : ""}>${label}</option>`;
    });

    actSelect.innerHTML += `<option value="skip" ${r.action === "skip" || !r.match ? "selected" : ""}>Skip</option>`;
    actSelect.innerHTML += `<option value="manual">Manual search…</option>`;

    actSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "skip") {
        r.action = "skip";
        r.match = null;
        r.confidence = "skip";
        renderRow(r);
        updateProgress();
      } else if (val === "manual") {
        const searchUI = document.createElement("div");
        searchUI.style.cssText = "display:flex;gap:4px;";
        const qInput = document.createElement("input");
        qInput.type = "text";
        qInput.className = "sclient-input";
        qInput.value = `${r.original.artists[0] || ""} ${r.original.title}`.trim();
        qInput.style.cssText = "flex:1;min-width:0;font-size:11px;";
        const goBtn = document.createElement("button");
        goBtn.className = "sclient-btn";
        goBtn.textContent = "Go";
        goBtn.style.cssText = "font-size:11px;";
        searchUI.appendChild(qInput);
        searchUI.appendChild(goBtn);

        goBtn.addEventListener("click", async () => {
          goBtn.disabled = true;
          try {
            const candidates = await api.search(qInput.value);
            r.candidates = candidates;
            if (candidates.length > 0) {
              r.match = candidates[0];
              r.confidence = "high";
              r.action = "accept";
              r.score = 1;
              r.reason = "manual";
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
        actionsEl.innerHTML = "";
        actionsEl.appendChild(searchUI);
        qInput.focus();
      } else if (val.startsWith("pick_")) {
        const idx = parseInt(val.split("_")[1], 10);
        r.match = r.candidates[idx];
        r.action = "accept";
        r.confidence = "high";
        const s = pmScoreMatch(r.original, r.match);
        r.score = s.score;
        r.reason = s.reason;
        renderRow(r);
        updateProgress();
      }
    });

    actionsEl.appendChild(actSelect);
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
        let best = { score: -1, match: null };
        for (const sc of candidates) {
          const res = pmScoreMatch(rowOrig, sc);
          if (res.score > best.score) {
            best = { ...res, match: sc };
          }
        }
        // Always pick best candidate if any results
        if (!best.match && candidates.length > 0) {
          best = { score: 0, reason: "first", match: candidates[0] };
        }
        return { candidates, best };
      } catch (e) {
        if (e.message && e.message.includes("429") && retries > 0) {
          await new Promise((res) => setTimeout(res, backoff));
          backoff = Math.min(backoff * 2, 8000);
          retries--;
        } else {
          return { error: "rate-limited; retry manually" };
        }
      }
    }
    return { error: "rate-limited; retry manually" };
  };

  _pmSpotifyState.rows.forEach((r) => renderRow(r));
  updateProgress();

  const unresolved = _pmSpotifyState.rows.filter((r) => !r.resolved);
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
      r.score = res.best.score;
      r.reason = res.best.reason;
      r.match = res.best.match;
      r.confidence = r.match ? "high" : "skip";
      r.action = r.match ? "accept" : "skip";
    }
    renderRow(r);
    updateProgress();
  });
}
