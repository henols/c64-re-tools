#!/usr/bin/env node
// -----------------------------------------------------------------------------
// evidence/autostart-probe.mjs -- Phase 33 plan 33-03's named, repeatable probe.
//
// WHY THIS FILE EXISTS
// --------------------
// `33-RESEARCH.md` Open Question Q2: AUTOSTART (0xdd) is ITSELF a power cycle
// (`mon_autostart` -> `reboot_for_autostart` -> `machine_trigger_reset(
// POWER_CYCLE)`, autostart.c:1437), so a separate `RESET 1` afterwards UNDOES
// the autostart. Research tried `arm-while-halted -> RESET 1 -> AUTOSTART ->
// count hits` once and got no usable stop (PC=$FD75/$FD70, LIN=0, hits=0 --
// inside the KERNAL reset routine). This probe settles, by measurement, which
// anchor-counted ordering DOES produce a repeatable stop on a real autostarted
// cracked release -- so plan 33-09's `runReproducible()` encodes a measurement
// rather than a guess.
//
// It is an EVIDENCE SCRIPT, not a deliverable (D-10): self-contained under the
// phase evidence directory, importing ONLY `node:` builtins, and it spawns
// `/usr/bin/x64sc` directly rather than going through the broker -- because
// D-11 requires the broker stopped for every measurement in this phase, and
// because the argv under test is the one this phase is defining.
//
// WHAT IT MUST NOT BECOME
// -----------------------
// - Not a second wire-protocol implementation for the shipped tree. The framing
//   below is a deliberate, throwaway restatement of `src/mcp/vice/
//   stock-protocol.ts`'s encoders so this file can stay import-free; the
//   SHIPPED path must always go through that module's encoders.
// - Not a `first_module_offset = 37` / resync-scan slicer. The prototype at
//   `.planning/phases/23-.../evidence/vsf-ram-extract.mjs` survives a stale
//   offset only by byte-by-byte resyncing, which can lock onto a false
//   "C64MEM" string inside 64 KB of RAM and return plausible garbage
//   (33-RESEARCH.md P2). The walk here is strict: 58, `off += size`, never
//   `off++`, and it asserts the walk ends exactly at file length.
//
// MEASURED WIRE FACTS THIS FILE DEPENDS ON (all live-verified 2026-09-02)
// ----------------------------------------------------------------------
// - 11-byte request header / 12-byte response header, all multi-byte LE.
// - FIVE unsolicited message types arrive at request id 0xffffffff: STOPPED
//   (0x62), RESUMED (0x63), JAM (0x61, ZERO-LENGTH body), CHECKPOINT_INFO
//   (0x11) on every hit, REGISTER_INFO (0x31) on every monitor open. The last
//   two SHARE a response type with a legitimate command reply, so this demux
//   keys on request id and NEVER resolves a pending request with an event.
// - `hit_count` is at CHECKPOINT_INFO body offset 13 as u32LE, NOT 12. Reading
//   12 yields 256 where the truth is 1 -- a plausible-looking wrong number.
// - PC/LIN/CYC register ids are resolved from REGISTERS_AVAILABLE (0x83) BY
//   NAME. On this build the catalog is `3:PC 53:LIN 54:CYC 55:00 56:01`, but
//   no id literal for those is written anywhere below.
// - The wire memspace byte is NOT VICE's internal enum: 0x00 main, 0x01-0x04
//   units 8-11, 0x08 REJECTED. Every checkpoint armed here passes memspace
//   0x00 through `memspaceByte()` below (T-33-17), never `body[8] = ...`.
// - Every checkpoint armed here is `stop: true` (T-33-10): a NON-stopping
//   checkpoint emits CHECKPOINT_INFO synchronously from inside the CPU loop on
//   every hit, which on a once-per-frame address stalls the emulator thread.
//
// ARGV ORDER IS LOAD-BEARING (33-RESEARCH.md P1, P5)
// --------------------------------------------------
// `main.c`'s prefix scan handles `-default`/`-console`/`-seed` before the UI
// or config load, `break`s at the first unrecognised option, and STRIPS what it
// handled. Measured: `-console` at index >= 2 dies headless with
// `Gtk-WARNING: cannot open display:`. So `-default` is index 0 and `-console`
// is index 1, always.
//
// T-33-04 (argv elevation of privilege): the flag list below is a fixed
// literal array with ONLY the port number interpolated. No argv element is
// built from an external string and there is no passthrough parameter.
// `-binarymonitoraddress` stays `ip4://127.0.0.1:<port>` -- loopback only.
//
// USAGE
// -----
//   node autostart-probe.mjs s1                      # survival probe: armed-then-AUTOSTART -> CHECKPOINT_LIST
//   node autostart-probe.mjs s2      --jitter <ms>    # arm AFTER the autostart reply, count from there
//   node autostart-probe.mjs s3      --jitter <ms>    # arm while halted, BEFORE AUTOSTART
//   node autostart-probe.mjs s4      --jitter <ms>    # hit-count OFFSET from the post-load baseline
//   node autostart-probe.mjs controlA --jitter <ms>   # wall-clock anchoring (expected RED)
//   node autostart-probe.mjs controlB                 # -warp + wall-clock bracket (expected RED)
//   node autostart-probe.mjs diff <a.vsf> <b.vsf>     # strict module walk + C64MEM RAM diff
//
// Every mode prints its own transcript to stdout. The caller appends a
// `$ <command>` line to the evidence file and then this real output below it
// (evidence convention 1) -- transcripts are never reconstructed afterwards.
// -----------------------------------------------------------------------------

import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

// --- fixed inputs ------------------------------------------------------------

const VICE_BIN = "/usr/bin/x64sc";
const RELEASE = path.resolve(
  import.meta.dirname,
  "../../23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64",
);
// T-33-06: probe output lands OUTSIDE the checkout, so no snapshot byte can be
// staged by accident. Never /tmp -- tmpfs on this host, emptied only on reboot.
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase33");

// $EA31 is the KERNAL IRQ entry: a once-per-frame exec anchor that MEASURABLY
// still executes after `danish`'s load (400 hits reached, 33-RESEARCH.md M6).
// It is used here as this release's frame anchor and is DELIBERATELY NOT
// promoted to a default -- D-14's refusal-when-`frame_anchor`-is-absent stands
// precisely because a cracked release almost always takes over the IRQ.
const FRAME_ANCHOR = 0xea31;

// --- wire constants ----------------------------------------------------------

const VICE_STX = 0x02;
const VICE_API_VERSION = 0x02;
const BROADCAST_REQUEST_ID = 0xffffffff;
const REQUEST_HEADER_LEN = 11;
const RESPONSE_HEADER_LEN = 12;

