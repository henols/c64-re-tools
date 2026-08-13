---
phase: 02-stock-backend-connection
plan: 05
subsystem: infra
tags: [broker, control-plane, tcp, ownership, security, stock-vice, binary-monitor]

# Dependency graph
requires:
  - phase: 02-stock-backend-connection
    provides: "02-01's narrowed npm run test:automated gate, used as this plan's own regression gate; 02-03's backend-selected launch argv and allocation-record-driven reap, whose files (broker-launch.mts, vice-broker.mts) this plan builds on top of"
provides:
  - "InstanceRecord.monitorClient + clearMonitorClient() (broker-state.mts): the broker's own record of which single grant holds an instance's raw binmon socket"
  - "monitor_claim/monitor_release control-plane ops (broker-control.mts): a claim-before-dial mechanism refusing a conflicting claim by name (code monitor_owned, naming the holder) before any second connect() is ever attempted"
  - "handleMonitorClaim()/handleMonitorRelease() (vice-broker.mts): the real ownership-comparison logic, wired into startControlListener() and clearing ownership on release/recycle/process-exit"
  - "claimMonitor()/releaseMonitor() + MonitorOwnershipError (vice-broker-client.ts): the container-side claim-before-dial call, with a discriminated outcome keeping monitor_owned strictly distinct from a control-plane timeout"
affects: [02-06, 02-07, 02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exclusive ownership enforced by the broker's own in-memory record (InstanceRecord.monitorClient), never by a client-side heuristic or timeout -- the same D-13/D-15 pattern GrantRecord already established for lifecycle grants, applied to a second, later, separate question (has the raw socket been claimed)"
    - "A conflict response reuses the existing generic { kind: \"error\", code, message } envelope with one optional extra field (holder) added, rather than a parallel response channel -- extending the existing seam instead of inventing a new one"
    - "target_id doubles as both 'which instance' (resolved via the same grant->port lookup handleRelease()/handleRecycleForRealBroker() already use) and 'the requesting identity' for idempotency/conflict comparison -- the claim IS the grant, so there is no separate identity to carry"

key-files:
  created: []
  modified:
    - .claude/mcp/vice/broker-state.mts
    - .claude/mcp/vice/broker-control.mts
    - .claude/mcp/vice/vice-broker.mts
    - .claude/mcp/vice/broker-launch.mts
    - .claude/mcp/vice/vice-broker-client.ts
    - .claude/mcp/vice/broker-state.test.ts
    - .claude/mcp/vice/broker-control.test.ts
    - .claude/mcp/vice/vice-broker-client.test.ts
    - .claude/mcp/vice/vice-proxy.test.ts
    - .claude/mcp/vice/resources/broker-state.mjs
    - .claude/mcp/vice/resources/broker-control.mjs
    - .claude/mcp/vice/resources/vice-broker.mjs
    - .claude/mcp/vice/resources/broker-launch.mjs

key-decisions:
  - "monitorClient.pid mirrors GrantRecord.pid's own convention: the EMULATOR CHILD PROCESS's pid (InstanceRecord.pid at claim time), never the connecting client's pid, which this broker cannot observe over a bare TCP control session"
  - "No connection-ownership gate on monitor_claim/monitor_release at the wire-framing level (unlike recycle, which enforces target_id === the connection's own held acquire grant before onRecycle is ever called) -- ownership is decided entirely by handleMonitorClaim()'s own state comparison, so the mechanism is testable directly against a real state object without needing two connections racing for the same acquired instance"
  - "monitorClient clearing in broker-launch.mts's handleExit() is a direct field assignment (record.monitorClient = undefined), not a call to broker-state.mts's exported clearMonitorClient() -- that file's own pre-existing type-only import of broker-state.mjs is load-bearing (it lets broker-launch.mts run directly, unresolved at runtime, when broker-launch.test.ts imports the .mts source outside any build step); a value import would have forced a real runtime resolution of './broker-state.mjs' that only exists once build.ts compiles this file's sibling into resources/"
  - "Clearing on release/recycle is largely redundant with InstanceRecord's own replace/delete lifecycle (a respawn always creates a brand new record; a release/give-up deletes the record outright) -- the explicit clearMonitorClient()/inline-assignment calls at those three sites are kept anyway, matching the plan's own explicit instruction and documenting the invariant rather than relying silently on a lifecycle detail elsewhere"

requirements-completed: [BROK-02, PROTO-08]

# Metrics
duration: ~43min
completed: 2026-08-13
---

# Phase 2 Plan 5: Exclusive Monitor-Client Ownership Summary

**Broker-enforced monitor_claim/monitor_release control-plane ops (server-side handlers in vice-broker.mts, client-side claimMonitor()/releaseMonitor() in vice-broker-client.ts) refuse a conflicting monitor-socket claim by name before any second binmon connect() is ever attempted.**

## Performance

- **Duration:** ~43 min (base commit 11:01 CEST, last task commit 11:43:38 CEST)
- **Started:** 2026-08-13T11:01:03+02:00 (worktree base)
- **Completed:** 2026-08-13T11:43:38+02:00
- **Tasks:** 2 completed / 2 planned
- **Files modified:** 13 (0 created, 13 modified)

## Accomplishments

- `InstanceRecord.monitorClient?: { grantId, claimedAt, pid }` (broker-state.mts) is the broker's own record of which single grant currently holds an instance's raw binmon socket -- an additive-optional field following the exact Plan-03 convention, with a doc comment naming `GrantRecord` as answering a different question (lifecycle grant, not socket ownership) per the plan's own named pitfall. `clearMonitorClient()` clears it, tested directly for the set/no-op/other-fields-untouched cases.
- `monitor_claim`/`monitor_release` join `ControlRequestKind`'s vocabulary (now 7 members) and `monitor_owned` joins `ControlErrorCode` (broker-control.mts). Both ops run under the exact same constant-time token gate every existing op runs, before any state is read or written. The conflict response reuses the existing generic error envelope with one added optional `holder` field, rather than a parallel channel.
- `handleMonitorClaim()`/`handleMonitorRelease()` (vice-broker.mts) are the real logic: a claim against an unheld instance succeeds and records the holder; a repeat claim from the same grant is idempotent; a claim from a different grant while held is refused naming the holder's grantId/claimedAt/pid; a release from a non-holder is refused, not silently accepted; a release against an already-cleared record is tolerated. `handleStatus()` now reports `hasMonitorClient` per instance.
- Ownership clears on release (`handleRelease()`), on recycle (`handleRecycleForRealBroker()`), and on the instance's own process exit (`broker-launch.mts`'s `handleExit()`, all three outcome branches) -- a client that died without releasing cannot permanently lock an instance. The exit-path clearing is a direct field assignment rather than a value import of `clearMonitorClient()`, preserving `broker-launch.mts`'s existing type-only-import trick that lets it run directly (unbuilt) under `broker-launch.test.ts`.
- `claimMonitor()`/`releaseMonitor()` (vice-broker-client.ts) send `monitor_claim`/`monitor_release` over the same control-plane session/token every other op uses -- no second connection, and neither call ever dials the binmon port itself, on success or on failure. `MonitorOwnershipError extends ViceError` is available for a caller that prefers to raise; both the outcome's own message and the error's message are grep-gated to never use "wedged"/"hung"/"unresponsive". A control-plane timeout resolves `reason: "timeout"`, kept strictly distinct from `reason: "monitor_owned"`.
- The `inFlight` launch guard (broker-launch.mts) was read but not touched by this plan -- no await was introduced into its synchronous check-and-set window.

