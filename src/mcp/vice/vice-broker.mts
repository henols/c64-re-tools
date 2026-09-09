// vice-broker.mts
//
// The long-lived host broker entry point (Phase 01.6.2). Extends the Phase
// 01.6 tracer in place rather than replacing it: parseArgs(),
// readBrokerRecordMaybe() and the atomic tmp-sibling-then-rename write
// discipline all survive; main() grows a real control listener, a
// heartbeat and a real acquire/release path spawning a real child.
//
// heartbeat_at is now MANDATORY, refreshed on a recurring timer for as long
// as this process lives. The tracer's own header comment used to forbid it
// ("DELIBERATELY OMITS heartbeat_at") because a heartbeat-less record from a
// write-once tracer that immediately exits would strand every later
// session's readBrokerLiveness() classification at never_started forever.
// That reasoning does not apply here: this broker is genuinely long-lived,
// so omitting heartbeat_at would instead make a REAL, RUNNING broker read
// as never_started -- exactly the failure this field exists to prevent.
//
// Imports node: builtins ONLY plus this phase's own sibling modules --
// mcp__vice__* stays the only route to the emulator; nothing here opens a
// connection to it.
import { readFileSync, mkdirSync, openSync, writeFileSync, chmodSync, renameSync } from "node:fs";
import { join, basename, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptionsWithoutStdio } from "node:child_process";

import { containerGuardReport, containerGuardEnforce } from "./container-guard.mjs";
// Plan 41-05 (folded todo): countReady/countTotal/countLaunching are DROPPED
// from this import -- they were used only as maintainWarmFloorForRealBroker()'s
// own deps for the now-retired maintainWarmFloor(), passed through by
// shorthand property (`countReady,` etc.), never called directly in this
// file. atCapacity() is the one survivor actually called here (its own
// cold-launch-arm gate, below).
import {
  createBrokerState,
  nextFreePort,
  atCapacity,
  resolveBasePort,
  clearMonitorClient,
  type BrokerState,
  type InstanceRecord,
  type PortAllocationResult,
  type MonitorChannel,
} from "./broker-state.mjs";
import {
  acquirePortAndLaunch,
  deleteInstanceRecord,
  // Plan 41-05 (folded todo): replaces maintainWarmFloor -- the warm floor
  // itself is retired; this is ONLY the launching -> ready promotion sweep
  // the floor used to carry as its own step 1.
  promoteLaunchingInstances,
  probeReady,
  runBrokerPass,
  withCrashSupervision,
  type SuperviseChildDeps,
  // Phase 33, plan 33-06 (D-15): IMPORTED, never redeclared -- broker-launch.mts
  // is the one definition of the profile shape, and it is the module that turns
  // a profile into argv. A second local shape here would let the eligibility
  // rule and the argv builder disagree about what a profile even is.
  type LaunchProfile,
} from "./broker-launch.mjs";
// Plan 02-07: resolvedBackend() is now the ONE reader of VICE_BACKEND in
// this tree -- ViceBackend's own definition moved to backend-detect.mts too,
// so broker-launch.mjs's own (type-only) re-import of it and this file's
// VALUE import both name the same one home. A real value import is safe
// here (unlike inside broker-launch.mts) because vice-broker.mts is ALWAYS
// run from its own compiled resources/ form -- both modules are compiled
// together in the same build.ts pass, so "./backend-detect.mjs" always
// exists as a real sibling file by the time this import resolves.
import { resolvedBackend, type ViceBackend } from "./backend-detect.mjs";
import { verifiedKill, registerShutdownHandlers, startupBanner, reapOrphanedInstances, type KillStage } from "./broker-kill.mjs";
import { writeEpochRecord, epochPathFor, nextEpochFor, instanceLogDirFor, type EpochRecord } from "./broker-epoch.mjs";
// Phase 34, plan 34-01 (SEAM-01): a VALUE import of the host-tool executor --
// safe here for the SAME reason every other sibling value import above is:
// this file is ALWAYS run from its own compiled resources/ form, and
// "./host-tool.mjs" is compiled into that same directory by the same build.ts
// pass (host-tool.mts is added to HOST_BOUND_ARTIFACTS/tsconfig.build.json's
// include[] in this same commit).
import { runHostTool } from "./host-tool.mjs";
// Gap G-40-1, requirement R2 (plan 40-09): a VALUE import of the same
// handle-minting function for the SAME reason as the host-tool.mjs import
// immediately above -- this file is always run from its own compiled
// resources/ form, and "./ghidra-project.mjs" is compiled into that same
// directory by the same build.ts pass (both source and target are already
// listed in HOST_BOUND_ARTIFACTS, since plan 40-08 landed the module).
import { ensureGhidraRunsHandle } from "./ghidra-project.mjs";
import {
  startControlListener,
  newControlToken,
  drainPendingAcquires,
  resolveControlPort,
  type AcquireOutcome,
  type RecycleOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
} from "./broker-control.mjs";

export interface ParsedArgs {
  repoRoot: string;
  stateDir: string;
  checkContainer: boolean;
  dryRun: boolean;
}

const USAGE = "usage: vice-broker.mjs --repo-root <path> [--state-dir <path>] [--check-container] [--dry-run]";

/** `--repo-root` is required UNLESS `--check-container` is given -- the
 * container guard needs no paths at all, matching the bash launcher's own
 * `--check-container` handling (answered before any path resolution).
 * `--state-dir` defaults to VICE_POOL_DIR from the environment when set,
 * otherwise `.c64-re-tools/supervisor` under the repo root (moved 2026-09-08,
 * D-33 -- was `.vice-supervisor`; the three-tier chain itself -- explicit
 * `--state-dir`, then `VICE_POOL_DIR`, then this default -- is unchanged,
 * only the default's location moved). This module is host-bound and compiled
 * by `build.ts`, so it must not import the container-side `repo-root.ts`;
 * the two segments are joined directly, matching that file's `toolsDir()`. */
export function parseArgs(argv: string[]): ParsedArgs {
  let repoRoot: string | null = null;
  let stateDir: string | null = null;
  let checkContainer = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo-root") {
      repoRoot = argv[i + 1] ?? null;
      i++;
    } else if (argv[i] === "--state-dir") {
      stateDir = argv[i + 1] ?? null;
      i++;
    } else if (argv[i] === "--check-container") {
      checkContainer = true;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!checkContainer && !repoRoot) {
    throw new Error(USAGE);
  }

  const resolvedStateDir =
    stateDir ??
    process.env.VICE_POOL_DIR ??
    (repoRoot ? join(repoRoot, ".c64-re-tools", "supervisor") : join(".c64-re-tools", "supervisor"));

  return { repoRoot: repoRoot ?? "", stateDir: resolvedStateDir, checkContainer, dryRun };
}

// The final thirteen-field set (plan 05, D-27, G/K; NARROWED to thirteen by
// plan 41-05, folded todo): version, written_by, pid, started_at,
// heartbeat_at, node_version, control_host, control_port, control_token,
// max_instances, base_port, poll_ms, dry_run. The bash original's
// `ttl_seconds` field is DELETED, not merely renamed -- it is one of
// criterion F's six retiring lease mechanisms; the connection is the lease
// now, and keeping a TTL-shaped field here would advertise an authority that
// no longer exists. `warm_floor` is DELETED for the same reason (plan
// 41-05): a published field whose knob no longer exists is false
// documentation, not harmless residue -- there is no warm floor left to
// echo a configured value for. Every other bash config-echo field is kept
// even though no consumer parses it beyond a status message
// (readBrokerLiveness() reads only `pid` and `heartbeat_at`) -- a human
// reading this file by hand benefits from the full configuration echo,
// which is why the bash version carried it and why this port keeps it.
export interface BrokerRecord {
  version: number;
  written_by: string;
  pid: number;
  started_at: string;
  heartbeat_at: string;
  node_version: string;
  control_host: string;
  control_port: number;
  control_token: string;
  max_instances: number;
  base_port: number;
  poll_ms: number;
  dry_run: boolean;
}

/** The deployed JavaScript broker artifact's own name -- D-26's entire
 * point: this field used to read "vice-broker.sh" (the retiring bash
 * daemon), which was false the moment a real TypeScript broker existed.
 * It now names itself. */
export const WRITTEN_BY = "vice-broker.mjs";

