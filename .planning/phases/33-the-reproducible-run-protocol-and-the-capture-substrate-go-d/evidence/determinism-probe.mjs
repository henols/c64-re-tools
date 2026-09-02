#!/usr/bin/env node
// -----------------------------------------------------------------------------
// determinism-probe.mjs -- Phase 33, plan 33-11, Task 1 (`REPRO-01`).
//
// WHAT THIS MEASURES, AND WHY IT NEEDS TWO ARMS
// ---------------------------------------------
// `SEED_EFFECT` is not "were the determinism flags present". It is a
// DIVERGENCE measurement, and `SCHEMA.md` § 2.1 makes both halves mandatory:
// two cold boots WITH the block must differ at 0 addresses over the untouched
// `$C000-$CFEF` window (4080 addresses), AND two cold boots WITHOUT it must
// differ at more than 0. A with-block count of 0 means nothing on its own,
// because a window that was never nondeterministic never tested the block.
//
// So this script boots the emulator SIX times:
//
//   A1, A2   port P1, determinism flags OMITTED   -> the expected red
//   B1, B2   port P1, determinism flags PRESENT   -> the expected 0 of 4080
//   B3, B4   port P2, determinism flags PRESENT   -> the concurrency arm
//
// WHY IT SPAWNS x64sc DIRECTLY AND NOT THROUGH THE BROKER
// ------------------------------------------------------
// `buildViceArgs()` emits STOCK_DETERMINISM_FLAGS *unconditionally* on the
// stock branch (broker-launch.mts, plan 33-05, `D-15`'s amendment rider). Arm A
// needs those flags ABSENT, and there is deliberately no broker route that
// omits them -- that unconditionality is the shipped behaviour `REPRO-01` asked
// for. A probe that went through the broker could therefore only ever measure
// Arm B, which is exactly the one-armed measurement `SCHEMA.md` § 2.1 forbids.
// Spawning `execve(/usr/bin/x64sc, argv)` directly is the only route that can
// build the without-block argv at all, and it is recorded as a trust boundary
// in this plan's threat model (`T-33-04`) rather than left implicit.
//
// WHAT IT DOES *NOT* RETYPE
// -------------------------
//   - The determinism block. Imported from broker-launch.mts's exported,
//     frozen `STOCK_DETERMINISM_FLAGS` (`T-33-36`), so Arm B measures the
//     SHIPPED block and a future edit to that array changes what this probe
//     launches instead of leaving it measuring a stale copy.
//   - The snapshot layout. The flat 64K is reached through the shipped
//     `vsf-slice` CLI entry point, spawned exactly as a skill would reach it.
//     This file parses no snapshot bytes.
//   - The wire encoders. Every command body comes from stock-protocol.ts.
//
// WHAT NOT TO DO
// --------------
//   - Never add a passthrough argv parameter. Every flag below is a fixed
//     literal and the ONLY interpolated value is the port (`T-33-04`).
//   - Never compare "the two most similar of N" boots. The reported pair is
//     the pair TAKEN, in the order taken (`README.md` § *Evidence conventions*
//     5), and a boot that produced no usable stop is recorded with its reason.
//   - Never treat the non-zero whole-64K count as a failure of the block. It
//     is expected and it is recorded: pinning launch nondeterminism is
//     NECESSARY AND NOT SUFFICIENT, and what closes the remainder is the reset
//     protocol plus the frame anchor, not the seed.
//   - Never single-shot `connect()` after spawn. `x64sc` binds the binary
//     monitor some time after `execve` returns; a bare connect measures the
//     spawn, not the readiness.
//   - Never run without preflight(). `D-11` is enforced in code here, not as a
//     shell habit -- `33-03` ran it as a habit, orphaned five emulators, and
//     had to void sixteen subsequent runs whose numbers then MOVED.
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

/** The shipped `vsf-slice` entry point. Spawned, never reimplemented: that
 *  wrapper IS the published route from a snapshot to a flat 64K image. */
const VSF_SLICE_CLI = path.join(SKILL_SCRIPTS, "vsf-slice.mjs");

const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const predicate = await import(path.join(MCP_DIR, "capture-predicate.ts"));
/** THE shipped definition of the determinism block. Imported, never retyped
 *  (`T-33-36`). */
