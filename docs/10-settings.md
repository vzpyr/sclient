# 10 — Settings (data-driven overlay)

**Prereqs:** `docs/00-overview.md` (sections 6, 10, 15, 16). Phases 01–09 done (ALL features exist — this phase reads their metadata).

## Goal
Rewrite the settings overlay as a **data-driven** feature: it renders toggles/fields by iterating `FEATURES`, instead of hardcoding 30+ toggle rows. This is the last feature phase.

## Old code to study
- `src/injected/settings.js` (the giant overlay — you are REPLACING it, not porting wholesale)
- `src/injected/init.js` — `injectMenuButton()` (settings gear icon → moves HERE)
- `src/injected/core.js` — `toggleOverlay` keyboard shortcut (Ctrl+I) → moves HERE
- `src/v2/main/ipc.js` — the generic `save_custom_files` contract from Phase 6 (implement AGAINST this)

## Design (see 00-overview §10, §15, §16)

### 1. `src/v2/renderer/features/settings.js` — `SettingsFeature`
- `featureKey` null, `hasToggle` false, `settingsCategory` null (it's the manager UI, not a managed feature).
- **`injectUI()`** → `injectMenuButton()` ported verbatim from old init.js (gear icon into `.header__right .header__navMenu`, calls `this.toggle()`).
- **Keyboard shortcut:** Ctrl+I toggles the overlay (old core.js/settings.js behavior) — register via `this.on(document, "keydown", ...)` in `init()`.

### 2. Overlay sections (build order)
```
1. GENERAL (hardcoded — not features):
   - titlebar style: select (features.titlebar_style: 'custom'|'native')
   - tray icon: toggle (features.tray_icon)
   - load last page: toggle (features.load_last_page)
2. APPEARANCE — iterate FEATURES where settingsCategory === 'appearance'
3. PLAYBACK — iterate FEATURES where settingsCategory === 'playback'
4. INTEGRATIONS — iterate FEATURES where settingsCategory === 'integrations'
   (lastfm: settingsFields api_key/secret + settingsCustom() "Authenticate" button + status line
    listenbrainz: token field)
5. STATS — iterate FEATURES where settingsCategory === 'stats'
   (stats: settingsCustom() "Open Stats" button → STATS_FEATURE.toggle())
6. PLAYLIST MANAGER section — PLAYLIST_MANAGER_FEATURE.settingsCustom() "Open Playlist Manager" button
7. CSS/JS EDITORS — hardcoded (ported from old settings.js: the two editors, tab switching,
   syntax highlighting via highlight/highlightCss/highlightJs — port those helpers verbatim into
   this file since they're settings-only)
8. ACCOUNTS — hardcoded (ported from old settings.js: list, create, delete, switch; uses
   get_accounts/create_account/delete_account/set_active_account channels)
```

### 3. Rendering a feature (per category iteration)
For each feature `f`:
- If `!f.settingsLabel` or `!f.hasToggle` → skip (unless `f.settingsCustom()` exists — render that + a heading instead).
- Row: label + description + toggle (`<input type="checkbox" data-config-key="${f.featureKey}">`).
- Fields: for each `field` in `f.settingsFields`, render by type:
  - `text` → `<input type="text" data-config-key="${field.key}" placeholder="...">`
  - `color` → `<input type="color" data-config-key="${field.key}">`
  - `number` → `<input type="number" data-config-key="${field.key}">`
  - `select` → `<select data-config-key="${field.key}">` with options
- If `f.settingsCustom()` → append its HTML + call `f.settingsInit(overlay)` after injection.
- Use the `sclient-` classes from base.css (`.sclient-card`, toggle styling, etc.). Reuse the old toggle-switch CSS pattern from settings.js but with `sclient-` prefixes.

### 4. Initial values
- Toggle checked state: read from the PAYLOAD (`SCLIENT_CONFIG.get(f.featureKey)`) — same as the old overlay did via `cfg`.
- Fields: `SCLIENT_CONFIG.get(field.key, field.default)`.
- CSS/JS editors: `SCLIENT_CONFIG.customCss` / `SCLIENT_CONFIG.customJs`.

### 5. Save (implements the Phase 6 generic contract)
Collect:
```javascript
const pairs = {};
overlay.querySelectorAll("[data-config-key]").forEach((el) => {
  let value;
  if (el.type === "checkbox") value = el.checked;               // bool
  else if (el.type === "color") value = el.value;               // hex string
  else value = el.value;                                        // string
  pairs[el.dataset.configKey] = value;
});
const payload = { pairs, files: { css: cssEditor.value, js: jsEditor.value } };
await sendBridge("save_custom_files", payload);
window.location.reload();   // old behavior: reload applies changes
```
- After reload, overlay state is re-read from the new payload. Keep the old flow (save → reload).
- Special keys (`features.adblock`, secure keys, files) are handled by the MAIN handler (Phase 6) — settings just sends raw values. Do NOT special-case them in the renderer.

### 6. Status elements for scrobbler features
The lastfm/listenbrainz features expect status elements `#sclient-lastfm-status` / `#sclient-listenbrainz-status` inside the settings overlay (Phase 7 contract). Add them in the integrations section (small status line elements). Their updates come from the features via `updateStatus` — settings only provides the DOM shell.

## Verification checklist
1. `node --check`.
2. Walk the FEATURES array: every feature with `settingsLabel`/`hasToggle`/`settingsCustom`/`settingsFields` renders in the right category. Grep each feature file's metadata and confirm a matching render path.
3. The overlay contains NO hardcoded feature toggles beyond the documented General section (grep for old `sclient-*-toggle` IDs — new IDs must be `data-config-key` driven; the toggle element itself can have an ID but it's generic).
4. Save payload matches the Phase 6 contract shape `{ pairs, files }`.
5. Ctrl+I shortcut + gear icon both open the overlay.
6. Do NOT touch: `src/`, `package.json`, other v2 files (main/ipc.js from Phase 6 already implements the generic handler — verify it matches, but do not modify unless there's a contract mismatch; if mismatch, report it).

## Report
Confirm the FEATURES-driven rendering works with ALL features from phases 3–9, note the save contract compliance, list hardcoded sections. Await human approval, then commit `feat(v2): settings`.