// ---------------------------------------------------------------------------
// Small, locally-duplicated env-var reader (plan 05) -- the SAME pattern
// broker-kill.mts's own resolveBasePortForReap()/resolveViceBinForReap()
// already established: this module cannot import broker-launch.mts's
// PRIVATE resolveCeiling() (it is not exported, and this file is already
// the top-level wiring module value-importing every sibling .mjs directly --
// exporting it would widen broker-launch.mts's own surface for a one-line
// env-var read this file can duplicate exactly as cheaply). Mirrors
// broker-launch.mts's own default precisely (VICE_BROKER_MAX/16) so
// broker.json's config echo and host_state's own answer can never disagree
// with what atCapacity() itself actually enforces. Plan 41-05 (folded todo):
// this used to be a PAIR with resolveWarmFloorForRecord() (VICE_BROKER_WARM_
// FLOOR/1), kept in lockstep with broker-launch.mts's own matching pair
// (01.6.2.1-03-PLAN.md, D-06) so the two numbers could never disagree. The
// warm-floor half of that pair is RETIRED along with the floor itself -- the
// ceiling's own default (16) is untouched, since it is a separate concern
// (VICE_BROKER_MAX / atCapacity()) this plan does not touch.
// ---------------------------------------------------------------------------
function resolveCeilingForRecord(): number {
  const raw = process.env.VICE_BROKER_MAX;
  if (raw === undefined || raw === "") return 16;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 16;
}

function resolveViceBinForHostState(): string {
  return process.env.VICE_BIN ?? "x64sc";
}

/** Duplicates vice-broker-client.ts's readBrokerLiveness() classification
 * logic (never_started / stale / alive against BROKER_STALE_MS) rather than
 * importing it -- confirmed empirically (plan 02's own SUMMARY) that
 * importing vice-broker-client.ts into a HOST-BOUND module pulls its
 * transitive dependents (repo-root.ts, install-resources.ts, hostpath.ts)
 * into the SAME tsc build program, which either fails to compile under
 * tsconfig.build.json's allowImportingTsExtensions:false or forces those
 * container-side files to be committed under resources/ as if host-bound.
 * This is the SAME classification a test can drive the REAL
 * readBrokerLiveness() over (broker-control.test.ts does exactly that,
 * against records this function's own caller writes), proving the two never
 * diverge -- this module only needs the classification NAME (never_started
 * / stale / alive), never the pid/heartbeatAt fields readBrokerLiveness()
 * also returns. */
const BROKER_STALE_MS = Number(process.env.VICE_BROKER_STALE_MS || 180000);

function classifyBrokerLivenessLocal(path: string): "never_started" | "stale" | "alive" {
  const parsed = readBrokerRecordMaybe(path);
  if (parsed === null) return "never_started";
  const heartbeatAt = typeof parsed.heartbeat_at === "string" ? parsed.heartbeat_at : null;
  const heartbeatMs = heartbeatAt ? Date.parse(heartbeatAt) : NaN;
  if (!Number.isFinite(heartbeatMs)) return "never_started";
  return Date.now() - heartbeatMs > BROKER_STALE_MS ? "stale" : "alive";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read and parse a broker record, treating anything short of a
 * well-formed object as "not there yet" -- missing file, unreadable file,
 * partial write, malformed JSON, non-object shape. Never throws. */
export function readBrokerRecordMaybe(path: string): Record<string, unknown> | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Atomic tmp-sibling -> mode-tighten -> content -> rename, the same
 * choke-point discipline the tracer's own writeBrokerRecord() used, now
 * shared by both the initial write and every heartbeat refresh -- mode
 * stays owner-read-write on EVERY write, refresh included. */
function writeBrokerRecordFile(stateDir: string, record: BrokerRecord): string {
  mkdirSync(stateDir, { recursive: true });
  const finalPath = join(stateDir, "broker.json");
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, "");
  chmodSync(tmpPath, 0o600);
  writeFileSync(tmpPath, JSON.stringify(record, null, 2) + "\n");
  renameSync(tmpPath, finalPath);
  return finalPath;
}

/** Builds a spawn function that redirects the child's stdout/stderr into a
 * FRESH per-launch log file under logDir (D-23: per-instance boot/crash
 * logs survive under .c64-re-tools/supervisor/<port>/logs/, same paths, same
 * format as the retiring bash supervisor), returning both the spawn
 * closure and the log's path relative to supervisorDir (the epoch
 * record's own `log` field). Shared by both launch paths -- a cold
 * acquire and warm-floor maintenance -- so there is exactly one place that
 * opens a launch log fd.
 *
 * I-1 rider (08.2-06-PLAN.md, Task 2): the returned `spawn` now also
 * forwards a caller options object (audit item I-1), MERGING it into the
 * object handed to nodeSpawn() -- caller options spread FIRST, `stdio` set
 * LAST, so the launch log fd always wins over any caller-supplied `stdio`.
 * Merging in the other order would silently redirect a launch's output
 * away from the per-instance log file the epoch record names, breaking
 * D-23's forensic logs while appearing to work. */
function makeLoggingSpawn(logDir: string): { spawn: (cmd: string, args: string[], options?: SpawnOptionsWithoutStdio) => ReturnType<typeof nodeSpawn>; logRelPath: string } {
  mkdirSync(logDir, { recursive: true });
  const viceBinForLog = basename(process.env.VICE_BIN ?? "x64sc");
  const logName = `${viceBinForLog}-${Date.now()}.log`;
  const logFd = openSync(join(logDir, logName), "a");
  return {
    spawn: (cmd, cmdArgs, options) => nodeSpawn(cmd, cmdArgs, { ...options, stdio: ["ignore", logFd, logFd] }),
    logRelPath: `logs/${logName}`,
  };
}

/** Writes the epoch record for a just-launched instance -- shared by both
 * launch paths so D-04's contract (format, location, atomic-write
 * discipline, all unchanged -- only the writer moves) is discharged from
 * exactly one place regardless of WHY the instance was launched. A
 * granted instance and a still-warm instance are equally real processes; both
 * need a real epoch.json the moment they exist, or plan 04's grant-time
 * re-probe (which reads a warm instance's recorded epoch_file, per
 * grant_from_spare()'s bash original) would carry forward a path to
 * nothing. */
function writeEpochForLaunch(record: InstanceRecord, logRelPath: string): void {
  const epochRecord: EpochRecord = {
    epoch: 1,
    spawned_at: new Date(record.launchedAt).toISOString(),
    pid: record.pid as number,
    supervisor_pid: process.pid,
    vice_bin: record.viceBin,
    vice_args: record.viceArgs,
    log: logRelPath,
    dry_run: false,
  };
  writeEpochRecord({ supervisorDir: record.supervisorDir, record: epochRecord });
  // The in-memory record's own epoch field must carry the SAME value the
  // epoch record was just written with -- without this, every
  // first-generation instance reports an absent epoch to the status
  // response and an absent epoch-before in a recycle acknowledgement,
  // making a later respawn's advance unobservable at the one place a
  // caller reads it (handleStatus(), handleRecycleForRealBroker()).
  record.epoch = epochRecord.epoch;
}

/** Builds the supervision dependency object for withCrashSupervision(),
 * once per launch, so the real launch path (handleAcquire's own cold arm,
 * here -- plan 41-05 retires the second real launch path this comment used
 * to name, the warm floor) passes a structurally identical SuperviseChildDeps
 * object into the shared wrapper. Deliberately does
 * NOT set spawnFactory: on a respawn, launchSupervised() (broker-launch.mts)
 * derives its own per-instance log path from instanceLogDirFor and names
 * that same path in the epoch record it writes -- supplying a competing
 * spawn factory here would produce two log files per respawn with the
 * epoch record naming the wrong one. Leaving it unset means a respawn's
 * output lands in the supervision module's own log file under the same
 * per-instance logs directory D-23 requires, and the epoch record names
 * the file that actually received the output.
 *
 * CR-01 (03-REVIEW.md): `backend` is a REQUIRED positional parameter, not an
 * optional field a call site may quietly omit. Before this, both real call
 * sites built their deps here WITHOUT it, so `spawnAndRecordInstance()`'s own
 * `deps.backend ?? "fork"` default silently took over the moment crash
 * supervision replaced an instance -- a stock instance's crash-respawn or
 * `vice_recycle` relaunched it with the FORK's `-mcpserver` argv, which stock
 * upstream VICE does not understand at all, leaving a pool member that can
 * never be reached over the binary monitor again while still counting toward
 * countReady()/countTotal(). Making it positional and required is what makes
 * that omission a compile error rather than a silent backend swap: the FIRST
 * launch and every REPLACEMENT of it now build their argv from the SAME
 * resolved verdict. `binmonHost` is threaded for the same reason, one step
 * ahead of need -- no broker call site configures a stock bind override today
 * (acquirePortAndLaunch()'s own `binmonHost` is likewise unset), so it is
 * always `undefined` in production right now; the parameter exists so that
 * adding one later cannot reintroduce exactly this divergence between a
 * launch's argv and its respawn's argv. */
function superviseDepsFor(stateDir: string, state: BrokerState, backend: ViceBackend, binmonHost?: string): SuperviseChildDeps {
  return {
    state,
    stateDir,
    epoch: { epochPathFor, instanceLogDirFor, nextEpochFor, writeEpochRecord },
    log: (line: string) => process.stderr.write(`${line}\n`),
    backend,
    binmonHost,
  };
}

