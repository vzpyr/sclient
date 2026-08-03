# 09 — Miniplayer

**Prereqs:** `docs/00-overview.md` (sections 6, 8, 13, 14). Phases 01–08 done.

## Goal

Move the miniplayer window to `src/v2/miniplayer/` and create its renderer feature + main feature pair.

## Old code to study

- `src/main/mini.html`, `src/main/mini.js` — the miniplayer window (separate BrowserWindow, `nodeIntegration: true, contextIsolation: false`, loads via `loadFile`)
- `src/main/index.js` — the miniplayer IPC block (`toggle_miniplayer` + all `mini_*` handlers, the BrowserWindow construction with `desiredSize`)
- `src/injected/core.js` — `injectMiniplayerButton` (~line 517), the `sclient-mini-action` and `sclient-mini-time` logic, the `sclient-mini-update` payload in `pollPlayback`

## Files to create

### 1. `src/v2/miniplayer/index.html`

Copy of old `src/main/mini.html` with `<script src="./index.js">` (was `./mini.js`). No other changes.

### 2. `src/v2/miniplayer/index.js`

Copy of old `src/main/mini.js` with ONE change: `const { romanizeLines } = require("./romanize");` → `require("../main/romanize")`. Everything else verbatim (accent extraction from artwork, lyrics fetch from lrcmux, visualizer canvas, transport buttons, `ipcRenderer` usage — this window has nodeIntegration, so `require("electron")` works here, which is the documented exception).

### 3. `src/v2/main/features/miniplayer.js` — `{ register }`

Port the ENTIRE miniplayer window-management block from old `src/main/index.js` (`app.whenReady` miniplayer section):

- Module state: `let miniWin = null;`
- `register({ ipcMain, BrowserWindow, win, app })` registering: `toggle_miniplayer` (create/close window, `loadFile` → path to `src/v2/miniplayer/index.html`, hide main win), `mini_close`, `mini_minimize`, `mini_fullscreen` (incl. desiredSize logic), `mini_action` (forward to main win `webContents.send("mini_action", action)`), `mini_update`/`mini_visualizer`/`mini_time` (forward to miniWin), `resize_mini`.
- Export a `stop()` or teardown if needed (window-all-closed behavior handled in main/index.js Phase 11).
- **Path note:** `main/index.js` (Phase 11) will call `miniWin.loadFile(path.join(__dirname, "..", "miniplayer", "index.html"))` — compute the path inside this file relative to its own `__dirname` (`path.join(__dirname, "..", "..", "miniplayer", "index.html")`). Use `__dirname`-relative paths, never hardcoded absolute.

### 4. `src/v2/renderer/features/miniplayer.js` — `MiniplayerFeature`

Port from old core.js:

- `injectUI()` → `injectMiniplayerButton()` verbatim (button `#sclient-mini-btn` before `.playbackSoundBadge__showQueue`, posts `{source:"sclient-mini-toggle"}`).
- `init()`:
  - Subscribe `onPlaybackChange` (store the returned unsubscribe on `this`, call it in `destroy()` — see §10) → build the `sclient-mini-update` payload exactly as old `pollPlayback` did: trackData, isPlaying, position, duration, isLiked (`.playbackSoundBadge__like` has `sc-button-selected`), isShuffled (`.shuffleControl` has `m-shuffling`), loopState (from `.repeatControl` classes `m-one`/`m-all`), accent (`getAccent()`), playbackRate (`window.sclient_effects?.speed ?? 1`), showVisualizer (`SCLIENT_CONFIG.showVisualizer`) → `window.postMessage({source:"sclient-mini-update", data}, "*")`.
  - Listen for `sclient-mini-action` messages → `bridge.playerCommand(action)` (old core.js handler logic, now in bridge).
  - The 100ms `sendLiveTime` interval posting `sclient-mini-time` → keep (store interval on `this`, clear in `destroy()`).
- featureKey `features.show_miniplayer`, category `playback`.

## Verification checklist

1. `node --check` `index.js` (miniplayer) and `main/features/miniplayer.js`; the miniplayer index.js requires `electron` — `node --check` still parses fine.
2. Diff old mini.html vs new index.html (only script src changed).
3. All `mini_*` IPC channels registered in exactly one place (main/features/miniplayer.js); none left for Phase 11 to add.
4. Renderer posts use the exact source strings from §13.
5. Do NOT touch: `src/`, `package.json`, prior v2 files.

## Report

Note the require-path change, confirm the mini_update payload matches old pollPlayback output. Await human approval, then commit `feat(v2): miniplayer`.
