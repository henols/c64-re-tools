# Phase 3: Direct Tools - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 24 (9 new handler modules + 9 colocated test files + 6 modified files)
**Analogs found:** 24 / 24 (every file has a same-tree analog; several categories — condition AST, PETSCII table, register catalog, rate limiter — are flagged as genuinely new design with no existing analog to copy structure from, only style)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `stock-address.ts` (new) | utility | transform (pure parse) | `stock-connect.ts`'s `clampCpuHistoryCount()` (pure validating function w/ doc-comment density) | role-match (no existing address parser; style-match only) |
| `stock-runstate.ts` (new) | service (event-projection) | event-driven | Pattern 1 sketch in RESEARCH.md, structurally closest to `stock-connect.ts`'s capability-settling pattern (`resolveCapabilities()` — settle once, cache on session) | role-match, no direct precedent |
| `stock-registers.ts` (new) | service + controller (catalog + handlers) | CRUD (get/set) + event-driven (cache-once) | `stock-connect.ts`'s `resolveCapabilities()`/`CapabilityDeps` (lazy-probe-then-cache-on-session idiom) for the catalog half; `stock-dispatch.ts`'s `viceHandlerPing` for the handler half | exact (handler half), role-match (catalog half — new sub-seam) |
| `stock-condition.ts` (new) | utility (AST + emitter + parser) | transform | No analog exists in this codebase — genuinely new design (typed AST + canonical emitter). Nearest *style* precedent: `stock-protocol.ts`'s `parseResponse()` (exhaustive switch, throws named errors, never partially-fixes bad input) | **no analog** — flagged below |
| `stock-checkpoints.ts` (new) | controller (handler family) | CRUD + event-driven (D-10 registry, D-11 rate limiter) | `stock-dispatch.ts`'s `viceHandlerPing` (handler shape: `ensureStockSession` → build body → `client.send` → format `StockToolResult`) | role-match |
| `stock-execution.ts` (new) | controller (handler family) | request-response + event-driven (runState gating) | `stock-dispatch.ts`'s `viceHandlerPing` | role-match |
| `stock-memory.ts` (new) | controller (handler family) | CRUD | `stock-dispatch.ts`'s `viceHandlerPing` | role-match |
| `stock-machine.ts` (new) | controller (handler family) | request-response + file-I/O (DUMP/UNDUMP/AUTOSTART paths) | `stock-dispatch.ts`'s `viceHandlerPing` for dispatch shape; `vice-sync.ts`'s `screenshot()` for the `hostpath.ts` file-I/O half | role-match (dispatch), exact (path translation) |
| `stock-petscii.ts` (new) | utility (static table) | transform | No analog exists — genuinely new (no ASCII↔PETSCII table anywhere in repo, confirmed by RESEARCH.md's own grep) | **no analog** — flagged below |
| `stock-protocol.ts` (modified — add encoders) | utility (pure encoders) | transform | `probe-binmon.mjs:265-340`'s already-tested `memGetBody`/`memSetBody`/`checkpointSetBody`/`cpNumBody`/`conditionSetBody` — port near-verbatim | exact (5 of ~14 encoders have a tested source to port; rest are `[CITED]`-only, same file's own encoding style) |
| `stock-dispatch.ts` (modified — ~20 table entries) | controller (dispatch table) | request-response | `stock-dispatch.ts`'s own existing `vice_ping` entry (`viceHandlerPing` + `STOCK_DISPATCH_TABLE`) | exact |
| `tools-manifest.stock.json` (modified — ~20 entries + outputSchema) | config | — | Its own existing `vice_ping` entry for `inputSchema`/description shape; **no `outputSchema` precedent anywhere in repo** | exact (inputSchema shape), **no analog** (outputSchema — must be invented, see below) |
| `tools-manifest.json` (modified — remove `vice_snapshot_list`, edit `vice_snapshot_load` description) | config | — | Itself, in place (surgical edit, not a new-file pattern question) | exact |
| `hostpath.ts` (modified — closed consumer set) | utility | file-I/O | `vice-sync.ts`'s `screenshot()` (existing consumer) | exact |
| `broker-launch.mts` (modified — `-remotemonitor` + 2nd port) | config/service (host launcher) | request-response (argv build) | `buildViceArgs()`'s own existing `backend === "stock"` branch, in place | exact |
| `broker-state.mts` (modified — `InstanceRecord` new field) | model | — | `InstanceRecord`'s own existing optional-field-groups convention (Plan 03's five fields, Plan 05's `monitorClient`) | exact |
| `stock-address.test.ts` (new) | test | — | `stock-connect.test.ts` (pure-function unit tests, no socket) | role-match |
| `stock-runstate.test.ts` (new) | test | event-driven | `stock-dispatch.test.ts` (feed synthetic events/stub client, assert derived state + call count) | role-match |
| `stock-condition.test.ts` (new) | test | — | `stock-protocol.test.ts` (golden-input/golden-output table style) | role-match |
| `stock-checkpoints.test.ts` (new) | test | CRUD + event-driven | `stock-dispatch.test.ts` (DI stub convention: fake `connect`, fake `client.send`) | exact |
| `stock-execution.test.ts` (new) | test | request-response | `stock-dispatch.test.ts` | exact |
| `stock-memory.test.ts` (new) | test | CRUD | `stock-dispatch.test.ts` + `stock-protocol.test.ts` (encoder round-trip) | exact |
| `stock-machine.test.ts` (new) | test | request-response + file-I/O | `stock-dispatch.test.ts` + `vice-sync.test.ts`'s stubbed-`hostpath` convention (per RESEARCH.md Focus Item 8, not directly read but named) | role-match |
| `stock-registers.test.ts` (new) | test | CRUD | `stock-dispatch.test.ts` | exact |
| `stock-petscii.test.ts` (new) | test | transform | No analog — exhaustive round-trip test is a new style for this repo, nearest kin is `stock-protocol.test.ts`'s exhaustive fixture tables | role-match |
| `stock-dispatch.test.ts` (modified — schema-conformance cases) | test | — | Itself, in place; the DI stub convention below | exact |
| `stock-protocol.test.ts` (modified — new encoder cases) | test | — | Itself, in place | exact |

