---
phase: 18-persistent-session-and-tool-surface
plan: 07
subsystem: phase-validation
tags: [regenerator2000, settings, package-gate, validation]
requires:
  - phase: 18-06
    provides: FIFO serialization and lost-update proof
provides:
  - Live D18-35 settings round-trip and no-revert proof
  - Recorded Phase 18 gate evidence and requirement mapping
requirements-completed: [SESS-01, SESS-02, SESS-03, SESS-04, SURF-01, SURF-02]
completed: 2026-08-24
status: complete
---

# Phase 18 Plan 07: Gate Summary

**The phase is closed by a live settings round trip, full Node 22 gate, package checks, and explicit evidence for all six requirements.**

## Accomplishments

- Added D18-35: a real held session forces `use_illegal_opcodes` before spawn, preserves it across the child's own save, and decodes the fixture's illegal instruction.
- Added the mismatched-system refusal check: it raises `R2000ProjectSettingsError`, spawns no child, and leaves the project byte-identical.
- Proved the settings test non-vacuous by temporarily removing the session-open forcing call. The first half failed with `D18-35 first half: session open must force use_illegal_opcodes on disk -- false !== true`; the call was restored before commit.
- Recorded the complete phase gate in `18-PHASE-GATE-EVIDENCE.md` and replaced every validation-map TBD with a green executed test.
- Made the `repoRoot()` fallback tests deterministic in environments whose `/tmp` has a `.git` marker by injecting only the marker lookup used by those tests; production still uses `existsSync`.

## Verification

- `node --test r2000-session.test.ts` under Node 22.22 passed with the live D18-35 scenarios run.
- `npm test` under Node 22.22 completed with no `not ok` records.
- Type check, skill coverage, npm-package validation, clean-worktree packaging, and orphan-process check passed; details and the legitimate skip census are in `18-PHASE-GATE-EVIDENCE.md`.

## Notes

The active workspace package command rejects the intentionally reinstalled root `.claude/skills` directory. Packaging passed from a clean detached worktree at the same commit, confirming the published payload remains valid without deleting or relocating user tooling.