const launch = await import(path.join(MCP_DIR, "broker-launch.mts"));

const { CommandType, CheckpointOperation, ResetMode, ViceMonitorClient } = proto;
const { STOCK_DETERMINISM_FLAGS, STOCK_DETERMINISM_SEED } = launch;

// --- fixed inputs ------------------------------------------------------------

/** Genuine unpatched stock VICE 3.9. The fork shadows a bare `x64sc` at
 *  /usr/local/bin, so the absolute path is load-bearing. */
const VICE_BIN = "/usr/bin/x64sc";

/** Outside the checkout, and never /tmp (tmpfs on this host, 16 GB, emptied
 *  only on reboot). */
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase33", "33-11");

/** The KERNAL IRQ entry -- the once-per-frame site the protocol anchors on. */
const FRAME_ANCHOR = 0xea31;
const MEMSPACE_MAIN = 0x00;

/** The untouched window `SCHEMA.md` § 2.1 declares. `$CFEF - $C000 + 1` is
 *  `0x0FEF + 1` = **4080** addresses -- the denominator research recorded
 *  (`33-RESEARCH.md` M3) and the requirement's own `67 of 4080`. Untouched by
 *  the KERNAL, by BASIC and by the protocol itself, which is why a difference
 *  there is launch nondeterminism and not work. */
const WINDOW_START = 0xc000;
const WINDOW_END = 0xcfef;
const WINDOW_SIZE = WINDOW_END - WINDOW_START + 1;

/** Two ports, so the concurrency arm can show the pinning is a property of the
 *  FLAGS and not of one port or one instance. */
const PORT_A = 6511;
const PORT_B = 6621;

// --- small helpers -----------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const hex4 = (n) => `$${n.toString(16).padStart(4, "0")}`;

// --- D-11 in code, not in shell discipline -----------------------------------

function systemdBrokerState() {
  try {
    return execFileSync("systemctl", ["--user", "is-active", "vice-broker"], { encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout ?? "").trim() || "inactive";
  }
}

/** `pgrep -x`, never `pgrep -f`: `-f` matches this script's OWN command line
 *  and would refuse every run. */
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
  if (broker !== "inactive") {
    throw new Error(`D-11 REFUSAL: the vice-broker unit is "${broker}", expected "inactive". Measurement not taken.`);
  }
  if (alive.length) {
    throw new Error(`D-11 REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}). Measurement not taken.`);
  }
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

// --- the argv under measurement ----------------------------------------------

/**
 * The two arms' argv, built from ONE function so the only difference between
 * them is the presence of the shipped block.
 *
 * Order is transcribed from `buildViceArgs()`'s own stock branch and is
 * load-bearing at two points, both cited in that function:
 *   - `-default` MUST be first. It is VICE's reset-to-compiled-in-defaults
 *     instruction, so anything before it is silently clobbered, and it must
 *     precede `-binarymonitor` or the monitor never binds.
 *   - `-console` goes immediately after `-default` and BEFORE `-drive8type`.
 *     Both are handled in the same `main.c` pre-scan; a `-console` the late
 *     parser sees arrives after GTK has already tried and failed.
 *
 * The ONLY interpolated value is the port (`T-33-04`). There is no passthrough
 * parameter and no argv element derived from a caller-supplied string.
 */
function buildArm(port, { block }) {
  const argv = [VICE_BIN, "-default", "-console", "-drive8type", "1541"];
  if (block) argv.push(...STOCK_DETERMINISM_FLAGS);
  argv.push("-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${port}`);
  return argv;
}

/** A scratch XDG_CONFIG_HOME per boot, so an operator `vicerc` on this host
 *  cannot silently participate in either arm. `DISPLAY`/`WAYLAND_DISPLAY` are
 *  removed because `-console` was measured with both unset
 *  (`33-RESEARCH.md` P5). */
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

/** Dial until the monitor's listener accepts. A bound port is NOT an immediate
 *  consequence of `execve` returning, so a single-shot connect measures the
 *  spawn rather than the readiness. */
async function connectWithRetry(client, port, { budgetMs = 60000 } = {}) {
  const deadline = Date.now() + budgetMs;
  let last = null;
  for (;;) {
    try {
      await client.connect("127.0.0.1", port, { timeoutMs: 5000 });
      return;
    } catch (err) {
      last = err;
      if (Date.now() >= deadline) {
        throw new Error(`monitor port ${port} never accepted a connection within ${budgetMs} ms: ${last.message}`);
      }
      await sleep(150);
    }
  }
}

/** PING until answered. An accepted TCP connection is not a serving monitor --
 *  the listen backlog accepts before the monitor services. */
async function pingReady(client) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 3000 });
      log(`MONITOR_READY_AFTER_PINGS ${attempt}`);
      return attempt;
    } catch (err) {
      if (attempt >= 12) {
        throw new Error(`monitor accepted the socket but never answered PING after ${attempt} attempts: ${err.message}`);
      }
      await sleep(500);
    }
  }
}

