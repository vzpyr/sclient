# 08 — Playlist Manager

**Prereqs:** `docs/00-overview.md` (sections 6, 10, 13, 14). Phases 01–07 done.

## Goal

Move the playlist manager (PM) into the new structure: renderer feature directory with sub-files + the main-side file-dialog feature. **Subdirectory rule** (00-overview): a feature big enough for clear sub-components gets a directory whose entry is `index.js`.

## Old code to study

- `src/injected/pm/api.js` — SC API client
- `src/injected/pm/state.js` — PM state + hydration
- `src/injected/pm/ui.js` — PM UI (the big one)
- `src/injected/pm/spotify.js` — Spotify CSV import
- `src/main/ipc.js` — `playlist_save_file`, `playlist_pick_import_file`

## Files to create

### 1. `src/v2/renderer/features/playlist-manager/api.js`

Port old `pm/api.js` VERBATIM: `SC_APP_VERSION`, `SC_APP_LOCALE`, `SC_BASE`, `extractOAuthToken` (DELETE — use `bridge.extractOAuthToken()`), `scReq`, `scCollectPages`, and the `api` object (me, listPlaylists, create, putTracks, putFull, del, getPlaylist, resolve, tracks, search).

- Keep the module-scope `const api = {...}` (it's a shared global within the concatenation — fine).

### 2. `src/v2/renderer/features/playlist-manager/state.js`

Port old `pm/state.js` VERBATIM: `_pmState`, `pmFmtDur`, `pmFmtTotal`, `pmPlaylistArt`, `pmTrackArt`, `pmCurrent`, `pmTrackCount`, `pmHydrateCurrent`.

### 3. `src/v2/renderer/features/playlist-manager/spotify.js`

Port old `pm/spotify.js` VERBATIM: `pmParseSpotifyCsv`, `pmNormTitle`, `pmExtractMixType`, `pmScoreMatch`, the rate-limited search loop, `_pmSpotifyState`, `mapLimit`, the review/accept/skip UI rendering. All the `pm-*` DOM helpers stay.

### 4. `src/v2/renderer/features/playlist-manager/index.js` — `PlaylistManagerFeature`

Port old `pm/ui.js` VERBATIM (overlay `#sclient-playlists-overlay`, sidebar render, detail render, drag/drop, context menu, import flows, export, `togglePlaylistManager` → method `this.toggle()`).

- Renames (§12): `.sc-*` own classes → `.sclient-*`; `var(--sc-*)` → `var(--sclient-*)`. NOTE: PM has a large injected style block (`.pm-sidebar`, `.pm-pl`, `.pm-track-row`, `.pm-picker`, ...) — the `pm-` prefix is OUR namespace and is fine to keep (it's consistent with the `sclient-` rule in spirit, but `pm-` is already unambiguous and heavily used — KEEP `pm-` as-is to avoid a huge rename; document this decision in the report).
- Config: always-on. `hasToggle` false. `settingsCategory` `playback`, `settingsLabel` "Playlist Manager", `settingsCustom()` returns an "Open Playlist Manager" button (Phase 10 settings wires `settingsInit` to call the feature's `toggle()`).
- `injectUI()`: NOT applicable the same way — the PM has no player-bar button in old code (it's opened from settings). So: `init()` → nothing visible; expose `toggle()`; the settings feature calls it. (If old code had a keyboard shortcut or header button for PM, preserve it — check `pm/ui.js` for keydown handlers.)
- Uses: `api` (from api.js), `_pmState` (state.js), `showConfirm`, `showToast`, `esc` (utils), `bridge.extractClientId()`, `bridge.extractOAuthToken()`, `sendBridge("playlist_save_file"|"playlist_pick_import_file", ...)`.
- Ends with `const PLAYLIST_MANAGER_FEATURE = new PlaylistManagerFeature(); FEATURES.push(PLAYLIST_MANAGER_FEATURE);`.

### 5. `src/v2/main/features/playlist-manager.js` — `{ register }`

Port the two file-dialog handlers from old `src/main/ipc.js` VERBATIM: `playlist_save_file` (save dialog, writes JSON, returns `{ok, path, canceled}`), `playlist_pick_import_file` (open dialog, returns file contents or null).

## Verification checklist

1. `node --check` all files.
2. Function inventory from old pm/ files all present in new files (grep old `^function` names, compare).
3. No `require` in renderer; `sendBridge` for file dialogs.
4. `FEATURES.push(PLAYLIST_MANAGER_FEATURE)` present; feature reachable for Phase 10 settings (document the access pattern, e.g. a lookup by class or a documented global const — recommend: keep the const name `PLAYLIST_MANAGER_FEATURE` global so settings can call it directly; it's part of the concatenation).
5. Do NOT touch: `src/`, `package.json`, prior v2 files.

## Report

Note the `pm-` prefix decision, the settings access contract for `toggle()`, any keydown/shortcut behavior preserved. Await human approval, then commit `feat(v2): playlist manager`.
