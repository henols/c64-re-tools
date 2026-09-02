#!/usr/bin/env node
// -----------------------------------------------------------------------------
// capture-pair.mjs -- plan 33-10's named, repeatable capture script.
//
// WHAT IT IS FOR
// --------------
// `GATE-01`'s one corpus-dependent input, `C0_CAPTURE_PAIR`, needs ONE real
// cracked release AUTOSTARTED with true drive emulation in the loop, captured
// TWICE through the route this phase built, and the pair compared under
// `CAP-02`'s committed predicate. This script takes those captures and does
// that comparison, so the number in `evidence/33-capture-pair.md` is
// reproducible by re-running a committed script rather than by recalling a
// session.
//
// IT DRIVES THE SHIPPED SEAMS, NOT PRIVATE COPIES OF THEM
// -------------------------------------------------------
// Everything below that could have been re-authored is imported or invoked
// instead, because a second copy of any of it would make this measurement a
// measurement of the copy:
//
//   * the argv           -> `broker-launch.mts`'s `buildViceArgs()`, reached by
//                           actually ACQUIRING over the broker's control plane
//                           (`vice-broker-client.ts`'s
//                           `acquireOverControlPlane()`), with a
//                           `profile: { headless: true }`. The argv recorded in
//                           the transcript is transcribed from the broker's own
//                           `launching ...` stderr line, never rebuilt here.
//   * the wire           -> `stock-protocol.ts`'s `ViceMonitorClient`,
//                           `checkpointSetBody`, `autostartBody`, `dumpBody`,
//                           `memspaceBody`, `resourceGetBody`,
//                           `advanceInstructionsBody`, `conditionSetBody`.
//                           `memspace: 0x00` always goes through the encoders'
//                           own wire-byte mapping (`memspaceByte()`), never as
//                           a hand-written `body[8] =` (`T-33-17`).
//   * the .vsf layout    -> the SHIPPED `vsf-slice` CLI entry point, spawned via
//                           the skill-side wrapper
//                           `src/skills/c64-ram-capture/scripts/vsf-slice.mjs`.
//                           NOT ONE snapshot byte offset, module name or body
//                           length appears in this file, and none may be added:
//                           the layout is version-sensitive and lives in exactly
//                           one module (`src/mcp/vice/vsf-slice.ts`).
//   * the predicate      -> `capture-predicate.ts`'s `normalisePorts()`,
//                           `compareCaptures()`, `parseAllowList()`,
//                           `argvDigest()`.
//   * the stop oracle    -> `stop-oracle.ts`'s `compareStopIdentity()` and
//                           `ORACLE_TERMS`.
//
// WHY IT DOES *NOT* CALL `runReproducible()`
// ------------------------------------------
// `stock-reproducible-run.ts` is this phase's protocol seam and it implements
// the READY-PROMPT sequence: it issues a monitor-issued HARD RESET from inside
// the procedure. Two independent reasons make it unusable for an AUTOSTARTED
// release, and both are recorded in that module's own header:
//
//   1. `AUTOSTART` (0xdd) IS the power cycle (`autostart.c:1437`). A `RESET`
//      before or after it undoes the autostart -- `33-03`'s `P11`, measured
//      (research's first attempt stopped inside the KERNAL reset routine at
//      `PC=$FD75`, `hits=0`). A procedure whose second step is a hard reset
//      cannot reach a stop with a release loaded.
//   2. `runReproducible()` sends EXACTLY ONE resume per wait, deliberately, and
//      an anchor hit arriving first is REFUSED rather than resumed past. The
//      anchor-COUNTING loop (`33-03`'s `S3` steps 8-10, N resumes for N hits) is
//      named in that module's WHAT NOT TO DO list as "an evidence script's job,
//      driving this module's pieces directly, and NOT a published tool surface".
//
// So this script is exactly the evidence script that module's header points at.
// It drives the pieces `runReproducible()` is assembled from, in `33-03`'s
// settled `S3` order, with no `RESET` anywhere.
//
// WHY IT DOES *NOT* USE `snapshotPathFor()`
// -----------------------------------------
// `stock-paths.ts`'s `snapshotPathFor()` returns
// `<repoRoot>/.vice-snapshots/<name>.vsf` -- INSIDE the checkout. That
// directory is gitignored, so a `git status` grep would not see the file, but
// `D-27` and threat `T-33-06` are about bytes not ENTERING the checkout at all,
// not about them being ignored once there. Every `.vsf` and `.bin` this script
// writes therefore lands under
// `PROBE_DIR=$HOME/.cache/c64-re-tools/phase33/33-10`, outside the checkout
// entirely. Recorded as an accepted limit in `33-capture-pair.md` rather than
// silently applied.
//
// WHAT NOT TO DO
// --------------
//   - Never copy a snapshot byte offset, module name or body length into this
//     file. Slice through the CLI or not at all.
//   - Never retry a run to get the allow-list under the cap. `33-03` measured
//     66 differing addresses at jitter 4000 against `D-22`'s cap of 64: the
//     overflow is an OBSERVED outcome and `C0_CAPTURE_PAIR: fail` with its
//     recorded cause is the honest answer, not a signal to take more runs.
//   - Never select the two most similar of N runs. Every run this script takes
//     writes its own `<label>.run.json`; the reported pair is named in the
//     evidence file and is the first two usable runs in the order taken.
//   - Never launch with the broker's warm floor at its default of 1. A second
//     emulator competes for the host scheduler, and the scheduler is what
//     decides the halt moment, which is what decides the stop identity past the
//     start of a disk load (`33-03`'s own cause analysis). `VICE_BROKER_WARM_FLOOR=0`
//     is set below and is load-bearing, not tidiness.
//   - Never use `pgrep -af x64sc` for the `D-11` guard: the `-af` form matches
//     the checking process's own command line. `pgrep -x x64sc` is the correct
//     check, not a weaker one.
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

/** The shipped `vsf-slice` entry point, reached through the skill-side
 *  wrapper. Spawned, never imported, because that wrapper IS the published
 *  route a skill takes and this measurement is of the published route. */
const VSF_SLICE_CLI = path.join(SKILL_SCRIPTS, "vsf-slice.mjs");