/** Exported ONLY so a test can install withCrashSupervision() through the
 * REAL deps object this module actually uses in production, rather than a
 * hand-built SuperviseChildDeps that can (and did) diverge from it -- the
 * exact blind spot CR-01 (03-REVIEW.md) lived in: broker-launch.test.ts's own
 * respawn/recycle tests each construct their deps inline and therefore pass
 * `backend: "stock"` directly, so the production builder's missing field was
 * invisible to the whole suite. Same discipline as broker-kill.mts's
 * `_HANDLED_SIGNALS`: an underscore-prefixed alias, never called by any
 * production code path in this module. */
export const _superviseDepsFor = superviseDepsFor;

/** Sets the deliberate-death marker and its respawn-after-kill answer
 * TOGETHER -- the single place in this module that ever writes either
 * field, so a call site can never set one and forget the other, which is
 * the exact shape of the defect this closes (T-01.6.2-80). Called BEFORE
 * any signal reaches the target child in both handlers below, never after:
 * the exit handler (broker-launch.mts) runs on the child's OWN exit event,
 * so a marker set after the signal arrives too late to be read
 * (T-01.6.2-84). */
function markDeliberateDeath(instance: InstanceRecord, respawnAfterKill: boolean): void {
  instance.deliberateKill = true;
  instance.respawnAfterKill = respawnAfterKill;
}

/** Injectable dependency seam for handleAcquire()'s warm-instance selection
 * arm and its cold-launch fall-through, mirroring the SAME
 * spawn/probe/clock-seam shape every other launch/kill/probe primitive in
 * this module tree already exposes (BrokerDeps, TryLaunchDeps,
 * MaintainWarmFloorDeps, SuperviseChildDeps). The real broker wiring
 * (run()'s onAcquire callback below) calls handleAcquire() with no deps at
 * all, so every default here IS the production behaviour; a unit test
 * against the built artifact injects its own stubs for `probe` and `kill`
 * (never opening a real connection or signalling a real pid) and its own
 * `buildColdSpawnFactory` (never spawning a real process) -- see
 * vice-broker-acquire.test.ts. */
export interface HandleAcquireDeps {
  /** Overrides the grant-time re-probe (P-02) -- defaults to a thin call
   * into broker-launch.mjs's real probeReady(). */
  probe?: (port: number) => Promise<boolean>;
  /** Overrides the identity-verified kill on a failed grant-time probe --
   * defaults to broker-kill.mjs's real verifiedKill(), reused unchanged
   * (Phase 01.6.2 criterion 6), never re-derived. */
  kill?: (opts: { pid: number | null; expectedIdentity: string }) => Promise<KillStage>;
  /** Overrides the cold-launch arm's spawn factory -- defaults to the same
   * makeLoggingSpawn()+withCrashSupervision() composition this function
   * always used. Widened (08.2-06-PLAN.md, Task 2) to the same optional
   * third options argument as that real composition, so a test or caller
   * that DOES supply an override can also forward options rather than
   * being typed out of it. */
  buildColdSpawnFactory?: (port: number) => (command: string, args: string[], options?: SpawnOptionsWithoutStdio) => ChildProcess;
  /** Which backend's launch argv to build (D-04, D-12) -- the real broker
   * wiring (run()'s onAcquire callback below) resolves this ONCE at startup
   * via backend-detect.mts's resolvedBackend() and passes the SAME resolved
   * value on every call (resolvedBackend() itself is never called
   * per-acquire). Defaults to `"fork"` -- broker-launch.mts's own
   * buildViceArgs() default -- when a caller omits it entirely (every
   * pre-Phase-2 test in vice-broker-acquire.test.ts), so those tests keep
   * exercising the exact byte-identical fork argv they always have. */
  backend?: ViceBackend;
  /** Plan 03-04 (DIRECT-06, D-13): threaded straight through to the
   * cold-launch arm's own acquirePortAndLaunch() call -- see that
   * function's own doc comment (broker-launch.mts) for the exclude/degrade
   * contract. The real broker wiring (run()'s onAcquire callback below)
   * passes `(state, exclude) => nextFreePort(state, { exclude })`; this
   * function does NOT read VICE_BACKEND itself to decide whether to call
   * it -- acquirePortAndLaunch() gates the second allocation on
   * `deps.backend === "stock"` on its own. */
  allocateRemoteMonitorPort?: (state: BrokerState, exclude: ReadonlySet<number>) => Promise<PortAllocationResult>;
  /** Phase 33, plan 33-06 (REPRO-05, D-15/D-16): the launch profile THIS
   * acquire requested, already narrowed by broker-control.mts's
   * normaliseLaunchProfile() (the one narrowing site -- nothing here
   * re-validates it, and nothing here reads a raw wire value).
   *
   * Carried on this options bag rather than as a fifth positional parameter
   * because the real broker wiring (run()'s onAcquire callback below) already
   * constructs a fresh bag PER ACQUIRE, so per-request data threads through
   * it naturally; `backend` sets the same precedent of a non-injected
   * configuration value living here. Optional and absent by default, so every
   * pre-33-06 call site and every existing test behaves identically.
   *
   * It feeds TWO places, and both matter: selectWarmInstance()'s synchronous
   * eligibility filter (D-16 -- a mismatched warm instance is skipped) and
   * the cold arm's acquirePortAndLaunch(), which turns it into argv and
   * mirrors it onto the new InstanceRecord. */
  profile?: LaunchProfile;
  log?: (line: string) => void;
}

// ---------------------------------------------------------------------------
// Phase 33, plan 33-06 (REPRO-05, D-16, T-33-23/T-33-24): the warm-instance
// PROFILE-ELIGIBILITY rule.
//
// THE DECISION, stated out loud because two of the three available answers
// are wrong in ways the CALLER CANNOT DETECT:
//   - Refuse the acquire outright when a mismatched warm instance exists ->
//     warp becomes unusable whenever a warm floor exists (the default is 1,
//     so: essentially always).
//   - Serve the request with the mismatched instance -> the caller asked for
//     warp, got an unwarped machine, and received a confident grant. The knob
//     is a lie and nothing in the response says so.
//   - D-16, what this implements: the mismatched instance is INELIGIBLE. The
//     walk skips it and the acquire falls through to the cold arm, which
//     launches a DEDICATED instance for that grant.
//
// WHAT MUST NEVER BE ADDED HERE: a retro-warp, and a kill-then-relaunch of a
// mismatched warm instance. There is no runtime `WarpMode` resource on stock
// at all (vsync.c:220-241, deliberately), so an existing instance cannot be
// adjusted -- it can only be ineligible. And "killing or relaunching
// preemptively to serve a newer request" is a NAMED anti-pattern in this
// project (CLAUDE.md): it would make an interactive session's emulator vanish
// because some capture run asked for warp. A test asserts the kill dependency
// is not called and the instance stays `ready`.
// ---------------------------------------------------------------------------

/** True when `record` was launched with the SAME profile `requested` asks
 * for. FULLY SYNCHRONOUS by requirement, not by convenience -- see the call
 * site inside selectWarmInstance() below for why.
 *
 * Absent is `{}`: a record with no `profile` field (a pre-33-06 record, a
 * fork launch, a warm-floor spare, or a record a broker restarted mid-phase
 * read from a state directory written before the field existed) is compared
 * as though it carried `{}`, and so is an absent request. Each knob is
 * compared `=== true` on BOTH sides, so `undefined` and `false` are the same
 * request -- which is what makes an absent profile, an explicit `{}` and
 * `{warp:false, headless:false}` one single behaviour rather than three. */
export function profileEligible(record: InstanceRecord, requested?: LaunchProfile): boolean {
  const have = record.profile ?? {};
  const want = requested ?? {};
  return (have.warp === true) === (want.warp === true) && (have.headless === true) === (want.headless === true);
}

