---
phase: 02-stock-backend-connection
reviewed: 2026-08-13T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - .claude/mcp/vice/stock-protocol.ts
  - .claude/mcp/vice/stock-protocol.test.ts
  - .claude/mcp/vice/stock-connect.ts
  - .claude/mcp/vice/stock-connect.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/backend-detect.mts
  - .claude/mcp/vice/backend-detect.test.ts
  - .claude/mcp/vice/vice-proxy.ts
  - .claude/mcp/vice/vice-proxy.test.ts
  - .claude/mcp/vice/vice-broker-client.ts
  - .claude/mcp/vice/vice-broker-client.test.ts
  - .claude/mcp/vice/vice-broker.mts
  - .claude/mcp/vice/vice-broker-launch.test.ts
  - .claude/mcp/vice/broker-state.mts
  - .claude/mcp/vice/broker-state.test.ts
  - .claude/mcp/vice/broker-control.mts
  - .claude/mcp/vice/broker-control.test.ts
  - .claude/mcp/vice/broker-launch.mts
  - .claude/mcp/vice/broker-launch.test.ts
  - .claude/mcp/vice/broker-kill.mts
  - .claude/mcp/vice/broker-kill.test.ts
  - .claude/mcp/vice/binmon-fixtures.ts
  - .claude/mcp/vice/binmon-fixtures.test.ts
  - .claude/mcp/vice/test-gate.mjs
  - .claude/mcp/vice/test-gate.test.ts
  - .claude/mcp/vice/test-gate.d.mts
  - .claude/mcp/vice/refresh-manifest.ts
  - .claude/mcp/vice/refresh-manifest.test.ts
  - .claude/mcp/vice/probe-binmon.mjs
  - .claude/mcp/vice/build.ts
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/tsconfig.build.json
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/mcp/vice/fixtures/binmon/README.md
  - .claude/mcp/vice/fixtures/binmon/display-get.json
  - .claude/mcp/vice/fixtures/binmon/event-interleaved.json
  - .claude/mcp/vice/fixtures/binmon/checkpoint-list.json
  - docs/phase2-backend-probe-evidence.md
findings:
  critical: 7
  warning: 13
  info: 5
  total: 25
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Reviewed the stock-VICE backend slice: the binary-monitor wire client
(`stock-protocol.ts`), the connect handshake (`stock-connect.ts`), the
backend-aware dispatch/manifest seam (`stock-dispatch.ts` + `vice-proxy.ts`
wiring), backend detection (`backend-detect.mts`), the broker-side
monitor-ownership ops (`broker-control.mts`, `vice-broker.mts`,
`broker-state.mts`), the launch-argv and reap changes (`broker-launch.mts`,
`broker-kill.mts`), and the test/fixture support (`binmon-fixtures.ts`,
`probe-binmon.mjs`, `test-gate.mjs`, `fixtures/binmon/*`).

Baseline observations: `npx tsc --noEmit` is clean, and all 145 tests across
the new test files pass. That is not evidence of correctness — the defects
below sit in the gaps between tests, and several of them are *encoded* by the
tests rather than caught by them.

Key concerns, in order of consequence:

1. `parseBuffer()` documents itself as never throwing and is the single
   authoritative framing seam; it in fact throws `RangeError` on any complete
   frame whose body is shorter than its response type requires (reproduced
   below, four distinct cases). The stated defect-(b) resync guarantee does
   not hold for garbage that survives the STX/length check.
2. The connect handshake sends `PING` and never sends `EXIT` (0xaa). Per this
   repo's own normative finding (`docs/phase0-binmon-findings.md` §4), any
   inbound byte halts the machine — so the first `vice_ping` on the stock
   backend freezes the emulated C64 and nothing ever resumes it.
3. `monitor_claim`/`monitor_release` accept an arbitrary `target_id` from any
   token-holding connection, while the `recycle` op in the same file
   explicitly refuses a target the connection does not itself hold. The
   ownership mechanism the whole claim-before-dial design rests on is
   spoofable, including *releasing another session's claim*.
4. The rewritten startup reap kills a pid recorded on disk with
   `expectedIdentity: ""` when the epoch record has no `vice_bin`, and
   `verifiedKill()`'s guard is `args.includes(expectedIdentity)` — which is
   unconditionally true for the empty string. The reap can SIGTERM/SIGKILL an
   arbitrary host process.
