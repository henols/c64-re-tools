---
phase: 05-skill-critical-derived-tools
plan: 08
subsystem: testing
tags: [ci-gate, coverage-script, documentation, skills, stock-vice, parity-doc]

# Dependency graph
requires:
  - phase: 05-skill-critical-derived-tools
    provides: "05-06/05-07's final 34-tool stock manifest and the nine-member STOCK_DERIVED_TOOLS set, which this plan's coverage script cross-checks against"
provides:
  - "scripts/check-skill-tool-coverage.mjs -- a mechanical, re-runnable answer to Phase 5's success criterion 5, with a five-set classified allowlist that shrinks by failing"
  - "A blocking CI step (.github/workflows/ci.yml) running the coverage script on every push/PR, beside the npm-package validation"
  - "docs/stock-vice-parity.md updated with Phase 5's four trim decisions (D-05-01..D-05-04), the DERIV-05 stock GAIN, the corrected criterion-5 exception count (D-05-08), and three corrected stale phase pointers"
  - "Five c64-program-recon reference files corrected so no stock user is told to reach for vice_sid_get_state or vice_keyboard_restore without a fork-requirement note"
affects: ["Phase 7 (vice_cycles_stopwatch/vice_run_until landing must delete their PENDING_LATER_PHASE entries or this script fails)", "Phase 8 (BACK-05/SKILL-01 scope should absorb vice_keyboard_restore as a third criterion-5 exception; DIST-01's support table can reuse this script's extraction)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist-that-shrinks-by-failing: every FORK_ONLY_UNRECOVERABLE/PENDING_LATER_PHASE entry is asserted ABSENT from the stock manifest, so a later phase landing one flips this from green to red until the entry is deleted"
    - "mcp__ prefix stripping before tool-name extraction: /mcp__[\\w-]+_vice__/g is stripped from skill text BEFORE the /\\bvice_[a-z0-9_]+/g match, because the double-underscore join point (…_vice__vice_x) has no \\b boundary and would otherwise swallow the whole prefixed string as one token or miss the tool name entirely"
    - "Never-execute skill content: the coverage script only readFileSync()s and regex-matches .claude/skills/ content, never import()/require()/eval()/spawn"

key-files:
  created:
    - scripts/check-skill-tool-coverage.mjs
  modified:
    - .github/workflows/ci.yml
    - docs/stock-vice-parity.md
    - .claude/skills/c64-program-recon/references/tool-selection.md
    - .claude/skills/c64-program-recon/references/observation-hazards.md
    - .claude/skills/c64-program-recon/references/sound-and-input.md
    - .claude/skills/c64-program-recon/references/graphics.md
    - .claude/skills/c64-program-recon/references/control-flow.md

key-decisions:
  - "D-05-05 (from plan, implemented as specified): success criterion 5 is verified by a committed, re-runnable script, not a one-off manual pass -- Phase 8's DIST-01 is expected to reuse the same extraction."
  - "D-05-08 (from plan, implemented as specified): the exception list is three tools, not the ROADMAP's stated two -- vice_keyboard_restore is a third provably-unrecoverable skill-called tool, allowlisted with the same BACK-05/SKILL-01 route as vice_sid_get_state and vice_keyboard_matrix. The ROADMAP's criterion-5 text was deliberately NOT amended; this is flagged as an open item for the developer / Phase 8 planning, per the plan's explicit instruction."

patterns-established:
  - "A skills-vs-manifest coverage check with three non-vacuity need() controls (minimum extracted-name count, minimum directories-scanned count, two positive controls) plus a live planted-unclassified-name probe, proving the gate can actually fail before trusting it to stay green."

requirements-completed: [DERIV-01, DERIV-04, DERIV-05, DERIV-06]

# Metrics
duration: 30min
completed: 2026-08-17
---

# Phase 5 Plan 8: Criterion 5 Coverage Script, CI Gate, Parity Doc, Skill Fixes Summary

**A committed, CI-blocking coverage script that extracts every vice_* tool reference from the six skills and cross-checks it against the 34-tool stock manifest, backed by a five-set classified allowlist that fails (rather than silently passes) the day a later phase makes one of its exceptions obsolete.**

## Performance

- **Duration:** ~30 min (task commits 20:34:34 -> 20:40:53 +02:00, 2026-08-17, plus setup/context-reading time)
- **Started:** 2026-08-17 (worktree base-check + context reads)
- **Completed:** 2026-08-17T20:40:53+02:00
- **Tasks:** 4
- **Files modified:** 8 (1 created, 7 modified) -- exactly the plan's declared `files_modified` set

## Accomplishments

- **`scripts/check-skill-tool-coverage.mjs` answers criterion 5 mechanically.** It walks `.claude/skills/` for `*.md`/`*.mjs` files, strips any `mcp__<plugin>_vice__` prefix, extracts every `vice_*` name, and checks each against `tools-manifest.stock.json`. 35 distinct names were extracted from 30 files across all 6 skill directories; 25 resolve as advertised on the 34-tool stock manifest; the remaining 10 are classified across five allowlist sets, each member carrying a non-empty reason and, for the fork-only/pending sets, a route.
- **The allowlist shrinks by failing, not grows silently.** Every `FORK_ONLY_UNRECOVERABLE` (`vice_sid_get_state`, `vice_keyboard_matrix`, `vice_keyboard_restore`) and `PENDING_LATER_PHASE` (`vice_cycles_stopwatch`, `vice_run_until`) entry is asserted **absent** from the stock manifest -- the day Phase 7 lands either pending tool, this script fails until the stale entry is deleted. Every allowlisted name is also asserted to still be **referenced** by a skill file (dead-entry guard).
- **Three non-vacuity `need()` controls, not comments**, plus a live probe: planting a reference to `vice_totally_made_up` in a scratch skill file (removed immediately after) proved the script exits non-zero and names the offending tool and file.
- **CI wired**: a single blocking step in the `build` job, positioned between "Validate npm package contents" and "Build installable package", no `continue-on-error`, no `if:` guard. `git diff --stat .github/workflows/ci.yml` shows only the one added step and its comment.
- **`docs/stock-vice-parity.md` updated**: item 5 rewritten from a prediction to a record of what Phase 5 shipped (one `sidefx:false` `MEM_GET` per chip, eleven `{available:false, reason}` fields, `enum:[false]` manifest pins); the DERIV-05 stock GAIN recorded explicitly (stock reads are **provably** side-effect-free vs. the fork's own read path, which this project's skill docs mark **unverified**); four new item-7 bullets for D-05-01 (memory_compare snapshot refusal, exact refusal text quoted), D-05-02 (symbols_load kickasm/simple refusal), D-05-03/D-05-04 (sprite_inspect png_base64 omission, native-resolution ASCII grid), and D-05-08 (criterion 5's corrected three-tool exception count); three stale phase pointers corrected (`vice_display_screenshot`/`vice_disk_read_sector` no longer point at a never-built phase, `vice_machine_config_get`/`set` no longer points at the cut Phase 6 -- all three now cite the 2026-08-17 scope cut).
- **Five `c64-program-recon` reference files corrected** so a stock user is never silently pointed at a fork-only tool: `tool-selection.md` splits the whole-chip-state row (VIC-II/CIA both-backends, SID fork-only) and marks sprite/memory-search/symbols rows "both backends"; `observation-hazards.md` adds the sidefx:false/unavailable-field notes; `sound-and-input.md` names `interruptStatus` vs. the unavailable write-side mask; `graphics.md` names `$D018` bank-relative pointers and the unscaled ASCII grid; `control-flow.md` flags `vice_keyboard_restore` as fork-only (naming `BACK-05`) and `vice_memory_compare` as `mode:'ranges'`-only on stock.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/check-skill-tool-coverage.mjs** - `be78aea` (feat)
2. **Task 2: Wire the coverage check into CI** - `15623b5` (feat)
3. **Task 3: Record Phase 5's divergences and the DERIV-05 gain in docs/stock-vice-parity.md** - `7dc322a` (docs)
4. **Task 4: Fix the four skill references this phase's landings made wrong** - `10805c5` (docs)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified

- `scripts/check-skill-tool-coverage.mjs` (created) - the criterion-5 coverage script: extraction, five classification sets, core check, three non-vacuity controls
- `.github/workflows/ci.yml` - one new blocking step in the `build` job, between the npm-package validation and the installable-package build
- `docs/stock-vice-parity.md` - item 5 rewritten as a record + the DERIV-05 gain; four new item-7 bullets (D-05-01..D-05-04, D-05-08); three stale phase pointers corrected
- `.claude/skills/c64-program-recon/references/tool-selection.md` - whole-chip-state row split, backend markers added to four rows
- `.claude/skills/c64-program-recon/references/observation-hazards.md` - sidefx:false / unavailable-field notes added
- `.claude/skills/c64-program-recon/references/sound-and-input.md` - interruptStatus / unavailable-enable-mask note added
- `.claude/skills/c64-program-recon/references/graphics.md` - bank-relative $D018 / unscaled-grid note added
- `.claude/skills/c64-program-recon/references/control-flow.md` - vice_keyboard_restore fork-requirement note, vice_memory_compare ranges-only note

## The Coverage Script's Summary Output (evidence for criterion 5)

```
check-skill-tool-coverage: OK -- 35 distinct vice_* names extracted from 30 files across 6 skill directories; 25 resolved as advertised on the stock manifest (34 tools total). Classified: 2 proxy-local, 1 deny-listed, 2 not-a-tool-name, 3 fork-only-unrecoverable, 2 pending-later-phase.
```

## The Full Classified Allowlist (as written, for Phase 7/8 to know exactly which entries they delete)

**`PROXY_LOCAL_TOOLS`** (served inside `vice-proxy.ts` itself; present in neither manifest by design):
- `vice_result_continue`
- `vice_recycle`
- `vice_diagnose`

**`DENY_LISTED_TOOLS`** (referenced by skills only to forbid it):
- `vice_disk_list` -- in `vice.ts`'s `DENY_LIST`, absent from both manifests

**`NOT_A_TOOL_NAMES`** (not actually tool names -- absent from both manifests):
- `vice_version` -- a JSON field name in `c64-ram-capture`'s capture logs
- `vice_epoch_get` -- named only to state it does not exist

**`FORK_ONLY_UNRECOVERABLE`** (present on the fork, provably unrecoverable on stock -- Phase 7 does NOT touch these; Phase 8 owns `BACK-05`/`SKILL-01`):
- `vice_sid_get_state` -- SID `$D400-$D418` write-only in hardware, no SID command on the binary monitor
- `vice_keyboard_matrix` -- `KEYBOARD_FEED` injects PETSCII text only, cannot drive the raw matrix
- `vice_keyboard_restore` -- **the third exception** (see Open Item below); RESTORE pulses NMI, not in the keyboard matrix

**`PENDING_LATER_PHASE`** (not yet built on stock -- **Phase 7 MUST delete these entries** the day it lands either tool, or this script fails):
- `vice_cycles_stopwatch` -- TIME-01, Phase 7
- `vice_run_until` -- TIME-02, Phase 7

**How the drift guard was checked:** each `FORK_ONLY_UNRECOVERABLE`/`PENDING_LATER_PHASE` entry has a `need(!stockNames.has(name), ...)` assertion reading the real, live-parsed `tools-manifest.stock.json` at script run time -- not a static comment. Confirmed by direct execution: `stockNames.has("vice_cycles_stopwatch")` and `stockNames.has("vice_run_until")` both evaluate `false` against the current 34-tool manifest, so the assertions currently pass; the moment either becomes `true` (Phase 7 landing), the corresponding `need()` call flips to failing and the script exits 1 until the entry is deleted from the source.

## Open Item for the Developer (D-05-08, not resolved here by design)

**The ROADMAP's Phase 5 criterion 5 names two provably-unrecoverable tools (`vice_sid_get_state`, `vice_keyboard_matrix`); the mechanical extraction finds a third: `vice_keyboard_restore`.**

- It is called by `c64-program-recon/references/control-flow.md` (RESTORE-key/NMI anti-tamper trap detection).
- It is already documented as a hard loss in `docs/stock-vice-parity.md` §A item 2 (the low-level keyboard family: `matrix`, `chord`, `key_press`/`key_release`, `restore` -- all fail because `KEYBOARD_FEED` (0x72) only injects PETSCII text and cannot pulse the RESTORE/NMI line).
- It is covered by **no requirement** and appears in **no phase's scope** today.
- This plan allowlisted it exactly like the other two (`FORK_ONLY_UNRECOVERABLE`, same `BACK-05`/`SKILL-01` Phase 8 route) and recorded the discrepancy in `docs/stock-vice-parity.md` (D-05-08).
- **The ROADMAP's criterion-5 text was deliberately NOT amended by this plan** -- per the plan's own `plan_decision_D-05-08` instruction, changing a success criterion's wording is a developer decision, not an executor's. Phase 8 planning should decide whether to formally fold `vice_keyboard_restore` into `BACK-05`/`SKILL-01`'s scope (which already exists for the other two) or handle it separately.

## Decisions Made

- **D-05-05 (from plan, implemented as specified):** see `key-decisions` above.
- **D-05-08 (from plan, implemented as specified):** see `key-decisions` above and the Open Item section.
- No decisions beyond what the plan specified. The exact classification-set reason strings, the `mcp__..._vice__` prefix-stripping mechanism, and the docs/skill-file edit wording were all authored to satisfy the plan's stated acceptance criteria; none required a judgment call beyond following the plan's action text closely.

## Deviations from Plan

None - plan executed exactly as written. All four tasks' acceptance criteria and verify blocks passed on the first implementation; no auto-fixes were needed.

## Issues Encountered

- **Pre-existing, unrelated `repo-root.test.ts` failure**, identical to the one every prior Phase 5 plan reported and already fully documented (RESOLVED disposition) in `.planning/phases/05-skill-critical-derived-tools/deferred-items.md` -- this plan's own worktree is likewise nested under `.claude/worktrees/agent-ae4686743c1455a16/`. No new deferred-items entry was added, per every prior plan's own precedent and this plan's instructions.
- Fresh worktree had no `node_modules/` for `.claude/mcp/vice` -- ran `npm ci` before typechecking/testing, matching every prior Phase 5 plan's own documented setup step (not a deviation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5's tool surface is complete and criterion 5 is now mechanically verifiable and CI-enforced: `node scripts/check-skill-tool-coverage.mjs` exits 0, `node scripts/check-npm-packages.mjs` exits 0 (transitive closure: 37 clean modules, `.claude/mcp/vice/package.json` untouched by this plan as instructed), `npm run typecheck` clean, `npm run smoke` OK, `node --test fork-manifest-surface.test.ts` passes (fork manifest still byte-identical at 62 tools).
- `npm run test:automated` reports **1348 pass / 1 fail (the documented, resolved-by-merge worktree-nesting failure) / 5 todo** -- the exact baseline every prior Phase 5 plan reported, confirming this plan introduced zero regressions to `.claude/mcp/vice`.
- `git status --porcelain installer/skills` and `git status --porcelain .claude/mcp/vice/resources` are both clean -- no gitignored/generated artifact leaked into this plan's commits.
- **Open item for Phase 8 planning:** `vice_keyboard_restore` as a third criterion-5 exception (see above) -- decide whether to fold it into the existing `BACK-05`/`SKILL-01` scope explicitly or track it separately; the ROADMAP's criterion-5 wording itself was intentionally left unamended.
- **Open item for Phase 7:** landing `vice_cycles_stopwatch` (`TIME-01`) or `vice_run_until` (`TIME-02`) will make `scripts/check-skill-tool-coverage.mjs` fail until the corresponding `PENDING_LATER_PHASE` entry is deleted from the script -- this is the drift guard working as designed, not a bug to route around.
- No blockers.

---
*Phase: 05-skill-critical-derived-tools*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: scripts/check-skill-tool-coverage.mjs
- FOUND: .planning/phases/05-skill-critical-derived-tools/05-08-SUMMARY.md
- FOUND commit: be78aea (Task 1)
- FOUND commit: 15623b5 (Task 2)
- FOUND commit: 7dc322a (Task 3)
- FOUND commit: 10805c5 (Task 4)
