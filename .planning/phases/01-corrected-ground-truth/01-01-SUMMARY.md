---
phase: 01-corrected-ground-truth
plan: 01
subsystem: docs
tags: [vice-binary-monitor, protocol-spec, cpuhistory, checkpoint-conditions]

# Dependency graph
requires: []
provides:
  - "docs/phase0-binmon-findings.md §1 corrected: REGISTERS_GET can source cycle data (LIN/CYC + frame-count reconstruction), CPUHISTORY_GET gated by VICE >= 3.10 not a compile flag, RL/CY condition pseudo-registers named with precedence/hex-literal traps"
  - "docs/phase0-binmon-findings.md §4 corrected: any inbound byte halts the machine via monitor_startup_trap() (no checkpoint needed), five unsolicited event types named (was three) with the shared-response-type hazard"
  - "docs/stock-vice-parity.md corrected: on-demand pause removed from the losses list (renumbered contiguous), stopwatch loss reframed on the VICE version gate, CPU-history gain caveated with the >= 3.10 gate, RL/CY named in the raster-condition gain"
affects: [phase-2-stock-backend-connection, phase-6-stock-only-gains, phase-7-cycle-timing-and-wedge-triage]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - docs/phase0-binmon-findings.md
    - docs/stock-vice-parity.md

key-decisions:
  - "On-demand pause is not a loss on stock VICE; renumbered the stock-vice-parity.md losses list contiguously (1-6) rather than leaving a note about a retired item number"
  - "The REGISTERS_GET/frame-count cycle reconstruction is documented as a second, always-available stopwatch route, explicitly not a replacement for CPU-history (Phase 7 still owns the routing decision between the two)"

patterns-established: []

requirements-completed: [DOC-01, DOC-02]

# Metrics
duration: 20min
completed: 2026-08-12
---

# Phase 1 Plan 01: Correct the Two Normative Protocol Documents Summary

**Corrected four verified factual errors plus a 3-to-5 unsolicited-event undercount in `docs/phase0-binmon-findings.md` and `docs/stock-vice-parity.md`, all source-cited against VICE's binary-monitor implementation.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-12T12:55:00Z (approx)
- **Completed:** 2026-08-12T13:15:14Z
- **Tasks:** 3/3 completed
- **Files modified:** 2

## Accomplishments
- Removed the false "`REGISTERS_GET` cannot be a stopwatch" conclusion and added the client-side cycle-reconstruction formula (`LIN`/`CYC` + frame count), with its `CHECKPOINT_INFO` cost warning, without overclaiming that it replaces CPU history
- Replaced the compile-flag framing of `CPUHISTORY_GET` availability with the real gate (VICE >= 3.10), distinguishing `INVALID_TYPE` (0x83, opcode absent) from `CMD_FAILURE` (0x8f, feature disabled on a qualifying build)
- Added the missing `RL`/`CY` condition-parser fact to both documents: uppercase-only pseudo-registers distinct from `LIN`/`CYC`, no operator precedence, hex-by-default literals — each source-cited (`mon_lex.l:559-560`, `mon_parse.y:168`, `monitor.c:1597`)
- Deleted the false "no pause-now opcode" claim from `phase0-binmon-findings.md` §4 and removed the corresponding loss entry from `stock-vice-parity.md`'s losses list, renumbering it to stay contiguous
- Corrected the unsolicited-event-type undercount from three to five (`STOPPED`, `RESUMED`, `JAM`, `CHECKPOINT_INFO`, `REGISTER_INFO`), naming the shared-response-type demux hazard Phase 2's PROTO-03 depends on, and the `JAM` zero-length-body fact

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct section 1 of docs/phase0-binmon-findings.md** - `e9d7cae` (docs)
2. **Task 2: Correct section 4 of docs/phase0-binmon-findings.md** - `2005fce` (docs)
3. **Task 3: Correct docs/stock-vice-parity.md** - `4dd3437` (docs)

**Plan metadata:** SUMMARY.md commit (this plan; committed alongside this file)

## Files Created/Modified
- `docs/phase0-binmon-findings.md` - Section 1 (cycle stopwatch) and section 4 (pause/run model, event types) rewritten with corrected, source-cited facts
- `docs/stock-vice-parity.md` - Section A losses list (pause removed, stopwatch reframed, renumbered) and section B gains list (CPU-history version gate, RL/CY naming) rewritten

## Decisions Made
- Renumbered the `stock-vice-parity.md` losses list contiguously (1-6) after removing the on-demand-pause item, rather than leaving a gap-with-note. A short parenthetical under the section heading records the retirement and cites the corrected source (`docs/phase0-binmon-findings.md` §4) without re-quoting any removed wording.
- Kept the `REGISTERS_GET`-based cycle reconstruction and the `CPUHISTORY_GET` stopwatch explicitly framed as two coexisting routes, per the plan's overcorrection guard — neither document claims CPU history is now unnecessary.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance-criteria greps and the plan-level seven-gate verification block pass; no `.ts`/`.mts`/`.mjs` file was touched.

## Issues Encountered

The worktree's initial `HEAD` did not match the expected wave-1 base commit (`5033cb728...`) — the branch had drifted onto an unrelated, older history with no `.planning/` directory present. Per the mandatory `<worktree_branch_check>` first-action step, `git reset --hard` to the expected base commit was performed before any file edit, which restored the correct planning artifacts and source tree. This is standard worktree-setup recovery, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both normative protocol documents now agree with `CLAUDE.md`/`PROJECT.md` on `RL`/`CY`, the VICE >= 3.10 gate, and the five-event-type count — Phase 2's PROTO-03 (event demux) and Phase 6/7 (CPU-history gains, cycle timing) can derive their designs from correct source documents.
- This plan is independent of `01-02` (constraints.md/ADR), `01-03` (probe extension), and `01-04` (probe execution) per the roadmap's Wave 1 parallel-plans note — no blockers introduced for those plans.
- No code was touched; the existing `node --test` suite is unaffected (confirmed via the `.ts`/`.mts`/`.mjs` non-regression grep, which returned 0).

## Self-Check: PASSED

- FOUND: docs/phase0-binmon-findings.md
- FOUND: docs/stock-vice-parity.md
- FOUND: .planning/phases/01-corrected-ground-truth/01-01-SUMMARY.md
- FOUND commit: e9d7cae (Task 1)
- FOUND commit: 2005fce (Task 2)
- FOUND commit: 4dd3437 (Task 3)
- FOUND commit: 69bbb18 (SUMMARY commit)

---
*Phase: 01-corrected-ground-truth*
*Completed: 2026-08-12*
