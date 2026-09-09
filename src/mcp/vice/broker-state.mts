// broker-state.mts
//
// C4 (complete, plan 02): the in-process state that replaces six on-disk
// locations -- two Maps plus a process-scoped Set, the 6600 port band
// (D-18), the full port-scan allocator, and the three running counts
// (countReady/countTotal/countLaunching) every launch path consults. Plan
// 01 left this module minimal (state shape + a single-candidate port probe
// only); this completes it.
//
// BrokerDeps is the injectable spawn/clock/readiness-probe/port-probe seam
// every launch, kill and probe test uses -- an architectural feature from
// the first commit that defined BrokerState, rather than a retrofit once a
// test needs it.
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
// TYPE-ONLY import, deliberately -- the SAME discipline broker-launch.mts's
// own `import type { BrokerState, ... } from "./broker-state.mjs"` uses in the
// opposite direction, and for the same reason: `import type` is fully erased
// under this project's verbatimModuleSyntax/isolatedModules settings, so the
// ".mjs" specifier never becomes a real runtime resolution and the pair of
// modules cannot form a load-time cycle. A VALUE import here would.
import type { LaunchProfile } from "./broker-launch.mjs";

// ---------------------------------------------------------------------------
// MonitorChannel (plan 41-03, D-14): exactly two channels exist -- stock VICE
// exposes precisely the binary monitor and the `-remotemonitor` text
// channel -- and this project has no plan to add a third. Frozen so a
// consumer cannot accidentally push a third value onto it at runtime.
//
// Declared here a SECOND time in channel-lock.ts (and a third time, as a
// local literal union, in vice-broker-client.ts) rather than imported from a
// single shared home: channel-lock.ts is a container-side module and this
// module is host-bound and compiled into resources/*.mjs, so neither can
// import the other at runtime. The shared thing between the declarations is
// the two-value CONTRACT ("binary" | "text"), not the declaration itself.
// ---------------------------------------------------------------------------
export const MONITOR_CHANNELS = Object.freeze(["binary", "text"] as const);
export type MonitorChannel = (typeof MONITOR_CHANNELS)[number];

export type InstanceState = "launching" | "ready" | "granted";

