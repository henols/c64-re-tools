// broker-launch.mts
//
// C (complete, plan 02 of Phase 01.6.2): the single `in_flight` launch-guard
// owner (plan 01, unchanged -- every launch call site in the whole broker
// goes through tryLaunchOne(), which is what makes the single-owner
// guarantee mechanical rather than a convention plan 02's own concurrency
// race test can silently violate), PLUS the readiness probe's single
// in-process mechanism (collapsed from a three-way branch by Phase
// 01.6.2.1's own plan 02 -- D-05 as amended by P-05/P-06/P-07; see
// probeReady()'s own header comment below for the amendment's record),
// serialised warm-floor maintenance (one launch per pass, never more), and
// the fixed-order evaluation pass both surviving concerns run through.
//
// Plan 03, Task 2 grows this module into a real per-child supervisor
// (C2/D-23), absorbing resources/vice-supervisor.sh wholesale: superviseChild()
// launches an instance through tryLaunchOne() (the SAME single guarded
// primitive above) and installs an exit handler on the spawned child that
// respawns on crash (doubling backoff, clamped at a ceiling), gives up
// cleanly after too many crashes inside a window, never respawns a
// deliberately-killed instance, and writes the per-instance boot/crash log
// D-23 preserves at the exact path shape the retiring bash supervisor used.
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptionsWithoutStdio } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, closeSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
// TYPE-ONLY import, deliberately -- this module must be importable and
// runnable directly (native Node type-stripping, no build step) by its own
// unit tests, exactly like every other host-bound module's test file
// already does. A VALUE import of broker-state's own exports (nextFreePort,
// countReady, countTotal, countLaunching) would need "./broker-state.mjs"
// to resolve at RUNTIME when this file is executed unbuilt -- and it
// cannot: that path only exists once `tsc` compiles both siblings into
// resources/. `import type` is fully erased under this project's
// verbatimModuleSyntax, so Node's native stripping never attempts to
// resolve it at all (verified empirically this task). The functions
// themselves are therefore REQUIRED, injected fields on
// MaintainWarmFloorDeps below -- vice-broker.mts (which already imports
// broker-state.mjs's real values for its own wiring) supplies the real
// ones; tests inject their own.
import type { BrokerState, InstanceRecord, PortAllocationResult } from "./broker-state.mjs";
// SAME type-only reasoning applies to broker-epoch.mts's own exports --
// superviseChild() below never imports epochPathFor/instanceLogDirFor/
// nextEpochFor/writeEpochRecord as VALUES (that would break this module's
// own unbuilt unit test the identical way a broker-state.mjs value import
// would); they are required, injected fields on SuperviseChildDeps
// (EpochWriterDeps) instead. Tests inject the REAL functions via a direct
// "./broker-epoch.mts" source import (safe -- test files reference the
// literal .mts extension, never the post-build .mjs specifier).
import type { EpochRecord } from "./broker-epoch.mjs";
// Plan 02-07: ViceBackend's definition moved to backend-detect.mts, which is
// now the type's one home (and the ONE reader of VICE_BACKEND, via that
// module's own resolvedBackend() -- see backend-detect.mts's own header
// comment). TYPE-ONLY, for the same reason as the two imports directly
// above: backend-detect.mts is ALSO a host-bound sibling compiled into this
// same build, so a VALUE import would need "./backend-detect.mjs" to exist
// at runtime -- which it does not when this file runs directly, unbuilt,
// under its own unit tests. This file only ever needs the TYPE (its own
// Deps interfaces); nothing here calls resolvedBackend() itself -- that is
// vice-broker.mts's job, exactly once, at startup.
import type { ViceBackend } from "./backend-detect.mjs";

// Module-level: this file, not the caller, owns the single boolean --
// synchronous check, synchronous set, released in a finally, with no
// `await` between the check and the set.
//
// D-07 (01.6.2.1-03-PLAN.md): launch PRIORITY is layered on this owner, and
// never replaces or weakens it. An in-flight boot always completes and is
// NEVER killed or abandoned to serve a later arrival -- preemption was
// considered and rejected (01.6.2-CONTEXT.md D-07) because a kill/relaunch
// overlap re-creates the exact concurrent-spawn window the 2026-08-01
// outage came from (one SEGV, one exit 1, one exit 0 at the identical spawn
// second). Once a boot reaches `ready`, a waiting request takes it
// regardless of which reason booted it (vice-broker.mts's
// selectWarmInstance() performs no `reason` check at all -- proven by
// vice-broker-acquire.test.ts). Priority governs only which REASON wins
// this slot once it next frees, via the fixed pass order (runBrokerPass()'s
// own invariant comment, below) -- it never decides who currently holds it.
let inFlight = false;

// The reason currently holding the slot, alongside `inFlight` -- metadata
// only, never a second guard: nothing branches on this value's presence to
// decide whether a launch may proceed (that is `inFlight` alone, checked
// and set synchronously exactly as before). Its only consumer is the
// launch-slot decision log line (D-07's standing constraint that a
// lifecycle decision must be reconstructable from the log after an
// incident -- both 2026-08-01 and 2026-08-02 were diagnosed from broker log
// lines).
let inFlightReason: string | null = null;

/** True while a launch is in progress -- exported for the race test plan 02
 * writes against two concurrent tryLaunchOne() calls. */
export function isLaunchInFlight(): boolean {
  return inFlight;
}

// Gates the stock binmon-bind-widened stderr note below so a long-running
// broker (or a test suite driving buildViceArgs() many times) emits it at
// most once per process -- the repo-root.ts `warnedEnvOutsideFrom` gate
// pattern, reused here.
let warnedBinmonBindWidened = false;

// Plan 03-04 (DIRECT-06, D-13): the SAME one-time-note idiom as
// warnedBinmonBindWidened above, for the SECOND (`-remotemonitor`) port's
// bind -- a separate boolean because the two flags widen independently (a
// caller could widen one host override and not the other, though in
// practice both resolve from the same `binmonHost` value below).
let warnedRemoteMonitorBindWidened = false;

/** Resolves the emulator's own argument vector for the given `backend`. The
 * `VICE_ARGS` full-override short-circuit (matching
 * resources/vice-supervisor.sh's own VICE_ARGS convention exactly) is
 * checked FIRST, ahead of either backend branch, and stays unchanged for
 * both: it exists because this broker's own tests (and an operator's manual
 * dry runs) need to launch a stand-in binary (e.g. /bin/sleep) that
 * understands neither `-mcpserver` nor `-binarymonitor` flags, and that need
 * does not depend on which backend is configured.
 *
 * `backend: "fork"` returns exactly the pre-Phase-2 shape, byte-identical:
 * the MCP server flag, the MCP server host from `mcpHost` or
 * VICE_BROKER_MCP_HOST (default `0.0.0.0`), and the MCP server port.
 *
 * `backend: "stock"` returns `-binarymonitor -binarymonitoraddress
 * ip4://<host>:<port>` (docs/phase1-probe-results.md's confirmed real-world
 * command line). The host resolves from `binmonHost` or
 * VICE_BROKER_BINMON_HOST, defaulting to `127.0.0.1` -- deliberately
 * narrower than the fork path's `0.0.0.0` default, because VICE's binary
 * monitor is unauthenticated by design and grants full read/write over the
 * emulated machine plus process control to anything that can reach it
 * (planner decision, `02-03-PLAN.md`). Widening the bind away from loopback
 * emits exactly one stderr note per process, naming the resolved bind
 * address and what the exposure grants.
 *
 * Plan 03-04 (DIRECT-06, D-13): when `remoteMonitorPort` is a number, the
 * stock branch APPENDS `-remotemonitor -remotemonitoraddress
 * ip4://<host>:<remoteMonitorPort>`, reusing the SAME resolved `host` value
 * the binmon address already used -- one resolution, not two. When
 * `remoteMonitorPort` is omitted (undefined), the returned argv is
 * byte-identical to what this function always returned -- no
 * `-remotemonitor` at all. `-remotemonitoraddress`'s exact spelling is
 * `[ASSUMED]` by symmetry with `-binarymonitoraddress` (RESEARCH.md
 * Assumption A1) and is filed as probe debt under
 * `.planning/todos/pending/`. Widening THIS bind away from loopback emits
 * its own one-time stderr note (`warnedRemoteMonitorBindWidened`), naming
 * the resolved address and stating that VICE's TEXT monitor accepts
 * arbitrary monitor commands and is unauthenticated -- Phase 3 dials
 * nothing on this port; only the launch flag lands now (see D-13's own
 * rationale: adding the flag later would require relaunching a live
 * instance, destroying all emulation state). */