5. The production wiring never passes `StockConnectDeps`, so two mechanisms
   this phase built (epoch-based reconnect identity, the BACK-04 capability
   cache) are inert; the first one *always* fails with a false
   `MachineRestartedError`.

## Critical Issues

### CR-01: `parseResponse()` reads wire-controlled offsets unchecked; `RangeError` escapes the "never throws" framing seam

**File:** `.claude/mcp/vice/stock-protocol.ts:523-647`, `.claude/mcp/vice/stock-protocol.ts:720-732`
**Issue:** Every `case` in `parseResponse()` calls `body.readUInt16LE`/
`readUInt32LE` at fixed or wire-derived offsets with no length check.
`parseBuffer()`'s `catch` only absorbs `StockFramingError` and
`StockProtocolError` and re-throws everything else, contradicting its own
doc comment ("This function never throws") and the header's claim that the
defect-(b) resync makes a stray byte survivable.

Reproduced against the committed code (four separate shapes):

```
A parseBuffer THREW: RangeError  (STOPPED 0x62, zero-length body)
B parseBuffer THREW: RangeError  (MEM_GET 0x01, 1-byte body)
C parseBuffer THREW: RangeError  (DISPLAY_GET 0x84, info_len = 0xfffffff0)
D parseBuffer THREW: RangeError  (CHECKPOINT_INFO 0x11, 10-byte body)
```

Case C is reachable from ordinary desync: once the scanner locks onto a
false STX with a plausible (`<= MAX_BODY_LEN`) length, the body bytes are
attacker/garbage-controlled, so a lying `info_len` throws straight out of the
parser. Consequences inside `ViceMonitorClient`: `#onData()`'s defensive
backstop discards the *entire* accumulated buffer (including complete,
valid frames already in it), emits `desync`, and leaves every in-flight
request unresolved until its 5 s timeout. Any other direct caller of the
exported `parseBuffer()` gets an exception instead of the documented
`{ responses, remainder, desyncBytes }`.

No test covers a complete-but-short body; `stock-protocol.test.ts:83` only
covers an *incomplete* frame (declared length exceeding bytes present).

**Fix:** Bounds-check every case before reading, and treat a short body as a
returned framing error, not a throw:

```ts
function need(body: Buffer, bytes: number, responseType: number, requestId: number): void {
  if (body.length < bytes) {
    throw new StockFramingError(
      `response type 0x${responseType.toString(16)} body is ${body.length} bytes, needs at least ${bytes}`,
      { observed: body.length, expected: bytes, responseType, requestId },
    );
  }
}
// e.g. case ResponseType.Stopped:
need(body, 2, responseType, requestId);
// DisplayGet: validate infoLength and imageLength against body.length before subarray/read
```

Then either widen `parseBuffer()`'s `catch` to absorb any `RangeError` as a
desync of `frameLength` bytes, or keep the narrow catch *and* make
`parseResponse()` provably total. Add tests for a zero-length STOPPED/RESUMED
/UNDUMP body, a 1-byte MEM_GET body, a short CHECKPOINT_INFO, and a
DISPLAY_GET whose `info_len`/`buflen` exceed the body.

### CR-02: the stock handshake halts the emulated machine and never resumes it

**File:** `.claude/mcp/vice/stock-connect.ts:246-256`
**Issue:** `stockConnect()` sends `PING` (0x81), then `VICE_INFO` (0x85), then
`CPUHISTORY_GET` (0x86). `docs/phase0-binmon-findings.md` §4 is explicit:
"`monitor_check_binary()` calls `monitor_startup_trap()` on **any inbound
byte** … A bare `PING` (0x81) therefore halts the machine within roughly one
frame and emits `STOPPED` (0x62) … `EXIT` (0xaa) still resumes the emulator."

Nothing in this phase ever sends `EXIT`: a tree-wide grep finds `0xaa` only
in `CommandType`/`ResponseType`/`EXPECTED_RESPONSE` table entries. So the
first `vice_ping` on the stock backend stops the C64 and leaves it stopped
for the life of the held session — the emulator "stops advancing" with a
`STOPPED` event nobody consumes, which is precisely the state
`vice-wedge-triage` exists to disambiguate. Phase docs contain no deferral
record for this.

**Fix:** Resume explicitly at the end of a successful handshake and after any
command sequence that stops the machine:

```ts
// after resolveCapabilities(), before returning the session
await client.send(CommandType.Exit); // 0xaa -- resumes the machine the PING halted
```

