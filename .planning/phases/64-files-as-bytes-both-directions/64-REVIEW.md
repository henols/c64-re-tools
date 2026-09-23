---
phase: 64-files-as-bytes-both-directions
reviewed: 2026-09-24T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-endpoint.test.ts
  - src/mcp/vice/broker-endpoint.ts
  - src/mcp/vice/broker-relay-text.test.ts
  - src/mcp/vice/broker-relay.mts
  - src/mcp/vice/broker-relay.test.ts
  - src/mcp/vice/broker-transfer.mts
  - src/mcp/vice/host-tool-transport.test.ts
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/broker-relay.mjs
  - src/mcp/vice/resources/broker-transfer.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-connect.test.ts
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/stock-handler.test.ts
  - src/mcp/vice/stock-handler.ts
  - src/mcp/vice/stock-machine.test.ts
  - src/mcp/vice/stock-machine.ts
  - src/mcp/vice/text-connect.test.ts
  - src/mcp/vice/transfer-disjoint-roots.test.ts
  - src/mcp/vice/vice-broker-staging.test.ts
  - src/mcp/vice/vice-broker.mts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-09-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This is the second gap-closure round for Phase 64, scoped to the diff since
`b06c74ac` (plan 64-12's bounded emulator-leg dial, G-64-4, and plan 64-13's
upload-completion confirmation, G-64-3). Both mechanisms are implemented
carefully and are backed by a large, targeted test suite (all 374 tests in
the affected files pass locally, and `resources-sync.test.ts` confirms the
committed `resources/*.mjs` artifacts are byte-identical to a fresh build of
their `.mts` sources, so they were reviewed only as a drift check per the
task's instructions).

The core race G-64-3 set out to close (an upload naming a staged file before
the broker had published it) is genuinely closed: `receivePayloadToFile()`
now only resolves after `verifyObserved()` and `renameSync()` have both
succeeded, and `stock-connect.ts`'s `defaultTransferFile()` now blocks on the
broker's own `transfer_complete`/`error` reply rather than on its local
write finishing. The G-64-4 bounded dial (`dialEmulatorLeg()`) correctly
serialises against concurrent attach/release/recycle races via an
identity-based `isAbandoned()` check, and `broker-control.mts`'s dispatch arm
correctly defers the `attached` acknowledgement until after the emulator leg
is confirmed connected.

However, in closing G-64-3's race, the new upload-failure wire replies
introduce a real regression against this same codebase's own path-disclosure
rule (D-15/D-17): three of `receivePayloadToFile()`'s failure branches build
the client-facing `wireReason` by concatenating a fixed prefix with the raw
Node.js `Error.message` of a filesystem failure, and Node's own `fs` errors
embed both the source and destination absolute paths verbatim in that
message (CR-01, below). Separately, `dialEmulatorLeg()`'s "bounded" dial has
no enforcement against a `connect()` call that never settles at all (WR-01).

## Critical Issues

### CR-01: Upload failure replies can leak the broker's host filesystem paths to the client

**File:** `src/mcp/vice/broker-transfer.mts:354-364`, `:377-389`, `:392-403`
**Issue:**

`receivePayloadToFile()`'s `TransferResult.wireReason` is documented, in this
same file, as "the PATH-FREE text a caller writes to the client on the
transfer connection (D-15/D-17)" — and `vice-broker.mts`'s
`writeUploadCompletionReply()` (added by this same plan, `vice-broker.mts:
1179-1192`, wired at `:1247-1253`) sends `result.wireReason ?? result.reason`
verbatim as the `error` line's `message` field to whatever peer dialled the
transfer connection (per `broker-control.mts`'s own extensive header
comment, this listener binds not just loopback but every enumerated bridge
gateway address, i.e. this reply can cross the container/host boundary).

Three of the four failure branches build `wireReason` like this:

```ts
} catch (e) {
  cleanupTmp();
  const message = (e as Error).message;
  return {
    ok: false,
    code: "internal",
    reason: `vice: failed to publish ${destPath}: ${message}`,
    wireReason: `vice: failed to publish the received file: ${message}`,
  };
}
```

`message` is never sanitised. Node's own filesystem errors embed both
absolute paths in `.message` — MEASURED directly against this exact
`renameSync`/`createWriteStream` failure shape:

```
$ node -e "require('fs').renameSync('/tmp/definitely-does-not-exist-xyz123','/tmp/some-other-nonexistent-dir-abc/dest.txt')"
ENOENT: no such file or directory, rename '/tmp/definitely-does-not-exist-xyz123' -> '/tmp/some-other-nonexistent-dir-abc/dest.txt'

$ node -e "require('fs').createWriteStream('/tmp/nonexistent-dir-zzz/foo.tmp').on('error', e => console.log(e.message))"
ENOENT: no such file or directory, open '/tmp/nonexistent-dir-zzz/foo.tmp'
```

So a real ENOSPC/EACCES/ENOENT during the receive pipeline (`:354-364`), the
`beforePublish` hook (`:377-389`), or the publish rename itself (`:392-403`)
sends the broker's own absolute `tmpPath` (which discloses the internal
staging directory layout under `.c64-re-tools`/`VICE_BROKER_HOME`) and/or
`destPath` (the resolved disk/snapshot destination) straight to the client —
exactly the disclosure this codebase's own `Boundary` convention and D-17
forbid, and exactly what this plan's own comments claim never happens.

