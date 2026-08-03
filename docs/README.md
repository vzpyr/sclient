# SClient Refactor — How to Run This

SClient is being refactored from a working-but-messy Electron codebase into a clean, feature-based
architecture. The work is split into 12 phases. Each phase is implemented in a **fresh AI session
with zero prior context** by following this file + `00-overview.md` + that phase's doc.

## The golden rule

**Read `00-overview.md` in full first, every session.** It defines the architecture, the global
rules, the contracts, the naming conventions, and the master old→new file mapping. Phase docs
assume it. If a phase doc contradicts it, the overview wins.

## Session opener (copy-paste into the new agent chat)

> You are working on SClient, an Electron wrapper for SoundCloud. It is being refactored in
> phases into a clean feature-based architecture. Your job is to implement ONE phase.
>
> FIRST: read the file `docs/00-overview.md` in full. It explains the architecture (main
> process / preload / renderer), the global rules you MUST follow, the contracts
> (Feature base class, bridge.js, utils.js, SCLIENT_CONFIG), the CSS naming conventions,
> and the master mapping of old files to new files.
>
> SECOND: read the phase doc `<PHASE_FILE>` in full.
>
> THIRD: read the old source files listed under "Old code to study" in the phase doc.
> The old tree under `src/` is the reference implementation — port from it faithfully.
>
> FOURTH: implement ONLY the files listed under "Files to create/modify" in the phase doc.
> Do NOT touch the old `src/` tree, `package.json` (except where the phase says so), or
> anything outside the phase's scope. Do NOT "improve" logic beyond the phase doc —
> behavior parity is the goal. If something is ambiguous or the contract seems wrong,
> STOP and report it instead of improvising.
>
> FIFTH: run the phase's "Verification checklist" and report results.
>
> SIXTH: report exactly what you did, any deviations, and any bugs you found and fixed.
> Do not commit — the human reviews and commits.

## Phase checklist

| # | Doc | What it delivers | App runs? |
|---|---|---|---|
| 1 | `01-foundation.md` | `src/v2/` skeleton, utils.js, bridge.js, config.js, Feature.js, core.js manager | no (v2 inert) |
| 2 | `02-styles.md` | base.css, titlebar.css, layout.css, features.css | no |
| 3 | `03-renderer-features-a.md` | hides, lazy-scroll, wide-layout, collapsible-sidebar, enhanced-header, accent, adblock, artwork-viewer | no |
| 4 | `04-renderer-features-b.md` | context-menu, shuffle, effects | no |
| 5 | `05-lyrics.md` | lyrics | no |
| 6 | `06-main-features-a.md` | main/ipc.js (generic save), downloader/discord-rpc/mpris pairs, romanize | no |
| 7 | `07-main-features-b.md` | lastfm, listenbrainz, stats pairs | no |
| 8 | `08-playlist-manager.md` | playlist manager (4 renderer files + main dialogs) | no |
| 9 | `09-miniplayer.md` | miniplayer window + feature pair | no |
| 10 | `10-settings.md` | data-driven settings overlay | no |
| 11 | `11-wire-and-flip.md` | new main/index.js + preload.js, package.json flip | **YES — smoke test** |
| 12 | `12-collapse-and-final-qa.md` | delete old tree, collapse v2→src, full QA matrix | **YES — 22-point QA** |

## How to run a phase

```
1. Create a NEW AI session (zero context).
2. Paste the session opener above, replacing <PHASE_FILE> with the phase doc name.
3. Let the agent work. Review the diff yourself (you have eyes).
4. Approve → agent (or you) commits:  feat(v2): <phase>
5. Next session, next phase.
```

## Verification commands (agents use these; you can too)

```bash
# syntax check every new file (works for renderer files too — pure parsing)
find src/v2 -name '*.js' -exec node --check {} \;

# no old-style config access outside config.js
grep -rn "__SCLIENT_CONFIG__" src/v2/renderer/          # must show ONLY renderer/config.js

# no SClient-owned sc- prefixed vars/classes left
grep -rn "\-\-sc-" src/v2/renderer/                     # must be empty
grep -rn "\.sc-btn" src/v2/renderer/                    # must be empty (.sc-button is SC's, ok)

# no require() in renderer
grep -rn "require(" src/v2/renderer/                    # must be empty

# function inventory per file (catch lost functions)
grep -rn "^function \|^  [a-zA-Z]*(" src/v2/renderer/
```

## Where things are in the final tree (after phase 12)

```
src/
├── main/            # Node.js: index.js, config.js, romanize.js, ipc.js, features/*
├── renderer/        # injected into SoundCloud: bridge.js, utils.js, config.js, core.js, styles/, features/*
├── miniplayer/      # separate window: index.html, index.js
├── preload.js       # the bridge
└── api/             # Vercel proxy (untouched)
```

## Ground rules for whoever runs this

1. **Phases run in order 1→12.** Phase 1 creates every contract later phases depend on.
2. **The old `src/` tree stays untouched until Phase 11** (it's the reference + the safety net).
3. **Phase 11 is the moment of truth.** Do not skip its smoke test. If something breaks,
   fix it in v2 files — and if a doc contract was wrong, fix the doc too and say so.
4. **Phase 12 only after Phase 11 QA passes.** Until then, old tree = rollback.
5. Never touch: `src/api/`, `node_modules/`, `dist/`, `venv/`, `afterSign.js`, `.npmrc`.
6. Behavior parity > beauty. Port faithfully. Flag improvements as suggestions, don't implement them.
7. **NO COMMENTS in code.** Zero banner/header blocks, no inline "what this does" notes. Only exceptions: the one-line permanent-patch note in adblock.js/shuffle.js and one-line attribution on byte-for-byte copies (00-overview §6 rule 14). Comment-free code is a hard acceptance criterion.
