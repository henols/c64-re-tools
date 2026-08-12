# Phase 2: Stock Backend Connection - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 15 new + 8 modified (see File Classification)
**Analogs found:** 20 / 23 (3 marked "no analog — new design", per RESEARCH.md's own honest flag on D-13)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `stock-protocol.ts` (new) | service (protocol client) | streaming (TCP framing/demux) | `.claude/mcp/vice/vice.ts` (transport seam, header + `ViceError` hierarchy) + vendor source `~/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts` (structure to port) | role-match (seam conventions) / exact (structure) |
| `stock-protocol.test.ts` (new) | test (unit, protocol parsing) | request-response + event | `.claude/mcp/vice/vice-probe.test.ts` (stub-server unit test shape) | role-match |
| `stock-connect.ts` (new) | service (connect handshake / epoch wrapper) | request-response | `.claude/mcp/vice/vice.ts` (`MachineRestartedError`, epoch/restart pattern) | role-match |
| `stock-connect.test.ts` (new) | test (unit + wrapper-level integration) | request-response | `.claude/mcp/vice/vice-probe.test.ts` | role-match |
| `stock-dispatch.ts` (new) | controller (per-tool dispatch table) | request-response | `.claude/mcp/vice/vice-proxy.ts`'s `forwardToVice()` / `tools` construction loop (lines 2708, 3009-3013) | role-match |
| `backend-detect.ts` (new) | utility (cached probe) | batch (once-per-broker-start) + file I/O (cache) | `.claude/mcp/vice/container-guard.mts` (one cached detector, checked at broker startup) + `.claude/mcp/vice/repo-root.ts` (one-time warning gates) | role-match |
| `backend-detect.test.ts` (new) | test (unit, cache logic) | batch | `.claude/mcp/vice/repo-root.test.ts` | role-match |
| `tools-manifest.stock.json` (new) | config (static manifest) | — | `.claude/mcp/vice/tools-manifest.json` (existing, committed, same shape) | exact |
| `tests/fixtures/binmon/*.bin` (+ `.json` sidecars) (new) | test fixture (binary + provenance) | file I/O | **No binary precedent** — closest is `.claude/mcp/vice/fixtures/*.json` + `fixtures/README.md` (JSON, "frozen evidence" provenance framing) | partial (format differs, provenance discipline transfers) |
| `probe-binmon.mjs` (modify — add capture mode) | utility (offline wire-protocol probe/CLI) | file I/O + streaming | itself — extend existing `--selftest` / `main()` conventions | exact (self) |
| `broker-launch.mts` (modify — D-12 stock args, D-03 probe placement) | service (host launch) | event-driven (spawn) | itself — `buildViceArgs()` (94-101), `inFlight` guard (66-83, 233-264) | exact (self) |
| `broker-kill.mts` (modify — D-14/D-15 reap replacement) | service (host process reap) | batch | itself — `discoverBandProcesses()` (483-489), `reapOrphanedInstances()` (609-637) | exact (self) |
| `broker-state.mts` (modify — D-13 ownership field) | model (in-memory state shape) | CRUD | itself — `InstanceRecord` (19-89), `GrantRecord` (91-111) | exact (self) |
| `broker-control.mts` (modify — new control-plane op for D-13) | controller (TCP control protocol) | event-driven (line-JSON over TCP) | itself — `ControlRequestKind` vocabulary (line 24), existing `acquire`/`release`/`recycle`/`status`/`host_state` handlers | exact (self) |
| `broker-control.test.ts` (modify — extend) | test (integration, real listener) | event-driven | itself — existing `makeClient()`/`waitFor()` harness (lines 40-90) | exact (self) |
| `vice-broker-client.ts` (modify, if D-13's signal needs a client-side call) | service (container-side broker client) | request-response over TCP | itself — `openBrokerControl()` | exact (self) |
| `broker-launch.test.ts` (modify — extend, BROK-01) | test (unit) | event-driven | itself | exact (self) |
| `vice-proxy.ts` (modify — 3 edits: `manifestPath()` backend branch, `ensureBrokerLease()`'s success branch widened to carry the held lease, `tools` construction dispatch choice) | controller (stdio dispatch) | request-response | itself — `manifestPath()` (393-397), `ensureBrokerLease()` (2136-2212), `tools` construction (3009-3013) | exact (self) — **one dispatch site, one manifest site, one acquisition function; do not append a second of any (D-09)** |
| `refresh-manifest.ts` (possibly modify — per-backend regen) | utility (manual CLI) | file I/O | itself — `writeManifestAtomic()`, guarded entry point | exact (self) |
| `vice.ts` (read-only reference; `MachineRestartedError` reused, not modified) | service (transport seam) | request-response | itself | exact (self) |

## Pattern Assignments

### `stock-protocol.ts` (new sibling module — protocol client)

**Analogs:** `.claude/mcp/vice/vice.ts` (this repo's seam/error conventions) and
`/home/henrik/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts` (the vendor
structure being ported, per D-16 — copy the *shape*, not the file verbatim).

**Header-comment convention to copy** (`vice.ts:1-13`):
```typescript
#!/usr/bin/env node
// Single MCP client seam for the host VICE MCP server.  Every emulator
// interaction in this project goes through `call()` -- no other file speaks
// MCP JSON-RPC or raw HTTP to the VICE endpoint directly.
//
// Why a seam at all: Phase 1 tooling and Phase 3's verify/runner.mjs both
// depend on this one transport.  If the handshake shape ever needs to change
// (session header, SSE framing, a curl fallback), it changes here once.
//
// The deny-list is the other reason this file exists: vice_disk_list crashes
// the shared host MCP server (see CLAUDE.md's hazard note and STATE.md's
// blocker entry).  The guard below runs *before* any request is serialised,
// so no caller -- however indirect -- can reach that tool by accident.
```
`stock-protocol.ts`'s header must do the same three things: (1) state what this
file is the ONE authoritative place for (framing/correlation/demux for the
stock binmon wire protocol), (2) name the vendoring source, exact version
(`c64-debug-mcp` v1.0.14, MIT, Henrik Olsson 2025), and the two defects fixed
on the way in (zero-length `JAM`, throw-on-bad-STX), (3) name what NOT to do
(never demux on response *type* before request *id* — see the demux-ordering
excerpt below). No existing file in this repo vendors third-party source
(`[VERIFIED]` per RESEARCH.md, zero grep hits for "vendored"/"Adapted from")
— this file establishes the template, it does not copy one.

**Error class pattern** (`vice.ts:245-291`, copy the constructor shape exactly):
```typescript
export interface ViceErrorOptions {
  code?: number | string;
  data?: unknown;
}

export class ViceError extends Error {
  code?: number | string;
  data?: unknown;

  constructor(message: string, { code, data }: ViceErrorOptions = {}) {
    super(message);
    this.name = "ViceError";
    this.code = code;
    this.data = data;
  }
}
```
Every new stock-path error (a `stock_protocol_error`, a `stock_desync_error`,
etc.) must be an `<Name>Error extends ViceError` subclass following this exact
`constructor(message, { ...fields }: XOptions = {})` shape — never the
vendor's own `ViceMcpError extends Error` (D-16 explicitly requires this
realignment). Do **not** import `contracts.ts`/`errors.ts` from the vendor
wholesale — they pull in `zod`, which this package does not depend on
(confirmed via direct read of `package.json`'s `dependencies` block). Copy
only the ~15 lines of pure constants (`VICE_API_VERSION`, `VICE_STX`,
`VICE_BROADCAST_REQUEST_ID`) and the plain interfaces/types by hand.

**Demux ordering — copy verbatim, do not restructure** (vendor source,
`c64-debug-mcp/src/vice-protocol.ts:669-681`, read this session):
```typescript
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
  // ... CheckpointList related[] accumulation and resolve/reject logic
}
```

**Defect fixes to apply while porting** (both confirmed exact locations,
vendor source, this session — see RESEARCH.md "Vendored Protocol Client"):
```typescript
// Defect (a): JAM's body is genuinely zero-length; never assume 2 bytes.
case ResponseType.Jam:
  return {
    type: "jam",
    requestId,
    errorCode,
    programCounter: body.length >= 2 ? body.readUInt16LE(0) : null,
  };
```
```typescript
// Defect (b): advance past a bad STX instead of throwing; increment a
// desync counter rather than aborting the whole parse.
while (offset + 12 <= buffer.length) {
  if (buffer[offset] !== VICE_STX) {
    offset += 1; // minimum recovery step -- never abandon the buffer unadvanced
    desyncCount += 1;
    continue;
  }
  // ... existing frame-length / body-slice logic, unchanged
}
```

**MAX_BODY_LEN desync guard (PROTO-07/D-18) — copy from `probe-binmon.mjs:73-77`:**
```javascript
// Upper bound on a trusted body length. The largest legitimate frame is a
// DISPLAY_GET of the full debug screen (504*312 = 157,248 bytes at 8bpp plus
// its info block), so 4 MiB is far above anything real while still refusing an
// arbitrary 32-bit value read out of a desynced stream.
const MAX_BODY_LEN = 4 * 1024 * 1024;
```
`probe-binmon.mjs`'s own `_onData()` (lines 119-150) already implements the
exact resync-on-bad-STX + implausible-body-length-guard loop this file needs
— read it directly as a second, already-correct-in-this-repo reference
alongside the vendor source, since it independently reinvented the same fix
this phase's D-16 defect-(b) also requires. Its `[framing]` log line
("implausible body length ... treating as desync, resyncing one byte") is a
good model for `stock-protocol.ts`'s own desync-counter increment log.

**Import extensions and quoting:** double quotes, explicit `.ts` extensions
on every relative import (`import { ... } from "./vice.ts";` — not `.js`),
2-space indent, per CLAUDE.md's Code Style conventions — the vendor source
uses single quotes and `.js` extensions; both must be rewritten, not kept.

---

### `stock-protocol.test.ts` (new)

**Analog:** `.claude/mcp/vice/vice-probe.test.ts` (`node --test`, colocated,
stub-server harness — no fixture-loading framework needed).

**Setup/teardown shape to copy** (`vice-probe.test.ts:1-37`):
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/** Start a stub http server driven by `handler(req, res)`, run `fn(port)`
 * against it, then shut down -- closeAllConnections() BEFORE close() so a
 * hanging-response test (a handler that never calls res.end()) cannot wedge
 * the suite waiting for a socket that will never close on its own. */
async function withStubServer<T>(handler: StubHandler, fn: (port: number) => Promise<T>): Promise<T> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
```
For `stock-protocol.ts` this becomes a raw TCP stub (`node:net`'s
`createServer`) rather than HTTP, feeding it captured/synthesized fixture
bytes from `tests/fixtures/binmon/` — same "start ephemeral loopback server,
run test, tear down in `finally`" shape, same rationale (never let a hung
test wedge the suite).

**Test-name-pattern convention for the 8 VERIF-02 cases** (per RESEARCH.md's
Validation Architecture section) — name each `test()` block so
`--test-name-pattern="jam"`, `"byte-at-a-time"`, `"correlat"`,
`"demux|event"`, `"display.*get|157"`, `"error.*code|protocol.*error"` match
directly; this is the mechanism the phase's own per-task verification gate
depends on, not a style nicety.

---

### `stock-connect.ts` (new)

**Analog:** `.claude/mcp/vice/vice.ts`'s `MachineRestartedError` (lines 262-291,
excerpted above under `stock-protocol.ts` — same class, reused not reinvented
per D-11/A4). This file is the one place that:
1. Opens a `stock-protocol.ts` client and asserts `api_version === 2`.
2. Reads `VICE_INFO` for the version quad, gates `CPUHISTORY_GET` availability
   once (BACK-04).
3. Wraps reconnect-after-restart by throwing the *existing* `MachineRestartedError`
   — construct it with the same options shape (`baselineEpoch`, `currentEpoch`,
   `where`, `lastToolCall`) `vice.ts`'s own call sites already use. Do **not**
   invent a second restart-error type (D-11 states this as locked, not
   discretionary).

**Anti-pattern to avoid explicitly:** this file must not re-derive its own
epoch/restart-detection heuristic — that would be exactly the
"re-deriving a cross-cutting seam locally" anti-pattern ARCHITECTURE.md names,
this time against `MachineRestartedError`'s established meaning instead of
`mcpHost()`/`repoRoot()`.

---

### `stock-dispatch.ts` (new)

**Analog:** `.claude/mcp/vice/vice-proxy.ts`'s `forwardToVice()` (line 2708) and
the `tools` construction loop (lines 3009-3013).

**Core dispatch-table pattern to follow** (`vice-proxy.ts:3009-3013`):
```typescript
const tools: Record<string, ReturnType<typeof buildViceTool>> = {};
for (const def of readManifestTools()) {
  if (DENY_LIST.includes(def.name)) continue;
  tools[def.name] = buildViceTool(def, (args) => forwardToVice(def.name, args));
}
```
`stock-dispatch.ts` exports an equivalent per-tool-name lookup (a
`CommandType`-shaped table or a plain `Record<string, Handler>`) that
`vice-proxy.ts` consults **in place of** the unconditional
`forwardToVice()` wiring when the active backend is `stock` — this is the
one and only place D-07/D-09's "no fall-through to the fork's HTTP forward"
requirement is enforced. A manifest entry with no matching handler in this
table must be a hard, explicit refusal (an `isErrorText(...)`-shaped result,
matching `forwardToVice()`'s own never-throw `{content, isError}` contract —
see the excerpt under `vice-proxy.ts` below), never a silent fall-through.

**`vice_ping` enrichment (D-05) is one entry in this table, not a
`vice-proxy.ts` special case** — `vice_ping` is dispatched through this same
table on the stock backend, with its handler adding `backend`, `viceVersion`,
`resolvedBinaryPath` fields to the reply payload before returning. Do not add
a second `if (name === "vice_ping")` branch inside `vice-proxy.ts` itself.

---

### `backend-detect.ts` (new)

**Analogs:** `.claude/mcp/vice/container-guard.mts` (one cached, checked-once
detector) and `.claude/mcp/vice/repo-root.ts`'s one-time-warning gates (D-06
wants exactly this pattern).

**One-time stderr warning gate — copy verbatim** (`repo-root.ts:50-54`,
`145-166`):
```typescript
// Gates the two "last resort" stderr notes below so a long-running process
// (or a test suite driving this module many times) emits each at most once,
// rather than spamming stderr on every single call.
let warnedEnvOutsideFrom = false;
let warnedNoMarkerFound = false;
```
```typescript
if (cwp) {
  if (!warnedEnvOutsideFrom) {
    warnedEnvOutsideFrom = true;
    console.error(
      `warn: CONTAINER_WORKSPACE_PATH is set (${cwp}) but does not contain ${from}, and no .git ` +
        `ancestor was found either -- falling back to CONTAINER_WORKSPACE_PATH itself as the repo root. ` +
        `This is expected for an exported copy of this skill living outside its mounted workspace; if ` +
        `that is not the situation here, the repo root this resolved to may be wrong.`
    );
  }
  return resolve(cwp);
}
```
D-06's note follows this exact shape: a module-level `let warnedBackendUnset = false;`,
set and checked before the single `console.error(...)` naming the detected
backend and how to override it (`VICE_BACKEND=stock|fork`) — fired at most
once per process, on whichever entry point first resolves the backend.

**Cache read/write under `.vice-supervisor/`** — use `supervisorDir()` from
`repo-root.ts` to resolve the cache file path, exactly as `vice.ts`'s
`EPOCH_FILE` does (`vice.ts:88-90`):
```typescript
export const EPOCH_FILE: string = process.env.VICE_EPOCH_FILE
  ? resolve(process.env.VICE_EPOCH_FILE)
  : join(supervisorDir(), "epoch.json");
```
Never re-derive `.vice-supervisor`'s location independently — import
`supervisorDir()`, matching ARCHITECTURE.md's "Re-deriving a cross-cutting
seam locally" anti-pattern warning verbatim.

**Cache-write atomicity** — follow `refresh-manifest.ts`'s
tmp-sibling → chmod → content → rename sequence (`refresh-manifest.ts:43-49`):
```typescript
function writeManifestAtomic(path: string, manifest: ToolsManifest): void {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, "");
  chmodSync(tmpPath, 0o600);
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(tmpPath, path);
}
```
The detection cache (`{ resolvedPath, versionQuad, mtimeMs }` per D-03's
replaced-in-place requirement) should be written the same way — this repo's
established convention for every host-synchronised state file under
`.vice-supervisor/` (documented in ARCHITECTURE.md's "State Management"
section) is atomic tmp-then-rename, never a direct in-place write.

**Where it is called from:** once, at broker startup — mirroring where
`container-guard.mts`'s `isInsideContainer()` check already runs (per
ARCHITECTURE.md's "Broker daemon... Owns: ... epoch/liveness records" and
`vice-broker.mts`'s own init sequence), never per-acquire, never per-connect
(D-03).

---

### `broker-launch.mts` (modify — D-12, D-03)

**Analog:** itself. `buildViceArgs()` (lines 94-101) is the exact, single,
already-existing decision point:
```typescript
export function buildViceArgs(port: number, { mcpHost, viceArgsEnv }: { mcpHost?: string; viceArgsEnv?: string } = {}): string[] {
  const rawViceArgs = viceArgsEnv ?? process.env.VICE_ARGS;
  if (typeof rawViceArgs === "string" && rawViceArgs.trim() !== "") {
    return rawViceArgs.trim().split(/\s+/);
  }
  const host = mcpHost ?? process.env.VICE_BROKER_MCP_HOST ?? "0.0.0.0";
  return ["-mcpserver", "-mcpserverhost", host, "-mcpserverport", String(port)];
}
```
D-12's stock shape (`-binarymonitor -binarymonitoraddress ip4://<host>:<port>`)
is a second branch inside this same function (selected by a `backend`
parameter) or a sibling `buildViceArgsStock()` called from the same call site
— **not a new seam**. The `VICE_ARGS` env override continues to work
unchanged for either backend since it short-circuits before either branch.

**`inFlight` guard — do not touch, only respect** (lines 66, 177-184,
233-264). Any D-03 probe placement must run entirely outside this critical
section, or (if a trial-launch mechanism is chosen) be folded into the SAME
single guarded acquisition as the real launch — see the header comment at
lines 50-65 for the exact 2026-08-01-outage rationale this guard exists to
prevent regressing:
```typescript
export function tryLaunchOne(reason: string, port: number, deps: TryLaunchDeps): InstanceRecord | null {
  if (inFlight) return null;
  inFlight = true;
  try {
    return spawnAndRecordInstance(reason, port, deps);
  } finally {
    inFlight = false;
  }
}
```

**Rebuild obligation:** any edit to this file requires `node .claude/mcp/vice/build.ts`
to regenerate `resources/vice-broker.mjs` (and siblings) before commit —
`resources-sync.test.ts` fails CI on drift.

---

### `broker-kill.mts` (modify — D-14/D-15 reap replacement)

**Analog:** itself. The exact heuristic being retired
(`discoverBandProcesses()`, lines 483-489):
```typescript
export async function discoverBandProcesses(options: DiscoverBandProcessesOptions = {}): Promise<ProcessListEntry[]> {
  const listProcesses = options.listProcesses ?? defaultListProcesses;
  const viceBin = resolveViceBinForReap(options.viceBin);
  const basePort = resolveBasePortForReap(options.basePort);
  const entries = await listProcesses();
  return entries.filter((entry) => entry.args.includes(viceBin) && argsNamePortAtOrAbove(entry.args, basePort));
}
```
`reapOrphanedInstances()` (lines 609-637) is the caller that needs its *kill*
half re-derived from the broker's own on-disk instance directories
(`listInstanceDirs()`, already used for the epoch-bump half at lines 628-633)
instead of a live `ps` scan — this is a genuine behavior change, not a pure
deletion, per RESEARCH.md's Broker-Side Changes section. Follow the existing
function's own doc-comment discipline (long structured comment naming the
D-number and the incident it prevents) when replacing the body.

**Rebuild obligation:** same as `broker-launch.mts` — `node build.ts` then
verify `resources-sync.test.ts` is green.

---

### `broker-state.mts` (modify — D-13 ownership field)

**Analog:** itself. `InstanceRecord`'s existing additive-optional-field
pattern (lines 33-89) is the exact template for D-13's new field:
```typescript
// ------------------------------------------------------------------
// Plan 03 (C2/D-23): the per-child supervisor's own bookkeeping fields.
// Optional -- a record created through a path that does not supervise
// (e.g. a caller with its own lifecycle) remains a valid InstanceRecord
// without them; broker-launch.mts's superviseChild() is the one writer
// that always sets all five together, immediately after every launch.
// ------------------------------------------------------------------
/** The current epoch integer for this instance -- mirrored into the
 * epoch.json record broker-epoch.mts writes (D-04). */
epoch?: number;
```
D-13's `monitorClientConnected?: boolean` (or a richer holder-naming shape)
should follow this exact convention: optional field, a structured doc comment
naming which single writer sets it and when, added to `InstanceRecord`
alongside (not replacing) the existing fields.

**No analog exists for the mechanism itself** — per RESEARCH.md's own honest
flag, `GrantRecord` (lines 91-111) answers a *different* question ("who
holds this instance's lifecycle grant") than D-13 needs ("has the raw binmon
socket been opened"). Do not treat `GrantRecord`'s existence as already
solving PROTO-08/BROK-02 (see Common Pitfall 2 in RESEARCH.md) — this is new
design, not a ported pattern; the closest structural precedent is
`GrantRecord`'s own shape (a small interface, `id`/`port`/timestamp/`pid`
fields) as a *template* for whatever new record or field is chosen, not as a
reusable mechanism.

**Rebuild obligation:** same as above.

---

### `broker-control.mts` (modify — new op for D-13's ownership signal)

**Analog:** itself. `ControlRequestKind`'s existing five-message vocabulary
(line 24):
```typescript
export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state";
```
Adding a sixth op (e.g. `"monitor_connected"`, per RESEARCH.md's Open
Question 1) follows the exact pattern already established: a plain
newline-delimited JSON op, gated by the same token check every existing op
uses (`newControlToken()`, line 168; the per-boot capability token compared
constant-time, checked BEFORE any state read or write, per the file's own
header comment lines 12-16). Do not invent a parallel channel — RESEARCH.md's
State of the Art table names this explicitly: "Phase 2 extends this existing
plane with new message kinds... it does not replace it."

**Header-comment convention** (lines 1-20) — same structured style as every
other file in this tree: what problem this file solves, the wire-format
decision-checkpoint reference, the auth model. Any new op added here should
extend this same header, not add a second one.

**Rebuild obligation:** same as above.

---

### `broker-control.test.ts` (modify — extend)

**Analog:** itself. The existing real-listener-plus-injected-stubs harness
(lines 40-90) is the exact shape a new `monitor_connected`-style op's test
should reuse:
```typescript
async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 15): Promise<boolean> { ... }

function makeClient(port: number, host = "127.0.0.1") {
  const socket = connect({ port, host });
  // ... line-buffered JSON send()/next() over a real TCP socket
}
```
No real emulator, no real spawn — injected `onAcquire`/`onRelease`/etc.
stubs, exactly as the file's own header comment states (lines 6-8). A new
op's handler stub follows the same injection pattern as the existing five.

---

### `stock-dispatch.ts`'s consumer edits to `vice-proxy.ts`

**Analog:** itself. Exactly three edits, all at already-identified seams.
The invariant is not the number — it is that there stays exactly ONE dispatch
site, ONE manifest site and ONE lease-acquisition function (D-09's "no
fall-through" requirement, ARCHITECTURE.md's "Re-deriving a cross-cutting seam
locally" anti-pattern). An earlier draft said two edits; that count omitted the
lease wiring, which left the stock dispatch path with no host, no port and no
control session to claim on before dialling.

**Edit 1 — `manifestPath()`** (lines 393-397), gains a backend-conditional
branch following the exact override pattern `VICE_TOOLS_MANIFEST` already
establishes:
```typescript
function manifestPath(): string {
  return process.env.VICE_TOOLS_MANIFEST
    ? resolve(process.env.VICE_TOOLS_MANIFEST)
    : join(HERE_DIR, "tools-manifest.json");
}
```

**Edit 2 — the `tools` construction loop** (lines 3009-3013), gains the
backend-selected dispatch choice between `forwardToVice()` (fork) and
`stock-dispatch.ts`'s table (stock):
```typescript
const tools: Record<string, ReturnType<typeof buildViceTool>> = {};
for (const def of readManifestTools()) {
  if (DENY_LIST.includes(def.name)) continue;
  tools[def.name] = buildViceTool(def, (args) => forwardToVice(def.name, args));
}
```

**Edit 3 — `ensureBrokerLease()`** (lines 2136-2212), the ONE acquisition
function, whose success branch widens from `{ ok: true }` to
`{ ok: true, lease: HeldLease | null }` so its result can be threaded into
`stockConnect({ host, port, targetId, brokerControl })`. `lease` is `null` only
on the `VICE_MCP_URL` early return, where no broker control session exists and
the stock path must therefore refuse rather than dial. The function itself is
then passed as `dispatchStock`'s `ensureLease` dependency at the Edit 2 call
site — the stock path reuses the fork path's acquisition rather than building a
second one, which is what keeps D-13's claim-before-dial ordering enforceable
(the claim inside `stockConnect()` must be made on the SAME control session that
acquired the grant).

**Never-throw / `{content, isError}` contract to preserve** — every stock
dispatch handler must return this same shape, matching `forwardToVice()`'s
own discipline (`vice-proxy.ts:2708-2786`, excerpted):
```typescript
async function forwardToVice(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
  const leaseResult = await ensureBrokerLease();
  if (!leaseResult.ok) {
    return isErrorText(leaseResult.message);
  }
  // ...
  let payload: unknown;
  try {
    payload = await call(name, translatedArgs);
  } catch (e) {
    if (e instanceof MachineRestartedError) {
      // ... converted to isErrorText(...), never re-thrown past this point
```
A stock dispatch handler that throws instead of returning `isErrorText(...)`
would violate the file's own "never-throw boundary" (ARCHITECTURE.md, Error
Handling section) — the global handlers exist for genuinely unexpected
failures, not routine dispatch outcomes.

**`buildViceTool()` wrapper — unchanged, reused as-is** (lines 2972-2985):
```typescript
function buildViceTool(def: ToolDefinition, run: (args: Record<string, unknown>) => Promise<ToolCallResult>) {
  return createTool({
    id: def.name,
    description: def.description ?? "",
    inputSchema: rawJsonSchemaAsStandardSchema(def.inputSchema),
    mcp: { _meta: { ...((def._meta as Record<string, unknown> | undefined) || {}), "anthropic/maxResultSizeChars": OUTPUT_CHAR_CAP } },
    execute: async (inputData) => run(isPlainObject(inputData) ? inputData : {}),
  });
}
```

---

### `probe-binmon.mjs` (modify — D-19 capture mode)

**Analog:** itself. CLI-arg convention to match (lines 1-28, 986-999):
```
Usage:
  1) Launch a VICE build with the binary monitor:
       x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
  2) node .claude/mcp/vice/probe-binmon.mjs [host] [port]
     (defaults: 127.0.0.1 6502; or set VICE_BINMON=host:port)

Offline self-check (no emulator, no socket):
  node .claude/mcp/vice/probe-binmon.mjs --selftest
```
```javascript
if (process.argv.includes("--selftest")) {
  try {
    selftest();
    console.log("SELFTEST PASS - all wire body builders and response parsers verified offline");
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
} else {
  main().catch((e) => {
    console.error("probe error:", e.message);
    process.exit(1);
  });
```
A `--capture <case-name>` flag should follow this exact `process.argv.includes(...)`
branch style, sitting alongside (not replacing) `--selftest`, with its own
guarded `catch`/`process.exit` block.

**Checkpoint cleanup-in-finally discipline to copy** (lines 726-816 — the
"delete whichever were actually created, in the `finally`" pattern, already
adopted in this file after Phase 1's own incident):
```javascript
// Both numbers live outside the try so the finally can delete whichever were
// actually created ...
} finally {
  // ...
  await mon.send(CMD.CHECKPOINT_DELETE, cpNumBody(n));
```
D-19's capture mode MUST reuse this pattern for every checkpoint it sets
during a capture session (case 5, `CHECKPOINT_LIST`) — narrow single-address
range, never the fork's `$0000-$FFFF` full-range shape that produced the
`CHECKPOINT_INFO ×18` flood (see Common Pitfall 4 in RESEARCH.md).

**`MAX_BODY_LEN` / resync-on-bad-STX (lines 73-77, 119-150)** — already
correct in this file; the capture mode's raw-byte dump should sit downstream
of this same framing loop (dump the frame bytes at the point they are already
correctly reassembled), not re-parse the wire independently.

---

### `tests/fixtures/binmon/` (new — VERIF-02 fixtures)

**No binary-fixture precedent exists in this repo** — confirmed by direct
search (`find . -iname "*.bin" -o -iname "*fixture*"` returns only
`.claude/mcp/vice/fixtures/*.json`, all small JSON, not binary). RESEARCH.md
rates the storage convention MEDIUM confidence for exactly this reason — this
is a new pattern to establish, not a precedent to copy structurally. However
the **provenance-discipline half** of the existing `fixtures/` directory is a
strong analog and should be copied:

**`.claude/mcp/vice/fixtures/README.md` (full text, 34 lines) — the
provenance-table + "frozen evidence" framing to reuse:**
```markdown
# Frozen fixtures — bash broker/epoch contract

These three files were captured **live**, on 2026-08-03, from the running bash broker's own
`.vice-supervisor/` state tree, before `vice-supervisor.sh` and `vice-broker.sh` are deleted by
this phase.

## Source paths

| Fixture | Captured from | Observed mode |
|---|---|---|
| `bash-epoch-6510.json` | `.vice-supervisor/6510/epoch.json` (first-launched instance, port 6510) | `600` |
...

## These are FROZEN EVIDENCE

These three files are **frozen evidence of a contract whose writer this phase deletes.** They are
never to be regenerated, reformatted, "tidied", or hand-edited. `broker-epoch.test.ts` asserts the
epoch contract directly against them...
```
A new `tests/fixtures/binmon/README.md` should carry the same shape: a table
naming each `.bin` file, what real (or synthesized) session it was captured
from, and which test asserts against it directly — plus a `.json` sidecar per
file recording `{ capturedFrom, viceVersion, capturedAt, command }` per
RESEARCH.md's VERIF-02 section. State plainly, as this README does, whether
each fixture is frozen evidence (never regenerate) or a living capture
(regenerate via the capture-mode script when the build changes).

**Loading convention** — plain `fs.readFileSync` against the committed
`.bin` file, consumed directly by `node --test`; no fixture-loading framework
(none exists elsewhere in this repo, and one file class does not justify
adding one — RESEARCH.md's "Don't Hand-Roll" table).

---

### `tools-manifest.stock.json` (new)

**Analog:** `.claude/mcp/vice/tools-manifest.json` (exact shape match).
Existing entry shape (`vice_ping`, read directly this session):
```json
{
  "generated_at": "...",
  "endpoint": "...",
  "tools": [
    {
      "name": "vice_ping",
      "description": "Check if VICE is responding",
      "inputSchema": { "type": "object", "additionalProperties": false }
    }
  ]
}
```
`tools-manifest.stock.json` is a sibling with the identical top-level shape
(`generated_at`/`endpoint`/`tools`), containing only the trimmed stock tool
list (D-07) — an authoring change to which entries the array carries, never
a new schema.

**`refresh-manifest.ts`'s atomic-write pattern** (lines 43-49, excerpted
above under `backend-detect.ts`) is the template if a per-backend regeneration
path is added — same tmp-sibling → chmod 0600 → content → rename sequence,
same "never write a partial/empty manifest over a good one on failure"
guarantee (lines 66-79).

---

## Shared Patterns

### Single seam per concern (ARCHITECTURE.md)
**Source:** `mcpHost()` in `vice.ts` (lines 76-78), `repoRoot()`/`supervisorDir()`
in `repo-root.ts`, `isInsideContainer()` in `container-guard.mts`.
**Apply to:** every new file in this phase that needs the repo root, the
supervisor directory, or container-vs-host detection — import the existing
function, never inline an equivalent check. This is the single most-repeated
instruction across CONTEXT.md, RESEARCH.md, and ARCHITECTURE.md for this
phase (see the "Re-deriving a cross-cutting seam locally" anti-pattern,
ARCHITECTURE.md).
```typescript
export function mcpHost(deps?: ContainerGuardDeps): string {
  return process.env.VICE_MCP_HOST || (isInsideContainer(deps) ? "host.docker.internal" : "127.0.0.1");
}
```

### One-time stderr warning gate
**Source:** `repo-root.ts:53-54, 145-166` (excerpted in full above under
`backend-detect.ts`).
**Apply to:** `backend-detect.ts` (D-06's required note when `VICE_BACKEND`
is unset) and any other new module that needs to warn once per process rather
than spam stderr on every call.

### Error class hierarchy
**Source:** `ViceError`/`MachineRestartedError` in `vice.ts:245-291`.
**Apply to:** every new error type across `stock-protocol.ts`,
`stock-connect.ts`, `stock-dispatch.ts` — all must be `class XError extends
ViceError` with the `constructor(message, { ...fields }: XOptions = {})`
shape; `stock-connect.ts` reuses `MachineRestartedError` itself rather than
adding a new subclass (D-11).

### Never-throw boundary at the dispatch seam
**Source:** `forwardToVice()`'s `{content, isError}` contract,
`vice-proxy.ts:2708-2786`.
**Apply to:** every `stock-dispatch.ts` handler — routine failures return
`isErrorText(...)`, never throw; only genuinely unexpected errors reach the
global uncaught-exception handler.

### Atomic state-file writes
**Source:** `refresh-manifest.ts:43-49`'s `writeManifestAtomic()`.
**Apply to:** `backend-detect.ts`'s cache file, any new `.vice-supervisor/`
state this phase introduces — tmp-sibling → chmod 0600 → content → rename,
never a direct in-place write.

### `.mts` → `resources/*.mjs` rebuild obligation
**Source:** `build.ts`'s `HOST_BOUND_ARTIFACTS` assertion;
`resources-sync.test.ts`.
**Apply to:** every edit to `broker-launch.mts`, `broker-kill.mts`,
`broker-state.mts`, `broker-control.mts` — run `node .claude/mcp/vice/build.ts`
and confirm `resources-sync.test.ts` is green before considering the task
done. This is not optional cleanup; CI fails on drift.

### Additive-optional-field convention on shared records
**Source:** `InstanceRecord`'s Plan-03 supervision fields, `broker-state.mts:33-89`.
**Apply to:** D-13's new ownership field on `InstanceRecord` — optional,
documented inline with a structured comment naming the single writer, added
alongside existing fields, never restructuring the interface.

## No Analog Found

| File / Mechanism | Role | Data Flow | Reason |
|---|---|---|---|
| D-13's "has the raw binmon socket been opened" signal (wherever it lands — likely `broker-state.mts` + `broker-control.mts` + `vice-broker-client.ts`) | new bookkeeping / control-plane op | event-driven | `GrantRecord` answers a different question (control-plane lease ownership); nothing in this codebase today tracks "has a raw TCP monitor socket actually been dialled." RESEARCH.md explicitly flags this as new design, not a discovered pattern — see Common Pitfall 2. Use `GrantRecord`'s own small-interface *shape* as a structural template only. |
| Binary test fixtures (`tests/fixtures/binmon/*.bin`) | test fixture | file I/O | No binary fixture precedent exists in this repo (confirmed via `find` this session) — `.claude/mcp/vice/fixtures/*.json` is the closest analog, but it is text/JSON, not binary. RESEARCH.md rates this MEDIUM confidence for exactly this reason; the plan should establish the convention (per-fixture `.json` sidecar with provenance, README table) rather than search further for a precedent that doesn't exist. |
| Stock-vs-fork backend probe mechanism itself (the actual `--help` invocation or trial launch, as opposed to its cache) | utility | batch | No existing code in this repo probes a VICE binary's own flag support — `container-guard.mts`'s five-signal detector is a structural analog for "one cached, checked-once detector" but detects the *environment*, not an external binary's capabilities. This is genuinely new, per RESEARCH.md's own "no VICE binary available in this sandbox to verify against" caveat (Assumption A1). |

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.ts`, `.claude/mcp/vice/*.mts`,
`.claude/mcp/vice/*.mjs`, `.claude/mcp/vice/fixtures/`, plus one external
vendor-source read (`/home/henrik/dev/henrik/git/c64-debug-mcp/src/vice-protocol.ts`,
per D-16).
**Files scanned (read this session, targeted or full):** `vice.ts` (targeted:
header, `ViceError`/`MachineRestartedError`, `mcpHost()`), `vice-probe.ts`
(targeted: header, exports), `vice-probe.test.ts` (targeted: harness),
`repo-root.ts` (full), `repo-root.test.ts` (name only), `broker-launch.mts`
(targeted: header + first 270 lines covering `buildViceArgs`/`inFlight`),
`broker-kill.mts` (targeted: lines 440-637 covering `discoverBandProcesses`/
`reapOrphanedInstances`), `broker-state.mts` (targeted: lines 1-120 covering
`InstanceRecord`/`GrantRecord`), `broker-control.mts` (targeted: lines 1-100
covering `ControlRequestKind` vocabulary), `broker-control.test.ts` (targeted:
lines 1-90 covering harness), `probe-binmon.mjs` (targeted: lines 1-150,
375-535, 960-1000 covering framing/selftest/CLI/checkpoint-cleanup),
`tools-manifest.json` (parsed: shape + `vice_ping` entry), `refresh-manifest.ts`
(full), `vice-proxy.ts` (targeted: lines 380-440 manifest loading, 2698-2790
`forwardToVice`, 2960-3033 tool construction + dispatch), `ARCHITECTURE.md`
(full), `CLAUDE.md` (full).
**Pattern extraction date:** 2026-08-12
