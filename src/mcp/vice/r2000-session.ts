#!/usr/bin/env node
// r2000-session.ts -- the ONE authoritative place in this repo that decides
// when a long-lived regenerator2000 child is opened, reused, or discarded
// across the whole life of one vice-proxy.ts process.
//
// WHY THIS MODULE EXISTS (D18-01, executing the D-17/D-18 reversal recorded
// in .planning/ARCHITECTURE.md's "## Architecture Change Record" and its new
// "### Rule A21"): every prior phase spawned a fresh regenerator2000 child
// per `r2000_*` tool call (spawn -> initialize -> call -> save -> exit,
// D-17). That per-call lifecycle is what made the TUI-shaped cursor tools
// meaningless and what `c64-program-recon`'s own SKILL.md text already
// conceded a real cost to ("batching is what makes that affordable under
// the per-call spawn-load-mutate-save-exit lifecycle"). Rule A21 states the
// invariant this module exists to hold: at most one live regenerator2000
// child per project path, per proxy process, held across many calls.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: holding at most one live
// `R2000Session` (`r2000-mcp-client.ts`'s long-lived primitive) and deciding
// when to open a fresh one, reuse the one already open, or discard it.
// Nothing else in this repo tracks session lifetime state.
//
// WHAT THIS MODULE MUST NEVER DO, named concretely:
//   - Never spawn a child process itself (D18-02). r2000-mcp-client.ts
//     remains the sole spawn seam in this repo for regenerator2000's
//     `--mcp-server-stdio` verb -- this module calls INTO it
//     (`openR2000Session()`), dynamically, and never spawns on its own.
//     r2000-spawn-seam.test.ts's frozen two-entry EXPECTED_R2000_SPAWN_SITES
//     set is what enforces this: this module contributes zero discovered
//     spawn sites, checked mechanically, not merely asserted here.
//   - Never own save timing (D18-08). Whether and when a mutating call's
//     own internal save runs is r2000-tools.ts's concern alone; this module
//     only decides whether a child stays alive, never when it flushes.
//   - Never store or signal a bare process id (D18-21). Every kill in this
//     module goes through the retained `R2000Session.killSync()`, which
//     itself kills only through its own retained `ChildProcess` handle --
//     there is no pid stored anywhere in this file, so a recycled pid is
//     unreachable by construction, not merely guarded against.
//
// MODULE-LEVEL MUTABLE STATE (mirroring vice.ts's own precedent for exactly
// this shape of problem -- one proxy process, one live resource, no
// per-request context object to carry it in): the current live session (or
// null), its resolved project path, an `inFlight` synchronous open-guard
// (Rule A11's single-owner check-and-set, ported from
// `broker-launch.mts`'s `tryLaunchOne()`), a coarse FIFO mutex (D18-15
// through D18-19, plan 18-06 -- see its own section below for the full
// rationale) serialising the ENTIRE body of `runInR2000Session()` per
// caller, and two counters (`openCount`/`killCount`) that exist ONLY for
// the test seam below -- production code never reads them.
//
// TWO DELIBERATE ABSENCES, recorded so a later reader does not "fix" them:
//   - NO IDLE TIMEOUT (D18-05). The held child lives until the proxy
//     process exits or the project path changes -- there is no timer
//     anywhere in this module. `vice-proxy.ts` is already one process per
//     Claude Code session, and a 64K project's footprint is trivial. An
//     idle-close would also introduce exactly the "was it idle-closed or
//     did it crash" ambiguity a later plan's crash detection would then
//     have to disambiguate.
//   - NO CALLER-VISIBLE SESSION TOOLS (D18-06). There is no
//     `r2000_session_open`/`_close`/`_status` tool anywhere in this repo's
//     curated surface. Session health surfaces only through named errors on
//     ordinary `r2000_*` calls -- this module exports no
//     `R2000ToolDefinition` and adds no name to `CURATED_R2000_TOOLS`.
//
// FAILURE POLICY IN THIS TRACER: the simplest correct thing, nothing more.
// If a call against the held session throws for any reason, the handle is
// discarded (best-effort `killSync()`, slot cleared) and the error
// propagates UNCHANGED -- no respawn, no retry, no restart budget. Those
// come from a later plan; this module never pretends to recover.
//
// EXTERNAL-WRITE STALENESS (found live by this plan's own full-suite run,
// r2000-symbol-roundtrip.test.ts's criterion-4 closed-symbol-loop test --
// R2000-15): D18-07 deliberately keeps `r2000-symbols.ts`'s `importLabels()`
// on the one-shot `withR2000Session()` contract, a SEPARATE regenerator2000
// process from whatever this module holds open for the same project path
// (in production, a genuinely separate OS process -- `vice-mcp r2000
// import-lbl`, invoked by a skill's Bash call, has no access to this
// module's in-memory state at all). That import saves through its own
// session, mutating the SAME `.regen2000proj` file on disk; a HELD session
// for that path has no way to know, and would otherwise answer a later
// `r2000_get_symbols` from its now-stale in-memory copy, silently missing
// the import -- the exact "several independent connections, no single place
// enforcing observe-after-mutate" shape Phase 9's incident generalises,
// reintroduced here across TWO deliberately-separate session kinds rather
// than across multiple one-shot connections. Detected cheaply, before every
// reuse, by comparing the project file's on-disk `mtimeMs` against the value
// observed right after this module's own last open/call -- never by
// re-reading the file's content. A mismatch evicts and reopens exactly like
// D18-04's project-path-change eviction (lossless by construction, D18-08:
// nothing THIS module's own held session did is ever lost by discarding the
// handle). This is an extension of D18-04's reuse-vs-evict decision, not a
// new mechanism: "the same project path" now means "the same project path
// AND the file this module last observed is still the file on disk."
import { statSync } from "node:fs";
import { ensureProjectSettings } from "./r2000-project.ts";
import {
  R2000ChildExitError,
  R2000RestartBudgetExhaustedError,
  R2000SessionBusyError,
  R2000TimeoutError,
  type R2000Call,
  type R2000Session,
} from "./r2000-mcp-client.ts";
// The three imports above are error CLASSES (values, needed for `instanceof`
// below) and light-weight type aliases -- never the spawn primitive itself.
// This is not a violation of D18-02's "never spawn a child process itself":
// importing r2000-mcp-client.ts's class/type declarations costs no child
// process (its module body defines constants, classes and functions --
// nothing runs at import time), and `openR2000Session()` -- the one call
// that actually spawns -- remains reached exclusively through the dynamic
// `await import("./r2000-mcp-client.ts")` further down in this file.

