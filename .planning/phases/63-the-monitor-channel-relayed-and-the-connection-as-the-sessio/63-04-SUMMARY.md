---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
plan: 04
subsystem: infra
tags: [vice-mcp, broker-control-plane, socket-lifecycle, idle-timeout, incident-record, evidence-before-reclaim]

requires:
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "01"
    provides: "broker-relay.mts's spliceRelay()/RelaySession, the attach control op, the per-claim handle"
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "02"
    provides: "the text channel's own relay attach, resolveRelayChannelTarget()"
  - phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session
    plan: "03"
    provides: "broker-incident.mts's writeBrokerIncident(), GrantRecord.operation, handleOperationNote()"
provides:
  - "broker-relay.mts: RelaySession.close(trigger) -- the ONE thing that ever destroys a relay's two legs, replacing the old auto-destroy-on-close wiring"
  - "broker-relay.mts: RelayDeathTrigger (relay_close/relay_error/relay_idle_expiry), reportDeath()'s per-session guard, and relaySessionKey()"
  - "broker-relay.mts: ArmIdleTimerFn/defaultArmIdleTimer/ArmedIdleTimer -- the broker-owned idle deadline, at-or-past, reset on any byte, suspend/resume"
  - "broker-relay.mts: resolveRelayIdleMs()/resolveRelayKeepAliveMs() -- env-var-backed, never-zero, log-the-rejected-value resolvers"
  - "broker-state.mts: BrokerState.relaySessions -- the live, never-serialised relay-session map keyed by relaySessionKey(grantId, channel)"
  - "vice-broker.mts: handleRelayDeath() -- evidence written and durable BEFORE the claim is cleared or either socket is destroyed"
  - "vice-broker.mts: handleRelayAttach() wires spliceRelay()'s onDeath straight into handleRelayDeath() and records the session"
  - "vice-broker.mts: handleOperationNote() now suspends/resumes the idle deadline on a grant's live relay sessions alongside its existing operation-field write"
  - "vice-broker.mts: handleRelease() writes the same evidence record (control_close trigger) ahead of the existing identity-verified kill, only when an operation was declared"
  - "broker-control.mts: setKeepAlive() on every accepted connection (a duplicated local resolver, since this module is loaded unbuilt by nine of its own test files)"
affects: []

actuals:
  tokens: 37068
  tasks: 3
  commits: 4
  plan_head_before: 66036c72e64b888419f6c253019f2247616858ed

tech-stack:
  added: []
  patterns:
    - "Report-then-release split: spliceRelay() no longer destroys either leg on its own 'close'/'error' events -- it only REPORTS the death (RelaySession.close() is a separate, explicit call), so a caller (handleRelayDeath()) can write evidence in the gap between the two. This is the mechanical shape 'evidence before reclaim' takes at the socket layer."
    - "Measured, not assumed, death classification: a real loopback probe (this session) showed that a plain .destroy() and a graceful .end() both deliver hadError:false on the peer -- there is no reliable 'absence of a FIN' signal. Node's own 'close' event hadError boolean (true only for a genuine transmission error, e.g. Socket.prototype.resetAndDestroy()'s RST) is what actually distinguishes relay_error from relay_close; the plan's own draft language ('no FIN') was corrected against this measurement rather than implemented as written."
    - "Fake-clock ArmIdleTimerFn as the injection seam, not a fake Date.now(): the idle deadline is armed on a real net.Socket via Socket.prototype.setTimeout() in production; a test substitutes the WHOLE arm function (capturing onExpire and driving it via advance()/activity()) rather than trying to fake Node's own internal socket timer."
    - "Duplicate a resolver at a load-mode boundary, don't value-import across it: broker-control.mts is routinely loaded UNBUILT by nine of its own test files and would break if it value-imported a sibling host-bound .mjs; resolveRelayKeepAliveMsLocal() duplicates broker-relay.mts's own resolver with a structural sync test holding the two literal defaults together, mirroring this file's own HELLO_PROTOCOL_MAGIC precedent."

