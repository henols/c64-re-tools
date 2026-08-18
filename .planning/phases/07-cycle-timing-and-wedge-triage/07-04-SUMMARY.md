---
phase: 07-cycle-timing-and-wedge-triage
plan: 04
subsystem: docs
tags: [documentation, constraints, drift-correction, phase0-findings]
requires: []
provides:
  - "CLAUDE.md and PROJECT.md cite vice-proxy.ts:2889 (and :1368) for rewriteArguments() call sites"
  - "docs/phase0-binmon-findings.md §1 marks the frame-counter stopwatch fallback SUPERSEDED"
affects:
  - "any future contributor reading the interception constraint or the cycle-stopwatch recommendation"
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - CLAUDE.md
    - .planning/PROJECT.md
    - docs/phase0-binmon-findings.md
decisions: []
metrics:
  duration: "~15m"
  completed: 2026-08-18
---

# Phase 07 Plan 04: Correct Drifted Citations and Supersede a Rejected Fallback Summary

Corrected a drifted line citation for `rewriteArguments()` (2773 -> 2889, plus a newly-cited
second call site at 1368) in `CLAUDE.md`/`PROJECT.md`, and marked `docs/phase0-binmon-findings.md`
§1's frame-counter stopwatch fallback SUPERSEDED with the D-11 trace-guard arithmetic that
rejects it.

## What Was Built

**Task 1 — Corrected `rewriteArguments()` line citations.** `CLAUDE.md` and `.planning/PROJECT.md`
both cited `vice-proxy.ts:2773` for the `forwardToVice()` call site of `rewriteArguments()`; the
call site has drifted (confirmed by direct grep) to `vice-proxy.ts:2889`. Updated both files
identically, and additionally cited the second `rewriteArguments()` call site inside
`gatherWedgeEvidence()` at `vice-proxy.ts:1368` (previously named but not line-cited). Added a
parenthetical noting that line numbers in this bullet are re-checked per phase and drift is
expected — a future mismatch should read as staleness to re-verify, not as the constraint itself
having changed. The constraint text itself ("derived tools must be intercepted before
`forwardToVice()`, not behind `call()`") was left untouched, per the plan's explicit instruction.

**Task 2 — Marked the frame-counter stopwatch fallback SUPERSEDED.** `docs/phase0-binmon-findings.md`
§1 ("Cycle stopwatch — RESOLVED") proposed a frame-counter reconstruction
(`cycles = frames * 19656 (PAL) + Δ(LIN * 63 + CYC)`) driven by a non-stopping exec checkpoint at
`$EA31`. That checkpoint fires ~50.1 times/second on PAL and ~59.8 on NTSC — well above this
client's own D-11 trace-hazard guard (`TRACE_HITS_PER_SECOND_LIMIT = 20` in
`.claude/mcp/vice/stock-checkpoints.ts`), which auto-disables a hot non-stopping checkpoint via
its own `CHECKPOINT_TOGGLE` with `enabled:false`. Inserted a SUPERSEDED note directly beneath the
frame-counter bullet naming the two replacement routes (Route A: `CPUHISTORY_GET`'s monotonic
uint64 cycle field on VICE >= 3.10; Route B: `LIN`/`CYC` reconstruction that refuses explicitly
rather than guessing across a crossed frame boundary, below 3.10). Also corrected the following
bullet's claim that the reconstruction was "a second, always-available stopwatch" chosen via
"measured socket cost" — with the guard in place it was never always-available, and Phase 7
rejected the fallback outright rather than picking between routes on cost. The rest of §1
(`e_Cycle`/`e_Rasterline`, `REGISTERS_GET`'s `LIN`/`CYC` availability, the `CPUHISTORY_GET`
version gate, the `RL`/`CY` condition-token finding) was left untouched.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; this plan touches
prose only, no code.

## Verification

- `grep -rn "vice-proxy.ts:2773" CLAUDE.md .planning/PROJECT.md` returns nothing. Confirmed.
- `grep -c "vice-proxy.ts:2889"` and `grep -c "vice-proxy.ts:1368"` both return 1 in each of
  `CLAUDE.md` and `.planning/PROJECT.md`. Confirmed.
- The Architecture constraint bullet is byte-identical between `CLAUDE.md` and
  `.planning/PROJECT.md` (verified by diffing the extracted lines — identical text). Confirmed.
- `docs/phase0-binmon-findings.md` §1 contains a SUPERSEDED note between the `## 1.` and `## 2.`
  headings naming `TRACE_HITS_PER_SECOND_LIMIT`, `20`, `Route A`, and `Route B`. Confirmed via
  `awk` range check and `grep -c`.
- `grep -c "second, always-available" docs/phase0-binmon-findings.md` returns 0 — the superseded
  claim was corrected, not merely annotated. Confirmed.
- `grep -c "RL" docs/phase0-binmon-findings.md` returns 5 (non-zero) and the `CPUHISTORY_GET`
  version-gate bullet is still present — the rest of §1 was not collaterally edited. Confirmed.
- `cd .claude/mcp/vice && npm run test:automated`: ran 1426 tests, 1392 pass, 29 fail, 5 todo.
  All 29 failures are in broker/build/mastra-telemetry infrastructure (`vice-broker`,
  `resources build`, `handleAcquire`/`handleRelease`, live-installed-tree telemetry checks) —
  none reference `CLAUDE.md`, `.planning/PROJECT.md`, or `docs/phase0-binmon-findings.md`, and a
  diff against the plan's base commit (`c38a4df`) confirms only those three doc files changed in
  this plan's commits. These failures are pre-existing and out of scope for this doc-only plan
  (deviation-rules scope boundary); not fixed here.

## Known Stubs

None — this plan produced no code, no UI, and no data-wiring surface.

## Threat Flags

None — this plan modified prose only; no new network endpoints, auth paths, file access
patterns, or schema changes were introduced. Both threat-register items (T-07-11, T-07-12) were
mitigated as specified: the frame-counter fallback is marked SUPERSEDED with its rejecting
arithmetic, and the interception-constraint citation is corrected with a per-phase drift note.

## Self-Check: PASSED

- FOUND: CLAUDE.md
- FOUND: .planning/PROJECT.md
- FOUND: docs/phase0-binmon-findings.md
- FOUND: .planning/phases/07-cycle-timing-and-wedge-triage/07-04-SUMMARY.md
- FOUND: commit 0c3cd38 (Task 1 — rewriteArguments() line citations)
- FOUND: commit f22bd53 (Task 2 — SUPERSEDED note)
- FOUND: commit bbfb802 (this summary)
