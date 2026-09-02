#!/usr/bin/env node
// -----------------------------------------------------------------------------
// reset-removed-probe.mjs -- Phase 33, plan 33-11, Task 2 (`REPRO-02`).
//
// WHAT THIS MEASURES
// ------------------
// Two arms of three runs each, differing in EXACTLY ONE STEP.
//
//   FULL     jitter 0 / 1500 / 4000 ms, the whole protocol -> the positive
//   NORESET  the same three jitters with the monitor-issued HARD RESET
//            REMOVED and nothing else changed -> the control, expected red
//
// The positive arm produces `JITTER_IMMUNITY` by `SCHEMA.md` § 2.2's declared
// rule. The control arm produces `RESET_REMOVED_CONTROL`. A red with no green
// beside it is not a proof, which is why both arms are in one script and run
// back to back: the ONLY difference between them is whether step 5 is sent.
//
// WHY THIS IS AN EVIDENCE SCRIPT AND NOT A TOOL ARGUMENT (`D-13`)
// ---------------------------------------------------------------
// The control needs the protocol MINUS the reset. It must NOT be produced by
// adding an argument to `vice_run_until`: shipping a
// protocol-without-the-reset option would ship exactly the second route
// `REPRO-02` exists to prevent a caller forgetting, and it would be reachable
// by every caller forever in order to serve one measurement that runs once.
// `33-09` pins the accepted argument key set by a single equality, so a
// sub-flag added here would red that test -- the prohibition has teeth beyond
// this comment.
//
// So the control calls `stock-reproducible-run.ts`'s ORDERED PIECES directly,
// over the wire, and simply does not send the `CommandType.Reset` step. Both
// arms below are driven by ONE function whose only branch is `sendReset`, so
// the "exactly one step removed" claim is a property of the code and not of a
// promise.
//
// WHAT NOT TO DO
// --------------
//   - Never let the two arms diverge in anything but `sendReset`. Same anchor,
//     same target, same argv, same single resume, same event-driven wait, same
//     slicer.
//   - Never retry a run because its number was unhelpful. A `not-red` control
//     is a FINDING to record, not a run to take again (and this file records
//     which it observed).
//   - Never send a second resume for one wait. Exactly ONE `EXIT`, which is
//     `vice-sync.ts`'s invariant in its stock-native, event-driven form.
//   - Never omit `preflight()`. `D-11` lives in code here, not in a shell habit.
//   - Never treat the jitter as part of the protocol. It is a PRE-protocol
//     free-run interval whose whole purpose is to move the moment the monitor
//     connect halts the machine.
//
// THE TWO MEASURED FACTS THAT SHAPE THIS PROBE
// -------------------------------------------
// FACT 1 -- the monitor's halt IS real, and one checkpoint is enough.
// `REPRO-02`'s protocol says "set the checkpoint WHILE HALTED", and stock's
// binary monitor does give you that: once it has serviced its first command
// the machine stays stopped, MEASURED as the jiffy clock at `$a0-$a2`
// unchanged across two reads 1200 ms apart, and as `hits_at_arm = 0` in every
// run below. So the protocol arms exactly ONE non-temporary Exec checkpoint at
// the anchor -- research's own measured sequence (`33-RESEARCH.md` M4) -- and
// the frame term is that checkpoint's own hit count.
//
// FACT 2 -- the hard reset does NOT reset the VIC-II raster counter, so the
// raster phase at the MOMENT OF THE RESET carries through to the stop.
// This is why the `PREHALT` variant arm exists below, and it is the single
// most useful thing this probe found. If an extra step halts the machine at a
// CHECKPOINT before the reset -- which leaves the VIC-II mid-frame at an
// arbitrary raster position -- the stop's `(LIN, CYC)` inherits that phase and
// lands on one of two values 6 cycles apart. If the machine is halted by the
// MONITOR (no checkpoint hit), `LIN` reads 0 and the reset starts from a
// reproducible phase, and the stop is `(LIN 257, CYC 57)` every time.
//
// Both are measured in this file's evidence document, in both directions. The
// `PREHALT` arm is recorded as a METHOD CONTROL, never as the protocol: it is
// what an added step costs, and it is the mechanism behind `33-10`'s
// `CAPTURE_FRAME_EXACT: no` on an autostarted release, where the anchor is
// necessarily armed and hit before the machine is captured.
//
// WHAT NOT TO DO, ADDED BY THE ABOVE
// ----------------------------------
//   - Never add a step before the reset "to be safe". Every extra step is a
//     chance to move the raster phase the reset inherits. The first version of
//     this probe added a halt-establishing checkpoint for exactly that reason
//     and turned an `immune` measurement into a `not-immune` one.
//   - Never poll while waiting for a checkpoint. Each command stops and
//     resumes the machine, so a four-command-per-700 ms poll STARVES the
//     emulator: `PC` sat at `$fd80` inside RAMTAS's RAM-sizing loop, unchanged
//     across thirty reads spanning 21 s, while an unpolled machine reached
//     `READY` in under 4.5 s. Install the listener first, then wait silently.
// -----------------------------------------------------------------------------
import { spawn, execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// --- shipped seams -----------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");
const SKILL_SCRIPTS = path.join(REPO_ROOT, "src", "skills", "c64-ram-capture", "scripts");
const VSF_SLICE_CLI = path.join(SKILL_SCRIPTS, "vsf-slice.mjs");

const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const predicate = await import(path.join(MCP_DIR, "capture-predicate.ts"));
const oracle = await import(path.join(MCP_DIR, "stop-oracle.ts"));
const launch = await import(path.join(MCP_DIR, "broker-launch.mts"));

const { CommandType, CheckpointOperation, ResetMode, ViceMonitorClient } = proto;
const { STOCK_DETERMINISM_FLAGS } = launch;

// --- fixed inputs ------------------------------------------------------------

const VICE_BIN = "/usr/bin/x64sc";
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase33", "33-11");
const FRAME_ANCHOR = 0xea31;
const MEMSPACE_MAIN = 0x00;
const PORT = 6512;

/** `REPRO-02`'s three pre-protocol jitter values, verbatim. */
const JITTERS = [0, 1500, 4000];

/** The free-run interval every run gets BEFORE its own jitter, so the machine
 *  has reached the KERNAL `READY` prompt in every arm. Research's own protocol
 *  used `3000 + J` (`33-RESEARCH.md` M4); held identical here so the two arms
 *  and research's triple are on the same footing. */
const BASE_FREE_RUN_MS = 3000;

/** How many times each jitter value is run. `SCHEMA.md` § 2.2's derivation is
 *  over THREE runs -- one per jitter -- so repetition 1 at each jitter IS the
 *  declared triple. Repetitions 2 and 3 are supplementary stability data,
 *  recorded in full: a triple that agreed by luck and a triple that agreed
 *  because the protocol is immune look identical from three runs, and the
 *  difference is the whole question. */
const REPS_FULL = 3;
const REPS_NORESET = 1;
const REPS_PREHALT = 1;

// --- small helpers -----------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const hex4 = (n) => `$${n.toString(16).padStart(4, "0")}`;

// --- D-11 in code ------------------------------------------------------------

function systemdBrokerState() {
  try {
    return execFileSync("systemctl", ["--user", "is-active", "vice-broker"], { encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout ?? "").trim() || "inactive";
  }
}

/** `pgrep -x`, never `-f`: `-f` matches this script's own command line. */
function aliveX64sc() {
  try {
    return execFileSync("pgrep", ["-x", "x64sc"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function preflight() {
  const broker = systemdBrokerState();
  const alive = aliveX64sc();
  log(`PREFLIGHT_BROKER ${broker}`);
  log(`PREFLIGHT_X64SC ${alive.length ? alive.join(",") : "(none)"}`);
  if (broker !== "inactive") throw new Error(`D-11 REFUSAL: the vice-broker unit is "${broker}", expected "inactive".`);
  if (alive.length) throw new Error(`D-11 REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}).`);
}

const CHILDREN = new Set();
function reapAll() {
  for (const child of CHILDREN) {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
  CHILDREN.clear();
  try {
    execFileSync("pkill", ["-x", "x64sc"]);
  } catch {}
}
process.on("exit", reapAll);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    reapAll();
    process.exit(130);
  });
}

// --- the argv, identical in both arms ----------------------------------------

/** The shipped determinism block, imported and never retyped (`T-33-36`).
 *  Order transcribed from `buildViceArgs()`'s stock branch: `-default` first
 *  (it is a reset-to-defaults instruction and must precede `-binarymonitor`),
 *  `-console` immediately after it and before `-drive8type` (both are handled
 *  in the same `main.c` pre-scan). Only the port is interpolated (`T-33-04`). */
function buildArgv(port) {
  return [
    VICE_BIN,
    "-default",
    "-console",
    "-drive8type",
    "1541",
    ...STOCK_DETERMINISM_FLAGS,
    "-binarymonitor",
    "-binarymonitoraddress",
    `ip4://127.0.0.1:${port}`,
  ];
}

function bootEnv(label) {
  const xdg = path.join(PROBE_DIR, "xdg", label);
  fs.rmSync(xdg, { recursive: true, force: true });
  fs.mkdirSync(xdg, { recursive: true });
  const env = { ...process.env, XDG_CONFIG_HOME: xdg };
  delete env.DISPLAY;
  delete env.WAYLAND_DISPLAY;
  return { env, xdg };
}

// --- monitor helpers ---------------------------------------------------------

async function connectWithRetry(client, port, { budgetMs = 60000 } = {}) {
  const deadline = Date.now() + budgetMs;
  let last = null;
  for (;;) {
    try {
      await client.connect("127.0.0.1", port, { timeoutMs: 5000 });
      return;
    } catch (err) {
      last = err;
      if (Date.now() >= deadline) throw new Error(`monitor port ${port} never accepted within ${budgetMs} ms: ${last.message}`);
      await sleep(150);
    }
  }
}

async function pingReady(client) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 3000 });
      log(`MONITOR_READY_AFTER_PINGS ${attempt}`);
      return attempt;
    } catch (err) {
      if (attempt >= 12) throw new Error(`monitor never answered PING after ${attempt} attempts: ${err.message}`);
      await sleep(500);
    }
  }
}