key-files:
  created: []
  modified:
    - src/mcp/vice/broker-relay.mts
    - src/mcp/vice/broker-state.mts
    - src/mcp/vice/vice-broker.mts
    - src/mcp/vice/broker-control.mts
    - src/mcp/vice/broker-relay.test.ts
    - src/mcp/vice/broker-relay-text.test.ts
    - src/mcp/vice/broker-control.test.ts
    - src/mcp/vice/README.md
    - src/mcp/vice/vice-broker-acquire.test.ts
    - src/mcp/vice/vice-broker-supervision.test.ts
    - src/mcp/vice/resources/broker-relay.mjs
    - src/mcp/vice/resources/broker-state.mjs
    - src/mcp/vice/resources/vice-broker.mjs
    - src/mcp/vice/resources/broker-control.mjs

key-decisions:
  - "Death classification uses Node's own 'close' event hadError boolean, not an 'end'-event-presence heuristic -- MEASURED this session (a throwaway probe script) that .destroy() and .end() are indistinguishable on the peer without a real transmission error; only Socket.prototype.resetAndDestroy() (a genuine RST) reliably produces hadError:true. The plan's own prose ('no FIN') is honored in spirit -- an abrupt, unclean death vs. a graceful one -- but implemented against the measured-reliable signal, not the originally-imagined one."
  - "clearMonitorClient() (the FULL per-channel entry, not merely the 'attached' boolean) is what a relay death clears -- superseding Plan 63-02's narrow 'clientSocket.once(close, () => holder.attached = false)' fix entirely. A re-attach after a relay death now mints a FRESH monitor_claim handle rather than resurrecting a dead one, which is the more correct posture 63-02's own SUMMARY anticipated this plan would build."
  - "handleRelayAttach()/handleRelayDeath()/handleRelease() all gained an OPTIONAL deps parameter (writeIncident/clearClaim/kill/idleMs/armIdleTimer/keepAliveMs), defaulting to real production functions -- the same HandleAcquireDeps-style injection register this codebase already uses, rather than a parallel test-only code path."
  - "broker-control.mts duplicates resolveRelayKeepAliveMs() locally rather than value-importing broker-relay.mjs -- see tech-stack.patterns above."

requirements-completed: [SESS-03, SESS-04, SESS-05]

