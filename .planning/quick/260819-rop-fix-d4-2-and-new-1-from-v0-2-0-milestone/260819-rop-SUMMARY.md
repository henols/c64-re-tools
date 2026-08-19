---
phase: quick-260819-rop
plan: 01
subsystem: docs
tags: [mcp, tool-manifest, backward-compatibility, roadmap, audit-closure]

requires:
  - phase: v0.2.0 milestone audit
    provides: findings D4-2 and NEW-1 (.planning/v0.2.0-MILESTONE-AUDIT.md §8, §4.3)
provides:
  - ROADMAP.md no longer claims Phase 7 owns or was deferred disk detach
  - Six live documents (ROADMAP.md, README.md, CLAUDE.md, decisions.md, the
    generator, and its regenerated docs/tool-support.md) state the true
    backward-compatible D-07 invariant instead of a false identical-shape claim
  - A structural node:test gate (manifest-arg-compat.test.ts) that fails if a
    future manifest edit removes, retypes, or newly-requires a shared property
affects: [tool-support-docs, mcp-manifest-maintenance]

tech-stack:
  added: []
  patterns:
    - "Pure checker function (checkBackwardCompatible) run against both real
       manifests and synthetic fixtures, house style shared with
       tool-support-table.test.mjs and fork-manifest-surface.test.ts"

key-files:
  created:
    - .claude/mcp/vice/manifest-arg-compat.test.ts
  modified:
    - .planning/ROADMAP.md
    - .planning/intel/decisions.md
    - README.md
    - CLAUDE.md
    - scripts/generate-tool-support-table.mjs
    - docs/tool-support.md

key-decisions:
  - "Disk detach's ROADMAP.md sites now say it was cut from v0.2.0 scope entirely, not deferred to or owned by Phase 7 -- while keeping the D-13/docs/stock-vice-parity.md cross-references and the already-correct 'Dropped from this phase'/'Cut from scope' sites untouched."
  - "The corrected D-07 invariant is 'backward-compatible', not 'identical': stock may add optional parameters but never removes, retypes, or newly-requires a shared one -- re-verified programmatically against both shipped manifests (34 shared tools, 17 with divergent inputSchema, zero removed, zero newly-required, exactly one widening)."
  - "The one widening (vice_checkpoint_set_condition.condition omitting type on stock) is allow-listed with a stated reason in the new test rather than loosening the checker, since the checker's schema subset has no union keyword to express string-or-object."

requirements-completed: [AUDIT-D4-2, AUDIT-NEW-1]

duration: ~20min
completed: 2026-08-19
---

# Quick Task 260819-rop: Fix D4-2 and NEW-1 from v0.2.0 Milestone Audit Summary

**Corrected ROADMAP.md's false "Phase 7 owns disk detach" claim and rewrote the D-07 "same argument shape" invariant to the true, now-tested "backward-compatible" invariant across six live documents plus a new structural gate.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-19T18:00:00Z (approx.)
- **Completed:** 2026-08-19T18:07:42Z
- **Tasks:** 3 completed
- **Files modified:** 7 (6 modified, 1 created)

## Accomplishments

- Closed audit finding D4-2: three ROADMAP.md sites no longer assert Phase 7
  owns or was deferred disk detach; all now correctly state it was cut from
  v0.2.0 scope, with the D-13 and `docs/stock-vice-parity.md` cross-references
  intact.
- Closed audit finding NEW-1 part A: six live documents (`.planning/ROADMAP.md`,
  `README.md`, `CLAUDE.md`, `.planning/intel/decisions.md`,
  `scripts/generate-tool-support-table.mjs`, and its regenerated
  `docs/tool-support.md`) now state the true backward-compatible invariant
  instead of the false "identical argument shape" claim.
- Closed audit finding NEW-1 part B: added
  `.claude/mcp/vice/manifest-arg-compat.test.ts`, a structural `node:test`
  gate with a reusable `checkBackwardCompatible()` checker, asserting nothing
  is removed, retyped, or newly-required across the 34 tools shared between
  `tools-manifest.json` and `tools-manifest.stock.json`, with one documented
  widening allow-list entry and five negative-control fixtures proving the
  checker actually rejects bad cases.

## Task Commits

1. **Task 1: Stop ROADMAP.md asserting Phase 7 owns disk detach (D4-2)** -
   `f574e21` (docs)
2. **Task 2: Correct the D-07 "same argument shape" claim at all five live
   sites (NEW-1 part A)** - `79af9a7` (docs)
3. **Task 3: Pin the backward-compatibility invariant with a structural
   test (NEW-1 part B)** - `3344809` (test)

_Plan metadata commit handled by the orchestrator, not this executor (per
constraints: SUMMARY.md/STATE.md/PLAN.md are not committed here)._

## Files Created/Modified

- `.planning/ROADMAP.md` - Corrected three disk-detach sites (D4-2) and the
  D-07 standing-constraint bullet + regenerator2000 overlap prose (NEW-1)
- `.planning/intel/decisions.md` - Corrected `DEC-preserve-mcp-surface`'s
  superseded-part mirror of D-07
- `README.md` - Corrected the "Consequences of the choice" bullet describing
  cross-backend tool compatibility