// -- Restart policy (D18-10 through D18-14, plan 18-04) --------------------
//
// A crashed or wedged child must be a recoverable, attributable event, never
// a hang. Three behaviours, layered on top of the tracer's original
// "discard on any error" policy (see the module header's FAILURE POLICY IN
// THIS TRACER note above -- that note now describes plan 18-03's baseline,
// superseded by the finer-grained classification below):
//   - A death BETWEEN two calls is invisible and lossless: the next call
//     transparently opens a fresh child and runs (D18-11).
//   - A death MID-CALL fails loud (R2000ChildExitError) and is never
//     retried, for read-only or mutating calls alike (D18-12).
//   - A wedge (no answer within the call timeout) fails loud
//     (R2000TimeoutError), and the wedged handle is killed through its own
//     `ChildProcess` so the NEXT call is never issued into it (D18-13).
// Both a mid-call death and a killed wedge count as ONE crash each,
// toward ONE counter, scoped to "this working session, this project path"
// (D18-14). The counter is intentionally the sole gate: it is never reset
// by a successful call (see `crashCount`'s own comment below for why), only
// by an explicit test reset or a project-path change.
export const DEFAULT_R2000_RESTART_BUDGET = 3;

/**
 * The number of child deaths tolerated, for one project path within one
 * working session, before `runInR2000Session()` refuses to respawn again
 * (throwing `R2000RestartBudgetExhaustedError`). Overridable per process via
 * the `R2000_RESTART_BUDGET` environment variable, read AT CALL TIME (never
 * frozen at module load) -- matching `WithR2000SessionOptions.bin`'s own
 * read-at-call-time rationale in `r2000-mcp-client.ts`, since this repo's own
 * test files share one module cache per `node --test` process and need to
 * point several different budgets at the same code within that one process.
 * `3` is chosen because a genuinely broken project or binary fails
 * immediately and repeatably (the budget is exhausted almost at once,
 * refusing loudly rather than retrying forever), while a healthy session
 * that loses a child to one isolated crash should not be penalised for it.
 */
