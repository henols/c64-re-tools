---
phase: 64-files-as-bytes-both-directions
reviewed: 2026-09-23T14:41:31Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-endpoint.test.ts
  - src/mcp/vice/broker-endpoint.ts
  - src/mcp/vice/broker-home.mts
  - src/mcp/vice/broker-home.test.ts
  - src/mcp/vice/broker-kill.mts
  - src/mcp/vice/broker-kill.test.ts
  - src/mcp/vice/broker-launch.mts
  - src/mcp/vice/broker-launch.test.ts
  - src/mcp/vice/broker-relay.test.ts
  - src/mcp/vice/broker-transfer.mts
  - src/mcp/vice/broker-transfer.test.mts
  - src/mcp/vice/build.ts
  - src/mcp/vice/repo-root.ts
  - src/mcp/vice/stock-broker-live.test.ts
  - src/mcp/vice/stock-connect.test.ts
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-live-broker-monitor.test.ts
  - src/mcp/vice/stock-machine.test.ts
  - src/mcp/vice/stock-machine.ts
  - src/mcp/vice/stock-paths.ts
  - src/mcp/vice/stock-recycle.test.ts
  - src/mcp/vice/text-connect.test.ts
  - src/mcp/vice/text-monitor-live.test.ts
  - src/mcp/vice/text-tools.test.ts
  - src/mcp/vice/tools-manifest.stock.json
  - src/mcp/vice/transfer-disjoint-roots.test.ts
  - src/mcp/vice/transfer-hash.mts
  - src/mcp/vice/transfer-hash.test.mts
  - src/mcp/vice/transfer-paths.test.ts
  - src/mcp/vice/transfer-paths.ts
  - src/mcp/vice/tsconfig.build.json
  - src/mcp/vice/vice-broker-acquire.test.ts
  - src/mcp/vice/vice-broker-client.test.ts
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker-launch.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-broker-staging.test.ts
findings:
  critical: 0
  warning: 4
  info: 0
  total: 4
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-09-23T14:41:31Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

