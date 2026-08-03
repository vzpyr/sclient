# 06 — Main Features A (core IPC + downloader + discord-rpc + mpris)

**Prereqs:** `docs/00-overview.md` (sections 6, 11, 13, 14). Phases 01–05 done.

## Goal
Create the main-process core IPC file, port `main/romanize.js`, and create the first three main+renderer feature pairs. This is the first phase with CommonJS `require()` — main files export `{ register }`.

**Pair rule:** `main/features/<name>.js` pairs with `renderer/features/<name>.js`. Same name, mirrored dirs. Renderer calls `sendBridge("<channel>", args)`; main registers the channel in `register()`.

## Files to create

### 1. `src/v2/main/romanize.js` — copy of `src/main/romanize.js` UNCHANGED

### 2. `src/v2/main/ipc.js` — core IPC (export `{ register }`)
Port from old `src/main/ipc.js`, KEEPING ONLY non-feature handlers + the generic config save:
- `get-proxy-config`, `get-ui-config` (sendSync) — verbatim
- `clipboard_readText`, `clipboard_writeText`, `webcontents_paste/copy/cut/selectAll` — verbatim
- `get_active_account`, `set_active_account`, `get_accounts` (Partitions dir scan), `create_account`, `delete_account` — verbatim
- `restart_app`, `clear_data`, `clear_data_and_restart` — verbatim
- `romanize` — `ipcMain.handle("romanize", (_e, args) => romanize.romanizeLines((args && args.texts) || []))`
- `get_custom_files` — `config.buildConfigPayload()`
- **`save_custom_files` — GENERIC rewrite** (replaces the old 60-line hardcoded version):
  - The renderer (Phase 10 settings) sends `{ pairs: { "config.key.path": value, ... }, files: { css, js } }`.
  - Apply order: files first (`config.setFile("custom.css", ...)`, `config.setFile("custom.js", ...)`), then each pair:
    - if key is a SECURE key (00-overview §15) → `config.setSecure(key, String(value))`
    - else if key === `features.adblock` → `config.set("features.adblock", String(Boolean(value)))` AND toggle the blocker (see below)
    - else → `config.set(key, typeof value === "boolean" ? String(value) : value)`
  - Blocker toggling (old behavior): compare old/new, call `global._blocker.enableBlockingInSession(global._session)` / `.disableBlockingInSession(...)` on change (globals set by `main/index.js` in Phase 11 — reference them safely with `global._blocker && global._session`).
  - **Backward compat:** also accept the old flat shape (`{ css, js, adblock, ... }`) so Phase 10 settings can migrate later? NO — keep it strict: only the new shape. Phase 10 settings sends the new shape. (If you prefer supporting both, note it in your report; default is strict.)

### 3. `src/v2/main/features/downloader.js` — `{ register }`
Port the `download_song` handler from old `src/main/ipc.js` VERBATIM (ytdl setup with asar.unpacked path fix, `hasFfmpeg` check, playlist/track output templates, progress parsing via stdout `[download]` lines, `download_progress` push to `_e.sender`, error classification: DRM / rate-limit / generic). Keep the `require("youtube-dl-exec")` INSIDE this file (that's the point of the split).

### 4. `src/v2/renderer/features/downloader.js` — `DownloaderFeature`
Port old `src/injected/downloader.js` VERBATIM (both button injections + both toast builders), with these changes:
- `getOAuthToken()` → delete; use `bridge.extractOAuthToken()`.
- `extractClientId()` → delete; use `bridge.extractClientId()`.
- Track URL: old read `.playbackSoundBadge__titleLink` directly → use `bridge.getCurrentTrack().songUrl`.
- `lazyScrollOn` global → `SCLIENT_CONFIG.lazyScroll`.
- Toast/progress DOM stays in-feature (it's the feature's own UI).
- featureKey `features.show_downloader`, category `playback`.

### 5. `src/v2/main/features/discord-rpc.js` — `{ register }`
Merge old `src/main/discord-rpc.js` (Client, CLIENT_ID, buildRedirectUrl, updateRpc logic) into a file with `register({ ipcMain })` registering `update_rpc` which calls the same logic. Everything else verbatim (keep `rpc`/`login` module state).

### 6. `src/v2/renderer/features/discord-rpc.js` — `DiscordRpcFeature`
Port old `src/injected/rpc-bridge.js` VERBATIM: `setupDiscordRpc()` → `init()` subscribing `onPlaybackChange` (store the returned unsubscribe on `this`, call it in `destroy()` — see §10), dedupe via `last` state object, builds payload (title/artist/isPlaying/artwork/timeStart/timeEnd/songUrl/trackId/artistSlug/trackSlug), `sendBridge("update_rpc", {...})`. Uses `bridge.getArtistFromTrack(evt.trackData)`. NO injectUI. featureKey `features.discord_rpc`, category `playback`.

### 7. `src/v2/main/features/mpris.js` — `{ register }`
Merge old `src/main/mpris.js` (mpris-service player, capabilities, event→renderer forwarding via `mpris_command`, `mpris_update` handler building metadata) into `register({ ipcMain, win })`. Old code was called as `mpris.init({ ipcMain, win })` from main/index.js only when enabled — keep an `init({ ipcMain, win })` export too (Phase 11 calls it conditionally), and register `mpris_update` inside `init`. Behavior verbatim (position/duration micros, getPositionOverride, volume).

### 8. `src/v2/renderer/features/mpris.js` — `MprisFeature`
New renderer side (old code had this logic INLINE inside `pollPlayback` in core.js):
- `init()`: subscribe `onPlaybackChange` (store the returned unsubscribe on `this`, call it in `destroy()` — see §10); on each event build the mpris payload exactly like the old inline block: title/artist (via `getArtistFromTrack`), artwork (upscaled via the `-(t50x50|badge|large|t120x120).(jpg|png)` → `-t500x500.$2` regex), isPlaying, position, duration, songUrl, volume (from `bridge.getActiveMedia()?.volume ?? 1`) — post `{ source: "sclient-mpris-update", data }` via `window.postMessage(..., "*")`.
- Also listen for `sclient-mpris-command` messages and forward to `bridge.playerCommand(data)` (replaces old core.js handler).
- featureKey `features.mpris`, category `playback`.

## Verification checklist
1. `node --check` all files.
2. `diff src/main/romanize.js src/v2/main/romanize.js` → identical.
3. Grep old `src/main/ipc.js` handlers vs new: download_song only in features/downloader.js, lastfm_* NOT present yet (Phase 7), stats_* NOT present yet, playlist_* NOT present yet, update_rpc only in features/discord-rpc.js, miniplayer channels NOT present yet (Phase 9).
4. Renderer pairs exist for downloader, discord-rpc, mpris with matching featureKeys.
5. No `require()` anywhere under `src/v2/renderer/`.
6. Do NOT touch: `src/` old tree, `package.json`, `renderer/core.js`, other v2 feature files.

## Report
List channels registered, note the generic save contract (this is the API Phase 10 settings must implement against), confirm checklist. Await human approval, then commit `feat(v2): main features A`.