const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const predicate = await import(path.join(MCP_DIR, "capture-predicate.ts"));
const oracle = await import(path.join(MCP_DIR, "stop-oracle.ts"));
const brokerClient = await import(path.join(MCP_DIR, "vice-broker-client.ts"));

const { CommandType, CheckpointOperation, ViceMonitorClient } = proto;

// --- fixed inputs ------------------------------------------------------------

/** Genuine unpatched stock VICE 3.9. The fork shadows a bare `x64sc` at
 *  /usr/local/bin, so the absolute path is load-bearing. */
const VICE_BIN = "/usr/bin/x64sc";

/** The canonical corpus release (`D-27`). Gitignored, never committed;
 *  identity travels as name plus sha256 and nothing else. */
const RELEASE = path.join(
  REPO_ROOT,
  ".planning",
  "phases",
  "23-the-real-release-gate-go-degrade-no-go",
  "evidence",
  "corpus",
  "danish.d64",
);
const RELEASE_ID = "danish";
const RELEASE_SHA256_EXPECTED = "1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5";

/** Outside the checkout, and never /tmp (tmpfs on this host, 16 GB, emptied
 *  only on reboot -- it has already cost this project a build). */
const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase33", "33-10");
const BROKER_STATE_DIR = path.join(PROBE_DIR, "broker-state");

/** The KERNAL IRQ entry. Used because it MEASURABLY still executes after
 *  `danish`'s load (`33-RESEARCH.md` M6, 400 hits reached). Explicitly NOT a
 *  default: `D-14`'s refusal when `frame_anchor` is absent stands, because a
 *  cracked release usually takes the IRQ over and this release happening not to
 *  is a fact about this release. */
const FRAME_ANCHOR = 0xea31;

/** Drive unit 8's wire memspace byte. `0x01`, NEVER `0x08` -- the wire byte is
 *  not VICE's internal enum and the monitor rejects `0x08`
 *  (`monitor_binary.c:401-434`). */
const MEMSPACE_DRIVE8 = 0x01;
const MEMSPACE_MAIN = 0x00;

/** The 1541 DOS ROM window. Armed as a RANGE so the drive's own idle loop
 *  hits it, whatever entry point that loop happens to use on this build. */
const DRIVE_ROM_START = 0xe000;
const DRIVE_ROM_END = 0xffff;

/** The `@bank:`-bearing checkpoint condition used as check (b) of the main-CPU
 *  memspace assertion. Every comparison parenthesised: conditions have NO
 *  operator precedence (`mon_parse.y:168`), so an unparenthesised comparison
 *  chain silently parses into something always-false. Bare integers are hex by
 *  default (`monitor.c:1597`), so both literals are written with `$`. */
const BANK_CONDITION = "(@ram:$0400 == $20)";

// --- small helpers -----------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const hex4 = (n) => `$${n.toString(16).padStart(4, "0")}`;

function argValue(argv, name, fallback = null) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback;
}

// --- D-11 in code, not in shell discipline -----------------------------------
//
// `33-03` ran this as a shell habit first and it FAILED: five throwing runs
// orphaned their emulators, sixteen later runs were taken against them, all
// sixteen were voided, and two numbers moved materially in the re-take. The
// guard belongs in the one place no invocation can forget it.

