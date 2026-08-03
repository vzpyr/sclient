# 02 — Styles (renderer CSS)

**Prereqs:** read `docs/00-overview.md` (sections 6, 11, 12). Phase 01 must be done (files exist).

## Goal

Create the four CSS files under `src/v2/renderer/styles/`, extracted from the inline CSS currently buried in `src/injected/core.js` and `src/preload.js`. All variables/classes renamed per Section 12. **Nothing is injected yet** (Phase 11 wires `insertCSS`); these are just files.

## Files to create

### 1. `src/v2/renderer/styles/base.css`

- **Design system** — the `scDesignSystem` template literal from `src/injected/core.js` (~line 110–230): `:root { --sclient-* vars }` with the SAME default values, the `body.theme-light` override block, `.sclient-text-h1/h2/body/sub`, `.sclient-btn`, `.sclient-btn-primary`, `.sclient-btn-danger`, `.sclient-btn-ghost`, `.sclient-modal-backdrop`, `.sclient-modal-surface`, `.sclient-input`. (Rename map in 00-overview §12.)
  - NOTE: old values used `bgSurfaceVal`/`bgElevatedVal` computed from `custom_bg_color` config. In v2, base.css declares the STATIC defaults (`#121212` / `#2a2a2a`); the custom-bg-color feature (Phase 3) overrides `--sclient-bg-surface`/`--sclient-bg-elevated` dynamically. Remove the JS-computed values.
- **Scrollbar** — `sclientScrollbarCss` from core.js (~line 50).
- **Light-theme overlay fixes** — the `sclient-light-theme-overlays` block from core.js (~line 60–110). Selectors referencing overlays (`#sclient-settings-overlay`, `#sclient-lyrics-sidebar`, `#sclient-stats-overlay`, `#sclient-playlists-overlay`, `.pm-sidebar`, `.stats-card`, ...) stay as-is.

### 2. `src/v2/renderer/styles/layout.css`

Static SoundCloud layout fixes, always applied:

- The player-bar fix from `src/injected/init.js` (`sclient-player-fix` style: `.playControls__soundBadge` widths, `.playbackSoundBadge__titleContextContainer`, `.playbackSoundBadge__actions`).
- `applyLayoutFixes()` CSS from `src/injected/core.js` (~line 700: `.mixedSelectionModule`, `.tileGallery`, `.playableTile`, `.systemPlaylistTile`).

NOT here: wide-layout CSS (dynamic width → feature, Phase 3), collapsible sidebar (dynamic bg → feature), enhanced header (toggle → feature), custom bg (dynamic → feature).

### 3. `src/v2/renderer/styles/titlebar.css`

The `#sclient-titlebar` CSS currently inline in `src/preload.js` (the `style.textContent` block): nav-area, title-area, controls-area, buttons, and the header/content offset rules (`header, .header, .header__wrapper { top: 32px !important; }`, `#content, .l-main { padding-top: 32px !important; }`, `.l-sidebar-right, .sclient-floating-btn, #sclient-sidebar-toggle, #sclient-lyrics-sidebar { margin-top: 32px !important; }`, `#sclient-settings-overlay, #sclient-stats-overlay, iframe.webiIframe { top: 32px !important; ... }`).

- Rename `--sc-bg-surface` → `--sclient-bg-surface`, `--sc-border` → `--sclient-border`, `--sc-text-main` → `--sclient-text-main`, `--sc-text-muted` → `--sclient-text-muted`, `--sc-font-sans` → `--sclient-font-sans` (keep the same fallback pattern `var(--sclient-bg-surface, #121212)`).
- The font `@import` and font-family logic STAYS in preload (dynamic from config) — only the static CSS moves here. Phase 11 will remove the inline block from preload.

### 4. `src/v2/renderer/styles/features.css`

Cross-feature shared component styles:

- `.sclient-floating-btn` — from `injectFloatingButtonStyles()` in core.js (~line 740) incl. hover/active states and the `.active` accent variants.
- `.sclient-download-toast` — from the same function's toast block (position, styling, transitions).
- Keep `var(--sclient-*)` references renamed. These two components are used by multiple features (lazy-scroll, sidebar toggle, artwork-viewer, downloader, effects copy/save buttons).

## Verification checklist

1. Every selector/variable starts with `sclient-` (own classes) or is a documented SoundCloud class (`sc-button*`, `header__*`, `playbackSoundBadge__*`, `theme-dark`, ...). Grep `--sc-` → nothing; grep `\.sc-btn` → nothing (but `.sc-button` may appear, that's SC's).
2. `diff` your design-system defaults against the old `scDesignSystem` values (only the rename + removal of dynamic bg values changed).
3. All 4 files exist and are syntactically valid CSS (balanced braces — quick check with a CSS linter if available, else manual).
4. Do NOT touch: `src/` old tree, `preload.js`, `package.json`, anything not listed.

## Report

List files, note any selector that didn't map cleanly, confirm checklist. Await human approval, then commit `feat(v2): styles`.
