// broker-kill.mts
//
// D (complete, this plan -- 01.6.2-04): the identity-verified kill discipline,
// ported from resources/vice-broker.sh's signal_recorded_pid()/
// signal_vice_child_pid(): zero-signal liveness check, identity check against
// the process's own argument string, SIGTERM, poll-then-SIGKILL. The
// expected-identity string always comes from the instance record (the
// resolved binary path recorded at spawn time by broker-launch.mts), never a
// module constant -- this broker spawns the emulator directly and there is
// no intermediate supervising script for an identity check to match against.
// See this module's own history: the bash original's PARAMETERISED sibling
// (signal_vice_child_pid, matched against a caller-supplied binary) is the
// model this ported; its hardcoded sibling (signal_recorded_pid, matched
// against $SUPERVISOR_SCRIPT) is NOT -- there is no supervisor script in
// this topology, so carrying that constant forward would make every kill
// silently refuse while logging a plausible-looking pid-reuse warning.
//
// This task also completes the module with two further concerns, both
// depending on the kill discipline above rather than replacing it:
//   - shutdown()/registerShutdownHandlers(): every catchable teardown path
//     (SIGTERM, SIGINT, SIGHUP, an uncaught exception, an unhandled
//     rejection, normal exit) converges on one re-entrant-safe teardown that
//     identity-verified-kills every instance and clears the map
//     unconditionally (kill-never-recycle). The uncatchable signals (SIGKILL,
//     SIGSTOP) are deliberately unhandled -- see registerShutdownHandlers()'s
//     own comment.
//   - reapOrphanedInstances(): the unconditional startup reap (criterion I,
//     D-15) that reaches instances this broker process has no in-memory
//     record of, derived from the emulator port band plus this broker's OWN
//     on-disk allocation record (epoch.json) -- never a host process
//     listing or a scan of another process's argv (02-03-PLAN.md/D-14/D-15;
//     see reapOrphanedInstances()'s own header comment for the incident
//     this revision closes).
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// TYPE-ONLY imports, deliberately -- this module is imported directly
// (unbuilt, native Node type-stripping) by its own test file and by
// broker-e2e.test.ts, exactly like broker-launch.mts already is (plan 02's
// finding: a VALUE import of a sibling ".mjs" specifier only resolves once
// both siblings are compiled by tsc into resources/; it cannot resolve when
// THIS file is loaded directly as ".mts" source). BrokerState/InstanceRecord
// (shutdown's own target) and EpochRecord (the reap's epoch-bump payload
// shape) are referenced as TYPES only; the epoch-writer FUNCTIONS
// (epochPathFor/nextEpochFor/writeEpochRecord) are taken as required,
// injected dependencies on ReapOrphanedInstancesOptions below instead of
// being value-imported -- the same EpochWriterDeps shape superviseChild()
// (broker-launch.mts) already established for the identical reason.
// vice-broker.mts (which is only ever executed from its BUILT
// resources/vice-broker.mjs form) supplies the real functions at the real
// wiring site; tests inject their own.
import type { BrokerState } from "./broker-state.mjs";
import type { EpochRecord } from "./broker-epoch.mjs";

/** The same four-value vocabulary resources/vice-broker.sh's
 * signal_vice_child_pid() already returns -- the recycle ack contract
 * (vice-proxy.ts's recycleAckOutcomeMessage()/successfulKill check) depends
 * on this exact set of words, never a fifth. That renderer is NOT changing,
 * so a renamed or added stage word silently breaks an agent-facing message;
 * this type is pinned to it, not the other way around. */
export type KillStage = "already_exited" | "identity_refused" | "sigterm" | "sigkill";

export interface VerifiedKillDeps {
  isAlive?: (pid: number) => boolean;
  readProcessArgs?: (pid: number) => string;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  sleepMs?: (ms: number) => Promise<void>;
  killWaitS?: number;
}

export interface VerifiedKillOptions {
  pid: number | null;
  expectedIdentity: string;
  deps?: VerifiedKillDeps;
}

const defaultIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const defaultReadProcessArgs = (pid: number): string => {
  try {
    return execFileSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf8" });
  } catch {
    return "";
  }
};

