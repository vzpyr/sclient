# 00 — SClient Refactor: Master Overview

> **STATUS: REFACTOR COMPLETE.** Phases 01–12 are done. The v2 tree was collapsed into `src/` (Phase 12): code now lives directly at `src/main/`, `src/renderer/`, `src/miniplayer/`, `src/preload.js`, `src/api/`. All historical `src/v2` references below describe the build process and are kept for context — mentally map `src/v2/<path>` → `src/<path>` when reading the architecture sections.

> **READ THIS FILE FIRST. ALWAYS.** Every phase doc assumes you have read this file in full.
> If a phase doc contradicts this file, this file wins. If something is unclear, ask — do not improvise.

---

## 1. What This Project Is

SClient is an Electron desktop wrapper for SoundCloud (cross-platform: Windows/Linux/macOS). It loads `soundcloud.com` in a Chromium window and injects custom JS/CSS to add features: custom accent colors, downloader (via `youtube-dl-exec`), synced lyrics, audio effects, true shuffle, Last.fm/ListenBrainz scrobbling, Discord Rich Presence, MPRIS integration, a miniplayer window, a playlist manager, listening stats, a settings overlay, a custom right-click menu, ad blocking, proxy region-bypass, and UI polish.

Stack: Electron (castlabs build, v43), plain JavaScript (CommonJS in main, plain script files in renderer), `electron-builder` for packaging, no bundler, no framework, no TypeScript.

**The app currently works.** The refactor must not regress behavior. Work happens in `src/v2/` alongside the working old code; the old tree keeps running until the final phase flips the switch.

---

## 2. The Electron 3-World Model (MANDATORY READING)

Electron runs three separate "worlds" that cannot directly access each other:

```
┌─────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (src/main/*)                                 │
│  • Full Node.js: require(), fs, OS APIs, npm packages       │
│  • Creates windows, handles downloads, SQLite, keytar       │
│  • CANNOT see the web page DOM                              │
└──────────────────┬──────────────────────────────────────────┘
                   │  IPC  (ipcMain.handle / ipcMain.on ↔ ipcRenderer.invoke / send)
┌──────────────────┴──────────────────────────────────────────┐
│  PRELOAD  (src/preload.js)                                  │
│  • Runs in the renderer but HAS Node.js access              │
│  • The bridge: forwards messages both ways                  │
└──────────────────┬──────────────────────────────────────────┘
                   │  window.postMessage / executeJavaScript
┌──────────────────┴──────────────────────────────────────────┐
│  RENDERER / INJECTED  (src/injected/* → src/v2/renderer/*)  │
│  • Runs INSIDE SoundCloud's web page                        │
│  • Can read/modify the DOM (HTML elements, <audio>)         │
│  • NO require(), NO npm packages, NO filesystem             │
│  • Talks to main ONLY via window.postMessage → preload      │
└─────────────────────────────────────────────────────────────┘
```

- **DOM** = the HTML tree of the page. `document.querySelector(".playControl")` navigates it.
- **IPC** = Inter-Process Communication: named messages between worlds.
- **Preload** = the translator. Injected code posts `{source:"sclient-bridge", cmd, args, callbackId}`; preload forwards to `ipcRenderer.invoke(cmd, args)`; the reply comes back as `sclient-bridge-reply`. This is `sendBridge()`.

### Hard constraints (non-negotiable, not a style choice)

1. **Renderer code cannot `require()` anything.** No npm packages. `youtube-dl-exec`, `better-sqlite3`, `keytar`, `mpris-service`, `@xhayper/discord-rpc` can ONLY run in main.
2. **Main cannot read the DOM.** It only knows what the renderer tells it over IPC.
3. **The renderer is the single source of truth for player state** (title, artist, position, duration, playing). Main features are *told* by renderer features via IPC.

---

## 3. Refactor Strategy

- Build the new tree at **`src/v2/`** with identical structure to the target (Section 5). The old `src/` stays untouched and keeps running until Phase 11.
- Phase 11 rewires `package.json` + creates the new `main/index.js` + new `preload.js`, and deletes nothing yet. Phase 12 collapses `src/v2` → `src` and deletes the old tree, after end-to-end QA.
- **Why `src/v2` and not in-place?** Zero-context agents (and you) can't accidentally break the working app. You can diff old vs new at any time. The old tree is the reference implementation and the safety net.
- Each phase is implemented in a fresh AI session by reading this file + that phase's doc + the old source files listed in the phase doc.

### Workflow (per phase)

```
1. Read docs/00-overview.md
2. Read docs/<NN>-<phase>.md
3. Read the old source files listed under "Old code to study" in the phase doc
4. Implement ONLY the files listed under "Files to create/modify"
5. Run the verification checklist
6. Report what was done + any deviations
7. (You approve, then start the next phase in a new session)
```

Commit convention: `feat(v2): <phase name>` — one commit per phase, only after approval.

**Chicken-egg answer:** There is none. Phase 1 creates every contract (utils, bridge, config wrapper, Feature base class, core feature manager) that later phases rely on. Later phases only ever depend on: (a) this file, (b) their phase doc, (c) files created in earlier phases, (d) the OLD tree for logic reference. No phase depends on a later phase. Phases must run in order 1→12; the only soft ordering rule beyond that is that `10-settings` runs after all feature phases (3–9) so every feature's settings metadata exists.