const Cmd = {
  MemoryGet: 0x01,
  CheckpointSet: 0x12,
  CheckpointDelete: 0x13,
  CheckpointList: 0x14,
  RegistersGet: 0x31,
  Dump: 0x41,
  ResourceGet: 0x51,
  Ping: 0x81,
  RegistersAvailable: 0x83,
  Exit: 0xaa,
  Reset: 0xcc,
  AutoStart: 0xdd,
};

const Res = {
  CheckpointInfo: 0x11,
  CheckpointList: 0x14,
  RegisterInfo: 0x31,
  Dump: 0x41,
  ResourceGet: 0x51,
  Jam: 0x61,
  Stopped: 0x62,
  Resumed: 0x63,
  Ping: 0x81,
  RegistersAvailable: 0x83,
  Exit: 0xaa,
  Reset: 0xcc,
  AutoStart: 0xdd,
};

const CheckpointOperation = { Load: 0x01, Store: 0x02, Exec: 0x04 };

// --- body encoders (mirrors of stock-protocol.ts, import-free by design) -----

/** The wire memspace byte is NOT VICE's internal enum (monitor_binary.c:401-434):
 *  0x00 main, 0x01-0x04 units 8-11, and 0x08 is REJECTED by the monitor. Every
 *  checkpoint below routes its memspace through here (T-33-17) rather than
 *  writing body[8] directly. */
function memspaceByte(memspace) {
  if (memspace === undefined) return 0x00;
  if (!Number.isInteger(memspace) || memspace < 0x00 || memspace > 0x04) {
    throw new Error(
      `memspace byte must be 0x00 (main) or 0x01-0x04 (units 8-11); 0x08 is rejected by the monitor. Got ${memspace}`,
    );
  }
  return memspace;
}

function encodeRequest(commandType, requestId, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(REQUEST_HEADER_LEN);
  header[0] = VICE_STX;
  header[1] = VICE_API_VERSION;
  header.writeUInt32LE(body.length >>> 0, 2);
  header.writeUInt32LE(requestId >>> 0, 6);
  header[10] = commandType;
  return Buffer.concat([header, body]);
}

function checkpointSetBody({ start, end, stop = true, enabled = true, operation, temporary = false, memspace }) {
  const withMemspace = memspace !== undefined;
  const body = Buffer.alloc(withMemspace ? 9 : 8);
  body.writeUInt16LE(start, 0);
  body.writeUInt16LE(end, 2);
  body[4] = stop ? 0x01 : 0x00;
  body[5] = enabled ? 0x01 : 0x00;
  body[6] = operation;
  body[7] = temporary ? 0x01 : 0x00;
  if (withMemspace) body[8] = memspaceByte(memspace);
  return body;
}

function memspaceBody(memspace) {
  return Buffer.from([memspaceByte(memspace)]);
}

function cpNumBody(checkpointNum) {
  const body = Buffer.alloc(4);
  body.writeUInt32LE(checkpointNum >>> 0, 0);
  return body;
}

function resetBody(mode) {
  return Buffer.from([mode]);
}

function autostartBody({ runAfter, fileIndex = 0, filename }) {
  const nameBuf = Buffer.from(filename, "ascii");
  const body = Buffer.alloc(1 + 2 + 1 + nameBuf.length);
  body[0] = runAfter ? 0x01 : 0x00;
  body.writeUInt16LE(fileIndex, 1);
  body[3] = nameBuf.length;
  nameBuf.copy(body, 4);
  return body;
}

function dumpBody({ saveRoms, saveDisks, filename }) {
  const nameBuf = Buffer.from(filename, "ascii");
  const body = Buffer.alloc(1 + 1 + 1 + nameBuf.length);
  body[0] = saveRoms ? 0x01 : 0x00;
  body[1] = saveDisks ? 0x01 : 0x00;
  body[2] = nameBuf.length;
  nameBuf.copy(body, 3);
  return body;
}

function resourceGetBody(name) {
  const nameBuf = Buffer.from(name, "ascii");
  const body = Buffer.alloc(1 + nameBuf.length);
  body[0] = nameBuf.length;
  nameBuf.copy(body, 1);
  return body;
}

// --- response parsing --------------------------------------------------------

function parseFrame(responseType, errorCode, requestId, body) {
  switch (responseType) {
    case Res.CheckpointInfo: {
      if (body.length < 22) return { kind: "short_checkpoint_info", responseType, errorCode, requestId };
      return {
        kind: "checkpoint_info",
        responseType,
        errorCode,
        requestId,
        id: body.readUInt32LE(0),
        currentlyHit: body[4] === 1,
        start: body.readUInt16LE(5),
        end: body.readUInt16LE(7),
        stopWhenHit: body[9] === 1,
        enabled: body[10] === 1,
        operation: body[11],
        temporary: body[12] === 1,
        // hit_count is at offset 13, NOT 12. Offset 12 is `temporary`; reading
        // a u32LE from 12 yields 256 where the truth is 1.
        hitCount: body.readUInt32LE(13),
        ignoreCount: body.readUInt32LE(17),
        hasCondition: body[21] === 1,
      };
    }
    case Res.CheckpointList:
      return { kind: "checkpoint_list", responseType, errorCode, requestId, total: body.readUInt32LE(0) };
    case Res.RegisterInfo: {
      const count = body.readUInt16LE(0);
      let off = 2;
      const registers = [];
      for (let i = 0; i < count; i += 1) {
        const itemSize = body[off];
        registers.push({ id: body[off + 1], value: body.readUInt16LE(off + 2) });
        off += itemSize + 1;
      }
      return { kind: "registers", responseType, errorCode, requestId, registers };
    }
    // REGISTERS_AVAILABLE (0x83) is the catalog PC/LIN/CYC ids are resolved
    // from BY NAME -- no id literal for those three appears in this file.
    case Res.RegistersAvailable: {
      const count = body.readUInt16LE(0);
      let off = 2;
      const registers = [];
      for (let i = 0; i < count; i += 1) {
        const itemSize = body[off];
        const id = body[off + 1];
        const size = body[off + 2];
        const nameLen = body[off + 3];
        const name = body.subarray(off + 4, off + 4 + nameLen).toString("ascii");
        registers.push({ id, size, name });
        off += itemSize + 1;
      }
      return { kind: "registers_available", responseType, errorCode, requestId, registers };
    }
    case Res.ResourceGet: {
      const type = body[0];
      const len = body[1];
      const raw = body.subarray(2, 2 + len);
      const value = type === 0x00 ? raw.toString("ascii") : len === 4 ? raw.readUInt32LE(0) : Array.from(raw);
      return { kind: "resource", responseType, errorCode, requestId, value };
    }
    // JAM (0x61) has a ZERO-LENGTH body: monitor_binary.c:384-394 computes the
    // PC then passes length = 0, so no PC is sent. Every surveyed client
    // assumes 2 bytes and breaks on it.
    case Res.Jam:
      return { kind: "jam", responseType, errorCode, requestId };
    case Res.Stopped:
      return { kind: "stopped", responseType, errorCode, requestId, pc: body.length >= 2 ? body.readUInt16LE(0) : null };
    case Res.Resumed:
      return { kind: "resumed", responseType, errorCode, requestId, pc: body.length >= 2 ? body.readUInt16LE(0) : null };
    default:
      return { kind: "other", responseType, errorCode, requestId, bodyLength: body.length };
  }
}

