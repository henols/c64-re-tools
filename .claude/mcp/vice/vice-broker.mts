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
import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";

import { containerGuardReport, containerGuardEnforce } from "./container-guard.mjs";
import {
  createBrokerState,
  nextFreePort,
  countReady,
  countTotal,
  countLaunching,
  atCapacity,
  resolveBasePort,
  type BrokerState,
  type InstanceRecord,
} from "./broker-state.mjs";
import {
  acquirePortAndLaunch,
  maintainWarmFloor,
  probeReady,
  runBrokerPass,
  withCrashSupervision,
  type SuperviseChildDeps,
} from "./broker-launch.mjs";
import { verifiedKill, registerShutdownHandlers, startupBanner, reapOrphanedInstances, type KillStage } from "./broker-kill.mjs";
import { writeEpochRecord, epochPathFor, nextEpochFor, instanceLogDirFor, type EpochRecord } from "./broker-epoch.mjs";
import {
  startControlListener,
  newControlToken,
  drainPendingAcquires,
  resolveControlPort,
  type AcquireOutcome,
  type RecycleOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
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
 * otherwise `.vice-supervisor` under the repo root. */
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

  const resolvedStateDir = stateDir ?? process.env.VICE_POOL_DIR ?? (repoRoot ? join(repoRoot, ".vice-supervisor") : ".vice-supervisor");

  return { repoRoot: repoRoot ?? "", stateDir: resolvedStateDir, checkContainer, dryRun };
}

// The final fourteen-field set (plan 05, D-27, G/K): version, written_by,
// pid, started_at, heartbeat_at, node_version, control_host, control_port,
// control_token, warm_floor, max_instances, base_port, poll_ms, dry_run.
// The bash original's `ttl_seconds` field is DELETED, not merely renamed --
// it is one of criterion F's six retiring lease mechanisms; the connection
// is the lease now, and keeping a TTL-shaped field here would advertise an
// authority that no longer exists. Every other bash config-echo field is
// kept even though no consumer parses it beyond a status message
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
  warm_floor: number;
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
// Small, locally-duplicated env-var readers (plan 05) -- the SAME pattern
// broker-kill.mts's own resolveBasePortForReap()/resolveViceBinForReap()
// already established: this module cannot import broker-launch.mts's
// PRIVATE resolveWarmFloor()/resolveCeiling() (they are not exported, and
// this file is already the top-level wiring module value-importing every
// sibling .mjs directly -- exporting them would widen broker-launch.mts's
// own surface for a one-line env-var read this file can duplicate exactly
// as cheaply). Both mirror broker-launch.mts's defaults precisely
// (VICE_BROKER_WARM_FLOOR/1, VICE_BROKER_MAX/16) so broker.json's config echo
// and host_state's own answer can never disagree with what maintainWarmFloor
// itself actually enforces. The floor default dropped from 3 to 1 in
// 01.6.2.1-03-PLAN.md (D-06) -- BOTH readers changed together in that same
// commit, deliberately, because this invariant (the two numbers never
// disagree) breaks silently the moment only one of them moves. The
// ceiling's own default (16) is untouched by D-06 -- it is the unrun
// concurrency-ceiling spike's territory, not this phase's.
// ---------------------------------------------------------------------------
function resolveWarmFloorForRecord(): number {
  const raw = process.env.VICE_BROKER_WARM_FLOOR;
  if (raw === undefined || raw === "") return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

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
 * logs survive under .vice-supervisor/<port>/logs/, same paths, same
 * format as the retiring bash supervisor), returning both the spawn
 * closure and the log's path relative to supervisorDir (the epoch
 * record's own `log` field). Shared by both launch paths -- a cold
 * acquire and warm-floor maintenance -- so there is exactly one place that
 * opens a launch log fd. */