const defaultKill = (pid: number, signal: NodeJS.Signals): void => {
  try {
    process.kill(pid, signal);
  } catch {
    // already gone -- idempotent by design, matching the bash version's `|| true`
  }
};

const defaultSleepMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function resolveKillWaitS(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_KILL_WAIT_S;
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : 5;
}

function defaultLog(line: string): void {
  process.stderr.write(`${line}\n`);
}

/** Implements the discipline exactly as signal_recorded_pid()/
 * signal_vice_child_pid() do. An empty/null/non-positive pid, or a pid
 * already gone, returns "already_exited" without ever signalling -- "the
 * machine being gone is the goal", per the bash version's own comment. An
 * EMPTY expectedIdentity is REFUSED outright (CR-04 -- see the guard's own
 * comment below), as is a live pid whose OWN argument string does not contain
 * expectedIdentity: both return "identity_refused" without ever signalling,
 * the one outcome a caller must be able to tell apart from every other stage
 * (possible pid reuse). Only a genuine identity match proceeds: SIGTERM,
 * poll every 200ms up to killWaitS (default VICE_BROKER_KILL_WAIT_S / 5),
 * SIGKILL on a survivor. */
export async function verifiedKill({ pid, expectedIdentity, deps = {} }: VerifiedKillOptions): Promise<KillStage> {
  const isAlive = deps.isAlive ?? defaultIsAlive;
  const readProcessArgs = deps.readProcessArgs ?? defaultReadProcessArgs;
  const kill = deps.kill ?? defaultKill;
  const sleepMs = deps.sleepMs ?? defaultSleepMs;
  const killWaitS = resolveKillWaitS(deps.killWaitS);

  if (pid === null || !Number.isFinite(pid) || pid <= 0) {
    return "already_exited";
  }
  if (!isAlive(pid)) {
    return "already_exited";
  }

  // CR-04 (code review 2026-08-13): an EMPTY expectedIdentity REFUSES, it
  // never permits. `"".includes` is vacuously satisfied by every process's
  // argv, so the guard below was unconditionally true for the empty string --
  // which disabled it entirely and let the caller SIGTERM (then SIGKILL)
  // whatever process happens to own a recorded pid today. Pids in epoch.json
  // outlive reboots and are freely reused, and bumpEpochForInstanceDir() below
  // itself writes back `vice_bin: ""` while preserving an existing `pid`, so
  // the broker could manufacture exactly that record and act on it at the next
  // start. That is the same class of incident (two unrelated processes killed
  // on a developer's host) this section's own header comment claims to have
  // closed. No identity is not a match; it is the absence of evidence, and
  // this function's whole purpose is to refuse without evidence.
  if (expectedIdentity === "") {
    process.stderr.write(
      `vice-broker: refusing to signal pid ${pid} -- no expected identity was recorded for it, so pid reuse cannot be ruled out\n`,
    );
    return "identity_refused";
  }

  const args = readProcessArgs(pid);
  if (!args.includes(expectedIdentity)) {
    process.stderr.write(
      `vice-broker: refusing to signal pid ${pid} -- ps reports "${args.trim()}", which does not match expected identity "${expectedIdentity}" (possible pid reuse)\n`,
    );
    return "identity_refused";
  }

  kill(pid, "SIGTERM");
  const limitMs = killWaitS * 1000;
  let waitedMs = 0;
  while (isAlive(pid)) {
    if (waitedMs >= limitMs) {
      process.stderr.write(`vice-broker: pid ${pid} did not exit within ${killWaitS}s of SIGTERM -- sending SIGKILL\n`);
      kill(pid, "SIGKILL");
      return "sigkill";
    }
    await sleepMs(200);
    waitedMs += 200;
  }
  return "sigterm";
}

// ============================================================================
// Shutdown: every catchable teardown path converges here (C5, D-25).
// ============================================================================

export interface ShutdownDeps {
  /** The live broker state -- every instance in `state.instances` is
   * identity-verified-killed and unconditionally removed. */
  state: BrokerState;
  /** Defaults to the real verifiedKill() above; overridable so tests can
   * observe call order/timing without spawning real processes. */
  kill?: (opts: VerifiedKillOptions) => Promise<KillStage>;
  log?: (line: string) => void;
}

