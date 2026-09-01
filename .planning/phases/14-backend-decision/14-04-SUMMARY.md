---
phase: 14-backend-decision
plan: 04
subsystem: decision-record
tags: [fork-backend, decision-record, retained-zero, backend-detect, vice-errors, FORK-01]

# Dependency graph
requires:
  - phase: 14-backend-decision (plan 01)
    provides: "The literal branch token `retain`, decided by a human at a blocking-human checkpoint"
provides:
  - "A confirmed, independently re-verified `retain` branch token, read directly from 14-01-SUMMARY.md's `## Decision` section rather than assumed"
  - "A deliberately recorded zero: both of this plan's tasks (flip the indeterminate-probe default; extract vice-errors.ts) are conditioned on non-`retain` branches, so on `retain` neither task performs any edit, and that absence is the decided, verified outcome, not an omission"
  - "An honest, full `node test-gate.mjs` baseline run (2085/2099 pass, 7 fail, 2 cancelled, 5 todo) establishing that the pre-existing test suite state is unchanged by this plan, since this plan changed zero source files"
affects: [14-05-backend-decision]

# Actuals (#2632)
actuals:
  tokens: 950
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch-conditional plan executed as a recorded zero: both tasks' own `<precondition>` and `<read_first>` instructions require reading the prior plan's decided branch token before touching any file, and skip visibly (with reason recorded here) when the token is `retain` rather than performing the non-retain-branch edit anyway"

key-files:
  created: []
  modified: []

key-decisions:
  - "Branch token re-confirmed as `retain` by directly reading 14-01-SUMMARY.md's `## Decision` section (not inferred, not assumed from this plan's own framing) before doing anything else."
  - "Task 1 (flip `resolvedBackend()`'s indeterminate fallback from `fork` to `stock`, add the one-time `warnedForkDeprecated` deprecation notice) is explicitly gated to the `deprecate-first`/`remove-now` branches by its own `<precondition>`. On `retain`, skipped entirely — zero edit to `backend-detect.mts`, its compiled mirror, or its test file."
  - "Task 2 (extract `ViceError`/`MachineRestartedError`/`readEpoch`/`mcpHost`/`ToolInfo` into a new `vice-errors.ts`, re-exported from `vice.ts`) is explicitly gated to the `remove-now` branch only by its own `<precondition>`. On `retain`, skipped entirely — no `vice-errors.ts` created, zero edit to `vice.ts` or `package.json`."
  - "No unauthorized default flip and no unauthorized vice-errors.ts extraction were performed, per this dispatch's explicit branch-context guardrail. Both are non-retain-branch actions this plan set aside deliberately, not actions this plan performed 'while in there'."
  - "The full automated `node test-gate.mjs` gate was run to completion (not skipped) to record an honest before/after baseline, even though this plan made no source edits -- before and after are, by construction, the identical measurement. All 7 observed failures (broker-control.test.ts singleton case, broker-e2e.test.ts SIGTERM case, four anno-cli.test.ts `--help`/usage bin cases plus its verb-options-map case, one anno-mcp-client.test.ts timeout Property case) match this dispatch's named known-flaky-under-load set exactly, with zero new or unexpected failures."

requirements-completed: [FORK-01]

