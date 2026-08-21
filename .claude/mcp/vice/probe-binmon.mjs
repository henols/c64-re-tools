#!/usr/bin/env node
/*
 * Phase-1 de-risk probe for stock VICE's binary monitor.
 *
 * This repo's container has no VICE and no display, so this must be run on a
 * machine with a real x64sc. It answers success criterion 3 (api version, VICE
 * version quad, CPUHISTORY_GET's 0x83-vs-0x8f distinction, DISPLAY_GET geometry,
 * PALETTE_GET entry count, observed unsolicited event sequence) and all five
 * items research flagged UNVERIFIED (9-byte CHECKPOINT_SET, Drive8TrueEmulation
 * naming, MEM_SET into drive ROM, RL/CY condition acceptance + firing,
 * PALETTE_GET/pixel-vs-register), plus whether ADVANCE_INSTRUCTIONS emits a
 * RESUMED/STOPPED pair. See docs/phase0-binmon-findings.md and
 * docs/phase1-probe-results.md (the recorded run).
 *
 * Usage:
 *   1) Launch a VICE build with the binary monitor:
 *        x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
 *   2) node .claude/mcp/vice/probe-binmon.mjs [host] [port]
 *      (defaults: 127.0.0.1 6502; or set VICE_BINMON=host:port)
 *
 * Offline self-check (no emulator, no socket):
 *   node .claude/mcp/vice/probe-binmon.mjs --selftest
 * Verifies every wire-body builder and response parser below against
 * synthesised buffers. Run this before trusting a live run against a real
 * build to have caught any layout regression here first.
 *
 * Bounded fixture capture (needs a real x64sc; writes fixtures/binmon/):
 *   node .claude/mcp/vice/probe-binmon.mjs --capture <case>
 *   node .claude/mcp/vice/probe-binmon.mjs --capture all [--capture-out <dir>]
 * <case> is one of "display-get", "event-interleaved", "checkpoint-list",
 * "cpuhistory-get", "cpuhistory-get-multi", "cpuhistory-get-unsupported", or
 * "all". Writes <case>.bin (raw concatenated wire bytes) and <case>.json (a
 * provenance sidecar: capturedFrom, viceVersion, capturedAt, command) into
 * --capture-out (defaults to fixtures/binmon/ next to this script), each via
 * a tmp-sibling -> rename write. Every case is bounded by MAX_CAPTURE_FRAMES:
 * a runaway case aborts and writes nothing rather than consuming the whole
 * capture session's time budget (see the CHECKPOINT_INFO x18 flood recorded
 * in docs/phase1-probe-results.md). binmon-fixtures.ts's loadCapturedFixture()
 * is the consumer of what this writes.
 *
 * Phase-3 assumption probes (needs a real x64sc; live, no fixtures written):
 *   node .claude/mcp/vice/probe-binmon.mjs --probe-assumptions [host] [port]
 *   node .claude/mcp/vice/probe-binmon.mjs --probe-assumptions=A1,A3 [host] [port]
 * Runs one live check per Phase 3 wire assumption -- A1 (-remotemonitoraddress
 * binding), A2 (ADVANCE_INSTRUCTIONS step-over semantics), A3 (JOYPORT_SET bit
 * mapping), A5 (AUTOSTART fileIndex with the run flag clear) -- against the
 * given (or default 127.0.0.1:6502) binary-monitor target, printing a
 * three-valued verdict (CONFIRMED/CONTRADICTED/INCONCLUSIVE) per assumption
 * with the raw observation it rests on. Bare `--probe-assumptions` runs all
 * four; `--probe-assumptions=<comma-list>` runs only the named subset. A4 is
 * deliberately OUT OF SCOPE and no probe here arms any checkpoint: A4 needs a
 * non-stopping checkpoint on a hot, frequently-executed address, and a
 * non-stopping checkpoint's CHECKPOINT_INFO hit frame is emitted
 * SYNCHRONOUSLY, over the blocking socket, from inside the emulator's CPU
 * loop (mon_breakpoint.c:557-562) -- on a hot address this can stall the
 * emulator thread. See docs/phase1-probe-results.md and
 * .planning/phases/13-external-verification/13-PROBE-RESULTS.md for recorded
 * runs.
 *
 * No dependencies; pure Node (net).
 */
import net from "node:net";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const STX = 0x02;
const API = 0x02;
const EVENT_ID = 0xffffffff;

const CMD = {
  MEM_GET: 0x01,
  MEM_SET: 0x02,
  CHECKPOINT_GET: 0x11,
  CHECKPOINT_SET: 0x12,
  CHECKPOINT_DELETE: 0x13,
  CHECKPOINT_LIST: 0x14,
  CONDITION_SET: 0x22,
  REGISTERS_GET: 0x31,
  REGISTERS_SET: 0x32,
  RESOURCE_GET: 0x51,
  ADVANCE_INSTRUCTIONS: 0x71,
  PING: 0x81,
  REGISTERS_AVAILABLE: 0x83,
  DISPLAY_GET: 0x84,
  VICE_INFO: 0x85,
  CPUHISTORY_GET: 0x86,
  PALETTE_GET: 0x91,
  JOYPORT_SET: 0xa2,
  EXIT: 0xaa,
  AUTOSTART: 0xdd,
};
const RESP_NAME = {
  0x11: "CHECKPOINT_INFO", // add — shares response type with CHECKPOINT_GET/SET replies;
  // demux already keys on request-id so this is display-only.
  0x31: "REGISTER_INFO", // add — shares response type with REGISTERS_GET replies.
  0x61: "JAM",
  0x62: "STOPPED",
  0x63: "RESUMED",
};
// Response types that arrive unsolicited at request-id 0xffffffff. Only
// STOPPED/RESUMED carry a 2-byte PC body; JAM's body is zero-length, and
// CHECKPOINT_INFO/REGISTER_INFO bodies are entirely different structures.
// Reading a "PC" out of the latter two produces plausible-looking nonsense --
// see the field-specific rendering in _onData().
const EVT = {
  JAM: 0x61,
  STOPPED: 0x62,
  RESUMED: 0x63,
  CHECKPOINT_INFO: 0x11,
  REGISTER_INFO: 0x31,
};

// Upper bound on a trusted body length. The largest legitimate frame is a
// DISPLAY_GET of the full debug screen (504*312 = 157,248 bytes at 8bpp plus
// its info block), so 4 MiB is far above anything real while still refusing an
// arbitrary 32-bit value read out of a desynced stream.
const MAX_BODY_LEN = 4 * 1024 * 1024;

// Hard per-case cap on how many frames --capture will accumulate before
// aborting that case and writing no .bin for it. Exists because a
// non-stopping or wide-range checkpoint can flood CHECKPOINT_INFO frames
// synchronously from inside the CPU loop -- exactly the CHECKPOINT_INFO x18
// flood observed on the fork build and recorded in
// docs/phase1-probe-results.md's "Anomaly observed on the fork build". A
// runaway case must not consume the whole capture session's time budget for
// the other cases.
const MAX_CAPTURE_FRAMES = 32;

// The real-capture cases --capture accepts (plus "all"). The three
// VERIF-02 cases plus plan 07-12's three CPUHISTORY_GET (0x86) captures --
// see cpuhistory-get{,-multi,-unsupported} runners below.
const CAPTURE_CASES = [
  "display-get",
  "event-interleaved",
  "checkpoint-list",
  "cpuhistory-get",
  "cpuhistory-get-multi",
  "cpuhistory-get-unsupported",
];

/**
 * WR-10 (07-REVIEW.md): the per-case VICE version requirement, MACHINE-CHECKED
 * rather than left to a comment.
 *
 * CAPTURE_CASES now mixes cases with MUTUALLY EXCLUSIVE target requirements:
 * `cpuhistory-get`/`-multi` are only meaningful against a >= 3.10 build (which
 * has the 0x86 opcode), and `cpuhistory-get-unsupported` only against a 3.9-class
 * one (which does not, and answers INVALID_TYPE). Their runners are
 * byte-identical -- the connected build is the ONLY thing that distinguishes
 * them. `--capture all` runs every case against the one connected target, so
 * before this gate a single run against a 3.10 build overwrote
 * cpuhistory-get-unsupported.bin with a successful 52-byte history frame while
 * its sidecar's `command` still read "against a build without
 * FEATURE_CPUMEMHISTORY" -- a provenance lie generated by the provenance
 * tooling itself, in a repo whose stated standard is "provenance that lies is
 * the thing not to produce". The only mitigation was that a downstream test's
 * errorCode 0x83 assertion then failed, by which point the committed fixture
 * was already clobbered.
 *
 * A case with no entry here runs against any build. The check happens BEFORE
 * the runner is invoked, so a mismatch sends nothing and writes nothing.
 */
export const CAPTURE_REQUIRES_VERSION = {
  "cpuhistory-get": { pattern: /^3\.(?:1[0-9]|[2-9][0-9])\./, describe: "VICE >= 3.10 (the build family that HAS the 0x86 CPUHISTORY_GET opcode)" },
  "cpuhistory-get-multi": { pattern: /^3\.(?:1[0-9]|[2-9][0-9])\./, describe: "VICE >= 3.10 (the build family that HAS the 0x86 CPUHISTORY_GET opcode)" },
  "cpuhistory-get-unsupported": { pattern: /^3\.9\./, describe: "VICE 3.9 (a build with NO 0x86 case, whose reply is the INVALID_TYPE error frame this fixture records)" },
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

// Plan 07-12, Task 1 (blocking fix): `--capture <case>` and `--capture-out
// <dir>` each consume the bare word immediately after them as their OWN
// argument, not a host/port positional -- but the naive `!a.startsWith("--")`
// filter below could not tell the difference and picked up the case name
// (e.g. "cpuhistory-get") as `host`, silently breaking every `--capture`
// invocation's VICE_BINMON env-var fallback (getaddrinfo ENOTFOUND
// "cpuhistory-get"). Strip both flags AND the single argument each consumes
// before falling through to host/port positionals.
function parseTarget() {
  const env = process.env.VICE_BINMON;
  const argv = process.argv.slice(2);
  const consumed = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--capture" || argv[index] === "--capture-out") {
      consumed.add(index);
      consumed.add(index + 1);
    }
  }
  const positional = argv.filter((a, index) => !consumed.has(index) && !a.startsWith("--"));
  let host = positional[0] || (env && env.split(":")[0]) || "127.0.0.1";
  let port = Number(positional[1] || (env && env.split(":")[1]) || 6502);
  return { host, port };
}

function encode(requestId, commandType, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(11);
  header[0] = STX;
  header[1] = API;
  header.writeUInt32LE(body.length >>> 0, 2);
  header.writeUInt32LE(requestId >>> 0, 6);
  header[10] = commandType;
  return Buffer.concat([header, body]);
}

class BinMon {
  constructor(socket) {
    this.sock = socket;
    this.buf = Buffer.alloc(0);
    this.pending = new Map(); // requestId -> {resolve, reject}
    this.nextId = 1;
    this.events = [];
    this.observedApi = null; // api_version byte from the response header, as observed
    // Set by --capture mode only: called with each frame's header+body,
    // downstream of the resync/MAX_BODY_LEN-guarded framing loop below (never
    // a second, independent parse of the wire). Left null outside capture.
    this.onFrame = null;
    socket.on("data", (chunk) => this._onData(chunk));
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    // Response header is 12 bytes; loop while a full frame is buffered.
    while (this.buf.length >= 12) {
      if (this.buf[0] !== STX) {
        // resync: drop one byte
        this.buf = this.buf.subarray(1);
        continue;
      }
      const bodyLen = this.buf.readUInt32LE(2);
      // A bodyLen beyond any legitimate frame means this 0x02 was not really a
      // frame start (a 0x02 byte inside an earlier body, reached after a
      // one-byte desync). Trusting it would park the cursor waiting for bytes
      // that never arrive, and every later response would queue behind it and
      // time out with no hint at the real cause. Drop one byte and resync
      // instead of trusting an arbitrary 32-bit length.
      if (bodyLen > MAX_BODY_LEN) {
        console.log(
          `   [framing] implausible body length ${bodyLen} at a 0x02 byte -- treating as desync, resyncing one byte`,
        );
        this.buf = this.buf.subarray(1);
        continue;
      }
      const total = 12 + bodyLen;
      if (this.buf.length < total) break;
      const frame = this.buf.subarray(0, total);
      this.buf = this.buf.subarray(total);
      // --capture mode's raw-byte dump: fires here, downstream of the
      // resync + MAX_BODY_LEN guards above, on every reassembled frame
      // (both replies and unsolicited events) in arrival order. Never
      // re-parses the wire independently.
      if (this.onFrame) this.onFrame(Buffer.from(frame));
      if (this.observedApi === null) this.observedApi = frame[1];
      const respType = frame[6];
      const errCode = frame[7];
      const reqId = frame.readUInt32LE(8);
      const body = frame.subarray(12, total);
      if (reqId === EVENT_ID) {
        const name = RESP_NAME[respType] || `0x${respType.toString(16)}`;
        // PC is read ONLY for the two event types whose body actually is a
        // 2-byte PC. JAM (0x61) has a zero-length body; CHECKPOINT_INFO (0x11)
        // begins with a u32 checkpoint number and REGISTER_INFO (0x31) with a
        // register-item count, so decoding either as a PC yields a
        // plausible-but-meaningless value. An earlier revision did exactly
        // that and wrote fabricated "PC=$0001"/"PC=$000a" lines into
        // docs/phase1-probe-results.md's recorded transcripts.
        const isPcShaped = respType === EVT.STOPPED || respType === EVT.RESUMED;
        const pc = isPcShaped && body.length >= 2 ? body.readUInt16LE(0) : null;
        let detail = "";
        if (pc != null) {
          detail = ` PC=$${pc.toString(16).padStart(4, "0")}`;
        } else if (respType === EVT.CHECKPOINT_INFO && body.length >= 23) {
          const info = parseCheckpointInfo(body);
          detail = ` checkpoint=#${info.checkpointNum} hit_count=${info.hitCount} currently_hit=${info.currentlyHit}`;
        } else if (respType === EVT.REGISTER_INFO && body.length >= 2) {
          detail = ` register_count=${body.readUInt16LE(0)}`;
        }
        this.events.push({ name, pc, detail: detail.trim() });
        console.log(`   [async event] ${name}${detail}`);
        continue;
      }
      const p = this.pending.get(reqId);
      if (p) {
        this.pending.delete(reqId);
        p.resolve({ respType, errCode, body, api: this.observedApi });
      }
    }
  }