coverage:
  - id: D1
    description: "A relay socket destroyed abruptly (a real TCP RST) or ended gracefully triggers exactly one teardown, with a trigger value that distinguishes the two cases; a second death observation for the same grant and channel is a no-op"
    requirement: "SESS-03"
    verification:
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: an abruptly destroyed relay (a real TCP RST) produces exactly one incident record and exactly one claim clear, in that order"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: a gracefully ended relay reports a trigger that distinguishes it from the abrupt case"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: a second close for the same grant and channel after a teardown has started does nothing and writes no second record"
        status: pass
    human_judgment: false
  - id: D2
    description: "A relay death on one grant leaves a concurrently-live second grant's relay untouched and still able to carry bytes; the instance record and the grant both survive a relay death (channel-scoped, never an instance kill)"
    requirement: "SESS-03"
    verification:
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: a relay death on one grant leaves the other grant's relay open and still able to carry bytes"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: the instance record is still present at its port and the grant is still in the grant map after a relay death"
        status: pass
    human_judgment: false
  - id: D3
    description: "The broker-owned idle deadline fires at exactly the configured bound (never merely past it), a byte in either direction resets the measured interval to zero, and an absent/non-numeric/zero/negative override falls back to the documented default while logging the rejected value by name"
    requirement: "SESS-04"
    verification:
      - kind: integration
        ref: "broker-relay.test.ts#spliceRelay/handleRelayDeath: with an injected timer, an interval exactly equal to the bound fires and one tick short does not"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#spliceRelay: a byte in either direction resets the measured idle interval to zero"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#resolveRelayIdleMs/resolveRelayKeepAliveMs: a raw bound of zero, of a negative number and of a non-numeric string each resolve to the default and each log the rejected raw value"
        status: pass
      - kind: integration
        ref: "broker-relay-text.test.ts#handleRelayDeath (text): with an injected timer, an interval exactly equal to the bound fires and one tick short does not"
        status: pass
    human_judgment: false
  - id: D4
    description: "Declaring an operation suspends the idle deadline on every live relay session a grant holds; clearing it resumes them with a fresh interval; a fired deadline runs the same single teardown as any other death, with its own trigger, leaving the instance record present"
    requirement: "SESS-04"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleOperationNote: declaring an operation suspends the idle deadline on that grant's live sessions and clearing it resumes them"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#handleOperationNote: a grant with no live relay session on a channel has nothing to suspend or resume there -- never an error"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: a fired deadline produces one incident record with the idle trigger, clears the claim, and leaves the instance record present"
        status: pass
      - kind: integration
        ref: "broker-control.test.ts#attachControlProtocol: every accepted connection gets a keepalive delay -- a plain control connection included, not only a relay one"
        status: pass
    human_judgment: false
  - id: D5
    description: "A relay death's incident record is durably on disk before any claim release, socket destroy or kill signal; a writer that throws stops the teardown before any claim is cleared; a death with a declared operation marks the run void, a death with none records the absence explicitly"
    requirement: "SESS-05"
    verification:
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: a death with a declared operation marks the run void; a death with none records the absence and does not mark it void"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: a writer that throws stops the teardown before any claim is cleared"
        status: pass
    human_judgment: false
  - id: D6
    description: "The control-connection release path (handleRelease()) writes the same broker incident record, BEFORE the claim clear/grant delete/instance delete/kill, only when the grant has a declared operation; a quiet release and the mismatched-occupant branch both write nothing, and the pid-match-before-kill discipline is unchanged"
    requirement: "SESS-05"
    verification:
      - kind: unit
        ref: "broker-relay.test.ts#handleRelease: a control-connection close with a declared operation writes exactly one record with the control-close trigger before the kill recorder is called"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#handleRelease: a control-connection close with nothing declared writes no record and still kills exactly as it did before"
        status: pass
      - kind: unit
        ref: "broker-relay.test.ts#handleRelease: the mismatched-occupant branch writes no record, signals nothing and still logs distinctly"
        status: pass
      - kind: other
        ref: "grep gate: vice-broker.mts retains the literal 'instance.pid === grant.pid' comparison, unchanged"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two triggers racing in the same turn (an idle deadline and a socket close) produce exactly one record and one claim clear with a deterministic trigger, repeatably; two channels of one grant dropping together produce one record each with no interleaving, and the same channel dropping twice produces one record total"
    requirement: "SESS-03"
    verification:
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: an idle deadline and a socket close in the same turn produce exactly one record and one claim clear, with a deterministic trigger across repeated runs"
        status: pass
      - kind: integration
        ref: "broker-relay.test.ts#handleRelayDeath: two channels of one grant dropping together produce one record each; the same channel dropping twice produces one record total"
        status: pass
    human_judgment: false
  - id: D8
    description: "The whole suite is green with the death/idle/evidence machinery as the production default, and the rebuilt host-bound artifacts are committed with their sources; no dependency was added"
    verification:
      - kind: other
        ref: "npm --prefix src/mcp/vice run typecheck; npm --prefix src/mcp/vice run build (14 artifacts); resources-sync.test.ts (2/2 pass); npm --prefix src/mcp/vice run test:automated (4058/4058 pass, 0 fail, 9 skipped); npm --prefix src/mcp/vice test (4150/4150 pass, 0 fail, 81 skipped); git diff --stat -- src/mcp/vice/package.json empty"
        status: pass
    human_judgment: false

duration: 55min (approximate -- session start not timestamped; commit span alone was ~49min)
completed: 2026-09-20
status: complete
---

# Phase 63 Plan 4: The Monitor Channel Relayed, and the Connection as the Session Summary

**A relay socket's death (abrupt RST, graceful end, or a broker-owned idle expiry) now writes a durable incident record before releasing anything, tearing down exactly one channel; the same evidence step runs ahead of the existing instance kill when a control connection closes with an operation still declared.**

## Performance

- **Duration:** ~55 min (approximate)
- **Completed:** 2026-09-20T00:47:00+02:00
- **Tasks:** 3 completed (plus one small follow-up test commit)
- **Files modified:** 14 (0 created, 14 modified)

## Accomplishments

