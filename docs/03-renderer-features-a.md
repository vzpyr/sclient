# 03 — Renderer Features A (simple/always-on)

**Prereqs:** `docs/00-overview.md` (sections 6, 8, 9, 10, 12). Phases 01–02 done.

## Goal
Port 8 renderer-only features into `src/v2/renderer/features/`. Each is one class extending `Feature`, instantiated at the bottom of its file, plus `FEATURES.push(<NAME>_FEATURE)` at the bottom of that file. Features only call `utils.js` / `bridge.js` / `SCLIENT_CONFIG` / their own code.

**Template every file follows:**

```javascript
class XFeature extends Feature {
  get featureKey() { return "config_key"; }        // or null if always-on
  get settingsCategory() { return "appearance"; }  // see 00-overview §10
  get settingsLabel() { return "Display Name"; }
  get hasToggle() { return true; }

  init() {
    if (this.enabled) return;
    super.init();                    // sets this.enabled = true
    // ...subscribe to bridge events / add styles...
  }

  injectUI() {
    // ...create DOM, guard with if (document.getElementById("sclient-x")) return;
  }
}

const X_FEATURE = new XFeature();
FEATURES.push(X_FEATURE);
```

## Files to create

### 1. `hides.js` — `HideUpsellFeature` + `HideArtistsFeature`
- Two small classes (one file is fine — they're the same category of CSS-only toggle) OR two files; pick one and be consistent. Recommended: one file, two classes, both pushed.
- Port the two `injectStyle` calls from old `src/injected/init.js` `applyFeatureStyles()`:
  - hide_upsell: `.header__upsellWrapper { display: none !important; }`
  - hide_artists: `.header__forArtistsButton, .sidebarModule:has(.sidebarModule__webiEmbeddedModule) { display: none !important; }`
- `init()` → `this.addStyle("sclient-hide-upsell", css)` / `this.addStyle("sclient-hide-artists", css)`.
- featureKey `features.hide_upsell` / `features.hide_artists`, category `playback`.

### 2. `lazy-scroll.js` — `LazyScrollFeature`
- Port `setupLazyScroll()` from old `src/injected/core.js` (~line 785): floating button `#sclient-lazy-scroll` (className `sclient-floating-btn`), click toggles auto-scroll interval (300px/16ms), `active` class toggle.
- featureKey `features.lazy_scroll`, category `playback`.
- Note: old `injectUI`-style guard `if (document.getElementById("sclient-lazy-scroll")) return;` — keep.
- The interval must be stored on `this` and cleared in `destroy()` (override + `super.destroy()`).

### 3. `wide-layout.js` — `WideLayoutFeature`
- Port `applyWideLayout()` from core.js (~line 680). Uses `SCLIENT_CONFIG.wideLayoutWidth` (default `"1200"`), `unlimited` → `max-width: none`.
- `init()` → `this.addStyle("sclient-fluid-viewport", css)`.
- featureKey `features.wide_layout`, category `appearance`, settingsFields: `[{ type:'text', key:'features.wide_layout_width', label:'Max Width' }]`.

### 4. `collapsible-sidebar.js` — `CollapsibleSidebarFeature`
- Port `applyCollapsibleSidebar()` from core.js (~line 722) — dynamic bg uses `var(--surface-color, var(--sclient-bg-surface))`.
- Port `injectSidebarToggle()` from old `src/injected/init.js` line 31 (button `#sclient-sidebar-toggle`, toggles `body.sclient-sidebar-open`, swaps open/close icons). Keep the `sclient-floating-btn` class; the `display` toggling CSS is part of the sidebar CSS.
- `init()` → addStyle; `injectUI()` → button injection (guard + early return if no `document.body` yet — observer handles retry).
- featureKey `features.collapsible_sidebar`, category `appearance`.

### 5. `enhanced-header.js` — `EnhancedHeaderFeature`
- Port from old `src/injected/init.js`:
  - `safeReplaceSvg(container, svgHtml)` (~line 60)
  - `replaceNavIcons()` (~line 90) — home/stream/library icons, notifications, messages, chevron, more, upload, artist studio, search — ALL the icon SVGs verbatim.
  - `injectNavButtons()` (~line 180) — back/fwd buttons (`#sclient-nav-back-btn`, `#sclient-nav-fwd-btn`) into `.header__navMenu`. Old behavior: only injected when titlebar style is NOT custom (check `SCLIENT_CONFIG.titlebarStyle !== "custom"`). Keep that condition.
  - The header-reorder CSS from `applyFeatureStyles()` in init.js (`sclient-header-reorder` style) → `this.addStyle("sclient-header-reorder", ...)` in `init()`.
- `injectUI()` → `replaceNavIcons()` (idempotent guards) + `injectNavButtons()`.
- featureKey `features.enhanced_header`, category `appearance`.

### 6. `accent.js` — `AccentFeature`
- Port `applyCustomAccentColor(newColor)` from old `src/injected/accent.js` VERBATIM (hexToRgb, processCss/processNode, link/style scanning, MutationObserver on added LINK/STYLE nodes, `data-sc-custom-accent` attribute, `::selection` + iframe injection via `injectToIframes`).
- `init()` → call it with `SCLIENT_CONFIG.accentColor` when `SCLIENT_CONFIG.customAccent`; also set `document.documentElement.style.setProperty("--sclient-accent", SCLIENT_CONFIG.accentColor)` (this replaces the old lyrics.js inline property set — the design system var must reflect the custom accent globally).
- The `data-sc-custom-accent` attribute stays as-is (it's our own marker; not a class, so no rename needed).
- featureKey `features.custom_accent`, category `appearance`, settingsFields: `[{ type:'color', key:'features.accent_color', label:'Accent Color' }]`.
- Also: when `customAccent` is false, the base design system var `--sclient-accent: #f50` (from base.css) applies — nothing to do.

### 7. `adblock.js` — `AdblockFeature`
- Port `applyAdblock()` from old `src/injected/adblock.js` VERBATIM (fetch + XHR interception for `adswizz.com`, `doubleclick.net`, `/ads`; `window.__sc_adblock_installed` flag → replace with `this.enabled` guard).
- `init()` → applyAdblock(). **This feature patches global fetch/XHR — never call `destroy()`-style unpatching** (restoring originals would break other listeners). Add exactly one comment line noting the interception is permanent (allowed exception, 00-overview §6 rule 14).
- featureKey `features.adblock`, category `playback`.
- Main-process ElectronBlocker is a separate mechanism handled in `main/index.js` (Phase 11) and the adblock special-case in the generic config save (Phase 6). Don't add IPC here.

### 8. `artwork-viewer.js` — `ArtworkViewerFeature` (always-on, NO toggle)
- Port the avatar-click handler from old `src/injected/core.js` (~line 860–950): click on `.playbackSoundBadge__avatar` → preventDefault/stopPropagation → extract `span.sc-artwork` background image → upscale `-(t50x50|badge|large|t120x120).(jpg|png)` → `-t500x500.$2` → fullscreen overlay (`sclient-modal-backdrop`) with copy button (canvas → clipboard PNG via `navigator.clipboard.write([new ClipboardItem(...)])`) and save button (`<a download>`), toasts via `showToast()`.
- Implement as: `init()` → `this.on(document, "click", handler, true)` (capture phase, same as old).
- `hasToggle` false, `settingsCategory` null, `featureKey` null.
- This feature is currently UNLABELED in old code (it's inside core.js) — don't lose it.

## Verification checklist
1. `node --check` on all new files.
2. Function inventory per file matches the port list (no helpers left behind in old core.js/init.js that these features need).
3. Grep: no `--sc-` own vars, no `window.__SCLIENT_CONFIG__` outside config.js, no cross-feature calls (only utils/bridge/SCLIENT_CONFIG/FEATURES).
4. Each file ends with `<NAME>_FEATURE` const + `FEATURES.push(...)`.
5. `document.getElementById` guards on every injectUI.
6. Do NOT touch: `src/`, `package.json`, main-process files, `renderer/core.js` beyond nothing (core.js already exists from Phase 1 — do not modify it unless FEATURES.push needs nothing more; it doesn't).

## Report
List features ported, flag any SVG/behavior differences, confirm checklist. Await human approval, then commit `feat(v2): renderer features A`.