export interface InstanceRecord {
  port: number;
  url: string;
  state: InstanceState;
  reason: string;
  epochFile: string;
  supervisorDir: string;
  pid: number | null;
  expectedIdentity: string;
  launchedAt: number;
  readyAt: number | null;
  viceBin: string;
  viceArgs: string[];
  dryRun: boolean;
  // ------------------------------------------------------------------
  // Plan 03 (C2/D-23): the per-child supervisor's own bookkeeping fields.
  // Optional -- a record created through a path that does not supervise
  // (e.g. a caller with its own lifecycle) remains a valid InstanceRecord
  // without them; broker-launch.mts's superviseChild() is the one writer
  // that always sets all five together, immediately after every launch.
  // ------------------------------------------------------------------
  /** The current epoch integer for this instance -- mirrored into the
   * epoch.json record broker-epoch.mts writes (D-04). */
  epoch?: number;
  /** Set BEFORE any signal is sent to this instance's child (T-01.6.2-21)
   * -- the exit handler reads this to distinguish a broker-ordered death
   * from a crash (respawn). NARROWED (plan 13): this field alone no longer
   * decides whether a replacement follows -- it answers only "did the
   * broker order this death," never "should a replacement follow." That
   * second, separate question is respawnAfterKill below. Before plan 13
   * there was exactly one kind of broker-ordered death (a release, which
   * never respawns), so one boolean silently answered both questions; a
   * recycle introduces a second kind whose answer to the second question
   * differs, which is why the two are split here. The name is kept
   * unchanged even though its meaning narrowed: five rows of
   * 01.6.2-VALIDATION.md's disposition ledger cite, by exact test name, the
   * shutdown test whose title contains it, and renaming would force
   * cosmetic edits to the artifact whose honesty is this gap closure's own
   * first failed truth. Without this field, EVERY broker-ordered death
   * would be misread as a crash and respawned, silently breaking
   * kill-never-recycle. */
  deliberateKill?: boolean;
  /** The answer to a question separate from deliberateKill's own: whether a
   * replacement follows this broker-ordered death, on the SAME port. Set
   * TOGETHER with deliberateKill, before any signal is sent (same ordering
   * requirement, same reason) -- vice-broker.mts's shared marker-and-intent
   * setter is the one place that sets both together, so no call site can
   * set one and forget the other. Absent or false means the death is final
   * (a release); true means the exit handler relaunches on the same port,
   * carrying the pre-kill crash history and backoff forward UNCHANGED and
   * restoring a granted pre-kill state (a recycle). Meaningless when
   * deliberateKill is not also set -- an unexplained crash never consults
   * this field. */
  respawnAfterKill?: boolean;
  /** Timestamps (ms, per the injected clock) of this instance's recent
   * crashes still inside the crash window -- carried FORWARD across
   * respawns (a fresh InstanceRecord is created on every relaunch) so the
   * give-up threshold is evaluated against the instance's whole crash
   * history, not just its latest incarnation. */
  crashTimes?: number[];
  /** The CURRENT backoff delay (ms) this instance would wait before its
   * NEXT respawn -- starts at the configured initial delay, doubles on
   * each consecutive crash, clamped at the configured ceiling
   * (T-01.6.2-20). */
  backoffMs?: number;
  /** Absolute path to this instance's current boot/crash log file --
   * derived from the SAME per-instance log-directory function
   * (broker-epoch.mts's instanceLogDirFor) the epoch record's own `log`
   * field is derived from, so the two can never disagree. */
  logPath?: string;
  // ------------------------------------------------------------------
  // Plan 05 (BROK-02/PROTO-08, D-13/D-15), PROMOTED to a per-channel map by
  // plan 41-03 (D-14): exclusive monitor-socket ownership, enforced
  // broker-side, now keyed by MonitorChannel. NON-OPTIONAL -- every record
  // carries a `monitorClients` object from construction
  // (spawnAndRecordInstance() in broker-launch.mts defaults it to `{}`), so
  // "no claim on any channel" is an EMPTY MAP, never an absent field --
  // deliberately, so the single-holder reading this promotion replaces
  // cannot survive by omission. The SINGLE WRITER of an entry is
  // vice-broker.mts's onMonitorClaim/onMonitorRelease control-plane
  // handlers (handleMonitorClaim/handleMonitorRelease): an entry is set on
  // a successful monitor_claim for that channel, cleared by
  // clearMonitorClient() below for that one channel on an explicit
  // monitor_release, and cleared for EVERY channel together on this
  // instance's own release/recycle (vice-broker.mts's handleRelease() /
  // handleRecycleForRealBroker()) and on the instance's process exit
  // (broker-launch.mts's crash-supervision handleExit()) -- so a client
  // that died without releasing can never permanently lock the instance on
  // any channel.
  //
  // NAMED PITFALL (RESEARCH.md Common Pitfalls #2): this is NOT the same
  // question GrantRecord.pid already answers. GrantRecord says "which
  // container-side process holds this instance's LIFECYCLE grant" -- issued
  // at acquire time, strictly BEFORE the client has dialled either monitor
  // socket at all. This field says "has THIS CHANNEL's raw socket actually
  // been claimed" -- a later, separate, per-channel event. Treating the
  // existing grant as already solving exclusive monitor-client ownership is
  // the mistake this comment exists to head off.
  //
  // MONITOR-OWNERSHIP DECISION (plan 41-03, D-14): the holder map is keyed
  // by channel ("binary" | "text", MonitorChannel above). Both channels may
  // be claimed SIMULTANEOUSLY by the SAME grant, and claiming one channel
  // never evicts, and is never refused by, the other channel's holder. This
  // map is bookkeeping for SOCKET OWNERSHIP ONLY -- no halting operation
  // anywhere in this tree consults it; cross-channel serialization of
  // halting operations is entirely channel-lock.ts's in-process mutex's job
  // (Phase 39's `go` verdict, rule R15), never this map's. The
  // `-remotemonitor` text-monitor port IS dialed (text-connect.ts's
  // textConnect(), plan 41-01) -- this comment hands no further
  // discriminator work to a future phase.
  // ------------------------------------------------------------------
  /** Keyed by channel; an entry is set by a successful `monitor_claim` for
   * that channel and cleared by clearMonitorClient(). `pid` mirrors
   * GrantRecord.pid's own convention -- the EMULATOR CHILD PROCESS's pid
   * (this instance's own `pid` field at claim time), not the connecting
   * client's pid, which this broker cannot observe over TCP. */
  monitorClients: Partial<Record<MonitorChannel, { grantId: string; claimedAt: number; pid: number | null }>>;
  // ------------------------------------------------------------------
  // Plan 03-04 (DIRECT-06, D-13); made MANDATORY on every stock record by
  // plan 41-05 (D-16): the SECOND, broker-allocated port stock's
  // `-remotemonitor` text monitor binds, alongside `-binarymonitor` on
  // `port` above. PRESENT on every stock record, ABSENT ONLY on the fork --
  // a stock launch that cannot bind a text-monitor port now fails the WHOLE
  // acquire (broker-launch.mts's acquirePortAndLaunch(), `no_free_text_port`)
  // rather than producing a portless stock record; there is no longer a
  // "second allocation failed" case for this field to be absent on. The
  // field stays optional in the TYPE (the fork case is real, and this is a
  // structural type, not a discriminated union keyed on backend) -- the
  // stock invariant is enforced as a runtime assertion at the one
  // construction site (broker-launch.mts's spawnAndRecordInstance()), not a
  // type-level claim the fork case would violate. Dialed since plan 41-01
  // (text-connect.ts's textConnect()) -- see the MONITOR-OWNERSHIP DECISION
  // banner above for the ownership discipline now governing this socket.
  // ------------------------------------------------------------------
  /** The second, broker-allocated port stock's `-remotemonitor` text
   * monitor binds -- present on every stock record, absent only on the
   * fork (D-16). See the banner above for the ownership discipline
   * governing this socket. */
  remoteMonitorPort?: number;
  // ------------------------------------------------------------------
  // Phase 33, plan 33-06 (REPRO-05, D-15/D-16): the launch profile this
  // instance was actually SPAWNED with -- the two additive launch knobs
  // (`warp`, `headless`) buildViceArgs() turned into `-warp` / `-console`.
  // Optional, in exactly the register the Plan 03 block above uses, and for
  // two distinct reasons that both have to hold:
  //
  //   1. A record created through a path that requests no profile remains a
  //      valid InstanceRecord without this field -- every pre-33-06 caller
  //      and every fork launch (plan 41-05, folded todo: the warm-floor
  //      spare this comment used to name here is retired -- there is no
  //      longer a speculative launch path to be profile-less by omission).
  //   2. A broker restarted mid-phase reads state-directory records written
  //      BEFORE this field existed (33-RESEARCH.md § Runtime State
  //      Inventory). ABSENT MEANS PROFILE-LESS, so such a broker degrades to
  //      today's semantics rather than to an error.
  //
  // DO NOT give this field a default value. An explicit `{}` and an absent
  // field must behave IDENTICALLY -- vice-broker.mts's profileEligible()
  // treats both as "no knobs requested" by comparing `=== true` on each
  // side, so `undefined` and `false` are the same request. A default here
  // would make `{}` and absence two different records for one intent, and
  // an eligibility rule that distinguishes them would refuse warm instances
  // for no reason a caller could see.
  //
  // WHY IT IS ON THE RECORD AT ALL (D-16): warp is fixed at spawn -- there
  // is no runtime `WarpMode` resource on stock at all (vsync.c:220-241,
  // deliberately; measured `err=0x01` OBJECT_MISSING over RESOURCE_GET on
  // 3.9), so a pre-warmed interactive instance CANNOT be retro-warped. The
  // eligibility rule therefore has to compare what an instance WAS launched
  // with against what a request ASKS for, which means the launch profile has
  // to outlive the launch call. A mismatch makes the instance INELIGIBLE (it
  // is never adjusted, never killed and never relaunched to re-warp it) and
  // the acquire falls through to a dedicated cold launch.
  // ------------------------------------------------------------------
  /** The launch profile this instance was spawned with -- see the banner
   * above. Absent means profile-less; never defaulted. */
  profile?: LaunchProfile;
}

