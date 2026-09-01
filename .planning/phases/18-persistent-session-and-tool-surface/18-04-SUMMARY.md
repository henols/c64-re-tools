---
phase: 18-persistent-session-and-tool-surface
plan: 04
subsystem: anno-session
tags: [the external analyser, error-handling, restart-budget, teardown, mcp-client, node-child-process]

requires:
  - phase: 18-persistent-session-and-tool-surface
    provides: "18-03's anno-session.ts single-slot lifecycle owner and closeAnnoSessionSync() (defined but not yet wired anywhere)"
provides:
  - "AnnoRestartBudgetExhaustedError and AnnoSession.onExit() in anno-mcp-client.ts"
  - "The full restart policy in anno-session.ts: between-calls transparent respawn, loud mid-call/timeout failure, a per-project-path crash counter bounded by DEFAULT_ANNO_RESTART_BUDGET (env-overridable via ANNO_RESTART_BUDGET)"
  - "vice-proxy.ts's teardown region now kills a held anno session synchronously on every exit path"
  - "18-STDIN-EOF-EVIDENCE.md: a measured, reproducible answer to whether a SIGKILLed proxy orphans its the external analyser child"
affects: [18-05, 18-06, 18-07]

actuals:
  tokens: 14500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Session-owned onExit(listener) callback (single listener, no EventEmitter) for surfacing a child's exit to its module-level lifecycle owner without polling"
    - "Env-var-read-at-call-time restart budget (DEFAULT_ANNO_RESTART_BUDGET / ANNO_RESTART_BUDGET), following DEFAULT_ANNO_CALL_TIMEOUT_MS's own convention"
    - "Crash-counter state that outlives session nullness (sessionDead flag distinct from currentSession being null) so a dead-but-not-yet-reopened slot is distinguishable from never-opened"

key-files:
  created:
    - .planning/phases/18-persistent-session-and-tool-surface/18-STDIN-EOF-EVIDENCE.md
    - .planning/phases/18-persistent-session-and-tool-surface/evidence/measure-stdin-eof-driver.mjs
    - .planning/phases/18-persistent-session-and-tool-surface/evidence/measure-stdin-eof-parent.mjs
  modified:
    - src/mcp/vice/anno-mcp-client.ts
    - src/mcp/vice/anno-session.ts
    - src/mcp/vice/anno-session.test.ts
    - src/mcp/vice/vice-proxy.ts
    - CLAUDE.md

key-decisions:
  - "A tool-level AnnoProtocolError (a normal `isError: true` tools/call reply) no longer discards the held session -- only AnnoChildExitError and AnnoTimeoutError do. Plan 18-03's tracer discarded on ANY thrown error; this plan narrows that deliberately, since a protocol-level failure says nothing about the child's health."
  - "The crash counter is scoped to the currently-tracked project path and survives the session going null (via a dedicated sessionDead flag), so a dead-but-not-yet-reopened slot is distinguishable from a slot that was never opened -- this is what lets the restart budget apply BEFORE a wasted respawn attempt, rather than after."
  - "No per-call liveness probe was added, by design (D18-13's own scope note) -- vice-probe.ts's fragility exists for an HTTP-mode accept()-lies-while-blocked shape that a stdio child cannot reproduce; AnnoTimeoutError IS this module's liveness signal."
  - "D18-23 (SIGKILLed-proxy orphan risk) is answered by measurement, not left as an assumption: The external analyser 0.9.20 self-terminates within ~200ms of its stdin reaching EOF, across four repeated runs, so no startup sweep is filed as a follow-on."

requirements-completed: [SESS-02]