  send(commandType, body) {
    const id = this.nextId++;
    const frame = encode(id, commandType, body);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.sock.write(frame);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout waiting for response to cmd 0x${commandType.toString(16)}`));
        }
      }, 4000);
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Control-flow marker: check 13's pre-write baseline read failed, so the
 * destructive write was never attempted and the outer catch must not report a
 * write outcome. Not an error condition to diagnose -- it has already printed
 * its own line. */
class SkipCheck13 extends Error {}

// Extract the newest history entry's uint64 cycle from a CPUHISTORY_GET body.
// Layout: uint32 count, then per entry: item_size(1) + <item_size bytes>, where
// the last 13 bytes of the item are [cycle:8][instr_len:1][op:1][p1:1][p2:1][p3:1].
function newestCycleFromHistory(body) {
  if (body.length < 5) return null;
  const count = body.readUInt32LE(0);
  if (count < 1) return { count, cycle: null };
  const itemSize = body[4];
  const itemStart = 5;
  const cycleOff = itemStart + itemSize - 13;
  if (cycleOff < 0 || cycleOff + 8 > body.length) return { count, cycle: null };
  return { count, cycle: body.readBigUInt64LE(cycleOff) };
}

// ---------------------------------------------------------------------------
// Request-body builders and response parsers. Every new probe check (below,
// in main()) is built on these; no second framing implementation.
// ---------------------------------------------------------------------------

// MEM_GET (0x01) / MEM_SET (0x02) share the same 8-byte header layout:
// sidefx(1), start(u16LE), end(u16LE), memspace(1), bank(u16LE) — always
// exactly 8 bytes for MEM_GET; MEM_SET appends the payload at offset 8.
function memGetBody({ sidefx = 0, start, end, memspace = 0x00, bank = 0x0000 } = {}) {
  const body = Buffer.alloc(8);
  body[0] = sidefx;
  body.writeUInt16LE(start, 1);
  body.writeUInt16LE(end, 3);
  body[5] = memspace;
  body.writeUInt16LE(bank, 6);
  return body;
}

function memSetBody({ start, end, memspace, data }) {
  const body = Buffer.alloc(8 + data.length);
  body[0] = 0x00; // sidefx = false
  body.writeUInt16LE(start, 1);
  body.writeUInt16LE(end, 3);
  body[5] = memspace; // 0x00 main, 0x01-0x04 units 8-11; 0x08 (internal enum) is rejected
  body.writeUInt16LE(0x0000, 6); // bank id, ignored by drivemem_bank_store
  data.copy(body, 8);
  return body;
}

// CHECKPOINT_SET (0x12) request body: 8 bytes, or 9 with the optional memspace byte.
function checkpointSetBody({
  start,
  end,
  stop = 1,
  enabled = 1,
  ops = 0x04,
  temporary = 1,
  memspace,
}) {
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

// Small shared helper: CHECKPOINT_GET/CHECKPOINT_DELETE both take a bare
// checkpointNum(u32LE) body. Not one of the enumerated builders above; kept
// tiny and local since it has nothing else to validate offline.
function cpNumBody(checkpointNum) {
  const body = Buffer.alloc(4);
  body.writeUInt32LE(checkpointNum, 0);
  return body;
}

// CONDITION_SET (0x22) request body: checkpointNum(u32LE), exprLen(1), expr
// ASCII, NOT NUL-terminated. Throws before encoding if the expression exceeds
// 255 bytes (the length field is a uint8; a silently truncated frame would
// desync the stream) — the ASVS V5 control recorded in the plan's threat model.
function conditionSetBody(checkpointNum, expr) {
  const exprBuf = Buffer.from(expr, "ascii");
  if (exprBuf.length > 255) throw new Error("CONDITION_SET expr exceeds 255 bytes");
  const body = Buffer.alloc(5 + exprBuf.length);
  body.writeUInt32LE(checkpointNum, 0);
  body[4] = exprBuf.length;
  exprBuf.copy(body, 5);
  return body;
}
// Example, correctly parenthesised, hex literal, uppercase pseudo-registers:
//   conditionSetBody(cpNum, "(RL == $64) && (CY == $14)")

// RESOURCE_GET (0x51) request body: nameLen(1), name ASCII.
function resourceGetBody(name) {
  const n = Buffer.from(name, "ascii");
  const body = Buffer.alloc(1 + n.length);
  body[0] = n.length;
  n.copy(body, 1);
  return body;
}
// Response: body[0]===0x00 -> string, len at body[1], ASCII after.
// body[0]===0x01 -> int, SIGNED int32LE at offset 2 (e.g. Speed can be negative).
// OBJECT_MISSING (0x01 errCode) is returned both for "resource does not exist"
// and for "string resource is NULL" — the two are NOT distinguishable on the
// wire. This matters for interpreting the Drive8TrueEmulation result.
function parseResource(r) {
  if (r.errCode !== 0x00) return { missing: true };
  if (r.body[0] === 0x00) {
    const len = r.body[1];
    return { type: "string", value: r.body.subarray(2, 2 + len).toString("ascii") };
  }
  return { type: "int", value: r.body.readInt32LE(2) };
}

// CPUHISTORY_GET (0x86) request body: memspace(1)=0x00 (main) + count(u32LE).
// Plan 07-12, Task 1: VICE reads `count` off the wire as a uint32
// (`little_endian_to_uint32`, monitor_binary.c:1491) but stores it in a
// `uint16_t requested_count` (monitor_binary.c:1469) -- CLAUDE.md's own
// Protocol constraint -- so a count >= 65536 silently wraps on the wire
// rather than being honoured. Clamp here so this harness can never send a
// count that would misrepresent what it asked for. VICE itself rejects a
// count below 1 with InvalidParameter (0x81, monitor_binary.c:1493-1497).
function cpuHistoryGetBody(count) {
  const clamped = Math.max(1, Math.min(65535, count));
  const body = Buffer.alloc(5);
  body[0] = 0x00; // memspace: main
  body.writeUInt32LE(clamped, 1);
  return body;
}

// PALETTE_GET (0x91) request body: 1 byte, use_vic = 0x00 on x64sc.
function paletteGetBody() {
  return Buffer.from([0x00]);
}
// Response: [count:u16LE][ per entry: itemSize(1)=3, r, g, b ]*count.
function parsePalette(body) {
  const count = body.readUInt16LE(0);
  const entries = [];
  let off = 2;
  for (let i = 0; i < count; i++) {
    const itemSize = body[off]; // expect 3
    const r = body[off + 1];
    const g = body[off + 2];
    const b = body[off + 3];
    entries.push({ r, g, b });
    off += 1 + itemSize;
  }
  return { count, entries };
}

// ---------------------------------------------------------------------------
// Plan 13-03: body builders and reply parsers the four assumption probes
// (A1, A2, A3, A5) need. Deliberately independent of stock-protocol.ts --
// this script imports nothing from the package's runtime modules and must
// stay that way -- but each mirrors that module's exact wire layout so a
// live probe result here means the same thing the production encoder would
// produce.
// ---------------------------------------------------------------------------

// ADVANCE_INSTRUCTIONS (0x71) request body -- 3 bytes: stepOver(1)=0x01/0x00,
// count(u16LE). main()'s async-events check (above) has built this inline
// with stepOver always false; this named builder is what probeA2StepOver
// needs to set stepOver=true.
function advanceInstructionsBody({ stepOver = false, count = 1 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 0xffff) {
    throw new Error(`advanceInstructionsBody: count must be an integer in 1..0xffff, got ${count}`);
  }
  const body = Buffer.alloc(3);
  body[0] = stepOver ? 0x01 : 0x00;
  body.writeUInt16LE(count, 1);
  return body;
}

// REGISTERS_GET (0x31) request body -- 1 byte, the wire memspace byte (0x00
// main, 0x01-0x04 units 8-11 -- NOT the internal enum; 0x08 is rejected).
function registersGetBody(memspace = 0x00) {
  if (!Number.isInteger(memspace) || memspace < 0x00 || memspace > 0xff) {
    throw new Error(`registersGetBody: memspace must be an integer in 0x00..0xff, got ${memspace}`);
  }
  return Buffer.from([memspace]);
}

// REGISTERS_SET (0x32) request body -- memspace(1) count(u16LE), then per
// item itemSize(1)=3 regId(1) value(u16LE). itemSize is ALWAYS 3 (regId +
// value) on the wire this project targets -- see stock-protocol.ts's
// registersSetBody() JSDoc, which this mirrors independently.
function registersSetBody({ memspace = 0x00, items } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("registersSetBody: items must be a non-empty array");
  }
  if (!Number.isInteger(memspace) || memspace < 0x00 || memspace > 0xff) {
    throw new Error(`registersSetBody: memspace must be an integer in 0x00..0xff, got ${memspace}`);
  }
  const itemBuffers = [];
  for (const item of items) {
    if (!Number.isInteger(item.id) || item.id < 0x00 || item.id > 0xff) {
      throw new Error(`registersSetBody: id must be an integer in 0x00..0xff, got ${item.id}`);
    }
    if (!Number.isInteger(item.value) || item.value < 0x0000 || item.value > 0xffff) {
      throw new Error(`registersSetBody: value must be an integer in 0x0000..0xffff, got ${item.value}`);
    }
    const itemBuf = Buffer.alloc(4);
    itemBuf[0] = 3; // itemSize -- always 3 (regId + value)
    itemBuf[1] = item.id;
    itemBuf.writeUInt16LE(item.value, 2);
    itemBuffers.push(itemBuf);
  }
  const header = Buffer.alloc(3);
  header[0] = memspace;
  header.writeUInt16LE(items.length, 1);
  return Buffer.concat([header, ...itemBuffers]);
}

// JOYPORT_SET (0xa2) request body -- 4 bytes, port(u16LE) value(u16LE). The
// body SHAPE is what this builder encodes; the BIT MEANING of `value` (which
// bit is up/down/left/right/fire) is [ASSUMED] -- RESEARCH.md Assumptions Log
// row A3 -- and is exactly what probeA3JoyportBits() below exists to check.
function joyportSetBody({ port, value } = {}) {
  if (!Number.isInteger(port) || port < 0x0000 || port > 0xffff) {
    throw new Error(`joyportSetBody: port must be an integer in 0x0000..0xffff, got ${port}`);
  }
  if (!Number.isInteger(value) || value < 0x0000 || value > 0xffff) {
    throw new Error(`joyportSetBody: value must be an integer in 0x0000..0xffff, got ${value}`);
  }
  const body = Buffer.alloc(4);
  body.writeUInt16LE(port, 0);
  body.writeUInt16LE(value, 2);
  return body;
}

// AUTOSTART (0xdd) request body -- runAfter(1) fileIndex(u16LE)
// filenameLen(1) filename(ASCII). `fileIndex`'s behaviour when `runAfter` is
// false is [ASSUMED] -- RESEARCH.md Assumptions Log row A5 -- and is exactly
// what probeA5AutostartFileIndex() below exists to check.
function autostartBody({ runAfter, fileIndex = 0, filename } = {}) {
  if (!Number.isInteger(fileIndex) || fileIndex < 0x0000 || fileIndex > 0xffff) {
    throw new Error(`autostartBody: fileIndex must be an integer in 0x0000..0xffff, got ${fileIndex}`);
  }
  const filenameBuf = Buffer.from(String(filename), "ascii");
  if (filenameBuf.toString("ascii") !== filename) {
    throw new Error("autostartBody: filename is not ASCII-representable");
  }
  if (filenameBuf.length > 255) {
    throw new Error(`autostartBody: filename exceeds 255 bytes (${filenameBuf.length})`);
  }
  const body = Buffer.alloc(1 + 2 + 1 + filenameBuf.length);
  body[0] = runAfter ? 0x01 : 0x00;
  body.writeUInt16LE(fileIndex, 1);
  body[3] = filenameBuf.length;
  filenameBuf.copy(body, 4);
  return body;
}

// REGISTER_INFO (0x31) response body -- count(u16LE) at offset 0, then per
// item itemSize(1) regId(1) value(u16LE), advancing by itemSize+1. The
// stride comes from the wire's OWN itemSize byte, never a fixed 4 -- a
// fixed-stride REGISTER_INFO parser is a recorded defect in this project's
// history (WR-09, stock-protocol.ts) and must not be reintroduced here.
function parseRegisterInfo(body) {
  const count = body.readUInt16LE(0);
  let offset = 2;
  const registers = [];
  for (let index = 0; index < count; index += 1) {
    const itemSize = body[offset];
    const id = body[offset + 1];
    const value = body.readUInt16LE(offset + 2);
    registers.push({ id, value });
    offset += itemSize + 1;
  }
  return registers;
}

// REGISTERS_AVAILABLE (0x83) response body -- count(u16LE) at offset 0, then
// per item itemSize(1) regId(1) size(1) nameLength(1) name(ASCII), advancing
// by itemSize+1. Same wire-stride discipline as parseRegisterInfo above.
function parseRegistersAvailable(body) {
  const count = body.readUInt16LE(0);
  let offset = 2;
  const registers = [];
  for (let index = 0; index < count; index += 1) {
    const itemSize = body[offset];
    const id = body[offset + 1];
    const size = body[offset + 2];
    const nameLength = body[offset + 3];
    const name = body.subarray(offset + 4, offset + 4 + nameLength).toString("ascii");
    registers.push({ id, size, name });
    offset += itemSize + 1;
  }
  return registers;
}

// CHECKPOINT_INFO (0x11) response body, fixed 23 bytes.
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

// DISPLAY_GET (0x84) response body: [info_len:u32LE][dw,dh,xo,yo,iw,ih:u16LE
// each][bpp:1][buflen:u32LE][buffer...], where the buflen field position and
// pixel-buffer start are DERIVED from info_len, never hardcoded to 17/21.
function parseDisplayGet(body) {
  const infoLen = body.readUInt32LE(0);
  const dw = body.readUInt16LE(4);
  const dh = body.readUInt16LE(6);
  const xo = body.readUInt16LE(8);
  const yo = body.readUInt16LE(10);
  const iw = body.readUInt16LE(12);
  const ih = body.readUInt16LE(14);
  const bpp = body[16];
  const buflenOff = 4 + infoLen;
  const buflen = body.readUInt32LE(buflenOff);
  const bufStart = buflenOff + 4;
  const buffer = body.subarray(bufStart, bufStart + buflen);
  return { infoLen, dw, dh, xo, yo, iw, ih, bpp, buflen, buffer };
}

// ---------------------------------------------------------------------------
// Offline self-test: proves every builder/parser above without a socket.
// ---------------------------------------------------------------------------

function assertTrue(cond, msg) {
  if (!cond) throw new Error(`SELFTEST FAILED: ${msg}`);
}

function selftest() {
  // encode(): STX, api, body length, request id, command type.
  const frame = encode(0x01020304, 0x81, Buffer.from([0xaa, 0xbb]));
  assertTrue(frame[0] === STX, "encode: STX byte at offset 0");
  assertTrue(frame[1] === API, "encode: api byte at offset 1");
  assertTrue(frame.readUInt32LE(2) === 2, "encode: body length u32LE at offset 2");
  assertTrue(frame.readUInt32LE(6) === 0x01020304, "encode: request id u32LE at offset 6");
  assertTrue(frame[10] === 0x81, "encode: command type byte at offset 10");

  // checkpointSetBody: 8 bytes without memspace, 9 with.
  const cp8 = checkpointSetBody({ start: 0xea31, end: 0xea31 });
  assertTrue(cp8.length === 8, "checkpointSetBody: 8 bytes without memspace");
  assertTrue(cp8[6] === 0x04, "checkpointSetBody: ops defaults to 0x04");
  const cp9 = checkpointSetBody({ start: 0xea31, end: 0xea31, memspace: 0x00 });
  assertTrue(cp9.length === 9, "checkpointSetBody: 9 bytes with memspace");
  assertTrue(cp9[8] === 0x00, "checkpointSetBody: memspace lands in byte 8");

  // conditionSetBody: layout, and the 255-byte throw guard.
  const cond = conditionSetBody(3, "(RL == $64)");
  assertTrue(cond.readUInt32LE(0) === 3, "conditionSetBody: checkpoint number u32LE");
  assertTrue(cond[4] === "(RL == $64)".length, "conditionSetBody: byte length at offset 4");
  assertTrue(
    cond.subarray(5).toString("ascii") === "(RL == $64)",
    "conditionSetBody: ascii expr from offset 5",
  );
  let threw = false;
  try {
    conditionSetBody(1, "x".repeat(256));
  } catch {
    threw = true;
  }
  assertTrue(threw, "conditionSetBody: throws on a 256-byte expression");

  // memGetBody / memSetBody: field offsets.
  const mg = memGetBody({ start: 0xd020, end: 0xd021, memspace: 0x00 });
  assertTrue(mg.length === 8, "memGetBody: exactly 8 bytes");
  assertTrue(mg.readUInt16LE(1) === 0xd020, "memGetBody: start at offset 1");
  assertTrue(mg.readUInt16LE(3) === 0xd021, "memGetBody: end at offset 3");
  assertTrue(mg[5] === 0x00, "memGetBody: memspace at offset 5");
  assertTrue(mg.readUInt16LE(6) === 0x0000, "memGetBody: bank at offset 6");

  const ms = memSetBody({ start: 0xc000, end: 0xc000, memspace: 0x01, data: Buffer.from([0xff]) });
  assertTrue(ms.length === 9, "memSetBody: 8 + data.length bytes");
  assertTrue(ms.readUInt16LE(1) === 0xc000, "memSetBody: start at offset 1");
  assertTrue(ms[5] === 0x01, "memSetBody: memspace at offset 5");
  assertTrue(ms[8] === 0xff, "memSetBody: payload at offset 8");

  // resourceGetBody: name length + ascii name.
  const rg = resourceGetBody("Drive8TrueEmulation");
  assertTrue(rg[0] === "Drive8TrueEmulation".length, "resourceGetBody: name length byte");
  assertTrue(
    rg.subarray(1).toString("ascii") === "Drive8TrueEmulation",
    "resourceGetBody: ascii name from offset 1",
  );

  // paletteGetBody: single 0x00 byte.
  const pg = paletteGetBody();
  assertTrue(pg.length === 1 && pg[0] === 0x00, "paletteGetBody: single 0x00 byte");

  // cpuHistoryGetBody: 5-byte body, memspace(1)=0x00 + count(u32LE), and the
  // uint16_t wrap ceiling (monitor_binary.c:1469/1491) clamps a huge count
  // to 65535 rather than sending a value VICE would silently truncate.
  const chg = cpuHistoryGetBody(1);
  assertTrue(chg.length === 5, "cpuHistoryGetBody: exactly 5 bytes");
  assertTrue(chg[0] === 0x00, "cpuHistoryGetBody: memspace byte is 0x00 (main)");
  assertTrue(chg.readUInt32LE(1) === 1, "cpuHistoryGetBody: count round-trips through readUInt32LE");
  const chgMulti = cpuHistoryGetBody(4);
  assertTrue(chgMulti.readUInt32LE(1) === 4, "cpuHistoryGetBody: a count of 4 round-trips");
  const chgClamped = cpuHistoryGetBody(100000);
  assertTrue(chgClamped.readUInt32LE(1) === 65535, "cpuHistoryGetBody: a count of 100000 clamps to 65535");

  // parsePalette: synthesised 16-entry buffer.
  const palBody = Buffer.alloc(2 + 16 * 4);
  palBody.writeUInt16LE(16, 0);
  for (let i = 0; i < 16; i++) {
    const off = 2 + i * 4;
    palBody[off] = 3;
    palBody[off + 1] = i * 10;
    palBody[off + 2] = i * 10 + 1;
    palBody[off + 3] = i * 10 + 2;
  }
  const pal = parsePalette(palBody);
  assertTrue(pal.count === 16, "parsePalette: count 16");
  assertTrue(
    pal.entries[0].r === 0 && pal.entries[0].g === 1 && pal.entries[0].b === 2,
    "parsePalette: first entry RGB",
  );
  assertTrue(
    pal.entries[15].r === 150 && pal.entries[15].g === 151 && pal.entries[15].b === 152,
    "parsePalette: last entry RGB",
  );

  // parseResource: synthesised string body and synthesised negative-int body.
  const strBody = Buffer.concat([Buffer.from([0x00, 4]), Buffer.from("test", "ascii")]);
  const strRes = parseResource({ errCode: 0x00, body: strBody });
  assertTrue(
    strRes.type === "string" && strRes.value === "test",
    "parseResource: string resource decode",
  );
  const intBody = Buffer.alloc(6);
  intBody[0] = 0x01;
  intBody[1] = 4;
  intBody.writeInt32LE(-42, 2);
  const intRes = parseResource({ errCode: 0x00, body: intBody });
  assertTrue(
    intRes.type === "int" && intRes.value === -42,
    "parseResource: signed negative int decode",
  );

  // parseCheckpointInfo: synthesised 23-byte body.
  const cpiBody = Buffer.alloc(23);
  cpiBody.writeUInt32LE(7, 0);
  cpiBody[4] = 1;
  cpiBody.writeUInt16LE(0xea31, 5);
  cpiBody.writeUInt16LE(0xea31, 7);
  cpiBody.writeUInt32LE(3, 13);
  cpiBody[22] = 0x00;
  const cpi = parseCheckpointInfo(cpiBody);
  assertTrue(cpi.checkpointNum === 7, "parseCheckpointInfo: checkpoint number");
  assertTrue(cpi.hitCount === 3, "parseCheckpointInfo: hit count");

  // parseDisplayGet: synthesised body with a deliberately non-13 infoLen,
  // proving the buffer-length/pixel-buffer offsets are derived, not hardcoded.
  const infoLen = 20;
  const dw = 384;
  const dh = 272;
  const xo = 1;
  const yo = 2;
  const iw = 320;
  const ih = 200;
  const bpp = 8;
  const pixelData = Buffer.from([0x11, 0x22, 0x33]);
  const dispBody = Buffer.alloc(4 + infoLen + 4 + pixelData.length);
  dispBody.writeUInt32LE(infoLen, 0);
  dispBody.writeUInt16LE(dw, 4);
  dispBody.writeUInt16LE(dh, 6);
  dispBody.writeUInt16LE(xo, 8);
  dispBody.writeUInt16LE(yo, 10);
  dispBody.writeUInt16LE(iw, 12);
  dispBody.writeUInt16LE(ih, 14);
  dispBody[16] = bpp;
  dispBody.writeUInt32LE(pixelData.length, 4 + infoLen);
  pixelData.copy(dispBody, 4 + infoLen + 4);
  const disp = parseDisplayGet(dispBody);
  assertTrue(
    disp.dw === dw && disp.dh === dh && disp.xo === xo && disp.yo === yo && disp.iw === iw &&
      disp.ih === ih && disp.bpp === bpp,
    "parseDisplayGet: geometry fields with a non-13 infoLen",
  );
  assertTrue(disp.buflen === pixelData.length, "parseDisplayGet: buflen derived from infoLen");
  assertTrue(disp.buffer.equals(pixelData), "parseDisplayGet: pixel buffer located correctly");

  // --- Plan 13-03: --probe-assumptions builders/parsers (no socket) -------

  // advanceInstructionsBody: layout, stepOver flag, and the count-range throw guard.
  const adv1 = advanceInstructionsBody({ stepOver: true, count: 1 });
  assertTrue(adv1.length === 3, "advanceInstructionsBody: exactly 3 bytes");
  assertTrue(adv1[0] === 0x01, "advanceInstructionsBody: stepOver=true encodes as 0x01");
  assertTrue(adv1.readUInt16LE(1) === 1, "advanceInstructionsBody: count u16LE at offset 1");
  const adv0 = advanceInstructionsBody({ stepOver: false, count: 4 });
  assertTrue(adv0[0] === 0x00, "advanceInstructionsBody: stepOver=false encodes as 0x00");
  assertTrue(adv0.readUInt16LE(1) === 4, "advanceInstructionsBody: a count of 4 round-trips");
  let advThrew = false;
  try {
    advanceInstructionsBody({ count: 0 });
  } catch {
    advThrew = true;
  }
  assertTrue(advThrew, "advanceInstructionsBody: throws on count=0 (out of 1..0xffff)");

  // registersGetBody: single wire-memspace byte.
  const rgb0 = registersGetBody(0x00);
  assertTrue(rgb0.length === 1 && rgb0[0] === 0x00, "registersGetBody: single 0x00 byte for main memspace");
  const rgb1 = registersGetBody(0x01);
  assertTrue(rgb1[0] === 0x01, "registersGetBody: memspace byte round-trips for unit 8 (0x01)");

  // registersSetBody: header + per-item layout, itemSize always 3, and the
  // empty-items / out-of-range throw guards.
  const rsb = registersSetBody({ memspace: 0x00, items: [{ id: 0x21, value: 0x1234 }, { id: 0x22, value: 0x5678 }] });
  assertTrue(rsb[0] === 0x00, "registersSetBody: memspace byte at offset 0");
  assertTrue(rsb.readUInt16LE(1) === 2, "registersSetBody: item count u16LE at offset 1");
  assertTrue(rsb[3] === 3, "registersSetBody: first item's itemSize byte is always 3");
  assertTrue(rsb[4] === 0x21, "registersSetBody: first item's regId");
  assertTrue(rsb.readUInt16LE(5) === 0x1234, "registersSetBody: first item's value u16LE");
  assertTrue(rsb[7] === 3, "registersSetBody: second item's itemSize byte is always 3");
  assertTrue(rsb[8] === 0x22, "registersSetBody: second item's regId");
  assertTrue(rsb.readUInt16LE(9) === 0x5678, "registersSetBody: second item's value u16LE");
  let rsbEmptyThrew = false;
  try {
    registersSetBody({ items: [] });
  } catch {
    rsbEmptyThrew = true;
  }
  assertTrue(rsbEmptyThrew, "registersSetBody: throws on an empty items array");
  let rsbIdThrew = false;
  try {
    registersSetBody({ items: [{ id: 0x100, value: 0 }] });
  } catch {
    rsbIdThrew = true;
  }
  assertTrue(rsbIdThrew, "registersSetBody: throws on an out-of-range id");
  let rsbValueThrew = false;
  try {
    registersSetBody({ items: [{ id: 0, value: 0x10000 }] });
  } catch {
    rsbValueThrew = true;
  }
  assertTrue(rsbValueThrew, "registersSetBody: throws on an out-of-range value");

  // joyportSetBody: 4-byte layout and the port/value range throw guards.
  const jpb = joyportSetBody({ port: 1, value: 0x01 });
  assertTrue(jpb.length === 4, "joyportSetBody: exactly 4 bytes");
  assertTrue(jpb.readUInt16LE(0) === 1, "joyportSetBody: port u16LE at offset 0");
  assertTrue(jpb.readUInt16LE(2) === 0x01, "joyportSetBody: value u16LE at offset 2");
  let jpbThrew = false;
  try {
    joyportSetBody({ port: -1, value: 0 });
  } catch {
    jpbThrew = true;
  }
  assertTrue(jpbThrew, "joyportSetBody: throws on an out-of-range port");

  // autostartBody: layout, and the fileIndex/filename validation guards.
  const asb = autostartBody({ runAfter: false, fileIndex: 1, filename: "PROBE.D64" });
  assertTrue(asb[0] === 0x00, "autostartBody: runAfter=false encodes as 0x00");
  assertTrue(asb.readUInt16LE(1) === 1, "autostartBody: fileIndex u16LE at offset 1");
  assertTrue(asb[3] === "PROBE.D64".length, "autostartBody: filenameLen byte at offset 3");
  assertTrue(asb.subarray(4).toString("ascii") === "PROBE.D64", "autostartBody: ascii filename from offset 4");
  const asbRun = autostartBody({ runAfter: true, filename: "X" });
  assertTrue(asbRun[0] === 0x01, "autostartBody: runAfter=true encodes as 0x01");
  assertTrue(asbRun.readUInt16LE(1) === 0, "autostartBody: fileIndex defaults to 0");
  let asbAsciiThrew = false;
  try {
    autostartBody({ runAfter: false, filename: "café.d64" });
  } catch {
    asbAsciiThrew = true;
  }
  assertTrue(asbAsciiThrew, "autostartBody: throws on a non-ASCII-representable filename");
  let asbLenThrew = false;
  try {
    autostartBody({ runAfter: false, filename: "x".repeat(256) });
  } catch {
    asbLenThrew = true;
  }
  assertTrue(asbLenThrew, "autostartBody: throws on a filename exceeding 255 bytes");

  // parseRegisterInfo: two items, the SECOND with a declared itemSize larger
  // than the 3-byte minimum (2 padding bytes) -- proving the stride comes
  // from the wire's own itemSize byte, not a fixed 4.
  {
    const b = Buffer.alloc(2 + 4 + 6);
    b.writeUInt16LE(2, 0); // count
    b[2] = 3; // item1 itemSize (minimum: regId+value)
    b[3] = 0x21; // item1 regId
    b.writeUInt16LE(0x1234, 4); // item1 value
    b[6] = 5; // item2 itemSize (padded: regId+value+2 unused bytes)
    b[7] = 0x22; // item2 regId
    b.writeUInt16LE(0x5678, 8); // item2 value
    b[10] = 0xff; // padding byte 1 (must be skipped, not misread as a third item)
    b[11] = 0xff; // padding byte 2
    const regs = parseRegisterInfo(b);
    assertTrue(regs.length === 2, "parseRegisterInfo: two items parsed despite a padded second itemSize");
    assertTrue(regs[0].id === 0x21 && regs[0].value === 0x1234, "parseRegisterInfo: first item fields");
    assertTrue(regs[1].id === 0x22 && regs[1].value === 0x5678, "parseRegisterInfo: second item fields, located past the padded first item via its own itemSize");
  }

  // parseRegistersAvailable: two items, the SECOND with a declared itemSize
  // larger than its own name-implied minimum (2 padding bytes) -- same
  // wire-stride proof as above, for the four-field item shape.
  {
    const b = Buffer.alloc(2 + 5 + 8);
    b.writeUInt16LE(2, 0); // count
    b[2] = 4; // item1 itemSize (id+size+nameLength+1-byte name = 4)
    b[3] = 0x10; // item1 id
    b[4] = 1; // item1 size
    b[5] = 1; // item1 nameLength
    b[6] = "A".charCodeAt(0); // item1 name
    b[7] = 7; // item2 itemSize (id+size+nameLength+2-byte name=5, +2 padding=7)
    b[8] = 0x11; // item2 id
    b[9] = 2; // item2 size
    b[10] = 2; // item2 nameLength
    b[11] = "X".charCodeAt(0);
    b[12] = "Y".charCodeAt(0);
    b[13] = 0xff; // padding byte 1
    b[14] = 0xff; // padding byte 2
    const regs = parseRegistersAvailable(b);
    assertTrue(regs.length === 2, "parseRegistersAvailable: two items parsed despite a padded second itemSize");
    assertTrue(regs[0].id === 0x10 && regs[0].size === 1 && regs[0].name === "A", "parseRegistersAvailable: first item fields");
    assertTrue(
      regs[1].id === 0x11 && regs[1].size === 2 && regs[1].name === "XY",
      "parseRegistersAvailable: second item fields, located past the padded first item via its own itemSize, name unaffected by trailing padding",
    );
  }

  // parseTarget(): still resolves host/port correctly with --probe-assumptions
  // present, bare or with an inline comma-separated case list -- proving the
  // new flag needed NO change to the existing --capture/--capture-out
  // consumed-index tracking, because it never takes a SEPARATE positional
  // argument (any case list is embedded via `=` in the same argv token,
  // which the existing `!a.startsWith("--")` filter already excludes).
  {
    const savedArgv = process.argv;
    try {
      process.argv = [savedArgv[0], savedArgv[1], "127.0.0.1", "6502", "--probe-assumptions"];
      const t1 = parseTarget();
      assertTrue(t1.host === "127.0.0.1" && t1.port === 6502, "parseTarget: resolves host/port with bare --probe-assumptions present");

      process.argv = [savedArgv[0], savedArgv[1], "127.0.0.1", "6502", "--probe-assumptions=A1,A3"];
      const t2 = parseTarget();
      assertTrue(t2.host === "127.0.0.1" && t2.port === 6502, "parseTarget: resolves host/port with --probe-assumptions=<list> present");
    } finally {
      process.argv = savedArgv;
    }
  }

  // --- --capture mode selftest additions (no socket, no emulator) ---------

  // (a) WR-11: the REAL sidecar builder -- buildSidecar(), the same function
  // runCapture() writes with -- emits exactly the four required provenance keys
  // plus the explicit `synthetic` provenance flag (07-REVIEW.md WR-09), with
  // the case's own recorded command. The previous version of this check built
  // an object literal with those keys and asserted the literal had them,
  // exercising nothing while its message claimed to cover the builder.
  const builtSidecar = buildSidecar({
    capturedFrom: "stock:/usr/bin/x64sc",
    viceVersion: "3.9.0.0",
    caseName: "display-get",
    now: () => new Date("2026-08-13T00:00:00.000Z"),
  });
  const sidecarKeys = Object.keys(builtSidecar);
  assertTrue(
    sidecarKeys.length === 5 &&
      ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"].every((k) => sidecarKeys.includes(k)),
    "buildSidecar: exactly the four required provenance keys plus the explicit synthetic flag, and no others",
  );
  assertTrue(
    builtSidecar.synthetic === false,
    "buildSidecar (WR-09): synthetic is STATED as false -- a live capture must never leave provenance to be defaulted by the loader",
  );
  assertTrue(builtSidecar.command === CAPTURE_COMMAND_BY_CASE["display-get"], "buildSidecar: command comes from the case's own recorded command string");
  assertTrue(builtSidecar.capturedAt === "2026-08-13T00:00:00.000Z", "buildSidecar: capturedAt is an ISO timestamp from the injected clock");

  // (a2) WR-11: a case with no recorded command is IMPOSSIBLE to write, rather
  // than producing `command: undefined` -- which survives JSON.stringify and
  // then fails loadCapturedFixture()'s required-key check much later, in
  // another process, against a .bin that looks fine.
  let sidecarThrew = false;
  try {
    buildSidecar({ capturedFrom: "stock:/usr/bin/x64sc", viceVersion: "3.9.0.0", caseName: "no-such-case" });
  } catch {
    sidecarThrew = true;
  }
  assertTrue(sidecarThrew, "buildSidecar: an unknown case name is refused, never written with an undefined command");

  let emptySourceThrew = false;
  try {
    buildSidecar({ capturedFrom: "", viceVersion: "3.9.0.0", caseName: "display-get" });
  } catch {
    emptySourceThrew = true;
  }
  assertTrue(emptySourceThrew, "buildSidecar: an empty capturedFrom is refused -- provenance that cannot name its source is not provenance");

  assertTrue(
    Object.keys(CAPTURE_COMMAND_BY_CASE).every((c) => typeof buildSidecar({ capturedFrom: "x:y", viceVersion: "z", caseName: c }).command === "string"),
    "buildSidecar: every capture case this script can run has a recorded command string",
  );

  // (a3) WR-10: the per-case version gate is a real, checkable table, not a
  // comment. The two CPUHISTORY_GET families must be mutually exclusive --
  // that is the whole point: their runners are byte-identical, so the
  // connected build is the only thing distinguishing them, and `--capture all`
  // must never satisfy both from one target.
  assertTrue(
    Object.keys(CAPTURE_REQUIRES_VERSION).every((c) => CAPTURE_CASES.includes(c)),
    "CAPTURE_REQUIRES_VERSION: every gated case name is a real capture case",
  );
  assertTrue(
    CAPTURE_REQUIRES_VERSION["cpuhistory-get"].pattern.test("3.10.0.0") &&
      CAPTURE_REQUIRES_VERSION["cpuhistory-get"].pattern.test("3.11.0.0") &&
      !CAPTURE_REQUIRES_VERSION["cpuhistory-get"].pattern.test("3.9.0.0") &&
      !CAPTURE_REQUIRES_VERSION["cpuhistory-get"].pattern.test("unknown"),
    "CAPTURE_REQUIRES_VERSION: cpuhistory-get accepts >= 3.10 only, and never an unknown version",
  );
  assertTrue(
    CAPTURE_REQUIRES_VERSION["cpuhistory-get-unsupported"].pattern.test("3.9.0.0") &&
      !CAPTURE_REQUIRES_VERSION["cpuhistory-get-unsupported"].pattern.test("3.10.0.0") &&
      !CAPTURE_REQUIRES_VERSION["cpuhistory-get-unsupported"].pattern.test("unknown"),
    "CAPTURE_REQUIRES_VERSION: cpuhistory-get-unsupported accepts 3.9 only -- a 3.10 target must not overwrite it",
  );
  assertTrue(
    ["3.9.0.0", "3.10.0.0", "3.11.0.0", "unknown"].every(
      (v) => !(CAPTURE_REQUIRES_VERSION["cpuhistory-get"].pattern.test(v) && CAPTURE_REQUIRES_VERSION["cpuhistory-get-unsupported"].pattern.test(v)),
    ),
    "CAPTURE_REQUIRES_VERSION: no single build can satisfy both mutually-exclusive CPUHISTORY_GET cases",
  );

  // Local, offline-only response-frame builder for the two checks below --
  // deliberately not exported, and not the same code path as
  // binmon-fixtures.ts's encodeResponseFrame() (a separate module this
  // plain-JS script must not import), but the same 12-byte layout.
  const buildResponseFrame = (respType, errCode, reqId, body) => {
    const header = Buffer.alloc(12);
    header[0] = STX;
    header[1] = API;
    header.writeUInt32LE(body.length, 2);
    header[6] = respType;
    header[7] = errCode;
    header.writeUInt32LE(reqId >>> 0, 8);
    return Buffer.concat([header, body]);
  };

  // (b) the frame-dump serializer round-trips through the EXISTING _onData()
  // framing loop: feed a synthesised two-frame stream through a stub-socket
  // BinMon and confirm onFrame fires once per reassembled frame, verbatim.
  {
    const stubSocket = { on() {}, write() {} };
    const mon = new BinMon(stubSocket);
    const captured = [];
    mon.onFrame = (frame) => captured.push(frame);
    const r1 = buildResponseFrame(0x62, 0x00, EVENT_ID, Buffer.from([0x01, 0x02])); // STOPPED-shaped
    const r2 = buildResponseFrame(0x81, 0x00, 7, Buffer.alloc(0)); // a plain reply
    mon._onData(Buffer.concat([r1, r2]));
    assertTrue(captured.length === 2, "capture selftest: onFrame fires once per reassembled frame");
    assertTrue(captured[0].equals(r1), "capture selftest: first captured frame matches byte-for-byte");
    assertTrue(captured[1].equals(r2), "capture selftest: second captured frame matches byte-for-byte");
  }

  // (c) the MAX_CAPTURE_FRAMES cap aborts rather than looping: feed more
  // frames than the cap through the same onFrame-guard logic runCapture()
  // uses and confirm collection stops exactly at the cap with abort set.
  {
    const stubSocket = { on() {}, write() {} };
    const mon = new BinMon(stubSocket);
    const frames = [];
    let aborted = false;
    mon.onFrame = (frame) => {
      if (frames.length >= MAX_CAPTURE_FRAMES) {
        aborted = true;
        return;
      }
      frames.push(frame);
      if (frames.length >= MAX_CAPTURE_FRAMES) aborted = true;
    };
    const many = Buffer.concat(
      Array.from({ length: MAX_CAPTURE_FRAMES + 5 }, (_, i) => buildResponseFrame(0x81, 0x00, i + 1, Buffer.alloc(0))),
    );
    mon._onData(many);
    assertTrue(aborted, "capture selftest: MAX_CAPTURE_FRAMES cap trips the abort flag rather than looping forever");
    assertTrue(
      frames.length === MAX_CAPTURE_FRAMES,
      `capture selftest: frame collection stops exactly at the cap (got ${frames.length})`,
    );
  }
}

// Shared by main() and --capture's runCapture(): connect a raw TCP socket to
// the binary monitor, with a bounded connect timeout. Lifted out of main()
// unchanged so there is exactly one connect implementation, not two.
function connectSocket(host, port) {
  return new Promise((resolve, reject) => {
    let connectTimer = null;
    const s = net.createConnection({ host, port }, () => {
      if (connectTimer) clearTimeout(connectTimer);
      resolve(s);
    });
    s.on("error", (err) => {
      if (connectTimer) clearTimeout(connectTimer);
      s.destroy();
      reject(err);
    });
    // Tear the socket down before rejecting: callers exit (or move to the
    // next case) immediately after a failed connect, but a dangling socket
    // plus its retained "error" listener would leak otherwise.
    connectTimer = setTimeout(() => {
      s.destroy();
      reject(new Error("connect timeout"));
    }, 4000);
  });
}

// ---------------------------------------------------------------------------
// --probe-assumptions mode (Phase 13 plan 03): one live check per Phase 3
// wire assumption -- A1 (-remotemonitoraddress binding), A2
// (ADVANCE_INSTRUCTIONS step-over semantics), A3 (JOYPORT_SET bit mapping),
// A5 (AUTOSTART fileIndex with the run flag clear). Each probe returns a
// three-valued verdict (CONFIRMED/CONTRADICTED/INCONCLUSIVE) with the raw
// observation it rests on, and cleans up whatever it changed in a `finally`.
//
// A4 is OUT OF SCOPE, deliberately, in every probe in this file. A4 needs a
// non-stopping checkpoint armed on a hot, frequently-executed address, and
// CLAUDE.md's own Protocol constraint records that a non-stopping
// checkpoint's CHECKPOINT_INFO hit frame is emitted SYNCHRONOUSLY, over the
// blocking socket, from inside the emulator's CPU loop
// (mon_breakpoint.c:557-562) -- on a hot address this can stall the emulator
// thread. No function below sends CHECKPOINT_SET at all.
// ---------------------------------------------------------------------------

export const PROBE_ASSUMPTION_CASES = ["A1", "A2", "A3", "A5"];

// Wire-shape gate, applied by every probe below before its behavioural half:
// these three error codes mean the assumed BODY LAYOUT itself is wrong --
// CONTRADICTED before the semantic question is even reachable. An ACCEPTED
// body is necessary but never sufficient for a runtime-behaviour claim (A2,
// A3) -- each of those two carries a separate recorded behavioural
// observation the verdict actually rests on.
const WIRE_SHAPE_REJECT_CODES = new Set([0x80, 0x81, 0x83]);

function errName(code) {
  return ERR_NAME[code] || `0x${code.toString(16)}`;
}

function wireShapeAccepted(errCode) {
  return !WIRE_SHAPE_REJECT_CODES.has(errCode);
}

function printProbeRecord(rec) {
  console.log(`\n--- ${rec.id} ---`);
  for (const r of rec.requests) {
    console.log(`  request: ${r.label} -> ${r.errName}`);
  }
  console.log(`  observation:\n    ${rec.observation.split("\n").join("\n    ")}`);
  console.log(`  verdict: ${rec.verdict}`);
}

// ---- A1: -remotemonitoraddress binding -------------------------------------

async function probeA1RemoteMonitorPort({ host = "127.0.0.1", port = 6510, windowMs = 500 } = {}) {
  const requests = [{ label: `plain TCP connect ${host}:${port}`, errName: "N/A (plain TCP, not a binmon frame)" }];
  let socket = null;
  try {
    socket = await connectSocket(host, port);
    let bannerBytes = Buffer.alloc(0);
    const onData = (chunk) => {
      bannerBytes = Buffer.concat([bannerBytes, chunk]);
    };
    socket.on("data", onData);
    await sleep(windowMs);
    socket.removeListener("data", onData);
    const hasBanner = bannerBytes.length > 0;
    const observation =
      `connection to ${host}:${port} was ACCEPTED. ` +
      (hasBanner
        ? `${bannerBytes.length} banner byte(s) arrived within ${windowMs}ms: ${bannerBytes.toString("hex")}`
        : `no banner bytes arrived within ${windowMs}ms -- still a bound, accepting listener (an accepted connection with no banner is not downgraded from CONFIRMED)`);
    return { id: "A1", requests, observation, verdict: "CONFIRMED" };
  } catch (e) {
    return {
      id: "A1",
      requests,
      observation: `connection attempt to ${host}:${port} FAILED: ${e.message} -- the port did not accept a connection`,
      verdict: "CONTRADICTED",
    };
  } finally {
    if (socket) {
      try {
        socket.end();
        socket.destroy();
      } catch {
        /* ignore -- probe result is already recorded */
      }
    }
  }
}

// ---- A2: ADVANCE_INSTRUCTIONS step-over semantics --------------------------

const A2_JSR_ADDR = 0xc000; // free RAM under the default C64 memory map
const A2_SUB_ADDR = 0xc010;
const A2_FILLER_BYTE = 0xea; // NOP -- distinguishable filler after the JSR

async function probeA2StepOver(mon) {
  const requests = [];
  let originalJsrBytes = null;
  let originalSubByte = null;
  let originalPc = null;
  let pcRegId = null;

  try {
    // Halt the machine on demand -- per docs/phase0-binmon-findings.md §4,
    // "any inbound byte halts the machine" (monitor_check_binary() calls
    // monitor_startup_trap() every vsync). A bare PING is enough; no
    // checkpoint of any kind is armed. Register writes only stick with the
    // machine stopped, so this probe must observe a real halt before
    // touching PC -- if it cannot, it records INCONCLUSIVE rather than
    // working around it with a checkpoint.
    const beforePing = mon.events.length;
    const pingR = await mon.send(CMD.PING);
    requests.push({ label: "PING (halt-on-demand)", errName: errName(pingR.errCode) });
    await sleep(300);
    const sinceHalt = mon.events.slice(beforePing).map((e) => e.name);
    const haltedReliably =
      sinceHalt.includes("STOPPED") && sinceHalt.lastIndexOf("STOPPED") > sinceHalt.lastIndexOf("RESUMED");
    if (!haltedReliably) {
      return {
        id: "A2",
        requests,
        observation: `PING did not produce an observed halt within 300ms (events since PING: [${sinceHalt.join(", ") || "none"}]) -- register writes are not confirmed to stick without a reliable halt, and this probe will not arm a checkpoint to force one`,
        verdict: "INCONCLUSIVE",
      };
    }

    // Discover the PC register id -- never hardcoded.
    const availR = await mon.send(CMD.REGISTERS_AVAILABLE, Buffer.from([0x00]));
    requests.push({ label: "REGISTERS_AVAILABLE memspace=0x00", errName: errName(availR.errCode) });
    if (!wireShapeAccepted(availR.errCode)) {
      return {
        id: "A2",
        requests,
        observation: `REGISTERS_AVAILABLE was rejected (${errName(availR.errCode)}) -- cannot discover the PC register id`,
        verdict: "CONTRADICTED",
      };
    }
    const availableRegs = parseRegistersAvailable(availR.body);
    const pcReg = availableRegs.find((r) => r.name.toUpperCase() === "PC");
    if (!pcReg) {
      return {
        id: "A2",
        requests,
        observation: `REGISTERS_AVAILABLE returned no register named "PC" (names seen: ${availableRegs.map((r) => r.name).join(", ")})`,
        verdict: "INCONCLUSIVE",
      };
    }
    pcRegId = pcReg.id;

    // Snapshot original PC and the scratch memory bytes for restoration.
    const pcBeforeR = await mon.send(CMD.REGISTERS_GET, registersGetBody(0x00));
    requests.push({ label: "REGISTERS_GET memspace=0x00 (baseline PC)", errName: errName(pcBeforeR.errCode) });
    const pcBeforeEntry = parseRegisterInfo(pcBeforeR.body).find((r) => r.id === pcRegId);
    originalPc = pcBeforeEntry ? pcBeforeEntry.value : null;

    const jsrBeforeR = await mon.send(CMD.MEM_GET, memGetBody({ start: A2_JSR_ADDR, end: A2_JSR_ADDR + 3, memspace: 0x00 }));
    const jsrLen = jsrBeforeR.body.readUInt16LE(0);
    originalJsrBytes = Buffer.from(jsrBeforeR.body.subarray(2, 2 + jsrLen));
    const subBeforeR = await mon.send(CMD.MEM_GET, memGetBody({ start: A2_SUB_ADDR, end: A2_SUB_ADDR, memspace: 0x00 }));
    const subLen = subBeforeR.body.readUInt16LE(0);
    originalSubByte = Buffer.from(subBeforeR.body.subarray(2, 2 + subLen));

    // Write the deterministic subject: JSR $C010 + filler at $C000, RTS at
    // $C010. JSR is a three-byte instruction, so JSR_ADDR+3 is the address
    // immediately following it.
    const jsrBytes = Buffer.from([0x20, A2_SUB_ADDR & 0xff, (A2_SUB_ADDR >> 8) & 0xff, A2_FILLER_BYTE]);
    const setJsrR = await mon.send(CMD.MEM_SET, memSetBody({ start: A2_JSR_ADDR, end: A2_JSR_ADDR + 3, memspace: 0x00, data: jsrBytes }));
    requests.push({
      label: `MEM_SET $${A2_JSR_ADDR.toString(16)} (JSR $${A2_SUB_ADDR.toString(16)} + filler)`,
      errName: errName(setJsrR.errCode),
    });
    const setSubR = await mon.send(CMD.MEM_SET, memSetBody({ start: A2_SUB_ADDR, end: A2_SUB_ADDR, memspace: 0x00, data: Buffer.from([0x60]) }));
    requests.push({ label: `MEM_SET $${A2_SUB_ADDR.toString(16)} (RTS)`, errName: errName(setSubR.errCode) });
    if (!wireShapeAccepted(setJsrR.errCode) || !wireShapeAccepted(setSubR.errCode)) {
      return {
        id: "A2",
        requests,
        observation: "one of the scratch MEM_SET writes was rejected on wire-shape grounds",
        verdict: "CONTRADICTED",
      };
    }

    // Point PC at the JSR and step over it.
    const setPcR = await mon.send(CMD.REGISTERS_SET, registersSetBody({ memspace: 0x00, items: [{ id: pcRegId, value: A2_JSR_ADDR }] }));
    requests.push({ label: `REGISTERS_SET PC=$${A2_JSR_ADDR.toString(16)}`, errName: errName(setPcR.errCode) });
    if (!wireShapeAccepted(setPcR.errCode)) {
      return {
        id: "A2",
        requests,
        observation: `REGISTERS_SET was rejected (${errName(setPcR.errCode)}) -- cannot position PC at the JSR`,
        verdict: "CONTRADICTED",
      };
    }

    const stepR = await mon.send(CMD.ADVANCE_INSTRUCTIONS, advanceInstructionsBody({ stepOver: true, count: 1 }));
    requests.push({ label: "ADVANCE_INSTRUCTIONS stepOver=true count=1", errName: errName(stepR.errCode) });
    if (!wireShapeAccepted(stepR.errCode)) {
      return {
        id: "A2",
        requests,
        observation: `ADVANCE_INSTRUCTIONS was rejected (${errName(stepR.errCode)}) -- the stepOver body shape itself is wrong`,
        verdict: "CONTRADICTED",
      };
    }
    await sleep(300);

    const pcAfterR = await mon.send(CMD.REGISTERS_GET, registersGetBody(0x00));
    requests.push({ label: "REGISTERS_GET memspace=0x00 (post-step PC)", errName: errName(pcAfterR.errCode) });
    const pcAfterEntry = parseRegisterInfo(pcAfterR.body).find((r) => r.id === pcRegId);
    const postPc = pcAfterEntry ? pcAfterEntry.value : null;
    const expectedAfterJsr = A2_JSR_ADDR + 3;
    const postPcHex = postPc != null ? `$${postPc.toString(16)}` : "?";
    const preface =
      "an accepted REGISTERS_SET/ADVANCE_INSTRUCTIONS body was necessary but not sufficient by itself -- " +
      "the verdict rests on the post-step PC observation: " +
      `discovered PC register id=${pcRegId} ("${pcReg.name}"), JSR at $${A2_JSR_ADDR.toString(16)}, ` +
      `expected post-step PC = JSR+3 = $${expectedAfterJsr.toString(16)}, observed post-step PC = ${postPcHex}`;

    let verdict;
    let observation;
    if (postPc === expectedAfterJsr) {
      verdict = "CONFIRMED";
      observation = `${preface} -- MATCH: stepOver=true skipped the subroutine as one step`;
    } else if (postPc === A2_SUB_ADDR) {
      verdict = "CONTRADICTED";
      observation = `${preface} (the subroutine's OWN address) -- stepOver=true behaved like a plain single step, NOT a step-over`;
    } else {
      verdict = "INCONCLUSIVE";
      observation = `${preface} -- neither the step-over nor the plain-step landing address; the observation does not resolve the assumption`;
    }
    return { id: "A2", requests, observation, verdict };
  } catch (e) {
    return { id: "A2", requests, observation: `probe threw: ${e.message}`, verdict: "INCONCLUSIVE" };
  } finally {
    // Restore the scratch bytes and PC, then resume the machine -- this
    // probe halted it via PING above and nothing else in this file resumes
    // it on A2's behalf.
    try {
      if (originalJsrBytes) {
        await mon.send(
          CMD.MEM_SET,
          memSetBody({ start: A2_JSR_ADDR, end: A2_JSR_ADDR + originalJsrBytes.length - 1, memspace: 0x00, data: originalJsrBytes }),
        );
      }
      if (originalSubByte) {
        await mon.send(
          CMD.MEM_SET,
          memSetBody({ start: A2_SUB_ADDR, end: A2_SUB_ADDR + originalSubByte.length - 1, memspace: 0x00, data: originalSubByte }),
        );
      }
      if (pcRegId !== null && originalPc !== null) {
        await mon.send(CMD.REGISTERS_SET, registersSetBody({ memspace: 0x00, items: [{ id: pcRegId, value: originalPc }] }));
      }
    } catch {
      console.log("    (A2 cleanup: could not fully restore scratch bytes/PC -- relaunch the emulator before trusting later probes)");
    }
    try {
      await mon.send(CMD.EXIT);
    } catch {
      /* ignore -- may already be running, or the connection may be unresponsive */
    }
  }
}