/** The single shutdown sequence every catchable entry point converges on
 * (mirrors resources/vice-broker.sh's own broker_shutdown() ->
 * reap_all_instances()). For every instance currently recorded: set the
 * deliberate-kill marker BEFORE any signal reaches it (T-01.6.2-21) -- done
 * as its own pass over every instance FIRST, before any kill is attempted,
 * so a slow kill on instance A can never race a later-arriving signal that
 * finds instance B's marker still unset -- so a supervisor's exit handler
 * (broker-launch.mts's superviseChild()) treats the death as a deliberate
 * teardown, never a crash to respawn. Then kill it identity-verified through
 * verifiedKill() (or the injected stand-in). Then remove it from the map
 * UNCONDITIONALLY, whatever stage word came back -- that unconditional
 * removal IS the kill-never-recycle structural guarantee: the only way an
 * instance becomes grantable again is a fresh launch, never a reset of this
 * entry (mirrors teardown()'s own header comment in the bash original).
 * Never throws past an individual kill failure -- one instance's kill
 * rejecting must not stop every other instance from being torn down. */
export async function shutdown(deps: ShutdownDeps): Promise<void> {
  const kill = deps.kill ?? verifiedKill;
  const log = deps.log ?? defaultLog;

  const instances = Array.from(deps.state.instances.values());
  for (const instance of instances) {
    instance.deliberateKill = true;
  }

  let killed = 0;
  for (const instance of instances) {
    try {
      const stage = await kill({ pid: instance.pid, expectedIdentity: instance.expectedIdentity });
      if (stage === "sigterm" || stage === "sigkill") killed++;
    } catch (e) {
      log(`vice-broker: shutdown -- kill of port ${instance.port} threw: ${(e as Error).message}`);
    } finally {
      deps.state.instances.delete(instance.port);
    }
  }

  log(`vice-broker: shutdown complete -- ${instances.length} instance(s) processed, ${killed} signalled`);
}

/** The six catchable entry points every real broker process registers
 * shutdown() against. Not exported: registerShutdownHandlers() below is the
 * only caller, and no other module needs to enumerate these by name -- a
 * structural test reads this array directly via a test-only re-export
 * rather than duplicating the literal list. */
const HANDLED_SIGNALS: NodeJS.Signals[] = ["SIGTERM", "SIGINT", "SIGHUP"];

/** Exported ONLY for the structural test asserting no handler is registered
 * for the uncatchable kill/stop signals -- reading this array is how that
 * test enumerates "the registered signal names from the module's own
 * registration function" without parsing source text. */
export const _HANDLED_SIGNALS: readonly NodeJS.Signals[] = HANDLED_SIGNALS;

/** A process-shaped seam: real code always gets the real Node `process`
 * global; a test supplies a plain EventEmitter-like stand-in so it can
 * trigger 'uncaughtException'/'unhandledRejection'/'exit' deterministically
 * without touching the actual test-runner process (which node:test itself
 * depends on staying alive and un-signalled). */
export interface ProcessLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must accept
  // whatever shape node:events' EventEmitter#once (and the real Node
  // `process` global) actually declare, so a real EventEmitter instance is
  // structurally assignable without a cast at every call site.
  once(event: string, listener: (...args: any[]) => void): unknown;
  exitCode?: number | null;
}

export interface RegisterShutdownHandlersDeps extends ShutdownDeps {
  /** Defaults to the real Node `process` global. */
  proc?: ProcessLike;
  /** Called once shutdown() settles, with the process exit code shutdown
   * should end in. Defaults to setting `proc.exitCode` (never
   * `process.exit()` directly -- this codebase's own convention, so pending
   * stderr writes flush before the process actually ends). */
  exit?: (code: number) => void;
}