## Pattern Assignments

### `stock-protocol.ts` — request-body encoders (utility, transform)

**Analog 1 (already-tested source to port near-verbatim):** `.claude/mcp/vice/probe-binmon.mjs:265-332`

```javascript
// MEM_GET (0x01) / MEM_SET (0x02) share the same 8-byte header layout:
// sidefx(1), start(u16LE), end(u16LE), memspace(1), bank(u16LE)
function memGetBody({ sidefx = 0, start, end, memspace = 0x00, bank = 0x0000 } = {}) {
  const body = Buffer.alloc(8);
  body[0] = sidefx;
  body.writeUInt16LE(start, 1);
  body.writeUInt16LE(end, 3);
  body[5] = memspace;
  body.writeUInt16LE(bank, 6);
  return body;
}

// CHECKPOINT_SET (0x12) request body: 8 bytes, or 9 with the optional memspace byte.
function checkpointSetBody({ start, end, stop = 1, enabled = 1, ops = 0x04, temporary = 1, memspace }) {
  const withMemspace = memspace !== undefined;
  const body = Buffer.alloc(withMemspace ? 9 : 8);
  body.writeUInt16LE(start, 0);
  body.writeUInt16LE(end, 2);
  body[4] = stop;
  body[5] = enabled;
  body[6] = ops; // e_exec = 0x04
  body[7] = temporary;
  if (withMemspace) body[8] = memspace;
  return body;
}

// CONDITION_SET (0x22): checkpointNum(u32LE), exprLen(1), expr ASCII, NOT NUL-terminated.
// Throws before encoding if expr exceeds 255 bytes (ASVS V5 control).
function conditionSetBody(checkpointNum, expr) {
  const exprBuf = Buffer.from(expr, "ascii");
  if (exprBuf.length > 255) throw new Error("CONDITION_SET expr exceeds 255 bytes");
  const body = Buffer.alloc(5 + exprBuf.length);
  body.writeUInt32LE(checkpointNum, 0);
  body[4] = exprBuf.length;
  exprBuf.copy(body, 5);
  return body;
}
```