const UNSOLICITED_KINDS = new Set(["stopped", "resumed", "jam"]);

class Monitor {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.nextRequestId = 1;
    this.pending = new Map();
    this.eventLog = [];
    this.eventHandlers = new Set();
    this.closed = false;
    socket.on("data", (chunk) => this.#onData(chunk));
    socket.on("close", () => {
      this.closed = true;
      for (const [, p] of this.pending) p.reject(new Error("monitor socket closed with a request in flight"));
      this.pending.clear();
    });
    socket.on("error", () => {});
  }

  #onData(chunk) {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    let off = 0;
    while (off + RESPONSE_HEADER_LEN <= this.buffer.length) {
      if (this.buffer[off] !== VICE_STX) {
        off += 1;
        continue;
      }
      const bodyLength = this.buffer.readUInt32LE(off + 2);
      const frameLength = RESPONSE_HEADER_LEN + bodyLength;
      if (off + frameLength > this.buffer.length) break;
      const responseType = this.buffer[off + 6];
      const errorCode = this.buffer[off + 7];
      const requestId = this.buffer.readUInt32LE(off + 8);
      const body = this.buffer.subarray(off + RESPONSE_HEADER_LEN, off + frameLength);
      this.#dispatch(parseFrame(responseType, errorCode, requestId, body));
      off += frameLength;
    }
    this.buffer = this.buffer.subarray(off);
  }

  // Demux BY REQUEST ID. An unsolicited event NEVER resolves a pending
  // request: CHECKPOINT_INFO (0x11) and REGISTER_INFO (0x31) each share a
  // response type with a legitimate command reply, so type alone cannot tell
  // an event from a reply.
  #dispatch(frame) {
    if (frame.requestId === BROADCAST_REQUEST_ID) {
      this.eventLog.push(frame);
      for (const h of this.eventHandlers) h(frame);
      return;
    }
    const p = this.pending.get(frame.requestId);
    if (!p) {
      this.eventLog.push({ ...frame, orphan: true });
      return;
    }
    // CHECKPOINT_LIST is N+1-shaped: every interim CHECKPOINT_INFO under the
    // same request id is a list item, and the terminal CHECKPOINT_LIST reply
    // is what resolves.
    if (p.commandType === Cmd.CheckpointList && frame.kind === "checkpoint_info") {
      p.related.push(frame);
      return;
    }
    this.pending.delete(frame.requestId);
    clearTimeout(p.timer);
    p.resolve({ ...frame, related: p.related });
  }

  send(commandType, body = Buffer.alloc(0), { timeoutMs = 20000 } = {}) {
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`command 0x${commandType.toString(16)} (request ${requestId}) timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(requestId, { commandType, resolve, reject, related: [], timer });
      this.socket.write(encodeRequest(commandType, requestId, body));
    });
  }

  /** EXIT (0xaa) is fire-and-forget in this probe: on a resume the monitor
   *  answers with an EXIT reply, but a stopping checkpoint can fire before it
   *  lands, so waiting on the reply would serialise against the hit. */
  resume() {
    this.socket.write(encodeRequest(Cmd.Exit, this.nextRequestId++));
  }

  onEvent(handler) {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  close() {
    try {
      this.socket.destroy();
    } catch {}
  }
}

// --- launch ------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** T-33-04: a fixed literal flag list with ONLY the port interpolated.
 *  `-default` MUST be index 0 and `-console` MUST be index 1 (P1/P5).
 *  `+autostart-delay-random` is a FIFTH flag beyond REPRO-01's four and is
 *  called out here rather than smuggled in: the resource ships at 1 (measured),
 *  it draws up to 10 frames of random delay, AND it selects WHICH
 *  keyboard-buffer feed injects `RUN` (`kbdbuf_feed_runcmd` vs `kbdbuf_feed`,
 *  autostart.c:882-886) -- a behavioural change, not only a timing one. */
/** `-initbreak reset` (MEASURED present on 3.9: `-initbreak <address>, ready,
 *  or reset`) is a SIXTH flag beyond `+autostart-delay-random`, opt-in here so
 *  the default argv stays exactly the list this plan set out to test.
 *
 *  Why it exists at all, measured in this file: the anchor count from
 *  AUTOSTART's power cycle is frame-exact up to hit 50 and diverges by hit 100
 *  -- the disk-load window -- because the power cycle resets the CPU, VIC-II
 *  and CIAs but NOT the absolute emulated clock, and the drive's rotational
 *  phase is a function of that clock. The pre-protocol jitter therefore leaks
 *  into the load's byte timing. `-initbreak reset` halts the machine AT reset,
 *  before it has run any cycles, so the absolute clock at the moment the
 *  protocol takes control is the same regardless of when the client connects. */
function buildArgv(port, { warp = false, initbreak = false } = {}) {
  const argv = [
    "-default",
    "-console",
    "-drive8type",
    "1541",
    "-seed",
    "4242",
    "-raminitstartrandom",
    "0",
    "-raminitrepeatrandom",
    "0",
    "-raminitrandomchance",
    "0",
    "+autostart-delay-random",
  ];
  if (initbreak) argv.push("-initbreak", "reset");
  if (warp) argv.push("-warp");
  argv.push("-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`);
  return argv;
}

async function launch({ warp = false, initbreak = false } = {}) {
  const port = await freePort();
  const argv = buildArgv(port, { warp, initbreak });
  const child = spawn(VICE_BIN, argv, { stdio: ["ignore", "pipe", "pipe"] });
  LAUNCHED.add(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => {
    stdout += d.toString();
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  let exited = null;
  child.on("exit", (code, signal) => {
    exited = { code, signal };
  });
  return {
    port,
    argv,
    child,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    get exited() {
      return exited;
    },
    kill() {
      try {
        child.kill("SIGKILL");
      } catch {}
      LAUNCHED.delete(child);
    },
  };
}

async function connectMonitor(port, { budgetMs = 20000 } = {}) {
  const deadline = Date.now() + budgetMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const socket = await new Promise((resolve, reject) => {
        const s = net.createConnection({ host: "127.0.0.1", port });
        s.once("connect", () => resolve(s));
        s.once("error", reject);
      });
      socket.setNoDelay(true);
      return { monitor: new Monitor(socket), timeToBindMs: budgetMs - (deadline - Date.now()) };
    } catch (err) {
      lastErr = err;
      await sleep(100);
    }
  }
  throw new Error(`monitor port ${port} never accepted a connection within ${budgetMs} ms: ${lastErr?.message}`);
}