Consume the resulting `RESUMED` (0x63) event, and add a test asserting a
handshake against the stub emits exactly one `EXIT` after the capability
probe. If leaving the machine stopped is deliberate for this phase, record it
in the phase docs and surface it in the `vice_ping` payload — silently
freezing the machine is not an acceptable default.

### CR-03: `monitor_claim`/`monitor_release` accept any `target_id` — no per-connection ownership check

**File:** `.claude/mcp/vice/broker-control.mts:547-583`, `.claude/mcp/vice/vice-broker.mts:631-663`
**Issue:** The `recycle` op in the same handler explicitly refuses a target
the connection does not hold (`broker-control.mts:500-510`: "recycle may only
target the grant this connection itself holds", enforced against
`requestIdForThisConnection`). The two new ops have no such check: they take
`target_id` from the request and pass it to `onMonitorClaim`/`onMonitorRelease`
unchanged.

`handleMonitorClaim()` then uses that caller-supplied id as *both* the target
and the claiming identity (`instance.monitorClient = { grantId: targetId, ... }`),
and `handleMonitorRelease()`'s "only the holder may release" check is
`instance.monitorClient.grantId !== targetId` — comparing the request against
itself. Concretely, with the per-boot control token (which every container-side
proxy sharing this broker holds):

- Session B can claim session A's instance by sending A's grant id, locking A
  out of its own monitor socket (`monitor_owned` refusal naming a grant that
  is not the real holder).
- Session B can *release* A's live claim by sending A's grant id, after which
  a third client is free to dial the same single-client binmon socket — the
  exact wedge-shaped state D-13 exists to prevent.

`broker-control.test.ts:365-382` encodes the gap rather than catching it: a
connection that never acquired anything sends `target_id: "req-b"` and is
served.

**Fix:** Gate both ops on the connection's own grant, mirroring `recycle`:

```ts
} else if (req.op === "monitor_claim" || req.op === "monitor_release") {
  const targetId = typeof req.target_id === "string" ? req.target_id : "";
  if (targetId === "") { /* bad_request as today */ return; }
  if (requestIdForThisConnection === null || targetId !== requestIdForThisConnection) {
    writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode,
      message: "monitor_claim/monitor_release may only target the grant this connection itself holds" });
    return;
  }
  ...
```

Add tests: a connection holding grant A is denied when claiming/releasing
grant B, and the denial does not mutate `instance.monitorClient`.

### CR-04: the startup reap kills a recorded pid with an identity guard that always matches

**File:** `.claude/mcp/vice/broker-kill.mts:584-585`, `.claude/mcp/vice/broker-kill.mts:140`
**Issue:** The rewritten `reapOrphanedInstances()` derives its kill identity
from the on-disk epoch record:

```ts
const expectedIdentity = typeof epochFields?.vice_bin === "string" ? epochFields.vice_bin : "";
const stage = await kill({ pid, expectedIdentity });
```

`verifiedKill()`'s guard is `if (!args.includes(expectedIdentity)) return "identity_refused"`.
`"".includes` is vacuously satisfied by every process's argv, so an
`expectedIdentity` of `""` disables the guard entirely and the reap SIGTERMs
(then SIGKILLs) whatever process currently owns that recorded pid. Pids in
`epoch.json` outlive reboots and are freely reused, and
`bumpEpochForInstanceDir()` (`broker-kill.mts:520-530`) itself *writes back*
`vice_bin: ""` while preserving an existing `pid`, so the broker can
manufacture exactly this record and then act on it at the next start. This is
the same class of incident (`killing two unrelated processes on a developer's
host`) that the section's own header comment claims to have closed.

**Fix:** Refuse an empty identity at both layers.

```ts
// broker-kill.mts, verifiedKill()
if (expectedIdentity === "") return "identity_refused";
// reapOrphanedInstances(): skip the kill half when no usable identity was recorded
const viceBin = typeof epochFields?.vice_bin === "string" ? epochFields.vice_bin : "";
if (viceBin === "") { log(`... port ${port}: epoch record carries no vice_bin -- kill skipped`); }
else { found++; ... }
```

Add a test: an epoch record with a live pid but no `vice_bin` produces
`killed: 0` and never invokes the kill dep.

### CR-05: a replaced lease drops a live binmon session without disconnecting it or releasing its monitor claim