Port these three (plus `memSetBody`/`cpNumBody`, same file lines 278-287/314-318) into `stock-protocol.ts` near-verbatim, same field order/offsets, converted to TypeScript with an options-object signature (never positional args, matching `stock-connect.ts`'s own convention per RESEARCH.md Focus Item 2).

**Analog 2 (`encodeRequestHeader()` — the sibling every new encoder sits beside):** `stock-protocol.ts:349-366`

```typescript
export interface EncodeRequestHeaderOptions {
  commandType: number;
  requestId: number;
  body?: Buffer;
}

/** Build the normative 11-byte binary-monitor request header
 * (docs/phase0-binmon-findings.md §5) plus body: STX, api_version, uint32 LE
 * body length, uint32 LE request id, command type byte. */
export function encodeRequestHeader({ commandType, requestId, body = Buffer.alloc(0) }: EncodeRequestHeaderOptions): Buffer {
  const header = Buffer.alloc(REQUEST_HEADER_LEN);
  header[0] = VICE_STX;
  header[1] = VICE_API_VERSION;
  header.writeUInt32LE(body.length >>> 0, 2);
  header.writeUInt32LE(requestId >>> 0, 6);
  header[10] = commandType;
  return Buffer.concat([header, body]);
}
```

Match new encoders' style exactly: JSDoc citing the wire spec section, `Options` interface named `<FunctionName>Options`, small pure function returning `Buffer`.

**Analog 3 (response parser style — `MemoryGet` case, `stock-protocol.ts:568-573`):**

```typescript
case ResponseType.MemoryGet: {
  need(body, 2, responseType, requestId);
  const length = body.readUInt16LE(0);
  need(body, 2 + length, responseType, requestId);
  return { type: "memory_get", requestId, errorCode, bytes: body.subarray(2, 2 + length) };
}
```

Note the `need()` bounds-check-before-every-read discipline (CR-01, `stock-protocol.ts:513-541`) — new encoders don't need `need()` (they build outgoing bytes, not parse incoming ones) but must match the same "provably total, never a bare throw out of an unguarded read" posture for any variable-length body they assemble (e.g. `conditionSetBody`'s explicit >255-byte guard is the encoder-side equivalent).

**`RegistersSet`'s per-item shape must mirror `RegisterInfo`'s parser** (structural inverse), per RESEARCH.md Focus Item 2 point 2 — the parser case is at `stock-protocol.ts:574-594` (grep `ResponseType.RegisterInfo`); write `registersSetBody()` beside it in the same file so the two stay in sync.