function currentRestartBudget(): number {
  const raw = process.env.R2000_RESTART_BUDGET;
  if (raw === undefined) return DEFAULT_R2000_RESTART_BUDGET;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_R2000_RESTART_BUDGET;
}

// -- Module-level mutable state -------------------------------------------

let currentSession: R2000Session | null = null;
let currentProjectPath: string | null = null;
/** The project file's `mtimeMs` as last observed by THIS module, right
 * after opening or after a call against the held session returns. `null`
 * only when no session is held. See the EXTERNAL-WRITE STALENESS note
 * above for why this exists. */
let currentProjectMtimeMs: number | null = null;
let inFlight = false;

/**
 * `true` exactly when `currentProjectPath` names a project whose held
 * session has crashed (between calls or mid-call) and has not yet been
 * reopened by a subsequent call. `currentSession` is `null` whenever this is
 * `true` -- the two are never both meaningful at once -- but this flag
 * outlives the null-out: it is what lets `runInR2000Session()` tell "no
 * session has ever been opened for this path" apart from "a session for
 * this path died and is awaiting the budget check", which the mere
 * nullness of `currentSession` cannot distinguish on its own.
 */
let sessionDead = false;

/**
 * Counts child deaths (mid-call exits AND timeout-killed wedges alike -- see
 * the "Restart policy" note above) for `currentProjectPath`, within this
 * working session. Reset in EXACTLY TWO places: `__resetR2000SessionForTest()`
 * and the project-path-change eviction branch of `runInR2000Session()` below
 * -- deliberately NEVER on a successful call. An alternating crash-then-
 * success pattern (crash, respawn, succeed, crash, respawn, succeed, ...)
 * would otherwise never exhaust the budget no matter how many times it
 * repeated, which is exactly the invisible respawn loop D18-14 exists to
 * surface -- a project or binary that crashes every other call would read
 * as merely slow, forever, instead of eventually refusing loudly.
 */
let crashCount = 0;

/** Test-seam-only counters -- never read by production code. See
 * `__r2000SessionStateForTest()` below. */
let openCount = 0;
let killCount = 0;

/**
 * Fires when a HELD session's child exits, for any reason, at any time --
 * between calls with nothing pending, or mid-call with a request still
 * unanswered (D18-10). Bound to the specific `R2000Session` instance that
 * was opened (captured by closure at the call site below), so a real exit
 * event that arrives AFTER this module has already moved on from that
 * instance -- e.g. `R2000TimeoutError`'s own handling below already killed
 * and cleared it -- is a no-op rather than a double count. Never respawns
 * from inside this listener: the respawn decision belongs to the NEXT call,
 * so a session nobody is using never spawns a child in the background.
 */
function handleSessionExit(session: R2000Session): void {
  if (currentSession !== session) return;
  currentSession = null;
  sessionDead = true;
  crashCount++;
}

/** The project file's current `mtimeMs`, or `null` if it cannot be stat'd
 * (e.g. deleted out from under a held session) -- never thrown, since a
 * stat failure here is a staleness SIGNAL, not a reason to abort the call
 * that triggered it (the call itself will fail on its own, distinctly, if
 * the file is genuinely gone). */
function projectMtimeMsOrNull(projectPath: string): number | null {
  try {
    return statSync(projectPath).mtimeMs;
  } catch {
    return null;
  }
}

/** Discards the currently-held session (if any), best effort, and clears
 * every piece of module state that describes it. Shared by the
 * project-path-change eviction (D18-04) and the external-write staleness
 * eviction above -- one discard path, not two. */
