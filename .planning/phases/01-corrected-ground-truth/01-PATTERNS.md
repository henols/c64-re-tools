# Phase 1: Corrected Ground Truth - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 1 code file (extended in place) + 5 markdown files (prose edits, no code analog)
**Analogs found:** 1 / 1 code file (self-analog: the file extends its own established patterns)

## Scope Note

This phase is ~90% markdown correction and ~10% code (one script extension). Per the
scope note in the task brief, the markdown files get one line each below with no
manufactured code analog. All mapping effort goes into `probe-binmon.mjs`, whose closest
analog for every new probe is **itself** — it already implements the exact wire format
(11-byte request header, 12-byte response header, request-id correlation, event demux at
`0xffffffff`) that every new probe must reuse verbatim. There is no other file in the repo
that speaks this wire protocol (it is deliberately dependency-free, `node:net` only, kept
separate from `vice.ts`'s HTTP/MCP transport, which speaks a different protocol entirely
to the fork's `-mcpserver` HTTP endpoint).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `.claude/mcp/vice/probe-binmon.mjs` (extended, not replaced) | utility (standalone probe/CLI script) | request-response over raw TCP, plus event-driven (unsolicited async frames) | itself — existing checks 1–6 in the same file | exact (self-analog) |
| `docs/phase0-binmon-findings.md` | doc | N/A | — | no code analog (prose edit) |
| `docs/stock-vice-parity.md` | doc | N/A | — | no code analog (prose edit) |
| `.planning/intel/constraints.md` | doc | N/A | — | no code analog (prose edit) |
| `docs/roadmap-stock-vice.md` (optional erratum) | doc | N/A | — | no code analog (prose edit) |
| `docs/phase1-probe-results.md` (new) | doc | N/A | — | no code analog; new artifact, no existing template in repo (RESEARCH.md confirms no "probe result" convention exists — write as a plain results doc, structure given in RESEARCH.md "Where to record probe output") |

## Pattern Assignments

### `.claude/mcp/vice/probe-binmon.mjs` (utility, request-response + event-driven)

**Analog:** itself. Every new probe is a new numbered check appended to the existing
`main()` sequence (checks 1–6 already there: PING, VICE_INFO, REGISTERS_AVAILABLE,
CPUHISTORY_GET, DISPLAY_GET, async-event demux), using the same `mon.send(cmd, body)` /
`ERR_NAME[r.errCode]` idiom throughout. Do not introduce a second framing implementation —
`encode()` and the `BinMon` class already handle everything correctly per
`CON-wire-request-header` / `CON-command-opcode-set` / `CON-response-header` in
`constraints.md`.

**Imports pattern** (lines 1–21, `.claude/mcp/vice/probe-binmon.mjs`):
```javascript
#!/usr/bin/env node
/*
 * Phase-0 de-risk probe for stock VICE's binary monitor.
 * ...
 */
import net from "node:net";

const STX = 0x02;
const API = 0x02;
const EVENT_ID = 0xffffffff;
```
Convention notes: header block comment states WHY the file exists and its usage (matches
project-wide "WHY this file exists" comment convention). `SCREAMING_SNAKE_CASE` module
constants (`STX`, `API`, `EVENT_ID`, `CMD`, `RESP_NAME`, `ERR_NAME`). No path aliases; this
file has no local imports at all (single-file script), so the "every relative import
includes its real extension" convention doesn't apply here — nothing to extend.

**Command-table pattern to extend** (lines 27–51):
```javascript
const CMD = {
  MEM_GET: 0x01,
  ADVANCE_INSTRUCTIONS: 0x71,
  PING: 0x81,
  REGISTERS_AVAILABLE: 0x83,
  DISPLAY_GET: 0x84,
  VICE_INFO: 0x85,
  CPUHISTORY_GET: 0x86,
  EXIT: 0xaa,
};
const RESP_NAME = {
  0x61: "JAM",
  0x62: "STOPPED",
  0x63: "RESUMED",
};
const ERR_NAME = {
  0x00: "OK",
  0x01: "OBJECT_MISSING",
  0x02: "INVALID_MEMSPACE",
  0x80: "INVALID_LENGTH",
  0x81: "INVALID_PARAMETER",
  0x82: "INVALID_API_VERSION",
  0x83: "INVALID_TYPE",
  0x8f: "CMD_FAILURE",
};
```
**Required additions** (all confirmed opcodes, `.planning/intel/constraints.md:54-60`):
```javascript
const CMD = {
  MEM_GET: 0x01,
  MEM_SET: 0x02,                // add
  CHECKPOINT_SET: 0x12,         // add
  CONDITION_SET: 0x22,          // add
  RESOURCE_GET: 0x51,           // add
  ADVANCE_INSTRUCTIONS: 0x71,
  PING: 0x81,
  REGISTERS_AVAILABLE: 0x83,
  DISPLAY_GET: 0x84,
  VICE_INFO: 0x85,
  CPUHISTORY_GET: 0x86,
  PALETTE_GET: 0x91,            // add
  EXIT: 0xaa,
};
```
`RESP_NAME` should also gain the two event types the doc-correction work is restoring
(`CHECKPOINT_INFO` 0x11, `REGISTER_INFO` 0x31) so the demux in `_onData` prints them
instead of falling through to the `0x${respType.toString(16)}` fallback — relevant because
the new `CONDITION_SET` probe (below) will trigger a `CHECKPOINT_INFO` event that arrives
at the same `reqId === EVENT_ID` path as `STOPPED`/`RESUMED`/`JAM`:
```javascript
const RESP_NAME = {
  0x11: "CHECKPOINT_INFO",  // add — shares response type with CHECKPOINT_GET/SET replies;
                              // demux already keys on request-id so this is display-only
  0x31: "REGISTER_INFO",    // add — shares response type with REGISTERS_GET replies
  0x61: "JAM",
  0x62: "STOPPED",
  0x63: "RESUMED",
};
```
`ERR_NAME` already has every code the new probes need (`OBJECT_MISSING` for the
`Drive8TrueEmulation` miss case, `INVALID_TYPE`/`CMD_FAILURE` for the version-gate
differential) — no additions needed there.

**Core request/response pattern, numbered-check style** (lines 159–190, e.g. check 3
`REGISTERS_AVAILABLE`, the simplest existing example — one-shot request, print result):
```javascript
try {
  const r = await mon.send(CMD.REGISTERS_AVAILABLE, Buffer.from([0x00]));
  console.log(`3. REGS_AVAILABLE  -> ${ERR_NAME[r.errCode] || r.errCode} (body ${r.body.length}B)`);
} catch (e) {
  console.log(`3. REGS_AVAILABLE  -> FAILED (${e.message})`);
}
```
Every new probe (PALETTE_GET, RESOURCE_GET for `Drive8TrueEmulation`) should follow this
exact try/catch + numbered-log shape, continuing the numbering from 7 onward (six checks
exist today).

**Body-construction pattern for multi-field requests** (lines 192–196, the existing
`CPUHISTORY_GET` body build — the closest existing analog for building a body with mixed
field widths, matches the `Buffer.alloc` + `writeUInt32LE`/direct-index style to reuse for
`CHECKPOINT_SET` and `CONDITION_SET`):
```javascript
const histBody = Buffer.alloc(5);
histBody[0] = 0x00;
histBody.writeUInt32LE(1, 1);
```

**New body builders to add** (already drafted and cross-checked in RESEARCH.md's Code
Examples section; verified opcodes match `constraints.md`):
```javascript
// PALETTE_GET (0x91) request body: 1 byte, use_vic. Send 0x00 on x64sc.
function paletteGetBody() {
  return Buffer.from([0x00]);
}
// Response: [count:u16LE][ per entry: itemSize(1)=3, r, g, b ]*count
// (monitor_binary.c:1325-1383, cross-checked GAINS-PROTOCOL.md §C.6)
function parsePalette(body) {
  const count = body.readUInt16LE(0);
  const entries = [];
  let off = 2;
  for (let i = 0; i < count; i++) {
    const itemSize = body[off]; // expect 3
    const r = body[off + 1], g = body[off + 2], b = body[off + 3];
    entries.push({ r, g, b });
    off += 1 + itemSize;
  }
  return { count, entries };
}

// RESOURCE_GET (0x51) request body: [nameLen:1][name ASCII]
function resourceGetBody(name) {
  const n = Buffer.from(name, "ascii");
  const body = Buffer.alloc(1 + n.length);
  body[0] = n.length;
  n.copy(body, 1);
  return body;
}
// Response: [0]=0x00 string -> [1]=len,[2..] bytes ; [0]=0x01 int -> [1]=4,[2..6]=int32LE
// (GAINS-PROTOCOL.md §C.1, monitor_binary.c:942-960). 0x01 OBJECT_MISSING on either
// "does not exist" or "string resource is NULL" -- these are NOT distinguishable on the wire.
function parseResource(r) {
  if (r.errCode !== 0x00) return { missing: true };
  if (r.body[0] === 0x00) {
    const len = r.body[1];
    return { type: "string", value: r.body.subarray(2, 2 + len).toString("ascii") };
  }
  return { type: "int", value: r.body.readInt32LE(2) }; // SIGNED -- Speed can be negative
}

// CHECKPOINT_SET (0x12) request body: 8 bytes, or 9 with optional memspace.
// (GAINS-PROTOCOL.md ~line 165-178; matches CON-command-opcode-set 0x12)
function checkpointSetBody({ start, end, stop = 1, enabled = 1, ops = 0x04, temporary = 1, memspace }) {
  const withMemspace = memspace !== undefined;
  const body = Buffer.alloc(withMemspace ? 9 : 8);
  body.writeUInt16LE(start, 0);
  body.writeUInt16LE(end, 2);
  body[4] = stop;
  body[5] = enabled;
  body[6] = ops; // e_exec = 0x04
  body[7] = temporary;
  if (withMemspace) body[8] = memspace; // 0x00 main, 0x01-0x04 units 8-11
  return body;
}
// Response is CHECKPOINT_INFO (0x11), fixed 23-byte body -- reuse for verifying the SET
// itself succeeded (checkpoint number at bytes 0-3) and later for reading hit_count
// (bytes 13-16, uint32LE) to confirm CONDITION_SET fired:
function parseCheckpointInfo(body) {
  return {
    checkpointNum: body.readUInt32LE(0),
    currentlyHit: body[4] === 1,
    startAddr: body.readUInt16LE(5),
    endAddr: body.readUInt16LE(7),
    hitCount: body.readUInt32LE(13),
    memspace: body[22],
  };
}

// CONDITION_SET (0x22) request body: [checkpointNum:u32LE][exprLen:1][expr ASCII, NOT NUL-terminated]
// Defensive bound per RESEARCH.md's ASVS V5 note: assert expr.length <= 255 before encoding.
function conditionSetBody(checkpointNum, expr) {
  const exprBuf = Buffer.from(expr, "ascii");
  if (exprBuf.length > 255) throw new Error("CONDITION_SET expr exceeds 255 bytes");
  const body = Buffer.alloc(5 + exprBuf.length);
  body.writeUInt32LE(checkpointNum, 0);
  body[4] = exprBuf.length;
  exprBuf.copy(body, 5);
  return body;
}
// Example, correctly parenthesised, hex literal, uppercase pseudo-registers per CLAUDE.md:
//   conditionSetBody(cpNum, "(RL == $64) && (CY == $14)")

// MEM_SET (0x02) request body for the drive-ROM probe -- reuse MEM_GET's existing shape
// (CMD.MEM_GET already defined; MEM_SET is the mirror opcode 0x02). Layout per
// constraints.md CON-command-opcode-set / GAINS-PROTOCOL.md §A: [sidefx:1][start:u16LE]
// [end:u16LE][memspace:1][bankLo:u16LE (send 0x0000, banks ignored on drive)][data...]
function memSetBody({ start, end, memspace, data }) {
  const body = Buffer.alloc(8 + data.length);
  body[0] = 0x00; // sidefx = false
  body.writeUInt16LE(start, 1);
  body.writeUInt16LE(end, 3);
  body[5] = memspace; // 0x01-0x04 for drive units 8-11
  body.writeUInt16LE(0x0000, 6); // bank id, ignored by drivemem_bank_store
  data.copy(body, 8);
  return body;
}
```

**Error handling pattern** (consistent throughout, lines 160–271, e.g. check 4):
```javascript
try {
  const r1 = await mon.send(CMD.CPUHISTORY_GET, histBody);
  if (r1.errCode !== 0x00) {
    results.cpuHistory = false;
    console.log(`4. CPUHISTORY_GET  -> ${ERR_NAME[r1.errCode] || r1.errCode}  => ...`);
  } else {
    // success path
  }
} catch (e) {
  results.cpuHistory = false;
  console.log(`4. CPUHISTORY_GET  -> FAILED (${e.message})`);
}
```
Every new probe (PALETTE_GET, CONDITION_SET, CHECKPOINT_SET ×2 lengths, `Drive8TrueEmulation`
RESOURCE_GET, MEM_SET into drive ROM, DISPLAY_GET pixel check, ADVANCE_INSTRUCTIONS event-pair
check) must follow this exact shape: try the send, branch on `errCode`, never let one probe's
exception abort the whole run (each check is independently wrapped). This matters especially
for the drive-ROM `MEM_SET` probe (UNVERIFIED item 3) — RESEARCH.md flags it as the one probe
that can crash the emulator instance; the surrounding `try/catch` here does not protect against
a crashed *process* (socket will just error/close), so this probe should be sequenced last and
its catch block should treat a closed-socket error as an informative result ("drive ROM write
crashed or hung the target"), not just a generic FAILED line.

**Async/event pattern to reuse for the `CONDITION_SET`-fires check and the
`ADVANCE_INSTRUCTIONS` RESUMED/STOPPED-pair check** (lines 80–113, `_onData`, and lines
258–269, the existing one-step check):
```javascript
// existing demux, already correct -- do not reimplement:
if (reqId === EVENT_ID) {
  const name = RESP_NAME[respType] || `0x${respType.toString(16)}`;
  const pc = body.length >= 2 ? body.readUInt16LE(0) : null;
  this.events.push({ name, pc });
  console.log(`   [async event] ${name}${pc != null ? ` PC=$${pc.toString(16).padStart(4, "0")}` : ""}`);
  continue;
}
```
```javascript
// existing check 6, the template for both new event checks:
const stepBody = Buffer.alloc(3);
stepBody[0] = 0x00;
stepBody.writeUInt16LE(1, 1);
await mon.send(CMD.ADVANCE_INSTRUCTIONS, stepBody);
await sleep(150);
console.log(`6. ASYNC EVENTS    -> observed ${mon.events.length} event(s): ${mon.events.map((e) => e.name).join(", ") || "none"}`);
```
For the new **RESUMED/STOPPED pair** check: clear/snapshot `mon.events.length` immediately
before sending `ADVANCE_INSTRUCTIONS`, sleep, then assert the *new* slice contains exactly
one `RESUMED` followed by one `STOPPED` (RESEARCH.md's open question about whether this pair
is actually emitted — this is exactly what the check answers). For the **CONDITION_SET
fires** check: `CHECKPOINT_SET` a temporary exec checkpoint over a range that will be hit
during normal execution (or during a subsequent `ADVANCE_INSTRUCTIONS`/`EXIT`+run), attach
`CONDITION_SET` with `"(RL == $64) && (CY == $14)"`, let the machine run briefly, then look
for a `CHECKPOINT_INFO` event in `mon.events` (once `RESP_NAME` is extended per above) with
`currentlyHit === true`, or independently re-`CHECKPOINT_GET`/track `hitCount` transitioning
from 0 to ≥1 via `parseCheckpointInfo`.

**DISPLAY_GET extension for the pixel-vs-known-colour check** (lines 233–256, existing
comment already documents the full body layout — extend, do not re-derive):
```javascript
// body: [info_len:4][dw:2][dh:2][xo:2][yo:2][iw:2][ih:2][bpp:1][buflen:4][buffer...]
const dw = r.body.readUInt16LE(4);
const dh = r.body.readUInt16LE(6);
const iw = r.body.readUInt16LE(12);
const ih = r.body.readUInt16LE(14);
const bpp = r.body[16];
```
To add the pixel check: read `buflen` at offset 17 (`readUInt32LE`), the pixel buffer
starts at offset 21, is indexed-8 (`bpp` should be 8), stride is `dw` (the *debug* width,
not inner width, since the buffer covers the full debug frame per VICE's screenshot
convention). Compute `pixelIndex = y * dw + x` for a border/background pixel position, read
`buffer[pixelIndex]` as the palette index, then cross-reference against the `PALETTE_GET`
result above (`entries[index]`) and compare RGB to the expected default (read the *actual*
default off a fresh boot, per RESEARCH.md Assumption A2 — do not hardcode a value from
training knowledge).

**Targeting a specific binary / port** — the script already supports this; no code change
needed here. It reads host/port from `process.argv[2]`/`[3]` or `VICE_BINMON=host:port`
(lines 53–58):
```javascript
function parseTarget() {
  const env = process.env.VICE_BINMON;
  let host = process.argv[2] || (env && env.split(":")[0]) || "127.0.0.1";
  let port = Number(process.argv[3] || (env && env.split(":")[1]) || 6502);
  return { host, port };
}
```
Running against both `/usr/bin/x64sc` (3.9) and `/usr/local/bin/x64sc` (3.10 fork) is an
**execution-time** concern, not a probe-script change: launch each binary once with
`-binarymonitor -binarymonitoraddress ip4://127.0.0.1:<port>` on two different ports (e.g.
6502 and 6503), then run `node probe-binmon.mjs 127.0.0.1 6502` and
`node probe-binmon.mjs 127.0.0.1 6503` separately, recording both outputs into
`docs/phase1-probe-results.md`. The closest existing repo pattern for "which VICE binary to
run" is the broker's `VICE_BIN` env var (`process.env.VICE_BIN ?? "x64sc"`, e.g.
`.claude/mcp/vice/broker-launch.mts:135`, `resources/vice-broker.mjs:108`) — but that
pattern belongs to the broker's *launch* path (it spawns the process), which is not what
this probe does (it only connects to an already-listening binary monitor port). Do not
import broker machinery into `probe-binmon.mjs`; the plan's launch step is a manual/shell
`x64sc -binarymonitor ...` invocation per binary, exactly as the script's own header
comment already documents (lines 13–17).

**Error handling shape used project-wide (NOT applicable to probe-binmon.mjs directly):**
`ViceError extends Error` (`.claude/mcp/vice/vice.ts:250-260`) is the project's base error
class for the MCP/HTTP transport surface:
```typescript
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
`probe-binmon.mjs` is a standalone dev script (not part of the MCP server module graph) and
does not use this class — its existing error handling is plain `throw new Error(...)` /
`console.log("... FAILED (...)")`, which is the correct pattern to continue for this file.
Do not introduce `ViceError` here; it would be an unused cross-module dependency for a
disposable probe script and RESEARCH.md's "Don't Hand-Roll" table explicitly says to extend
the existing `BinMon` class rather than build new client machinery.

---

## Shared Patterns

### Wire framing (applies to every new probe)
**Source:** `.claude/mcp/vice/probe-binmon.mjs:60-129` (`encode()` + `BinMon` class)
**Apply to:** all six new probe additions
- 11-byte request header, 12-byte response header, all multi-byte fields little-endian
  (matches `CON-wire-request-header`/`CON-response-header` in `constraints.md`).
- Never write a second socket/framing implementation; call `mon.send(cmdType, body)` and
  branch on the returned `{ respType, errCode, body }`.
- Unsolicited events arrive at `reqId === EVENT_ID` (`0xffffffff`) and must never resolve a
  pending request — the existing demux already enforces this; extending `RESP_NAME` for
  `CHECKPOINT_INFO` (0x11) and `REGISTER_INFO` (0x31) is display-only and does not change
  the demux logic itself.

### Numbered-check console output
**Source:** `.claude/mcp/vice/probe-binmon.mjs:159-283` (checks 1–6, final verdict block)
**Apply to:** all new checks, and the final "=== Phase-0 verdict ===" summary block, which
should gain a line per new capability (palette entry count, condition-fire result,
9-byte-checkpoint result, `Drive8TrueEmulation` presence, drive `MEM_SET` result, event-pair
observation) mirroring the existing `results.*` accumulator + summary-print pattern.

### Defensive bounds on probe-authored (not attacker-controlled) input
**Source:** RESEARCH.md Security Domain section, V5 row
**Apply to:** `conditionSetBody()`, `checkpointSetBody()` — assert length invariants
(`expr.length <= 255`) before encoding, matching the wire format's uint8 length fields,
even though the probe is a manual dev tool with no untrusted input.

### Project-wide code style (applies to any edits in this file)
**Source:** `./CLAUDE.md` Conventions section, cross-checked against the file itself
- 2-space indent, double quotes, semicolons — `probe-binmon.mjs` already follows this
  throughout; new code must match.
- `camelCase`, verb-first function names (`parsePalette`, `parseResource`,
  `checkpointSetBody`, `conditionSetBody`, `memSetBody`, `parseCheckpointInfo`) — matches
  existing `newestCycleFromHistory`, `parseTarget`, `encode`.
- `SCREAMING_SNAKE_CASE` for module constants (`STX`, `API`, `EVENT_ID`, `CMD`, `RESP_NAME`,
  `ERR_NAME`) — extend `CMD`/`RESP_NAME`/`ERR_NAME` in place rather than adding parallel
  tables.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/phase1-probe-results.md` | doc (new) | N/A | RESEARCH.md confirms no existing repo convention for recording an empirical probe/verification run (`.planning/intel/`, `docs/`, `.planning/notes/`, and GSD's `artifact-types.md` were all checked). Use the shape RESEARCH.md proposes directly (Summary table for criterion 3, one subsection per UNVERIFIED item for criterion 4, raw output appendix) — there is no code or prior-doc pattern to copy structurally, only the proposed template already in RESEARCH.md's "Where to record probe output" section. |

## Markdown-only files (no code analog — listed per scope note, not mapped further)

| File | Nature of edit |
|------|-----------------|
| `docs/phase0-binmon-findings.md` | Replace four cited error blocks (§1 twice, §4) with drafted correction text; add the RL/CY omission fix and the 3-vs-5 event-type undercount fix, both already worded in `CLAUDE.md`/`.planning/PROJECT.md` |
| `docs/stock-vice-parity.md` | Remove/rewrite loss #3 (pause-now), update loss #5's premise (stopwatch conditionality), name `RL`/`CY` in §A.4, note version gate in §B.1 |
| `.planning/intel/constraints.md` | Rewrite `CON-stopwatch-via-cpuhistory` (exact replacement text already drafted in RESEARCH.md), reconcile `CON-no-monotonic-cycle-register` and `CON-no-pause-now-opcode` |
| `docs/roadmap-stock-vice.md` (optional) | One-line erratum pointer at top, per RESEARCH.md Open Question 1 recommendation — not a full rewrite |

## Metadata

**Analog search scope:** `.claude/mcp/vice/*.mjs`, `.claude/mcp/vice/*.ts`, `.claude/mcp/vice/*.mts`, `.claude/mcp/vice/resources/*.mjs`, `.planning/research/GAINS-PROTOCOL.md`, `.planning/intel/constraints.md`
**Files scanned:** `probe-binmon.mjs` (full), `vice.ts` (ViceError excerpt), `repo-root.ts` (header-comment convention), `smoke.mjs` (sibling standalone script style), `broker-launch.mts` / `resources/vice-broker.mjs` (VICE_BIN parameterization pattern), `.planning/research/GAINS-PROTOCOL.md` (wire layouts for PALETTE_GET, RESOURCE_GET, CHECKPOINT_SET/CHECKPOINT_INFO, CPUHISTORY_GET), `.planning/intel/constraints.md` (opcode table cross-check)
**Pattern extraction date:** 2026-08-12
