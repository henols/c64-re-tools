---
phase: 64-files-as-bytes-both-directions
reviewed: 2026-09-23T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - CLAUDE.md
  - src/mcp/vice/broker-control.mts
  - src/mcp/vice/broker-control.test.ts
  - src/mcp/vice/broker-endpoint.test.ts
  - src/mcp/vice/broker-endpoint.ts
  - src/mcp/vice/broker-home.mts
  - src/mcp/vice/broker-relay.test.ts
  - src/mcp/vice/broker-relay-text.test.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/repo-root.ts
  - src/mcp/vice/resources/broker-control.mjs
  - src/mcp/vice/resources/broker-home.mjs
  - src/mcp/vice/resources/vice-broker.mjs
  - src/mcp/vice/stock-connect.ts
  - src/mcp/vice/stock-dispatch.ts
  - src/mcp/vice/stock-live-relay.test.ts
  - src/mcp/vice/stock-machine.test.ts
  - src/mcp/vice/text-connect.test.ts
  - src/mcp/vice/text-connect.ts
  - src/mcp/vice/text-tools.ts
  - src/mcp/vice/transfer-disjoint-roots.test.ts
  - src/mcp/vice/vice-broker-client.ts
  - src/mcp/vice/vice-broker-launch.test.ts
  - src/mcp/vice/vice-broker.mts
  - src/mcp/vice/vice-proxy.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-09-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 64 lands the file-transfer control ops (`stage_file`/`transfer`) and reverses G-64-1's