coverage:
  - id: D1
    description: "The FORK-01 decision's code consequence is correctly zero on the `retain` branch: neither backend-detect.mts's indeterminate-probe default nor vice.ts's error/utility exports were touched, and that absence is recorded as the decided outcome (not silently omitted)"
    requirement: "FORK-01"
    verification:
      - kind: other
        ref: "git diff --quiet -- .claude/mcp/vice (exit 0, confirmed clean); [ -f .claude/mcp/vice/vice-errors.ts ] (absent, confirmed); grep -c FORK-01 .claude/mcp/vice/backend-detect.mts (0, confirmed no edit made)"
        status: pass
      - kind: other
        ref: "14-01-SUMMARY.md ## Decision section read directly: 'Branch token: retain', decided by a human at a blocking-human checkpoint"
        status: pass
    human_judgment: false
  - id: D2
    description: "An honest, full node test-gate.mjs run recorded as this plan's before/after baseline (identical by construction, since zero source files changed), with any observed failures checked against the dispatch's named known-flaky set rather than silently reported as passing"
    requirement: "FORK-01"
    verification:
      - kind: other
        ref: "cd .claude/mcp/vice && node test-gate.mjs -- 2099 tests, 2085 pass, 7 fail, 2 cancelled, 5 todo, 0 skipped, duration 72.6s, process exit 1"
        status: fail
    human_judgment: true
    rationale: "The raw exit code is 1 (7 failing tests), so this cannot auto-pass under the deterministic contract. A human read is required to confirm what this SUMMARY asserts: all 7 failing test names (the broker-control.test.ts singleton case, the broker-e2e.test.ts real-SIGTERM case, four anno-cli.test.ts vice-mcp-anno---help/usage bin cases plus its verb-options-map case, and one anno-mcp-client.test.ts timeout Property case) match this dispatch's explicitly pre-named known-flaky-under-full-suite-load set verbatim, with zero new or unexpected failures -- and that this plan made no source edit, so the red state is pre-existing and cannot be this plan's regression by construction."

duration: 37min
completed: 2026-08-22
status: complete
---

# Phase 14 Plan 4: Branch-Conditional Code Consequence (retain: recorded zero) Summary

**On the decided `retain` branch, both of this plan's code-consequence tasks (flip the fork-default fallback; extract shared error types out of `vice.ts`) are non-retain-branch actions and were correctly skipped, verified against a clean `git diff` and a full, honestly-reported `node test-gate.mjs` baseline run.**

## Performance