/** Clears ONE channel's entry when `channel` is passed (an explicit
 * `monitor_release` for that channel), or EVERY channel's entry when it is
 * omitted (the whole record's ownership is going away -- recycle, release,
 * or the instance's own process exit; see InstanceRecord.monitorClients'
 * own header comment for the exact call sites of each case) -- so a dead or
 * torn-down client can never hold this lock forever, on any channel. The
 * ONE place a holder entry is cleared, apart from broker-launch.mts's
 * handleExit(), which assigns `{}` directly for a documented reason (see
 * that function's own comment). A no-op when the targeted channel (or, with
 * no channel, every channel) is not currently held -- idempotent, matching
 * monitor_release's own tolerance for an already-cleared record. */
export function clearMonitorClient(record: InstanceRecord, channel?: MonitorChannel): void {
  if (channel !== undefined) {
    delete record.monitorClients[channel];
    return;
  }
  for (const ch of MONITOR_CHANNELS) delete record.monitorClients[ch];
}

export interface GrantRecord {
  id: string;
  port: number;
  grantedAt: number;
  /** The pid of the process THIS grant was actually issued for, recorded at
   * grant time (handleAcquire()'s own single state.grants.set() call site,
   * vice-broker.mts). REQUIRED, not optional -- a grant with no identity to
   * check against is exactly the gap CR-01's blast radius exploited:
   * handleRelease() used to resolve its kill target purely by CURRENT port
   * occupant (state.instances.get(grant.port)), which is unsafe against ANY
   * event that swaps a port's occupant without also clearing the grant (a
   * concurrent-acquire race, an ordinary crash-and-respawn that frees the
   * port for an unrelated cold launch, or a give-up). Comparing this field
   * against the port's current occupant's own pid before releasing is what
   * proves "the same process this grant was actually issued for," not
   * merely "whatever now holds this port number." A legitimate recycle
   * (broker-launch.mts's handleExit()) keeps this field in sync with the
   * respawned record's own pid, so the check never misfires against this
   * project's own kill-never-recycle design. */
  pid: number | null;
}

