---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
plan: 05
subsystem: broker
tags: [vice, broker, text-monitor, remotemonitor, warm-floor, launch, port-allocation, d-16]

requires:
  - phase: 41-the-text-channel-its-serialization-authority-and-the-content
    provides: "plan 41-01's text-connect.ts (textConnect()/textDisconnect(), HeldLease.remoteMonitorPort) and plan 41-03's per-channel monitorClients map, both of which depend on remoteMonitorPort actually being present on every stock grant"
provides:
  - "acquirePortAndLaunch() fails the whole acquire (no_free_text_port) on a failed text-monitor port allocation -- no stock instance can ever exist without one"
  - "spawnAndRecordInstance()'s runtime assertion: a stock construction with no remoteMonitorPort throws by name"
  - "promoteLaunchingInstances() -- the launching->ready promotion sweep, extracted out of the retired warm floor"
  - "the warm floor (maintainWarmFloor, maintainWarmFloorForRealBroker, VICE_BROKER_WARM_FLOOR, the warm_floor config-echo fields) is retired outright; VICE launches strictly on demand"
affects: [41-06]

actuals:
  tokens: 44000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Checkpoint option B: a distinct AcquireLaunchResult/AcquireOutcome/ControlErrorCode member (no_free_text_port) for a named failure cause, rather than collapsing it into an existing generic reason"
    - "Runtime construction-site assertion in place of a type-level guarantee the type system cannot express across a backend discriminator (spawnAndRecordInstance() throws for backend:'stock' with no remoteMonitorPort; the field stays optional in the TYPE because the fork case is real)"
    - "Extraction, not rewrite: a retired mechanism's still-useful step (launching->ready promotion) is pulled out into its own function with its own header comment explaining why it is NOT the retired mechanism's logic, before the mechanism around it is deleted"

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-launch.mts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/vice-broker-client.ts
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-kill.mts
    - src/mcp/vice/host-tool.mts
    - src/mcp/vice/install-resources.ts
    - src/mcp/vice/broker-launch.test.ts
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/vice-broker-supervision.test.ts
    - src/mcp/vice/vice-broker-launch.test.ts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/broker-kill.test.ts
    - src/mcp/vice/broker-state.test.ts
    - src/mcp/vice/broker-e2e.test.ts
    - src/mcp/vice/host-tool.test.ts
    - src/mcp/vice/host-tool-transport.test.ts
    - src/mcp/vice/stock-broker-live.test.ts
    - src/mcp/vice/text-monitor-live.test.ts
    - src/mcp/vice/stock-a4-checkpoint-flood.test.ts
    - src/mcp/vice/stock-live-broker-monitor.test.ts
    - src/mcp/vice/resources/broker-launch.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/resources/broker-control.mjs
    - src/mcp/vice/resources/broker-kill.mjs
    - src/mcp/vice/resources/host-tool.mjs

key-decisions:
  - "Task 1 checkpoint: option B (proceed-with-named-diagnostic) -- owner delegated the A-vs-B choice ('You decide, but the same behavure to get a free port for biun and text protocols and launch vice with the free ports from the broker'), which stands as B, the plan's own recommendation. The same-allocator constraint the owner added is ALREADY satisfied by construction and required no code change: vice-broker.mts:717 passes `allocatePort: nextFreePort` and vice-broker.mts:1184 passes `allocateRemoteMonitorPort: (s, exclude) => nextFreePort(s, { exclude })` -- the identical broker-state.mjs nextFreePort() function, called the same way, for both the primary binary-monitor port and the second text-monitor port; only the `exclude` set differs, because the second allocation must never re-offer the port the first one just claimed. This wiring predates this plan (Phase 3, D-13) and needed no change to satisfy the owner's constraint."
  - "spawnAndRecordInstance()'s stock-port guarantee is a RUNTIME assertion, not a type-level one: InstanceRecord.remoteMonitorPort stays optional in the TYPE (the fork case is real and has none), so the invariant 'every STOCK record has one' is enforced where it is actually true -- at the one construction site, gated on backend==='stock' -- rather than attempted as a discriminated-union type the codebase does not otherwise use for InstanceRecord."
  - "superviseChild() gained an optional fourth parameter (remoteMonitorPort) so this module's own unit tests can construct a stock FIRST launch without violating the new invariant -- it is not a production stock first-launch path (only acquirePortAndLaunch() is), but the type had no way to supply the field before this change."
  - "The warm-floor-specific e2e crash-respawn test (broker-e2e.test.ts) was deleted rather than re-pointed: its subject (crash-respawn wiring) became identical to the pre-existing cold-acquire crash-respawn test once the warm-spare launch path it distinguished itself from was retired. The OTHER e2e warm-floor test ('served from an already-ready instance, no second spawn') was genuinely re-pointed, per the plan's own instruction, onto the surviving path that produces a ready-but-ungranted instance in production: an ordinary (non-deliberate) crash-respawn of a granted instance."