/** Walks `state.instances` for probe-live `ready` candidates, in iteration
 * order, and returns the first that answers a grant-time re-probe (P-02) --
 * or `null` once every candidate has been tried and none answered, letting
 * the caller fall through to a cold launch (P-03). Regardless of
 * `record.reason`: per D-07, a waiting request takes an instance whichever
 * reason booted it, so a warm-floor instance and a not-yet-granted instance are
 * equally eligible. Kill-never-recycle needs no separate guard here --
 * handleRelease() below already deletes a released instance's record
 * outright, so a released instance is structurally absent from
 * `state.instances` and can never be a candidate.
 *
 * A candidate whose grant-time probe FAILS is dropped -- de-registered from
 * `state.instances` -- and identity-verified-killed BEFORE the walk
 * continues to the next candidate, but per WR-02
 * (`.planning/todos/pending/2026-08-05-wr-02-*`, decision: fix now rather
 * than defer further) the kill itself is fire-and-forget, matching
 * handleRelease()'s own posture a few hundred lines below
 * (`verifiedKill(...).catch(...)`, never awaited by that call site either):
 * the acquiring request must not wait up to `VICE_BROKER_KILL_WAIT_S`
 * (default 5s) of SIGTERM-then-poll-then-SIGKILL PER DEAD CANDIDATE before
 * the walk can move on -- that wait is exactly what turns a warm floor's
 * fast, in-memory grant into a multi-second serial teardown on a single
 * request's hot path once the warm floor is configured above its default
 * of 1 (WR-02's own bounding condition). The drop -- `markDeliberateDeath()`
 * plus `state.instances.delete()` -- still happens SYNCHRONOUSLY, in the
 * same tick as the probe failure, before `deps.kill(...)` is even invoked;
 * only the kill's own SETTLEMENT is decoupled from this walk. This is
 * WR-02's fix option 1, not option 2 (capping how many failed candidates a
 * single acquire will wait through): option 1 matches an idiom the file
 * already uses elsewhere rather than inventing a new bound, and removes the
 * wait entirely rather than merely capping it. The grant-time-probe-failure
 * log line's own ordering is decoupled accordingly (see below) -- it can no
 * longer name the kill's resolved stage synchronously, since nothing here
 * waits for it to resolve. The marker is set BEFORE any signal reaches the
 * child (markDeliberateDeath()'s own contract), with a FALSE
 * respawn-after-kill answer -- this arm never wants a replacement on the
 * SAME port; a replacement, if any, comes from either the next candidate in
 * this same walk or the caller's own cold-launch fall-through.
 *
 * Re-checks `record.state === "ready"` AND map membership by identity
 * immediately after every `await` (the probe call itself) and BEFORE ever
 * treating a probe-live candidate as the winner -- this is what makes the
 * caller's own "no await between selection and the grant-recording step"
 * property (T-01.6.2.1-03) actually hold under two concurrent acquires. A
 * candidate's own probe response cannot change because a sibling acquire
 * granted it first, but its RECORDED state does, the instant that sibling's
 * synchronous grant step runs -- recorded state alone catches that case.
 * It does NOT catch a sibling that has already DROPPED this exact candidate
 * (a failed grant-time probe: markDeliberateDeath() + state.instances.delete(),
 * which never touches record.state -- the drop path a few lines below) --
 * 01.6.2.1-VERIFICATION.md's CR-01 finding, re-confirmed here: a state-only
 * recheck is blind to a concurrent drop, letting a second caller's stale
 * object reference win a grant for a record that is no longer in
 * state.instances at all, orphaning the grant. Rechecking
 * `state.instances.get(record.port) === record` (identity, not merely a
 * port-number lookup) closes that case too. */
async function selectWarmInstance(
  state: BrokerState,
  deps: {
    probe: (port: number) => Promise<boolean>;
    kill: (opts: { pid: number | null; expectedIdentity: string }) => Promise<KillStage>;
    log: (line: string) => void;
    /** Phase 33, plan 33-06 (D-16): the profile THIS acquire asked for.
     * `undefined` means profile-less, which is what every pre-33-06 caller
     * passes and what the warm floor has always served. */
    requestedProfile?: LaunchProfile;
  },
): Promise<InstanceRecord | null> {
  for (const record of Array.from(state.instances.values())) {
    if (record.state !== "ready") continue;
    // Phase 33, plan 33-06 (D-16, T-33-23): a SYNCHRONOUS `continue`, sitting
    // immediately beside the `record.state !== "ready"` filter directly
    // above and BEFORE the readiness probe below. That placement is
    // load-bearing twice over, and neither reason is stylistic:
    //
    //   1. It introduces NO new `await` into the region the single-owner
    //      `inFlight` launch guard protects. That guard exists because of the
    //      2026-08-01 triple-launch outage and must stay a synchronous
    //      check-and-set with no `await` between (CLAUDE.md, regression-
    //      tested). A filter placed after the probe would put a fresh
    //      suspension point inside that region -- which is why this plan
    //      verifies the placement by line-number comparison, not by comment.
    //   2. An ineligible candidate costs no probe at all -- no socket, no
    //      round trip, no wait.
    //
    // An ineligible miss falls through EXACTLY as a "no warm instance" miss
    // does: to the caller's own cold arm, which records the one and only
    // grant. It opens no second `state.grants.set()` call, and it never
    // kills, recycles or re-warps the mismatched instance (see
    // profileEligible()'s own banner for why those are excluded by design).
    if (!profileEligible(record, deps.requestedProfile)) continue;

    const isReady = await deps.probe(record.port);

    // A sibling acquire may have granted OR dropped this exact candidate
    // while this probe was in flight. "Granted" changes record.state;
    // "dropped" removes the record from state.instances outright and never
    // touches record.state -- so map membership must be rechecked too, not
    // merely the state field (CR-01, 01.6.2.1-REVIEW.md/01.6.2.1-VERIFICATION.md).
    if (record.state !== "ready" || state.instances.get(record.port) !== record) {
      continue;
    }

    if (isReady) {
      return record;
    }

    // Drop and de-register FIRST, synchronously, before the kill is even
    // invoked -- this is what CR-01's identity recheck above depends on:
    // the record must already be gone from state.instances by the time a
    // concurrent sibling's own probe on this same candidate resolves.
    // WR-02 only changes what happens to the kill's own PROMISE next, never
    // this ordering.
    markDeliberateDeath(record, false);
    // CR-02 (03-REVIEW.md): dropping a record is also where its second
    // (`-remotemonitor`) port stops being spoken for -- deleteInstanceRecord()
    // is the ONE place both mutations happen together, so a drop can never
    // leak a port out of the fixed allocation band.
    deleteInstanceRecord(state, record.port);
    // Distinct wording from shutdown()'s own "shutdown complete" line
    // (broker-kill.mts) and from handleRecycleForRealBroker's own log-free
    // path -- D-07's standing constraint that a lifecycle decision must be
    // reconstructable from the log after an incident (both 2026-08-01 and
    // 2026-08-02 were diagnosed from broker log lines). Logged BEFORE the
    // kill settles (WR-02): the walk does not wait for deps.kill(...) to
    // resolve, so this line can no longer name the kill's resolved stage --
    // that gets its own, separately-logged line once the kill settles,
    // below.
    deps.log(
      `vice-broker: grant-time probe failed for port ${record.port} (pid ${record.pid ?? "null"}) -- dropped the record and kicked off an identity-verified kill of the pid (not awaited by the acquire walk, WR-02)`,
    );
    // Fire-and-forget, matching handleRelease()'s own posture
    // (`verifiedKill(...).catch(...)`, a few hundred lines below in this
    // same file) -- the acquire walk moves on to the next candidate (or
    // returns null to the cold-launch fall-through) without waiting up to
    // VICE_BROKER_KILL_WAIT_S per dead candidate. Still identity-verified:
    // this is the SAME deps.kill, never replaced by a bare, unverified
    // signal. The settlement is only OBSERVED asynchronously, via its own
    // log line, never awaited.
    void deps
      .kill({ pid: record.pid, expectedIdentity: record.expectedIdentity })
      .then((killStage) => {
        deps.log(
          `vice-broker: grant-time-probe-failure kill for port ${record.port} (pid ${record.pid ?? "null"}) settled (kill stage: ${killStage})`,
        );
      })
      .catch(() => {
        // best-effort; nothing further to report on this path, matching
        // handleRelease()'s own posture at its own verifiedKill(...).catch(...) call site.
      });
  }
  return null;
}

/** Resolves a GRANTABLE instance -- a cold launch is one of two ways of
 * obtaining one, not the only one (this task's own assumption-delta
 * decision: "resolve a grantable instance" is now the primary operation).
 * The warm-instance selection arm (selectWarmInstance(), P-01) runs BEFORE
 * the cold-launch arm; `atCapacity()` gates ONLY the cold-launch arm --
 * checked only once selectWarmInstance() has already answered `null` (no
 * probe-live candidate available) -- NOT before either arm (WR-01,
 * 01.6.2.1-REVIEW.md). A full host still refuses a fresh cold launch before
 * ever touching the port allocator, but a ready, probe-live warm candidate
 * is grantable even when the ceiling is already reached: granting it
 * creates no NEW instance and does not raise `countTotal()`, so refusing to
 * hand out an already-existing idle one was a real availability bug, not a
 * correct interpretation of the ceiling's own purpose (bounding concurrent
 * emulator *processes*, not bounding how many of those processes may be
 * *handed out*). Both arms converge on exactly ONE `state.grants.set()`
 * call -- load-bearing for task 2's structural anti-regression gate, which
 * counts it -- fed by whichever arm produced a record. Answers the full
 * discriminated AcquireOutcome (plan 05): `at_capacity` when the ceiling is
 * already reached AND no warm candidate could be served,
 * `no_free_port`/`launch_in_flight` passed straight through from
 * acquirePortAndLaunch()'s own typed failure (the cold arm only), and
 * `internal` only for a genuine, otherwise-unclassified fault. A
 * `launch_in_flight` outcome is NOT a control-plane error -- broker-
 * control.mts's own attemptAcquire()/enqueueAcquire() queue the request and
 * retry it later rather than refusing it. */