async function discardCurrentSession(): Promise<void> {
  const stale = currentSession;
  currentSession = null;
  currentProjectPath = null;
  currentProjectMtimeMs = null;
  sessionDead = false;
  if (!stale) return;
  try {
    await stale.close();
  } catch {
    // Best effort -- D18-08's save-per-mutation invariant already
    // persisted everything this session ever mutated, so a close failure
    // here carries no data-loss risk. The eviction proceeds regardless.
  }
}

// -- Coarse FIFO mutex (D18-15 through D18-19, plan 18-06) -----------------
//
// OWNER: this module. Recorded here, not `r2000-mcp-client.ts`, because the
// critical-section UNIT D18-18 requires is the caller's whole `fn` -- the
// mutating call AND its own internal `r2000_save_project`, executed as one
// unit so no second mutation can interleave between a change and its flush
// -- and `runInR2000Session(projectPath, fn)` is the only place in this repo
// where an `fn` boundary of that shape exists. Owning the mutex at the
// transport layer (`r2000-mcp-client.ts`) would only ever see individual
// `tools/call` frames, leaving exactly the window Phase 9's incident lived
// in. SESS-04's "concurrent fan-out is restricted to read-only queries" is
// therefore satisfied at the ORCHESTRATION level (Phase 19's playbooks fan
// out read-only subagents by convention), not mechanically here: this seam
// serialises everything it is handed, reads included, and answers
// contention with a bounded queue-and-wait rather than a refusal (D18-17) --
// an LLM-driven procedure handling a "busy, try again" error correctly is
// not something to rely on, and it would push retry logic into every
// absorbed procedure Phase 19 writes.
//
// RELATIONSHIP TO THE RETAINED `inFlight` CHECK-AND-SET ABOVE: both exist,
// deliberately, for different reasons -- this mutex is a PROMISE structure
// and can only ever serialise callers that actually go through it, while
// Rule A11's `inFlight` invariant is specifically a synchronous check and a
// set with ZERO `await` between them (ported from `broker-launch.mts`'s
// `tryLaunchOne()`). That is the property that survives a future refactor
// which adds a second entry point into the open path without going through
// this mutex at all -- the queue alone could not catch that; `inFlight`
// still would. Neither replaces the other; do not convert `inFlight` into a
// promise-based equivalent.

/**
 * The maximum time a caller waits for ITS OWN TURN at the mutex, never the
 * maximum time its own operation may take once granted -- once a caller
 * holds the slot, its own `fn` may run for as long as it needs to (bounded,
 * if at all, only by its own `RunInR2000SessionOptions.timeoutMs`). `60_000`
 * is deliberately double `DEFAULT_R2000_CALL_TIMEOUT_MS` (`r2000-mcp-
 * client.ts`, `30_000`) so a single legitimately-slow call ahead in the
 * queue can never trip a waiter behind it, while a genuinely stuck holder
 * still surfaces as a named, bounded `R2000SessionBusyError` rather than
 * hanging forever (SESS-02's own "never a hang" floor, applied here to
 * contention rather than to the child process itself). Overridable per
 * process via `R2000_QUEUE_WAIT_MS`, read AT CALL TIME (never frozen at
 * module load) -- matching `currentRestartBudget()`'s own read-at-call-time
 * rationale above, since this repo's test files share one module cache per
 * `node --test` process and need to point several different bounds at the
 * same code within that one process.
 */
export const DEFAULT_R2000_QUEUE_WAIT_MS = 60_000;

function currentQueueWaitMs(): number {
  const raw = process.env.R2000_QUEUE_WAIT_MS;
  if (raw === undefined) return DEFAULT_R2000_QUEUE_WAIT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_R2000_QUEUE_WAIT_MS;
}

interface MutexQueueEntry {
  description: string;
  enqueuedAt: number;
  /** Reassigned by `acquireMutexSlot()` to clear the entry's own bounded-
   * wait timer before granting its turn -- see that function's own comment
   * for why an explicit array (not a bare `tail = tail.then(...)` chain) is
   * required: a timed-out entry must be individually removable from the
   * MIDDLE of arrival order, which a plain promise chain cannot express. */
  grant: () => void;
}