export interface BrokerState {
  instances: Map<number, InstanceRecord>;
  grants: Map<string, GrantRecord>;
  /** Process-scoped, never persisted. Two distinct populations live here:
   *
   * 1. Ports that FAILED to bind, added by nextFreePort() itself and blocked
   *    for the lifetime of this broker process -- never released, since a
   *    port refused once is not worth re-probing until the next reboot.
   * 2. The second (`-remotemonitor`) port of a live stock instance, added by
   *    broker-launch.mts's acquirePortAndLaunch() -- this one IS released,
   *    by that module's deleteInstanceRecord(), the moment the instance
   *    holding it is torn down for good (CR-02, 03-REVIEW.md). It survives a
   *    crash-respawn or a recycle, because the replacement instance reuses the
   *    same second port exactly as it reuses the same primary port.
   *
   * Nothing here distinguishes the two: population 2's entries are simply
   * removed by port number when their owning record is deleted, and a
   * population-1 entry is never a candidate for that removal because it was
   * never handed to an instance in the first place. */
  blockedPorts: Set<number>;
}

export function createBrokerState(): BrokerState {
  return { instances: new Map(), grants: new Map(), blockedPorts: new Set() };
}

// ---------------------------------------------------------------------------
// FINDING 1 (recorded per this plan's own acceptance criteria -- a positive
// finding, not an oversight): vice-broker.sh's drop_dead_instance_records()
// (resources/vice-broker.sh:1792-1831) -- the start-time validator that
// dropped any grant/warm-instance record whose pid was dead or mismatched, because a
// ghost record could otherwise survive a broker stop, a broker start, and a
// full host restart -- HAS NO EQUIVALENT HERE, AND NEEDS NONE. A fresh
// broker process starts with an EMPTY instances Map by construction
// (createBrokerState() above): there is no stale record to drop, because
// there is no record until THIS broker instance itself creates one via
// tryLaunchOne() (broker-launch.mts). This is exactly what "state in one
// place, in process" (C4) buys -- the entire CLASS of bug that function
// existed to catch cannot occur when the record lives only in the process's
// own memory. Not a gap; a strengthening.
//
// FINDING 2 (also recorded per this plan's own acceptance criteria):
// broker-instances.json -- the pure projection of grants+warm instances that
// write_instances()/read_instance_field() (resources/vice-broker.sh:958-
// 1043) rebuilt every single pass, with no confirmed consumer outside the
// bash daemon's own `status` subcommand -- is DROPPED ENTIRELY per D-24.
// With state in-process and a control plane in place (Phase 01.6.2 plan 01),
// "what instances exist" becomes a control-plane query plan 05 adds
// (status/host_state), answered on demand from this exact Map -- strictly
// better than a file that can go stale between passes.
// ---------------------------------------------------------------------------