function makeLoggingSpawn(logDir: string): { spawn: (cmd: string, args: string[]) => ReturnType<typeof nodeSpawn>; logRelPath: string } {
  mkdirSync(logDir, { recursive: true });
  const viceBinForLog = basename(process.env.VICE_BIN ?? "x64sc");
  const logName = `${viceBinForLog}-${Date.now()}.log`;
  const logFd = openSync(join(logDir, logName), "a");
  return {
    spawn: (cmd, cmdArgs) => nodeSpawn(cmd, cmdArgs, { stdio: ["ignore", logFd, logFd] }),
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
 * once per launch, so both real launch paths (handleAcquire here; Task 2's
 * maintainWarmFloorForRealBroker) pass a structurally identical
 * SuperviseChildDeps object into the SAME shared wrapper. Deliberately does
 * NOT set spawnFactory: on a respawn, launchSupervised() (broker-launch.mts)
 * derives its own per-instance log path from instanceLogDirFor and names
 * that same path in the epoch record it writes -- supplying a competing
 * spawn factory here would produce two log files per respawn with the
 * epoch record naming the wrong one. Leaving it unset means a respawn's
 * output lands in the supervision module's own log file under the same
 * per-instance logs directory D-23 requires, and the epoch record names
 * the file that actually received the output. */
function superviseDepsFor(stateDir: string, state: BrokerState): SuperviseChildDeps {
  return {
    state,
    stateDir,
    epoch: { epochPathFor, instanceLogDirFor, nextEpochFor, writeEpochRecord },
    log: (line: string) => process.stderr.write(`${line}\n`),
  };
}

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
   * always used. */
  buildColdSpawnFactory?: (port: number) => (command: string, args: string[]) => ChildProcess;
  log?: (line: string) => void;
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
  },
): Promise<InstanceRecord | null> {
  for (const record of Array.from(state.instances.values())) {
    if (record.state !== "ready") continue;

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
    state.instances.delete(record.port);
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
  const probe = deps.probe ?? ((port: number) => probeReady(port));
  // Textually a verifiedKill( call site, not merely a reference -- reused
  // UNCHANGED from broker-kill.mts (Phase 01.6.2 criterion 6), never
  // re-derived, and never replaced by a bare process.kill().
  const kill = deps.kill ?? ((opts: { pid: number | null; expectedIdentity: string }) => verifiedKill(opts));
  const log = deps.log ?? ((line: string) => process.stderr.write(`${line}\n`));

  const winner = await selectWarmInstance(state, { probe, kill, log });

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
      spawnFactory:
        deps.buildColdSpawnFactory ??
        ((port: number) => {
          const supervisorDir = join(stateDir, String(port));
          const { spawn, logRelPath } = makeLoggingSpawn(join(supervisorDir, "logs"));
          lastLogRelPath = logRelPath;
          return withCrashSupervision("acquire", port, spawn, superviseDepsFor(stateDir, state));
        }),
    });

    if (!result.ok) {
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
      state.instances.delete(result.record.port);
      return { ok: false, reason: "internal" };
    }
    record = result.record;

    // Only the cold-launch arm ever writes a FRESH epoch record -- the warm
    // arm's winner already has one, written when it was warmed
    // (maintainWarmFloorForRealBroker()'s own onLaunched hook), and
    // rewriting it here would advance an epoch no restart caused, which the
    // container-side assertSameMachine() would read as a machine change.
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
    grant: { port: record.port, url: record.url, epochFile: record.epochFile, supervisorDir: record.supervisorDir },
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
  }));
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
  const killStage = await verifiedKill({ pid: instance.pid, expectedIdentity: instance.expectedIdentity });
  const outcome = killStage === "identity_refused" ? "identity_refused" : "ok";
  const reason = killStage === "identity_refused" ? "process identity did not match the recorded emulator binary -- the target was NOT signalled and is still running" : "";

  return { port: instance.port, pid: instance.pid, viceBin: instance.viceBin, killStage, epochBefore, outcome, reason };
}

/** The warm-floor concern of the fixed-order evaluation pass (D-24 drops
 * the projection write; the grant sweep does not appear -- D-12's
 * connection-is-the-lease). Builds a fresh MaintainWarmFloorDeps per call
 * (never reused across passes) wiring broker-state.mjs's real
 * allocatePort/counts and broker-launch.mjs's real probeReady, and hooks
 * onLaunched to write the SAME epoch record a cold acquire writes -- a
 * warm instance is a real process the moment it exists, per D-04.
 *
 * WR-04 (01.6.2.1-REVIEW.md): the log-path stash below is a LOCAL variable,
 * declared fresh once per call to THIS function -- exactly mirroring how
 * handleAcquire()'s own equivalent cold-launch log-path variable
 * (`lastLogRelPath`) is already scoped locally rather than to the module.
 * Both the write site (the spawn-wrapping closure) and the read site (the
 * `onLaunched` callback) live inside this SAME function body, so this is a
 * pure relocation with no behavioural change -- it removes the
 * cross-call-sharing risk a module-level `let` carried (correct only
 * because of invariants -- at most one launch per call, never invoked
 * concurrently with itself -- enforced elsewhere and never checked at the
 * point the variable used to be declared). */
