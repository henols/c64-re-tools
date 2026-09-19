# Phase 63: The Monitor Channel Relayed, and the Connection as the Session - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 9 (7 EDIT, 2 likely-NEW test files, 1 possible-NEW splice module)
**Analogs found:** 9 / 9 (every file has at least a partial analog; two constructs — the `attach(socket)` seam and the broker-side host-bound incident writer — have **no analog anywhere in this tree**, flagged explicitly below)

No `63-CONTEXT.md` exists. File list and shape below are taken from `63-RESEARCH.md`'s "Recommended Project Structure" and Architecture Patterns, cross-checked against `63-VALIDATION.md`'s Wave 0 gaps and the ROADMAP Phase 63 section.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/mcp/vice/stock-connect.ts` (EDIT) | service (handshake orchestrator) | request-response → then byte-stream hand-off | itself (`stockConnect()`, already read in full below) | exact — edit-in-place, single call site changes |
| `src/mcp/vice/text-connect.ts` (EDIT) | service (handshake orchestrator) | request-response → then byte-stream hand-off | `stock-connect.ts`'s `stockConnect()` (near-identical claim-then-dial shape, deliberately mirrored) | exact |
| `src/mcp/vice/stock-protocol.ts` (EDIT — new `attach(socket)`) | service (protocol/framing) | streaming (byte-transparent demux) | itself, `ViceMonitorClient.connect()` (lines 2038-2093) | role-match — same class, new entry point, no existing socket-injection seam anywhere to copy from |
| `src/mcp/vice/text-protocol.ts` (EDIT — new `attach(socket)`) | service (protocol/framing) | streaming | `stock-protocol.ts`'s `ViceMonitorClient.connect()` (deliberately mirrored, `text-protocol.ts:787-840` already mirrors it) | role-match — same absence of an injection seam |
| `src/mcp/vice/broker-control.mts` (EDIT — new `attach` op, Buffer-mode splice) | middleware (host control-plane dispatch) | event-driven (socket lifecycle) + streaming (post-handshake) | itself, `attachControlProtocol()`'s `hello`/`monitor_claim` dispatch (lines 737-1110) | exact for the JSON-handshake half; **no analog** for the string→Buffer mode switch (new ground, see below) |
| `src/mcp/vice/vice-broker.mts` (EDIT — splice + reclaim wiring) | service (host broker core) | event-driven (socket close/error) | itself, `handleRelease()` (lines 1117-1150) | exact — this phase generalizes this function's shape, does not replace it |
| `src/mcp/vice/broker-home.mts` (EDIT — wire only) | config/utility (path resolver) | n/a (pure path computation) | itself, `brokerIncidentsDir()` (lines 127-133) — already correct, just unwired | exact |
| `src/mcp/vice/incident-record.ts` (POSSIBLE EXTEND) | utility (atomic writer) | file-I/O | itself, `writeIncidentRecord()`/`writeAtomic()` (lines 45-48, 347-378) | role-match — logic is host-agnostic but `incidentsDir()` is hardcoded, not parameterized (see Open Question 3 note below) |
| **NEW** `src/mcp/vice/broker-relay.test.ts` (or similar name) | test | integration (synthetic loopback lifecycle matrix) | `stock-protocol.test.ts`'s `withStubNetServer()` (lines 540-567) — **a real-socket harness, not `stock-run-until.ts`** (correction below) | role-match, strong |
| **NEW** cases in `src/mcp/vice/broker-control.test.ts` (attach op, status identity fields) | test | unit/integration | `broker-endpoint.test.ts` (real listener + real dial + handshake assertions, lines 1-30) | exact |
| **NEW** live, default-SKIP byte-transparency test (`stock-*-live.test.ts` family) | test | live/manual | `stock-live-broker-monitor.test.ts`'s skip guard (lines 137-150) | exact |
| Possible **NEW** `src/mcp/vice/broker-splice.mts` (if the splice logic is factored out, per RESEARCH's "plausible" note) | service (host, new module) | streaming | no analog — new ground, see below | none |

## Pattern Assignments

### `src/mcp/vice/stock-connect.ts` (service, request-response → streaming)

**Analog:** itself — the ONE call site that changes is inside the existing `stockConnect()`.

**The exact line to change** (`stock-connect.ts:430`, inside the function starting at `stock-connect.ts:405`):
```typescript
const client = new ViceMonitorClient();
let resumeAttempted = false;