// ---- A3: JOYPORT_SET bit mapping --------------------------------------------

const ASSUMED_JOYPORT_BITS = { up: 0x01, down: 0x02, left: 0x04, right: 0x08, fire: 0x10 };
const A3_ORDER = ["up", "down", "left", "right", "fire"];
// Fixed for every round -- the assumption does not state which PHYSICAL port
// this wire value maps to; reading both $DC00 (joystick 2 on real hardware)
// and $DC01 (joystick 1) every round is what answers that question too.
const A3_PORT = 1;

async function readCia1Ports(mon) {
  const r = await mon.send(CMD.MEM_GET, memGetBody({ sidefx: 0, start: 0xdc00, end: 0xdc01, memspace: 0x00 }));
  const len = r.body.readUInt16LE(0);
  const data = r.body.subarray(2, 2 + len);
  return { dc00: data[0], dc01: data.length > 1 ? data[1] : null };
}

async function probeA3JoyportBits(mon) {
  const requests = [];
  const rounds = [];
  let wireShapeContradicted = false;
  try {
    for (const name of A3_ORDER) {
      const bit = ASSUMED_JOYPORT_BITS[name];
      const before = await readCia1Ports(mon);
      const setR = await mon.send(CMD.JOYPORT_SET, joyportSetBody({ port: A3_PORT, value: bit }));
      requests.push({
        label: `JOYPORT_SET port=${A3_PORT} value=0x${bit.toString(16).padStart(2, "0")} (${name})`,
        errName: errName(setR.errCode),
      });
      if (!wireShapeAccepted(setR.errCode)) wireShapeContradicted = true;
      const after = await readCia1Ports(mon);
      await mon.send(CMD.JOYPORT_SET, joyportSetBody({ port: A3_PORT, value: 0x00 })); // release before the next round
      rounds.push({ name, bit, dc00Before: before.dc00, dc00After: after.dc00, dc01Before: before.dc01, dc01After: after.dc01 });
    }
  } catch (e) {
    return { id: "A3", requests, observation: `probe threw: ${e.message}`, verdict: "INCONCLUSIVE" };
  } finally {
    try {
      await mon.send(CMD.JOYPORT_SET, joyportSetBody({ port: A3_PORT, value: 0x00 }));
    } catch {
      /* ignore -- best-effort release */
    }
  }

  const fmtByte = (v) => (v != null ? v.toString(16).padStart(2, "0") : "?");
  const observationLines = rounds.map(
    (r) =>
      `${r.name} (bit 0x${r.bit.toString(16).padStart(2, "0")}): $DC00 ${fmtByte(r.dc00Before)} -> ${fmtByte(r.dc00After)}; ` +
      `$DC01 ${fmtByte(r.dc01Before)} -> ${fmtByte(r.dc01After)}`,
  );
  let observation = `port=${A3_PORT} fixed across all five rounds; per-round CIA1 port bytes:\n${observationLines.join("\n")}`;

  if (wireShapeContradicted) {
    return { id: "A3", requests, observation, verdict: "CONTRADICTED" };
  }

  const anyDelta = rounds.some((r) => r.dc00Before !== r.dc00After || r.dc01Before !== r.dc01After);
  if (!anyDelta) {
    observation += "\nno single-bit write produced any observable delta in either port byte -- INCONCLUSIVE (keyboard-matrix multiplexing on CIA1 port B can cause this)";
    return { id: "A3", requests, observation, verdict: "INCONCLUSIVE" };
  }

  // Real joystick lines are active-LOW: a driven direction is expected to
  // CLEAR the corresponding bit, not set one. Compare the assumed mapping's
  // bit position against whichever port byte actually changed, checking for
  // a clear transition rather than assuming polarity.
  let allMatchAssumedClearing = true;
  const polarityNotes = [];
  for (const r of rounds) {
    const clearedInDc00 = (r.dc00Before & r.bit) !== 0 && (r.dc00After & r.bit) === 0;
    const clearedInDc01 = r.dc01Before != null && (r.dc01Before & r.bit) !== 0 && (r.dc01After & r.bit) === 0;
    const setInDc00 = (r.dc00Before & r.bit) === 0 && (r.dc00After & r.bit) !== 0;
    const setInDc01 = r.dc01Before != null && (r.dc01Before & r.bit) === 0 && (r.dc01After & r.bit) !== 0;
    if (clearedInDc00 || clearedInDc01) {
      polarityNotes.push(`${r.name}: bit cleared in ${clearedInDc00 ? "$DC00" : "$DC01"} -- matches active-LOW expectation and the assumed bit position`);
    } else if (setInDc00 || setInDc01) {
      polarityNotes.push(`${r.name}: bit SET (not cleared) in ${setInDc00 ? "$DC00" : "$DC01"} -- polarity does not match the active-LOW expectation`);
      allMatchAssumedClearing = false;
    } else {
      polarityNotes.push(`${r.name}: assumed bit 0x${r.bit.toString(16)} shows no clean set/clear transition in either port byte at this position`);
      allMatchAssumedClearing = false;
    }
  }
  observation += `\n${polarityNotes.join("\n")}`;
  const verdict = allMatchAssumedClearing ? "CONFIRMED" : "CONTRADICTED";
  return { id: "A3", requests, observation, verdict };
}