**Section-comment convention to open the new block with** (adapt from `stock-protocol.ts:46-48`'s section-header style):

```typescript
// ---------------------------------------------------------------------------
// Request-body encoders (Phase 3)
// ---------------------------------------------------------------------------
```

---

### `stock-dispatch.ts` — ~20 new `STOCK_DISPATCH_TABLE` entries (controller, request-response)

**Analog:** `stock-dispatch.ts`'s own existing `vice_ping` entry, `stock-dispatch.ts:412-446`

```typescript
async function viceHandlerPing(_args: Record<string, unknown>, deps: StockDispatchDeps): Promise<StockToolResult> {
  let outcome: EnsureStockSessionOutcome;
  try {
    outcome = await ensureStockSession(deps);
  } catch (err) {
    return convertHandshakeError("vice_ping", err);
  }

  if (!outcome.ok) {
    return isErrorText(outcome.message);
  }

  const session = outcome.session;
  const payload = { /* ...tool-specific fields... */ };
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: false };
}

const STOCK_DISPATCH_TABLE: Record<string, StockHandler> = {
  vice_ping: viceHandlerPing,
  // Phase 3 adds ~20 more entries here — same shape, never a parallel table.
};
```

Every new handler follows this exact shape: `ensureStockSession(deps)` first (never resolve a lease or open a socket directly — `ensureStockSession`'s own header comment at `stock-dispatch.ts:198-260` is explicit that this is the *only* path in), a `try/catch` around it feeding `convertHandshakeError(toolName, err)`, an `{ ok: false }` branch returning `outcome.message` verbatim, then the tool-specific body build → `session.client.send(CommandType.X, body)` → `StockToolResult` JSON payload. `StockHandler`'s type signature (`stock-dispatch.ts:350`) is `(args, deps) => Promise<StockToolResult>` — match it exactly so every new handler slots into `STOCK_DISPATCH_TABLE` with no adapter.

**`dispatchStock()` / `stockHandlerFor()`** (`stock-dispatch.ts:453-477`) are unchanged by Phase 3 — new entries are pure data added to the `STOCK_DISPATCH_TABLE` object literal; the lookup/refusal machinery around them needs no edits.

---

### `convertHandshakeError()` — shared pattern (apply to every new handler)

**Source:** `stock-dispatch.ts:361-398`

```typescript
function convertHandshakeError(toolName: string, err: unknown): StockErrorResult {
  if (err instanceof MonitorOwnershipError) {
    return isErrorText(
      `${toolName}: this instance's monitor socket is already claimed by a different grant ` +
        `(grant ${err.holderGrantId ?? "unknown"}, claimed at ${err.holderClaimedAt ?? "unknown"}, port ${err.port ?? "unknown"}) -- ` +
        `only one client may hold the stock monitor socket at a time.`,
    );
  }
  if (err instanceof MachineRestartedError) {
    return isErrorText(
      `${toolName}: the emulator's identity could not be proven across a reconnect ` +
        `(baseline epoch ${String(err.baselineEpoch)}, current epoch ${String(err.currentEpoch)}) -- ` +
        `treat every result since the previous call as void and retry.`,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/.test(message)) {
    return isErrorText(/* ...binmon-bind guidance... */);
  }
  return isErrorText(`${toolName}: stock handshake failed (${message}).`);
}
```

This is **the one error converter every handler reuses** — RESEARCH.md and CONTEXT.md both confirm there is no second converter anywhere. Every new handler's `try { outcome = await ensureStockSession(deps); } catch (err) { return convertHandshakeError("<tool_name>", err); }` block calls this exact function, unmodified, passing only its own tool name.

---

### `tools-manifest.stock.json` — ~20 new entries with `outputSchema` (config)

**Analog for `inputSchema`/description shape:** the file's one existing entry, `tools-manifest.stock.json:5-12`

```json
{
  "name": "vice_ping",
  "description": "Check if VICE is responding",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  }
}
```

For tools with fork counterparts, D-03 requires the `inputSchema` to match the fork's required fields exactly — e.g. `vice_checkpoint_add`'s fork entry (`tools-manifest.json:225-259`) has `start`/`end`/`stop`/`load`/`store`/`exec` with only `start` required; `vice_memory_read`'s fork entry (`tools-manifest.json:124-151`) has `address`/`size` required, `bank`/`encoding` optional. Copy the fork's property names/types/required list verbatim for the stock entry, then append any stock-only optional args (D-03) and the new `outputSchema`.

**`outputSchema` has NO existing precedent anywhere in the repo** — confirmed by `grep -c "outputSchema" tools-manifest.json` returning `0`, and `stock-dispatch.test.ts:87-95`'s own test ("every stock tool name also exists in the fork manifest with an identical `inputSchema`") only ever compares `inputSchema`. **This is a genuinely new contract the planner must design from scratch** (per D-02 and RESEARCH.md Focus Item 6's hand-rolled shape-checker sketch); there is no manifest entry, fork or stock, to copy the shape of. Recommended minimal shape per RESEARCH.md: `type`/`properties`/`required`/`items`/`enum` only (no `$ref`, no `oneOf`).

The existing test `stock-dispatch.test.ts:97-102` ("no DENY_LIST name appears in tools-manifest.stock.json") shows the manifest-testing idiom to extend:

```typescript
test("manifest/backend: no DENY_LIST name appears in tools-manifest.stock.json", () => {
  const stock = readManifest(STOCK_MANIFEST_PATH);
  for (const name of DENY_LIST) {
    assert.ok(!stock.tools.some((t) => t.name === name), `DENY_LIST name "${name}" must never appear in the stock manifest`);
  }
});
```

---

### `hostpath.ts` — D-17's path-translation table (utility, file-I/O)

**Analog (existing consumer, fork-side but structurally identical to what Phase 3 needs):** `vice-sync.ts:328-336`

```typescript
/**
 * VICE writes screenshots itself, on the HOST -- so the path handed to
 * vice_display_screenshot must be a host path, exactly like the one handed to
 * vice_disk_attach. Passing the container path silently fails.
 */
export async function screenshot(containerPath: string): Promise<string> {
  mkdirSync(dirname(containerPath), { recursive: true });
  const { hostPath } = await tryHostPaths(
    containerPath,
    (p: string) => call("vice_display_screenshot", { path: p }),
    { workspaceRoot: repoRoot() }
  );
  return hostPath;
}
```

Every Phase 3 handler with an emulator-side path argument (`vice_autostart`, `vice_disk_attach`, `vice_snapshot_save`, `vice_snapshot_load` — D-17's declared table) calls `tryHostPaths(constructedPath, (hostPath) => encodeAndSend(hostPath), { workspaceRoot: repoRoot() })` in exactly this shape — never `rewriteArguments()` (which lives inside `forwardToVice()` in `vice-proxy.ts:2773` and is structurally unreachable from the stock dispatch tree).

`hostpath.ts`'s exported surface consumed here (`hostpath.ts:168-259`): `hostPathCandidates()`, `hostPath()`, `tryHostPaths()`, `describe()` — all take an optional `workspaceRoot` and **never** import `repo-root.ts` directly (see the file's own header comment, `hostpath.ts:33-51`, on the three-module import cycle this avoids). New stock handlers must follow the same discipline: thread `repoRoot()` in from the caller, never import it inside `hostpath.ts` or add a new import cycle.

Confirmed current consumer set (`grep -l "from \"./hostpath"` / `hostpath.ts"`): `containerpath.test.ts`, `vice-sync.ts`, `vice-broker.mts`, `broker-state.test.ts`, `load-order.test.ts`, `vice-broker-client.ts`, `containerpath.ts`, `install-resources.ts`, `vice-proxy.test.ts`, `vice-proxy.ts`. D-17 adds `stock-machine.ts` (and whichever module ends up owning the declared path-translation table constant) to this list.

