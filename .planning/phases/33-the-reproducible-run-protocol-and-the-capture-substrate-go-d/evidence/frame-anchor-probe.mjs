#!/usr/bin/env node
// -----------------------------------------------------------------------------
// frame-anchor-probe.mjs -- Phase 33, plan 33-11, Task 2 (`REPRO-03`).
//
// WHAT THIS MEASURES, AND WHICH DIRECTION IT HAS TO RUN IN
// -------------------------------------------------------
// `SCHEMA.md` § 2.3 wants `(LIN, CYC)` ALONE **PASSING** on two stops that are
// genuinely different, while the full four-term identity correctly reports them
// different. The interesting failure is the two-term projection AGREEING on two
// different stops -- a control in which `(LIN, CYC)` merely *differs* proves
// nothing, because a term that disagrees was never the risk.
//
// The reason such a pair exists at all is that `LIN`/`CYC` is a position
// MODULO THE FRAME, not a monotonic clock: stock VICE below 3.10 has no
// monotonic cycle register at all. Two stops an integral number of frames
// apart therefore land on the same raster coordinates while being different
// machine states.
//
// THE MEASURED OBSTACLE, AND WHY THIS PROBE SURVEYS BEFORE IT CONCLUDES
// --------------------------------------------------------------------
// The anchor is `$ea31`, the KERNAL IRQ entry, driven by CIA#1 timer A. On this
// PAL build the KERNAL programs that timer for **60 Hz** while the video frame
// is **50.125 Hz**, so consecutive anchor hits are NOT one frame apart -- they
// are one IRQ apart, and the raster position at successive hits DRIFTS. So the
// literal minimal form of the control ("hit k against hit k+1") cannot be
// assumed to satisfy § 2.3's antecedent; whether it does is a measurement, not
// a design choice.
//
// This probe therefore runs BOTH controls and labels which is which:
//
//   (2) the LITERAL control the plan specifies -- two dedicated stops at anchor
//       hit k and anchor hit k+1, each with its own DUMP and sliced sha256 --
//       preceded by a 240-hit survey of the anchor's own `(LIN, CYC)` so the
//       literal form's outcome is a measurement and not an assertion.
//   (4) the VARIANT control -- two dedicated stops at a FRAME-LOCKED,
//       raster-conditioned probe point, chosen so their raster coordinates are
//       EQUAL while their anchor hit counts differ. Equal raster coordinates is
//       what "an integral number of frames apart" MEANS on a machine with no
//       monotonic cycle register, so the variant pair instantiates § 2.3's
//       phenomenon exactly -- at a separation of more than one frame.
//
// The derivation below checks § 2.3's antecedent AS DECLARED, literally, and
// does not loosen "exactly one frame apart" to fit the variant. Both readings
// and their consequences are recorded; the choice belongs to the findings
// document, not to the measuring plan.
//
// WHAT IT DOES NOT REIMPLEMENT
// ----------------------------
// Both the two-term projection and the four-term identity go through the
// shipped `compareStopIdentity()` (`T-33-36`). The projection is expressed by
// holding `pc` and `hitCount` to ONE shared constant on both sides, so only the
// frame term can decide the verdict -- it is a projection of the shipped
// oracle, never a second comparison written here. `stop-oracle.ts` deliberately
// ships NO two-term mode flag, and this file must not become one.
//
// WHAT NOT TO DO
// --------------
//   - Never add a step before the reset. MEASURED in this plan's
//     `reset-removed-probe.mjs`: the hard reset does not reset the VIC-II
//     raster counter, so a checkpoint halt before the reset moves the phase the
//     stop inherits and costs frame-exactness.
//   - Never poll while waiting for a hit. Every monitor command stops and
//     resumes the machine; a tight poll starves the emulator (`PC` observed
//     stuck in RAMTAS for 21 s).
//   - Never send more than one resume per wait. One `EXIT` per observed hit,
//     which is `vice-sync.ts`'s invariant applied per wait rather than per
//     count.
//   - Never conclude `proven` from a pair that was not observed. § 2.3 says
//     `unproven` INCLUDES the case where no qualifying pair was produced.
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
const PORT = 6513;