function systemdBrokerState() {
  try {
    return execFileSync("systemctl", ["--user", "is-active", "vice-broker"], { encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout ?? "").trim() || "inactive";
  }
}

function aliveX64sc() {
  try {
    return execFileSync("pgrep", ["-x", "x64sc"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return []; // pgrep exits 1 with no match
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
    throw new Error(
      `D-11 REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}). Measurement not taken.`,
    );
  }
}

// Every child this script starts is registered here and reaped from
// `process.on("exit")`, so no throw anywhere below can orphan an emulator or a
// broker. This is the fix `33-03` had to make at the cause.
const CHILDREN = new Set();
function reapAll() {
  for (const child of CHILDREN) {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
  CHILDREN.clear();
  // A broker killed with SIGKILL cannot reap its own instances, so sweep any
  // survivor by exact name. Nothing else on this host runs stock x64sc during a
  // measurement -- preflight() refused if anything did.
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

// --- the task-scoped broker --------------------------------------------------

/**
 * Start a broker for THIS TASK ONLY, with its state directory under PROBE_DIR
 * so the repository's own `.vice-supervisor/broker.json` is untouched and the
 * `BACK-05` assertion cannot see it.
 *
 * Deliberately a CHILD of this process, not `setsid`/`nohup`: a detached broker
 * dies with the session and voids every capture in flight, and there is no
 * reconnect. A child broker's lifetime is exactly this script's lifetime, which
 * is the property a measurement needs.
 *
 * `VICE_BROKER_WARM_FLOOR=0` is load-bearing -- see WHAT NOT TO DO.
 */
async function startBroker() {
  fs.rmSync(BROKER_STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(BROKER_STATE_DIR, { recursive: true });
  const brokerJs = path.join(MCP_DIR, "resources", "vice-broker.mjs");
  const argv = [brokerJs, "--repo-root", REPO_ROOT, "--state-dir", BROKER_STATE_DIR];
  const env = {
    ...process.env,
    VICE_BIN,
    VICE_BROKER_WARM_FLOOR: "0",
    VICE_BROKER_MAX: "1",
  };
  log(`BROKER_START_ENV VICE_BIN=${VICE_BIN} VICE_BROKER_WARM_FLOOR=0 VICE_BROKER_MAX=1`);
  log(`BROKER_START_CMD ${process.execPath} ${argv.join(" ")}`);
  log(`BROKER_START_AT ${new Date().toISOString()}`);
  const child = spawn(process.execPath, argv, { env, stdio: ["ignore", "pipe", "pipe"] });
  CHILDREN.add(child);
  let stderr = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  const brokerJson = brokerClient.brokerJsonPath(BROKER_STATE_DIR);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (fs.existsSync(brokerJson)) break;
    await sleep(200);
  }
  if (!fs.existsSync(brokerJson)) {
    throw new Error(`broker never wrote ${brokerJson} within 30 s. stderr:\n${stderr}`);
  }
  const record = JSON.parse(fs.readFileSync(brokerJson, "utf8"));
  log(`BROKER_JSON pid=${record.pid} control=${record.control_host}:${record.control_port} warm_floor=${record.warm_floor} max=${record.max_instances}`);
  const backend = /detected backend "([a-z]+)" for (\S+)/.exec(stderr);
  if (backend) log(`BROKER_BACKEND ${backend[1]} binary=${backend[2]}`);
  return {
    child,
    get stderr() {
      return stderr;
    },
    stop() {
      log(`BROKER_STOP_AT ${new Date().toISOString()}`);
      try {
        child.kill("SIGTERM");
      } catch {}
      CHILDREN.delete(child);
    },
  };
}

/** The one place the spawn argv is obtained: transcribed from the broker's own
 *  `launching ...` stderr line, never rebuilt in this file. A rebuilt argv
 *  would digest to whatever this file believes rather than to what execve
 *  actually received. */
function argvFromBrokerStderr(stderr, port) {
  const line = stderr
    .split("\n")
    .reverse()
    .find((l) => l.includes("vice-broker: launching ") && l.includes(`:${port}`));
  if (!line) throw new Error(`no "launching" line for port ${port} in broker stderr:\n${stderr}`);
  const m = /vice-broker: launching (.*?)(?: \(XDG_CONFIG_HOME=(.*)\))?$/.exec(line.trim());
  if (!m) throw new Error(`could not parse the broker's launching line: ${line}`);
  return { argv: m[1].trim().split(/\s+/), xdg: m[2] ?? null, line: line.trim() };
}

// --- monitor helpers ---------------------------------------------------------

/** Dial until the monitor's listener accepts.
 *
 *  MEASURED, and the reason this retry exists rather than a bare `connect()`:
 *  the broker's `acquire` returns as soon as the port is allocated and the
 *  launch is under way -- the first run of this script saw `ACQUIRE_MS 33`
 *  followed immediately by `ECONNREFUSED 127.0.0.1:6600`, because `x64sc` had
 *  not yet bound the binary-monitor socket. A single-shot connect therefore
 *  measures the broker's grant latency, not the emulator's readiness. The
 *  elapsed dial time is recorded as `CONNECTED_AFTER_MS` so it is visible as
 *  part of the pre-protocol interval rather than hidden inside it. */
async function connectWithRetry(client, port, { budgetMs = 30000 } = {}) {
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

/** PING until answered. An accepted TCP connection is NOT a serving monitor:
 *  the listen backlog accepts before the monitor services, measured in `33-03`
 *  under `-initbreak reset` where an accepted socket left every command
 *  unanswered for the full budget. */
async function pingReady(client) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 3000 });
      log(`MONITOR_READY_AFTER_PINGS ${attempt}`);
      return attempt;
    } catch (err) {
      if (attempt >= 10) {
        throw new Error(`monitor accepted the socket but never answered PING after ${attempt} attempts: ${err.message}`);
      }
      await sleep(500);
    }
  }
}

/** Resolve register ids BY NAME from the REGISTERS_AVAILABLE catalog. Wire ids
 *  are not stable across builds and these feed the stop-identity oracle, so
 *  hardcoding 3/53/54 would silently mis-read. */
async function registerIds(client, memspace = MEMSPACE_MAIN) {
  const reply = await client.send(CommandType.RegistersAvailable, proto.memspaceBody({ memspace }));
  const byName = new Map(reply.registers.map((r) => [r.name.toUpperCase(), r.id]));
  const catalog = reply.registers.map((r) => `${r.id}:${r.name}(${r.size}b)`).join(" ");
  const need = ["PC", "LIN", "CYC"];
  for (const name of need) {
    if (!byName.has(name)) {
      throw new Error(`register ${name} is absent from this build's catalog on memspace 0x0${memspace}: ${catalog}`);
    }
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
  for (const extra of ["00", "01", "A", "X", "Y", "SP", "FL"]) {
    const id = ids.byName.get(extra);
    if (id !== undefined && byId.has(id)) out[extra] = byId.get(id);
  }
  return out;
}

/** Arm an Exec checkpoint through the SHIPPED encoder, so the memspace byte
 *  goes through `memspaceByte()`'s own wire-byte mapping (`T-33-17`).
 *  `stop: true` always: a non-stopping checkpoint emits CHECKPOINT_INFO
 *  synchronously from inside the CPU loop on every hit (`T-33-10`). */
async function armExec(client, { start, end = start, memspace = MEMSPACE_MAIN, temporary = false }) {
  return client.send(
    CommandType.CheckpointSet,
    proto.checkpointSetBody({
      start,
      end,
      stop: true,
      enabled: true,
      operation: CheckpointOperation.Exec,
      temporary,
      memspace,
    }),
  );
}

async function checkpointList(client, tag) {
  const reply = await client.send(CommandType.CheckpointList, Buffer.alloc(0));
  log(`CHECKPOINT_LIST_${tag} total=${reply.total} items=${reply.checkpoints.length}`);
  for (const cp of reply.checkpoints) {
    log(
      `  CP id=${cp.id} start=${hex4(cp.start)} end=${hex4(cp.end)} stop=${cp.stopWhenHit} enabled=${cp.enabled} op=0x${cp.operation.toString(16)} temporary=${cp.temporary} hits=${cp.hitCount}`,
    );
  }
  return reply;
}

/**
 * Count `target` hits of checkpoint `cpId`, resuming ONCE per observed hit.
 *
 * `33-03`'s `S3` steps 8-10. A `stop: true` checkpoint halts on every hit, so N
 * hits need N resumes -- the stock-native form of `vice-sync.ts`'s "exactly one
 * resume per wait" invariant, applied per wait rather than per count. The loop
 * keys on `hit_count` and never on paused state, which is that invariant's other
 * half.
 */
function countHits(client, cpId, target, { budgetMs = 120000 } = {}) {
  return new Promise((resolve) => {
    let last = 0;
    const resume = () => {
      client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 }).catch(() => {});
    };
    const finish = (result) => {
      clearTimeout(timer);
      client.off("event", onEvent);
      resolve(result);
    };
    const onEvent = (frame) => {
      if (frame.type === "jam") {
        finish({ reached: false, hits: last, reason: "JAM (0x61, zero-length body) -- CPU jammed" });
        return;
      }
      if (frame.type !== "checkpoint_info" || frame.checkpoint.id !== cpId) return;
      last = frame.checkpoint.hitCount;
      if (last >= target) {
        finish({ reached: true, hits: last, reason: null });
        return;
      }
      resume();
    };
    const timer = setTimeout(
      () => finish({ reached: false, hits: last, reason: `budget ${budgetMs} ms exhausted at ${last} of ${target} hits` }),
      budgetMs,
    );
    client.on("event", onEvent);
    resume();
  });
}