// ---- A5: AUTOSTART fileIndex with the run flag clear ------------------------

const A5_SENTINEL_ADDR = 0x0801; // start of the default unexpanded BASIC program area
const A5_SENTINEL_BYTES = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
const A5_ZP_PTR_ADDR = 0x002b; // BASIC TXTTAB pointer (start of BASIC text), 2 bytes LE

function checkCommandAvailable(cmd) {
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

// Builds a scratch multi-file disk image via c1541 in a process-owned
// temporary directory. Two distinct programs so fileIndex 0 and 1 are
// distinguishable, per the acceptance criterion this probe answers.
function buildA5ScratchImage() {
  const dir = mkdtempSync(join(tmpdir(), "probe-a5-"));
  const imagePath = join(dir, "probe.d64");
  const prg1Path = join(dir, "prog1.prg");
  const prg2Path = join(dir, "prog2.prg");
  writeFileSync(prg1Path, Buffer.from([0x01, 0x08, 0x11, 0x11, 0x11, 0x11]));
  writeFileSync(prg2Path, Buffer.from([0x01, 0x08, 0x22, 0x22, 0x22, 0x22]));
  const fmt = spawnSync("c1541", ["-format", "PROBE,00", "d64", imagePath], { encoding: "utf8" });
  if (fmt.status !== 0) throw new Error(`c1541 -format failed: ${fmt.stderr || fmt.stdout}`);
  const w1 = spawnSync("c1541", [imagePath, "-write", prg1Path, "PROG1"], { encoding: "utf8" });
  if (w1.status !== 0) throw new Error(`c1541 -write PROG1 failed: ${w1.stderr || w1.stdout}`);
  const w2 = spawnSync("c1541", [imagePath, "-write", prg2Path, "PROG2"], { encoding: "utf8" });
  if (w2.status !== 0) throw new Error(`c1541 -write PROG2 failed: ${w2.stderr || w2.stdout}`);
  return { dir, imagePath };
}

async function probeA5AutostartFileIndex(mon) {
  const requests = [];
  if (!checkCommandAvailable("c1541")) {
    return {
      id: "A5",
      requests,
      observation:
        "c1541 is not available on PATH -- cannot build the scratch multi-file disk image this probe needs; recorded INCONCLUSIVE rather than silently skipped",
      verdict: "INCONCLUSIVE",
    };
  }

  let scratch = null;
  const trials = [];
  let wireShapeContradicted = false;
  try {
    scratch = buildA5ScratchImage();

    // Discover the PC register id once, reused for both trials -- used only
    // for a reset-side-effect HEURISTIC below, not a definitive detector.
    const availR = await mon.send(CMD.REGISTERS_AVAILABLE, Buffer.from([0x00]));
    const availableRegs = parseRegistersAvailable(availR.body);
    const pcReg = availableRegs.find((r) => r.name.toUpperCase() === "PC");

    for (const fileIndex of [0, 1]) {
      await mon.send(
        CMD.MEM_SET,
        memSetBody({ start: A5_SENTINEL_ADDR, end: A5_SENTINEL_ADDR + A5_SENTINEL_BYTES.length - 1, memspace: 0x00, data: A5_SENTINEL_BYTES }),
      );
      const zpBeforeR = await mon.send(CMD.MEM_GET, memGetBody({ start: A5_ZP_PTR_ADDR, end: A5_ZP_PTR_ADDR + 1, memspace: 0x00 }));
      const zpBeforeLen = zpBeforeR.body.readUInt16LE(0);
      const zpBefore = Buffer.from(zpBeforeR.body.subarray(2, 2 + zpBeforeLen));
      let pcBefore = null;
      if (pcReg) {
        const pcBeforeR = await mon.send(CMD.REGISTERS_GET, registersGetBody(0x00));
        const entry = parseRegisterInfo(pcBeforeR.body).find((r) => r.id === pcReg.id);
        pcBefore = entry ? entry.value : null;
      }

      const autostartR = await mon.send(CMD.AUTOSTART, autostartBody({ runAfter: false, fileIndex, filename: scratch.imagePath }));
      requests.push({
        label: `AUTOSTART runAfter=false fileIndex=${fileIndex} filename=${scratch.imagePath}`,
        errName: errName(autostartR.errCode),
      });
      if (!wireShapeAccepted(autostartR.errCode)) wireShapeContradicted = true;
      await sleep(700);

      const sentinelR = await mon.send(
        CMD.MEM_GET,
        memGetBody({ start: A5_SENTINEL_ADDR, end: A5_SENTINEL_ADDR + A5_SENTINEL_BYTES.length - 1, memspace: 0x00 }),
      );
      const sentinelLen = sentinelR.body.readUInt16LE(0);
      const sentinelAfter = Buffer.from(sentinelR.body.subarray(2, 2 + sentinelLen));
      const zpAfterR = await mon.send(CMD.MEM_GET, memGetBody({ start: A5_ZP_PTR_ADDR, end: A5_ZP_PTR_ADDR + 1, memspace: 0x00 }));
      const zpAfterLen = zpAfterR.body.readUInt16LE(0);
      const zpAfter = Buffer.from(zpAfterR.body.subarray(2, 2 + zpAfterLen));
      let pcAfter = null;
      if (pcReg) {
        const pcAfterR = await mon.send(CMD.REGISTERS_GET, registersGetBody(0x00));
        const entry = parseRegisterInfo(pcAfterR.body).find((r) => r.id === pcReg.id);
        pcAfter = entry ? entry.value : null;
      }

      const sentinelSurvived = sentinelAfter.equals(A5_SENTINEL_BYTES);
      const pointersMoved = !zpAfter.equals(zpBefore);
      // Heuristic only, reported as an observation and never as a certainty:
      // a post-call PC landing at the hardware RESET vector target ($FCE2)
      // or in the very low page is treated as "the machine appears to have
      // reset".
      const looksReset = pcAfter != null && pcBefore != null && pcAfter !== pcBefore && (pcAfter === 0xfce2 || pcAfter < 0x0100);

      trials.push({ fileIndex, sentinelSurvived, pointersMoved, zpBefore, zpAfter, pcBefore, pcAfter, looksReset });
    }
  } catch (e) {
    return { id: "A5", requests, observation: `probe threw: ${e.message}`, verdict: "INCONCLUSIVE" };
  } finally {
    if (scratch) {
      try {
        rmSync(scratch.dir, { recursive: true, force: true });
      } catch {
        /* ignore -- scratch dir is process-owned temp; leaking it is inert */
      }
    }
  }

  const observationLines = trials.map(
    (t) =>
      `fileIndex=${t.fileIndex}: sentinel ${t.sentinelSurvived ? "SURVIVED unchanged" : "CHANGED"}; ` +
      `zero-page pointer $${A5_ZP_PTR_ADDR.toString(16)} before=${t.zpBefore.toString("hex")} after=${t.zpAfter.toString("hex")} (${t.pointersMoved ? "MOVED" : "unchanged"}); ` +
      `PC before=$${t.pcBefore != null ? t.pcBefore.toString(16) : "?"} after=$${t.pcAfter != null ? t.pcAfter.toString(16) : "?"} (reset-looking heuristic: ${t.looksReset})`,
  );
  const observation =
    "an accepted AUTOSTART body was necessary but not sufficient -- the verdict rests on whether the program area and zero-page pointers stayed untouched:\n" +
    observationLines.join("\n");

  let verdict;
  if (wireShapeContradicted) {
    verdict = "CONTRADICTED";
  } else {
    const anyLoaded = trials.some((t) => !t.sentinelSurvived || t.pointersMoved);
    verdict = anyLoaded ? "CONTRADICTED" : "CONFIRMED";
  }
  return { id: "A5", requests, observation, verdict };
}

// ---- dispatcher --------------------------------------------------------------

async function runAssumptionProbes(mon, { host = "127.0.0.1", remoteMonitorHost, remoteMonitorPort = 6510, cases = null } = {}) {
  const toRun = cases && cases.length ? cases.filter((c) => PROBE_ASSUMPTION_CASES.includes(c)) : PROBE_ASSUMPTION_CASES;
  const records = [];
  for (const c of toRun) {
    let record;
    if (c === "A1") record = await probeA1RemoteMonitorPort({ host: remoteMonitorHost || host, port: remoteMonitorPort });
    else if (c === "A2") record = await probeA2StepOver(mon);
    else if (c === "A3") record = await probeA3JoyportBits(mon);
    else if (c === "A5") record = await probeA5AutostartFileIndex(mon);
    else continue;
    printProbeRecord(record);
    records.push(record);
  }
  console.log("\n=== Probe-assumptions summary ===");
  for (const r of records) {
    console.log(`${r.id}: ${r.verdict}`);
  }
  return records;
}

async function main() {
  const { host, port } = parseTarget();
  console.log(`Connecting to VICE binary monitor at ${host}:${port} ...`);
  const socket = await connectSocket(host, port);
  console.log("Connected.\n");
  const mon = new BinMon(socket);
  const results = {};

  // 1. PING
  try {
    const r = await mon.send(CMD.PING);
    results.ping = r.errCode === 0x00;
    console.log(`1. PING            -> ${ERR_NAME[r.errCode] || r.errCode}`);
  } catch (e) {
    results.ping = false;
    console.log(`1. PING            -> FAILED (${e.message})`);
  }

  // 2. VICE_INFO (version + svn rev)
  try {
    const r = await mon.send(CMD.VICE_INFO);
    // body: [len][version bytes...][len][svn rev bytes...]
    let ver = "?";
    if (r.body.length >= 1) {
      const vlen = r.body[0];
      ver = Array.from(r.body.subarray(1, 1 + vlen)).join(".");
    }
    results.version = ver;
    console.log(`2. VICE_INFO       -> ${ERR_NAME[r.errCode] || r.errCode}, version ${ver}`);
  } catch (e) {
    console.log(`2. VICE_INFO       -> FAILED (${e.message})`);
  }

  // 3. REGISTERS_AVAILABLE (sanity; body = memspace)
  try {
    const r = await mon.send(CMD.REGISTERS_AVAILABLE, Buffer.from([0x00]));
    console.log(`3. REGS_AVAILABLE  -> ${ERR_NAME[r.errCode] || r.errCode} (body ${r.body.length}B)`);
  } catch (e) {
    console.log(`3. REGS_AVAILABLE  -> FAILED (${e.message})`);
  }

  // 4. CPUHISTORY_GET  == the cycle stopwatch test ==
  //    body: memspace(1)=0 + count(uint32)=1  -> newest entry
  const histBody = Buffer.alloc(5);
  histBody[0] = 0x00;
  histBody.writeUInt32LE(1, 1);
  try {
    const r1 = await mon.send(CMD.CPUHISTORY_GET, histBody);
    if (r1.errCode !== 0x00) {
      results.cpuHistory = false;
      console.log(
        `4. CPUHISTORY_GET  -> ${ERR_NAME[r1.errCode] || r1.errCode}  => CPU history NOT available in this build (no cycle stopwatch)`,
      );
    } else {
      const a = newestCycleFromHistory(r1.body);
      await sleep(300); // let the machine run ~300ms
      const r2 = await mon.send(CMD.CPUHISTORY_GET, histBody);
      const b = newestCycleFromHistory(r2.body);
      results.cpuHistory = a && a.count >= 1;
      const c1 = a && a.cycle != null ? a.cycle : null;
      const c2 = b && b.cycle != null ? b.cycle : null;
      console.log(`4. CPUHISTORY_GET  -> OK, entries=${a ? a.count : "?"}`);
      if (c1 != null && c2 != null) {
        const elapsed = c2 - c1;
        console.log(`   newest cycle: t0=${c1}  t1=${c2}  elapsed=${elapsed}`);
        console.log(
          elapsed > 0n
            ? "   => STOPWATCH WORKS: elapsed cycles are monotonic and measurable."
            : "   => history present but cycle did not advance (was the machine running?).",
        );
      } else {
        console.log(
          "   (cycle offset heuristic did not parse; raw entry hex below to calibrate)",
        );
        console.log("   " + r1.body.subarray(0, Math.min(48, r1.body.length)).toString("hex"));
      }
    }
  } catch (e) {
    results.cpuHistory = false;
    console.log(`4. CPUHISTORY_GET  -> FAILED (${e.message})`);
  }

  // 5. DISPLAY_GET  == screenshot test ==  body: use_vic(1)=0 + format(1)=0 (INDEXED8)
  try {
    const r = await mon.send(CMD.DISPLAY_GET, Buffer.from([0x00, 0x00]));
    if (r.errCode !== 0x00) {
      results.display = false;
      console.log(
        `5. DISPLAY_GET     -> ${ERR_NAME[r.errCode] || r.errCode}${r.errCode === 0x82 ? " (api < 2)" : ""}`,
      );
    } else {
      const disp = parseDisplayGet(r.body);
      results.display = true;
      console.log(
        `5. DISPLAY_GET     -> OK, debug ${disp.dw}x${disp.dh}, inner ${disp.iw}x${disp.ih}, ${disp.bpp}bpp indexed  => screenshots feasible`,
      );
    }
  } catch (e) {
    results.display = false;
    console.log(`5. DISPLAY_GET     -> FAILED (${e.message})`);
  }

  // 6. Async event demux: STEP one instruction should produce STOPPED (and the
  //    monitor prompt), demonstrating unsolicited-event handling.
  try {
    const stepBody = Buffer.alloc(3);
    stepBody[0] = 0x00; // step over subroutines = false
    stepBody.writeUInt16LE(1, 1); // 1 instruction
    await mon.send(CMD.ADVANCE_INSTRUCTIONS, stepBody);
    await sleep(150);
    console.log(`6. ASYNC EVENTS    -> observed ${mon.events.length} event(s): ${mon.events.map((e) => e.name).join(", ") || "none"}`);
  } catch (e) {
    console.log(`6. ASYNC EVENTS    -> FAILED (${e.message})`);
  }

  // 7. PALETTE_GET entry count (hard requirement of success criterion 3).
  try {
    const r = await mon.send(CMD.PALETTE_GET, paletteGetBody());
    if (r.errCode !== 0x00) {
      results.palette = null;
      console.log(`7. PALETTE_GET     -> ${ERR_NAME[r.errCode] || r.errCode}`);
    } else {
      const pal = parsePalette(r.body);
      results.palette = pal;
      const first = pal.entries[0] || {};
      console.log(
        `7. PALETTE_GET     -> OK, ${pal.count} entries, first RGB=(${first.r},${first.g},${first.b})`,
      );
    }
  } catch (e) {
    results.palette = null;
    console.log(`7. PALETTE_GET     -> FAILED (${e.message})`);
  }

  // 8. DISPLAY_GET pixel vs the live $D020/$D021 border/background register
  //    (UNVERIFIED item 5, second half). Do not hardcode a default colour —
  //    read the live registers via MEM_GET instead (research assumption A2).
  try {
    const memR = await mon.send(CMD.MEM_GET, memGetBody({ start: 0xd020, end: 0xd021, memspace: 0x00 }));
    // MEM_GET response body: [len:u16LE][data...]
    const dataLen = memR.body.readUInt16LE(0);
    const memData = memR.body.subarray(2, 2 + dataLen);
    const borderReg = memData[0] & 0x0f;
    const bgReg = memData.length >= 2 ? memData[1] & 0x0f : null;

    const dispR = await mon.send(CMD.DISPLAY_GET, Buffer.from([0x00, 0x00]));
    if (dispR.errCode !== 0x00) {
      results.pixelCheck = false;
      console.log(`8. PIXEL vs $D020  -> DISPLAY_GET ${ERR_NAME[dispR.errCode] || dispR.errCode}`);
    } else {
      const disp = parseDisplayGet(dispR.body);
      console.log(
        `   geometry: dw=${disp.dw} dh=${disp.dh} xo=${disp.xo} yo=${disp.yo} iw=${disp.iw} ih=${disp.ih} bpp=${disp.bpp}`,
      );
      // Sample RELATIVE to the inner-screen origin (xo, yo), a few pixels back
      // into the border. A fixed (4,4) lands in pre-visible blanking padding
      // given the real xo=136/yo=51 this build reports, which produced an
      // uncaveated MISMATCH in both recorded runs that looked like a
      // PALETTE_GET/DISPLAY_GET fault rather than a bad sample coordinate.
      const bx = Math.max(0, disp.xo - 4);
      const by = Math.max(0, disp.yo - 4);
      const borderIdx = disp.buffer[by * disp.dw + bx];
      const borderRgb = results.palette && results.palette.entries[borderIdx];
      const borderMatch = borderIdx === borderReg;
      results.pixelCheck = borderMatch;
      console.log(
        `8. PIXEL vs $D020  -> border(${bx},${by}) index=${borderIdx} expected(masked $D020)=${borderReg} ${borderMatch ? "MATCH" : "MISMATCH"}${borderRgb ? ` rgb=(${borderRgb.r},${borderRgb.g},${borderRgb.b})` : ""}`,
      );
      if (!borderMatch) {
        console.log(
          "   (a MISMATCH here can be a sample-coordinate artifact -- blanking padding vs rendered border -- not necessarily a DISPLAY_GET or PALETTE_GET fault)",
        );
      }
      const cx = Math.floor(disp.dw / 2);
      const cy = Math.floor(disp.dh / 2);
      const centreIdx = disp.buffer[cy * disp.dw + cx];
      console.log(
        `   centre(${cx},${cy}) index=${centreIdx} vs expected(masked $D021)=${bgReg} (informational only; may land on a glyph)`,
      );
    }
  } catch (e) {
    results.pixelCheck = false;
    console.log(`8. PIXEL vs $D020  -> FAILED (${e.message})`);
  }

  // 9. CHECKPOINT_SET: 8-byte vs 9-byte body (UNVERIFIED item 1). Both
  //    checkpoints are disabled + temporary so neither perturbs execution,
  //    and both are deleted immediately so nothing leaks into later checks.
  // Both numbers live outside the try so the finally can delete whichever were
  // created, even if the second CHECKPOINT_SET throws. These are enabled: 0, so
  // a leak is inert rather than harmful -- but it still contradicts this
  // check's own "deleted immediately so nothing leaks" contract.
  let cpNum8 = null;
  let cpNum9 = null;
  try {
    const body8 = checkpointSetBody({ start: 0xea31, end: 0xea31, stop: 1, enabled: 0, ops: 0x04, temporary: 1 });
    const r8 = await mon.send(CMD.CHECKPOINT_SET, body8);
    const err8 = ERR_NAME[r8.errCode] || r8.errCode;
    cpNum8 = r8.errCode === 0x00 ? parseCheckpointInfo(r8.body).checkpointNum : null;

    const body9 = checkpointSetBody({
      start: 0xea31,
      end: 0xea31,
      stop: 1,
      enabled: 0,
      ops: 0x04,
      temporary: 1,
      memspace: 0x00,
    });
    const r9 = await mon.send(CMD.CHECKPOINT_SET, body9);
    const err9 = ERR_NAME[r9.errCode] || r9.errCode;
    cpNum9 = r9.errCode === 0x00 ? parseCheckpointInfo(r9.body).checkpointNum : null;

    results.checkpointSet8 = err8;
    results.checkpointSet9 = err9;
    console.log(`9. CHECKPOINT_SET  -> 8-byte: ${err8}  9-byte(+memspace): ${err9}`);
  } catch (e) {
    console.log(`9. CHECKPOINT_SET  -> FAILED (${e.message})`);
  } finally {
    for (const n of [cpNum8, cpNum9]) {
      if (n === null) continue;
      try {
        await mon.send(CMD.CHECKPOINT_DELETE, cpNumBody(n));
      } catch {
        console.log(`    (could not delete checkpoint #${n} -- it is enabled:0 and therefore inert)`);
      }
    }
  }

  // 10. RL/CY conditions: accepted, and actually firing (UNVERIFIED item 4's
  //     answerable half; the empirical proof behind DOC-02).
  // cpNum lives OUTSIDE the try so the finally can always delete it. This
  // checkpoint is enabled, non-temporary, full-address-range and stop=1, and
  // the machine is resumed via EXIT while it is live -- if anything after that
  // throws (CHECKPOINT_GET timing out is the observed case, see
  // docs/phase1-probe-results.md), a leaked copy re-fires on essentially the
  // next instruction and wedges every later check on the same connection.
  let cp10Num = null;
  try {
    const fullRange = checkpointSetBody({ start: 0x0000, end: 0xffff, stop: 1, enabled: 1, ops: 0x04, temporary: 0 });
    const rSet = await mon.send(CMD.CHECKPOINT_SET, fullRange);
    if (rSet.errCode !== 0x00) {
      console.log(`10. RL/CY CONDITION -> CHECKPOINT_SET FAILED (${ERR_NAME[rSet.errCode] || rSet.errCode})`);
    } else {
      const cpNum = parseCheckpointInfo(rSet.body).checkpointNum;
      cp10Num = cpNum;

      // (a) token differential: correct-token condition, then the LIN/CYC
      //     negative control on the SAME checkpoint.
      const rlcyCond = await mon.send(CMD.CONDITION_SET, conditionSetBody(cpNum, "(RL == $64) && (CY == $14)"));
      const linCycCond = await mon.send(CMD.CONDITION_SET, conditionSetBody(cpNum, "(LIN == $64) && (CYC == $14)"));
      results.rlCyAccepted = rlcyCond.errCode === 0x00;
      results.linCycRejected = linCycCond.errCode !== 0x00;
      console.log(
        `10a. RL/CY vs LIN/CYC -> RL/CY: ${ERR_NAME[rlcyCond.errCode] || rlcyCond.errCode}  LIN/CYC: ${ERR_NAME[linCycCond.errCode] || linCycCond.errCode}`,
      );

      // (b) fire test: relax to a reachable single-token condition, resume,
      //     and check hit_count transitioned from 0.
      await mon.send(CMD.CONDITION_SET, conditionSetBody(cpNum, "(RL == $64)"));
      await mon.send(CMD.EXIT);
      await sleep(500);
      const cpGet = await mon.send(CMD.CHECKPOINT_GET, cpNumBody(cpNum));
      const hitCount = cpGet.errCode === 0x00 ? parseCheckpointInfo(cpGet.body).hitCount : null;
      results.conditionFired = hitCount != null && hitCount > 0;
      console.log(
        `10b. FIRE TEST      -> hitCount=${hitCount != null ? hitCount : "?"} ${hitCount > 0 ? "FIRED" : "did not fire"}; events so far: ${mon.events.map((e) => e.name).join(" -> ") || "none"}`,
      );

      // (c) cleanup happens in the finally below -- conditions cannot be read
      //     back or cleared and leak with their checkpoint, so it must run
      //     even when the fire test above throws.
    }
  } catch (e) {
    console.log(`10. RL/CY CONDITION -> FAILED (${e.message})`);
  } finally {
    if (cp10Num !== null) {
      try {
        await mon.send(CMD.CHECKPOINT_DELETE, cpNumBody(cp10Num));
      } catch {
        console.log(
          `    (could not delete checkpoint #${cp10Num} -- connection already unresponsive; it will die with the target)`,
        );
      }
    }
  }

  // 11. Drive8TrueEmulation under that exact name (UNVERIFIED item 2).
  try {
    const tde = await mon.send(CMD.RESOURCE_GET, resourceGetBody("Drive8TrueEmulation"));
    const tdeParsed = parseResource(tde);
    const driveType = await mon.send(CMD.RESOURCE_GET, resourceGetBody("Drive8Type"));
    const driveTypeParsed = parseResource(driveType);

    let fallback = null;
    if (tdeParsed.missing) {
      const fb = await mon.send(CMD.RESOURCE_GET, resourceGetBody("DriveTrueEmulation"));
      fallback = parseResource(fb);
    }

    results.tdeOn = !tdeParsed.missing && tdeParsed.type === "int" && tdeParsed.value !== 0;
    results.driveTypeNonZero = !driveTypeParsed.missing && driveTypeParsed.type === "int" && driveTypeParsed.value !== 0;

    console.log(
      `11. Drive8TrueEmulation -> ${tdeParsed.missing ? "OBJECT_MISSING (does-not-exist or NULL string, not distinguishable on the wire)" : `${tdeParsed.type}=${tdeParsed.value}`}`,
    );
    console.log(
      `    Drive8Type          -> ${driveTypeParsed.missing ? "OBJECT_MISSING" : `${driveTypeParsed.type}=${driveTypeParsed.value}`}`,
    );
    if (fallback) {
      console.log(
        `    DriveTrueEmulation (fallback name) -> ${fallback.missing ? "OBJECT_MISSING" : `${fallback.type}=${fallback.value}`}`,
      );
    }
  } catch (e) {
    console.log(`11. Drive8TrueEmulation -> FAILED (${e.message})`);
  }

  // 12. Does ADVANCE_INSTRUCTIONS emit a RESUMED/STOPPED pair? (ROADMAP's
  //     separately-listed probe addition; feeds criterion 3's "observed
  //     unsolicited event sequence". Does not assert a specific answer.)
  try {
    const before = mon.events.length;
    const stepBody = Buffer.alloc(3);
    stepBody[0] = 0x00;
    stepBody.writeUInt16LE(1, 1);
    await mon.send(CMD.ADVANCE_INSTRUCTIONS, stepBody);
    await sleep(150);
    const slice = mon.events.slice(before).map((e) => e.name);
    results.advanceEventSlice = slice;
    let verdict;
    if (slice.length === 2 && slice[0] === "RESUMED" && slice[1] === "STOPPED") {
      verdict = "RESUMED then STOPPED";
    } else if (slice.length === 1 && slice[0] === "STOPPED") {
      verdict = "STOPPED only";
    } else {
      verdict = slice.length ? "other" : "no events";
    }
    console.log(`12. ADVANCE_INSTRUCTIONS event pair -> [${slice.join(", ") || "none"}] (${verdict})`);
  } catch (e) {
    console.log(`12. ADVANCE_INSTRUCTIONS event pair -> FAILED (${e.message})`);
  }

  // 13. MEM_SET into drive ROM $C000 (UNVERIFIED item 3). This is the only
  //     probe that can crash the target, so it runs last. Gated on evidence
  //     from check 11, not assumption: with TDE off, drive reads return
  //     silent zeros rather than an error, so an unguarded run would produce
  //     a meaningless "looks like a no-op" answer.
  try {
    if (!results.tdeOn || !results.driveTypeNonZero) {
      console.log(
        "13. MEM_SET drive ROM -> SKIPPED (Drive8TrueEmulation/Drive8Type precondition from check 11 not confirmed on; a zero read-back here would not be evidence of a safe no-op)",
      );
      results.driveRomWrite = "skipped-precondition-unmet";
    } else {
      // The baseline read is deliberately OUTSIDE the write's own try. A
      // failure here happens BEFORE any byte is written, so attributing it to
      // "the drive-ROM write crashed the target" would corrupt the exact
      // causal claim this check exists to establish for UNVERIFIED item 3.
      let beforeByte;
      try {
        const before = await mon.send(CMD.MEM_GET, memGetBody({ start: 0xc000, end: 0xc000, memspace: 0x01 }));
        beforeByte = before.body.subarray(2, 2 + before.body.readUInt16LE(0))[0];
      } catch (e) {
        console.log(
          `13. MEM_SET drive ROM -> SKIPPED: the pre-write baseline read failed (${e.message}). No write was attempted, so this says nothing about UNVERIFIED item 3.`,
        );
        results.driveRomWrite = "skipped-baseline-read-failed";
        throw new SkipCheck13();
      }

      try {
        const setR = await mon.send(
          CMD.MEM_SET,
          memSetBody({ start: 0xc000, end: 0xc000, memspace: 0x01, data: Buffer.from([0xff]) }),
        );
        if (setR.errCode !== 0x00) {
          console.log(`13. MEM_SET drive ROM -> REJECTED (${ERR_NAME[setR.errCode] || setR.errCode})`);
          results.driveRomWrite = "rejected";
        } else {
          const after = await mon.send(CMD.MEM_GET, memGetBody({ start: 0xc000, end: 0xc000, memspace: 0x01 }));
          const afterData = after.body.subarray(2, 2 + after.body.readUInt16LE(0));
          const afterByte = afterData[0];
          if (afterByte === beforeByte) {
            console.log(
              `13. MEM_SET drive ROM -> OK but byte UNCHANGED ($${beforeByte.toString(16)}) -- silent no-op store stub`,
            );
            results.driveRomWrite = "silent-no-op";
          } else {
            console.log(
              `13. MEM_SET drive ROM -> OK, byte CHANGED $${beforeByte.toString(16)} -> $${afterByte.toString(16)} -- drive ROM is writable through the monitor`,
            );
            results.driveRomWrite = "writable";
          }
        }
      } catch (e) {
        console.log(
          `13. MEM_SET drive ROM -> the write itself crashed or hung the target (${e.message}) -- this IS the answer to UNVERIFIED item 3, not a probe defect`,
        );
        results.driveRomWrite = "crashed-or-hung";
      }
    }
  } catch (e) {
    if (!(e instanceof SkipCheck13)) {
      console.log(`13. MEM_SET drive ROM -> FAILED before the write (${e.message})`);
      results.driveRomWrite = "failed-before-write";
    }
  }

  // Resume the machine and disconnect cleanly. Tolerate a socket already
  // closed by check 13 -- the verdict below must still print.
  try {
    await mon.send(CMD.EXIT);
  } catch { /* ignore -- check 13 may have already crashed/closed the target */ }
  try {
    socket.end();
  } catch { /* ignore */ }

  console.log("\n=== Phase-1 verdict ===");
  console.log(`connect/ping ............ ${results.ping ? "PASS" : "FAIL"}`);
  console.log(`api_version (observed) .. ${mon.observedApi != null ? `0x${mon.observedApi.toString(16)}` : "?"}`);
  console.log(`vice version ............ ${results.version || "?"}`);
  console.log(
    `cpuhistory_get ........... ${results.cpuHistory === undefined ? "?" : results.cpuHistory ? "OK" : "unavailable (INVALID_TYPE 0x83 on <3.10, CMD_FAILURE 0x8f if disabled on >=3.10)"}`,
  );
  console.log(`display_get geometry ..... ${results.display ? "AVAILABLE" : "MISSING/unsupported"}`);
  console.log(`palette_get entries ...... ${results.palette ? results.palette.count : "?"}`);
  console.log(
    `checkpoint_set 8/9-byte .. 8-byte: ${results.checkpointSet8 ?? "?"}  9-byte: ${results.checkpointSet9 ?? "?"}`,
  );
  console.log(
    `RL/CY condition .......... accepted=${results.rlCyAccepted ?? "?"}  LIN/CYC rejected=${results.linCycRejected ?? "?"}  fired=${results.conditionFired ?? "?"}`,
  );
  console.log(
    `Drive8TrueEmulation ...... on=${results.tdeOn ?? "?"}  Drive8Type nonzero=${results.driveTypeNonZero ?? "?"}`,
  );
  console.log(
    `ADVANCE_INSTRUCTIONS ..... event slice: [${(results.advanceEventSlice || []).join(", ") || "?"}]`,
  );
  console.log(`drive ROM MEM_SET ........ ${results.driveRomWrite || "?"}`);
  console.log(
    `unsolicited event sequence (full session) -> ${mon.events.map((e) => e.name).join(" -> ") || "none"}`,
  );
  console.log(
    "\nVICE >= 3.10 is the gate for CPUHISTORY_GET, not a compile flag -- see docs/phase1-probe-results.md for the recorded run.",
  );
}

// ---------------------------------------------------------------------------
// --capture mode (D-19): write byte-exact, provenance-stamped fixtures for
// the three VERIF-02 cases that need a real emulator. Added alongside
// --selftest, never replacing it. Every case's raw-byte dump sits downstream
// of BinMon's own _onData() framing loop via the onFrame hook above -- this
// never re-parses the wire independently and never bypasses MAX_BODY_LEN.
// ---------------------------------------------------------------------------

function usageCaptureError(badCase) {
  const named = badCase ? `Unknown --capture case "${badCase}".` : "Missing --capture <case>.";
  return `${named} Valid cases: ${CAPTURE_CASES.join(", ")}, or "all".`;
}

function parseCaptureArgs(argv) {
  const idx = argv.indexOf("--capture");
  if (idx === -1) return null;
  const caseName = argv[idx + 1];
  const outIdx = argv.indexOf("--capture-out");
  const outDir = outIdx !== -1 ? argv[outIdx + 1] : null;
  return { caseName, outDir };
}

// Write via a tmp-sibling then rename -- never a direct in-place write --
// matching this repo's established atomic-write convention
// (refresh-manifest.ts's writeManifestAtomic()).
function writeAtomic(path, data) {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, data);
  renameSync(tmpPath, path);
}