/** The free-run interval before the protocol, matching this plan's other
 *  probes and research's own `3000 + J`. */
const BASE_FREE_RUN_MS = 3000;

/** How many anchor hits the survey walks. Kept well inside the region `33-03`
 *  measured as frame-exact (it recorded exactness holding through hit 50 and
 *  lost from hit 75 on an AUTOSTARTED release); this measurement is
 *  corpus-free with no drive activity, so the survey goes further and RECORDS
 *  what it finds rather than assuming either bound transfers. */
const SURVEY_HITS = 240;

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

// --- argv --------------------------------------------------------------------

/** The shipped determinism block, imported and never retyped (`T-33-36`).
 *  Order transcribed from `buildViceArgs()`'s stock branch. Only the port is
 *  interpolated (`T-33-04`). */
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

async function registerIds(client) {
  const reply = await client.send(CommandType.RegistersAvailable, proto.memspaceBody({ memspace: MEMSPACE_MAIN }));
  const byName = new Map(reply.registers.map((r) => [r.name.toUpperCase(), r.id]));
  const catalog = reply.registers.map((r) => `${r.id}:${r.name}(${r.size}b)`).join(" ");
  for (const name of ["PC", "LIN", "CYC"]) {
    if (!byName.has(name)) throw new Error(`register ${name} absent from this build's catalog: ${catalog}`);
  }
  return { byName, catalog };
}

async function readRegisters(client, ids) {
  const reply = await client.send(CommandType.RegistersGet, proto.memspaceBody({ memspace: MEMSPACE_MAIN }));
  const byId = new Map(reply.registers.map((r) => [r.id, r.value]));
  const pick = (name) => {
    const id = ids.byName.get(name);
    if (id === undefined || !byId.has(id)) throw new Error(`register ${name} absent from this REGISTERS_GET reply -- refusing rather than zero-filling`);
    return byId.get(id);
  };
  return { pc: pick("PC"), lin: pick("LIN"), cyc: pick("CYC") };
}