/** The spawn/clock/readiness-probe/port-probe seam every launch, kill and
 * probe test uses. `spawn` and `now` are broker-launch.mts's own;
 * `probeReady` is broker-launch.mts's readiness probe (a *record*-shaped
 * convenience wrapper around this module's port-oriented `probeReady`);
 * `portInUse` is this module's own allocation-time seam (plan 02),
 * defaulting to `defaultPortInUse` below -- threaded through
 * `nextFreePort()`'s own options bag directly rather than required on every
 * caller of this interface, since most callers (tests especially) inject it
 * without constructing a full BrokerDeps object. */
export interface BrokerDeps {
  spawn: (command: string, args: string[]) => ChildProcess;
  now: () => number;
  probeReady: (record: InstanceRecord) => Promise<boolean>;
  portInUse?: PortInUseProbe;
}

export interface StateSnapshot {
  instances: InstanceRecord[];
  grants: GrantRecord[];
  blockedPorts: number[];
}

/** Deep, plain-object copy of `state` for tests -- a real, typed, named
 * export imported directly by test files, modelled on build.ts's own
 * exported build(). Never a global, never a subprocess-and-inspect round
 * trip. */
export function _snapshotState(state: BrokerState): StateSnapshot {
  return {
    // Phase 33, plan 33-06: `profile` is the SECOND nested object on an
    // InstanceRecord (after `viceArgs`), so it needs its own copy for this
    // function's documented "deep, plain-object copy" contract to stay true --
    // a spread alone would hand a caller a reference into live broker state,
    // and this file's own snapshot test asserts that mutating a nested value
    // in the result leaves the broker's state unchanged. The key is
    // reproduced only when present, so an absent profile stays absent in the
    // snapshot (absent means profile-less, and a snapshot must not invent a
    // `profile: undefined` key that the record itself does not carry).
    instances: Array.from(state.instances.values()).map((r) => ({
      ...r,
      viceArgs: [...r.viceArgs],
      ...(r.profile === undefined ? {} : { profile: { ...r.profile } }),
    })),
    grants: Array.from(state.grants.values()).map((g) => ({ ...g })),
    blockedPorts: Array.from(state.blockedPorts).sort((a, b) => a - b),
  };
}