/** Wait for exactly ONE CHECKPOINT_INFO frame for `cpId`, resuming once. */
function awaitOneHit(client, cpId, { budgetMs = 60000 } = {}) {
  return new Promise((resolve) => {
    const finish = (result) => {
      clearTimeout(timer);
      client.off("event", onEvent);
      resolve(result);
    };
    const onEvent = (frame) => {
      if (frame.type !== "checkpoint_info" || frame.checkpoint.id !== cpId) return;
      finish({ hit: true, frame });
    };
    const timer = setTimeout(() => finish({ hit: false, frame: null }), budgetMs);
    client.on("event", onEvent);
    client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 }).catch(() => {});
  });
}

// --- the shipped slicer ------------------------------------------------------

/** Reach the flat 64K through the SHIPPED `vsf-slice` CLI entry point. This
 *  function is the only route from a snapshot to an image in this file, and it
 *  parses no snapshot bytes: it reads the CLI's `--json` summary, which carries
 *  the image sha256 and the two CPU-visible port read-back values the predicate
 *  needs for `normalisePorts()`. */
function sliceThroughShippedCli(vsfPath, outPath) {
  const argv = [VSF_SLICE_CLI, "slice", vsfPath, "--out", outPath, "--json"];
  log(`$ node ${argv.join(" ")}`);
  const run = spawnSync(process.execPath, argv, { encoding: "utf8" });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) {
    throw new Error(`vsf-slice exited ${run.status}: ${run.stderr || run.stdout}`);
  }
  log(run.stdout.trim());
  return JSON.parse(run.stdout.trim());
}

// --- one capture -------------------------------------------------------------