requirements-completed: [CHAN-02]

coverage:
  - id: D1
    description: "A stock launch whose text-monitor port allocation fails now fails the whole acquire (no_free_text_port) rather than degrading to a portless launch -- no stock instance can ever exist without a text-monitor port (D-16)"
    requirement: "CHAN-02"
    verification:
      - kind: unit
        ref: "broker-launch.test.ts#acquirePortAndLaunch (D-16, plan 41-05): a second-port allocation failure FAILS THE WHOLE ACQUIRE, spawns nothing, and leaves state.instances empty"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#acquirePortAndLaunch (D-16, discriminating power): the primary port allocated before a text-port allocation failure is allocatable again on the very next call -- no leak"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#spawnAndRecordInstance (D-16, via tryLaunchOne): throws, naming the missing field, when handed backend \"stock\" with no remoteMonitorPort"
        status: pass
      - kind: unit
        ref: "vice-broker-acquire.test.ts#handleAcquire (D-16, plan 41-05, checkpoint option B): a stock cold launch whose text-port allocation fails returns no_free_text_port -- distinct from the generic no_free_port -- and no grant is recorded"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#grep gate (D-16): broker-launch.mts's source no longer carries the removed degrade log's own wording about the text-monitor port going undialed"
        status: pass
    human_judgment: false
  - id: D2
    description: "The warm floor is retired: VICE launches strictly on demand (first request), with the promotion step relocated to promoteLaunchingInstances() and the ceiling, single-owner guard and selectWarmInstance() all intact"
    requirement: "CHAN-02"
    verification:
      - kind: unit
        ref: "broker-launch.test.ts#promoteLaunchingInstances (plan 41-05): a cold-launched launching record is promoted to ready by runBrokerPass() with no warm-floor concern present at all"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#promoteLaunchingInstances: a launching instance whose probe fails stays launching and is not promoted"
        status: pass
      - kind: unit
        ref: "broker-launch.test.ts#criterion C: two concurrent launch requests against a stubbed, deferred port allocator produce exactly one spawn (2026-08-01 triple-launch regression) -- UNCHANGED, re-run to confirm it still passes with no warm floor involved"
        status: pass
      - kind: e2e
        ref: "broker-e2e.test.ts#wired warm-hit (plan 41-05): an acquire over the real control plane is served from a ready, ungranted instance an ordinary crash-respawn left behind, spawning no second instance (Defect 5, P-01/P-04)"
        status: pass
      - kind: unit
        ref: "grep -arc 'VICE_BROKER_WARM_FLOOR' src/mcp/vice/ (repo-root-relative, excluding resources/ and node_modules/) -- 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "selectWarmInstance() survives the floor's removal byte-identical, because a ready-but-ungranted instance can still arise without any speculative warming"
    verification:
      - kind: other
        ref: "diff of selectWarmInstance()'s function body against the pre-plan HEAD -- byte-identical (see 'Argued: does a ready-but-ungranted instance still exist?' below for the argument)"
        status: pass
    human_judgment: false
---

# Phase 41 Plan 05: The Text Port Becomes Mandatory, and the Warm Floor Is Retired Summary

**A stock launch that cannot bind a text-monitor port now fails the whole acquire instead of degrading, and the warm floor's speculative pre-launching is deleted outright -- VICE launches strictly on demand, with its launching-to-ready promotion step surviving as its own function.**

## Performance

- **Duration:** ~62 min
- **Started:** 2026-09-09T08:06:09Z
- **Completed:** 2026-09-09T09:08:33Z
- **Tasks:** 3 (Task 1 checkpoint pre-resolved by the orchestrator; Tasks 2 and 3 executed)
- **Files modified:** 26 (across 2 commits)