// Run `fn()` while every frame BinMon reassembles is appended to a bounded
// array via the onFrame hook. Once MAX_CAPTURE_FRAMES frames have been read,
// further frames are dropped and `aborted` is set -- the case must stop
// accumulating rather than let a flood consume the whole capture session.
async function withFrameCapture(mon, fn) {
  const frames = [];
  let aborted = false;
  mon.onFrame = (frame) => {
    if (frames.length >= MAX_CAPTURE_FRAMES) {
      aborted = true;
      return;
    }
    frames.push(frame);
    if (frames.length >= MAX_CAPTURE_FRAMES) {
      aborted = true;
      console.log(`   [capture] hit MAX_CAPTURE_FRAMES (${MAX_CAPTURE_FRAMES}) -- aborting this case`);
    }
  };
  try {
    await fn();
  } finally {
    mon.onFrame = null;
  }
  return { frames, aborted };
}

async function captureDisplayGetCase(mon) {
  return withFrameCapture(mon, async () => {
    await mon.send(CMD.DISPLAY_GET, Buffer.from([0x00, 0x00]));
  });
}

async function captureEventInterleavedCase(mon) {
  return withFrameCapture(mon, async () => {
    // Stepping one instruction reliably produces at least one 0xffffffff
    // event frame (RESUMED/REGISTER_INFO/STOPPED, per check 6's own
    // "ASYNC EVENTS" probe above) landing between this request and its own
    // reply -- exactly the interleaving this case exists to capture.
    const stepBody = Buffer.alloc(3);
    stepBody[0] = 0x00;
    stepBody.writeUInt16LE(1, 1);
    await mon.send(CMD.ADVANCE_INSTRUCTIONS, stepBody);
    await sleep(200); // let interleaved events land before the case ends
  });
}