async function takeRun({ label, jitterMs, target }) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });

  log(`RUN_LABEL ${label}`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`NODE ${process.version}`);
  log(`DATE_UTC ${new Date().toISOString()}`);
  const releaseBytes = fs.readFileSync(RELEASE);
  const releaseSha = sha256(releaseBytes);
  log(`RELEASE ${RELEASE}`);
  log(`RELEASE_SHA256 ${releaseSha}`);
  if (releaseSha !== RELEASE_SHA256_EXPECTED) {
    throw new Error(
      `release identity REFUSAL: ${RELEASE} digests to ${releaseSha}, expected ${RELEASE_SHA256_EXPECTED}. ` +
        `A release is identified by its BYTES, never by its filename -- two files with the same name and ` +
        `different bytes are different releases.`,
    );
  }
  log(`VICE_VERSION ${execFileSync(VICE_BIN, ["--version"], { encoding: "utf8" }).trim()}`);

  preflight();
  const broker = await startBroker();

  let grantHandle = null;
  const record = { label, jitterMs, target, release: RELEASE_ID, releaseSha256: releaseSha, usable: false };

  try {
    const t0 = Date.now();
    grantHandle = await brokerClient.acquireOverControlPlane(BROKER_STATE_DIR, { profile: { headless: true } });
    const { grant } = grantHandle;
    log(`ACQUIRE_MS ${Date.now() - t0}`);
    log(`GRANT id=${grant.id} port=${grant.port} supervisor_dir=${grant.supervisor_dir}`);
    log(`ACQUIRE_PROFILE {"headless":true}`);

    const spawned = argvFromBrokerStderr(broker.stderr, grant.port);
    log(`BROKER_LAUNCH_LINE ${spawned.line}`);
    log(`SPAWN_ARGV ${JSON.stringify(spawned.argv)}`);
    log(`SPAWN_ARGV_INDEX_0 ${spawned.argv[1]}`);
    log(`XDG_CONFIG_HOME ${spawned.xdg ?? "(not recorded)"}`);
    // argvDigest() over the emulator's own argument vector -- the argv[0]
    // binary path included, because a different binary is a different launch.
    const argvDigest = predicate.argvDigest(spawned.argv);
    log(`ARGV_DIGEST ${argvDigest}`);
    const seedIndex = spawned.argv.indexOf("-seed");
    const seed = seedIndex >= 0 ? spawned.argv[seedIndex + 1] : "(absent)";
    log(`SEED ${seed}`);
    record.spawnArgv = spawned.argv;
    record.argvDigest = argvDigest;
    record.seed = seed;
    record.grantPort = grant.port;

    // PRE-protocol jitter: it shifts the moment our monitor connect halts the
    // machine, which is the whole point of varying it.
    log(`JITTER_MS ${jitterMs}`);
    if (jitterMs > 0) await sleep(jitterMs);

    const client = new ViceMonitorClient();
    const events = [];
    client.on("event", (frame) => events.push(frame.type));
    const tConnect = Date.now();
    await connectWithRetry(client, grant.port, { budgetMs: 60000 });
    log(`CONNECTED_AFTER_MS ${Date.now() - tConnect}`);
    await sleep(400);
    log(`OPEN_EVENTS ${events.join(",") || "(none)"}`);
    await pingReady(client);

    const ids = await registerIds(client);
    log(`REGISTER_CATALOG ${ids.catalog}`);

    for (const name of ["Drive8TrueEmulation", "Drive8Type", "AutostartDelayRandom"]) {
      const reply = await client.send(CommandType.ResourceGet, proto.resourceGetBody({ name }));
      log(`RESOURCE ${name}=${reply.value}`);
      record[`resource_${name}`] = reply.value;
    }

    // S3 step 5: arm the frame anchor WHILE HALTED, before AUTOSTART.
    const armed = await armExec(client, { start: FRAME_ANCHOR });
    log(`ARMED_BEFORE_AUTOSTART cp=${armed.checkpoint.id} start=${hex4(armed.checkpoint.start)} stop=${armed.checkpoint.stopWhenHit} temporary=${armed.checkpoint.temporary} hits=${armed.checkpoint.hitCount}`);

    // S3 step 6: AUTOSTART. THIS is the reset -- no RESET appears anywhere.
    const as = await client.send(
      CommandType.AutoStart,
      proto.autostartBody({ runAfter: true, fileIndex: 0, filename: RELEASE }),
      { timeoutMs: 60000 },
    );
    log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")} responseType=0x${as.responseType.toString(16)}`);

    // S3 step 7: assert the anchor survived AUTOSTART's power cycle. Kept as an
    // assertion, never an inference.
    const survived = await checkpointList(client, "AFTER_AUTOSTART");
    log(`ANCHOR_SURVIVED_AUTOSTART ${survived.total > 0 ? "yes" : "no"}`);
    if (survived.total === 0) throw new Error("the frame anchor did not survive AUTOSTART's power cycle");

    // S3 steps 8-10: one EXIT per observed hit, to the target count.
    const counted = await countHits(client, armed.checkpoint.id, target, { budgetMs: 180000 });
    log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);
    record.hits = counted.hits;
    record.countReached = counted.reached;

    // S3 step 11: all four stop-identity terms from ONE reply.
    const regs = await readRegisters(client, ids);
    log(`STOP PC=${hex4(regs.pc)} hit_count=${counted.hits} LIN=${regs.lin} CYC=${regs.cyc} $00=${regs["00"] ?? "-"} $01=${regs["01"] ?? "-"}`);
    // Written under `stop-oracle.ts`'s OWN term names (`ORACLE_TERMS`), so a
    // reader of the record and a caller of `compareStopIdentity()` cannot
    // disagree about which field is which.
    record.stop = { pc: regs.pc, hitCount: counted.hits, line: regs.lin, cycle: regs.cyc };
    record.registers = { PC: regs.pc, LIN: regs.lin, CYC: regs.cyc };
    record.ports = { reg00: regs["00"] ?? null, reg01: regs["01"] ?? null };

    const cpsAtExit = await checkpointList(client, "AT_EXIT");
    record.checkpointsAtExit = cpsAtExit.total;

    // The snapshot -- under PROBE_DIR, outside the checkout.
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
    record.vsfBytes = vsfSize;

    client.disconnect?.();
    if (!counted.reached) {
      record.voidReason = `the anchor count did not reach ${target}: ${counted.reason}`;
    }
  } finally {
    if (grantHandle) {
      grantHandle.release();
      await sleep(1500);
    }
    broker.stop();
    await sleep(1500);
    const after = aliveX64sc();
    log(`POST_X64SC ${after.length ? after.join(",") : "(none)"}`);
    if (after.length) {
      try {
        execFileSync("pkill", ["-x", "x64sc"]);
      } catch {}
      log(`POST_X64SC_SWEPT ${after.join(",")}`);
    }
  }

  // Slice through the shipped CLI, then normalise the two port addresses in
  // code from THIS snapshot's own dirRead/dataRead.
  const binPath = path.join(PROBE_DIR, `${label}.bin`);
  const slice = sliceThroughShippedCli(record.vsfPath, binPath);
  const raw = fs.readFileSync(binPath);
  log(`IMAGE_RAW ${binPath} bytes=${raw.length} sha256=${slice.sha256}`);
  log(`PORT_READS dirRead=${slice.dirRead} dataRead=${slice.dataRead} dataOut=${slice.dataOut}`);
  const normalised = Buffer.from(
    predicate.normalisePorts(raw, { dirRead: slice.dirRead, dataRead: slice.dataRead }),
  );
  const normPath = path.join(PROBE_DIR, `${label}.norm.bin`);
  fs.writeFileSync(normPath, normalised);
  log(`IMAGE_NORMALISED ${normPath} bytes=${normalised.length} sha256=${sha256(normalised)}`);

  record.imagePath = binPath;
  record.imageBytes = raw.length;
  record.imageSha256 = slice.sha256;
  record.normalisedPath = normPath;
  record.normalisedSha256 = sha256(normalised);
  record.dirRead = slice.dirRead;
  record.dataRead = slice.dataRead;
  record.snapshotMinor = slice.snapshotMinor;
  record.bodyLength = slice.bodyLength;
  record.usable = record.voidReason === undefined && raw.length === 65536;
  record.takenAt = new Date().toISOString();

  const recPath = path.join(PROBE_DIR, `${label}.run.json`);
  fs.writeFileSync(recPath, `${JSON.stringify(record, null, 2)}\n`);
  log(`RUN_RECORD ${recPath} usable=${record.usable}${record.voidReason ? ` void=${record.voidReason}` : ""}`);
  return record;
}

// --- the comparison ----------------------------------------------------------

/** Map a run record's stop onto `ORACLE_TERMS`' own names.
 *
 *  Accepts BOTH the `line`/`cycle` spelling `takeRun()` writes and the
 *  `lin`/`cyc` spelling the FIRST TWO runs of this measurement were written
 *  with, before the field names here were aligned with `stop-oracle.ts`'s.
 *  This maps KEY NAMES only -- not one recorded VALUE is altered, defaulted or
 *  inferred, and a record carrying neither spelling for a term is left absent
 *  so `compareStopIdentity()` refuses it by name rather than being handed a
 *  zero. Recorded as a named function rather than an inline `??` so the reason
 *  the two spellings exist is written down beside them.
 */
function toStopIdentity(record) {
  const s = record.stop ?? {};
  const out = { pc: s.pc, hitCount: s.hitCount };
  if (s.line !== undefined) out.line = s.line;
  else if (s.lin !== undefined) out.line = s.lin;
  if (s.cycle !== undefined) out.cycle = s.cycle;
  else if (s.cyc !== undefined) out.cycle = s.cyc;
  return out;
}

