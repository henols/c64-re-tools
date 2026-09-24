---
phase: 64-files-as-bytes-both-directions
reviewed: 2026-09-24T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/mcp/vice/broker-transfer.mts
  - src/mcp/vice/broker-transfer.test.mts
  - src/mcp/vice/resources/broker-transfer.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-machine.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-staging.test.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-09-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This diff (gap-closure plan 64-15, G-64-5/CR-01) replaces `receivePayloadToFile()`'s
ad-hoc, path-leaking wire text with `formatPathFreeFault()` plus a stricter
`ReceivePayloadToFileResult` return type, and threads the change through
`vice-broker.mts`'s `writeUploadCompletionReply()`. The CR-01 fix itself is sound:
`formatPathFreeFault()`'s errno-token allowlist regex correctly excludes every
character a path needs, the getter-throws-as-no-code case is handled, every caught-fault
branch in `receivePayloadToFile()` now routes through it, the compiled `resources/*.mjs`
artifacts are byte-for-byte in sync with their `.mts`/`.ts` sources, and the new tests
drive real `fs` faults (ENOENT, ENAMETOOLONG) rather than synthetic already-path-free
rejections, closing the exact gap the prior review found.

Reviewing the full files at standard depth (not just the diff hunks) surfaced two
pre-existing, untouched-by-this-diff defects in the same staging/transfer machinery this
phase owns, both severe enough to flag here: an unconditional, liveness-blind staging
sweep that can delete a live broker's active session data, and an unguarded synchronous
`mkdirSync()` inside a function whose own contract promises "never throws," reachable from
a caller with no `.catch()`, in a codebase where an unhandled rejection is documented to
kill the entire VICE pool.

## Critical Issues

### CR-01: `sweepOrphanedStaging()` deletes a live broker's active staging directories, unconditionally, before the singleton bind race is even decided