async function registerIds(client, memspace = MEMSPACE_MAIN) {
  const reply = await client.send(CommandType.RegistersAvailable, proto.memspaceBody({ memspace }));
  const byName = new Map(reply.registers.map((r) => [r.name.toUpperCase(), r.id]));
  const catalog = reply.registers.map((r) => `${r.id}:${r.name}(${r.size}b)`).join(" ");
  for (const name of ["PC", "LIN", "CYC"]) {
    if (!byName.has(name)) throw new Error(`register ${name} absent from this build's catalog: ${catalog}`);
  }
  return { byName, catalog };
}

async function readRegisters(client, ids, memspace = MEMSPACE_MAIN) {
  const reply = await client.send(CommandType.RegistersGet, proto.memspaceBody({ memspace }));
  const byId = new Map(reply.registers.map((r) => [r.id, r.value]));
  const pick = (name) => {
    const id = ids.byName.get(name);
    if (id === undefined || !byId.has(id)) throw new Error(`register ${name} absent from this REGISTERS_GET reply -- refusing rather than zero-filling`);
    return byId.get(id);
  };
  const out = { pc: pick("PC"), lin: pick("LIN"), cyc: pick("CYC") };
  for (const extra of ["00", "01"]) {
    const id = ids.byName.get(extra);
    if (id !== undefined && byId.has(id)) out[extra] = byId.get(id);
  }
  return out;
}