- `CLAUDE.md` - Corrected the Compatibility standing-constraint bullet
  (SKILL-01 consequence left untouched)
- `scripts/generate-tool-support-table.mjs` - Corrected the generated prose
  string literal
- `docs/tool-support.md` - Regenerated via
  `node scripts/generate-tool-support-table.mjs` (one-line diff, byte-identity
  drift guard still green)
- `.claude/mcp/vice/manifest-arg-compat.test.ts` (new) - Structural
  backward-compatibility gate over the two shipped manifests, 8 tests (1
  sanity precondition, 1 real-manifest assertion, 6 fixture-based negative/
  positive controls)

## Decisions Made

- Kept the three D4-2 fixes minimally scoped to the exact quoted sentences,
  preserving all surrounding plan-count/date/cross-reference text
  byte-identical, per the plan's explicit "keep the rest... byte-identical"
  instruction.
- Chose one consistent phrase for the corrected D-07 invariant — "a
  backward-compatible argument shape ... stock may add optional parameters
  but never removes, retypes, or newly-requires one" — adapted to each site's
  register (terse constraint bullets vs. flowing prose), per the plan's "you
  own the exact phrasing, say the same true thing" instruction.
- Implemented the widening allow-list as an array of `{tool, property,
  reason}` records rather than a bare name set, so the reason is inline and
  machine-checkable (the sanity-precondition test fails if a stale entry's
  tool falls out of the shared set).

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<action>` and
`<verify>` blocks were followed as specified; no Rule 1-4 auto-fixes were
needed.

## Verification Evidence (real command output)

**Task 1 gate:**
```
$ test "$(tr '\n' ' ' < .planning/ROADMAP.md | tr -s ' ' | grep -ocE 'owned by Phase 7|Deferred to Phase 7|Phase 7 owns disk detach' | awk '{s+=$1} END {print s+0}')" -eq 0 && \
  grep -q 'Dropped from this phase:' .planning/ROADMAP.md && \
  grep -q '| Disk detach | remainder of `DIRECT-06`' .planning/ROADMAP.md && \
  grep -q 'D-13 in `03-CONTEXT.md`' .planning/ROADMAP.md && \
  grep -q "stops attributing detach to Phase 7" .planning/ROADMAP.md && \
  echo D4-2-OK
D4-2-OK
```

**Task 2 gate:**
```
$ for f in .planning/ROADMAP.md README.md CLAUDE.md docs/tool-support.md scripts/generate-tool-support-table.mjs .planning/intel/decisions.md; do ...stale-check... done
(no STALE lines printed)
$ for f in ...; do grep -qi 'backward-compatible' "$f" || echo MISSING...; done
(no MISSING lines printed)
$ test "$(git diff --numstat -- docs/tool-support.md | awk '{print $1"/"$2}')" = "1/1"
(true)
$ (cd .claude/mcp/vice && node --test tool-support-table.test.mjs)
# tests 6
# pass 6
# fail 0
NEW-1-A-OK
```

**Task 3 gate:**
```
$ cd .claude/mcp/vice && node --test manifest-arg-compat.test.ts
# tests 8
# pass 8
# fail 0
$ npx tsc --noEmit -p tsconfig.json
(exit 0, no output)
$ node test-gate.mjs
# tests 1676
# suites 21
# pass 1671
# fail 0
# cancelled 0
# skipped 0
# todo 5
(exit 0)
```
The 5 `todo` entries are pre-existing, documented as requiring a real
emulator (e.g. `runToCheckpoint()`, `reset()`'s temporary-checkpoint
invariant, `vice_display_screenshot`'s host-path proof) — unrelated to this
plan's changes and unchanged by it.

**Whole-plan diff scope check:**
```
$ git diff --stat a2037f6 HEAD
 .claude/mcp/vice/manifest-arg-compat.test.ts | 339 +++++++++++++++++++++++++++
 .planning/ROADMAP.md                         |  15 +-
 .planning/intel/decisions.md                 |   4 +-
 CLAUDE.md                                    |   2 +-
 README.md                                    |   4 +-
 docs/tool-support.md                         |   2 +-
 scripts/generate-tool-support-table.mjs      |   4 +-
 7 files changed, 359 insertions(+), 11 deletions(-)
```
Exactly the seven files named in the plan's `files_modified` frontmatter;
nothing under `.planning/phases/**`, `.planning/REQUIREMENTS.md`, or
`.planning/v0.2.0-MILESTONE-AUDIT.md` was touched.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both audit findings (D4-2, NEW-1) are closed. No follow-on work is implied by
this quick task; the milestone audit record itself (`.planning/v0.2.0-MILESTONE-AUDIT.md`)
was intentionally left unmodified, as instructed.

---
*Phase: quick-260819-rop*
*Completed: 2026-08-19*

## Self-Check: PASSED

All 7 claimed files verified present on disk (`.claude/mcp/vice/manifest-arg-compat.test.ts`,
`.planning/ROADMAP.md`, `.planning/intel/decisions.md`, `README.md`, `CLAUDE.md`,
`scripts/generate-tool-support-table.mjs`, `docs/tool-support.md`). All 3 claimed
task commit hashes (`f574e21`, `79af9a7`, `3344809`) verified present in
`git log --oneline --all`.