/** VICE_BROKER_BASE_PORT's default (D-18): the broker's port band moves
 * from 6510 to 6600 in this phase -- 6510-6599 stays reserved by convention
 * for an x64sc a human launches for their own work. */
export const DEFAULT_BASE_PORT = 6600;

/** Scan ceiling matching vice-broker.sh's own next_free_port(): exactly one
 * hundred candidates starting at (and including) the base port. Bounded so
 * an exhausted host produces one explicit `no_free_port` result rather than
 * an unbounded scan. */
const PORT_SCAN_CEILING = 100;

/** Exported (plan 05): vice-broker.mts's host_state control-plane response
 * and broker.json's own `base_port` field both need the SAME resolved base
 * port this allocator itself uses -- reading it here rather than
 * re-duplicating the env-var lookup a third time keeps the two values
 * structurally unable to disagree. */
export function resolveBasePort(): number {
  const raw = process.env.VICE_BROKER_BASE_PORT;
  if (raw === undefined || raw === "") return DEFAULT_BASE_PORT;
  const n = Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_BASE_PORT;
}

export type PortInUseProbe = (port: number) => Promise<boolean>;

/** Real default: attempts to bind the candidate port on 127.0.0.1 and
 * immediately releases it. Answers ONLY "is a TCP listener already bound
 * here" -- the exact question vice-broker.sh's own /dev/tcp-based
 * port_in_use() asked, and deliberately never reused as a readiness check
 * (see broker-launch.mts's probeReady() header comment for why those two
 * questions are never conflated: a C64 can accept a connection before it
 * has finished booting). EADDRINUSE means genuinely in use; any other
 * listen error is treated as "not in use" -- cheaper and clearer than
 * letting a launch fail later for an unrelated reason. */
export function defaultPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      resolve(err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, "127.0.0.1");
  });
}

export interface PortAllocated {
  ok: true;
  port: number;
}

export interface PortAllocationExhausted {
  ok: false;
  reason: "no_free_port";
}

/** A discriminated result naming WHY allocation failed rather than throwing,
 * so the control plane can answer the `no_free_port` error code (already a
 * named ControlErrorCode in broker-control.mts) with no try/catch around
 * the allocator. */
export type PortAllocationResult = PortAllocated | PortAllocationExhausted;

export function isPortBlocked(state: BrokerState, port: number): boolean {
  return state.blockedPorts.has(port);
}

/** Remembers a refused port for the lifetime of THIS broker process only --
 * never persisted. A port refused now may be free after the next reboot;
 * persisting the refusal would silently shrink the allocation band
 * forever. Idempotent: blocking an already-blocked port is a no-op. */
export function blockPort(state: BrokerState, port: number): void {
  state.blockedPorts.add(port);
}

export interface NextFreePortOptions {
  basePort?: number;
  portInUse?: PortInUseProbe;
  /** Plan 03-04 (D-13): ports to skip that are NOT yet reflected in
   * `state.instances` -- the primary port allocated for a stock launch's
   * `-binarymonitor` bind has already been decided by the moment the SECOND
   * (`-remotemonitor`) port is allocated, but its `InstanceRecord` does not
   * exist yet (spawnAndRecordInstance() has not run), so without this
   * option the second allocation could return the SAME candidate the first
   * one just claimed. An excluded candidate is NOT added to
   * `state.blockedPorts` -- it is not refused, only already spoken for by
   * this same caller. */
  exclude?: ReadonlySet<number>;
}

/** Allocates the lowest free port at or above the base port (default 6600
 * per D-18, overridable via VICE_BROKER_BASE_PORT -- the same env var name
 * the bash daemon used), scanning up to PORT_SCAN_CEILING candidates.
 * "Free" means: not already recorded in the instance map (granted,
 * launching or ready all occupy their port), not already in the
 * process-scoped blocked set, and not reported in use by the injectable
 * port-in-use probe (defaulting to defaultPortInUse's real bind-and-release
 * check). A candidate the probe reports as in use is added to the blocked
 * set before scanning continues, so it is never re-offered or re-probed by
 * this process again. Never throws -- returns a typed failure naming
 * exhaustion when every candidate in the window is taken. */