**File:** `.claude/mcp/vice/stock-dispatch.ts:206-213`
**Issue:** When the lease names a different `targetId`, `ensureStockSession()`
calls `clearHeldStockSession()` — which only nulls the module-level reference
(`stock-dispatch.ts:114-116`) — and then connects fresh. The previous
session's `ViceMonitorClient` is still connected: its socket, its `data`/
`close`/`error` listeners, its pending map and its broker-side
`monitorClient` claim all survive with no remaining reference through which
anything can release them (the holder is module-private and now overwritten).

Because stock VICE services exactly one binmon client, the leaked socket
keeps occupying that instance's single client slot. If the broker later hands
that port out again (recycle/respawn creates a fresh `InstanceRecord`, so
`monitorClient` is cleared and a new claim succeeds), the new client's
`connect()` sits unserviced in the backlog with no reply and no EOF — the
state CLAUDE.md says must never be reachable and must never be diagnosed as a
hang.

**Fix:** Tear the old session down before discarding the reference:

```ts
if (heldSession !== null && heldSession.targetId !== lease.targetId) {
  const stale = heldSession;
  heldSession = null;
  try { await stockDisconnect(stale); } catch { /* best effort */ }
}
```

Add a test asserting `stale.client.connected === false` and one
`releaseMonitor` call for the old `targetId` after a replacement acquisition.

### CR-06: `StockConnectDeps` is never wired in production — reconnect always reports a false machine restart, and the capability cache is inert

**File:** `.claude/mcp/vice/stock-dispatch.ts:211`, `.claude/mcp/vice/stock-connect.ts:262-263`, `.claude/mcp/vice/stock-connect.ts:314-326`
**Issue:** The only production call is
`connectFn({ host, port, targetId, brokerControl })` — no `deps`. Grep
confirms `epochPath`/`binPath` are supplied only from `stock-connect.test.ts`.
Therefore, in production:

- `deps.epochPath` is undefined, so `baselineEpoch` is always `null`
  (`stock-connect.ts:262-263`), and `stockReconnect()`'s first branch
  (`baselineEpoch === null || ...`) *always* throws `MachineRestartedError`.
  Every transient socket drop is reported to the agent as "the emulator's
  identity could not be proven across a reconnect … treat every result since
  the previous call as void", even when the machine never restarted. The
  entire epoch-identity mechanism this phase built is dead code on the real
  path, and `stock-dispatch.test.ts:248/271` cannot see it because both stub
  `reconnect`.
- `deps.binPath`/`deps.supervisorDir` are undefined, so
  `resolveCapabilities()` skips the cache and re-probes `CPUHISTORY_GET` on
  every handshake, and `writeCapabilityRecord()` is never called. BACK-04's
  "settle once per binary, at connect time" is not achieved.

**Fix:** Thread the grant's own coordinates into the lease and down into the
handshake. `HeldLease` already comes from a grant that carries `epoch_file`
and `supervisor_dir` (`vice-broker-client.ts:297-303`); add them to
`HeldLease` in `buildHeldLease()` (`vice-proxy.ts:2173-2177`, where
`activeInstance().epochFile` is already available) and pass them plus
`ACTIVE_BACKEND.binPath` through:

```ts
const session = await connectFn({
  host: lease.host, port: lease.port, targetId: lease.targetId, brokerControl: lease.brokerControl,
  deps: { epochPath: lease.epochFile, supervisorDir: lease.supervisorDir, binPath: deps.resolvedBinaryPath },
});
```

Add an integration-shaped test that drives `ensureStockSession()` with a real
`stockConnect` against the loopback stub and asserts `baselineEpoch !== null`.

### CR-07: `vice_diagnose` is advertised on the stock backend but dispatches through the fork's HTTP transport

**File:** `.claude/mcp/vice/vice-proxy.ts:3062-3072`
**Issue:** The backend-aware runner choice covers only manifest tools. The
three synthetic tools are registered unconditionally straight after the loop:

```ts
tools[RESULT_CONTINUE_TOOL.name] = ...
tools[RECYCLE_TOOL.name] = ...
tools[DIAGNOSE_TOOL.name] = buildViceTool(DIAGNOSE_TOOL, (args) => handleDiagnose(args));
```

