---
phase: 03-direct-tools
fixed_at: 2026-08-14T21:06:02Z
review_path: .planning/phases/03-direct-tools/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-14T21:06:02Z
**Source review:** `.planning/phases/03-direct-tools/03-REVIEW.md`
**Iteration:** 1
**Fix scope:** critical_warning (CR-01, CR-02, WR-01, WR-02, WR-03; IN-01 out of scope)

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

Every fix ships with a regression test that fails against the pre-fix code.
In the primary checkout `npx tsc --noEmit` is clean and `npm run test:automated`
reports 948 tests, 943 pass, 0 fail, 5 todo.

## Fixed Issues

### CR-01: A crash-respawn or recycle of a stock-backend instance silently relaunched it with the FORK's argv

**Files modified:** `.claude/mcp/vice/vice-broker.mts`, `.claude/mcp/vice/resources/vice-broker.mjs`, `.claude/mcp/vice/vice-broker-supervision.test.ts` (new)
**Commit:** `83a8732`

**Applied fix:** `superviseDepsFor()` now takes `backend` as a REQUIRED positional
parameter (plus an optional `binmonHost`) and sets both on the returned
`SuperviseChildDeps`. Making it positional-and-required rather than an optional
field is what turns the original omission into a compile error instead of a
silent backend swap. Both production call sites — `handleAcquire()`'s cold arm
and `maintainWarmFloorForRealBroker()` — thread the SAME already-resolved
`backend` value they use for the initial argv; `handleAcquire()`'s
`acquirePortAndLaunch({ backend: deps.backend ?? "fork" })` was collapsed onto
the identical local `backend` const so both routes visibly read from one source.

