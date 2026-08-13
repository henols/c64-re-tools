---
phase: 02-stock-backend-connection
plan: 02
subsystem: testing
tags: [binary-monitor, fixtures, vice, node-test, provenance]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "plan 02-01's binmon-fixtures.ts (encodeResponseFrame(), loadCapturedFixture(), MissingFixtureError) and probe-binmon.mjs's bounded --capture mode, which this plan's fixtures are generated to be loadable through"
provides:
  - "Three committed, provenance-stamped VERIF-02 wire fixtures (display-get, event-interleaved, checkpoint-list) that binmon-fixtures.test.ts and later plan 02-04's stock-protocol.test.ts can load via loadCapturedFixture()"
  - "A recorded, non-silent D-19 override: docs/phase2-backend-probe-evidence.md names exactly why real capture could not happen and what a re-capture must confirm, case by case"
  - "An explicit OPEN verdict on RESEARCH.md's A1/Open Question 2 (the --help backend-detection discriminator), so plan 02-07 does not silently inherit an unverified assumption"
affects: [02-04, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spec-derived synthesis stamped with synthetic: true + specSections (naming the exact spec section each field came from) as the honest alternative to a blocked hardware capture -- never silently relabeled as real"
    - "Fixture well-formedness assertions (frame decomposition, no trailing partial frame) are written to hold regardless of whether the underlying bytes are captured or synthesized, so re-recording later requires no test rewrite"

key-files:
  created:
    - .claude/mcp/vice/fixtures/binmon/display-get.bin
    - .claude/mcp/vice/fixtures/binmon/display-get.json
    - .claude/mcp/vice/fixtures/binmon/event-interleaved.bin
    - .claude/mcp/vice/fixtures/binmon/event-interleaved.json
    - .claude/mcp/vice/fixtures/binmon/checkpoint-list.bin
    - .claude/mcp/vice/fixtures/binmon/checkpoint-list.json
    - docs/phase2-backend-probe-evidence.md
    - .planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md
  modified:
    - .claude/mcp/vice/fixtures/binmon/README.md
    - .claude/mcp/vice/binmon-fixtures.test.ts

key-decisions:
  - "2026-08-13 user override of D-19: no stock VICE binary is reachable in this execution environment, so the three VERIF-02 fixtures were synthesized from the normative protocol spec (docs/phase0-binmon-findings.md §5, probe-binmon.mjs's own body-layout parsers) rather than captured live -- recorded, not silent, per docs/phase2-backend-probe-evidence.md"
  - "capturedFrom: \"synthesized-fallback\" reused (not a new label) for all three sidecars, matching the meaning plan 02-02's own checkpoint fallback path already established for this project"
  - "Task 3's --help discriminator evidence (RESEARCH.md A1) was NOT fabricated -- it has no synthetic substitute (a --help transcript is either real or a lie), so it is left explicitly OPEN in docs/phase2-backend-probe-evidence.md for plan 02-07 to gather itself before depending on it"

patterns-established:
  - "Pattern 1: a blocked hardware-dependent checkpoint is resolved by either (a) an honest, clearly-labelled spec-derived synthesis when one is possible, or (b) an explicit OPEN verdict with a named downstream owner when it is not -- never a silent assumption in either case"

requirements-completed: [VERIF-02, BACK-04]

# Metrics
duration: ~40min
completed: 2026-08-13
---

# Phase 2 Plan 2: Synthesized VERIF-02 Fixtures (D-19 Override) Summary

**Three provenance-stamped VERIF-02 wire fixtures generated from the binary-monitor spec rather than captured live, because no stock VICE binary is reachable in this execution environment -- with the override, the affected fixtures, and a still-open `--help` discriminator question all recorded in `docs/phase2-backend-probe-evidence.md`.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-13T10:20:00+02:00 (approx.)
- **Completed:** 2026-08-13T11:00:00+02:00 (approx.)
- **Tasks:** 3 completed / 3 planned (all three adapted per the mid-execution scope override -- see Deviations)
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- `display-get.bin` (157,281 bytes), `event-interleaved.bin` (78 bytes, 4
  frames), and `checkpoint-list.bin` (156 bytes, 5 frames) now exist under
  `.claude/mcp/vice/fixtures/binmon/`, each loadable through
  `loadCapturedFixture()` and asserted to decompose into complete,
  well-formed frame sequences with no trailing partial frame.
- `fixtures/binmon/README.md`'s provenance table has zero `PENDING` rows;
  every fixture is marked `synthesized-fallback` with a pointer to the
  full override record.
- `docs/phase2-backend-probe-evidence.md` records both the D-19 override
  (what, why, which fixtures, what re-recording must confirm) and an
  explicit OPEN verdict on the `--help` backend-detection discriminator
  (RESEARCH.md A1), rather than silently assuming either resolution.
- A follow-up todo names the exact re-capture acceptance check for all
  three fixtures.

## Task Commits

Each task was committed atomically (task numbering follows the original
plan's three tasks, each adapted per the scope override):

1. **Task 1 (adapted): Synthesize the three VERIF-02 fixtures from spec** - `e8c4265` (feat)
2. **Task 2: Fill README provenance table, assert fixtures parse** - `98a9f2d` (test)
3. **Task 3 (adapted): Record D-19 override; leave `--help` discriminator open** - `8ac1542` (docs)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

## Files Created/Modified

- `.claude/mcp/vice/fixtures/binmon/display-get.bin` / `.json` - synthesized `DISPLAY_GET` (0x84) reply frame, recorded 504x312/8bpp geometry, `synthetic: true` sidecar
- `.claude/mcp/vice/fixtures/binmon/event-interleaved.bin` / `.json` - synthesized `RESUMED`/`STOPPED`/`REGISTER_INFO` broadcast events landing between an `ADVANCE_INSTRUCTIONS` request and its own reply
- `.claude/mcp/vice/fixtures/binmon/checkpoint-list.bin` / `.json` - synthesized two `CHECKPOINT_SET` replies plus a 2+1-frame `CHECKPOINT_LIST` answer sharing one request id
- `.claude/mcp/vice/fixtures/binmon/README.md` - provenance table filled (all `synthesized-fallback`), synthetic-provenance callout added, `PENDING` marker removed from the "Bounded by design" prose too (it tripped the `grep -c PENDING` acceptance check)
- `.claude/mcp/vice/binmon-fixtures.test.ts` - 12 new `fixture:`-named tests: load-without-throwing, sidecar provenance keys, frame decomposition/well-formedness, `display-get` size, `event-interleaved` broadcast-vs-non-broadcast ids, `checkpoint-list` shared-request-id count, for all three fixtures
- `docs/phase2-backend-probe-evidence.md` (new) - full D-19 override record plus the `--help` discriminator's OPEN verdict
- `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md` (new) - re-capture acceptance check, named case by case

## Decisions Made

- Kept `capturedFrom: "synthesized-fallback"` as the label rather than
  inventing a new string -- it already carries this project's established
  "not real evidence, use with that caveat" meaning from plan 02-02's own
  fallback-path design, and reusing it avoids a second vocabulary for the
  same concept.
- Generated all three fixtures through `binmon-fixtures.ts`'s own
  `encodeResponseFrame()` (via a one-off `import()` of that module from a
  scratch generator script, never committed) rather than hand-writing
  bytes, so the fixtures are byte-exact against the same header-encoding
  logic the tests and any future client will use -- consistent with the
  project's "no test/tool hand-rolls its own header-byte offsets"
  convention.
- Did not fabricate `--help` evidence for RESEARCH.md's A1. A synthetic
  wire frame can be defended as a spec-conformant reading; a synthetic
  `--help` transcript cannot be defended as anything but a guess at what
  a specific binary's argument parser prints. Left explicitly OPEN
  instead, with plan 02-07 named as the owner of gathering it before
  implementing against it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Provisioned missing `node_modules` before verification**
- **Found during:** pre-execution baseline check (`npm run test:automated`)
- **Issue:** This worktree had no `node_modules` (same class of issue plan 02-01 hit in its own worktree).
- **Fix:** Ran `npm ci --no-audit --no-fund` in `.claude/mcp/vice`, matching the SessionStart hook's own command.
- **Verification:** `npm run test:automated` ran to completion afterward.
- **Committed in:** N/A (environment-only, no file changes)

**2. [Scope-directed, not a Rule 1-4 deviation] All three tasks were executed per an explicit mid-execution scope override, not as originally planned**
- **What changed:** The orchestrator's prompt carried a `<scope_override>` block, issued by the user on 2026-08-13, stating no real stock VICE is reachable in this environment and directing this plan to run fully autonomously: synthesize all three fixtures from spec (with provenance marked synthetic, not real), record the override in `docs/phase2-backend-probe-evidence.md`, and file a re-recording todo. This is a direct instruction, not a Rule 1-4 auto-fix, and is documented here for traceability rather than silently absorbed into "executed as planned."
- **Task 1** (originally `checkpoint:human-verify` waiting for a developer to run a live capture) became an autonomous synthesis step producing the same three files the plan's `must_haves.artifacts` names.
- **Task 3** (originally `checkpoint:human-verify` waiting for a developer to run `x64sc --help` on two real builds) could not be executed at all in this environment -- there is no synthetic substitute for a `--help` transcript without fabricating evidence, which the override's own "provenance must not lie" principle forbids. It was converted to an explicit OPEN-verdict record instead, naming plan 02-07 as the owner of gathering this evidence before depending on it.
- **Files affected:** all of this plan's created/modified files.
- **Committed in:** `e8c4265`, `98a9f2d`, `8ac1542`

**Fixed one acceptance-check false-positive discovered during self-verification (Rule 1 - Bug):**
- **Found during:** Task 2 verification (`grep -c 'PENDING' fixtures/binmon/README.md`)
- **Issue:** An unrelated prose sentence in the "Bounded by design" section ("leaves its row above unchanged (still `PENDING`)") contained the literal string `PENDING`, tripping the plan's own zero-`PENDING` acceptance check even though the provenance table itself had no pending rows.
- **Fix:** Reworded that sentence to describe the same behavior without the literal token.
- **Files modified:** `.claude/mcp/vice/fixtures/binmon/README.md`
- **Verification:** `grep -c 'PENDING' fixtures/binmon/README.md` now returns `0`.
- **Committed in:** `98a9f2d`

---

**Total deviations:** 1 auto-fixed (blocking/environment), 1 auto-fixed (bug, acceptance-check false positive), plus the scope-override-directed task restructuring documented above (not a Rule 1-4 deviation -- direct instruction).
**Impact on plan:** The environment fix and the README wording fix are both necessary-and-narrow. The scope-override restructuring changes *how* both hardware-dependent tasks were resolved but not what this plan's `must_haves.artifacts` require to exist; every artifact the plan's frontmatter names is present, with honest provenance.

## Issues Encountered

- Same pre-existing worktree-path test artifact plan 02-01 documented
  (`repo-root.test.ts`'s "the agreed path is not under .claude" assertion
  fails only because this specific worktree is nested under
  `.claude/worktrees/agent-.../`). Confirmed unrelated to this plan's three
  tasks; not auto-fixed, out of scope per the executor's scope boundary.
  `npm run test:automated` is 319/320 passing (5 `todo`) in this worktree
  as a result.

## User Setup Required

None - no external service configuration required. The re-capture this
plan's todo describes requires a real stock VICE build on a separate host
and is deferred, not blocking.

## Next Phase Readiness

- `binmon-fixtures.test.ts`'s 12 new `fixture:`-named tests are ready for
  plan 02-04's `stock-protocol.test.ts` to load the same three fixtures
  through `loadCapturedFixture()`.
- `docs/phase2-backend-probe-evidence.md`'s OPEN verdict on the `--help`
  discriminator is a direct input to plan 02-07: that plan must gather
  real `--help` evidence (as a checkpoint at its own start) before
  implementing the `-mcpserver`/`-binarymonitor` string-match mechanism.
- The re-recording todo
  (`.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`)
  is not a blocker for any later plan in this phase -- the synthetic
  fixtures are structurally valid and load correctly -- but should be
  picked up whenever a real stock VICE build becomes reachable.
- No blockers for plan 02-03 (running in parallel) or 02-04.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/fixtures/binmon/display-get.bin`
- FOUND: `.claude/mcp/vice/fixtures/binmon/display-get.json`
- FOUND: `.claude/mcp/vice/fixtures/binmon/event-interleaved.bin`
- FOUND: `.claude/mcp/vice/fixtures/binmon/event-interleaved.json`
- FOUND: `.claude/mcp/vice/fixtures/binmon/checkpoint-list.bin`
- FOUND: `.claude/mcp/vice/fixtures/binmon/checkpoint-list.json`
- FOUND: `docs/phase2-backend-probe-evidence.md`
- FOUND: `.planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`
- FOUND commit `e8c4265` (feat: synthesize fixtures)
- FOUND commit `98a9f2d` (test: assert fixtures parse, fill README)
- FOUND commit `8ac1542` (docs: D-19 override + open --help verdict)
