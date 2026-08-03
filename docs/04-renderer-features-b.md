# 04 — Renderer Features B (complex: context-menu, shuffle, effects)

**Prereqs:** `docs/00-overview.md` (sections 6, 8, 9, 10, 12). Phases 01–03 done.

## Goal

Port the three most complex renderer-only features. Same class pattern as Phase 3. These are big ports — be meticulous; behavior parity matters more than prettiness.

## Files to create

### 1. `context-menu.js` — `ContextMenuFeature` (always-on, no toggle)

- Port the ENTIRE old `src/injected/contextmenu.js` (an IIFE). It contains: `findEditable`, `findLink`, `findImageEl`, `imageUrlFrom`, `navigateToUrlModal`, the context menu builder/positioning/dismissal, the `contextmenu` handler, and `injectIntoIframes()` (injects the handler into iframes with `doc.__sclient_cm` marker).
- Convert to a class: `init()` sets up `document.addEventListener("contextmenu", ...)` via `this.on(...)`; iframe injection via a MutationObserver stored on `this` (so `destroy()` can disconnect it).
- Rename classes it creates: `sc-modal-backdrop` → `sclient-modal-backdrop`, `sc-modal-surface` → `sclient-modal-surface`, `sc-text-body` → `sclient-text-body` (see 00-overview §12).
- Keep the iframe-injection MutationObserver pattern verbatim (it's robust).
- `hasToggle` false, `settingsCategory` null.
- Note: old code wrapped everything in an IIFE for privacy — in v2 that's unnecessary (concatenation scope), but keeping an IIFE inside the file is harmless. Prefer plain functions.

### 2. `shuffle.js` — `ShuffleFeature`

- Port old `src/injected/shuffle.js` VERBATIM:
  - `resolveUrl(arg)` helper
  - the `window.fetch` interception (hydrate stub tracks via `tracks?ids=` chunking, 50 per chunk, using `extractClientId()` from bridge)
  - the XHR `open`/`setRequestHeader`/`send` interception (full custom response emulation with defineProperty — keep exactly)
  - `forceLoadQueue()` (queue open, scroll wheel loop, fallback hide, all the waits — keep)
  - the click handler on `.shuffleControl` (only when `trueShuffleMode === 'native'`, `isTrusted` check, showToast, forceLoadQueue, then click)
- `init()` → install the fetch/XHR patches once (guard `if (this.patched) return; this.patched = true;`) + register the click handler via `this.on(document, "click", handler, true)`.
- Gating config: `SCLIENT_CONFIG.trueShuffle` and `SCLIENT_CONFIG.trueShuffleMode` — read at call time inside the handlers (NOT captured at init), because settings reload the page anyway, but be consistent with old behavior (old code used module-scope consts from cfg — equivalent since page reloads on config change).
- featureKey `features.true_shuffle`, category `playback`, settingsFields: select `features.true_shuffle_mode` with options `[{value:'native',label:'Native'},{value:'api',label:'API'}]`.
- **Permanent patch caveat:** like adblock, the fetch/XHR interception cannot be cleanly unpatched. Add exactly one comment line noting it (allowed exception, 00-overview §6 rule 14). `destroy()` only removes the click listener.
- `showToast` now comes from utils.js — remove the old file-local definition if any (old shuffle.js used the global one; there was no local def — verify).

### 3. `effects.js` — `EffectsFeature`

- Port old `src/injected/effects.js` VERBATIM:
  - `injectEffectsButton()` — button `#sclient-effects-btn` + popup `#sclient-effects-popup` (speed slider, preserve-pitch checkbox, reverb checkbox). **Rename** `.sc-background-darkgrey` stays (it's SC's utility class — keep). The popup positioning/toggle/outside-click-close logic verbatim.
  - `setupAudioNodes(ctx)` — convolver + analyser, `window.sclientAnalyser`, the 66ms visualizer interval that posts `{source:"sclient-mini-visualizer"}` — keep the postMessage (preload still relays it; miniplayer feature also reads it in Phase 9). Gate on `SCLIENT_CONFIG.showVisualizer`.
  - `applyEffectsToMedia(el)` — speed/pitch/reverb wiring incl. `sclientSourceNodes` WeakMap and `externalCtx` handling — verbatim.
  - the `HTMLMediaElement.prototype.play` hook + `createMediaElementSource` hook + the 250ms sync interval — these push media elements into `window.__scMedia` (via `bridge.initBridge()`'s array). Keep pushing to `window.__scMedia`.
- Feature state (`window.sclient_effects` object with speed/preservePitch/reverb) — keep as a module-scope object in the file (old code used `window.sclient_effects`; bridge's miniplayer payload in Phase 9 may read it — safest to keep `window.sclient_effects` global, it's an allowed-ish shared global; document it). Actually: keep `window.sclient_effects` for compatibility with old miniplayer payload code (Phase 9 will read it).
- featureKey `features.show_effects`, category `playback`.
- The visualizer posts must respect `SCLIENT_CONFIG.showVisualizer === false` → skip (old check).
- All intervals stored on `this` and cleared in `destroy()` override.

## Verification checklist

1. `node --check` all files.
2. Diff-inventory: every function from old shuffle.js / effects.js / contextmenu.js exists in the new file (use grep to enumerate old `function ` names and compare).
3. No `--sc-` own vars introduced; `sc-background-darkgrey`/`sc-artwork`/SC classes kept as-is.
4. Effects: `window.__scMedia` only written inside effects feature + initialized in bridge; `window.sclient_effects` kept.
5. No cross-feature calls.
6. Do NOT touch: `src/` old tree, main process, other v2 files, `package.json`.

## Report

List the three ports, confirm the single-line permanent-patch comments (the only allowed comments), confirm checklist. Await human approval, then commit `feat(v2): renderer features B`.