/** Registers the single shutdown sequence against every CATCHABLE entry
 * point: SIGTERM, SIGINT, SIGHUP, an uncaught exception, an unhandled
 * rejection, and normal exit -- six listeners, one shutdown function,
 * mirroring the bash original's single `trap broker_shutdown EXIT HUP INT
 * TERM` (extended here with the two JS-only failure modes bash has no
 * equivalent of). Disarms re-entry FIRST, before any child is signalled --
 * the bash version disarms its own trap (`trap - EXIT HUP INT TERM`) as its
 * first statement for exactly this reason, and an interrupt followed by a
 * terminate a hundred milliseconds later is a shape this project has
 * already seen (2026-08-02).
 *
 * Registers NOTHING for SIGKILL or SIGSTOP, and builds no mechanism to
 * prevent orphans after one -- both are UNCATCHABLE at the OS level; a
 * process receiving either executes no handler, no exit hook, no cleanup
 * block, and in a one-process design there is no supervisor left standing
 * to be told anything happened. Orphaned emulators after such a kill are
 * accepted and cleaned up by hand (T-01.6.2-29) -- the NEXT broker start's
 * unconditional reap (reapOrphanedInstances() below) is the actual recovery
 * mechanism, not anything registered here. Two kernel-level alternatives (a
 * watchdog process, a cgroup-wide kill) were considered during this phase's
 * own design discussion and dropped as over-engineering, not deferred.
 *
 * The 'exit' listener is registered identically to the other five, but
 * carries an honest limitation worth stating rather than hiding: Node's
 * 'exit' event fires synchronously and cannot keep the event loop alive for
 * pending async work, so on a REAL process exit only shutdown()'s
 * synchronous prefix (marking every instance deliberately-killed, issuing
 * the initial SIGTERM to each) is guaranteed to run before the process is
 * actually gone -- the SIGTERM-wait-then-SIGKILL escalation's own polling
 * cannot complete there. This is a real Node platform limitation, not a gap
 * in this module; it is why the 'exit' path is exercised in this module's
 * own tests via the injectable `proc` seam (a plain EventEmitter, which CAN
 * await async work in its own listeners) rather than a real process exit.
 *
 * Returns a cleanup function that removes every listener this call
 * registered -- used by this module's own tests so successive test cases
 * never accumulate listeners on the same `proc` object; a real broker
 * process never calls it (registered once, for the process's whole life). */