export function buildViceArgs(
  port: number,
  {
    backend,
    mcpHost,
    binmonHost,
    viceArgsEnv,
    remoteMonitorPort,
  }: { backend: ViceBackend; mcpHost?: string; binmonHost?: string; viceArgsEnv?: string; remoteMonitorPort?: number },
): string[] {
  const rawViceArgs = viceArgsEnv ?? process.env.VICE_ARGS;
  if (typeof rawViceArgs === "string" && rawViceArgs.trim() !== "") {
    return rawViceArgs.trim().split(/\s+/);
  }
  if (backend === "stock") {
    const host = binmonHost ?? process.env.VICE_BROKER_BINMON_HOST ?? "127.0.0.1";
    if (host !== "127.0.0.1" && !warnedBinmonBindWidened) {
      warnedBinmonBindWidened = true;
      process.stderr.write(
        `vice-broker: stock binary-monitor bind widened to ${host} -- VICE's binary monitor is ` +
          `unauthenticated and grants full memory read/write plus process control to anything that can ` +
          `reach it; the default of 127.0.0.1 is the safe posture for a host-native install, widen only ` +
          `when the MCP server itself runs in a container that must reach the host emulator\n`,
      );
    }
    // Audit item I-2 (§4.2, FINDING-C1): a broker-launched stock x64sc used
    // to boot with Drive8Type=0 (NONE) -- nothing answers unit 8, so
    // LOAD"*",8,1 fails ?DEVICE NOT PRESENT ERROR and the entry-point
    // checkpoint never hits. No stock MCP tool can correct this after boot
    // (the 38-tool stock manifest has zero resource-set names by design),
    // so the fix must be a launch-time flag. `-default` MUST be the very
    // first element: it is VICE's reset-to-compiled-in-defaults instruction,
    // not an inert "these are the baselines" no-op, so any flag emitted
    // before it (including -drive8type) is silently clobbered back to its
    // compiled-in value. `-drive8type 1541` therefore has to come
    // immediately after `-default`, and -- per CLAUDE.md's documented
    // constraint -- `-default` also has to come before `-binarymonitor` or
    // the monitor never binds and the subsequent connect hangs in the
    // backlog looking exactly like a wedge. Confirmed sufficient live in
    // Phase 8.1's standalone probe (08.1-WALKTHROUGH-EVIDENCE.md §4):
    // `resourceget "Drive8Type"` moved 0 -> 1541 and a `load` over the text
    // monitor succeeded immediately. Deliberately NOT setting
    // -drive8truedrive / Drive8TrueEmulation here: this build's own default
    // already reads Drive8TrueEmulation=1 (same probe), so 08.2-RESEARCH.md's
    // primary recommendation is that only -drive8type needs adding.
    // Assumption A3 in that doc's Assumptions Log (some other stock build
    // might default Drive8TrueEmulation to 0) is read and deliberately not
    // pre-emptively defended against here; plan 03's live test is what would
    // surface it if that assumption is ever wrong on a different build.
    const args = ["-default", "-drive8type", "1541", "-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`];
    if (typeof remoteMonitorPort === "number") {
      if (host !== "127.0.0.1" && !warnedRemoteMonitorBindWidened) {
        warnedRemoteMonitorBindWidened = true;
        process.stderr.write(
          `vice-broker: stock text (-remotemonitor) monitor bind widened to ${host} -- VICE's text monitor ` +
            `accepts arbitrary monitor commands and is unauthenticated, exactly like the binary monitor; the ` +
            `default of 127.0.0.1 is the safe posture for a host-native install, widen only when the MCP server ` +
            `itself runs in a container that must reach the host emulator\n`,
        );
      }
      args.push("-remotemonitor", "-remotemonitoraddress", `ip4://${host}:${remoteMonitorPort}`);
    }
    return args;
  }
  const host = mcpHost ?? process.env.VICE_BROKER_MCP_HOST ?? "0.0.0.0";
  return ["-mcpserver", "-mcpserverhost", host, "-mcpserverport", String(port)];
}

export interface TryLaunchDeps {
  state: BrokerState;
  supervisorDir: string;
  epochFile: string;
  /** I-1 rider (08.2-02-PLAN.md, Task 2): widened to an optional third
   * `options` argument so `spawnAndRecordInstance()` below can thread a
   * scratch `XDG_CONFIG_HOME` through for stock launches. The parameter is
   * optional, so every pre-existing 2-arg caller and every pre-existing
   * 2-arg test stub keeps compiling and behaving identically -- JS/TS
   * function-type compatibility allows a function that ignores its extra
   * argument to satisfy a type that offers one. */
  spawn?: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  now?: () => number;
  viceBin?: string;
  mcpHost?: string;
  /** Which backend's argv shape to build (D-04, D-12) -- optional and
   * defaulting to `"fork"` when omitted, so every pre-Phase-2 caller (and
   * every existing test in broker-launch.test.ts that never mentions this
   * field) keeps producing the exact byte-identical fork argv it always
   * has. The real broker resolves this ONCE at startup via
   * backend-detect.mts's resolvedBackend() and passes the resolved value
   * down through every real launch call site -- see that module's own doc
   * comment; this file no longer reads VICE_BACKEND itself in any form. */
  backend?: ViceBackend;
  /** Stock-only bind override -- see buildViceArgs()'s own doc comment.
   * Ignored entirely when `backend` is `"fork"` or omitted. */
  binmonHost?: string;
  /** Plan 03-04 (DIRECT-06, D-13): the second, broker-allocated port stock's
   * `-remotemonitor` text monitor binds -- threaded straight through to
   * buildViceArgs() and mirrored onto the constructed InstanceRecord (key
   * omitted when `undefined`). This function stays fully synchronous -- it
   * must NOT allocate this port itself; the caller (acquirePortAndLaunch()
   * below) resolves it before calling in. */
  remoteMonitorPort?: number;
  /** Overrides the resolved-command-line log line's destination -- default
   * writes to stderr exactly like before this field existed. Added (plan
   * 03) so superviseChild()'s own tests can capture "the resolved spawn
   * command line is logged before every spawn, including every respawn"
   * (T-jty-02's mitigation) without scraping process.stderr. */
  log?: (line: string) => void;
}

/** The unguarded spawn+record primitive -- no in_flight check here at all.
 * Called from exactly two places: tryLaunchOne() below (which wraps it in
 * the standalone synchronous guard) and acquirePortAndLaunch() further
 * down (which holds that SAME guard across its own async port-allocation
 * step first, then calls this directly so the guard is never
 * double-checked against itself). Spawns via deps.spawn (defaulting to
 * Node's own child_process.spawn), records the resolved binary path at
 * spawn time into the instance record's expectedIdentity field -- the
 * string the kill discipline (broker-kill.mts) checks identity against,
 * and the VICE_BIN binary this broker spawns directly, never any
 * intermediate script path. Logs the resolved command line before
 * spawning, so a bad configuration value is visible rather than silently
 * mis-parsed, exactly like the bash launcher's own logging discipline. */
function spawnAndRecordInstance(reason: string, port: number, deps: TryLaunchDeps): InstanceRecord {
  const spawnFn = deps.spawn ?? ((cmd: string, args: string[], opts?: SpawnOptionsWithoutStdio) => nodeSpawn(cmd, args, opts));
  const now = deps.now ?? ((): number => Date.now());
  const viceBin = deps.viceBin ?? process.env.VICE_BIN ?? "x64sc";
  const backend = deps.backend ?? "fork";
  const viceArgs = buildViceArgs(port, {
    backend,
    mcpHost: deps.mcpHost,
    binmonHost: deps.binmonHost,
    remoteMonitorPort: deps.remoteMonitorPort,
  });
  const log = deps.log ?? defaultLog;

  // I-1 rider (audit §4.4, 08.2-02-PLAN.md Task 2): production stock
  // launches used to set no scratch XDG_CONFIG_HOME and would read whatever
  // vicerc the operator's own $HOME already carried -- shared with the
  // operator's own VICE usage and with the fork build. For backend ===
  // "stock" only, compute a fresh, isolated config dir with mkdtempSync
  // (atomic creation, random suffix, 0700 permissions -- the primitive that
  // makes a collision or a symlink-swap into the operator's real config
  // unreachable) and pass it as a third options argument carrying `env`
  // only. Never `shell: true`: the existing array-form spawn(viceBin,
  // viceArgs) call avoids shell interpretation entirely and that property
  // must survive this widening. For backend === "fork", spawnFn is called
  // with NO third argument at all, so the fork path's observable behaviour
  // stays bit-for-bit what it was (BACK-02 is a standing gate and the fork
  // backend has been the sole production backend across all of v0.1.x).
  //
  // Scope boundary (do not remove this note): the production broker daemon
  // always supplies its own deps.spawn / deps.spawnFactory, so the widened
  // default wrapper above is dead code on the real launch paths. This
  // function's job is only to COMPUTE the value at the one seam that should
  // own it; the forwarding to nodeSpawn() happens at four further hops --
  // makeLoggingSpawn() and maintainWarmFloorForRealBroker's inner
  // stashingSpawn in vice-broker.mts, and withCrashSupervision()'s wrapper
  // body and launchSupervised()'s defaultRealSpawn in this file. All four
  // now forward the options argument (plan 08.2-06 closed them in this same
  // phase, with a handleAcquire() composition test that omits
  // buildColdSpawnFactory so an injected stub cannot fake the proof). If you
  // add a fifth spawn hop, it must forward options too, or production stock
  // launches silently lose their config isolation again.
  //
  // Scratch-dir lifetime: this function deliberately does NOT clean the
  // directory up -- the spawned emulator process outlives this function's
  // return and needs the directory for its whole lifetime. Per-launch
  // scratch dirs therefore accumulate under the OS temp dir for the life of
  // the host; this is a recorded trade-off, not an oversight. If reaping
  // them is ever worth doing, the broker's own kill/recycle path is the
  // component that would own it (it already knows when an instance's
  // process has actually exited).
  let spawnOptions: SpawnOptionsWithoutStdio | undefined;
  let logLine = `vice-broker: launching ${viceBin} ${viceArgs.join(" ")}`;
  if (backend === "stock") {
    const scratchConfigDir = mkdtempSync(join(tmpdir(), "vice-broker-vicerc-"));
    spawnOptions = { env: { ...process.env, XDG_CONFIG_HOME: scratchConfigDir } };
    logLine += ` (XDG_CONFIG_HOME=${scratchConfigDir})`;
  }
  log(logLine);

  const child = spawnOptions === undefined ? spawnFn(viceBin, viceArgs) : spawnFn(viceBin, viceArgs, spawnOptions);
  const record: InstanceRecord = {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "launching",
    reason,
    epochFile: deps.epochFile,
    supervisorDir: deps.supervisorDir,
    pid: child.pid ?? null,
    expectedIdentity: viceBin,
    launchedAt: now(),
    readyAt: null,
    viceBin,
    viceArgs,
    dryRun: false,
    ...(deps.remoteMonitorPort === undefined ? {} : { remoteMonitorPort: deps.remoteMonitorPort }),
  };
  deps.state.instances.set(port, record);
  return record;
}

/** The single in_flight owner, for a caller that ALREADY knows its port.
 * Fully SYNCHRONOUS by design -- no `await` anywhere between the guard
 * check and the guard release. This is what makes the single-owner
 * guarantee hold even under concurrent CALLERS: JS's run-to-completion
 * semantics mean two invocations of a synchronous function can never
 * interleave, regardless of how many async callers race to reach it. The
 * moment this function itself grows an internal `await` between the check
 * and the set, that guarantee is lost -- see broker-launch.test.ts's own
 * "discriminating power" regression check for a demonstration.
 *
 * This is the RIGHT primitive when the port is already decided and fixed
 * (most tests; any future caller with its own allocation scheme). It is
 * deliberately NOT what handleAcquire or maintainWarmFloor call for a
 * FRESH port, because nextFreePort() itself is asynchronous (a real
 * port-in-use probe requires it) -- see acquirePortAndLaunch()'s own
 * header comment for the race that creates and how it is closed. */
export function tryLaunchOne(reason: string, port: number, deps: TryLaunchDeps): InstanceRecord | null {
  if (inFlight) return null;
  inFlight = true;
  try {
    return spawnAndRecordInstance(reason, port, deps);
  } finally {
    inFlight = false;
  }
}

export interface AcquirePortAndLaunchDeps {
  state: BrokerState;
  stateDir: string;
  allocatePort: (state: BrokerState) => Promise<PortAllocationResult>;
  /** I-1 rider -- same widened, optional third `options` argument as
   * TryLaunchDeps.spawn's own doc comment describes; this value is passed
   * straight through to spawnAndRecordInstance() unchanged. */
  spawn?: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  /** Same widening applied to the returned function's own signature -- this
   * factory's result is assigned directly to the `spawn` field above. */
  spawnFactory?: (port: number) => (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  now?: () => number;
  viceBin?: string;
  mcpHost?: string;
  /** See TryLaunchDeps's own doc comment -- same optional, same
   * fork-when-omitted default, threaded through to spawnAndRecordInstance(). */
  backend?: ViceBackend;
  binmonHost?: string;
  /** Plan 03-04 (DIRECT-06, D-13): resolves the SECOND (`-remotemonitor`)
   * port, given the primary port already allocated as `exclude` (so the
   * second allocation can never return the SAME candidate the first one
   * just claimed, before its InstanceRecord exists to make `exclude`
   * redundant). Optional -- omitted entirely (the default for every
   * pre-Phase-3 caller and every fork launch) means no second port is ever
   * requested, and `buildViceArgs()`'s stock branch stays byte-identical to
   * before this field existed. Called ONLY when `backend === "stock"` --
   * this function gates that itself; a caller need not check the backend
   * before providing it. A failed second allocation degrades to launching
   * WITHOUT `-remotemonitor` rather than failing the whole acquire -- a
   * port nothing uses yet must never make the backend unavailable. */
  allocateRemoteMonitorPort?: (state: BrokerState, exclude: ReadonlySet<number>) => Promise<PortAllocationResult>;
  /** Overrides the launch-slot decision log line's destination -- default
   * writes to stderr, matching every other log seam in this module. */
  log?: (line: string) => void;
}

export type AcquireLaunchResult =
  | { ok: true; record: InstanceRecord }
  | { ok: false; reason: "launch_in_flight" | "no_free_port" };

/** Holds the SAME single in_flight owner across the ENTIRE
 * allocate-a-port-then-launch sequence -- not merely the synchronous spawn
 * instant tryLaunchOne() alone guards. This closes a genuine race window
 * tryLaunchOne() cannot: nextFreePort()'s own port-in-use probe is
 * asynchronous (plan 02, C4 -- a real bind-and-release check), so two
 * overlapping callers (a cold acquire arriving over the TCP control
 * listener at any moment, and a warm-floor pass on its own poll timer)
 * could otherwise BOTH be told the SAME candidate port is free before
 * either commits it to state.instances -- a double-launch on one port,
 * silently overwriting the earlier record. The guard is checked and set
 * SYNCHRONOUSLY before the first `await`, exactly like tryLaunchOne()'s
 * own discipline, so a second concurrent call is refused immediately
 * (`launch_in_flight`) rather than racing on the allocation.
 *
 * This is also the function that restores vice-broker.sh's own
 * process_requests() throttle (its `in_flight` local, checked before a
 * COLD launch, not only before a warm one): a cold acquire and a
 * warm-floor pass can never launch simultaneously, matching the bash
 * original's declined-to-change behaviour (RESEARCH.md §A1/§C). D-07
 * (01.6.2.1-03-PLAN.md) layers non-preemptive PRIORITY on top of this same
 * "one at a time" guard, never replacing it: this function still only ever
 * refuses a second concurrent caller (`launch_in_flight`), and never kills
 * or preempts whichever caller already holds the slot -- which reason wins
 * this slot NEXT, once it frees, falls out of runBrokerPass()'s own fixed
 * evaluation order (that function's own invariant comment), not from
 * anything in this function. The refusal below logs which reason currently
 * holds the slot and which reason is waiting, so the decision is
 * reconstructable from the log after an incident. */
export async function acquirePortAndLaunch(reason: string, deps: AcquirePortAndLaunchDeps): Promise<AcquireLaunchResult> {
  const log = deps.log ?? defaultLog;
  if (inFlight) {
    log(`vice-broker: launch-slot decision -- ${inFlightReason ?? "unknown"} holds the slot; ${reason} waits (D-07)`);
    return { ok: false, reason: "launch_in_flight" };
  }
  inFlight = true;
  inFlightReason = reason;
  try {
    const portResult = await deps.allocatePort(deps.state);
    if (!portResult.ok) {
      return { ok: false, reason: "no_free_port" };
    }
    const port = portResult.port;
    const supervisorDir = join(deps.stateDir, String(port));
    const epochFile = join(supervisorDir, "epoch.json");
    const spawn = deps.spawnFactory ? deps.spawnFactory(port) : deps.spawn;

    // Plan 03-04 (DIRECT-06, D-13): the second (`-remotemonitor`) port is
    // resolved HERE, still inside the single in_flight owner's own
    // try-block, immediately after the primary allocation succeeds -- both
    // awaits stay inside this SAME try, after the guard's synchronous
    // check-and-set above; neither is moved, duplicated, or awaited around
    // that guard. Only ever attempted for `backend === "stock"`, and only
    // when the caller actually provided the allocator -- every fork launch
    // and every pre-Phase-3 caller never reaches this branch at all.
    let remoteMonitorPort: number | undefined;
    if (deps.backend === "stock" && deps.allocateRemoteMonitorPort) {
      const remoteResult = await deps.allocateRemoteMonitorPort(deps.state, new Set([port]));
      if (remoteResult.ok) {
        // Assigned directly (not via broker-state.mjs's blockPort()) -- this
        // module's own type-only import of that sibling is load-bearing
        // (see this file's own header comment): a VALUE import would turn
        // "./broker-state.mjs" into a real runtime resolution this file
        // cannot satisfy when loaded directly, as this file's own unit test
        // does. `state.blockedPorts` is a plain Set the type import already
        // describes, so mutating it directly needs no value import at all --
        // exactly the same discipline handleExit()'s own
        // `record.monitorClient = undefined` uses in place of
        // clearMonitorClient().
        deps.state.blockedPorts.add(remoteResult.port);
        remoteMonitorPort = remoteResult.port;
      } else {
        // Degrade, never fail: a port nothing dials yet (Phase 3 builds no
        // text-monitor client) must never make the backend unavailable.
        log(
          `vice-broker: second (-remotemonitor) port allocation failed (${remoteResult.reason}) -- ` +
            `launching WITHOUT -remotemonitor; nothing in Phase 3 dials the text-monitor port anyway`,
        );
      }
    }

    const record = spawnAndRecordInstance(reason, port, {
      state: deps.state,
      supervisorDir,
      epochFile,
      spawn,
      now: deps.now,
      viceBin: deps.viceBin,
      mcpHost: deps.mcpHost,
      backend: deps.backend,
      binmonHost: deps.binmonHost,
      remoteMonitorPort,
    });
    return { ok: true, record };
  } finally {
    inFlight = false;
    inFlightReason = null;
  }
}

/** The ONE way an instance record leaves `state.instances` for good --
 * deleting the record AND handing its second (`-remotemonitor`) port back to
 * the allocator in the same step.
 *
 * CR-02 (03-REVIEW.md): `acquirePortAndLaunch()` above adds every allocated
 * remote-monitor port to `state.blockedPorts`, and until this function existed
 * NOTHING ever removed one. `nextFreePort()` never reconsiders a blocked
 * candidate for the lifetime of the process, so every teardown of a stock
 * instance permanently consumed one more port out of the fixed
 * PORT_SCAN_CEILING window even though the OS port was free again the instant
 * the owning process exited -- a long-running broker (the explicit design goal
 * of an on-demand pool with crash supervision and a warm floor) eventually
 * exhausts its band and answers `no_free_port` to ordinary launches purely
 * from routine churn, with no operator recourse short of a broker restart.
 *
 * A RESPAWN is deliberately NOT a call site: the replacement instance keeps
 * BOTH the primary port and the remote-monitor port of the instance it
 * replaces (launchSupervised() below threads the latter forward exactly like
 * the port argument carries the former), so the block must stay in place for
 * the whole chain of replacements rather than being released and immediately
 * re-taken.
 *
 * Mutates `state.blockedPorts` directly rather than through a broker-state
 * helper, for the SAME load-bearing reason acquirePortAndLaunch()'s own
 * `blockedPorts.add` does (see this file's header comment): a VALUE import of
 * "./broker-state.mjs" would turn a type-only dependency into a real runtime
 * resolution this file cannot satisfy when loaded unbuilt, as its own unit
 * test does. Callers outside this module import THIS function rather than
 * re-deriving the pair of mutations. Idempotent, and safe for a record that
 * never had a second port (every fork launch). */
export function deleteInstanceRecord(state: BrokerState, port: number): void {
  const record = state.instances.get(port);
  if (record && typeof record.remoteMonitorPort === "number") {
    state.blockedPorts.delete(record.remoteMonitorPort);
  }
  state.instances.delete(port);
}

// ---------------------------------------------------------------------------
// Readiness probe (D-05's permitted-route note applies throughout this
// section): this is HOST-SIDE broker code inspecting the emulator instance
// IT ITSELF spawned, on 127.0.0.1, as part of owning that instance's
// lifecycle -- exactly like vice-broker.sh's own probe_ready() does today.
// mcp__vice__*-only governs CONTAINER-SIDE code reaching the emulator; this
// is not that. No test in this module ever opens a real connection -- every
// probe test injects its own stub.
// ---------------------------------------------------------------------------

export interface ProbeDeps {
  /** Overrides VICE_BROKER_PROBE_TIMEOUT_S for this call -- test seam. */
  probeTimeoutSEnv?: string;
  /** The HTTP readiness check. Defaults to a real POST against the
   * instance's own /mcp endpoint using the global fetch. Tests inject a
   * stub to control success/failure directly. */
  httpProbe?: (port: number, timeoutMs: number) => Promise<boolean>;
  /** WR-01: which readiness route this port speaks. Threaded in exactly like
   * buildViceArgs() already receives it -- from the ONE `resolvedBackend()` call
   * the broker makes at startup, never re-detected here. Omitted defaults to
   * "fork", so every pre-existing fork call site is unchanged. */
  backend?: ViceBackend;
  /** WR-01: the binary-monitor readiness check, used for `backend: "stock"`.
   * Defaults to the real one-PING-then-EXIT exchange below; tests inject a
   * stub. */
  binmonProbe?: (port: number, timeoutMs: number) => Promise<boolean>;
  log?: (line: string) => void;
}

const DEFAULT_PROBE_TIMEOUT_S = 1;

function defaultLog(line: string): void {
  process.stderr.write(`${line}\n`);
}

/** A single POST of a tools/call for vice_ping at the instance's own URL,
 * bounded by the probe timeout -- matching the exact single-POST curl form
 * vice-broker.sh's own probe_ready() used. Treated as ready ONLY when the
 * response body carries BOTH the "version" and "machine" substrings a real
 * vice_ping reply contains; a bare TCP accept is explicitly not sufficient
 * (a C64 can accept a connection before it has finished booting). */
async function defaultHttpProbe(port: number, timeoutMs: number): Promise<boolean> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "vice_ping", arguments: {} },
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    return text.includes("version") && text.includes("machine");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// WR-01: the STOCK readiness route.
//
// probeReady() below used to POST http://127.0.0.1:<port>/mcp unconditionally
// and require both "version" and "machine" in the body. On the stock backend
// that port speaks the BINARY MONITOR, so the probe could never succeed:
// warm-floor instances stayed `launching` forever, countLaunching(state) > 0
// short-circuited every later warm pass, and a never-usable emulator process was
// retained until broker shutdown while still counting toward
// countTotal()/atCapacity(). Cold acquires kept working only because the cold
// arm grants without probing.
//
// WHY THE WIRE BYTES ARE HAND-BUILT HERE: stock-protocol.ts is the ONE place
// this tree frames and DEMULTIPLEXES the binmon protocol, and this probe is
// deliberately not a second copy of that -- it neither correlates request ids
// nor decodes bodies. But it cannot reuse even the constants: this file is a
// host-bound .mts compiled into resources/ by build.ts, and a .mts cannot
// value-import a .ts module (TS5097). The same constraint already produced
// hand-copied wire constants in binmon-fixtures.ts and a standalone client in
// probe-binmon.mjs. What is written here is the minimum a READINESS check needs:
// one request header out, one response header in, four bytes checked.
// ---------------------------------------------------------------------------

/** Hand-copied from docs/phase0-binmon-findings.md §5 -- see the block comment
 * above for why these are not imported from stock-protocol.ts. */
const BINMON_STX = 0x02;
const BINMON_API_VERSION = 0x02;
const BINMON_REQUEST_HEADER_LEN = 11;
const BINMON_RESPONSE_HEADER_LEN = 12;
const BINMON_CMD_PING = 0x81;
const BINMON_CMD_EXIT = 0xaa;
const BINMON_PROBE_REQUEST_ID = 0x0000ca11;

function binmonRequest(commandType: number, requestId: number): Buffer {
  const header = Buffer.alloc(BINMON_REQUEST_HEADER_LEN);
  header[0] = BINMON_STX;
  header[1] = BINMON_API_VERSION;
  header.writeUInt32LE(0, 2); // no body
  header.writeUInt32LE(requestId >>> 0, 6);
  header[10] = commandType;
  return header;
}

/** The wire's own "this is not a reply to any request I sent" sentinel
 * (CLAUDE.md's Protocol constraint) -- REGISTER_INFO (0x31) arrives
 * unsolicited at THIS id on every monitor open, and CHECKPOINT_INFO/STOPPED/
 * RESUMED/JAM can too. A response-type byte alone is not enough to
 * distinguish "an event that happens to share a type with a real reply" from
 * an actual reply -- request-id is the only field the wire promises never
 * collides between the two, which is exactly why demux must key on it. */
const BINMON_UNSOLICITED_REQUEST_ID = 0xffffffff;

/**
 * WR-01: one PING (0x81) over the binary monitor, requiring a WELL-FORMED 0x81
 * reply -- STX, the expected api_version, response type 0x81, error code 0x00,
 * and this probe's own request id. A bare TCP accept is explicitly insufficient
 * here for exactly the reason probeReady()'s own comment gives for the HTTP
 * route: a C64 can accept a connection before it has finished booting.
 *
 * quick task 260818-obc (live-discovered): a NEW binmon connection ALWAYS
 * emits an unsolicited REGISTER_INFO (0x31) frame at request-id 0xffffffff
 * the instant it opens (CLAUDE.md's own Protocol constraint) -- BEFORE this
 * probe's own PING reply ever arrives. The naive "the first 12 bytes ARE the
 * reply" read this code used to do treated that event frame's OWN response-
 * type byte (0x31) as a malformed PING reply and answered `false` forever,
 * live-reproduced against a real crash-respawned stock x64sc: the respawn
 * never left "launching" because THIS probe could never see it as ready,
 * even though the emulator was genuinely up and answering fine underneath.
 * The fix walks frame boundaries using each frame's own body-length field and
 * discards every frame whose request-id is the unsolicited sentinel (or
 * simply is not this probe's own id) rather than assuming the first frame
 * on the wire is the reply -- the same "demux by request-id, never by
 * arrival order" discipline CLAUDE.md's Protocol constraint already requires
 * of every OTHER binmon consumer in this tree (stock-protocol.ts's
 * ViceMonitorClient chief among them).
 *
 * Then EXIT (0xaa), unconditionally, before closing -- because the PING ITSELF
 * HALTS THE MACHINE. Any inbound byte does (docs/phase0-binmon-findings.md §4,
 * and CR-02, which fixed the same omission in the connect handshake). A
 * readiness probe that left every warm instance frozen would be a worse defect
 * than the one it fixes: the emulator would be "ready" and stopped.
 *
 * Never throws -- every failure (refused, timed out, wrong reply shape, socket
 * error) is `false`, matching defaultHttpProbe()'s own posture, so a
 * still-booting instance simply fails THIS pass and is re-probed on the next.
 *
 * The socket is ALWAYS destroyed before resolving: stock VICE services exactly
 * one binmon client, so a probe that leaked its connection would occupy the
 * single client slot the real session needs to claim.
 */
async function defaultBinmonProbe(port: number, timeoutMs: number): Promise<boolean> {
  const { createConnection } = await import("node:net");
  return new Promise<boolean>((resolvePromise) => {
    let settled = false;
    let buffer = Buffer.alloc(0);
    const socket = createConnection({ host: "127.0.0.1", port });

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* already gone */
      }
      resolvePromise(result);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    socket.on("error", () => finish(false));
    socket.on("close", () => finish(false));
    socket.on("connect", () => {
      socket.write(binmonRequest(BINMON_CMD_PING, BINMON_PROBE_REQUEST_ID));
    });
    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      // Walk complete frames off the front of the buffer -- never assume the
      // first BINMON_RESPONSE_HEADER_LEN bytes on the wire are this probe's
      // own reply (see this function's own header comment on why an
      // unsolicited event frame can and does arrive first in practice).
      for (;;) {
        if (buffer.length < BINMON_RESPONSE_HEADER_LEN) return; // wait for more data
        const bodyLen = buffer.readUInt32LE(2);
        const frameLen = BINMON_RESPONSE_HEADER_LEN + bodyLen;
        if (buffer.length < frameLen) return; // header seen, body still incoming

        const responseType = buffer[6];
        const errorCode = buffer[7];
        const requestId = buffer.readUInt32LE(8);
        const stxOk = buffer[0] === BINMON_STX && buffer[1] === BINMON_API_VERSION;

        if (!stxOk) {
          finish(false);
          return;
        }

        if (requestId === BINMON_UNSOLICITED_REQUEST_ID || requestId !== BINMON_PROBE_REQUEST_ID) {
          // Not a reply to anything this probe sent (an unsolicited event, or
          // a stale reply to a previous probe's own request id) -- discard
          // this one frame only and keep walking the rest of the buffer.
          buffer = buffer.subarray(frameLen);
          continue;
        }

        if (responseType !== BINMON_CMD_PING || errorCode !== 0x00) {
          finish(false);
          return;
        }

        // Resume the machine this probe's own PING halted, then close GRACEFULLY:
        // socket.end(data, cb) writes the EXIT and then sends FIN, so the bytes
        // are delivered before the connection goes away. A bare write() followed
        // by destroy() can discard them (destroy may RST), which would leave the
        // instance "ready" and frozen -- the exact outcome the EXIT exists to
        // prevent. The resume is best-effort in its OUTCOME, though: a failed
        // resume must not turn a READY instance into a not-ready one, since the
        // emulator demonstrably answered, which is what this function reports on.
        try {
          socket.end(binmonRequest(BINMON_CMD_EXIT, BINMON_PROBE_REQUEST_ID + 1), () => finish(true));
        } catch {
          finish(true);
        }
        return;
      }
    });
  });
}