function loadRecord(label) {
  const p = path.join(PROBE_DIR, `${label}.run.json`);
  if (!fs.existsSync(p)) throw new Error(`no run record at ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function comparePair({ labelA, labelB, allowListPath }) {
  const a = loadRecord(labelA);
  const b = loadRecord(labelB);

  log(`PAIR_A ${a.label} jitter=${a.jitterMs} argvDigest=${a.argvDigest} seed=${a.seed} releaseSha=${a.releaseSha256}`);
  log(`PAIR_B ${b.label} jitter=${b.jitterMs} argvDigest=${b.argvDigest} seed=${b.seed} releaseSha=${b.releaseSha256}`);

  // The reproducibility key is the TRIPLE (binary sha256, argv digest, seed).
  // Two captures whose keys differ are different keys and must not be compared
  // as a pair -- refused rather than warned.
  const keyA = [a.releaseSha256, a.argvDigest, String(a.seed)].join("|");
  const keyB = [b.releaseSha256, b.argvDigest, String(b.seed)].join("|");
  log(`REPRO_KEY_A ${keyA}`);
  log(`REPRO_KEY_B ${keyB}`);
  log(`REPRO_KEY_MATCH ${keyA === keyB ? "yes" : "no"}`);
  if (keyA !== keyB) {
    throw new Error(
      "REFUSAL: the two runs do not share a reproducibility key (binary sha256, argv digest, seed). " +
        "Different keys are different launches and must not be compared as a pair.",
    );
  }

  const stopA = toStopIdentity(a);
  const stopB = toStopIdentity(b);
  const stopCmp = oracle.compareStopIdentity(stopA, stopB);
  log(`ORACLE_TERMS ${JSON.stringify(oracle.ORACLE_TERMS)}`);
  log(`STOP_IDENTITY_A ${JSON.stringify(stopA)}`);
  log(`STOP_IDENTITY_B ${JSON.stringify(stopB)}`);
  log(`STOP_IDENTITY_VERDICT ${JSON.stringify(stopCmp)}`);

  let allowList = [];
  let allowListSource = "empty (no allow-list artifact given)";
  if (allowListPath) {
    if (!fs.existsSync(allowListPath)) {
      throw new Error(`allow-list ${allowListPath} does not exist -- refusing to substitute an empty one silently`);
    }
    allowList = predicate.parseAllowList(JSON.parse(fs.readFileSync(allowListPath, "utf8")));
    allowListSource = `${allowListPath} (release "${allowList.release}", ${allowList.addresses.length} entries)`;
  }
  log(`ALLOW_LIST ${allowListSource}`);

  const imgA = fs.readFileSync(a.normalisedPath);
  const imgB = fs.readFileSync(b.normalisedPath);
  const cmp = predicate.compareCaptures(imgA, imgB, allowList);
  log(`COMPARE verdict=${cmp.verdict} differing=${cmp.differing.length} allowed=${cmp.allowed.length} cap=${cmp.cap} allowListSize=${cmp.allowListSize}`);
  log(`DIFFERING_COUNT ${cmp.differing.length}`);
  log(`DIFFERING_FIRST_20 ${cmp.differing.slice(0, 20).map((n) => predicate.hex4(n)).join(" ") || "(none)"}`);
  log(`ALLOWED_FIRST_20 ${cmp.allowed.slice(0, 20).map((n) => predicate.hex4(n)).join(" ") || "(none)"}`);
  log(predicate.formatComparison(cmp, 20));

  // SCHEMA.md § 2.5's declared derivation, applied. Written here as code so the
  // value is derived by a rule and not chosen after seeing the numbers.
  const capExceeded = cmp.allowListSize > cmp.cap;
  const value = cmp.verdict === "equivalent" && !capExceeded ? "pass" : "fail";
  log(`DERIVED_C0_CAPTURE_PAIR ${value}`);
  log(`DERIVED_CAPTURE_FRAME_EXACT ${stopCmp.identical ? "yes" : "no"}`);
  if (!stopCmp.identical) log(`DERIVED_DIFFERING_TERMS ${stopCmp.differingTerms.join(",")}`);
  return { cmp, stopCmp, value };
}

// --- Task 3: the main-CPU memspace assertion --------------------------------

/**
 * THE MAIN-CPU MEMSPACE ASSERTION, stated before it is run.
 *
 * A drive checkpoint hit sets `default_memspace` (`monitor.c:3393-3396`) and NO
 * binary-monitor command resets it. After that, per `33-RESEARCH.md`'s pitfall
 * `P10`, TWO things go wrong and they are the assertion's two checks:
 *
 *   (a) `ADVANCE_INSTRUCTIONS` (0x71) -- which carries NO memspace byte -- steps
 *       the DRIVE CPU rather than the main one, while looking exactly like it
 *       stepped the main one.
 *   (b) a `@bank:`-bearing checkpoint condition FAILS OUTRIGHT.
 *
 * There is no "read default_memspace" command, so the state cannot be queried;
 * it can only be OBSERVED through commands that depend on it. The assertion is
 * therefore the conjunction of the two checks `P10` names:
 *
 *   PASS    iff a memspace-less `ADVANCE_INSTRUCTIONS` moved the MAIN CPU's PC
 *           AND a `@bank:`-bearing condition was accepted.
 *   REFUSE  iff either check fails, naming which one and what it observed.
 *
 * BOTH sub-results are always recorded separately, whatever the conjunction
 * says, so a reader can re-derive the verdict under a narrower definition
 * instead of taking this one on trust.
 *
 * WHY THE STEPPING CHECK DOES *NOT* REQUIRE THE DRIVE CPU TO STAY PUT.
 * MEASURED, and it is the reason the first run of this verb was voided: an
 * earlier draft of this function passed only when the main PC moved AND the
 * drive PC did not. On a machine with `Drive8TrueEmulation=1` the drive CPU runs
 * concurrently with the main one, so advancing the main CPU advances emulated
 * time and the drive PC moves too -- observed on the CLEAN machine
 * (`main $ea31 -> $ffea`, `drive $d125 -> $d127`, both moved). That draft could
 * therefore never pass on any true-drive-emulation machine, i.e. it was an
 * assertion that always refuses, which is exactly what the clean control exists
 * to catch. It caught it. The drive PC is still read and recorded on both sides
 * -- it is evidence about what the step did -- but it is not a pass condition.
 */
async function assertMainCpuMemspace(client, mainIds, driveIds, tag) {
  // --- check (a): does a memspace-less command still step the MAIN CPU? ---
  const beforeMain = await readRegisters(client, mainIds, MEMSPACE_MAIN);
  const beforeDrive = driveIds ? await readRegisters(client, driveIds, MEMSPACE_DRIVE8) : null;
  const adv = await client.send(
    CommandType.AdvanceInstructions,
    proto.advanceInstructionsBody({ stepOver: false, count: 1 }),
    { timeoutMs: 15000 },
  );
  await sleep(250);
  const afterMain = await readRegisters(client, mainIds, MEMSPACE_MAIN);
  const afterDrive = driveIds ? await readRegisters(client, driveIds, MEMSPACE_DRIVE8) : null;

  const mainMoved = afterMain.pc !== beforeMain.pc;
  const driveMoved = beforeDrive !== null && afterDrive.pc !== beforeDrive.pc;
  log(`MEMSPACE_ASSERTION_${tag} advance_err=0x${adv.errorCode.toString(16).padStart(2, "0")}`);
  log(`  (a) stepping: main  PC ${hex4(beforeMain.pc)} -> ${hex4(afterMain.pc)} moved=${mainMoved}`);
  if (beforeDrive) {
    log(`  (a) stepping: drive PC ${hex4(beforeDrive.pc)} -> ${hex4(afterDrive.pc)} moved=${driveMoved} (recorded, NOT a pass condition -- see the header)`);
  }
  const steppingOk = mainMoved;
  log(
    `  (a) VERDICT ${steppingOk ? "pass" : "REFUSAL"}: a memspace-less ADVANCE_INSTRUCTIONS ${
      steppingOk
        ? `moved the MAIN CPU (${hex4(beforeMain.pc)} -> ${hex4(afterMain.pc)})`
        : `did NOT step the main CPU -- it stayed at ${hex4(beforeMain.pc)}${beforeDrive ? `, while unit 8 moved ${hex4(beforeDrive.pc)} -> ${hex4(afterDrive.pc)}` : ""}, so the command acted on another processor while reporting as if it acted on this one`
    }`,
  );

  // --- check (b): is a @bank:-bearing condition still accepted? ---
  // Run TWICE on each side, on two independently armed checkpoints, so a single
  // failure cannot be attributed to "the second CONDITION_SET of a session
  // fails" rather than to the memspace state.
  const bank = [];
  for (let i = 0; i < 2; i += 1) {
    const cp = await armExec(client, { start: 0x0326, temporary: false });
    const res = await client
      .send(
        CommandType.ConditionSet,
        proto.conditionSetBody({ checkpointNum: cp.checkpoint.id, expression: BANK_CONDITION }),
        { timeoutMs: 10000 },
      )
      .then((r) => ({ cp: cp.checkpoint.id, err: r.errorCode, message: null }))
      .catch((e) => ({ cp: cp.checkpoint.id, err: null, message: e.message }));
    bank.push(res);
    log(
      `  (b) bank condition ${i + 1}/2 on cp=${res.cp}: ${
        res.err === null ? `THREW -- ${res.message}` : `err=0x${res.err.toString(16).padStart(2, "0")}`
      }`,
    );
    await client.send(CommandType.CheckpointDelete, proto.cpNumBody(cp.checkpoint.id)).catch(() => {});
  }
  const bankOk = bank.every((r) => r.err === 0x00);
  log(`  (b) VERDICT ${bankOk ? "pass" : "REFUSAL"}: the condition \`${BANK_CONDITION}\` was ${bankOk ? "accepted on both attempts" : "REFUSED"}`);

  const passed = steppingOk && bankOk;
  const message = passed
    ? `PASS: a memspace-less command still reaches the main CPU (check a) and a @bank:-bearing condition is still accepted (check b)`
    : `REFUSAL: ${[
        steppingOk ? null : "a memspace-less ADVANCE_INSTRUCTIONS did not step the main CPU (check a)",
        bankOk ? null : `a @bank:-bearing condition was refused (check b): ${bank.map((r) => (r.err === null ? r.message : `err=0x${r.err.toString(16).padStart(2, "0")}`)).join("; ")}`,
      ]
        .filter(Boolean)
        .join(" AND ")}. default_memspace is contaminated: a drive checkpoint hit set it (monitor.c:3393-3396) and NO binary-monitor command resets it, so the monitor's default target is no longer the main CPU and nothing over this wire can put it back.`;
  log(`  ${tag} ASSERTION ${passed ? "PASS" : "REFUSES"} -- ${message}`);
  return {
    passed,
    steppingOk,
    bankOk,
    message,
    stepping: { beforeMain: beforeMain.pc, afterMain: afterMain.pc, mainMoved, beforeDrive: beforeDrive?.pc ?? null, afterDrive: afterDrive?.pc ?? null, driveMoved },
    bank,
  };
}