// --- register helpers --------------------------------------------------------

/** Resolve register ids from the REGISTERS_AVAILABLE (0x83) catalog BY NAME.
 *  Hardcoding 3/53/54 would silently mis-read on any build whose catalog
 *  differs, and these values feed the stop-identity oracle. */
async function registerIds(monitor) {
  const reply = await monitor.send(Cmd.RegistersAvailable, memspaceBody(0x00));
  const byName = new Map(reply.registers.map((r) => [r.name.toUpperCase(), r.id]));
  const catalog = reply.registers.map((r) => `${r.id}:${r.name}(${r.size}b)`).join(" ");
  const need = ["PC", "LIN", "CYC"];
  for (const n of need) {
    if (!byName.has(n)) throw new Error(`REGISTERS_AVAILABLE catalog has no register named ${n}: ${catalog}`);
  }
  return { byName, catalog };
}

async function readStopIdentity(monitor, ids) {
  const reply = await monitor.send(Cmd.RegistersGet, memspaceBody(0x00));
  const byId = new Map(reply.registers.map((r) => [r.id, r.value]));
  const get = (name) => byId.get(ids.byName.get(name));
  return {
    pc: get("PC"),
    lin: get("LIN"),
    cyc: get("CYC"),
    p00: ids.byName.has("00") ? byId.get(ids.byName.get("00")) : null,
    p01: ids.byName.has("01") ? byId.get(ids.byName.get("01")) : null,
  };
}

function hex4(n) {
  return n === null || n === undefined ? "??" : `$${n.toString(16).padStart(4, "0")}`;
}

// --- anchor arming and hit counting -----------------------------------------

/** Arm the frame anchor. `stop: true` always (T-33-10). `memspace: 0x00`
 *  through `memspaceByte()` always (T-33-17). */
async function armAnchor(monitor, { address = FRAME_ANCHOR, temporary = false } = {}) {
  const reply = await monitor.send(
    Cmd.CheckpointSet,
    checkpointSetBody({
      start: address,
      end: address,
      stop: true,
      enabled: true,
      operation: CheckpointOperation.Exec,
      temporary,
      memspace: 0x00,
    }),
  );
  return reply;
}

/**
 * Count `target` hits of checkpoint `cpId`, resuming once per observed hit.
 *
 * A `stop: true` checkpoint halts the machine on every hit, so counting N hits
 * needs N resumes -- that is the stock-native form of `vice-sync.ts`'s "exactly
 * one resume per wait" invariant, applied per wait rather than per count. The
 * loop polls on `hit_count` (never on paused state), which is the other half of
 * that invariant, and hit_count is read at CHECKPOINT_INFO body offset 13.
 */
function countHits(monitor, cpId, target, { budgetMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    let last = 0;
    const timer = setTimeout(() => {
      off();
      resolve({ reached: false, hits: last, reason: `budget ${budgetMs} ms exhausted at ${last} of ${target} hits` });
    }, budgetMs);
    const off = monitor.onEvent((frame) => {
      if (frame.kind === "jam") {
        clearTimeout(timer);
        off();
        resolve({ reached: false, hits: last, reason: "JAM (0x61, zero-length body) -- CPU jammed" });
        return;
      }
      if (frame.kind !== "checkpoint_info" || frame.id !== cpId) return;
      last = frame.hitCount;
      if (last >= target) {
        clearTimeout(timer);
        off();
        resolve({ reached: true, hits: last, reason: null });
        return;
      }
      monitor.resume();
    });
    monitor.resume();
  });
}

/** Free-run a recorded wall-clock interval, absorbing every stop the machine
 *  reports. Used only where the sequence under test deliberately has no anchor
 *  armed yet (the load window) or where the control being measured IS
 *  wall-clock-anchored. */
async function freeRun(monitor, ms) {
  monitor.resume();
  await sleep(ms);
}

async function snapshot(monitor, filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const reply = await monitor.send(Cmd.Dump, dumpBody({ saveRoms: false, saveDisks: false, filename }), {
    timeoutMs: 60000,
  });
  return reply;
}

// --- strict .vsf module walk + C64MEM slice ---------------------------------
//
// FIRST_MODULE_OFFSET is 58, computed from named constants -- NOT the
// prototype's 37, which lands inside the "VICE Version\x1a" block (P2). The
// walk advances by the module's own declared size and refuses a malformed
// header rather than resyncing, then asserts it ended exactly at file length.

const SNAPSHOT_MAGIC = "VICE Snapshot File\x1a"; // 19
const SNAPSHOT_MACHINE_NAME_LEN = 16;
const SNAPSHOT_VERSION_MAGIC_LEN = 13; // "VICE Version\x1a"
const FIRST_MODULE_OFFSET = SNAPSHOT_MAGIC.length + 2 + SNAPSHOT_MACHINE_NAME_LEN + SNAPSHOT_VERSION_MAGIC_LEN + 4 + 4;
const MODULE_HEADER_LEN = 22; // name(16) major(1) minor(1) size(u32LE)
const RAM_OFFSET = 4; // pport.data, pport.dir, EXROM, GAME
const RAM_SIZE = 65536;
const MIN_C64MEM_BODY_LEN = RAM_OFFSET + RAM_SIZE + 3; // 65543, snapshot minor 0
const V01_C64MEM_BODY_LEN = MIN_C64MEM_BODY_LEN + 4 + 4 + 4; // 65555, snapshot minor 1

function sliceC64Mem(file) {
  let off = FIRST_MODULE_OFFSET;
  const modules = [];
  let found = null;
  while (off + MODULE_HEADER_LEN <= file.length) {
    const name = file.subarray(off, off + 16).toString("latin1").replace(/\0+$/, "");
    const major = file[off + 16];
    const minor = file[off + 17];
    const size = file.readUInt32LE(off + 18);
    if (size < MODULE_HEADER_LEN || off + size > file.length) {
      throw new Error(
        `vsf walk: malformed module header at offset ${off} (name=${JSON.stringify(name)}, size=${size}) -- refusing rather than resyncing`,
      );
    }
    modules.push({ off, name, major, minor, size });
    if (name === "C64MEM") {
      const body = file.subarray(off + MODULE_HEADER_LEN, off + size);
      // D-21's original `body.length === 4 + 65536` would refuse EVERY real
      // snapshot: the measured body is 65555 (minor 1) or 65543 (minor 0).
      if (body.length < MIN_C64MEM_BODY_LEN) {
        throw new Error(`vsf walk: C64MEM body is ${body.length} bytes, need at least ${MIN_C64MEM_BODY_LEN}`);
      }
      const ram = Buffer.from(body.subarray(RAM_OFFSET, RAM_OFFSET + RAM_SIZE));
      // The CPU-visible port values live in the 3-byte SUFFIX after the RAM
      // array, not in the 4-byte prefix, and $0000 is DIRECTION while $0001 is
      // DATA (P3 / D-24 as amended).
      const dataRead = body[RAM_OFFSET + RAM_SIZE + 1];
      const dirRead = body[RAM_OFFSET + RAM_SIZE + 2];
      ram[0x0000] = dirRead;
      ram[0x0001] = dataRead;
      found = { ram, bodyLength: body.length, minorSeen: body.length === V01_C64MEM_BODY_LEN ? 1 : 0 };
    }
    off += size; // NEVER off++
  }
  if (off !== file.length) {
    throw new Error(`vsf walk: ended at ${off}, file length is ${file.length} -- walk did not consume the file exactly`);
  }
  if (!found) throw new Error("vsf walk: no C64MEM module found");
  return { ...found, modules, endedAt: off };
}