coverage:
  - id: D1
    description: "A child that exits between two calls is invisible and lossless -- the next call transparently opens a fresh child and succeeds (D18-11)"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "anno-session.test.ts#stub: a child that exits cleanly between two calls is invisible and lossless -- next call succeeds, openCount +1, crashCount +1, no error"
        status: pass
      - kind: integration
        ref: "anno-session.test.ts#gated (LIVE): a real analyser child killed between calls is invisible and lossless -- openCount 2, crashCount 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "A mid-call death surfaces AnnoChildExitError, is never retried, and does not stick to the session -- the next call opens fresh and succeeds (D18-12)"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "anno-session.test.ts#stub: a child that exits mid-call rejects with AnnoChildExitError, is never retried, and a subsequent call opens a fresh child and succeeds"
        status: pass
      - kind: unit
        ref: "anno-session.test.ts#D18-09 scenario 3: a child killed between a mutating tools/call and its own internal save surfaces a named, distinguishable error"
        status: pass
    human_judgment: false
  - id: D3
    description: "A child that never answers within the call timeout surfaces AnnoTimeoutError, is killed through its own retained handle, and counts as one crash (D18-13)"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "anno-session.test.ts#stub: a child that answers nothing within the call timeout rejects with AnnoTimeoutError, is killed, and the crash counter increases by 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "The restart budget (DEFAULT_ANNO_RESTART_BUDGET, env-overridable) bounds repeated crashes: two crash-respawn-succeed cycles run at budget 2, and the third crash's respawn is refused with AnnoRestartBudgetExhaustedError naming both the observed count and the limit; the counter is never reset by a successful call, only by an explicit test reset or a project-path change (D18-14)"
    requirement: SESS-02
    verification:
      - kind: unit
        ref: "anno-session.test.ts#stub: with ANNO_RESTART_BUDGET=2, two crash-then-respawn-then-succeed cycles run, and the third crash's respawn is refused with AnnoRestartBudgetExhaustedError naming the count and the limit"
        status: pass
      - kind: unit
        ref: "anno-session.test.ts#stub: crash counting is not reset by an intervening successful call -- crash, success, crash, success, crash still reaches the refusal at budget 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "vice-proxy.ts's teardown region kills a live analyser session synchronously on every exit path, without widening the region's own no-await/no-.then(/no-async structural guard or its exactly-one-controlSession.release() invariant"
    verification:
      - kind: unit
        ref: "vice-proxy.test.ts#teardown region: no promise-awaiting construct, and the control session's release() called exactly once, between its markers"
        status: pass
      - kind: unit
        ref: "anno-session.test.ts#structural: vice-proxy.ts's teardown region calls anno-session.ts's own synchronous close function exactly once (D18-22)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D18-23's stdin-EOF orphan question is answered by measurement against the real 0.9.20 binary, not assumed"
    verification:
      - kind: other
        ref: "evidence/measure-stdin-eof-driver.mjs (run 4x; see 18-STDIN-EOF-EVIDENCE.md)"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-08-24
status: complete
---

# Phase 18 Plan 04: Session Crash Recovery and the Teardown Kill Hook Summary

**A crashed or wedged the external analyser session is now recoverable and attributable: between-call deaths respawn transparently, mid-call/wedge deaths fail loud and are never retried, a named restart budget refuses a genuinely broken project after repeated crashes, and the proxy's own exit no longer orphans a live child — with the SIGKILLed-proxy risk answered by measurement, not assumption.**

## Performance

- **Duration:** 90 min
- **Started:** 2026-08-24T09:45:34Z
- **Completed:** 2026-08-24T10:50:36Z
- **Tasks:** 3
- **Files modified:** 8 (2 created evidence scripts + 1 evidence doc + 5 modified source/doc files)

## Accomplishments

- `AnnoRestartBudgetExhaustedError` (public `crashCount`/`limit` fields) and `AnnoSession.onExit()` land in `anno-mcp-client.ts`, giving `anno-session.ts` a way to learn about a child's exit at any time, not only while a request is pending (D18-10).
- `anno-session.ts` now classifies every failure from the held session: `AnnoChildExitError` clears the slot and never retries; `AnnoTimeoutError` kills the wedged handle through its own retained `ChildProcess` and clears the slot; any other error (a tool-level `AnnoProtocolError`) leaves the session in place, since it says nothing about the child's health. This is a deliberate narrowing of plan 18-03's "discard on any error" tracer policy.
- `DEFAULT_ANNO_RESTART_BUDGET = 3`, overridable via `ANNO_RESTART_BUDGET` (read at call time, matching `DEFAULT_ANNO_CALL_TIMEOUT_MS`'s own convention), bounds the crash counter per project path within one working session. The counter resets in exactly two places — `__resetAnnoSessionForTest()` and the project-path-change eviction branch — and is proven, by a dedicated test, to survive an alternating crash/success sequence without ever resetting on success.
- 7 new tests in `anno-session.test.ts` cover every `<behavior>` row from the plan (between-calls death, mid-call death with a no-retry frame-count assertion, wedge timeout, budget exhaustion, crash-not-reset-by-success), plus one **live** test that SIGKILLs a real `the external analyser` child between calls and confirms transparent respawn (`openCount` 2, `crashCount` 1) — not only the stub-driven happy path.
- `vice-proxy.ts`'s `onTeardown()` now calls `anno-session.ts`'s synchronous close function after `releaseLeaseNow()`, so SIGINT/SIGTERM/SIGHUP/stdin-close all kill a held session before the proxy exits (D18-22). The region's structural guard (`vice-proxy.test.ts`) passes unmodified.
- `18-STDIN-EOF-EVIDENCE.md` measures D18-23 directly against the real `the external analyser 0.9.20` binary: a `SIGKILL`ed parent process (no exit hook of any kind) still leaves the child observing stdin EOF and self-terminating within ~200ms, across four repeated runs. **No startup sweep is required** — this closes D18-23 as a measured fact rather than an assumption.

## Task Commits

Each task was committed atomically:

1. **Task 1: Exit tracking, transparent respawn, loud mid-call failure, bounded restart budget** - `89b7471` (feat)
2. **Task 2: SESS-02's proof — stub-driven crash scenarios and a live kill** - `2f4d5b8` (test)
3. **Task 3: The clean-exit hook, and measuring the orphan question instead of assuming it** - `1c9d103` (feat)

**Plan metadata:** committed as part of this SUMMARY commit.

## Files Created/Modified

- `src/mcp/vice/anno-mcp-client.ts` - `AnnoRestartBudgetExhaustedError`/`AnnoRestartBudgetExhaustedErrorOptions`; `AnnoSession.onExit()` registration and wiring inside `openAnnoSession()`'s exit handler
- `src/mcp/vice/anno-session.ts` - the full restart policy: `DEFAULT_ANNO_RESTART_BUDGET`, `currentRestartBudget()`, `sessionDead`/`crashCount` module state, `handleSessionExit()`, the classified catch in `runInAnnoSession()`, an optional `RunInAnnoSessionOptions.timeoutMs`, and `crashCount`/`dead` added to `__annoSessionStateForTest()`
- `src/mcp/vice/anno-session.test.ts` - 8 new tests (7 stub-driven behavior tests + 1 live kill test) plus a structural test pinning the teardown wiring
- `src/mcp/vice/vice-proxy.ts` - static import of `closeAnnoSessionSync`; one call added inside `onTeardown()`
- `CLAUDE.md` - repaired the two `vice-proxy.ts:<N>` line citations in the `rewriteArguments()` bullet, which drifted after this plan's own edits shifted line numbers (see Deviations)
- `.planning/phases/18-persistent-session-and-tool-surface/18-STDIN-EOF-EVIDENCE.md` - the D18-23 measurement record
- `.planning/phases/18-persistent-session-and-tool-surface/evidence/measure-stdin-eof-{parent,driver}.mjs` - the reproducible measurement scripts

## Decisions Made

- **Narrowed the discard-on-any-error policy to two error classes.** Plan 18-03's tracer discarded the held session on ANY thrown error. This plan's task 1 deliberately narrows that: only `AnnoChildExitError` and `AnnoTimeoutError` clear the slot; every other error (chiefly `AnnoProtocolError`, a normal tool-level failure) leaves the session in place, since a bad tool call says nothing about the child's own health. This was specified by the plan's own action text, not an ad hoc choice.
- **Crash state outlives session nullness.** `sessionDead` is a dedicated flag, separate from `currentSession === null`, so a "dead, awaiting the budget check" slot is distinguishable from "never opened" — this is what lets the restart-budget check run BEFORE a respawn attempt rather than discovering exhaustion only after wasting a spawn.
- **No per-call liveness probe.** Considered and rejected per D18-13's own scope note: `vice-probe.ts`'s fragility targets an HTTP-mode `accept()`-lies-while-blocked failure a stdio child cannot reproduce, and probing before every call would reintroduce most of the round-trip cost the persistent session was built to remove.
- **Explicit close vs. crash are kept distinct.** `closeAnnoSessionSync()` (used at teardown) does not increment the crash counter or set `sessionDead` — it is an intentional close, not a crash. The live kill test in task 2 verifies this by killing the real child directly (`process.kill(pid, "SIGKILL")`), bypassing `closeAnnoSessionSync()`, so the crash counter increments exactly as it would for a genuine, unplanned death.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired CLAUDE.md's line-number citations after they drifted**
- **Found during:** Task 3 final verification (`cd src/mcp/vice && npm test`)
- **Issue:** CLAUDE.md pins two `vice-proxy.ts:<N>` line citations in its `rewriteArguments()` bullet, mechanically checked by `docs-linerefs.test.ts`. Task 3's new static import (`closeAnnoSessionSync`) and its accompanying comment added 6 lines above both `gatherWedgeEvidence()` (was `:1501`, now `:1507`; its `rewriteArguments()` call was `:1525`, now `:1531`) and `forwardToVice()` (was `:2981`, now `:2987`; its call was `:3046`, now `:3052`), turning `docs-linerefs.test.ts` red and, by cascade, `audit-integrity.test.ts`'s D-12-02 check (which refuses a gated milestone status while any docs guard is red).
- **Fix:** Updated the four line numbers in CLAUDE.md's `rewriteArguments()` bullet to match the post-edit source. CLAUDE.md's own text names this exact situation as expected drift to re-verify, not evidence the constraint changed.
- **Files modified:** `CLAUDE.md`
- **Verification:** `docs-linerefs.test.ts` and `audit-integrity.test.ts` both green on re-run; full `npm test` re-run clean (2388 pass, 0 fail).
- **Committed in:** `1c9d103` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking fix).
**Impact on plan:** Required for the plan's own full-suite verification requirement to hold. No scope creep — a direct, mechanical consequence of the plan's own line additions to `vice-proxy.ts`.

## Issues Encountered

A transient full-suite run (before the CLAUDE.md fix above) showed 2 failures (`docs-linerefs.test.ts` and the cascading `audit-integrity.test.ts` D-12-02 check) caused by the line-number drift described above. Fixed and re-verified clean; not a regression in the restart-policy or teardown logic itself.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `anno-session.ts`'s restart policy (crash counter, `sessionDead`, classified catch) is a stable foundation plan 18-06's serialisation mutex (D18-17) builds on directly — that plan should compose with, not duplicate, this plan's crash bookkeeping.
- `vice-proxy.ts`'s teardown region now has TWO call sites of interest for future plans to be aware of (`releaseLeaseNow()` and the new `closeAnnoSessionSync()` call) — plan 18-05 edits `vice-proxy.test.ts` next; this plan's own structural test for the anno side deliberately lives in `anno-session.test.ts` instead, to avoid file contention.
- `18-STDIN-EOF-EVIDENCE.md`'s measurement scripts (`evidence/measure-stdin-eof-{parent,driver}.mjs`) are reproducible and can be re-run against a future analyser version if that binary's own EOF-handling behavior is ever in question again.
- No blockers for the next plan in this phase.

---
*Phase: 18-persistent-session-and-tool-surface*
*Completed: 2026-08-24*

## Self-Check: PASSED

- `src/mcp/vice/anno-mcp-client.ts` — FOUND, contains `AnnoRestartBudgetExhaustedError`
- `src/mcp/vice/anno-session.ts` — FOUND, contains `DEFAULT_ANNO_RESTART_BUDGET`
- `src/mcp/vice/anno-session.test.ts` — FOUND, 15 tests passing (8 new + 7 pre-existing)
- `src/mcp/vice/vice-proxy.ts` — FOUND, teardown region calls `closeAnnoSessionSync(` exactly once
- `.planning/phases/18-persistent-session-and-tool-surface/18-STDIN-EOF-EVIDENCE.md` — FOUND
- `.planning/phases/18-persistent-session-and-tool-surface/evidence/measure-stdin-eof-driver.mjs` — FOUND
- `.planning/phases/18-persistent-session-and-tool-surface/evidence/measure-stdin-eof-parent.mjs` — FOUND
- Commit `89b7471` (feat: exit tracking, transparent respawn, bounded restart budget) — FOUND in `git log`
- Commit `2f4d5b8` (test: SESS-02's proof) — FOUND in `git log`
- Commit `1c9d103` (feat: teardown kill hook + stdin-EOF measurement) — FOUND in `git log`
- `cd src/mcp/vice && npx tsc --noEmit -p tsconfig.json` — exit 0
- `cd src/mcp/vice && npm test` (plain, full suite) — 2388 pass, 0 fail, 39 skipped, 5 todo, exit 0, ~104s
- `git diff --stat src/mcp/vice/vice-proxy.test.ts` — empty
- `git diff --stat src/mcp/vice/anno-mcp-client.test.ts` — empty
- `pgrep -f 'the external analyser --mcp-server-stdio'` — no real leftover process (only the invoking shell's own command line, a known false positive)
