# 11 — Wire & Flip (new main/index.js + preload.js + injection)

**Prereqs:** `docs/00-overview.md` (sections 2, 11, 13, 14). Phases 01–10 done (ALL v2 files exist).

## Goal
Create `src/v2/main/index.js` (the app entry) and `src/v2/preload.js`, flip `package.json` to use v2, and verify the app boots with the new code. The OLD tree stays on disk (deleted in Phase 12 after QA).

### ⚠️ CRITICAL — FEATURES registry temporal dead zone (fix here, or the bundle crashes at load)

Every renderer feature file ends with `FEATURES.push(...)`, but `const FEATURES = []` is declared in `renderer/core.js` — which is concatenated LAST (§11 order, entry 30). In one concatenated script, `FEATURES.push` inside the feature files throws `ReferenceError: Cannot access 'FEATURES' before initialization` (the `const` is in the temporal dead zone), so the entire injection dies on the first feature file.

Fix during this phase: hoist the registry so it initializes before any feature file executes — e.g. move `const FEATURES = []` (declaration only) from `renderer/core.js` to `renderer/utils.js` (concatenated first, entry 2). The manager functions in `core.js` keep referencing the shared global and are unaffected. Verify via the smoke test: console must log `[SClient] Successfully injected all modules.` with no errors.

## Files to create/modify

### 1. `src/v2/main/index.js` — port of old `src/main/index.js`
Port VERBATIM except the changes below:
- **Injection order** — replace the old `files` array + `chartJs` + payload block with the EXACT order from 00-overview §11. Read paths from `path.join(__dirname, "..", "renderer", ...)`. Chart.js path: `path.join(__dirname, "..", "..", "node_modules", "chart.js", "dist", "chart.umd.js")`.
- **CSS injection** — after `dom-ready`, also `insertCSS` the four style files in order (base, titlebar, layout, features) — read them from `styles/`. Keep the splash `insertCSS` logic (that's separate and stays).
- **Config payload** — `window.__SCLIENT_CONFIG__ = ${JSON.stringify(config.buildConfigPayload())};` set BEFORE the JS bundle (as old).
- **Preload path** — `preload: path.join(__dirname, "..", "preload.js")`.
- **Miniplayer block** — REMOVE the inline miniplayer IPC from `app.whenReady`; instead call `require("./features/miniplayer").register({ ipcMain, BrowserWindow, win, app })` (Phase 9 file handles it). Keep the `miniWin`-related `win.hide()` behavior inside that register (it was in the old block).
- **Main feature registration** — register everything in `app.whenReady`:
  ```javascript
  require("./ipc").register({ ipcMain, session, app, config });
  require("./features/downloader").register({ ipcMain, app });
  require("./features/discord-rpc").register({ ipcMain });
  require("./features/lastfm").register({ ipcMain, config });
  require("./features/listenbrainz").register({ ipcMain, config });
  require("./features/stats").register({ ipcMain, dialog, config });
  require("./features/playlist-manager").register({ ipcMain, dialog });
  require("./features/miniplayer").register({ ipcMain, BrowserWindow, win, app });
  ```
  (`dialog` is imported from electron at the top. `mpris` is NOT registered here unconditionally — old behavior: `mpris.init({ ipcMain, win })` only when `process.platform === "linux" && config.isEnabled("features.mpris")`; keep that conditional, calling the Phase 6 `main/features/mpris.js` `init({ ipcMain, win })`.)
- **Adblock** — keep ElectronBlocker init + `config.adblockEnabled` gating + `global._session`/`global._blocker` assignment (the generic save in Phase 6 references these globals).
- Everything else verbatim: single-instance lock, `sclient://` protocol handling, account partitions, splash, titlebar `frame`/`titleBarStyle` from config, tray menu (including the `executeJavaScript` DOM clicks — documented exception, keep), `load_last_page` save on close, F12 devtools, `before-quit`, `window-all-closed`.
- Export nothing (entry point). `app.name = "sclient"` stays.

### 2. `src/v2/preload.js` — port of old `src/preload.js`
- Copy VERBATIM with ONE change: remove the inline titlebar `<style>` block (the static CSS now lives in `styles/titlebar.css`, injected via insertCSS in main). KEEP: the titlebar HTML/button creation, the dynamic font @import logic, nav/control button wiring, `get-ui-config` usage, proxy interception, UA spoofing, the bridge relay (`sclient-bridge` ↔ `ipcRenderer.invoke`), `download_progress` forwarding, mini/mpris relays, `sclient-loaded`/`sclient-ready` class timing.
- ⚠️ Ordering: main injects titlebar.css via insertCSS in the dom-ready handler — that happens before `sclient-loaded` fade-out, so no flash regression. If the titlebar looks unstyled at boot, the fix is to insertCSS titlebar.css EARLIER (in `did-start-loading` next to the splash CSS) — implement it there instead if needed; note what you chose and why.

### 3. `package.json`
- `"main": "src/v2/main/index.js"` (was `src/main/index.js`). NOTHING else changes.
- electron-builder `files: ["src/**"]` already covers v2.

### 4. Smoke test
- `npm start` — app must boot to SoundCloud, splash shows, titlebar appears (custom style), injection runs (check devtools console: `[SClient] Successfully injected all modules.` and no errors; F12 opens devtools).
- Toggle a feature in settings → saves → reloads → feature appears (e.g. enable downloader → button in player bar; enable lyrics → button).
- Open playlist manager, stats overlay, miniplayer, right-click context menu. Try Ctrl+I.
- If anything is broken, debug and fix INSIDE v2 files (the phase docs + 00-overview are the contract; if a contract was wrong, fix the doc too and note it).

## Verification checklist
1. `node --check` main/index.js + preload.js.
2. Grep v2/main/index.js: no inline `mini_*` handlers, no `download_song`, no `lastfm_*` (all in feature files).
3. Injection file list in main/index.js matches §11 order exactly (29 JS entries + chart.js + payload; 4 CSS).
4. `package.json` main points at v2.
5. App boots with no console errors; features work per smoke test.
6. Do NOT touch: old `src/` (still needed as reference + rollback), `src/api`, `dist`, `node_modules`.

## Report
Smoke test results, the titlebar.css injection timing choice, any contract deviations. Await human approval, then commit `feat(v2): wire & flip`.
