#!/usr/bin/env node
/*
 * Phase-0 de-risk probe for stock VICE's binary monitor.
 *
 * This repo's container has no VICE and no display, so this must be run on a
 * machine with a stock x64sc. It answers the roadmap's open questions against a
 * REAL build (see docs/phase0-binmon-findings.md):
 *   1. Connect + api/version (VICE_INFO)
 *   2. Is CPU history compiled in?  -> the cycle "stopwatch" (CPUHISTORY_GET)
 *   3. Does DISPLAY_GET work? (needs api >= 2)  -> screenshots
 *   4. Demonstrate the async STOPPED/RESUMED event demux
 *
 * Usage:
 *   1) Launch stock VICE with the binary monitor:
 *        x64sc -binarymonitor -binarymonitoraddress ip4://127.0.0.1:6502
 *   2) node .claude/mcp/vice/probe-binmon.mjs [host] [port]
 *      (defaults: 127.0.0.1 6502; or set VICE_BINMON=host:port)
 *
 * No dependencies; pure Node (net).
 */
import net from "node:net";

const STX = 0x02;
const API = 0x02;
const EVENT_ID = 0xffffffff;

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

function parseTarget() {
  const env = process.env.VICE_BINMON;
  let host = process.argv[2] || (env && env.split(":")[0]) || "127.0.0.1";
  let port = Number(process.argv[3] || (env && env.split(":")[1]) || 6502);
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
        p.resolve({ respType, errCode, body });
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
      // body: [info_len:4][dw:2][dh:2][xo:2][yo:2][iw:2][ih:2][bpp:1][buflen:4][buffer...]
      const dw = r.body.readUInt16LE(4);
      const dh = r.body.readUInt16LE(6);
      const iw = r.body.readUInt16LE(12);
      const ih = r.body.readUInt16LE(14);
      const bpp = r.body[16];
      results.display = true;
      console.log(
        `5. DISPLAY_GET     -> OK, debug ${dw}x${dh}, inner ${iw}x${ih}, ${bpp}bpp indexed  => screenshots feasible`,
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

  console.log("\n=== Phase-0 verdict ===");
  console.log(`connect/ping ....... ${results.ping ? "PASS" : "FAIL"}`);
  console.log(`vice version ....... ${results.version || "?"}`);
  console.log(`cycle stopwatch .... ${results.cpuHistory ? "AVAILABLE (CPU history on)" : "MISSING (build lacks CPU history)"}`);
  console.log(`screenshot ......... ${results.display ? "AVAILABLE" : "MISSING/unsupported"}`);
  console.log("\nIf 'cycle stopwatch' is MISSING, the timing tools need a fallback");
  console.log("(instruction-count or wall-clock); see docs/phase0-binmon-findings.md.");
}

main().catch((e) => {
  console.error("probe error:", e.message);
  process.exit(1);
});
