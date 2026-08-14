---
phase: 03-direct-tools
reviewed: 2026-08-14T18:15:38Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - .claude/mcp/vice/broker-launch.mts
  - .claude/mcp/vice/broker-launch.test.ts
  - .claude/mcp/vice/broker-state.mts
  - .claude/mcp/vice/broker-state.test.ts
  - .claude/mcp/vice/fork-manifest-surface.test.ts
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/resources/broker-launch.mjs
  - .claude/mcp/vice/resources/broker-state.mjs
  - .claude/mcp/vice/resources/vice-broker.mjs
  - .claude/mcp/vice/stock-address.test.ts
  - .claude/mcp/vice/stock-address.ts
  - .claude/mcp/vice/stock-checkpoints.test.ts
  - .claude/mcp/vice/stock-checkpoints.ts
  - .claude/mcp/vice/stock-condition.test.ts
  - .claude/mcp/vice/stock-condition.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-execution.test.ts
  - .claude/mcp/vice/stock-execution.ts
  - .claude/mcp/vice/stock-handler.test.ts
  - .claude/mcp/vice/stock-handler.ts
  - .claude/mcp/vice/stock-input.test.ts
  - .claude/mcp/vice/stock-input.ts
  - .claude/mcp/vice/stock-machine.test.ts
  - .claude/mcp/vice/stock-machine.ts
  - .claude/mcp/vice/stock-memory.test.ts
  - .claude/mcp/vice/stock-memory.ts
  - .claude/mcp/vice/stock-paths.test.ts
  - .claude/mcp/vice/stock-paths.ts
  - .claude/mcp/vice/stock-petscii.test.ts
  - .claude/mcp/vice/stock-petscii.ts
  - .claude/mcp/vice/stock-protocol.test.ts
  - .claude/mcp/vice/stock-protocol.ts
  - .claude/mcp/vice/stock-registers.test.ts
  - .claude/mcp/vice/stock-registers.ts
  - .claude/mcp/vice/stock-runstate.test.ts
  - .claude/mcp/vice/stock-runstate.ts
  - .claude/mcp/vice/stock-schema-check.test.ts
  - .claude/mcp/vice/stock-schema-check.ts
  - .claude/mcp/vice/tools-manifest.json
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/mcp/vice/vice-broker.mts
  - docs/stock-vice-parity.md
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-14T18:15:38Z
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

This phase implements the request-body encoders, the D-04 address parser, the
D-09 condition AST/emitter, the D-06/D-07/D-08 run-state projection, and the
nine direct-tool family handlers on top of Phase 2's stock-protocol
plumbing, plus D-13's broker-side `-remotemonitor` launch flag and second
port. The bulk of the new tool-handler code (`stock-memory.ts`,
`stock-registers.ts`, `stock-checkpoints.ts`, `stock-execution.ts`,
`stock-machine.ts`, `stock-input.ts`, `stock-petscii.ts`,
`stock-condition.ts`, `stock-address.ts`, `stock-paths.ts`,
`stock-handler.ts`, `stock-dispatch.ts`) is careful, well-documented, and
consistent with the locked decisions (D-01 through D-17): the halt policy,
the runState projection, the fail-closed condition cleanup, the D-11 trace
guard, and the D-17 path-translation table were all traced against their
call sites and found correctly wired.

The two Critical findings below are both in the broker's crash-supervision
path (`broker-launch.mts` / `vice-broker.mts`), not in the tool-handler
layer: the code path that respawns or recycles an already-running instance
(as opposed to a fresh cold/warm launch) was not updated to carry the
backend selection or the D-13 second-port allocation through, so a
long-running broker silently regresses on exactly the crash scenario the
supervisor exists to handle. Both are demonstrable from the source with no
speculation about runtime behavior the tests don't already establish.

## Critical Issues

### CR-01: A crash-respawn or recycle of a stock-backend instance silently relaunches it with the FORK's argv, not stock's