---

### `broker-launch.mts` — D-13's `-remotemonitor` + second port (config/service)

**Analog:** `buildViceArgs()`'s own existing stock branch, `broker-launch.mts:125-148`

```typescript
export function buildViceArgs(
  port: number,
  { backend, mcpHost, binmonHost, viceArgsEnv }: { backend: ViceBackend; mcpHost?: string; binmonHost?: string; viceArgsEnv?: string },
): string[] {
  const rawViceArgs = viceArgsEnv ?? process.env.VICE_ARGS;
  if (typeof rawViceArgs === "string" && rawViceArgs.trim() !== "") {
    return rawViceArgs.trim().split(/\s+/);
  }
  if (backend === "stock") {
    const host = binmonHost ?? process.env.VICE_BROKER_BINMON_HOST ?? "127.0.0.1";
    if (host !== "127.0.0.1" && !warnedBinmonBindWidened) {
      warnedBinmonBindWidened = true;
      process.stderr.write(/* ...one-time widened-bind warning... */);
    }
    return ["-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`];
  }
  const host = mcpHost ?? process.env.VICE_BROKER_MCP_HOST ?? "0.0.0.0";
  return ["-mcpserver", "-mcpserverhost", host, "-mcpserverport", String(port)];
}
```

Extend the `backend === "stock"` branch to accept a second port parameter and append `-remotemonitor -remotemonitoraddress ip4://<host>:<secondPort>` (flag spelling `[ASSUMED]` per RESEARCH.md Assumption A1 — verify against the manual during implementation, not blocking). Reuse the exact one-time-warning gate idiom (`warnedBinmonBindWidened`, `broker-launch.mts:99`) if the second port's bind also needs a widened-exposure note — same pattern, new boolean.

**`spawnAndRecordInstance()`** (`broker-launch.mts:191-219`) is the single call site that both builds argv via `buildViceArgs()` and constructs the `InstanceRecord` — a `remoteMonitorPort` field must be threaded through both in the same function, mirroring how `port`/`viceArgs` already flow through together.

**CRITICAL — build obligation:** `broker-launch.mts` is one of the seven `.mts` files `build.ts` compiles into committed `resources/*.mjs`. Any edit here **must** be followed by `node build.ts` before commit, or `resources-sync.test.ts` fails CI (RESEARCH.md Focus Item 8, point 5) — this is mechanically checked, not a style preference.

---

### `broker-state.mts` — `InstanceRecord`'s new `remoteMonitorPort` field (model)

**Analog:** `InstanceRecord`'s own existing optional-field-group convention, `broker-state.mts:19-115`

```typescript
export interface InstanceRecord {
  port: number;
  url: string;
  state: InstanceState;
  reason: string;
  epochFile: string;
  supervisorDir: string;
  pid: number | null;
  expectedIdentity: string;
  launchedAt: number;
  readyAt: number | null;
  viceBin: string;
  viceArgs: string[];
  dryRun: boolean;
  // ------------------------------------------------------------------
  // Plan 03 (C2/D-23): the per-child supervisor's own bookkeeping fields.
  // Optional -- a record created through a path that does not supervise
  // remains a valid InstanceRecord without them; ...
  // ------------------------------------------------------------------
  epoch?: number;
  deliberateKill?: boolean;
  respawnAfterKill?: boolean;
  crashTimes?: number[];
  backoffMs?: number;
  logPath?: string;
  // ------------------------------------------------------------------
  // Plan 05 (BROK-02/PROTO-08, D-13/D-15): exclusive monitor-socket
  // ownership, enforced broker-side. Optional -- additive, same convention...
  // ------------------------------------------------------------------
  monitorClient?: { grantId: string; claimedAt: number; pid: number | null };
}
```

