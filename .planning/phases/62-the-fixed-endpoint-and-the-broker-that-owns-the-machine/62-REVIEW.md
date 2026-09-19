---
phase: 62-the-fixed-endpoint-and-the-broker-that-owns-the-machine
reviewed: 2026-09-19T17:03:46Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - docs/phase58-declaration-provenance.md
  - README.md
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-e2e.test.ts
  - src/mcp/vice/broker-endpoint.test.ts
  - src/mcp/vice/broker-endpoint.ts
  - src/mcp/vice/broker-home.mts
  - src/mcp/vice/broker-home.test.ts
  - src/mcp/vice/broker-kill.test.ts
  - src/mcp/vice/build.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/repo-root.ts
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/broker-home.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/service/com.henols.vice-broker.plist
  - src/mcp/vice/service-no-invoke.test.ts
  - src/mcp/vice/service/vice-broker.service
  - src/mcp/vice/tsconfig.build.json
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker-launch.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-supervision.test.ts
  - src/mcp/vice/vice-cli.d.mts
  - src/mcp/vice/vice-cli.mjs
  - src/mcp/vice/vice-cli.test.ts
  - src/mcp/vice/vice-errors.ts
  - src/mcp/vice/vice-proxy.ts
findings:
  critical: 1
  warning: 4
  info: 0
  total: 5
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-09-19T17:03:46Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 62 gives the broker a fixed dial endpoint, a machine-level home directory, a
narrowed (loopback + enumerated bridge) bind set, one CLI entry point, and two inert,
user-installed service definitions. The design is unusually well-documented in-line and
the committed `resources/*.mjs` artifacts were verified byte-identical to a fresh
`build.ts` run against the current `.mts` sources, so there is no build drift to report.