async function armAnchor(client) {
  return client.send(
    CommandType.CheckpointSet,
    proto.checkpointSetBody({
      start: FRAME_ANCHOR,
      end: FRAME_ANCHOR,
      stop: true,
      enabled: true,
      operation: CheckpointOperation.Exec,
      temporary: false,
      memspace: MEMSPACE_MAIN,
    }),
  );
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

// --- the raster-conditioned probe point --------------------------------------
//
// MEASURED, and the reason this second checkpoint exists at all: the anchor at
// `$ea31` is the KERNAL IRQ entry, and on this PAL build the KERNAL programs
// CIA#1 timer A for 60 Hz while the video frame is 50.125 Hz. So consecutive
// anchor hits are one IRQ apart, NOT one frame apart, and the raster position
// drifts about 51 lines per hit. The survey below records 240 anchor hits with
// 240 DISTINCT `(LIN, CYC)` values and zero consecutive repeats.
//
// To obtain two stops at the SAME raster coordinates -- which is the only way
// the two-term projection can PASS on genuinely different stops -- a second,
// FRAME-LOCKED probe point is needed. `$e5d4` is inside the KERNAL keyboard-scan
// idle loop and was OBSERVED as the halt PC on four independent monitor halts
// at the `READY` prompt in this plan's other probes, so it is chosen on
// measurement rather than on a reading of the ROM. Conditioned on the raster
// line, it stops once per frame region rather than thousands of times per
// frame.
//
// The condition's spelling is load-bearing and every part of it is a project
// constraint, not a style choice:
//   - `RL`, uppercase, and NOT `LIN`. The register-list name `LIN` lexes as
//     BANKNAME in the condition grammar and produces a syntax error.
//   - Fully parenthesised. Conditions have NO operator precedence
//     (`mon_parse.y:168`), so an unparenthesised comparison chain parses into
//     something that is silently always false.
//   - `$f0`, written in hex explicitly. Bare integer literals in a condition
//     are HEX by default (`monitor.c:1597`), so an unprefixed `240` would mean
//     line 576.
const PROBE_ADDRESS = 0xe5d4;
const PROBE_CONDITION = "(RL == $f0)";

// --- the memory read that tells running from halted --------------------------

async function jiffy(client) {
  const reply = await client.send(CommandType.MemoryGet, proto.memGetBody({ start: 0x00a0, end: 0x00a2, memspace: MEMSPACE_MAIN }));
  return [...reply.bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- one run --------------------------------------------------------------

/**
 * The protocol exactly as `REPRO-02` specifies it and as
 * `reset-removed-probe.mjs` measured `immune`: connect (the monitor's own halt,
 * verified there as a real halt by `hits_at_arm = 0`), resolve the registers by
 * name, arm ONE non-temporary Exec checkpoint at the anchor, the monitor-issued
 * hard reset, then exactly ONE resume per observed hit.
 *
 * Modes:
 *   `stopAtAnchorHit: k`  -- count anchor hits to k. `sample: true` reads
 *                            `(LIN, CYC)` at every hit; that is the survey.
 *   `stopAtProbeHit: n`   -- additionally arm the raster-conditioned probe at
 *                            PROBE_ADDRESS and stop at its nth hit. The
 *                            reported `hitCount` term is still the ANCHOR's own
 *                            hit count, read authoritatively via
 *                            `CHECKPOINT_GET` at the stop and never from a
 *                            lagging event.
 *
 * The machine is halted at every hit, so the per-hit register reads cost the
 * emulator no run time. Nothing is polled: each wait installs its listener
 * before its single resume.
 */
async function oneRun({ label, jitterMs, stopAtAnchorHit = null, stopAtProbeHit = null, sample = false, dump = false }) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const argv = buildArgv(PORT);
  const { env, xdg } = bootEnv(label);

  log(`RUN_LABEL ${label}`);
  log(`RUN_JITTER_MS ${jitterMs}`);
  log(`RUN_STOP_AT ${stopAtProbeHit !== null ? `probe hit ${stopAtProbeHit} (conditioned ${PROBE_CONDITION} at ${hex4(PROBE_ADDRESS)})` : `anchor hit ${stopAtAnchorHit}`}`);
  log(`SPAWN_ARGV ${JSON.stringify(argv)}`);
  log(`ARGV_DIGEST ${predicate.argvDigest(argv)}`);
  log(`XDG_CONFIG_HOME ${xdg}`);
  log(`DATE_UTC ${new Date().toISOString()}`);

  const record = {
    label,
    jitterMs,
    stopAtAnchorHit,
    stopAtProbeHit,
    argv,
    argvDigest: predicate.argvDigest(argv),
    usable: false,
    samples: [],
  };

  const child = spawn(argv[0], argv.slice(1), { env, stdio: ["ignore", "pipe", "pipe"] });
  CHILDREN.add(child);
  let stderr = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  const client = new ViceMonitorClient();
  try {
    await sleep(BASE_FREE_RUN_MS + jitterMs);
    await connectWithRetry(client, PORT);
    await sleep(300);
    await pingReady(client);

    const ids = await registerIds(client);
    const pre = await readRegisters(client, ids);
    const preJiffy = await jiffy(client);
    log(`PRE_PROTOCOL pc=${hex4(pre.pc)} LIN=${pre.lin} CYC=${pre.cyc} jiffy=${preJiffy}`);

    const anchor = await armAnchor(client);
    const anchorId = anchor.checkpoint.id;
    const atArm = await anchorHitCount(client, anchorId);
    log(`ANCHOR_ARMED cp=${anchorId} at=${hex4(FRAME_ANCHOR)} temporary=false hits_at_arm=${atArm}`);
    if (atArm !== 0) throw new Error(`the anchor's hit count is ${atArm} at arm, not 0`);

    let probeId = null;
    if (stopAtProbeHit !== null) {
      const probe = await client.send(
        CommandType.CheckpointSet,
        proto.checkpointSetBody({
          start: PROBE_ADDRESS,
          end: PROBE_ADDRESS,
          stop: true,
          enabled: true,
          operation: CheckpointOperation.Exec,
          temporary: false,
          memspace: MEMSPACE_MAIN,
        }),
      );
      probeId = probe.checkpoint.id;
      const cond = await client.send(CommandType.ConditionSet, proto.conditionSetBody({ checkpointNum: probeId, expression: PROBE_CONDITION }));
      log(`PROBE_ARMED cp=${probeId} at=${hex4(PROBE_ADDRESS)} condition=${PROBE_CONDITION} condition_err=0x${cond.errorCode.toString(16).padStart(2, "0")}`);
      if (cond.errorCode !== 0) throw new Error(`the condition ${PROBE_CONDITION} was rejected with err=0x${cond.errorCode.toString(16)}`);
      if (probeId === anchorId) throw new Error("the monitor returned one id for the anchor and the probe -- their frames cannot be told apart");
    }

    await client.send(CommandType.Reset, proto.resetBody({ mode: ResetMode.Hard }));
    log(`RESET mode=hard sent=yes`);

    // Exactly ONE resume per observed hit. `anyHit()` waits for the next
    // CHECKPOINT_INFO from EITHER checkpoint and discriminates on id, which is
    // the same discipline `runReproducible()`'s own wait uses.
    let anchorObserved = 0;
    let probeObserved = 0;
    let resumes = 0;
    const deadline = Date.now() + 240000;
    for (;;) {
      if (stopAtProbeHit !== null ? probeObserved >= stopAtProbeHit : anchorObserved >= stopAtAnchorHit) break;
      if (Date.now() > deadline) throw new Error(`240 s budget exhausted at anchor=${anchorObserved} probe=${probeObserved}`);
      const hit = await anyHit(client);
      resumes += 1;
      if (!hit.hit) throw new Error(`hits stopped arriving after ${resumes} resumes (anchor=${anchorObserved} probe=${probeObserved}): ${hit.reason}`);
      if (hit.id === anchorId) {
        anchorObserved = hit.hitCount;
        if (sample) {
          const r = await readRegisters(client, ids);
          if (r.pc !== FRAME_ANCHOR) throw new Error(`anchor hit ${anchorObserved}: PC is ${hex4(r.pc)}, not the anchor`);
          record.samples.push({ kind: "anchor", hitCount: anchorObserved, line: r.lin, cycle: r.cyc });
          log(`SAMPLE anchor_hit=${anchorObserved} LIN=${r.lin} CYC=${r.cyc}`);
        }
        continue;
      }
      if (hit.id === probeId) {
        probeObserved = hit.hitCount;
        if (sample) {
          const r = await readRegisters(client, ids);
          const anchorNow = await anchorHitCount(client, anchorId);
          record.samples.push({ kind: "probe", hitCount: probeObserved, anchorHitCount: anchorNow, pc: r.pc, line: r.lin, cycle: r.cyc });
          log(`SAMPLE probe_hit=${probeObserved} anchor_hit=${anchorNow} pc=${hex4(r.pc)} LIN=${r.lin} CYC=${r.cyc}`);
        }
        continue;
      }
      throw new Error(`a CHECKPOINT_INFO arrived for an unknown checkpoint id ${hit.id}`);
    }
    log(`COUNTED resumes=${resumes} anchor_hits=${anchorObserved} probe_hits=${probeObserved}`);

    // The four terms. `pc`, `line` and `cycle` from ONE `REGISTERS_GET`; the
    // frame term is the ANCHOR's own hit count via `CHECKPOINT_GET`.
    const finalRegs = await readRegisters(client, ids);
    const frameTerm = await anchorHitCount(client, anchorId);
    log(`STOP PC=${hex4(finalRegs.pc)} hit_count=${frameTerm} LIN=${finalRegs.lin} CYC=${finalRegs.cyc}`);
    record.stop = { pc: finalRegs.pc, hitCount: frameTerm, line: finalRegs.lin, cycle: finalRegs.cyc };
    record.probeHitsAtStop = probeObserved;

    if (dump) {
      const vsfPath = path.join(PROBE_DIR, `${label}.vsf`);
      const d = await client.send(
        CommandType.Dump,
        proto.dumpBody({ saveRoms: false, saveDisks: false, filename: vsfPath }),
        { timeoutMs: 90000 },
      );
      const vsfSize = fs.existsSync(vsfPath) ? fs.statSync(vsfPath).size : 0;
      log(`SNAPSHOT ${vsfPath} err=0x${d.errorCode.toString(16).padStart(2, "0")} size=${vsfSize}`);
      if (vsfSize === 0) throw new Error(`snapshot ${vsfPath} was not written`);
      record.vsfPath = vsfPath;
    }
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

  if (!record.voidReason && record.vsfPath) {
    const binPath = path.join(PROBE_DIR, `${label}.bin`);
    const slice = sliceThroughShippedCli(record.vsfPath, binPath);
    const raw = fs.readFileSync(binPath);
    log(`IMAGE ${binPath} bytes=${raw.length} sha256=${slice.sha256}`);
    record.imagePath = binPath;
    record.imageSha256 = slice.sha256;
  }
  record.usable = !record.voidReason;
  record.takenAt = new Date().toISOString();
  const recPath = path.join(PROBE_DIR, `${label}.frame.json`);
  fs.writeFileSync(recPath, `${JSON.stringify(record, null, 2)}\n`);
  log(`RUN_RECORD ${recPath} usable=${record.usable}${record.voidReason ? ` void=${record.voidReason}` : ""}`);
  return record;
}

/** Wait for the next CHECKPOINT_INFO from ANY armed checkpoint, having sent
 *  exactly ONE resume. Discriminates on id at the caller. */
function anyHit(client, { budgetMs = 60000 } = {}) {
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
      if (frame.type !== "checkpoint_info") return;
      finish({ hit: true, id: frame.checkpoint.id, hitCount: frame.checkpoint.hitCount });
    };
    const timer = setTimeout(() => finish({ hit: false, reason: `budget ${budgetMs} ms exhausted with no hit` }), budgetMs);
    client.on("event", onEvent);
    client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 }).catch(() => {});
  });
}

