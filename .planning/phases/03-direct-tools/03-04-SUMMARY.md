---
phase: 03-direct-tools
plan: 04
subsystem: infra
tags: [vice-broker, launch, port-allocation, binary-monitor, remotemonitor, d-13]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: broker launch support for -binarymonitor alongside -mcpserver, resolvedBackend()
provides:
  - InstanceRecord.remoteMonitorPort (D-13), carried through _snapshotState()
  - nextFreePort()'s exclude option, for allocating a second port without racing the first
  - buildViceArgs()'s stock branch appending -remotemonitor/-remotemonitoraddress when a second port was allocated
  - Both real broker launch call sites (cold acquire, warm floor) wired to allocate the second port
  - The monitor-ownership decision for the second (text-monitor) socket, recorded in a code comment for Phase 7
affects: [07-stock-only-gains, phase-7-text-monitor-detach]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second-port allocation via nextFreePort(state, { exclude }) then direct state.blockedPorts.add() -- never a value import of blockPort() from a sibling host-bound .mts module, matching this file's own type-only-import discipline"
    - "Graceful degradation on optional-capability allocation failure: log one line, proceed without the flag, never fail the whole acquire"

key-files:
  created:
    - .planning/phases/03-direct-tools/deferred-items.md
  modified:
    - .claude/mcp/vice/broker-state.mts
    - .claude/mcp/vice/broker-launch.mts
    - .claude/mcp/vice/vice-broker.mts
    - .claude/mcp/vice/resources/broker-state.mjs
    - .claude/mcp/vice/resources/broker-launch.mjs
    - .claude/mcp/vice/resources/vice-broker.mjs
    - .claude/mcp/vice/broker-state.test.ts
    - .claude/mcp/vice/broker-launch.test.ts

key-decisions:
  - "InstanceRecord.remoteMonitorPort is optional/additive, absent on fork and absent when the second allocation fails -- never a required field"
  - "monitorClient stays a single field covering the binary-monitor socket only; the -remotemonitor socket is deliberately left unclaimed in Phase 3 (T-3-07b, accepted) since nothing dials it yet -- no speculative channel discriminator added"
  - "A failed second-port allocation degrades to launching WITHOUT -remotemonitor rather than failing the whole acquire (T-3-08 mitigation)"
  - "DIRECT-06 not marked complete from this plan -- it is a shared requirement across six 03-0X plans in this phase; this plan lands only the launch-flag half (D-13), detach itself moves to Phase 7"

patterns-established:
  - "Optional, additive, banner-commented field groups on InstanceRecord (D-13's own banner is the third instance of this convention, after Plan 03's supervisor fields and Plan 05's monitorClient)"

requirements-completed: []

# Metrics
duration: 55min
completed: 2026-08-14
---

# Phase 3 Plan 04: Broker launch support for stock's second (-remotemonitor) monitor port Summary

**Broker now allocates and launches stock `x64sc` with `-remotemonitor` on a second, broker-managed port alongside `-binarymonitor`, with the port recorded on `InstanceRecord` for Phase 7 to discover -- no text-monitor client or wire code added yet.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-14T18:10Z (approx, worktree reset + context load)
- **Completed:** 2026-08-14T18:40Z
- **Tasks:** 2/2 completed
- **Files modified:** 8 (6 modified source/test/resource files, 1 new deferred-items.md, plus this SUMMARY)

## Accomplishments
- `InstanceRecord.remoteMonitorPort` lands as an optional, additive field, with the monitor-ownership decision for the second socket written into the code as a comment Phase 7 will find.
- `nextFreePort()` gained an `exclude` option so a second port allocation can never collide with a primary port whose `InstanceRecord` doesn't exist yet.
- `buildViceArgs()`'s stock branch appends `-remotemonitor -remotemonitoraddress ip4://<host>:<port>` only when a second port was actually allocated; the fork argv and the stock-without-second-port argv are both byte-identical to before this plan (BACK-02's standing gate holds).
- Both real launch call sites in `vice-broker.mts` (the cold-acquire arm and the warm-floor pass) now allocate the second port through the same `nextFreePort` mechanism, gated internally on `backend === "stock"` -- neither call site re-reads `VICE_BACKEND`.
- A failed second-port allocation degrades gracefully: the acquire still succeeds, `remoteMonitorPort` stays `undefined`, and the argv carries no `-remotemonitor`.
- All three `resources/*.mjs` host-bound artifacts rebuilt via `node build.ts`; `resources-sync.test.ts` confirms zero drift.

## Task Commits

Each task was committed atomically:

1. **Task 1: InstanceRecord.remoteMonitorPort, nextFreePort exclude, and the stock argv** - `b63244b` (feat)
2. **Task 2: Wire the real broker call sites, rebuild the host artifacts, and test** - `7ec134e` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `.claude/mcp/vice/broker-state.mts` - `InstanceRecord.remoteMonitorPort`, `NextFreePortOptions.exclude`, `nextFreePort()`'s exclude-skip-without-blocking check
- `.claude/mcp/vice/broker-launch.mts` - `buildViceArgs()`'s `-remotemonitor` extension, `TryLaunchDeps`/`spawnAndRecordInstance()` threading `remoteMonitorPort`, `AcquirePortAndLaunchDeps.allocateRemoteMonitorPort` + `acquirePortAndLaunch()`'s second-allocation logic (gated on `backend === "stock"`, degrades on failure), `MaintainWarmFloorDeps.allocateRemoteMonitorPort` threaded to the warm arm's own `acquirePortAndLaunch()` call
- `.claude/mcp/vice/vice-broker.mts` - `HandleAcquireDeps.allocateRemoteMonitorPort`, both real call sites (`handleAcquire()`'s cold arm, `maintainWarmFloorForRealBroker()`) wired to `(state, exclude) => nextFreePort(state, { exclude })`; the real `onAcquire` callback in `run()` passes it through
- `.claude/mcp/vice/resources/broker-state.mjs`, `resources/broker-launch.mjs`, `resources/vice-broker.mjs` - rebuilt via `node build.ts`
- `.claude/mcp/vice/broker-state.test.ts` - `nextFreePort()`'s exclude-skip case (not added to `blockedPorts`), `_snapshotState()` carrying `remoteMonitorPort`
- `.claude/mcp/vice/broker-launch.test.ts` - `buildViceArgs()`'s three D-13 argv shapes (fork unchanged, stock-without-second-port unchanged, stock-with-second-port extended), `acquirePortAndLaunch()`'s exclude-set/degrade-on-failure/fork-never-calls-allocator cases
- `.planning/phases/03-direct-tools/deferred-items.md` - new, logs one out-of-scope pre-existing test failure

## Decisions Made
- `blockPort()` is not value-imported into `broker-launch.mts` for the second port's block -- `deps.state.blockedPorts.add(remoteResult.port)` is used directly instead, matching this file's own existing discipline (`handleExit()`'s direct `record.monitorClient = undefined` in place of `clearMonitorClient()`) that avoids a runtime value import of a sibling host-bound `.mts` module this file must also run unbuilt under its own tests.
- `DIRECT-06` is not marked complete in `REQUIREMENTS.md` from this plan -- it is referenced by six plans in this phase (03-02, 03-04, 03-05, 03-10, 03-12, 03-13); this plan only lands the launch-flag half of D-13, with the text-monitor client and detach functionality itself explicitly deferred to Phase 7 per the plan's own objective.

## Deviations from Plan

None - plan executed exactly as written. All `must_haves` truths, artifacts and key_links from the plan frontmatter are satisfied; all acceptance criteria for both tasks were verified directly (grep counts, `buildViceArgs()` output shapes, `inFlight`/`inFlight = true` guard inspection).

## Issues Encountered

- **Worktree base drift at spawn time:** HEAD was at an ancestor commit (`68b0a79`) far behind the expected phase base (`d1429b4`); the worktree was clean, so it was corrected with `git reset --hard d1429b4...` per the mandatory `<worktree_branch_check>` step before any work began.
- **`npm run test:automated` reports one unrelated pre-existing failure:** `repo-root.test.ts`'s "path agreement... the agreed path is not under .claude" test fails specifically because this worktree's own checkout lives under a path containing a literal `.claude` segment (`.claude/worktrees/agent-<id>/`) -- an artifact of the parallel-worktree execution environment, not a defect in this plan's files. Neither `repo-root.ts` nor `repo-root.test.ts` is touched by this plan's diff. Logged to `deferred-items.md` rather than fixed, per the executor's scope boundary.
- **`vice-broker-launch.test.ts` (manual-only, run explicitly per the plan's own verification step):** 11/15 pass. The 4 failures are all container-guard exit-code assertions (`vice-broker-launch.test.ts:373,385,403,409` -- expecting exit 2/3 for "inside a container" refusal, observing 0/1 instead) -- this sandbox's container-detection signals do not match what the test's authoring environment expected. None of the 4 failing subtests touch `remoteMonitorPort`, `-remotemonitor`, `allocateRemoteMonitorPort`, or any file this plan modifies; confirmed by inspecting each failure's own assertion. Recorded here per the plan's explicit instruction to run this suite and record its result, not to gate on it passing.

## User Setup Required

None - no external service configuration required. This plan only extends broker-side launch argv and in-process state; no new environment variable, secret, or dashboard step.

## Next Phase Readiness

- Every stock `InstanceRecord` now carries `remoteMonitorPort` (or omits it on allocation failure), giving Phase 7 a discoverable port to dial once it builds the text-monitor client.
- The monitor-ownership question for the second socket is answered in writing (`broker-state.mts`'s `InstanceRecord.monitorClient` banner) so Phase 7's security review does not have to re-derive it.
- `-remotemonitoraddress`'s exact flag spelling remains `[ASSUMED]` (RESEARCH.md Assumption A1, symmetric with the already-used `-binarymonitoraddress`) -- filed as probe debt under `.planning/todos/pending/`; Phase 7 (or an earlier live-VICE validation pass) should confirm it against a real binary before the text-monitor client dials it.
- No blockers for the remaining Wave 1 plans in this phase -- this plan has no `depends_on` and nothing in this phase declares a dependency on it.

---
*Phase: 03-direct-tools*
*Completed: 2026-08-14*

## Self-Check: PASSED

All files listed under "Files Created/Modified" confirmed present on disk (10/10). Both task commit hashes (`b63244b`, `7ec134e`) confirmed present in `git log --oneline --all`.