---

## 4. Current Codebase Map (OLD — reference only)

```
src/
├── main/                     # Main process
│   ├── index.js              # Window, splash, tray, injection, protocol, single-instance, partitions
│   ├── ipc.js                # ALL IPC handlers (download, lastfm, listenbrainz, stats, playlist, accounts, clipboard, romanize, config save)
│   ├── config.js             # Config store + keytar (GOOD, keep as-is)
│   ├── stats.js              # SQLite stats DB logic (moves into feature)
│   ├── romanize.js           # Romanization utility (keep as utility)
│   ├── discord-rpc.js        # Discord RPC client (moves into feature)
│   ├── mpris.js              # MPRIS service (moves into feature)
│   ├── mini.js / mini.html   # Miniplayer window (moves to miniplayer/)
├── preload.js                # Bridge: IPC relay, UA spoof, proxy interception, titlebar, ready flags
├── injected/                 # Renderer code (concatenated + injected via executeJavaScript)
│   ├── core.js               # ~950 lines GOD FILE: utils, bridge, observer, styles, features all mixed
│   ├── init.js               # menu button, nav buttons/icons, applyFeatureStyles, observer
│   ├── settings.js           # ~1700 lines: settings overlay, editors, accounts, all toggles hardcoded
│   ├── accent.js, adblock.js, shuffle.js, rpc-bridge.js, downloader.js,
│   ├── lyrics.js, scrobbler.js, stats.js, contextmenu.js, effects.js
│   └── pm/                   # playlist manager: api.js, state.js, ui.js, spotify.js
└── api/index.js              # Vercel serverless proxy (UNTOUCHED — deployed separately)
```

### Problems being fixed

1. **God files:** `core.js` (~950 lines) and `settings.js` (~1700 lines) do the work of 10+ files.
2. **Global soup:** ~25 bare globals (`lazyScrollOn`, `customAccentOn`, `accentColor`, ...) read from `window.__SCLIENT_CONFIG__` with 3 different access patterns.
3. **No lifecycle:** features self-initialize inconsistently (some at bottom of file, some from init.js). No enable/disable/cleanup.
4. **Duplication:** `extractClientId`/`extractOAuthToken` copy-pasted in 4 files; download-toast HTML duplicated; `injectStyle` re-implemented mentally everywhere.
5. **Prefix chaos:** `--sc-`, `--sclient-`, `.sc-`, `.sclient-`, `#sclient-` mixed. Our own classes (`.sc-btn`) collide conceptually with SoundCloud's (`.sc-button`).
6. **Boundary violation:** features read SoundCloud player DOM directly (`.playbackSoundBadge__titleLink`, `navigator.mediaSession`) instead of going through one bridge.
7. **Hardcoded settings:** 30+ toggles hand-written in settings.js instead of data-driven from feature metadata.

---

## 5. Target Architecture (NEW — build this)

```
src/v2/
├── main/
│   ├── index.js                  # [11] window, splash, tray, injection order, protocol, partitions
│   ├── config.js                 # [1] copy of old src/main/config.js UNCHANGED
│   ├── romanize.js               # [6] copy of old src/main/romanize.js UNCHANGED
│   ├── ipc.js                    # [6] CORE IPC only: window ctrl, clipboard, accounts, config get/save (generic), romanize, get-proxy/get-ui-config
│   └── features/
│       ├── downloader.js         # [6] youtube-dl-exec + download_song handler
│       ├── discord-rpc.js        # [6] RPC client + update_rpc handler
│       ├── mpris.js              # [6] MPRIS service + mpris_update handler
│       ├── lastfm.js             # [7] lastfm API + lastfm_* handlers
│       ├── listenbrainz.js       # [7] listenbrainz API + submit handler
│       ├── stats.js              # [7] SQLite DB logic + stats_* handlers
│       ├── playlist-manager.js   # [8] playlist file dialogs
│       └── miniplayer.js         # [9] miniplayer window management
├── preload.js                    # [11] port of old preload, minus inline titlebar CSS (now styles/titlebar.css)
├── renderer/
│   ├── bridge.js                 # [1] THE SoundCloud player interface (see Section 8)
│   ├── utils.js                  # [1] shared helpers (see Section 9)
│   ├── config.js                 # [1] SCLIENT_CONFIG wrapper (see Section 7)
│   ├── core.js                   # [1] feature manager: FEATURES registry, init, observer, custom css/js, F5 handler
│   ├── styles/
│   │   ├── base.css              # [2] design system vars, scrollbar, buttons, modals, light theme
│   │   ├── titlebar.css          # [2] custom titlebar styles (from old preload inline CSS)
│   │   ├── layout.css            # [2] static SC layout fixes (player bar width, gallery fixes)
│   │   └── features.css          # [2] floating buttons, download toast
│   └── features/
│       ├── Feature.js            # [1] base class (see Section 10)
│       ├── hides.js              # [3] hide upsell + hide artists
│       ├── lazy-scroll.js        # [3]
│       ├── wide-layout.js        # [3]
│       ├── collapsible-sidebar.js# [3]
│       ├── enhanced-header.js    # [3] nav icons, back/fwd buttons, header reorder
│       ├── accent.js             # [3] custom accent color (stylesheet scanning)
│       ├── adblock.js            # [3] fetch/XHR interception
│       ├── artwork-viewer.js     # [3] click player avatar → fullscreen image + copy/save
│       ├── context-menu.js       # [4]
│       ├── shuffle.js            # [4]
│       ├── effects.js            # [4]
│       ├── lyrics.js             # [5]
│       ├── downloader.js         # [6] (pairs with main/features/downloader.js)
│       ├── discord-rpc.js        # [6] (pairs with main/features/discord-rpc.js)
│       ├── mpris.js              # [6] (pairs with main/features/mpris.js)
│       ├── lastfm.js             # [7] (pairs with main/features/lastfm.js)
│       ├── listenbrainz.js       # [7] (pairs with main/features/listenbrainz.js)
│       ├── stats.js              # [7] (pairs with main/features/stats.js)
│       ├── playlist-manager/
│       │   ├── index.js          # [8] PM feature class + UI (from pm/ui.js)
│       │   ├── api.js            # [8] SC API client (from pm/api.js)
│       │   ├── state.js          # [8] PM state (from pm/state.js)
│       │   └── spotify.js        # [8] Spotify CSV import (from pm/spotify.js)
│       ├── miniplayer.js         # [9] (pairs with main/features/miniplayer.js)
│       └── settings.js           # [10] data-driven settings overlay
├── miniplayer/
│   ├── index.html                # [9] from old mini.html
│   └── index.js                  # [9] from old mini.js (fix romanize require path)
└── (no api/ — old src/api stays untouched)
```