// --- the comparisons, both through the shipped oracle ------------------------

/** The FULL four-term identity, straight through the shipped oracle. */
function fourTerm(a, b) {
  return oracle.compareStopIdentity(a, b);
}

/**
 * The `(LIN, CYC)`-ONLY projection, also through the shipped oracle.
 *
 * Expressed by holding `pc` and `hitCount` to ONE shared constant on both
 * sides, so those two terms cannot contribute to the verdict and only the frame
 * term can decide it. This is a PROJECTION of the shipped
 * `compareStopIdentity()` -- not a second comparison written here, and not a
 * two-term mode flag on the oracle, which `stop-oracle.ts` deliberately does
 * not ship and must not acquire. Not one recorded VALUE of `line` or `cycle` is
 * altered, defaulted or inferred.
 */
function twoTermProjection(a, b) {
  const PROJECTED_OUT = 0;
  return oracle.compareStopIdentity(
    { pc: PROJECTED_OUT, hitCount: PROJECTED_OUT, line: a.line, cycle: a.cycle },
    { pc: PROJECTED_OUT, hitCount: PROJECTED_OUT, line: b.line, cycle: b.cycle },
  );
}

function imageDiff(a, b) {
  const rawA = fs.readFileSync(a.imagePath);
  const rawB = fs.readFileSync(b.imagePath);
  let n = 0;
  const first = [];
  for (let addr = 0; addr < 65536; addr += 1) {
    if (rawA[addr] !== rawB[addr]) {
      n += 1;
      if (first.length < 10) first.push(addr);
    }
  }
  return { count: n, first };
}