async function captureCheckpointListCase(mon) {
  // Both checkpoint numbers live outside the try so the finally can delete
  // whichever were actually created, even if CHECKPOINT_LIST itself throws --
  // the same cleanup discipline checks 9 and 10 above already established.
  let cpNumA = null;
  let cpNumB = null;
  try {
    return await withFrameCapture(mon, async () => {
      // Two narrow, single-address (start === end) stop=1 checkpoints --
      // never the fork's $0000-$FFFF full-range shape, which produced the
      // CHECKPOINT_INFO x18 flood recorded in docs/phase1-probe-results.md.
      const rA = await mon.send(
        CMD.CHECKPOINT_SET,
        checkpointSetBody({ start: 0xea31, end: 0xea31, stop: 1, enabled: 0, temporary: 1 }),
      );
      cpNumA = rA.errCode === 0x00 ? parseCheckpointInfo(rA.body).checkpointNum : null;

      const rB = await mon.send(
        CMD.CHECKPOINT_SET,
        checkpointSetBody({ start: 0xea81, end: 0xea81, stop: 1, enabled: 0, temporary: 1 }),
      );
      cpNumB = rB.errCode === 0x00 ? parseCheckpointInfo(rB.body).checkpointNum : null;

      await mon.send(CMD.CHECKPOINT_LIST);
      await sleep(100); // let any CHECKPOINT_INFO frames the list emits land
    });
  } finally {
    for (const n of [cpNumA, cpNumB]) {
      if (n === null) continue;
      try {
        await mon.send(CMD.CHECKPOINT_DELETE, cpNumBody(n));
      } catch {
        console.log(`    (could not delete capture checkpoint #${n} -- it is enabled:0 and therefore inert)`);
      }
    }
  }
}

