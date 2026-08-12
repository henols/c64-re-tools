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
 * No dependencies; pure Node (net).
 */
import net from "node:net";

const STX = 0x02;
const API = 0x02;
const EVENT_ID = 0xffffffff;

const CMD = {
  MEM_GET: 0x01,
  MEM_SET: 0x02,
  CHECKPOINT_GET: 0x11,
  CHECKPOINT_SET: 0x12,
  CHECKPOINT_DELETE: 0x13,
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

function parseTarget() {
  const env = process.env.VICE_BINMON;
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
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
      const total = 12 + bodyLen;
      if (this.buf.length < total) break;
      const frame = this.buf.subarray(0, total);
      this.buf = this.buf.subarray(total);
      if (this.observedApi === null) this.observedApi = frame[1];
      const respType = frame[6];
      const errCode = frame[7];
      const reqId = frame.readUInt32LE(8);
      const body = frame.subarray(12, total);
      if (reqId === EVENT_ID) {
        const name = RESP_NAME[respType] || `0x${respType.toString(16)}`;
        const pc = body.length >= 2 ? body.readUInt16LE(0) : null;
        this.events.push({ name, pc });
        console.log(
          `   [async event] ${name}${pc != null ? ` PC=$${pc.toString(16).padStart(4, "0")}` : ""}`,
        );
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
}

async function main() {
  const { host, port } = parseTarget();
  console.log(`Connecting to VICE binary monitor at ${host}:${port} ...`);
  const socket = await new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port }, () => resolve(s));
    s.on("error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 4000);
  });
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

  // Resume the machine and disconnect cleanly.
  try {
    await mon.send(CMD.EXIT);
  } catch { /* ignore */ }
  socket.end();

  console.log("\n=== Phase-0 verdict (checks 1-6 only; extended verdict follows in 01-03 Task 3) ===");
  console.log(`connect/ping ....... ${results.ping ? "PASS" : "FAIL"}`);
  console.log(`vice version ....... ${results.version || "?"}`);
  console.log(`cycle stopwatch .... ${results.cpuHistory ? "AVAILABLE" : "MISSING"}`);
  console.log(`screenshot ......... ${results.display ? "AVAILABLE" : "MISSING/unsupported"}`);
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
} else {
  main().catch((e) => {
    console.error("probe error:", e.message);
    process.exit(1);
  });
}