/** Report one candidate pair through both comparisons and the image diff. */
function reportPair(tag, a, b) {
  const two = twoTermProjection(a.stop, b.stop);
  const four = fourTerm(a.stop, b.stop);
  const diff = imageDiff(a, b);
  log(`${tag}_STOP_A ${a.label} ${JSON.stringify(a.stop)} sha256=${a.imageSha256}`);
  log(`${tag}_STOP_B ${b.label} ${JSON.stringify(b.stop)} sha256=${b.imageSha256}`);
  log(`${tag}_TWO_TERM_PROJECTION ${JSON.stringify(two)}`);
  log(`${tag}_TWO_TERM_VERDICT ${two.identical ? "PASSES -- it certifies the two stops as the SAME stop" : "differs -- it separates them, which per SCHEMA.md 2.3 proves nothing"}`);
  log(`${tag}_FOUR_TERM_IDENTITY ${JSON.stringify(four)}`);
  log(`${tag}_FOUR_TERM_DIFFERING_TERMS ${four.differingTerms.join(",") || "(none)"}`);
  log(`${tag}_IMAGE_DIFF differing_bytes=${diff.count} first=${diff.first.map(hex4).join(" ") || "(none)"}`);
  log(`${tag}_IMAGE_SHA_EQUAL ${a.imageSha256 === b.imageSha256 ? "yes" : "no"}`);
  return { two, four, diff };
}