`tools/list` is served from this same `tools` object (see the comment at
`vice-proxy.ts:3045-3051`), so on the stock backend the advertised surface is
`vice_ping` **plus** `vice_result_continue`, `vice_recycle` and
`vice_diagnose`. `handleDiagnose()` (`vice-proxy.ts:1223-1250`) calls
`ensureViceSession()`, `gatherCheckpointTrapEvidence()` and
`gatherBracketEvidence()`, all of which go through the fork's HTTP
`call()`/`forwardToVice()` path against a port that is speaking the binary
monitor. That is a direct D-09 violation ("the stock path must never fall
through to the fork's HTTP forward") at the seam this phase edited, and the
tool it lands on is the wedge-triage skill's documented opening move — so its
output on stock is HTTP failure text dressed as emulator diagnosis.
`stock-dispatch.test.ts:472` only checks that no *code line* pairs the string
`"stock"` with `forwardToVice`, which this arrangement satisfies while still
reaching that transport.

**Fix:** Make the synthetic registrations backend-aware too — either route
them through `dispatchStock` (so a stock-unimplemented name is refused by
name) or gate registration:

```ts
if (ACTIVE_BACKEND.backend === "fork") {
  tools[DIAGNOSE_TOOL.name] = buildViceTool(DIAGNOSE_TOOL, (args) => handleDiagnose(args));
} else {
  tools[DIAGNOSE_TOOL.name] = buildViceTool(DIAGNOSE_TOOL, (args) =>
    stockDispatch.dispatchStock(DIAGNOSE_TOOL.name, args, stockDeps));
}
```

Strengthen the structural test to assert that, on the stock backend, no
registered tool's runner reaches `forwardToVice`/`ensureViceSession`.

## Warnings

### WR-01: stock instances can never be promoted to `ready` — readiness is HTTP-only

**File:** `.claude/mcp/vice/broker-launch.mts:364-428`, `.claude/mcp/vice/broker-launch.mts:133-144`
**Issue:** The phase teaches the broker to launch `-binarymonitor
-binarymonitoraddress ip4://host:port`, but `probeReady()` still POSTs
`http://127.0.0.1:<port>/mcp` and requires `"version"` and `"machine"` in the
body. On the stock backend that port speaks a binary protocol, so the probe
can never succeed: warm-floor instances stay `launching` forever,
`countLaunching(state) > 0` short-circuits every later warm pass
(`broker-launch.mts:551-560`), and the never-usable emulator process is
retained until broker shutdown while still counting toward
`countTotal()`/`atCapacity()`. Cold acquires still work only because the cold
arm grants without probing.
**Fix:** Give `probeReady()` a backend-aware route — for stock, open the
binmon socket and send one `PING` (0x81), requiring a well-formed 0x81 reply
(a bare TCP accept is explicitly insufficient, per that function's own
comment) — and thread the resolved `backend` into `ProbeDeps` the same way
`buildViceArgs()` now receives it. Note that such a probe *also* halts the
machine, so it must send `EXIT` afterwards (see CR-02).

### WR-02: a timed-out or write-failed request is not marked settled, so its late reply is emitted as an unsolicited event

**File:** `.claude/mcp/vice/stock-protocol.ts:1011-1041`, `.claude/mcp/vice/stock-protocol.ts:1132-1148`
**Issue:** Both the timeout callback and the `socket.write` error callback do
`this.#pending.delete(requestId)` without `#markSettled(requestId)`, unlike
`#finishPending()` (whose doc comment says it must be called "exactly once per
settled request id"). When the reply eventually arrives, `#dispatch()` finds
no pending entry and no settled-ring entry and falls through to
`this.emit("event", item)` — routing a *command reply* onto the event
channel, which the duplicate-reply branch two lines above deliberately
refuses to do ("routing it there would let a future consumer treat a
duplicate reply as a second, spurious STOPPED/RESUMED-shaped transition").
**Fix:** Call `this.#markSettled(requestId)` on both abandonment paths, and
add a test: a request that times out and is answered afterwards increments
`counters.duplicateReplies` and emits no `event`.

### WR-03: `MAX_BODY_LEN` doubles as the buffered-byte cap, and the desync reset discards complete frames

**File:** `.claude/mcp/vice/stock-protocol.ts:1070-1087`
**Issue:** `parseBuffer()` accepts a declared body length up to
`MAX_BODY_LEN` (4 MiB), but `#onData()` treats a *remainder* above the same
constant as a desync and resets the buffer. A frame whose body is at or near
4 MiB therefore can never be reassembled from chunks — its own partially
received bytes trip the cap. The reset also throws away any complete frames
that happen to sit in the same buffer, and does not reject pending requests,
so callers wait out their full timeout.
**Fix:** Use a separate, larger accumulation cap (`RESPONSE_HEADER_LEN +
MAX_BODY_LEN`, plus slack) for the buffered-bytes check, and only trip it
when the buffer contains no in-progress frame header consistent with its
length. Consider failing pending requests with `StockDesyncError` when the
buffer is reset, rather than silently letting them time out.

### WR-04: the container-side proxy probes the container's PATH for the emulator, producing a second backend verdict that can silently disagree with the broker's

**File:** `.claude/mcp/vice/vice-proxy.ts:186`, `.claude/mcp/vice/backend-detect.mts:396-466`
**Issue:** `const ACTIVE_BACKEND = backendDetect.resolvedBackend();` runs at
module scope inside the MCP proxy, with no `supervisorDir` (so no cache) and
against the *container's* filesystem — while the emulator it describes is
launched by the broker on the *host*, which performs its own
`resolvedBackend({ supervisorDir })`. In the normal devcontainer topology the
container has no `x64sc`, so the proxy classifies `unknown` →
`{ backend: "fork", source: "indeterminate" }`. If the host binary is stock
(broker detects/overrides to `stock`), the proxy still advertises the fork's
full manifest and forwards HTTP to a binary-monitor port; the mismatch is
never detected or reported. D-01's "one reader" property holds per process
but not across the pair. Secondary: the probe ladder is up to three blocking
`spawnSync` calls (5 s each) during module init of a stdio server.
**Fix:** Have the proxy learn the backend from the broker it already talks to
(the control plane's `host_state` already carries `vice_bin`; add `backend`)
rather than probing locally, or at minimum refuse to proceed when the proxy's
verdict is `indeterminate` and the broker reports a different backend. Keep
`VICE_BACKEND` as the explicit override, and document that it must be set for
both processes until the wire carries the verdict.

### WR-05: `binPath`/`resolvedBinaryPath` is the unresolved command name, not a resolved path

**File:** `.claude/mcp/vice/backend-detect.mts:407-465`, `.claude/mcp/vice/stock-dispatch.ts:83-95`, `.claude/mcp/vice/stock-dispatch.ts:323`
**Issue:** Every `ResolvedBackendResult` sets `binPath: viceBin` — the raw
`VICE_BIN`/`"x64sc"` string — even though the function computes
`resolvedPath` internally for cache keying. `StockDispatchDeps`'s own comment
calls this "the resolved binary path `resolvedBackend()` already determined",
and BACK-03's `vice_ping` answer surfaces it as `resolvedBinaryPath`. In
practice `vice_ping` on stock reports `"x64sc"`, and inside a container that
name resolves to nothing at all.
**Fix:** Return the resolved absolute path when it is known
(`binPath: resolvedPath ?? viceBin`, or add a distinct `resolvedPath` field)
and fix the two doc comments; if the intent is "the configured name", rename
the field so it stops claiming resolution.

### WR-06: the default stock binmon bind is unreachable from the host the proxy dials, with no diagnostic connecting the two

**File:** `.claude/mcp/vice/broker-launch.mts:133-144`, `.claude/mcp/vice/vice-proxy.ts:2173-2177`
**Issue:** `buildViceArgs()` binds the binary monitor to `127.0.0.1` by
default (a deliberate, documented safety posture), while `buildHeldLease()`
derives the dial host from the *containerized* instance URL — i.e.
`host.docker.internal`. In the default containerized topology the stock
handshake therefore fails with a bare `ECONNREFUSED` surfaced as
"`vice_ping`: stock handshake failed (connect ECONNREFUSED …)", with nothing
pointing at `VICE_BROKER_BINMON_HOST`. Additionally `new URL(url).hostname`
returns a *bracketed* literal for IPv6 (`"[::1]"`), which `net.connect()`
will not accept.
**Fix:** In `convertHandshakeError()`, special-case a connect refusal on the
stock path and name `VICE_BROKER_BINMON_HOST` plus the loopback default; and
strip brackets when deriving the host (or carry the host through the grant
instead of re-parsing a URL).

### WR-07: the handshake's cleanup path can replace the original failure with a `releaseMonitor` failure, and ignores its outcome

**File:** `.claude/mcp/vice/stock-connect.ts:266-272`
**Issue:** `await brokerControl.releaseMonitor({ targetId })` sits between the
`catch` and the `throw err`. If `releaseMonitor` rejects, its error replaces
the real handshake failure (an api-version mismatch, a timeout, a closed
socket) and the caller loses the actual cause. Its `{ ok: false, reason }`
outcome is also discarded, so a failed release is silent and the instance
stays claimed while the caller is told the handshake failed for another
reason.
**Fix:**

```ts
} catch (err) {
  await safeDisconnect(client);
  try {
    const released = await brokerControl.releaseMonitor({ targetId });
    if (!released.ok) console.error(`stockConnect: monitor release after a failed handshake failed (${released.reason})`);
  } catch (releaseErr) {
    console.error(`stockConnect: monitor release after a failed handshake threw: ${String(releaseErr)}`);
  }
  throw err;
}
```

### WR-08: a malformed `holder` payload downgrades `monitor_owned` to `internal`

**File:** `.claude/mcp/vice/vice-broker-client.ts:939-951`
**Issue:** `claimMonitor()` reports `monitor_owned` only when
`raw.kind === "monitor_owned" && raw.holder`; a broker answer whose `holder`
is absent or malformed (`extractHolder()` returns `undefined`) collapses to
`{ ok: false, reason: "internal" }`. `stockConnect()` then throws a generic
`ViceError`, and `convertHandshakeError()` produces "stock handshake failed
(…)" — losing exactly the ownership-conflict framing T-02-14 requires and
that `MonitorOwnershipError` exists to preserve.
**Fix:** Keep the `monitor_owned` reason even without a usable holder (with
`holder` fields defaulted to `unknown`), so the ownership wording survives a
partially-malformed refusal.

### WR-09: `REGISTER_INFO` items are parsed with a hardcoded 4-byte stride while `REGISTERS_AVAILABLE` honours the wire `item_size`

**File:** `.claude/mcp/vice/stock-protocol.ts:528-535` vs `:536-550`
**Issue:** The `RegisterInfo` case computes `start = 2 + index * 4` and reads
a 2-byte value, ignoring the per-item size byte it steps over; the
`RegistersAvailable` case immediately below advances by `itemSize + 1`. Any
register whose declared size is not 2 bytes (or any future item-layout
change) silently mis-parses the whole array rather than failing — and the
values feed cycle reconstruction (`LIN`/`CYC`) in later phases.
**Fix:** Use the wire item size for both:

```ts
let offset = 2;
for (let i = 0; i < count; i += 1) {
  const itemSize = body[offset]!;
  registers.push({ id: body[offset + 1]!, value: body.readUInt16LE(offset + 2) });
  offset += itemSize + 1;
}
```

(with the bounds checks from CR-01).

### WR-10: `binmon-fixtures.ts`'s header claims the three fixtures are real captures

**File:** `.claude/mcp/vice/binmon-fixtures.ts:13-16`
**Issue:** "the other three (display-get, event-interleaved, checkpoint-list)
are captured for real by `probe-binmon.mjs`'s `--capture` mode and loaded
back through `loadCapturedFixture()`". All three sidecars say
`"capturedFrom": "synthesized-fallback"`, `"synthetic": true`, and both
`fixtures/binmon/README.md` and `docs/phase2-backend-probe-evidence.md`
document the D-19 override. In a codebase whose review standard is
"provenance that lies is the thing not to produce", the module that *loads*
the fixtures is the worst place for the stale claim.
**Fix:** Update the header to state the fixtures are currently
spec-synthesized under the 2026-08-13 D-19 override and point at the
re-capture todo. Consider having `loadCapturedFixture()` return
`provenance.synthetic` explicitly so a caller can assert on it, and wrap the
sidecar `JSON.parse` (line 222) in the same `MissingFixtureError` handling as
the missing-key path, so a corrupt sidecar is not a bare `SyntaxError`.

### WR-11: `probe-binmon.mjs`'s sidecar selftest is vacuous

**File:** `.claude/mcp/vice/probe-binmon.mjs` (selftest addition, "capture sidecar: exactly the four required provenance keys")
**Issue:** The check builds an object literal with the four keys and then
asserts that object has those four keys. It exercises none of `runCapture()`'s
actual sidecar construction, while its assertion message claims coverage of
"the sidecar builder". This is false confidence in exactly the provenance
contract `loadCapturedFixture()` enforces.
**Fix:** Extract the sidecar construction into a pure function (e.g.
`buildSidecar({ capturedFrom, viceVersion, command })`) and assert on *its*
output, including that a missing `command` case is impossible.

### WR-12: `clampCpuHistoryCount()` has no lower or NaN bound

**File:** `.claude/mcp/vice/stock-connect.ts:82-84`
**Issue:** `Math.min(count, 65535)` clamps the documented uint16 wrap
(CLAUDE.md), but passes through negatives and `NaN`; `body.writeUInt32LE(NaN, 1)`
throws. The function is documented as "a general guard for any future caller
of this same request shape", which is precisely the caller who will hand it
unvalidated input.
**Fix:**

```ts
function clampCpuHistoryCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(Math.trunc(count), 0), CPU_HISTORY_MAX_COUNT);
}
```

### WR-13: `connect()` leaves the socket with no `error` listener on the timeout path and silently replaces an existing socket

**File:** `.claude/mcp/vice/stock-protocol.ts:954-984`
**Issue:** Two robustness gaps in one function. (a) The timeout callback
removes both the `connect` and `error` listeners and then destroys the
socket; any `error` still delivered for that socket has no listener, which in
Node is an unhandled `'error'` event (caught only by the proxy's
never-throw global handler, i.e. an unexplained stderr incident). (b) There
is no guard against calling `connect()` on a client that already has a live
`#socket`: the previous socket and its three listeners are simply overwritten
and leaked, and `#closed`/`#pending`/`#settledRing` are not reset
consistently.
**Fix:** Keep a no-op `error` handler attached after the timeout (or destroy
with `socket.destroy()` *before* removing listeners and swallow the resulting
event), and reject early when `this.#socket != null && !this.#socket.destroyed`
— or route reconnects through `disconnect()` first.

## Info

### IN-01: `hasMonitorClient` is written on the wire but no client reads it

**File:** `.claude/mcp/vice/broker-control.mts:82-88`, `.claude/mcp/vice/vice-broker-client.ts:532-538`
**Issue:** `StatusInstanceEntry` gained `hasMonitorClient`, but the
container-side `ControlStatusInstanceEntry` parser does not extract it, so
the only diagnostic that could tell an operator "this instance already has a
monitor client" is unreachable.
**Fix:** Add the field to `ControlStatusInstanceEntry` (defaulting `false`)
and surface it wherever status is rendered.

### IN-02: the new automated test gate is not what CI enforces, and is cwd-dependent

**File:** `.claude/mcp/vice/test-gate.mjs:39-63`, `.github/workflows/ci.yml:47`
**Issue:** CI runs `npm test` (`node --test '*.test.*'`), which still
includes the three files `MANUAL_ONLY_TESTS` excludes — so `test:automated`
is a parallel path nothing enforces, and the five new assertions added to
`vice-proxy.test.ts` are outside the gate that is supposed to protect this
milestone. Also `automatedTestFiles(process.cwd())` silently depends on the
invocation directory, and the entry guard
`import.meta.url === \`file://${process.argv[1]}\`` breaks for paths needing
percent-encoding.
**Fix:** Point CI at `npm run test:automated` (with a separate manual job or
none), pass the module's own directory instead of `process.cwd()`, and use
`pathToFileURL(process.argv[1]).href` for the guard.

### IN-03: duplicate-reply logging is unbounded

**File:** `.claude/mcp/vice/stock-protocol.ts:1141`
**Issue:** Every duplicate frame writes one `console.error` line, unlike the
desync path which gates its logging behind `desyncEpisodeActive`. A hostile or
badly desynced stream can flood stderr.
**Fix:** Gate it the same way (log the first per connection, then count only,
reporting the total via `counters.duplicateReplies`).

### IN-04: the stock `vice_ping` payload shape diverges from the fork's, with no skill updates in this phase

**File:** `.claude/mcp/vice/stock-dispatch.ts:319-326`
**Issue:** The fork's `vice_ping` reply carries `version`/`machine` (the
broker's own readiness probe greps for both); the stock payload is
`{ status, backend, viceVersion, resolvedBinaryPath, capabilities }`. The
compatibility constraint only guarantees argument shape, but no playbook was
updated to name the stock route (SKILL-01), so any skill parsing `vice_ping`
output breaks with no signposting.
**Fix:** Either include the fork's field names as aliases or record the
divergence and the affected skills in the phase summary and SKILL docs.

### IN-05: `stockReconnect()`'s error message names the wrong function

**File:** `.claude/mcp/vice/stock-connect.ts:322`
**Issue:** The thrown message begins `"stockConnect: reconnect to target …"`
while `where` correctly says `stock-connect.ts:stockReconnect`. Message text
is what reaches the agent.
**Fix:** Start the message with `stockReconnect:`.

---

_Reviewed: 2026-08-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
