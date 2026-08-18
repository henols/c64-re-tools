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
 * No dependencies; pure Node (net).
 */
import net from "node:net";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  RESOURCE_GET: 0x51,
  ADVANCE_INSTRUCTIONS: 0x71,
  PING: 0x81,
  REGISTERS_AVAILABLE: 0x83,
  DISPLAY_GET: 0x84,
  VICE_INFO: 0x85,
  CPUHISTORY_GET: 0x86,
  PALETTE_GET: 0x91,
  EXIT: 0xaa,
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

  // --- --capture mode selftest additions (no socket, no emulator) ---------

  // (a) WR-11: the REAL sidecar builder -- buildSidecar(), the same function
  // runCapture() writes with -- emits exactly the four required provenance keys,
  // with the case's own recorded command. The previous version of this check
  // built an object literal with those keys and asserted the literal had them,
  // exercising nothing while its message claimed to cover the builder.
  const builtSidecar = buildSidecar({
    capturedFrom: "stock:/usr/bin/x64sc",
    viceVersion: "3.9.0.0",
    caseName: "display-get",
    now: () => new Date("2026-08-13T00:00:00.000Z"),
  });
  const sidecarKeys = Object.keys(builtSidecar);
  assertTrue(
    sidecarKeys.length === 4 &&
      ["capturedFrom", "viceVersion", "capturedAt", "command"].every((k) => sidecarKeys.includes(k)),
    "buildSidecar: exactly the four required provenance keys, and no others",
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

if (process.argv.includes("--selftest")) {
  try {
    selftest();
    console.log("SELFTEST PASS - all wire body builders and response parsers verified offline");
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
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