// --- the survey's analysis ---------------------------------------------------

function analyseAnchorSurvey(samples) {
  const anchors = samples.filter((s) => s.kind === "anchor");
  log("");
  log(`--- the anchor survey's analysis -------------------------------------`);
  log(`ANCHOR_SURVEY_SAMPLES ${anchors.length}`);
  log(`ANCHOR_SURVEY_DISTINCT_LIN_CYC ${new Set(anchors.map((s) => `${s.line}:${s.cycle}`)).size}`);
  let consecutiveEqual = 0;
  for (let i = 1; i < anchors.length; i += 1) {
    if (anchors[i].line === anchors[i - 1].line && anchors[i].cycle === anchors[i - 1].cycle) consecutiveEqual += 1;
  }
  log(`ANCHOR_SURVEY_CONSECUTIVE_PAIRS ${anchors.length - 1}`);
  log(`ANCHOR_SURVEY_CONSECUTIVE_PAIRS_WITH_EQUAL_LIN_CYC ${consecutiveEqual}`);
  log(`ANCHOR_SURVEY_FIRST_SIX ${anchors.slice(0, 6).map((s) => `${s.hitCount}:(${s.line},${s.cycle})`).join(" ")}`);
  const seen = new Map();
  let best = null;
  for (const s of anchors) {
    const key = `${s.line}:${s.cycle}`;
    if (seen.has(key)) {
      const gap = s.hitCount - seen.get(key);
      if (!best || gap < best.gap) best = { gap, a: seen.get(key), b: s.hitCount, line: s.line, cycle: s.cycle };
    }
    seen.set(key, s.hitCount);
  }
  log(`ANCHOR_SURVEY_SMALLEST_REPEAT_GAP ${best ? `${best.gap} (hits ${best.a} and ${best.b} at (LIN ${best.line}, CYC ${best.cycle}))` : "(none -- no (LIN, CYC) value repeated anywhere in the survey)"}`);
  return { consecutiveEqual, best, count: anchors.length };
}

function analyseProbeSurvey(samples) {
  const probes = samples.filter((s) => s.kind === "probe");
  log("");
  log(`--- the conditioned probe survey's analysis --------------------------`);
  log(`PROBE_SURVEY_SAMPLES ${probes.length}`);
  log(`PROBE_SURVEY_DISTINCT_LINES ${[...new Set(probes.map((s) => s.line))].join(",")}`);
  log(`PROBE_SURVEY_DISTINCT_PCS ${[...new Set(probes.map((s) => hex4(s.pc)))].join(",")}`);
  const seen = new Map();
  let best = null;
  for (const s of probes) {
    const key = `${s.line}:${s.cycle}`;
    if (seen.has(key)) {
      const prev = seen.get(key);
      // The pair must differ in the FRAME TERM -- the anchor's hit count -- or
      // the four-term identity has nothing to separate them with.
      if (prev.anchorHitCount !== s.anchorHitCount) {
        const gap = s.hitCount - prev.hitCount;
        if (!best || gap < best.gap) best = { gap, a: prev, b: s };
      }
    }
    seen.set(key, s);
  }
  if (best) {
    log(`PROBE_SURVEY_SMALLEST_EQUAL_RASTER_PAIR probe hits ${best.a.hitCount} and ${best.b.hitCount} both at pc=${hex4(best.a.pc)} (LIN ${best.a.line}, CYC ${best.a.cycle}), anchor hit counts ${best.a.anchorHitCount} and ${best.b.anchorHitCount}, probe-hit gap ${best.gap}`);
  } else {
    log(`PROBE_SURVEY_SMALLEST_EQUAL_RASTER_PAIR (none)`);
  }
  return { best, count: probes.length };
}