- `broker-relay.mts`'s `spliceRelay()` no longer auto-destroys either leg on `"close"`/`"error"` -- it only **reports** the death (`RelayDeathTrigger`: `relay_close` | `relay_error` | `relay_idle_expiry`) through an injectable `onDeath` callback, latched once per session by a `reportDeath()` guard. A new `close(trigger)` entry point on `RelaySession` is the ONE thing that ever destroys the two legs, always called AFTER a caller has had the chance to write evidence.
- `vice-broker.mts`'s new `handleRelayDeath()` is the ONE place a relay death's incident record is written: it looks up the live session (an absent one means a teardown already ran -- write nothing), reads the grant's declared operation, writes the record synchronously with the injectable `writeBrokerIncident()`, and only THEN removes the session from the map, clears the WHOLE per-channel monitor claim (`clearMonitorClient()`, superseding Plan 63-02's narrower `attached`-only fix), and calls `close(trigger)`. A throw from the writer propagates -- nothing is released when evidence cannot be written.
- `handleRelayAttach()` wires every successful splice's `onDeath` straight into `handleRelayDeath()` and records the session in a new `BrokerState.relaySessions` map, keyed by `relaySessionKey(grantId, channel)`.
- **Measured, not assumed** (a real loopback probe run this session): a plain `.destroy()` and a graceful `.end()` are indistinguishable on the peer (`hadError: false` for both) -- there is no reliable "absence of FIN" signal. Death classification uses Node's own `"close"` event `hadError` boolean instead; tests use `Socket.prototype.resetAndDestroy()` to produce a genuine RST for the abrupt case.
- The broker-owned idle deadline: `ArmIdleTimerFn`/`defaultArmIdleTimer` (real `Socket.setTimeout()`, at-or-past comparison) and `resolveRelayIdleMs()`/`resolveRelayKeepAliveMs()` (env-var-backed, `VICE_BROKER_RELAY_IDLE_MS`/`VICE_BROKER_RELAY_KEEPALIVE_MS`, never zero, rejected values logged by name). `RelaySession` gained `suspendIdle()`/`resumeIdle()`; `handleOperationNote()` now suspends every live relay session a grant holds on a declaration and resumes them on clear -- one declaration serves both the SESS-05 evidence requirement and the SESS-04 deadline.
- Keepalive is applied to the client-facing relay socket (`spliceRelay()`) and to every accepted control connection (`broker-control.mts`, via a locally-duplicated resolver -- this module is loaded unbuilt by nine of its own test files and cannot value-import a sibling host-bound module).
- `handleRelease()` (the control-connection close path) gained the same evidence step ahead of its existing identity-verified kill: a `control_close`-triggered, `void: true` record when the grant has a declared operation, nothing when it doesn't; the pid-match-before-kill comparison and the mismatched-occupant branch are byte-for-byte unchanged.
- Two races proven: an idle deadline and a socket close landing in the same synchronous turn produce exactly one record with a deterministic trigger (5 repeated runs); two channels of one grant dropping together produce one record each with no interleaving, and the same channel dropping twice produces one record total.
- README.md documents both new environment knobs, including what the keepalive setting explicitly does NOT bound.

## Task Commits

Each task was committed atomically:

1. **Task 1: A relay death leaves evidence, then lets go of exactly one channel** - `a7e3fee8` (feat)
2. **Task 2: A bound the broker owns, and a probe it honestly does not** - `dbb398d9` (feat)
3. **Task 3: Evidence before the instance kill, and one teardown when two triggers race** - `fdaf65cb` (feat)
   - Follow-up: `609ddba2` (test) -- an explicit proof that a real data write through the relay resets the idle deadline via production's own wiring, added after Task 2/3 closed to cover the plan's own "a byte resets it" behavior more directly than the boundary test alone.

_Note: no TDD cycle in this plan -- `type: execute`, not `type: tdd` (though each task itself carries `tdd="true"` and was developed test-first within its own commit)._

## Files Created/Modified

- `src/mcp/vice/broker-relay.mts` - `RelayDeathTrigger`, `RelaySession.close()`/`suspendIdle()`/`resumeIdle()`, `relaySessionKey()`, `ArmIdleTimerFn`/`defaultArmIdleTimer`/`ArmedIdleTimer`, `resolveRelayIdleMs()`/`resolveRelayKeepAliveMs()`
- `src/mcp/vice/broker-state.mts` - `BrokerState.relaySessions`
- `src/mcp/vice/vice-broker.mts` - `handleRelayDeath()`, `HandleRelayDeathDeps`, `HandleReleaseDeps`, widened `handleRelayAttach()`/`handleOperationNote()`/`handleRelease()`
- `src/mcp/vice/broker-control.mts` - `setKeepAlive()` on every accepted connection, `resolveRelayKeepAliveMsLocal()`
- `src/mcp/vice/broker-relay.test.ts` - Task 1/2/3 proving cases (17 new tests)
- `src/mcp/vice/broker-relay-text.test.ts` - the text channel's own idle-boundary case, plus the temp-dir incident-writer fix for every pre-existing relay-death exercise in this file
- `src/mcp/vice/broker-control.test.ts` - keepalive-on-every-connection case, the `DEFAULT_RELAY_KEEPALIVE_MS` sync test, and the release/recycle structural gate's updated source marker
- `src/mcp/vice/README.md` - `VICE_BROKER_RELAY_IDLE_MS`/`VICE_BROKER_RELAY_KEEPALIVE_MS` environment table rows
- `src/mcp/vice/vice-broker-acquire.test.ts` / `src/mcp/vice/vice-broker-supervision.test.ts` - `relaySessions: new Map()` added to their hand-built `BrokerState` fixtures
- `src/mcp/vice/resources/broker-relay.mjs` / `resources/broker-state.mjs` / `resources/vice-broker.mjs` / `resources/broker-control.mjs` - rebuilt twins

