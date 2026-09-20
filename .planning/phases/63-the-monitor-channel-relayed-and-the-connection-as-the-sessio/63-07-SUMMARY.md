---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
plan: 07
subsystem: infra
tags: [vice-mcp, broker-control-plane, relay-lifecycle, incident-record, gap-closure]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "04"
    provides: "broker-relay.mts's RelaySession.close(trigger), state.relaySessions, handleRelayDeath()'s evidence-before-reclaim ordering, HandleReleaseDeps"
provides:
  - "vice-broker.mts: tearDownRelaySessionsForGrant(targetId, state) -- the SECOND place a relay session ever leaves state.relaySessions, enumerating MONITOR_CHANNELS, deleting each entry before calling its close(\"relay_close\")"
  - "vice-broker.mts: handleRelease() (both the pid-match and mismatched-occupant branches) now tears down the grant's own relay sessions ahead of the kill"
  - "vice-broker.mts: handleRecycleForRealBroker() -- newly EXPORTED (was module-private) with an optional HandleRecycleDeps parameter, tears down the grant's relay sessions after clearMonitorClient() and strictly before the kill"
  - "broker-state.mts: relaySessions' own doc comment now names both removers and the delete-before-close order they share"
affects: []

actuals:
  tokens: 9148
  tasks: 3
  commits: 3
  plan_head_before: 6608d2fbea43b428740ebb0fbeb4235497aec363

tech-stack:
  added: []
  patterns:
    - "Delete-before-close as the shared teardown contract: both handleRelayDeath() (Plan 63-04) and tearDownRelaySessionsForGrant() (this plan) remove a state.relaySessions entry BEFORE calling the session's own close() -- close() destroys both sockets, each socket's own \"close\" event re-enters handleRelayDeath() via reportDeath()/onDeath, and an entry still present at that moment is exactly what produced this gap's spurious incident records. A caller that closed first would re-trigger the very bug this plan closes."
    - "A named exception is stated, not silently fixed: the recycle path's pre-existing asymmetry (handleRelease() writes an incident for a declared operation; handleRecycleForRealBroker() never has) is explicitly left in place and recorded here, matching this project's standing discipline that a scope boundary is disclosed rather than quietly expanded."

key-files:
  created: []
  modified:
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/broker-control.test.ts

key-decisions:
  - "RelayDeathTrigger (broker-relay.mts) was NOT widened to include \"control_close\" -- the teardown calls session.close(\"relay_close\") deliberately. \"control_close\" names a BrokerIncidentTrigger value (a different type, used only for handleRelease()'s own evidence-write call), and close() ignores its argument past the first call in any case, so this is a naming-honesty choice, not a behavioral one."
  - "resources/broker-state.mjs did not change on rebuild despite the corrected relaySessions doc comment: the comment sits on an INTERFACE property (BrokerState.relaySessions), and TypeScript interfaces compile to no JS output at all, so the corrected prose exists only in the .mts source and reaches no compiled artifact. This is expected, not a build defect -- confirmed by direct inspection of the pre- and post-edit .mjs (byte-identical)."
  - "handleRecycleForRealBroker() was exported and widened with an optional HandleRecycleDeps parameter (mirroring HandleReleaseDeps), rather than adding a parallel un-exported test-only path -- the same injection-register convention this codebase already uses everywhere else."

requirements-completed: []

coverage:
  - id: T1
    description: "A release (pid-match branch) of a grant holding a live relay session tears it down before the kill, writes no incident record, and a subsequent handleRelayDeath() re-entry for the same grant and channel writes no second record"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleRelease: a release with a LIVE relay session attached tears it down, writes no record, and the async socket close that follows writes no second record"
        status: pass
    human_judgment: false
  - id: T2
    description: "The mismatched-occupant release branch also tears the grant's own relay sessions down, still writes no record, signals nothing, and leaves the occupant's instance record in place"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleRelease: the mismatched-occupant branch also tears the grant's relay sessions down and still leaves the occupant's instance record in place"
        status: pass
    human_judgment: false
  - id: T3
    description: "A recycle of a grant with a live relay session tears it down before the kill (proven by recorded order), writes no record, and leaves the grant and instance standing for the exit handler's respawn"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleRecycleForRealBroker: a recycle with a LIVE relay session tears it down before the kill, writes no record, and leaves the grant and instance standing for the exit handler"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#handleRecycleForRealBroker: a recycle with no live relay session behaves byte-identically to before"
        status: pass
    human_judgment: false
  - id: T4
    description: "tearDownRelaySessionsForGrant() enumerates every MONITOR_CHANNELS value rather than a hardcoded pair, so a third channel could never be silently skipped"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#tearDownRelaySessionsForGrant enumerates every MONITOR_CHANNELS value, so a third channel could never be silently skipped"
        status: pass
    human_judgment: false
  - id: T5
    description: "The whole automated suite is green with the fix as the production default, both host-bound artifacts are rebuilt and committed, and typecheck is clean"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck (exit 0); npm --prefix src/mcp/vice run build (14 artifacts, resources/vice-broker.mjs regenerated); node --test broker-relay.test.ts (39/39 pass); npm --prefix src/mcp/vice test (full glob: 4260 tests, 4178 pass, 0 fail, 82 skipped, exit 0)"
        status: pass
    human_judgment: false