Add `remoteMonitorPort?: number` as a new optional field group, with its own section-comment banner naming the plan/decision that introduces it (D-13), following this exact "optional, additive, banner-commented group" idiom — never a required field (would break every existing `InstanceRecord` literal in tests that predates this phase).

**Per RESEARCH.md Focus Item 8, point 4 (explicit planner guidance, not left implicit):** `monitor_claim`/`monitor_release` do **NOT** need to change in Phase 3 — `InstanceRecord.monitorClient` stays a single field per instance; leave the second (text-monitor) socket's ownership deliberately unclaimed in Phase 3, since nothing dials it yet. Do not add a `channel` discriminator speculatively.

---

### Representative `*.test.ts` — dependency-injection stubbing convention

**Analog:** `stock-dispatch.test.ts:1-133`

```typescript
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
// ...

beforeEach(() => {
  clearHeldStockSession();
});

const STUB_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

// stockConnect()'s own StockConnectOptions.brokerControl (and
// StockConnectSession.brokerControl) is typed as the narrower
// StockConnectBrokerControl (claimMonitor/releaseMonitor only) -- alias it
// off StockConnectSession itself rather than importing a second name...
type FakeSessionBrokerControl = StockConnectSession["brokerControl"];
```

Key conventions to replicate for every new `*.test.ts`:
- `beforeEach()` clears whatever module-level held state exists (`clearHeldStockSession()` here; a new tracker/registry module needs the equivalent reset hook).
- Stubs are **two-method plain objects cast via `as unknown as <RealType>`** — never a real socket, never a real broker control session opened by the test (comment at `stock-dispatch.test.ts:104-112`: "every `connect`/`reconnect` is a spy stub... these tests assert WIRING (call order, call count, field identity), never protocol shape").
- Tests assert **call order / call count / field identity** — e.g. "asserting `send()` is/isn't called" for D-08's no-wire-traffic-on-retry criterion (RESEARCH.md's own DIRECT-05 test-map row) is this exact idiom: stub `client.send` as a counting spy, assert it was/wasn't invoked.
- `encodeResponseFrame()` from `binmon-fixtures.ts` is the existing fixture-frame builder for constructing synthetic wire bytes in tests — reuse it rather than hand-building frame bytes inline.

---

### The long structured header-comment convention (quote in full — new modules must match density)

**Full header, `stock-connect.ts:1-32`:**

```typescript
#!/usr/bin/env node
// stock-connect.ts
//
// The ONE place that performs the stock connect handshake: claim the
// monitor socket from the broker (BEFORE any TCP dial), open a
// ViceMonitorClient, assert the wire's api_version, read the connected
// build's identity via VICE_INFO, settle its version-gated capabilities
// exactly once per binary (BACK-04 -- at connect time, not at first use),
// and detect whether the machine underneath a reconnect is the SAME machine
// this client originally handshook with.
//
// WHY THIS FILE EXISTS: stock-protocol.ts's ViceMonitorClient deliberately
// answers only "this socket died" (see its own header comment on D-11) --
// it never decides whether a freshly reconnected socket belongs to the same
// emulator process. backend-detect.mts's capability cache is written once
// per binary by a --help probe that cannot observe a version quad at all
// (that file's own header comment says as much). Something has to sit
// between those two files and turn "a claimed, connected,
// api_version-checked socket" into "a named build with settled
// capabilities, whose continued identity across a reconnect is provable" --
// this file is that seam.
//
// WHAT NOT TO DO:
//   - Never re-derive an epoch or restart heuristic here. vice.ts's
//     MachineRestartedError is the ONE restart-error type this whole module
//     tree uses (D-11); reuse it, do not define a second one.
//   - Never dial the binmon port before claimMonitor() has succeeded --
//     stock VICE services exactly one client, and a refused claim must
//     arrive as a JSON response on a working control-plane socket, never as
//     a connect() that silently sits unserviced in the backlog (PROTO-08,
//     D-13, vice-broker-client.ts's own MonitorOwnershipError header
//     comment).
```

**Every new Phase 3 module needs this same three-part shape:**
1. **WHAT this file is the one authoritative place for** ("the ONE place that...").
2. **WHY it exists** — what gap between two existing files it fills, named specifically (not "for organization").
3. **WHAT NOT TO DO** — naming the specific anti-pattern with its rationale, referencing the exact decision ID (D-04, D-06, D-09, D-10, D-11...) that forbids it. E.g. `stock-condition.ts`'s header must say "never string-concatenate a condition — that is exactly how a silently-always-false condition ships (unparenthesised `&&`, decimal literal, wrong-case register); D-09/D-10 exist to make this class of bug structurally unreachable."

