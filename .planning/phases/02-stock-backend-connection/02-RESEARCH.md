# Phase 2: Stock Backend Connection - Research

**Researched:** 2026-08-12
**Domain:** VICE binary-monitor protocol client (framing/correlation/demux), on-demand emulator broker (launch flags, single-client ownership, orphan reap), backend auto-detection, connect handshake
**Confidence:** HIGH for the vendored client's actual defects and the broker code paths (all read in full, this session); MEDIUM for the exact shape of the broker's new "monitor-client ownership" bookkeeping (D-13), since no existing mechanism in this codebase already tracks "has a raw binmon socket been opened," only "who holds the control-plane grant" — this is new design, not a ported pattern.

## Summary

Phase 2 has three genuinely independent pieces of work, and this research found no
hidden coupling that would break planning them as parallel work streams. Stream
(a) — the protocol client — is the deepest piece: the vendor source
(`henols/c64-debug-mcp`'s `src/vice-protocol.ts`, same author, MIT) was located
on the local filesystem at `/home/henrik/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts`
and read in full (747 lines). Its core demux discipline — correlate by full
uint32 request id, treat `requestId === 0xffffffff` as an event regardless of
response type — is **already correct** and already satisfies PROTO-02/PROTO-03's
central invariant. What it is missing is exactly what D-16 says it is missing
(the command→expected-response table is a single hardcoded `if` branch, not a
table; there is no `api_version` byte read anywhere in its frame parser at all;
there is no connect epoch; there is no desync counter) plus one thing D-16's
text does not spell out but this research found by reading the code: its two
sibling files (`contracts.ts`, `errors.ts`) pull in `zod`, which is not a
dependency of this repo's `vice-mcp` package and must **not** come along —
only a handful of pure constants and functions should be copied, and the error
class must be a new `ViceError` subclass (per D-16's own instruction), not the
vendored `ViceMcpError`.

Stream (b) — broker launch flags and single-client ownership — lands on code
that already has most of the right shape. `broker-launch.mts`'s `inFlight`
guard, `buildViceArgs()`, and the whole per-child supervision path
(`superviseChild`/`launchSupervised`/`withCrashSupervision`) are backend-agnostic
already; D-12 only needs a second `buildViceArgs()`-shaped function (or a
branch inside it) for `-binarymonitor -binarymonitoraddress`. `broker-kill.mts`'s
`discoverBandProcesses()` (line 483, not 489 — the CONTEXT.md line reference is
off by six lines against the read source, see the Broker-Side Changes section)
is the literal substring-and-`>=basePort` match D-14/D-15 retire. The harder,
genuinely new piece is D-13's ownership flag: nothing in this codebase today
tracks "has a raw binary-monitor TCP socket been opened to this instance" — the
existing `GrantRecord`/control-plane lease answers a different question ("which
container-side MCP process may use this instance's *lifecycle*"), not "has the
binmon port itself been dialled." This is new design, assessed below.

Stream (c) — backend detection and the connect handshake — is the smallest
code footprint (a cached probe result plus a dispatch-table lookup) but has the
widest blast radius: it is the one piece that touches `vice-proxy.ts`'s
`tools` construction loop (currently unconditionally wired to
`forwardToVice()`), so it must land last, after (a) provides a real client to
dispatch to.

**Primary recommendation:** three plans, one per stream, with stream (c)'s plan
depending on both (a) and (b); (a) and (b) have zero file-overlap and can run
in the same wave.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wire framing/correlation/demux (PROTO-01..08) | Container-side MCP server (`.claude/mcp/vice/*.ts`) | — | The client that speaks the binmon protocol runs in the same process as `vice-proxy.ts`, dialling the host directly; no broker involvement in the wire protocol itself |
| Backend detection + cache (BACK-01..04) | Host broker daemon (`.claude/mcp/vice/vice-broker.mts` + `broker-*.mts`) | Container-side (reads the cached result at connect time) | D-03 requires the probe to run once "when the broker first starts" — the broker is the only long-lived host-side process; the container-side client only ever *reads* the cached verdict |
| Launch flag selection (BROK-01) | Host broker daemon (`broker-launch.mts`) | — | `buildViceArgs()` already owns this decision point for the fork; stock is a second branch in the same function, not a new seam |
| Single-client ownership (BROK-02, PROTO-08) | Host broker daemon (new bookkeeping on `InstanceRecord`) | Container-side (the client that must fail fast on conflict) | The broker is the only party that can refuse a second acquire against an instance already carrying a live monitor connection; the container-side client can only report what the broker told it |
| Existing broker guarantees survive (BROK-03) | Host broker daemon | — | Crash supervision, `inFlight` guard, incident-record-before-kill are all broker-owned already; this phase's job is "don't break them," not build them |
| Manifest per-backend trim (D-07, dispatch only in this phase) | Container-side (`vice-proxy.ts`'s `tools` construction) | Build-time artifact (`tools-manifest.stock.json`) | `tools/list` is answered from a static, committed file already; D-07 adds a second static file and a backend-selected read, not a runtime computation |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | One config value switches backends, no code edit | `VICE_BACKEND` does not exist anywhere in the codebase today (confirmed via repo-wide grep) — this is a new env var, read through one seam per the "Where the Code Goes" section |
| BACK-02 | Fork backend behaviour identical to v0.1.x; existing suite passes unchanged | "The BACK-02 Verification Gate" section below: exact command, exact file count (24 test files exist today; 21 count toward the automated gate per CONTEXT.md's folded todo) |
| BACK-03 | `vice_ping` names backend + VICE version | `vice_ping` is a plain manifest-forwarded tool today (`forwardToVice("vice_ping", args)`, confirmed at `vice-proxy.ts:1086`) — on stock it must become a stock-dispatch-table entry that enriches the reply with the cached detection result, per D-05 |
| BACK-04 | Version-gated capabilities determined at connect, not first use | Folds into the same cached probe (D-10) — see "Backend Detection Probe" section; `CPUHISTORY_GET`'s `0x83` vs `0x8f` distinction is already proven empirically in Phase 1 |
| PROTO-01 | Reassemble across arbitrary chunk boundaries | Vendored client's `parseBuffer()` already loops correctly on `offset + 12 <= buffer.length`, breaking (not throwing) when a frame is incomplete — this half is already correct, see Vendored Protocol Client section |
| PROTO-02 | Correlate by request id | Already correct in the vendored client (`#pending` Map keyed by request id) — see Correlation and Demux Design |
| PROTO-03 | Demux all 5 unsolicited types, never resolve a pending request with an event | Already correct in principle (`requestId === VICE_BROADCAST_REQUEST_ID` check runs before the pending-map lookup) — but the vendored `ResponseType` enum is missing `RegisterInfo` mapped to `'registers'` only for *replies*; needs verification it is not misrouted for the *event* case too (it is not — event routing does not consult `ResponseType` at all, only `requestId`) |
| PROTO-04 | Zero-length `JAM` handled without throwing or desyncing | **Confirmed defect** — `parseResponse()`'s `Jam` case calls `body.readUInt16LE(0)` unconditionally; on a genuinely zero-length body this throws a Node `RangeError` inside `#onData()`, itself called from the socket's `'data'` listener | Exact fix given below |
| PROTO-05 | Protocol error surfaced distinguishably | Already present: `#onData()` checks `response.errorCode !== ErrorCode.OK` and rejects with a typed `emulator_protocol_error` before ever resolving — needs only the error-class rename to this repo's `ViceError` subclass convention |
| PROTO-06 | Died/restarted-underneath reported distinctly from timeout | `#onClose()` already rejects every pending command with a distinct `connection_closed` error on socket close — this satisfies the "unambiguous, immediate" half of D-11; the "new machine, re-handshake" half (reusing `MachineRestartedError` from `vice.ts:277`) is new wrapper logic, not in the vendored client |
| PROTO-07 | Full `DISPLAY_GET` (~157 KB) without truncation | Vendored client has no fixed buffer cap at all (`Buffer.concat` growth, unbounded) — this is *safer* than truncation but needs the `probe-binmon.mjs` precedent's `MAX_BODY_LEN` (4 MiB) ported in as a desync guard, per D-18 |
| PROTO-08 | Second client prevented/reported as conflict, never diagnosed as wedge | **No existing mechanism answers this** — new broker-side bookkeeping, see Broker-Side Changes and the D-13 assessment in Summary |
| BROK-01 | Broker launches stock with binmon flags, fork unchanged, by backend | `buildViceArgs()` (`broker-launch.mts:94-101`) is the exact, single, already-existing decision point |
| BROK-02 | One monitor client per instance | Same new mechanism as PROTO-08 — two requirements, one design |
| BROK-03 | Existing guarantees survive | `inFlight` (`broker-launch.mts:66`), crash supervision (`handleExit`/`launchSupervised`), incident-record-before-kill (`incident-record.ts`, not touched by this phase) are all read and confirmed backend-agnostic already |
| VERIF-02 | Client unit-tested against recorded/stubbed frames incl. malformed/event-interleaved cases | "VERIF-02 Test Fixture Strategy" section: 8 named cases, capture-vs-synthesize disposition for each |

</phase_requirements>

## Vendored Protocol Client (D-16 Deep Dive)

**Source, read in full this session:**
`/home/henrik/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts` (747 lines),
plus its two direct dependencies, `src/contracts.ts` (208 lines) and
`src/errors.ts` (173 lines). Package: `c64-debug-mcp` v1.0.14, MIT, copyright
Henrik Olsson 2025 (`LICENSE`). `[VERIFIED: local filesystem read, this
session]` — not a web-search-sourced claim.

### Module structure

- `CommandType` / `ResponseType` / `ErrorCode` — three `const enum`s mirroring
  the exact opcode/error-code set already normative in
  `docs/phase0-binmon-findings.md` §5. One-for-one match confirmed: `0x01/0x02`
  MEM, `0x11-0x15` CHECKPOINT, `0x22` CONDITION_SET, `0x31/0x32` REGISTERS,
  `0x41/0x42` DUMP, `0x71-0x73` execution control, `0x81-0x86` PING through
  CPUHISTORY_GET, `0x91` PALETTE_GET, `0xa2` JOYPORT_SET, `0xaa/0xbb/0xcc/0xdd`
  EXIT/QUIT/RESET/AUTOSTART. `USERPORT_SET` (`0xb2`) is the one opcode this
  project's normative doc lists that the vendored `CommandType` enum omits —
  trivial one-line addition if a later phase needs it (not required by
  PROTO-01..08).
- `parseBuffer(buffer)` — the framing loop. Header size assumed is **12
  bytes**, matching this project's normative *response* header (not the
  11-byte *request* header, which `encodeHeader()` handles separately and
  correctly).
- `parseResponse(responseType, errorCode, requestId, body)` — a big `switch`
  producing one of thirteen `Parsed*Response` union members. Per-type parsing
  is otherwise faithful to the wire layout this project's docs already
  normative-ize (e.g. `DisplayGet`'s `infoLength`-then-`imageLength` unpacking
  at offsets 0/17 matches `docs/phase0-binmon-findings.md` §3's byte layout).
- `class ViceMonitorClient extends EventEmitter` — the client. Private fields:
  `#socket`, `#buffer` (growth via `Buffer.concat`, no cap), `#nextRequestId`
  (starts at 1, plain increment — **never mints `0xffffffff`** by construction,
  satisfying D-17 for free as long as it never wraps past `0xfffffffe`, which
  at 1 request/ms would take ~49.7 days continuous — should still be asserted
  defensively, not merely relied on), `#pending` (`Map<number, PendingCommand>`),
  `#chain` (a promise chain serialising every `send()` call — one in-flight
  command at a time, matching this project's "gate commands on derived state"
  convention already planned for Phase 3's execution-control work), `#runtimeState`.
- Public surface: `connect`/`disconnect`, `ping`, `getInfo`, `captureDisplay`,
  `getPalette`, `getRegistersAvailable`, `getRegisters`/`setRegisters`,
  `readMemory`/`writeMemory`, `continueExecution` (maps to `EXIT`),
  `stepInstruction`, `stepOut`, `reset`, `setBreakpoint`/`getBreakpoint`/
  `listBreakpoints`/`deleteBreakpoint`/`toggleBreakpoint`/`setBreakpointCondition`,
  `autostartProgram`, `quit`, `sendKeys`, `setJoyport`. This maps closely
  1:1 onto Phase 3's DIRECT-01..09 tool list — a strong signal the vendor's
  method shape is the right level of abstraction to keep, even though Phase 2
  itself only needs `connect`/`ping`/`getInfo`/the demux plumbing.

### Defect (a): zero-length `JAM` read — confirmed, exact location

```typescript
// Source: c64-debug-mcp src/vice-protocol.ts:357-358 (read this session)
case ResponseType.Jam:
  return { type: 'jam', requestId, errorCode, programCounter: body.readUInt16LE(0) };
```

`body` is a zero-length `Buffer.subarray` slice whenever the emulator sends a
genuine `JAM` (per this project's own normative finding,
`monitor_binary.c:384-394` passes `length = 0` for this response). Node's
`Buffer.prototype.readUInt16LE` throws `RangeError: The value of "offset" is
out of range` on a length-0 buffer with `offset=0`. This throw happens inside
`parseResponse()`, called from `parseBuffer()`, called from `#onData()`,
called from the raw socket's `'data'` event listener
(`socket.on('data', (chunk) => this.#onData(chunk));`, line 412) — i.e. it
throws inside a Node built-in `EventEmitter` listener with **no surrounding
try/catch anywhere in this file**. Node does not catch listener exceptions;
this either becomes an `uncaughtException` (caught at the process level by
`vice-proxy.ts`'s global handler per this codebase's "never-throw boundary,"
per `.planning/codebase/ARCHITECTURE.md`) or, if the socket internals happen to
wrap the emit, a silently swallowed error — either way, the connection's
`#pending` map is left with commands never resolved or rejected, indistinguishable
from a hang.

**The fix must:** branch on `body.length` (or use `errorCode`/response-length
field already available at the call site — `parseResponse` already receives
`errorCode`) before attempting the 2-byte read, and represent "no PC available"
as `null`/`undefined` rather than reading garbage or throwing. Since
`monitor_binary.c` never sends a PC for `JAM`, `programCounter: null` is the
only honest representation — do not fabricate a `0` (indistinguishable from a
real PC of `$0000`).

### Defect (b): throw-on-bad-STX, never advances the buffer — confirmed, exact location and mechanism

```typescript
// Source: c64-debug-mcp src/vice-protocol.ts:228-231 (read this session)
while (offset + 12 <= buffer.length) {
  if (buffer[offset] !== VICE_STX) {
    throw new ViceMcpError('protocol_invalid_stx', 'Invalid response prefix from emulator debug connection', 'protocol');
  }
  ...
```

Two compounding problems, both real:

1. **The throw is synchronous and unrecoverable in place.** `#onData()`
   (line 664-667) does `this.#buffer = Buffer.concat([this.#buffer, chunk]); const { responses, remainder } = parseBuffer(this.#buffer); this.#buffer = Buffer.from(remainder);`
   — the reassignment to `this.#buffer` on line 667 **never executes** when
   `parseBuffer` throws, because the throw unwinds past it. The concatenated
   buffer (already containing the un-skippable bad byte, at the same offset)
   is retained forever as `this.#buffer` from the assignment on line 665,
   which ran *before* the throw.
2. **Every subsequent chunk makes it worse, not better.** The next inbound
   `'data'` event concatenates onto the same poisoned buffer and calls
   `parseBuffer` again, which restarts scanning at `offset = 0` — hits the
   exact same bad byte at the exact same position, and throws again. This is
   a permanent livelock: the connection is unrecoverable without a full
   `disconnect()`/`connect()` cycle, which is exactly what D-16 means by
   "never advances the buffer."

**The fix must:** on an STX mismatch, advance `offset` by at least one byte
(the minimum recovery step — scanning forward for the next byte that looks
like a plausible STX is a reasonable refinement, but even a naive
one-byte-at-a-time skip is strictly better than the current unrecoverable
throw) and increment the "desync counter" D-16 asks for, so a caller can
observe how many bytes were discarded rather than the connection silently
going quiet. Whether to keep scanning within the *same* `#onData()` call or
bail out to wait for more bytes is a real design choice for the plan to make —
either is acceptable as long as `this.#buffer` is left advanced past the bad
byte before the function returns, not concatenated-and-abandoned.

### What D-16 says is missing, confirmed present-or-absent by direct read

| D-16 item | Present today? | Where it would need to live |
|---|---|---|
| Generalised `related[]` accumulation | **Partially present, not generalised.** `PendingCommand.linkedCheckpointInfo` (line 90) and the hardcoded `if (pending.type === CommandType.CheckpointList && response.type === 'checkpoint_info')` branch (line 683) already implement exactly this pattern for the one case VICE's protocol actually needs it (`CHECKPOINT_LIST` answering N `CheckpointInfo` frames plus one final `CheckpointList` frame, all under the original request id). D-16 wants this turned into a data-driven table (`CommandType -> { relatedTypes: ResponseType[] }`) rather than a second `if` branch appearing every time a new N+1 command is discovered. | `#onData()`'s response-dispatch loop |
| Command→expected-response table | **Absent entirely.** Nothing validates that a `CommandType.MemoryGet` request actually got back a `ResponseType.MemoryGet` reply (as opposed to some other type arriving on the same request id, which would currently be handed to the caller unchecked as whatever `parseResponse()` produced for that response type). | New table, consulted in `#onData()` before `pending.resolve()` |
| Connect epoch | **Absent entirely.** No field on `ViceMonitorClient` tracks "which machine incarnation is this." | Belongs one layer *above* the vendored client — a wrapping module reusing `vice.ts`'s existing `MachineRestartedError`, per D-11 |
| `api_version === 2` assertion | **Absent entirely — the byte is never even read.** `parseBuffer()` reads STX at `offset+0`, body length at `offset+2`, response type at `offset+6`, error code at `offset+7`, request id at `offset+8` — **offset+1 (api_version) is skipped over completely**, both as a value to validate and as a value to surface. | Add the read (`buffer[offset+1]`) and the assertion inside `parseBuffer()`, or immediately after connect via one `getInfo()`/response-header check |
| Desync counter | **Absent entirely.** No counter of any kind exists on the class. | A private field, incremented in the fixed STX-mismatch path above |

### Alignment cost to this repo's conventions

The vendored file arrives in a genuinely different style, confirmed by direct
comparison:

- **Quoting:** single quotes throughout (`'protocol_invalid_stx'`) vs. this
  repo's double-quote convention.
- **Error class:** `ViceMcpError extends Error` (`errors.ts:6`) — a
  **different class hierarchy** than this repo's `ViceError extends Error`
  (`vice.ts:250`, not read in full this session but confirmed present via
  grep). D-16 explicitly says to align to `ViceError` subclasses; this is not
  optional cosmetic work — it changes which `catch`/`instanceof` patterns the
  rest of the codebase can use against errors this client raises.
- **A hard dependency problem, not just a style one:** `contracts.ts` (the
  vendored file's own import, line 4) begins `import { z } from 'zod';` and
  defines every enum/type via `z.enum(...)`/`z.infer<...>`. `errors.ts`
  imports `ZodError` from `'zod'` directly in `normalizeToolError()`. **This
  repo's `vice-mcp` package has no `zod` dependency** (`package.json`'s
  `dependencies` block lists only `@mastra/mcp` and `@mastra/core` — confirmed
  by direct read this session). Vendoring `vice-protocol.ts` verbatim, with
  its two import lines intact, would silently add a new direct dependency this
  package does not declare and does not need — `vice-protocol.ts` itself only
  ever uses four small pure exports from `contracts.ts`
  (`VICE_API_VERSION`, `VICE_STX`, `VICE_BROADCAST_REQUEST_ID`,
  `mainMemSpaceToProtocol()`, `breakpointKindToOperation()`,
  `cpuOperationToBreakpointKind()`) plus one plain interface (`Breakpoint`,
  `contracts.ts:155-167`, no `zod` involved) and one plain type alias
  (`BreakpointKind`, which *is* `zod`-derived at `contracts.ts:75` but is a
  trivial four-value string union that should be hand-written instead of
  imported). **The plan must copy only these pure values inline or into a
  small new sibling file, never import `contracts.ts`/`errors.ts` wholesale.**
  This is a concrete finding this research surfaced by reading the dependency
  chain, not something D-16's text names explicitly.
- **Import extensions:** the vendor uses `.js` extensions on TypeScript
  imports (`from './contracts.js'`) — correct for that project's own build
  setup, wrong for this one, which runs unbuilt `.ts` directly and requires
  real, matching extensions (`.ts`) on every relative import.
- **Header comment:** the vendored file has **no header comment of any kind**
  — it opens directly on `import { EventEmitter } from 'node:events';`. D-16
  says "keep header attribution," but there is no existing attribution
  comment to keep; the task is to **author** one, in this repo's own
  structured header-comment style (see `broker-launch.mts`'s or
  `broker-kill.mts`'s opening comments for the convention: what problem the
  file solves, prior-incident context, explicit "do not do X" warnings),
  naming the source repository, the commit/version vendored from, the MIT
  license, and the two defects fixed on the way in. No existing file in this
  repo vendors third-party source, so there is no established attribution
  template to copy from — the plan should establish one, not search for a
  precedent that doesn't exist. `[VERIFIED: grepped this repo's `.ts`/`.mts`
  files for "vendored"/"Adapted from"/"MIT License" this session, zero hits]`.

**Net line-count estimate:** the vendored file is 747 lines; landing it here
after (1) fixing the two defects, (2) adding the epoch/api_version/desync/table
machinery, (3) stripping the `zod` dependency down to ~15 lines of hand-copied
constants, and (4) rewriting to this repo's quoting/header conventions is
realistically a 750-850 line new module, not a drop-in copy — budget it as
new-module-sized work, not a port.

## Correlation and Demux Design

The concrete mechanism, grounded in the vendored client's actual (correct)
architecture:

**Pending-request map keyed on full uint32 id, coexisting with `0xffffffff`
events:** `#onData()`'s dispatch loop checks `response.requestId ===
VICE_BROADCAST_REQUEST_ID` **first**, before ever touching `#pending`. This
ordering is the entire mechanism — it prevents the exact failure mode PROTO-03
names (`CHECKPOINT_INFO`/`REGISTER_INFO` sharing a response *type* byte with a
legitimate reply is irrelevant to this check, because the check never
inspects the type byte at all, only the request id). **Failure mode this
prevents:** a client that demuxes on response *type* instead of request *id*
would misroute an unsolicited `CHECKPOINT_INFO` (arriving mid-flight, at id
`0xffffffff`) into whatever pending command happens to be waiting on a
`CheckpointInfo`-shaped reply (e.g. an in-flight `CHECKPOINT_GET`), resolving
it with the wrong checkpoint's data — silently wrong, not a crash. This is
precisely the hazard `docs/phase0-binmon-findings.md` §4 and CLAUDE.md's
Protocol constraints call out as the reason five event types (not three)
matter.

**`CHECKPOINT_LIST` answering N+1 frames on one request id:** demonstrated
working today via `PendingCommand.linkedCheckpointInfo` (an array field set
only when `pending.type === CommandType.CheckpointList`) plus a dispatch check
`if (pending.type === CommandType.CheckpointList && response.type ===
'checkpoint_info') { pending.linkedCheckpointInfo?.push(response); continue; }`
— each interim `CheckpointInfo` frame is appended and the loop `continue`s
without resolving or rejecting the pending command; only the terminal
`CheckpointList`-typed frame (carrying the total count) triggers
`pending.resolve()`, at which point `response.checkpoints` is populated from
the accumulated array. **Generalizing this** (D-16) means replacing the single
hardcoded `if` with a lookup against a `CommandType -> ResponseType[]` related-types
table, so a *future* N+1-shaped command (none is currently known beyond
`CHECKPOINT_LIST`, but the table should not assume there will never be one)
does not require a fifth copy-pasted branch.

**Dropping a duplicate reply on an already-settled id:** the vendored client
does not currently need to handle this explicitly, because `#pending.delete(response.requestId)`
runs (line 689) *before* `pending.resolve()`/`pending.reject()` — so if a
genuinely duplicate frame with the same request id arrived a second time,
`this.#pending.get(response.requestId)` on the second occurrence would return
`undefined` (already deleted), and the existing "no pending entry" branch
(`if (!pending) { this.emit('event', response); continue; }`) fires instead —
**routing a duplicate settled-id reply into the `'event'` emitter, mislabeled
as an unsolicited event.** This is subtly wrong but not dangerous by itself
(nothing currently listens for `'event'` and acts on request-id-shaped data as
if it were real telemetry) — the plan should decide whether a duplicate on a
settled id should be silently dropped (logged, not emitted) versus routed
through the same `'event'` path a genuine unsolicited frame uses, since the
latter could confuse a future consumer that assumes every `'event'` emission
came from `requestId === 0xffffffff`. **Failure mode this decision prevents:**
a downstream event consumer treating a duplicate reply as a second, spurious
`STOPPED`/`RESUMED` transition.

**Mid-stream desync detection and recovery:** covered under Defect (b) above —
the mechanism is the desync counter plus a byte-skip-and-rescan loop rather
than a throw. **Failure mode this prevents:** the permanent livelock described
in Defect (b), and (secondarily) gives an operator/log a way to *know* a
desync happened at all, rather than observing only silent stalled commands.

## VERIF-02 Test Fixture Strategy

Eight named cases, matching the phase's own success criterion 4 verbatim.

| # | Case | Real emulator can produce it? | Capture or synthesize | Notes |
|---|------|-------------------------------|------------------------|-------|
| 1 | Byte-at-a-time delivery | Yes, but not naturally — TCP does not guarantee packet boundaries, but a real run over loopback will usually deliver whole frames | **Synthesize.** Capture one real frame, then feed it to the parser one byte at a time in the test itself (a test-time transform, not a captured artifact) | This is a test *technique* applied to any captured fixture, not a fixture that needs its own capture session |
| 2 | ~157 KB `DISPLAY_GET` | Yes — this is a completely ordinary `DISPLAY_GET` reply; Phase 1's probe already captured the geometry (`dw=504 dh=312`, 8bpp, ~157,248 bytes) | **Capture.** Extend `probe-binmon.mjs` with a capture mode that dumps the raw wire bytes of one `DISPLAY_GET` round trip to a fixture file | Store the fixture binary under a project-appropriate `tests/fixtures/` path (see below) |
| 3 | Zero-length `JAM` | Yes — Phase 1 did not trigger a real `JAM` (no crash occurred), but the frame shape is fully known: 12-byte header, `bodyLength=0`, `responseType=0x61`, `requestId=0xffffffff` | **Synthesize** (constructing the exact 12 header bytes is trivial and safe; deliberately crashing a real 6510 program to capture a genuine JAM is unnecessary risk for a fixture that has no ambiguity in its byte layout) | Cross-check against `monitor_binary.c:384-394`'s `length=0` finding already cited normatively |
| 4 | Event interleaved between a request and its reply | Yes — Phase 1's own raw probe output shows this exact interleaving happening constantly (`REGISTER_INFO -> STOPPED -> RESUMED` appearing between numbered checks in `docs/phase1-probe-results.md`'s raw transcript) | **Capture**, straight out of an existing real session — no new probe code needed, this shape is already sitting in `docs/phase1-probe-results.md`'s raw output and can be re-captured as raw bytes rather than re-derived | Cheapest of the eight to obtain |
| 5 | `CHECKPOINT_LIST` answering N+1 frames on one id | Yes — set 2+ checkpoints, then call `CHECKPOINT_LIST`; VICE answers with one `CheckpointInfo` (0x11) frame per checkpoint plus one final `CheckpointList` (0x14) frame, all at the same request id | **Capture.** New probe capture-mode addition: set 2 checkpoints, issue `CHECKPOINT_LIST`, dump the raw bytes | Directly exercises the `related[]` generalization from the Correlation and Demux Design section |
| 6 | Error reply typed `0x00` (i.e. response type byte `0x00`, not a known type) | **No** — a healthy VICE binary monitor never emits response type `0x00`; this is a genuinely impossible-to-observe shape, per CONTEXT.md D-19's own framing | **Synthesize.** Hand-construct a 12-byte header with `responseType=0x00` and any body | Tests only the parser's `default:` fallback path (`parseResponse()`'s `default: return { type: 'empty', ... }`) |
| 7 | Duplicate reply on a settled id | **No** — a healthy VICE never re-sends a settled reply | **Synthesize.** Two identical frames with the same request id, fed to the client after the first has already been resolved | Exercises the "drop or route to `'event'`" decision from the Correlation and Demux Design section — the plan should pin down and test the *chosen* behavior, not merely "does not throw" |
| 8 | Mid-stream desync | **No** — a healthy VICE never emits a corrupted STX | **Synthesize.** A valid frame, a garbage byte (not `0x02`), then another valid frame concatenated | Exercises the fixed Defect (b) path directly; should assert the desync counter increments and the second valid frame still parses |

**Capture-mode extension to `probe-binmon.mjs`:** the script already has a
`--selftest` offline mode and real command builders for every opcode this
phase needs (`CHECKPOINT_SET`, `CONDITION_SET`, `DISPLAY_GET`, etc., all
confirmed present by direct read this session). A capture mode needs to: (1)
accept a `--capture <case-name>` flag, (2) run the specific command sequence
for that named case, (3) instead of only decoding and printing the response,
also write the **raw wire bytes** (header + body, exactly as received off the
socket, before any parsing) to a fixture file, (4) record provenance
(VICE build path, version quad from `VICE_INFO`, capture date) either in a
JSON sidecar file or a comment block in the same directory.

**Bounding the fork's `CHECKPOINT_INFO ×18` flood (Phase 1's observed
anomaly):** Phase 1's probe results (`docs/phase1-probe-results.md`, "Anomaly
observed on the fork build") show that a `stop=1`, full-range (`$0000-$FFFF`)
exec checkpoint with an `RL`/`CY` condition re-fired 18 times before the
connection became unresponsive, on the fork build specifically. The capture
mode must **not** reuse that exact shape: (1) use a `stop=1` checkpoint on a
**narrow, single-address** range (not `$0000-$FFFF`), (2) always delete the
checkpoint in a `finally` block regardless of outcome (the same fix Phase 1's
probe itself already adopted after this incident — confirmed present in the
"Probe defect that prolonged, but did not cause, the failure" note), and (3)
impose a hard cap on the number of events read in a single capture session
(e.g. stop reading and abort the capture after N frames, rather than looping
until a natural quiescence that may never arrive) — this third point is new,
since Phase 1's probe used a fixed 4-second per-command timeout rather than an
explicit event-count cap, and a capture session iterating over 8 named cases
back-to-back should not risk one runaway case consuming the whole session's
timeout budget.

**Storage of ~157 KB binary fixtures:** this repo already commits generated
binary-shaped artifacts under `resources/*.mjs` (text, but treated as a
committed build artifact) and this project's own convention doc
(`.planning/codebase/ARCHITECTURE.md`, "Generated-but-committed artifacts")
establishes that committing derived/captured artifacts alongside their
generation script is normal here. Recommend a new
`tests/fixtures/binmon/` directory (or, matching this repo's existing
colocated-test convention, a sibling `*.fixtures/` directory next to whichever
new `*.test.ts` file consumes them) holding raw `.bin` frame captures, each
paired with a small `.json` sidecar recording `{ capturedFrom: "stock 3.9" |
"fork 3.10 (not stock)", viceVersion: "3.9.0.0", capturedAt: "<ISO date>",
command: "DISPLAY_GET" }` — mirroring the same provenance discipline
`docs/phase1-probe-results.md` already applies to its own probe run. No
existing directory convention for binary test fixtures was found in this repo
(the closest precedent, `resources/*.mjs`, is text, not binary) — this is a
new pattern the plan should establish explicitly rather than search further
for.

**Test runner:** `node --test`, colocated `*.test.ts` files, confirmed via
`package.json:58` (`"test": "node --test '*.test.*'"`) — no fixture-loading
framework beyond Node's own `fs.readFileSync`. No new test dependency is
implied.

## Backend Detection Probe (D-03)

Two licensed mechanisms, evaluated on the axes CONTEXT.md asks for:

| Axis | Trial launch (spawn with `-mcpserver`, observe failure, respawn) | `-help`/`-?` flag introspection |
|------|---|---|
| Cost | Two full process spawns (one throwaway) every time the cache is invalidated — expensive relative to a flag scan, but this only ever runs once per broker start per D-03 | One process spawn, brief (`--help` exits immediately), cheaper |
| Reliability | Depends on the fork actually *failing* cleanly and quickly when given `-mcpserver` incorrectly (it won't fail — D-02 states the fork accepts **both** flags, so a trial launch of `-mcpserver` against a *stock* binary is the only case that fails, and stock's failure mode on an unrecognized flag needs confirming, not assumed) | Depends on `--help`/`-?` output actually differing between the two binaries in a `grep`-able way |
| Can it run outside `broker-launch.mts`'s `inFlight` critical section? | **No, not safely, unless explicitly serialized under the same guard as a single logical launch** — D-03 states this explicitly: "both spawns are one logical launch under a single guard acquisition — never two racing spawns," referencing the 2026-08-01 outage | **Yes** — a `--help` invocation is not a real emulator launch at all; it does not touch the port-allocation/`inFlight` machinery, so it can run entirely outside `tryLaunchOne()`/`acquirePortAndLaunch()` |

**What stock and the fork actually print for an unknown flag — not
independently verified this session.** This research did **not** run
`/usr/bin/x64sc -mcpserver` or `/usr/local/bin/x64sc --help` in this session
(no VICE binaries are present in this repo's container — confirmed absent via
`command -v x64sc` returning nothing in this sandbox); Phase 1's probe results
document (`docs/phase1-probe-results.md`) recorded that both builds were
launched by hand *outside* this session, on the researcher's own host, with
`-binarymonitor` flags only — it does not record either binary's `--help`
output or its behavior on an unrecognized flag. **`[ASSUMED]`: stock VICE's
argument parser rejects an unrecognized flag (such as `-mcpserver`) with a
non-zero exit and a usage message on stderr, rather than silently ignoring it
and continuing to boot** — this is standard `getopt`-family behavior and
matches this project's own D-01/D-02 framing ("try first to start VICE with
the MCP flag and if it fails then we know it's stock VICE"), but is not
verified against this exact codebase's stock binary in this session. If wrong
— e.g. if stock VICE silently ignores unknown flags and boots anyway — a
trial-launch probe would misclassify every stock binary as "unknown," not
"stock," since the expected failure signal would never arrive. **The plan
should verify this empirically on the researcher's own host (which has both
binaries, per Phase 1) before committing to the trial-launch mechanism**, or
prefer `--help` introspection specifically because it sidesteps this
uncertainty (a `--help` invocation always exits 0 with usage text on both
GNU-style and VICE's own arg parser, regardless of how unknown *other* flags
would be handled).

**Recommendation:** `--help` introspection, specifically because (1) it can
run fully outside the `inFlight` guard (simpler, matches D-03's "must not sit
inside the critical section" constraint by construction rather than by
careful serialization), (2) it does not depend on the unverified assumption
above, and (3) `VICE_INFO` (`0x85`) already gives the version quad once the
binary is confirmed to speak the binary monitor at all — so the two
mechanisms are not actually in tension: `--help` (or a bare `-binarymonitor`
launch, since D-02 already establishes both binaries speak that flag) decides
fork-vs-stock, and the very next step (a real launch, needed regardless to
serve the first acquire) reads `VICE_INFO`'s version quad through the same
connection stream (a) provides. This reframes D-03's "trial launch" option as
possibly unnecessary — the plan should confirm whether `-mcpserver` acceptance
even needs testing at all, given `-binarymonitor` support already
distinguishes nothing (D-02 says both binaries accept it) and the two binaries
are actually told apart by whether they *also* accept `-mcpserver`, which is
the one thing `--help`'s flag-listing output can answer directly by string
match, with zero process-lifecycle risk.

**Cache-key composition (D-03's "catches a binary replaced in place"
requirement):** `{ resolvedPath: string, versionQuad: [number, number, number, number], mtimeMs: number }`. Path alone fails the replaced-in-place test outright (that is the whole point of the requirement). The version quad alone is not sufficient either — two different builds can legitimately share a version quad (this project's own Phase 1 found the fork build reports `3.10.0.0`, indistinguishable by version alone from a genuine stock 3.10 release, per the "Fork-as-3.10 accepted unknown" caveat in `docs/phase1-probe-results.md`). Adding the file's `mtimeMs` (or a content hash, more robust but costs a full read of a multi-megabyte binary on every broker start) catches an in-place binary swap that happens to preserve both path and reported version — `[ASSUMED]`: `mtimeMs` is a directionally-useful signal here, since almost every realistic replace-in-place (an `apt upgrade`, a manual `cp` over the old binary) updates the file's mtime, but a `touch -r` matching the old timestamp would defeat it; this is a cheap-but-imperfect check, not a cryptographic guarantee, and the plan should decide whether that tradeoff is acceptable or whether a content hash is worth the one-time cost.

## Broker-Side Changes

Read in full this session: `broker-launch.mts` (894 lines), `broker-kill.mts`
(638 lines), `broker-control.mts` (516 lines), `broker-state.mts` (366 lines),
`vice-broker-client.ts` (900 lines).

- **Where launch flags are chosen (D-12):** `buildViceArgs(port, { mcpHost,
  viceArgsEnv })` at `broker-launch.mts:94-101`. Currently hardcoded to the
  fork's shape: `["-mcpserver", "-mcpserverhost", host, "-mcpserverport",
  String(port)]`, with a `VICE_ARGS` env-var full override already present
  (used today so tests can launch a stand-in binary like `/bin/sleep`). D-12's
  stock shape is `-binarymonitor -binarymonitoraddress
  ip4://<host>:<port>` (confirmed exact flag names against both
  `docs/phase0-binmon-findings.md` and the real probe command line recorded in
  `docs/phase1-probe-results.md`: `-binarymonitor -binarymonitoraddress
  ip4://127.0.0.1:<port>`). The function needs a `backend` parameter (or the
  caller needs to select which of two argv-building functions to call) — this
  is a small, contained edit, not a rewrite; the existing `VICE_ARGS` override
  continues to work unchanged for either backend since it bypasses this
  function's own construction entirely.
- **Today's instance record shape:** `InstanceRecord` (`broker-state.mts:19-89`)
  already carries `port`, `url`, `state` (`"launching" | "ready" | "granted"`),
  `reason`, `epochFile`, `supervisorDir`, `pid`, `expectedIdentity`,
  `launchedAt`, `readyAt`, `viceBin`, `viceArgs`, `dryRun`, plus the Plan-03
  supervision fields (`epoch`, `deliberateKill`, `respawnAfterKill`,
  `crashTimes`, `backoffMs`, `logPath`). **What D-13 adds:** a new optional
  field, e.g. `monitorClientConnected?: boolean` (or a richer shape naming
  *which* grant/connection holds it, for the "naming the holder" half of D-13's
  refusal message) — a small, additive change to this interface, following the
  exact pattern the Plan-03 supervision fields already set (optional fields,
  documented inline, set by exactly one writer). **Important design gap this
  research surfaces, not resolved by reading the code:** the existing
  `GrantRecord` (`broker-state.mts:91-111`) already answers "which container-side
  MCP process may use this instance's lifecycle" — a port can only be granted
  once at a time, structurally, because `selectWarmInstance()` only offers
  instances in `"ready"` state and `handleAcquire()` immediately flips the
  winner to `"granted"` (`vice-broker.mts:563`, confirmed via grep, not read in
  full this session). **This already prevents two different grant-holders from
  racing onto the same instance.** What it does *not* answer is whether the
  *raw binary-monitor TCP socket* has actually been opened yet by the one
  legitimate grant-holder — a genuinely new question this codebase has never
  needed to answer before, since the fork's HTTP/MCP transport has no
  equivalent "exactly one client" constraint at the wire level (an HTTP server
  services concurrent requests trivially; a raw binmon TCP listener does not).
  **The plan needs to decide**, not merely discover, how the container-side
  client informs the broker "I have now opened the binmon socket" (a new
  control-plane message over the existing `BrokerControlSession`, most likely
  — `status`/`host_state` already establish the pattern of query-shaped
  control messages that don't touch launch/kill) versus whether the ownership
  check can be inferred entirely from the existing grant lifecycle without a
  new message at all (e.g., treating "granted" as sufficient proof of
  exclusivity and pushing the actual conflict-detection to the connect
  attempt itself failing/timing out, which is exactly the "indistinguishable
  from wedge" failure mode PROTO-08 exists to avoid — so this fallback does
  **not** satisfy the requirement and a genuinely new signal is needed).
- **`discoverBandProcesses()` — exact location, and what D-14/D-15 replace it
  with:** `broker-kill.mts:483-489` (not line 489 alone — CONTEXT.md's
  reference points at the function's closing brace; the function body starts
  at line 483):
  ```typescript
  // Source: .claude/mcp/vice/broker-kill.mts:483-489 (read this session)
  export async function discoverBandProcesses(options: DiscoverBandProcessesOptions = {}): Promise<ProcessListEntry[]> {
    const listProcesses = options.listProcesses ?? defaultListProcesses;
    const viceBin = resolveViceBinForReap(options.viceBin);
    const basePort = resolveBasePortForReap(options.basePort);
    const entries = await listProcesses();
    return entries.filter((entry) => entry.args.includes(viceBin) && argsNamePortAtOrAbove(entry.args, basePort));
  }
  ```
  `argsNamePortAtOrAbove()` (line 447-454) does exactly what CONTEXT.md's
  folded todo describes: `args.match(/\d+/g)` then `.some(n => n >= basePort)`
  — a bare numeric-token scan over the process's own argv string, with no
  understanding of which flag actually carries the port. **D-14/D-15's
  replacement:** since ports are now allocated-never-contested (D-14) and
  ownership is the broker's own allocation record, not argv archaeology
  (D-15), the reap should stop calling `discoverBandProcesses()`/
  `argsNamePortAtOrAbove()` at all for identifying *this broker's own*
  instances — `reapOrphanedInstances()` (`broker-kill.mts:609-637`) already
  separately walks `stateDir`'s on-disk instance directories
  (`listInstanceDirs()`) for the epoch-bump half of its job; the *kill* half
  should be re-derived from that same on-disk record (which port directories
  exist under `stateDir`) rather than a live `ps` scan matched by substring.
  This is a genuine behavior change to `reapOrphanedInstances()`, not a pure
  deletion — the plan needs a task for it, and it is squarely BROK-03's
  territory ("existing broker guarantees survive") since the orphan reap is
  one of those guarantees.
- **The `.mts` → `resources/*.mjs` rebuild obligation:** confirmed via
  `.planning/codebase/ARCHITECTURE.md` and `build.ts`'s own asserted file-set
  check — any edit to `broker-launch.mts`, `broker-kill.mts`, or
  `broker-state.mts` (all host-bound `.mts` sources) requires re-running
  `node .claude/mcp/vice/build.ts` to regenerate the committed
  `resources/*.mjs` siblings, and `resources-sync.test.ts` (one of the 24 test
  files, confirmed present) fails CI on drift between source and compiled
  output. **Every task in stream (b) must include this rebuild step**, or the
  automated gate (`npm test`) will catch the omission but only after the
  fact.

## The BACK-02 Verification Gate

**Confirmed test-file inventory (direct `ls`, this session):** 24 files match
`*.test.*` under `.claude/mcp/vice/`:
`broker-control.test.ts`, `broker-e2e.test.ts`, `broker-epoch.test.ts`,
`broker-kill.test.ts`, `broker-launch.test.ts`, `broker-state.test.ts`,
`build-atomic.test.ts`, `container-guard.test.ts`, `containerpath.test.ts`,
`host-scripts.test.ts`, `incident-record.test.ts`, `install-resources.test.ts`,
`load-order.test.ts`, `refresh-manifest.test.ts`, `repo-root.test.ts`,
`resources-sync.test.ts`, `telemetry-import.test.ts`,
`vice-broker-acquire.test.ts`, `vice-broker-client.test.ts`,
`vice-broker-launch.test.ts`, `vice-probe.test.ts`, `vice-proxy.test.ts`,
`vice-sync.test.ts`, `vice.test.ts`.

CONTEXT.md's folded todo already dispositions three of these
(`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`) as
manual-only, "not a bug," since they stall outside the devcontainer and depend
on manual host setup — leaving **21 files** as the automated gate, matching
CONTEXT.md's own count exactly (this research independently confirms the file
count agrees: 24 total minus 3 excluded = 21). The command
`cd .claude/mcp/vice && npm test` runs `node --test '*.test.*'`, which globs
**all 24 files**, including the three that stall — so **the literal command
`npm test` is not, by itself, "the gate that passes unchanged."** The plan
must either (a) change the glob/script to exclude the three named files for
the automated CI/gate path (leaving a separate, documented manual command for
the excluded three), or (b) document precisely that a plain `npm test` run in
this environment is expected to hang on those three files and that the gate is
"the other 21 report green," verified by watching for their completion lines
specifically rather than waiting on the full command to exit. **This research
did not execute `npm test` in this session** — running it here (a container
with no VICE binary and no display) would hit exactly the three
devcontainer-stalling files CONTEXT.md already names, for the same reason;
running it is not "safe and bounded" in this sandbox, matching the phase's own
stated constraint. The planner/executor should run the narrowed command (once
task 1 defines it) on a host that has the excluded three's dependencies, not
in this container.

## Where the Code Goes (Module Layout)

Grounded in `.planning/codebase/ARCHITECTURE.md`'s "single seam per concern"
pattern and this repo's existing precedent of one file per cross-cutting
concern (`vice.ts` for transport, `repo-root.ts` for root resolution,
`container-guard.mts` for container detection). `vice-proxy.ts` is 3,093 lines
/ ~160 KB (confirmed via `wc -l`, this session) and its `tools/call` dispatch
override (`server.getServer().setRequestHandler(CallToolRequestSchema, ...)`,
starting at line 3033) plus its `tools` construction loop (line 3009-3013,
currently `tools[def.name] = buildViceTool(def, (args) =>
forwardToVice(def.name, args));` for every manifest entry not on
`DENY_LIST`) are the two places this phase's dispatch decision must land — and
per D-09, **must not** grow a third place.

Recommended new files, all sibling `.ts` modules under `.claude/mcp/vice/`,
none appended to `vice-proxy.ts`:

- **`stock-protocol.ts`** — the vendored-and-fixed `ViceMonitorClient`
  (renamed from the vendor's own filename to avoid implying it is still that
  exact file), the command/response enums, the demux/related-table/desync-counter
  machinery, and the hand-copied pure constants from `contracts.ts` (no `zod`
  import anywhere in this file).
- **`stock-connect.ts`** — the connect handshake: opens a `stock-protocol.ts`
  client, asserts `api_version === 2`, reads `VICE_INFO` for the version quad,
  gates version-dependent capabilities (`CPUHISTORY_GET` availability) once,
  and wraps reconnect-after-restart in `vice.ts`'s existing
  `MachineRestartedError` per D-11 — this is the one place PROTO-06's "new
  machine, re-handshake" half lives, distinct from `stock-protocol.ts`'s own
  per-socket `#onClose()` (which only ever answers "this socket died," not
  "should the client re-trust a freshly reconnected one").
- **`stock-dispatch.ts`** — the per-tool-name lookup table mapping each stock
  manifest entry to either a direct binmon command (via `stock-protocol.ts`)
  or a client-side derivation function. Consulted by `vice-proxy.ts`'s `tools`
  construction loop in place of the unconditional `forwardToVice()` wiring,
  when the detected/overridden backend is `stock` — with a hard, explicit
  refusal (never a silent fall-through to `forwardToVice()`) for any manifest
  entry this table has no matching handler for, satisfying D-09.
- **`backend-detect.ts`** — the D-01..D-03 probe (mechanism per the
  recommendation above) plus its cache read/write under `.vice-supervisor/`,
  called once by the broker at startup (`vice-broker.mts`'s own init sequence,
  not read in full this session but confirmed to be where `container-guard.mts`'s
  equivalent one-time check already runs, per the architecture doc's "Broker
  daemon... Owns: ... epoch/liveness records").
- **`tools-manifest.stock.json`** — a sibling to the existing, committed
  `tools-manifest.json`, containing only the trimmed stock tool list (D-07).
  `manifestPath()` (`vice-proxy.ts:393-397`) gains a backend-conditional branch
  choosing between the two files, following the exact override pattern
  `VICE_TOOLS_MANIFEST` already establishes for tests.

`vice-proxy.ts` itself needs exactly two edits in this phase: (1) read the
resolved backend once (via one new function, e.g. `activeBackend()`, following
`vice.ts`'s own `mcpHost()` one-reader convention explicitly called out in
CLAUDE.md's Architecture constraint) and pass it into `manifestPath()`'s
selection and the `tools` construction loop's dispatch choice; (2) enrich
`vice_ping`'s stock-path reply with backend/version fields per D-05 (this
becomes one `stock-dispatch.ts` entry, not a `vice-proxy.ts` special case,
since `vice_ping` is an ordinary manifest tool on both backends).

## Work-Stream Decomposition

CONTEXT.md's three-stream split validated against everything read this
session:

- **Stream (a) — protocol client + fixtures.** Files: `stock-protocol.ts`
  (new), `stock-protocol.test.ts` (new), `tests/fixtures/binmon/*` (new).
  Requirements carried: PROTO-01..08, VERIF-02. **No dependency on the broker
  or on backend detection** — the client can be built and fully unit-tested
  against recorded/synthesized frames with zero VICE process involved, exactly
  as `probe-binmon.mjs`'s own `--selftest` mode already proves is possible for
  this wire format.
- **Stream (b) — broker launch flags + single-client ownership.** Files:
  `broker-launch.mts`, `broker-kill.mts`, `broker-state.mts` (edits), plus
  their `resources/*.mjs` rebuild. Requirements carried: BROK-01, BROK-02,
  BROK-03, and the broker half of PROTO-08. **Genuinely independent of stream
  (a)** — none of these files import or reference the binmon wire client at
  all today, and D-13's new ownership bookkeeping (see Broker-Side Changes) is
  pure `InstanceRecord`/control-plane surface area, not wire-protocol code.
  One hidden coupling worth flagging: stream (b)'s D-13 mechanism needs *some*
  signal from whoever opens the real binmon socket (stream a's eventual
  consumer, stream c's connect handshake) — but that signal is a new,
  separately-designed control-plane message, not a shared file or shared
  types. As long as stream (b) defines the *shape* of that signal (e.g., a
  new `op: "monitor_connected"` control request) without needing stream (a)'s
  actual client code to exist yet, the two streams stay decoupled — this is a
  contract-level coupling, not a code-level one, and should be called out
  explicitly in whichever plan owns stream (b) so its author does not block on
  stream (a)'s completion for a detail that does not actually require it.
- **Stream (c) — backend detection/selection + connect handshake.** Files:
  `backend-detect.ts`, `stock-connect.ts`, `stock-dispatch.ts`,
  `tools-manifest.stock.json`, plus the two `vice-proxy.ts` edits above.
  Requirements carried: BACK-01..04. **Genuinely last**, exactly as CONTEXT.md
  states — it consumes stream (a)'s finished client (to actually dial and
  handshake) and stream (b)'s finished launch-flag selection (to know which
  binary the broker actually started, informing what to expect from the
  handshake). No plan should schedule stream (c) in the same wave as either of
  the other two.

**Requirement-ID-to-stream mapping**, for the planner's wave assignment:

| Stream | Requirement IDs |
|---|---|
| (a) | PROTO-01, PROTO-02, PROTO-03, PROTO-04, PROTO-05, PROTO-06 (client half only — the wrapper/`MachineRestartedError` reuse is stream c's), PROTO-07, PROTO-08 (client-observable half only — refusal reporting), VERIF-02 |
| (b) | BROK-01, BROK-02, BROK-03, PROTO-08 (broker-enforcement half) |
| (c) | BACK-01, BACK-02, BACK-03, BACK-04 |

Note PROTO-06 and PROTO-08 each straddle two streams — this is not hidden
coupling in the sense of blocking parallel execution (each stream's *own*
half can be built and tested independently), but the planner should make sure
each requirement's acceptance criteria are split explicitly across the two
plans that jointly satisfy it, so neither plan's task list silently assumes
the other stream already landed the missing half.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| A binary-monitor wire client from scratch | A new framing/correlation/demux implementation | The vendored-and-fixed `henols/c64-debug-mcp` client (D-16) | Its core demux discipline (request-id-first, never type-first) is already correct; re-deriving it risks reintroducing exactly the type-vs-id confusion PROTO-03 exists to prevent |
| A single-client-ownership TCP trick | A client-side connect-retry/backoff heuristic guessing whether a hang means "wedged" or "already owned" | Broker-side bookkeeping (D-13) that refuses a conflicting acquire before a second raw socket is ever attempted | D-13's own text: "No client-side timeout heuristic — that would be a guess on exactly the signal that has no distinguishing shape" |
| A port-liveness/orphan-detection heuristic | A `ps`-based substring-and-numeric-token scan (`discoverBandProcesses()`'s current shape) | The broker's own on-disk/in-memory allocation record (D-15) | Direct history: this exact class of heuristic is the folded todo's whole subject, and D-15's text explicitly frames the fix as "read from its own records," not a smarter heuristic |
| A binary-fixture-loading test framework | A custom binary asset pipeline for the ~157 KB `DISPLAY_GET` fixture | Plain `fs.readFileSync` against a committed `.bin` file, consumed by `node --test` directly | No fixture-loading framework exists or is needed anywhere else in this repo; adding one for a single 157 KB file would be disproportionate |

**Key insight:** every "don't hand-roll" item above is really the same
lesson stated four ways — this codebase already has real, working, cited
precedent for each of these problems (a correct-by-construction demux, a
documented rejection of client-side heuristics for exactly this failure class,
a named incident that motivated retiring a heuristic once already, and a
minimal test-runner convention with zero fixture tooling) — the risk in this
phase is re-deriving a worse version of something that already exists nearby,
not a lack of prior art.

## Common Pitfalls

### Pitfall 1: Treating the vendored client as "mostly done, two bugs to fix"

**What goes wrong:** D-16's text names exactly two defects, which reads like
a small patch. Direct code reading (this session) found the *api_version
byte is never read at all*, not merely unvalidated — a materially larger gap
than "two bugs."
**Why it happens:** the phase-level framing (CONTEXT.md, ROADMAP.md) is
accurate about the two *named* defects but was not written from a full
line-by-line read of the vendor source.
**How to avoid:** budget stream (a) as "build a new module informed by a
correct reference implementation," not "apply a two-line patch to a copied
file."
**Warning signs:** a plan task titled "fix the two vice-protocol.ts defects"
with no separate task for the `zod` dependency strip, the header-comment
authoring, or the api_version read.

### Pitfall 2: Assuming the existing grant/lease mechanism already solves PROTO-08/BROK-02

**What goes wrong:** `GrantRecord` already prevents two container-side
processes from being granted the *same instance*, which looks at first glance
like it already solves "one monitor client per instance." It does not — it
answers a *different* question (who owns this instance's lifecycle), and
nothing today tracks whether the raw binmon TCP socket has actually been
opened by that one legitimate owner.
**Why it happens:** both mechanisms use the word "instance" and both are
about exclusivity, inviting a false equivalence.
**How to avoid:** explicitly design the new signal (see Broker-Side Changes'
open design question) rather than assuming the grant lifecycle already covers
it; write a task that states the *new* control-plane message or field
explicitly.
**Warning signs:** a plan that lists PROTO-08/BROK-02 as satisfied by
"the existing grant mechanism, no code change needed."

### Pitfall 3: Running `npm test` in this container and reading a hang as a regression

**What goes wrong:** the three devcontainer-stalling test files
(`vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`) will
hang in this sandbox regardless of whether Phase 2's changes are correct —
this is a pre-existing, already-dispositioned environment limitation, not a
regression signal.
**Why it happens:** the plain command `npm test` globs all 24 files with no
built-in exclusion; a naive "run the suite, see if it's green" step will
appear to fail/hang for reasons unrelated to the phase's own correctness.
**How to avoid:** define the narrowed 21-file gate command explicitly (see
The BACK-02 Verification Gate section) as its own artifact/script, and never
run the bare `npm test` as this phase's pass/fail signal inside a container
lacking VICE/a display.
**Warning signs:** a verification task that says "run `npm test` and confirm
it passes" with no mention of the three excluded files.

### Pitfall 4: Reproducing the fork's `CHECKPOINT_INFO` flood while building VERIF-02's capture mode

**What goes wrong:** naively reusing Phase 1's exact fire-test shape (a
`stop=1`, full-range exec checkpoint under `RL`/`CY`) to capture case 5's
`CHECKPOINT_LIST` fixture risks reproducing the exact 18-event flood/hung-connection
anomaly Phase 1 already hit on the fork build.
**Why it happens:** it is the only real, already-working example of a
condition-triggered checkpoint fire in this repo's probe history, and it is
tempting to copy it directly for a new capture case.
**How to avoid:** use a narrow, single-address range for any capture-mode
checkpoint, always delete in a `finally`, and cap the number of events read
per capture case — all covered concretely in the VERIF-02 section above.
**Warning signs:** a capture-mode task that copies check 10's exact checkpoint
parameters from `probe-binmon.mjs` verbatim.

## Code Examples

### The two D-16 defects, minimal illustrative fixes

```typescript
// Defect (a) fix sketch — JAM's body is genuinely zero-length; never assume 2 bytes
// Source of the bug: c64-debug-mcp src/vice-protocol.ts:357-358 (read this session)
case ResponseType.Jam:
  return {
    type: "jam",
    requestId,
    errorCode,
    programCounter: body.length >= 2 ? body.readUInt16LE(0) : null,
  };
```

```typescript
// Defect (b) fix sketch — advance past a bad STX instead of throwing;
// increment a desync counter rather than aborting the whole parse.
// Source of the bug: c64-debug-mcp src/vice-protocol.ts:228-231 (read this session)
while (offset + 12 <= buffer.length) {
  if (buffer[offset] !== VICE_STX) {
    offset += 1; // minimum recovery step -- never abandon the buffer unadvanced
    desyncCount += 1;
    continue;
  }
  // ... existing frame-length / body-slice logic, unchanged
}
```

### The already-correct demux ordering worth preserving verbatim

```typescript
// Source: c64-debug-mcp src/vice-protocol.ts:669-681 (read this session) --
// this ordering (id-check BEFORE pending-map lookup) is the entire PROTO-03
// mechanism; do not restructure this to check response TYPE first.
for (const response of responses) {
  this.emit("response", response);
  if (response.requestId === VICE_BROADCAST_REQUEST_ID) {
    this.#applyRuntimeResponse(response);
    this.emit("event", response);
    continue;
  }
  const pending = this.#pending.get(response.requestId);
  if (!pending) {
    this.emit("event", response);
    continue;
  }
  // ... existing CheckpointList related[] accumulation and resolve/reject logic
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `discoverBandProcesses()`'s substring-plus-numeric-token `ps` scan for orphan reap | The broker's own port-allocation record (on-disk instance directories under `stateDir`) as the sole source of "which processes are ours" | This phase, per D-14/D-15 (folded todo `2026-08-12-broker-orphan-reap-substring-identity-match.md`) | Removes a heuristic that could kill an unrelated process merely mentioning a matching-looking port number in its own argv |
| File-based broker request/grant/lease protocol (`resources/vice-broker.sh`-era) | TCP control plane (`broker-control.mts`/`vice-broker-client.ts`), connection-is-the-lease | Already landed before this phase (Phase 01.6.2 series, per file header comments read this session) — Phase 2 extends this existing plane with new message kinds (D-13's ownership signal), it does not replace it | Phase 2 should add to `ControlRequestKind`/`ControlResponse`'s existing five-message vocabulary, not invent a parallel channel |
| `CPUHISTORY_GET`'s availability framed as a compile-time risk | Framed as a VICE-version gate (≥3.10), empirically confirmed in Phase 1 | Phase 1 (this milestone) | Directly informs BACK-04's "determine at connect time" design — the check is a version-quad comparison, not a live probe-and-hope |

**Deprecated/outdated:** nothing in this phase's own domain is deprecated by
this research beyond what Phase 1 already corrected; the vendored client's
`.js`-extension imports and single-quote style are "wrong for this repo," not
"deprecated" in any general sense — they are simply a different, valid
convention this repo does not use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stock VICE's argument parser rejects an unrecognized flag (e.g. `-mcpserver`) with a non-zero exit rather than silently ignoring it | Backend Detection Probe | A trial-launch-based probe mechanism would misclassify stock as "unknown" rather than "stock," since the expected failure signal never arrives; mitigated by recommending `--help` introspection instead, which does not depend on this claim |
| A2 | A file's `mtimeMs` is a sufficient replaced-in-place signal for the backend-detection cache key, alongside path and version quad | Backend Detection Probe | A `touch -r`-preserved-timestamp binary swap would defeat the cache invalidation, silently serving a stale detection result against a genuinely different binary; low-likelihood in practice (this is not an adversarial-attacker scenario) but not zero |
| A3 | The fork's binary-monitor implementation is unmodified from stock upstream for the specific opcodes this phase's connect handshake exercises (`PING`, `VICE_INFO`) | (inherited from Phase 1's own A1, not re-verified this session) | If the fork *does* patch these paths, a connect-handshake design validated against the fork build (the only ≥3.10-vintage binary Phase 1 had access to) could behave differently against a genuine stock 3.10 release |
| A4 | Reusing `vice.ts`'s existing `MachineRestartedError` (rather than a new stock-specific error type) is sufficient for PROTO-06's "new machine, re-handshake" half | Where the Code Goes / stock-connect.ts | D-11 states this explicitly as a locked decision, not merely a research recommendation — flagged here only because this research did not verify that `MachineRestartedError`'s existing fields (`baselineEpoch`/`currentEpoch`/`where`/`lastToolCall`) are semantically sufficient for a stock-path epoch model that has no `epoch.json` file equivalent yet (that file is a broker-launch-side artifact, not something the stock binmon connection itself produces) |

## Open Questions

1. **How does the container-side client actually inform the broker "the binmon
   socket is now open," for D-13's ownership flag?**
   - What we know: the existing control plane (`broker-control.mts`) already
     has a five-message vocabulary (`acquire`/`release`/`recycle`/`status`/`host_state`)
     and an established pattern for adding a sixth (each is a plain
     newline-delimited JSON op, gated by the same token check).
   - What's unclear: whether this needs a genuinely new op, or whether it can
     ride an existing one (e.g., folding a `monitor_connected: true` flag into
     an existing `acquire` response cycle is not obviously possible, since
     the acquire happens *before* the client has dialled the binmon port at
     all — the two events are not simultaneous).
   - Recommendation: treat this as its own small design task inside stream
     (b)'s plan, informed by (but not blocked on) stream (c)'s eventual
     connect-handshake code, per the Work-Stream Decomposition section's
     "contract-level, not code-level" coupling note.

2. **Does `-mcpserver` even need testing for backend detection, or does
   `-binarymonitor` support alone (already common to both) make the
   `--help`-string-match approach the only mechanism actually needed?**
   - What we know: D-02 establishes both binaries accept `-binarymonitor`;
     the fork additionally accepts `-mcpserver`, stock does not.
   - What's unclear: whether `--help`'s flag-listing output reliably lists
     `-mcpserver` as a *recognized* flag name-string on the fork and omits it
     on stock (this research did not run `--help` against either binary in
     this session, per the Backend Detection Probe section's own caveat).
   - Recommendation: verify empirically on a host with both binaries (per
     Phase 1's confirmed dual-build environment) before locking the mechanism
     in the plan.

## Environment Availability

| Dependency | Required By | Available (this session's container) | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stock `x64sc` | Empirical verification of the backend-detection probe, VERIF-02 real captures | ✗ (no VICE binary present in this sandbox — confirmed via `command -v x64sc`) | — | Phase 1's already-recorded probe output and Phase 1's confirmed dual-build host environment; new capture work must run on that host, not in this container |
| Fork `x64sc` | Same as above | ✗ | — | Same fallback |
| Display (X11/Wayland) | Launching either build for a real capture session | ✗ (this sandbox is headless/containerized) | — | Same fallback |
| Node.js | Running the vendored/fixed client's own tests, `probe-binmon.mjs` capture-mode extension | ✓ | Not independently re-checked this session; Phase 1 confirmed v22.22.0 on the host | — |
| `henols/c64-debug-mcp` source | D-16's vendoring source | ✓ — found locally at `/home/henrik/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts`, read in full this session | v1.0.14 (package.json) | GitHub (`github.com/henols/c64-debug-mcp`) as a second source, not needed since the local copy was available and readable |

**Missing dependencies with no fallback:** none — every missing dependency
above has an explicit fallback (Phase 1's already-recorded host environment).
**Missing dependencies with fallback:** real VICE binaries, a display, and any
new live-capture work all require the researcher/executor's own host (already
proven available and dual-versioned per Phase 1), not this repo's container.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` |
| Config file | none — `package.json:58`'s script glob (`'*.test.*'`) is the only configuration |
| Quick run command | `cd .claude/mcp/vice && node --test stock-protocol.test.ts` (per-file, once the new module exists) |
| Full suite command | `cd .claude/mcp/vice && npm test` — **but see The BACK-02 Verification Gate section**: this globs all 24 files including the 3 devcontainer-stalling ones; the phase needs its own narrowed command for the automated gate, not the bare `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROTO-01 | Reassembles across arbitrary chunk boundaries | unit | `node --test stock-protocol.test.ts -- --test-name-pattern="byte-at-a-time"` | ❌ Wave 0 |
| PROTO-02 | Correlates by request id under concurrent in-flight commands | unit | same file, `--test-name-pattern="correlat"` | ❌ Wave 0 |
| PROTO-03 | Never resolves a pending request with an event, incl. shared-response-type case | unit | same file, `--test-name-pattern="demux\|event"` | ❌ Wave 0 |
| PROTO-04 | Zero-length JAM handled without throwing/desyncing | unit | same file, `--test-name-pattern="jam"` | ❌ Wave 0 |
| PROTO-05 | Protocol error surfaced distinguishably | unit | same file, `--test-name-pattern="error.*code\|protocol.*error"` | ❌ Wave 0 |
| PROTO-06 | Died/restarted-underneath distinct from timeout | unit (client half) + integration (epoch-reuse half) | same file for the client half; a `stock-connect.test.ts` for the `MachineRestartedError` reuse | ❌ Wave 0 (both files) |
| PROTO-07 | Full ~157 KB `DISPLAY_GET` without truncation | unit | same file, `--test-name-pattern="display.*get\|157"` | ❌ Wave 0 |
| PROTO-08 | Second client refused/reported, not diagnosed as wedge | integration (broker half) + unit (client-observable half) | `broker-control.test.ts` extension + `stock-connect.test.ts` | ❌ Wave 0 (extension to an existing file, plus a new one) |
| BROK-01 | Broker launches stock/fork by backend | unit | `broker-launch.test.ts` extension | ❌ Wave 0 (extension) |
| BROK-02 | One monitor client per instance | integration | `broker-control.test.ts` extension | ❌ Wave 0 (extension) |
| BROK-03 | Existing guarantees survive | regression | the narrowed 21-file gate command (see Validation Gate section) | Exists already, needs the narrowed script |
| BACK-01..04 | Config-driven backend switch, version-gated capability detection | unit + manual | `backend-detect.test.ts` (cache logic, unit-testable without a real binary) + manual verification against Phase 1's confirmed dual-build host for the actual probe mechanism | ❌ Wave 0 (new file) |
| VERIF-02 | Client survives all 8 named fixture cases | unit | `stock-protocol.test.ts`, one test per named case | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific `--test-name-pattern`-scoped run for the
  requirement(s) that task addresses.
- **Per wave merge:** the full new-file set (`node --test stock-protocol.test.ts
  stock-connect.test.ts backend-detect.test.ts`) plus every *extended*
  existing file (`broker-launch.test.ts`, `broker-control.test.ts`), plus the
  narrowed 21-file regression gate for BROK-03/BACK-02.
- **Phase gate:** the narrowed 21-file command green, plus every new
  `*.test.ts` file green, before `/gsd-verify-work`. The bare `npm test`
  command is never the phase gate in this container.

### Wave 0 Gaps
- [ ] `stock-protocol.test.ts` — does not exist; covers PROTO-01..08, VERIF-02
- [ ] `stock-connect.test.ts` — does not exist; covers the PROTO-06/PROTO-08
  wrapper-level halves and the `MachineRestartedError` reuse
- [ ] `backend-detect.test.ts` — does not exist; covers BACK-01..04's cache
  logic (the actual VICE-binary-dependent probe mechanism itself needs manual
  verification against a real host per the Environment Availability section)
- [ ] `tests/fixtures/binmon/` (or equivalent) — does not exist; the 8 named
  VERIF-02 fixtures need to be captured/synthesized before `stock-protocol.test.ts`
  can consume them
- [ ] A narrowed test-runner script (e.g. `npm run test:automated`) excluding
  the 3 devcontainer-stalling files — does not exist; required before BACK-02/
  BROK-03's "existing suite passes unchanged" criterion is mechanically
  checkable rather than manually asserted

## Security Domain

`security_enforcement` is enabled, `security_asvs_level: 1`
(`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No end-user auth surface introduced |
| V3 Session Management | Marginal | The binmon TCP connection is itself session-shaped ("the connection is the lease," matching this project's existing control-plane pattern) but carries no credential of its own — VICE's binary monitor has no auth by design; this phase's own D-13 ownership mechanism is the closest thing to a session-exclusivity control, and it is broker-side bookkeeping, not a security boundary against a hostile actor |
| V4 Access Control | Marginal | Single-client enforcement (BROK-02/PROTO-08) is an availability/correctness control ("don't confuse a second client with a wedge"), not an access-control boundary — anything on the same host network segment as the emulator's binmon port can still dial it directly, bypassing the broker entirely; this is an accepted, already-documented posture (QUAL-03, "network exposure of the emulator control plane," explicitly deferred out of this milestone per `.planning/STATE.md`) |
| V5 Input Validation | Yes | The new protocol client parses untrusted-shaped bytes off a TCP socket (the emulator's own replies are "trusted" in the sense of coming from a process this broker itself spawned, but the wire bytes must still be defensively parsed against malformed/truncated frames — exactly what PROTO-01/PROTO-04/the desync-recovery fix are about) |
| V6 Cryptography | No | No new cryptographic surface; the binmon connection is unauthenticated and unencrypted by VICE's own design, an already-accepted, already-deferred posture (QUAL-03) this phase does not change |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Malformed/truncated binmon frame (accidental, from a crashing emulator, or a genuinely desynced stream) causing an unhandled exception that crashes the container-side MCP process | Denial of Service | The defensive parsing fixes this research specifies (Defect a/b fixes, the desync counter, a max-body-length guard following `probe-binmon.mjs`'s own precedent) |
| A second, unrelated local process on the same host connecting directly to the emulator's binmon port, outside this codebase's own broker/client entirely | Denial of Service (against the legitimate client, via VICE's "exactly one serviced client" limitation) | Cannot be prevented at the wire level (VICE itself has no auth); BROK-02/PROTO-08's mitigation is scoped to *this codebase's own* clients never racing each other, and to reporting the resulting hang/refusal accurately rather than misdiagnosing it — not to preventing an out-of-band actor from dialling the port at all (out of scope, QUAL-03) |
| A stale/leaked non-stopping checkpoint left armed after a probe/capture session crashes mid-flight (exactly what Phase 1's own "probe defect that prolonged the failure" describes) | Denial of Service (against the emulator instance's own future usability) | `finally`-block cleanup, already established as this repo's own convention after Phase 1's incident; the VERIF-02 capture-mode extension must follow the same discipline, per the Common Pitfalls section |

## Sources

### Primary (HIGH confidence — direct file reads, this session)
- `/home/henrik/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts` — full text, 747 lines
- `/home/henrik/dev/henrik/git/c64-debug-mcp/src/contracts.ts` — full text, 208 lines
- `/home/henrik/dev/henrik/git/c64-debug-mcp/src/errors.ts` — full text, 173 lines
- `/home/henrik/dev/henrik/git/c64-debug-mcp/package.json`, `LICENSE` — targeted read (version, license, author)
- `.claude/mcp/vice/broker-launch.mts` — full text, 894 lines
- `.claude/mcp/vice/broker-kill.mts` — full text, 638 lines
- `.claude/mcp/vice/broker-control.mts` — full text, 516 lines
- `.claude/mcp/vice/broker-state.mts` — full text, 366 lines
- `.claude/mcp/vice/vice-broker-client.ts` — full text, 900 lines
- `.claude/mcp/vice/vice-proxy.ts` — targeted reads (manifest loading ~380-440, tools/call dispatch ~2990-3090, `vice_ping` occurrences); full file confirmed 3,093 lines via `wc -l`
- `.claude/mcp/vice/vice.ts` — targeted reads (`MachineRestartedError`, `mcpHost()`, `DENY_LIST`, `ToolInfo`); full file confirmed 772 lines via `wc -l`
- `.claude/mcp/vice/probe-binmon.mjs` — targeted read (header, command table, `MAX_BODY_LEN`); full file confirmed 1,000 lines via `wc -l`
- `.claude/mcp/vice/tools-manifest.json` — targeted read (shape confirmation); full file confirmed 1,231 lines via `wc -l`
- `.claude/mcp/vice/package.json` — full text (dependencies, test script)
- `docs/phase0-binmon-findings.md`, `docs/phase1-probe-results.md`, `docs/stock-vice-parity.md` — full text
- `.planning/phases/02-stock-backend-connection/02-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` — full text
- `.planning/phases/01-corrected-ground-truth/01-RESEARCH.md`, `.planning/codebase/ARCHITECTURE.md` — full text
- `.planning/config.json` — full text (workflow flags)
- Live environment checks this session: `find`/`ls` for the vendor source location, `wc -l` on all six named large files, `grep`-based structural confirmation of `VICE_BACKEND`'s absence, `discoverBandProcesses()`'s line number, `handleAcquire`/`selectWarmInstance` locations, test-file inventory via `ls *.test.*`

### Secondary (MEDIUM confidence)
- None — every claim in this research traces to a primary source read in this
  session; where a claim could not be verified this way (the two Assumptions
  Log items on `--help` output and `mtimeMs` sufficiency), it is tagged
  `[ASSUMED]` rather than presented as sourced.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Vendored client's actual structure, defects, and dependency chain: HIGH —
  read in full, this session, cross-checked line-by-line against this
  project's own normative protocol facts.
- Broker code (launch/kill/control/state/client): HIGH — all five files read
  in full, this session; the one genuinely new design surface (D-13's
  ownership signal) is honestly flagged as an open design question, not
  presented as a discovered pattern.
- Backend-detection mechanism recommendation: MEDIUM — reasoned from D-01/D-02's
  own text and this project's `inFlight`-guard constraint, but the underlying
  "what does an unknown flag actually do on each binary" fact is `[ASSUMED]`,
  not verified in this session (no VICE binary available in this sandbox).
- VERIF-02 fixture strategy: HIGH for which cases are capturable vs. must be
  synthesized (grounded directly in Phase 1's own already-recorded probe
  results and this project's own normative "healthy VICE never emits X"
  claims); MEDIUM for the exact fixture-storage convention, since no existing
  precedent for binary test fixtures was found in this repo.

**Research date:** 2026-08-12
**Valid until:** Through Phase 2's completion. The one time-sensitive claim
worth re-checking if this research is reused for a later phase: the
vendor source's own version (read at v1.0.14 this session) may have moved on
if `henols/c64-debug-mcp` receives further commits before Phase 2 actually
lands — re-diff before vendoring if significant time has passed.