// Gap closure (plan 14, discovered live during Task 2's own end-to-end
// proof -- see RE-FINDINGS.md's dated entry for the full account):
// EADDRINUSE is delivered to defaultPortInUse()'s `error` listener without
// ever yielding to libuv's poll phase, so a scan running against MANY
// already-bound candidates in a row does not merely take longer -- for its
// ENTIRE duration, the control listener cannot accept a new connection or
// read data already sitting on an existing one (verified live: a second,
// already-established connection's own request was not read by this
// process until the ENTIRE scan, spawn and record sequence had already
// resolved, confirmed with the real production functions in isolation
// before this fix). That is a real liveness gap independent of this
// plan's own test -- a release, a recycle or a status request over an
// UNRELATED connection would be held up for as long as a contended scan
// takes, not merely a competing acquire. Yielding via setImmediate every
// few candidates restores that liveness at negligible cost (the scan
// itself already costs one real bind-and-release round trip per
// candidate; this adds one cheap timer-phase turn every YIELD_EVERY of
// them) without changing what this function returns for any input.
const YIELD_EVERY_N_CANDIDATES = 5;

export async function nextFreePort(state: BrokerState, opts: NextFreePortOptions = {}): Promise<PortAllocationResult> {
  const basePort = opts.basePort ?? resolveBasePort();
  const portInUse = opts.portInUse ?? defaultPortInUse;
  const limit = basePort + PORT_SCAN_CEILING;

  let checked = 0;
  for (let port = basePort; port < limit; port++) {
    if (state.instances.has(port)) continue;
    if (opts.exclude?.has(port)) continue;
    if (isPortBlocked(state, port)) continue;
    if (await portInUse(port)) {
      blockPort(state, port);
      checked++;
      if (checked % YIELD_EVERY_N_CANDIDATES === 0) {
        await new Promise((resolvePromise) => setImmediate(resolvePromise));
      }
      continue;
    }
    return { ok: true, port };
  }
  return { ok: false, reason: "no_free_port" };
}

/** Counts ready, unclaimed instances -- filters the SAME in-memory map every
 * other count reads, no filesystem access anywhere in this expression. */
export function countReady(state: BrokerState): number {
  let n = 0;
  for (const record of state.instances.values()) {
    if (record.state === "ready") n++;
  }
  return n;
}

/** Counts every launched instance regardless of state (launching, ready or
 * granted) -- the denominator of the total <= VICE_BROKER_MAX ceiling. */
export function countTotal(state: BrokerState): number {
  return state.instances.size;
}

/** Counts instances currently "launching" -- THE single counter both launch
 * paths (a cold acquire, via handleAcquire in vice-broker.mts, and warm
 * floor maintenance, via maintainWarmFloor in broker-launch.mts) consult
 * before starting a new launch. Two counters that could ever disagree about
 * whether a boot is already under way is exactly how the two bash launch
 * paths raced each other into the 2026-08-01 outage (three simultaneous
 * x64sc launches: one SEGV, one exit 1, one exit 0 at the identical spawn
 * second) -- there is now exactly one, read here and nowhere else. */
export function countLaunching(state: BrokerState): number {
  let n = 0;
  for (const record of state.instances.values()) {
    if (record.state === "launching") n++;
  }
  return n;
}

function resolveCeiling(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_MAX;
  if (raw === undefined || raw === "") return 16;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 16;
}

/** True once countTotal() has reached the configured instance ceiling
 * (VICE_BROKER_MAX, default 16, untouched by this phase). A cold acquire
 * consults this BEFORE attempting to allocate a port or spawn (plan 05's
 * control-plane `at_capacity` error code), so an at-capacity host answers
 * without ever touching the port allocator. */
export function atCapacity(state: BrokerState, ceiling?: number): boolean {
  return countTotal(state) >= resolveCeiling(ceiling);
}
