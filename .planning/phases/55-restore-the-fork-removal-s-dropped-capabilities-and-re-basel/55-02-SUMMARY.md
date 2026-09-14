---
phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel
plan: 02
subsystem: testing
tags: [incident-record, epoch, recycle, stock-vice, dependency-injection]

# Dependency graph
requires:
  - phase: 55-01
    provides: "Result chunking restored at the tools/call choke point (unrelated file, no overlap)"
provides:
  - "A producer for the incident record's epoch_after field: a bounded, environment-overridable post-kill epoch poll in stock-recycle.ts"
  - "10 new automated-gate tests pinning both branches (advance/stall), first-appearance, never-present, no-epoch-file, throwing-reader, and both non-successful-kill outcomes"
affects: ["55-03 (deletes vice-proxy.test.ts's now-superseded proxy-side witness for this behaviour)"]

actuals:
  tokens: 5156
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Call-time environment-override reader with a positivity check and logged rejection (stockRecycleEpochPollTimeoutMs()), mirroring the existing stockCaptureStepTimeoutMs() shape but under its OWN env var name so one knob cannot silently retune the other."
    - "Single advancement predicate gates promotion into a permanent record: present AND (before is null OR strictly greater) -- never presence alone."

key-files:
  created: []
  modified:
    - src/mcp/vice/stock-recycle.ts
    - src/mcp/vice/stock-recycle.test.ts

key-decisions:
  - "New env var VICE_RECYCLE_EPOCH_POLL_TIMEOUT_MS (default 3000ms), deliberately distinct from VICE_RECYCLE_CAPTURE_TIMEOUT_MS -- the two knobs govern different things (one evidence-gathering step before the kill vs. the epoch poll after it) and must not share a name."
  - "The poll reuses the SAME session.deps.readEpochFn / lease.epochFile the pre-kill read already uses, so before/after come from one source with no new DI seam."
  - "epoch_after is passed to exactly the confirmed-kill finaliseIncidentRecord() call; the refused/timeout/broker-gone/internal call sites are byte-unchanged."
  - "The readiness probe that used to accompany the fork's own epoch poll was deliberately NOT restored -- its module was deleted with the fork backend and is out of this plan's scope."

patterns-established:
  - "A throw from an injected epoch reader is caught and treated as 'did not advance', never as a fatal error -- a failed bookkeeping read must not end a handler that runs after a destructive action already happened."

requirements-completed: [PROXY-02]

coverage:
  - id: D1
    description: "A confirmed kill whose epoch advances within the poll deadline persists that new value as epoch_after"
    requirement: "PROXY-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts#handleRecycleStock: a confirmed kill whose epoch reader advances finalises the record with the new epoch_after"
        status: pass
    human_judgment: false
  - id: D2
    description: "A confirmed kill whose epoch never advances persists epoch_after as null, never the stale epoch_before value"
    requirement: "PROXY-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts#handleRecycleStock: a confirmed kill whose epoch never advances finalises the record with epoch_after null, never the stale epoch_before value"
        status: pass
    human_judgment: false
  - id: D3
    description: "The poll is bounded and its deadline is overridable from the environment; a test drives the never-advances case in well under a second"
    requirement: "PROXY-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts#stockRecycleEpochPollTimeoutMs(): 0, negative, and non-numeric overrides all fall back to the default, with the rejection logged"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts#handleRecycleStock: a confirmed kill whose epoch never advances finalises the record with epoch_after null, never the stale epoch_before value"
        status: pass
    human_judgment: false
  - id: D4
    description: "A refused, timed-out, or broker-gone recycle still finalises with no epoch claim and no additional epoch reads"
    requirement: "PROXY-02"
    verification:
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts#handleRecycleStock: a refused (non-killing) ack makes no additional epoch reads -- the poll never runs when the machine's state is unknown"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/stock-recycle.test.ts#handleRecycleStock: a broker_gone recycle outcome makes no additional epoch reads -- the poll never runs when the machine's state is unknown"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both branches of the producer are covered inside the automated gate, not only by a manual-only file"
    requirement: "PROXY-02"
    verification:
      - kind: unit
        ref: "npm run test:automated (stock-recycle.test.ts, part of the default node --test glob)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-14
status: complete
---