/** Resolve register ids BY NAME. Wire ids are not stable across builds and
 *  these feed the stop-identity terms, so a hardcoded id would mis-read
 *  silently. */
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
    if (id === undefined || !byId.has(id)) {
      throw new Error(`register ${name} absent from this REGISTERS_GET reply -- refusing rather than zero-filling`);
    }
    return byId.get(id);
  };
  const out = { pc: pick("PC"), lin: pick("LIN"), cyc: pick("CYC") };
  for (const extra of ["00", "01"]) {
    const id = ids.byName.get(extra);
    if (id !== undefined && byId.has(id)) out[extra] = byId.get(id);
  }
  return out;
}

/** Arm an Exec checkpoint through the SHIPPED encoder, so the memspace byte
 *  goes through `memspaceByte()`'s own wire-byte mapping. `stop: true` always:
 *  a non-stopping checkpoint emits CHECKPOINT_INFO synchronously from inside
 *  the CPU loop on every hit. */
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

/** Wait for ONE CHECKPOINT_INFO frame belonging to `cpId`, having sent exactly
 *  ONE resume. That is `vice-sync.ts`'s "exactly one resume per wait"
 *  invariant in its stock-native, event-driven form. The listener goes on
 *  BEFORE the resume, so a hit in the gap cannot be missed. */
function awaitHit(client, cpId, { budgetMs = 60000 } = {}) {
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

/** The anchor's own hit count -- CHECKPOINT_GET (0x11), parsed by the one
 *  seam in this tree that turns those bytes into a number. */
async function anchorHitCount(client, cpId) {
  const reply = await client.send(CommandType.CheckpointGet, proto.cpNumBody(cpId));
  return reply.checkpoint.hitCount;
}

// --- the shipped slicer ------------------------------------------------------

function sliceThroughShippedCli(vsfPath, outPath) {
  const argv = [VSF_SLICE_CLI, "slice", vsfPath, "--out", outPath, "--json"];
  log(`$ node ${argv.join(" ")}`);
  const run = spawnSync(process.execPath, argv, { encoding: "utf8" });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) throw new Error(`vsf-slice exited ${run.status}: ${run.stderr || run.stdout}`);
  log(run.stdout.trim());
  return JSON.parse(run.stdout.trim());
}

// --- one cold boot -----------------------------------------------------------

/**
 * One cold boot, one frame-anchored stop, one sliced 64K image.
 *
 * The protocol is `stock-reproducible-run.ts`'s own ordered sequence, driven
 * here over the wire because Arm A's argv cannot be produced by the broker at
 * all: resolve the register names BY NAME -> arm the frame anchor
 * (non-temporary, so it survives its own hits) -> arm the target (temporary) ->
 * the monitor-issued HARD RESET -> exactly ONE resume -> the event-driven wait
 * -> the four stop terms -> DUMP.
 */
