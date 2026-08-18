# Phase 7: Cycle Timing and Wedge Triage - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 13 (3 new production + 3 new test + 5 modified + 2 doc)
**Analogs found:** 13 / 13 (every file has at least a role-match; several are direct/exact)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `.claude/mcp/vice/stock-timing.ts` | service (derived tool handler) | request-response (composed reads) | `.claude/mcp/vice/stock-vicii.ts` / `stock-registers.ts` (DERIV-05 composed-read derived tool) | role-match (same `withDerivedTool({needsSession:true})` shape; no prior tool does version-gated dual-route arithmetic, so the *route-selection* half is first-of-its-kind) |
| `.claude/mcp/vice/stock-timing.test.ts` | test | unit, DI-stub | `.claude/mcp/vice/stock-checkpoints.test.ts` (fake-client + spy `send()` convention) | exact (same DI-stub harness pattern) |
| `.claude/mcp/vice/stock-run-until.ts` | service (derived tool handler) | event-driven (checkpoint set + resume + wait + conditional cleanup) | `.claude/mcp/vice/stock-checkpoints.ts` (`isCheckpointInfoEvent`/D-11 trace guard) for the event-narrowing half; `vice-sync.ts`'s `waitCheckpointHit()` for the wait-loop *shape* (algorithm analog, wrong transport) | role-match (event-narrowing is exact; the wait itself has no direct stock analog — first-of-its-kind plumbing per RESEARCH.md's own "Don't Hand-Roll" table) |
| `.claude/mcp/vice/stock-run-until.test.ts` | test | unit, DI-stub | `.claude/mcp/vice/stock-checkpoints.test.ts` | exact (same harness; the event emission is `client.emit("event", ...)` via the fake `EventEmitter`) |
| `.claude/mcp/vice/stock-diagnose.ts` | service (derived tool handler, ported algorithm) | request-response (composed reads) + special-cased error verdicts | `.claude/mcp/vice/vice-proxy.ts`'s `gatherCheckpointTrapEvidence()`/`resolveLiveIrqHandler()`/`classifyLiveness()` (the algorithm to port) + `stock-handler.ts`'s `convertHandshakeError()` (the verdict-from-error-type pattern) | role-match for the composition shape; the *algorithm* is a direct port (transport swapped, logic unchanged) |
| `.claude/mcp/vice/stock-diagnose.test.ts` | test | unit, DI-stub | `.claude/mcp/vice/stock-checkpoints.test.ts` | exact |
| `.claude/mcp/vice/stock-connect.ts` (modify `probeCpuHistory()`) | service (capability probe) | request-response | itself — this is a bugfix to existing code, not a new pattern; `stock-connect.test.ts:120-149`'s `happyPathResponder()` `cpuHistoryErrorCode` parameter is the exact test seam already built for this fix | exact (fixing in place) |
| `.claude/mcp/vice/stock-protocol.ts` (add `CPUHISTORY_GET` parser case) | utility (wire decoder) | transform | `stock-protocol.ts`'s own `ResponseType.CheckpointInfo` case (`stock-protocol.ts:1229-1247`) — closest existing parser case by structural shape (fixed-then-variable layout with a `need()` guard) | exact (same file, same switch, sibling case) |
| `.claude/mcp/vice/stock-protocol.ts` (add `RESOURCE_GET` encoder + parser case) | utility (wire encoder/decoder) | transform | Encoder analog: `requireAsciiFilename()` (`stock-protocol.ts:900-915`, length-prefixed ASCII body) and `checkpointSetBody()` (`stock-protocol.ts:573-601`, options-object-to-Buffer). Parser analog: `ResponseType.MemoryGet` case (`stock-protocol.ts:1141-1146`, one-length-then-payload shape) | exact (same file, same conventions) |
| `.claude/mcp/vice/stock-connect.test.ts` (add 0x81 fixture) | test | unit, DI-stub | itself — extend the existing `happyPathResponder({cpuHistoryErrorCode})` parametrization already in the file (`stock-connect.test.ts:104-149`) | exact |
| `.claude/mcp/vice/tools-manifest.stock.json` (3 new entries) | config (manifest) | — | Any existing entry, e.g. `vice_sprite_inspect` (34-tool file, read live) | exact (copy shape) |
| `.claude/skills/vice-wedge-triage/SKILL.md` (stock route) | config/doc | — | itself — add a stock-specific route note | n/a — doc edit |
| `docs/stock-vice-parity.md`, `docs/phase0-binmon-findings.md` | doc | — | itself | n/a — doc edit |