// Plan 07-12, Task 1: three CPUHISTORY_GET (0x86) captures. cpuhistory-get
// and cpuhistory-get-multi are run against a genuine >= 3.10 build (count=1
// and count=4, respectively -- the multi-entry case is the stride proof, not
// just a bigger single-entry case). cpuhistory-get-unsupported is run
// against a genuine 3.9 build, which lacks the opcode entirely, to record
// the real refusal frame rather than assume one.
async function captureCpuHistoryGetCase(mon) {
  return withFrameCapture(mon, async () => {
    await mon.send(CMD.CPUHISTORY_GET, cpuHistoryGetBody(1));
  });
}

async function captureCpuHistoryGetMultiCase(mon) {
  return withFrameCapture(mon, async () => {
    await mon.send(CMD.CPUHISTORY_GET, cpuHistoryGetBody(4));
  });
}

async function captureCpuHistoryGetUnsupportedCase(mon) {
  return withFrameCapture(mon, async () => {
    await mon.send(CMD.CPUHISTORY_GET, cpuHistoryGetBody(1));
  });
}

const CAPTURE_COMMAND_BY_CASE = {
  "display-get": "DISPLAY_GET (0x84)",
  "event-interleaved": "ADVANCE_INSTRUCTIONS (0x71)",
  "checkpoint-list": "CHECKPOINT_SET (0x12) x2 -> CHECKPOINT_LIST (0x14) -> CHECKPOINT_DELETE (0x13) x2",
  "cpuhistory-get": "CPUHISTORY_GET (0x86) count=1",
  "cpuhistory-get-multi": "CPUHISTORY_GET (0x86) count=4",
  "cpuhistory-get-unsupported": "CPUHISTORY_GET (0x86) count=1 against a build without FEATURE_CPUMEMHISTORY",
};
const CAPTURE_RUNNER_BY_CASE = {
  "display-get": captureDisplayGetCase,
  "event-interleaved": captureEventInterleavedCase,
  "checkpoint-list": captureCheckpointListCase,
  "cpuhistory-get": captureCpuHistoryGetCase,
  "cpuhistory-get-multi": captureCpuHistoryGetMultiCase,
  "cpuhistory-get-unsupported": captureCpuHistoryGetUnsupportedCase,
};