/** FIFO of callers waiting for their OWN turn at the mutex -- never
 * includes whichever caller currently holds the slot (that caller is
 * tracked separately by `inFlightDescription` below, not by an entry in
 * this array). */
let mutexQueue: MutexQueueEntry[] = [];

/** A short description of whichever caller currently holds the mutex's one
 * slot, or `null` when nobody does. Surfaced verbatim as a later waiter's
 * `R2000SessionBusyError.holder` field, and exposed on the test seam below
 * (`__r2000SessionStateForTest().inFlightDescription`) so a test can assert
 * on queue state directly, never on timing. */
let inFlightDescription: string | null = null;

function grantNextInMutexQueue(): void {
  const next = mutexQueue.shift();
  if (next) next.grant();
}

/**
 * Acquires the coarse FIFO mutex's one slot for `description`, resolving
 * with a `release()` function once it is this caller's turn -- strict
 * arrival order, including several callers that call this in the same
 * synchronous tick: each pushes onto `mutexQueue` in the exact order it
 * reaches this function, and Node's single-threaded, run-to-completion
 * semantics mean two calls can never race for the same queue position
 * (mirroring `killAfter()`'s own "race a timer against the real event"
 * shape in `r2000-mcp-client.ts`, applied here to a turn rather than to a
 * process exit). A caller whose turn has not arrived within
 * `currentQueueWaitMs()` (D18-17) rejects with `R2000SessionBusyError`,
 * naming its own observed wait and `inFlightDescription` at the moment of
 * the timeout, and is removed from `mutexQueue` so its abandoned turn is
 * never granted late against a session this caller has already given up on
 * -- contention is answered by a bound, never by a refusal-while-busy.
 */
function acquireMutexSlot(description: string): Promise<() => void> {
  return new Promise((resolve, reject) => {
    function grant(): void {
      inFlightDescription = description;
      resolve(release);
    }

    function release(): void {
      inFlightDescription = null;
      grantNextInMutexQueue();
    }

    if (inFlightDescription === null && mutexQueue.length === 0) {
      // Nobody ahead and nobody holding the slot -- this caller's turn is
      // now, granted synchronously (before this function's own caller even
      // resumes from its `await`), so a second caller invoked in the SAME
      // tick always observes the slot as already held.
      grant();
      return;
    }

    const entry: MutexQueueEntry = { description, enqueuedAt: Date.now(), grant: () => {} };
    const waitMs = currentQueueWaitMs();
    const timer = setTimeout(() => {
      const idx = mutexQueue.indexOf(entry);
      if (idx === -1) return; // already granted between the timer firing and this callback running
      mutexQueue.splice(idx, 1);
      const waitedMs = Date.now() - entry.enqueuedAt;
      reject(
        new R2000SessionBusyError(
          `r2000-session: a caller waited ${waitedMs}ms for its turn against the coarse FIFO mutex without ` +
            `one, exceeding the R2000_QUEUE_WAIT_MS bound of ${waitMs}ms -- currently held by: ` +
            `"${inFlightDescription ?? "(unknown)"}". The abandoned turn has been removed from the queue and ` +
            `will not run late.`,
          { waitedMs, holder: inFlightDescription ?? "(unknown)" }
        )
      );
    }, waitMs);
    // Deliberately retain this timer: awaiting a Promise alone does not keep
    // Node's event loop alive, and this timer is the bounded-wait guarantee.
    // It is cleared as soon as the caller gets its turn, so it cannot outlive
    // a successful queue acquisition.
    entry.grant = () => {
      clearTimeout(timer);
      grant();
    };
    mutexQueue.push(entry);
  });
}

