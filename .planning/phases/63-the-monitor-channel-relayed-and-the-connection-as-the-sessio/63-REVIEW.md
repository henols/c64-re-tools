---
phase: 63-the-monitor-channel-relayed-and-the-connection-as-the-sessio
reviewed: 2026-09-20T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - CLAUDE.md
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-endpoint.test.ts
  - src/mcp/vice/broker-endpoint.ts
  - src/mcp/vice/broker-incident.mts
  - src/mcp/vice/broker-incident.test.ts
  - src/mcp/vice/broker-launch.mts
  - src/mcp/vice/broker-launch.test.ts
  - src/mcp/vice/broker-relay.mts
  - src/mcp/vice/broker-relay.test.ts
  - src/mcp/vice/broker-relay-text.test.ts
  - src/mcp/vice/broker-state.mts
  - src/mcp/vice/broker-state.test.ts
  - src/mcp/vice/build.ts
  - src/mcp/vice/disasm-roundtrip.test.ts
  - src/mcp/vice/host-tool.test.ts
  - src/mcp/vice/host-tool-transport.test.ts
  - src/mcp/vice/phase58-citation-ledger.test.ts
  - src/mcp/vice/README.md
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/broker-incident.mjs
  - src/mcp/vice/resources/broker-launch.mjs
  - src/mcp/vice/resources/broker-relay.mjs
  - src/mcp/vice/resources/broker-state.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-connect.test.ts
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/stock-live-relay.test.ts
  - src/mcp/vice/stock-protocol.ts
  - src/mcp/vice/stock-recycle.test.ts
  - src/mcp/vice/test-gate.mjs
  - src/mcp/vice/text-connect.test.ts
  - src/mcp/vice/text-connect.ts
  - src/mcp/vice/text-protocol.test.ts
  - src/mcp/vice/text-protocol.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/tsconfig.build.json
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/vice-broker-client.test.ts
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker-launch.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-supervision.test.ts
  - src/mcp/vice/vice-proxy-ping.test.ts
  - src/mcp/vice/vice-proxy.test.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-09-20T00:00:00Z
