# 01 — Foundation (renderer core + skeleton)

**Prereqs:** read `docs/00-overview.md` fully (sections 2, 6, 7, 8, 9, 10, 11 especially).

## Goal
Create the `src/v2/` skeleton and every contract later phases depend on. After this phase, the v2 renderer has working utils, bridge, config wrapper, Feature base class, and a feature manager — but **nothing is wired into the app yet** (old `src/` still runs; do NOT touch it).

## Files to create

### 1. Directory skeleton (empty dirs are fine)
```
src/v2/main/
src/v2/main/features/
src/v2/renderer/
src/v2/renderer/features/
src/v2/renderer/styles/
src/v2/miniplayer/
```

### 2. `src/v2/main/config.js` — copy of `src/main/config.js` UNCHANGED (byte-for-byte)

### 3. `src/v2/renderer/utils.js`
Port these functions **verbatim** from the old files (rename classes per Section 12 of 00-overview):
- `injectStyle(id, css)` — from `src/injected/core.js` line 1
- `injectToIframes(id, css)` — from `src/injected/core.js` line 15
- `showToast(message)` — from `src/injected/core.js` line 596. **Rename `.sc-modal-surface` → `.sclient-modal-surface`** and `var(--sc-radius-xl)` → `var(--sclient-radius-xl)` in its inline styles.
- `showConfirm(message, options)` — from `src/injected/core.js` line 619. **Rename** `.sc-modal-backdrop` → `.sclient-modal-backdrop`, `.sc-modal-surface` → `.sclient-modal-surface`, `.sc-text-body` → `.sclient-text-body`, `.sc-btn`/`.sc-btn-danger`/`.sc-btn-primary` → `.sclient-btn*`, `var(--sc-text-lg)` → `var(--sclient-text-lg)`.
- `esc(str)` — from `src/injected/lyrics.js` (~line 260): escapes `& < > "`.
- `getAccent()` — NEW implementation: `return SCLIENT_CONFIG.customAccent ? SCLIENT_CONFIG.accentColor : "#f50";`

Note: `getAccent` and `SCLIENT_CONFIG` are not defined yet at this point in concatenation — that's fine, they resolve at call time (utils.js runs before config.js but functions only call them later).

### 4. `src/v2/renderer/bridge.js`
Port from `src/injected/core.js` lines 313–595, exactly as specified in 00-overview Section 8:
- `sendBridge(cmd, args)` — verbatim (core.js:319)
- `getArtistFromTrack(track)` — verbatim (core.js:351)
- `extractClientId()` — verbatim (core.js:364)
- `extractOAuthToken()` — NEW merged version of the three copies (downloader.js `getOAuthToken`, stats.js/pm `extractOAuthToken`): cookie `oauth_token` starting with `2-`, then `localStorage`, then `sessionStorage`.
- `fetchTrackData(songUrl)` + `trackCache` Map — verbatim
- `onPlaybackChange(cb)` + `pollPlayback()` + `parseTime()` + `PLAYBACK_SEL` — verbatim, **but REMOVE the `sclient-mini-update` and `sclient-mpris-update` postMessage blocks from `pollPlayback`** (those move to the miniplayer/mpris features in later phases).
- `getCurrentTrack()` — returns `{ songUrl, trackData }` from current module state (`currentSongUrl` / `currentTrackData`); `null`/`{}` when nothing loaded. Used by downloader (Phase 6) for on-demand reads.
- `seekTo(seconds)` — verbatim from `src/injected/lyrics.js` (mousedown/mouseup on `.playbackTimeline__progressWrapper`).
- `playerCommand(action, value)` — consolidated control logic:
  - From old core.js `sclient-mini-action` handler: `playpause`/`next`/`prev`/`shuffle`/`loop`/`like` click their `.playControl`/`.skipControl__next`/`.skipControl__previous`/`.shuffleControl`/`.repeatControl`/`.playbackSoundBadge__like`; `seek` sets `media.currentTime` on the active media.
  - From old core.js `sclient-mpris-command` handler: `play`/`pause`/`playpause`/`stop` (all click `.playControl`), `next`/`previous` (skip buttons), `seek` (relative `offsetMicros`), `setPosition` (absolute `positionMicros`), `volume` (sets `media.volume` AND syncs `.volume` data-level, `.volume__sliderWrapper` aria-valuenow, `.volume__sliderProgress` height, `.volume__sliderHandle` top — copy verbatim).
  - Normalize: accept both string actions and `{action, value}` objects. The old handlers also called `pollPlayback()` after ~50ms — do the same.
- `getActiveMedia()` — `return (window.__scMedia || []).find((m) => m.duration > 0);`
- `initBridge()` — `window.__scMedia = window.__scMedia || [];` (idempotent)

### 5. `src/v2/renderer/config.js`
`SCLIENT_CONFIG` exactly as 00-overview Section 7. Include EVERY getter from the payload table (all 39 rows). Getter bodies are `this.get('snake_case_key', default)` with the documented defaults.

### 6. `src/v2/renderer/features/Feature.js`
The base class source from 00-overview Section 10, **verbatim** (comment-free — the contract is explained in §10's prose).

### 7. `src/v2/renderer/core.js` — the feature manager (renderer entry)
Write the following structure. The comments below are INSTRUCTIONS to you, not code to ship — ship comment-free (rule 14):
```javascript
const FEATURES = [];

function initFeatures() {
  for (const f of FEATURES) {
    if (f.isEnabled()) f.init();
  }
}

function startObserver() {}

function runCustomJs() {}

// boot sequence
initBridge();
initFeatures();
startObserver();
console.log("[SClient] Successfully injected all modules.");
```
- `startObserver()`: MutationObserver on `document.body` (childList + subtree), 100ms debounce; for every `f` in `FEATURES` where `f.enabled && !f.injected && typeof f.injectUI === "function"`, call `f.injectUI()` then set `f.injected = true`. Same pattern as old core.js/init.js observer, but generic. Retry: a feature that couldn't find its anchor may set `this.injected = false` itself to be re-invoked on the next mutation (contract in 00-overview §10). Start it after `DOMContentLoaded` if `document.readyState === "loading"`, else immediately.
- `runCustomJs()`: user custom JS from `SCLIENT_CONFIG.customJs` — create a `<script>` element with `textContent` and append to body, DOMContentLoaded-safe (same pattern as old core.js `applyFeatureStyles` tail). Call it from the boot sequence too.
- Also in boot: `injectStyle("sclient-custom-css", SCLIENT_CONFIG.customCss)` if non-empty.
- The F5/Ctrl+R keydown handler (preventDefault + reload) from old core.js — port verbatim.
- `FEATURES` starts empty. Later phases append via `FEATURES.push(...)` at the bottom of their feature files.
- `initBridge()` comes from bridge.js.

## Verification checklist
1. `node --check` passes on every new file.
2. `grep -rn "function " src/v2/renderer | grep "^.*function "` — confirm the function inventory matches exactly: utils has 6, bridge has the listed API, core has initFeatures/startObserver/runCustomJs.
3. Grep `window.__SCLIENT_CONFIG__` in `src/v2/renderer/` → must appear ONLY in `config.js`.
4. Grep `--sc-` in `src/v2/renderer/` → must return nothing (all renamed to `--sclient-`).
5. Confirm `src/v2/main/config.js` is identical to `src/main/config.js` (`diff`).
6. Do NOT modify: anything under `src/` (old), `package.json`, `src/api`, `docs/` (other than report), `node_modules`.

## Report
List files created, note any verbatim ports that needed the class renames, and confirm the checklist. Await human approval, then commit `feat(v2): foundation`.
