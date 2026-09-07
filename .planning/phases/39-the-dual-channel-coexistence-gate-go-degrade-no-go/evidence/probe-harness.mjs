#!/usr/bin/env node
// -----------------------------------------------------------------------------
// probe-harness.mjs -- Phase 39, plan 39-03 (`CHAN-01`).
//
// THE ONE PLACE THIS PHASE'S PROBES DO HOST THINGS.
// --------------------------------------------------
// Every probe in this phase (`idle-coexist-probe.mjs` and the six behind it)
// imports this module rather than re-deriving any of binary resolution, port
// allocation, spawn/reap, preflight, connect-with-retry, checkpoint arming, or
// the `test:automated` baseline. It reaches the emulator by direct `execve`
// (`D-12`) rather than through the broker, because the broker never surfaces
// the text-monitor port to a container-side caller -- so this file supplies,
// in code, every guard the broker would otherwise have supplied.
//
// WHAT NOT TO DO
// --------------
//   - Never add a passthrough argv parameter. Every flag in buildProbeArgs()
//     is a fixed literal; the only interpolated values are the two
//     probe-chosen port numbers. An externally-derived string reaching
//     execve() is exactly the class of defect this file exists to foreclose.
//   - Never run without the refusal check. Phase 33's own postmortem records
//     a plan that ran a probe as a habit, orphaned five emulators, and had to
//     void sixteen subsequent runs whose numbers then moved. preflight()
//     throws -- it does not warn -- and every probe calls it before spawning
//     anything.
//   - Never single-shot connect() after spawn on either port. `x64sc` binds
//     its monitor sockets some time after `execve` returns, not the instant
//     it returns; connectWithRetry() retries inside a stated budget for
//     exactly this reason, on both ports independently.
//   - Never resolve the emulator by bare name. The fork at
//     /usr/local/bin/x64sc (VICE 3.10) shadows genuine stock (VICE 3.9) at
//     /usr/bin/x64sc on bare `$PATH` -- VICE_STOCK and VICE_FORK are always
//     the resolved absolute paths, never a `PATH`-relative lookup.
// -----------------------------------------------------------------------------
import { spawn, execFileSync, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..");
const MCP_DIR = path.join(REPO_ROOT, "src", "mcp", "vice");

// --- shipped seams (D-14): every wire body and every argv flag this phase's
// probes send comes from these two imports, never retyped. -------------------
const proto = await import(path.join(MCP_DIR, "stock-protocol.ts"));
const launch = await import(path.join(MCP_DIR, "broker-launch.mts"));

export const { CommandType, CheckpointOperation, ViceMonitorClient, memGetBody, memspaceBody, advanceInstructionsBody } = proto;
/** The shipped, frozen determinism-flag array (broker-launch.mts). Imported,
 * never retyped: a later edit to this array changes what the probe launches
 * instead of leaving it measuring a stale copy. */
export const { STOCK_DETERMINISM_FLAGS } = launch;

// --- fixed inputs (D-15) ------------------------------------------------------

/** Genuine unpatched stock VICE 3.9 -- the gate baseline. Resolved by
 * absolute path, never by bare name: the fork shadows it on `$PATH`. */
export const VICE_STOCK = "/usr/bin/x64sc";
/** The fork, VICE 3.10. Not launched by any measurement in this plan, but
 * recorded here so a caller who needs to name it never retypes the path. */
export const VICE_FORK = "/usr/local/bin/x64sc";

/** The bare process name, for the two liveness/reap helpers below
 * (`pgrep -x` / `pkill -x`) that must match against the RUNNING PROCESS'S
 * name -- not spawn anything. Named as a constant, never invoked directly
 * inside a spawn()/execFile() literal, so a mechanical scan for "does any
 * spawn call in this file invoke the emulator by bare name" cannot confuse
 * a liveness check with an actual launch. */
const X64SC_PROCESS_NAME = "x64sc";

/**
 * Derive `stock` / `fork` from the RESOLVED ABSOLUTE PATH, never from an
 * environment variable or an operator-supplied token. The existing binary
 * fixture tree records a real incident where an operator-supplied kind token
 * mislabelled the fork as stock for over two months; deriving it from the
 * path itself removes the whole class.
 */
export function viceKind(binPath) {
  const resolved = path.resolve(binPath);
  if (resolved === path.resolve(VICE_STOCK)) return "stock";
  if (resolved === path.resolve(VICE_FORK)) return "fork";
  throw new Error(`viceKind: ${resolved} is neither the recorded VICE_STOCK nor VICE_FORK path`);
}

/** The binary's own reported version, for `VICE_VERSION_OBSERVED:`. Never a
 * gate input -- provenance only. */
export function viceVersion(binPath) {
  return execFileSync(binPath, ["--version"], { encoding: "utf8" }).trim();
}

// --- D-16 in code, not in shell discipline ------------------------------------

export function systemdBrokerState() {
  try {
    return execFileSync("systemctl", ["--user", "is-active", "vice-broker"], { encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout ?? "").trim() || "inactive";
  }
}

/** `pgrep -x`, never `pgrep -f`: `-f` matches this script's OWN command line
 * (which contains the literal string "x64sc" in nearby argv) and would
 * refuse every run permanently. `-x` matches only the process's own name. */
export function aliveX64sc() {
  try {
    return execFileSync("pgrep", ["-x", X64SC_PROCESS_NAME], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Throws -- not warns -- when the broker unit is anything but `inactive` or
 * any other emulator process is alive. The measurement is refused in code,
 * never by habit. Callable standalone via `node probe-harness.mjs --preflight`.
 */
export function preflight() {
  const broker = systemdBrokerState();
  const alive = aliveX64sc();
  log(`PREFLIGHT_BROKER ${broker}`);
  log(`PREFLIGHT_X64SC ${alive.length ? alive.join(",") : "(none)"}`);
  if (broker !== "inactive") {
    throw new Error(`D-16 REFUSAL: the vice-broker unit is "${broker}", expected "inactive". Measurement not taken.`);
  }
  if (alive.length) {
    throw new Error(`D-16 REFUSAL: ${alive.length} other x64sc process(es) alive (${alive.join(",")}). Measurement not taken.`);
  }
  return { broker, alive };
}

// --- ports ---------------------------------------------------------------

/** Bind a throwaway TCP listener on port 0, read the OS-assigned port, close.
 * Called twice for two distinct free ports. The probe owns both port numbers
 * itself, which is precisely why no broker port-allocation plumbing is
 * needed for this direct-spawn measurement. */
function allocOnePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export async function allocPorts() {
  const a = await allocOnePort();
  let b = await allocOnePort();
  // Vanishingly unlikely (TIME_WAIT reuse) but guarded anyway: refuse to hand
  // back the same port twice under either name.
  for (let attempt = 0; b === a && attempt < 5; attempt += 1) {
    b = await allocOnePort();
  }
  if (b === a) throw new Error(`allocPorts: could not obtain two distinct ports after retries (both ${a})`);
  return { binaryPort: a, textPort: b };
}

// --- argv (D-12, D-14) -----------------------------------------------------

/**
 * Reproduces buildViceArgs()'s stock branch (`broker-launch.mts`) exactly:
 * reset-to-defaults first, optionally `-console`, the drive-type pair, then
 * the IMPORTED determinism-flag array, then the binary-monitor flag and its
 * loopback address pair, then the text-monitor flag and its loopback address
 * pair LAST. Both addresses bind 127.0.0.1 only -- never a wider bind, per
 * the shipped launcher's own recorded warning that both monitors are
 * unauthenticated.
 *
 * Ordering fact vs. assumption, recorded here rather than left implicit:
 *   - `-default` preceding `-binarymonitor` is MEASURED on this host
 *     (CLAUDE.md project constraints: "-default must precede -binarymonitor
 *     or the monitor never binds").
 *   - The SAME discipline for `-remotemonitor` (that `-default` need only
 *     precede it, and that trailing it after `-binarymonitor` is fine) is
 *     ASSUMED, NOT MEASURED -- nothing has ever dialed that port before this
 *     plan. `swapMonitorOrder` exists so a caller can test the alternative
 *     ordering (text-monitor pair moved ahead of the binary-monitor pair) if
 *     the assumed order fails to bind, turning assumption A1 into a
 *     recorded fact either way.
 */
export function buildProbeArgs({ binaryPort, textPort, headless = true, swapMonitorOrder = false }) {
  const args = ["-default"];
  if (headless) args.push("-console");
  args.push("-drive8type", "1541");
  args.push(...STOCK_DETERMINISM_FLAGS);
  const binMonPair = ["-binarymonitor", "-binarymonitoraddress", `ip4://127.0.0.1:${binaryPort}`];
  const textMonPair = ["-remotemonitor", "-remotemonitoraddress", `ip4://127.0.0.1:${textPort}`];
  if (swapMonitorOrder) {
    args.push(...textMonPair, ...binMonPair);
  } else {
    args.push(...binMonPair, ...textMonPair);
  }
  return args;
}

// --- spawn / reap ----------------------------------------------------------

export const CHILDREN = new Set();

export function reapAll() {
  for (const child of CHILDREN) {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
  CHILDREN.clear();
  try {
    execFileSync("pkill", ["-x", X64SC_PROCESS_NAME]);
  } catch {}
}
process.on("exit", reapAll);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    reapAll();
    process.exit(130);
  });
}

/** Spawn the resolved binary with the given flag array (NOT including the
 * binary path itself). Registers the child in CHILDREN so reapAll() can
 * never miss it. */
export function spawnVice(binPath, args, { env } = {}) {
  const child = spawn(binPath, args, { env: env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
  CHILDREN.add(child);
  child.on("exit", () => CHILDREN.delete(child));
  return child;
}

// --- monitor helpers ---------------------------------------------------------

/** Dial until the monitor's listener accepts, inside a budget. Returns the
 * elapsed milliseconds so the caller can record the OBSERVED bind-time
 * budget rather than assume one. Used for BOTH ports independently -- the
 * text port has no measured bind-time budget on file. */
export async function connectWithRetry(client, port, { budgetMs = 60000 } = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + budgetMs;
  let last = null;
  for (;;) {
    try {
      await client.connect("127.0.0.1", port, { timeoutMs: 5000 });
      return Date.now() - startedAt;
    } catch (err) {
      last = err;
      if (Date.now() >= deadline) {
        throw new Error(`monitor port ${port} never accepted a connection within ${budgetMs} ms: ${last.message}`);
      }
      await sleep(150);
    }
  }
}

/** PING until answered -- an accepted TCP connection is not yet a serving
 * monitor; the listen backlog accepts before the monitor services. */
export async function pingReady(client) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await client.send(CommandType.Ping, Buffer.alloc(0), { timeoutMs: 3000 });
      return attempt;
    } catch (err) {
      if (attempt >= 12) {
        throw new Error(`monitor accepted the socket but never answered PING after ${attempt} attempts: ${err.message}`);
      }
      await sleep(500);
    }
  }
}

const MEMSPACE_MAIN = 0x00;

/** Arm an Exec checkpoint at `address` with stop-on-hit OFF (a non-stopping
 * checkpoint), through the SHIPPED checkpointSetBody() encoder. Never
 * temporary, so it survives its own hits and can be read repeatedly. */
export async function armNonStoppingExec(client, { address }) {
  return client.send(
    CommandType.CheckpointSet,
    proto.checkpointSetBody({
      start: address,
      end: address,
      stop: false,
      enabled: true,
      operation: CheckpointOperation.Exec,
      temporary: false,
      memspace: MEMSPACE_MAIN,
    }),
  );
}

/** Read one checkpoint's own hit count through the shipped CHECKPOINT_GET
 * (0x11) encoder. */
export async function checkpointHitCount(client, cpId) {
  const reply = await client.send(CommandType.CheckpointGet, proto.cpNumBody(cpId));
  return reply.checkpoint.hitCount;
}

/**
 * Arm a STOPPING (`stop_when_hit=true`) exec checkpoint at `address` --
 * the mirror of armNonStoppingExec() above, added for 39-04 (`CROSS_CHANNEL_RESUME`
 * direction two): a halt the BINARY client owns, distinct from a foreign
 * halt induced over the text channel. Through the same shipped
 * checkpointSetBody() encoder; never temporary, so the caller controls its
 * own lifecycle (delete it explicitly via deleteCheckpoint() once its
 * purpose is served, rather than relying on `temporary` auto-clearing it,
 * which would remove it AFTER its one stopping hit -- fine for a single
 * bracket, but this caller re-arms/re-uses the id across repetitions).
 */
export async function armStoppingExec(client, { address }) {
  return client.send(
    CommandType.CheckpointSet,
    proto.checkpointSetBody({
      start: address,
      end: address,
      stop: true,
      enabled: true,
      operation: CheckpointOperation.Exec,
      temporary: false,
      memspace: MEMSPACE_MAIN,
    }),
  );
}

/** Delete a checkpoint through the shipped CHECKPOINT_DELETE (0x13) encoder
 * (the same 4-byte checkpointNum body CHECKPOINT_GET uses). Used to retire
 * a diagnostic checkpoint before a window where its own unsolicited
 * CHECKPOINT_INFO hits would contaminate an UNRELATED measurement counting
 * unsolicited broadcast frames. */
export async function deleteCheckpoint(client, cpId) {
  return client.send(CommandType.CheckpointDelete, proto.cpNumBody(cpId));
}

/**
 * Send EXIT (0xaa) once -- the resume-execution command. MEASURED on this
 * host, empirically, while building this probe (not previously documented
 * anywhere in this project): a stock x64sc launched with `-console` plus
 * either monitor flag starts with the CPU HALTED, and it stays halted
 * indefinitely until this exact command is sent -- reading state (MEMORY_GET,
 * REGISTERS_GET, CHECKPOINT_GET) does NOT itself start it running, and
 * conversely, once resumed, the CPU keeps running autonomously until the
 * NEXT command is sent to the monitor (which halts it again). A caller that
 * needs a window of continuous free-running execution must send this
 * exactly once and then send NOTHING ELSE for the duration of that window.
 */
export async function resumeExecution(client) {
  return client.send(CommandType.Exit, Buffer.alloc(0), { timeoutMs: 10000 });
}

/**
 * Wait for the checkpoint's OWN unsolicited CHECKPOINT_INFO event (not a
 * CheckpointGet reply) to arrive, up to `budgetMs`. Used to confirm a
 * freshly-resumed machine has actually reached its first interrupt --
 * MEASURED at ~2000ms on this host for a cold C64 boot (the KERNAL RAM
 * test masks interrupts for that long before the first jiffy IRQ), so a
 * caller that samples a "is it still running" window immediately after
 * resume, without first waiting for this, reads a false negative that has
 * nothing to do with any foreign channel and everything to do with the
 * boot still being in progress.
 */
export function awaitFirstCheckpointHit(client, cpId, { budgetMs = 30000 } = {}) {
  return new Promise((resolve) => {
    const onEvent = (frame) => {
      if (frame.type !== "checkpoint_info" || frame.checkpoint.id !== cpId) return;
      finish({ hit: true, elapsedMs: Date.now() - startedAt });
    };
    const startedAt = Date.now();
    const finish = (result) => {
      clearTimeout(timer);
      client.off("event", onEvent);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ hit: false, elapsedMs: Date.now() - startedAt }), budgetMs);
    client.on("event", onEvent);
  });
}

