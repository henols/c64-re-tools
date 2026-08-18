# Phase 7: Cycle Timing and Wedge Triage - Research

**Researched:** 2026-08-18
**Domain:** Client-side reconstruction of CPU-cycle timing and emulator liveness/wedge diagnosis over stock VICE's binary monitor, where (a) every inbound byte halts the emulated machine and (b) no monotonic cycle register exists on the wire below VICE 3.10
**Confidence:** HIGH for wire-protocol facts and existing-seam mechanics (all read live from this repo's own code and from the fork's vendored VICE C source, several cross-checked against a live-launched genuine VICE 3.10 binary monitor in this session) / MEDIUM for the exact bracket-duration defaults and whether `vice_recycle` belongs in this phase's scope / LOW for NTSC-old and PAL-N real-world prevalence (PAL/NTSC dominate; the other two video standards are rare and untested here)

## Summary

Phase 7 closes the last two skill-called tool gaps on stock (`vice_cycles_stopwatch`,
`vice_run_until`) and makes `vice_diagnose` — the wedge-triage skill's documented
opening move — actually work on the stock backend instead of being refused by name.
All three problems share one root cause and one architectural consequence that this
research treats as its central finding: **stock VICE's binary monitor has no
non-pausing observation of any kind.** `monitor_check_binary()` calls
`monitor_startup_trap()` on **any** inbound byte (`monitor_binary.c:281`, confirmed
both by this project's own docs and by every wire trace in this session), so a bare
`PING` halts the machine within about one frame exactly like every other command.
The fork's own C implementation of `vice_cycles_stopwatch`
(`mcp_tools_debug.c:842-912`) and its wedge-triage cycle bracket (`vice-sync.ts`,
`vice-proxy.ts`'s `runCycleBracket()`) both depend on a capability stock does not
have: an in-process function call (`mon_stopwatch_get_elapsed()`,
`monitor.c:1565-1570`) that reads VICE's internal clock **without ever entering the
monitor**, and a non-pausing `vice_ping` the fork's own HTTP transport happens to
provide. Neither exists on stock. Every stock design in this document is shaped by
that gap, not by a missing opcode.

A second, independently significant finding from this session's own source reading
and a **live empirical test against the genuine VICE 3.10 binary already vendored in
this repo's fork build**: `stock-connect.ts`'s existing `probeCpuHistory()`
(Phase 2/BACK-04) sends `CPUHISTORY_GET` with `count=0` and only recognises
`InvalidType` (0x83) and `CmdFailure` (0x8f) as failure codes. A real VICE build
requires `count >= 1` (`monitor_binary.c:1493-1497`, upstream monitor code, not a
fork patch) and rejects `count=0` with `InvalidParameter` (0x81) — confirmed live in
this session (see Sources). `probeCpuHistory()` does not handle 0x81 and lets it
propagate, which throws out of `resolveCapabilities()` and fails the **entire**
stock connect handshake on any genuine VICE >= 3.10 build. This is a pre-existing
defect, not something Phase 7 introduces, but Phase 7 is the first phase whose
correctness actually depends on `session.capabilities.cpuHistory` ever reaching
`"available"` — so fixing it is a Wave 0 prerequisite for this phase, not optional
cleanup.

A third finding changes the shape of the "any supported VICE version" stopwatch
design: `docs/phase0-binmon-findings.md`'s own proposed <3.10 fallback (count frames
via a non-stopping/"trace" checkpoint at a frame-boundary address such as `$EA31`)
**directly conflicts with this project's own D-11 trace-hazard guard**
(`TRACE_HITS_PER_SECOND_LIMIT = 20`, `stock-checkpoints.ts:280`). A checkpoint that
fires once per PAL frame (~50.1 Hz) or NTSC frame (~59.8 Hz) exceeds 20 hits/second
within well under one second and gets auto-disabled by the client's own existing
safety mechanism. That fallback is therefore **not viable as a general-purpose
multi-second stopwatch** — only for brackets short enough to stay under the guard's
window, which this research recommends against relying on. The honest design
this document recommends instead: an exact route on VICE >= 3.10 via
`CPUHISTORY_GET`'s monotonic per-entry `cycle` field (no checkpoint needed at all),
and, below 3.10, a `LIN`/`CYC` reconstruction that reports an exact answer only when
it can prove no frame boundary was crossed, and refuses explicitly — never
returning zero, never guessing — when it cannot.

**Primary recommendation:** Fix `probeCpuHistory()`'s missing `InvalidParameter`
handling first (Wave 0). Build `vice_cycles_stopwatch` and `vice_run_until` as new
derived tools (`withDerivedTool(..., {needsSession:true}, ...)`, sibling modules,
registered in `STOCK_DERIVED_TOOLS`/`STOCK_DISPATCH_TABLE` exactly like Phase 5's
eight tools) in two new files, `stock-timing.ts` (stopwatch + the shared
cycle-baseline/video-standard helpers) and `stock-run-until.ts` (temporary-checkpoint
run-to-address with guaranteed cleanup on all three named failure paths). Build a
new stock-native `vice_diagnose` handler in `stock-diagnose.ts`, registered directly
into `STOCK_DISPATCH_TABLE` (no `vice-proxy.ts` change needed — its backend-aware
registration already routes to `dispatchStock()` on stock; only a table entry is
missing), reusing the fork's already-proven checkpoint-trap algorithm ported to
stock's own MEM_GET/REGISTERS_GET primitives, and adding one new verdict
(`monitor_held_elsewhere`) that is already fully evidenced by the existing
`MonitorOwnershipError`/`convertHandshakeError()` machinery from Phase 2 — no new
detection mechanism required, only a new named outcome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cycle-elapsed measurement (TIME-01/03, `vice_cycles_stopwatch`) | API/Backend (container-side MCP process, client-side reconstruction/composition) | Database/Storage (`REGISTERS_GET`/`CPUHISTORY_GET`, themselves a Database/Storage-tier concern from this server's point of view) | No wire opcode measures elapsed cycles directly; this is always a client-side composition over one or two direct reads |
| Run-until-address with guaranteed cleanup (TIME-02, `vice_run_until`) | API/Backend | Database/Storage (`CHECKPOINT_SET`/`EXIT`/event demux) | Composes a temporary checkpoint + resume + event wait + conditional delete; no 1:1 opcode |
| Wedge/liveness diagnosis (TIME-04, stock `vice_diagnose`) | API/Backend | Database/Storage (`CHECKPOINT_LIST`, `REGISTERS_GET`, `MEM_GET`) | Composes several direct reads into a five-verdict classification; already the fork's own architecture, ported |
| Monitor-ownership conflict detection (criterion 3's fifth state) | API/Backend | Broker/control-plane (a Database/Storage-adjacent concern for this server) | Already fully implemented by Phase 2's `MonitorOwnershipError`/`ensureStockSession()` — this phase only surfaces it as a named verdict |

No browser, SSR, or CDN tier exists in this architecture (a stdio MCP server plus an
external emulator process) — identical framing to Phases 4 and 5's own maps.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIME-01 | User can measure elapsed CPU cycles on the stock backend, on any supported VICE version | No opcode measures elapsed cycles. Route A (VICE >= 3.10): `CPUHISTORY_GET`'s per-entry monotonic `cycle` field (`monitor_binary.c:1598`, uint64), read before/after — accurate for any bracket length, no version-independent fallback needed once the `probeCpuHistory()` defect (below) is fixed. Route B (any version, including the Debian/Ubuntu-shipped 3.9): reconstruct from `LIN`/`CYC` already surfaced generically through `stock-registers.ts`'s `registers` map — exact only when provably within one video-standard frame (see Pitfall 2); the honest refusal path (TIME-03) is what covers everything else. |
| TIME-02 | User can run until an address is reached, exactly | `CHECKPOINT_SET` (0x12) with `temporary:true` (already a supported wire field, `stock-protocol.ts:579,596`, empirically confirmed live on both 8- and 9-byte bodies, `docs/phase1-probe-results.md` item 1) + `EXIT` (0xaa, resume) + an event-driven wait for the matching `CHECKPOINT_INFO`/`STOPPED` event, reusing the narrowing pattern `stock-checkpoints.ts`'s D-11 trace guard already established. |
| TIME-03 | Cycle-bounded execution is either supported or reports its approximation honestly | The fork's own `mcp_tools_debug.c:772` already reports `cycles`-only mode as "not yet implemented; provide an address" — matched, not regressed, on stock. A **separate**, stock-only wall-clock safety deadline (NOT the fork's `cycles` argument) is what guarantees `vice_run_until`'s cleanup on a timeout (criterion 2). For the stopwatch itself, a bracket that provably crossed a frame boundary on VICE < 3.10 is refused by name, never silently truncated or reported as zero. |
| TIME-04 | `vice-wedge-triage`'s "is the emulator advancing" check works on the stock backend | The fork's ping-poll-while-running bracket (`vice-proxy.ts:1101-1113`, `vice-sync.ts`) cannot be ported: stock has no non-pausing call at all. The stock liveness bracket instead snapshots PC+`LIN`/`CYC` (or the CPU-history clock), resumes, waits a bounded **real** wall-clock interval with zero socket traffic, then sends exactly one halting read to compare. `vice_diagnose` itself does not exist on the stock dispatch table today (confirmed: `dispatchStock()`'s miss branch refuses it by name) — this phase adds it. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are locked, not discretionary, and every design decision below was checked
against them:

- **Derived tools must be intercepted BEFORE `forwardToVice()`, never behind
  `call()`.** Already structurally satisfied by the existing `withDerivedTool()`/
  `STOCK_DERIVED_TOOLS`/`STOCK_DISPATCH_TABLE` seam (Phase 4/5) — this phase's three
  new handlers (`vice_cycles_stopwatch`, `vice_run_until`, stock `vice_diagnose`)
  register through it exactly like Phase 5's eight tools. No `vice-proxy.ts` change
  is needed for `vice_diagnose`'s routing — it is already backend-aware
  (`buildBackendAwareTool()`) and already reaches `dispatchStock()` on the stock
  arm; only a `STOCK_DISPATCH_TABLE` entry is missing.
- **Five unsolicited message types at request-id `0xffffffff`,** including
  `CHECKPOINT_INFO` (0x11) sharing a response type with a legitimate reply. The new
  `vice_run_until` wait logic must key on request-id via the existing demux (already
  built, Phase 2) and narrow on the parsed event's own `.type` discriminant exactly
  like `stock-checkpoints.ts`'s D-11 guard already does (`isCheckpointInfoEvent()`),
  never on response type alone.
- **A non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the
  CPU loop, per hit** (`mon_breakpoint.c:558`, confirmed: `mon_breakpoint_event(cp)`
  runs before the `cp->stop`/`cp->temporary` checks at lines 560/605). This is
  **directly why** the frame-counter fallback in `docs/phase0-binmon-findings.md`
  §1 is rejected below (Pitfall 1) — it would fire at 50-60 Hz, an order of
  magnitude above this project's own 20 Hz trace-guard ceiling.
- **Stock VICE's binary monitor services exactly one client.** Already fully
  handled by Phase 2 (`MonitorOwnershipError`, `PROTO-08`/`BROK-02`). This phase's
  only obligation is to surface the already-thrown error as a **named verdict**
  inside the new stock `vice_diagnose`, not to build any new detection.
- **No monotonic cycle register; checkpoint conditions use `RL`/`CY`, uppercase, no
  precedence, hex-literal-by-default.** Not directly exercised by this phase's own
  checkpoints (`vice_run_until`'s temporary checkpoint is an unconditional exec-stop
  at one address, no condition attached) — recorded here only to confirm no new
  condition text is being emitted, so `stock-condition.ts`'s emitter is not touched.
- **`default_memspace` contamination from a drive checkpoint hit.** Not applicable:
  every checkpoint this phase creates targets `memspace = 0x00` (main) exclusively —
  no drive-CPU tool exists on the stock backend (Phase 6 was cut) to have set
  `default_memspace` away from main in the first place.
- **Node >= 22.18, no build step for the shipped server.** All three new modules
  are container-side `.ts`, matching every existing `stock-*.ts` family module — no
  `.mts` file, no `build.ts` rebuild.
- **`vice-sync.ts`'s three invariants** (exactly one resume per wait; poll on
  `hit_count`, never on paused state; never delete a VICE-marked temporary
  checkpoint) are a **fork-only** module's own documented rules
  (`vice-sync.ts` is imported by nothing in this tree except its own test file — it
  is legacy from the `call()`-based fork path). The **spirit** of all three survives
  in this phase's stock design (event-driven wait instead of polling; the temporary
  checkpoint's own self-delete on hit is never redundantly deleted — see Pitfall 4)
  but the mechanism is necessarily different, because stock has no non-pausing
  observation to poll with at all (see Pitfall 3).

## Standard Stack

### Core
No new runtime dependency. Every tool composes Node built-ins plus this repo's own
existing seams (`stock-registers.ts`'s register catalog, `stock-connect.ts`'s
capability cache, `stock-checkpoints.ts`'s event-narrowing pattern), matching the
project's zero-runtime-dependency posture for `.claude/mcp/vice` established in
every prior phase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node built-ins only | Node >= 22.18 (repo floor) | `Buffer` decoding for the new `CPUHISTORY_GET`/`RESOURCE_GET` parser cases, `setTimeout`-based bounded waits | Matches this repo's existing zero-dependency `.claude/mcp/vice` posture |

### Supporting
None. No CI tool, no apt package, no external binary.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frame-counting via a non-stopping ("trace") checkpoint at a fixed frame-boundary address, as `docs/phase0-binmon-findings.md` §1 originally proposed | Refuse multi-frame brackets on VICE < 3.10 and report exact cycles only within one frame | Rejected building the trace-checkpoint fallback: a 50-60 Hz hit rate exceeds this project's own `TRACE_HITS_PER_SECOND_LIMIT = 20` (`stock-checkpoints.ts:280`) within under a second, so the checkpoint would auto-disable itself mid-bracket via the existing D-11 guard — a mechanism this phase would be fighting, not using. See Pitfall 1. |
| Reaching the text monitor's own `stopwatch` console command (`monitor.c:1547-1570`, `mon_parse.y:3592-3597`) over the wire | `CPUHISTORY_GET`'s per-entry cycle field | Rejected: exhaustively confirmed absent. The binary monitor's confirmed opcode set (`docs/phase0-binmon-findings.md` §5, cross-checked directly against `monitor_binary.c`'s `enum t_binary_command`) has no "execute monitor command text" opcode of any kind. The text-monitor `stopwatch` command is reachable only from the **interactive console** (`-console`), a wholly separate code path from the binary-monitor TCP port this client speaks. See Pitfall 5. |
| Porting the fork's ping-poll-while-running liveness bracket verbatim | A snapshot-resume-wait-halt-compare bracket using real wall-clock time | Rejected porting verbatim: every stock command halts the machine (`monitor_binary.c:281`), so a "ping" on stock is not the fork's non-pausing observation — it is itself a halt. See Pitfall 3. |
| A generic "wait for any wire event" utility shared with Phase 3/5's existing polling patterns | A small, new, phase-local helper (`waitForCheckpointHit()`) | No existing helper of this shape exists in this tree (confirmed: no `waitForEvent`/`Promise.race`-based deadline helper anywhere in `.claude/mcp/vice`) — this phase is the first consumer, so it is new plumbing, not a reuse. |

**Installation:** None — no new package, no new CI step.

**Version verification:** Not applicable — no new package is proposed.

## Package Legitimacy Audit

Not applicable — this phase adds zero new npm/pip/cargo packages and zero new
external (apt/binary) dependencies. `slopcheck`/registry verification is skipped
because no package name is being introduced.

**Packages removed due to slopcheck verdict:** none — none proposed.
**Packages flagged as suspicious:** none — none proposed.

## Architecture Patterns

### System Architecture Diagram

```
Claude Code (MCP client)
        │  tools/call { name: "vice_cycles_stopwatch" | "vice_run_until" | "vice_diagnose" }
        ▼
vice-proxy.ts  CallToolRequestSchema handler (deny-list, tool lookup)
        │
        ▼
buildBackendAwareTool()  ◄── unchanged since Phase 2; vice_diagnose ALREADY routes
        │                     here via DIAGNOSE_TOOL's existing registration
        ├── backend === "fork" ──► forwardToVice()/handleDiagnose() ─► fork HTTP /mcp
        │                            (UNCHANGED -- fork implements all three in-process,
        │                             mon_stopwatch_get_elapsed()/mcp_tool_run_until()
        │                             never enter the binary monitor at all)
        │
        └── backend === "stock" ─► dispatchStock(name, args, deps)   [stock-dispatch.ts]
                                        │
                                        ├─ STOCK_DISPATCH_TABLE[name]  (3 NEW entries)
                                        │
                                        │   vice_cycles_stopwatch ───► withDerivedTool(needsSession:true)
                                        │     stock-timing.ts           → session.capabilities.cpuHistory
                                        │                                    === "available"?
                                        │                                 → YES: CPUHISTORY_GET(count:1),
                                        │                                        newest entry's u64 cycle
                                        │                                 → NO:  REGISTERS_GET, LIN/CYC +
                                        │                                        RESOURCE_GET(MachineVideoStandard)
                                        │                                        for the cycles-per-frame constant;
                                        │                                        refuse if wraparound proven
                                        │
                                        │   vice_run_until ─────────► withDerivedTool(needsSession:true)
                                        │     stock-run-until.ts        → CHECKPOINT_SET(temporary:true, stop:true,
                                        │                                    exec:true) at the resolved address
                                        │                                 → EXIT (resume)
                                        │                                 → wait for the matching CHECKPOINT_INFO
                                        │                                    event, bounded by a NEW stock-only
                                        │                                    timeout_ms deadline (never the fork's
                                        │                                    unimplemented `cycles` argument)
                                        │                                 → on hit: nothing to delete (VICE already
                                        │                                    auto-deleted it, mon_breakpoint.c:605-607)
                                        │                                 → on timeout: CHECKPOINT_DELETE, tolerate
                                        │                                    ObjectMissing (already-gone race)
                                        │                                 → on MachineRestartedError mid-wait:
                                        │                                    nothing to clean up (whole instance gone)
                                        │
                                        │   vice_diagnose (NEW on stock) ─► withDerivedTool(needsSession:true)
                                        │     stock-diagnose.ts          → catches MonitorOwnershipError from
                                        │                                    ensureStockSession() FIRST, at zero
                                        │                                    extra cost -- verdict "monitor_held_elsewhere"
                                        │                                 → catches MachineRestartedError -- verdict
                                        │                                    "restarted"
                                        │                                 → CHECKPOINT_LIST + REGISTERS_GET(PC) +
                                        │                                    MEM_GET($01,$0314,$FFFE, bank omitted
                                        │                                    == default/cpu view) -- ported verbatim
                                        │                                    from vice-proxy.ts's own
                                        │                                    resolveLiveIrqHandler()/
                                        │                                    gatherCheckpointTrapEvidence() --
                                        │                                    verdict "checkpoint_trap" if matched
                                        │                                 → else: the liveness bracket (above) --
                                        │                                    verdict "wedged" or "live"
                                        │
                                        └─ table miss ── explicit "not implemented by stock" refusal (unchanged)

PREREQUISITE (Wave 0, blocks the CPUHISTORY_GET route entirely):
stock-connect.ts's probeCpuHistory() sends CPUHISTORY_GET count=0, which a REAL
VICE build rejects with InvalidParameter (0x81) -- confirmed live in this session
against the fork's genuine VICE 3.10.0.0 binary monitor. probeCpuHistory() only
handles 0x83/0x8f and lets 0x81 propagate, throwing out of resolveCapabilities()
and failing the WHOLE stock connect handshake on any real VICE >= 3.10 build.
Fix: send count=1 (matching probe-binmon.mjs's own already-verified approach) or
add 0x81 => "available" (or a fourth capability outcome) to the classification.
```

### Recommended Project Structure
```
.claude/mcp/vice/
├── stock-dispatch.ts            # existing -- adds 3 imports + 3 table entries under withDerivedTool()
├── stock-derived.ts             # existing -- STOCK_DERIVED_TOOLS grows from 9 to 12 entries
├── stock-connect.ts             # existing -- Wave 0 FIX: probeCpuHistory()'s missing 0x81 handling
├── stock-timing.ts              # NEW -- vice_cycles_stopwatch; shared readCycleBaseline()/
│                                 #        resolveVideoStandard() helpers vice_run_until does NOT need
│                                 #        but vice_diagnose's liveness bracket reuses
├── stock-timing.test.ts         # NEW
├── stock-run-until.ts           # NEW -- vice_run_until
├── stock-run-until.test.ts      # NEW
├── stock-diagnose.ts            # NEW -- the stock-native vice_diagnose handler
├── stock-diagnose.test.ts       # NEW
├── stock-protocol.ts            # existing -- Wave 0 ADDS: a CPUHISTORY_GET response parser case
│                                 #        (currently falls through to "unknown", see Pitfall 6) and a
│                                 #        RESOURCE_GET request-body encoder + response parser case
│                                 #        (currently neither exists, see Pitfall 7)
├── stock-registers.ts           # existing -- NO code change needed; registerCatalogFor()/handleRegistersGet
│                                 #        already surface LIN/CYC generically by name
├── stock-checkpoints.ts         # existing -- NO code change needed; vice_run_until sends its OWN
│                                 #        CHECKPOINT_SET call directly (temporary:true is not exposed by
│                                 #        handleCheckpointAdd, which always sends temporary:false)
├── vice-proxy.ts                # existing -- NO change needed; DIAGNOSE_TOOL's buildBackendAwareTool()
│                                 #        registration already routes to dispatchStock() on stock
├── tools-manifest.stock.json    # existing -- 3 new entries (inputSchema + outputSchema), 34 -> 37 tools
├── package.json                 # existing -- files[] gains the 3 new production modules
└── docs/stock-vice-parity.md    # existing -- record this phase's divergences (below)
```

### Pattern 1: Every new handler is `withDerivedTool()`-registered, exactly like Phase 5's eight tools
**What:** No new adapter, no new dispatch table. Each of the three tools is one more
line in `STOCK_DISPATCH_TABLE`, one more entry in `STOCK_DERIVED_TOOLS`.
**When to use:** All three tools in this phase, including `vice_diagnose` — it
composes several direct reads exactly the way Phase 5's chip-state/sprite tools do,
which is this project's own established test for "derived."
**Example (the exact registration shape to copy, from `stock-dispatch.ts`):**
```typescript
// derived (TIME-01)
vice_cycles_stopwatch: withDerivedTool("vice_cycles_stopwatch", { needsSession: true }, handleCyclesStopwatch),

// derived (TIME-02)
vice_run_until: withDerivedTool("vice_run_until", { needsSession: true }, handleRunUntil),

// derived (TIME-04) -- NEW on stock; vice-proxy.ts's DIAGNOSE_TOOL already
// routes here via buildBackendAwareTool(), no vice-proxy.ts change needed
vice_diagnose: withDerivedTool("vice_diagnose", { needsSession: true }, handleDiagnoseStock),
```

### Pattern 2: The stopwatch picks its route from `session.capabilities.cpuHistory`, already resolved at connect time
**What:** Phase 2's BACK-04 already settles `session.capabilities.cpuHistory` (one
of `"available" | "absent" | "not_compiled_in"`, `stock-connect.ts:67-70`) exactly
once per connect, cached across reconnects to the same binary. Route selection is a
single property read, no new probe.
**When to use:** The very first line of `handleCyclesStopwatch()`'s `"read"`/
`"reset_and_read"` logic.
**Example:**
```typescript
// stock-timing.ts
if (session.capabilities.cpuHistory === "available") {
  // Route A: CPUHISTORY_GET(count:1)'s newest entry -- monotonic uint64, any bracket length
  const body = Buffer.alloc(5);
  body[0] = 0x00; // memspace: main
  body.writeUInt32LE(1, 1); // NEVER 0 -- see the Wave-0 probeCpuHistory() defect this phase depends on fixing
  const response = await session.client.send(CommandType.CpuHistoryGet, body);
  // ... decode the newest entry's u64 cycle field (new parser case, Pitfall 6)
} else {
  // Route B: LIN/CYC reconstruction, exact only within one frame -- Pattern 3
}
```

### Pattern 3: The <3.10 fallback reports exact cycles only when it can prove no frame boundary was crossed
**What:** `LIN`/`CYC` (surfaced generically by name in `vice_registers_get`'s
`registers` map, `stock-registers.ts:186-198`) encode a position within the current
frame: `position = LIN * cyclesPerLine + CYC`, bounded `0..(screenLines *
cyclesPerLine - 1)`. If `positionAfter >= positionBefore`, the delta is reported as
the exact elapsed-cycle count — honestly documented as valid only because no
wraparound was DETECTED, not because none is possible (a coincidental multiple of a
whole frame cannot be distinguished from zero elapsed frames using these two
registers alone). If `positionAfter < positionBefore`, that is **definitive proof**
that at least one frame boundary was crossed, and the count cannot be reconstructed
without `CPUHISTORY_GET` — refuse explicitly (TIME-03, criterion 1).
**When to use:** `vice_cycles_stopwatch`'s `"read"`/`"reset_and_read"` path when
`session.capabilities.cpuHistory !== "available"`.
**Example:**
```typescript
// Cycles-per-line/lines-per-frame, VERIFIED against VICE's own source
// (c64/c64.h:36-58) -- MachineVideoStandard's INTEGER resource values (RESOURCE_GET
// 0x51, read-only-safe; ONLY the SET side power-cycles per CLAUDE.md) are the fork's
// own numbering, not 0-based:
const VIDEO_STANDARDS: Record<number, { cyclesPerLine: number; screenLines: number; name: string }> = {
  1: { cyclesPerLine: 63, screenLines: 312, name: "PAL" },        // MACHINE_SYNC_PAL
  2: { cyclesPerLine: 65, screenLines: 263, name: "NTSC" },       // MACHINE_SYNC_NTSC
  3: { cyclesPerLine: 64, screenLines: 262, name: "NTSC-old" },   // MACHINE_SYNC_NTSCOLD
  4: { cyclesPerLine: 65, screenLines: 312, name: "PAL-N" },      // MACHINE_SYNC_PALN
};
// default resource value if never queried: 1 (PAL), c64/c64-resources.c:438

function positionWithinFrame(lin: number, cyc: number, cyclesPerLine: number): number {
  return lin * cyclesPerLine + cyc;
}

function reconstructWithinFrame(before: number, after: number): number | "wrapped" {
  return after >= before ? after - before : "wrapped";
}
```

### Pattern 4: `vice_run_until`'s temporary checkpoint is never deleted on the success path
**What:** VICE deletes a `temporary:true` checkpoint **itself**, immediately after
emitting the `CHECKPOINT_INFO` event that reports the hit
(`mon_breakpoint.c:558` emits the event; `mon_breakpoint.c:605-607` deletes it
right after, still inside the same `if (cp->stop)` block). The success path must
never call `CHECKPOINT_DELETE` on it.
**When to use:** `handleRunUntil()`'s hit branch.
**Example:**
```typescript
// stock-run-until.ts -- success path
const hitEvent = await waitForCheckpointHit(session.client, checkpointId, timeoutMs);
if (hitEvent) {
  // VICE already deleted this checkpoint (mon_breakpoint.c:605-607). Do NOT call
  // CHECKPOINT_DELETE here -- this is the "never delete a VICE-marked temporary
  // checkpoint" invariant, ported to its stock-native form.
  return stockAnswer(session.client, { requested: "run_until", reached: true, address, hitCount: hitEvent.checkpoint.hitCount });
}
// timeout path -- see Pitfall 4 for the ObjectMissing-tolerant cleanup
```

### Pattern 5: The stock liveness bracket needs real wall-clock time, deliberately, because there is no non-pausing observation
**What:** Unlike `vice-sync.ts`'s own header rule ("there is no timer, no delay,
and no wall-clock quantity anywhere in it"), the stock bracket **must** wait real
time with zero socket traffic, because sending anything at all (even a bare PING)
halts the machine (`monitor_binary.c:281`). This is a deliberate, load-bearing
departure from that fork-era rule, not an oversight — the rule's own rationale
("pacing comes from the forwarded round trips alone... there is no timer") depended
on a non-pausing `vice_ping` that stock does not have.
**When to use:** The new stock `vice_diagnose`'s liveness check, and nowhere else
in this phase — `vice_run_until`'s wait is event-driven (Pattern 4), not
time-driven.
**Example:**
```typescript
// stock-diagnose.ts
const before = await snapshotPcAndCycles(session); // one halting REGISTERS_GET
await session.client.send(CommandType.Exit); // resume
await new Promise((r) => setTimeout(r, BRACKET_WINDOW_MS)); // NO socket traffic here at all
const after = await snapshotPcAndCycles(session); // one halting REGISTERS_GET -- re-pauses AND reads
const verdict = (before.pc === after.pc && before.lin === after.lin && before.cyc === after.cyc) ? "wedged" : "live";
```

### Anti-Patterns to Avoid
- **Frame-counting via a non-stopping checkpoint for a general-purpose stopwatch.**
  Rejected above (Standard Stack / Alternatives, Pitfall 1) — it fights this
  project's own D-11 trace-guard.
- **Reusing the fork's ping-poll-while-running bracket verbatim on stock.** Every
  stock command halts the machine; there is no non-pausing call to poll with
  (Pitfall 3).
- **Calling `CHECKPOINT_DELETE` on a `temporary:true` checkpoint that already
  fired.** It is already gone (Pattern 4); attempting the delete anyway is at best
  a wasted round trip and at worst a misleading `ObjectMissing` surfaced as an
  error rather than the benign "already cleaned up itself" it actually is.
- **Sending `CPUHISTORY_GET` with `count=0` anywhere in new code.** A real VICE
  build rejects it with `InvalidParameter` (0x81) — confirmed live this session.
  Always request `count >= 1`.
- **Treating the fork's `cycles` argument on `vice_run_until` as something to
  implement.** The fork itself has never implemented it
  (`mcp_tools_debug.c:772`: `"cycles-only mode not yet implemented; provide an
  address"`) — matching that (not regressing it) satisfies TIME-03. The **timeout**
  criterion 2 needs is a **separate**, new, stock-only concept.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session acquisition + error conversion | A second `ensureStockSession()`-equivalent | `withDerivedTool()`'s existing `needsSession: true` branch | Already the tested, `runState`-attaching, never-throw seam every existing tool uses |
| VICE-version-gate detection for the stopwatch route | A new capability probe | `session.capabilities.cpuHistory`, already resolved once per connect by Phase 2's BACK-04 (`stock-connect.ts:129-153`) | Re-probing per call would be exactly the re-derivation this codebase's own conventions forbid, and BACK-04 already exists for precisely this purpose |
| LIN/CYC value access | A second register-fetch path | `stock-registers.ts`'s existing `registerCatalogFor()`/`handleRegistersGet()` — `LIN`/`CYC` already surface generically by name in the `registers` map | The catalog already resolves register ids dynamically per build (ids are not guaranteed stable across VICE versions); a hardcoded id would reintroduce the exact hazard `stock-registers.ts`'s own header comment warns against |
| Checkpoint-trap detection algorithm (armed checkpoints + live IRQ handler resolution) | A new algorithm from scratch | Port `vice-proxy.ts`'s existing `gatherCheckpointTrapEvidence()`/`resolveLiveIrqHandler()` (lines 893-985), already live-tested on the fork, onto stock's own `CHECKPOINT_LIST`/`REGISTERS_GET`/`MEM_GET` primitives | The algorithm (armed stopping exec checkpoint at PC, or at the resolved handler with `hit_count===0`) is already correct and already documented; only the transport underneath changes |
| Monitor-ownership conflict detection | A new "is someone else connected" probe | The existing `MonitorOwnershipError` thrown by `ensureStockSession()`/`stockConnect()`, already converted to explanatory text by `convertHandshakeError()` (`stock-handler.ts:87-93`) | Fully built by Phase 2 (PROTO-08/BROK-02); this phase only needs to catch this specific error type and re-surface it as a named verdict rather than generic error text |
| Event-narrowing for a `CHECKPOINT_INFO` matching a specific checkpoint id | A new predicate | `stock-checkpoints.ts`'s existing `isCheckpointInfoEvent()` narrowing pattern (D-11 trace guard) | Same narrowing shape already proven correct against the wire's own event stream |

**Key insight:** Every family in this phase composes primitives Phases 2/3/5 already
built and tested (`REGISTERS_GET` via the register catalog, `CHECKPOINT_SET`/
`CHECKPOINT_INFO` via the existing event demux, the capability cache, the
checkpoint-trap algorithm already proven on the fork). The genuinely new work is
(a) the video-standard-aware cycle-position arithmetic, (b) the event-driven
run-until wait with its three-path cleanup guarantee, and (c) porting the
checkpoint-trap algorithm's *transport* — never its logic — from `call()` to
stock's own session primitives.

## Common Pitfalls

### Pitfall 1: Building the frame-counter fallback from `docs/phase0-binmon-findings.md` §1 as written
**What goes wrong:** A non-stopping (`stop:false`) checkpoint armed at a
frame-boundary address (e.g. `$EA31`) to count elapsed frames gets **auto-disabled**
by this project's own existing safety mechanism within well under a second of a
real bracket running.
**Why it happens:** `docs/phase0-binmon-findings.md` §1 proposes this route as an
"always-available" fallback for VICE < 3.10, written before `stock-checkpoints.ts`'s
D-11 trace guard existed. PAL fires such a checkpoint ~50.1 times/second, NTSC
~59.8 — both comfortably above `TRACE_HITS_PER_SECOND_LIMIT = 20`
(`stock-checkpoints.ts:280`), so `w.hits > TRACE_HITS_PER_SECOND_LIMIT` trips inside
roughly 0.4-0.5 real seconds and the client sends its own `CHECKPOINT_TOGGLE`
(`enabled:false`) to shut it off (`stock-checkpoints.ts:307-361`).
**How to avoid:** Do not build this fallback as a general-purpose stopwatch.
Restrict the <3.10 route to `LIN`/`CYC` reconstruction bounded to one frame (Pattern
3), refusing explicitly on detected wraparound.
**Warning signs:** A plan task that arms a `stop:false` checkpoint anywhere in
`stock-timing.ts` — there is no such checkpoint in this design at all.

### Pitfall 2: Assuming a within-frame `LIN`/`CYC` delta is always exact
**What goes wrong:** Reporting `positionAfter - positionBefore` as the elapsed
cycle count even when one or more full frames elapsed between the reset and read,
because the two register values happen to have increased (a coincidence that
becomes near-certain the longer the bracket runs).
**Why it happens:** `LIN`/`CYC` alone cannot distinguish "0 cycles elapsed within
this frame" from "exactly N whole frames plus this many cycles elapsed" when the
position increased — both look identical.
**How to avoid:** Only trust the delta when the caller's own operation is known to
be bounded well under one frame (typically a stepped/paused routine, not a free-run
resume across real wall-clock time) — document this limitation explicitly in the
tool's own answer (e.g. an `exactness: "within-one-frame, unverified"` field) rather
than presenting it as unconditionally exact. Detected wraparound (`positionAfter <
positionBefore`) is the one case that can be proven, and must refuse rather than
guess a `+ k * cyclesPerFrame` correction for an unknown `k`.
**Warning signs:** A stopwatch answer on VICE < 3.10 that reports a number with no
caveat field, for a bracket that spanned a real free-run resume of more than a few
milliseconds.

### Pitfall 3: Porting the fork's cycle bracket (ping-poll while running) to stock unchanged
**What goes wrong:** A stock "liveness bracket" that resumes the machine, then
calls `vice_ping`-equivalent several times "without pausing" the way
`vice-proxy.ts`'s `runCycleBracket()` does on the fork, expecting the machine to
keep running between polls.
**Why it happens:** The fork's own `vice_ping` is measured non-pausing
(`vice-sync.ts`'s own header: "986,693 cycles/s while ping-polling vs 991,569 fully
quiet") because the fork's HTTP transport answers `vice_ping` from process state
without necessarily entering VICE's own binary/text monitor loop. Stock's `PING`
opcode is a **binary-monitor command**, and `monitor_check_binary()` halts the
machine on **any** inbound byte (`monitor_binary.c:281`) — there is no non-pausing
call of any kind on stock.
**How to avoid:** Use Pattern 5's design: one halting snapshot, one resume, one
bounded real-time wait with **zero** socket traffic, one halting snapshot. Never
poll more than once per bracket on stock.
**Warning signs:** A loop that calls `session.client.send(...)` more than twice
inside a single liveness-bracket function.

### Pitfall 4: Deleting (or failing to delete) `vice_run_until`'s temporary checkpoint on the wrong path
**What goes wrong:** Either (a) calling `CHECKPOINT_DELETE` on a checkpoint that
VICE already auto-deleted after a hit (Pattern 4), surfacing a spurious error where
none should appear, or (b) never attempting cleanup on a genuine timeout, leaving a
stale armed checkpoint behind for the rest of the session.
**Why it happens:** The three paths (hit, timeout, machine restarted underneath)
each need a **different** cleanup action, and conflating them is the natural first
draft.
**How to avoid:** Hit path: no delete call at all (Pattern 4). Timeout path:
attempt `CHECKPOINT_DELETE`, and treat an `ObjectMissing` (0x01) wire error as
"already gone" (a benign race where the hit landed between the last poll and the
delete attempt) rather than a failure — this is safe on stock specifically because
the binary monitor's error responses are well-typed and deterministic, unlike the
fork/HTTP-era crash history `vice-sync.ts`'s own comment references (which does not
apply here). Machine-restarted-mid-wait path: skip the delete entirely — the whole
instance and every checkpoint on it are already gone; report the standard
"restarted" outcome via the existing `MachineRestartedError`/`convertHandshakeError()`
machinery.
**Warning signs:** A single, undifferentiated `finally { await deleteCheckpoint() }`
block wrapping all three paths identically.

### Pitfall 5: Assuming the text monitor's `stopwatch` command is reachable over the binary monitor
**What goes wrong:** Time spent trying to construct a wire message that invokes
VICE's console `stopwatch` command (`mon_parse.y:3592-3597`,
`monitor.c:1547-1570`) remotely.
**Why it happens:** The fork's own `mon_stopwatch_get_elapsed()`/
`mon_stopwatch_reset()` (`monitor.c:1557-1570`) look — from the outside — like they
"belong" to the monitor console, and the fork's `mcp_tool_cycles_stopwatch()` calls
them directly, which could plausibly suggest a wire path exists.
**How to avoid:** `monitor_binary.c`'s confirmed opcode enum
(`enum t_binary_command`, cross-checked exhaustively in this session against both
the vendored 3.8 tree and the fork's 3.10-vintage tree) has no "execute monitor
command text" opcode of any kind, and the fork's own C code calls
`mon_stopwatch_get_elapsed()` as a **plain in-process function call** from
`mcp_tools_debug.c`, never through `monitor_binary_process_*()`'s command dispatch.
This is a genuinely separate code path (the interactive `-console` text monitor)
from the binary-monitor TCP port this client speaks to at all.
**Warning signs:** A plan task titled "encode the stopwatch command body" — there
is no such wire message, on any VICE version.

### Pitfall 6: `CPUHISTORY_GET`'s response has no decoder in this tree today
**What goes wrong:** Assuming `session.client.send(CommandType.CpuHistoryGet, ...)`
already returns a typed, decoded shape.
**Why it happens:** `stock-protocol.ts`'s `parseResponse()` switch has cases for
every OTHER response type this tree currently uses, but `ResponseType.CpuHistoryGet`
falls through to the generic `{ type: "unknown", requestId, errorCode,
responseType }` shape (confirmed: no `case ResponseType.CpuHistoryGet:` exists;
Phase 2's own capability probe only checks success/failure and never reads the
body).
**How to avoid:** Add a new parser case. The response layout (confirmed from
`monitor_binary.c:1563-1617`): `count(u32LE)`, then per entry:
`item_size(1)` + a register block of `item_size` bytes (skip — this phase never
needs to interpret it, since the fork's own code hard-fills `LIN`/`CYC` inside CPU
history entries with the sentinel `0xffff`, `monitor_binary.c:1585-1590`, i.e. they
carry no real per-entry raster position) + `cycle(u64LE)` (the field this phase
needs) + `instruction_length(1)` + `opcode(1)` + `p1(1)` + `p2(1)` + a placeholder
byte (5 bytes total after the cycle field). Only the newest (first, since count is
requested as 1 and the newest entry comes first) entry's `cycle` field matters for
the stopwatch.
**Warning signs:** A stopwatch implementation that reads `response.type ===
"unknown"` and tries to decode `response.responseType`'s raw bytes ad hoc inline,
rather than adding a proper parser case to `stock-protocol.ts`.

### Pitfall 7: `RESOURCE_GET`'s request encoder and response parser do not exist in this tree today either
**What goes wrong:** Assuming `MachineVideoStandard` can be read the same way
`MEM_GET`/`REGISTERS_GET` already are.
**Why it happens:** `CommandType.ResourceGet` (0x51) is declared in the command
table, but no request-body encoder and no `case ResponseType.ResourceGet:` exist in
`stock-protocol.ts` — this opcode has never been used by any of Phases 2-5.
**How to avoid:** Add both. Request body (confirmed, `monitor_binary.c:918-935`):
`name_length(1)` + `name` (ASCII, NOT null-terminated on the wire). Response
(confirmed, `monitor_binary.c:938-965`): `type(1)` (`0` = string, `1` = integer per
`e_MON_RESOURCE_TYPE_STRING`/`_INT`) then, for the integer case this phase needs,
`size(1)=4` + `value(u32LE)`. `MachineVideoStandard` is always the integer case.
This read is safe: only the **SET** side of `MachineVideoStandard` power-cycles the
machine (CLAUDE.md's own constraint); `RESOURCE_GET` is read-only and halts the
machine exactly like every other stock command, nothing more.
**Warning signs:** A plan task that hardcodes PAL (`19656` cycles/frame) with no
`RESOURCE_GET` call at all — this silently mis-measures on an NTSC-configured
instance.

### Pitfall 8 (the load-bearing one): `probeCpuHistory()`'s `count=0` request is rejected by real VICE, breaking the whole stock connect handshake on VICE >= 3.10
**What goes wrong:** `stock-connect.ts`'s existing `probeCpuHistory()`
(Phase 2/BACK-04) sends `CPUHISTORY_GET` with a **zero**, clamped count
(`clampCpuHistoryCount(0)`, `stock-connect.ts:104`) and only recognises
`ErrorCode.InvalidType` (0x83, "absent") and `ErrorCode.CmdFailure` (0x8f,
"not_compiled_in") as classified outcomes; anything else `throw`s.
**Why it happens:** `monitor_binary.c:1493-1497` (upstream monitor code, not a fork
patch) explicitly rejects `requested_count < 1` with `INVALID_PARAMETER` (0x81) —
`count=0` is not a valid "give me the newest entry" request on real VICE, it is a
malformed one. **Confirmed live in this session**: a hand-built raw socket client
launched against the fork's own genuine VICE 3.10.0.0 binary monitor (this repo's
`/usr/local/bin/x64sc -default -binarymonitor -binarymonitoraddress
ip4://127.0.0.1:16502`) received `errorCode=0x81` for `count=0` and
`errorCode=0x00` (success, 52-byte body) for `count=1`, on the identical binary.
`docs/phase1-probe-results.md`'s own recorded CPUHISTORY_GET probe run
(`probe-binmon.mjs`) has always used `count=1`, never `count=0` — this specific
edge case has never been exercised against a real build before this session.
**How to avoid:** Change `probeCpuHistory()` to send `count=1` (matching the
already-proven-live `probe-binmon.mjs` approach) rather than `count=0`, or add
`InvalidParameter` handling that still classifies the outcome without letting it
propagate. This is a **Wave 0 prerequisite fix**, not new Phase 7 functionality —
without it, `session.capabilities.cpuHistory` never resolves on a real VICE >= 3.10
build at all, because the connect handshake itself throws at Step 5
(`stock-connect.ts:327`) before any Phase 7 tool is ever reached.
**Warning signs:** A plan that treats `session.capabilities.cpuHistory` as
already-reliable on `>= 3.10` without first re-reading `probeCpuHistory()`'s current
`count=0` line.

## Code Examples

### Empirical confirmation of Pitfall 8 (this session's own live test)
```
$ node test-cpuhistory.mjs   # raw socket client against /usr/local/bin/x64sc (fork's genuine VICE 3.10.0.0), -binarymonitor
connected
EVENT type=0x31 err=0x0 bodyLen=42
EVENT type=0x62 err=0x0 bodyLen=2
VICE_INFO -> err=0x0 version=3.10.0.0
CPUHISTORY_GET count=0 -> responseType=0x0 errorCode=0x81 bodyLen=0
CPUHISTORY_GET count=1 -> responseType=0x86 errorCode=0x0 bodyLen=52
```
Source of the confirming C code:
```c
// vice/src/monitor/monitor_binary.c:1491-1497 (this repo's vendored fork tree,
// core upstream monitor logic, not a fork-specific patch)
requested_count = little_endian_to_uint32(&command->body[1]);
if (requested_count < 1) {
    monitor_binary_error(e_MON_ERR_INVALID_PARAMETER, command->request_id);
    log_message(LOG_DEFAULT, "monitor binary cpuhistory: Invalid count %u", count);
    return;
}
```

### The temporary-checkpoint auto-delete VICE performs on hit (Pattern 4's grounding)
```c
// vice/src/monitor/mon_breakpoint.c:556-607 (this repo's vendored fork tree)
cp->hit_count++;
mon_breakpoint_event(cp);          // <-- CHECKPOINT_INFO event fires HERE, reporting the hit
if (cp->stop) {
    must_stop = TRUE;
    action_str = "Stop on";
} else {
    action_str = "Trace";
}
/* ... disassembly/print logic omitted ... */
if (cp->temporary) {
    mon_breakpoint_delete_checkpoint(cp->checknum);   // <-- auto-delete AFTER the event
}
```

### PAL/NTSC cycle-per-frame constants (verified against VICE's own source)
```c
// vice/src/c64/c64.h:36-58 (this repo's vendored fork tree)
#define C64_PAL_CYCLES_PER_LINE 63
#define C64_PAL_SCREEN_LINES    312   // 19656 cycles/frame
#define C64_NTSC_CYCLES_PER_LINE 65
#define C64_NTSC_SCREEN_LINES    263  // 17095 cycles/frame
#define C64_NTSCOLD_CYCLES_PER_LINE 64
#define C64_NTSCOLD_SCREEN_LINES    262  // 16768 cycles/frame
#define C64_PALN_CYCLES_PER_LINE 65
#define C64_PALN_SCREEN_LINES    312     // 20280 cycles/frame
```
```c
// vice/src/c64/c64-resources.c:438 -- MachineVideoStandard's resource default
{ "MachineVideoStandard", MACHINE_SYNC_PAL, RES_EVENT_SAME, NULL, ... }
// vice/src/machine.h:57-60
#define MACHINE_SYNC_PAL     1
#define MACHINE_SYNC_NTSC    2
#define MACHINE_SYNC_NTSCOLD 3
#define MACHINE_SYNC_PALN    4
```

### The existing monitor-ownership error, already fully wired (Phase 2) -- this phase's fifth verdict needs nothing new to detect it
```typescript
// .claude/mcp/vice/stock-handler.ts:87-93 (read live)
if (err instanceof MonitorOwnershipError) {
  return isErrorText(
    `${toolName}: this instance's monitor socket is already claimed by a different grant ` +
      `(grant ${err.holderGrantId ?? "unknown"}, claimed at ${err.holderClaimedAt ?? "unknown"}, port ${err.port ?? "unknown"}) -- ` +
      `only one client may hold the stock monitor socket at a time.`,
  );
}
```
The new stock `vice_diagnose` should catch this SAME error type at the very top
(before `ensureStockSession()`'s outcome is otherwise consumed) and produce a
`verdict: "monitor_held_elsewhere"` answer carrying the same fields, rather than
letting it fall through to generic error text — matching the skill's "read the
verdict, not the vibe" contract.

### The fork's own honest non-implementation of cycles-bound run_until (matched, not regressed, on stock)
```c
// vice/src/mcp/mcp_tools_debug.c:767-773 (this repo's vendored fork tree)
if (!has_addr && cycle_limit > 0) {
    return mcp_error(MCP_ERROR_NOT_IMPLEMENTED, "cycles-only mode not yet implemented; provide an address");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fork's in-process `mon_stopwatch_get_elapsed()`, never entering the monitor | Client-side reconstruction over `CPUHISTORY_GET` (>=3.10) or `LIN`/`CYC` with proven-wraparound refusal (<3.10) | This phase | Stock's stopwatch is honest about approximation where the fork's own is silently exact (a genuine loss the tool's own answer shape must communicate, not hide) |