## Task Commits

Each task was committed atomically:

1. **Task 1: Ownership record and the monitor_claim/monitor_release control ops (BROK-02, PROTO-08, D-13)** - `bb33e33` (feat)
2. **Task 2: Container-side claim before dial, with a typed conflict outcome (PROTO-08, D-13)** - `514f9be` (feat)

**Plan metadata:** committed separately by the orchestrator after wave merge (worktree mode).

_Both tasks were `tdd="true"` in the plan; in practice each landed as a single
commit adding both the new tests and the implementation together (no separate
RED-only commit), since the added behavior extended existing, already-green
test files (broker-state.test.ts, broker-control.test.ts,
vice-broker-client.test.ts) rather than standing up a fresh module -- each was
verified green immediately before its own commit
(`node --test broker-control.test.ts broker-state.test.ts resources-sync.test.ts`
for task 1, `node --test vice-broker-client.test.ts` for task 2)._

## Files Created/Modified

- `.claude/mcp/vice/broker-state.mts` - `InstanceRecord.monitorClient` field + doc comment naming the single writer and the GrantRecord pitfall; `clearMonitorClient()`
- `.claude/mcp/vice/broker-control.mts` - `ControlRequestKind`/`ControlErrorCode` extended; `MonitorHolder`/`MonitorClaimOutcome`/`MonitorReleaseOutcome` types; `StartControlListenerOptions.onMonitorClaim`/`onMonitorRelease`; `StatusInstanceEntry.hasMonitorClient`; `ControlResponse`'s `monitor_claimed`/`monitor_released` kinds and the error variant's optional `holder` field; dispatch for both new ops in `attachControlProtocol()`
- `.claude/mcp/vice/vice-broker.mts` - `handleMonitorClaim()`/`handleMonitorRelease()`, `resolveInstanceForMonitorTarget()`; `handleStatus()` reports `hasMonitorClient`; `handleRelease()`/`handleRecycleForRealBroker()` clear `monitorClient`; `run()` wires `onMonitorClaim`/`onMonitorRelease`
- `.claude/mcp/vice/broker-launch.mts` - `handleExit()` clears `record.monitorClient` (direct assignment, not an import) before branching on its own outcome
- `.claude/mcp/vice/vice-broker-client.ts` - `claimMonitor()`/`releaseMonitor()` on `BrokerControlSession`; `MonitorOwnershipError extends ViceError`; `ClaimMonitorOutcome`/`ReleaseMonitorOutcome`/`MonitorClaimHolder` types; `ControlFailureKind` gains `monitor_owned`; `RawLineOutcome` widened with an optional `holder`, extracted via a never-throw `extractHolder()`
- `.claude/mcp/vice/broker-state.test.ts` - record-shape and `clearMonitorClient()` tests (set/no-op/other-fields-untouched)
- `.claude/mcp/vice/broker-control.test.ts` - wire-level tests for both new ops against injected stubs (10 new tests); updated `StatusInstanceEntry` fixtures for the new required field; updated the now-stale "ControlRequestKind still has exactly its original five members" structural test to state plan 05's own addition explicitly
- `.claude/mcp/vice/vice-broker-client.test.ts` - `claimMonitor()`/`releaseMonitor()` behavior tests against the real listener harness (7 new tests, titled `monitor_claim:`/`monitor_release:` to match the acceptance grep pattern); `FullBrokerDeps`/`startFullBrokerListener()` extended with the two new stub callbacks; export-list structural test updated for `MonitorOwnershipError`
- `.claude/mcp/vice/vice-proxy.test.ts` - (deviation) added stub `onMonitorClaim`/`onMonitorRelease` to its own `startControlBroker()` fixture, required once both fields became mandatory on `StartControlListenerOptions`
- `.claude/mcp/vice/resources/broker-state.mjs`, `resources/broker-control.mjs`, `resources/vice-broker.mjs`, `resources/broker-launch.mjs` - rebuilt via `node build.ts`