**File:** `.claude/mcp/vice/vice-broker.mts:308-315` (`superviseDepsFor()`), consumed by `.claude/mcp/vice/broker-launch.mts:244` (`spawnAndRecordInstance()`'s `const backend = deps.backend ?? "fork";`) via `broker-launch.mts:1156-1215` (`launchSupervised()`) and `broker-launch.mts:1019-1105` (`handleExit()`)

**Issue:** Both real production call sites that install the crash-supervision exit handler build their `SuperviseChildDeps` object exclusively through `superviseDepsFor(stateDir, state)`:

```ts
function superviseDepsFor(stateDir: string, state: BrokerState): SuperviseChildDeps {
  return {
    state,
    stateDir,
    epoch: { epochPathFor, instanceLogDirFor, nextEpochFor, writeEpochRecord },
    log: (line: string) => process.stderr.write(`${line}\n`),
  };
}
```

This object never sets `backend` (or `binmonHost`), even though `SuperviseChildDeps` declares both fields and `launchSupervised()` threads `deps.backend`/`deps.binmonHost` straight through to `tryLaunchOne()` → `spawnAndRecordInstance()`, which resolves `const backend = deps.backend ?? "fork";`.

The result: the FIRST launch of any instance (cold acquire or warm-floor pass) correctly resolves the broker's actual backend via `handleAcquire()`/`maintainWarmFloorForRealBroker()` (both of which do pass `backend`). But the moment that instance's child process exits for ANY reason handled by the crash supervisor — a genuine crash-and-respawn, or a deliberate `respawnAfterKill` recycle (e.g. triggered by `vice_recycle` / wedge-triage) — `handleExit()` calls `launchSupervised()` with the very same `deps` object `withCrashSupervision()` closed over at spawn time, which is always `superviseDepsFor()`'s output with `backend` silently `undefined`. `spawnAndRecordInstance()` then defaults to `"fork"`, and `buildViceArgs()` builds `-mcpserver -mcpserverhost ... -mcpserverport ...` instead of `-binarymonitor -binarymonitoraddress ...` for what is supposed to be a stock VICE binary.

Stock (upstream) VICE does not understand `-mcpserver` at all — it is the custom fork's own patched flag. The respawned/recycled process will not open a binary-monitor listener on the expected port, so the broker will keep an `InstanceRecord` around that never becomes reachable over the binary monitor again, while believing (and reporting via `countReady`/`countTotal`) that it is a normal pool member. This defeats the entire stock backend for any deployment that experiences even one crash or one recycle over the life of the broker process — which crash supervision exists specifically to handle.

No test exercises this: `broker-launch.test.ts`'s respawn/recycle tests build `SuperviseChildDeps` by hand per-test (so they can and do pass `backend: "stock"` directly), and there is no `vice-broker*.test.ts` coverage of `superviseDepsFor()`'s own fixed shape, so the gap between the two is invisible to the current suite.

**Fix:**
```ts
// vice-broker.mts
function superviseDepsFor(stateDir: string, state: BrokerState, backend: ViceBackend, binmonHost?: string): SuperviseChildDeps {
  return {
    state,
    stateDir,
    epoch: { epochPathFor, instanceLogDirFor, nextEpochFor, writeEpochRecord },
    log: (line: string) => process.stderr.write(`${line}\n`),
    backend,
    binmonHost,
  };
}
```
and thread the already-resolved `backend` (and `binmonHost`, if configured) into both call sites (`handleAcquire`'s cold arm, `maintainWarmFloorForRealBroker`), exactly as `handleAcquire`/`maintainWarmFloorForRealBroker` already do for their own direct launches. Add a test that installs `withCrashSupervision` through the REAL `superviseDepsFor()` (not a hand-built deps object) and asserts the respawned argv still contains `-binarymonitor` when the broker was started with `backend: "stock"`.

---

### CR-02: D-13's `-remotemonitor` port is never carried across a crash-respawn or recycle, and the old port is leaked permanently into `state.blockedPorts`

**File:** `.claude/mcp/vice/broker-launch.mts:952-987` (`SuperviseChildDeps` — no `remoteMonitorPort`/`allocateRemoteMonitorPort` field), `.claude/mcp/vice/broker-launch.mts:1156-1215` (`launchSupervised()` calls `tryLaunchOne()`, not `acquirePortAndLaunch()`), `.claude/mcp/vice/broker-launch.mts:405` (`deps.state.blockedPorts.add(remoteResult.port)`)

**Issue:** The D-13 second-port allocation (`allocateRemoteMonitorPort`) is wired ONLY into `acquirePortAndLaunch()`, which is used by the cold-acquire and warm-floor launch paths. The crash-supervision respawn/recycle path (`handleExit()` → `launchSupervised()`) calls `tryLaunchOne()` directly — a deliberately lower-level primitive that has no concept of a second port at all (`TryLaunchDeps` does carry a `remoteMonitorPort` field, but `launchSupervised()` never populates it; `SuperviseChildDeps` has no such field to populate it from). Two compounding consequences:

1. **Feature regression:** the replacement instance created by any respawn or recycle never gets a `remoteMonitorPort` allocated, so its `InstanceRecord` loses the field, and its argv loses `-remotemonitor`/`-remotemonitoraddress` entirely — even though the ORIGINAL instance (before the crash) had both. D-13's own stated goal ("the instance record carries it") silently stops being true the moment an instance is replaced.
2. **Port leak:** the OLD `remoteMonitorPort` that belonged to the crashed/recycled instance was added to `state.blockedPorts` at allocation time (`broker-launch.mts:405`) and is never removed from it anywhere in this file or `broker-state.mts` — `blockPort()`/`state.blockedPorts` has no corresponding "release" function, and nothing calls `state.blockedPorts.delete(...)` when the paired instance is torn down (`state.instances.delete(port)` is called in three places in `broker-launch.mts` — `handleExit()`'s deliberate-teardown and give-up branches, and elsewhere — none of them touch `blockedPorts`). Since `nextFreePort()`/`allocateRemoteMonitorPort` never reconsider a blocked candidate for the lifetime of the process, every crash-respawn or recycle of a stock instance permanently consumes one more port out of the fixed `PORT_SCAN_CEILING` (100) window, even though the actual port is free again the moment the old process exits. A long-running broker (which is the explicit design goal of an on-demand pool with crash supervision and warm-floor maintenance) will eventually exhaust its allocatable port band and start returning `no_free_port` for ordinary launches, entirely from routine churn, with no operator recourse short of restarting the whole broker.

The threat table in `03-04-PLAN.md` (T-3-08) considered only "a single allocation exhausting the port band within one call" (mitigated by the `exclude` set) — it did not consider unbounded accumulation across many respawns/recycles over the process's lifetime, so this is a genuine gap, not a knowingly-accepted tradeoff. `broker-state.test.ts` only asserts that `remoteMonitorPort` survives `_snapshotState()`'s deep copy and that `nextFreePort`'s `exclude` skip does not itself block a port — nothing exercises freeing a `remoteMonitorPort` on teardown.

**Fix:** Thread `remoteMonitorPort`/`allocateRemoteMonitorPort` through `SuperviseChildDeps` and `launchSupervised()` the same way `AcquirePortAndLaunchDeps` already does (or route the respawn/recycle path through `acquirePortAndLaunch()` instead of the bare `tryLaunchOne()`, if the supervision bookkeeping can tolerate it). Separately, add a `releasePort(state, port)` (or extend `state.instances.delete()`'s call sites) that removes a `remoteMonitorPort` from `state.blockedPorts` at every point an `InstanceRecord` carrying one is deleted, so the port becomes reusable once its owning process is actually gone.

## Warnings

### WR-01: `stock-checkpoints.ts`'s `stop` argument is coerced with `Boolean()` instead of a strict boolean check, inconsistent with every other flag in the same handlers

**File:** `.claude/mcp/vice/stock-checkpoints.ts:401` (`handleCheckpointAdd`) and `.claude/mcp/vice/stock-checkpoints.ts:669` (`handleWatchAdd`)

**Issue:** Both handlers compute `const stop = args.stop === undefined ? true : Boolean(args.stop);`, while every other boolean-shaped argument in the same file (`args.load === true`, `args.store === true`, `args.exec === true`, `args.acknowledgeTraceRisk === true`) and in the sibling family modules (`stock-machine.ts`, `stock-input.ts`) uses a strict `typeof x !== "boolean"` refusal or an `=== true` check. `Boolean("false")` is `true` in JavaScript (any non-empty string is truthy), so a caller that sends `stop: "false"` (a plausible mistake for an LLM-driven MCP client formatting a value as a string) silently gets `stop: true` instead of the non-stopping trace mode it asked for — with no error, no warning, and a different checkpoint behavior than requested.

This is reachable in practice, not just in theory: `vice-proxy.ts`'s `rawJsonSchemaAsStandardSchema()` wraps every manifest `inputSchema` with a `validate: (value) => ({ value })` that performs no actual type checking (`vice-proxy.ts:3054`), so a type-mismatched argument is never rejected before it reaches the handler — each handler's own checks are the only enforcement that exists. This one argument is the sole spot in this file that doesn't get one.

The direction of the failure is the safer one (silently defaulting to `stop: true`, the stopping/safe mode, rather than silently enabling the hazardous `stop: false` trace mode), so this is not itself a safety bypass of D-11's guard — but it is a real, demonstrable behavioral bug: the caller's explicit request is silently overridden with no diagnostic.

**Fix:**
```ts
if (args.stop !== undefined && typeof args.stop !== "boolean") {
  return isErrorText(`vice_checkpoint_add: stop must be a boolean, got ${typeof args.stop}`);
}
const stop = args.stop === undefined ? true : args.stop;
```
(same change at the `vice_watch_add` call site).

### WR-02: Latent `'event'` listener leak in `stock-execution.ts`'s program-counter capture, dormant only because of today's parser output

**File:** `.claude/mcp/vice/stock-execution.ts:86-100` (`beginProgramCounterCapture`), used at `stock-execution.ts:257-266` (`handleExecutionStep`) and `stock-execution.ts:299-308` (`handleExecutionUntilReturn`)

**Issue:** Both handlers do:
```ts
const capture = beginProgramCounterCapture(session.client);
...
const programCounter = programCounterFromReply(response) ?? capture.finish();
```
`capture.finish()` — the ONLY thing that calls `client.off("event", listener)` — is invoked via `??`, so it only runs when `programCounterFromReply(response)` returns `undefined`. Today that is always true (`ParsedResponse` never gives `AdvanceInstructions`/`ExecuteUntilReturn` a `programCounter` field, per this file's own comment at line 106), so the listener is always removed in practice. But the moment a future change to `stock-protocol.ts`'s parser adds a genuine `programCounter` to either response shape (explicitly flagged in this file's own comment as "a future parser extension... picked up for free"), the short-circuit means `capture.finish()` is silently never called on that code path — leaking one `'event'` listener on `session.client` per call, forever, since `session.client` is a long-lived, reused object across many tool calls.

**Fix:** Always call `capture.finish()` unconditionally, and use its return value only as the fallback:
```ts
const capturedProgramCounter = capture.finish();
const programCounter = programCounterFromReply(response) ?? capturedProgramCounter;
```

### WR-03: `stock-checkpoints.ts`'s condition registry and trace-guard tables are never evicted for a target/client that has gone away

**File:** `.claude/mcp/vice/stock-checkpoints.ts:129` (`conditionRegistry`, keyed on `session.targetId`) and `.claude/mcp/vice/stock-checkpoints.ts:256` (`traceGuards`, a `WeakMap<ViceMonitorClient, TraceGuardState>`)

**Issue:** `conditionRegistry` is a plain `Map<string, Map<number, string>>` keyed by `session.targetId` — a real (non-weak) map, so an entry is created the first time a condition is set against a given target and is never removed, even after that target's instance is recycled, crashes, or is replaced by a different broker-managed instance with a new `targetId`. Over the life of a long-running broker/proxy process serving many different targets over time (which is exactly the scenario the crash-supervision and warm-floor machinery in this same phase's other files are built to handle routinely), this map grows without bound. This is the same class of "never evicted for the life of the process" issue as CR-02 above, just in the tool-handler layer rather than the broker, and at a much smaller scale (one small `Map<number,string>` per distinct target ever seen, not one port per respawn) — worth fixing for correctness of the design intent ("keyed on session.targetId... so a stockReconnect() ... keeps the registry aligned with the machine identity"), which implicitly assumes a bounded population of live targets, not an ever-growing one.

**Fix:** Either key `conditionRegistry` off something that is itself garbage-collected when a target is abandoned (harder, since the whole point is that it must survive a `stockReconnect()` to the *same* machine), or add an explicit eviction hook called when `ensureStockSession()` (`stock-dispatch.ts`) discards a `heldSession` for a `targetId` that will never be reused (the `CR-05`-guarded teardown path already has the old session's `targetId` in hand at that exact point).

## Info

### IN-01: `checkpointSetBody()` doesn't validate `end >= start`, unlike its siblings `memGetBody()`/`memSetBody()`

**File:** `.claude/mcp/vice/stock-protocol.ts:573-601`

**Issue:** `memGetBody()` and `memSetBody()` both throw `StockEncodingError` when `end < start`. `checkpointSetBody()` — encoding the same kind of address-range pair — has no equivalent check; it relies entirely on its two callers (`handleCheckpointAdd`, `handleWatchAdd` in `stock-checkpoints.ts`) validating the range themselves before calling it, which they currently do, so this is not exploitable today. But it is an inconsistent contract for an encoder module whose own header comment says every encoder "validates its arguments and throws `StockEncodingError` BEFORE writing any bytes" — a future caller of `checkpointSetBody()` that omits the range check (there is nothing in the encoder's own signature or tests to catch that) would silently send an inverted range to the wire.

**Fix:** Add the same `if (end < start) throw new StockEncodingError(...)` guard `memGetBody()`/`memSetBody()` already have.

---

_Reviewed: 2026-08-14T18:15:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