try {
  await client.connect(host, port);   // <-- TODAY: direct dial to the emulator's own port
  // ...
```
Everything else in `stockConnect()` — the `claimMonitor()` call BEFORE any socket opens (lines 406-420), the try/catch cleanup ordering, the failure-path release discipline (lines 465-493) — stays byte-identical. Only the one `client.connect(host, port)` line becomes something like:
```typescript
const relaySocket = await dialAndAttachRelay({ targetId, channel: "binary", brokerControl /* or a fixed-endpoint dialer */ });
await client.attach(relaySocket);   // NEW entry point on ViceMonitorClient — see stock-protocol.ts below
```

**Imports pattern** (`stock-connect.ts:33-52`) — relative paths with explicit `.ts`/`.mts` extensions, named imports only, no default export, `import type` never mixed with value imports in the same specifier list:
```typescript
import {
  ViceMonitorClient,
  CommandType,
  ErrorCode,
  StockProtocolError,
  StockFramingError,
  StockDesyncError,
  StockResponseMismatchError,
  StockConnectionClosedError,
  StockRequestTimeoutError,
} from "./stock-protocol.ts";
import { readCapabilityRecord, writeCapabilityRecord, type CapabilityDeps } from "./backend-detect.mts";
import { MachineRestartedError, ViceError, readEpoch, type EpochResult } from "./vice-errors.ts";
```

**Claim-before-dial pattern** (`stock-connect.ts:405-420`) — copy verbatim for the relay dial's own ordering discipline (claim/attach must precede any byte exchange the same way):
```typescript
const claimOutcome = await brokerControl.claimMonitor({ targetId, channel: "binary" });
if (!claimOutcome.ok) {
  if (claimOutcome.reason === "monitor_owned") {
    throw new MonitorOwnershipError(/* ... names the holder ... */);
  }
  throw new ViceError(`stockConnect: monitor claim for target ${targetId} failed (${claimOutcome.reason})`, { code: claimOutcome.reason });
}
```

**Error-handling / cleanup pattern** (`stock-connect.ts:465-493`) — every failure path best-effort-resumes the machine, disconnects, and releases the claim WITHOUT letting the release's own outcome displace the original error (`WR-07`):
```typescript
} catch (err) {
  if (!resumeAttempted) await safeResume(client);
  await safeDisconnect(client);
  try {
    const released = await brokerControl.releaseMonitor({ targetId, channel: "binary" });
    if (!released.ok) {
      console.error(`stockConnect: monitor release for target ${targetId} after a failed handshake was refused (${released.reason}) -- the instance may still be claimed`);
    }
  } catch (releaseErr) {
    console.error(`stockConnect: monitor release for target ${targetId} after a failed handshake threw: ${String(releaseErr)}`);
  }
  throw err;
}
```
Apply the SAME never-displace discipline to any new relay-teardown step this phase adds.

**Module header convention to imitate** (`stock-connect.ts:1-32`) — states WHY the file exists, names the seam it sits between, and has a "WHAT NOT TO DO" block naming the past mistake. A new relay-dial addition to this file (or its sibling) should extend this header, not add a second one.

---

### `src/mcp/vice/text-connect.ts` (service, request-response → streaming)

**Analog:** `stock-connect.ts`'s `stockConnect()`, deliberately mirrored already.

**The exact line to change** (`text-connect.ts:128`, inside `textConnect()` starting at `text-connect.ts:96`):
```typescript
const client = new TextMonitorClient();
try {
  await client.connect(host, remoteMonitorPort, connectTimeoutMs !== undefined ? { timeoutMs: connectTimeoutMs } : {});
  return { client, host, port: remoteMonitorPort, targetId, brokerControl };
```
becomes an `attach(socket)` call after dialling/claiming the relay, mirroring `stockConnect()`'s edit exactly.

**Load-bearing constraint this file's own header states and this phase must preserve** (`text-connect.ts:24-29`):
```
//   - Never build a textReconnect(). Per RESEARCH.md's Open Question 2, an
//     unexpected text-socket close is treated as FATAL for the session, not
//     something to silently reconnect...
```
Any relay-death policy for the text channel must fail the session outright — do NOT give the text relay connection a `stockReconnect()`-style retry. The binary channel's relay MAY retry-with-identity-check (mirroring `stockReconnect()`, `stock-connect.ts:535-550`); the text channel must not. This asymmetry is Pitfall 7 in RESEARCH.md — treat it as binding.

**Claim pattern with explicit channel** (`text-connect.ts:109-124`) — same shape as `stock-connect.ts`, `channel: "text"` instead of `"binary"`, copy verbatim for the relay-claim step.

---

### `src/mcp/vice/stock-protocol.ts` (service/protocol, streaming) — new `attach(socket)` entry point

**Analog:** itself. `ViceMonitorClient.connect()` (`stock-protocol.ts:2038-2093`) is the ONLY existing code that wires a socket's three listeners (`data`/`close`/`error`) to this class's private state. There is **no existing socket-injection seam anywhere in this class or its sibling `TextMonitorClient`** — confirmed by RESEARCH's own exhaustive read (Assumption A2, "Low risk — verified by reading both classes' `connect()` methods in full"). This is new ground; the closest analog is the class's OWN wiring, to be factored so a pre-connected socket can reuse it.

**The exact wiring to preserve, factored into a shared private helper** (`stock-protocol.ts:2055-2093`):
```typescript
return new Promise((resolve, reject) => {
  const socket = net.createConnection({ host, port });

  const onConnect = () => {
    clearTimeout(timer);
    socket.removeListener("error", onConnectError);
    this.#socket = socket;
    this.#buffer = Buffer.alloc(0);
    this.#port = port;
    this.#closed = false;
    socket.on("data", this.#onDataBound);
    socket.on("close", this.#onCloseBound);
    socket.on("error", this.#onErrorBound);
    resolve();
  };
  // ... connect-timeout race, WR-13(a)/(b) guards against a live socket
  // being silently overwritten and against destroy()'s own 'error' going
  // unhandled ...
});
```
`connect(host, port)`'s existing "refuse to connect over a socket that is still live" guard (`stock-protocol.ts:2047-2053`, the `WR-13(b)` fix) must extend to `attach(socket)` too — the same one-client invariant applies whether the socket was dialled here or handed in already-connected. The new `attach(socket)`'s body is essentially lines 2061-2067 verbatim (skip the `net.createConnection`/connect-timeout race entirely, since the caller already has a live socket), reusing `#onDataBound`/`#onCloseBound`/`#onErrorBound` unchanged — this is the concrete form of RESEARCH's own recommendation ("reuses every byte of the existing data/close/error wiring unchanged").

**`connected` getter to reuse unmodified** (`stock-protocol.ts:2010-2012`):
```typescript
get connected(): boolean {
  return this.#socket != null && !this.#socket.destroyed;
}
```

**D-11 boundary to respect** (`stock-protocol.ts:1983-1987`) — this class answers "this socket died" only, never "is this the same machine." Do not let `attach()` grow any reconnect-identity logic; that stays one layer up in `stock-connect.ts`.

---

### `src/mcp/vice/text-protocol.ts` (service/protocol, streaming) — new `attach(socket)` entry point

**Analog:** `stock-protocol.ts`'s `ViceMonitorClient.connect()`, already deliberately mirrored by this class's own `connect()` (`text-protocol.ts:787-840`) — same `WR-13(a)/(b)` guards, same three-listener wiring, one difference (D-13(a), line 814-816): resolves immediately on connect with NO banner read (stock's text monitor sends zero bytes on connect). The new `attach(socket)` should resolve equally immediately once listeners are wired — no additional handshake read.

**Carried debt to flag, not fix, if this file is touched** (`text-protocol.ts:850`, inside `command()`):
```typescript
command(cmd: string, _opts: TextCommandOptions = {}): Promise<string> {
```
`_opts.timeoutMs` is declared (`TextCommandOptions.timeoutMs`, `text-protocol.ts:729,733`) but never read inside `command()` — this is `CR-01`, explicitly named in RESEARCH.md and the ROADMAP as carried debt, OUT OF SCOPE for Phase 63. If a plan's diff touches this line for an unrelated reason, the plan must say so explicitly rather than silently "fixing" it.

**Channel-lock gate to preserve untouched** (`text-protocol.ts:876-887`) — `command()` refuses to send unless `currentChannelLockHolder()` names the `"text"` channel. This has nothing to do with the relay attach point and must not be touched by this phase; it is cited here only so a planner does not confuse it with the socket-source change.

---

### `src/mcp/vice/broker-control.mts` (middleware, event-driven + streaming) — new `attach` op

**Analog:** itself, `attachControlProtocol()` (`broker-control.mts:737-1110`).

**The close-is-release pattern to EXTEND, not reinvent** (`broker-control.mts:756-766`) — this is the mechanism SESS-03 already provides for the control connection; wire the identical shape onto the new relay-connection acceptor:
```typescript
socket.on("close", () => {
  // Connection close IS the release -- including on the client's own
  // SIGKILL, since "close" always fires either way. Idempotent: an
  // explicit `release` already having cleared
  // requestIdForThisConnection makes this a no-op.
  if (requestIdForThisConnection) {
    const id = requestIdForThisConnection;
    requestIdForThisConnection = null;
    opts.onRelease(id);
  }
});
```

**The `hello` dispatch to extend for the relay tag** (`broker-control.mts:917-926`) — currently a pure echo, no state, answered BEFORE the token gate (D-06, ENDPOINT-03):
```typescript
if (req.op === "hello") {
  const tag = typeof req.tag === "string" && req.tag !== "" ? req.tag : "control";
  writeLine(socket, {
    kind: "hello",
    protocol: HELLO_PROTOCOL_MAGIC,
    version: opts.helloVersion ?? resolveBrokerVersion(),
    tag,
  });
  return;
}
```
Pitfall 2 (RESEARCH.md) is explicit: this tag does NOTHING beyond the echo today. Adding meaning to `tag: "monitor-binary"`/`"monitor-text"` AND adding the follow-on `attach` op are both new work, not "already there."

**The ownership-check pattern every target-naming op must reuse** (`broker-control.mts:796-798`, `ownsTarget()`) — the new `attach` op must gate on this SAME predicate, never trust a bare `target_id`:
```typescript
function ownsTarget(targetId: string): boolean {
  return requestIdForThisConnection !== null && targetId === requestIdForThisConnection;
}
```
Note this predicate is scoped to `requestIdForThisConnection` — the control connection's OWN grant id. A relay connection is a SEPARATE socket/connection from the control connection that claimed the monitor, so the attach op's ownership check needs the grant id to travel WITH the attach request (the client already knows its own `targetId`/grant from its control-plane session) — this is new plumbing, not a direct copy-paste of `ownsTarget()`'s closure variable, though the CHECK ITSELF (compare against the caller-claimed identity, never trust the bare field) is the pattern to copy.

**The `monitor_claim` op's dispatch shape to copy for `attach`** (`broker-control.mts:1041-1087`) — same skeleton: read `target_id`, reject empty, check ownership, resolve `channel`, reject unrecognised channel BY NAME, call the callback, branch on the discriminated outcome:
```typescript
} else if (req.op === "monitor_claim") {
  const targetId = typeof req.target_id === "string" ? req.target_id : "";
  if (targetId === "") { writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "monitor_claim requires target_id" }); return; }
  if (!ownsTarget(targetId)) { writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL }); return; }
  const channel = resolveMonitorChannel(req.channel);
  if (channel === "bad_request") { /* refuse by name, echo the bad value */ return; }
  const outcome = opts.onMonitorClaim(requestId, targetId, channel);
  if (outcome.ok) { writeLine(socket, { kind: "monitor_claimed" }); }
  else if (outcome.code === "monitor_owned") { /* names the holder AND channel */ }
  else { /* generic outcome.code error */ }
}
```

**`StatusInstanceEntry` — the shape SESS-06 must extend** (`broker-control.mts:159-173`):
```typescript
export interface StatusInstanceEntry {
  port: number;
  url: string;
  state: string;
  reason: string;
  epoch: number | null;
  hasMonitorClient: boolean;
}
```
Zero identity fields today. SESS-06 needs to add something like `sessionId`/`tag`/`grantId` here — follow this interface's own documentation convention (a JSDoc block per field stating what it means and where it's computed from, as `hasMonitorClient`'s own comment does).

**Buffer-mode discipline — NO ANALOG, new ground** (`broker-control.mts:742-743`):
```typescript
socket.on("data", (chunk: Buffer) => {
  buffer += chunk.toString("utf8");
  ...
```
Every existing op is JSON-line, string-mode, by construction. There is nothing in this file (or anywhere else in this tree) that switches a socket from string-line mode to raw-Buffer mode mid-stream. This is new code, not a copy: design the attach socket so its first bytes are a single ASCII JSON line terminated by exactly one `\n` (found via a Buffer-aware `indexOf(0x0a)` — NOT `chunk.toString("utf8")` first), and any bytes after that `\n` — including ones that arrive in the SAME `"data"` event as the handshake line — must be captured as a raw `Buffer` and handed to the splice, never decoded as a string. `63-VALIDATION.md`'s own byte-mode discipline note ("every transparency assertion compares Buffer contents, never strings") is the test-side mirror of this same constraint.

**Module-header convention to imitate** (`broker-control.mts:1-77` area, and the `hello` op's own comment at 904-916) — every new branch in this dispatcher needs prose stating WHY it is answered where it is (pre-gate vs. post-gate) and what it must never do, matching this file's existing style exactly.

**`.mts` build obligation** — this file compiles to `resources/broker-control.mjs` (`build.ts:50`, `HOST_BOUND_ARTIFACTS`). Any edit here MUST ship its rebuilt `resources/broker-control.mjs` in the same commit or `resources-sync.test.ts` fails CI (Pitfall 5).

---

### `src/mcp/vice/vice-broker.mts` (service, event-driven) — reclaim + splice wiring

**Analog:** itself, `handleRelease()` (`vice-broker.mts:1117-1150`) — the identity-verified-kill this phase generalizes rather than reinvents:
```typescript
export function handleRelease(requestId: string, state: BrokerState): void {
  const grant = state.grants.get(requestId);
  if (!grant) return;
  const instance = state.instances.get(grant.port);

  if (instance && instance.pid === grant.pid) {
    markDeliberateDeath(instance, false);
    clearMonitorClient(instance);
    state.grants.delete(requestId);
    deleteInstanceRecord(state, grant.port);
    verifiedKill({ pid: instance.pid, expectedIdentity: instance.expectedIdentity }).catch(() => {
      // best-effort; nothing further to report on this path this task
    });
    return;
  }
  // Stale/orphaned grant: bookkeeping retired, mismatched occupant left untouched, logged distinctly.
  ...
}
```
This pid-match-before-kill discipline is the one to reuse for the relay-connection reclaim path — never a blind `process.kill(pid)`.

**No analog for:** the actual byte splice (`clientRelaySocket <-> emulatorSocket`) or `Socket.setTimeout()`-based idle detection — RESEARCH's own "Standard Stack" table confirms zero existing uses of `Socket.setKeepAlive`/`Socket.setTimeout`/`.pipe()`-as-a-splice anywhere in `src/mcp/vice/`. This is genuinely new code; `.pipe()` is the stdlib primitive to use directly (Don't Hand-Roll table), not a hand-rolled copy loop, but there is no in-tree splice to copy the shape from.

**`.mts` build obligation** — compiles to `resources/vice-broker.mjs` (`build.ts:44`). Same rebuild-and-commit rule as above.

---

### `src/mcp/vice/broker-home.mts` (config/utility) — wiring `brokerIncidentsDir()`

**Analog:** itself — the function already exists and is already correct, just unwired:
```typescript
// broker-home.mts:127-133
export function brokerIncidentsDir(opts: BrokerHomeOptions = {}): string {
  const env = resolveEnv(opts);
  if (env.VICE_INCIDENTS_DIR) return resolve(env.VICE_INCIDENTS_DIR);
  return join(brokerHome(opts), "incidents");
}
```
No production module calls this yet (RESEARCH, verified by exhaustive grep). Phase 63 gives it its first real caller: the new broker-side SESS-05 incident writer.

**`.mts` build obligation** — compiles to `resources/broker-home.mjs` (`build.ts:55`).

---

### `src/mcp/vice/incident-record.ts` (utility, file-I/O) — possible extension for SESS-05

**Analog:** itself, `writeIncidentRecord()`/`writeAtomic()` (`incident-record.ts:45-48, 347-378`).

**The exact hardcoding that blocks reuse from a host-bound `.mts` module today:**
```typescript
// incidentsDir() -- NOT parameterized, called internally by writeAtomic()
// and writeIncidentRecord() with no override:
export function incidentsDir(): string {
  if (process.env.VICE_INCIDENTS_DIR) return resolve(process.env.VICE_INCIDENTS_DIR);
  return join(toolsDir(), "incidents");   // <-- toolsDir() is PER-PROJECT, wrong for a machine-level broker
}

function writeAtomic(path: string, content: string): string {
  mkdirSync(incidentsDir(), { recursive: true });   // <-- hardcoded call, not a parameter
  ...
}

export function writeIncidentRecord(record: IncidentRecordInput = {}): string {
  mkdirSync(incidentsDir(), { recursive: true });   // <-- same
  ...
}
```
This confirms RESEARCH's Open Question 3 exactly: `renderIncidentRecord()` itself has zero `.mts`-incompatible dependencies (only `node:fs`/`node:crypto`/`node:path` + `toolsDir()`), but `writeAtomic()`/`writeIncidentRecord()` call the module's OWN `incidentsDir()` internally rather than accepting a directory as a parameter — so plumbing `incidentsDir` through as an explicit option (mirroring this same file's own options-object convention, `IncidentRecordInput`) touches every existing call site (`stock-recycle.ts`), not just this file. The planner must decide, as a plan-level call: thread `incidentsDir` as a new option here, or write a small, host-bound sibling writer in `.mts` reusing only `renderIncidentRecord()`'s pure string-building logic.

**The `IncidentRecordInput` shape to extend for a broker-minted operation field (SESS-05):**
```typescript
// incident-record.ts:242-255
export interface IncidentRecordInput {
  version?: unknown;
  at?: unknown;
  port?: unknown;
  epoch_before?: unknown;
  epoch_after?: unknown;
  outcome?: unknown;
  kill_stage?: unknown;
  session_id?: unknown;
  reason?: unknown;
  evidence?: IncidentEvidence | null;
  evidence_section?: string | null;
  evidence_complete?: unknown;
}
```
Every field is typed `unknown` deliberately (this module renders whatever it is handed, never validates) — a new `operation` field for "what was in flight when the relay died" fits this same untyped-passthrough convention.

**The ordering discipline to copy exactly, from the ONE existing caller** (`stock-recycle.ts:472-517`, comment at line 498):
```typescript
let recordWritten = false;
let requestSent = false;
let recordPath: string | null = null;
// ...
const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;

// Evidence, then record, then RPC -- in that order and no other (D-17).
const evidence = await gatherStockWedgeEvidence(session, deps);

// The record is written BEFORE the request -- capturing is structurally
// impossible to skip, not a discipline to remember.
recordPath = writeIncidentRecord({ at, port: lease.port, epoch_before: epochBefore, reason, session_id: sessionId, evidence });
recordWritten = true;

const recycled = await lease.brokerControl.recycle(lease.targetId);
requestSent = true;
```
SESS-05's "an incident record exists BEFORE the instance is reclaimed" is the SAME discipline one layer down: write-then-kill, never kill-then-write, with a boolean flag tracking which side of the ordering actually completed (useful for a test asserting write-before-kill by instrumenting both calls).

**Session-identity precedent, client-only today** (`stock-recycle.ts:496`):
```typescript
const sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;
```
Never transmitted to the broker today — SESS-06 needs this value (or a fallback) to actually travel over the wire, which is new plumbing, not a reuse of this line as-is.

---

### NEW test file: synthetic relay-lifecycle matrix (SESS-03/04/05)

**Analog — CORRECTED from RESEARCH.md's naming.** RESEARCH names `stock-run-until.ts` as "the style to copy" for a synthetic client/server pair, but that file's OWN test (`stock-run-until.test.ts:1-9`) is explicit that every client there is "a bare EventEmitter with a spy `send()` — no broker, no real socket, no emulator." That is a DI-stub pattern, not a real-loopback-socket pattern, and this phase's SESS-03/04 assertions are specifically about real TCP socket lifecycle (`socket.destroy()`, `socket.end()`, idle timers) — an EventEmitter stub cannot exercise "no FIN at all" at all, since there is no real FIN to omit.

**The actual real-socket harness to copy is `stock-protocol.test.ts`'s `withStubNetServer()`** (`stock-protocol.test.ts:540-567`):
```typescript
async function withStubNetServer<T>(
  handler: (socket: import("node:net").Socket) => void,
  fn: (port: number) => Promise<T>,
): Promise<T> {
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
```
This is exactly the shape needed: dynamic port (`listen(0, ...)`), tracked accepted sockets destroyed BEFORE `close()` so a stub that never finishes a frame cannot wedge the suite, `finally`-guaranteed teardown. `broker-endpoint.test.ts` (Phase 62's own new file, lines 1-30) additionally shows the pattern for standing up `broker-control.mts`'s REAL `startControlListener()`/`bindControlListener()` against a dynamic port and dialling it with `dialBrokerEndpoint()` for a genuine end-to-end handshake — this is the closer analog for the new `attach`-op cases specifically (as opposed to the raw-socket lifecycle matrix, which wants the lower-level `withStubNetServer()` shape).

**Timer injection to copy exactly** (`stock-checkpoints.ts:293-299, 363-388`):
```typescript
interface TraceGuardState {
  // ...
  now: () => number;
}
// ...
export function registerTraceCheckpoint(session: StockConnectSession, checkpointId: number, opts: { now?: () => number } = {}): void {
  const nowFn = opts.now ?? Date.now;
  const state = traceGuardStateFor(session.client, nowFn);
  state.traceCheckpoints.add(checkpointId);
}
```
This is the project's canonical `now?: () => number` injection spelling: an options-object field, defaulted to `Date.now`, threaded into whatever internal state needs the clock. Any new SESS-04 idle-timeout function must take the identical shape — `{ now?: () => number }` in a destructured options object — never a positional argument, never a bare closure over `Date.now()`.

**File placement — must NOT land in `MANUAL_ONLY_TESTS`** (`test-gate.mjs:141-154`):
```javascript
export const MANUAL_ONLY_TESTS = Object.freeze([
  "vice-broker-launch.test.ts",
  "vice-proxy.test.ts",
  "broker-e2e.test.ts",
  "stock-live.test.ts",
  "stock-live-triage.test.ts",
  "stock-live-broker-monitor.test.ts",
  "stock-broker-live.test.ts",
  "stock-a4-checkpoint-flood.test.ts",
  "dxa-live.test.ts",
  "ghidra-live.test.ts",
  "ghidra-opcode-live.test.ts",
  "text-monitor-live.test.ts",
]);
```
(12 entries, confirmed unchanged.) A new file such as `broker-relay.test.ts` is NOT on this list and must stay that way — `npm run test:automated` is what CI actually runs.

---

### NEW live, default-SKIP test for Success Criterion 1 (byte-transparency)

**Analog:** `stock-live-broker-monitor.test.ts`'s skip guard (lines 137-150):
```typescript
const VICE_LIVE_BROKER_BIN_ENV = process.env.VICE_LIVE_BROKER_BIN;
const SKIP_REASON: string | false = !VICE_LIVE_BROKER_BIN_ENV
  ? "stock-live-broker-monitor.test.ts is opt-in and default-skipped -- set VICE_LIVE_BROKER_BIN=/usr/bin/x64sc " +
    /* ... */
  : !existsSync(VICE_LIVE_BROKER_BIN_ENV)
    ? `VICE_LIVE_BROKER_BIN="${VICE_LIVE_BROKER_BIN_ENV}" does not exist on disk -- opt-in requires a real stock ` +
      /* ... */
    : false;
// ... later, at the actual test() call:
test("...", { skip: SKIP_REASON, timeout: 60000 }, async () => { /* ... */ });
```
Copy this three-way guard verbatim (absent env var / path doesn't exist / else armed) for the new byte-transparency live test — never a bare `if (!process.env.X) return;` inside the test body, since that reports a false PASS rather than a SKIP (the comment at line 141 states this explicitly).

## Shared Patterns

### Never-displace-the-original-error on cleanup
**Source:** `stock-connect.ts:465-493` (`WR-07`), mirrored in `text-connect.ts:130-148`
**Apply to:** any new cleanup path in the relay-dial or relay-teardown code — a failing release/disconnect/kill call must be logged, never thrown in place of the real failure.

### Claim-before-dial (PROTO-08/D-13)
**Source:** `stock-connect.ts:406-420`, `text-connect.ts:109-124`
**Apply to:** the new relay dial in both `stockConnect()` and `textConnect()` — claim/attach must complete over the control-plane socket BEFORE any byte is exchanged on the relay socket, since stock VICE services exactly one client and a refused claim must arrive as a JSON response, never as a silently-unserviced `connect()`.

### Close-is-release, extended not reinvented
**Source:** `broker-control.mts:756-766` (control connection), `vice-broker.mts:1117-1150` (`handleRelease()`)
**Apply to:** the new relay-connection acceptor in `broker-control.mts`/`vice-broker.mts` — wire the SAME `socket.on("close", ...)` → reclaim shape onto the relay socket, independently of the control connection's own close handler (Pitfall 1: a `SIGKILL` closes both sockets at once and can hide a relay-only-orphan bug if the two are conflated).

### Ownership check before acting on a caller-supplied target id
**Source:** `broker-control.mts:796-798` (`ownsTarget()`), reused at `monitor_claim`/`monitor_release` (lines 1047, 1094)
**Apply to:** the new `attach` op — never trust a bare `target_id` field; gate on the connection's own proven identity.

### Injected clock, `now?: () => number`
**Source:** `stock-checkpoints.ts:293-299, 384-388`
**Apply to:** every SESS-04 timing function and every lifecycle test — no real sleeps, ever (`63-VALIDATION.md`'s own sign-off checklist repeats this).

### Buffer-only transparency assertions
**Source:** no in-tree precedent (new discipline for this phase) — stated in `63-VALIDATION.md`'s "Byte-mode discipline" section
**Apply to:** every new test that claims byte-transparency — compare `Buffer` contents (`Buffer.equals()` / `Buffer.compare()`), never `.toString()` first.

### `.mts` → `resources/*.mjs` rebuild obligation
**Source:** `build.ts:43-56` (`HOST_BOUND_ARTIFACTS`, 12 entries: `vice-broker.mjs`, `container-guard.mjs`, `broker-state.mjs`, `broker-launch.mjs`, `broker-kill.mjs`, `broker-epoch.mjs`, `broker-control.mjs`, `backend-detect.mjs`, `host-tool.mjs`, `ghidra-project.mjs`, `tool-location.mjs`, `broker-home.mjs`)
**Apply to:** every edit to `broker-control.mts`, `vice-broker.mts`, `broker-home.mts` — run `npm run build` and commit the regenerated `.mjs` in the SAME commit, or `resources-sync.test.ts` reds CI (Pitfall 5). If a genuinely NEW host-bound `.mts` module is introduced for the splice logic, it must be ADDED to `HOST_BOUND_ARTIFACTS` in the same change.

## No Analog Found

| File / Construct | Role | Data Flow | Reason |
|---|---|---|---|
| `ViceMonitorClient.attach(socket)` / `TextMonitorClient.attach(socket)` | protocol entry point | streaming | No existing module in this tree accepts a pre-made socket anywhere — confirmed by RESEARCH's exhaustive read of both classes' `connect()` methods. This absence is itself the finding: every existing consumer (`stock-connect.ts`, `text-connect.ts`, and every test) calls `net.createConnection()` internally via `connect(host, port)`. The new entry point must be built from scratch, reusing only the listener-wiring lines already inside each class's own `connect()`. |
| Byte-transparent socket splice (`clientRelaySocket <-> emulatorSocket`) | new host-bound service logic | streaming | Zero uses of `.pipe()`-as-a-splice, `Socket.setKeepAlive()`, or `Socket.setTimeout()` anywhere in `src/mcp/vice/` today (RESEARCH's own "Standard Stack" table, exhaustive grep). Use Node's `Socket.pipe()` directly per the Don't-Hand-Roll guidance — there is no in-tree shape to copy the wiring from, only the general instruction not to write a manual copy loop. |
| String-mode → Buffer-mode socket handoff mid-connection | broker control-plane dispatch | streaming | `broker-control.mts`'s existing `"data"` handler is unconditionally string-mode (`chunk.toString("utf8")`, line 743) for all 9 existing ops. No existing code in this file (or anywhere in this tree) switches a live socket from line-buffered string mode to raw-Buffer mode at a byte boundary. This is genuinely new code — see the Buffer-mode-discipline note under `broker-control.mts` above. |
| Broker-side (host-bound, `.mts`) incident-record writer | new host-bound utility | file-I/O | `incident-record.ts` has never been called from a host-bound `.mts` module — it is a plain `.ts` consumed only by container-side callers (`stock-recycle.ts`). `broker-home.mts`'s `brokerIncidentsDir()` resolves the right PATH but has zero callers. Whether the fix is threading `incidentsDir` as a parameter through `incident-record.ts` or writing a small host-bound sibling is an open, plan-level design decision (RESEARCH's Open Question 3) — no existing code makes this choice for the planner. |
| Session-identity value transmitted broker-ward (SESS-06's wire field) | new protocol field + plumbing | request-response | `CLAUDE_CODE_SESSION_ID` (`stock-recycle.ts:496`) is read client-side and written to a LOCAL file only — it has never been sent over any socket to the broker. There is no existing "identity travels over the control-plane wire" precedent to copy; RESEARCH's Open Question 2 records this as unresolved (default recommendation: `CLAUDE_CODE_SESSION_ID` when present, else `${cwd basename}-${pid}`, but this is a synthesis, not a copied pattern). |

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts`, and every colocated `*.test.ts`/`*.test.mts` in the same directory — no other directory in the repo contains relevant analogs for this phase (skills, installer, docs are all out of scope for a transport-layer relay change).
**Files scanned (read in full or by targeted grep+offset):** `stock-connect.ts`, `text-connect.ts`, `stock-protocol.ts` (class `ViceMonitorClient`, lines ~1983-2095), `text-protocol.ts` (class `TextMonitorClient`, lines 755-914), `broker-control.mts` (lines 155-230, 737-1110), `vice-broker.mts` (lines 1095-1150), `broker-home.mts` (lines 100-140), `incident-record.ts` (full), `stock-recycle.ts` (lines 460-560), `host-tool-client.ts` (full), `stock-checkpoints.ts` (lines 280-389), `stock-protocol.test.ts` (lines 535-620), `stock-run-until.test.ts` (header), `broker-endpoint.test.ts` (header), `stock-live-broker-monitor.test.ts` (lines 90-165), `test-gate.mjs` (lines 40-160), `build.ts` (lines 43-60), `vice-broker-client.ts` (grep only), `broker-state.mts` (grep only, `MonitorChannel`/`InstanceRecord.monitorClients`).
**Pattern extraction date:** 2026-09-19