## Accomplishments

- `acquirePortAndLaunch()`'s second-allocation failure arm no longer degrades to launching without `-remotemonitor` -- it returns a typed `no_free_text_port` failure (checkpoint option B) and spawns nothing, with the primary port allocated moments earlier proven allocatable again on the very next call (no leak, no explicit release code needed since the allocator never marked it taken).
- `spawnAndRecordInstance()` asserts the invariant at its one construction site: a stock call with no `remoteMonitorPort` throws by name.
- `broker-control.mts`'s `AcquireOutcome`/`ControlErrorCode` gain `no_free_text_port` as its own distinct code, so a host that fails only on the text-port allocation is diagnosable at the control plane, not only in the broker log.
- The warm floor is retired: `maintainWarmFloor()`, `maintainWarmFloorForRealBroker()`, `_maintainWarmFloorForRealBroker`, `resolveWarmFloorForRecord()`, the `VICE_BROKER_WARM_FLOOR` knob, and the `warm_floor` fields on `broker.json`'s config echo and `host_state`'s answer are all deleted. VICE launches strictly on the first request; the accepted cost is first-cold-launch latency (no instance is ever pre-warmed).
- The launching->ready promotion step survives, extracted verbatim into `promoteLaunchingInstances()` -- a cold acquire's own instance still needs promoting (though in practice a cold-acquire's grant is set synchronously before any promotion pass could ever observe it as merely "ready"; the promotion step's real remaining job is a crash-respawned instance).
- Every comment, log line, test and user-facing message describing the removed behaviour is corrected or deleted with it, including the deployed launcher's own startup banner text and six live-only test fixtures across four files.

## Task Commits