## Pattern Assignments

### `.claude/mcp/vice/stock-timing.ts` (service, request-response)

**Analog for registration:** `.claude/mcp/vice/stock-dispatch.ts` (the one seam every derived tool goes through) + `.claude/mcp/vice/stock-derived.ts` (the registry).

**Registration site** (`stock-dispatch.ts:612-629`, copy this exact shape):
```typescript
// derived (DERIV-06)
vice_sprite_get: withDerivedTool("vice_sprite_get", { needsSession: true }, handleSpriteGet),
vice_sprite_inspect: withDerivedTool("vice_sprite_inspect", { needsSession: true }, handleSpriteInspect),
```
Add three lines the same shape, e.g.:
```typescript
// derived (TIME-01)
vice_cycles_stopwatch: withDerivedTool("vice_cycles_stopwatch", { needsSession: true }, handleCyclesStopwatch),
// derived (TIME-02)
vice_run_until: withDerivedTool("vice_run_until", { needsSession: true }, handleRunUntil),
// derived (TIME-04) -- vice-proxy.ts's DIAGNOSE_TOOL already routes here via
// buildBackendAwareTool(); no vice-proxy.ts change needed.
vice_diagnose: withDerivedTool("vice_diagnose", { needsSession: true }, handleDiagnoseStock),
```
Also add the three new imports beside the existing family-module import block (`stock-dispatch.ts:49-68`), and add the three tool names to `STOCK_DERIVED_TOOLS` (`stock-derived.ts:82-92`) — **required**: `withDerivedTool()` refuses at call time (`stock-dispatch.ts:492-493`) any tool name not present in that set, and package.json's `files[]` must gain the new module in the **same commit** (`stock-derived.ts:53-57`'s own warning) or the published tarball fails at module load.

**Capability-gated route selection** (Pattern 2 in RESEARCH.md, already the exact field to read): `session.capabilities.cpuHistory` is the `CpuHistoryCapability` type defined at `stock-connect.ts:67-70`, resolved once per connect by `resolveCapabilities()` (`stock-connect.ts:129-153`). Read it, branch, never re-probe.

**Request/response shape to build in `stock-protocol.ts` first (Wave 0):**
- Existing encoder for the shape "small fixed body, `requireU32`-style guard" — `checkpointSetBody()` (`stock-protocol.ts:573-601`) and `cpNumBody()` (`stock-protocol.ts:545-550`) are the closest precedent for a compact options-object encoder. `CPUHISTORY_GET`'s request body is already sent correctly by `probeCpuHistory()` (`stock-connect.ts:103-118`, just needs `count=1` and a fixed-up outcome map) — **no new encoder needed for the request side, only the response parser case.**
- Missing parser case (Pitfall 6): add a `case ResponseType.CpuHistoryGet:` to the `parseResponse()` switch (`stock-protocol.ts:1140-1324`), modeled on the closest sibling shape, `ResponseType.CheckpointInfo` (`stock-protocol.ts:1229-1247`):
```typescript
case ResponseType.CheckpointInfo: {
  // 22 = the last field's own extent: hasCondition sits at body[21].
  need(body, 22, responseType, requestId);
  const operation = body[11] ?? 0x04;
  const checkpoint: ParsedCheckpoint = {
    id: body.readUInt32LE(0),
    currentlyHit: body[4] === 1,
    // ...
  };
  return { type: "checkpoint_info", requestId, errorCode, checkpoint };
}
```
Per RESEARCH.md Pitfall 6, `CPUHISTORY_GET`'s body is `count(u32LE)` then per-entry `item_size(1)` + register block (skip) + `cycle(u64LE)` + 5 more bytes; only the newest (first) entry's `cycle` u64 matters. Use `need()` (`stock-protocol.ts:1107-1114`) before every offset read, exactly like every existing case — this is the file's own hard rule ("never add a `case` here that reads at a fixed or wire-derived offset without a preceding `need()`", `stock-protocol.ts:1102-1105`).