async function coldBoot({ label, port, block }) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const argv = buildArm(port, { block });
  const { env, xdg } = bootEnv(label);

  log(`BOOT_LABEL ${label}`);
  log(`BOOT_BLOCK ${block ? "present" : "OMITTED"}`);
  log(`BOOT_PORT ${port}`);
  log(`SPAWN_ARGV ${JSON.stringify(argv)}`);
  log(`XDG_CONFIG_HOME ${xdg}`);
  log(`ARGV_DIGEST ${predicate.argvDigest(argv)}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  const record = { label, port, block, argv, argvDigest: predicate.argvDigest(argv), usable: false };

  const spawnedAt = Date.now();
  const child = spawn(argv[0], argv.slice(1), { env, stdio: ["ignore", "pipe", "pipe"] });
  CHILDREN.add(child);
  let stderr = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  let exited = null;
  child.on("exit", (code, signal) => {
    exited = { code, signal };
  });

  const client = new ViceMonitorClient();
  try {
    await connectWithRetry(client, port);
    log(`TIME_TO_BIND_MS ${Date.now() - spawnedAt}`);
    await sleep(300);
    await pingReady(client);

    const ids = await registerIds(client);
    log(`REGISTER_CATALOG ${ids.catalog}`);

    for (const name of ["RAMInitRandomChance", "AutostartDelayRandom", "Drive8TrueEmulation", "Drive8Type"]) {
      const reply = await client.send(CommandType.ResourceGet, proto.resourceGetBody({ name }));
      log(`RESOURCE ${name}=${reply.value}`);
      record[`resource_${name}`] = reply.value;
    }

    const anchor = await armExec(client, { start: FRAME_ANCHOR, temporary: false });
    const target = await armExec(client, { start: FRAME_ANCHOR, temporary: true });
    log(`ARMED anchor=${anchor.checkpoint.id} target=${target.checkpoint.id} at=${hex4(FRAME_ANCHOR)}`);
    if (anchor.checkpoint.id === target.checkpoint.id) {
      throw new Error("the monitor returned one id for both checkpoints -- their frames cannot be told apart");
    }

    // The load-bearing step. RESET 0xcc, ResetMode.Hard -- a distinct opcode
    // from the RESOURCE_SET power-cycle hazard, needing no deny-list.
    await client.send(CommandType.Reset, proto.resetBody({ mode: ResetMode.Hard }));
    log(`RESET mode=hard`);

    const hit = await awaitHit(client, target.checkpoint.id, { budgetMs: 90000 });
    log(`WAIT hit=${hit.hit} reason=${hit.reason ?? "-"}`);
    if (!hit.hit) throw new Error(`no stop: ${hit.reason}`);

    const regs = await readRegisters(client, ids);
    const frameTerm = await anchorHitCount(client, anchor.checkpoint.id);
    log(`STOP PC=${hex4(regs.pc)} hit_count=${frameTerm} LIN=${regs.lin} CYC=${regs.cyc} $00=${regs["00"] ?? "-"} $01=${regs["01"] ?? "-"}`);
    // Written under `stop-oracle.ts`'s OWN term names (`ORACLE_TERMS`), so a
    // reader of the record and a caller of `compareStopIdentity()` cannot
    // disagree about which field is which.
    record.stop = { pc: regs.pc, hitCount: frameTerm, line: regs.lin, cycle: regs.cyc };

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
    try {
      client.disconnect?.();
    } catch {}
    try {
      child.kill("SIGKILL");
    } catch {}
    CHILDREN.delete(child);
    await sleep(900);
    log(`CHILD_EXIT ${exited ? `code=${exited.code} signal=${exited.signal}` : "(still recorded alive)"}`);
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

  if (record.voidReason) {
    const recPath = path.join(PROBE_DIR, `${label}.boot.json`);
    fs.writeFileSync(recPath, `${JSON.stringify(record, null, 2)}\n`);
    log(`BOOT_RECORD ${recPath} usable=false void=${record.voidReason}`);
    return record;
  }

  const binPath = path.join(PROBE_DIR, `${label}.bin`);
  const slice = sliceThroughShippedCli(record.vsfPath, binPath);
  const raw = fs.readFileSync(binPath);
  log(`IMAGE ${binPath} bytes=${raw.length} sha256=${slice.sha256}`);
  log(`PORT_READS dirRead=${slice.dirRead} dataRead=${slice.dataRead}`);
  record.imagePath = binPath;
  record.imageBytes = raw.length;
  record.imageSha256 = slice.sha256;
  record.dirRead = slice.dirRead;
  record.dataRead = slice.dataRead;
  record.usable = raw.length === 65536;
  record.takenAt = new Date().toISOString();

  const recPath = path.join(PROBE_DIR, `${label}.boot.json`);
  fs.writeFileSync(recPath, `${JSON.stringify(record, null, 2)}\n`);
  log(`BOOT_RECORD ${recPath} usable=${record.usable}`);
  return record;
}

// --- the divergence measurement ----------------------------------------------

/** Count differing addresses over the declared window and over the whole 64K.
 *  Raw sliced images, deliberately: research's `59 / 1092 / 1242` were measured
 *  on the raw C64MEM slice, and a port-normalised count is reported BESIDE it
 *  rather than in place of it, so the two are comparable. */
function diverge(a, b) {
  const rawA = fs.readFileSync(a.imagePath);
  const rawB = fs.readFileSync(b.imagePath);
  if (rawA.length !== 65536 || rawB.length !== 65536) {
    throw new Error(`refusing to compare images of ${rawA.length} and ${rawB.length} bytes`);
  }
  const windowDiff = [];
  for (let addr = WINDOW_START; addr <= WINDOW_END; addr += 1) {
    if (rawA[addr] !== rawB[addr]) windowDiff.push(addr);
  }
  const totalDiff = [];
  for (let addr = 0; addr < 65536; addr += 1) {
    if (rawA[addr] !== rawB[addr]) totalDiff.push(addr);
  }
  const normA = Buffer.from(predicate.normalisePorts(rawA, { dirRead: a.dirRead, dataRead: a.dataRead }));
  const normB = Buffer.from(predicate.normalisePorts(rawB, { dirRead: b.dirRead, dataRead: b.dataRead }));
  let normTotal = 0;
  for (let addr = 0; addr < 65536; addr += 1) if (normA[addr] !== normB[addr]) normTotal += 1;
  return { windowDiff, totalDiff, normTotal, shaA: sha256(rawA), shaB: sha256(rawB) };
}

function reportPair(tag, a, b) {
  const d = diverge(a, b);
  log(`PAIR_${tag} ${a.label} vs ${b.label} port=${a.port}/${b.port} block=${a.block ? "present" : "OMITTED"}`);
  log(`PAIR_${tag}_SHA_A ${d.shaA}`);
  log(`PAIR_${tag}_SHA_B ${d.shaB}`);
  log(`PAIR_${tag}_STOP_A ${JSON.stringify(a.stop)}`);
  log(`PAIR_${tag}_STOP_B ${JSON.stringify(b.stop)}`);
  log(`PAIR_${tag}_WINDOW ${d.windowDiff.length} of ${WINDOW_SIZE}   first=${d.windowDiff.slice(0, 8).map(hex4).join(" ") || "(none)"}`);
  log(`PAIR_${tag}_TOTAL_64K ${d.totalDiff.length}   first=${d.totalDiff.slice(0, 8).map(hex4).join(" ") || "(none)"}`);
  log(`PAIR_${tag}_TOTAL_64K_PORT_NORMALISED ${d.normTotal}`);
  return d;
}

/** `SCHEMA.md` § 2.1's declared derivation, as code, so the value is produced
 *  by the rule and never chosen after the numbers are visible. */
function deriveSeedEffect(withBlock, withoutBlock) {
  if (withBlock === 0 && withoutBlock > 0) return "pinned";
  if (withBlock > 0 && withBlock < withoutBlock) return "partial";
  if (withBlock >= withoutBlock) return "unpinned";
  // withBlock === 0 && withoutBlock === 0: the window was never
  // nondeterministic, so the block was never tested. `pinned` requires BOTH
  // halves, so this is not it.
  return "unpinned";
}

// --- CLI ---------------------------------------------------------------------

const USAGE = `usage: node determinism-probe.mjs <command>

  run        six cold boots (2 without the block, 2 with, 2 with on a second
             port) plus every comparison and the derived SEED_EFFECT line
  preflight  D-11 only: print the broker state and any live x64sc, then exit
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

  log(`PROBE determinism-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`NODE ${process.version}`);
  log(`VICE_VERSION ${execFileSync(VICE_BIN, ["--version"], { encoding: "utf8" }).trim()}`);
  log(`STOCK_DETERMINISM_SEED ${STOCK_DETERMINISM_SEED}`);
  log(`STOCK_DETERMINISM_FLAGS ${JSON.stringify(STOCK_DETERMINISM_FLAGS)}`);
  log(`WINDOW ${hex4(WINDOW_START)}-${hex4(WINDOW_END)} = ${WINDOW_SIZE} addresses`);
  preflight();

  const boots = [];
  const plan = [
    { label: "A1-noblock-p1", port: PORT_A, block: false },
    { label: "A2-noblock-p1", port: PORT_A, block: false },
    { label: "B1-block-p1", port: PORT_A, block: true },
    { label: "B2-block-p1", port: PORT_A, block: true },
    { label: "B3-block-p2", port: PORT_B, block: true },
    { label: "B4-block-p2", port: PORT_B, block: true },
  ];
  for (const spec of plan) {
    log("");
    log(`--- boot ${spec.label} -------------------------------------------------`);
    boots.push(await coldBoot(spec));
    await sleep(700);
  }

  const by = new Map(boots.map((b) => [b.label, b]));
  const voided = boots.filter((b) => !b.usable);
  log("");
  log(`VOIDED_BOOTS ${voided.length ? voided.map((b) => `${b.label}(${b.voidReason})`).join(" ; ") : "(none)"}`);
  if (voided.length) throw new Error(`${voided.length} boot(s) produced no usable image -- refusing to derive from a partial set`);

  log("");
  log(`--- comparisons ------------------------------------------------------`);
  const armA = reportPair("A", by.get("A1-noblock-p1"), by.get("A2-noblock-p1"));
  const armB = reportPair("B", by.get("B1-block-p1"), by.get("B2-block-p1"));
  const armC = reportPair("C", by.get("B3-block-p2"), by.get("B4-block-p2"));

  log("");
  log(`--- the concurrency arm ----------------------------------------------`);
  const argvP1 = by.get("B1-block-p1").argv;
  const argvP2 = by.get("B3-block-p2").argv;
  log(`CONCURRENCY_ARGV_P1 ${JSON.stringify(argvP1)}`);
  log(`CONCURRENCY_ARGV_P2 ${JSON.stringify(argvP2)}`);
  const differingIndices = [];
  const maxLen = Math.max(argvP1.length, argvP2.length);
  for (let i = 0; i < maxLen; i += 1) if (argvP1[i] !== argvP2[i]) differingIndices.push(i);
  log(`CONCURRENCY_ARGV_DIFFERING_INDICES ${JSON.stringify(differingIndices)}`);
  for (const i of differingIndices) log(`CONCURRENCY_ARGV_DIFF[${i}] p1=${argvP1[i]} p2=${argvP2[i]}`);
  const onlyPortElement =
    differingIndices.length === 1 && String(argvP1[differingIndices[0]]).startsWith("ip4://");
  log(`CONCURRENCY_ARGV_DIFFERS_ONLY_IN_IP4_ELEMENT ${onlyPortElement ? "yes" : "no"}`);
  log(`CONCURRENCY_WINDOW_P1 ${armB.windowDiff.length} of ${WINDOW_SIZE}`);
  log(`CONCURRENCY_WINDOW_P2 ${armC.windowDiff.length} of ${WINDOW_SIZE}`);
  log(`CONCURRENCY_SAME_WINDOW_COUNT ${armB.windowDiff.length === armC.windowDiff.length ? "yes" : "no"}`);

  log("");
  log(`--- the derivation ---------------------------------------------------`);
  log(`NOSEED_DIFF_C000_CFEF ${armA.windowDiff.length} of ${WINDOW_SIZE}`);
  log(`BLOCK_DIFF_C000_CFEF ${armB.windowDiff.length} of ${WINDOW_SIZE}`);
  log(`NOSEED_DIFF_TOTAL_64K ${armA.totalDiff.length}`);
  log(`BLOCK_DIFF_TOTAL_64K ${armB.totalDiff.length}`);
  log(`DERIVED_SEED_EFFECT ${deriveSeedEffect(armB.windowDiff.length, armA.windowDiff.length)}`);
  return 0;
}

process.exitCode = await main();