The one **Critical** finding is a real regression in `vice-broker.mts`'s own startup
discipline: every other failure path in `run()` is careful to close every already-bound
listener before an early return (the file's own comments call this out explicitly for
the `EADDRINUSE`/loopback-failure branch), but the *first* `writeBrokerRecordFile()` call
— the write that announces the singleton immediately after a successful bind — has no
such protection. Because that call sits inside an `async` function body rather than
inside a signal handler or a bare top-level statement, a thrown error there becomes a
*handled* promise rejection (caught by `main()`'s own `.catch()`), which bypasses
`registerShutdownHandlers()`'s `uncaughtException`/`unhandledRejection` hooks — the only
code path in this file that ever calls `process.exit()` — entirely. The result is a
broker process that holds the control port open forever with no valid discovery record,
and never actually exits despite `process.exitCode` being set.

The remaining findings are lower-severity robustness/consistency gaps: a socket-cleanup
window in `broker-endpoint.ts` that strips a socket's `error` listener before destroying
it, an unauthenticated, uncached synchronous-I/O handshake handler in `broker-control.mts`,
a dead/always-`NaN` field left over in `vice-broker-client.ts` from an earlier phase's
warm-floor retirement, and an asymmetry between the two shipped service definitions'
handling of a minimal-PATH execution environment.

## Critical Issues

### CR-01: A failed initial `broker.json` write leaves the broker listening forever with no discovery record

**File:** `src/mcp/vice/vice-broker.mts:1565` (the initial `writeBrokerRecordFile()` call), interacting with `src/mcp/vice/vice-broker.mts:1638` (`main()`'s `run(args).catch(...)`)

**Issue:** Immediately after `run()` successfully binds the control listener(s)
(`startControlListenerOnHosts`, around line 1332) and registers `registerShutdownHandlers({ state })`
(line 1530), it writes the initial discovery record with no surrounding `try`/`catch`:

```ts
writeBrokerRecordFile(args.stateDir, record);   // line 1565 -- can throw: ENOSPC, EACCES, EROFS, ...
```

`writeBrokerRecordFile()` performs `mkdirSync`/`writeFileSync`/`chmodSync`/`renameSync`
synchronously and can genuinely throw — a full disk, a read-only or permission-restricted
home directory, or a `.c64-re-tools` path an operator does not own are all realistic, and
this phase specifically *increases* the odds of hitting a home-directory permission
problem by moving the default state directory from a per-project location to
`~/.c64-re-tools/supervisor` (`broker-home.mts`, BROKER-06/D-13).

Because this statement executes as a plain synchronous line inside `run()`'s `async`
function body — not inside a timer callback, a signal handler, or a bare top-level
statement — a thrown error here is converted by the language into a **rejected Promise**
returned by `run(args)`. `main()` (line 1638) already attaches a handler to that promise:

```ts
run(args).catch((e) => {
  process.stderr.write(`vice-broker: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
```

Because the rejection has a handler, Node never emits `unhandledRejection`, and this is
not a thrown value at the top of the call stack, so `uncaughtException` never fires
either. `registerShutdownHandlers()` (`broker-kill.mts`) — the *only* code path in this
process that ever calls the real `process.exit(code)` — is wired exclusively to
`SIGTERM`/`SIGINT`/`SIGHUP`/`uncaughtException`/`unhandledRejection`/`exit`, none of which
occur here. So `main()`'s catch runs instead: it sets `process.exitCode = 1` and returns,
but **nothing closes the control listener(s) that were bound moments earlier**.

The file's own `loopbackFailure` branch (lines 1453–1483) demonstrates that the author
understood this exact hazard and guarded against it there — closing every bound listener
*before* returning on a bind failure, with the comment "exitCode alone only takes effect
once Node has nothing left to wait for." That same discipline was not applied to this
later failure surface. The practical effect: the broker process hangs indefinitely
(net.Server objects keep the event loop alive), squatting the control port with no valid
`broker.json`, so a subsequent legitimate broker start attempt hits `EADDRINUSE`,
classifies the port's occupant as `never_started`/`stale` (since no readable record
exists), and refuses loudly — leaving an operator to hunt down and manually kill a
process that gave no indication it had failed (it never actually terminated, so nothing
outside the process observed `exitCode`).

**Fix:** Wrap the initial write (and ideally the whole "listener is bound" region through
the first successful write) so a failure closes every bound listener before returning,
mirroring the `loopbackFailure` branch's own discipline:

```ts
try {
  writeBrokerRecordFile(args.stateDir, record);
} catch (e) {
  for (const bound of bindResult.listeners) bound.server.close();
  process.stderr.write(`vice-broker: FATAL -- failed to write the initial discovery record at ${finalPath}: ${(e as Error).message}\n`);
  process.exitCode = 1;
  return;
}
```

(Keep `bindResult`/the individual `Server` handles in scope past the block that currently
narrows them to `listener`, or close via `listener`'s own underlying servers if that
refactor is preferred.) The same reasoning applies to the later heartbeat `setInterval`
write on line 1577, but that one *is* caught correctly today because a throw inside a
timer callback becomes a genuine top-level `uncaughtException`, which `registerShutdownHandlers()`
does handle — only the very first, synchronous-in-`run()`-body write is exposed.

## Warnings

### WR-01: `broker-endpoint.ts` strips a socket's error listener before destroying it, leaving a live-connection window with no error handler

**File:** `src/mcp/vice/broker-endpoint.ts:242-249` (`finish()`), contrasted with the `connectTimer` branch at `src/mcp/vice/broker-endpoint.ts:233-239`

**Issue:** `dialOneCandidate()`'s `connectTimer` timeout branch is careful to destroy the
socket immediately after removing its listeners:

```ts
socket.removeAllListeners();
if (!socket.destroyed) socket.destroy();
```

but `finish()` — reached from the "data" handler (a completed handshake), the
`replyTimer` timeout, and the `"error"` handler — only removes listeners and never
destroys the socket itself:

```ts
function finish(connected: boolean, raw: unknown, resolved: boolean): void {
  if (settled) return;
  settled = true;
  clearTimeout(connectTimer);
  if (replyTimer) clearTimeout(replyTimer);
  socket.removeAllListeners();     // <-- strips the 'error' listener too
  resolvePromise({ host, resolved, classification: classifyHelloReply({ connected, raw }, clientVersion) });
}
```

`removeAllListeners()` removes *every* listener, including `'error'`. The socket is left
open (not destroyed) with zero listeners until `dialBrokerEndpoint()`'s outer
`destroyAllSockets()` eventually runs — which only happens once the *outer* promise
resolves, itself only scheduled on the microtask queue after `dialOneCandidate()`'s own
promise settles. In that window, a live TCP socket with no `'error'` listener that emits
a genuine socket-level error (e.g. an `ECONNRESET` arriving from the peer right after the
`hello` reply, or right as the reply-timeout fires) causes Node's EventEmitter contract
to throw, since an `'error'` event with no listener is treated as fatal. Nothing in this
file installs a fallback handler for that window.

The header comment states this module must "Never throw out of `dialBrokerEndpoint()` or
`classifyHelloReply()`", so this is a violation of the module's own contract, not merely a
style nit. Today the blast radius is contained because (a) `dialBrokerEndpoint()` has no
production caller yet (confirmed by grep — only `broker-endpoint.test.ts` exercises it),
and (b) `vice-proxy.ts` installs a global `uncaughtException`/`unhandledRejection` handler
that logs and stays alive rather than crashing. But this will matter the moment this
dial path is wired into a live caller (which is the whole point of this phase), and
relying on a process-wide catch-all to paper over a module-local contract violation is
fragile.

**Fix:** Destroy the socket in `finish()` the same way the `connectTimer` branch already
does — nothing in this design needs the socket to remain open past classification (the
real acquire happens over a *separate* connection):

```ts
function finish(connected: boolean, raw: unknown, resolved: boolean): void {
  if (settled) return;
  settled = true;
  clearTimeout(connectTimer);
  if (replyTimer) clearTimeout(replyTimer);
  socket.removeAllListeners();
  if (!socket.destroyed) socket.destroy();
  resolvePromise({ host, resolved, classification: classifyHelloReply({ connected, raw }, clientVersion) });
}
```

### WR-02: The pre-token-gate `hello` handler performs an unauthenticated, uncached synchronous file read on every request

**File:** `src/mcp/vice/broker-control.mts:917-926` (the `hello` dispatch arm), `src/mcp/vice/broker-control.mts:402-416` (`resolveBrokerVersion()`)

**Issue:** This module's own header explains that, as of this phase, the enumerated bind
set (loopback plus every Docker/Podman/CNI bridge gateway address) is now "the FIRST line
of defence," specifically *because* `hello` answers unconditionally with no credential to
any caller that can reach a bound address. That widens the pre-auth attack surface from
"anything on localhost" to "anything on any bridge network this host's containers share."

The `hello` handler resolves the reply's `version` field via `resolveBrokerVersion()`,
which is **not memoised**:

```ts
version: opts.helloVersion ?? resolveBrokerVersion(),
```

`resolveBrokerVersion()` performs `existsSync()` + `readFileSync()` + `JSON.parse()`
synchronously, on the broker's single-threaded event loop, on *every single* `hello`
call, since `opts.helloVersion` is a test-only override that production never sets. There
is no per-connection or global rate limit on `hello` requests. Any peer reachable on one
of the enumerated bind addresses can therefore force the broker to repeatedly perform
blocking disk I/O by opening connections and sending `{"op":"hello"}` in a tight loop,
degrading the broker's ability to service every other in-flight `acquire`/`status`/`recycle`
request in a timely way (the whole process is single-threaded and this blocks the loop).

By contrast, the *client* side of this same handshake (`broker-endpoint.ts`) resolves its
own equivalent version exactly once, at module load, specifically to avoid repeating this
work:

```ts
const CLIENT_VERSION = runtimeVersion({ pkgJsonPath: join(HERE, "package.json") });
```

**Fix:** Resolve the broker's own version once (e.g. at module load or at
`startControlListener()`/`run()` startup, mirroring `CLIENT_VERSION`'s own pattern) and
have the `hello` dispatch site use the cached value, falling back to
`opts.helloVersion` only when supplied for a test:

```ts
const RESOLVED_BROKER_VERSION = resolveBrokerVersion();
// ...
version: opts.helloVersion ?? RESOLVED_BROKER_VERSION,
```

### WR-03: `vice-broker-client.ts`'s `hostState().warm_floor` is dead code that always evaluates to `NaN`

**File:** `src/mcp/vice/vice-broker-client.ts:636` (`ControlHostStateFields.warm_floor: number`), `src/mcp/vice/vice-broker-client.ts:1103` (`warm_floor: Number(line.warm_floor)`)

**Issue:** The warm floor was retired in phase 41 (`c8eaea64`), and `broker-control.mts`'s
own `ControlResponse`'s `host_state` wire variant has carried no `warm_floor` field since
— confirmed by `broker-control.test.ts`'s own assertion, `"Object.prototype.hasOwnProperty.call(resp, \"warm_floor\")"` must be `false`. `vice-broker-client.ts` was not updated to
match: `ControlHostStateFields` still declares `warm_floor: number`, and `hostState()`
still computes it from the (now permanently absent) wire field:

```ts
warm_floor: Number(line.warm_floor),   // line.warm_floor is always undefined -> NaN
```

Since the wire never sends this key, `Number(undefined)` is `NaN` on every real call —
this field is not merely unused, it is silently wrong on every invocation. No test in
`vice-broker-client.test.ts` asserts the actual output value of `hostState().warm_floor`
(the fixtures that set `warmFloor` on the *input* stub object are for the `HostStateFields`
type the *stub* accepts, which is a different, older shape than what `broker-control.mts`
actually sends today), so the defect is invisible to the suite. No production code
currently reads this field (confirmed by grep), so the immediate blast radius is limited
to a misleading typed field that will surprise the first real consumer.

This predates phase 62 and was not touched by this phase's diff, but it sits inside a
file phase 62 is shipping changes in, and it is worth closing alongside the phase's own
warm-floor-adjacent cleanup rather than carrying it forward.

**Fix:** Delete `warm_floor` from `ControlHostStateFields` and from `hostState()`'s return
value, matching the wire shape `broker-control.mts` actually sends.

### WR-04: The two shipped service definitions are not at parity on PATH resolution

**File:** `src/mcp/vice/service/com.henols.vice-broker.plist:32-38`, contrasted with `src/mcp/vice/service/vice-broker.service:35-41`

**Issue:** The systemd user unit explicitly documents and provides a commented escape
hatch for the well-known "a service manager does not inherit an interactive shell's PATH"
problem:

```
# Uncomment and fill in an ABSOLUTE path to a Node interpreter if this unit's
# own execution context carries no usable `node`/`npx` on PATH ...
#Environment=VICE_BROKER_NODE=/path/to/your/node
```

and `service-no-invoke.test.ts` even asserts this variable is named and commented out in
the unit file. The launchd agent (`com.henols.vice-broker.plist`) has no equivalent
`EnvironmentVariables` key, comment, or README caveat at all, even though launchd's
per-user-agent default PATH is typically *more* restrictive than a systemd user unit's
(commonly limited to `/usr/bin:/bin:/usr/sbin:/sbin`, excluding Homebrew's
`/opt/homebrew/bin` or `/usr/local/bin`, where `node`/`npx` usually live on macOS). A user
who installed Node via Homebrew and follows the README's "macOS (launchd, per-user agent)"
steps verbatim is likely to have `launchctl load` succeed while the agent itself fails
every time it runs (`ProgramArguments: ["npx", ...]` not found), with `KeepAlive`
restarting it in a fast failure loop and no documented remedy anywhere in this phase's
material — unlike the Linux path, which names the exact fix.

**Fix:** Add an equivalent, commented `EnvironmentVariables` dictionary to the plist (a
`launchd` agent's `Environment=`-equivalent) naming the same `VICE_BROKER_NODE` override,
e.g.:

```xml
<!-- Uncomment and fill in an ABSOLUTE path to a Node interpreter if this
     agent's own execution context carries no usable `npx` on PATH (launchd's
     default per-user-agent PATH is minimal and typically excludes Homebrew's
     install prefix). -->
<!--
<key>EnvironmentVariables</key>
<dict>
    <key>VICE_BROKER_NODE</key>
    <string>/path/to/your/node</string>
</dict>
-->
```

and extend `service-no-invoke.test.ts`'s existing "interpreter-pinning variable is present
and commented out" case to cover the plist as well as the systemd unit.

---

_Reviewed: 2026-09-19T17:03:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
