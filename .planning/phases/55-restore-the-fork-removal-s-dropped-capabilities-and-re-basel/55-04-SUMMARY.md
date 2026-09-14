---
phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel
plan: 04
subsystem: testing
tags: [vice-proxy, containerize, structural-guards, manifest-exactness, epoch-drift, test-rewrite]

# Dependency graph
requires:
  - phase: 55-03
    provides: "vice-proxy.test.ts with every fork-era dead-mechanism region already deleted, leaving exactly 16 rewrite-set/no-harness-set failures for 55-04/55-05 to resolve"
provides:
  - "vice-proxy.test.ts with the grant-containerization trio, three structural guards, the manifest-exactness contract, and both epoch-drift tests all re-pointed at post-fork-removal reality (9 of the 16 failures 55-03 handed forward)"
  - "A verified, reasoned commit trail: each guard's old and new expectation with its measuring command, the containerize trio's adoption-record witness, and named-successor evidence for both retired epoch-drift tests"
affects: ["55-05 (owns the remaining 7 no-harness-set failures, unaffected by this plan)", "55-06 (owns this file's own header/gate decisions, untouched here)"]

actuals:
  tokens: 8106
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Adoption-record witness: when a forwarded call can no longer complete (the stock backend claims the monitor socket before dialling, and the fixture control broker never wires that claim to succeed), prove a seam's effect from its own one-line stderr report instead of from the forwarded call's outcome -- the idiom the already-passing 'already-container-shaped grant' sibling test established, extended here to the other three containerize tests."
    - "Ladder disposition for a test whose harness precondition became categorically impossible (not merely stale): confirm the precondition really is gone (VICE_MCP_URL now refuses outright under the stock backend), locate the surviving mechanism's own suite, run its candidate successors green BEFORE cutting the predecessor, and name every one in the commit message -- extending 55-03's same ladder to a harness-impossibility case rather than a simple deletion case."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-proxy.test.ts

key-decisions:
  - "The containerize trio's rewrite does NOT bind a real off-loopback listener speaking the binary monitor protocol to make the forwarded call succeed -- MEASURED that the fixture control broker (startControlBroker()) never wires onMonitorClaim to succeed, so every forwarded call in this file fails at the monitor-claim step in ~10ms regardless of what the containerized grant resolves to. Building a real binmon stand-in to make these three tests drive a genuinely successful call was rejected as out of scope for this plan (that capability, if ever needed, belongs to whichever plan actually requires a working binmon stub) -- the adoption-record stderr line is sufficient evidence and is what the already-passing sibling already relied on."
  - "The network-call module-set guard stays a directory enumeration over src/mcp/vice/, not a switch to shipped-modules.ts's files[]-derived shipped set -- the guard's own name and header comment declare its subject as the on-disk tree, and shipped-modules.ts's derivation serves a different property (what ships to npm) used by other guards (e.g. spawn-seam.test.ts)."
  - "The manifest-exactness test's ordering assertion is KEPT (not dropped) with an explicit stated decision: registration order is the wire order and a client can depend on it, since vice-proxy.ts's tools{} record's insertion order is fixed at first assignment (the manifest loop) and never moves on the later proxy-local-runner overwrite for vice_recycle/vice_diagnose."
  - "Both epoch-drift tests are retired with named successors rather than rewritten in place, on the finding that their harness precondition (VICE_MCP_URL forwarding through the stock backend) is now categorically impossible, not merely stale -- ensureStockSession() refuses outright the instant VICE_MCP_URL is set. The surviving mechanism (stock-connect.ts's stockReconnect() epoch guard) is a documented, deliberate REVERSAL of one of the two old properties (D-3: missing epoch evidence at reconnect is now treated as unprovable identity, not as 'not a restart'), not a like-for-like relocation -- this is stated explicitly rather than silently absorbed into a passing rewrite."

patterns-established:
  - "When a plan's own read_first names a 'candidate successor suite' by file, do not assume it is a single complete 1:1 replacement -- decompose the retired test's distinct claims (here: 'drift is reported', 'drift is not cached across live calls', 'missing epoch is not a restart') and locate a named successor for EACH claim, even if that means citing a second suite (stock-dispatch.test.ts, for the live-session-reuse-never-touches-epoch claim) alongside the one the plan pointed at first."

