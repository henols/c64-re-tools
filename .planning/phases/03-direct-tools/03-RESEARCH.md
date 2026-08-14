# Phase 3: Direct Tools - Research

**Researched:** 2026-08-14
**Domain:** VICE binary-monitor wire protocol -> stock-backend MCP tool dispatch (request encoders, run/stop-state projection, checkpoint conditions, machine control)
**Confidence:** HIGH on wire layouts and existing-code seams (grounded in this repo's own Phase 1/2 artifacts and the official VICE manual); MEDIUM-LOW on a handful of behavioural specifics that have never been probed against a real binary (flagged individually below and collected in the Assumptions Log).

## Summary

Phase 3 fills in the one part of the stock backend that Phase 2 deliberately left empty: request-body encoders in `stock-protocol.ts`, the ~20 new entries `stock-dispatch.ts`'s own header comment already anticipates ("a later plan (phases 3-7) adds its own stock entries here"), and the `tools-manifest.stock.json` entries that expose them. Every wire fact this phase needs was already either verified against a real emulator in Phase 1 (`docs/phase1-probe-results.md`), is encoded and offline-tested in `probe-binmon.mjs`, or is documented in the official VICE manual (`vice_13.html`, fetched and cross-checked this session). No live stock VICE was invoked in this research session — this environment happens to have both `/usr/bin/x64sc` (apt, VICE 3.9, genuinely stock) and `/usr/local/bin/x64sc` (the barryw fork, VICE-3.10-based) installed, matching Phase 1's own recorded environment, but per this task's scope this research stays spec-driven and does not exercise either binary; live validation of the new encoders remains verification debt, tracked the same way Phase 2's two pending fixture/discriminator todos already are.

The four tool families CONTEXT.md identifies are real and mostly independent, but they share four seams that must land before family-specific handler work can run in true parallel: (1) `parseAddress()` (D-04), consumed by both the memory and checkpoint families; (2) the `runState` projection (D-06/07/08), which must appear on **every** handler's answer regardless of family; (3) a register-name/id catalog (new — not called out by name in CONTEXT.md, discovered this session, see Focus Item 1) needed by both register tools; and (4) a shared error-to-refusal-text mapping so `stockConnect()`'s `convertHandshakeError()` pattern is not reinvented per family. The practical consequence for planning: a small Wave 1 that lands these four shared seams, followed by four largely parallel Wave 2+ plans (one per family), is a better fit than four fully independent waves from the start.

Two new, concrete findings not already in CONTEXT.md surfaced this session and change how two DIRECT requirements should be scoped: (a) `AUTOSTART` (0xdd) — the only wire route to D-14's disk-attach approximation — has **no drive-unit field at all**, so it can only ever target VICE's default drive; the fork's `vice_disk_attach` `unit` argument (8-11) cannot be honoured on stock for units 9-11 (see Focus Item 1, Family D). (b) `KEYBOARD_FEED` (0x72) expects raw PETSCII bytes, and this codebase currently has **no ASCII-to-PETSCII conversion table anywhere** — the previous custom fork did this conversion server-side in C; Phase 3 must build a small client-side table that does not exist yet.

**Primary recommendation:** Land a Wave 1 "shared seams" plan (address parser, runState tracker, register catalog, shared error-text helper, encoder-builder conventions mirrored from `probe-binmon.mjs`) before splitting into the four family plans CONTEXT.md names, and treat the AUTOSTART unit-field gap and the missing PETSCII table as scope items the planner must explicitly account for, not silently absorb.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Request-body encoding (MEM_GET, CHECKPOINT_SET, CONDITION_SET, etc.) | API/Backend (container-side MCP server) | — | `stock-protocol.ts` is the one wire-format seam; encoders are pure functions with no I/O |
| Dispatch table + tool-name routing | API/Backend | — | `stock-dispatch.ts`'s `STOCK_DISPATCH_TABLE` is the one dispatch seam (D-09) |
| `runState` projection | API/Backend | — | Derived purely from the `ViceMonitorClient`'s event stream, held per-session |
| Condition AST + emitter | API/Backend | — | Pure string-building over an in-process typed structure; no host or emulator dependency |
| Address parsing (`parseAddress()`) | API/Backend | — | Pure function; symbol-resolution hook stays empty until Phase 5 |
| Emulator-side path translation (DUMP/UNDUMP/AUTOSTART/disk paths) | API/Backend (container) | Host (VICE process reads the file) | `hostpath.ts` is the one translation seam; the emulator itself runs on the host and dereferences the translated path |
| Broker launch flags / second port | Host (broker daemon) | — | `broker-launch.mts` -> compiled `resources/*.mjs`, runs on the bare host outside any container |
| Monitor-socket ownership (`monitor_claim`/`monitor_release`) | Host (broker daemon) | API/Backend (consumes it) | `broker-control.mts` owns the single `InstanceRecord.monitorClient` record; the stock session merely calls it |
| Test/verification of encoders and runState | API/Backend (offline, no emulator) | — | Fixture-driven, same posture as `probe-binmon.mjs`'s own `--selftest` |

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-17, summarised — see 03-CONTEXT.md for full text)

- **D-01:** Stock answers are stock-native; every divergence from the fork's answer shape is logged in `docs/stock-vice-parity.md`, not reproduced bug-for-bug.
- **D-02:** `outputSchema` on every stock manifest entry is the enforced contract, checked by a test. Fork manifest is untouched (no `outputSchema` there — BACK-02).
- **D-03:** Inputs stay fork-compatible for required arguments; stock may add only OPTIONAL arguments with safe defaults.
- **D-04:** One shared `parseAddress()` seam (decimal / `$hex` / `0x`), with an empty-in-Phase-3 symbol-resolution hook. A symbolic address refuses with "no symbol table loaded," not a parse error.
- **D-05:** Commands leave the machine halted; no unrequested `EXIT`, ever. The agent resumes explicitly.
- **D-06:** `runState` (`"running"|"stopped"|"unknown"`) appears on EVERY stock tool answer, derived purely from the event stream.
- **D-07:** `"unknown"` (the post-connect honest state) gates the execution tools only (step, execute-until-return refuse; memory/register/checkpoint tools run freely).
- **D-08:** Pause/resume short-circuit on known state (no wire traffic on a genuine retry); no additional resume-cooldown mechanism.
- **D-09:** `condition` accepts a string OR a structured object; both funnel into one typed AST and one canonical emitter (full parenthesisation, `$hex` literals, uppercase `RL`/`CY`).
- **D-10:** Client-side condition registry + fail-closed cleanup (delete the checkpoint if `CONDITION_SET` fails) ships in Phase 3, not Phase 6.
- **D-11:** `stop:false` checkpoints require an explicit opt-in argument, a per-second hit-rate limit, and auto-disable (via `CHECKPOINT_TOGGLE`) with the reason reported.
- **D-12:** Keep the fork's add-then-condition split; `vice_checkpoint_add` does not gain an inline `condition` argument.
- **D-13:** Disk detach moves to Phase 7 (text monitor). Phase 3 ships ONLY the `-remotemonitor` launch flag and a second broker-allocated port; it builds no text client and `vice_disk_detach` is absent from the stock manifest.
- **D-14:** Disk attach = `AUTOSTART` with the run flag clear — documented as an approximation, not exact.
- **D-15:** `vice_checkpoint_set_ignore_count` is trimmed from the stock manifest (no native ignore count; would require a D-05 exception).
- **D-16:** `vice_snapshot_list` is deleted from BOTH manifests (no consumer anywhere); `vice_snapshot_load`'s description is updated in the same change.
- **D-17:** A declared table names exactly which stock handlers have emulator-side path arguments (DUMP/UNDUMP, AUTOSTART, disk attach); those handlers call `hostpath.ts` directly, never `rewriteArguments()`.

### Claude's Discretion

- D-03's default (fork-compatible required args, stock-only optional extras).
- D-17's declared path-translation table shape.
- Module layout for Phase 3 handlers (sibling modules only; never appended to `vice-proxy.ts`).
- Request-body encoder design in `stock-protocol.ts` (none exist yet).
- Two open naming items: a stock-only tool name for `EXECUTE_UNTIL_RETURN` (0x73), and where `REGISTERS_AVAILABLE` (0x83) surfaces (new tool vs. field on `vice_registers_get`).

### Deferred Ideas (OUT OF SCOPE for Phase 3)