**Depth:** standard (with targeted cross-file tracing on the relay-session lifecycle and the operation-declaration invariant, since both are load-bearing for this phase's stated evidence-before-reclaim guarantee)
**Files Reviewed:** 40 (per `files:` scope; generated `resources/*.mjs` twins reviewed only to confirm they are build output, findings attributed to their `.mts` sources per the review's own scope note)
**Status:** issues_found

## Summary

Phase 63 replaces direct client dials to the emulator's binary/text monitor
ports with a broker-mediated relay (`broker-relay.mts`), adds a per-claim
handle as the sole authority for attaching to that relay
(`broker-control.mts`'s `attach` op), and layers an operation-declaration
mechanism (`operation` op, `GrantRecord.operation`) that is meant to do two
jobs at once: suspend the relay's idle deadline while a legitimate long-running
capture is in flight, and let a broker-written incident record say what was
running when a connection dropped ("evidence before reclaim").

The byte-transparency and framing work itself (`broker-relay.mts`'s
`spliceRelay()`, the buffer-mode carry in `broker-control.mts`, the
`attach()` entry points added to `stock-protocol.ts`/`text-protocol.ts`) is
careful and internally consistent — Buffer-only handling throughout, correct
request-id-based demux preserved, JAM/CHECKPOINT_INFO/REGISTER_INFO
handling untouched. The defects below are concentrated in the two pieces
that manage relay-session *lifecycle* and *evidence attribution* across the
release/recycle paths and the two channel-tool wrappers, where the
documented invariants ("a routine, quiet release is not an incident"; "a
grant has exactly one in-flight operation at a time") are not actually
upheld by the code that is supposed to enforce them.

## Critical Issues

### CR-01: `handleRelease()`/`handleRecycleForRealBroker()` never clear `state.relaySessions`, so every ordinary teardown writes a spurious "relay death" incident (and can leak the relay sockets)

**File:** `src/mcp/vice/vice-broker.mts:1479` (`handleRelease`) and `src/mcp/vice/vice-broker.mts:1344` (`handleRecycleForRealBroker`), interacting with `src/mcp/vice/vice-broker.mts:1105` (`handleRelayDeath`)

**Issue:**

`handleRelayDeath()`'s own header comment (lines ~1068-1093) states the
intended invariant plainly: step 1 is "Look up the grant and the live relay
session for this exact (targetId, channel) pair. An ABSENT session means a
teardown already ran ... return immediately, writing NOTHING." That is,
the design assumes a *deliberate* teardown path removes the
`state.relaySessions` entry (or otherwise makes it absent) before the
resulting socket-close event can reach `handleRelayDeath()`, precisely so a
routine release never produces an incident record.

Neither of the two deliberate-teardown call sites does that:

- `handleRelease()` (line 1479) clears `instance.monitorClients` via
  `clearMonitorClient(instance)`, deletes the grant (`state.grants.delete`),
  deletes the instance record (`deleteInstanceRecord`), and fire-and-forgets
  `kill(...)` — but never touches `state.relaySessions`.
- `handleRecycleForRealBroker()` (line 1344) clears `monitorClients` the
  same way and kills the process, but likewise never touches
  `state.relaySessions`.

`state.relaySessions` is written only in `handleRelayAttach()` (line 1234)
and cleared only in `handleRelayDeath()` (line 1139) — there is no third
call site. Killing the emulator process (via `verifiedKill()`) closes the
OS socket underlying `spliceRelay()`'s `emulatorSocket`, which fires that
socket's `"close"` event and calls `reportDeath()` → `onDeath(trigger)` →
`handleRelayDeath(targetId, channel, trigger, state, deps)` — asynchronously,
some time after `handleRelease()`/`handleRecycleForRealBroker()` has already
returned.

By the time that fires for a `handleRelease()` teardown, `state.grants` no
longer has `targetId` (already deleted), so:

```ts
const session = state.relaySessions.get(key);      // FOUND -- never removed
if (!session) return;                               // does not trigger
...
const grant = state.grants.get(targetId);            // undefined -- already deleted
const instance = resolveInstanceForMonitorTarget(targetId, state); // null (grant lookup fails first)
const operation = grant?.operation ?? null;           // null
...
recordPath = writeIncident({ trigger, grant_id: targetId, channel, port: null,
  epoch_before: null, operation: null,
  reason: `relay death on target ${targetId}, channel ${channel}: ${trigger}` });
```

This writes a full incident markdown file to the machine-wide,
cross-project incidents directory (`brokerIncidentsDir()`) for what was a
completely ordinary, successful session release — contradicting the
explicit design statement elsewhere in this same file ("A grant with
NOTHING declared writes nothing: a routine, quiet release is not an
incident") and the test suite's own framing (`broker-relay.test.ts`'s
`handleRelease` tests assert `writeIncident` is *not* called for a quiet
release, but none of those tests set up an active `state.relaySessions`
entry first, so this downstream, asynchronous write is completely
untested).

For `handleRecycleForRealBroker()`, the same missing cleanup means the
eventual `handleRelayDeath()` call resolves the instance through the
*still-present* grant, i.e. against whatever instance now occupies that
port — which, after a fast respawn, can already be the **new**,
post-recycle `InstanceRecord`. The written incident's `port`/`epoch_before`
fields can then describe the replacement instance rather than the one whose
relay actually died, misattributing the very evidence this mechanism exists
to produce correctly.

Because attaching a monitor channel is the normal path for nearly every
stock/text tool call, this is not an edge case: essentially every session
that ever claims and attaches a channel and is then released or recycled
will, some time later, produce one spurious incident record. It also means
the relay's live handle (sockets, idle timer) is not explicitly torn down by
the deliberate-teardown paths at all — cleanup depends entirely on the kill
succeeding and the OS socket actually closing; if the kill is slow, refused
(`identity_refused`), or the idle timer was suspended by a still-recorded
declared operation, the relay session can remain live and un-reclaimed
indefinitely.

**Fix:** Before (or instead of relying solely on) killing the process,
`handleRelease()` and `handleRecycleForRealBroker()` should proactively
remove and close any live `state.relaySessions` entries for the grant's
channels — e.g. by iterating `MONITOR_CHANNELS`, deleting each
`relaySessionKey(targetId, ch)` entry from `state.relaySessions`, and
calling that session's own `close("control_close")`/`close("relay_close")`
*before* deleting the grant/instance records, so the later async socket
`"close"` finds `state.relaySessions.get(key)` already absent and
`handleRelayDeath()`'s own early-return fires as designed. Add a test that
attaches a relay, then releases (or recycles) the grant, and asserts no
incident record is written and `state.relaySessions` is empty afterward.

## Warnings

### WR-01: The single `GrantRecord.operation` field can be overwritten by a different channel's declaration while the actually-running operation is still in flight

**File:** `src/mcp/vice/text-tools.ts:158` vs. `src/mcp/vice/stock-dispatch.ts:539-561`

**Issue:** `handleOperationNote()` (`vice-broker.mts`) stores exactly one
`operation` value per grant, on the stated assumption that
"`channel-lock.ts`'s own single, cross-channel mutex is what already
guarantees that only one logical operation is ever running for this grant
at once" (see `vice-broker.mts`'s `handleOperationNote()` header comment).
That guarantee only holds if every caller declares its operation *after*
it has actually acquired the shared mutex.

The two channel wrappers do this in opposite order:

- `stock-dispatch.ts`'s `withChannelLockHeld()` calls
  `await acquireChannelLock(...)` (line 550) **first**, and only calls
  `declareOperation(session, toolName)` (line 557) once the lock is held.
- `text-tools.ts`'s `withTextTool()` calls
  `lease.brokerControl.noteOperation({ ..., name: toolName })` (line 158)
  **before** calling `withTextChannelLock(...)` (line 160), i.e. before the
  shared mutex (`channel-lock.ts`'s single `currentHolder`, used for both
  channels) has necessarily been granted.

If a binary tool call is currently holding the lock and running (its
operation correctly declared per `stock-dispatch.ts`'s ordering), and a
text tool call is issued concurrently on the same grant (parallel tool
invocation is an explicitly supported calling pattern), the text call's
`noteOperation()` overwrites `grant.operation` with its own name *while it
is still queued, not yet running* — clobbering the record of the operation
that is genuinely in flight. If the binary channel's relay dies at that
moment, `handleRelayDeath()` (`vice-broker.mts:1105`) reads
`grant?.operation` and attributes the incident to the queued-but-not-started
text operation instead of the one that was actually interrupted. The
inverse ordering issue also applies when the binary call's own `finally`
clears the field to `null` (line 561) while a still-queued or now-running
text operation's declaration is thereby erased.

**Fix:** Make the declare-order symmetric: `text-tools.ts` should declare
the operation only once `withTextChannelLock()` has actually granted the
lock (e.g. thread the declare/clear calls through a callback invoked from
inside the locked section, mirroring `stock-dispatch.ts`'s
`declareOperation()`/`finally` placement), so `grant.operation` never
describes an operation that is merely queued.

### WR-02: `readAttachLine()`/`MAX_ATTACH_LINE_BYTES` (`broker-relay.mts`) is dead code whose own header comments assert a call relationship that does not exist

**File:** `src/mcp/vice/broker-relay.mts:46-107` vs. `src/mcp/vice/broker-control.mts:940-988`

**Issue:** `broker-relay.mts`'s module header and `readAttachLine()`'s own
doc comment both describe this function as what
"`broker-control.mts`'s attach dispatch arm reads out of" (lines 49-51,
88), and `MAX_ATTACH_LINE_BYTES`'s own comment says it is "mirroring
`broker-control.mts`'s own `MAX_LINE_BYTES`" (line 27) as though the two are
the same governing bound reached through this function. In fact
`broker-control.mts` never imports `broker-relay.mjs` at all (its import
list is `node:net`, `node:os`, `node:crypto`, `node:fs`, `node:path`,
`node:url`, and three `import type` specifiers — no `broker-relay`), and
its own per-connection `"data"` handler (lines 953-988) re-implements an
equivalent byte-level newline search and its own independently-defined
`MAX_LINE_BYTES` constant (line 487) from scratch. `readAttachLine()` and
`MAX_ATTACH_LINE_BYTES` are exercised only by `broker-relay.test.ts` — never
by production code.

This is more than unused code: the two 65536-byte caps are independently
declared, coincidentally equal today, with no sync test holding them
together (unlike this codebase's usual practice of a byte-identical sync
test wherever two copies of a value or a string must never drift, e.g.
`HELLO_PROTOCOL_MAGIC`, `DEFAULT_RELAY_KEEPALIVE_MS_LOCAL`). A future editor
who changes `MAX_ATTACH_LINE_BYTES` believing it governs the real
attach-line parser (per this file's own header comment) will silently fail
to change actual broker behavior at all.

**Fix:** Either have `broker-control.mts`'s attach-line accumulation
actually call `readAttachLine()` (removing the duplicated logic), or correct
the header comments in `broker-relay.mts` to state plainly that this
function and constant are not currently wired into `broker-control.mts` and
name where the real bound lives (`broker-control.mts`'s own
`MAX_LINE_BYTES`).

### WR-03: `performAttach()`'s client-side reply buffer has no byte cap, unlike its server-side counterpart

**File:** `src/mcp/vice/broker-endpoint.ts:614-654` (the `socket.on("data", ...)` handler inside `performAttach()`)

**Issue:** `broker-control.mts`'s own pre-splice line reader is explicitly
bounded (`MAX_LINE_BYTES`, socket destroyed on overflow) precisely because
"a connection that never sends a terminator is destroyed, not buffered
further" (`broker-relay.mts`'s own header comment states the same
discipline for `MAX_ATTACH_LINE_BYTES`). `performAttach()`'s own comment at
the `idx === -1` branch says accumulation is "bounded by the reply timer
above, not a byte cap" — i.e. this client-side reader intentionally has no
byte ceiling and instead relies solely on the 2-second
(`DEFAULT_REPLY_TIMEOUT_MS`) reply timeout to bound how long it accumulates.
Because this dials the broker on the same trusted host, the practical risk
is low, but it is an asymmetric application of a discipline this same
change enforces on the other side of the identical connection, and a wire
desync (e.g., a `hello`-race candidate that never emits `\n`) could
accumulate up to ~2 seconds' worth of arbitrary inbound bytes before the
timer aborts it.

**Fix:** Apply the same `MAX_ATTACH_LINE_BYTES`-style byte cap to
`performAttach()`'s accumulator, destroying the socket immediately on
overflow rather than waiting out the reply timeout.

## Info

### IN-01: `stock-protocol.ts` is included in this phase's file scope but carries no phase-63 changes of substance beyond wire-constant additions

**File:** `src/mcp/vice/stock-protocol.ts`

**Issue:** Per the review scope note, this file entered scope via the diff
base reaching slightly before the phase branch point rather than through
phase-63 authorship. No defects specific to this phase's own changes were
found in it; it is flagged here only to record that it was read in full per
`<required_reading>` and found to require no action.

**Fix:** None required.

---

_Reviewed: 2026-09-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