function maintainWarmFloorForRealBroker(stateDir: string, state: BrokerState): Promise<void> {
  let lastWarmLaunchLogRelPath = "";
  return maintainWarmFloor({
    state,
    stateDir,
    spawnFactory: (port: number) => {
      const supervisorDir = join(stateDir, String(port));
      const { spawn, logRelPath } = makeLoggingSpawn(join(supervisorDir, "logs"));
      const stashingSpawn = (cmd: string, args: string[]): ChildProcess => {
        const child = spawn(cmd, args);
        // Stash the log path where onLaunched (fired synchronously right
        // after this returns, still within the SAME maintainWarmFloor()
        // call -- at most one launch per call, per the serialised-warming
        // invariant) can find it. withCrashSupervision() below composes
        // AROUND this function, so the stash still runs (and still
        // completes before onLaunched reads it) before the exit listener
        // is ever attached.
        lastWarmLaunchLogRelPath = logRelPath;
        return child;
      };
      return withCrashSupervision("spare", port, stashingSpawn, superviseDepsFor(stateDir, state));
    },
    probe: (port: number) => probeReady(port),
    allocatePort: nextFreePort,
    countReady,
    countTotal,
    countLaunching,
    onLaunched: (record: InstanceRecord) => {
      writeEpochForLaunch(record, lastWarmLaunchLogRelPath);
    },
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
    state.grants.delete(requestId);
    state.instances.delete(grant.port);
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

  // D-18: the singleton guarantee holds only while the control port keeps its default -- two brokers deliberately configured onto different ports are two brokers, and no code prevents that.
  let listener: Awaited<ReturnType<typeof startControlListener>>;
  try {
    listener = await startControlListener({
      host: controlHost,
      port: controlPort,
      token,
      onAcquire: (requestId) => handleAcquire(requestId, args.stateDir, state),
      onRelease: (requestId) => handleRelease(requestId, state),
      onRecycle: (targetId) => handleRecycleForRealBroker(targetId, state),
      onStatus: () => handleStatus(state),
      onHostState: (): HostStateFields => ({
        pid: process.pid,
        startedAt,
        nodeVersion: process.version,
        viceBin: resolveViceBinForHostState(),
        warmFloor: resolveWarmFloorForRecord(),
        maxInstances: resolveCeilingForRecord(),
        basePort: resolveBasePort(),
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
  // (D-17). The fourteen-field set (D-27, criterion G): the lease
  // time-to-live field the bash original carried is gone -- the connection
  // is the lease now (D-12) -- and every other config-echo field survives
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
    warm_floor: resolveWarmFloorForRecord(),
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
  // serve pending acquires, then maintain the warm floor -- mirroring
  // vice-broker.sh's own broker_once() ordering. Ticks on
  // VICE_BROKER_POLL_MS (default 500, the SAME env var name and semantics
  // the bash daemon used). serveAcquires now drains the arrival-ordered
  // pending-acquire structure this listener instance owns (D-08's
  // mechanism; plan 02's own `serveAcquires: () => {}` comment reserved
  // exactly this room) -- an acquire queued because a launch was already in
  // flight is retried here, on the SAME pass that also maintains the warm
  // floor, so a stalled pass shows up as a stale record rather than a
  // silently wrong one. Re-entrancy guarded: a pass that is still running
  // (e.g. a slow readiness probe against a genuinely slow host) is never
  // overlapped by the next tick.
  let passInFlight = false;
  setInterval(() => {
    if (passInFlight) return;
    passInFlight = true;
    runBrokerPass({
      serveAcquires: () => drainPendingAcquires(listener.pendingAcquires),
      maintainWarmFloor: () => maintainWarmFloorForRealBroker(args.stateDir, state),
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