1. **Task 2: Fail the acquire on a failed text-port allocation, and correct the prose it leaves behind** - `66d2ef2e` (feat)
2. **Task 3: Retire the warm floor, moving the promotion step rather than losing it** - `c8eaea64` (feat)
3. **Post-completion fixup (orchestrator spot-check, deviation #4 below): correct `countLaunching()`'s stale comment and two related dead imports** - `70dcc05f` (fix)

**Task 1** was a `checkpoint:decision` pre-resolved by the orchestrator before this executor was spawned -- see "Task 1 checkpoint resolution" below.

**Plan metadata:** committed separately (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md), see the `docs(41-05)` commit following this file.

## Task 1 Checkpoint Resolution

**Chosen option id:** `proceed-with-named-diagnostic` (option B).

**Owner's response, verbatim:** *"You decide, but the same behavure to get a free port for biun and text protocols and launch vice with the free ports from the broker"*

**Reading applied:** the owner delegated the A-vs-B choice, so option B stands (the plan's own recommendation). The owner's added constraint -- the binary-monitor port and the text-monitor port must be obtained by the SAME behaviour, the same broker allocator, called the same way, and VICE must be launched with both broker-allocated free ports -- was checked against the code and found **already satisfied by construction, requiring no change**:

```typescript
// vice-broker.mts:717 (handleAcquire()'s cold arm)
allocatePort: nextFreePort,
// vice-broker.mts:1184 (the SAME handleAcquire() call, threaded to acquirePortAndLaunch())
allocateRemoteMonitorPort: (s: BrokerState, exclude: ReadonlySet<number>) => nextFreePort(s, { exclude }),
```

Both the primary (binary-monitor) port and the second (text-monitor) port are allocated by the identical `nextFreePort()` function from `broker-state.mjs` -- the same allocator, called the same way. The only difference is the `exclude` set on the second call, which exists so the second allocation can never re-offer the candidate the first one just claimed (its `InstanceRecord` does not exist yet to make `exclude` redundant, per `broker-launch.mts`'s own header comment on `allocateRemoteMonitorPort`). This wiring predates this plan (Phase 3, D-13, `03-04-PLAN.md`, DIRECT-06) and was not written as part of this plan -- it is cited here because Task 1's own `<done>` condition requires recording the constraint and where it is (or is not) satisfied, and it is satisfied.

Under option B, Task 2 additionally costs one `AcquireLaunchResult` union member (`no_free_text_port`), one `AcquireOutcome` reason, and one `ControlErrorCode` mapping -- all delivered in Task 2's commit (`66d2ef2e`).

## Argued: does a ready-but-ungranted instance still exist for `selectWarmInstance()` to walk?

Task 3's own truth requires this argued from surviving code paths, not assumed. **Yes**, and `selectWarmInstance()` therefore survives intact and unchanged (confirmed via `diff` against the pre-plan `HEAD`: byte-identical).

Walking every path that can leave an instance in `ready` state without a grant, now that nothing warms speculatively:

1. **A cold acquire's own instance never passes through `ready` at all.** `handleAcquire()`'s cold arm calls `acquirePortAndLaunch()` (which leaves the record in `launching` state), then -- with no `await` between resolving the record and the grant step -- synchronously sets `state.grants.set(...)` and `record.state = "granted"`. No `runBrokerPass()` tick can interleave in that gap (JS run-to-completion), so a cold-launched record is never observed as merely `ready`.

2. **The surviving path: an ORDINARY (non-deliberate) crash of a GRANTED instance.** `broker-launch.mts`'s `handleExit()` has two branches on an unexplained exit:
   - The **deliberate-recycle** branch (`deliberateKill && respawnAfterKill`) restores the pre-kill `granted` state onto the respawned record, and syncs the matching grant's own `pid`. This path only ever fires via `vice_recycle`, which always targets an already-granted instance -- no gap here.
   - The **ordinary crash-respawn** branch (no `deliberateKill` marker at all) does **not** restore `granted` -- it simply relaunches into `launching` state via `launchSupervised()`, carrying forward crash history and backoff, but never the pre-crash `state` field. If that crashed instance was `granted` (the common case -- a real session's own emulator crashing unexpectedly), the respawned record starts `launching` and is later promoted to `ready` by `promoteLaunchingInstances()` on a subsequent pass, once its probe succeeds -- at which point it is exactly a `ready`, ungranted candidate `selectWarmInstance()` can walk. The ORIGINAL grant record (in `state.grants`, keyed by the original request id) still exists, pointing at the now-dead pid; it becomes a stale, orphaned grant that `handleRelease()`'s own pid-identity check already handles safely (it retires the stale grant's bookkeeping without touching the live occupant, since `instance.pid !== grant.pid`).

   This is **not new behaviour introduced by this plan** -- the same branch existed, unchanged, before the warm floor's removal; it was simply one of two sources of `ready`-but-ungranted instances (the other being the floor's own speculative pre-launches, now gone). Removing the floor did not remove this path.

3. `handleRelease()`'s pid-mismatch branch (a stale grant naming a port whose current occupant does not match) leaves the mismatched occupant **untouched**, whatever state it is in -- it does not itself CREATE a `ready`-ungranted instance, but it compounds with #2: if that occupant happens to be a crash-respawned, promoted-to-`ready` instance, `handleRelease()`'s own tolerance for the mismatch is what lets it survive to be picked up later.

Live corroboration, found independently in this codebase's own prior work: `stock-live-broker-monitor.test.ts`'s header comment (lines 32-48, corrected in this plan to rename `maintainWarmFloor()` to `promoteLaunchingInstances()`) already documents this EXACT scenario -- session A's granted instance crashes, respawns unclaimed, gets promoted to `ready`, and session B's `acquire()` is served from it via `selectWarmInstance()` -- as the reachable route to a specific stock live-monitor test's own setup, entirely independent of any warm floor. This plan's own new e2e test (`broker-e2e.test.ts`'s `"wired warm-hit"`) reproduces the identical mechanism end-to-end against the real broker artifact and passes.

**Conclusion:** `selectWarmInstance()`'s grant-time re-probe, the CR-01 concurrent-drop identity recheck, and the WR-02 fire-and-forget kill of a dead candidate all remain load-bearing. The function is unchanged.

## Accepted latency

Per the folded todo's own settled open question (neither latency nor grant certainty motivated the removal -- the answer was simply "remove it"): the first cold launch after a period of no activity now pays the full boot latency with no pre-warmed instance to serve it. This is an accepted trade, not a regression to fix. Per-profile warming was explicitly declined as out of scope for this plan (a different todo, per the folded todo's own text).

## Files Created/Modified

**Production code:**
- `src/mcp/vice/broker-launch.mts` - `AcquireLaunchResult` gains `no_free_text_port`; `acquirePortAndLaunch()`'s second-allocation failure arm fails the acquire instead of degrading; `spawnAndRecordInstance()` asserts the stock-port invariant; `promoteLaunchingInstances()`/`PromoteLaunchingInstancesDeps` replace `maintainWarmFloor()`/`MaintainWarmFloorDeps`/`resolveWarmFloor()`; `BrokerPassDeps.maintainWarmFloor` renamed `promoteLaunching`; `runBrokerPass()` calls the renamed concern; `superviseChild()` gains an optional `remoteMonitorPort` parameter; numerous comments corrected.
- `src/mcp/vice/broker-state.mts` - `remoteMonitorPort`'s doc comment rewritten (present on every stock record, absent only on fork); the `profile` field's "every warm-floor spare" example corrected.
- `src/mcp/vice/vice-broker.mts` - `maintainWarmFloorForRealBroker()`/`_maintainWarmFloorForRealBroker`/`resolveWarmFloorForRecord()` deleted; `promoteLaunchingForRealBroker()` added; `BrokerRecord`/`HostStateFields` lose `warm_floor`/`warmFloor`; `runBrokerPass()` wiring updated; comments corrected.
- `src/mcp/vice/vice-broker-client.ts` - `HeldLease.remoteMonitorPort` and `AcquireGrant.remote_monitor_port` doc comments tightened to state the new mechanism.
- `src/mcp/vice/broker-control.mts` - `ControlErrorCode`/`AcquireOutcome` gain `no_free_text_port`; `HostStateFields`/the `host_state` wire response lose `warm_floor`; `AcquireGrant.remoteMonitorPort` doc comment corrected (not in this plan's own `files_modified` list -- required by the task's own `read_first`/action text; a deviation, see below).
- `src/mcp/vice/broker-kill.mts` - startup banner no longer points an operator at the now-also-retired `VICE_BROKER_WARM_FLOOR` replacement (deviation).
- `src/mcp/vice/host-tool.mts` - a stale "starving...the warm floor" comment corrected (deviation).
- `src/mcp/vice/install-resources.ts` - the deployed launcher's own user-facing startup message no longer claims a warm floor of spares (deviation).
- `src/mcp/vice/resources/broker-launch.mjs`, `resources/vice-broker.mjs`, `resources/broker-control.mjs`, `resources/broker-kill.mjs`, `resources/host-tool.mjs` - regenerated via `npm run build`, committed alongside their `.mts` sources.

**Tests:**
- `src/mcp/vice/broker-launch.test.ts` - the degrade-succeeds test rewritten to assert the acquire fails; new discriminating-power (no port leak), throw, and grep-gate tests added; `promoteLaunchingInstances` tests extracted from the deleted `maintainWarmFloor` tests; floor-arithmetic tests deleted; `runBrokerPass` order tests re-pointed; the D-07 priority-vs-warming test deleted (no second launcher left to prioritise against).
- `src/mcp/vice/vice-broker-acquire.test.ts` - six `handleAcquire(..., { backend: "stock" })` call sites given a working `allocateRemoteMonitorPort` stub; new `no_free_text_port` test added; the warm-floor-specific I-1 composition test deleted (subsumed by the existing cold-acquire I-1 test); `_maintainWarmFloorForRealBroker` references removed.
- `src/mcp/vice/vice-broker-supervision.test.ts` - `stockInstanceRecord()` fixture gains `remoteMonitorPort`; the structural call-site count narrowed from 2 to 1.
- `src/mcp/vice/vice-broker-launch.test.ts` (deviation, genuinely broken by the narrowed `BrokerRecord` shape) - the fourteen-key discovery-record assertion narrowed to thirteen keys, with an explicit `warm_floor`-absence assertion added.
- `src/mcp/vice/broker-control.test.ts` - `warm_floor`/`warmFloor` removed from every fixture; `host_state` test asserts the field's absence explicitly; the `extractSourceRegion` end-marker updated to the renamed function.
- `src/mcp/vice/broker-kill.test.ts` (deviation) - the startup-banner test updated to assert no replacement variable is named.
- `src/mcp/vice/broker-state.test.ts` - two stale "warm floor" prose mentions corrected.
- `src/mcp/vice/broker-e2e.test.ts` - the crash-respawn-of-a-spare test deleted (redundant with the cold-acquire crash-respawn test); the "served from an already-warm instance" test re-pointed onto a real crash-respawn-produced ready instance; three `VICE_BROKER_WARM_FLOOR=0` isolation fixtures updated to note the isolation is now the default.
- `src/mcp/vice/host-tool.test.ts`, `src/mcp/vice/host-tool-transport.test.ts` (deviation) - stray `warmFloor: 1` fields removed from `HostStateFields` fixtures (compile errors after the type narrowed).
- `src/mcp/vice/stock-broker-live.test.ts`, `src/mcp/vice/text-monitor-live.test.ts`, `src/mcp/vice/stock-a4-checkpoint-flood.test.ts`, `src/mcp/vice/stock-live-broker-monitor.test.ts` (deviation) - `VICE_BROKER_WARM_FLOOR: "0"` env assignments removed (four live-only fixtures); one header comment renamed `maintainWarmFloor()` to `promoteLaunchingInstances()`.

## Decisions Made

See `key-decisions` in the frontmatter above. In summary: option B for the checkpoint (already satisfied by construction); the stock-port guarantee is a runtime assertion, not a type-level one; `superviseChild()` gained an optional parameter for test construction; one e2e warm-floor test was deleted as redundant rather than re-pointed, the other genuinely re-pointed onto a real production path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2/3 - Missing critical / blocking] `broker-control.mts` required editing to implement checkpoint option B, but is not in this plan's own `files_modified` list**
- **Found during:** Task 2, reading the plan's own action text ("map the new failure reason through handleAcquire()'s AcquireOutcome... so it reaches the control plane as its own code rather than collapsing to internal") and `read_first` list (which explicitly names `broker-control.mts`'s `AcquireOutcome`/`ControlErrorCode`).
- **Issue:** Option B cannot be implemented without adding `no_free_text_port` to `ControlErrorCode` and `AcquireOutcome`, both declared in `broker-control.mts` -- a file the plan's own `files_modified` list omits, but whose editing the plan's own action text requires.
- **Fix:** Added the new union member to both types, updated the `HostStateFields`/`AcquireGrant`/grant-response doc comments in the same file for consistency with D-16.
- **Files modified:** `src/mcp/vice/broker-control.mts`, `src/mcp/vice/broker-control.test.ts`
- **Verification:** `npm run typecheck` clean; `node --test broker-control.test.ts` green (219/219 across the full test group).
- **Committed in:** `66d2ef2e` (Task 2 commit)

**2. [Rule 3 - Blocking] Six test files broke or would have broken at compile/runtime, requiring fixes outside this plan's own `files_modified` list**
- **Found during:** Task 2's own typecheck pass (`host-tool-transport.test.ts`, `host-tool.test.ts` -- excess-property compile errors on `HostStateFields`) and Task 3's own repo-wide `VICE_BROKER_WARM_FLOOR` grep gate, plus a full `npm run typecheck` pass that caught `vice-broker-launch.test.ts`'s `record.warm_floor` runtime assertion against a field the narrowed `BrokerRecord` no longer produces.
- **Issue:** Removing `HostStateFields.warmFloor` and `BrokerRecord.warm_floor` is a genuine breaking type/behaviour change with call sites this plan's own `files_modified` list does not enumerate.
- **Fix:** Removed the stale `warmFloor`/`warm_floor` fields/assertions from each affected fixture; narrowed the fourteen-key discovery-record assertion in `vice-broker-launch.test.ts` to thirteen keys with an explicit absence check.
- **Files modified:** `src/mcp/vice/host-tool.test.ts`, `src/mcp/vice/host-tool-transport.test.ts`, `src/mcp/vice/vice-broker-launch.test.ts`
- **Verification:** `npm run typecheck` clean; `node --test vice-broker-launch.test.ts` -- 11/11 pass (4 skipped, requiring container env vars not set here).
- **Committed in:** `c8eaea64` (Task 3 commit)

**3. [Rule 1 - Bug/false documentation] User-facing and log-line text describing the removed warm floor, outside this plan's own `files_modified` list**
- **Found during:** Task 3's own repo-wide sweep for "false documentation" describing removed behaviour (per this plan's own `must_haves.truths`), running `broker-e2e.test.ts` and observing the deployed launcher's own stale startup message ("keeping a warm floor of spare instances ready") print during a live test run; a full-repo grep for "warm floor"/"warm-floor" text beyond the strict `VICE_BROKER_WARM_FLOOR` grep gate.
- **Issue:** `broker-kill.mts`'s startup banner told an operator to "Use VICE_BROKER_WARM_FLOOR instead" of the also-retired `VICE_BROKER_SPARES` -- pointing at a second dead knob. `host-tool.mts` and `install-resources.ts` carried prose/log lines asserting the warm floor is still a live concern.
- **Fix:** Corrected all three to describe current behaviour (VICE launches strictly on demand; no replacement knob exists).
- **Files modified:** `src/mcp/vice/broker-kill.mts`, `src/mcp/vice/broker-kill.test.ts`, `src/mcp/vice/host-tool.mts`, `src/mcp/vice/install-resources.ts`
- **Verification:** `node --test broker-kill.test.ts` green; repo-wide `grep -arc 'VICE_BROKER_WARM_FLOOR' src/mcp/vice/ | grep -v ':0$' | grep -v '/resources/' | grep -v '/node_modules/'` returns empty (0 matches).
- **Committed in:** `c8eaea64` (Task 3 commit)

**4. [Rule 1 - Bug/false documentation, post-hoc] `countLaunching()`'s doc comment still asserted two launch paths, and two more dead imports in `vice-broker.mts` from the same removal**
- **Found during:** NOT found at commit time -- this plan's own repo-wide sweep (deviation #3, above) missed it because the comment names neither `maintainWarmFloor` in isolation grep-friendly form nor `VICE_BROKER_WARM_FLOOR`; it was caught by the orchestrator's own post-completion spot-check and reported back to this executor, which is why this correction is a separate, later commit rather than folded into Task 3's own commit. The SUMMARY is being edited to record this rather than silently backdating it into the Task 3 deviation list above, so it does not claim a clean sweep this plan did not actually have at Task 3's own commit time.
- **Issue:** `broker-state.mts`'s `countLaunching()` doc comment still read "THE single counter both launch paths (a cold acquire... and warm floor maintenance, via maintainWarmFloor...) consult" -- present tense, describing a mechanism (`maintainWarmFloor()`) this plan's own Task 3 had already deleted. Investigating it surfaced a second, closely related, previously-missed defect: `vice-broker.mts` still imported `countReady`, `countTotal` and `countLaunching` from `broker-state.mjs`, but none was called anywhere in the file's actual code -- their only use was as `maintainWarmFloorForRealBroker()`'s own deps, passed through by shorthand object-property syntax (`countReady,` etc.) into the now-deleted `maintainWarmFloor()` call, which is why an earlier parenthesised grep (`countReady(`) during Task 3 missed them as unused.
- **Fix:** Rewrote `countLaunching()`'s doc comment to state plainly that only one launch path remains and that nothing in production calls the counter today, while preserving the 2026-08-01 outage rationale for why a single counter exists. Removed the three dead imports from `vice-broker.mts` (`atCapacity`, the one import genuinely called, is untouched).
- **Files modified:** `src/mcp/vice/broker-state.mts`, `src/mcp/vice/vice-broker.mts`, `src/mcp/vice/resources/broker-state.mjs`, `src/mcp/vice/resources/vice-broker.mjs`
- **Verification:** `npm run typecheck` clean; `npm run build` regenerated both `.mjs` artifacts (JSDoc on real functions survives type-stripping, unlike a comment on a type/interface member, which is why `broker-state.mjs` changed this time when it had not after Task 2's own comment-only edit); `node --test resources-sync.test.ts` -- 2/2 pass; `node --test broker-state.test.ts broker-launch.test.ts vice-broker-acquire.test.ts vice-broker-supervision.test.ts broker-kill.test.ts broker-control.test.ts` -- 243/243 pass.
- **Committed in:** `70dcc05f` (post-completion fixup commit, not part of the original Task 2/3 commits)

---

**Total deviations:** 4 auto-fixed groups (1 Rule 2/3 architectural-adjacent addition, 1 Rule 3 blocking test fix, 2 Rule 1 false-documentation corrections -- one at Task 3's own commit time, one post-hoc after an orchestrator spot-check), spanning 13 files outside this plan's own `files_modified` list. **Impact on plan:** All were necessary consequences of the plan's own stated action text or its own acceptance criteria (the repo-wide `VICE_BROKER_WARM_FLOOR` grep gate is unconditional, not scoped to `files_modified`). Deviation #4 is a documented instance of this plan's own initial "false documentation" sweep being incomplete -- caught by review rather than by this plan's own process -- recorded rather than smoothed over.

## Issues Encountered

- A stale `node_modules/.cache/.build-tmp-*` directory (gitignored, left over from an earlier interrupted build on this host, unrelated to this plan's own work) contained old copies of `VICE_BROKER_WARM_FLOOR` and briefly caused the repo-wide grep gate to read non-zero. Removed (safe: gitignored, transient build cache, not tracked source). Not a defect in this plan's own changes.
- `npm run test:automated`'s first run (default ~2 min budget) showed a transient `audit-root-args.test.ts` failure (`check-skill-tool-coverage`, a `zz-scratch` ENOENT) that did not reproduce on a second full run under `timeout 580` -- matches this project's own documented "Suite races on repo-tree scratch files" intermittent flake, not a regression from this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CHAN-02 is closed: `remoteMonitorPort` is now genuinely mandatory on every stock grant, matching what plans 41-01 and 41-03 already assumed and documented as "later closed by this plan."
- Plan 41-06 (the two remedy tools, `handleDeviceConsole`/`handleWarpSet`) can rely on every stock lease carrying a real text-monitor port with no optional-absence branch to handle.
- The warm floor's removal is complete and self-contained; no other phase or plan in this milestone depended on speculative pre-warming.
- No blockers.

---
*Phase: 41-the-text-channel-its-serialization-authority-and-the-content*
*Completed: 2026-09-09*

## Self-Check: PASSED

- All 26 modified source/test files confirmed present via file listing above; regenerated `resources/*.mjs` siblings confirmed present.
- Both task commits (`66d2ef2e`, `c8eaea64`) confirmed present via `git log --oneline -3`.
- `npm run typecheck` clean (re-confirmed after every edit round, most recently after the final commit).
- `node --test resources-sync.test.ts` -- 2/2 pass (regenerated `resources/*.mjs` byte-identical to a fresh build).
- `node --test broker-launch.test.ts vice-broker-acquire.test.ts vice-broker-supervision.test.ts broker-kill.test.ts broker-control.test.ts` -- 219/219 pass.
- `node --test broker-state.test.ts` -- included in the combined 243/243 pass run performed mid-execution (re-verified individually).
- `node --test vice-broker-launch.test.ts` -- 11/11 pass, 4 skipped (container-env-gated).
- `node --test broker-e2e.test.ts` (run by hand, no other broker running, confirmed via `pgrep`) -- 10/10 pass, 1 skipped (container-env-gated).
- `timeout 580 npm run test:automated` -- 3672 tests, 3 failures, all confined to the documented `anno-register.test.ts` baseline; no failure touches a file this plan modified.
- `grep -arc 'VICE_BROKER_WARM_FLOOR' src/mcp/vice/ | grep -v ':0$' | grep -v '/resources/' | grep -v '/node_modules/'` -- empty (0 matches).
- `selectWarmInstance()`'s function body diffed byte-identical against pre-plan `HEAD`.
- `atCapacity`, `resolveCeiling`, `VICE_BROKER_MAX` in `broker-state.mts` confirmed unedited via `git diff --stat` (0 hunks touching those symbols).
- No unexpected deletions in either task commit beyond the deliberate removal of retired warm-floor code/tests (each named explicitly in the commit body).
- Post-completion fixup (`70dcc05f`) confirmed present via `git log --oneline -1`; `npm run typecheck` clean; `npm run build` + `node --test resources-sync.test.ts` -- 2/2 pass; `node --test broker-state.test.ts broker-launch.test.ts vice-broker-acquire.test.ts vice-broker-supervision.test.ts broker-kill.test.ts broker-control.test.ts` -- 243/243 pass; a repo-wide grep for `maintainWarmFloor` outside `.test.` and `resources/` files confirms all four surviving mentions are past-tense/retrospective.