# Phase 55 Plan 02: Restore the incident record's epoch_after producer Summary

**Bounded, environment-overridable post-kill epoch poll in `stock-recycle.ts` gives the incident record's `epoch_after` field a producer again, pinned by 10 new automated-gate tests.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `stockRecycleEpochPollTimeoutMs()` (default 3000ms, env override `VICE_RECYCLE_EPOCH_POLL_TIMEOUT_MS`, rejects non-positive values with a logged reason) following the existing `stockCaptureStepTimeoutMs()` shape.
- Added `pollEpochAfter()`: reuses the pre-kill read's same `readEpochFn`/`epochFile`, loops with a clamped sleep until either the epoch advances (`epochAdvanced()` predicate: present AND (before is null OR strictly greater)) or the deadline passes, treating a thrown read as "did not advance".
- Wired the poll's result into the ONE confirmed-kill `finaliseIncidentRecord()` call as `epoch_after`; the other two call sites (non-ok RPC, refused ack) are untouched.
- Added 10 tests to `stock-recycle.test.ts`: the advance branch, the stall branch (with an explicit assertion that `epoch_after` never equals the stale `epoch_before`), first-appearance, never-present, no-epoch-file, a throwing reader, both non-successful-kill outcomes (asserting zero additional epoch reads), and the deadline reader's default/override/rejection shape.

## Task Commits

1. **Task 1: Restore the bounded post-kill epoch poll in stock-recycle.ts** - `1037f8cb` (feat)
2. **Task 2: Pin both branches of the producer in the automated suite** - `b2e553f2` (test)

**Plan metadata:** (orchestrator-owned; not committed by this executor)

## Files Created/Modified
- `src/mcp/vice/stock-recycle.ts` - added `stockRecycleEpochPollTimeoutMs()`, `epochAdvanced()`, `pollEpochAfter()`; wired the poll's result into the confirmed-kill `finaliseIncidentRecord()` call
- `src/mcp/vice/stock-recycle.test.ts` - added `readEpochFn` injection to the fake-session harness, `fakeEpoch()`/`ABSENT_EPOCH`/`scriptedEpochReader()`/`frontmatterField()`/`withEpochPollTimeout()` helpers, and 10 new tests

## Decisions Made
- Gave the poll deadline its own environment variable (`VICE_RECYCLE_EPOCH_POLL_TIMEOUT_MS`), distinct from `VICE_RECYCLE_CAPTURE_TIMEOUT_MS`, per the plan's explicit instruction that one knob must not silently retune the other.
- Did not restore the fork's readiness probe that used to accompany the epoch poll — its module was deleted with the fork backend and restoring it was explicitly out of scope (plan prohibition, honored).
- Placed the poll call directly before the confirmed-kill `finaliseIncidentRecord()`, after the `successfulKill` guard, so the answer-building and disconnect ordering already documented in the file's own header comment is unchanged.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>`, `<acceptance_criteria>`, and `<verify>` steps matched the measured code shape (`lease.epochFile`, `session.deps.readEpochFn`, `stockCaptureStepTimeoutMs()`'s call-time-reader pattern) exactly as the plan's own MEASURED note predicted.

## Issues Encountered
- The full `npm run test:automated` run failed once on an unrelated, pre-existing leaked scratch directory under `installer/skills/acme-build/` (a known cross-session race documented in project memory as "Suite races on repo-tree scratch files"). The directory was gone on inspection (likely cleaned up by a parallel session) and a re-run was green with no code changes — not a regression from this plan's files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `epoch_after` now has a real producer; `55-03` can proceed to delete `vice-proxy.test.ts`'s superseded proxy-side witness for this behaviour, now that this file's coverage exists.
- No blockers. `npm run test:automated`: 4407 -> 4417 tests (delta of 10, matching the new case count exactly), 0 failures, 9 skips unchanged. Permanent incident directory entry count: 0 before, 0 after (unchanged, no leakage).

---
*Phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/mcp/vice/stock-recycle.ts
- FOUND: src/mcp/vice/stock-recycle.test.ts
- FOUND: .planning/phases/55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel/55-02-SUMMARY.md
- FOUND commit: 1037f8cb (feat: bounded post-kill epoch poll)
- FOUND commit: b2e553f2 (test: pin both branches in the automated gate)