/**
 * WR-11 (code review 2026-08-13): THE sidecar builder, extracted as a pure
 * function so the selftest can exercise the real construction. The selftest
 * used to build an object literal with the four keys and then assert that the
 * object had those four keys -- exercising none of runCapture()'s actual
 * construction while claiming, in its own assertion message, to cover "the
 * sidecar builder". That is false confidence in exactly the provenance contract
 * binmon-fixtures.ts's loadCapturedFixture() enforces at load time.
 *
 * `caseName` is looked up in CAPTURE_COMMAND_BY_CASE here, so a case with no
 * command string cannot silently produce a sidecar with `command: undefined` --
 * which would pass JSON.stringify and then fail loadCapturedFixture()'s
 * required-key check much later, in a different process, against a .bin that
 * looks fine. Throwing at construction is the whole point.
 */
export function buildSidecar({ capturedFrom, viceVersion, caseName, now = () => new Date() }) {
  const command = CAPTURE_COMMAND_BY_CASE[caseName];
  if (typeof command !== "string" || command === "") {
    throw new Error(`buildSidecar: no capture command recorded for case "${caseName}" -- refusing to write a sidecar with no command`);
  }
  if (typeof capturedFrom !== "string" || capturedFrom === "") {
    throw new Error("buildSidecar: capturedFrom must be a non-empty string -- provenance that cannot name its source is not provenance");
  }
  if (typeof viceVersion !== "string" || viceVersion === "") {
    throw new Error('buildSidecar: viceVersion must be a non-empty string (use "unknown" when VICE_INFO could not be read)');
  }
  return {
    capturedFrom,
    viceVersion,
    capturedAt: now().toISOString(),
    command,
    // WR-09 (07-REVIEW.md): provenance is always STATED, never defaulted.
    // binmon-fixtures.ts's loadCapturedFixture() derives
    // `synthetic: provenance.synthetic === true`, so a sidecar that omits the
    // key silently claims hardware provenance -- which is how the three real
    // CPUHISTORY_GET captures satisfied `assert.equal(fixture.synthetic,
    // false)` by saying nothing at all, defeating the very assertion whose
    // stated purpose is that "a future re-record to a synthesized fallback
    // fails loudly here rather than silently". Anything this function writes
    // came off a live socket, so `false` is the truthful value; the synthetic
    // fixtures are written by hand and carry `true` plus a `specSections`
    // array. Never make this a parameter.
    synthetic: false,
  };
}

async function runCapture(caseName, outDirArg) {
  const outDir = outDirArg
    ? resolve(outDirArg)
    : join(dirname(fileURLToPath(import.meta.url)), "fixtures", "binmon");
  mkdirSync(outDir, { recursive: true });

  const { host, port } = parseTarget();
  console.log(`[capture] connecting to VICE binary monitor at ${host}:${port} ...`);
  const socket = await connectSocket(host, port);
  console.log("[capture] connected.\n");
  const mon = new BinMon(socket);

  let viceVersion = "unknown";
  try {
    const viceInfo = await mon.send(CMD.VICE_INFO);
    if (viceInfo.body.length >= 1) {
      const vlen = viceInfo.body[0];
      viceVersion = Array.from(viceInfo.body.subarray(1, 1 + vlen)).join(".");
    }
  } catch (e) {
    console.log(`[capture] VICE_INFO failed (${e.message}) -- viceVersion will read "unknown"`);
  }
  // capturedFrom names the resolved binary path plus stock/fork, per the
  // sidecar contract binmon-fixtures.ts's loadCapturedFixture() enforces.
  // Neither is observable from a bare TCP client, so both are taken from the
  // environment/CLI, with an honest fallback rather than a guessed value.
  const capturedFrom = `${process.env.CAPTURE_BACKEND_KIND || "unknown"}:${process.env.VICE_BIN || `${host}:${port}`}`;

  const casesToRun = caseName === "all" ? CAPTURE_CASES : [caseName];
  for (const c of casesToRun) {
    // WR-10: refuse a case whose required build family does not match the
    // connected target, BEFORE its runner sends anything. Skipped, not fatal:
    // `--capture all` against one build is expected to be able to refresh the
    // cases that build can legitimately produce.
    const requirement = CAPTURE_REQUIRES_VERSION[c];
    if (requirement && !requirement.pattern.test(viceVersion)) {
      console.log(
        `[capture] case "${c}" SKIPPED: needs ${requirement.describe}, connected build reports "${viceVersion}" -- no .bin and no .json written ` +
          `(overwriting it from this build would produce a fixture whose sidecar describes a different VICE version)`,
      );
      continue;
    }
    console.log(`[capture] running case "${c}" ...`);
    let result;
    try {
      result = await CAPTURE_RUNNER_BY_CASE[c](mon);
    } catch (e) {
      console.log(`[capture] case "${c}" FAILED: ${e.message}`);
      continue;
    }
    if (result.aborted) {
      console.log(`[capture] case "${c}" ABORTED: reached MAX_CAPTURE_FRAMES (${MAX_CAPTURE_FRAMES}) -- no .bin written`);
      continue;
    }
    if (result.frames.length === 0) {
      console.log(`[capture] case "${c}" produced no frames -- no .bin written`);
      continue;
    }
    const bytes = Buffer.concat(result.frames);
    // WR-11: the ONE sidecar construction, shared with the selftest.
    const sidecar = buildSidecar({ capturedFrom, viceVersion, caseName: c });
    writeAtomic(join(outDir, `${c}.bin`), bytes);
    writeAtomic(join(outDir, `${c}.json`), JSON.stringify(sidecar, null, 2) + "\n");
    console.log(
      `[capture] case "${c}" OK: ${result.frames.length} frame(s), ${bytes.length} byte(s) -> ${join(outDir, c)}.{bin,json}`,
    );
  }

  try {
    await mon.send(CMD.EXIT);
  } catch { /* ignore -- a case above may have already left the target unresponsive */ }
  try {
    socket.end();
  } catch { /* ignore */ }
}

// Only dispatch when invoked DIRECTLY (`node probe-binmon.mjs ...`), never when
// imported -- the same guard test-gate.mjs uses, for the same reason. This file
// exports real, testable values (buildSidecar, CAPTURE_REQUIRES_VERSION), and
// without this guard a plain `import` of the module fell straight through to
// main(), which dials a live socket and exits non-zero with "probe error:
// connect ECONNREFUSED". A module cannot be both a script with unconditional
// side effects and a source of truth other code can read.
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--selftest")) {
    try {
      selftest();
      console.log("SELFTEST PASS - all wire body builders and response parsers verified offline");
      process.exit(0);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  } else if (process.argv.some((a) => a === "--probe-assumptions" || a.startsWith("--probe-assumptions="))) {
    const flag = process.argv.find((a) => a === "--probe-assumptions" || a.startsWith("--probe-assumptions="));
    const casesArg = flag.includes("=") ? flag.slice(flag.indexOf("=") + 1) : null;
    const cases = casesArg ? casesArg.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const { host, port } = parseTarget();
    (async () => {
      console.log(`Connecting to VICE binary monitor at ${host}:${port} for --probe-assumptions ...`);
      const socket = await connectSocket(host, port);
      console.log("Connected.\n");
      const mon = new BinMon(socket);
      try {
        await runAssumptionProbes(mon, { host, cases });
      } finally {
        try {
          await mon.send(CMD.EXIT);
        } catch {
          /* ignore */
        }
        try {
          socket.end();
        } catch {
          /* ignore */
        }
      }
    })().catch((e) => {
      console.error("probe-assumptions error:", e.message);
      process.exit(1);
    });
  } else if (process.argv.includes("--capture")) {
    const parsed = parseCaptureArgs(process.argv);
    const caseName = parsed && parsed.caseName;
    if (!caseName || (caseName !== "all" && !CAPTURE_CASES.includes(caseName))) {
      // Validated BEFORE any socket connection is attempted -- a bogus case
      // name must fail fast and offline, never dial the target first.
      console.error(usageCaptureError(caseName));
      process.exit(1);
    } else {
      runCapture(caseName, parsed.outDir).catch((e) => {
        console.error("capture error:", e.message);
        process.exit(1);
      });
    }
  } else {
    main().catch((e) => {
      console.error("probe error:", e.message);
      process.exit(1);
    });
  }
}