export async function handleAcquire(requestId: string, stateDir: string, state: BrokerState, deps: HandleAcquireDeps = {}): Promise<AcquireOutcome> {
  // WR-01: the readiness probe is backend-aware, from the SAME threaded-down
  // verdict handleAcquire already uses for buildViceArgs() -- on stock the port
  // speaks the binary monitor, so an HTTP POST there can never succeed.
  const backend = deps.backend ?? "fork";
  const probe = deps.probe ?? ((port: number) => probeReady(port, { backend }));
  // Textually a verifiedKill( call site, not merely a reference -- reused
  // UNCHANGED from broker-kill.mts (Phase 01.6.2 criterion 6), never
  // re-derived, and never replaced by a bare process.kill().
  const kill = deps.kill ?? ((opts: { pid: number | null; expectedIdentity: string }) => verifiedKill(opts));
  const log = deps.log ?? ((line: string) => process.stderr.write(`${line}\n`));

  const winner = await selectWarmInstance(state, { probe, kill, log, requestedProfile: deps.profile });

  let record: InstanceRecord;
  if (winner) {
    record = winner;
  } else if (atCapacity(state)) {
    return { ok: false, reason: "at_capacity" };
  } else {
    // acquirePortAndLaunch() holds the single in_flight owner across its own
    // async port allocation (not merely tryLaunchOne()'s synchronous spawn
    // instant) -- see that function's own header comment for the race this
    // closes between a cold acquire and a concurrent warm-floor pass. This
    // is also what restores vice-broker.sh's own process_requests() throttle:
    // a cold acquire that arrives while ANY launch (cold or warm) is already
    // under way is queued here (plan 05), matching the bash original's
    // declined-to-change behaviour of never racing a second instance into
    // existence, but answered LATER instead of refused outright.
    let lastLogRelPath = "";
    const result = await acquirePortAndLaunch("acquire", {
      state,
      stateDir,
      allocatePort: nextFreePort,
      // CR-01 (03-REVIEW.md): the SAME local `backend` const resolved at the
      // top of this function feeds BOTH the initial argv (here) and the
      // supervision deps below, so a crash-respawn of this instance can never
      // build a different backend's argv than the launch it replaces.
      backend,
      allocateRemoteMonitorPort: deps.allocateRemoteMonitorPort,
      // Phase 33, plan 33-06 (D-15/D-16): the profile the warm arm just
      // refused to compromise on reaches buildViceArgs() here, and is
      // mirrored onto the fresh InstanceRecord by spawnAndRecordInstance()
      // in the SAME step -- so this instance's recorded profile and its real
      // argv are written together and cannot disagree. This is the arm that
      // makes "a dedicated instance for that grant" true rather than
      // aspirational.
      profile: deps.profile,
      spawnFactory:
        deps.buildColdSpawnFactory ??
        ((port: number) => {
          const supervisorDir = join(stateDir, String(port));
          const { spawn, logRelPath } = makeLoggingSpawn(join(supervisorDir, "logs"));
          lastLogRelPath = logRelPath;
          return withCrashSupervision("acquire", port, spawn, superviseDepsFor(stateDir, state, backend));
        }),
    });

    if (!result.ok) {
      // Plan 41-05 (D-16, checkpoint option B): `result.reason` passes
      // straight through -- `AcquireLaunchResult`'s reason union
      // ("launch_in_flight" | "no_free_port" | "no_free_text_port") is a
      // subset of `AcquireOutcome`'s, so a failed text-port allocation's own
      // `no_free_text_port` reaches the control plane as its own distinct
      // code (broker-control.mts's ControlErrorCode) rather than collapsing
      // to `internal` or to the generic `no_free_port`.
      return { ok: false, reason: result.reason };
    }
    if (result.record.pid === null) {
      // WR-03 (01.6.2.1-REVIEW.md): the spawn never forked a real process
      // (e.g. a bad VICE_BIN path), so there is nothing to signal -- the
      // fix is deleting the just-created broken record alone. Without this,
      // a configuration failure would silently occupy a port slot and count
      // toward countTotal()/atCapacity() until crash supervision's own
      // delayed respawn/give-up machinery eventually noticed and freed it,
      // even though the caller was already told "internal" right now.
      // CR-02: deleteInstanceRecord(), not a bare map delete -- a stock launch
      // that failed this way already had its second port allocated and
      // blocked by acquirePortAndLaunch(), and deleteInstanceRecord() hands
      // that second port back to the allocator (via state.blockedPorts) in
      // the SAME step as it removes the broken record -- confirmed still
      // true after plan 41-05 (D-16): this branch is reached only once a
      // record already exists, i.e. only once BOTH allocations already
      // succeeded (a failed second allocation now fails the acquire before
      // any record -- and before this `pid === null` check -- is ever
      // reached at all).
      deleteInstanceRecord(state, result.record.port);
      return { ok: false, reason: "internal" };
    }
    record = result.record;

    // Only the cold-launch arm ever writes a FRESH epoch record here --
    // selectWarmInstance()'s own winner already has one. Plan 41-05 (folded
    // todo) changes WHY that is true without changing that it IS true: a
    // ready, ungranted candidate no longer comes from a warm-floor pass's
    // own onLaunched hook (retired along with the floor) -- it comes from
    // broker-launch.mts's own crash-supervision respawn path
    // (launchSupervised(), which writes its own epoch record via
    // deps.epoch.writeEpochRecord() on every launch and every respawn).
    // Either way, rewriting the epoch here would advance an epoch no restart
    // caused, which the container-side assertSameMachine() would read as a
    // machine change.
    writeEpochForLaunch(record, lastLogRelPath);
  }

  // THE single grant-recording step, fed by both arms above -- no `await`
  // between resolving `record` (whichever arm produced it) and this
  // synchronous pair, so two concurrent acquires can never both grant the
  // SAME record (T-01.6.2.1-03; see selectWarmInstance()'s own re-check for
  // the other half of that guarantee).
  state.grants.set(requestId, { id: requestId, port: record.port, grantedAt: Date.now(), pid: record.pid });
  record.state = "granted";

  return {
    ok: true,
    grant: {
      port: record.port,
      url: record.url,
      epochFile: record.epochFile,
      supervisorDir: record.supervisorDir,
      // Plan 41-01 (D-15): key omitted entirely when the record has none --
      // the fork case, and (until a later plan closes the port-allocation
      // degrade path) a stock instance whose second port allocation itself
      // failed. Same key-omitted-when-undefined idiom
      // spawnAndRecordInstance() already uses for this same field.
      ...(record.remoteMonitorPort === undefined ? {} : { remoteMonitorPort: record.remoteMonitorPort }),
    },
  };
}

/** Answers the `status` control-plane request: one entry per instance,
 * computed on demand from the SAME in-memory map every other count reads --
 * strictly better than the dropped broker-instances.json projection, which
 * could go stale between passes (D-24). */
function handleStatus(state: BrokerState): StatusInstanceEntry[] {
  return Array.from(state.instances.values()).map((r) => ({
    port: r.port,
    url: r.url,
    state: r.state,
    reason: r.reason,
    epoch: typeof r.epoch === "number" ? r.epoch : null,
    // Plan 41-03 (D-14): "at least one channel is claimed" -- promoted from
    // a single-field check, byte-identical wire shape, meaning stated
    // explicitly (D-15).
    hasMonitorClient: Object.keys(r.monitorClients).length > 0,
  }));
}

/** Resolves a monitor_claim/monitor_release target the SAME way
 * handleRelease() and handleRecycleForRealBroker() already resolve theirs:
 * `targetId` is a grant id, looked up in state.grants for its port, then
 * the instance at that port. Returns `null` for an unknown target_id/port
 * so callers answer `bad_request`, never `internal` (plan 05's own
 * acceptance criterion). */
function resolveInstanceForMonitorTarget(targetId: string, state: BrokerState): InstanceRecord | null {
  const grant = state.grants.get(targetId);
  if (!grant) return null;
  return state.instances.get(grant.port) ?? null;
}