// ---------------------------------------------------------------------------
// TEST-ONLY (D18-19's non-vacuity control). Exists SOLELY so
// the session test can prove the mutex is what prevents two concurrent
// `runInR2000Session()` calls' `fn`s from interleaving against the SAME held
// session -- flipping this toggle for exactly the duration of one test skips
// the mutex entirely (both calls proceed straight into the guarded body
// below with no serialisation), then observes a client-side read-modify-
// write race that survives cleanly under the mutex now losing an update.
// MUST NEVER be set by production code -- there is no code path in this file
// that ever mutates `.active` other than a test file importing this binding
// and flipping it directly, matching `r2000-tools.ts`'s own
// `__R2000_TEST_ONLY_SUPPRESS_INTERNAL_SAVE` convention exactly. Defaults to
// `false` (asserted at module load by a companion test), and this
// identifier appears in this file ONLY here and at its one read site inside
// `runInR2000Session()` below -- a source assertion in
// the companion source assertion pins the exported toggle to two occurrences.
// ---------------------------------------------------------------------------

export const __R2000_TEST_ONLY_BYPASS_QUEUE: { active: boolean } = { active: false };
const r2000TestOnlyBypassQueue = __R2000_TEST_ONLY_BYPASS_QUEUE;

export interface RunInR2000SessionOptions {
  /**
   * Per-request timeout for THIS call's session, passed straight through to
   * `openR2000Session()`'s own `WithR2000SessionOptions.timeoutMs` when a
   * fresh child is opened. Defaults to `DEFAULT_R2000_CALL_TIMEOUT_MS`
   * (`r2000-mcp-client.ts`'s own default), never a second, locally-defined
   * default -- added so a test can shorten a wedge test's own wait without
   * a 30-second real-time cost, not as a caller-facing tuning knob.
   */
  timeoutMs?: number;
}

/**
 * The exported entry point. Acquires the coarse FIFO mutex's one slot for
 * `projectPath` (D18-15), then runs the ENTIRE existing tracer body --
 * `runInR2000SessionLocked()` below -- inside it: the eviction/open
 * decision, the `fn` invocation, and the error classification are all one
 * critical-section unit (D18-18), never merely the `fn` call alone. Releases
 * the slot in a `finally` regardless of success or throw, so a callback that
 * throws still frees the queue for the next caller (D18-15's own behaviour
 * requirement) and the rejection reaches only this call's own caller.
 *
 * The test-only bypass toggle skips the mutex entirely -- see
 * that toggle's own doc comment for why it exists and its safety discipline.
 */
export async function runInR2000Session<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>,
  opts: RunInR2000SessionOptions = {}
): Promise<T> {
  if (r2000TestOnlyBypassQueue.active) {
    return runInR2000SessionLocked(projectPath, fn, opts);
  }
  const release = await acquireMutexSlot(projectPath);
  try {
    return await runInR2000SessionLocked(projectPath, fn, opts);
  } finally {
    release();
  }
}

/**
 * The tracer body proper (plan 18-03, extended by plans 18-04/18-06):
 * against the held regenerator2000 session for `projectPath`, opens a fresh
 * one when none is held, reuses the held one when its `projectPath` strictly
 * equals the requested path AND the project file is still the one this
 * module last observed (see the EXTERNAL-WRITE STALENESS note above), or
 * evicts-then-respawns otherwise (D18-04: single slot, evict-and-respawn --
 * lossless by construction because every mutating call already saved before
 * it resolved, D18-08). Always called from inside `runInR2000Session()`'s
 * own critical section above (or, for exactly one test, with it bypassed) --
 * never call this function directly from production code.
 *
 * Deliberately signature-compatible with `withR2000Session(projectPath, fn)`
 * so `r2000-tools.ts`'s rewire is a one-identifier swap -- `opts` is an
 * additional, optional third parameter, so every existing call site
 * (`r2000-tools.ts`'s two-argument calls) is unaffected.
 */