Deviation from the review's suggested patch: the review proposed threading
`binmonHost` "if configured". No broker call site configures one today
(`acquirePortAndLaunch()`'s own `binmonHost` is likewise unset), so the
parameter is always `undefined` in production; it is threaded anyway, with a
doc comment saying so, purely so adding one later cannot reintroduce the same
launch-argv/respawn-argv divergence.

**Test:** new `vice-broker-supervision.test.ts` drives a real crash-respawn
through the PRODUCTION deps builder (exported as `_superviseDepsFor`, following
`broker-kill.mts`'s `_HANDLED_SIGNALS` test-only-export precedent) rather than a
hand-built deps object, and asserts the respawned argv still carries
`-binarymonitor` and never `-mcpserver`. The test explicitly asserts that the
real builder sets neither `spawn` nor `spawnFactory`, so the two test-only
overrides that keep the respawn off a real process and off wall-clock time are
provably adding a seam rather than masking production behaviour. A second,
structural test asserts no two-argument `superviseDepsFor(stateDir, state)` call
site survives and that exactly two call sites pass a resolved backend — the half
a signature change alone could still regress.

### CR-02: D-13's `-remotemonitor` port was never carried across a respawn, and the old port leaked into `state.blockedPorts`

**Files modified:** `.claude/mcp/vice/broker-launch.mts`, `.claude/mcp/vice/broker-state.mts`, `.claude/mcp/vice/vice-broker.mts`, `.claude/mcp/vice/broker-launch.test.ts`, `.claude/mcp/vice/resources/broker-launch.mjs`, `.claude/mcp/vice/resources/vice-broker.mjs`
**Commit:** `510e097`

**Applied fix (feature regression):** `launchSupervised()` takes an optional
`remoteMonitorPort` and threads it into `tryLaunchOne()`. `handleExit()` passes
the crashed/recycled record's own `remoteMonitorPort` on both relaunch paths
(the recycle branch captures it alongside the pre-kill state/crash-history/
backoff, before the map entry is overwritten). The replacement therefore REUSES
the port the dead process just vacated, exactly as it already reuses the primary
port — which is why this needed no async allocator and left `launchSupervised()`
fully synchronous.

**Applied fix (port leak):** new exported `deleteInstanceRecord(state, port)` in
`broker-launch.mts` deletes the record and removes any `remoteMonitorPort` it
held from `state.blockedPorts` in one step. It replaces the bare
`state.instances.delete()` at all five terminal call sites: `handleExit()`'s
deliberate-teardown and give-up branches, `selectWarmInstance()`'s failed-probe
drop, `handleAcquire()`'s no-pid broken-record cleanup, and `handleRelease()`.
A respawn is deliberately NOT a call site (the block must persist across the
chain of replacements). `BrokerState.blockedPorts`' doc comment now spells out
the two populations that live there and which one is releasable.

Deviations from the review's suggested patch: (a) the review offered "thread
`allocateRemoteMonitorPort` through `SuperviseChildDeps`, or route the respawn
through `acquirePortAndLaunch()`" — reusing the vacated port is strictly better
than reallocating (it needs no async allocation inside a synchronous primitive,
and it cannot itself leak), so neither option was taken; (b) the helper lives in
`broker-launch.mts` rather than `broker-state.mts` because that is the module
that performs the matching `blockedPorts.add`, and `broker-launch.mts`'s
type-only import of `broker-state.mjs` is load-bearing (a value import would
break its own unbuilt unit test). `broker-kill.mts`'s `shutdown()` was left
alone: it runs at process exit, where nothing reallocates.

**Tests:** five new tests in `broker-launch.test.ts` — a crash-respawn and a
recycle each keep the second port on the record and `-remotemonitor` (with the
same port) in the argv; a deliberate teardown and a crash-loop give-up each
release the port back to the allocator; and a unit test of
`deleteInstanceRecord()` proving it releases only a record's OWN second port and
never an unrelated bind-refused block.

### WR-01: `stop` was `Boolean()`-coerced instead of strictly checked

**Files modified:** `.claude/mcp/vice/stock-checkpoints.ts`, `.claude/mcp/vice/stock-checkpoints.test.ts`
**Commit:** `5a7476d`

**Applied fix:** exactly the review's suggested patch, at both call sites
(`handleCheckpointAdd`, `handleWatchAdd`): a non-`undefined`, non-boolean `stop`
is refused naming the type it got, and the accepted value is used as-is rather
than coerced. This matches every other boolean-shaped argument in the file.

**Tests:** three new tests asserting `stop: "false"` and `stop: 0` are refused
with zero sends (a refused argument must never reach the wire) and that the
refusal names the offending type.

### WR-02: latent `'event'` listener leak in the program-counter capture

**Files modified:** `.claude/mcp/vice/stock-execution.ts`, `.claude/mcp/vice/stock-execution.test.ts`
**Commit:** `2d07bce`

**Applied fix:** exactly the review's suggested patch, at both call sites
(`handleExecutionStep`, `handleExecutionUntilReturn`): `capture.finish()` is
called unconditionally and only its return value participates in the `??`
fallback.

**Tests:** two new tests simulate the future parser shape the comment in
`programCounterFromReply()` anticipates — a reply that DOES carry a
`programCounter` — and assert the client's `'event'` listener count is flat
across five calls (against the run-state tracker's own listener as the
baseline), while the reply's own program counter still wins over the captured
one. Both fail against the pre-fix `?? capture.finish()`.

### WR-03: the condition registry was never evicted for a target that has gone away

**Files modified:** `.claude/mcp/vice/stock-checkpoints.ts`, `.claude/mcp/vice/stock-dispatch.ts`, `.claude/mcp/vice/stock-checkpoints.test.ts`, `.claude/mcp/vice/stock-dispatch.test.ts`
**Commit:** `bc8f09e`

**Applied fix:** the review's second option (an explicit eviction hook), placed
so it also covers a path the review's suggested placement would have missed.
New `forgetConditionsForOtherTargets(activeTargetId)` in `stock-checkpoints.ts`
prunes every registry entry except the live target's;
`ensureStockSession()` calls it immediately after a FRESH `stockConnect()`
installs a new held session, keyed on the new session's `targetId`.

Deviation from the review's suggested patch: the review pointed at the
CR-05-guarded teardown, which has the discarded session's `targetId` in hand.
Pruning "all but the live one" at the fresh-connect point instead is a strictly
stronger invariant (at most one target's map is ever retained) and additionally
covers the path where the holder was cleared by a FAILED `stockReconnect()`, so
its stale `targetId` was never handed to a teardown at all. The reuse and
reconnect branches return before the hook, so a `stockReconnect()` to the SAME
machine still never evicts anything — the survives-a-reconnect guarantee that
motivated the `targetId` key is preserved.

`traceGuards` was left alone: it is already a `WeakMap<ViceMonitorClient, ...>`
and is collected with its client.

**Tests:** two unit tests in `stock-checkpoints.test.ts` (three registered
targets, one kept and two dropped, with the live target's condition text still
readable; plus idempotence/empty-registry no-op) and two wiring tests in
`stock-dispatch.test.ts` (a fresh handshake for a new `targetId` evicts the
abandoned entry; a same-`targetId` reuse never does).

## Skipped Issues

None.

## Verification notes

- `npx tsc --noEmit` — clean after every fix.
- `node build.ts` was re-run and the regenerated `resources/*.mjs` committed in
  the SAME commit as each `.mts` change (`resources-sync.test.ts` passes; note
  `resources/broker-state.mjs` needed no update, as the only change to
  `broker-state.mts` was a doc comment).
- `npm run test:automated` in the primary checkout, after the fixes were merged
  back: 948 tests, 943 pass, 0 fail, 5 todo. (While running inside the isolated
  `/tmp` worktree, two `containerpath.test.ts` cases failed because they derive a
  host root from the checkout location; both pass in the primary checkout, and
  neither touches any file changed here.)
- The three `MANUAL_ONLY_TESTS` (`vice-broker-launch.test.ts`,
  `vice-proxy.test.ts`, `broker-e2e.test.ts`) were not run — they are
  dispositioned manual-only by `test-gate.mjs` because they require a real
  broker topology/display and hang outside the devcontainer.
- CR-01, CR-02 and WR-03 are behavioural changes to control flow rather than
  pure defensive checks; their regression tests are the intended proof, but a
  human should confirm the crash-supervision and session-eviction semantics read
  correctly before the phase proceeds to verification.

---

_Fixed: 2026-08-14T21:06:02Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