This phase moves four file-carrying MCP tools off a shared filesystem onto a broker
file-transfer protocol (bytes over TCP, sha256-verified, 16 MiB-capped at both ends). The
containment validators (`transfer-paths.ts`'s `validateContainedDestination()` and
`broker-transfer.mts`'s deliberately-duplicated `refuseUnsafeSegment()`) refuse the same
inputs and neither touches the filesystem before refusing; the staged-file path is always
built from a broker-minted random handle plus a validated, separator-free grant id, so no
client-controlled string ever reaches a path component and no traversal or symlink-escape
vector was found. The `transfer` control op's deliberate non-gating (T-63-01 precedent)
is sound: the handle is 128 bits of `randomBytes`, unrelated to the (grantId, slot) pair
it was minted from, so an ungated caller cannot derive one it was not handed. The
per-session channel lock (`withChannelLockHeld()`, held across the whole
stage→transfer→wire sequence in `withStockSession()`) closes off same-session concurrent
staging races for all four migrated tools. No BLOCKER-level defect was found.

Four WARNING-level gaps remain, all in the identified security-sensitive seams: the
client-side download path in `stock-connect.ts` implements a strictly weaker declared-
length check than its broker-side sibling in `broker-transfer.mts` (D-11 calls for the
full check at every consumption site); the staging-supersession primitive
(`stageFileSlot()`) does not consult the in-flight-transfer guard before deleting a
handle's registry entry and unlinking its file, a real gap in the primitive even though
today's four call sites cannot reach it thanks to the channel lock; `clearStagingForSession()`
recursively deletes a grant's whole staging directory with no check for an in-flight
transfer racing it on a separate physical connection, a case this codebase's usual
name-every-race discipline does not mention anywhere; and transfer handles are logged to
broker stderr on failure, inconsistent with the "never echo the value" posture the sibling
`refuseUnsafeSegment()` states for the same class of secret.

## Warnings

### WR-01: Client-side download path skips half of D-11's declared-length validation

**File:** `src/mcp/vice/stock-connect.ts:540-551`
**Issue:** `broker-transfer.mts`'s `receivePayloadToFile()` validates a transfer header's
declared `byteLength` in full before consuming any payload byte:

```ts
if (typeof header.byteLength !== "number" || !Number.isSafeInteger(header.byteLength) || header.byteLength < 0) {
  return { ok: false, reason: `... must be a non-negative safe integer ...` };
}
if (header.byteLength > capBytes) { ... }
```

`stock-connect.ts`'s `defaultTransferFile()` — the client-side mirror of the same
exchange, re-implemented separately because `broker-transfer.mts` is host-bound and cannot
be value-imported from a container-side, never-built `.ts` file — only re-implements the
second half:

```ts
if (byteLength > TRANSFER_MAX_BYTES) {
  return { ok: false, reason: `vice: broker declared byteLength ${byteLength} exceeds ...` };
}
```

`byteLength` here comes from `dialFileTransfer()`'s reply parse
(`broker-endpoint.ts`'s `performTransfer()`), which only checks `typeof obj.byteLength !==
"number"` — `NaN`, a negative number, or a non-integer float all pass both checks
(`NaN > TRANSFER_MAX_BYTES` is `false`). The per-chunk cap inside
`createHashAndCountTransform()` still bounds the actual bytes streamed, and
`verifyObserved()`'s final digest/length compare will refuse any resulting mismatch (a
non-integer or negative declared value can never equal a real observed count), so this is
not currently exploitable for memory exhaustion or a corrupted publish — but it is the
exact "declared length is untrusted input, checked wherever it is consumed" mandate
(D-11, stated in this same module's own header) implemented on only one side of the wire,
and is precisely the kind of divergence the phase's own review guidance flagged this
duplicated pair as a risk for.
**Fix:** Mirror the same three-part check `receivePayloadToFile()` runs:
```ts
if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 0) {
  return { ok: false, reason: `vice: broker declared byteLength ${byteLength} is not a non-negative safe integer` };
}
if (byteLength > TRANSFER_MAX_BYTES) { ... }
```

### WR-02: `stageFileSlot()`'s supersession does not consult the in-flight guard

**File:** `src/mcp/vice/broker-transfer.mts:467-481`
**Issue:** A repeat `stageFileSlot()` call for the same `(grantId, slot)` unconditionally
deletes the previous handle's registry entry and unlinks its file:

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

Nothing here checks `inFlightHandles.has(previousHandle)` first. If a transfer for
`previousHandle` is actively streaming (`markTransferInFlight()` already set), this
silently removes it from every index — including `inFlightHandles`, so
`clearTransferInFlight()` called later by the in-flight transfer's own `finally` becomes a
no-op on an already-absent entry — and deletes the backing file out from under an
in-progress `receivePayloadToFile()`/`sendPayloadFromFile()` pipeline. Today this is
unreachable through the four shipped call sites (`handleAutostart`/`handleDiskAttach`/
`handleSnapshotSave`/`handleSnapshotLoad`) because `withStockSession()` holds
`channel-lock.ts`'s per-session mutex across the *entire* stage→transfer→wire sequence, so
two calls against the same session and slot can never overlap — but `stageFileSlot()` is a
general primitive with no such caller-side guarantee built in, and its own header comment
("the previous handle is dropped from every index" / "D-05") states a completeness this
implementation does not actually provide for the in-flight case. `broker-transfer.test.mts`
has no test exercising supersession of an in-flight handle.
**Fix:** Either refuse to supersede a slot whose current handle is in-flight (returning
`{ ok: false, reason: "a transfer for this slot is already in flight" }`), or explicitly
document, beside `markTransferInFlight()`'s own header, that supersession is safe only
because every current caller serialises through the channel lock — so a future caller
reached through a different path is warned rather than silently exposed.

### WR-03: `clearStagingForSession()` has no guard against a transfer in flight on a separate connection

**File:** `src/mcp/vice/broker-transfer.mts:544-563`, `src/mcp/vice/vice-broker.mts:1767-1853`
**Issue:** `handleRelease()` calls `clearStagingForSession(requestId)` unconditionally —
both on an explicit `release` request and on the grant-holding control connection's own
close (`vice-broker.mts:1825,1853`) — which recursively `rmSync`s the *entire* staging
directory for that grant:

```ts
export function clearStagingForSession(grantId: string): void {
  const sessionDir = join(brokerStagingDir(), grantId);
  try { rmSync(sessionDir, { recursive: true, force: true }); } catch { /* ... */ }
  ...
}
```

A `transfer` (upload or download) runs on a *separate*, independently-dialled TCP
connection from the grant-holding control connection (`dialFileTransfer()`), so nothing
prevents the control connection closing (a crash, a forced release, the client process
dying) while a transfer for that same grant is still streaming. On POSIX this does not
corrupt data (an already-open read fd keeps its inode alive after unlink; an in-flight
upload's `renameSync(tmpPath, destPath)` simply fails once `tmpPath`'s directory entry has
already been removed, landing on the existing "failed to publish" refusal path rather than
silently succeeding) — but the resulting error is a confusing "failed to publish" message
rather than a clean "session closed" one, and — unlike every other race this module's
comments name explicitly (the upload-completion race, the D-05/D-06/D-07/D-08 lifetime
rules, `markTransferInFlight()`'s own T-64-16 rationale) — this specific interaction is not
discussed anywhere in this file, `vice-broker.mts`, or their test suites.
**Fix:** At minimum, add a header comment beside `clearStagingForSession()` (and
`handleRelease()`) naming this as an accepted, bounded risk the way every other race in
this phase is named. If tighter behaviour is wanted, check `inFlightHandles` for the
grant's own handles before the recursive delete and skip (or defer) removal of any
in-flight entry's file.

### WR-04: Transfer handles are logged verbatim on failure, inconsistent with the phase's own no-echo posture

**File:** `src/mcp/vice/vice-broker.mts:1153,1161`
**Issue:**
```ts
process.stderr.write(`vice-broker: upload transfer failed for handle ${request.handle}: ${result.reason}\n`);
...
process.stderr.write(`vice-broker: download transfer failed for handle ${request.handle}: ${result.reason}\n`);
```
`broker-transfer.mts`'s own `refuseUnsafeSegment()` deliberately never echoes the offending
`grantId`/`slot` value in its refusal message, citing "T-64-13's own posture for a handle
refusal, applied here too". A transfer handle is the sole bearer capability
`handleFileTransfer()` checks (by design, per T-63-01) for reaching a staged file, so
logging it verbatim to the broker's own stderr on every failed transfer is a minor
inconsistency with that stated posture, even though the log is host-local and the
practical exposure is low.
**Fix:** Either drop the handle from these two log lines, or note explicitly why logging it
here (unlike in `refuseUnsafeSegment()`) is considered safe.

---

_Reviewed: 2026-09-23T14:41:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