| Fork's ping-poll-while-running liveness bracket | Snapshot-resume-wait-halt-compare, using real wall-clock time deliberately | This phase | A necessary architectural divergence forced by stock having no non-pausing observation at all — not a regression in method, a different method for a different transport |
| `vice_diagnose` refused by name on stock (current `dispatchStock()` miss branch) | A stock-native five-verdict handler | This phase | Closes TIME-04 and unblocks `vice-wedge-triage`'s documented opening move |

**Deprecated/outdated:** `docs/phase0-binmon-findings.md` §1's frame-counter
fallback proposal should be marked superseded by this phase's D-11-guard finding
once Phase 7 lands (a doc-correction task, not a code task).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A within-frame `LIN`/`CYC` delta with no detected wraparound is "exact" for the caller's intended use (measuring a bounded routine, not a long free-run) | Pattern 3, Pitfall 2 | Medium — if a caller resumes freely for many frames and the position happens to have increased, the tool reports a plausible-looking but wrong (aliased) number. Mitigated by requiring the tool's own answer to carry an explicit exactness caveat rather than presenting the number as unconditionally exact; the wraparound-detected case is always refused, never guessed. |
| A2 | A reasonable default deadline for `vice_run_until`'s new stock-only timeout has not been fixed by this research — recommend the planner choose a value informed by the two extremes: skill usage in `tool-selection.md` implies typically sub-second brackets (a checkpoint that "fires once per frame"), while `vice-sync.ts`'s own `POLL_WINDOWS_MS` budget for a full KERNAL-boot-plus-loader scenario sums to 150s | Architecture Patterns, Open Questions | Low-Medium — too short a default causes spurious timeouts on legitimately slow boot/load waits; too long delays criterion 2's cleanup guarantee from firing promptly on a genuinely unreachable address. Exposed as a stock-only optional argument either way, so a caller can always override the default. |
| A3 | `MachineVideoStandard`'s value never changes mid-session for a running instance (i.e., caching the resolved video standard per session, like the register catalog, is safe) | Pattern 3 | Low — VICE's own `MachineVideoStandard` **write** side power-cycles the machine (CLAUDE.md), so any change to it necessarily produces a fresh session via the existing epoch/restart machinery; a stale cached value cannot outlive the session that read it. |
| A4 | `vice_recycle` is out of this phase's literal scope (no TIME-* requirement names it), even though a stock `"wedged"` verdict from the new `vice_diagnose` has no stock-side recovery tool without it | Open Questions | Medium — if left unbuilt, a user who reaches "wedged" on stock via the skill's documented flow has no working next step on this backend, undermining the practical value of TIME-04 even though its literal text is satisfied. See Open Questions below; this is a scope decision for the planner/discuss-phase, not something this research resolves unilaterally. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `vice_recycle` also get a stock implementation in this phase, even
   though no `TIME-*` requirement names it?**
   - What we know: the destructive recycle **action** itself
     (`controlSession.recycle(grantId)`, `vice-proxy.ts:698`) is a broker-control-
     session RPC, entirely independent of the fork's HTTP transport — only the
     **evidence-gathering** half (`gatherWedgeEvidence()`, which calls
     `rewriteArguments()`/`call()`) is fork-only. Building a stock-native evidence
     gatherer (PC/registers/checkpoint state via stock's own primitives, no
     screenshot since `SHOT-*` was cut) alongside the same broker RPC looks cheap
     given this phase already builds the liveness bracket and checkpoint-trap
     algorithm it would reuse.
   - What's unclear: the roadmap's Phase 7 success criteria only require
     *diagnosis* to distinguish the five states, not *recovery* — `vice_recycle`
     is named nowhere in `TIME-01`..`04`.
   - Recommendation: flag this explicitly for the planner/discuss-phase rather than
     deciding it here. If left out, `vice-wedge-triage`'s documented "wedged →
     `vice_recycle` with a reason" step (SKILL.md's own verdict table) has no
     working stock route — the skill doc may need a stock-specific caveat if this
     phase does not also build it (a `SKILL-01`/Phase-8 concern either way).