## Decisions Made

- Death classification uses Node's own `hadError` (not an `"end"`-presence heuristic) -- see key-decisions above.
- `clearMonitorClient()` (the whole per-channel entry) supersedes Plan 63-02's narrower `attached`-only fix.
- `handleRelayAttach()`/`handleRelayDeath()`/`handleRelease()` all gained an optional, defaulting-to-production `deps` parameter.
- `broker-control.mts` duplicates `resolveRelayKeepAliveMs()` locally rather than value-importing it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, caught before any commit] The plan's own "no FIN" framing does not distinguish abrupt from graceful death on real loopback sockets**
- **Found during:** Task 1, while designing `spliceRelay()`'s death-detection wiring
- **Issue:** A throwaway probe script (real loopback pair, `.destroy()` vs `.end()` vs `.resetAndDestroy()`) showed `.destroy()` and `.end()` both deliver `hadError: false` to the peer -- an "absence of an `"end"` event" heuristic cannot tell them apart, because ordinary TCP close does not send an RST just because the local side skipped a graceful shutdown.
- **Fix:** Used Node's own `"close"` event `hadError` boolean instead (`true` only for a genuine transmission error); tests use `Socket.prototype.resetAndDestroy()` to produce a real RST for the "abrupt" case.
- **Files modified:** `src/mcp/vice/broker-relay.mts` (design-time only -- no incorrect version was ever committed)
- **Verification:** `broker-relay.test.ts`'s abrupt/graceful cases pass with distinct triggers.
- **Committed in:** `a7e3fee8` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Every pre-existing relay-death test in `broker-relay.test.ts`/`broker-relay-text.test.ts` would have started writing REAL incident files to the machine-level directory**
- **Found during:** Task 1, once `handleRelayAttach()` unconditionally wired `onDeath` into `handleRelayDeath()` (which defaults to the REAL `writeBrokerIncident()`)
- **Issue:** Plans 63-01/63-02's own relay-death exercises (the `stockReconnect()`-after-death tests, the text relay-death test) would now trigger a genuine filesystem write on every test run, on any machine, violating this project's own scratch discipline.
- **Fix:** Widened `handleRelayAttach()`/`startRelayListenerForState()` in both test files with an optional `relayDeathDeps` seam, defaulting to a freshly `mkdtemp`'d scratch directory (reaped in a `finally` block) rather than the real incidents root.
- **Files modified:** `src/mcp/vice/broker-relay.test.ts`, `src/mcp/vice/broker-relay-text.test.ts`
- **Verification:** all pre-existing tests in both files still pass; no incident files appear outside the mkdtemp'd scratch dirs.
- **Committed in:** `a7e3fee8` (Task 1 commit)

**3. [Rule 3 - Blocking] `BrokerState.relaySessions` (required field) rippled into two hand-built `BrokerState` fixtures not named in the plan's `files_modified`**
- **Found during:** Task 1's own `npm run typecheck`
- **Issue:** `vice-broker-acquire.test.ts` and `vice-broker-supervision.test.ts` each construct a raw `BrokerState` object literal directly (`{ instances: new Map(), grants: new Map(), blockedPorts: new Set() }`), which no longer satisfies the widened interface.
- **Fix:** Added `relaySessions: new Map()` to both literals.
- **Files modified:** `src/mcp/vice/vice-broker-acquire.test.ts`, `src/mcp/vice/vice-broker-supervision.test.ts`
- **Verification:** `npm run typecheck` exit 0; both files' own suites re-run individually.
- **Committed in:** `a7e3fee8` (Task 1 commit)

