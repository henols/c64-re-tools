---
phase: 01-corrected-ground-truth
plan: 02
subsystem: docs
tags: [vice-binary-monitor, protocol-docs, constraints-synthesis, adr]

# Dependency graph
requires:
  - phase: 01-corrected-ground-truth
    provides: "01-RESEARCH.md's source-verified error inventory and drafted replacement text"
provides:
  - "constraints.md with four constraint blocks corrected to agree with the normative protocol facts"
  - "docs/roadmap-stock-vice.md fully corrected on pause model, five-event coverage, and wire-framing paraphrase"
affects: [phase-2-protocol-client, phase-7-timing-design]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/intel/constraints.md
    - docs/roadmap-stock-vice.md

key-decisions:
  - "CON-no-pause-now-opcode retired and renamed to CON-inbound-byte-halts-machine rather than left in place with corrected prose, per the plan's explicit instruction that the constraint NAME itself asserted the retracted fact"
  - "The wire-framing paraphrase in docs/roadmap-stock-vice.md's Phase 1 description was corrected to the real 11-byte header field order (including api_version) as an intentional adjacent fix beyond DOC-01's literal text, since the sentence naming the five events was being rewritten anyway"

requirements-completed: [DOC-03, DOC-01]

# Metrics
duration: 18min
completed: 2026-08-12
---

# Phase 1 Plan 02: Corrected Constraints and Roadmap Summary

**Rewrote four constraint blocks in `constraints.md` (stopwatch version-gate, monotonic-cycle reconstruction route, retired pause-now opcode, five-event demux) and fully corrected `docs/roadmap-stock-vice.md`'s pause model, event coverage, and wire-framing paraphrase.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-12T12:56:00Z (approx, worktree setup)
- **Completed:** 2026-08-12T13:13:42Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `CON-stopwatch-via-cpuhistory` moved from PROVISIONAL-on-build-flag to SETTLED, version-gated on VICE >= 3.10 with the INVALID_TYPE (0x83) vs CMD_FAILURE (0x8f) distinction
- `CON-no-monotonic-cycle-register` no longer claims `REGISTERS_GET` cannot serve as a stopwatch; documents the LIN/CYC + frame-count reconstruction route and the CHECKPOINT_INFO cost warning
- `CON-no-pause-now-opcode` retired and replaced with `CON-inbound-byte-halts-machine`, citing `monitor_startup_trap()` on any inbound byte
- `CON-async-event-demux` corrected from three to five unsolicited event types, with the shared-response-type demux hazard called out
- `docs/roadmap-stock-vice.md`'s three pause-on-demand claims replaced with the resolved fact; its Phase 1 description now names all five event types and the correct 11-byte header field order; its Verification section points at the future `docs/phase1-probe-results.md`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the four affected constraint blocks in .planning/intel/constraints.md** - `fe4352c` (docs)
2. **Task 2: Fully correct the pause model and event coverage in docs/roadmap-stock-vice.md** - `17b3ec4` (docs)

**Plan metadata:** committed alongside this SUMMARY (see below)

_Note: no TDD tasks in this plan — both tasks are markdown-only edits._

## Files Created/Modified
- `.planning/intel/constraints.md` - four constraint blocks rewritten, file header corrected to remove the stale PROVISIONAL-items promise
- `docs/roadmap-stock-vice.md` - pause model, event coverage, wire-framing paraphrase, and Verification section corrected; dated status banner added

## Decisions Made
- Retired `CON-no-pause-now-opcode` by name (renamed to `CON-inbound-byte-halts-machine`) rather than keeping the old ID with corrected prose, per the plan's instruction that the ID itself asserted the retracted fact. Verified no dangling reference to the old ID remains anywhere in `constraints.md`.
- Corrected the wire-framing paraphrase in `docs/roadmap-stock-vice.md`'s Phase 1 description (field order + `api_version`) as an intentional adjacent fix while already rewriting that sentence for the five-event correction — this is beyond DOC-01's literal text but was explicitly authorized by the plan (`<action>` note: "record it in the plan summary").
- Added a "Resolved" note to `docs/roadmap-stock-vice.md`'s gaps section rather than leaving the corrected item listed as a bullet inside "C. Gaps / must-verify", since a settled item does not belong in an unresolved-risks list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gate-hygiene violation from re-quoting banned phrases in my own added prose**
- **Found during:** Task 1 and Task 2, self-verification against the acceptance-criteria grep gates
- **Issue:** My first drafts of the corrected file header (constraints.md) and status banner (roadmap-stock-vice.md) used the literal words "PROVISIONAL" / "OUTSTANDING" and the phrase "pause model" while describing that those states no longer applied — which the zero-count acceptance gates correctly flag as still present in the file (the gates check for *any* occurrence, not just in the removed context). Also missed that "run/pause model" in the Doability section contains "pause model" as a substring.
- **Fix:** Rephrased the constraints.md header to avoid the literal words entirely ("every item below has a settled status now... the one remaining unresolved item, `CON-probe-outstanding`, is resolved by the empirical probe run"), and rephrased both the roadmap-stock-vice.md status banner ("on-demand-halt behavior" instead of "pause model") and the Doability paragraph ("on-demand halting is settled" instead of "run/pause model").
- **Files modified:** `.planning/intel/constraints.md`, `docs/roadmap-stock-vice.md`
- **Verification:** Re-ran all acceptance-criteria grep commands from the plan; all now return the exact expected counts.
- **Committed in:** `fe4352c`, `17b3ec4` (part of each task's single commit — caught before committing, not as a follow-up fix)

---

**Total deviations:** 1 auto-fixed (1 bug — self-caught gate-hygiene violation, fixed before commit)
**Impact on plan:** No scope creep; the fix was purely wording precision to satisfy the plan's own zero-count gates. No additional files touched.

## Issues Encountered
- Worktree branch check found the worktree's HEAD (`68b0a79`, an ancestor of the intended base) behind the expected base commit `5033cb7283d605a34188056874eebcfd9072d25e`. Per the mandated branch-check protocol, ran `git reset --hard` to the expected base after confirming `git status --short` showed no uncommitted changes. This is expected worktree-setup behavior, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `constraints.md` now agrees with the corrected normative protocol facts and is safe for Phase 2's PROTO-03/PROTO-04 (event demux) and Phase 7's timing-design decision to read directly.
- `docs/roadmap-stock-vice.md` no longer misleads a reader on pause model, event set, or wire framing; its Verification section forward-references `docs/phase1-probe-results.md`, which plan `01-04` (same phase, same wave structure) will produce.
- No blockers for the remainder of Phase 1.

---
*Phase: 01-corrected-ground-truth*
*Completed: 2026-08-12*

## Self-Check: PASSED

- FOUND: `.planning/intel/constraints.md`
- FOUND: `docs/roadmap-stock-vice.md`
- FOUND: `.planning/phases/01-corrected-ground-truth/01-02-SUMMARY.md`
- FOUND commit: `fe4352c`
- FOUND commit: `17b3ec4`