2. **What is the right default deadline for `vice_run_until`'s new stock-only
   safety timeout?**
   - What we know: this project's own `vice-sync.ts` budgets up to 150 real
     seconds for a full KERNAL-boot-plus-turbo-loader wait; the skills' own
     documented `vice_run_until` usage (`tool-selection.md`: "fires once per
     frame ⇒ proven") implies typically sub-second brackets.
   - What's unclear: whether one default serves both use cases, or whether the
     tool should expose a required/optional `timeout_ms` argument with no
     built-in default at all (forcing the caller to state its own expectation).
   - Recommendation: expose an optional stock-only `timeout_ms` (D-03 permits
     stock-only optional extras), defaulting to something in the tens-of-seconds
     range consistent with this project's existing budgets, and let the planner
     pick the exact number against real skill call patterns.

3. **Does the new stock `vice_diagnose` need a `"stale_read_path"`-equivalent
   verdict at all?**
   - What we know: the fork's `"stale_read_path"` verdict exists specifically
     because the fork mixes a non-pausing `vice_ping` with pausing reads
     (`vice-proxy.ts`'s `classifyLiveness()`) — a byte-identical register snapshot
     across an advancing bracket is only meaningful when one read path could
     plausibly be stale while another moves.
   - What's unclear: whether stock, where **every** read pauses uniformly, can
     ever legitimately reach an analogous state, or whether this is provably
     impossible by construction on stock.
   - Recommendation: drop this verdict from the stock five (use `["restarted",
     "checkpoint_trap", "wedged", "monitor_held_elsewhere", "live"]`) unless the
     planner identifies a stock-specific scenario this research did not surface.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stock VICE (binary monitor) | All three tools | Yes — `/usr/bin/x64sc` (genuine, unpatched stock VICE 3.9, apt-installed on this machine) | 3.9+dfsg-1 | N/A — this is the target backend |
| A real VICE >= 3.10 build | The `CPUHISTORY_GET` stopwatch route | Partial — this machine has no genuine stock 3.10 build; `/usr/local/bin/x64sc` is the project's own fork build, self-reporting `VICE_INFO` version `3.10.0.0`, and its `monitor_binary.c`/`mon_breakpoint.c` are core upstream monitor code (not fork-patched), so its `CPUHISTORY_GET`/checkpoint behaviour is a valid live proxy for genuine upstream 3.10 — used directly in this session's own empirical test (Pitfall 8) | 3.10.0.0 (fork-vintage) | The <3.10 `LIN`/`CYC` reconstruction route (Pattern 3) is the honest fallback and must be built regardless, per TIME-01's "on any supported VICE version" |
| A display (`DISPLAY=:0`/Wayland) | Launching any real VICE instance for live testing | Yes — confirmed in this session (`DISPLAY=:0`, `WAYLAND_DISPLAY=wayland-0`) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a genuine (non-fork) VICE >= 3.10 build —
mitigated because the fork's own build exercises the same core upstream monitor
code path for the opcodes this phase depends on, and because the <3.10 fallback
route must exist regardless of version availability.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test`, run via `node --test '*.test.*'` |
| Config file | none — `.claude/mcp/vice/package.json`'s `"test"`/`"test:automated"` scripts are the only config |
| Quick run command | `node --test stock-timing.test.ts stock-run-until.test.ts stock-diagnose.test.ts` (per-file, fast, no emulator) |
| Full suite command | `npm run test:automated` (`.claude/mcp/vice/test-gate.mjs`, excludes the four frozen `MANUAL_ONLY_TESTS`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIME-01 | `vice_cycles_stopwatch` picks Route A when `session.capabilities.cpuHistory === "available"` and decodes the newest `CPUHISTORY_GET` entry's cycle field correctly against a synthetic wire body | unit (synthetic frame, injected via a fake `session.client.send`) | `node --test stock-timing.test.ts` | ❌ Wave 0 |
| TIME-01 | `vice_cycles_stopwatch` Route B computes `LIN*cyclesPerLine+CYC` correctly for all four video standards and detects wraparound | unit | `node --test stock-timing.test.ts` | ❌ Wave 0 |
| TIME-03 | A detected wraparound on Route B is refused with an explanatory message, never a fabricated number or zero | unit | `node --test stock-timing.test.ts` | ❌ Wave 0 |
| TIME-02 | `vice_run_until` sends `CHECKPOINT_SET` with `temporary:true` and never calls `CHECKPOINT_DELETE` on the hit path | unit (captured wire body + call-count assertion) | `node --test stock-run-until.test.ts` | ❌ Wave 0 |
| TIME-02 | On a synthetic timeout, `vice_run_until` attempts `CHECKPOINT_DELETE` and tolerates `ObjectMissing` as a benign already-gone race | unit | `node --test stock-run-until.test.ts` | ❌ Wave 0 |
| TIME-02 | On a synthetic `MachineRestartedError` mid-wait, `vice_run_until` skips the delete entirely and reports the standard restarted outcome | unit | `node --test stock-run-until.test.ts` | ❌ Wave 0 |
| TIME-04 | The new stock `vice_diagnose` reaches `"monitor_held_elsewhere"` when `ensureStockSession()` throws a synthetic `MonitorOwnershipError`, and `"restarted"` on a synthetic `MachineRestartedError`, at zero or near-zero simulated wire cost | unit | `node --test stock-diagnose.test.ts` | ❌ Wave 0 |
| TIME-04 | The ported checkpoint-trap algorithm matches an armed stopping exec checkpoint at the current PC, or at the resolved live-IRQ-handler address with `hit_count===0`, against synthetic `CHECKPOINT_LIST`/register/memory responses | unit | `node --test stock-diagnose.test.ts` | ❌ Wave 0 |
| Pitfall 8 (blocking prerequisite) | `probeCpuHistory()` no longer throws an unhandled `StockProtocolError` for `InvalidParameter` (0x81); a real >=3.10 connect handshake succeeds | unit (regression fixture matching this session's own live-captured 0x81 response) + a live gate re-run | `node --test stock-connect.test.ts` | ❌ Wave 0 (fixture) |

### Sampling Rate
- **Per task commit:** the quick-run command above (all three new test files,
  fast, no external process).
- **Per wave merge:** `npm run test:automated`.
- **Phase gate:** full suite green before `/gsd-verify-work`, plus a real
  live-VICE pass for each requirement: `vice_cycles_stopwatch` against genuine
  stock VICE 3.9 (Route B only, since 3.9 has no `CPUHISTORY_GET`) AND against the
  fork's own 3.10-vintage build with `-binarymonitor` (Route A, and a re-run of
  this session's own `count=0`-vs-`count=1` empirical test as a committed
  regression fixture); `vice_run_until` against a real address in a running
  program, including a deliberate unreachable-address timeout case; the new
  `vice_diagnose` against a real checkpoint trap and a real wedge (achieved the
  same way Phase 1's own probe work did — e.g. via `vice_recycle` on the fork
  side, or a manually-killed-and-respawned instance). Per this project's own
  memory, `/usr/bin/x64sc` on this machine is genuine unpatched stock VICE (the
  fork build shadows it on `PATH`), so live-testing against real stock is
  available and should be the default rather than something to ask permission
  for first — and remember the flag-order gotcha: `-default` must precede
  `-binarymonitor` in the launch command, or the monitor never binds.

### Wave 0 Gaps
- [ ] **`stock-connect.ts`'s `probeCpuHistory()` fix (Pitfall 8) — blocking.**
      Must land before any live test of Route A is meaningful; without it, every
      stock connect to a real VICE >= 3.10 build fails outright.
- [ ] `stock-protocol.ts`: a `CPUHISTORY_GET` response parser case (currently
      falls through to `"unknown"`, Pitfall 6).
- [ ] `stock-protocol.ts`: a `RESOURCE_GET` request-body encoder and response
      parser case (neither exists today, Pitfall 7).
- [ ] `stock-timing.ts` + `.test.ts` — nothing exists yet.
- [ ] `stock-run-until.ts` + `.test.ts` — nothing exists yet; the wire primitive
      it needs (`temporary:true` on `CHECKPOINT_SET`) is already supported and
      already empirically confirmed live (`docs/phase1-probe-results.md` item 1),
      but no handler composes it yet.
- [ ] `stock-diagnose.ts` + `.test.ts` — nothing exists yet; the algorithm it
      ports (checkpoint-trap detection) already exists and is already live-tested
      on the fork (`vice-proxy.ts`'s `gatherCheckpointTrapEvidence()`).
- [ ] `tools-manifest.stock.json` — 3 new entries (34 -> 37 tools).
- [ ] `docs/stock-vice-parity.md` — record this phase's divergences: the
      `"stale_read_path"` verdict's absence on stock, the honest
      wraparound-refusal behaviour on VICE < 3.10, and the `probeCpuHistory()`
      fix as a stock-specific correctness gain (BACK-04 now actually reaches
      `"available"` on a real >=3.10 build, which it could not before this
      phase).
- [ ] A doc correction to `docs/phase0-binmon-findings.md` §1, marking the
      frame-counter fallback superseded by the D-11-guard finding (Pitfall 1).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no auth surface |
| V3 Session Management | no | Reuses the existing stock monitor session (`ensureStockSession`) for all three tool families |
| V4 Access Control | no | No new access-control surface; `vice_run_until`/`vice_diagnose` are read-mostly (one temporary checkpoint, auto-cleaned) and `vice_cycles_stopwatch` never writes anything |
| V5 Input Validation | yes | `vice_run_until`'s `address` argument is parsed through `stock-address.ts`'s existing `parseAddress()`, matching every other family's discipline; a new stock-only `timeout_ms` is clamped to a sane bound (never unbounded, never negative) exactly like `stock-connect.ts`'s own `clampCpuHistoryCount()` precedent |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted `timeout_ms` of `0`, negative, `NaN`, or an enormous value on `vice_run_until`, causing an immediate spurious timeout or an effectively unbounded wait | Denial of Service | Clamp with the same finite/trunc/bounds discipline `stock-connect.ts`'s `clampCpuHistoryCount()` already establishes as this project's own precedent for a numeric wire-adjacent argument |
| A `vice_run_until` call against an address that legitimately never executes, leaving a checkpoint armed indefinitely if the timeout logic has a bug | Denial of Service (resource leak inside the emulator) | The timeout path's `CHECKPOINT_DELETE` attempt (Pitfall 4) is the guard; a unit test asserting the delete call happens on every synthetic-timeout path is the mechanical check |
| The new `RESOURCE_GET` encoder being reused carelessly for a resource name outside `MachineVideoStandard`, drifting toward the power-cycling resources CLAUDE.md already names (`MachineVideoStandard`/`VICIIModel`/`MachinePowerFrequency` are the SET-side hazards, not the GET side this phase uses) | Tampering (scope creep into a write-adjacent seam) | This phase only ever calls `RESOURCE_GET`, never `RESOURCE_SET` — a grep-gated structural check (matching this project's own "grep-gated to exactly one call site" convention used elsewhere, e.g. `vice_execution_run`'s sole `CommandType.Exit` occurrence) is a natural fit if the planner wants a mechanical guarantee |

## Sources

### Primary (HIGH confidence)
- `docs/phase0-binmon-findings.md` (read live, full file) — the confirmed
  binary-monitor command set; the original frame-counter fallback proposal this
  research finds in conflict with D-11.
- `docs/phase1-probe-results.md` (read live) — the recorded `CPUHISTORY_GET
  count=1` success/failure pattern this research's `count=0` finding sits beside;
  the 8-vs-9-byte `CHECKPOINT_SET` (`temporary`) confirmation.
- `docs/roadmap-stock-vice.md` (read live) — Group C's original "gap/must-verify"
  classification of these two tools.
- `.claude/mcp/vice/vice-proxy.ts` (read live, the full `vice_diagnose`/
  `vice_recycle` implementation, lines ~340-1270 and ~3100-3195) — the fork's
  cycle-bracket algorithm, the checkpoint-trap algorithm, the exact backend-aware
  registration mechanism already routing `vice_diagnose` to `dispatchStock()` on
  stock.
- `.claude/mcp/vice/stock-connect.ts` (read live, full file) — `CpuHistoryCapability`,
  `probeCpuHistory()`, `resolveCapabilities()`; the exact defect this research
  identifies and empirically confirms.
- `.claude/mcp/vice/stock-checkpoints.ts` (read live, full file) — the D-11 trace
  guard and its exact `TRACE_HITS_PER_SECOND_LIMIT = 20` constant.
- `.claude/mcp/vice/stock-registers.ts` (read live, full file) — confirms `LIN`/
  `CYC` already surface generically in `vice_registers_get`'s answer.
- `.claude/mcp/vice/stock-protocol.ts` (read live, full response-parser section)
  — confirms the missing `CPUHISTORY_GET`/`RESOURCE_GET` decoder cases.
- `.claude/mcp/vice/stock-dispatch.ts`, `stock-derived.ts`, `stock-handler.ts`
  (read live, full files) — the exact registration seam, `MonitorOwnershipError`
  conversion, and the derived-tool adapter this phase's three tools plug into.
- `.claude/mcp/vice/vice-sync.ts` (read live, full file) — the fork-only
  three-invariant polling design this phase's stock design deliberately departs
  from, and why.
- `.claude/skills/vice-wedge-triage/SKILL.md`, `.claude/skills/c64-program-recon/
  references/tool-selection.md`, `observation-hazards.md` (read live) — the
  documented skill usage this phase's tool shapes must satisfy.
- `vice/src/monitor/monitor_binary.c` (this repo's vendored fork tree,
  `/home/henrik/dev/henrik/git/vice-mcp/vice/src/monitor/monitor_binary.c`,
  read live in full for the opcode enum, `CPUHISTORY_GET`'s count validation and
  response layout, `RESOURCE_GET`'s request/response layout) and
  `vice/src/monitor/mon_breakpoint.c` (temporary-checkpoint auto-delete ordering)
  and `vice/src/monitor/monitor.c` (`mon_stopwatch_get_elapsed`/`_reset`) and
  `vice/src/c64/c64.h` + `c64-resources.c` (PAL/NTSC timing constants,
  `MachineVideoStandard` resource default) and `vice/src/machine.h`
  (`MACHINE_SYNC_*` values) and `vice/src/mcp/mcp_tools_debug.c` (the fork's own
  `mcp_tool_cycles_stopwatch()`/`mcp_tool_run_until()` C implementations) —
  cross-checked against the older vendored `/home/henrik/Downloads/vice-3.8/src/
  monitor/monitor_binary.c` tree to confirm `CPUHISTORY_GET`'s absence pre-3.10.
- **This session's own live empirical test** (Pitfall 8, reproduced verbatim in
  Code Examples): a hand-built raw binary-monitor client against
  `/usr/local/bin/x64sc -default -binarymonitor -binarymonitoraddress
  ip4://127.0.0.1:16502` (this repo's fork build, self-reporting `VICE_INFO`
  `3.10.0.0`), confirming `CPUHISTORY_GET count=0` returns `errorCode=0x81` and
  `count=1` succeeds, on a genuine running instance in this session.

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`,
  `.planning/phases/05-*/05-RESEARCH.md`, `05-VERIFICATION.md`,
  `deferred-items.md` (all read live, full files) — phase scope, the Phase 5
  precedent this phase's tool classification follows, and confirmation that
  Phase 5's own gap-closure work (the `resolveRequiredBank()` banking discipline)
  does not apply to this phase's own memory reads ($01/$0314/$FFFE are plain
  RAM/ROM, never I/O-space registers).

### Tertiary (LOW confidence)
- The exact real-world prevalence of `NTSC-old`/`PAL-N` C64 hardware variants
  among users of this project — not investigated in this session; the constants
  themselves (source-verified) are trusted, but whether supporting all four
  video standards versus just PAL/NTSC is worth the code surface is a judgment
  call left to the planner.

## Metadata

**Confidence breakdown:**
- Wire-protocol facts (opcode absence, `CPUHISTORY_GET`/`RESOURCE_GET` layout,
  temporary-checkpoint auto-delete ordering, `count=0` rejection): HIGH — read
  directly from the vendored VICE C source and, for the single most
  consequential claim, independently confirmed live against a running instance
  in this session.
- Existing-seam mechanics (`withDerivedTool()`, capability cache, register
  catalog, `MonitorOwnershipError` conversion): HIGH — read directly from this
  repo's own already-merged, already-tested code.
- The D-11 trace-guard conflict with the frame-counter fallback: HIGH — both the
  guard's exact threshold and the PAL/NTSC frame rate are independently
  source-verified; the conclusion follows directly from arithmetic on both.
- Exact default values (the run-until timeout, whether to build `vice_recycle`
  in this phase): MEDIUM — genuinely open engineering/scope judgment calls,
  flagged as such in Open Questions rather than asserted.
- NTSC-old/PAL-N real-world relevance: LOW — flagged, not asserted.

**Research date:** 2026-08-18
**Valid until:** Effectively indefinite for the VICE-source-level facts (opcode
layouts, timing constants, the D-11 threshold) — these do not change without a
VICE or this-project-source change. 30 days for anything describing this repo's
own in-progress code shape (module names, exact line numbers, the current
`probeCpuHistory()` defect's un-fixed state).
