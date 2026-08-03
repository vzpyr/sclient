# 12 — Collapse & Final QA

**Prereqs:** Phase 11 merged and QA'd (app runs on `src/v2`). `docs/00-overview.md` still mandatory reading.

## Goal
Delete the old tree, collapse `src/v2` → `src`, and run a full end-to-end QA pass. After this phase the repo has ONE clean tree.

## Steps (in order)

### 1. Backup & safety
- Confirm git status is clean or you have a stash/commit of the Phase 11 state. The old tree is your rollback — a commit is your rollback.

### 2. Remove old tree
```bash
rm -rf src/main src/injected src/preload.js
```
Do NOT delete `src/api` (deployed separately, untouched) and `src/v2`.

### 3. Collapse
```bash
# move v2 contents up into src/
mv src/v2/main src/v2/preload.js src/v2/renderer src/v2/miniplayer src/
rmdir src/v2
```
Final layout: `src/main/`, `src/renderer/`, `src/miniplayer/`, `src/preload.js`, `src/api/`.

### 4. Fix paths after the move
- `package.json`: `"main"` back to `"src/main/index.js"`.
- `src/main/index.js`:
  - preload path → `path.join(__dirname, "..", "preload.js")`
  - renderer dir → `path.join(__dirname, "..", "renderer")`
  - styles dir → `path.join(__dirname, "..", "renderer", "styles")`
  - chart.js → `path.join(__dirname, "..", "..", "node_modules", "chart.js", "dist", "chart.umd.js")` (unchanged)
- `src/main/features/miniplayer.js`: miniplayer html path → `path.join(__dirname, "..", "..", "miniplayer", "index.html")` (verify it resolves).
- `src/miniplayer/index.js`: `require("../main/romanize")` → verify relative path still resolves (from `src/miniplayer/` to `src/main/romanize.js` — it should be unchanged by the collapse since both moved up together; double check).
- Grep for `src/v2` anywhere (docs are fine to reference v2; CODE must not).

### 5. Update docs
- Edit `docs/00-overview.md`: add a short note at the top that the refactor is COMPLETE and paths now live at `src/` directly (keep the historical v2 references; they explain the process). Optionally mark phases 11–12 as done. Keep everything else (it's the architecture reference).
- Update `docs/11-wire-and-flip.md` and this doc's status in the overview if you keep a phase checklist.

### 6. Full QA pass (end-to-end)
Run `npm start` and verify, in one sitting:
1. Boot → splash → SoundCloud loads, no console errors.
2. Custom titlebar (custom style): drag, back/fwd, min/max/close work.
3. Settings (Ctrl+I + gear icon): every section renders (General, Appearance, Playback, Integrations, Stats, Playlist Manager, CSS/JS editors, Accounts). Toggle several features, save → reload → persisted.
4. Accent color change reflects across UI (buttons, lyrics highlights, toggles).
5. Downloader: single track + playlist, progress toast, cancel.
6. Lyrics: synced highlighting, offset slider, romanize toggle (J-pop test track).
7. Effects: speed/pitch/reverb; visualizer in miniplayer.
8. True shuffle (native + api modes).
9. Adblock on/off.
10. Context menu on a track/image/link; avatar artwork viewer (click player avatar) → copy/save image.
11. Miniplayer: open, play/pause/next/prev/like/shuffle/loop/seek/volume, visualizer, resize.
12. MPRIS (Linux): media keys from a DE/`playerctl` work; metadata correct.
13. Discord RPC: presence shows (if Discord running).
14. Last.fm + ListenBrainz: authenticate (lastfm), scrobble after threshold; status indicators.
15. Stats: local tracking records listens; charts render; export/import DB.
16. Playlist manager: list, hydrate, select, drag-reorder, create/delete, import JSON/CSV, Spotify exportify import flow.
17. Tray: show/prev/pause/next/exit.
18. Multi-account: create/switch/delete account; partition isolation.
19. Proxy region-bypass toggle + URL field.
20. `sclient://` protocol deep link (open a redirect URL).
21. Load-last-page on relaunch.
22. Native titlebar option still works (setting).

### 7. Cleanup
- Update `README.md` if it documents the old structure (optional but recommended).
- Remove `todo.md` if stale (optional).
- Commit: `refactor: collapse v2 into src, final QA`.

## Report
QA matrix with pass/fail per item (copy the list above), any fixes applied, final `tree src` output. Confirm `grep -rn "src/v2" src/ package.json` returns nothing.