**`RESOURCE_GET` encoder (Pitfall 7, new):** modeled on `requireAsciiFilename()`'s length-prefixed-ASCII discipline (`stock-protocol.ts:900-915`) — `name_length(1) + name(ASCII, not NUL-terminated)`. Parser case modeled on `ResponseType.MemoryGet` (`stock-protocol.ts:1141-1146`, a length-then-payload shape): `type(1)` then for the integer case, `size(1)=4` + `value(u32LE)`.

**Video-standard/frame-position arithmetic:** no existing analog in this tree (first-of-its-kind, per RESEARCH.md's Pattern 3/Code Examples). Use the `VIDEO_STANDARDS` table and `positionWithinFrame()`/`reconstructWithinFrame()` sketch already given verbatim in `07-RESEARCH.md`'s Pattern 3 and Code Examples sections — treat that as the reference implementation, cross-checked against `vice/src/c64/c64.h:36-58` and `machine.h:57-60`.

**LIN/CYC access — no new register-fetch path.** `stock-registers.ts`'s existing `registerCatalogFor()`/`handleRegistersGet()` (`stock-registers.ts` ~145-200, read live) already surfaces `LIN`/`CYC` generically by name in the `registers` map returned to a caller of `vice_registers_get` — reuse `handleRegistersGet`'s underlying `session.client.send(CommandType.RegistersGet, memspaceBody({memspace: 0x00}))` call directly inside `stock-timing.ts`, do not add a second register-catalog mechanism.

### `.claude/mcp/vice/stock-run-until.ts` (service, event-driven)

**Registration:** identical shape to `stock-timing.ts` above (`stock-dispatch.ts:612-629`, `stock-derived.ts:82-92`).

**`CHECKPOINT_SET` with `temporary:true`** — already supported, already live-confirmed (`docs/phase1-probe-results.md` item 1). Encoder: `checkpointSetBody()` (`stock-protocol.ts:567-601`), verbatim:
```typescript
export function checkpointSetBody({
  start, end, stop = true, enabled = true, operation, temporary = false, memspace,
}: CheckpointSetBodyOptions): Buffer {
  // ... body[7] = temporary ? 0x01 : 0x00;
}
```
`vice_run_until` is this codebase's **first caller** to ever pass `temporary: true` — every existing caller (`stock-checkpoints.ts:476-479` `handleCheckpointAdd`, and `stock-checkpoints.ts:755`) hardcodes `temporary: false` with the comment "the fork exposes no such argument, and vice-sync.ts's ... invariant" — read that comment before writing this file so the new call site's intent is unambiguous to a future reviewer.

**Event narrowing for the matching `CHECKPOINT_INFO`** — copy `stock-checkpoints.ts`'s D-11 pattern exactly (`stock-checkpoints.ts:303-361`):
```typescript
function isCheckpointInfoEvent(item: unknown): item is ParsedCheckpointInfoResponse {
  return isPlainObject(item) && item.type === "checkpoint_info" && isPlainObject(item.checkpoint);
}
// ...
client.on("event", (item: unknown) => {
  if (!isCheckpointInfoEvent(item)) return;
  const id = item.checkpoint.id;
  if (id !== myCheckpointId) return; // narrow to THIS wait's own checkpoint
  // ...
});
```
Never key on response type alone — key on the parsed event's own `.type` discriminant then the checkpoint id, exactly as `stock-checkpoints.ts:308-311` does.

**The wait loop itself has no direct stock analog.** The closest algorithm-shape precedent is `vice-sync.ts`'s `waitCheckpointHit()` (`vice-sync.ts:227-258`) — read it for the *shape* (check-before-resume, exactly one resume, poll on the checkpoint's own hit state, one final read after a deadline) but **do not port its transport**: it polls via `vice_ping` (non-pausing on the fork only) in a `sleep()` loop, which does not exist on stock. Port to an **event-driven** `Promise.race([eventPromise, timeoutPromise])`-shaped wait instead (RESEARCH.md's Alternatives Considered table: "no existing helper of this shape exists in this tree... this phase is the first consumer, so it is new plumbing, not a reuse").

**IMPORTANT — do not unit-test `vice-sync.ts`'s own invariants as a model.** `vice-sync.ts`'s header (`vice-sync.ts:14-44`) states its three invariants (exactly one resume per wait; poll on `hit_count` never on paused state; never delete a VICE-marked temporary checkpoint) are **deliberately NOT unit-tested** — "each is only meaningful against a real emulator's timing... a stub server answering fast and deterministically would prove nothing." `stock-run-until.test.ts` is **not** exempt from testing in the same way, because its own event-driven design (unlike `vice-sync.ts`'s poll loop) is deterministic against a fake `EventEmitter` — the call-count and cleanup-path assertions in `07-VALIDATION.md`'s Per-Task Verification Map are exactly the mechanical checks that ARE meaningful here (temporary flag on the wire body, zero `CHECKPOINT_DELETE` calls on the hit path, exactly one delete attempt + `ObjectMissing` tolerance on timeout). Do not use `vice-sync.test.ts`'s "named todo, no fixture" disposition as a precedent for skipping these — that disposition applies to a *polling* design against *unpredictable real timing*, not to this event-driven design driven by a synthetic client.

**Cleanup-path pattern (Pattern 4/Pitfall 4 in RESEARCH.md, no existing code, use the sketch given there):**
```typescript
// stock-run-until.ts -- success path
const hitEvent = await waitForCheckpointHit(session.client, checkpointId, timeoutMs);
if (hitEvent) {
  // VICE already deleted this checkpoint (mon_breakpoint.c:605-607). Do NOT call
  // CHECKPOINT_DELETE here.
  return stockAnswer(session.client, { requested: "run_until", reached: true, address, hitCount: hitEvent.checkpoint.hitCount });
}
// timeout path: attempt CHECKPOINT_DELETE, tolerate ErrorCode.ObjectMissing as benign
```
`ErrorCode.ObjectMissing`'s already-explanatory text lives in `stock-handler.ts:141` (`WIRE_ERROR_TEXT[ErrorCode.ObjectMissing]`) — reuse that constant, do not hardcode `0x01` a second time.

**Address parsing** — `stock-address.ts:111` `parseAddress(input, opts)` is the existing, exclusive address-parsing entry point every other family module uses; `vice_run_until`'s `address` argument must go through it, matching every other family's discipline (RESEARCH.md Security Domain, V5).

**`timeout_ms` clamping** — model on `stock-connect.ts:91-94`'s `clampCpuHistoryCount()`:
```typescript
export function clampCpuHistoryCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(Math.trunc(count), 0), CPU_HISTORY_MAX_COUNT);
}
```
Copy this finite/trunc/bounds discipline for the new stock-only `timeout_ms` argument (never unbounded, never negative, never NaN) — this project's own established precedent for a numeric wire-adjacent argument (RESEARCH.md Security Domain / Known Threat Patterns).

**Note on the `CommandType.Exit` grep-gate convention:** `stock-execution.ts:22-24` documents "grep-gated to exactly one `CommandType.Exit` occurrence **in this file's code lines**" for `handleExecutionRun`'s exclusive resume licence. That gate is per-file, not global — `stock-connect.ts:242` and `stock-machine.ts:85` already send `EXIT` from their own files for their own reasons. `stock-run-until.ts` sending its own `EXIT` to resume after arming the temporary checkpoint is consistent with this precedent (a new file, its own single `CommandType.Exit` occurrence) — do not treat `stock-execution.ts`'s gate as forbidding a second file from ever sending `EXIT`.

### `.claude/mcp/vice/stock-diagnose.ts` (service, ported algorithm)

**Registration:** identical shape (`stock-dispatch.ts:612-629`, `stock-derived.ts:82-92`). No `vice-proxy.ts` change needed — confirmed live: `DIAGNOSE_TOOL` is already registered via `buildBackendAwareTool()` at `vice-proxy.ts:3192`, which already routes to `stockDispatch.dispatchStock()` on the stock arm (`vice-proxy.ts:3166-3176`); only the `STOCK_DISPATCH_TABLE` entry is missing today (a call reaches `dispatchStock()`'s miss branch, `stock-dispatch.ts:652-661`, and is refused by name).

**The `forwardToVice()`/`rewriteArguments()` interception constraint, located exactly:** `rewriteArguments()` is called at **`vice-proxy.ts:2889`**, inside `forwardToVice()` (`vice-proxy.ts:2824-2913`) — CLAUDE.md's cited line number (2773) has drifted with subsequent edits; 2889 is the current, confirmed call site. `forwardToVice()` is the fork-only HTTP-forwarding path; `dispatchStock()` (`stock-dispatch.ts:652-661`) never calls it and has no code reference to that name at all (grep-gated, per that file's own header comment `stock-dispatch.ts:389-395`). Every one of this phase's three new handlers reaches `dispatchStock()` through `buildBackendAwareTool()` (`vice-proxy.ts:3166-3176`) **before** any fork-transport code exists in the call path — this is what "intercepted before `forwardToVice()`" means concretely: there is no `forwardToVice()` call anywhere upstream of `withDerivedTool()`'s handler on the stock arm, structurally, not just by convention.

**Second cited site, `gatherWedgeEvidence()`'s own `rewriteArguments()` call:** `vice-proxy.ts:1368` (inside `gatherWedgeEvidence()`, `vice-proxy.ts:1344-1374`) calls `rewriteArguments({ path: screenshotContainerPath }, "vice_display_screenshot")` directly — this is fork-only code (`handleRecycle()` is backend-aware and refused by name on stock after CR-07, so `gatherWedgeEvidence()` is currently unreachable on stock). If this phase also builds a stock-native evidence gatherer for `vice_recycle` (Open Question 1 in RESEARCH.md — flagged, not decided), that gatherer must be a **new, stock-native function** that never calls `rewriteArguments()` at all — per `stock-derived.ts:37-42`'s own "WHAT NOT TO DO" list: "Never `import` vice-proxy.ts, and never call `rewriteArguments()`."

**Ported algorithm — three pieces, cite exactly which lines are fork-transport-coupled vs. pure-algorithm-portable:**

1. **`resolveLiveIrqHandler()`** (`vice-proxy.ts:893-922`) — pure algorithm, fork-transport-coupled only at its three `call("vice_memory_read", ...)` invocations (`vice-proxy.ts:894, 899, 912`). Port: replace each with `session.client.send(CommandType.MemoryGet, memGetBody({ start, end, memspace: 0x00 }))` (the stock-native call `stock-memory.ts`'s own `handleMemoryRead` already uses) and decode via `response.bytes`. The bit-masking logic (`HIRAM_MASK`, `vice-proxy.ts:873`), the RAM-vs-hardware-vector branch (`vice-proxy.ts:902-921`), and the returned `IrqHandlerResolution` shape are **portable unchanged**.

2. **`gatherCheckpointTrapEvidence()`** (`vice-proxy.ts:956-985`) — fork-transport-coupled only at its three `call(...)` invocations (`vice-proxy.ts:957` `vice_checkpoint_list`, `963` `vice_registers_get`, `966` `resolveLiveIrqHandler()` itself). Port each `call(...)` to the equivalent stock-native primitive: `session.client.send(CommandType.CheckpointList, ...)` (parsed via the existing `ResponseType.CheckpointList` case, `stock-protocol.ts:1248-1255` — note this case returns an empty `checkpoints: []` array by design, "filled by request-id correlation across the preceding CHECKPOINT_INFO events sharing this request id" — the new stock diagnose handler must perform that correlation itself, or call `handleCheckpointList` from `stock-checkpoints.ts`, which already does), and `session.client.send(CommandType.RegistersGet, memspaceBody({memspace: 0x00}))` for the PC read. The armed-checkpoint filter (`vice-proxy.ts:968`), the `atPc`/`atHandler` matching logic (`vice-proxy.ts:970-976`), and the `CheckpointTrapEvidence` shape are **portable unchanged**.

3. **`classifyLiveness()`** (`vice-proxy.ts:1159-1165`) — **pure, zero transport coupling, portable verbatim**: `if (bracket1.cycles === 0 && (!bracket2 || bracket2.cycles === 0)) return "wedged"` then a register-byte-identity check. The thing that changes is `runCycleBracket()` (`vice-proxy.ts:1101-1113`), which is **not portable at all** (Pitfall 3): it calls `vice_ping` in a poll loop assuming non-pausing behaviour that stock does not have. Replace with Pattern 5's snapshot-resume-wait-halt-compare (RESEARCH.md, one real `setTimeout`, zero socket traffic during the wait, two halting `REGISTERS_GET` reads). RESEARCH.md's own recommendation (Open Question 3) is to **drop** the `"stale_read_path"` verdict on stock — every stock read pauses uniformly, so the fork's specific "one non-pausing path vs. one pausing path" precondition cannot occur — leaving five verdicts: `["restarted", "checkpoint_trap", "wedged", "monitor_held_elsewhere", "live"]`.

**The `"monitor_held_elsewhere"` verdict needs no new detection** — catch `MonitorOwnershipError` at the very top of the handler, before `ensureStockSession()`'s outcome is otherwise consumed (this happens automatically: `withDerivedTool({needsSession:true}, ...)`'s own preamble at `stock-dispatch.ts:504-509` already wraps `ensureStockSession(deps)` in a try/catch calling `convertHandshakeError(toolName, err)` on any thrown handshake error). The existing conversion, verbatim (`stock-handler.ts:87-93`):
```typescript
if (err instanceof MonitorOwnershipError) {
  return isErrorText(
    `${toolName}: this instance's monitor socket is already claimed by a different grant ` +
      `(grant ${err.holderGrantId ?? "unknown"}, claimed at ${err.holderClaimedAt ?? "unknown"}, port ${err.port ?? "unknown"}) -- ` +
      `only one client may hold the stock monitor socket at a time.`,
  );
}
```
For `stock-diagnose.ts` to surface this as a **named verdict** (`"monitor_held_elsewhere"`) rather than generic refusal text, `handleDiagnoseStock()` itself should catch `MonitorOwnershipError` explicitly (import it from `vice-broker-client.ts`, same as `stock-handler.ts:38` does) inside its own body — since `withDerivedTool()`'s outer catch already converts it to text before the handler's own return value is reached, the handler needs to structure its own session-dependent logic so a thrown `MonitorOwnershipError` reaching *that* outer catch is itself the desired "monitor_held_elsewhere" outcome (the wording in `convertHandshakeError()` already matches the verdict's intent) — OR, if `vice_diagnose` on stock must answer `isError:false` with a `verdict` field rather than `isError:true` refusal text (matching the fork's `handleDiagnose()`'s own always-`isError:false` shape, `vice-proxy.ts:1224-1260`), then `handleDiagnoseStock` needs its own explicit try/catch around `ensureStockSession`/the first stock call, converting `MonitorOwnershipError` into a `{verdict: "monitor_held_elsewhere", ...}` **ok** result rather than delegating to `withDerivedTool()`'s outer error-shaped conversion. This is a planner decision RESEARCH.md flags but does not resolve (the fork's `handleDiagnose()` never throws past its own boundary, `vice-proxy.ts:1221` "Never throws past this point") — match that contract on stock too, most likely by NOT using `withDerivedTool({needsSession:true}, ...)`'s automatic session acquisition for this one tool, and instead calling `ensureStockSession()` manually inside the handler with its own try/catch, the same way `handleDiagnose()` on the fork wraps its own body in one big `try { ... } catch (e) { if (e instanceof MachineRestartedError) ... }` (`vice-proxy.ts:1224-1260`).

**`MachineRestartedError`'s existing conversion** (`stock-handler.ts:95-101`), reuse the same way:
```typescript
if (err instanceof MachineRestartedError) {
  return isErrorText(
    `${toolName}: the emulator's identity could not be proven across a reconnect ` +
      `(baseline epoch ${String(err.baselineEpoch)}, current epoch ${String(err.currentEpoch)}) -- ` +
      `treat every result since the previous call as void and retry.`,
  );
}
```

**Incident-record ordering, if `vice_recycle`'s stock evidence gatherer is also built this phase (Open Question 1):** the fork's own `handleRecycle()` (`vice-proxy.ts:639-720`) writes the incident record **before** the destructive RPC — `writeIncidentRecord()` at `vice-proxy.ts:683-690`, `controlSession.recycle(grantId)` at `vice-proxy.ts:698`, with the comment at `vice-proxy.ts:672-677` making the ordering explicit: "the record is written BEFORE the request -- capturing is structurally impossible to skip, not a discipline to remember." Any stock-native evidence gatherer must preserve this exact ordering: gather evidence via stock-native reads, call `writeIncidentRecord()` (`incident-record.ts`, imported the same way `vice-proxy.ts:146-152` does), **then** call the same `controlSession.recycle(grantId)` broker RPC (unchanged — it is backend-independent, a control-plane RPC, not an HTTP-to-fork call).

## Shared Patterns

### Derived-tool registration (every one of the three new tools)
**Source:** `stock-dispatch.ts:484-521` (`withDerivedTool()`), `stock-derived.ts:82-92` (`STOCK_DERIVED_TOOLS`)
**Apply to:** `stock-timing.ts`, `stock-run-until.ts`, `stock-diagnose.ts` — every handler registers as `withDerivedTool(toolName, { needsSession: true }, handler)` in `STOCK_DISPATCH_TABLE` (`stock-dispatch.ts:571-630`), and every tool name must appear in `STOCK_DERIVED_TOOLS` in the same commit as its module is added to `package.json`'s `files[]` (`package.json:10-50`).

### Error conversion (never write a third converter)
**Source:** `stock-handler.ts:87-124` (`convertHandshakeError`), `stock-handler.ts:150-164` (`convertWireError`)
**Apply to:** All three new handlers — `withDerivedTool()`'s own preamble (`stock-dispatch.ts:504-519`) already wraps every handler in these two converters; a handler must never construct its own error text for a handshake failure or a wire `ErrorCode`.

### Successful-answer construction (runState on every answer)
**Source:** `stock-handler.ts:175-178` (`stockAnswer()`)
**Apply to:** `stock-timing.ts`, `stock-run-until.ts` — every ok answer goes through `stockAnswer(session.client, payload)`, never a bare `{content, isError:false}` literal (this is how D-06's "runState on every stock answer" is satisfied by construction).

### Address parsing
**Source:** `stock-address.ts:111` (`parseAddress(input, opts)`)
**Apply to:** `stock-run-until.ts`'s `address` argument.

### Numeric-argument clamping
**Source:** `stock-connect.ts:91-94` (`clampCpuHistoryCount()`)
**Apply to:** `stock-run-until.ts`'s new `timeout_ms` argument (finite/trunc/bounds discipline, never unbounded/negative/NaN).

### Event narrowing on `CHECKPOINT_INFO`
**Source:** `stock-checkpoints.ts:303-311` (`isCheckpointInfoEvent()`)
**Apply to:** `stock-run-until.ts`'s wait-for-hit logic — narrow on the parsed event's own `.type` discriminant then the specific checkpoint id, never on response type alone (the demux already guarantees `CHECKPOINT_INFO` frames arrive at request-id `0xffffffff` distinctly from command replies — this narrowing is the layer above that).

### Wire error text lookup (do not hardcode a second `ObjectMissing` string)
**Source:** `stock-handler.ts:140-148` (`WIRE_ERROR_TEXT`)
**Apply to:** `stock-run-until.ts`'s timeout-cleanup path (tolerating `ErrorCode.ObjectMissing` on a `CHECKPOINT_DELETE` that raced a hit).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Video-standard-aware cycle-position arithmetic (`positionWithinFrame()`/`reconstructWithinFrame()`, the `VIDEO_STANDARDS` table) | utility | transform | No existing code in this tree computes a raster position from `LIN`/`CYC`, or holds a PAL/NTSC/NTSC-old/PAL-N constant table — first-of-its-kind. Use RESEARCH.md's Pattern 3 / Code Examples sketches (cross-checked against `vice/src/c64/c64.h:36-58`) as the reference implementation, not a repo analog. |
| Event-driven bounded wait (`waitForCheckpointHit()`-equivalent for `vice_run_until`) | utility | event-driven | RESEARCH.md's own "Don't Hand-Roll" table confirms: "No existing helper of this shape exists in this tree (confirmed: no `waitForEvent`/`Promise.race`-based deadline helper anywhere in `.claude/mcp/vice`) — this phase is the first consumer." `vice-sync.ts`'s `waitCheckpointHit()` is an algorithm-shape reference only (poll-based, fork-only, deliberately not unit-tested) — its *transport* must not be ported. |
| The stock liveness bracket (snapshot-resume-wait-halt-compare using real wall-clock time) | utility | request-response with a deliberate real-time wait | The fork's `runCycleBracket()` (`vice-proxy.ts:1101-1113`) is an anti-pattern here (Pitfall 3), not an analog — it assumes a non-pausing `vice_ping` stock does not have. No existing stock code waits real wall-clock time with zero socket traffic; this is new. |
| `RESOURCE_GET`'s encoder+parser pair, end to end | utility | transform | `CommandType.ResourceGet`/`ResponseType.ResourceGet` (0x51) are declared in the enums (`stock-protocol.ts:108, 147`) and already present in `EXPECTED_RESPONSE` (`stock-protocol.ts:1500`), but **no encoder function and no parser case exist anywhere in this tree** — this opcode has never been used by Phases 2-5. The closest structural analogs (cited above under `stock-timing.ts`) are shape-matches, not a direct reuse. |
| `CPUHISTORY_GET`'s response parser case | utility | transform | Same situation: the opcode is used (by `probeCpuHistory()`) but only its success/failure is ever inspected, never its body — `stock-protocol.ts`'s `parseResponse()` switch has no `case ResponseType.CpuHistoryGet:` today, confirmed by reading the full switch (`stock-protocol.ts:1140-1324`). |

## Metadata

**Analog search scope:** `.claude/mcp/vice/` (all `stock-*.ts`, `vice-proxy.ts`, `vice-sync.ts`, `incident-record.ts`, `stock-handler.ts`, `stock-dispatch.ts`, `stock-derived.ts`, `stock-protocol.ts`, `stock-connect.ts`, `stock-checkpoints.ts`, `stock-address.ts`, `tools-manifest.stock.json`, `package.json`, `test-gate.mjs`), plus `stock-checkpoints.test.ts` and `stock-connect.test.ts` for the test-DI-stub convention.
**Files scanned:** ~20 read live in full or by targeted section (see file:line citations throughout); `stock-dispatch.ts` and `stock-derived.ts` read in full (661 + 135 lines); `vice-proxy.ts` read by targeted section (lines 639-720, 860-1260, 1330-1460, 2814-2913, 3130-3230, ~9200 lines total, not read in full — targeted per RESEARCH.md's own cited line ranges).
**Pattern extraction date:** 2026-08-18

---

## Notes for the planner (not part of the pattern map proper)

- **Wave 0 is a hard prerequisite, not parallel work.** `probeCpuHistory()`'s `count=0`→`InvalidParameter` defect (`stock-connect.ts:103-118`) breaks the *entire* stock connect handshake on any real VICE ≥ 3.10 build — every one of this phase's three new tools needs a live `ensureStockSession()` to reach their own logic at all, so the Wave 0 fix must land and pass before any Wave 1/2 task's live-VICE verification is meaningful (matches `07-VALIDATION.md`'s own Wave 0 gating).
- **`vice_diagnose`'s never-throw contract needs an explicit planner decision** (see the `stock-diagnose.ts` section above) — whether `handleDiagnoseStock` uses `withDerivedTool()`'s automatic session-acquisition-with-outer-error-conversion, or manages its own `ensureStockSession()` call inside a local try/catch to keep every verdict (including `monitor_held_elsewhere`/`restarted`) inside a single `isError:false` answer shape matching the fork's `handleDiagnose()` (`vice-proxy.ts:1224-1260`) contract. RESEARCH.md does not resolve this; it is a genuine implementation-shape choice for the planner.
- **`vice_recycle`'s stock implementation is explicitly out of this research's committed scope** (RESEARCH.md Open Question 1) — the pattern map above still documents the incident-record-before-RPC ordering in case the planner elects to build it alongside `stock-diagnose.ts`, since both reuse the same liveness-bracket/checkpoint-trap algorithm.