/** Answers `monitor_claim` (plan 05, BROK-02/PROTO-08, D-13; per-channel
 * since plan 41-03, D-14): exclusive monitor-socket ownership enforced
 * HERE, broker-side, PER CHANNEL, so a conflicting claim is refused by name
 * before any second `connect()` is ever attempted -- the one state stock
 * VICE cannot report and no client-side heuristic can diagnose. `targetId`
 * doubles as both "which instance" (resolved via the SAME grant lookup
 * handleRelease()/handleRecycleForRealBroker() already use) and "the
 * requesting grant's own identity" -- the claim IS the grant, so there is
 * no separate identity to carry. A repeated claim from the SAME grant on
 * the SAME channel is idempotent (`ok: true`, no second holder created); a
 * claim from a DIFFERENT grant while that channel already has a holder is
 * refused, naming the current holder and the channel (T-02-18) -- never the
 * emulator's own fault. A DIFFERENT channel's holder is irrelevant to this
 * decision -- claiming one channel never evicts or is refused by the
 * other's holder. */
export function handleMonitorClaim(requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState): MonitorClaimOutcome {
  void requestId; // correlation only -- the claim's own identity is targetId itself
  const instance = resolveInstanceForMonitorTarget(targetId, state);
  if (!instance) return { ok: false, code: "bad_request" };

  const existing = instance.monitorClients[channel];
  if (!existing) {
    instance.monitorClients[channel] = { grantId: targetId, claimedAt: Date.now(), pid: instance.pid };
    return { ok: true };
  }
  if (existing.grantId === targetId) {
    return { ok: true }; // idempotent repeat from the SAME grant on the SAME channel -- no second holder
  }
  return { ok: false, code: "monitor_owned", holder: { grantId: existing.grantId, claimedAt: existing.claimedAt, pid: existing.pid, channel } };
}

/** Answers `monitor_release` (plan 05, T-02-01; per-channel since plan
 * 41-03, D-14): clears ONLY the named channel's entry, ONLY when `targetId`
 * names that channel's CURRENT holder -- a non-holder is refused, not
 * silently accepted (spoofing a release is exactly T-02-01's own
 * disposition). A channel with no current holder at all tolerates the
 * release as a success, matching the container-side client's own documented
 * tolerance for releasing a socket the broker already cleared. */
export function handleMonitorRelease(requestId: string, targetId: string, channel: MonitorChannel, state: BrokerState): MonitorReleaseOutcome {
  void requestId; // correlation only, matching handleMonitorClaim()'s own posture
  const instance = resolveInstanceForMonitorTarget(targetId, state);
  if (!instance) return { ok: false, code: "bad_request" };

  const existing = instance.monitorClients[channel];
  if (!existing) return { ok: true }; // already cleared -- tolerated, not an error
  if (existing.grantId !== targetId) {
    return { ok: false, code: "denied" };
  }
  clearMonitorClient(instance, channel);
  return { ok: true };
}

/** Resolves a recycle target's emulator child pid from THIS broker's own
 * in-memory instance record -- record.pid is, by construction, exactly the
 * same value broker-epoch.mts's writer puts in epoch.json's own `pid` field
 * (both are set from the same spawned child's own pid at launch time, and
 * both are updated together on every respawn) -- so reading it here is
 * reading "the epoch record's pid", never the supervising broker's own
 * process.pid (T-01.6.2-17; there is no intermediate supervisor process in
 * this topology at all, per broker-kill.mts's own header comment). A
 * recycle's OWNERSHIP check (does this connection hold this grant) already
 * happened in broker-control.mts before this function is ever called -- this
 * function only resolves, marks and kills.
 *
 * Marks the death as broker-ordered AND to be replaced, with a TRUE
 * respawn-after-kill answer, BEFORE the kill -- the actual replacement is
 * then carried out by the per-child supervision exit handler
 * (broker-launch.mts's handleExit(), wired in by plan 12) on the SAME port,
 * asynchronously, after this function has already returned its own
 * acknowledgement. This is exactly what the tool description's own "via the
 * host supervisor's existing respawn loop" wording describes: this function
 * marks and kills; the respawn loop is the exit handler, not this function.
 * Neither the grant nor the instance entry is deleted here -- the grant is
 * what keeps the recycled port belonging to this same session, and the
 * instance entry is what the exit handler reads to decide the relaunch;
 * both must still exist once this function returns for the exit handler to
 * have anything to act on. */
async function handleRecycleForRealBroker(targetId: string, state: BrokerState): Promise<RecycleOutcome> {
  const grant = state.grants.get(targetId);
  if (!grant) {
    return {
      port: null,
      pid: null,
      viceBin: null,
      killStage: "no_signal",
      epochBefore: null,
      outcome: "grant_lookup_failed",
      reason: `no grant record found for target ${targetId}`,
    };
  }
  const instance = state.instances.get(grant.port);
  if (!instance) {
    return {
      port: grant.port,
      pid: null,
      viceBin: null,
      killStage: "no_signal",
      epochBefore: null,
      outcome: "epoch_lookup_failed",
      reason: `no resolvable epoch record for target ${targetId} (port ${grant.port})`,
    };
  }
  if (instance.pid === null) {
    return {
      port: instance.port,
      pid: null,
      viceBin: instance.viceBin,
      killStage: "no_signal",
      epochBefore: typeof instance.epoch === "number" ? instance.epoch : null,
      outcome: "pid_lookup_failed",
      reason: `epoch record carries no pid for target ${targetId}`,
    };
  }

  const epochBefore = typeof instance.epoch === "number" ? instance.epoch : null;
  markDeliberateDeath(instance, true);
  // Plan 05: a recycle clears monitor-client ownership as a side effect --
  // the respawned record the exit handler creates is a BRAND NEW
  // InstanceRecord object (broker-launch.mts's spawnAndRecordInstance())
  // that never carries this field forward regardless, but clearing it here
  // too keeps the CURRENT (pre-kill) record's own state honest for the
  // window between this call and that respawn.
  clearMonitorClient(instance);
  const killStage = await verifiedKill({ pid: instance.pid, expectedIdentity: instance.expectedIdentity });
  const outcome = killStage === "identity_refused" ? "identity_refused" : "ok";
  const reason = killStage === "identity_refused" ? "process identity did not match the recorded emulator binary -- the target was NOT signalled and is still running" : "";

  return { port: instance.port, pid: instance.pid, viceBin: instance.viceBin, killStage, epochBefore, outcome, reason };
}

/** Plan 41-05 (folded todo): the second concern of the fixed-order
 * evaluation pass, RENAMED from the retired warm-floor maintenance function
 * this replaces (D-24 drops the projection write; the grant sweep does not
 * appear -- D-12's connection-is-the-lease). Unlike the function it
 * replaces, this one never launches anything -- it wires only
 * broker-launch.mjs's real promoteLaunchingInstances() against this
 * broker's own state and the backend-aware readiness probe, so a
 * `launching` instance (however it got there -- a cold acquire's own
 * instance, or a crash-respawn) is promoted to `ready` the moment it
 * answers. */
function promoteLaunchingForRealBroker(state: BrokerState, backend: ViceBackend): Promise<void> {
  return promoteLaunchingInstances({
    state,
    backend,
    // WR-01: same backend-aware probe route as handleAcquire's, from the
    // SAME resolved verdict this function already receives.
    probe: (port: number) => probeReady(port, { backend }),
    log: (line: string) => process.stderr.write(`${line}\n`),
  });
}

/** Releases a grant and identity-verified-kills its instance -- but ONLY
 * when the port's CURRENT occupant is proven to be the SAME process this
 * grant was actually issued for (its own recorded `pid`, set at grant time
 * by handleAcquire()'s single state.grants.set() call site), not merely
 * "whatever now holds this port number." This is Task 2's own closure of
 * CR-01's cross-session-kill blast radius (T-01.6.2.1-28): even after Task
 * 1 closes the specific concurrent-acquire race, this lookup was ALREADY
 * unsafe against any OTHER event that swaps a port's occupant without also
 * clearing the grant -- the clearest independent example being an ordinary
 * (non-deliberate) crash of a GRANTED instance that hits the give-up
 * threshold: broker-launch.mts's handleExit() deletes the record from
 * state.instances regardless of record.state, freeing the port for
 * nextFreePort() to hand to a brand-new, unrelated cold launch, while the
 * original grant sits untouched in state.grants.
 *
 * On a pid MATCH: unchanged from before this task -- marks the death as
 * broker-ordered with a FALSE respawn-after-kill answer BEFORE the kill
 * (the opposite answer from the recycle handler above, since a release
 * wants no replacement), deletes the instance entry (harmless double-delete
 * if the exit handler's own final-death branch also runs), and
 * fire-and-forget identity-verified-kills it.
 *
 * On a pid MISMATCH -- including when there is no instance at all at that
 * port: the grant's own bookkeeping is still removed (a release always
 * retires its OWN request's bookkeeping), but the mismatched CURRENT
 * occupant is left running, untouched -- neither deleted nor signalled in
 * any way -- and a distinct log line names the request id, the port, the
 * grant's own recorded pid, and the current occupant's pid (or "none" when
 * the port is empty), worded distinctly from both the shutdown-complete
 * line (broker-kill.mts) and the grant-time-probe-failure line this same
 * file already emits (D-07's standing constraint that a lifecycle decision
 * must be reconstructable from the log after an incident).
 *
 * A legitimate recycle (broker-launch.mts's handleExit() recycle branch)
 * keeps this grant's `pid` in sync with the respawned record's own pid, so
 * this check never misfires against a recycled instance the grant still
 * legitimately owns. */