async function armExec(client, { start, temporary }) {
  return client.send(
    CommandType.CheckpointSet,
    proto.checkpointSetBody({
      start,
      end: start,
      stop: true,
      enabled: true,
      operation: CheckpointOperation.Exec,
      temporary,
      memspace: MEMSPACE_MAIN,
    }),
  );
}

/** Install a CHECKPOINT_INFO listener NOW and return a function that waits for
 *  a given checkpoint id. Split in two so the listener is on the client BEFORE
 *  the command that arms the checkpoint is even sent -- on a machine already
 *  past KERNAL init the hit lands within microseconds of the arm, and a
 *  listener installed after the arm reply misses it (observed: `hit:false`
 *  beside a machine that was demonstrably halted at the anchor). Sends NO
 *  resume: this waits for a checkpoint that fires on a machine already
 *  running. */
function awaitHitById(client) {
  const seen = [];
  const collector = (frame) => seen.push(frame);
  client.on("event", collector);
  return (cpId, { budgetMs = 60000 } = {}) =>
    new Promise((resolve) => {
      const finish = (result) => {
        clearTimeout(timer);
        client.off("event", collector);
        client.off("event", onEvent);
        resolve(result);
      };
      const match = (frame) => frame.type === "checkpoint_info" && frame.checkpoint.id === cpId;
      const already = seen.find(match);
      if (already) {
        client.off("event", collector);
        resolve({ hit: true, frame: already });
        return;
      }
      const onEvent = (frame) => {
        if (frame.type === "jam") {
          finish({ hit: false, reason: "JAM (0x61, zero-length body) -- CPU jammed" });
          return;
        }
        if (!match(frame)) return;
        finish({ hit: true, frame });
      };
      const timer = setTimeout(() => finish({ hit: false, reason: `budget ${budgetMs} ms exhausted with no hit` }), budgetMs);
      client.on("event", onEvent);
    });
}

/** ONE resume, then the event-driven wait on the TARGET's own checkpoint id.
 *  The listener goes on BEFORE the resume, so a hit in the gap is not missed.
 *  An anchor frame arriving first does not resolve the wait. */