`stock-protocol.ts:1-40`'s header is the second reference instance (attribution + defect-fix enumeration + "what NOT to do" — quoted in full above under the Pattern Assignments section's protocol-encoder analog); use whichever of the two is closer to each new file's own nature (a from-scratch design like `stock-condition.ts` fits `stock-connect.ts`'s "WHY THIS FILE EXISTS" shape better than `stock-protocol.ts`'s "ported from a vendor, defects fixed" shape, which does not apply to genuinely new modules).

---

### Runtime narrowing at JSON boundaries — `isPlainObject()` (shared pattern, apply to every new handler's argument parsing)

**Canonical definition, `vice.ts:310-316`:**

```typescript
/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches vice-broker.mts's / vice-broker-client.ts's own
 * isPlainObject() predicate exactly -- the same narrowing discipline this
 * module tree uses everywhere a parsed JSON value's fields are touched. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

This exact predicate is independently redeclared (not imported — each module keeps its own private copy, per the existing convention in `vice.ts`, `vice-broker-client.ts`, `backend-detect.mts`, `install-resources.ts`, `vice-probe.ts`) in every file that narrows a JSON boundary. New Phase 3 handler modules parsing `args: Record<string, unknown>` fields (e.g. `args.start`, `args.condition` as string-or-object per D-09) should declare the same private `isPlainObject()` and use it — e.g. for D-09's structured-condition-object branch: `if (isPlainObject(args.condition)) { /* structured form */ } else if (typeof args.condition === "string") { /* string form */ }`.

## Shared Patterns

### Session acquisition — `ensureStockSession(deps)`
**Source:** `stock-dispatch.ts:198-264`
**Apply to:** every new handler in `stock-memory.ts`, `stock-registers.ts`, `stock-checkpoints.ts`, `stock-execution.ts`, `stock-machine.ts`
No handler resolves a lease or opens a socket of its own — always `await ensureStockSession(deps)` first, exactly as `viceHandlerPing` does.

### Error conversion — `convertHandshakeError(toolName, err)`
**Source:** `stock-dispatch.ts:361-398`
**Apply to:** every new handler's `catch` block around `ensureStockSession()`. Never write a second converter; never mention "wedge"/"hung"/"unresponsive" from a handler.

### Dispatch table registration
**Source:** `stock-dispatch.ts:444-446` (`STOCK_DISPATCH_TABLE`)
**Apply to:** every new tool name. One object literal, one entry per tool, never a second table or a second `dispatchStock(` call site in `vice-proxy.ts`.

### Path translation for emulator-side arguments
**Source:** `vice-sync.ts:328-336` (`screenshot()`), `hostpath.ts:237-259` (`tryHostPaths()`)
**Apply to:** `vice_autostart`, `vice_disk_attach`, `vice_snapshot_save`, `vice_snapshot_load` handlers in `stock-machine.ts` only (D-17's declared table) — never `rewriteArguments()`.

### `isPlainObject()` runtime narrowing
**Source:** `vice.ts:310-316` (canonical), re-declared privately per consuming module
**Apply to:** every new handler's `args: Record<string, unknown>` field access, and D-09's condition-argument string-or-object discrimination specifically.

### Long structured header comments
**Source:** `stock-connect.ts:1-32`, `stock-protocol.ts:1-40`
**Apply to:** every new file (`stock-address.ts`, `stock-runstate.ts`, `stock-registers.ts`, `stock-condition.ts`, `stock-checkpoints.ts`, `stock-execution.ts`, `stock-memory.ts`, `stock-machine.ts`, `stock-petscii.ts`) — WHAT/WHY/WHAT-NOT-TO-DO, naming the specific decision ID.

### DI stubbing / test convention
**Source:** `stock-dispatch.test.ts:1-133`
**Apply to:** every new `*.test.ts` — `beforeEach()` reset hook, two-method stub objects cast via `as unknown as <RealType>`, assertions on call order/count/identity rather than real sockets, `encodeResponseFrame()` from `binmon-fixtures.ts` for synthetic wire bytes.

## No Analog Found

Files/sub-designs with no existing structural precedent in this codebase — the planner must treat these as genuinely new design, following only the *style* conventions above (header comments, error hierarchy, `isPlainObject()`, DI-stubbed tests), not a code shape to copy:

| File / Sub-design | Role | Data Flow | Reason |
|---|---|---|---|
| `stock-condition.ts` (typed AST + canonical emitter + string parser) | utility | transform | No condition-building code exists anywhere in the repo today; this is a from-scratch typed-AST design driven entirely by the VICE parser traps documented in CLAUDE.md (uppercase `RL`/`CY`, no operator precedence, hex-by-default literals). Nearest *style* precedent is `parseResponse()`'s exhaustive-switch/throw-named-error discipline in `stock-protocol.ts`, not a structural analog. |
| `stock-petscii.ts` (ASCII↔PETSCII table) | utility | transform | RESEARCH.md confirms (via its own grep) no ASCII/PETSCII conversion exists anywhere in this codebase or its skills — the previous custom fork did this server-side in C. Build as a static table + exhaustive round-trip test; no existing table to port. |
| `stock-runstate.ts`'s tracker (event-projection state machine) | service | event-driven | No existing module projects `ViceMonitorClient`'s `'event'` stream into a derived, cached state value. `stock-connect.ts`'s `resolveCapabilities()` (settle-once-per-binary, cache-on-session) is the closest *philosophical* kin (RESEARCH.md's own framing) but is a one-shot probe, not a continuously-updated event listener — do not copy its structure literally, only its "single seam, attached once" discipline. |
| `stock-registers.ts`'s register catalog (`Map<string,{id,size}>` built from `REGISTERS_AVAILABLE`, cached per session via `WeakMap`) | service | CRUD (lazy fetch + cache) | No existing per-session `WeakMap`-keyed cache exists in this module tree; `resolveCapabilities()` caches on a record written to disk (`writeCapabilityRecord()`), a different mechanism (persistent, cross-process) from what this catalog needs (in-memory, per-connection-object). Treat as new. |
| D-11's rate-limiter + deferred auto-disable (`setImmediate()` or next-dispatch-check design, inside `stock-checkpoints.ts`) | service | event-driven | No existing code in this repo defers a `send()` call out of an event-handler call stack. RESEARCH.md's own Assumption A4 flags this as "this session's own synthesis," not sourced from any existing pattern — implement per the two options RESEARCH.md's Focus Item 5 offers, and treat the "never send from inside the event handler" rule (stated as an established anti-pattern in RESEARCH.md, not demonstrated in existing code since no event-driven sender exists yet) as the binding constraint, not a structural template. |
| `tools-manifest.stock.json`'s `outputSchema` field + its hand-rolled shape-checker | config + utility | — | Confirmed zero occurrences of `outputSchema` anywhere in the repo (`grep -c` = 0). D-02's enforced contract is a wholly new mechanism; RESEARCH.md's Focus Item 6 sketch (`checkAgainstSchema(value, schema)`, ~40 lines, covering `type`/`properties`/`required`/`items`/`enum` only) is the only guidance available — there is no existing schema-checker to copy. |
| D-04's symbol-resolution hook inside `stock-address.ts` (empty in Phase 3) | utility | transform | No symbol store exists yet (arrives in Phase 5, DERIV-04) — this is a deliberately empty extension point, not a partial analog. Design the hook's shape now; do not implement resolution. |

## Metadata

**Analog search scope:** `.claude/mcp/vice/` (all `.ts`/`.mts` source and colocated `.test.ts` files); `.claude/mcp/vice/probe-binmon.mjs`; `.claude/mcp/vice/tools-manifest.json` / `tools-manifest.stock.json`.
**Files scanned (read in full or targeted):** `stock-protocol.ts` (header, encoder section, parser section, correlation tables), `stock-dispatch.ts` (full), `stock-connect.ts` (header + capability section), `stock-dispatch.test.ts` (header + Task 1/2 sections), `hostpath.ts` (full), `vice-sync.ts` (screenshot section), `broker-launch.mts` (buildViceArgs + spawnAndRecordInstance sections), `broker-state.mts` (InstanceRecord + clearMonitorClient), `tools-manifest.stock.json` (full, 14 lines), `tools-manifest.json` (grepped: `vice_memory_read`, `vice_checkpoint_add`, `vice_disk_attach`, `vice_disk_detach`, `vice_snapshot_load`/`vice_snapshot_list`, `outputSchema` occurrence count), `probe-binmon.mjs` (encoder section, lines 260-340), `vice.ts` (`isPlainObject()` definition).
**Pattern extraction date:** 2026-08-14