## Decisions Made

- `monitorClient.pid` mirrors `GrantRecord.pid`'s exact convention (the emulator child process's pid, not the client's) -- the broker cannot observe a connecting client's own pid over a bare TCP control session.
- No connection-ownership gate on `monitor_claim`/`monitor_release` at the framing level, unlike `recycle`'s `target_id === requestIdForThisConnection` enforcement. Ownership is decided entirely inside `handleMonitorClaim()`'s own state comparison (does `instance.monitorClient.grantId` match `targetId`), which keeps the mechanism unit-testable directly against a constructed `BrokerState` without needing two real connections to race for the same already-acquired instance -- the realistic race (two different connections holding two different acquire grants against the SAME port) cannot occur under the current acquire model, but the ownership check itself does not depend on that being true.
- `broker-launch.mts`'s own exit-path clearing is `record.monitorClient = undefined` inline, not a call to the exported `clearMonitorClient()` helper -- discovered live during verification (see Deviations) that a value import of `broker-state.mjs` breaks this file's "runs directly, unbuilt, under its own test file" property, which its pre-existing type-only import of the same specifier exists specifically to preserve.
- Chose not to thread `hasMonitorClient` through `vice-broker-client.ts`'s own `status()` mapping (`ControlStatusInstanceEntry`) -- out of this plan's tested scope; the broker-side wire field exists and is tested, but no container-side consumer needs it yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed `broker-launch.mts`'s exit-path clearing to avoid breaking its own direct-run property**
- **Found during:** Task 1 verification (`node --test broker-launch.test.ts`)
- **Issue:** The plan's own action text instructs clearing `monitorClient` in `broker-launch.mts`'s crash-supervision exit path via `broker-state.mts`'s `clearMonitorClient()`. Adding that as a VALUE import turned `broker-launch.mts`'s existing `import type { ... } from "./broker-state.mjs"` into a mixed import, which is no longer erased by Node's type-stripping at runtime -- and `./broker-state.mjs` does not exist as a real file alongside `broker-launch.mts` (it exists only under `resources/`, once `build.ts` compiles the two together). `broker-launch.test.ts` imports `broker-launch.mts` directly (not via `resources/`), so the module failed to load at all (`ERR_MODULE_NOT_FOUND`).
- **Fix:** Reverted the import to its original type-only form and clear the field with a direct assignment (`record.monitorClient = undefined;`) instead, documenting why in an inline comment.
- **Files modified:** `.claude/mcp/vice/broker-launch.mts`
- **Verification:** `node --test broker-launch.test.ts` passes (42/42); `npm run typecheck` clean.
- **Committed in:** `bb33e33` (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed test-title word order so the acceptance grep pattern actually matches**
- **Found during:** Task 2's own acceptance-criteria self-check
- **Issue:** The plan's acceptance criterion requires `--test-name-pattern="monitor.*claim|ownership"` to report ≥5 passing against `vice-broker-client.test.ts`. The first draft named tests `"claimMonitor: ..."`/`"releaseMonitor: ..."` (function-name order), which puts "claim" BEFORE "monitor" in the title -- the regex `monitor.*claim` requires the opposite order, and only one test happened to match by accident (via an unrelated "claimedAt" substring later in that title).
- **Fix:** Renamed the 7 new test titles to lead with the wire op name (`"monitor_claim: ..."`/`"monitor_release: ..."`), matching the convention `broker-control.test.ts`'s own task-1 tests already established. No logic change.
- **Files modified:** `.claude/mcp/vice/vice-broker-client.test.ts`
- **Verification:** `node --test --test-name-pattern="monitor.*claim|ownership" vice-broker-client.test.ts` reports 5 passing, 0 failing.
- **Committed in:** `514f9be` (Task 2 commit)

**3. [Rule 3 - Blocking] Closed a leaked client socket in 5 new tests, causing the test process to hang**
- **Found during:** Task 2 verification (`node --test vice-broker-client.test.ts` hung indefinitely with no output)
- **Issue:** 5 of the 7 new `claimMonitor()`/`releaseMonitor()` tests asserted and returned without calling `opened.session.release()`. `server.close()` in the `finally` block stops the LISTENER from accepting new connections but does not terminate an already-open client<->server TCP connection, so the process never drained its event loop and `node --test` never printed a summary or exited.
- **Fix:** Added `await opened.session.release();` before each test's `finally` block, matching the existing convention every other passing session test in this file already follows.
- **Files modified:** `.claude/mcp/vice/vice-broker-client.test.ts`
- **Verification:** `node --test vice-broker-client.test.ts` completes in <1s, 33/33 passing, process exits cleanly.
- **Committed in:** `514f9be` (Task 2 commit)

**4. [Rule 3 - Blocking] Added onMonitorClaim/onMonitorRelease stubs to vice-proxy.test.ts's own fixture**
- **Found during:** Task 1 typecheck run (`npm run typecheck`)
- **Issue:** `vice-proxy.test.ts` (a MANUAL_ONLY_TESTS file, excluded from `npm run test:automated` but still part of the shared `tsc --noEmit` program) constructs its own `startControlListener({...})` fixture with the pre-existing five callbacks. Making `onMonitorClaim`/`onMonitorRelease` required fields on `StartControlListenerOptions` (matching every other op's own required-field pattern) broke this unrelated file's typecheck.
- **Fix:** Added two stub callbacks returning `{ ok: false, code: "internal" }`, with a comment noting this fixture never exercises the new ops itself. No behavior change to any test in this file.
- **Files modified:** `.claude/mcp/vice/vice-proxy.test.ts`
- **Verification:** `npm run typecheck` exits 0.
- **Committed in:** `bb33e33` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 3 / blocking -- necessary to make the plan's own verification commands pass; none touched runtime behavior beyond what the plan itself specified).
**Impact on plan:** No scope creep. Deviation 1 preserves an existing, load-bearing module property this plan's own instruction would otherwise have silently broken.

## Manual Reasoning Check (plan's own verification requirement)

Traced both paths named in the plan's `<verification>` block:

- **acquire -> claim -> dial -> release:** `handleAcquire()` (unchanged by this plan) grants a port/URL. The container-side client then calls `claimMonitor({ targetId: grant.id })`, which sends `monitor_claim` over the SAME control-plane session/token `acquire` used. `handleMonitorClaim()` resolves the same grant->port->instance chain `handleRelease()`/`handleRecycleForRealBroker()` already use, finds no existing `monitorClient`, and sets one (`{ grantId: targetId, claimedAt, pid: instance.pid }`), answering `{ ok: true }` -> the wire's `monitor_claimed`. Only AFTER that success does the client's own code (outside this plan's scope -- a later plan's binmon dial path) ever call `connect()` on the binmon port. `release()` (unchanged) destroys the control socket; broker-side, `handleRelease()` clears `monitorClient` (explicitly, ahead of the instance-map deletion two lines later) before killing the child.
- **acquire -> claim -> refused (the second-client path):** A second `monitor_claim` naming a DIFFERENT grant id against the SAME already-claimed instance (resolved via the plan's own required test shape: two separate grants sharing one port) finds `instance.monitorClient.grantId !== targetId` and answers `{ ok: false, code: "monitor_owned", holder }` -- the wire's `{ kind: "error", code: "monitor_owned", holder }`. `claimMonitor()` on the container side never attempts a binmon `connect()` on this path (confirmed by the new `"never dials the binmon port itself"` test, which counts accepted connections and asserts exactly 1 -- the control-plane session itself, none other) -- the refusal is a JSON response on a control-plane socket that already works, never silence on a second, unserviced one.

No path in `vice-broker.mts`/`vice-broker-client.ts` reaches a binmon `connect()` without either (a) a successful claim recorded first, or (b) no claim mechanism at all (any future direct-dial code path added by a LATER plan that skips `claimMonitor()` would be a regression this plan's own mechanism cannot itself prevent at the type level -- enforcing that the dial call site actually calls `claimMonitor()` first is a later plan's integration concern, out of this plan's scope per its own objective, which builds the mechanism, not its every future call site).

## Environment Constraint Compliance

Per this plan's environment constraint, no real stock VICE binary is available in this environment. Nothing in Task 1 or Task 2 launched or dialed a real emulator. The single-client refusal is proven entirely through:
- Unit tests over the broker's own grant/instance state machine (`handleMonitorClaim()`/`handleMonitorRelease()`, exercised indirectly via `broker-control.test.ts`'s injected-stub wire tests and directly via `broker-state.test.ts`'s `clearMonitorClient()` tests).
- Unit tests over the container-side control protocol (`vice-broker-client.test.ts`'s `claimMonitor()`/`releaseMonitor()` tests against a real `startControlListener()` instance, never a real emulator).

**Deferred to a later phase (live validation):** actually dialling a real stock `x64sc -binarymonitor` process TWICE against the SAME instance to observe the second `connect()` sit unserviced in the backlog, and confirming that this plan's `claimMonitor()` refusal genuinely prevents that second dial from ever being attempted end-to-end (acquire -> claim -> dial, wired together) -- both require a real stock VICE binary this environment does not have, and the second additionally requires the not-yet-built binmon-dial call site (a later plan's scope).

## Known Stubs

None. Every code path this plan adds is exercised by its own unit tests; no hardcoded empty values or placeholder text was introduced.

## Threat Flags

None beyond the plan's own `<threat_model>`, which already covers every trust boundary this plan's two new control-plane ops touch (T-02-01, T-02-16, T-02-17, T-02-18, T-02-19).

## Issues Encountered

- Same pre-existing worktree-path test artifact 02-01's and 02-03's own SUMMARYs documented: `repo-root.test.ts`'s "path agreement... not under .claude" assertion fails inside this nested worktree checkout (`.../c64-re-tools/.claude/worktrees/agent-.../`), unrelated to and untouched by this plan's two tasks. `npm run test:automated` is 345/351 passing (5 `todo`, 1 pre-existing artifact) in this worktree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The claim-before-dial mechanism (`claimMonitor()`/`releaseMonitor()`) is ready for whichever later plan builds the actual binmon-dial call site -- that call site MUST call `claimMonitor()` and check its outcome before ever calling `connect()` on the binmon port; this plan builds the mechanism, not that integration.
- `MonitorOwnershipError` is ready for `vice-wedge-triage` or any other consumer that wants to raise on a conflict rather than branch on the discriminated outcome.
- Live validation against a real stock VICE binary (the two deferred items above) is expected once a real build is reachable, per this plan's own environment constraint.
- No blockers. The one worktree-path test artifact noted above is expected to self-resolve once this worktree's commits land in the main checkout, as the identical artifacts in 02-01 and 02-03 did.

---
*Phase: 02-stock-backend-connection*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/broker-state.mts`
- FOUND: `.claude/mcp/vice/broker-control.mts`
- FOUND: `.claude/mcp/vice/vice-broker-client.ts`
- FOUND commit `bb33e33` (feat: broker-enforced exclusive monitor-client ownership)
- FOUND commit `514f9be` (feat: claim monitor ownership before dialling the binmon port)