requirements-completed: [PROXY-05]

coverage:
  - id: D1
    description: "The grant-containerization seam and both of its safety nets are re-pointed at containerizeGrant()'s own adoption-record stderr line (the idiom the already-passing sibling test established), since the forwarded call they used to assert on can no longer complete under the stock backend's monitor-claim-before-dial ordering"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "vice-proxy.test.ts: 'containerize: a loopback grant url is rewritten to the alias...' / 'containerize safety net: a grant whose epoch_file translates outside the workspace...' / 'containerize safety net: a grant whose url port disagrees...' -- all pass; sibling 'already-container-shaped grant' unmodified, still passes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three structural guards (network-call module set, launcher-message call-site floor, synthetic-tool registration) re-measured against the tree as it ships, each with its old expectation, new expectation, and measuring command recorded in the commit message"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "git commit 38100d55 -- three re-measured guards, each verified green; deleted_names_still_expected grep check flagged 3 residual PROSE hits (historical/explanatory comments, not the live assertion), documented as a measured discrepancy in the commit message per the instruction to follow the measurement"
        status: pass
    human_judgment: false
  - id: D3
    description: "tools/list's manifest-exactness contract asserts name set, order, schema and cap stamp against the manifest as it ships, with no DENY_LIST clause, and states its ordering decision explicitly"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "vice-proxy.test.ts: 'tools/list's full output matches the manifest exactly (name set, order, schema, _meta cap)' passes; 'tools/list declares the same cap it enforces' unmodified, still passes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both epoch-drift tests are retired against named, currently-green successors after confirming their harness precondition is categorically impossible under the stock backend, not merely stale"
    requirement: "PROXY-05"
    verification:
      - kind: unit
        ref: "stock-connect.test.ts: 'stockReconnect: an advanced epoch rejects with MachineRestartedError...' + 'stockReconnect: no epoch can be read at all rejects...' (both green, full suite 41/41); stock-dispatch.test.ts: 'lease: two successive calls with the same targetId call stockConnect exactly once...' (green)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The file's skip count does not rise, and npm run test:automated stays at 0 failures / 9 skips"
    requirement: "PROXY-03"
    verification:
      - kind: unit
        ref: "grep -c 'test.skip|{ skip:|, { skip' vice-proxy.test.ts: 3 (Plan 55-03 baseline) -> 3 (unchanged through all three tasks); npm run test:automated: 4417/0/9 (one transient failure from a concurrent session's leaked installer/skills/*/zz-scratch-* dir, gone and re-confirmed green on a second run)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-14
status: complete
---

# Phase 55 Plan 04: Re-point the fork-removal rewrite set in vice-proxy.test.ts Summary

**Re-pointed 9 of the 16 failures Plan 55-03 left behind -- the grant-containerization trio, three structural guards, and the manifest-exactness contract -- at post-fork-removal reality, and retired both epoch-drift tests against named, currently-green successors in stock-connect.test.ts and stock-dispatch.test.ts, on the finding that their harness precondition (forwarding through VICE_MCP_URL) is now categorically impossible under the stock backend.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (each one commit)
- **Files modified:** 1 (`src/mcp/vice/vice-proxy.test.ts`)
- **Commits:** 3

## Accomplishments