export function registerShutdownHandlers(deps: RegisterShutdownHandlersDeps): () => void {
  // Whether this call is wired to the REAL Node process global (true, the
  // real-broker wiring site in vice-broker.mts) or a test's injected
  // process-like stand-in (false). This is what the default `exit` below
  // uses to decide whether it may actually call process.exit() -- see that
  // default's own comment for why the answer differs by caller.
  const usingRealProcess = deps.proc === undefined;
  const proc = deps.proc ?? (process as unknown as ProcessLike);
  // Default exit: always records the intended exit code on `proc.exitCode`
  // first (matching this codebase's own "never process.exit(), always
  // process.exitCode" convention used elsewhere, e.g. main()'s
  // argument-parsing error paths, so any pending stdout/stderr write has a
  // chance to flush) -- but ONLY when wired to the real Node process does it
  // ALSO call the real process.exit(code) explicitly. This is deliberate,
  // not an inconsistency: a long-lived broker keeps its heartbeat/poll
  // setInterval timers alive for as long as the process lives, so merely
  // setting `process.exitCode` after a signal would never actually end the
  // process -- the event loop has nothing left that would let it drain on
  // its own. A deliberate, fully-sequenced shutdown (every instance killed,
  // every marker set, the log line written) is exactly the point at which an
  // explicit process.exit() is the right primitive, not a shortcut around
  // it. Tests that inject their own `proc` (a fake, never the real Node
  // process) never take this branch, so emitting 'exit'/'uncaughtException'
  // on a fake stand-in never terminates the actual test-runner process.
  const exit = deps.exit ?? ((code: number) => {
    (proc as { exitCode?: number | null }).exitCode = code;
    if (usingRealProcess) {
      process.exit(code);
    }
  });
  const log = deps.log ?? defaultLog;

  let running = false;
  const run = (reasonForLog: string, exitCode: number): void => {
    if (running) return;
    running = true;
    shutdown(deps)
      .catch((e) => {
        log(`vice-broker: shutdown error during ${reasonForLog}: ${(e as Error).message}`);
      })
      .finally(() => {
        exit(exitCode);
      });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches
  // ProcessLike#once's own listener shape (node:events' EventEmitter#once).
  const registrations: Array<[string, (...args: any[]) => void]> = [];
  const register = (event: string, listener: (...args: any[]) => void): void => {
    proc.once(event, listener);
    registrations.push([event, listener]);
  };

  for (const sig of HANDLED_SIGNALS) {
    register(sig, () => run(`signal ${sig}`, 0));
  }
  register("uncaughtException", (err: Error) => {
    log(`vice-broker: uncaught exception: ${err && err.message ? err.message : String(err)}`);
    run("uncaughtException", 1);
  });
  register("unhandledRejection", (reason: unknown) => {
    log(`vice-broker: unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
    run("unhandledRejection", 1);
  });
  register("exit", () => run("exit", 0));

  return () => {
    const p = proc as unknown as { removeListener?: (event: string, listener: (...args: any[]) => void) => void };
    if (typeof p.removeListener === "function") {
      for (const [event, listener] of registrations) {
        p.removeListener(event, listener);
      }
    }
  };
}

/** D-25's mandatory start-time banner: printed unconditionally, before the
 * control listener begins accepting, naming exactly what a keyboard
 * interrupt or a closed terminal destroys. On 2026-08-02 a `^C` produced
 * "reap saw 4 recorded instance(s), terminated 4" and killed a live
 * session -- the incident was not caused by missing machinery, it was
 * caused by nobody being told. Detaching stays the operator's own
 * nohup/setsid/systemd choice (D-25) -- this banner names that choice
 * rather than offering a flag; the launcher stays thin.
 *
 * D-25/P-13 (01.6.2.1-05-PLAN.md): the one place naming the retired
 * warm-floor environment variable does not weaken D-10/D-11's clean break --
 * the line added below reports the variable's mere PRESENCE, never its
 * value, and no reader anywhere in this broker still consults it (the
 * structural gate in broker-kill.test.ts proves that). Without it, an
 * operator with the retired variable set in a shell profile would silently
 * get the default instead of their configured value, with nothing saying
 * so -- the exact failure mode the developer was shown when choosing the
 * clean break over a fallback read. */
export function startupBanner(): string {
  const lines = [
    "vice-broker: WARNING -- this broker runs in the FOREGROUND of this process.",
    "vice-broker: a keyboard interrupt (Ctrl-C), a closed terminal, or an ending SSH/VS Code",
    "vice-broker: session will TERMINATE EVERY EMULATOR this broker launched -- including",
    "vice-broker: instances leased to OTHER AGENTS' LIVE SESSIONS, which then lose their",
    "vice-broker: accumulated context.",
    "vice-broker: a broker that dies voids every session it was serving -- there is no",
    "vice-broker: reconnect. A session whose broker dies must be restarted, not resumed.",
    "vice-broker: to run this broker outside the current terminal session, use your own",
    "vice-broker: nohup/setsid/systemd -- this launcher does not offer a --detach flag.",
  ];
  if (process.env.VICE_BROKER_SPARES !== undefined) { // banner-only presence check (D-25/P-13) -- never reads the value
    lines.push(
      "vice-broker: NOTE -- the VICE_BROKER_SPARES environment variable is set and is IGNORED; it was retired with no alias or fallback. Use VICE_BROKER_WARM_FLOOR instead.", // banner
    );
  }
  return lines.join("\n");
}

// ============================================================================
// Startup reap: unconditional, file-free... but no longer PROCESS-TABLE-free
// (criterion I, D-15, as revised by 02-03-PLAN.md/D-14/D-15).
//
// 02-03-PLAN.md (BROK-03) retires this section's entire former identity
// mechanism -- the two functions it lived in are gone from this tree
// outright, not merely unused -- which used to select kill targets by
// scanning EVERY host process's own argument string for a plain substring
// match on the configured emulator binary path, gated only by "some bare
// integer token >= basePort appears somewhere in that same string" -- folded
// todo
// `.planning/todos/pending/2026-08-12-broker-orphan-reap-substring-identity-match.md`,
// observed killing two unrelated orchestrator shell processes on a
// developer's host (a long scratchpad path supplied the qualifying integer;
// a short VICE_BIN like `/bin/sleep` supplied the substring). D-15 replaces
// that heuristic with the broker's OWN allocation record: this reap now
// enumerates the instance directories under `stateDir` (which THIS broker,
// or a same-machine predecessor, created) and kills only the pid each
// directory's own epoch.json actually recorded launching. A host process
// this broker never allocated a port for -- however it is named, however
// many integers its argv happens to contain -- is out of scope BY
// CONSTRUCTION and is never even enumerated, let alone considered a
// candidate: that is the whole point, and a future "smarter heuristic"
// reintroducing any form of process-table scanning here is the exact
// regression this section exists to prevent.
// ============================================================================

function resolveBasePortForReap(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_BASE_PORT;
  if (raw === undefined || raw === "") return 6600;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 6600;
}

export interface ReapResult {
  found: number;
  killed: number;
}

/** The epoch-writer functions reapOrphanedInstances() needs, taken as
 * required, injected dependencies for the identical reason
 * superviseChild()'s own EpochWriterDeps exists (broker-launch.mts): this
 * module cannot VALUE-import broker-epoch.mjs's real exports without
 * breaking its own direct-unbuilt-import contract. vice-broker.mts (built
 * form only) supplies the real broker-epoch.mts functions; tests inject
 * their own or the real ones via a direct ".mts" source import. */
export interface EpochWriterDeps {
  epochPathFor: (stateDir: string, port: number) => string;
  nextEpochFor: (supervisorDir: string) => number;
  writeEpochRecord: (opts: { supervisorDir: string; record: EpochRecord }) => string;
}

export interface ReapOrphanedInstancesOptions extends EpochWriterDeps {
  /** Root state directory -- the same one every per-port supervisorDir is
   * derived from elsewhere in this codebase (`join(stateDir, String(port))`). */
  stateDir: string;
  basePort?: number;
  /** Defaults to the real verifiedKill() above. */
  kill?: (opts: VerifiedKillOptions) => Promise<KillStage>;
  log?: (line: string) => void;
  /** Enumerates every port-numbered directory currently on disk under
   * `stateDir` -- defaults to a real directory listing. Overridable so tests
   * can assert against a controlled, temporary state directory without
   * every other test in the suite's own stateDir leaking in. */
  listInstanceDirs?: (stateDir: string) => number[];
}

function defaultListInstanceDirs(stateDir: string): number[] {
  let names: string[];
  try {
    names = readdirSync(stateDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  return names.filter((name) => /^\d+$/.test(name)).map(Number);
}

function readExistingEpochFieldsMaybe(path: string): Partial<EpochRecord> | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Partial<EpochRecord>;
    }
  } catch {
    /* malformed -- treated as "nothing to preserve", matching nextEpochFor()'s
     * own never-throw posture */
  }
  return null;
}

/** Bumps a single in-band instance directory's epoch by exactly one
 * (via the injected nextEpochFor(), the SAME derivation superviseChild()
 * uses on every respawn), preserving every OTHER field already on disk when
 * readable so a human inspecting the file afterwards still finds the
 * instance's real spawned_at/pid/vice_bin/log -- and degrading to
 * reasonable placeholders when the directory carries no prior epoch.json at
 * all (the exact case this reap exists to still cover: a directory the
 * broker has no in-memory record of). This bump is what carries the void
 * into the existing MachineRestartedError path (vice.ts's
 * assertSameMachine()) -- no second notion of "recoverable" is invented
 * here. */
function bumpEpochForInstanceDir(deps: EpochWriterDeps, stateDir: string, port: number): void {
  const supervisorDir = join(stateDir, String(port));
  const path = deps.epochPathFor(stateDir, port);
  const existing = readExistingEpochFieldsMaybe(path);
  const nextEpoch = deps.nextEpochFor(supervisorDir);
  const record: EpochRecord = {
    epoch: nextEpoch,
    spawned_at: typeof existing?.spawned_at === "string" ? existing.spawned_at : new Date().toISOString(),
    pid: typeof existing?.pid === "number" ? existing.pid : 0,
    supervisor_pid: typeof existing?.supervisor_pid === "number" ? existing.supervisor_pid : process.pid,
    vice_bin: typeof existing?.vice_bin === "string" ? existing.vice_bin : "",
    vice_args: Array.isArray(existing?.vice_args) ? (existing.vice_args as string[]) : [],
    log: typeof existing?.log === "string" ? existing.log : "",
    dry_run: typeof existing?.dry_run === "boolean" ? existing.dry_run : false,
  };
  deps.writeEpochRecord({ supervisorDir, record });
}

/** The unconditional startup reap (criterion I, D-15, kill-target identity
 * revised by 02-03-PLAN.md/D-14/D-15). Runs on every broker start, before the
 * control listener accepts and before anything is launched -- unconditional
 * because a broker killed with SIGKILL never runs a shutdown path, so "was
 * the last shutdown clean" is unanswerable, and a marker file recording that
 * answer would itself be the class of file-based liveness claim this phase
 * retires.
 *
 * Enumerates the on-disk instance directories under `stateDir` in the
 * allocation band (`port >= basePort` -- the 6510-6599 range below it stays
 * reserved by convention for an emulator a human launched for their own
 * work, D-18), and for each one reads its OWN `epoch.json` -- never a host
 * process listing, never an argv scan. A directory whose record is absent,
 * unparseable, or carries no finite positive `pid` contributes nothing to
 * `found`/`killed` and is skipped by the kill half entirely, but the epoch
 * bump below still runs for it: a registry-free restart must still void
 * every in-band instance directory it finds, including one it has no usable
 * pid for, which is the exact case this seed
 * (.planning/seeds/broker-restart-reaps-and-voids.md) flags -- the void has
 * to reach instances a registry-free restart never heard of. A record that
 * DOES carry a usable pid AND a non-empty `vice_bin` is killed via
 * verifiedKill() with `expectedIdentity` set to THAT record's own `vice_bin`
 * -- never a globally resolved binary name -- so a live pid whose own argv
 * does not match what THIS broker itself recorded launching there is refused
 * (`identity_refused`), exactly like every other verifiedKill() call site in
 * this module. A record carrying a usable pid but NO `vice_bin` is NOT a kill
 * candidate at all (CR-04): it contributes nothing to `found`/`killed`, the
 * kill dep is never invoked, and only the epoch bump runs -- an unidentifiable
 * pid is refused, never killed on the strength of the pid alone.
 *
 * Then bumps the epoch of EVERY instance directory under `stateDir` whose
 * port falls in the band, exactly as before this revision -- including
 * directories this broker process has no in-memory record of.
 *
 * Logs one line naming the count found and the count killed, including the
 * zero case -- both the 2026-08-01 and 2026-08-02 incidents were diagnosed
 * from broker log lines, and a silent reap would be exactly the kind of
 * thing impossible to reconstruct afterwards. */
export async function reapOrphanedInstances(options: ReapOrphanedInstancesOptions): Promise<ReapResult> {
  const kill = options.kill ?? verifiedKill;
  const log = options.log ?? defaultLog;
  const basePort = resolveBasePortForReap(options.basePort);
  const listInstanceDirs = options.listInstanceDirs ?? defaultListInstanceDirs;

  const ports = listInstanceDirs(options.stateDir);

  let found = 0;
  let killed = 0;
  for (const port of ports) {
    if (port < basePort) continue;

    const epochFields = readExistingEpochFieldsMaybe(options.epochPathFor(options.stateDir, port));
    const pid = epochFields?.pid;
    if (typeof pid === "number" && Number.isFinite(pid) && pid > 0) {
      const expectedIdentity = typeof epochFields?.vice_bin === "string" ? epochFields.vice_bin : "";
      if (expectedIdentity === "") {
        // CR-04: a record with a usable pid but NO recorded identity is not a
        // kill candidate at all -- it is not counted in `found` and the kill
        // dep is never invoked. verifiedKill() refuses an empty identity too
        // (second layer, deliberately: removing either leaves the other
        // standing), but the reap must not even ASK, so an injected kill
        // recorder stays empty for this case. The epoch bump below still runs:
        // a registry-free restart must void every in-band instance directory
        // it finds, including one it has no usable identity for.
        log(`vice-broker: startup reap -- port ${port} records pid ${pid} but no vice_bin, so pid reuse cannot be ruled out; kill skipped, epoch still voided`);
      } else {
        found++;
        const stage = await kill({ pid, expectedIdentity });
        if (stage === "sigterm" || stage === "sigkill") killed++;
      }
    }

    bumpEpochForInstanceDir(options, options.stateDir, port);
  }

  log(`vice-broker: startup reap found ${found} process(es) in the emulator port band, terminated ${killed}`);
  return { found, killed };
}
