# 07 — Main Features B (lastfm + listenbrainz + stats)

**Prereqs:** `docs/00-overview.md` (sections 6, 13, 14). Phases 01–06 done.

## Goal

Split the scrobbler into two independent features and move the stats feature (main DB + renderer UI) into the new structure.

## Old code to study

- `src/main/ipc.js` — `submit_listenbrainz`, `lastfm_*` handlers, `lastfmSig`/`lastfmCreds`/`lastfmCall` helpers, stats handlers
- `src/main/stats.js` — DB logic
- `src/injected/scrobbler.js` — combined scrobbler (splits here)
- `src/injected/stats.js` — stats renderer (charts, overlay, tracking)
- `src/main/index.js` — the `stats_store_credentials`/`stats_record_listen` wiring context (already known)

## Files to create

### 1. `src/v2/main/features/lastfm.js` — `{ register }`

- Port VERBATIM from old `src/main/ipc.js`: `lastfmSig`, `lastfmCreds`, `lastfmCall`, and handlers: `lastfm_authenticate` (the BrowserWindow auth flow with will-redirect/will-navigate token capture), `lastfm_save_credentials`, `lastfm_disconnect`, `lastfm_now_playing`, `lastfm_scrobble`.
- Uses `config.getSecure(...)` — receive `config` via `register({ ipcMain, config })`.

### 2. `src/v2/renderer/features/lastfm.js` — `LastfmFeature`

- Port the Last.fm backend portion of old `src/injected/scrobbler.js` (`setupScrobbling`'s lastfm backend + the shared scrobble state machine) as its own feature:
  - `updateStatus(elId, text, color)` — the status element (`#sclient-lastfm-status`). NOTE: this element lives inside the SETTINGS overlay, which doesn't exist until Phase 10. Solution: `updateStatus` must tolerate a missing element (`if (el) {...}`) and the settings feature (Phase 10) will create the element. Keep the elId constant.
  - Track-start → `sendBridge("lastfm_now_playing", { artist, title })`
  - Threshold scrobble (min(duration/2, 240)s) → `sendBridge("lastfm_scrobble", { artist, title, timestamp })`
  - Auth error codes set: `new Set([4, 9, 14])`
- featureKey `integrations.lastfm.enabled`, category `integrations`, settingsFields: text `integrations.lastfm.api_key` (label "API Key"), text `integrations.lastfm.secret` (label "Secret"), plus `settingsCustom()` for an "Authenticate" button (Phase 10 wires `settingsInit` → `sendBridge("lastfm_authenticate")` and shows the resulting username; keep the custom HTML minimal — a button + a status line).

### 3. `src/v2/main/features/listenbrainz.js` — `{ register }`

- Port `submit_listenbrainz` handler from old `src/main/ipc.js` VERBATIM (token from `config.getSecure`, POST to api.listenbrainz.org, response mapping).

### 4. `src/v2/renderer/features/listenbrainz.js` — `ListenbrainzFeature`

- Port the ListenBrainz backend portion of old scrobbler.js: status element `#sclient-listenbrainz-status` (same missing-element tolerance), `sendBridge("submit_listenbrainz", { listen_type: "playing_now"|"single", payload: [...] })`, auth codes `new Set([401])`.
- featureKey `integrations.listenbrainz.enabled`, category `integrations`, settingsFields: text `integrations.listenbrainz.token` (label "Token").

### 5. `src/v2/main/features/stats.js` — `{ register }`

- Merge old `src/main/stats.js` (Database setup, WAL, listens table + source column migration, syncPlayHistory with credentials + 2h interval, recordListen, getData, wipeDb, exportDb, importDb) and the stats IPC handlers from old `src/main/ipc.js` (`stats_store_credentials`, `stats_record_listen`, `stats_get_data`, `stats_wipe_db`, `stats_export_db` with dialog, `stats_pick_import_file`, `stats_execute_import`) into one file.
- `register({ ipcMain, config, dialog })`. Keep module state (`db`, `credentials`, `syncTimer`, `insertStmt`).

### 6. `src/v2/renderer/features/stats.js` — `StatsFeature`

- Port old `src/injected/stats.js` VERBATIM: `extractAndSendCredentials` (via `bridge.extractClientId()` + `bridge.extractOAuthToken()`), `setupStatsTracking` → `init()`-time subscription to `onPlaybackChange` (store the returned unsubscribe on `this`, call it in `destroy()` — see §10) (record listen via `sendBridge("stats_record_listen", ...)`), charts (Chart global comes from the injected chart.umd.js), `createAnalyticsOverlay`/`toggleAnalytics` → methods, import/export buttons via `sendBridge`, `showConfirm` from utils.
- Rename `.sc-*` own classes → `.sclient-*` (§12) and `var(--sc-*)` → `var(--sclient-*)`.
- The stats feature is opened via a button — old code had the gear menu inject it? NO: old stats overlay is opened from the settings overlay ("Open stats" button in settings.js) and possibly a keyboard handler. Keep the toggle function exported on the instance (e.g. `this.toggle()`), and the settings feature (Phase 10) will wire an "Open Stats" button via that instance. To make that possible, `StatsFeature` must be reachable: `const STATS_FEATURE = new StatsFeature(); FEATURES.push(STATS_FEATURE);` and settings accesses `FEATURES.find(f => f.featureKey === "stats_local_tracking")` or similar. Note this access pattern in your report.
- featureKey: the stats feature is controlled by TWO keys (`stats.api_sync`, `stats.local_tracking`). Set `featureKey` to `stats.local_tracking` and expose `get apiSyncEnabled() { return !!SCLIENT_CONFIG.statsApiSync; }`. Category `stats`, label "Listening Stats", hasToggle true (toggle reflects local_tracking). settingsCustom(): an "Open Stats" button (Phase 10 wires it). **NOTE:** base `isEnabled()` only strips the `features.` prefix, so `stats.local_tracking` will NOT resolve against the flat payload (`stats_local_tracking`). Override `isEnabled()` in StatsFeature to return `!!SCLIENT_CONFIG.statsLocalTracking`.

## Verification checklist

1. `node --check` all files.
2. Old `scrobbler.js` logic fully distributed: no leftover combined backend code in old files referenced by new ones.
3. Grep old main/ipc.js: `submit_listenbrainz` and `lastfm_*` and `stats_*` handlers no longer needed there (they exist in v2 feature files). (Old file itself stays untouched.)
4. Renderer: `sendBridge` used for all main interactions; no direct `require`.
5. Stats charts reference global `Chart` (no import).
6. Do NOT touch: `src/`, `package.json`, Phase 1–6 v2 files.

## Report

Note the scrobbler state-machine duplication between lastfm/listenbrainz features (expected per 00-overview §16), the status-element contract for Phase 10, the STATS_FEATURE lookup contract. Await human approval, then commit `feat(v2): main features B`.