two causes: (1) `attach`/`transfer` now authenticate by broker-minted handle alone, dispatched
*before* the per-boot token gate in `broker-control.mts`, and (2) the broker's own state root
(`broker.json`, `supervisor/`) moves from a project-relative `--repo-root` join to
`broker-home.mts`'s machine-level resolver, with the container-side client
(`vice-broker-client.ts`'s `brokerRootDir()`) now sharing that exact resolver instead of
recomputing a second, drifting answer.

Both reversals are implemented consistently across every file in scope: the removed
`controlToken`/`token` parameter is gone from every call site (`stock-connect.ts`,
`text-connect.ts`, `broker-endpoint.ts`, `stock-dispatch.ts`, and every touched test fixture),
the compiled `resources/*.mjs` artifacts are rebuilt and match their `.mts` sources (checked by
grep for the new `attach`/`transfer` pre-gate arms and the `brokerStateDir()` wiring), and the
new `transfer-disjoint-roots.test.ts` / `vice-broker-launch.test.ts` route-agreement tests
substantiate the two headline claims (no broker-side path ever reaches a client-visible result;
client and broker agree on `broker.json`'s location under every documented start route). I did
not find a defect in the core security reversal itself — the per-claim/per-stage handle is
128-bit random, compared via `timingSafeEqual` after a length gate, and the listener's own bind
set (loopback + enumerated bridge addresses, never wildcard) remains the first line of defence
for the newly pre-gate ops, matching the documented threat model.

Three lower-severity issues remain, detailed below: a newly-introduced validation asymmetry
between the bind-side and dial-side readers of `VICE_BROKER_CONTROL_PORT` that undercuts this
phase's own diagnosability goal for a misconfigured port; a pre-existing (but in-scope) gap
where several of `broker-control.mts`'s synchronous dispatch callbacks have no `try/catch`,
unlike their asynchronous siblings; and a stale doc comment in `broker-home.mts` referencing an
import that does not exist.

## Warnings

### WR-01: `VICE_BROKER_CONTROL_PORT` is validated inconsistently between bind and dial sides

**File:** `src/mcp/vice/broker-control.mts:833-839` (bind side, pre-existing, unmodified by
this phase) vs. `src/mcp/vice/broker-endpoint.ts:97-104` (dial side, new in this phase)

**Issue:** Before this phase, every dial function in `broker-endpoint.ts` hardcoded
`DEFAULT_CONTROL_PORT` and never read `VICE_BROKER_CONTROL_PORT` at all — this was the exact
"relay always dials 19510" defect the G-64-1 diagnosis recorded and this phase fixes by adding
`resolveEndpointPort()` and routing `dialBrokerEndpoint()`/`dialMonitorRelay()`/
`dialFileTransfer()` through it. `resolveEndpointPort()` validates strictly: the raw string
must parse to an integer in `1..65535`, or the default is used. The pre-existing bind-side
`resolveControlPort()` (which `startControlListenerOnHosts()`/`vice-broker.mts`'s startup path
uses to choose the port to bind) validates far more loosely: any `Number.isFinite()` value is
accepted verbatim, including `0`, negative numbers, and any value above `65535` (a non-integer
like `"12.5"` is also accepted verbatim by the bind side, whereas the dial side rejects it).

Because this phase is the *first* time the dial side actually reads this variable, the two
readers' disagreement on "valid" is now reachable in practice: an operator setting
`VICE_BROKER_CONTROL_PORT` to an out-of-integer-range value (e.g. `"70000"`, `"-1"`, `"12.5"`)
makes the broker attempt to bind that raw value (which Node will refuse, most likely a
synchronous `RangeError`/`ERR_SOCKET_BAD_PORT` surfaced as a rejected `bindControlListener()`
promise) while every client-side dial silently falls back to port `19510` instead of naming the
mismatch. The result is the least informative of the four ranked dial failures this same phase
otherwise goes to great lengths to make maximally informative (`describeDialFailure()`'s rank
1-4 messages) — a misconfigured port produces a bare "no broker answered on either candidate"
rather than a message that could name the env var as the cause. `broker-endpoint.test.ts`'s new
tests exercise `resolveEndpointPort()` in isolation but nothing cross-checks it against
`resolveControlPort()`'s semantics.

**Fix:** Give `resolveControlPort()` the same integer/range validation `resolveEndpointPort()`
now has (or have one delegate to the other, since both ultimately answer the same question for
the same env var), so a malformed `VICE_BROKER_CONTROL_PORT` is refused/defaulted identically on
both sides of the wire:
```ts
export function resolveControlPort(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_CONTROL_PORT;
  if (raw === undefined || raw === "") return 19510;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return 19510;
  return n;
}
```

### WR-02: Several `broker-control.mts` dispatch callbacks run with no `try/catch`, unlike their async siblings

**File:** `src/mcp/vice/broker-control.mts` — the `attach` arm (~line 1325), `transfer` arm
(~line 1370), `monitor_claim` arm (~line 1545), `monitor_release` arm (~line 1592),
`operation` arm (~line 1618), and `stage_file` arm (~line 1667), all inside `handleLine()`
within `attachControlProtocol()`'s `socket.on("data", ...)` handler.

**Issue:** `handleLine()`'s `host_tool`, `acquire`, and `recycle` arms each wrap their callback
invocation in a `.then()/.catch()` pair, explicitly converting a thrown/rejected promise into a
well-formed `{ kind: "error", code: "internal", ... }` reply (see `host_tool`'s own comment:
"the dispatch branch below treats a rejection as a genuine possibility anyway and answers
`internal` rather than letting it escape uncaught"). The six ops listed above call their own
*synchronous* callback (`opts.onRelayAttach`, `opts.onFileTransfer`, `opts.onMonitorClaim`,
`opts.onMonitorRelease`, `opts.onOperation`, `opts.onStageFile`) directly, with no `try/catch`
at all. Neither this file nor `vice-broker.mts` registers a process-level `uncaughtException`
handler. Since these calls happen synchronously inside a `net.Socket`'s `"data"` event listener,
a throw from any of them (today, or from a future change to `vice-broker.mts`'s
`handleRelayAttach()`/`handleMonitorClaim()`/`handleFileTransfer()`/etc.) propagates as an
uncaught exception out of the event emitter and crashes the entire broker process — not merely
the offending connection — taking down every other live grant/instance the broker was managing
for every project on the machine. This directly contradicts the architecture's own stated
posture elsewhere in this codebase ("Never-throw boundary") and this same file's own
"never fabricate/never let an uninterpreted error reach the caller" discipline it applies
everywhere else on the async paths.

I did not find a concrete input that makes today's `vice-broker.mts` implementations of these
six callbacks throw (the handle comparisons are length-gated before `timingSafeEqual`, the map
lookups cannot throw), so this is a latent robustness gap rather than a demonstrated crash —
but it is a real asymmetry in a file whose own header repeatedly asserts a "never throw"
design intent for untrusted wire input, and `broker-relay.mts` (not in this review's scope) is
exactly the kind of sibling module a future change could touch without anyone re-auditing this
call site's own protection.

**Fix:** Wrap each of the six synchronous callback invocations in a `try/catch` that answers
`{ kind: "error", code: "internal", message: "<op> threw" }` on a thrown error, mirroring the
existing `.catch()` arms for `host_tool`/`acquire`/`recycle`. For the `attach`/`transfer` arms
specifically, remember to reset `relayMode = false` in the catch block (matching the existing
`outcome.ok === false` branches) so a thrown callback does not leave the socket's line reader
permanently disabled.

## Info

### IN-01: Stale doc comment in `broker-home.mts` claims `existsSync` is imported, but it is not

**File:** `src/mcp/vice/broker-home.mts:207-215`
**Issue:** `ensureBrokerDir()`'s doc comment reads: "`existsSync` is imported only so a future
caller can probe without creating; this function itself never uses it as a guard." The file's
actual import list is:
```ts
import { mkdirSync } from "node:fs";
import { homedir as osHomedir } from "node:os";
import { join, resolve } from "node:path";
```
`existsSync` does not appear anywhere in this file. The comment describes an import that was
either removed at some point without updating the comment, or never actually added — either
way it is misleading to a future reader who might assume `existsSync` is available to reach for.
**Fix:** Either add `existsSync` to the `node:fs` import (if a future caller genuinely needs a
probe-without-create primitive here) or delete the sentence claiming it is imported.

---

_Reviewed: 2026-09-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