function diffImages(a, b) {
  const addrs = [];
  for (let i = 0; i < RAM_SIZE; i += 1) if (a[i] !== b[i]) addrs.push(i);
  return addrs;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// --- environment banner ------------------------------------------------------

function log(...parts) {
  process.stdout.write(`${parts.join(" ")}\n`);
}

/**
 * D-11 IN CODE, not in shell discipline.
 *
 * Every live run in this phase must be taken with the VICE broker stopped and
 * no other `x64sc` alive, because a live broker reddens the BACK-05 assertion
 * deterministically and any concurrent emulator competes for the host
 * scheduler -- which is what decides the halt moment, which is what decides
 * the stop identity past the start of a disk load.
 *
 * This ran as a shell habit first and FAILED: five `-initbreak reset` runs
 * threw before `closeRun()` and orphaned their emulators, which then sat
 * halted in the monitor for sixteen minutes while later measurements were
 * taken. Those measurements were voided and re-run. The guard belongs here, in
 * the one place no invocation can forget it.
 *
 * `pgrep -x x64sc` (exact match), NOT `pgrep -af x64sc` -- the `-af` form
 * matches the checking shell's own command line and always reports a false
 * positive.
 */
function preflight() {
  let broker = "unknown";
  try {
    broker = execFileSync("systemctl", ["--user", "is-active", "vice-broker"], { encoding: "utf8" }).trim();
  } catch (err) {
    broker = (err.stdout ?? "").trim() || "inactive";
  }
  let alive = "";
  try {
    alive = execFileSync("pgrep", ["-x", "x64sc"], { encoding: "utf8" }).trim();
  } catch {
    alive = ""; // pgrep exits 1 with no match
  }
  log(`PREFLIGHT_BROKER ${broker}`);
  log(`PREFLIGHT_X64SC ${alive ? alive.split("\n").join(",") : "(none)"}`);
  if (broker !== "inactive") {
    throw new Error(`D-11 REFUSAL: vice-broker is "${broker}", expected "inactive". Measurement not taken.`);
  }
  if (alive) {
    throw new Error(
      `D-11 REFUSAL: ${alive.split("\n").length} other x64sc process(es) alive (${alive.split("\n").join(",")}). Measurement not taken.`,
    );
  }
}

// Every launched child is registered here so no throw can orphan one. The
// orphan episode above is exactly what this exists for.
const LAUNCHED = new Set();
function reapAll() {
  for (const child of LAUNCHED) {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
  LAUNCHED.clear();
}
process.on("exit", reapAll);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    reapAll();
    process.exit(130);
  });
}

function banner(mode) {
  preflight();
  log(`PROBE_MODE ${mode}`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`RELEASE ${RELEASE}`);
  log(`RELEASE_SHA256 ${sha256(fs.readFileSync(RELEASE))}`);
  log(`NODE ${process.version}`);
  log(`DATE_UTC ${new Date().toISOString()}`);
}

// --- shared run scaffolding --------------------------------------------------

/**
 * Launch, wait `jitterMs` (PRE-protocol jitter -- it shifts the moment the
 * monitor connect halts the machine, which is the whole point), connect, then
 * hand the caller a halted machine.
 */
async function openRun({ jitterMs = 0, warp = false, initbreak = false, mode }) {
  const inst = await launch({ warp, initbreak });
  log(`ARGV ${JSON.stringify(inst.argv)}`);
  log(`ARGV_INDEX_0 ${inst.argv[0]}`);
  log(`ARGV_INDEX_1 ${inst.argv[1]}`);
  log(`JITTER_MS ${jitterMs}`);
  if (jitterMs > 0) await sleep(jitterMs);
  const t0 = Date.now();
  const { monitor } = await connectMonitor(inst.port);
  log(`CONNECTED_AFTER_MS ${Date.now() - t0}`);
  // Connecting opens the monitor and halts the machine: REGISTER_INFO (0x31)
  // then STOPPED (0x62) both arrive at request id 0xffffffff.
  await sleep(400);
  log(`OPEN_EVENTS ${monitor.eventLog.map((f) => f.kind).join(",") || "(none)"}`);
  // The listen backlog accepts a connection before the monitor is servicing
  // it, so an accepted socket is NOT a serving monitor. PING (0x81) with a
  // short budget, retried, is the readiness signal -- MEASURED under
  // `-initbreak reset`, where a connection accepted at ~2.5 s left
  // REGISTERS_AVAILABLE unanswered for the full 20 s command budget.
  let pings = 0;
  for (;;) {
    pings += 1;
    try {
      await monitor.send(Cmd.Ping, Buffer.alloc(0), { timeoutMs: 3000 });
      break;
    } catch (err) {
      if (pings >= 8) throw new Error(`monitor accepted the socket but never answered PING after ${pings} attempts: ${err.message}`);
      await sleep(500);
    }
  }
  log(`MONITOR_READY_AFTER_PINGS ${pings}`);
  const ids = await registerIds(monitor);
  log(`REGISTER_CATALOG ${ids.catalog}`);
  const drive8 = await monitor.send(Cmd.ResourceGet, resourceGetBody("Drive8TrueEmulation"));
  const drive8type = await monitor.send(Cmd.ResourceGet, resourceGetBody("Drive8Type"));
  const delayRandom = await monitor.send(Cmd.ResourceGet, resourceGetBody("AutostartDelayRandom"));
  log(`RESOURCE Drive8TrueEmulation=${drive8.value} Drive8Type=${drive8type.value} AutostartDelayRandom=${delayRandom.value}`);
  return { inst, monitor, ids, mode };
}

async function closeRun(run, { snapshotName = null } = {}) {
  let vsfPath = null;
  if (snapshotName) {
    vsfPath = path.join(PROBE_DIR, snapshotName);
    try {
      const reply = await snapshot(run.monitor, vsfPath);
      const size = fs.existsSync(vsfPath) ? fs.statSync(vsfPath).size : 0;
      log(`SNAPSHOT ${vsfPath} err=0x${reply.errorCode.toString(16).padStart(2, "0")} size=${size}`);
    } catch (err) {
      log(`SNAPSHOT_FAILED ${vsfPath} ${err.message}`);
      vsfPath = null;
    }
  }
  run.monitor.close();
  run.inst.kill();
  await sleep(300);
  const so = run.inst.stdout.trim();
  const se = run.inst.stderr.trim();
  log(`CHILD_EXIT ${JSON.stringify(run.inst.exited)}`);
  if (so) log(`CHILD_STDOUT<<<\n${so}\n>>>`);
  if (se) log(`CHILD_STDERR<<<\n${se}\n>>>`);
  return vsfPath;
}