**File:** `src/mcp/vice/vice-broker.mts:2211-2226` (call site; implementation in `src/mcp/vice/broker-kill.mts:837-882`, out of this review's file list but directly load-bearing here)

**Issue:** `run()` calls `sweepOrphanedStaging({ root: brokerStagingDir() })` unconditionally,
*before* the control-port bind attempt — the same "before the bind, even for a process that
goes on to lose the singleton race" ordering `vice-broker.mts`'s own comment block explicitly
documents for the neighbouring `reapOrphanedInstances()` call:

```
// NOTE: this reap runs UNCONDITIONALLY, before the bind attempt
// below -- including for a process that goes on to LOSE the singleton
// race a moment later ...
// A losing second broker's own reap pass is an accepted, pre-existing
// consequence of "the reap is unconditional" -- not something the
// singleton guard below is required to prevent.
...
reapOrphanedConfigScratch({ root: brokerConfigScratchDir() });
sweepOrphanedStaging({ root: brokerStagingDir() });
```

`sweepOrphanedStaging()` itself (`broker-kill.mts:837-882`) has **no liveness check at
all** — its own doc comment says so explicitly: the `isAlive` parameter is "[a]ccepted for
SYMMETRY with `reapOrphanedConfigScratch()`'s own liveness seam only -- deliberately NEVER
called anywhere in this function's own body." Contrast this with `reapOrphanedConfigScratch()`,
whose sibling function genuinely checks `configScratchStillOwnedByLiveProcess()` (pid alive
*and* the process's own args still name the expected identity) before removing anything.

The consequence: if a second broker process starts while a first, genuinely live broker
still holds the control port (a systemd restart race, an operator accidentally starting a
second instance, or any other double-launch), the second process runs this sweep — and
deletes **every** staging session directory under `brokerStagingDir()`, including ones the
live broker's active grants currently own, before it ever discovers (via `EADDRINUSE`) that
it lost the race. This directly violates the guarantee `broker-transfer.mts`'s own module
header states for this exact directory tree: "Never delete a staged file on an
AUTOSTART/DUMP/UNDUMP reply... for `vice_disk_attach` the image must stay attached to unit
8 for the rest of the session." A disk image a running emulator has attached, or a file
mid-upload/mid-download on the live broker, can be unlinked out from under it by a
completely unrelated, losing process — with no warning to the affected client, and no
liveness check of any kind standing in the way.

**Fix:** Give `sweepOrphanedStaging()` the same liveness discipline
`reapOrphanedConfigScratch()` already has, or move it after the singleton bind succeeds (so
a losing process never reaches it at all) rather than running it unconditionally ahead of
the bind attempt:

```ts
// Only sweep once this process has confirmed it actually owns the
// control port -- never before the bind is known to have succeeded.
sweepOrphanedStaging({ root: brokerStagingDir() }); // move below the bind, or
// gate each directory by liveness the same way reapOrphanedConfigScratch() does,
// e.g. by writing/reading a per-session-dir owner record.
```

---

### CR-02: `receivePayloadToFile()`'s unguarded `mkdirSync()` violates its own "never throws" contract, and its only production caller has no `.catch()` — an unhandled rejection here is documented to kill the entire VICE pool

**File:** `src/mcp/vice/broker-transfer.mts:451` (unguarded call); caller: `src/mcp/vice/vice-broker.mts:1254-1266`

**Issue:** `receivePayloadToFile()`'s own doc comment states, twice, that it never throws:
"On ANY failure path... this function resolves `{ ok: false, reason }`. Never throws," and
repeats "`wireReason` never reads a caught error's `.message` directly anywhere in this
function" as if every fs call were already inside a catch. But this line is not:

```ts
mkdirSync(dirname(destPath), { recursive: true });   // <-- no try/catch
const tmpPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;
```

every other filesystem operation in this function (`createWriteStream`/`pipeline`,
`beforePublish`, `renameSync`) is wrapped in its own `try`/`catch` with a dedicated
`formatPathFreeFault()` branch — this one is not, and any real fault here (`EACCES`,
`ENOSPC`, `ENOTDIR` from a colliding path segment, a symlink loop, or the directory having
been removed out from under an in-flight upload by CR-01 above) throws synchronously
inside this `async` function, producing a rejected promise.

Its one production call site, `handleFileTransfer()`'s upload branch in `vice-broker.mts`,
never attaches a `.catch()`:

```ts
receivePayloadToFile({
  socket, destPath: entry.path, header: {...}, pending, beforePublish: deps.beforePublish,
}).then((result) => {
  if (!result.ok) { ... }
  clearTransferInFlight(request.handle);
  writeUploadCompletionReply(socket, result);
});
```

A rejection here becomes a genuine Node `unhandledRejection`. This project's own
`broker-kill.mts` registers a process-wide handler for exactly that event, and
`host-tool.mts`'s own comments describe its effect in this codebase without hedging:
"broker-kill.mts's uncaughtException/unhandledRejection handlers kill the whole VICE pool
on an unhandled [rejection]." One client's failed upload — triggered by an ordinary,
plausible fs fault at this specific call — can therefore take down every other client's
running emulator instance on the same broker. No test in `broker-transfer.test.mts` or
`vice-broker-staging.test.ts` exercises this branch; every fs-fault test in this suite
targets the *pipeline*, the *hook*, or the *rename*, never this `mkdirSync`.

**Fix:** Wrap the call the same way every sibling fs operation in this function already is:

```ts
try {
  mkdirSync(dirname(destPath), { recursive: true });
} catch (e) {
  return {
    ok: false,
    code: "internal",
    reason: `vice: failed to create the staging directory for ${destPath}: ${(e as Error).message}`,
    wireReason: formatPathFreeFault("vice: transfer failed before the payload could be received", e),
  };
}
```

The same unguarded-`mkdirSync` shape also exists one call up the same staging subsystem, in
`ensureBrokerDir()` (`broker-home.mts:213-215`, `mkdirSync(path, { recursive: true })` with
no try/catch), reached synchronously from `handleStageFile()` (`vice-broker.mts:1090-1104`)
via `stageFileSlot()` (`broker-transfer.mts:639-672`) with no try/catch anywhere in that
chain either, and `broker-control.mts`'s own `stage_file` dispatch arm calls
`opts.onStageFile(targetId, slot)` directly, uncaught. A throw there is a synchronous
uncaught exception rather than a rejected promise, but lands on the same registered
`uncaughtException` handler with the same documented consequence. Worth the same fix,
though `broker-home.mts` and `broker-control.mts` are outside this review's file list.

## Warnings

### WR-01: A download-side transfer failure produces no reply line at all, unlike the upload side's rich `transfer_complete`/`error` protocol

**File:** `src/mcp/vice/vice-broker.mts:1267-1275`

**Issue:** The upload branch of `handleFileTransfer()` now (post G-64-3/G-64-5) always
writes an explicit `transfer_complete` or path-free `error` completion line before closing
the socket. The download branch has no equivalent:

```ts
} else {
  sendPayloadFromFile({ socket, sourcePath: entry.path, kind: "transfer_payload" })
    .then((result) => {
      if (!result.ok) {
        process.stderr.write(`vice-broker: download transfer failed for handle ${request.handle}: ${result.reason}\n`);
      }
    })
    .finally(settle);
}
```

On a mid-stream failure (e.g. a read error on the staged file, or the file vanishing
between the `existsSync()` pre-check and the actual read), the client sees nothing but an
abrupt connection close — indistinguishable from a plain network drop, with zero
diagnostic text, even though `sendPayloadFromFile()`'s own `result.reason` is right there
(logged server-side only). This is not a CR-01-style path leak (nothing is ever sent to the
client), but it is a real robustness/UX gap: a download failure is strictly harder to
diagnose from the client side than the equivalent upload failure now is.

**Fix:** Write a path-free `error` line (via `formatPathFreeFault()`-shaped text, or a
fixed phrase) before destroying the socket on a failed download, mirroring
`writeUploadCompletionReply()`'s shape for the download direction.

### WR-02: `stageFileSlot()`'s supersession does not consult the in-flight guard before deleting the previous handle's registry entry and file

**File:** `src/mcp/vice/broker-transfer.mts:651-665`

**Issue:** A repeat `stageFileSlot()` call for the same `(grantId, slot)` unconditionally
drops the previous handle from `handleIndex`/`inFlightHandles` and best-effort unlinks its
file — even if `markTransferInFlight()` currently holds that exact handle (i.e. an upload
or download for it is actively streaming):

```ts
const previousHandle = slotIndex.get(key);
if (previousHandle) {
  const previousEntry = handleIndex.get(previousHandle);
  handleIndex.delete(previousHandle);
  inFlightHandles.delete(previousHandle);
  if (previousEntry) {
    try { rmSync(previousEntry.path, { force: true }); } catch { /* best-effort */ }
  }
}
```

If a client races a fresh `stage_file` for the same slot against a still-in-flight
transfer for the old handle: (1) `resolveStagedFile(oldHandle)` starts refusing "unknown
transfer handle" mid-transfer even though the upload is still genuinely running; (2) once
that in-flight upload eventually completes and calls `renameSync()`, it silently publishes
its bytes to a path no registry entry references anymore — an orphaned file invisible to
every caller until the whole session directory is later cleared. `T-64-16`'s own in-flight
guard exists precisely to prevent two operations from racing on the same handle; this path
bypasses it entirely for the *supersession* case.

**Fix:** Either refuse (or queue) a `stageFileSlot()` supersession while
`inFlightHandles.has(previousHandle)`, or accept the race explicitly and document why an
orphaned publish is harmless here (it currently is not documented at all — the module's own
"WHAT NOT TO DO" list covers deletion-on-reply and slot-as-path-component, not this case).

## Info

### IN-01: `sendPayloadFromFile()`'s size cap check has a TOCTOU window between `statSync` and the two streaming passes

**File:** `src/mcp/vice/broker-transfer.mts:320-357`

**Issue:** The pre-flight `statSync(sourcePath).size` cap check happens once, before either
streaming pass. If the source file grows between that stat and the subsequent digest/send
passes (e.g. a concurrent writer), the friendly pre-flight refusal is bypassed and the
transform's own mid-stream cap rejection fires instead, with a less specific message. Low
severity — the cap is still enforced, just later and with a different message shape — but
worth a one-line acknowledgement given how deliberately every other edge in this file names
its own race windows.

**Fix:** No action required; note only. If ever revisited, re-stat immediately before the
send pass, or accept the current behavior and say so in the header comment the way the
publish-hook race is documented.

---

_Reviewed: 2026-09-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