- **Task 1** (`86783915`): re-pointed the three failing grant-containerization tests (loopback url rewrite, epoch_file safety net, url safety net) at `containerizeGrant()`'s own one-line stderr adoption record instead of a forwarded call's outcome. MEASURED that every forwarded `vice_ping` call in this file's containerize section now fails in ~10ms at the monitor-claim step (`stockConnect: monitor claim for target ... failed (internal)`) because the fixture control broker never wires `onMonitorClaim` to succeed -- this is true regardless of what the containerized url/epoch_file resolves to, so the old `resp.result.isError === false` assertions were asserting nothing about containerization at all. Rewrote each test to assert the specific before/after (or SUBSTITUTED) values `containerizeGrant()` reports for `url`/`epoch_file`, using the same idiom the already-passing "already-container-shaped grant" sibling established. That sibling and the environment-gated case are byte-unchanged.
- **Task 2** (`38100d55`): re-measured three structural guards against the tree as it ships. Network-call module set: measured offenders = `["broker-launch.mts"]` (both `vice-probe.ts` and `vice.ts` confirmed absent from disk); kept the guard as a directory enumeration (its own subject, not the npm-shipped subset) and a full two-directional set equality. Launcher-message guard: measured 4 `brokerHostPath()` call sites (down from 6, two lived in the now-deleted replaced-machine message family); lowered the floor to `>= 4`, a non-vacuity control, not an exact equality -- the two subcommand negative assertions are byte-identical to their pre-task form. Synthetic-tool registration guard: found THREE proxy-local-registered tool definitions, not two (`RESULT_CONTINUE_TOOL`, `RECYCLE_TOOL`, `DIAGNOSE_TOOL`), and found that `vice_recycle`/`vice_diagnose` are now genuinely present in `tools-manifest.stock.json` (their schema is manifest-derived; only their runner stays proxy-local) -- re-pointed the test to derive all three names from their own source object literals via regex rather than hand-typing, and to assert manifest-absence is now scoped to exactly `vice_result_continue`.
- **Task 3** (`4890e5b1`): re-pointed the manifest-exactness contract. Measured the actual failing clause was ORDER, not the stale `DENY_LIST` exception the test's old name carried (there is no deny list in shipped code, confirmed by Plan 55-03). The old `expectedOrder` appended `vice_recycle`/`vice_diagnose` a second time after `vice_result_continue` -- stale, from when both were synthetic-only; they now appear once, at their natural manifest position, via `expectedManifestNames`. Corrected the array, dropped the `DENY_LIST` clause from the test's name and body, and stated the ordering decision explicitly in a comment (registration order IS the wire order, asserted as a real contract). Retired both epoch-drift tests after confirming, empirically, that `ensureStockSession()` now refuses outright the instant `VICE_MCP_URL` is set -- there is no forwarding path left for either test to drive, a harness impossibility rather than a stale assertion -- and after running all three named successors green first.

## Task Commits

1. **Task 1: Re-point the grant-containerization trio** - `86783915` (test)
2. **Task 2: Re-measure the three structural guards whose coordinates moved** - `38100d55` (test)
3. **Task 3: Re-point the manifest-exactness contract and dispose of the two epoch-drift tests** - `4890e5b1` (test)