async function autostart(monitor) {
  const reply = await monitor.send(Cmd.AutoStart, autostartBody({ runAfter: true, fileIndex: 0, filename: RELEASE }), {
    timeoutMs: 30000,
  });
  return reply;
}

// --- S1: does a checkpoint armed before AUTOSTART survive its power cycle? ---
//
// The question can only be answered by arming one FIRST, so the sequence is
// connect (halts) -> arm the anchor -> AUTOSTART (0xdd) -> IMMEDIATELY
// CHECKPOINT_LIST (0x14). One observed reply settles it; no inference.

async function runS1() {
  banner("s1");
  const run = await openRun({ jitterMs: 0, mode: "s1" });
  const { monitor } = run;

  const before = await monitor.send(Cmd.CheckpointList, Buffer.alloc(0));
  log(`CHECKPOINT_LIST_BEFORE_ARM total=${before.total} items=${before.related.length}`);

  const armed = await armAnchor(monitor, { temporary: false });
  log(
    `ARMED_BEFORE_AUTOSTART cp=${armed.id} start=${hex4(armed.start)} stop=${armed.stopWhenHit} enabled=${armed.enabled} temporary=${armed.temporary} hits=${armed.hitCount} err=0x${armed.errorCode.toString(16).padStart(2, "0")}`,
  );

  const listArmed = await monitor.send(Cmd.CheckpointList, Buffer.alloc(0));
  log(`CHECKPOINT_LIST_AFTER_ARM total=${listArmed.total} items=${listArmed.related.length}`);
  for (const cp of listArmed.related) {
    log(`  CP id=${cp.id} start=${hex4(cp.start)} end=${hex4(cp.end)} stop=${cp.stopWhenHit} enabled=${cp.enabled} op=0x${cp.operation.toString(16)} temporary=${cp.temporary} hits=${cp.hitCount}`);
  }

  const as = await autostart(monitor);
  log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")} responseType=0x${as.responseType.toString(16)}`);

  // IMMEDIATELY -- this is the whole point of S1.
  const listAfter = await monitor.send(Cmd.CheckpointList, Buffer.alloc(0));
  log(`CHECKPOINT_LIST_AFTER_AUTOSTART total=${listAfter.total} items=${listAfter.related.length}`);
  for (const cp of listAfter.related) {
    log(`  CP id=${cp.id} start=${hex4(cp.start)} end=${hex4(cp.end)} stop=${cp.stopWhenHit} enabled=${cp.enabled} op=0x${cp.operation.toString(16)} temporary=${cp.temporary} hits=${cp.hitCount}`);
  }
  log(`S1_SURVIVAL ${listAfter.total > 0 ? "checkpoint-survives-autostart-power-cycle" : "checkpoint-gone-after-autostart"}`);
  log(`EVENTS_SO_FAR ${monitor.eventLog.map((f) => f.kind).join(",") || "(none)"}`);

  await closeRun(run);
}

// --- S2: arm AFTER the autostart reply, count from there ---------------------

async function runS2({ jitterMs, loadMs = 20000, target = 400, label = "s2" }) {
  banner(`s2 label=${label}`);
  const run = await openRun({ jitterMs, mode: "s2" });
  const { monitor, ids } = run;

  const as = await autostart(monitor);
  log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);

  // Let the load run. AUTOSTART's own power cycle IS the reset (P11) -- no
  // RESET 1 is issued anywhere in this sequence, because a RESET after
  // AUTOSTART would undo the autostart.
  log(`FREE_RUN_MS ${loadMs}`);
  await freeRun(monitor, loadMs);

  // Re-halt so the anchor is armed on a stopped machine.
  const ping = await monitor.send(Cmd.Ping, Buffer.alloc(0));
  log(`PING err=0x${ping.errorCode.toString(16).padStart(2, "0")}`);
  const armed = await armAnchor(monitor, { temporary: false });
  log(`ARMED_AFTER_LOAD cp=${armed.id} start=${hex4(armed.start)} stop=${armed.stopWhenHit} temporary=${armed.temporary} hits=${armed.hitCount}`);

  const counted = await countHits(monitor, armed.id, target);
  log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);

  const stop = await readStopIdentity(monitor, ids);
  log(
    `RUN ${label} jitter=${jitterMs} asErr=${as.errorCode} cpErr=${armed.errorCode} hits=${counted.hits} PC=${hex4(stop.pc)} LIN=${stop.lin} CYC=${stop.cyc} $00=${stop.p00} $01=${stop.p01}`,
  );

  const vsf = await closeRun(run, { snapshotName: `${label}-j${jitterMs}.vsf` });
  log(`VSF ${vsf ?? "(none)"}`);
}

// --- S3: arm while halted, BEFORE AUTOSTART ---------------------------------

async function runS3({ jitterMs, target = 400, label = "s3", initbreak = false, warp = false }) {
  banner(`s3 label=${label} initbreak=${initbreak} warp=${warp}`);
  const run = await openRun({ jitterMs, initbreak, warp, mode: "s3" });
  const { monitor, ids } = run;

  const armed = await armAnchor(monitor, { temporary: false });
  log(`ARMED_BEFORE_AUTOSTART cp=${armed.id} start=${hex4(armed.start)} stop=${armed.stopWhenHit} temporary=${armed.temporary}`);

  const as = await autostart(monitor);
  log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);

  const counted = await countHits(monitor, armed.id, target, { budgetMs: 90000 });
  log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);

  const stop = await readStopIdentity(monitor, ids);
  log(
    `RUN ${label} jitter=${jitterMs} asErr=${as.errorCode} cpErr=${armed.errorCode} hits=${counted.hits} PC=${hex4(stop.pc)} LIN=${stop.lin} CYC=${stop.cyc} $00=${stop.p00} $01=${stop.p01}`,
  );

  const vsf = await closeRun(run, { snapshotName: `${label}-j${jitterMs}.vsf` });
  log(`VSF ${vsf ?? "(none)"}`);
}

// --- S4: hit-count OFFSET from a post-load baseline --------------------------
//
// If S2 works but is not repeatable across jitters, the absolute hit total is
// the wrong counter: record the anchor's hit count at the moment the load
// completes and count a fixed OFFSET from there instead.