/** D-05, AS AMENDED BY P-05 -- this comment is the amendment's record, kept
 * in the exact place a three-branch description used to sit, per this
 * plan's own instruction that a code reader must meet the amendment here,
 * not merely in the plan text (`01.6.2.1-02-PLAN.md`) or the validation
 * ledger (`01.6.2-VALIDATION.md`, consolidated by plan 06).
 *
 * D-05 (locked, `01.6.2-CONTEXT.md`) originally specified the probe as a
 * bare in-process TCP connect to the instance's own monitor port, with a
 * short timeout. The code that landed instead argued against that wording,
 * in its OWN comment: "a bare TCP accept is explicitly not sufficient (a
 * C64 can accept a connection before it has finished booting)" -- a
 * booting emulator promoted to ready on nothing more than an accepted
 * connection is exactly Defect 3's failure shape reappearing, here on the
 * plan-01 acquire hot path.
 *
 * P-05 amends D-05: the ping-shaped request body stays -- it is what
 * proves the emulator ANSWERS, not merely that a port is bound, which is
 * the whole difference between a liveness check and a readiness check. The
 * two OTHER branches the landed code carried (an external-command
 * mechanism, and a "neither mechanism available -> report ready
 * unconditionally" fallback) retire outright, per P-06: with no second
 * mechanism to prefer and no "no mechanism" state left to report, there is
 * no longer a pair of indistinguishable states (a deliberately-zero warm
 * floor and a broken host) for an operator to confuse in the logs. D-05's
 * own intent -- exactly one check, no external command, no ambiguity -- is
 * fully honoured by this collapse, not reversed by it.
 *
 * No retry loop, deliberately: a still-booting instance simply fails THIS
 * pass and is re-probed on the next one (maintainWarmFloor()'s own per-pass
 * cadence, or a later grant-time re-probe) -- this is what makes the
 * shortened ~1s default below safe rather than reckless: a slow host is
 * re-probed, never starved, and the seconds-valued timeout knob
 * (VICE_BROKER_PROBE_TIMEOUT_S) still lets an operator on a slow host raise
 * it. */