async function runInR2000SessionLocked<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>,
  opts: RunInR2000SessionOptions
): Promise<T> {
  if (currentProjectPath !== null && currentProjectPath !== projectPath) {
    // Project-path change: full eviction, AND the crash counter is scoped
    // to "this project path" (D18-14) -- it resets here, one of exactly two
    // reset sites (the other is __resetR2000SessionForTest()). Covers a
    // dead-but-not-yet-reopened slot too (sessionDead with currentSession
    // already null): there is nothing live to close, but the old path's
    // crash history must not leak onto the new path either.
    await discardCurrentSession();
    crashCount = 0;
  } else if (currentProjectPath === projectPath) {
    if (sessionDead) {
      // A held session for THIS path died since the last call. Transparent
      // respawn is lossless (D18-08: every mutating call already saved
      // before it resolved) -- UNLESS the restart budget for this path is
      // already exhausted, in which case respawning again would hide a
      // genuinely broken project or binary behind what reads as slowness
      // (D18-14).
      const limit = currentRestartBudget();
      if (crashCount > limit) {
        throw new R2000RestartBudgetExhaustedError(
          `regenerator2000 has crashed ${crashCount} time(s) for "${projectPath}" within this working ` +
            `session, exceeding the restart budget of ${limit} -- refusing to respawn again. Set ` +
            `R2000_RESTART_BUDGET to override, or close/reopen the session (a project-path change also ` +
            `resets this counter).`,
          { crashCount, limit }
        );
      }
      // Discard the dead handle (already null -- the exit listener cleared
      // it) and take the open path below, so this call runs against a
      // fresh child (D18-11).
      sessionDead = false;
      currentProjectMtimeMs = null;
    } else if (currentSession) {
      const observedMtime = projectMtimeMsOrNull(projectPath);
      if (observedMtime !== null && observedMtime !== currentProjectMtimeMs) {
        await discardCurrentSession();
      }
    }
  }

  if (!currentSession) {
    // Rule A11's synchronous single-owner check-and-set, ported from
    // broker-launch.mts's tryLaunchOne() (D18-20): read the flag, set it,
    // and only THEN reach the first `await` -- so two overlapping open
    // attempts can never both spawn a child for this module's slot.
    //
    // RETAINED DELIBERATELY alongside plan 18-06's coarse mutex above, not
    // deleted as redundant now that the mutex already serialises every
    // caller that goes through `runInR2000Session()`: this flag is what
    // still protects the open path if a FUTURE refactor ever adds a second
    // entry point into this function's body that bypasses the mutex -- a
    // promise-chain queue is a structure callers can be routed AROUND; a
    // synchronous check-and-set with zero `await` between the check and the
    // set cannot be, by construction. In today's code, with every caller
    // routed through the mutex, this branch should never actually observe
    // `inFlight === true` (the mutex already prevents two callers from
    // being inside this function's body at the same time) -- its value is
    // as a structural invariant surviving a future refactor, not as the
    // live contention path itself (D18-17's mutex is that path now).
    if (inFlight) {
      throw new Error(
        "r2000-session: a session-open is already in flight for this proxy process -- concurrent opens " +
          "are not yet queued (that lands with a later plan's mutex); refusing rather than risking two " +
          "live regenerator2000 children for one slot."
      );
    }
    inFlight = true;
    try {
      // Forced BEFORE spawn, in the exact window Pitfall 9(6) declares safe
      // (D18-32): the only editor of an existing .regen2000proj's settings
      // is this call, and it always runs before any child owns the file.
      await ensureProjectSettings(projectPath);
      const { openR2000Session } = await import("./r2000-mcp-client.ts");
      const opened = await openR2000Session(projectPath, { timeoutMs: opts.timeoutMs });
      // Bound to THIS session instance by closure -- see handleSessionExit()'s
      // own doc comment for why that binding is what keeps a later, already-
      // handled exit event from double-counting (D18-10).
      opened.onExit(() => handleSessionExit(opened));
      currentSession = opened;
      currentProjectPath = projectPath;
      currentProjectMtimeMs = projectMtimeMsOrNull(projectPath);
      sessionDead = false;
      openCount++;
    } finally {
      inFlight = false;
    }
  }

  const session = currentSession;
  try {
    const result = await fn(session.call);
    if (currentSession === session) {
      // Refresh the observed mtime after a successful call -- covers this
      // session's own internal save (r2000-tools.ts) equally with a
      // read-only no-op, so the NEXT call's staleness check compares
      // against what THIS module actually saw most recently, not a
      // snapshot from session-open time.
      currentProjectMtimeMs = projectMtimeMsOrNull(projectPath);
    }
    return result;
  } catch (err) {
    // Classified, not swallowed into a blanket "discard on any error"
    // (plan 18-03's original tracer-only policy, superseded here). A
    // tool-level R2000ProtocolError says nothing about the child's health --
    // falling through this if/else chain with no branch taken leaves the
    // session in place deliberately.
    //
    // NO per-call liveness probe is added anywhere in this function, by
    // design (D18-13's own scope note): `vice-probe.ts`'s fragility exists
    // for an HTTP-mode "accept() lies while the event loop is blocked"
    // shape (see its own header) -- a stdio child has no accept step that
    // can lie the same way, and probing before every call would reintroduce
    // most of the round-trip cost the persistent session was built to
    // remove. `R2000TimeoutError` below IS this module's liveness signal.
    if (err instanceof R2000ChildExitError) {
      // handleSessionExit() (this session's own onExit listener, fired
      // synchronously inside r2000-mcp-client.ts's exit handler, BEFORE
      // this rejection's continuation ever runs) has already cleared
      // `currentSession`, set `sessionDead`, and incremented `crashCount`
      // for this exact exit. Nothing left to do here except never retry
      // (D18-12) and let the caller see the named error unchanged.
    } else if (err instanceof R2000TimeoutError) {
      // The child may still be alive but wedged -- no exit event will ever
      // fire on its own, so THIS call site is the one place responsible for
      // killing it (through its own retained handle, never a bare pid) and
      // recording the crash, so the NEXT call is not issued into the same
      // wedge (D18-13).
      if (currentSession === session) {
        currentSession = null;
      }
      try {
        session.killSync();
        killCount++;
      } catch {
        // Best effort -- the call already failed; a failed kill does not
        // change the outcome the caller sees.
      }
      sessionDead = true;
      crashCount++;
    }
    throw err;
  }
}