/** `SCHEMA.md` § 2.3's declared derivation, as code.
 *
 *  `proven` requires a control on two stops **exactly one frame apart**. The
 *  antecedent is checked as declared and NOT loosened: `oneFrameApart` is the
 *  literal conjunct, and § 2.3's own closing clause -- "`unproven` otherwise,
 *  INCLUDING when no such pair was produced at all" -- is what makes its
 *  absence decisive rather than arguable. */
function deriveOracleNecessity({ oneFrameApart, twoTermPassed, fourTermSeparated, sameFrameUnified }) {
  const failing = [];
  if (!oneFrameApart) failing.push("no pair of stops EXACTLY ONE FRAME APART was produced -- the anchor is a 60 Hz IRQ against a 50.125 Hz frame, so consecutive anchor hits are never at the same raster coordinates (MEASURED: 240 hits, 240 distinct (LIN, CYC), 0 consecutive repeats)");
  if (!twoTermPassed) failing.push("the two-term (LIN, CYC) projection did not PASS on the candidate pair");
  if (!fourTermSeparated) failing.push("the four-term identity did not report the candidate pair different");
  if (!sameFrameUnified) failing.push("the four-term identity did not report the same-frame pair identical");
  return { value: failing.length === 0 ? "proven" : "unproven", failing };
}

// --- CLI ---------------------------------------------------------------------