// --- test:automated baseline (README.md Evidence conventions 4) --------------

/** Runs the gated automated suite from src/mcp/vice and returns what it
 * OBSERVED -- never an assumed or previously-briefed count. Parses the
 * `node --test` summary lines (`tests`, `pass`, `fail`) and the `test at
 * <file>:` lines naming which files failed. */
export function testAutomatedBaseline() {
  const run = spawnSync("npm", ["run", "test:automated"], { cwd: MCP_DIR, encoding: "utf8" });
  const combined = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const pick = (name) => {
    const m = combined.match(new RegExp(`^ℹ ${name} (\\d+)`, "m"));
    return m ? Number(m[1]) : null;
  };
  const tests = pick("tests");
  const pass = pick("pass");
  const fail = pick("fail");
  const failingFiles = [...new Set([...combined.matchAll(/^test at ([^:]+):\d+:\d+/gm)].map((m) => m[1]))];
  return { tests, pass, fail, failingFiles, exitCode: run.status, raw: combined };
}

// --- probe cache directory (README.md Evidence conventions 2) ----------------

/** Cross-wave working artifacts live outside the checkout and outside /tmp
 * (tmpfs on this host, 16 GB, emptied only on reboot). */
export const PROBE_DIR = path.join(os.homedir(), ".cache", "c64-re-tools", "phase39", "39-03");

// --- small helpers -----------------------------------------------------------

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...parts) => process.stdout.write(`${parts.join(" ")}\n`);

// --- CLI (--preflight entry point) -------------------------------------------

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  const cmd = process.argv[2];
  if (cmd === "--preflight") {
    try {
      preflight();
      log("PREFLIGHT_OK");
      process.exitCode = 0;
    } catch (err) {
      log(`PREFLIGHT_REFUSED ${err.message}`);
      process.exitCode = 1;
    }
  } else {
    process.stderr.write("usage: node probe-harness.mjs --preflight\n");
    process.exitCode = cmd ? 1 : 0;
  }
}