function awaitHit(client, cpId, { budgetMs = 90000 } = {}) {
  return new Promise((resolve) => {
    const finish = (result) => {
      clearTimeout(timer);
      client.off("event", onEvent);
      resolve(result);
    };
    const onEvent = (frame) => {
      if (frame.type === "jam") {
        finish({ hit: false, reason: "JAM (0x61, zero-length body) -- CPU jammed" });
        return;
      }
      if (frame.type !== "checkpoint_info" || frame.checkpoint.id !== cpId) return;
      finish({ hit: true, frame });
    };
    const timer = setTimeout(() => finish({ hit: false, reason: `budget ${budgetMs} ms exhausted with no hit` }), budgetMs);
    client.on("event", onEvent);
    client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 }).catch(() => {});
  });
}

async function anchorHitCount(client, cpId) {
  const reply = await client.send(CommandType.CheckpointGet, proto.cpNumBody(cpId));
  return reply.checkpoint.hitCount;
}

function sliceThroughShippedCli(vsfPath, outPath) {
  const argv = [VSF_SLICE_CLI, "slice", vsfPath, "--out", outPath, "--json"];
  log(`$ node ${argv.join(" ")}`);
  const run = spawnSync(process.execPath, argv, { encoding: "utf8" });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) throw new Error(`vsf-slice exited ${run.status}: ${run.stderr || run.stdout}`);
  log(run.stdout.trim());
  return JSON.parse(run.stdout.trim());
}


// --- the memory read that tells running from halted --------------------------

/** The KERNAL jiffy clock at `$a0-$a2`, incremented by the very IRQ handler the
 *  anchor sits on. Read twice with a gap, it is the ONE cheap discriminator
 *  between "the monitor stopped the machine to service this command and
 *  resumed it" and "the machine is genuinely halted at a checkpoint". */
