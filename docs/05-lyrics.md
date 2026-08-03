# 05 — Lyrics Feature

**Prereqs:** `docs/00-overview.md` (sections 6, 8, 10, 13). Phases 01–04 done.

## Goal

Port the lyrics feature (sidebar, synced word-level highlighting, romanize toggle) as `src/v2/renderer/features/lyrics.js`. Renderer-only: it fetches lyrics from `api.lrcmux.dev` directly and calls `sendBridge('romanize', ...)` for romanization (the IPC handler is created in Phase 6 `main/ipc.js` — the renderer just calls it; it will resolve at runtime).

## Old code to study

- `src/injected/lyrics.js` (entire file)

## Key refactors vs old code

1. **Player state via bridge, not direct DOM:**
   - Old `fetchLyrics()` read `currentTrackData` global + `navigator.mediaSession.metadata` → new: use `onPlaybackChange` events (`evt.trackData`, `evt.songUrl`) and/or `bridge.getCurrentTrack()`.
   - Old `seekTo()` (defined in lyrics.js) → DELETED here; use `bridge.seekTo(seconds)` (ported in Phase 1).
2. **Romanize:** old `romanizeAllLines()` called `sendBridge("romanize", { texts })` — same call, now through bridge.js's `sendBridge`. The main-side handler + `main/romanize.js` copy happen in Phase 6.
3. **Design-system renames:** `var(--sc-accent)` → `var(--sclient-accent)`, `var(--sc-text-main)` → `var(--sclient-text-main)`, `var(--sc-text-muted)` → `var(--sclient-text-muted)`, `var(--sc-text-sm/base/lg)` → `var(--sclient-text-*)`, `var(--sc-border)` → `var(--sclient-border)`, `var(--sc-bg-surface)` → `var(--sclient-bg-surface)`. Also `getAccent()` now comes from utils.js.
4. **Accent property:** old code set `document.documentElement.style.setProperty("--sclient-accent", getAccent())` at load — REMOVE that line here; the accent feature (Phase 3) owns the `--sclient-accent` property.
5. **Styles:** the tiny inline style block (`sclient-lyrics-style` id: `.sclient-lyric-line:hover`, `.sclient-lyric-word.sung`, romanize button styles) → `this.addStyle("sclient-lyrics-style", css)` in `init()`. The sidebar's inline `sidebar.style.cssText` and inline HTML styles can stay inline (they're dynamic), but any static classes go to the style block.
6. **Class → Feature:**
   - `init()`: addStyle + subscribe `onPlaybackChange` (track changes: reset `lastTrack`, `currentLyricsUrl`, call `fetchLyrics()` when open) + start the `renderLoop` (requestAnimationFrame; store the rAF id on `this` and cancel in `destroy()`). Also add the document click handler for line seeking? No — line clicks are bound inside the sidebar DOM (kept).
   - `injectUI()`: `injectLyricsButton()` — button `#sclient-lyrics-btn` before `.playbackSoundBadge__showQueue` (guard + early return).
   - The sidebar is created lazily on first `toggleLyrics()` (old behavior, keep).
   - `toggleLyrics()` etc. become methods.
7. **Interpolation loop:** old `renderLoop` read `window.__scMedia` and fell back to `document.querySelectorAll("audio, video")`. Use `bridge.getActiveMedia()` where possible, keep the fallback. Keep `currentInterpolatedPos` logic verbatim.
8. **Config:** featureKey `features.show_lyrics`, category `playback`.

## Romanize IPC contract (for later reference)

`sendBridge("romanize", { texts: [...] })` → main returns `results` array (same length, romanized strings). Old handler name and shape preserved (Phase 6).

## Verification checklist

1. `node --check`.
2. Grep: no `--sc-` own vars; no direct `.playbackSoundBadge__titleLink` / `navigator.mediaSession` reads (all through bridge/onPlaybackChange); no local `seekTo` definition (uses bridge's).
3. `document.getElementById("sclient-lyrics-btn")` guard present; `FEATURES.push(LYRICS_FEATURE)` at bottom.
4. Behavior parity: synced word highlighting, offset slider, romanize toggle, manual entry fallback, click-to-seek.
5. Do NOT touch: `src/`, `main/`, `package.json`, other v2 files.

## Report

Note any lrcmux API behavior kept (abort controller, level=word), confirm checklist. Await human approval, then commit `feat(v2): lyrics`.