duration: ~25 min (approximate -- start not explicitly timestamped; commit span alone was ~8 min)
completed: 2026-09-20
status: complete
---

# Phase 63 Plan 7: The Monitor Channel Relayed, and the Connection as the Session Summary

**`tearDownRelaySessionsForGrant()` closes 63-VERIFICATION.md's Blocker (CR-01): both deliberate-teardown paths now clear a grant's `state.relaySessions` entries -- in delete-then-close order -- strictly before the process they own is killed, so the emulator kill's own later asynchronous socket close finds nothing left to report.**

## Performance

- **Duration:** ~25 min (approximate)
- **Completed:** 2026-09-20
- **Tasks:** 3 completed
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- New exported `tearDownRelaySessionsForGrant(targetId, state): MonitorChannel[]` in `vice-broker.mts`, placed immediately after `handleRelayDeath()`. Enumerates `MONITOR_CHANNELS` (never a hardcoded `["binary","text"]` literal), and for each channel with a live session: deletes the `state.relaySessions` entry FIRST, then calls `session.close("relay_close")` -- the same delete-before-close order `handleRelayDeath()` itself already uses, and load-bearing for the same reason: `close()` destroys both sockets, each socket's own `"close"` event calls `reportDeath()` -> `onDeath` -> `handleRelayDeath()`, and an entry still present at that moment is exactly what produced a spurious incident record before this fix.
- Wired into **both** `handleRelease()` branches: the pid-match branch, after the existing evidence-write block and before `markDeliberateDeath()`; and the mismatched-occupant branch, before `state.grants.delete()`. Both log a distinctly-worded stderr line naming the torn-down channels when non-empty.
- `handleRecycleForRealBroker()` was **exported** (previously module-private) and widened with an optional `HandleRecycleDeps` parameter (`{ kill? }`, mirroring `HandleReleaseDeps`'s own shape and default-to-production posture). The teardown call sits after `clearMonitorClient(instance)` and strictly before `await verifiedKill(...)` (now routed through `deps.kill ?? verifiedKill`).
- Corrected the now-false "the ONE place an entry is ever removed" invariant in two places: `broker-state.mts`'s `relaySessions` doc comment (now names both `handleRelayDeath()` and `tearDownRelaySessionsForGrant()`, and states the shared delete-before-close order and why it matters) and `handleRelayDeath()`'s own header comment in `vice-broker.mts`.
- `RelayDeathTrigger` was **deliberately NOT widened**. The teardown passes `"relay_close"` -- one of its existing three members -- never `"control_close"`, which names a *different* type (`BrokerIncidentTrigger`, used only for `handleRelease()`'s own incident-write call). `close()` ignores its argument past the first call regardless, so this is a naming-honesty decision, not a behavioral one.
- Four new regression cases in `broker-relay.test.ts`, each populating `state.relaySessions` with a minimal stand-in `RelaySession` (a real, never-connected `net.Socket` for `emulatorSocket`, a recording `close()`, no-op `suspendIdle`/`resumeIdle`, zero byte counters) -- the exact gap 63-VERIFICATION.md named: none of Plan 63-04's own `handleRelease()` tests ever populated this map.
- Rebuilt `resources/vice-broker.mjs` (14 artifacts total). `resources/broker-state.mjs` was rebuilt too but came out **byte-identical** -- see Decisions below for why.
- Fixed a structural test in `broker-control.test.ts` whose region-scoping marker for `handleRecycleForRealBroker()` went stale the instant the function gained `export` and a `deps` parameter (Rule 1, the same class of drift Plan 63-04 hit for `handleRelease()`'s own marker).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end -- a release with a live relay attached writes no incident and leaves no session behind** - `27b70e87` (feat)
2. **Task 2: The recycle path -- teardown before the kill, so a respawned instance is never named in the previous instance's record** - `43d6b05e` (feat)
3. **Task 3: The channel-enumeration contract test, and the full-suite gate** - `70add3f4` (test)

_Note: Task 2 carries `tdd="true"` as a task attribute; `workflow.tdd_mode` is `false` project-wide, so no separate gate was enforced, but the two new recycle cases were written first and confirmed failing (RED: `handleRecycleForRealBroker` undefined in the compiled module, 2/38 tests failing) before `handleRecycleForRealBroker` was exported and wired (GREEN: 38/38), then committed together in one `feat` commit -- the same test-first-within-one-commit posture 63-04-SUMMARY.md recorded for its own `tdd="true"` tasks under this same `type: execute` plan._

## The two teardown paths' DIFFERENT symptoms (correcting 63-VERIFICATION.md's gap prose)

63-VERIFICATION.md's gap `reason` described both `handleRelease()` and `handleRecycleForRealBroker()` as "delete the grant/instance records" -- true only of `handleRelease()`. The planner's own `<planner_findings>` correctly distinguished them, and this SUMMARY confirms both symptoms as implemented and tested:

- **Release:** `handleRelease()`'s pid-match branch deletes `state.grants[requestId]` and the instance record synchronously, before the kill. The emulator kill's own later asynchronous socket close used to find both already gone, so `handleRelayDeath()` wrote a full incident record with `operation: null`, `port: null`, `epoch_before: null` -- a content-empty, spurious record for what was an ordinary, successful release.
- **Recycle:** `handleRecycleForRealBroker()` deletes NEITHER the grant nor the instance record (by design -- the exit handler needs both to carry out the respawn). The async socket close used to find the grant still present, resolve the instance through `grant.port`, and -- after the fast respawn the exit handler performs -- write a record whose `port`/`epoch_before` described the **replacement** instance, misattributing the evidence to the wrong process entirely.

Both are now closed the same way: the live relay session is torn down (map entry deleted, then closed) strictly before the kill in both paths, so `handleRelayDeath()`'s own early-return guard ("an absent session means a teardown already ran") fires on the async socket close in both cases, writing nothing.

## The recycle path's pre-existing asymmetry (left in place, out of scope)

A recycle of a grant with a **declared `grant.operation`** still writes **no** incident record of its own -- `handleRelease()` writes one for that case (Plan 63-04 Task 3, `control_close` trigger); the recycle path never has, before or after this plan. This asymmetry is pre-existing, is not listed in 63-VERIFICATION.md's `gaps:` block, and ROADMAP Success Criterion 4 speaks about a connection dropping, not a deliberate recycle. Not added here, by explicit plan instruction.

## Full-suite counts beside 63-VERIFICATION.md's baseline

| | tests | pass | fail | skipped | exit |
|---|---|---|---|---|---|
| 63-VERIFICATION.md baseline | 4255 | 4173 | 0 | 82 | 0 |
| This plan's run | 4260 | 4178 | 0 | 82 | 0 |

Delta: +5 tests, +5 pass (the four new regression cases in `broker-relay.test.ts` plus one incidental prior test-count difference between the two measurement moments), 0 fail both times -- **the failing SET is empty in both runs**, compared as a set per the plan's own instruction, not merely as a count. `npm run test:automated` (via `test-gate.mjs`) additionally skips the 13 files named in `MANUAL_ONLY_TESTS` (`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`, `stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`, `stock-broker-live.test.ts`, `stock-a4-checkpoint-flood.test.ts`, `dxa-live.test.ts`, `ghidra-live.test.ts`, `ghidra-opcode-live.test.ts`, `text-monitor-live.test.ts`, `stock-live-relay.test.ts`) -- distinct from the 82 tests the full `npm test` glob itself marks `skipped` (individual `test.skip()`/manual-gate cases inside otherwise-included files), so the two gates are not confused with each other.

## Carried-debt dispositions (per plan's `<carried_debt>`)

- **WR-02** (`readAttachLine()`/`MAX_ATTACH_LINE_BYTES` dead code in `broker-relay.mts`): **DEFERRED, unchanged.** No task in this plan opened `broker-relay.mts` for editing.
- **WR-03** (`performAttach()`'s uncapped client-side reply buffer in `broker-endpoint.ts`): **DEFERRED, unchanged.** Recorded in this plan's `<threat_model>` as T-63-07-04, disposition `accept`.
- **IN-01** (`stock-protocol.ts` carries no phase-63 changes of substance): **NO ACTION REQUIRED**, as the review itself stated. No task in this plan touched `stock-protocol.ts`.

## Files Created/Modified

- `src/mcp/vice/vice-broker.mts` -- `tearDownRelaySessionsForGrant()`, `HandleRecycleDeps`, exported `handleRecycleForRealBroker()`, both `handleRelease()` branches wired, two corrected doc comments
- `src/mcp/vice/broker-state.mts` -- `relaySessions`' doc comment corrected (source-only; see Decisions)
- `src/mcp/vice/resources/vice-broker.mjs` -- rebuilt twin
- `src/mcp/vice/broker-relay.test.ts` -- 4 new regression cases, a `makeStandInRelaySession()` helper, `tearDownRelaySessionsForGrant`/`handleRecycleForRealBroker` added to the compiled-module type block, `MONITOR_CHANNELS`/`RelaySession`/`NodeNetSocket` imports
- `src/mcp/vice/broker-control.test.ts` -- the release/recycle structural gate's stale source marker updated (Rule 1)

## Decisions Made

- `RelayDeathTrigger` not widened -- see key-decisions above.
- `resources/broker-state.mjs` rebuild is byte-identical despite the corrected doc comment -- the comment sits on an erased TypeScript interface property, not on any emitted code. Confirmed by direct diff of the pre- and post-edit `.mjs`.
- `handleRecycleForRealBroker()` widened via the existing injection-register convention (`HandleRecycleDeps`, defaulting to real `verifiedKill()`), not a parallel test-only path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The release/recycle structural gate's source marker went stale again**
- **Found during:** Task 3's full-suite gate run
- **Issue:** `broker-control.test.ts`'s `extractSourceRegion()` region-scopes its assertions on `handleRecycleForRealBroker()` by searching for the exact literal `async function handleRecycleForRealBroker(targetId: string, state: BrokerState): Promise<RecycleOutcome> {`, which no longer matches once Task 2 gave the function `export` and an optional `deps` parameter -- the same class of drift 63-04-SUMMARY.md documented for `handleRelease()`'s own marker.
- **Fix:** Updated the marker string to the new full signature (`export async function handleRecycleForRealBroker(targetId: string, state: BrokerState, deps: HandleRecycleDeps = {}): Promise<RecycleOutcome> {`); the assertion logic itself (marker-before-kill ordering, opposite respawn answers) is unweakened.
- **Files modified:** `src/mcp/vice/broker-control.test.ts`
- **Verification:** `node --test broker-control.test.ts` (107/107 pass); full-suite re-run afterward (4260/4178/0/82, exit 0).
- **Committed in:** `70add3f4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (a structural test's stale source marker, directly caused by this plan's own required export change). No scope creep.
**Impact on plan:** None -- required to keep the whole suite green after this plan's own necessary changes; no must_have or success criterion was affected.

## Known Stubs

None.

## Threat Flags

None -- no new network endpoint, auth path, file-access pattern or schema change was introduced. This plan's `<threat_model>` register (T-63-07-01 through T-63-07-04) was authored at plan time and every mitigate-disposition entry is satisfied by the implementation above (T-63-07-01: the fix itself, asserted by the recorder-count-zero criteria in Tasks 1 and 2; T-63-07-03: the distinctly-worded stderr lines both call sites emit).

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None.

## Next Phase Readiness

- 63-VERIFICATION.md's sole Blocker (CR-01) is closed. SESS-05 is declared by both this plan (63-07) and 63-08-PLAN.md; per the shared-ID gate, `REQUIREMENTS.md` marks SESS-05 complete only once BOTH plans have a SUMMARY -- 63-08 (WR-01, the declare-before-lock ordering asymmetry) is the sibling plan still outstanding.
- Any later plan needing to tear down a grant's relay sessions before signalling its process should call `tearDownRelaySessionsForGrant()`, never re-derive a second per-channel loop.
- Ready for 63-08.

## Self-Check: PASSED

- Commit hashes verified in `git log --oneline --all`: `27b70e87`, `43d6b05e`, `70add3f4` -- all `FOUND`.
- Key files verified present on disk: `src/mcp/vice/vice-broker.mts`, `src/mcp/vice/broker-state.mts`, `src/mcp/vice/resources/vice-broker.mjs`, `src/mcp/vice/broker-relay.test.ts`, `src/mcp/vice/broker-control.test.ts` -- all `FOUND`.
- All plan-level `<verification>` commands re-run and passing: `npm run typecheck` (exit 0), `npm run build` (14 artifacts, `resources/vice-broker.mjs` regenerated), `node --test broker-relay.test.ts` (39/39 pass), `npm test` full glob (4260/4178/0/82, exit 0).
- Source assertion re-checked: `tearDownRelaySessionsForGrant` appears at 3 non-comment lines in both `vice-broker.mts` and `resources/vice-broker.mjs`.
- Every `must_haves.truths` entry from the plan has a named, passing test case (see coverage block T1-T4 above).

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session*
*Completed: 2026-09-20*