export async function probeReady(port: number, deps: ProbeDeps = {}): Promise<boolean> {
  const timeoutS = Number(deps.probeTimeoutSEnv ?? process.env.VICE_BROKER_PROBE_TIMEOUT_S) || DEFAULT_PROBE_TIMEOUT_S;
  const timeoutMs = timeoutS * 1000;
  // WR-01: the route is chosen by the backend, exactly like buildViceArgs()'s
  // own argv choice, and from the SAME threaded-down verdict. The fork arm below
  // is byte-identical to what this function always did, including the
  // omitted-backend default -- a fork deployment sees no behaviour change.
  if (deps.backend === "stock") {
    const binmonProbe = deps.binmonProbe ?? defaultBinmonProbe;
    return binmonProbe(port, timeoutMs);
  }
  const httpProbe = deps.httpProbe ?? defaultHttpProbe;
  return httpProbe(port, timeoutMs);
}

// ---------------------------------------------------------------------------
// Serialised warm-floor maintenance
// ---------------------------------------------------------------------------

function resolveWarmFloor(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_WARM_FLOOR;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

function resolveCeiling(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_MAX;
  if (raw === undefined || raw === "") return 16;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 16;
}

export interface MaintainWarmFloorDeps {
  state: BrokerState;
  /** Root state directory -- per-port supervisorDir/epochFile are derived
   * from this exactly like handleAcquire's own cold-launch path does. */
  stateDir: string;
  /** I-1 rider (08.2-06-PLAN.md, Task 1): widened to the same optional
   * third `options` argument as TryLaunchDeps.spawn above, so a real
   * warm-floor launch can thread the same scratch `XDG_CONFIG_HOME`
   * through as the cold-acquire arm. Optional, so every pre-existing
   * 2-arg caller and test stub keeps compiling and behaving identically. */
  spawn?: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  /** Alternative to `spawn` -- when both are given, spawnFactory wins.
   * Receives the ALLOCATED port directly (no need to parse it back out of
   * an argv array) so a caller can open a per-port log file BEFORE
   * spawning -- exactly what vice-broker.mts's real wiring needs for
   * D-23's forensic per-instance logs, mirroring handleAcquire's own
   * cold-launch path. Widened (08.2-06-PLAN.md, Task 1) to the same
   * optional third options argument as `spawn` above. */
  spawnFactory?: (port: number) => (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  now?: () => number;
  viceBin?: string;
  mcpHost?: string;
  /** See TryLaunchDeps's own doc comment -- same optional, same
   * fork-when-omitted default, threaded through to acquirePortAndLaunch(). */
  backend?: ViceBackend;
  binmonHost?: string;
  /** Probes a PORT (not a full InstanceRecord) -- defaults to a thin call
   * into probeReady() above with no overrides. */
  probe?: (port: number) => Promise<boolean>;
  /** VICE_BROKER_WARM_FLOOR override -- default 1 (D-06, landed
   * 01.6.2.1-03-PLAN.md), down from the tracer-era default of 3. The knob
   * itself keeps working unchanged: an explicitly configured N still
   * overrides this default exactly as before, so the 2026-08-02
   * host-validation run stays reproducible with no code change. The
   * variable's retired predecessor name was renamed away in this same plan
   * (D-10/D-11, 01.6.2.1-05-PLAN.md) -- no alias, no fallback read of the
   * old name. */
  warmFloor?: number;
  /** VICE_BROKER_MAX override -- default 16, untouched by this phase. */
  ceiling?: number;
  log?: (line: string) => void;
  /** REQUIRED, injected -- broker-state.mts's real nextFreePort()/
   * countReady()/countTotal()/countLaunching(), threaded in by the caller
   * rather than imported as values here (see this file's own header
   * comment on why: a runtime VALUE import of a sibling host-bound module
   * only resolves once both are compiled, which breaks this module's own
   * ability to run unbuilt under its unit tests). vice-broker.mts's real
   * wiring passes broker-state.mjs's actual exports; tests inject stubs. */
  allocatePort: (state: BrokerState) => Promise<PortAllocationResult>;
  /** Plan 03-04 (DIRECT-06, D-13): same optional field and the same
   * gate-inside-acquirePortAndLaunch() contract as
   * AcquirePortAndLaunchDeps's own field of this name -- threaded straight
   * through to the warm arm's own acquirePortAndLaunch() call below.
   * Omitted entirely (every pre-Phase-3 caller) means no second port is
   * ever requested for a warm launch, exactly like the cold arm. */
  allocateRemoteMonitorPort?: (state: BrokerState, exclude: ReadonlySet<number>) => Promise<PortAllocationResult>;
  countReady: (state: BrokerState) => number;
  countTotal: (state: BrokerState) => number;
  countLaunching: (state: BrokerState) => number;
  /** Called once, synchronously, right after a successful warm launch --
   * vice-broker.mts's real wiring hooks this to write the instance's
   * epoch.json (broker-epoch.mts), exactly like handleAcquire's cold path
   * already does. Kept as a callback rather than importing broker-epoch.mjs
   * directly here, for the same reason this module avoids importing
   * broker-state.mjs's values: this module's own tests run it unbuilt. */
  onLaunched?: (record: InstanceRecord) => void;
}

/** Promotes launching instances via probe, then -- unless a launch is
 * already in flight -- launches AT MOST ONE instance toward the warm floor
 * and returns. Never loops to reach the floor in one call: reaching
 * VICE_BROKER_WARM_FLOOR this way costs one
 * additional CALL per warm instance instead of one call total, which is the exact
 * trade the 2026-08-01 outage made non-negotiable (three simultaneous
 * x64sc launches: one SEGV, one exit 1, one exit 0 at the identical spawn
 * second). `async`/`await` makes launching everything needed in one go
 * look free and idiomatic; it is actively dangerous here. DO NOT gather
 * several pending launches into a single concurrent await, and do not
 * "helpfully" loop this function internally until the floor is met.
 *
 * D-05's probe-live floor evaluation (count_ready() trusting probe-live
 * instances rather than a recorded `ready` state) is explicitly Phase
 * 01.6.2.1's criterion L, NOT this plan's -- countReady() here still
 * counts by RECORDED state, exactly like the bash original's count_ready()
 * before Decision 5.2. A reviewer must not mistake this for an oversight:
 * it is the declined-for-this-phase choice RESEARCH.md §A1 recommends, and
 * grant_from_spare()'s own live re-probe at GRANT time (broker-kill.mts /
 * plan 04's territory) is a separate, already-correct mechanism this plan
 * does not touch. */
export async function maintainWarmFloor(deps: MaintainWarmFloorDeps): Promise<void> {
  const log = deps.log ?? defaultLog;
  const now = deps.now ?? ((): number => Date.now());
  // WR-01: the DEFAULT probe follows this call's own backend, so a caller that
  // threads `backend` for the launch argv and omits `probe` gets a matching
  // readiness route rather than an HTTP POST at a binary-monitor port. An
  // explicitly injected `probe` still wins, unchanged.
  const probe = deps.probe ?? ((port: number) => probeReady(port, { backend: deps.backend ?? "fork" }));

  // Step 1: promote every "launching" instance whose probe now succeeds.
  // Runs regardless of whether a launch is in flight -- promotion and
  // speculative warming are independent concerns; an already-launched
  // instance becomes usable the moment it answers, whether or not this
  // pass goes on to warm anything further.
  for (const record of deps.state.instances.values()) {
    if (record.state !== "launching") continue;
    const isReady = await probe(record.port);
    if (isReady) {
      const readyAt = now();
      const elapsedMs = readyAt - record.launchedAt;
      record.state = "ready";
      record.readyAt = readyAt;
      log(`vice-broker: port ${record.port} launching -> ready (${elapsedMs}ms)`);
    }
  }

  // Step 2 (P-06: the warm-zero "no readiness mechanism" branch that used
  // to sit here is GONE -- the surviving probe mechanism is in-process and
  // always available, so there is no "no mechanism" state left to warm
  // zero against). No new boot starts while one is already under way --
  // THE single in-flight counter (countLaunching) both this function and a
  // cold acquire (vice-broker.mts's handleAcquire) consult.
  if (deps.countLaunching(deps.state) > 0) {
    // D-07's launch-slot decision log line, this decision point's own half:
    // name WHICH reason currently holds the slot (the launching record's
    // own `reason`, whichever call produced it -- cold acquire or an
    // earlier warming pass), not merely that warming is waiting.
    const inFlightRecord = Array.from(deps.state.instances.values()).find((r) => r.state === "launching");
    const winningReason = inFlightRecord?.reason ?? "unknown";
    log(`vice-broker: launch-slot decision -- ${winningReason} holds the slot; spare waits (D-07)`);
    return;
  }

  const ready = deps.countReady(deps.state);
  const total = deps.countTotal(deps.state);
  const warmFloor = resolveWarmFloor(deps.warmFloor);
  const ceiling = resolveCeiling(deps.ceiling);

  if (!(ready < warmFloor && total < ceiling)) {
    return;
  }

  // acquirePortAndLaunch() holds the SAME single in_flight owner across
  // its own async port allocation -- not merely tryLaunchOne()'s
  // synchronous spawn instant. This is what actually closes the race
  // between this warm-floor launch and a cold acquire (vice-broker.mts's
  // handleAcquire) arriving over the TCP control listener at any moment:
  // the countLaunching() check just above is a cheap PRE-check (bails
  // early when a launch is already recorded), but nextFreePort() is
  // itself asynchronous, so without the guard held across the allocation
  // too, two overlapping callers could still both be told the same
  // candidate port is free before either commits it.
  const result = await acquirePortAndLaunch("spare", {
    state: deps.state,
    stateDir: deps.stateDir,
    allocatePort: deps.allocatePort,
    allocateRemoteMonitorPort: deps.allocateRemoteMonitorPort,
    spawn: deps.spawn,
    spawnFactory: deps.spawnFactory,
    now: deps.now,
    viceBin: deps.viceBin,
    mcpHost: deps.mcpHost,
    backend: deps.backend,
    binmonHost: deps.binmonHost,
  });

  if (result.ok) {
    log(`vice-broker: warmed 1 warm instance this pass -- ${ready + 1} of ${warmFloor} ready, remainder warmed on later passes`);
    deps.onLaunched?.(result.record);
  } else if (result.reason === "no_free_port") {
    log(`vice-broker: no free port available -- warming no further warm instances; ${ready} of ${warmFloor} ready`);
  } else {
    // A launch started (cold or warm) between this function's own
    // countLaunching() check above and this call -- a narrow window
    // closed by the guard rather than assumed impossible.
    log("vice-broker: a warm-floor launch was attempted but a launch was already in flight -- deferring to a later pass");
  }
}

// ---------------------------------------------------------------------------
// The fixed-order evaluation pass
// ---------------------------------------------------------------------------

export interface BrokerPassDeps {
  /** Serves pending acquires for this pass. Under this phase's TCP control
   * plane (plan 01), an acquire is already served immediately, per
   * connection, by vice-broker.mts's own onAcquire callback -- there is no
   * file-based request queue left to iterate (D-01). This concern stays a
   * named, orderable step (rather than being dropped) because plan 05 adds
   * the real arrival-ordered queue (D-08) here; until then it is a no-op
   * by construction, not a stub standing in for missing work. */
  serveAcquires: () => Promise<void> | void;
  maintainWarmFloor: () => Promise<void> | void;
}

/** The fixed pass order (mirrors vice-broker.sh's own broker_once(), whose
 * comment names the ordering as load-bearing: "the spare invariant is
 * always re-evaluated against the freshest possible grant/teardown
 * state"). The bash version's third concern, the grant sweep, does NOT
 * appear here -- it is one of criterion F's six retiring file-lease
 * mechanisms; the TCP connection itself is the lease (D-12). The
 * broker-instances.json projection write does not appear either, per D-24
 * (see broker-state.mts's own FINDING 2 comment). Takes plain callbacks
 * rather than the full BrokerState/deps shape so a test can inject two
 * instrumented no-op functions and assert call ORDER without needing a
 * real broker, a real port or a real launch.
 *
 * D-07 (01.6.2.1-03-PLAN.md): THIS is where launch priority actually lives
 * -- serving acquires before maintaining the warm floor is what lets a
 * request-driven launch win a freed slot before a warming launch, within
 * one pass, on top of the single in-flight owner (acquirePortAndLaunch()'s
 * own invariant comment) that this order never weakens. Inverting this
 * order lets a warming launch take the slot first and go untested against
 * a concurrently arriving acquire, which is exactly the regression
 * broker-launch.test.ts's own D-07 priority test is written to catch (its
 * own discriminating-power demonstration inverts this exact order and
 * observes the test go red). Priority decides only which reason wins the
 * NEXT freed slot -- it is never a substitute for the lock, and it never
 * kills or abandons whichever boot is already in flight. */
export async function runBrokerPass(deps: BrokerPassDeps): Promise<void> {
  await deps.serveAcquires();
  await deps.maintainWarmFloor();
}

// ===========================================================================
// Per-child supervision (Plan 03, Task 2 -- C2/D-23): absorbs
// resources/vice-supervisor.sh WHOLESALE. The respawn loop becomes an
// exit-event handler installed on the spawned child; the backoff shape
// (initial delay, doubling, ceiling), the crash-loop give-up (too many
// crashes inside a window), and the per-instance boot/crash log are ported
// exactly, per D-1's own configuration knobs -- VICE_RESTART_BACKOFF_S,
// VICE_RESTART_BACKOFF_MAX_S, VICE_MAX_RESTARTS, VICE_CRASH_WINDOW_S all
// keep their exact names and semantics.
// ===========================================================================

function resolveMs(envVar: string, defaultSeconds: number, override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env[envVar];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return (Number.isFinite(n) ? n : defaultSeconds) * 1000;
}

function resolveCount(envVar: string, defaultValue: number, override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env[envVar];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

/** The four-value outcome vocabulary a single exit event resolves to --
 * exported so a caller (this module's own tests, and any future real-broker
 * wiring) can assert which branch a given crash took without inspecting
 * private state. */
export type RespawnOutcome = "respawned" | "deliberate_teardown" | "given_up" | "recycled";

/** broker-epoch.mts's own exports, injected rather than value-imported --
 * see this file's own header comment for why (the same unbuilt-test-import
 * constraint plan 02 already solved for broker-state.mts's exports). The
 * real broker wires broker-epoch.mjs's actual functions here; tests inject
 * broker-epoch.mts's REAL functions via a direct source import (safe for a
 * test file) or their own stubs. */
export interface EpochWriterDeps {
  epochPathFor: (stateDir: string, port: number) => string;
  instanceLogDirFor: (stateDir: string, port: number) => string;
  nextEpochFor: (supervisorDir: string) => number;
  writeEpochRecord: (opts: { supervisorDir: string; record: EpochRecord }) => string;
}

export interface SuperviseChildDeps {
  state: BrokerState;
  /** Root state directory -- per-port supervisorDir/epochFile/logDir are
   * all derived from this, exactly like every other launch path. */
  stateDir: string;
  epoch: EpochWriterDeps;
  /** I-1 rider (08.2-06-PLAN.md, Task 1): widened to the same optional
   * third `options` argument as every other spawn/spawnFactory field in
   * this file, so a real crash-respawn threads the same isolation as the
   * launch it replaces (CR-01 precedent: launch/respawn divergence has
   * already caused one incident in this file). */
  spawn?: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  spawnFactory?: (port: number) => (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  now?: () => number;
  /** Injected delay for the respawn backoff wait -- tests supply an
   * immediately-resolving stub so the backoff VALUES can be asserted
   * against the injected clock, never real wall time (this project's own
   * stack pattern: synchronise on injected time, never sleep()). */
  sleepMs?: (ms: number) => Promise<void>;
  viceBin?: string;
  mcpHost?: string;
  /** See TryLaunchDeps's own doc comment -- same optional, same
   * fork-when-omitted default, threaded through to tryLaunchOne(). */
  backend?: ViceBackend;
  binmonHost?: string;
  /** VICE_RESTART_BACKOFF_S override, in MILLISECONDS (the env var itself
   * stays seconds, matching the retiring supervisor exactly). */
  initialBackoffMs?: number;
  /** VICE_RESTART_BACKOFF_MAX_S override, in milliseconds. */
  maxBackoffMs?: number;
  /** VICE_MAX_RESTARTS override. */
  maxRestarts?: number;
  /** VICE_CRASH_WINDOW_S override, in milliseconds. */
  crashWindowMs?: number;
  log?: (line: string) => void;
  /** Test/observability hook -- fired once per exit event, after this
   * module has fully resolved the outcome (state already updated). Never
   * consulted for behaviour by this module itself. */
  onOutcome?: (outcome: RespawnOutcome, port: number) => void;
}

/** The exit-driven respawn step. Reads the JUST-crashed record (still in
 * state.instances -- nothing here deletes it before this runs), decides
 * among the four outcomes, and acts:
 *
 * - deliberateKill set AND respawnAfterKill set -> "recycled": a
 *   broker-ordered death that wants a replacement, relaunched on the SAME
 *   port through launchSupervised() -- but called DIRECTLY, bypassing every
 *   crash-accounting step below (no appended crash timestamp, no give-up
 *   evaluation, no backoff wait, no doubling): a deliberate recycle is not
 *   evidence of instability, and the crash-loop machinery exists for an
 *   UNEXPLAINED exit, not this one. The pre-kill crash history and backoff
 *   are carried forward UNCHANGED, and a pre-kill "granted" state is
 *   restored on the fresh record -- the relaunch primitive always creates a
 *   new record in the "launching" state, and leaving it there would let the
 *   warm floor's own ready-count numerator mistake a recycled session's own
 *   machine for an available warm instance.
 * - deliberateKill set WITHOUT respawnAfterKill -> "deliberate_teardown":
 *   drop the instance, no respawn. This is T-01.6.2-21's whole point --
 *   without reading this flag, every deliberate teardown would respawn
 *   exactly what it just killed, silently breaking kill-never-recycle (a
 *   released instance must be killed and stay gone).
 * - crash count (this instance's crash timestamps still inside the window,
 *   INCLUDING this one) at or above the configured maximum ->
 *   "given_up": drop the instance, log a line naming it and the count.
 *   Mirrors vice-supervisor.sh's own `>= VICE_MAX_RESTARTS` check exactly
 *   (T-01.6.2-20).
 * - otherwise -> "respawned": wait the CURRENT backoff (from the crashed
 *   record, so the doubling carries forward across respawns), then relaunch
 *   through launchSupervised() below -- the SAME tryLaunchOne() primitive
 *   plan 02 established, with the crash history and the NEXT (doubled,
 *   clamped) backoff threaded into the new record. */
async function handleExit(reason: string, port: number, deps: SuperviseChildDeps): Promise<void> {
  const record = deps.state.instances.get(port);
  if (!record) {
    // Already gone by some other path (e.g. a release that removed the
    // instance outright rather than merely marking it) -- nothing to do.
    return;
  }

  const log = deps.log ?? defaultLog;

  // Plan 05 (BROK-02/PROTO-08): the process behind this instance's monitor
  // socket has just exited, by every path this function can take (crash,
  // recycle, or a deliberate teardown) -- clear the ownership record HERE,
  // once, before any of those paths branch, so a client that died without
  // releasing can never hold this lock forever. Redundant with the
  // respawn/delete paths below (a fresh InstanceRecord never carries this
  // field forward; a deleted one has no field to carry), but explicit for
  // the same reason broker-state.mts's own header comment names this as one
  // of the three required clearing sites. Assigned directly (not via
  // broker-state.mjs's clearMonitorClient()) -- this module's own
  // type-only import of that sibling (see this file's own header comment a
  // few lines above) is load-bearing: a VALUE import would turn "./broker-
  // state.mjs" into a real runtime resolution this file cannot satisfy when
  // loaded directly (as broker-launch.test.ts does), rather than the
  // compiled resources/ sibling this specifier is actually shaped for.
  record.monitorClient = undefined;

  if (record.deliberateKill) {
    if (record.respawnAfterKill) {
      // Recycle. Capture the pre-kill state, crash history and backoff
      // BEFORE launchSupervised() replaces the map entry at this port key
      // with a brand new InstanceRecord -- nothing about those three facts
      // survives once that overwrite happens.
      const preKillState = record.state;
      const preKillCrashTimes = record.crashTimes ?? [];
      const preKillBackoffMs = record.backoffMs ?? resolveMs("VICE_RESTART_BACKOFF_S", 3, deps.initialBackoffMs);
      // CR-02 (03-REVIEW.md): the second (`-remotemonitor`) port is carried
      // forward across the replacement exactly like the primary port is --
      // captured BEFORE launchSupervised() overwrites this port's map entry
      // with a brand new record, for the same reason the three values above
      // are.
      const preKillRemoteMonitorPort = record.remoteMonitorPort;

      const respawned = launchSupervised(reason, port, deps, preKillCrashTimes, preKillBackoffMs, preKillRemoteMonitorPort);
      if (respawned && preKillState === "granted") {
        respawned.state = "granted";
      }
      // Keep the matching grant's own recorded pid in sync with the
      // respawned record's pid -- the ONE legitimate case where the SAME
      // grant continues to own a DIFFERENT pid on the SAME port. Without
      // this, vice-broker.mts's handleRelease() own grant-pid identity
      // check (T-01.6.2.1-28) would misfire and refuse to tear down the
      // very instance the grant now legitimately owns.
      if (respawned) {
        for (const grant of deps.state.grants.values()) {
          if (grant.port === port) {
            grant.pid = respawned.pid;
          }
        }
      }
      deps.onOutcome?.("recycled", port);
      return;
    }
    // CR-02: a deliberate teardown is the END of this instance -- its
    // remote-monitor port must go back to the allocator with it.
    deleteInstanceRecord(deps.state, port);
    deps.onOutcome?.("deliberate_teardown", port);
    return;
  }

  const now = deps.now ?? ((): number => Date.now());
  const nowMs = now();
  const crashWindowMs = resolveMs("VICE_CRASH_WINDOW_S", 120, deps.crashWindowMs);
  const crashTimes = [...(record.crashTimes ?? []), nowMs].filter((t) => nowMs - t <= crashWindowMs);

  const maxRestarts = resolveCount("VICE_MAX_RESTARTS", 5, deps.maxRestarts);
  if (crashTimes.length >= maxRestarts) {
    log(
      `vice-broker: giving up on port ${port} after ${crashTimes.length} crashes within ${crashWindowMs}ms -- ` +
        `this is not a transient crash; check VICE_ARGS and whether the port is already bound`,
    );
    // CR-02: giving up is likewise terminal for this instance -- release its
    // remote-monitor port rather than leaking it out of the allocation band.
    deleteInstanceRecord(deps.state, port);
    deps.onOutcome?.("given_up", port);
    return;
  }

  const sleepMs = deps.sleepMs ?? ((ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms)));
  const currentBackoffMs = record.backoffMs ?? resolveMs("VICE_RESTART_BACKOFF_S", 3, deps.initialBackoffMs);
  await sleepMs(currentBackoffMs);

  const maxBackoffMs = resolveMs("VICE_RESTART_BACKOFF_MAX_S", 30, deps.maxBackoffMs);
  const nextBackoffMs = Math.min(currentBackoffMs * 2, maxBackoffMs);

  // CR-02: same carry-forward as the recycle branch above -- a crash must not
  // silently strip `-remotemonitor` (and its InstanceRecord field) off the
  // replacement, which is what made D-13's "the instance record carries it"
  // stop being true the first time an instance was replaced.
  const respawned = launchSupervised(reason, port, deps, crashTimes, nextBackoffMs, record.remoteMonitorPort);
  deps.onOutcome?.(respawned ? "respawned" : "given_up", port);
}

/** The single exit-listener installation point in the whole module tree.
 * Wraps `baseSpawn` (a plain spawn function of the same shape
 * `(command, args, options?) => ChildProcess` every launch path already
 * threads through -- the third `options` argument is load-bearing: it
 * carries the scratch XDG_CONFIG_HOME that isolates a stock launch from the
 * operator's real vicerc, and this wrapper MUST forward it) so the returned
 * spawn function, when called, attaches a
 * one-shot "exit" listener that drives handleExit() above -- the SAME
 * respawn/give-up/deliberate-teardown resolution launchSupervised()'s own
 * relaunch path already uses. Returns the child object baseSpawn produced,
 * UNCHANGED -- a caller's own handle to the child (e.g. its pid) is never
 * replaced or wrapped itself; only the spawn FUNCTION is composed.
 *
 * This is the extraction the phase's own gap closure exists to make: before
 * this function existed, launchSupervised() built this exact listener
 * inline, and it was the ONLY place in the tree that ever did -- both real
 * launch paths in vice-broker.mts instead spawned through a bare,
 * unwrapped spawn with no exit observation at all. Composing a real launch
 * path's own spawn factory through THIS function, rather than reaching for
 * a second inline listener, is what keeps the "exactly one installation
 * point" invariant a structural gate (broker-launch.test.ts) can hold. */
export function withCrashSupervision(
  reason: string,
  port: number,
  baseSpawn: (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess,
  deps: SuperviseChildDeps,
): (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess {
  // I-1 rider (08.2-06-PLAN.md, Task 1): forwards a third options argument
  // in the BODY, not just the type -- this is the hop that matters most,
  // because it wraps every real launch path (cold acquire, warm floor, and
  // every respawn). A type-only widening would still silently drop a
  // caller's options at this call site.
  return (cmd: string, args: string[], options?: SpawnOptionsWithoutStdio): ChildProcess => {
    const child = baseSpawn(cmd, args, options);
    child.once("exit", () => {
      void handleExit(reason, port, deps);
    });
    return child;
  };
}

/** Launches (or relaunches) a supervised instance: spawns through
 * tryLaunchOne() (the SAME single guarded primitive plan 02 established --
 * "spawn again through the SAME single guarded launch function", never a
 * second, parallel spawn path), writes the per-instance boot/crash log at
 * the path shape the retiring supervisor used (a `logs/` directory under
 * the instance directory, named for the binary and a timestamp -- derived
 * from broker-epoch.mts's instanceLogDirFor so this file and the epoch
 * record's own `log` field can never disagree), bumps the epoch through
 * the epoch writer (broker-epoch.mts's nextEpochFor + writeEpochRecord),
 * and installs the exit handler that drives the NEXT crash's outcome.
 *
 * crashTimes/backoffMs are threaded through explicitly (not reset to
 * defaults) so a respawn's crash history and doubling backoff survive the
 * fact that spawnAndRecordInstance() creates a BRAND NEW InstanceRecord
 * object on every launch, replacing the old one at the same port key.
 *
 * CR-02 (03-REVIEW.md): `remoteMonitorPort` is threaded the SAME way and for
 * the same reason -- it belongs to the instance, not to a single spawn of it.
 * The replacement reuses the port the crashed/recycled process just vacated
 * (already reserved in `state.blockedPorts`, so nothing else can have taken it
 * meanwhile), exactly as it reuses the primary `port` argument; this function
 * stays fully synchronous and never allocates. `undefined` is the correct
 * value for a FIRST launch through superviseChild() and for every fork launch,
 * which is why the parameter is optional. */
function launchSupervised(
  reason: string,
  port: number,
  deps: SuperviseChildDeps,
  crashTimes: number[],
  backoffMs: number,
  remoteMonitorPort?: number,
): InstanceRecord | null {
  const supervisorDir = join(deps.stateDir, String(port));
  const epochFile = deps.epoch.epochPathFor(deps.stateDir, port);
  const logDir = deps.epoch.instanceLogDirFor(deps.stateDir, port);
  mkdirSync(logDir, { recursive: true });

  const epoch = deps.epoch.nextEpochFor(supervisorDir);
  const viceBin = deps.viceBin ?? process.env.VICE_BIN ?? "x64sc";
  // Timestamp PLUS the epoch number: Date.now() alone can collide across
  // two respawns inside the same millisecond when the injected sleepMs
  // resolves immediately (exactly what this module's own tests do to stay
  // fast and deterministic) -- the epoch, guaranteed strictly increasing
  // per instance, makes every respawn's log filename distinct regardless
  // of wall-clock resolution.
  const logFileName = `${basename(viceBin)}-${Date.now()}-e${epoch}.log`;
  const logPath = join(logDir, logFileName);
  const logRelPath = `logs/${logFileName}`;

  // I-1 rider (08.2-06-PLAN.md, Task 1): forwards a third options argument
  // and MERGES it with the per-instance log stdio -- caller options
  // spread FIRST, `stdio` set LAST, so the per-instance log fd always
  // wins. Never the other order: a caller-supplied `stdio` would silently
  // redirect a crash-respawn's output away from the log file the epoch
  // record names, and the forensic per-instance log (D-23) would point at
  // a file that received nothing. Without this fix, a stock instance that
  // crashes and respawns comes back reading the operator's real `vicerc`
  // even though its original launch was isolated.
  const defaultRealSpawn = (cmd: string, args: string[], options?: SpawnOptionsWithoutStdio): ChildProcess => {
    const fd = openSync(logPath, "a");
    return nodeSpawn(cmd, args, { ...options, stdio: ["ignore", fd, fd] });
  };
  const baseSpawn = deps.spawnFactory ? deps.spawnFactory(port) : (deps.spawn ?? defaultRealSpawn);
  const wrappedSpawn = withCrashSupervision(reason, port, baseSpawn, deps);

  const record = tryLaunchOne(reason, port, {
    state: deps.state,
    supervisorDir,
    epochFile,
    spawn: wrappedSpawn,
    now: deps.now,
    viceBin: deps.viceBin,
    mcpHost: deps.mcpHost,
    backend: deps.backend,
    binmonHost: deps.binmonHost,
    remoteMonitorPort,
    log: deps.log,
  });
  if (!record) return null;

  // The log file's EXISTENCE and the epoch record's `log` field naming it
  // must never disagree, regardless of which spawn implementation actually
  // produced output -- a test-injected stub child never writes through
  // defaultRealSpawn's own fd, so this touches the file into existence
  // when nothing else has.
  if (!existsSync(logPath)) {
    closeSync(openSync(logPath, "a"));
  }

  record.epoch = epoch;
  record.deliberateKill = false;
  record.crashTimes = crashTimes;
  record.backoffMs = backoffMs;
  record.logPath = logPath;

  deps.epoch.writeEpochRecord({
    supervisorDir,
    record: {
      epoch,
      spawned_at: new Date(record.launchedAt).toISOString(),
      pid: record.pid as number,
      supervisor_pid: process.pid,
      vice_bin: record.viceBin,
      vice_args: record.viceArgs,
      log: logRelPath,
      dry_run: false,
    },
  });

  return record;
}

/** The public entry point: launches a NEW instance under full supervision
 * (crash respawn with backoff, crash-loop give-up, kill-never-recycle via
 * the deliberate-kill marker, and the per-instance boot/crash log), exactly
 * mirroring resources/vice-supervisor.sh's own respawn loop but expressed
 * as an event-loop exit handler instead of a `while true` poll. */
export function superviseChild(reason: string, port: number, deps: SuperviseChildDeps): InstanceRecord | null {
  const initialBackoffMs = resolveMs("VICE_RESTART_BACKOFF_S", 3, deps.initialBackoffMs);
  return launchSupervised(reason, port, deps, [], initialBackoffMs);
}