async function runS4({ jitterMs, loadMs = 20000, offset = 200, label = "s4" }) {
  banner(`s4 label=${label}`);
  const run = await openRun({ jitterMs, mode: "s4" });
  const { monitor, ids } = run;

  const as = await autostart(monitor);
  log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);

  // Arm the anchor immediately after the autostart reply, then free-run the
  // load with the anchor already counting. Because the checkpoint stops the
  // machine on every hit, the load window is driven by resumes rather than by
  // wall clock: the baseline is the hit count observed when the load-window
  // budget expires, and the target is baseline + offset. The BASELINE is still
  // wall-clock-derived -- which is exactly why S4 is a fallback and not the
  // preferred sequence.
  const armed = await armAnchor(monitor, { temporary: false });
  log(`ARMED_AFTER_AUTOSTART_REPLY cp=${armed.id} start=${hex4(armed.start)} hits=${armed.hitCount}`);

  const baseline = await countHits(monitor, armed.id, Number.MAX_SAFE_INTEGER, { budgetMs: loadMs });
  log(`BASELINE_AT_LOAD_WINDOW_END hits=${baseline.hits} window_ms=${loadMs} reason=${baseline.reason ?? "-"}`);

  const target = baseline.hits + offset;
  const counted = await countHits(monitor, armed.id, target);
  log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} offset=${offset} reason=${counted.reason ?? "-"}`);

  const stop = await readStopIdentity(monitor, ids);
  log(
    `RUN ${label} jitter=${jitterMs} asErr=${as.errorCode} cpErr=${armed.errorCode} hits=${counted.hits} baseline=${baseline.hits} PC=${hex4(stop.pc)} LIN=${stop.lin} CYC=${stop.cyc} $00=${stop.p00} $01=${stop.p01}`,
  );

  const vsf = await closeRun(run, { snapshotName: `${label}-j${jitterMs}.vsf` });
  log(`VSF ${vsf ?? "(none)"}`);
}

// --- Control A: wall-clock anchoring, expected RED ---------------------------

async function runControlA({ jitterMs, waitMs = 20000, target = 400, label }) {
  banner(`controlA label=${label}`);
  const run = await openRun({ jitterMs, mode: "controlA" });
  const { monitor, ids } = run;

  const as = await autostart(monitor);
  log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);

  // THE THING UNDER TEST: the stop is anchored to a WALL-CLOCK interval after
  // the autostart, not to a counted frame anchor from the power cycle.
  log(`WALLCLOCK_WAIT_MS ${waitMs}`);
  await freeRun(monitor, waitMs);

  const ping = await monitor.send(Cmd.Ping, Buffer.alloc(0));
  log(`PING err=0x${ping.errorCode.toString(16).padStart(2, "0")}`);
  const armed = await armAnchor(monitor, { temporary: false });
  log(`ARMED_AFTER_WALLCLOCK_WAIT cp=${armed.id} start=${hex4(armed.start)} hits=${armed.hitCount}`);

  const counted = await countHits(monitor, armed.id, target);
  log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);

  const stop = await readStopIdentity(monitor, ids);
  log(
    `RUN ${label} jitter=${jitterMs} asErr=${as.errorCode} cpErr=${armed.errorCode} hits=${counted.hits} PC=${hex4(stop.pc)} LIN=${stop.lin} CYC=${stop.cyc} $00=${stop.p00} $01=${stop.p01}`,
  );

  const vsf = await closeRun(run, { snapshotName: `${label}.vsf` });
  log(`VSF ${vsf ?? "(none)"}`);
}

// --- Control B: warp-invalidated wall-clock bracket, expected RED ------------

async function runControlB({ jitterMs = 0, bracketMs = 20000, target = 400, label = "warp-bracket" }) {
  banner(`controlB label=${label}`);
  const run = await openRun({ jitterMs, warp: true, mode: "controlB" });
  const { monitor, ids } = run;

  const as = await autostart(monitor);
  log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);

  // The bracket budget below is sized for an UNWARPED run. Under -warp the
  // emulated machine advances far faster than the wall clock the bracket is
  // measuring, so a bracket calibrated unwarped either overshoots the region
  // entirely or times out with the region already past.
  log(`BRACKET_BUDGET_MS ${bracketMs} (calibrated for an UNWARPED run)`);
  const t0 = Date.now();
  await freeRun(monitor, bracketMs);
  const elapsed = Date.now() - t0;

  const ping = await monitor.send(Cmd.Ping, Buffer.alloc(0));
  log(`PING err=0x${ping.errorCode.toString(16).padStart(2, "0")}`);
  const armed = await armAnchor(monitor, { temporary: false });
  log(`ARMED_AFTER_BRACKET cp=${armed.id} start=${hex4(armed.start)} hits=${armed.hitCount}`);

  // A short counting budget on purpose: the question is whether the bracket
  // lands in the intended region at all, and a bracket that has already
  // overshot shows up as a spurious timeout here.
  const counted = await countHits(monitor, armed.id, target, { budgetMs: 30000 });
  log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);
  log(`BRACKET_WALLCLOCK_ELAPSED_MS ${elapsed}`);
  log(`BRACKET_TIMED_OUT ${counted.reached ? "no" : "yes"}`);

  const stop = await readStopIdentity(monitor, ids);
  log(
    `RUN ${label} jitter=${jitterMs} warp=yes asErr=${as.errorCode} cpErr=${armed.errorCode} hits=${counted.hits} PC=${hex4(stop.pc)} LIN=${stop.lin} CYC=${stop.cyc} $00=${stop.p00} $01=${stop.p01}`,
  );

  const vsf = await closeRun(run, { snapshotName: `${label}.vsf` });
  log(`VSF ${vsf ?? "(none)"}`);
}

// --- warp isolation ----------------------------------------------------------
//
// Does `-warp` accelerate emulated time on THIS build and THIS launch profile
// at all? Asked without any autostart in the loop, because AUTOSTART manages
// warp itself and would confound the answer. Free-run a recorded wall-clock
// interval from the KERNAL READY prompt, then read the jiffy clock: the ratio
// of emulated seconds to wall-clock seconds IS the warp factor.

async function runWarpCheck({ warp, runMs = 5000, label }) {
  banner(`warpcheck label=${label} warp=${warp}`);
  const run = await openRun({ jitterMs: 0, warp, mode: "warpcheck" });
  const { monitor } = run;
  log(`FREE_RUN_MS ${runMs}`);
  const t0 = Date.now();
  await freeRun(monitor, runMs);
  const elapsed = Date.now() - t0;
  const ping = await monitor.send(Cmd.Ping, Buffer.alloc(0));
  log(`PING err=0x${ping.errorCode.toString(16).padStart(2, "0")}`);
  log(`WALLCLOCK_ELAPSED_MS ${elapsed}`);
  const vsf = await closeRun(run, { snapshotName: `${label}.vsf` });
  log(`VSF ${vsf ?? "(none)"}`);
}

// --- the wall-clock bracket, as an explicit region assertion -----------------
//
// The `controlB` mode below brackets an autostarted run and asks whether the
// anchor still fires. MEASURED: it does, because AUTOSTART manages warp itself
// during the load and `-warp` buys no material emulated time after it -- so
// that instance of the control comes out `not-red` and says nothing about
// wall-clock bracketing.
//
// This mode isolates the mechanism the control is actually about, with no
// autostart in the loop: free-run a wall-clock interval, then assert the
// machine landed in the emulated-time region a bracket CALIBRATED UNWARPED
// expects. The jiffy clock is the region coordinate, and it is emulated time,
// which is the thing a wall-clock bracket cannot see.

async function runBracket({ warp, bracketMs, lo, hi, label }) {
  banner(`bracket label=${label} warp=${warp}`);
  const run = await openRun({ jitterMs: 0, warp, mode: "bracket" });
  const { monitor } = run;
  log(`BRACKET_BUDGET_MS ${bracketMs} (wall clock)`);
  log(`BRACKET_EXPECTED_JIFFY_WINDOW ${lo}..${hi} (calibrated on an UNWARPED run)`);
  const t0 = Date.now();
  await freeRun(monitor, bracketMs);
  const elapsed = Date.now() - t0;
  const ping = await monitor.send(Cmd.Ping, Buffer.alloc(0));
  log(`PING err=0x${ping.errorCode.toString(16).padStart(2, "0")}`);
  log(`WALLCLOCK_ELAPSED_MS ${elapsed}`);
  const vsf = await closeRun(run, { snapshotName: `${label}.vsf` });
  if (!vsf) {
    log(`BRACKET_REGION indeterminate (no snapshot)`);
    return;
  }
  const { ram } = sliceC64Mem(fs.readFileSync(vsf));
  const jiffies = (ram[0x00a0] << 16) | (ram[0x00a1] << 8) | ram[0x00a2];
  log(`BRACKET_JIFFY_AT_END ${jiffies} (${(jiffies / 60).toFixed(2)} emulated seconds)`);
  const inside = jiffies >= lo && jiffies <= hi;
  log(`BRACKET_REGION ${inside ? "inside" : "OUTSIDE"} the expected window`);
  log(`BRACKET_OVERSHOOT_FACTOR ${(jiffies / ((lo + hi) / 2)).toFixed(2)}x of the window centre`);
  log(`VSF ${vsf}`);
}

// --- diff mode ---------------------------------------------------------------

/**
 * Print the KERNAL jiffy clock (`TI`) from each snapshot's RAM slice: `$00A0`
 * MSB, `$00A1`, `$00A2` LSB, incremented 60 times per emulated second by the
 * `$EA31` IRQ handler. It is therefore a direct, objective measure of how much
 * EMULATED time a run consumed -- which is exactly the quantity a wall-clock
 * bracket cannot see and warp multiplies.
 */
function runJiffy(paths) {
  log(`PROBE_MODE jiffy`);
  for (const p of paths) {
    const { ram } = sliceC64Mem(fs.readFileSync(p));
    const jiffies = (ram[0x00a0] << 16) | (ram[0x00a1] << 8) | ram[0x00a2];
    log(`JIFFY ${path.basename(p)} raw=$${ram[0x00a0].toString(16).padStart(2, "0")}${ram[0x00a1]
      .toString(16)
      .padStart(2, "0")}${ram[0x00a2].toString(16).padStart(2, "0")} jiffies=${jiffies} emulated_seconds=${(jiffies / 60).toFixed(2)}`);
  }
}

function runDiff(aPath, bPath) {
  log(`PROBE_MODE diff`);
  const a = sliceC64Mem(fs.readFileSync(aPath));
  const b = sliceC64Mem(fs.readFileSync(bPath));
  log(`A ${aPath} modules=${a.modules.length} endedAt=${a.endedAt} c64mem_body=${a.bodyLength} minor=${a.minorSeen} sha=${sha256(a.ram)}`);
  log(`B ${bPath} modules=${b.modules.length} endedAt=${b.endedAt} c64mem_body=${b.bodyLength} minor=${b.minorSeen} sha=${sha256(b.ram)}`);
  const addrs = diffImages(a.ram, b.ram);
  log(`PAIR diffs=${addrs.length}`);
  log(`PAIR first=${addrs.slice(0, 20).map(hex4).join(" ") || "(none)"}`);
}

// --- main --------------------------------------------------------------------

function argValue(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}

async function main() {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const argv = process.argv.slice(2);
  const mode = argv[0];
  const jitterMs = Number(argValue(argv, "--jitter", "0"));
  const label = argValue(argv, "--label", null);
  const target = Number(argValue(argv, "--target", "400"));
  const loadMs = Number(argValue(argv, "--load-ms", "20000"));

  switch (mode) {
    case "s1":
      await runS1();
      break;
    case "s2":
      await runS2({ jitterMs, target, loadMs, label: label ?? `s2-j${jitterMs}` });
      break;
    case "s3":
      await runS3({
        jitterMs,
        target,
        label: label ?? `s3-j${jitterMs}`,
        initbreak: argv.includes("--initbreak"),
        warp: argv.includes("--warp"),
      });
      break;
    case "s4":
      await runS4({ jitterMs, loadMs, offset: Number(argValue(argv, "--offset", "200")), label: label ?? `s4-j${jitterMs}` });
      break;
    case "controlA":
      await runControlA({ jitterMs, waitMs: Number(argValue(argv, "--wait-ms", "20000")), target, label: label ?? `auto-j${jitterMs}` });
      break;
    case "controlB":
      await runControlB({ jitterMs, bracketMs: Number(argValue(argv, "--bracket-ms", "20000")), target, label: label ?? "warp-bracket" });
      break;
    case "diff":
      runDiff(argv[1], argv[2]);
      break;
    case "bracket":
      await runBracket({
        warp: argv.includes("--warp"),
        bracketMs: Number(argValue(argv, "--bracket-ms", "10000")),
        lo: Number(argValue(argv, "--expect-lo", "0")),
        hi: Number(argValue(argv, "--expect-hi", "0")),
        label: label ?? (argv.includes("--warp") ? "bracket-warp" : "bracket-plain"),
      });
      break;
    case "warpcheck":
      await runWarpCheck({
        warp: argv.includes("--warp"),
        runMs: Number(argValue(argv, "--run-ms", "5000")),
        label: label ?? (argv.includes("--warp") ? "warpcheck-warp" : "warpcheck-plain"),
      });
      break;
    case "jiffy":
      runJiffy(argv.slice(1));
      break;
    default:
      process.stderr.write(
        "usage: autostart-probe.mjs <s1|s2|s3|s4|controlA|controlB|diff|jiffy> [--jitter ms] [--target n] [--load-ms ms] [--wait-ms ms] [--bracket-ms ms] [--label name]\n",
      );
      process.exitCode = 2;
  }
}

await main();
process.exit(process.exitCode ?? 0);