**4. [Rule 3 - Blocking] `broker-control.mts` cannot value-import `resolveRelayKeepAliveMs()` from `broker-relay.mjs`**
- **Found during:** Task 2, running `node --test broker-control.test.ts` directly (it loads `broker-control.mts` UNBUILT, alongside eight other test files)
- **Issue:** A value import of a sibling host-bound module requires a real `./broker-relay.mjs` file to sit beside the SOURCE file, which only exists once built -- exactly the boundary `vice-broker.mts`'s own `classifyBrokerLivenessLocal()`/`isWildcardBindHostLocal()` duplicate rather than cross.
- **Fix:** Duplicated the tiny env-var resolver as `resolveRelayKeepAliveMsLocal()`, plus a structural sync test asserting the two mirrored `DEFAULT_RELAY_KEEPALIVE_MS` literals never drift apart.
- **Files modified:** `src/mcp/vice/broker-control.mts`, `src/mcp/vice/broker-control.test.ts`
- **Verification:** all nine files that load `broker-control.mts` unbuilt still pass; the sync test passes.
- **Committed in:** `dbb398d9` (Task 2 commit)

**5. [Rule 1 - Bug] The release/recycle structural gate's own source marker went stale**
- **Found during:** Task 3, running `broker-control.test.ts` after widening `handleRelease()`'s signature
- **Issue:** `structural: the release and recycle handlers both set the deliberate-death marker...` region-scopes its assertions by searching for the exact literal `function handleRelease(requestId: string, state: BrokerState): void {`, which no longer appears verbatim once the function gained an optional `deps` parameter.
- **Fix:** Updated the marker string to the new full signature; the assertion logic itself is unchanged.
- **Files modified:** `src/mcp/vice/broker-control.test.ts`
- **Verification:** the structural test passes again; its own assertions (marker-before-kill, opposite respawn answers) are unweakened.
- **Committed in:** `fdaf65cb` (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (1 design-time correction caught before any commit, 1 test-hygiene fix preventing real-filesystem writes from the whole suite, 2 blocking ripples across test fixtures/a structural gate, 1 architectural-boundary duplication). No scope creep -- every fix was necessary either for correctness or to keep the whole suite green after this plan's own required changes.
**Impact on plan:** None of the deviations changed this plan's own scope or must_haves; all were required to make the plan's own behavior actually true, provable, or safe to run in this test suite.

## Known Stubs

None.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. `VICE_BROKER_RELAY_IDLE_MS`/`VICE_BROKER_RELAY_KEEPALIVE_MS` are optional operator overrides with safe defaults.

## Next Phase Readiness

- Ready for Plan 63-05 (per the phase's own later-plans symbol list: `resolveSessionLabel()`, session-label and grant-id fields on `StatusInstanceEntry`/`GrantRecord`, `stock-live-relay.test.ts`).
- `SESS-03`, `SESS-04` and `SESS-05` are all marked complete in `REQUIREMENTS.md` -- `SESS-05` was shared with Plan 63-03, whose own SUMMARY deferred it pending this plan.
- Any later plan needing to know "is this relay session still alive" should read `state.relaySessions` directly via `relaySessionKey()`; any later plan needing to tear down a relay channel should call `handleRelayDeath()`, never re-derive a second teardown path.
- The `HandleRelayDeathDeps`/`HandleReleaseDeps` injection registers are the established seam for any future plan wanting to observe or override the broker's evidence-writing or kill behavior in a test.

## Self-Check: PASSED

- Commit hashes verified in `git log --oneline --all`: `a7e3fee8`, `dbb398d9`, `fdaf65cb`, `609ddba2` -- all `FOUND`.
- All plan-level `<verification>` commands re-run and passing: typecheck (exit 0), build (14 artifacts), `resources-sync.test.ts` (2/2 pass), `test:automated` (4058/4058 pass, 0 fail, 9 skipped, exit 0), full `npm test` glob (4150/4150 pass, 0 fail, 81 skipped, exit 0), the real-timer grep gate (`real_sleeps=0`), `git diff --stat -- src/mcp/vice/package.json` empty.
- All plan `<success_criteria>` re-checked against this SUMMARY's own coverage table (D1-D8) -- every one has a passing verification entry.

---
*Phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-session*
*Completed: 2026-09-20*