`[N]` = phase number that creates the file. Files without `[N]` markers in the tree above are created by the phase listed in their line.

**NOT TOUCHED, EVER:** `src/api/`, `dist/`, `node_modules/`, `venv/`, `.github/`, `afterSign.js`, `.npmrc`, `package-lock.json` (only package.json `main` field changes in Phase 11).

---

## 6. Global Rules (violating these = failed phase)

1. **Renderer files: NO `import`/`export`, NO `require()`, NO ES modules.** They are plain scripts concatenated in the documented order (Section 11) and executed inside SoundCloud's page. Cross-file access is via shared globals defined earlier in the concatenation.
2. **Main files: normal CommonJS `require()`/`module.exports`.**
3. **Allowed shared globals in renderer (exactly three):**
   - `SCLIENT_CONFIG` — config wrapper (renderer/config.js)
   - `FEATURES` — array of feature instances (renderer/core.js)
   - `window.__scMedia` — array of media elements; initialized in bridge.js; written ONLY by the effects feature's `HTMLMediaElement.prototype.play` hook; read via `bridge.getActiveMedia()`.
   Everything else must be function/class scoped or module-scoped (top-level of its own file, which is fine because of the concatenation order).
4. **No feature may call another feature's functions.** Shared logic goes in `utils.js` or `bridge.js`. The only exception: `settings.js` reads `FEATURES` (registry) — that's the manager, not a feature-to-feature call.
5. **Only `bridge.js` touches SoundCloud's player DOM** (player bar selectors, `<audio>`/`<video>`, `navigator.mediaSession`, media playback controls). Features that need player state/control call bridge functions. Features MAY touch DOM for their own injected UI (buttons, sidebars, overlays) — that's their job.
6. **Every DOM element a feature creates gets an `sclient-` prefixed ID** and must be removable in `destroy()` (track via `this.addStyle()` / `this.on()` / cleanup array).
7. **No global `setInterval`/`setTimeout` for recurring work** without storing the handle in the feature (so `destroy()` can clear it).
8. **CSS/class naming:** everything SClient owns gets the `sclient-` prefix (see Section 12 for the rename map). SoundCloud's own classes are never renamed (`.sc-button`, `.header__*`, `.playbackSoundBadge__*`, `.theme-dark`, ...). When reusing SC's utility classes for SC-native look (`.sc-button-secondary`, `.sc-mr-1x`, `.sc-background-darkgrey`, `.sc-artwork`) that is intentional — those are SoundCloud's, keep them.
9. **Do not "improve" or refactor logic beyond what the phase doc says.** Port faithfully. Behavior parity is the goal. You may fix bugs only if they are obvious (e.g., a typo that clearly breaks the port) — note every such fix in your report.
10. **Keep existing IPC channel names and postMessage source strings exactly** (see Section 13). Renaming channels breaks the preload bridge contract.
11. **Config booleans are stored as strings** `"true"`/`"false"` in main config (old convention). The renderer payload (`buildConfigPayload`) converts them to real booleans. Preserve this in both directions.
12. **`node --check <file>` must pass for every new JS file** (main AND renderer — it's a pure syntax check and works even with undefined globals).
13. **Do not touch files outside the phase's listed scope.** In particular: never modify old `src/`, `package.json` (until Phase 11), or anything in Section 5's "NOT TOUCHED" list.
14. **NO COMMENTS in code. Zero.** No banner/header blocks, no section separators, no inline explanations of what the code obviously does, no "ported from..." notes. The ONLY exceptions (exactly these):
    - one-line comment in `features/adblock.js` and `features/shuffle.js` noting their fetch/XHR interception is permanent and cannot be unpatched (safety-relevant);
    - one-line attribution at the top of files that are byte-for-byte copies (`// copy of src/main/config.js`).
    Everything else ships comment-free. A comment that merely restates code = failed phase. This applies to ALL code, including the Phase 1 contract files.

---

## 7. Renderer Config Wrapper (`renderer/config.js`)

Old code accessed config 3 ways (`window.__SCLIENT_CONFIG__`, `cfg.x`, global copies). New code: exactly ONE wrapper, `SCLIENT_CONFIG`, defined in `renderer/config.js`. The raw injected object `window.__SCLIENT_CONFIG__` appears in EXACTLY two places in the whole codebase: where main injects it (Phase 11 `main/index.js`) and where `renderer/config.js` reads it.

```javascript
// renderer/config.js — full file
const SCLIENT_CONFIG = {
  _data: (typeof window.__SCLIENT_CONFIG__ !== "undefined" && window.__SCLIENT_CONFIG__) || {},

  get(key, fallback = "") {
    const v = this._data[key];
    return v !== undefined && v !== null ? v : fallback;
  },
};
```

Add exactly one getter per row of the payload table below (snake_case key → camelCase getter), e.g. `get customCss() { return this.get("css", ""); }` and `get showDownloader() { return this.get("show_downloader", false); }`. No comments.

The payload schema (what `buildConfigPayload` sends — keep key names EXACTLY):

| payload key | type | camelCase getter |
|---|---|---|
| css | string | customCss |
| js | string | customJs |
| lazy_scroll | bool | lazyScroll |
| titlebar_style | string | titlebarStyle |
| custom_accent | bool | customAccent |
| accent_color | string | accentColor |
| custom_font | bool | customFont |
| custom_font_family | string | customFontFamily |
| wide_layout | bool | wideLayout |
| wide_layout_width | string | wideLayoutWidth |
| custom_bg_color | bool | customBgColor |
| bg_color | string | bgColor |
| adblock | bool | adblock |
| discord_rpc | bool | discordRpc |
| tray_icon | bool | trayIcon |
| hide_upsell | bool | hideUpsell |
| hide_artists | bool | hideArtists |
| show_lyrics | bool | showLyrics |
| show_miniplayer | bool | showMiniplayer |
| show_downloader | bool | showDownloader |
| show_effects | bool | showEffects |
| show_visualizer | bool | showVisualizer |
| true_shuffle | bool | trueShuffle |
| true_shuffle_mode | string | trueShuffleMode |
| region_bypass | bool | regionBypass |
| proxy_url | string | proxyUrl |
| enhanced_header | bool | enhancedHeader |
| collapsible_sidebar | bool | collapsibleSidebar |
| listenbrainz | bool | listenbrainzEnabled |
| listenbrainz_token | string | listenbrainzToken |
| lastfm | bool | lastfmEnabled |
| lastfm_api_key | string | lastfmApiKey |
| lastfm_secret | string | lastfmSecret |
| lastfm_session_key | string | lastfmSessionKey |
| lastfm_username | string | lastfmUsername |
| load_last_page | bool | loadLastPage |
| mpris | bool | mpris |
| stats_api_sync | bool | statsApiSync |
| stats_local_tracking | bool | statsLocalTracking |

Booleans in the payload are REAL booleans (main converts them). Strings like `accent_color` may be empty.

---

## 8. Bridge (`renderer/bridge.js`) — the ONLY SoundCloud player interface

Source of truth: old `src/injected/core.js` lines 313–595 (functions to port verbatim) + `seekTo` from old `src/injected/lyrics.js` + merged OAuth extraction from `pm/api.js`/`stats.js`/`downloader.js`.

```javascript
// API surface (all defined in this file, in this order):
sendBridge(cmd, args = {})            // verbatim from core.js:319 (300s timeout, callbackId pattern)
getArtistFromTrack(track)             // verbatim from core.js:351
extractClientId()                     // verbatim from core.js:364 (performance resource entries)
extractOAuthToken()                   // merged: cookie 'oauth_token' startsWith '2-', then localStorage, then sessionStorage
fetchTrackData(songUrl)               // verbatim from core.js:399-ish (with trackCache Map)
onPlaybackChange(cb)                  // verbatim from core.js:411 + pollPlayback (2000ms interval, PLAYBACK_SEL '.playbackSoundBadge__titleLink',
                                      //   isPlaying from navigator.mediaSession.playbackState, position/duration via parseTime from
                                      //   '.playbackTimeline__timePassed' / '.playbackTimeline__duration', event {type:'track_start'|'tick'|'none', songUrl, trackData, isPlaying, timestamp, position, duration})
                                      //   RETURNS an unsubscribe function: removes the listener; the 2s poll timer stops when the LAST
                                      //   listener unsubscribes. Features must store the return value and call it in destroy().
getCurrentTrack()                     // NEW: returns { songUrl, trackData } from current state (for on-demand reads, e.g. downloader button)
seekTo(seconds)                       // verbatim from lyrics.js: dispatches mousedown/mouseup on '.playbackTimeline__progressWrapper'
playerCommand(action, value)          // NEW: all playback control DOM logic in ONE place (see below)
getActiveMedia()                      // returns (window.__scMedia || []).find(m => m.duration > 0) — media find helper
initBridge()                          // sets window.__scMedia = window.__scMedia || [] (idempotent)
```

**`playerCommand(action, value)`** consolidates ALL of the DOM control logic currently in:
- old core.js "sclient-mini-action" message handler (playpause/next/prev/shuffle/loop/like + seek via `media.currentTime`)
- old core.js "sclient-mpris-command" message handler (play/pause/playpause/stop/next/previous + seek + setPosition + volume, including the volume slider DOM sync: `.volume` data-level, `.volume__sliderWrapper` aria-valuenow, `.volume__sliderProgress` height, `.volume__sliderHandle` top)

It maps each action to the same button clicks (`document.querySelector(".playControl")?.click()` etc.) and returns nothing. Both the miniplayer feature and the mpris feature call `bridge.playerCommand(...)`.

**IMPORTANT:** the old `pollPlayback` also posted `sclient-mini-update` and `sclient-mpris-update` messages inline. In v2 that is REMOVED from bridge — those posts move to the miniplayer feature (Phase 9) and mpris feature (Phase 6) respectively, which subscribe to `onPlaybackChange` and build their own payloads. Bridge stays pure state.

**Every feature that subscribes via `onPlaybackChange` must keep the returned unsubscribe on `this` and call it in `destroy()`** (pattern: lyrics.js `this.unsubscribePlayback`). Otherwise toggling the feature off/on double-subscribes.

---

## 9. Utils (`renderer/utils.js`)

```javascript
// All verbatim ports unless noted:
injectStyle(id, css)                  // core.js:1  (idempotent, DOMContentLoaded-safe)
injectToIframes(id, css)              // core.js:15 (handles iframe injection + MutationObserver)
showToast(message)                    // core.js:596 (uses sclient-modal-surface class — renamed, see Section 12)
showConfirm(message, options)         // core.js:619 (uses sclient-modal-backdrop/surface, sclient-btn classes — renamed)
esc(str)                              // lyrics.js (HTML escape for & < > ")
getAccent()                           // core.js:313 → NEW impl: SCLIENT_CONFIG.customAccent ? SCLIENT_CONFIG.accentColor : "#f50"
```

That's the entire file (~150 lines). If you feel the need to add more, stop and ask — that's a signal something belongs in bridge.js or a feature.

---

## 10. Feature Base Class (`renderer/features/Feature.js`) — full source

```javascript
class Feature {
  get featureKey() { return null; }
  get settingsCategory() { return null; }
  get settingsLabel() { return null; }
  get settingsDescription() { return ""; }
  get hasToggle() { return true; }
  get settingsFields() { return []; }
  settingsCustom() { return ""; }
  settingsInit(overlay) {}

  constructor() {
    this.enabled = false;
    this.injected = false;
    this.cleanup = [];
  }

  isEnabled() {
    return this.featureKey == null ? true : !!SCLIENT_CONFIG.get(this.featureKey.replace(/^features\./, ""), false);
  }

  init() { if (this.enabled) return; this.enabled = true; }
  destroy() {
    this.enabled = false;
    this.injected = false;
    this.cleanup.forEach((fn) => { try { fn(); } catch (e) {} });
    this.cleanup = [];
  }
  injectUI() {}

  on(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    this.cleanup.push(() => target.removeEventListener(event, handler, opts));
  }
  addStyle(id, css) {
    injectStyle(id, css);
    this.cleanup.push(() => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}
```

Rules for feature files:
- One class per file. Instantiate at the bottom: `const DOWNLOADER_FEATURE = new DownloaderFeature();` (global const, part of the concatenation — this IS the registration).
- `featureKey` is the STORAGE dot-path (`features.show_lyrics`, §15). `isEnabled()` strips the `features.` prefix and looks up the FLAT payload key (`show_lyrics`, §7). Keep the key name aligned with §15 — never return a bare payload key.
- `init()` = subscribe to bridge events, inject always-on styles, set up anything that must exist even before DOM targets appear.
- `injectUI()` = create buttons/sidebars/overlays that depend on SoundCloud DOM nodes appearing. The manager's MutationObserver calls it (debounced) once per feature. **Retry contract:** if the feature's anchor element wasn't found yet, the feature may set `this.injected = false` before returning; the manager will re-invoke `injectUI()` on the next DOM mutation. Otherwise `injected` stays true after the first call.
- `destroy()` = default handles cleanup; override only for extra teardown (call `super.destroy()`). If `init()` subscribed via `onPlaybackChange`, store the returned unsubscribe on `this` and call it here (pattern: lyrics.js `this.unsubscribePlayback`).
- DOM targeting: every feature that injects UI must guard with `if (document.getElementById("sclient-<x>")) return;` (idempotency) and return early if its anchor selector is missing.

---

## 11. Injection Order (used by Phase 11 `main/index.js`)

On `dom-ready`, main reads and concatenates these files in EXACTLY this order into one `executeJavaScript` call (wrapped in the existing IIFE):

```
JS (executeJavaScript, in order):
  1. node_modules/chart.js/dist/chart.umd.js   (sets global Chart for stats)
  2. renderer/utils.js
  3. renderer/bridge.js
  4. renderer/config.js
  5. renderer/features/Feature.js
  6. renderer/features/hides.js
  7. renderer/features/lazy-scroll.js
  8. renderer/features/wide-layout.js
  9. renderer/features/collapsible-sidebar.js
  10. renderer/features/enhanced-header.js
  11. renderer/features/accent.js
  12. renderer/features/adblock.js
  13. renderer/features/artwork-viewer.js
  14. renderer/features/context-menu.js
  15. renderer/features/shuffle.js
  16. renderer/features/effects.js
  17. renderer/features/lyrics.js
  18. renderer/features/downloader.js
  19. renderer/features/discord-rpc.js
  20. renderer/features/mpris.js
  21. renderer/features/lastfm.js
  22. renderer/features/listenbrainz.js
  23. renderer/features/stats.js
  24. renderer/features/playlist-manager/api.js
  25. renderer/features/playlist-manager/state.js
  26. renderer/features/playlist-manager/spotify.js
  27. renderer/features/playlist-manager/index.js
  28. renderer/features/miniplayer.js
  29. renderer/features/settings.js
  30. renderer/core.js                        (manager: reads FEATURES, inits, starts observer, injects custom css/js)

CSS (insertCSS, in order): styles/base.css, styles/titlebar.css, styles/layout.css, styles/features.css
```

Also in main/index.js dom-ready: `window.__SCLIENT_CONFIG__ = <buildConfigPayload()>` is set BEFORE the JS bundle executes (as in the old code).

---

## 12. CSS Naming Convention + Rename Map

**Rule: everything SClient owns gets `sclient-`. SoundCloud's classes stay as-is.**

Renames (apply to ALL new files; old files keep old names until deleted):

| OLD (ours) | NEW |
|---|---|
| `--sc-accent` | `--sclient-accent` |
| `--sc-bg-surface` | `--sclient-bg-surface` |
| `--sc-bg-overlay` | `--sclient-bg-overlay` |
| `--sc-bg-elevated` | `--sclient-bg-elevated` |
| `--sc-text-main` | `--sclient-text-main` |
| `--sc-text-muted` | `--sclient-text-muted` |
| `--sc-border` | `--sclient-border` |
| `--sc-border-hover` | `--sclient-border-hover` |
| `--sc-btn-bg` | `--sclient-btn-bg` |
| `--sc-btn-bg-hover` | `--sclient-btn-bg-hover` |
| `--sc-danger` | `--sclient-danger` |
| `--sc-font-sans` | `--sclient-font-sans` |
| `--sc-text-xs/sm/base/lg/xl/xxl` | `--sclient-text-xs/...` |
| `--sc-radius-sm/md/lg/xl` | `--sclient-radius-sm/...` |
| `.sc-btn` | `.sclient-btn` |
| `.sc-btn-primary` | `.sclient-btn-primary` |
| `.sc-btn-danger` | `.sclient-btn-danger` |
| `.sc-btn-ghost` | `.sclient-btn-ghost` |
| `.sc-text-h1/h2/body/sub` | `.sclient-text-h1/...` |
| `.sc-modal-backdrop` | `.sclient-modal-backdrop` |
| `.sc-modal-surface` | `.sclient-modal-surface` |
| `.sc-card` | `.sclient-card` |

KEEP as-is: `#sclient-*` IDs, `.sclient-floating-btn`, `.sclient-download-toast`, `.sclient-lyric-line`, `.sclient-lyric-word`, `.sclient-input`, `.sclient-sidebar-open`, `.sclient-svg-container`. Keep SoundCloud's classes we intentionally reuse: `.sc-button*`, `.sc-mr-1x`, `.sc-background-darkgrey`, `.sc-artwork`, and all SC structural selectors (`.header__*`, `.playbackSoundBadge__*`, `.playbackTimeline__*`, `.skipControl__*`, `.playControl`, `.shuffleControl`, `.repeatControl`, `.volume__*`, `.queue__*`, `.l-container`, `.l-main`, `.l-sidebar-right`, `.theme-dark`, `.theme-light`).

Design system (`styles/base.css`) root block: all `--sclient-*` vars with the same default values as old core.js (`scDesignSystem`), including the `body.theme-light` override block.

---

## 13. IPC Channel Names + postMessage Sources (KEEP EXACT)

**postMessage sources (renderer ↔ preload):** `sclient-bridge`, `sclient-bridge-reply`, `sclient-bridge-event`, `sclient-mini-update`, `sclient-mini-visualizer`, `sclient-mini-time`, `sclient-mini-toggle`, `sclient-mpris-update`, `sclient-mini-action`, `sclient-mpris-command`.

**IPC channels (renderer → main via sendBridge / ipcRenderer):**

| Channel | Owner (main) |
|---|---|
| `get-proxy-config`, `get-ui-config` (sendSync) | ipc.js core |
| `clipboard_readText`, `clipboard_writeText` | ipc.js core |
| `webcontents_paste/copy/cut/selectAll` | ipc.js core |
| `get_custom_files`, `save_custom_files` | ipc.js core |
| `get_active_account`, `set_active_account`, `get_accounts`, `create_account`, `delete_account` | ipc.js core |
| `restart_app`, `clear_data`, `clear_data_and_restart` | ipc.js core |
| `romanize` | ipc.js core |
| `download_song` (+ push `download_progress`) | features/downloader.js |
| `update_rpc` | features/discord-rpc.js |
| `mpris_update` (renderer→main), `mpris_command` (main→renderer) | features/mpris.js |
| `lastfm_authenticate`, `lastfm_save_credentials`, `lastfm_disconnect`, `lastfm_now_playing`, `lastfm_scrobble` | features/lastfm.js |
| `submit_listenbrainz` | features/listenbrainz.js |
| `stats_store_credentials`, `stats_record_listen`, `stats_get_data`, `stats_wipe_db`, `stats_export_db`, `stats_pick_import_file`, `stats_execute_import` | features/stats.js |
| `playlist_save_file`, `playlist_pick_import_file` | features/playlist-manager.js |
| `toggle_miniplayer`, `mini_close`, `mini_minimize`, `mini_fullscreen`, `mini_action`, `mini_update`, `mini_visualizer`, `mini_time`, `resize_mini` | features/miniplayer.js |
| `window_minimize`, `window_maximize`, `window_close` | ipc.js core |

---

## 14. Master Mapping: old file → new home

| Old | New | Phase |
|---|---|---|
| `main/index.js` | `v2/main/index.js` (window/splash/tray/injection/protocol/partitions) | 11 |
| `main/config.js` | `v2/main/config.js` (copy unchanged) | 1 |
| `main/romanize.js` | `v2/main/romanize.js` (copy unchanged) | 6 |
| `main/ipc.js` — window/clipboard/accounts/config/romanize/proxy/ui | `v2/main/ipc.js` | 6 |
| `main/ipc.js` — `download_song` | `v2/main/features/downloader.js` | 6 |
| `main/ipc.js` — `update_rpc` | `v2/main/features/discord-rpc.js` | 6 |
| `main/ipc.js` — lastfm_* | `v2/main/features/lastfm.js` | 7 |
| `main/ipc.js` — `submit_listenbrainz` | `v2/main/features/listenbrainz.js` | 7 |
| `main/ipc.js` — stats_* | `v2/main/features/stats.js` | 7 |
| `main/ipc.js` — playlist_* | `v2/main/features/playlist-manager.js` | 8 |
| `main/stats.js` | merged into `v2/main/features/stats.js` | 7 |
| `main/discord-rpc.js` | merged into `v2/main/features/discord-rpc.js` | 6 |
| `main/mpris.js` | merged into `v2/main/features/mpris.js` | 6 |
| `main/mini.js`, `mini.html` | `v2/miniplayer/index.js`, `v2/miniplayer/index.html` | 9 |
| `preload.js` | `v2/preload.js` (titlebar CSS moves to styles/titlebar.css) | 11 |
| `injected/core.js` — utils + showToast/showConfirm/getAccent | `v2/renderer/utils.js` | 1 |
| `injected/core.js` — bridge (sendBridge, onPlaybackChange, extractClientId, getArtistFromTrack, fetchTrackData) | `v2/renderer/bridge.js` | 1 |
| `injected/core.js` — mini/mpris message handlers, injectMiniplayerButton, sendLiveTime | miniplayer.js / mpris.js features | 6/9 |
| `injected/core.js` — design system, scrollbar, light theme CSS | `v2/renderer/styles/base.css` | 2 |
| `injected/core.js` — layout fixes, player fix | `v2/renderer/styles/layout.css` | 2 |
| `injected/core.js` — floating button styles, download toast | `v2/renderer/styles/features.css` | 2 |
| `injected/core.js` — wide layout | `features/wide-layout.js` | 3 |
| `injected/core.js` — collapsible sidebar | `features/collapsible-sidebar.js` | 3 |
| `injected/core.js` — lazy scroll | `features/lazy-scroll.js` | 3 |
| `injected/core.js` — avatar artwork viewer (unlabeled!) | `features/artwork-viewer.js` | 3 |
| `injected/core.js` — F5/Ctrl+R handler | `v2/renderer/core.js` (verbatim) | 1 |
| `injected/core.js` — custom css/js injection | `v2/renderer/core.js` | 1 |
| `injected/init.js` — injectMenuButton | `features/settings.js` | 10 |
| `injected/init.js` — sidebar toggle | `features/collapsible-sidebar.js` | 3 |
| `injected/init.js` — nav icons/back-fwd | `features/enhanced-header.js` | 3 |
| `injected/init.js` — applyFeatureStyles + observer | distributed to features / `core.js` | 1+ |
| `injected/accent.js` | `features/accent.js` | 3 |
| `injected/adblock.js` | `features/adblock.js` | 3 |
| `injected/shuffle.js` | `features/shuffle.js` | 4 |
| `injected/contextmenu.js` | `features/context-menu.js` | 4 |
| `injected/effects.js` | `features/effects.js` | 4 |
| `injected/lyrics.js` | `features/lyrics.js` | 5 |
| `injected/rpc-bridge.js` | `features/discord-rpc.js` | 6 |
| `injected/downloader.js` | `features/downloader.js` | 6 |
| `injected/scrobbler.js` | `features/lastfm.js` + `features/listenbrainz.js` | 7 |
| `injected/stats.js` | `features/stats.js` | 7 |
| `injected/pm/api.js` | `features/playlist-manager/api.js` | 8 |
| `injected/pm/state.js` | `features/playlist-manager/state.js` | 8 |
| `injected/pm/ui.js` | `features/playlist-manager/index.js` | 8 |
| `injected/pm/spotify.js` | `features/playlist-manager/spotify.js` | 8 |
| `injected/settings.js` | `features/settings.js` (data-driven rewrite) | 10 |
| `api/index.js` | untouched | — |

---

## 15. Config Storage Keys (for settings + generic save)

Convention: dot-paths in a JSON file (`config.json` in userData/SClient); booleans as strings `"true"`/`"false"`; secure values in OS keychain via keytar. Secure keys (SECURE_KEYS): `integrations.listenbrainz.token`, `integrations.lastfm.api_key`, `integrations.lastfm.secret`, `integrations.lastfm.session_key`.

| Key | Type | Settings field |
|---|---|---|
| `features.titlebar_style` | 'custom'\|'native'\|'none' | select (General section) |
| `features.tray_icon` | bool | toggle (General) |
| `features.load_last_page` | bool | toggle (General) |
| `features.custom_accent` | bool | toggle (appearance) + color field `features.accent_color` |
| `features.custom_font` | bool | toggle + text `features.custom_font_family` |
| `features.custom_bg_color` | bool | toggle + color `features.bg_color` |
| `features.wide_layout` | bool | toggle + text `features.wide_layout_width` |
| `features.enhanced_header` | bool | toggle |
| `features.collapsible_sidebar` | bool | toggle |
| `features.lazy_scroll` | bool | toggle |
| `features.adblock` | bool | toggle (SPECIAL: also toggles ElectronBlocker in main) |
| `features.hide_upsell` | bool | toggle |
| `features.hide_artists` | bool | toggle |
| `features.show_lyrics` | bool | toggle |
| `features.show_miniplayer` | bool | toggle |
| `features.show_downloader` | bool | toggle |
| `features.show_effects` | bool | toggle |
| `features.show_visualizer` | bool | toggle |
| `features.true_shuffle` | bool | toggle + select `features.true_shuffle_mode` ('native'\|'api') |
| `features.region_bypass` | bool | toggle + text `features.proxy_url` |
| `features.discord_rpc` | bool | toggle |
| `features.mpris` | bool | toggle |
| `integrations.listenbrainz.enabled` | bool | toggle + secure token |
| `integrations.lastfm.enabled` | bool | toggle + secure api_key, secret + auth flow |
| `stats.api_sync` | bool | toggle (stats section) |
| `stats.local_tracking` | bool | toggle (stats section) |
| `accounts.active` | string | account management (core) |
| `last_page_url` | string | written by main on close, not in settings |
| files: `custom.css`, `custom.js` | file | CSS/JS editors (settings) |

---

## 16. Decisions Log (why things are the way they are)

- **No bundler.** Files are read+concatenated by main (existing pattern). Adding esbuild would add a build step for no benefit at this scale. Keep raw files, structured as if a bundler existed.
- **No IIFE wrappers in individual files.** The old code wraps everything in ONE IIFE at injection time. Individual renderer files are plain scripts in a documented order.
- **Paired files live in mirrored dirs, not the same dir.** `renderer/features/downloader.js` pairs with `main/features/downloader.js`. Same name, mirrored path. Mixing both worlds in one directory creates confusing require paths in main.
- **`lastfm` and `listenbrainz` are separate features.** Independent services, independent auth, independent toggles. The ~40 lines of shared scrobble logic is duplicated per feature (acceptable; they differ in auth codes, endpoints, status element IDs).
- **`discord-rpc` is the canonical name for both files** (old: renderer `rpc-bridge.js` / main `discord-rpc.js`).
- **`settings.js` is data-driven** — it iterates `FEATURES` and renders toggles/fields from feature metadata. Adding a feature with a toggle = zero changes to settings.js. Only General (titlebar/tray/last-page), CSS/JS editors, accounts, and per-feature custom sections are hand-written.
- **`main/ipc.js` stays one file** (core app plumbing), but feature IPC lives in `main/features/<feature>.js` with a `register({ ipcMain, ... })` export.
- **Titlebar stays in preload** (exception to the rules): it must exist before page render to avoid a flash. Only its CSS moves to `styles/titlebar.css` (injected via `insertCSS` early).
- **Splash screen stays in main/index.js** — it's window creation, not a feature.
- **Renderer has no `index.js`.** `renderer/core.js` IS the renderer entry (manager). The old `init.js` role is absorbed by core.js + feature lifecycle.