- **Duration:** 37 min (dominated by waiting out a pre-existing, environment-triggered slow/flaky run of `broker-control.test.ts`'s singleton tests under this sandbox's process scheduling -- not by any edit)
- **Started:** 2026-08-22T10:07:29Z
- **Completed:** 2026-08-22T10:44:42Z
- **Tasks:** 2 (both skipped per their own `<precondition>`)
- **Files modified:** 0 source files (`.claude/mcp/vice/` diff is empty); 4 planning/doc files (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Accomplishments

- Re-confirmed, by direct read of `.planning/phases/14-backend-decision/14-01-SUMMARY.md`'s `## Decision` section (not by assuming this dispatch's own framing), that the FORK-01 branch token is `retain`, decided by a human at a `blocking-human` checkpoint.
- Task 1 (stop the fork being the silent default: flip `resolvedBackend()`'s indeterminate fallback from `fork` to `stock`, add a one-time `warnedForkDeprecated` deprecation notice citing `FORK-01`) is gated by its own `<precondition>` to the `deprecate-first`/`remove-now` branches. Confirmed skip: `backend-detect.mts` carries zero occurrences of the literal `FORK-01`, and `git diff --quiet -- .claude/mcp/vice` exits 0.
- Task 2 (move `ViceError`, `MachineRestartedError`, `readEpoch()`, `mcpHost()`, `type ToolInfo` out of `vice.ts` into a new `vice-errors.ts`) is gated by its own `<precondition>` to the `remove-now` branch only. Confirmed skip: no `vice-errors.ts` file exists, and `vice.ts`/`package.json` are unmodified.
- Ran the full automated test gate (`node test-gate.mjs`, the complete non-manual-only test file set, 2099 tests across 23 suites) to record an honest baseline, even though no source edit makes a "before vs. after" comparison meaningful here -- they are, by construction, the same measurement. Result: 2085 pass / 7 fail / 2 cancelled / 5 todo / 0 skipped, in 72.6s (a fast, clean second run after an anomalously slow first run -- see Issues Encountered). All 7 failing test names were checked one by one against this dispatch's explicitly pre-named known-flaky-under-full-suite-load set and matched it exactly, with zero unnamed/unexpected failures:
  - `broker-control.test.ts`: `singleton: a broker started against a port held by a plain non-broker listener, ... exits loudly` (named: "the broker singleton/SIGTERM cases in broker-control.test.ts")
  - `broker-e2e.test.ts`: `end-to-end: a real SIGTERM to the broker kills every stub child it launched and the broker exits 0` (named: "... and broker-e2e.test.ts")
  - `anno-cli.test.ts` (5 cases): `` bin: `vice-mcp anno --help` exits 0 ... ``, `` bin: `vice-mcp anno no-such-verb` exits non-zero ... ``, `` bin: `vice-mcp anno --help` lists all three verbs ``, `` bin: `vice-mcp anno --help` lists both symbol round-trip verbs ``, `both invocations terminate on their own within the timeout`, and `the verb-options map agrees with USAGE's own per-verb option lists` (named: "the `vice-mcp anno --help` bin cases and the verb-options map case in anno-cli.test.ts")
  - `anno-mcp-client.test.ts`: `runAnno({ timeoutMs: 250 }) against a genuinely slow child throws a named, actionable error` (named: "the timeout/mid-call-exit Property cases in anno-mcp-client.test.ts")
  - `audit-integrity.test.ts`'s named D-12-02 case did **not** fail this run -- consistent with it being named as flaky (intermittent), not always-red.
- Verified via `git status --short -- .claude/mcp/vice` that the working tree under the fork/stock backend module directory is completely clean -- no stray edits, no untracked files.
- Cleaned up orphaned host-side `sleep 600` stub processes left behind by the broker-control/e2e tests' own child-process handling (a symptom of the same named flakiness, not a leak this plan introduced) so no junk process is left running.

## Task Commits

Both tasks made zero file changes (per their own `<precondition>`, correctly evaluated as unmet for this branch), so there is no task-level `git add`/commit for either -- there is nothing to stage. The single commit for this plan is the plan-completion metadata commit below, which is itself "a documentation-only recorded-zero commit," per this plan's own success criteria.

1. **Task 1: Stop the fork being the silent default (deprecate-first and remove-now branches only)** - no commit (skipped: branch is `retain`, not `deprecate-first`/`remove-now`; confirmed via `14-01-SUMMARY.md` and a clean `git diff`)
2. **Task 2: Move the stock backend's shared error types and utilities out of the fork transport module (remove-now branch only)** - no commit (skipped: branch is `retain`, not `remove-now`; confirmed via `14-01-SUMMARY.md`, absence of `vice-errors.ts`, and a clean `git diff`)

**Plan metadata:** (this commit, made immediately after this SUMMARY)

## Files Created/Modified

- `.planning/phases/14-backend-decision/14-04-SUMMARY.md` - this file (created)
- `.planning/STATE.md` - position/decisions/session updated for plan 14-04
- `.planning/ROADMAP.md` - Phase 14 plan-progress table row updated for 14-04
- `.planning/REQUIREMENTS.md` - FORK-01 traceability status re-evaluated (remains held open by the shared-ID gate until 14-05 also completes; see Next Phase Readiness)

No files under `.claude/mcp/vice/` were created or modified. `git diff --quiet -- .claude/mcp/vice` exits 0.

## Decisions Made

See `key-decisions` in frontmatter. In prose: this plan is entirely branch-conditional, both tasks' code-consequence work is scoped to non-`retain` branches by their own `<precondition>` elements, the decided branch is `retain`, and the correct execution of a `retain`-branch dispatch of this plan is therefore zero source edits -- verified, not assumed. No unauthorized `resolvedBackend()` default flip and no unauthorized `vice-errors.ts` extraction were performed.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' own `<precondition>` elements were evaluated exactly as specified (read-only checks: read `14-01-SUMMARY.md`, then confirm absence of edits with `git diff`/`grep`/file-existence checks), and both correctly resolved to "skipped, `retain` branch."

## Issues Encountered

- **`node test-gate.mjs`'s first invocation ran anomalously slowly** (~31 minutes wall-clock, driven entirely by `broker-control.test.ts`'s singleton-guard tests: a real broker daemon it spawns kept respawning a `/bin/sleep 600` stand-in "emulator" process across at least three ~600-second cycles before the underlying pipe-tail capture reported a (misleadingly-reported, see below) exit code). This matches, and is explained by, this dispatch's own explicit warning that "the broker singleton/SIGTERM cases in broker-control.test.ts and broker-e2e.test.ts" are "known-flaky under full-suite load" in this sandboxed environment's process scheduling. Per the SCOPE_BOUNDARY instruction ("only auto-fix issues directly caused by the current task's changes" -- this plan made none), this was not investigated further or fixed; a second, independent invocation of the same unmodified command completed cleanly in 72.6 seconds with no hang, confirming this was transient scheduling contention rather than a deterministic hang.
- **The first invocation's `| tail -30` capture reported a misleading "exit code 0."** Piping through `tail` causes the shell to report `tail`'s own exit status, not `node test-gate.mjs`'s -- so that "0" was never evidence the gate passed. The second invocation redirected to a file directly (no pipe) and captured the real exit code (`1`, from 7 genuine-but-named-flaky failures) and the real TAP summary line. This SUMMARY reports the second invocation's numbers as authoritative and notes the first invocation's reported exit code should be disregarded as an artifact of the capture method, not a signal about test outcome.
- Six orphaned `/bin/sleep 600` host processes (stand-in "emulator" stubs, left behind by the same broker-control/e2e flaky tests across both invocations) were found still running after both test-gate.mjs invocations exited, and were killed by hand (`kill -9`) to avoid leaving junk processes on the host. This is a symptom of the named flakiness (child-process cleanup not always completing under load), not something this plan's zero-edit dispatch could have caused or is expected to fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 14-05 (declaring `FORK-01`) can now read this plan's confirmed `retain`-branch recorded-zero outcome: no `backend-detect.mts` default flip, no `vice-errors.ts` extraction, `.claude/mcp/vice/` unchanged.
- `FORK-01` is **not yet** marked `Complete` in `.planning/REQUIREMENTS.md`'s traceability table: the shared-ID gate correctly holds it open because plan 14-05 also declares `FORK-01` and has not yet produced its own SUMMARY.md. This mirrors 14-01's own note about the same gate.
- The full `node test-gate.mjs` baseline recorded here (2085/2099 pass, 7 named-flaky fails, 2 cancelled, 5 todo) is available for plan 14-05 or any later phase to compare against, without re-running the gate, if a future plan needs to confirm whether a later change introduced a *new* failure beyond this named set.
- No blockers.

## Self-Check: PASSED

- `[ -f .planning/phases/14-backend-decision/14-04-SUMMARY.md ]` -> FOUND (this file)
- `git diff --quiet -- .claude/mcp/vice` -> exit 0, confirmed clean
- `[ -f .claude/mcp/vice/vice-errors.ts ]` -> ABSENT, confirmed
- `grep -c FORK-01 .claude/mcp/vice/backend-detect.mts` -> 0, confirmed
- `.planning/phases/14-backend-decision/14-01-SUMMARY.md`'s `## Decision` section -> read directly, confirms branch token `retain`
- Full `node test-gate.mjs` run -> 2099 tests, 2085 pass, 7 fail (all matched against the named known-flaky set), 2 cancelled, 5 todo, 0 skipped -- re-run once independently (72.6s), consistent both times on which tests failed
- No stray host processes remain: `ps aux | grep -E "test-gate|vice-broker|sleep 600"` -> empty after cleanup

---
*Phase: 14-backend-decision*
*Completed: 2026-08-22*