**Plan metadata:** (recorded separately by the orchestrator, per this plan's constraint against committing docs artifacts from this agent)

## Files Created/Modified

- `src/mcp/vice/vice-proxy.test.ts` - re-pointed the grant-containerization trio, three structural guards, and the manifest-exactness contract at post-fork-removal reality; retired both epoch-drift tests against named successors. 3834 -> 3891 lines net (individual task diffs: +65/-34, +65/-10, +85/-114).

## Decisions Made

- The containerize trio's rewrite proves the seam's effect from its own adoption-record stderr line rather than building a real binary-monitor stand-in to make the forwarded call succeed -- MEASURED that the fixture control broker never wires `onMonitorClaim`, so no containerize test in this file can ever observe a successful forwarded call without new stand-in infrastructure, which is out of this plan's scope.
- The network-call guard stays a directory enumeration (its own stated subject), not a switch to `shipped-modules.ts`'s npm-`files[]`-derived set, which serves a different property used by other guards.
- The manifest-exactness test's ordering assertion is kept, with the ordering decision stated explicitly as a comment rather than silently dropped or silently kept.
- Both epoch-drift tests are retired, not rewritten, because their harness precondition (`VICE_MCP_URL` forwarding under the stock backend) is now categorically impossible, and the surviving mechanism in `stock-connect.ts` is a documented, deliberate reversal (D-3) of one of the two old properties, not a relocation of them.

## Deviations from Plan

**None of Rules 1-4** were triggered -- this plan is pure test re-pointing with no source-code changes.

**One measured discrepancy, reported per the instruction to follow the measurement over the plan when they conflict:** Task 2's own automated verify step (`grep -ac 'vice-probe.ts\|"vice.ts"' vice-proxy.test.ts`, expected 0) reports 3 after the rewrite, against a `fails_when > 0` threshold. All three are historical/explanatory PROSE -- one pre-existing comment from Phase 01.6.1 documenting the original `vice-probe.mjs` -> `vice-probe.ts` rename (present before this plan touched the file), plus two sentences in this commit's own new comment explaining WHY the two filenames were dropped from the guard's expected array. The guard's actual pass/fail surface -- its test name, its `expected` array, and its error message -- reads exactly `["broker-launch.mts"]` today, verified green. The blunt substring grep cannot distinguish "the guard still expects this" from "a comment explains why it no longer does"; I judged that obscuring the two literal filenames in the new comment purely to dodge this heuristic would reduce reader clarity for a shallow compliance win, and documented the discrepancy in the Task 2 commit message instead, per the standing instruction to follow the measurement and say so.

**One naming nuance beyond the plan's own phrasing:** the plan's `must_haves.truths` describes the epoch-drift ladder outcome as "retired against a named, currently-green successor in `stock-connect.test.ts`" (singular suite). The actual disposition cites successors in BOTH `stock-connect.test.ts` (two tests, covering the drift-detected-and-reported and missing-epoch-at-reconnect claims) AND `stock-dispatch.test.ts` (one test, covering the live-session-never-rechecks-epoch claim that subsumes the old "absent -> present is not a restart" property for a still-connected session). The retired tests each carried more than one distinct claim, and no single test in `stock-connect.test.ts` alone covered all of them -- citing the second suite was necessary for full, honest coverage rather than a partial match. All three successors were confirmed green before the retirement, matching the plan's own stricter instruction elsewhere ("locate the successor by NAME and show it green before the predecessor is cut").

## Issues Encountered

- A transient `npm run test:automated` failure appeared mid-plan in `anno-verb-coverage.test.ts` (a leaked `installer/skills/*/zz-scratch-*` directory with no counterpart under `src/skills/`) -- confirmed, per this plan's own execution notes, to be drift from a parallel Claude session editing `src/skills/**`, not caused by anything in this plan (which touched only `vice-proxy.test.ts`). The directory was gone by the time it was investigated, and a second full run of `npm run test:automated` confirmed 4417/0/9, unchanged from the plan's own protected baseline.
- Diagnosing the correct rewrite for the containerize trio required one round of temporary instrumentation (a scratch `console.error` added to inspect the actual forwarded-call response and its timing, then reverted before the real edit) to establish, empirically, that the fixture control broker's `onMonitorClaim` stub always fails -- this is not itself a deviation (no assertion changed), just the investigation method, recorded here for transparency.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vice-proxy.test.ts` now has 59 top-level tests (down from 61; the two epoch-drift tests were retired with no rewrite), 49 passing, 7 failing, 3 skipped (unchanged from Plan 55-03's baseline). The 7 remaining failures are, by name, exactly Plan 55-05's own stated scope (`tracer: one real tool call round-trips end to end`, `never-throw: malformed and hostile input is answered, not fatal`, `never-cache: host down then up succeeds without a restart`, `three states: each unreachable shape gets its own message and fix`, `path translation: a lexical .. cannot escape the workspace...`, `with an explicit endpoint override set, the control listener receives no connection at all`, `fixed-port unreachable is unchanged...`) -- none of them are this plan's, and this plan did not touch any of their tests.
- `stock-connect.test.ts` and `stock-dispatch.test.ts` remain byte-unchanged and fully green (41/41 and full suite respectively) -- this plan only ever read them to locate successors, never modified them.
- `npm run test:automated` is unmoved at 4417/0/9.
- No broker or stray `x64sc` process was running at any point during this plan (`pgrep -c x64sc` = 0, confirmed at the end); the three long-lived `vice-proxy.ts` processes present throughout are Claude Code's own MCP servers and were left untouched.

## Self-Check: PASSED

- FOUND: `src/mcp/vice/vice-proxy.test.ts`
- FOUND: `.planning/phases/55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel/55-04-SUMMARY.md`
- FOUND commit: `86783915` (Task 1 -- grant-containerization trio)
- FOUND commit: `38100d55` (Task 2 -- three structural guards)
- FOUND commit: `4890e5b1` (Task 3 -- manifest-exactness contract + epoch-drift retirement)

---
*Phase: 55-restore-the-fork-removal-s-dropped-capabilities-and-re-basel*
*Completed: 2026-09-14*