export function handleRelease(requestId: string, state: BrokerState): void {
  const grant = state.grants.get(requestId);
  if (!grant) return;
  const instance = state.instances.get(grant.port);

  if (instance && instance.pid === grant.pid) {
    markDeliberateDeath(instance, false);
    // Plan 05: releasing clears monitor-client ownership (every channel) as
    // a side effect -- redundant with the instance-map deletion two lines
    // below (the WHOLE record, monitorClients included, is going away), but
    // explicit for the same reason GrantRecord's own clearing is explicit
    // here: the
    // instance-map deletion is a Task-2-era invariant this task must not
    // depend on silently continuing to hold.
    clearMonitorClient(instance);
    state.grants.delete(requestId);
    // CR-02: kill-never-recycle means this instance is gone for good, so its
    // second (`-remotemonitor`) port must go back to the allocator with it.
    deleteInstanceRecord(state, grant.port);
    verifiedKill({ pid: instance.pid, expectedIdentity: instance.expectedIdentity }).catch(() => {
      // best-effort; nothing further to report on this path this task
    });
    return;
  }

  // Stale/orphaned grant: the port's current occupant (if any) is NOT the
  // same process this grant was issued for. Retire the grant's own
  // bookkeeping only -- the mismatched occupant, if any, is left running.
  state.grants.delete(requestId);
  process.stderr.write(
    `vice-broker: release for request ${requestId} found a different instance at port ${grant.port} than the one this grant was issued for ` +
      `(grant pid ${grant.pid ?? "null"}, current occupant pid ${instance ? instance.pid ?? "null" : "none"}) -- the grant's own bookkeeping was retired, ` +
      `and the current occupant was left untouched\n`,
  );
}

