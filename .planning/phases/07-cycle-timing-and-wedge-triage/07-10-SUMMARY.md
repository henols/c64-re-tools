---
phase: 07-cycle-timing-and-wedge-triage
plan: 10
subsystem: docs
tags: [documentation, skill-correctness, parity-record, validation-closure, live-verification]

# Dependency graph
requires:
  - phase: 07-cycle-timing-and-wedge-triage
    provides: "07-05's stock-timing.ts (Route A/B, TIME-03 refusal), 07-06's stock-diagnose.ts (five-verdict vocabulary), 07-07's stock-recycle.ts (screenshot-free evidence), 07-08/07-09's manifest registration (34 -> 36 -> 38) -- everything this plan documents"
provides:
  - "docs/stock-vice-parity.md's Phase 7 divergence record: vice_diagnose's stale_read_path absence (D-03), vice_recycle's screenshot-free stock record (D-01), vice_run_until's bounded timeout_ms (D-02), and the probeCpuHistory() count=0/0x81 fix recorded as a stock gain"
  - "vice-wedge-triage/SKILL.md correct on the stock backend: backend-aware verdict vocabulary, the monitor_held_elsewhere row/state, the corrected vice_run_until trap, and a stock-only zero-call liveness bracket replacing the fork's vice_ping x3 poll"
  - "07-VALIDATION.md's Per-Task Verification Map fully resolved (no placeholder rows), corrected manifest counts (34 -> 36 -> 38), and a live manual-verification pass against genuine stock VICE 3.9 and 3.10"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual-only validation rows may be PASS, PARTIAL, or OUTSTANDING -- a checklist item is not ticked to reach a compliance flag when a row's evidence does not yet support it (T-07-19)"

key-files:
  created: []
  modified:
    - docs/stock-vice-parity.md
    - .claude/skills/vice-wedge-triage/SKILL.md
    - .planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md
    - .planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md
    - scripts/check-skill-tool-coverage.mjs

key-decisions:
  - "Performed a live manual-verification pass (not merely required by the plan's literal task list, but licensed by its own Task 3 instruction that these behaviors 'are runnable, not hypothetical') against both /usr/bin/x64sc (genuine stock 3.9) and /usr/local/bin/x64sc (genuine VICE 3.10) using throwaway, uncommitted scratch scripts dispatched through the real dispatchStock() seam -- deleted immediately after use, never part of this plan's diff"
  - "The live pass surfaced a genuine Route A (CPUHISTORY_GET) wire-decode mismatch against real VICE 3.10 (52-byte reply, parser needs 65) -- NOT fixed here (protocol-level investigation is outside this plan's docs-only scope), logged to deferred-items.md, and left as the one row blocking 07-VALIDATION.md's nyquist_compliant flag rather than silently absorbed into a passing checklist"
  - "nyquist_compliant left false, naming the exact blocking row, per the document's own T-07-19 disposition: an outstanding manual row must be named, not ticked away"

requirements-completed: [TIME-01, TIME-02, TIME-03, TIME-04]

# Metrics
duration: ~95min
completed: 2026-08-18
---

# Phase 07 Plan 10: Close the Phase's Documentation Obligations Summary

**Corrected `vice-wedge-triage/SKILL.md` for the stock backend (backend-aware verdict vocabulary, bounded `vice_run_until`, a zero-call stock liveness procedure), recorded Phase 7's three divergences plus one correctness gain in `docs/stock-vice-parity.md`, and fully resolved `07-VALIDATION.md`'s Per-Task Verification Map -- including a live pass against genuine stock VICE 3.9 and 3.10 that both confirmed four behaviors and surfaced one new, out-of-scope Route A decode defect.**

## Performance

- **Duration:** ~95 min
- **Completed:** 2026-08-18T09:24:19Z
- **Tasks:** 3 completed
- **Files modified:** 5 (3 in plan scope, 1 deviation log, 1 Rule 3 fix)

## Accomplishments