async function runMemspace({ label, target }) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  log(`RUN_LABEL ${label}`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`DATE_UTC ${new Date().toISOString()}`);
  log(`RELEASE_SHA256 ${sha256(fs.readFileSync(RELEASE))}`);
  log(`BANK_CONDITION ${BANK_CONDITION}`);
  preflight();
  const broker = await startBroker();
  const out = { label, steps: [] };
  let grantHandle = null;
  try {
    grantHandle = await brokerClient.acquireOverControlPlane(BROKER_STATE_DIR, { profile: { headless: true } });
    const { grant } = grantHandle;
    log(`GRANT id=${grant.id} port=${grant.port}`);
    const spawned = argvFromBrokerStderr(broker.stderr, grant.port);
    log(`SPAWN_ARGV ${JSON.stringify(spawned.argv)}`);

    const client = new ViceMonitorClient();
    const seen = [];
    client.on("event", (f) => seen.push(f.type));
    const tConnect = Date.now();
    await connectWithRetry(client, grant.port, { budgetMs: 60000 });
    log(`CONNECTED_AFTER_MS ${Date.now() - tConnect}`);
    await sleep(400);
    log(`OPEN_EVENTS ${seen.join(",") || "(none)"}`);
    await pingReady(client);

    const mainIds = await registerIds(client, MEMSPACE_MAIN);
    log(`REGISTER_CATALOG_MAIN ${mainIds.catalog}`);
    let driveIds = null;
    try {
      driveIds = await registerIds(client, MEMSPACE_DRIVE8);
      log(`REGISTER_CATALOG_DRIVE8 ${driveIds.catalog}`);
    } catch (err) {
      log(`REGISTER_CATALOG_DRIVE8 unavailable: ${err.message}`);
    }

    for (const name of ["Drive8TrueEmulation", "Drive8Type"]) {
      const reply = await client.send(CommandType.ResourceGet, proto.resourceGetBody({ name }));
      log(`RESOURCE ${name}=${reply.value}`);
    }

    const anchor = await armExec(client, { start: FRAME_ANCHOR });
    log(`ARMED_ANCHOR cp=${anchor.checkpoint.id} start=${hex4(anchor.checkpoint.start)}`);
    const as = await client.send(
      CommandType.AutoStart,
      proto.autostartBody({ runAfter: true, fileIndex: 0, filename: RELEASE }),
      { timeoutMs: 60000 },
    );
    log(`AUTOSTART err=0x${as.errorCode.toString(16).padStart(2, "0")}`);
    const counted = await countHits(client, anchor.checkpoint.id, target, { budgetMs: 120000 });
    log(`COUNTED reached=${counted.reached} hits=${counted.hits} target=${target} reason=${counted.reason ?? "-"}`);

    // STEP 1 -- the clean control, FIRST. Without it a later refusal is
    // indistinguishable from an assertion that always refuses. It has already
    // caught exactly that once; see assertMainCpuMemspace()'s header.
    log(`--- STEP 1: the CLEAN control -- no drive checkpoint hit yet ---`);
    const clean = await assertMainCpuMemspace(client, mainIds, driveIds, "CLEAN");
    out.steps.push({ step: "clean", ...clean });

    // STEP 2 -- contaminate deliberately: ONE checkpoint on the DRIVE memspace,
    // wire byte 0x01 (unit 8) through the encoder's own mapping. NEVER 0x08,
    // which is VICE's internal enum and is rejected by the monitor.
    log(`--- STEP 2: contaminate with ONE drive-memspace checkpoint hit (wire memspace 0x01) ---`);
    const driveCp = await armExec(client, {
      start: DRIVE_ROM_START,
      end: DRIVE_ROM_END,
      memspace: MEMSPACE_DRIVE8,
    });
    log(
      `ARMED_DRIVE_CHECKPOINT cp=${driveCp.checkpoint.id} start=${hex4(driveCp.checkpoint.start)} end=${hex4(driveCp.checkpoint.end)} memspace=0x01 stop=${driveCp.checkpoint.stopWhenHit} err=0x${driveCp.errorCode.toString(16).padStart(2, "0")}`,
    );
    const oneHit = await awaitOneHit(client, driveCp.checkpoint.id, { budgetMs: 60000 });
    if (oneHit.hit) {
      const cp = oneHit.frame.checkpoint;
      log(`CHECKPOINT_INFO_VERBATIM ${JSON.stringify(oneHit.frame)}`);
      log(
        `CHECKPOINT_INFO id=${cp.id} currentlyHit=${cp.currentlyHit} start=${hex4(cp.start)} end=${hex4(cp.end)} stop=${cp.stopWhenHit} enabled=${cp.enabled} op=0x${cp.operation.toString(16)} temporary=${cp.temporary} hit_count=${cp.hitCount} ignore_count=${cp.ignoreCount} hasCondition=${cp.hasCondition}`,
      );
    } else {
      log(`CHECKPOINT_INFO none within budget -- the drive checkpoint did not hit`);
    }
    out.steps.push({ step: "contaminate", hit: oneHit.hit, frame: oneHit.frame ?? null });
    // Delete the drive checkpoint so nothing below can attribute a later halt to
    // it. Deleting it does NOT reset default_memspace -- that is the point.
    await client.send(CommandType.CheckpointDelete, proto.cpNumBody(driveCp.checkpoint.id)).catch(() => {});

    // STEP 3 -- the SAME assertion again.
    log(`--- STEP 3: the SAME assertion, after exactly one drive checkpoint hit ---`);
    const dirty = await assertMainCpuMemspace(client, mainIds, driveIds, "CONTAMINATED");
    out.steps.push({ step: "contaminated", ...dirty });

    const value = clean.passed && !dirty.passed ? "refuses" : "did-not-refuse";
    log(`DERIVED_MEMSPACE_ASSERTION ${value}`);
    log(`SUBCHECK_STEPPING clean=${clean.steppingOk ? "pass" : "refuse"} contaminated=${dirty.steppingOk ? "pass" : "refuse"} discriminates=${clean.steppingOk && !dirty.steppingOk}`);
    log(`SUBCHECK_BANK_CONDITION clean=${clean.bankOk ? "pass" : "refuse"} contaminated=${dirty.bankOk ? "pass" : "refuse"} discriminates=${clean.bankOk && !dirty.bankOk}`);
    out.value = value;
    client.disconnect?.();
  } finally {
    if (grantHandle) {
      grantHandle.release();
      await sleep(1500);
    }
    broker.stop();
    await sleep(1500);
    const after = aliveX64sc();
    log(`POST_X64SC ${after.length ? after.join(",") : "(none)"}`);
    if (after.length) {
      try {
        execFileSync("pkill", ["-x", "x64sc"]);
      } catch {}
    }
  }
  const outPath = path.join(PROBE_DIR, `${label}.memspace.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  log(`MEMSPACE_RECORD ${outPath}`);
  return out;
}

// --- CLI ---------------------------------------------------------------------

const USAGE = `usage: node capture-pair.mjs <command>

  run      --label <l> --jitter <ms> --target <n>   take ONE capture through the shipped route
  compare  --a <label> --b <label> [--allow-list <path>]
                                                    compare a pair under CAP-02's predicate
  memspace --label <l> [--target <n>]               Task 3: the main-CPU memspace assertion,
                                                    clean control then one drive checkpoint hit
  preflight                                         the D-11 guard alone

Every capture and snapshot lands under
${PROBE_DIR}
-- outside the checkout, never /tmp. Only digests, counts and register values
travel into the repository.`;

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  switch (cmd) {
    case "run":
      await takeRun({
        label: argValue(argv, "--label", "run"),
        jitterMs: Number(argValue(argv, "--jitter", "0")),
        target: Number(argValue(argv, "--target", "400")),
      });
      break;
    case "compare":
      comparePair({
        labelA: argValue(argv, "--a"),
        labelB: argValue(argv, "--b"),
        allowListPath: argValue(argv, "--allow-list"),
      });
      break;
    case "memspace":
      await runMemspace({
        label: argValue(argv, "--label", "memspace"),
        target: Number(argValue(argv, "--target", "60")),
      });
      break;
    case "preflight":
      preflight();
      break;
    default:
      process.stderr.write(`${USAGE}\n`);
      process.exitCode = cmd ? 1 : 0;
  }
}

await main();
process.exit(process.exitCode ?? 0);