/**
 * Synchronously discards the held session, if any, via its `killSync()` --
 * no `await`, no `.then(`, no `async` anywhere in this function's body, so
 * it is safe to call from a synchronous exit-handler context (plan 18-04
 * wires this into `vice-proxy.ts`'s teardown region; this plan only defines
 * it). `trigger` names why the caller is closing (e.g. "process exit"),
 * surfaced on stderr for post-incident attribution -- never consulted by
 * this function's own logic. Returns `true` if a session was actually
 * discarded, `false` if none was held.
 */
export function closeR2000SessionSync(trigger: string): boolean {
  if (!currentSession) return false;
  const session = currentSession;
  const path = currentProjectPath;
  currentSession = null;
  currentProjectPath = null;
  currentProjectMtimeMs = null;
  session.killSync();
  killCount++;
  console.error(`r2000-session: closed the held session for "${path}" (trigger: ${trigger})`);
  return true;
}

/** Test-only snapshot of this module's state. Never imported by production
 * code -- see the `__`-prefix convention this repo's other test seams use.
 * `crashCount`/`dead` added by plan 18-04 (D18-14) so tests can assert on
 * the restart policy's own counters directly, rather than on timing. */
export function __r2000SessionStateForTest(): {
  open: boolean;
  projectPath: string | null;
  pid: number | undefined;
  openCount: number;
  killCount: number;
  crashCount: number;
  dead: boolean;
  queueDepth: number;
  inFlightDescription: string | null;
} {
  return {
    open: currentSession !== null,
    projectPath: currentProjectPath,
    pid: currentSession?.pid,
    openCount,
    killCount,
    crashCount,
    dead: sessionDead,
    queueDepth: mutexQueue.length,
    inFlightDescription,
  };
}

/** Test-only reset: closes any live session (best effort) and zeroes the
 * counters, so one `node --test` process can run several session scenarios
 * in sequence without a child leaking between them. Never imported by
 * production code. Also one of the restart policy's exactly two crash-
 * counter reset sites (D18-14) -- the other is the project-path-change
 * eviction branch inside `runInR2000Session()`. */
export async function __resetR2000SessionForTest(): Promise<void> {
  await discardCurrentSession();
  inFlight = false;
  inFlightDescription = null;
  mutexQueue = [];
  openCount = 0;
  killCount = 0;
  crashCount = 0;
  sessionDead = false;
  r2000TestOnlyBypassQueue.active = false;
}