- Resume cooldown/rate limiting on `EXIT` (roadmap note; D-08's short-circuit is judged sufficient).
- The text-monitor transport itself (framing, prompt detection) — Phase 7.
- `vice_disk_detach` — Phase 7.
- `vice_disk_read_sector` (parse `.d64` client-side) — Phase 5.
- Low-level keyboard (`key_press`/`release`/`restore`/`matrix`/`chord`) — hard loss, absent from stock manifest permanently (Phase 8 documents it).
- `vice_sid_get_state` — hard loss (write-only registers).
- `vice_machine_config_get`/`set` (`RESOURCE_GET`/`SET`) — Phase 6.
- Roadmap reconciliation for DIRECT-06's detach half (-> Phase 7) and the `vice_snapshot_list` BACK-02 exception — a `gsd-sdk` roadmap edit, not phase work.
- Skill playbook revision for D-01's answer-shape drift and D-05's read-halts-the-machine divergence — Phase 8 (SKILL-01), widened.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIRECT-01 | Read/write memory, side-effect-free by default | Family A: `MEM_GET`(0x01)/`MEM_SET`(0x02) encoders documented (Focus Item 2); `sidefx` byte defaults to 0 |
| DIRECT-02 | Read/write CPU registers | Family A: `REGISTERS_GET`(0x31)/`REGISTERS_SET`(0x32); register-name<->id catalog design (Focus Item 1/10) |
| DIRECT-03 | Set/list/delete/toggle/condition checkpoints and watchpoints | Family B: `CHECKPOINT_SET/DELETE/LIST/TOGGLE`(0x12-0x15), `CONDITION_SET`(0x22); AST/emitter design (Focus Item 4), registry/fail-closed cleanup (D-10) |
| DIRECT-04 | Step instructions, execute-until-return | Family C: `ADVANCE_INSTRUCTIONS`(0x71), `EXECUTE_UNTIL_RETURN`(0x73) new stock-only tool naming (Focus Item 1) |
| DIRECT-05 | Pause/resume, idempotent | Family C: `PING`(0x81)/`EXIT`(0xaa) via D-08 short-circuit on `runState` (Focus Item 3) |
| DIRECT-06 | Reset, autostart, disk attach/detach | Family D: `RESET`(0xcc), `AUTOSTART`(0xdd); disk-attach unit-field gap (Focus Item 1, new finding); detach deferred (D-13) |
| DIRECT-07 | Type text, joystick | Family D: `KEYBOARD_FEED`(0x72) needs new PETSCII table (new finding); `JOYPORT_SET`(0xa2) needs bitmask mapping (flagged ASSUMED) |
| DIRECT-08 | Save/restore snapshots | Family D: `DUMP`(0x41)/`UNDUMP`(0x42); D-17 path translation (Focus Item 7) |
| DIRECT-09 | Enumerate banks and registers | Family A/D: `BANKS_AVAILABLE`(0x82) (existing tool `vice_memory_banks`); `REGISTERS_AVAILABLE`(0x83) new naming (Focus Item 1) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md's Constraints block is normative and this research does not contradict any line in it. The lines most load-bearing for Phase 3 specifically:

- Derived tools (none in Phase 3 — that's Phase 4/DERIV-07) must be intercepted before `rewriteArguments()`; Phase 3's direct tools sit entirely behind `stock-dispatch.ts`'s table and never reach `forwardToVice()`/`rewriteArguments()` at all, so this constraint is satisfied by construction, not by a new interception point.
- The 11-byte request / 12-byte response header layout, all little-endian, is settled and must not be re-derived — `encodeRequestHeader()` already implements it; Phase 3's job is bodies only.
- Five unsolicited message types at request-id `0xffffffff`; `CHECKPOINT_INFO`/`REGISTER_INFO` share response types with legitimate replies. The demux is already built (`stock-protocol.ts`'s `#dispatch()`); Phase 3's `runState` tracker and D-11's rate limiter must consume the existing `'event'` channel, never re-derive request-id-vs-response-type logic.
- `JAM` has a zero-length body — already handled by the existing parser; no new code in Phase 3 touches this.
- A non-stopping checkpoint's `CHECKPOINT_INFO` flood is synchronous, from inside the CPU loop, over the blocking socket — directly informs D-11's rate limiter design (Focus Item 5 below).
- The wire memspace byte (`0x00` main, `0x01`-`0x04` units 8-11, `0x08` rejected) and `MEM_GET`'s mandatory 8-byte body are both confirmed by the official VICE manual this session (Focus Item 2) and must not be re-litigated.
- Checkpoint conditions use uppercase `RL`/`CY`, no operator precedence, hex-by-default bare literals — the entire basis for D-09/D-10's AST design (Focus Item 4).
- `CPUHISTORY_GET`'s uint16 wrap, drive true-emulation silent zeros, and the three power-cycling resources are all Phase 6 concerns (`RESOURCE_SET`), not touched by Phase 3's `RESET` opcode (0xcc) — see Focus Item 1 Family D for why these two mechanisms must not be conflated.
- `hostpath.ts`/`containerpath.ts`/`container-guard.mts` carry a tested closed consumer set — D-17's table is an addition to that set, not a new parallel mechanism (Focus Item 7).
- The broker's single-owner `inFlight` launch guard stays synchronous, no `await` between — unaffected by D-13's second port, which only changes `buildViceArgs()`'s stock-branch return value, not the launch-guard code path (Focus Item 8).
- `vice-sync.ts`'s invariants (one resume per wait, poll on `hit_count` never paused state) are a FORK-side module (uses `call()` from `vice.ts`, not the stock dispatch table) and are unaffected by Phase 3 — but they inform the *design philosophy* behind D-06/07/08's runState projection: poll/derive from an authoritative signal (the event stream), never from what the client itself sent.

## Standard Stack

### Core

Phase 3 adds **no new npm dependency**. Everything it needs is either already a dependency (`stock-protocol.ts`'s existing `net`/`node:events` imports) or hand-rolled per this codebase's own zero-dependency convention (confirmed: `.claude/mcp/vice/package.json` carries exactly `@mastra/mcp` and `@mastra/core` as runtime deps; no JSON-schema validator, no PETSCII library, nothing else).

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins only (`node:net`, `node:events`, `node:buffer`) | Node >= 22.18 (already required) | Wire encoding, socket I/O, event demux | Already the whole stack; this repo's own convention is zero third-party deps for the container-side server (`.planning/codebase/ARCHITECTURE.md`'s "Depends on: Node builtins only" pattern, applied here even though this module runs container-side, not host-side — the same zero-dependency discipline is visible throughout `stock-protocol.ts`/`stock-connect.ts`) |

### Supporting

None. No JSON-schema library, no PETSCII conversion library on npm is warranted at this scale (a PETSCII table is ~190 static byte mappings and a home-rolled `outputSchema` checker only needs to cover `type`/`properties`/`required`/`items`/`enum` — see Focus Item 6).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `outputSchema` shape checker | `ajv` (JSON-Schema validator) | `ajv` is the ecosystem standard but is a new runtime dependency this project has deliberately avoided everywhere; the actual schemas Phase 3 needs to validate are small and flat (no `$ref`, no `oneOf`), so a ~40-line recursive type/required/enum checker covers the real need without the dependency-audit cost |
| Client-side ASCII->PETSCII table | An existing petscii npm package | None found audited/verified in this session; a static ~192-entry byte-swap table (uppercase ASCII <-> PETSCII unshifted/shifted regions) is well-documented public-domain knowledge (same character-set facts skill scripts already rely on for `.d64` filename decoding) and small enough to hand-write and unit-test exhaustively, avoiding another unverified registry dependency |

**Installation:** none — no `npm install` step for this phase.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every artifact (request encoders, dispatch handlers, the condition AST/emitter, the runState tracker, the PETSCII table, the register catalog, the `outputSchema` checker) is hand-written TypeScript against Node builtins, consistent with the rest of `.claude/mcp/vice/`. The Package Legitimacy Gate protocol (slopcheck / registry verification) is not applicable — there is nothing to run it against.

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

## Architecture Patterns

### System Architecture Diagram

```text
Claude Code (stdio tools/call: e.g. vice_memory_read)
        |
        v
vice-proxy.ts  --(ACTIVE_BACKEND.backend === "stock")-->  dispatchStock(name, args, deps)
        |                                                        |
        | (fork path: forwardToVice() -- UNCHANGED,               v
        |  never reached for stock)                    stock-dispatch.ts: STOCK_DISPATCH_TABLE
        |                                                        |
        v                                                        v
   HTTP /mcp (host)                              ensureStockSession(deps)
                                                                  |
                                              (reuses held ViceMonitorClient,
                                               or stockConnect()/stockReconnect())
                                                                  |
                                                                  v
                                              Phase-3 handler (per family, new)
                                                  |         |          |
                                        parseAddress()  runState    condition
                                        (D-04, shared)  tracker     AST+emitter
                                                  |     (D-06/07/08) (D-09/10)
                                                  v         |          |
                                     stock-protocol.ts: NEW request-body encoders
                                     (memGetBody, checkpointSetBody, conditionSetBody, ...)
                                                  |
                                                  v
                                     ViceMonitorClient.send(CommandType, body)
                                                  |
                                     TCP :binmon-port -----------------> x64sc (host)
                                                  |
                                     'response' | 'event' (STOPPED/RESUMED/JAM/
                                                            CHECKPOINT_INFO/REGISTER_INFO)
                                                  |
                                     runState tracker updates ONLY from 'event'
                                     (never from what this client itself sent)
                                                  |
                                                  v
                                  Handler formats stock-native answer + runState
                                  field (D-01, D-06) -> StockToolResult -> stdout
```

### Recommended Project Structure

```
.claude/mcp/vice/
├── stock-protocol.ts        # EXTEND: add request-body encoders here (no new file)
├── stock-dispatch.ts        # EXTEND: add ~20 STOCK_DISPATCH_TABLE entries (no new file)
├── stock-connect.ts         # UNCHANGED at the handshake level; runState tracker attaches to the session it returns
├── stock-address.ts         # NEW: parseAddress() (D-04), empty symbol-resolver hook
├── stock-runstate.ts        # NEW: runState tracker (D-06/07/08), attaches to a ViceMonitorClient
├── stock-condition.ts       # NEW: condition AST types + typed builder + canonical emitter (D-09), refusal rules (D-10)
├── stock-registers.ts       # NEW: register name<->id catalog (Focus Item 1) + get/set handlers (Family A, register half)
├── stock-memory.ts          # NEW: memory read/write/banks handlers (Family A, memory half)
├── stock-checkpoints.ts     # NEW: checkpoint/watchpoint handlers (Family B) + D-10 registry + D-11 rate limiter
├── stock-execution.ts       # NEW: pause/run/step/execute-until-return handlers (Family C)
├── stock-machine.ts         # NEW: reset/autostart/disk-attach/keyboard/joystick/snapshot handlers (Family D)
├── stock-petscii.ts         # NEW: the ASCII<->PETSCII table KEYBOARD_FEED needs (no such table exists today)
├── tools-manifest.stock.json  # EXTEND: ~20 new entries, each with outputSchema (D-02)
└── broker-launch.mts        # EXTEND: buildViceArgs()'s stock branch gains -remotemonitor + second port (D-13)
```

### Pattern 1: Shared-seam-first sequencing

**What:** Land `stock-address.ts`, `stock-runstate.ts`, `stock-registers.ts`'s catalog, and a shared error-text helper in one early plan before the four family plans.
**When to use:** Any time multiple otherwise-independent handler families all need to call the same not-yet-written function. `runState` is the strongest forcing case — D-06 requires it on literally every answer, so every family's handler code depends on `stock-runstate.ts` existing first.
**Example:**
```typescript
// stock-runstate.ts (new) -- sketch, not yet written
import type { ViceMonitorClient, ParsedResponse } from "./stock-protocol.ts";

export type RunState = "running" | "stopped" | "unknown";

export interface RunStateTracker {
  get(): RunState;
}

/** Attaches ONCE per ViceMonitorClient instance (i.e. once per stockConnect()/
 * stockReconnect() call, since each produces a fresh client) -- never a
 * module-level singleton, since a reconnect creates a brand-new client and a
 * brand-new tracker naturally, with no manual listener teardown needed. */
export function attachRunStateTracker(client: ViceMonitorClient): RunStateTracker {
  let state: RunState = "unknown"; // D-07: honest until the first STOPPED/RESUMED event
  client.on("event", (item: ParsedResponse) => {
    if (item.type === "stopped" || item.type === "jam") state = "stopped";
    else if (item.type === "resumed") state = "running";
    // anything else on the event channel (REGISTER_INFO, unrecognised) leaves state untouched
  });
  return { get: () => state };
}
```

### Pattern 2: Mirror `probe-binmon.mjs`'s already-tested encoder shapes

**What:** `probe-binmon.mjs` already implements and offline-tests `memGetBody()`, `memSetBody()`, `checkpointSetBody()`, `cpNumBody()`, and `conditionSetBody()` (lines 265-332). Phase 3's `stock-protocol.ts` encoders should port these functions near-verbatim (same field order, same offsets), the same way `stockConnect()` already reuses `probe-binmon.mjs`'s `parseDisplayGet()` derivation rather than the vendor's off-by-four slice.
**When to use:** For every encoder this phase needs that `probe-binmon.mjs` already has a tested implementation of.
**Example:**
```javascript
// Source: .claude/mcp/vice/probe-binmon.mjs:265-276 (already offline-tested this
// session's grep confirmed selftest coverage at line ~419-461)
function memGetBody({ sidefx = 0, start, end, memspace = 0x00, bank = 0x0000 } = {}) {
  const body = Buffer.alloc(8);
  body[0] = sidefx;
  body.writeUInt16LE(start, 1);
  body.writeUInt16LE(end, 3);
  body[5] = memspace;
  body.writeUInt16LE(bank, 6);
  return body;
}
```

### Pattern 3: One register catalog, populated lazily, cached per session

**What:** `REGISTERS_SET`'s wire body needs a numeric register id (`RI`), but the fork's `vice_registers_set` takes a name (`"PC"|"A"|"X"|...`). `stock-protocol.ts`'s existing `ParsedRegistersAvailableResponse` already carries `{ id, size, name }` triples — the exact data needed to build a name->id map. Fetch `REGISTERS_AVAILABLE` (0x83) once per session (lazily, on first register access), cache the map on the `StockConnectSession`, and use it for both `vice_registers_get`'s id->name rendering and `vice_registers_set`'s name->id lookup.
**When to use:** Register get/set handlers, and the new register-enumeration surface (Focus Item 1).
**Example:**
```typescript
// stock-registers.ts (new) -- sketch
import type { StockConnectSession } from "./stock-connect.ts";
import { CommandType } from "./stock-protocol.ts";

export interface RegisterCatalog {
  byName: Map<string, { id: number; size: number }>;
  byId: Map<number, string>;
}

let cached: WeakMap<object, RegisterCatalog> = new WeakMap();

export async function registerCatalogFor(session: StockConnectSession): Promise<RegisterCatalog> {
  const existing = cached.get(session);
  if (existing) return existing;
  const body = Buffer.from([0x00]); // memspace: main
  const resp = await session.client.send(CommandType.RegistersAvailable, body);
  if (resp.type !== "registers_available") throw new Error("unexpected reply to REGISTERS_AVAILABLE");
  const byName = new Map<string, { id: number; size: number }>();
  const byId = new Map<number, string>();
  for (const r of resp.registers) {
    byName.set(r.name, { id: r.id, size: r.size });
    byId.set(r.id, r.name);
  }
  const catalog = { byName, byId };
  cached.set(session, catalog);
  return catalog;
}
```
Keying the cache on the `session` object (not a module-level singleton) means a `stockReconnect()` — which builds a fresh session — naturally gets a fresh catalog, with no manual invalidation needed, mirroring `resolveCapabilities()`'s own per-binary-not-per-connect caching philosophy in `stock-connect.ts`.

### Anti-Patterns to Avoid

- **A second dispatch table or dispatch site:** `stock-dispatch.ts`'s own header comment is explicit — every Phase 3 handler is an entry in the existing `STOCK_DISPATCH_TABLE`, never a parallel table, and `vice-proxy.ts` keeps exactly one `dispatchStock(` call site.
- **Re-deriving `parseAddress()` per handler:** the codebase's own named anti-pattern ("re-deriving a cross-cutting seam locally") applies directly here — every family that touches an address argument (memory, checkpoints, watchpoints) must import the one seam.
- **Re-deriving `runState` per handler:** D-06 requires the SAME derivation logic on every answer; a handler that infers `runState` from "I just sent EXIT so it must be running" reintroduces exactly the bug D-06/07/08 exist to prevent.
- **Sending a wire command from inside the `'event'` handler:** established as a hard rule by the roadmap notes ("never send from inside the event handler") and directly relevant to D-11's rate-limiter design (Focus Item 5).
- **Building a stock tool's path directly (skipping `hostpath.ts`):** D-17's whole point; `vice-sync.ts`'s `screenshot()` function (fork-side) is the reference pattern to replicate (`tryHostPaths(path, fn, { workspaceRoot: repoRoot() })`), not a new host-path heuristic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wire framing / request-id demux / event routing | A second parser or a per-handler `'data'` listener | The existing `ViceMonitorClient` (`stock-protocol.ts`) — `send()`, `'event'`, `'response'` | Already handles chunk reassembly, N+1 `CHECKPOINT_LIST` accumulation, and the request-id-first demux that keeps `CHECKPOINT_INFO`/`REGISTER_INFO` from masquerading as replies |
| Address parsing (decimal/`$hex`/`0x`) | A per-family regex | `stock-address.ts`'s single `parseAddress()` (D-04) | Named anti-pattern in this codebase; a second parser drifts on edge cases (leading `$$`, `0X` case, negative addresses) independently |
| Checkpoint condition text | String concatenation per call site | The typed AST + one canonical emitter (D-09/D-10) | String concatenation is exactly how a silently-always-false condition gets shipped (unparenthesised `&&`, decimal literal, wrong-case register) — see Focus Item 4 |
| Run/stop state | Inferring from "which command did I just send" | The `runState` tracker fed only by the event stream (D-06/07/08) | The whole point of D-06/07/08 is that the client's own commands are not a reliable signal — the machine can be halted by ANY inbound byte, including ones other layers send |
| JSON output-shape checking | `ajv` or another schema library | A ~40-line hand-rolled checker covering `type`/`properties`/`required`/`items`/`enum` | No schema library exists anywhere in this codebase; the schemas Phase 3 needs to check are flat and small (Focus Item 6) |
| ASCII<->PETSCII conversion | A new npm dependency, or ad-hoc per-call-site byte math | One small `stock-petscii.ts` table, unit-tested exhaustively | The conversion is well-documented, fixed, small (uppercase-region swap plus a handful of control codes); building it once avoids five inconsistent inline versions across `vice_keyboard_type` calls elsewhere |
| Register name<->id resolution | Hardcoding VICE's internal register ids | The lazy, session-cached catalog built from `REGISTERS_AVAILABLE`'s own `name` field (Pattern 3 above) | Register ids are enumerated by the wire itself, per memspace, and are not guaranteed identical across every VICE build/config — reading them beats hardcoding a guess |

**Key insight:** every "don't hand-roll" item above is a case where a per-call-site shortcut looks harmless in isolation but produces a *silent* wrong answer under a condition the shortcut author didn't test — exactly the failure mode CLAUDE.md's own condition-precedence and memspace-byte warnings describe. The single-seam pattern this codebase already uses everywhere else is the correct response here too.

## Focus Item 1: The Tool Inventory (fork tool -> opcode, per family)

All opcode/body-layout facts in the four tables below are `[CITED: vice-emu.sourceforge.io/vice_13.html §13, fetched 2026-08-14]` unless marked otherwise, cross-checked against `docs/phase0-binmon-findings.md`'s confirmed command-set list and, where available, `probe-binmon.mjs`'s already-tested encoder implementations `[VERIFIED: this repo's own offline selftest]`.

### Family A — Memory & Registers (DIRECT-01, DIRECT-02, DIRECT-09 partial)

| Fork tool | Opcode | Request body | Notes |
|-----------|--------|---------------|-------|
| `vice_memory_read` | `MEM_GET` 0x01 | `sidefx(1) start(u16LE) end(u16LE) memspace(1) bank(u16LE)` — always exactly 8 bytes | `[VERIFIED]` body shape matches `probe-binmon.mjs:268-276`. `sidefx` defaults to 0 (side-effect-free), satisfying criterion 1. `bank` needs `BANKS_AVAILABLE` id lookup for the fork's named-bank argument. Memspace fixed to `0x00` (main) in Phase 3 — drive memspace is Phase 6 (GAIN-03) |
| `vice_memory_write` | `MEM_SET` 0x02 | Same 8-byte header + data appended | `[VERIFIED]` `probe-binmon.mjs:278-287` |
| `vice_memory_banks` | `BANKS_AVAILABLE` 0x82 | Empty | `[CITED]` |
| `vice_registers_get` | `REGISTERS_GET` 0x31 | `memspace(1)` | `[CITED]`. Response is `RegisterInfo` — already parsed (`stock-protocol.ts`); needs the register catalog (Pattern 3) to render names |
| `vice_registers_set` | `REGISTERS_SET` 0x32 | `memspace(1) count(u16LE) [itemSize(1) regId(1) value(u16LE)]*count` | `[CITED]`. Needs the same catalog to resolve the fork's name argument to `regId` |
| **NEW, stock-only** (planner names — D-09 open item 2) | `REGISTERS_AVAILABLE` 0x83 | `memspace(1)` | `[CITED]`. DIRECT-09 explicitly asks for "banks **and registers**"; nothing on the fork covers register enumeration. Recommend a small new tool (`vice_registers_available`, matching the existing `vice_execution_*`/`vice_memory_*` naming convention) rather than folding into `vice_registers_get`'s answer — enumeration and value-reading are different operations with different callers, and a fork-parity-minded caller expects `vice_registers_get` to keep returning values only |

### Family B — Checkpoints & Watchpoints (DIRECT-03)

| Fork tool | Opcode | Request body | Notes |
|-----------|--------|---------------|-------|
| `vice_checkpoint_add` | `CHECKPOINT_SET` 0x12 | `start(u16LE) end(u16LE) stop(1) enabled(1) op(1) temporary(1) [memspace(1)]` (8 or 9 bytes) | `[VERIFIED]` `probe-binmon.mjs:290-309`; `op` byte: load=0x01, store=0x02, exec=0x04 (bitmask — the fork's `load`/`store`/`exec` booleans OR together) |
| `vice_checkpoint_delete` | `CHECKPOINT_DELETE` 0x13 | `checkpointNum(u32LE)` | `[VERIFIED]` `probe-binmon.mjs:314-318` (`cpNumBody`) |
| `vice_checkpoint_list` | `CHECKPOINT_LIST` 0x14 | Empty | `[CITED]`. Response accumulates interim `CHECKPOINT_INFO` frames via `RELATED_RESPONSES` — already built in `stock-protocol.ts` |
| `vice_checkpoint_toggle` | `CHECKPOINT_TOGGLE` 0x15 | `checkpointNum(u32LE) enabled(1)` | `[CITED]` |
| `vice_checkpoint_set_condition` | `CONDITION_SET` 0x22 | `checkpointNum(u32LE) exprLen(1) expr(ASCII, not NUL-terminated)` | `[VERIFIED]` `probe-binmon.mjs:320-332`, including the >255-byte throw guard already implemented there. Feeds through the D-09 typed emitter (Focus Item 4), never a raw string |
| `vice_watch_add` | `CHECKPOINT_SET` 0x12 (load/store `op`), then `CONDITION_SET` 0x22 if `condition` given | Same as above | Two wire round trips behind one tool call, same as the fork's own internal shorthand; D-10's fail-closed cleanup applies to the add-then-condition window here too (D-12 note) |
| `vice_checkpoint_set_ignore_count` | **TRIMMED** — absent from stock manifest (D-15) | — | No native ignore count on the wire at all |

### Family C — Execution Control (DIRECT-04, DIRECT-05)

| Fork tool | Opcode | Request body | Notes |
|-----------|--------|---------------|-------|
| `vice_execution_pause` | bare `PING` 0x81 | Empty | `[CITED §4 / docs/phase0-binmon-findings.md §4]`. Any inbound byte halts the machine via `monitor_startup_trap()`; `PING` is the documented, side-effect-minimal way to trigger it on demand. D-08 short-circuits: no wire traffic if `runState` is already `"stopped"` |
| `vice_execution_run` | `EXIT` 0xaa | Empty | `[CITED]`. D-08 short-circuits when already `"running"` |
| `vice_execution_step` | `ADVANCE_INSTRUCTIONS` 0x71 | `stepOver(1) count(u16LE)` | `[VERIFIED]` shape exercised in `probe-binmon.mjs`'s async-events check (lines ~793-797), though only with `stepOver=0`; the `stepOver=1` "skip subroutine" semantic is `[ASSUMED]` to match the fork's own `stepOver` field name and has not been probed against a real `JSR` — see Assumptions Log A2. D-07 gates this tool on `runState !== "unknown"` |
| **NEW, stock-only** (planner names — D-09 open item 1) | `EXECUTE_UNTIL_RETURN` 0x73 | Empty | `[CITED]`. No fork tool name exists for this; recommend `vice_execution_return` or `vice_execution_until_return`, matching the `vice_execution_*` family. D-07 gates this tool identically to step |

### Family D — Machine Control (DIRECT-06, DIRECT-07, DIRECT-08, DIRECT-09 partial: banks covered in Family A)

| Fork tool | Opcode | Request body | Notes |
|-----------|--------|---------------|-------|
| `vice_machine_reset` | `RESET` 0xcc | `resetMode(1)` — `0x00` system/soft, `0x01` power-cycle/hard, `0x08`-`0x0b` drives 8-11 | `[CITED]`. Fork's `mode: "soft"|"hard"` maps directly to `0x00`/`0x01`. **Distinct mechanism from CLAUDE.md's power-cycling-resource warning** — that warning is about `RESOURCE_SET` on `MachineVideoStandard`/`VICIIModel`/`MachinePowerFrequency` (Phase 6 territory), not about this opcode; a requested hard reset via `RESET` is exactly what DIRECT-06 asks for and needs no deny-list. Fork's `run_after` boolean has no wire equivalent on `RESET` itself — if `run_after: true`, the handler must send an explicit follow-up `EXIT`, which is fine under D-05 because the agent's own argument is the explicit request, not an auto-resume |
| `vice_autostart` | `AUTOSTART` 0xdd | `runAfter(1) fileIndex(u16LE) filenameLen(1) filename` | `[CITED]`. **New finding:** the fork's optional `program` argument (load-by-name from a disk image) has NO wire equivalent — `AUTOSTART` only supports a numeric `fileIndex`, never a name. Per D-03, an optional argument stock cannot honour must be explicitly refused when supplied, not silently dropped. Needs `hostpath.ts` translation (D-17) |
| `vice_disk_attach` | `AUTOSTART` 0xdd with `runAfter=0` (D-14 approximation) | Same as above | **New finding, HIGH confidence:** `AUTOSTART` has **no drive-unit field at all** — confirmed by direct query against the official manual this session, cross-checked against `docs/stock-vice-parity.md`'s own silence on a unit parameter. VICE's binary monitor gives no route to attach an image to units 9-11 specifically. The fork's `unit` argument is **required** in its schema (8-11); D-14's approximation can only ever satisfy `unit: 8`. **The planner must decide:** either scope stock's `vice_disk_attach` to unit 8 only (refusing 9-11 explicitly, per D-03's "an unhonourable required argument is a hard error, not a silent no-op"), or defer multi-unit attach entirely to Phase 6 alongside `RESOURCE_SET` investigation. This is a genuine scope-narrowing fact, not covered by CONTEXT.md's D-14 text, which only says "documented as an approximation" without naming this specific limit |
| `vice_disk_detach` | **DEFERRED to Phase 7** (D-13) | — | Phase 3 ships only the launch flag + port (see Focus Item 8) |
| `vice_keyboard_type` / `vice_keyboard_petscii` | `KEYBOARD_FEED` 0x72 | `textLen(1) text(PETSCII)` | `[CITED]`. **New finding:** no ASCII->PETSCII conversion exists anywhere in this codebase today (confirmed by grep across `.claude/mcp/vice` and `.claude/skills`) — Phase 3 must build `stock-petscii.ts` from scratch. `vice_keyboard_petscii`'s own fork schema already takes raw PETSCII bytes, so that half is a direct pass-through; `vice_keyboard_type`'s ASCII/`petscii_upper` conversion is the new work |
| `vice_joystick_set` / `vice_joystick_tap` | `JOYPORT_SET` 0xa2 | `port(u16LE) value(u16LE)` | `[CITED]` for the body shape. **The bitmask meaning of `value` (which bit is up/down/left/right/fire) is `[ASSUMED]`** from general VICE joystick-driver knowledge, not confirmed against the manual or a probe this session — see Assumptions Log A3. Recommend a probe-extension task (Wave 0 gap, see Validation Architecture) before shipping |
| `vice_snapshot_save` | `DUMP` 0x41 | `saveRoms(1) saveDisks(1) filenameLen(1) filename` | `[CITED]`. Fork's `name`/`description`/`include_roms`/`include_disks` map to a client-constructed path (e.g. `~/.config/vice/mcp_snapshots/<name>.vsf`) plus a JSON metadata sidecar (client bookkeeping, matching `docs/stock-vice-parity.md` §A.6's own framing) and `saveRoms`/`saveDisks` directly. Needs `hostpath.ts` translation (D-17) since the constructed path is opened by VICE on the host |
| `vice_snapshot_load` | `UNDUMP` 0x42 | `filenameLen(1) filename` | `[CITED]`. Same path-translation need. Response carries a `programCounter` (already parsed as `ParsedUndumpResponse`) |
| `vice_snapshot_list` | **DELETED from both manifests** (D-16) | — | No consumer anywhere in this repo; `vice_snapshot_load`'s description must be edited in the same change (currently references it at `tools-manifest.json:1000`) |

## Focus Item 2: Request-Body Encoder Design

`stock-protocol.ts` currently has `encodeRequestHeader()` (header only) and every response **parser** for the opcodes above, but zero request-body encoders. Recommended API shape — mirroring the module's existing style (small pure functions returning `Buffer`, JSDoc citing the wire spec, grouped under a clearly labelled section comment):

```typescript
// ---------------------------------------------------------------------------
// Request-body encoders (Phase 3) -- one function per command whose body has
// fields, ported from probe-binmon.mjs's already offline-tested builders
// where one exists (memGetBody, memSetBody, checkpointSetBody, cpNumBody,
// conditionSetBody) and derived fresh from the VICE manual (§13) for the rest
// (registersSetBody, advanceInstructionsBody, keyboardFeedBody, joyportSetBody,
// resetBody, autostartBody, dumpBody, undumpBody, checkpointToggleBody).
// Every encoder takes a plain options object (never positional args, matching
// stock-connect.ts's own convention) and returns a Buffer ready for
// ViceMonitorClient.send(commandType, body).
// ---------------------------------------------------------------------------

export interface MemGetBodyOptions {
  sidefx?: boolean; // default false -- DIRECT-01's side-effect-free-by-default
  start: number;
  end: number;
  memspace?: number; // default 0x00 (main); 0x01-0x04 units 8-11, 0x08 rejected
  bank?: number;
}
export function memGetBody(opts: MemGetBodyOptions): Buffer { /* mirrors probe-binmon.mjs:268-276 */ }

// ... memSetBody, checkpointSetBody, checkpointToggleBody, cpNumBody
// (shared by CHECKPOINT_GET and CHECKPOINT_DELETE), conditionSetBody,
// registersGetBody (bare memspace byte), registersSetBody, registersAvailableBody
// (bare memspace byte), advanceInstructionsBody, keyboardFeedBody, resetBody,
// autostartBody, dumpBody, undumpBody, joyportSetBody -- same pattern.
```

Two encoding details worth calling out explicitly for the planner:

1. **`conditionSetBody()` must be the ONLY caller that ever turns AST-emitted text into wire bytes.** The typed emitter (Focus Item 4) produces a string; `conditionSetBody()` is where that string becomes `exprLen(1) + ASCII bytes`, including the already-implemented >255-byte guard (`probe-binmon.mjs:326`, cross-referenced as an ASVS V5 input-validation control in that file's own comment).
2. **`registersSetBody()`'s per-item shape (`itemSize(1) regId(1) value(u16LE)`) mirrors the existing `RegisterInfo` PARSER's own per-item stride logic** (`stock-protocol.ts`'s `ResponseType.RegisterInfo` case, lines 574-594) — recommend writing the encoder as the structural inverse of that parser, in the same file, so the two are easy to keep in sync if VICE's item shape is ever probed and found to differ from the manual's description.

## Focus Item 3: The `runState` Projection (D-06/07/08)

The event stream is already fully surfaced: `ViceMonitorClient` (`stock-protocol.ts`) emits `'event'` for anything arriving at request-id `0xffffffff` (or an unrecognised non-pending id), with parsed shapes `ParsedStoppedEvent`, `ParsedResumedEvent`, `ParsedJamEvent` already available. No new protocol-layer work is needed — Phase 3's job is purely the projection layer described in Pattern 1 above (`stock-runstate.ts`).

**Design constraints, restated precisely for the planner:**

- **One tracker instance per `ViceMonitorClient`**, attached exactly once, at the point `stockConnect()`/`stockReconnect()` returns a new client — never a module-level singleton (a module-level tracker would leak state across `stockDisconnect()`/reconnect cycles the same way CR-05's leaked-socket bug did before it was fixed).
- **Initial value is `"unknown"`, honestly, even right after a successful handshake.** This is subtler than it first looks: `stockConnect()`'s own `resumeMachine()` (CR-02) unconditionally sends `PING` then `EXIT` during every handshake, which DOES resume the machine — but only the halt **that handshake itself caused**. It has no way to know or report whether the user had the machine paused *before* this connection ever existed. D-07's "unknown after connect" is not a simplification — it is the only honest answer the wire can give, and this session's read of `stock-connect.ts` confirms nothing in the handshake could ever report otherwise.
- **The rate-limiter (Focus Item 5) and any other consumer must only ever *read* the tracker, never write to it** — the tracker's own `'event'` listener is the sole writer, which is what keeps `runState` a "projection... never derived from the commands sent" (D-06's own wording).
- **Every handler attaches the current `runState` to its answer just before returning**, reading `tracker.get()` once. Recommend threading the tracker through `StockDispatchDeps` (alongside `ensureLease`, `resolvedBinaryPath`) so every handler gets it the same way it gets a session, rather than each handler resolving its own reference to the session's tracker.

## Focus Item 4: The Condition AST + Emitter (D-09/D-10)

**Design, informed directly by CLAUDE.md's own condition-parser findings** (`RL`/`CY` uppercase-only, no operator precedence, hex-by-default bare literals, `mon_lex.l:559-560`/`mon_parse.y:168` as the underlying VICE source citations already established in Phase 1's corrected docs):

```typescript
// stock-condition.ts (new) -- sketch
export type ConditionOperand =
  | { kind: "register"; name: "A" | "X" | "Y" | "SP" | "PC" }
  | { kind: "pseudo"; name: "RL" | "CY" } // raster line / cycle-within-line -- UPPERCASE ONLY
  | { kind: "literal"; value: number };   // always emitted as $hex, never bare decimal

export type ConditionOp = "==" | "!=" | "<" | ">" | "<=" | ">=";

export interface ConditionComparison {
  left: ConditionOperand;
  op: ConditionOp;
  right: ConditionOperand;
}

export type ConditionNode =
  | ConditionComparison
  | { kind: "and"; left: ConditionNode; right: ConditionNode }
  | { kind: "or"; left: ConditionNode; right: ConditionNode };

/** The ONE function that ever produces wire text for a condition. Every
 * comparison is wrapped in its own parens, and every literal is emitted as
 * $hex -- eliminating the operator-precedence trap (mon_parse.y:168) and the
 * bare-decimal-is-hex trap (monitor.c:1597) structurally, not by convention. */
export function emitCondition(node: ConditionNode): string { /* ... */ }

/** D-09: parses the fork-compatible STRING form into the same AST the
 * structured form builds directly, so both paths funnel through emitCondition().
 * Refuses (throws a named, explanatory error -- never silently "fixes" input)
 * on: LIN/CYC (must be RL/CY), lowercase register/pseudo names, bare decimal
 * literals with no distinguishing prefix (ambiguous -- VICE's own bare-decimal-
 * is-hex rule means the string author's INTENT cannot be recovered), and any
 * unparenthesised multi-comparison expression this parser cannot prove is safe
 * to auto-parenthesise (D-10's already-settled refusal list). */
export function parseConditionString(expr: string): ConditionNode { /* ... */ }
```

**Refusal set (already settled by CONTEXT.md, restated for completeness):** bare-decimal literals, `LIN`/`CYC`, lowercase register/pseudo names, unparenthesised multi-comparison input, out-of-range values — all refused with an explanation, never silently sent. Phase 3 establishes this refusal; Phase 6's GAIN-06 extends the same AST with raster semantics.

**The client-side condition registry (D-10)** is a separate, small piece of state — a `Map<checkpointNum, conditionText>` — populated on a successful `CONDITION_SET` and consulted by `vice_checkpoint_list`'s handler to report conditions the wire itself cannot read back. Recommend co-locating it in `stock-checkpoints.ts` (the family module) rather than `stock-condition.ts` (the pure AST/emitter module), since the registry is about a *specific checkpoint's* state, not about condition syntax. **Fail-closed rule:** if `CONDITION_SET` rejects, the handler must issue `CHECKPOINT_DELETE` for the checkpoint number it was conditioning, before returning an error — otherwise a full-range unconditioned breakpoint is left armed. This delete-on-failure path needs its own error handling: a `CHECKPOINT_DELETE` that *also* fails after a failed `CONDITION_SET` should report BOTH failures in the refusal text, since silently swallowing the second failure would leave the dangerous state undocumented.

## Focus Item 5: The `stop:false` Guard (D-11)

The synchronous-flood hazard is confirmed at the VICE-source level (`docs/phase0-binmon-findings.md` §1: "every hit of a non-stopping checkpoint fires a synchronous CHECKPOINT_INFO frame from inside the CPU loop... a non-stopping checkpoint over a wide address range is dangerous"). Design, respecting "never send from inside the event handler":

1. **Opt-in argument:** a stock-only optional argument on `vice_checkpoint_add` (e.g. `acknowledgeTraceRisk: true`), required whenever `stop: false` is requested. Refuse with an explanation if `stop: false` is set without it.
2. **Rate observation is synchronous and cheap; the disable action is deferred.** The event handler (already installed by the runState tracker's sibling, or a second listener registered alongside it) increments an in-memory per-checkpoint hit counter and timestamp window on every `CHECKPOINT_INFO` event for a checkpoint registered as trace-mode. This is pure arithmetic — no I/O, no `send()` call — so it never violates the "never send from inside the event handler" rule by construction.
3. **When the per-second threshold is crossed, the handler schedules the disable via a macrotask (`setImmediate()`), not a synchronous call from within the event callback.** This defers the actual `CHECKPOINT_TOGGLE` `send()` to a later tick, outside the synchronous `'event'` emission call stack, while still firing promptly (not waiting for the next unrelated tool call). `[ASSUMED — this session's own synthesis, not sourced from CONTEXT.md or an external document; flagged for planner confirmation, see Assumptions Log A4]` An acceptable alternative the planner may prefer: defer the disable to "the next dispatch of any kind checks a `pendingAutoDisables` list and issues the toggle before proceeding," which trades promptness for an even simpler implementation (no `setImmediate` reasoning needed) — D-11's own text ("reported in the answer") is compatible with either.
4. **The auto-disable reports the checkpoint id and reason in whichever answer surfaces it** — either the next tool call's answer (if using the deferred-dispatch-check design) or a fire-and-forget log plus the state being reflected next time `vice_checkpoint_list` is called.

## Focus Item 6: `outputSchema` Enforcement (D-02)

**How the manifest is consumed today:** `vice-proxy.ts` resolves the manifest path via `stockDispatch.manifestPathForBackend()`, reads the file with `readFileSync`, `JSON.parse`s it, and answers `tools/list` with whatever `tools` array it finds (confirmed by reading `vice-proxy.ts` lines 415-444 this session) — it does not currently special-case `outputSchema` or any other manifest field. Adding `outputSchema` to each stock entry therefore requires **zero changes to `vice-proxy.ts`**: the field passes through as inert extra JSON that `tools/list` serves unchanged (the MCP spec tolerates additional fields on a tool descriptor; a client that doesn't understand `outputSchema` simply ignores it).

**The cheapest test, given the Node-built-in-test-runner-only convention and zero schema-library policy:** write one small, hand-rolled recursive shape-checker (in a new small module, e.g. `stock-schema-check.ts`, or as a local helper inside `stock-dispatch.test.ts` if the planner judges it not worth its own file) covering exactly the JSON-Schema subset the manifest's own `outputSchema` entries will use — `type: "object"|"string"|"number"|"boolean"|"array"`, `properties`, `required`, `items`, `enum`. No `$ref`, no `oneOf`/`anyOf`, no `format` validators — the manifest doesn't need them and adding support for constructs nothing uses is exactly the over-engineering this project's zero-dependency posture argues against.

```typescript
// Sketch: minimal shape-checker sufficient for this manifest's actual schemas.
// Returns a list of violations (empty = valid), never throws.
export function checkAgainstSchema(value: unknown, schema: JsonSchemaSubset): string[] { /* ~40 lines */ }
```

**The test itself** (recommend as a `stock-dispatch.test.ts` addition, or a small new co-located test file): for every entry in `tools-manifest.stock.json` that has a dispatch-table handler, invoke the handler against a stubbed `StockDispatchDeps` (the existing `stock-dispatch.test.ts` conventions for stubbing `connect`/`ensureLease` already establish this pattern), parse the returned `content[0].text` as JSON, and assert `checkAgainstSchema(parsed, entry.outputSchema)` is empty. This needs no live emulator — it is exactly the kind of fixture-driven test the Validation Architecture section below formalises.

## Focus Item 7: D-17's Path-Translation Table

`hostpath.ts`'s closed consumer set is currently small and explicit — this session's read of the file confirms it exports `hostPathCandidates()`, `hostPath()`, `tryHostPaths()`, `describe()`, all taking an optional `workspaceRoot` (never importing `repo-root.ts` directly, to avoid the documented three-module import cycle). The **existing reference pattern for a stock-adjacent consumer already exists**: `vice-sync.ts`'s `screenshot()` function (fork-side, but structurally identical to what Phase 3 needs):

```typescript
// Source: .claude/mcp/vice/vice-sync.ts:328-336 (existing, fork-side, read this session)
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

**Recommended D-17 table shape** — a single declared, exported constant naming exactly which stock handlers have emulator-side path arguments, consulted at the start of each named handler (not a runtime scan, and not a per-handler ad hoc decision):

```typescript
// stock-machine.ts or a small stock-paths.ts, whichever the planner prefers --
// either way, ONE declared constant, never a per-handler judgment call.
export const STOCK_EMULATOR_SIDE_PATH_TOOLS: ReadonlySet<string> = new Set([
  "vice_autostart",       // AUTOSTART's filename
  "vice_disk_attach",     // AUTOSTART's filename (D-14 approximation)
  "vice_snapshot_save",   // DUMP's filename (client-constructed from `name`)
  "vice_snapshot_load",   // UNDUMP's filename (client-constructed from `name`)
]);
```

Each of the four listed handlers calls `tryHostPaths(constructedPath, (hostPath) => encodeAndSend(hostPath), { workspaceRoot: repoRoot() })` directly — never `rewriteArguments()`, which lives inside `forwardToVice()` and which the stock path structurally cannot reach (there is no code path from `stock-dispatch.ts` into `vice-proxy.ts`'s fork-transport function). This satisfies D-17 by construction rather than by discipline: the four handlers are the only place a stock handler ever builds a host-facing path, and nothing else in the stock tree imports `hostpath.ts` at all.

## Focus Item 8: D-13's Broker Change

**What `broker-launch.mts` does today (read in full this session):** `buildViceArgs(port, { backend, mcpHost, binmonHost, viceArgsEnv })` is the one function that resolves the emulator's argv; its `backend === "stock"` branch currently returns exactly `["-binarymonitor", "-binarymonitoraddress", "ip4://<host>:<port>"]` (lines 133-147), with a one-time stderr warning if the binmon bind is widened past `127.0.0.1`. This is the single, small, well-isolated change surface for D-13's launch-flag half.

**What adding `-remotemonitor` plus a second port entails, concretely:**

1. `buildViceArgs()`'s stock branch needs a second port parameter (e.g. `remoteMonitorPort`) and must append `-remotemonitor -remotemonitoraddress ip4://<host>:<second-port>` (following VICE's own flag-naming symmetry with `-binarymonitor`/`-binarymonitoraddress`; `[ASSUMED]` exact flag spelling for `-remotemonitor`'s address option — not confirmed against the manual this session since Phase 3's own scope explicitly builds no text client and CONTEXT.md itself defers the exact flag combination's *use* to Phase 7; recommend a quick manual-cross-check as part of implementation, not blocking research).
2. **Port allocation:** the broker's existing single-port-per-instance model (`spawnAndRecordInstance()`, `InstanceRecord`) needs a second field (e.g. `remoteMonitorPort: number`) alongside `port`, allocated the same way — "ports are allocated, never contested" (Phase 2 D-14) applies identically to the second port; it is not a new allocation *mechanism*, just a second value flowing through the existing one.
3. **The instance record** (`broker-state.mts`'s `InstanceRecord`) gains this field so `broker-control.mts`'s `host_state`/`status` responses can report it if a future (Phase 7) consumer needs to discover it.
4. **`monitor_claim`/`monitor_release` do NOT need to change in Phase 3.** This session's read of `vice-broker-client.ts` and `broker-control.mts` confirms `InstanceRecord.monitorClient` is a **single field per instance** (`{ grantId, claimedAt, pid }`), keyed by `targetId` (the grant), not by port or socket — it currently has no concept of "which of the instance's two monitor sockets is this claim for." **Recommendation for the planner, stated explicitly since CONTEXT.md hands this decision down:** leave the mechanism unclaimed for the second socket in Phase 3, deliberately — nothing dials `-remotemonitor`'s port yet (Phase 3 builds no text client), so there is no ownership conflict to guard against. Phase 7, which does build a text-monitor client, is the right place to extend `MonitorHolder`/the claim protocol with a channel discriminator (e.g. `channel: "binary" | "text"`) if concurrent binary+text access to one instance is ever needed — extending a not-yet-used mechanism speculatively in Phase 3 would be exactly the kind of premature abstraction this codebase's own "single seam, added when its first consumer exists" pattern argues against (see Phase 4's own DERIV-07 note: "avoids both a seam with no user and a seam retrofitted under three consumers at once").
5. **`build.ts` → `resources/*.mjs` rebuild obligation:** `broker-launch.mts` is one of the seven `.mts` files `build.ts` compiles into committed `resources/*.mjs` (per `ARCHITECTURE.md`'s "Generated-but-committed artifacts" pattern and `HOST_BOUND_ARTIFACTS`'s asserted exact-match set). Any edit to `buildViceArgs()`/`spawnAndRecordInstance()`/`InstanceRecord` **must** be followed by `node build.ts` before commit, or `resources-sync.test.ts` fails CI — this is a hard, mechanically-checked obligation, not a style preference.

## Focus Item 9: Validation Architecture (MANDATORY)

`workflow.nyquist_validation` is `true` in `.planning/config.json` (absent-defaults-to-enabled would apply anyway; it is explicitly `true` here), so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node:test`), no third-party framework |
| Config file | none — behaviour is `node --test`'s defaults; `.claude/mcp/vice/package.json`'s `scripts.test` is `node --test '*.test.*'` |
| Quick run command | `cd .claude/mcp/vice && node --test stock-protocol.test.ts stock-dispatch.test.ts stock-connect.test.ts` (the three existing stock-* suites; Phase 3 adds sibling `.test.ts` files next to each new module, same glob) |
| Full suite command | `cd .claude/mcp/vice && npm run test:automated` (`test-gate.mjs`, excludes the three named manual-only suites: `vice-broker-launch.test.ts`, `vice-proxy.test.ts`, `broker-e2e.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIRECT-01 | `MEM_GET`/`MEM_SET` encode correctly; `sidefx` defaults to 0 | unit (fixture round-trip: encode a body, hand-decode the bytes, assert field offsets) | `node --test stock-protocol.test.ts` | ✅ existing file, ❌ new test cases (Wave 0 gap) |
| DIRECT-02 | `REGISTERS_GET`/`SET` encode correctly; register catalog resolves names<->ids from a synthetic `REGISTERS_AVAILABLE` fixture | unit | `node --test stock-registers.test.ts` | ❌ Wave 0 |
| DIRECT-03 | `CHECKPOINT_*` encoders; condition AST refuses the documented trap set; registry + fail-closed delete-on-`CONDITION_SET`-failure | unit (golden tests for the emitter: known-bad input -> refusal message; known-good input -> exact expected wire string) | `node --test stock-condition.test.ts stock-checkpoints.test.ts` | ❌ Wave 0 |
| DIRECT-04 | `ADVANCE_INSTRUCTIONS`/`EXECUTE_UNTIL_RETURN` encode correctly; refuse while `runState === "unknown"` | unit | `node --test stock-execution.test.ts` | ❌ Wave 0 |
| DIRECT-05 | `PING`/`EXIT` short-circuit on known `runState`; no wire traffic on a genuine retry | unit — feed the runState tracker synthetic `'event'` frames (`ParsedStoppedEvent`/`ParsedResumedEvent`), assert `send()` is/isn't called via a stubbed client, matching this codebase's dependency-injection mocking convention | `node --test stock-runstate.test.ts stock-execution.test.ts` | ❌ Wave 0 |
| DIRECT-06 | `RESET`/`AUTOSTART` encode correctly; disk-attach unit-8-only refusal for units 9-11; `run_after` follow-up `EXIT` logic | unit | `node --test stock-machine.test.ts` | ❌ Wave 0 |
| DIRECT-07 | `KEYBOARD_FEED`/`JOYPORT_SET` encode correctly; the new PETSCII table round-trips every mapped ASCII character | unit (exhaustive table test: every input byte this table claims to handle produces the documented PETSCII byte) | `node --test stock-petscii.test.ts stock-machine.test.ts` | ❌ Wave 0 |
| DIRECT-08 | `DUMP`/`UNDUMP` encode correctly; path translation invoked (stubbed `hostpath.ts` call, matching `vice-sync.ts`'s own untested-without-a-real-emulator posture for the *translation succeeding* half) | unit (encoder) + integration (path-translation call is made, not that it lands a real file) | `node --test stock-machine.test.ts` | ❌ Wave 0 |
| DIRECT-09 | `BANKS_AVAILABLE`/`REGISTERS_AVAILABLE` encode correctly; new tool naming decision reflected in manifest + dispatch table | unit | `node --test stock-memory.test.ts stock-registers.test.ts` | ❌ Wave 0 |
| D-02 (`outputSchema`) | Every stock handler's answer validates against its own declared `outputSchema` | unit (schema-conformance harness, Focus Item 6) | `node --test stock-dispatch.test.ts` | ✅ existing file, ❌ new schema-check cases (Wave 0 gap) |

### Sampling Rate

- **Per task commit:** the quick run command for whichever family module the task touched.
- **Per wave merge:** `npm run test:automated` (full automated suite).
- **Phase gate:** full suite green, plus `npm run typecheck`, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `stock-address.test.ts` — `parseAddress()`'s decimal/`$hex`/`0x` forms, plus the "no symbol table loaded" refusal path
- [ ] `stock-runstate.test.ts` — new file, covers D-06/07/08's tracker against synthetic event sequences
- [ ] `stock-condition.test.ts` — new file, golden tests for the AST/emitter and every named refusal case
- [ ] `stock-checkpoints.test.ts` — new file, covers the D-10 registry and fail-closed delete-on-failure path
- [ ] `stock-execution.test.ts` — new file, covers D-07's `unknown`-state gating and D-08's short-circuit
- [ ] `stock-machine.test.ts` — new file, covers `RESET`/`AUTOSTART`/keyboard/joystick/snapshot encoders and the unit-8-only disk-attach refusal
- [ ] `stock-registers.test.ts` — new file, covers the register catalog (Pattern 3) against a synthetic `RegistersAvailable` fixture
- [ ] `stock-petscii.test.ts` — new file, exhaustive round-trip over the new conversion table
- [ ] `stock-dispatch.test.ts` extension — new schema-conformance test cases per D-02, using the Focus-Item-6 hand-rolled checker
- [ ] `stock-protocol.test.ts` extension — new encoder-shape test cases for every body layout in the four family tables above

### What genuinely cannot be validated offline (verification debt, not silently claimed)

- **Whether `stock-protocol.ts`'s new encoders are byte-for-byte accepted by a real VICE binary.** This research grounds every body layout in the official VICE manual (`[CITED]`) and, where possible, in this repo's own already-tested `probe-binmon.mjs` builders (`[VERIFIED]`), but the manual is documentation, not the source itself, and several fields (`ADVANCE_INSTRUCTIONS`'s `stepOver` semantic, `JOYPORT_SET`'s bit layout, `-remotemonitor`'s exact flag spelling) are flagged `[ASSUMED]` above precisely because no probe run in this session confirmed them against either the fork (3.10) or the genuinely-stock (3.9, apt) binary present in this dev environment. Recommend filing this as a pending todo in the same style as the two already-reviewed Phase 2 items (`2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`, `2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`) — a probe-extension task for whichever session has hands-on access, not a Phase 3 blocker.
- **Whether the machine genuinely returns to its exact prior run state across the full connect/handshake/tool-call/disconnect cycle in practice**, since `runState`'s honesty (D-07) is a design property provable by unit test against synthetic events, but its real-world correctness depends on the actual event ordering a real emulator emits, which `docs/phase1-probe-results.md` recorded for a *subset* of transitions, not this phase's full new tool set.

## Focus Item 10: Sizing

**Rough file-count/complexity estimate per family**, assuming the shared-seams-first sequencing (Pattern 1) is adopted:

| Unit | New/changed files | Rough complexity | Notes |
|------|--------------------|-------------------|-------|
| Shared seams (recommended Wave 1) | `stock-address.ts`, `stock-runstate.ts`, `stock-registers.ts` (catalog half only), a shared error-text helper, plus encoder scaffolding conventions in `stock-protocol.ts` | Small-Medium | Blocking dependency for every family below; small in code volume but high in design-decision density (this is where D-04/D-06/D-07/D-08 get made real) |
| Family A (memory/registers) | `stock-memory.ts`, `stock-registers.ts` (handler half), `stock-protocol.ts` encoder additions (`memGetBody`/`memSetBody`/`registersGetBody`/`registersSetBody`/`registersAvailableBody`/`banksAvailableBody`) | Medium | Register catalog (Pattern 3) is a real new sub-seam within this family, not trivial plumbing |
| Family B (checkpoints/watchpoints) | `stock-condition.ts`, `stock-checkpoints.ts`, encoder additions (`checkpointSetBody`/`checkpointToggleBody`/`conditionSetBody`/`cpNumBody`) | Medium-Large | The condition AST/emitter (Focus Item 4) and the D-10 registry + D-11 rate limiter are the most design-dense pieces in the whole phase |
| Family C (execution control) | `stock-execution.ts`, encoder additions (`advanceInstructionsBody`) | Small | `PING`/`EXIT` need no new body encoder (empty bodies); mostly `runState`-gating logic, which the shared seam already provides |
| Family D (machine control) | `stock-machine.ts`, `stock-petscii.ts`, encoder additions (`resetBody`/`autostartBody`/`dumpBody`/`undumpBody`/`keyboardFeedBody`/`joyportSetBody`), `hostpath.ts` consumer additions | Medium-Large | The largest *tool count* of the four families (9 fork tools map here) and carries two of the three genuinely new findings (AUTOSTART's missing unit field, the missing PETSCII table) |
| Broker (D-13, cross-cutting but small) | `broker-launch.mts` (+ rebuild), `broker-state.mts` | Small | Isolated, no dependency on any of the four families; can run fully in parallel with all of them |
| Manifest + dispatch wiring | `tools-manifest.stock.json` (~20 entries + `outputSchema` each), `stock-dispatch.ts` (~20 table entries) | Medium (breadth, not depth) | Every family's plan touches this file; recommend each family's plan owns its own entries to avoid merge conflicts, or a final small integration plan that adds all entries together after the family handlers exist |

**Answering the "truly independent, or serialising first wave?" question directly:** CONTEXT.md's note that the four families are "largely independent" is correct for their *emulator-facing behaviour* (no family's wire calls depend on another family's wire calls), but it is not fully independent at the *implementation* level. Three shared seams are hard blockers for all four: `parseAddress()` (used by A and B), the `runState` tracker (used by every answer in all four, per D-06), and the register catalog (used only by A, so less of a cross-family blocker than the first two). Recommend: **one small Wave 1 landing the shared seams**, then **Waves 2+ running the four family plans in parallel** — which matches CONTEXT.md's "largely independent" framing once the shared prerequisite is separated out, rather than contradicting it.

## Common Pitfalls

### Pitfall 1: Conflating `RESET`'s power-cycle with `RESOURCE_SET`'s power-cycle

**What goes wrong:** A handler or a reviewer assumes `vice_machine_reset(mode: "hard")` needs the same deny-list treatment CLAUDE.md documents for `MachineVideoStandard`/`VICIIModel`/`MachinePowerFrequency`.
**Why it happens:** Both mechanisms end at "the machine power-cycles," and CLAUDE.md's warning is phrased generally enough to read that way on a skim.
**How to avoid:** `RESET` (0xcc) with `resetMode: 0x01` is the DIRECT-06-requested, agent-initiated hard reset — no gating needed. The CLAUDE.md warning is specifically about `RESOURCE_SET` (0x52) writes to those three named resources, which is Phase 6 (GAIN-09) territory and a completely different opcode.
**Warning signs:** A plan or review comment proposing a "hard reset confirmation" checkpoint or deny-list entry for `vice_machine_reset` itself.

### Pitfall 2: Treating `AUTOSTART`'s missing unit field as a Phase 3 implementation bug to "fix"

**What goes wrong:** An implementer discovers mid-task that `vice_disk_attach`'s `unit` argument can't be threaded into `AUTOSTART`'s wire body and spends effort looking for a workaround (e.g. probing `RESOURCE_SET` names) instead of scoping the tool down.
**Why it happens:** The fork's schema makes `unit` look like a normal, always-honourable required argument.
**How to avoid:** This is a protocol-level gap (confirmed against the official manual this session), not a code bug. The correct Phase 3 response is either an explicit unit-8-only scope with a clear refusal for 9-11, or an explicit deferral to Phase 6 — a decision, not a debugging exercise.
**Warning signs:** Time spent searching VICE resource names for a per-unit disk-attach route mid-implementation.

### Pitfall 3: Building the PETSCII table from a single online table without an exhaustive round-trip test

**What goes wrong:** PETSCII's unshifted/shifted case-swap regions are a frequent source of off-by-one and reversed-case bugs when hand-transcribed.
**Why it happens:** The mapping "looks like" a simple 0x20 XOR in the letter ranges, but the boundary bytes and control-code region (0x00-0x1f, 0x80-0x9f) don't follow that rule uniformly.
**How to avoid:** Write the table, then write a test that round-trips every byte the table claims to convert and asserts the exact expected output — not a spot-check of a handful of letters. The fork's own `petscii_upper` default-true behaviour (uppercase ASCII displays as uppercase on C64) is the specific semantic to preserve.
**Warning signs:** A test file with fewer than ~10 assertions for a ~190-entry table.

### Pitfall 4: Registering the runState/rate-limiter event listener more than once per client

**What goes wrong:** If `attachRunStateTracker()` (or the rate-limiter's listener) is accidentally called more than once against the same `ViceMonitorClient` — e.g. from inside `ensureStockSession()`'s reuse branch rather than only its fresh-connect branch — every event fires the update logic multiple times, which is often harmless for a pure state assignment but becomes a real bug the moment any listener has a side effect (as the rate limiter's deferred-disable does).
**Why it happens:** `ensureStockSession()` has multiple branches that can return an already-held session; a careless call site attaches a tracker unconditionally on every `ensureStockSession()` call rather than once per `stockConnect()`/`stockReconnect()`.
**How to avoid:** Attach exactly once, inside `stockConnect()`/`stockReconnect()` themselves (or immediately after they return, at the one call site that invokes them), never inside `ensureStockSession()`'s session-reuse branch.
**Warning signs:** A test asserting "N events produce state X" that passes locally but a manual multi-call trace shows the listener firing more than once per real event.

## Code Examples

### Encoding a `MEM_GET` request (side-effect-free read)

```typescript
// Source: probe-binmon.mjs:265-276 (this repo's own offline-tested reference),
// ported into stock-protocol.ts's encoder section.
const body = memGetBody({ sidefx: false, start: 0xd019, end: 0xd019, memspace: 0x00 });
await client.send(CommandType.MemoryGet, body);
// sidefx: false is the DEFAULT -- reading $D019 must not acknowledge the IRQ,
// satisfying success criterion 1 verbatim.
```

### A correctly-built condition (RL/CY, parenthesised, hex)

```typescript
// Source: docs/phase0-binmon-findings.md §1/§5 (RL/CY, parenthesisation, hex-by-default)
const node: ConditionNode = {
  kind: "and",
  left: { kind: "comparison", left: { kind: "pseudo", name: "RL" }, op: "==", right: { kind: "literal", value: 0x64 } },
  right: { kind: "comparison", left: { kind: "pseudo", name: "CY" }, op: "==", right: { kind: "literal", value: 0x14 } },
} as any; // structural sketch -- see Focus Item 4 for the real discriminated union
emitCondition(node); // => "(RL == $64) && (CY == $14)" -- never "RL == $64 && CY == $14"
```

## State of the Art

| Old Approach (custom fork, `-mcpserver`) | Current Approach (stock, binary monitor) | When Changed | Impact |
|--------------------------------------------|----------------------------------------|--------------|--------|
| Server-side ASCII->PETSCII conversion (inside the fork's C code) | Client-side conversion (new `stock-petscii.ts`) | This phase | New maintenance surface; must be exhaustively tested since there is no second implementation to cross-check against |
| Fork's HTTP JSON answers, one bespoke shape per tool, no schema | Stock-native JSON answers with a machine-checked `outputSchema` per tool (D-01/D-02) | This phase | A genuine improvement in contract clarity, at the cost of authoring ~20 schemas |
| Implicit "the machine keeps running unless a checkpoint stops it" (fork) | Explicit, honestly-reported `runState` on every answer, with reads halting the machine (D-05/06) | This phase | The single biggest behavioural divergence in the whole milestone (CONTEXT.md's own words) — every skill that reads memory mid-run must be revisited (SKILL-01, Phase 8) |

**Deprecated/outdated:** the milestone-intent note's original "keep every tool, annotate per backend" policy (superseded by Phase 2's D-07); `vice_checkpoint_set_ignore_count`'s server-side counting (no longer feasible without violating D-05).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `-remotemonitor`'s address-option flag is spelled `-remotemonitoraddress`, symmetric to `-binarymonitor`/`-binarymonitoraddress` | Focus Item 8 | Broker launch fails to bind the text-monitor port at the intended address; caught immediately by a launch smoke-test, low real-world risk since Phase 3 dials nothing on this port |
| A2 | `ADVANCE_INSTRUCTIONS`'s `SO` (step-over) byte behaves identically to the fork's `stepOver` semantic (skip a `JSR`'s subroutine as one step) | Family C table (Focus Item 1) | `vice_execution_step`'s `stepOver: true` could silently behave like a plain single-instruction step instead of skipping the subroutine; would surface as a wrong PC after stepping over a `JSR` in manual testing |
| A3 | `JOYPORT_SET`'s `value` bitfield uses VICE's conventional joystick bit layout (bit0=up, bit1=down, bit2=left, bit3=right, bit4=fire) | Family D table (Focus Item 1) | Wrong bits would move the joystick in the wrong direction or fail to register fire; needs a probe-extension task before shipping, not silently trusted |
| A4 | Deferring the `stop:false` rate-limiter's auto-disable via `setImmediate()` (rather than a next-dispatch check) correctly satisfies "never send from inside the event handler" without introducing a new race | Focus Item 5 | If wrong, the rate limiter could still be reentrant with the flood it's trying to suppress, or could under-report to the agent which checkpoint was disabled and when |
| A5 | `AUTOSTART`'s `fileIndex` field, when repurposed for D-14's disk-attach approximation, is meaningful for a `.d64`/`.g64` image the same way it is for a multi-program disk's program selection, and defaulting it to 0 is a safe "just attach" behaviour | Family D table (Focus Item 1) | If VICE's `AUTOSTART` handler treats `fileIndex` differently when `runAfter` is false, the disk-attach approximation could behave unexpectedly (e.g. attempting to locate and partially load a specific program even with run suppressed) |

**Confirming this table is non-empty:** several claims in this document ARE user-confirmation candidates for `/gsd-discuss-phase` follow-up, chiefly A2/A3 (exact opcode behaviour never probed against a real binary in this session) and the AUTOSTART unit-field finding (which is `[CITED]`/HIGH confidence as a documentation fact but changes DIRECT-06's effective scope and may warrant an explicit user decision on unit-8-only vs. Phase-6 deferral).

## Open Questions

1. **Should `vice_disk_attach` on stock be scoped to unit 8 only in Phase 3, or should multi-unit attach be deferred to Phase 6 entirely?**
   - What we know: `AUTOSTART` has no unit-selection field at all (confirmed against the official VICE manual this session); `RESOURCE_SET` is not documented as an attach mechanism either.
   - What's unclear: whether some other VICE mechanism (a resource name this research didn't surface, or a text-monitor `attach` command usable once Phase 7's text client exists) could reach units 9-11 at all, ever, without relaunching the instance.
   - Recommendation: scope Phase 3's `vice_disk_attach` to unit 8, refuse 9-11 explicitly with text naming this exact limitation, and record it in `docs/stock-vice-parity.md` alongside D-14's existing approximation note; revisit if Phase 7's text-monitor work turns up a route.

2. **Where should the two new stock-only tool names land** (`EXECUTE_UNTIL_RETURN`'s tool name, and `REGISTERS_AVAILABLE`'s surface) **relative to the fork's naming conventions, for future parity-harness legibility (Phase 8, VERIF-03)?**
   - What we know: CONTEXT.md explicitly hands this naming decision to the planner; this research recommends `vice_execution_return`/`vice_execution_until_return` and a new `vice_registers_available` tool (not a field on `vice_registers_get`).
   - What's unclear: whether Phase 8's parity harness will want a naming convention that signals "stock-only, no fork counterpart" more visibly (e.g. a documented naming prefix or a manifest-level `stockOnly: true` flag) versus just relying on the tool being absent from the fork manifest.
   - Recommendation: use plain, convention-matching names now; Phase 8 can add a manifest-level marker later without renaming anything, since D-02's `outputSchema` addition already shows the manifest schema tolerates new optional fields.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All Phase 3 code (container-side, no build step) | ✓ | v22.22.0 | — |
| npm | Dependency management (none new needed) | ✓ | 10.9.4 | — |
| Genuinely stock VICE (`x64sc`) | Live protocol validation (NOT exercised this research session, per task scope) | ✓ (present, unused) | `/usr/bin/x64sc`, VICE 3.9+dfsg-1 (apt) | Spec-driven research this session; live validation deferred as verification debt (see Focus Item 9's "cannot be validated offline" list) |
| Fork VICE (`x64sc`) | Cross-check only, not this phase's target backend | ✓ (present, unused) | `/usr/local/bin/x64sc`, VICE 3.10-based fork | — |

**Missing dependencies with no fallback:** none — this phase adds no new dependency and this research session deliberately did not require live emulator access (per the task's explicit "no live stock VICE is available... research must ground every wire-level claim in normative docs" instruction, honoured even though both binaries happen to be present in this container).

**Missing dependencies with fallback:** live opcode-behaviour confirmation (Assumptions A2/A3/A5) has a fallback of "ship flagged as ASSUMED, verify via a probe-extension task in a session with hands-on access" — the same disposition already applied to Phase 2's two pending fixture/discriminator todos.

## Security Domain

`security_enforcement` is `true` (ASVS level 1, block-on `high`) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | The binary monitor is unauthenticated by VICE's own design (already documented in `broker-launch.mts`'s own header comment); Phase 3 adds no new auth surface, and the existing bind-to-loopback-by-default posture (`VICE_BROKER_BINMON_HOST` default `127.0.0.1`) is unchanged |
| V3 Session Management | Partial | The stock session (`StockConnectSession`) is a connect-scoped object, not a user session; its lifecycle is already governed by `ensureStockSession()`/`stockReconnect()` (Phase 2) and unchanged by Phase 3 |
| V4 Access Control | Yes | The `MachinePowerFrequency`/`VICIIModel`/`MachineVideoStandard` power-cycle deny-list is Phase 6's `RESOURCE_SET` allow-list, not Phase 3's concern (Pitfall 1) — but Phase 3's own `RESET`'s `resetMode` byte and `AUTOSTART`'s path arguments ARE within Phase 3's access-control surface (see V5/V12 below) |
| V5 Input Validation | Yes | `parseAddress()` (D-04), the condition emitter's refusal set (D-09/D-10), `conditionSetBody()`'s existing >255-byte guard (`probe-binmon.mjs`'s own comment already frames this as an ASVS V5 control), and the disk-attach unit-8-only refusal (Focus Item 1) are all input-validation controls this phase must implement, not merely inherit |
| V12 File and Resources | Yes | Every emulator-side path argument (DUMP/UNDUMP/AUTOSTART/disk-attach filenames) crosses the container/host boundary via `hostpath.ts` (D-17) — the existing `CONTAINER_ONLY_FS` check and the closed-consumer-set discipline are the relevant controls; Phase 3 must not construct a path that escapes the workspace root without going through this seam |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a snapshot `name` or autostart `path`/`program` argument reaching the host filesystem outside the intended directory | Tampering / Information Disclosure | `hostpath.ts`'s existing candidate-resolution + the constructed-path convention (snapshot names built into a fixed `mcp_snapshots/`-style directory rather than accepting an arbitrary path) — recommend the snapshot-save/-load handlers sanitise `name` (alphanumeric/underscore/hyphen only, matching the fork's own existing schema description) before constructing the file path, never trusting it as a path fragment unchecked |
| A silently-always-false checkpoint condition being mistaken for "armed and correct" (operator-precedence / bare-decimal / wrong-case traps) | Tampering (of the debugging session's own integrity, not an external attacker) | The typed AST + canonical emitter (D-09), which makes the class of bug structurally unreachable rather than relying on caller discipline |
| A denial-of-service against the emulator itself via an unbounded `stop:false` `CHECKPOINT_INFO` flood | Denial of Service | D-11's opt-in + rate-limit + auto-disable guard |
| Oversized/malformed `CONDITION_SET` expression desyncing the wire stream | Tampering / Denial of Service | The existing >255-byte throw guard (`probe-binmon.mjs`, already implemented, to be ported into `stock-protocol.ts`'s `conditionSetBody()`) |
| A second, uncoordinated client attaching to the (future, Phase 7) `-remotemonitor` text-monitor socket while the binary-monitor client is also connected, bypassing the existing single-client discipline | Elevation of Privilege / Tampering | Not this phase's problem to solve (Phase 3 builds no text client and dials nothing on the second port), but flagged here so Phase 7's own security review does not assume `monitor_claim`/`monitor_release` already covers it — Focus Item 8 states explicitly that it currently does not |

## Sources

### Primary (HIGH confidence)
- `docs/phase0-binmon-findings.md` — normative protocol document, read in full this session; opcode set, error codes, event semantics, memspace byte, condition parser traps
- `docs/phase1-probe-results.md` — real-emulator probe results (referenced, cross-checked against `phase0-binmon-findings.md`'s own summary of it)
- `.planning/phases/03-direct-tools/03-CONTEXT.md` — read in full, all 17 locked decisions
- `.planning/phases/02-stock-backend-connection/02-CONTEXT.md` — read in full, prior-phase decisions this phase builds on
- `.claude/mcp/vice/stock-protocol.ts` — read in full (1459 lines)
- `.claude/mcp/vice/stock-dispatch.ts` — read in full (478 lines)
- `.claude/mcp/vice/stock-connect.ts` — read in full (428 lines)
- `.claude/mcp/vice/hostpath.ts` — read in full (319 lines)
- `.claude/mcp/vice/vice-sync.ts` — read in full (337 lines), reference pattern for D-17
- `.claude/mcp/vice/probe-binmon.mjs` — grepped and read relevant sections (260-360, 780-800); already-tested encoder implementations
- `.claude/mcp/vice/vice-broker-client.ts`, `broker-control.mts`, `broker-launch.mts` — grepped and read relevant sections; `monitor_claim`/`monitor_release` and `buildViceArgs()` mechanics
- `.claude/mcp/vice/tools-manifest.json` — parsed programmatically (63 tools); full schemas extracted for every Phase 3-relevant tool
- `.claude/mcp/vice/tools-manifest.stock.json` — read in full (14 lines, one entry today)
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/TESTING.md` — read in full
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — read in full
- `vice-emu.sourceforge.io/vice_13.html` (official VICE manual, §13 Binary monitor) — fetched twice this session with targeted extraction prompts; source for every `[CITED]` request-body layout in Focus Item 1/2, and for the `AUTOSTART`-has-no-unit-field and disk-detach-has-no-opcode findings

### Secondary (MEDIUM confidence)
- General VICE joystick bit-layout knowledge underlying Assumption A3 (training-knowledge level, not confirmed against the manual page fetched or a probe this session)

### Tertiary (LOW confidence)
- `-remotemonitor`'s exact address-flag spelling (Assumption A1) — inferred by symmetry with `-binarymonitor`/`-binarymonitoraddress`, not independently confirmed
- `ADVANCE_INSTRUCTIONS`'s step-over runtime semantic (Assumption A2) — body layout is `[CITED]`, but the *behavioural* claim that it matches the fork's `stepOver` is inference, not verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, straightforward zero-dependency continuation of existing convention
- Architecture: HIGH — every seam (dispatch table, protocol client, session handshake) already exists and was read in full this session; Phase 3's additions are extensions of established patterns, not new architecture
- Tool inventory / wire layouts: HIGH for opcodes cited against the official manual or already implemented in `probe-binmon.mjs`; MEDIUM-LOW for the handful of behavioural specifics flagged `[ASSUMED]` in the Assumptions Log
- Pitfalls: HIGH for the two protocol-grounded pitfalls (RESET vs RESOURCE_SET, PETSCII table completeness); MEDIUM for the runState-listener-double-registration pitfall (design reasoning, not observed in this codebase yet since the tracker doesn't exist)

**Research date:** 2026-08-14
**Valid until:** 30 days (stable domain — VICE's binary monitor protocol has not changed under this milestone since Phase 0/1, and this phase adds no new external dependency whose version could drift)