const USAGE = `usage: node frame-anchor-probe.mjs <command>

  run        the whole measurement:
             (1) the anchor survey -- ${SURVEY_HITS} counted anchor hits with
                 (LIN, CYC) at every hit
             (2) the LITERAL control -- two dedicated stops at anchor hit k and
                 k+1, each with its own DUMP and sliced 64K sha256
             (3) the conditioned-probe survey, then the VARIANT control -- two
                 dedicated stops at equal raster coordinates and different
                 anchor hit counts
             (4) the same-frame positive -- the same stop at a second jitter
             (5) the derived ORACLE_NECESSITY line
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

  log(`PROBE frame-anchor-probe.mjs`);
  log(`PROBE_DIR ${PROBE_DIR}`);
  log(`NODE ${process.version}`);
  log(`VICE_VERSION ${execFileSync(VICE_BIN, ["--version"], { encoding: "utf8" }).trim()}`);
  log(`STOCK_DETERMINISM_FLAGS ${JSON.stringify(STOCK_DETERMINISM_FLAGS)}`);
  log(`ORACLE_TERMS ${JSON.stringify(oracle.ORACLE_TERMS)}`);
  log(`FRAME_ANCHOR ${hex4(FRAME_ANCHOR)}`);
  log(`PROBE_POINT ${hex4(PROBE_ADDRESS)} condition=${PROBE_CONDITION}`);
  preflight();

  const voided = [];

  // (1) The anchor survey.
  log("");
  log(`--- (1) the anchor survey: ${SURVEY_HITS} counted anchor hits ---------------`);
  const survey = await oneRun({ label: "survey-anchor", jitterMs: 0, stopAtAnchorHit: SURVEY_HITS, sample: true });
  if (!survey.usable) throw new Error(`the anchor survey was voided: ${survey.voidReason}`);
  const anchorAnalysis = analyseAnchorSurvey(survey.samples);
  await sleep(600);

  // (2) The LITERAL control the plan specifies: anchor hit k against k+1.
  const K = 50;
  log("");
  log(`--- (2) the LITERAL control: anchor hit ${K} against anchor hit ${K + 1} -------`);
  const litA = await oneRun({ label: `lit-anchor${K}-j0`, jitterMs: 0, stopAtAnchorHit: K, dump: true });
  await sleep(600);
  const litB = await oneRun({ label: `lit-anchor${K + 1}-j0`, jitterMs: 0, stopAtAnchorHit: K + 1, dump: true });
  await sleep(600);
  for (const r of [litA, litB]) if (!r.usable) voided.push(r);
  let literal = null;
  if (litA.usable && litB.usable) {
    log("");
    literal = reportPair("LITERAL", litA, litB);
    log(`LITERAL_SEPARATION one anchor hit -- which is one 60 Hz IRQ period, NOT one 50.125 Hz video frame`);
  }

  // (3) The conditioned-probe survey, then the VARIANT control.
  log("");
  log(`--- (3) the conditioned-probe survey ---------------------------------`);
  const psurvey = await oneRun({ label: "survey-probe", jitterMs: 0, stopAtProbeHit: 60, sample: true });
  if (!psurvey.usable) throw new Error(`the probe survey was voided: ${psurvey.voidReason}`);
  const probeAnalysis = analyseProbeSurvey(psurvey.samples);
  if (!probeAnalysis.best) throw new Error("the probe survey found no pair at equal raster coordinates with differing anchor hit counts");
  const nA = probeAnalysis.best.a.hitCount;
  const nB = probeAnalysis.best.b.hitCount;
  await sleep(600);

  log("");
  log(`--- (4) the VARIANT control: probe hit ${nA} against probe hit ${nB} ----------`);
  const varA = await oneRun({ label: `var-probe${nA}-j0`, jitterMs: 0, stopAtProbeHit: nA, dump: true });
  await sleep(600);
  const varB = await oneRun({ label: `var-probe${nB}-j0`, jitterMs: 0, stopAtProbeHit: nB, dump: true });
  await sleep(600);
  log("");
  log(`--- (5) the same-frame positive: probe hit ${nA} again at jitter 2500 --------`);
  const varC = await oneRun({ label: `var-probe${nA}-j2500`, jitterMs: 2500, stopAtProbeHit: nA, dump: true });
  for (const r of [varA, varB, varC]) if (!r.usable) voided.push(r);

  log("");
  log(`VOIDED_RUNS ${voided.length ? voided.map((r) => `${r.label}(${r.voidReason})`).join(" ; ") : "(none)"}`);
  if (!varA.usable || !varB.usable || !varC.usable) throw new Error("a variant-control run was voided -- refusing to derive from a partial set");

  log("");
  log(`--- the variant pair --------------------------------------------------`);
  const variant = reportPair("VARIANT", varA, varB);
  log(`VARIANT_SEPARATION equal raster coordinates, so an exact INTEGRAL number of video frames -- ${nB - nA} probe hits apart, anchor hit counts ${varA.stop.hitCount} and ${varB.stop.hitCount}`);

  log("");
  log(`--- the same-frame positive ------------------------------------------`);
  const same = reportPair("SAMEFRAME", varA, varC);

  log("");
  log(`--- the derivation ---------------------------------------------------`);
  const derived = deriveOracleNecessity({
    oneFrameApart: anchorAnalysis.consecutiveEqual > 0,
    twoTermPassed: variant.two.identical,
    fourTermSeparated: !variant.four.identical,
    sameFrameUnified: same.four.identical,
  });
  log(`CONJUNCT_0_ONE_FRAME_APART_PAIR_EXISTS ${anchorAnalysis.consecutiveEqual > 0 ? "yes" : "no"}`);
  log(`CONJUNCT_1_TWO_TERM_PASSES_ON_VARIANT_PAIR ${variant.two.identical ? "yes" : "no"}`);
  log(`CONJUNCT_2_FOUR_TERM_SEPARATES_VARIANT_PAIR ${!variant.four.identical ? `yes (differing: ${variant.four.differingTerms.join(",")})` : "no"}`);
  log(`CONJUNCT_3_SAME_FRAME_PAIR_UNIFIED ${same.four.identical ? "yes" : "no"}`);
  log(`DERIVED_ORACLE_NECESSITY ${derived.value}`);
  for (const f of derived.failing) log(`FAILING_CONJUNCT ${f}`);
  log(`ALTERNATIVE_READING if "exactly one frame apart" is read as "an integral number of frames apart", the variant pair satisfies every conjunct and the derivation yields proven; this file records both readings and does NOT choose for the findings document`);
  return 0;
}

process.exitCode = await main();