- `docs/stock-vice-parity.md` §A item 4 (`vice_cycles_stopwatch`) rewritten to describe the dual-route implementation that actually shipped (Route A exact on VICE >= 3.10, Route B's `within-one-frame-unverified` reconstruction with a named-refusal wraparound guard), removing the superseded "second, always-available" frame-counter claim entirely (the phrase itself, not just its meaning, no longer appears in the file).
- §A item 3 (`vice_run_until`) amended: run-until-address exact on both backends, `cycles` still refused everywhere, and stock's new optional `timeout_ms` (default 30000, ceiling 600000) named as the one thing the fork lacks.
- Three new entries added in the existing house style: `vice_diagnose`'s `stale_read_path`-absent/`monitor_held_elsewhere`-gained divergence (D-03), `vice_recycle`'s four-item screenshot-free stock incident record (D-01), and `probeCpuHistory()`'s `count=0`/`InvalidParameter` (0x81) fix recorded as a stock correctness gain (every stock connect to a real VICE >= 3.10 build failed outright before it).
- §B item 1 (CPU-history) reframed: the tracing feature set itself remains unbuilt (Phase 6's cut `GAIN-*` work), but this phase gave it its first real consumer via Route A's cycle field.
- `vice-wedge-triage/SKILL.md` corrected across all seven of the plan's named touch points: the verdict vocabulary line, the verdict -> response table, the top state table, the `vice_run_until` trap, the manual fallback (fork's `vice_ping` x3 poll marked fork-only, a zero-call stock bracket added), the provenance table, and the troubleshooting table. No other skill file was touched (`git diff --name-only` against the phase-start commit lists only this one file under `.claude/skills/`).
- `07-VALIDATION.md`'s Per-Task Verification Map fully resolved: 15 rows, every one naming a real `{phase}-{plan}-{task}` ID, its actual wave (1-7), and a green status (225/225 across the six new test files, confirmed by running the quick command). The manifest-count line corrected to `34 -> 36 -> 38`. Four new rows added for behaviors the draft didn't anticipate (RESOURCE_GET round-trip, video-standard fallback, bounded session acquisition, record-before-RPC ordering proof).
- A live manual-verification pass was run against genuine stock VICE 3.9 (`/usr/bin/x64sc`) and genuine VICE 3.10 (`/usr/local/bin/x64sc`, confirmed via `-version`), dispatching through the real `dispatchStock()` seam with throwaway scratch scripts (never committed). Four of five Manual-Only rows now carry a recorded live result: Route B's stopwatch (including a live wraparound refusal on 3.9), `vice_run_until` reaching `$EA31` and timing out on unreached `$C000` with checkpoint cleanup (both binaries), and `vice_diagnose`'s `live` verdict via a real liveness bracket (both binaries).
- **A genuine, previously-unknown defect surfaced during the live pass:** forcing Route A (`CPUHISTORY_GET`) against real VICE 3.10 fails with a body-length mismatch (52 bytes present, parser needs 65). A follow-up raw-wire probe (hand-built request/response framing, bypassing this tree's parser) confirmed the real bytes and pinpointed the exact byte offsets involved. This was **not fixed** in this plan (protocol-level root-causing is outside its docs-only scope) -- it is logged in full, byte-level detail to `deferred-items.md`, and is the one row `07-VALIDATION.md`'s Manual-Only Verifications table records as OUTSTANDING, the sole blocker to `nyquist_compliant: true`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record Phase 7's divergences in docs/stock-vice-parity.md** - `22acad5` (docs)
2. **Task 2: Make vice-wedge-triage/SKILL.md correct on the stock backend** - `9a56def` (docs, includes a Rule 3 fix to `scripts/check-skill-tool-coverage.mjs`)
3. **Task 3: Resolve 07-VALIDATION.md's Per-Task Verification Map** - `78f49e3` (docs)

_No plan-metadata commit yet -- orchestrator commits STATE.md/ROADMAP.md updates centrally after all wave agents complete (worktree mode)._

## Files Created/Modified

- `docs/stock-vice-parity.md` - §A items 3/4 rewritten to describe what shipped; three new divergence/gain entries added; §B item 1 reframed to not claim CPU-history tracing shipped
- `.claude/skills/vice-wedge-triage/SKILL.md` - backend-aware verdict vocabulary, state table, verdict table, `vice_run_until` trap, manual fallback, provenance table, and troubleshooting table, all corrected for the stock backend's actual five-verdict path and bounded timeout
- `.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md` - Per-Task Verification Map fully resolved (15 rows), Wave 0 Requirements checklist ticked against what shipped, manifest count corrected, Manual-Only Verifications table filled with live results (4 PASS/PARTIAL, 1 OUTSTANDING), `nyquist_compliant` left `false` naming the blocker
- `.planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md` - new entry: the Route A live decode mismatch, with full byte-level analysis and a recommended follow-up plan
- `scripts/check-skill-tool-coverage.mjs` (Rule 3) - `PENDING_LATER_PHASE`'s stale `vice_cycles_stopwatch`/`vice_run_until` entries deleted; both landed in 07-08 and the drift guard correctly caught the staleness

## Decisions Made

- Chose to actually run live verification (not merely document an aspiration) against both real stock binaries available on this machine, using disposable scratch scripts dispatched through the real `dispatchStock()` seam, matching this project's established pattern (`stock-live.test.ts`) but without adding new committed test infrastructure -- consistent with this plan's own docs-only scope fence, since no new code or test files were left behind.
- When the live pass surfaced a genuine defect (Route A's decode mismatch), chose not to attempt a fix within this plan. Root-causing `CPUHISTORY_GET`'s actual per-entry wire layout requires either VICE source inspection for this specific build's version or further live captures across builds -- squarely the kind of protocol-level investigation this plan's scope fence explicitly excludes ("this plan touches vice-wedge-triage/SKILL.md only as far as criterion 4 requires... it does not build the manifest-derived support table"). Recorded honestly instead of silently absorbed.
- `nyquist_compliant` left `false` with the exact blocking row named, per the document's own T-07-19 threat disposition -- an outstanding manual verification is not something a later checklist tick may paper over.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `check-skill-tool-coverage.mjs`'s `PENDING_LATER_PHASE` allowlist was stale**
- **Found during:** Task 2's verification step (`node scripts/check-skill-tool-coverage.mjs`)
- **Issue:** The script's own drift guard failed by design: `vice_cycles_stopwatch` and `vice_run_until` were still listed as "not yet built on stock, Phase 7" (with an explicit comment reading "delete this entry the day Phase 7 lands it"), but both landed in plan 07-08. The guard existed precisely to catch this.
- **Fix:** Deleted both entries from `PENDING_LATER_PHASE`, leaving it empty (the correct steady state until a future phase defers something new).
- **Files modified:** `scripts/check-skill-tool-coverage.mjs`
- **Verification:** `node scripts/check-skill-tool-coverage.mjs` now reports `OK -- 35 distinct vice_* names... 0 pending-later-phase`.
- **Committed in:** `9a56def`

---

**Total deviations:** 1 auto-fixed (1 blocking-issue fix, Rule 3). No Rule 4 (architectural) decisions were needed.

## Issues Encountered

`npm run test:automated` reports 29 pre-existing failures out of 1527 tests (1493 pass, 5 pre-existing `todo`), unchanged before and after this plan's three commits (`git diff --stat` against the phase-start commit for `.claude/mcp/vice/` is empty -- this plan touched no file under that directory except the one Rule 3 fix to a repo-root `scripts/` file, unrelated to the failing tests). The failures are entirely in broker/build/mastra-telemetry infrastructure (`vice-broker`, `resources build`, `handleAcquire`/`handleRelease`, live-installed-tree telemetry checks) plus the same `repo-root.test.ts` "path agreement" worktree artifact documented in every prior plan this phase -- matching the exact 29-failure baseline `07-04-SUMMARY.md` already recorded. Not caused by this plan; out of scope per the standing scope-boundary rule.

The six timing/wedge-triage test files this plan's quick-verification command covers are fully green: 225/225 (`stock-connect.test.ts`, `stock-protocol.test.ts`, `stock-timing.test.ts`, `stock-run-until.test.ts`, `stock-diagnose.test.ts`, `stock-recycle.test.ts`).

One genuine, previously-undiscovered defect surfaced during this plan's own live manual-verification pass (see Accomplishments and Decisions Made above): Route A's `CPUHISTORY_GET` decode against real VICE 3.10 does not match this tree's parser assumptions. Documented in full in `deferred-items.md`; not fixed here; recommend a dedicated follow-up plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All four of Phase 7's documentation obligations are closed: `vice-wedge-triage/SKILL.md`'s opening move is correct on stock (ROADMAP success criterion 4), the three divergences plus one gain are recorded in `docs/stock-vice-parity.md`, and `07-VALIDATION.md`'s validation contract names a real task for every behavior it samples. One item is carried forward, not silently closed: the Route A live-decode mismatch against genuine VICE 3.10, logged in `deferred-items.md` with a recommended follow-up plan to re-derive the real wire layout and fix `stock-protocol.ts`/`stock-timing.ts`. `07-VALIDATION.md`'s `nyquist_compliant` flag is `false` pending that fix and a full re-run of the two PARTIAL Manual-Only rows (`vice_diagnose`'s `checkpoint_trap`/`wedged`/`restarted` verdicts; the broker-mediated half of second-client contention).

---
*Phase: 07-cycle-timing-and-wedge-triage*
*Completed: 2026-08-18*

## Known Stubs

None -- this plan produced no code, no UI, and no data-wiring surface. All three modified files
are documentation (`docs/stock-vice-parity.md`, `.claude/skills/vice-wedge-triage/SKILL.md`,
`.planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md`), plus one drift-guard
allowlist correction (`scripts/check-skill-tool-coverage.mjs`).

## Threat Flags

None -- this plan modified prose and one test-allowlist file only; no new network endpoints, auth
paths, file access patterns, or schema changes were introduced. All four threat-register items
(T-07-01, T-07-11, T-07-14, T-07-19) were mitigated as specified: `monitor_held_elsewhere` is
stated as never a reason to recycle, `stale_read_path` is marked fork-only, the `vice_ping`-poll
bracket is marked fork-only with the real `timeout_ms` default given, and `nyquist_compliant` was
left `false` with its blocking row named rather than absorbed by a ticked checklist.

## Self-Check: PASSED

- FOUND: docs/stock-vice-parity.md
- FOUND: .claude/skills/vice-wedge-triage/SKILL.md
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/07-VALIDATION.md
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/deferred-items.md
- FOUND: scripts/check-skill-tool-coverage.mjs
- FOUND: 22acad5 (docs: record Phase 7's divergences in stock-vice-parity.md)
- FOUND: 9a56def (docs: correct vice-wedge-triage/SKILL.md for the stock backend)
- FOUND: 78f49e3 (docs: resolve 07-VALIDATION.md's Per-Task Verification Map)