This is not caught by the suite: `stock-machine.test.ts:1338`'s own
`beforePublish` rejection test ("a publish that fails before the rename
refuses the load... names no path") injects `new Error("forced publish
failure (G-64-3, plan 64-13 test)")` — a synthetic, path-free message
authored by the test itself — so the assertion passes without ever
exercising a real filesystem error's `.message` shape. The test proves the
plumbing forwards `wireReason` correctly; it does not prove `wireReason` is
actually path-free under a real I/O failure.

**Fix:**
Never interpolate a caught error's raw `.message` into `wireReason`. Use the
same discipline `broker-relay.mts`'s `buildEmulatorUnreachableMessage()`
already uses for the sibling G-64-4 fix ("Deliberately carries NO errno
token and NO path"): report at most the `errno` code, never the message.

```ts
} catch (e) {
  cleanupTmp();
  const code = (e as NodeJS.ErrnoException).code ?? "unknown_error";
  return {
    ok: false,
    code: "internal",
    reason: `vice: failed to publish ${destPath}: ${(e as Error).message}`, // broker-side only
    wireReason: `vice: failed to publish the received file (${code})`,      // never the raw message
  };
}
```
Apply the same change to the receive-pipeline branch (`:354-364`) and the
`beforePublish` branch (`:377-389`). Then replace `stock-machine.test.ts:
1338`'s synthetic path-free rejection with (or add alongside it) a case that
triggers a **real** `renameSync`/`createWriteStream` failure (e.g. a
destination directory that does not exist, or a read-only staging root) and
assert the wire reply contains neither the tmp path nor the destination
path — the current test cannot detect this defect because its own injected
error was authored to already be path-free.

## Warnings

### WR-01: The "bounded" emulator-leg dial has no timeout on an individual connect attempt

**File:** `src/mcp/vice/broker-relay.mts:586-609` (`attemptEmulatorConnect`), `:622-675` (`dialEmulatorLeg`)
**Issue:**

G-64-4's whole premise is that `dialEmulatorLeg()` bounds the wait for the
emulator leg to `deadlineMs` (default 5000ms), and `broker-endpoint.ts`'s
`DEFAULT_ATTACH_REPLY_TIMEOUT_MS` (8000ms) is deliberately set to exceed
that bound by at least one retry interval so the client's own wait outlives
the broker's. That relationship only holds if every individual `connect()`
attempt itself resolves (with `"connect"` or `"error"`) in bounded time.

`attemptEmulatorConnect()` calls `connectFn({ host, port })` with no
`timeout` option and installs only `"connect"`/`"error"` listeners — there
is no `socket.setTimeout()` guarding the attempt itself, and the deadline
check in `dialEmulatorLeg()`'s loop only runs *between* completed attempts
(`elapsedMs >= deadlineMs`, checked after an attempt settles). If a single
`connect()` call neither errors nor connects — e.g. `resolveBinmonHost()`
resolves to `VICE_BROKER_BINMON_HOST` pointed at a host that silently drops
SYN packets (a firewalled or unreachable address; this override exists
precisely for "the MCP server itself runs in a container that must reach
the host emulator", per `broker-launch.mts:110-134`) — the `await
attemptEmulatorConnect(...)` never settles, `dialEmulatorLeg()`'s promise
never resolves, and:

- `handleRelayAttach()`'s `holder.attached` (set `true` synchronously before
  the dial, `vice-broker.mts:1605`/`:1615` area) is never reset, permanently
  blocking any future `attach` on that channel until the whole grant is
  recycled.
- The client eventually gives up at its own 8000ms `attachReplyTimeoutMs`
  and destroys its socket, but the broker-side promise chain is still
  alive, waiting on a `connect()` that will never settle — this
  is a real, if narrow-scope (requires a non-default `VICE_BROKER_BINMON_HOST`
  and a black-holing network path), regression against the "bounded" dial
  this plan's own design and tests (`broker-relay.test.ts`) assume.

Note this is a new risk introduced by this round: before G-64-4,
`spliceRelay()` dialled and spliced immediately with no wait at all, so a
hanging `connect()` had no analogous failure mode.

**Fix:** Arm a per-attempt timeout inside `attemptEmulatorConnect()` (e.g.
`socket.setTimeout(remainingMs, () => { socket.destroy(); resolve({connected:
false, code: "ETIMEDOUT", socket}); })`, computing `remainingMs` from the
overall deadline so the sum of all attempts still respects `deadlineMs`),
and treat a timeout either as fatal immediately (safest, since the deadline
is close to expired anyway) or as a bounded, non-infinite retry case —
either way, no attempt should be able to keep the overall promise pending
past `deadlineMs`.

## Info

### IN-01: A connected emulator socket can be silently leaked if the client socket is destroyed in the resolve/`.then()` gap

**File:** `src/mcp/vice/broker-control.mts:1374-1409`
**Issue:** After `Promise.resolve(opts.onRelayAttach(...))` settles `ok:
true`, the `.then()` callback checks `if (socket.destroyed) return;` before
writing `attached` and calling `outcome.start()`. If the client socket
became destroyed in the narrow window between `handleRelayAttach()`'s own
internal `isAbandoned()` check (run synchronously just before it returns
`ok: true`) and this `.then()` callback running, the already-connected
`dial.socket` (the emulator leg) is never closed and `holder.attached` is
never reset — both leak until the grant is released or recycled. In
practice this window is a same-tick microtask handoff with no I/O in
between, so it is very unlikely to be reachable, but there is no defensive
check here (unlike the synchronous refusal path, which explicitly calls
`socket.resume()`).
**Fix:** Consider having the `.then()` callback's `socket.destroyed` branch
also call `outcome.start()`-independent cleanup — e.g. widen
`RelayAttachOutcome`'s `ok: true` case with an `abort()` alongside `start()`
that destroys the dialled emulator socket and clears `holder.attached` if
still current, so this path is not silently unhandled even if it never
fires in practice.

---

_Reviewed: 2026-09-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