async function run(args: ParsedArgs): Promise<void> {
  const finalPath = join(args.stateDir, "broker.json");

  // Plan 05 (criterion K, D-17): the tracer/plan-04-era "refuse to overwrite
  // a record naming a currently-live pid" pre-check is GONE -- REPLACED by
  // the bind-before-write singleton guard below, not merely extended
  // alongside it (this phase's own plan-time note is explicit: the
  // refuse-to-clobber heuristic is replaced, not extended). That old check
  // read broker.json's OWN recorded pid and asked "is that process alive" --
  // a heuristic that can never tell "a live broker legitimately holds this
  // port" apart from "a live but unrelated process happens to share a pid
  // number with a stale record" (pids get reused). The kernel-enforced bind
  // below asks the ONLY question that actually matters -- "is the control
  // port itself already held" -- and broker.json becomes a pure ARBITER of
  // that question's two possible causes, never a gate in its own right.
  //
  // D-25: the mandatory start-time banner, printed unconditionally and
  // BEFORE anything else in this function runs -- an operator must be told
  // what a Ctrl-C costs before there is anything running for them to Ctrl-C.
  process.stderr.write(`${startupBanner()}\n`);

  const state = createBrokerState();
  const token = newControlToken();
  const controlHost = process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";
  const startedAt = new Date().toISOString(); // FIXED across every heartbeat refresh -- see writeBrokerRecordFile()'s callers below
  const pollMs = Number(process.env.VICE_BROKER_POLL_MS) || 500;
  const controlPort = resolveControlPort();

  // Criterion I / D-15: the unconditional startup reap runs BEFORE the
  // control listener accepts and before anything is launched. A SIGKILLed
  // prior broker never ran a shutdown path, so this is the only place the
  // "every emulator this project's port band could be squatting is either
  // ours or a human's own work" guarantee can be enforced -- no marker file
  // is consulted, per this reap's own header comment in broker-kill.mts.
  //
  // NOTE (plan 05): this reap runs UNCONDITIONALLY, before the bind attempt
  // below -- including for a process that goes on to LOSE the singleton
  // race a moment later (see the EADDRINUSE handling below). That ordering
  // is D-15's own, already established and tested by plan 04
  // (broker-kill.test.ts's own structural source-order check); this task
  // does not change it. A losing second broker's own reap pass is an
  // accepted, pre-existing consequence of "the reap is unconditional" --
  // not something the singleton guard below is required to prevent.
  await reapOrphanedInstances({
    stateDir: args.stateDir,
    epochPathFor,
    nextEpochFor,
    writeEpochRecord,
  });

  // Plan 02-07 (D-01, D-03): resolved ONCE here, after the unconditional
  // startup reap and BEFORE the control listener binds -- never re-read per
  // launch, and never called from inside broker-launch.mts's `inFlight`
  // single-owner guard (this call sits entirely outside it; no launch is
  // even possible yet at this point in run()). `supervisorDir: args.stateDir`
  // is passed explicitly -- args.stateDir IS `.c64-re-tools/supervisor` under this
  // broker's own repo root (see parseArgs() above), so this is the SAME
  // directory repo-root.ts's supervisorDir() would resolve to, without this
  // host-bound module ever importing that container-side resolver directly
  // (backend-detect.mts's own header comment explains why it cannot). An
  // `indeterminate` outcome does not prevent the broker from starting: it
  // logs its own note (backend-detect.mts) and this line proceeds with the
  // "fork" answer resolvedBackend() already returns for that case -- the
  // pre-Phase-2 behaviour every existing install already has.
  const backendResult = resolvedBackend({ supervisorDir: args.stateDir });
  const backend: ViceBackend = backendResult.backend;
  process.stderr.write(
    `vice-broker: backend "${backend}" (source: ${backendResult.source}, binary: ${backendResult.binPath})\n`,
  );

  // Gap G-40-1, requirement R2 (plan 40-09): THE BROKER mints/verifies the
  // Ghidra runs-root handle here -- after the unconditional startup reap
  // above, and BEFORE the control listener below accepts a single
  // connection -- so a container-side MCP server with no host tooling of
  // its own still finds the handle in place the moment it can reach this
  // broker at all. This is deliberately NOT the only call site:
  // resolveGhidraProject() (ghidra-project.mts) calls the same function as
  // an idempotent precondition, because two host-side routes never involve
  // a broker at all -- the direct spawn of resources/host-tool.mjs from
  // host-tool-client.ts:269-273 (the everyday route on a host with no
  // devcontainer, and the route CI uses), and tests importing that
  // artifact directly. Both callers write the identical relative-target
  // link, so a race between them is a benign EEXIST, not a conflict (see
  // ensureGhidraRunsHandle()'s own header). The negative rule: container-
  // side code must NEVER mint this handle -- the link target is relative
  // and correct only when written from the host's view of the workspace.
  //
  // Handled WITHOUT throwing: run() has no try/catch around this region and
  // the broker must start regardless of the outcome here -- it serves
  // twelve allowlisted tool ids and only one of them (ghidra.analyze) needs
  // this handle. A refusal is surfaced as ONE stderr line naming the
  // consequence; every other tool id is unaffected.
  const ghidraHandleResult = ensureGhidraRunsHandle(args.repoRoot);
  if (ghidraHandleResult.ok) {
    process.stderr.write(
      `vice-broker: ghidra runs handle ${ghidraHandleResult.handle} -> ${ghidraHandleResult.target}\n`,
    );
  } else {
    process.stderr.write(
      `vice-broker: ghidra runs handle refused: ${ghidraHandleResult.message} -- ghidra.analyze will refuse by name until this is fixed by hand; every other tool id is unaffected\n`,
    );
  }

  // D-18: the singleton guarantee holds only while the control port keeps its default -- two brokers deliberately configured onto different ports are two brokers, and no code prevents that.
  let listener: Awaited<ReturnType<typeof startControlListener>>;
  try {
    listener = await startControlListener({
      host: controlHost,
      port: controlPort,
      token,
      onAcquire: (requestId, profile) =>
        handleAcquire(requestId, args.stateDir, state, {
          backend,
          // Plan 03-04 (DIRECT-06, D-13): threaded down to
          // acquirePortAndLaunch()'s own gate (backend === "stock"); this
          // callback does NOT re-read VICE_BACKEND itself.
          allocateRemoteMonitorPort: (s: BrokerState, exclude: ReadonlySet<number>) => nextFreePort(s, { exclude }),
          // Phase 33, plan 33-06 (REPRO-05, D-15): the ALREADY-NARROWED
          // profile broker-control.mts handed this callback. Nothing here
          // re-validates it and nothing here reads a raw wire field --
          // normaliseLaunchProfile() is the single narrowing site, and it ran
          // before this callback was ever invoked.
          profile,
        }),
      onRelease: (requestId) => handleRelease(requestId, state),
      onRecycle: (targetId) => handleRecycleForRealBroker(targetId, state),
      onStatus: () => handleStatus(state),
      // Phase 34, plan 34-01 (SEAM-01): its OWN callback, wired alongside
      // (never derived from) the other six above -- handed only
      // `args.repoRoot` and a stderr logger, never this broker's `state` map,
      // so it structurally cannot reach lease state through this closure.
      // 34-09 (CR-04): deliberately supplies no timeout, and that is
      // authoritative here, not an omission -- the per-tool budget table
      // inside runHostTool()/hostToolTimeoutMs() (host-tool.mts) is the ONE
      // place a budget is decided, and no wire field carries one across the
      // seam at all (the `deps.timeoutMs` this callback could pass is an
      // in-process test seam, not something a caller's request ever
      // supplies). A reader arriving here from the artifact this plan's
      // completeness case checks should find this comment as the answer,
      // not an apparent gap.
      onHostTool: (raw: unknown) =>
        runHostTool(raw, {
          repoRoot: args.repoRoot,
          log: (line: string) => process.stderr.write(`${line}\n`),
        }),
      onMonitorClaim: (requestId, targetId, channel) => handleMonitorClaim(requestId, targetId, channel, state),
      onMonitorRelease: (requestId, targetId, channel) => handleMonitorRelease(requestId, targetId, channel, state),
      onHostState: (): HostStateFields => ({
        pid: process.pid,
        startedAt,
        nodeVersion: process.version,
        viceBin: resolveViceBinForHostState(),
        maxInstances: resolveCeilingForRecord(),
        basePort: resolveBasePort(),
        // WR-04: the verdict THIS process resolved once, at startup, above --
        // the same one every launch argv is built from. Never a second
        // resolvedBackend() call (backend-detect.mts's own prohibition).
        backend,
      }),
    });
  } catch (e) {
    // Criterion K / D-17 / D-18: CR-01 closes here. A well-known TCP port
    // cannot be bound twice, so EADDRINUSE is the kernel enforcing the
    // singleton -- but the guarantee holds only while the control port
    // keeps its default (two brokers deliberately configured onto
    // DIFFERENT ports are two brokers, and no code here or anywhere else
    // prevents that). On EADDRINUSE, broker.json arbitrates via the SAME
    // never_started/stale/alive classification vice-broker-client.ts's
    // readBrokerLiveness() uses (duplicated locally above -- see
    // classifyBrokerLivenessLocal()'s own header comment for why this
    // cannot be a value import), and takes exactly one of two DISTINCT
    // paths: a record classified alive means this process lost a genuine
    // race against a live broker -- exit quietly, status 0, as designed.
    // A record classified stale or never_started means the port is held by
    // something that does not answer as a broker at all -- fail loudly,
    // naming the port and what to check. Conflating these two would let a
    // squatted port masquerade as a healthy singleton, permanently and
    // silently (T-01.6.2-34). Neither path writes the discovery record,
    // launches an instance, or reaps again -- both simply exit.
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EADDRINUSE") {
      const liveness = classifyBrokerLivenessLocal(finalPath);
      if (liveness === "alive") {
        process.stderr.write(
          `vice-broker: another broker is already running and holds control port ${controlPort} -- exiting quietly as a second instance (record: ${finalPath})\n`,
        );
        process.exitCode = 0;
        return;
      }
      process.stderr.write(
        `vice-broker: FATAL -- control port ${controlPort} is held by something that does not answer as a broker (discovery record classified "${liveness}"). ` +
          `Check what is bound to port ${controlPort} on the host (e.g. \`lsof -i :${controlPort}\` or \`ss -ltnp\`) before restarting. Record: ${finalPath}\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`vice-broker: failed to start control listener: ${err.message}\n`);
    process.exitCode = 1;
    return;
  }

  // C5: every catchable shutdown path (SIGTERM/SIGINT/SIGHUP, an uncaught
  // exception, an unhandled rejection, normal exit) converges on ONE
  // re-entrant-safe teardown that identity-verified-kills every instance
  // this broker launched and clears the map unconditionally
  // (kill-never-recycle). Registered once the listener is up, since there is
  // nothing to tear down before that point.
  registerShutdownHandlers({ state });

  // A successful bind writes the record UNCONDITIONALLY, overwriting
  // whatever was there -- the bind itself is the proof of singleton status
  // (D-17). The thirteen-field set (D-27, criterion G; narrowed from
  // fourteen by plan 41-05): the lease time-to-live field the bash original
  // carried is gone -- the connection is the lease now (D-12) -- `warm_floor`
  // is likewise gone (plan 41-05: there is no warm floor left to echo a
  // configured value for) -- and every other config-echo field survives
  // even though no consumer parses it beyond a status message, because a
  // human reading this file by hand benefits from the full echo.
  let record: BrokerRecord = {
    version: 1,
    written_by: WRITTEN_BY,
    pid: process.pid,
    started_at: startedAt,
    heartbeat_at: new Date().toISOString(),
    node_version: process.version,
    control_host: listener.host,
    control_port: listener.port,
    control_token: token, // never logged -- T-01.6.2-02
    max_instances: resolveCeilingForRecord(),
    base_port: resolveBasePort(),
    poll_ms: pollMs,
    dry_run: args.dryRun,
  };
  writeBrokerRecordFile(args.stateDir, record);
  process.stderr.write(`vice-broker: wrote ${finalPath} (node ${record.node_version}); control listener bound on ${listener.host}:${listener.port}\n`);

  const heartbeatMs = Number(process.env.VICE_BROKER_HEARTBEAT_MS) || 30000;
  setInterval(() => {
    // The refresh path goes through the SAME atomic tmp-then-rename choke
    // point as the initial write (writeBrokerRecordFile() itself), and the
    // mode is tightened to owner-read-write on EVERY write, refresh
    // included -- never only on the first.
    record = { ...record, heartbeat_at: new Date().toISOString() };
    writeBrokerRecordFile(args.stateDir, record);
  }, heartbeatMs);

  // The fixed-order evaluation pass (runBrokerPass, broker-launch.mts):
  // serve pending acquires, then promote launching -> ready -- mirroring
  // vice-broker.sh's own broker_once() ordering (plan 41-05, folded todo:
  // the warm floor this pass used to maintain as its second concern is
  // RETIRED; see runBrokerPass()'s own comment in broker-launch.mts for what
  // the fixed order still buys now that only serveAcquires() ever launches
  // anything). Ticks on VICE_BROKER_POLL_MS (default 500, the SAME env var
  // name and semantics the bash daemon used). serveAcquires now drains the
  // arrival-ordered pending-acquire structure this listener instance owns
  // (D-08's mechanism; plan 02's own `serveAcquires: () => {}` comment
  // reserved exactly this room) -- an acquire queued because a launch was
  // already in flight is retried here, on the SAME pass that also promotes
  // any newly-ready instance, so a stalled pass shows up as a stale record
  // rather than a silently wrong one. Re-entrancy guarded: a pass that is
  // still running (e.g. a slow readiness probe against a genuinely slow
  // host) is never overlapped by the next tick.
  let passInFlight = false;
  setInterval(() => {
    if (passInFlight) return;
    passInFlight = true;
    runBrokerPass({
      serveAcquires: () => drainPendingAcquires(listener.pendingAcquires),
      promoteLaunching: () => promoteLaunchingForRealBroker(state, backend),
    })
      .catch((e) => {
        process.stderr.write(`vice-broker: evaluation pass failed: ${(e as Error).message}\n`);
      })
      .finally(() => {
        passInFlight = false;
      });
  }, pollMs);
}

/** Parses argv, evaluates the container guard FIRST -- before any state
 * directory is read or written and before anything is spawned (PD-03) --
 * then runs the long-lived broker. Never calls process.exit(); always sets
 * process.exitCode so pending I/O flushes first. */
export function main(argv: string[] = process.argv.slice(2)): void {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exitCode = 1;
    return;
  }

  if (args.checkContainer) {
    process.exitCode = containerGuardReport();
    return;
  }

  const guardRc = containerGuardEnforce();
  if (guardRc !== 0) {
    process.exitCode = guardRc;
    return;
  }

  run(args).catch((e) => {
    process.stderr.write(`vice-broker: ${(e as Error).message}\n`);
    process.exitCode = 1;
  });
}

// -------------------------------------------------------------------- CLI
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