async function jiffy(client) {
  const reply = await client.send(CommandType.MemoryGet, proto.memGetBody({ start: 0x00a0, end: 0x00a2, memspace: MEMSPACE_MAIN }));
  return [...reply.bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- ONE run, with the reset as its only branch ------------------------------

/**
 * `stock-reproducible-run.ts`'s ordered pieces, driven directly.
 *
 * Step 0 (BOTH arms, identical) -- establish the documented "while halted"
 * precondition rather than assume it. See this file's header: stock's binary
 * monitor stops per command and resumes, so "connect (which halts)" is not the
 * state the protocol's own description assumes. A temporary checkpoint at the
 * anchor address is armed, and the machine is then CONFIRMED halted at it: PC
 * at the anchor AND the jiffy clock unchanged across two reads 700 ms apart.
 * Polled rather than event-waited, because on a machine already past KERNAL
 * init the hit can land before an `event` listener is installed (observed).
 *
 * Then the protocol proper, numbered as that module numbers it:
 *   2. resolve `PC` / `LIN` / `CYC` BY NAME before anything is armed
 *   3. arm the ANCHOR, `temporary: false` (it must survive its own hits), and
 *      ASSERT via `CHECKPOINT_GET` that its hit count is 0 -- so the frame
 *      term's origin is the protocol and never the pre-protocol interval
 *   5. the monitor-issued HARD RESET -- `RESET` 0xcc, `ResetMode.Hard`.
 *      **THIS IS THE ONLY STEP `sendReset: false` REMOVES.**
 *   6. exactly ONE `EXIT`, then the event-driven wait on the anchor's own id
 *   7. `PC` / `LIN` / `CYC` from ONE `REGISTERS_GET` reply
 *   8. the ANCHOR's own hit count via `CHECKPOINT_GET` -- that is the frame term
 *
 * Then `DUMP` and the shipped slicer, so each run carries a 64K sha256.
 *
 * One checkpoint, not two: this is `REPRO-02`'s own protocol and research's
 * own measured sequence (`33-RESEARCH.md` M4) -- `CHECKPOINT_SET exec at $ea31
 * stop=true while halted`. `runReproducible()` arms a second, temporary target
 * because its target address is a caller's parameter; here the target IS the
 * anchor, which is that function's own documented measured-green case.
 */
async function oneRun({ label, jitterMs, sendReset, preHalt = false }) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const argv = buildArgv(PORT);
  const { env, xdg } = bootEnv(label);

  log(`RUN_LABEL ${label}`);
  log(`RUN_ARM ${preHalt ? "PREHALT (method control: an extra checkpoint halt BEFORE the reset)" : sendReset ? "FULL (reset sent -- the protocol as REPRO-02 specifies it)" : "NORESET (reset step REMOVED -- the control)"}`);
  log(`RUN_JITTER_MS ${jitterMs}`);
  log(`RUN_FREE_RUN_MS ${BASE_FREE_RUN_MS + jitterMs}`);
  log(`SPAWN_ARGV ${JSON.stringify(argv)}`);
  log(`ARGV_DIGEST ${predicate.argvDigest(argv)}`);
  log(`XDG_CONFIG_HOME ${xdg}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  const record = { label, jitterMs, sendReset, preHalt, argv, argvDigest: predicate.argvDigest(argv), usable: false };

  const child = spawn(argv[0], argv.slice(1), { env, stdio: ["ignore", "pipe", "pipe"] });
  CHILDREN.add(child);
  let stderr = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  const client = new ViceMonitorClient();
  const events = [];
  client.on("event", (f) => events.push(f.type + (f.checkpoint ? `#${f.checkpoint.id}@${f.checkpoint.hitCount}` : "")));
  try {
    // PRE-protocol free run. It shifts the moment the monitor halts the
    // machine, which is the whole point of varying it.
    await sleep(BASE_FREE_RUN_MS + jitterMs);

    await connectWithRetry(client, PORT);
    await sleep(300);
    await pingReady(client);

    const ids = await registerIds(client);

    // The machine's state as the MONITOR halted it -- before anything is
    // armed. `LIN` reading 0 here is the signature of a monitor halt as
    // opposed to a checkpoint halt, and it is what makes the reset's raster
    // phase reproducible (FACT 2 in this file's header).
    const preRegs = await readRegisters(client, ids);
    const preJiffy = await jiffy(client);
    log(`PRE_PROTOCOL pc=${hex4(preRegs.pc)} LIN=${preRegs.lin} CYC=${preRegs.cyc} jiffy=${preJiffy}`);
    record.pre = { pc: preRegs.pc, line: preRegs.lin, cycle: preRegs.cyc, jiffy: preJiffy };

    // --- The PREHALT variant's added step, NOT part of the protocol --------
    //
    if (preHalt) {
      // Present ONLY in the `PREHALT` method-control arm. It halts the machine
      // at a CHECKPOINT before the reset, which is what an autostarted capture
      // necessarily does, and it is recorded to show what that costs. It is
      // absent from both the FULL and the NORESET arm, so those two still differ
      // in exactly one step: the reset.
      //
      // EVENT-DRIVEN, and deliberately NOT a polling loop. MEASURED, and the
      // reason this is written the way it is: every monitor command stops the
      // machine to be serviced and resumes it afterwards, so a poll that issues
      // four commands per 700 ms STARVES the emulator. A first version of this
      // step did exactly that and watched `PC` sit at `$fd80` -- inside RAMTAS's
      // RAM-sizing loop -- unchanged across thirty reads spanning 21 s, while an
      // unpolled machine reached the `READY` prompt in under 4.5 s. The
      // starvation was an artefact of the measurement, and it voided four runs
      // before it was recognised. So: install the listener FIRST, arm, then wait
      // with NO command traffic at all.
      const halterWait = awaitHitById(client);
      const halter = await armExec(client, { start: FRAME_ANCHOR, temporary: true });
      log(`STEP0_HALTER_ARMED cp=${halter.checkpoint.id} at=${hex4(FRAME_ANCHOR)} temporary=true`);
      const halterHit = await halterWait(halter.checkpoint.id, { budgetMs: 60000 });
      log(`STEP0_HALTER_HIT hit=${halterHit.hit} hit_count=${halterHit.hit ? halterHit.frame.checkpoint.hitCount : "-"} reason=${halterHit.reason ?? "-"}`);
      if (!halterHit.hit) throw new Error(`step 0 never observed the halter's hit: ${halterHit.reason}`);
      // Confirm the halt rather than assume it: PC at the anchor, and the jiffy
      // clock -- incremented by the very IRQ the anchor sits on -- unchanged
      // across two reads 700 ms apart.
      const j1 = await jiffy(client);
      const r1 = await readRegisters(client, ids);
      await sleep(700);
      const j2 = await jiffy(client);
      const r2 = await readRegisters(client, ids);
      log(`STEP0_HALT_CHECK pc=${hex4(r1.pc)}->${hex4(r2.pc)} jiffy=${j1}->${j2}`);
      if (r2.pc !== FRAME_ANCHOR || j1 !== j2) {
        throw new Error(`step 0 could not confirm a halt at the anchor: pc=${hex4(r2.pc)} jiffy ${j1}->${j2}`);
      }
      log(`STEP0_HALTED pc=${hex4(r2.pc)} LIN=${r2.lin} CYC=${r2.cyc} jiffy=${j2} (stable across two reads 700 ms apart)`);
      record.halt = { pc: r2.pc, line: r2.lin, cycle: r2.cyc, jiffy: j2 };
    }


    // --- Step 3: the anchor, non-temporary, hit count asserted zero --------
    const anchor = await armExec(client, { start: FRAME_ANCHOR, temporary: false });
    const atArm = await anchorHitCount(client, anchor.checkpoint.id);
    log(`ANCHOR_ARMED cp=${anchor.checkpoint.id} temporary=false hits_at_arm=${atArm}`);
    if (atArm !== 0) throw new Error(`the anchor's hit count is ${atArm} at arm, not 0 -- the frame term's origin would carry a pre-protocol offset`);

    // --- Step 5, and the ONLY branch between the two arms ------------------
    if (sendReset) {
      await client.send(CommandType.Reset, proto.resetBody({ mode: ResetMode.Hard }));
      const afterReset = await anchorHitCount(client, anchor.checkpoint.id);
      const jr = await jiffy(client);
      log(`RESET mode=hard sent=yes anchor_hits_after_reset=${afterReset} jiffy_after_reset=${jr}`);
    } else {
      log(`RESET mode=hard sent=NO  <-- the removed step`);
    }

    // --- Step 6: exactly ONE resume, then the event-driven wait ------------
    const hit = await awaitHit(client, anchor.checkpoint.id);
    log(`WAIT hit=${hit.hit} reason=${hit.reason ?? "-"}`);
    if (!hit.hit) throw new Error(`no stop: ${hit.reason}`);

    // --- Steps 7 and 8: the four terms -------------------------------------
    const regs = await readRegisters(client, ids);
    const frameTerm = await anchorHitCount(client, anchor.checkpoint.id);
    const stopJiffy = await jiffy(client);
    log(`STOP PC=${hex4(regs.pc)} hit_count=${frameTerm} LIN=${regs.lin} CYC=${regs.cyc} $00=${regs["00"] ?? "-"} $01=${regs["01"] ?? "-"} jiffy=${stopJiffy}`);
    if (regs.pc !== FRAME_ANCHOR) throw new Error(`the stop's PC is ${hex4(regs.pc)}, not the anchor ${hex4(FRAME_ANCHOR)} -- the machine was not halted at the stop`);
    record.stop = { pc: regs.pc, hitCount: frameTerm, line: regs.lin, cycle: regs.cyc };
    record.stopJiffy = stopJiffy;

    const vsfPath = path.join(PROBE_DIR, `${label}.vsf`);
    const dump = await client.send(
      CommandType.Dump,
      proto.dumpBody({ saveRoms: false, saveDisks: false, filename: vsfPath }),
      { timeoutMs: 90000 },
    );
    const vsfSize = fs.existsSync(vsfPath) ? fs.statSync(vsfPath).size : 0;
    log(`SNAPSHOT ${vsfPath} err=0x${dump.errorCode.toString(16).padStart(2, "0")} size=${vsfSize}`);
    if (vsfSize === 0) throw new Error(`snapshot ${vsfPath} was not written`);
    record.vsfPath = vsfPath;
  } catch (err) {
    record.voidReason = err.message;
    log(`VOID ${label} ${err.message}`);
  } finally {
    log(`EVENTS ${events.join(",") || "(none)"}`);
    try {
      client.disconnect?.();
    } catch {}
    try {
      child.kill("SIGKILL");
    } catch {}
    CHILDREN.delete(child);
    await sleep(900);
    if (stderr.trim()) log(`CHILD_STDERR ${stderr.trim().split("\n").slice(0, 6).join(" | ")}`);
    const after = aliveX64sc();
    log(`POST_X64SC ${after.length ? after.join(",") : "(none)"}`);
    if (after.length) {
      try {
        execFileSync("pkill", ["-x", "x64sc"]);
      } catch {}
      log(`POST_X64SC_SWEPT ${after.join(",")}`);
    }
  }

  if (!record.voidReason) {
    const binPath = path.join(PROBE_DIR, `${label}.bin`);
    const slice = sliceThroughShippedCli(record.vsfPath, binPath);
    const raw = fs.readFileSync(binPath);
    log(`IMAGE ${binPath} bytes=${raw.length} sha256=${slice.sha256}`);
    record.imagePath = binPath;
    record.imageSha256 = slice.sha256;
    record.dirRead = slice.dirRead;
    record.dataRead = slice.dataRead;
    record.usable = raw.length === 65536;
  }
  record.takenAt = new Date().toISOString();
  const recPath = path.join(PROBE_DIR, `${label}.run.json`);
  fs.writeFileSync(recPath, `${JSON.stringify(record, null, 2)}\n`);
  log(`RUN_RECORD ${recPath} usable=${record.usable}${record.voidReason ? ` void=${record.voidReason}` : ""}`);
  return record;
}

// --- the comparisons ---------------------------------------------------------

function pairwiseDiff(a, b) {
  const rawA = fs.readFileSync(a.imagePath);
  const rawB = fs.readFileSync(b.imagePath);
  let n = 0;
  const first = [];
  for (let addr = 0; addr < 65536; addr += 1) {
    if (rawA[addr] !== rawB[addr]) {
      n += 1;
      if (first.length < 8) first.push(addr);
    }
  }
  return { count: n, first };
}

/** Every stop comparison goes through the SHIPPED oracle, never a local
 *  reimplementation (`T-33-36`). */
function stopCompare(a, b) {
  return oracle.compareStopIdentity(a.stop, b.stop);
}

function reportArm(tag, runs) {
  log("");
  log(`--- arm ${tag}: ${runs.length} runs ------------------------------------`);
  for (const r of runs) {
    log(`${tag}_RUN ${r.label} jitter=${r.jitterMs} halt=${JSON.stringify(r.halt)} stop=${JSON.stringify(r.stop)} stop_jiffy=${r.stopJiffy} sha256=${r.imageSha256}`);
  }
  const shas = new Set(runs.map((r) => r.imageSha256));
  log(`${tag}_DISTINCT_SHA256 ${shas.size} (${[...shas].join(" ")})`);

  const pairs = [];
  for (let i = 0; i < runs.length; i += 1) {
    for (let j = i + 1; j < runs.length; j += 1) {
      const d = pairwiseDiff(runs[i], runs[j]);
      const s = stopCompare(runs[i], runs[j]);
      log(
        `${tag}_PAIR ${runs[i].label}v${runs[j].label} differing_bytes=${d.count} first=${d.first.map(hex4).join(" ") || "(none)"} stop_identical=${s.identical} differing_terms=${s.differingTerms.join(",") || "(none)"}`,
      );
      pairs.push({ a: runs[i].label, b: runs[j].label, diff: d.count, stop: s });
    }
  }
  const total = pairs.reduce((acc, p) => acc + p.diff, 0);
  log(`${tag}_PAIRWISE_DIFF_TOTAL ${total}`);
  log(`${tag}_ANY_STOP_TERM_DIFFERS ${pairs.some((p) => !p.stop.identical) ? "yes" : "no"}`);
  const allDifferingTerms = new Set(pairs.flatMap((p) => p.stop.differingTerms));
  log(`${tag}_DIFFERING_TERMS_UNION ${[...allDifferingTerms].join(",") || "(none)"}`);
  return {
    pairs,
    distinctSha: shas.size,
    total,
    anyStopDiffers: pairs.some((p) => !p.stop.identical),
    differingTerms: allDifferingTerms,
  };
}

/** `SCHEMA.md` § 2.2's declared derivation, as code, so the value is produced
 *  by the rule and not chosen once the numbers are visible. */
function deriveJitterImmunity(arm) {
  if (arm.anyStopDiffers) return "not-immune";
  if (arm.distinctSha === 1) return "immune";
  return "partial";
}

/** `RESET_REMOVED_CONTROL`: `red` when the reset-removed arm's stops differ in
 *  any stop-identity term OR in the sliced sha256; `not-red` otherwise, which
 *  would be a finding to record rather than a run to retry. */
function deriveResetRemovedControl(arm) {
  return arm.anyStopDiffers || arm.distinctSha > 1 ? "red" : "not-red";
}

// --- CLI ---------------------------------------------------------------------

const USAGE = `usage: node reset-removed-probe.mjs <command>

  run        both arms: FULL-protocol runs at jitter 0/1500/4000 (${REPS_FULL}
             repetitions each) and NORESET runs at the same jitters
             (${REPS_NORESET} each), then every pairwise comparison and the two
             derived outcome lines
  preflight  D-11 only
`;

async function main() {
  const cmd = process.argv[2];
  if (cmd === "preflight") {
    preflight();
    return 0;
  }
  if (cmd !== "run") {
    process.stderr.write(USAGE);
    return cmd ? 1 : 0;
  }

  log(`PROBE reset-removed-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`NODE ${process.version}`);
  log(`VICE_VERSION ${execFileSync(VICE_BIN, ["--version"], { encoding: "utf8" }).trim()}`);
  log(`STOCK_DETERMINISM_FLAGS ${JSON.stringify(STOCK_DETERMINISM_FLAGS)}`);
  log(`ORACLE_TERMS ${JSON.stringify(oracle.ORACLE_TERMS)}`);
  log(`FRAME_ANCHOR ${hex4(FRAME_ANCHOR)}`);
  log(`JITTERS ${JSON.stringify(JITTERS)}  (each preceded by ${BASE_FREE_RUN_MS} ms of free run)`);
  log(`REPS full=${REPS_FULL} noreset=${REPS_NORESET}`);
  preflight();

  const full = [];
  for (const j of JITTERS) {
    for (let rep = 1; rep <= REPS_FULL; rep += 1) {
      log("");
      log(`--- FULL protocol, jitter ${j} ms, rep ${rep} ---------------------------`);
      full.push(await oneRun({ label: `full-j${j}-r${rep}`, jitterMs: j, sendReset: true }));
      await sleep(600);
    }
  }

  const noreset = [];
  for (const j of JITTERS) {
    for (let rep = 1; rep <= REPS_NORESET; rep += 1) {
      log("");
      log(`--- NORESET control, jitter ${j} ms, rep ${rep} -------------------------`);
      noreset.push(await oneRun({ label: `noreset-j${j}-r${rep}`, jitterMs: j, sendReset: false }));
      await sleep(600);
    }
  }

  // The METHOD control. Same protocol, same reset, plus ONE extra step that
  // halts the machine at a checkpoint before the reset. Recorded because its
  // result is the mechanism behind `33-10`'s CAPTURE_FRAME_EXACT: no, and
  // because it is what this probe's own first version accidentally measured.
  const prehalt = [];
  for (const j of JITTERS) {
    for (let rep = 1; rep <= REPS_PREHALT; rep += 1) {
      log("");
      log(`--- PREHALT method control, jitter ${j} ms, rep ${rep} ------------------`);
      prehalt.push(await oneRun({ label: `prehalt-j${j}-r${rep}`, jitterMs: j, sendReset: true, preHalt: true }));
      await sleep(600);
    }
  }

  const voided = [...full, ...noreset, ...prehalt].filter((r) => !r.usable);
  log("");
  log(`VOIDED_RUNS ${voided.length ? voided.map((r) => `${r.label}(${r.voidReason})`).join(" ; ") : "(none)"}`);
  const usableFull = full.filter((r) => r.usable);
  const usableNoReset = noreset.filter((r) => r.usable);

  // The DECLARED triple is repetition 1 at each jitter -- `SCHEMA.md` § 2.2's
  // derivation is over three runs, one per jitter. Named explicitly so the
  // derivation's input set is a rule and not a selection.
  const triple = JITTERS.map((j) => usableFull.find((r) => r.label === `full-j${j}-r1`)).filter(Boolean);
  log(`DECLARED_TRIPLE ${triple.map((r) => r.label).join(" ") || "(incomplete)"}`);
  if (triple.length !== 3) throw new Error(`the declared triple is incomplete (${triple.length} of 3 usable) -- refusing to derive`);
  if (usableNoReset.length !== JITTERS.length) throw new Error(`the NORESET arm is incomplete (${usableNoReset.length} of ${JITTERS.length})`);

  const armTriple = reportArm("TRIPLE", triple);
  const armFullAll = reportArm("FULL_ALL", usableFull);
  const armNoReset = reportArm("NORESET", usableNoReset);
  const usablePrehalt = prehalt.filter((r) => r.usable);
  const armPrehalt = usablePrehalt.length >= 2 ? reportArm("PREHALT", usablePrehalt) : null;

  log("");
  log(`--- the contrast -----------------------------------------------------`);
  log(`CONTRAST_FULL_PAIRWISE_DIFF_TOTAL ${armTriple.total}`);
  log(`CONTRAST_NORESET_PAIRWISE_DIFF_TOTAL ${armNoReset.total}`);
  log(`CONTRAST_ONLY_DIFFERENCE the monitor-issued hard RESET (step 5) was sent in FULL and not sent in NORESET`);

  log("");
  log(`--- the derivations --------------------------------------------------`);
  log(`DERIVED_JITTER_IMMUNITY_DECLARED_TRIPLE ${deriveJitterImmunity(armTriple)}`);
  log(`DERIVED_JITTER_IMMUNITY_ALL_FULL_RUNS ${deriveJitterImmunity(armFullAll)}`);
  log(`DERIVED_RESET_REMOVED_CONTROL ${deriveResetRemovedControl(armNoReset)}`);
  if (armPrehalt) {
    log(`METHOD_CONTROL_PREHALT_WOULD_HAVE_DERIVED ${deriveJitterImmunity(armPrehalt)}  (NOT the protocol -- one added step)`);
  }
  return 0;
}

process.exitCode = await main();
