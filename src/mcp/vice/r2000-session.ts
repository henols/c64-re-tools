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
// `broker-launch.mts`'s `tryLaunchOne()`), and two counters
// (`openCount`/`killCount`) that exist ONLY for the test seam below --
// production code never reads them.
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
import type { R2000Call, R2000Session } from "./r2000-mcp-client.ts";

// -- Module-level mutable state -------------------------------------------

let currentSession: R2000Session | null = null;
let currentProjectPath: string | null = null;
/** The project file's `mtimeMs` as last observed by THIS module, right
 * after opening or after a call against the held session returns. `null`
 * only when no session is held. See the EXTERNAL-WRITE STALENESS note
 * above for why this exists. */
let currentProjectMtimeMs: number | null = null;
let inFlight = false;

/** Test-seam-only counters -- never read by production code. See
 * `__r2000SessionStateForTest()` below. */
let openCount = 0;
let killCount = 0;

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
  if (!stale) return;
  try {
    await stale.close();
  } catch {
    // Best effort -- D18-08's save-per-mutation invariant already
    // persisted everything this session ever mutated, so a close failure
    // here carries no data-loss risk. The eviction proceeds regardless.
  }
}

/**
 * Runs `fn` against the held regenerator2000 session for `projectPath`,
 * opening a fresh one when none is held, reusing the held one when its
 * `projectPath` strictly equals the requested path AND the project file is
 * still the one this module last observed (see the EXTERNAL-WRITE
 * STALENESS note above), or evicting-then-respawning otherwise (D18-04:
 * single slot, evict-and-respawn -- lossless by construction because every
 * mutating call already saved before it resolved, D18-08).
 *
 * Deliberately signature-compatible with `withR2000Session(projectPath, fn)`
 * so `r2000-tools.ts`'s rewire is a one-identifier swap.
 */
export async function runInR2000Session<T>(
  projectPath: string,
  fn: (call: R2000Call) => Promise<T>
): Promise<T> {
  if (currentSession && currentProjectPath === projectPath) {
    const observedMtime = projectMtimeMsOrNull(projectPath);
    if (observedMtime !== null && observedMtime !== currentProjectMtimeMs) {
      await discardCurrentSession();
    }
  } else if (currentSession && currentProjectPath !== projectPath) {
    await discardCurrentSession();
  }

  if (!currentSession) {
    // Rule A11's synchronous single-owner check-and-set, ported from
    // broker-launch.mts's tryLaunchOne() (D18-20): read the flag, set it,
    // and only THEN reach the first `await` -- so two overlapping open
    // attempts can never both spawn a child for this module's slot. The
    // full contention-queue-and-wait behaviour (D18-17) is a later plan's
    // mutex; this guard only protects the open path itself from a double
    // spawn.
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
      currentSession = await openR2000Session(projectPath);
      currentProjectPath = projectPath;
      currentProjectMtimeMs = projectMtimeMsOrNull(projectPath);
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
    if (currentSession === session) {
      currentSession = null;
      currentProjectPath = null;
      currentProjectMtimeMs = null;
      try {
        session.killSync();
        killCount++;
      } catch {
        // Best effort -- the call already failed; a failed kill does not
        // change the outcome the caller sees.
      }
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
 * code -- see the `__`-prefix convention this repo's other test seams use. */
export function __r2000SessionStateForTest(): {
  open: boolean;
  projectPath: string | null;
  pid: number | undefined;
  openCount: number;
  killCount: number;
} {
  return {
    open: currentSession !== null,
    projectPath: currentProjectPath,
    pid: currentSession?.pid,
    openCount,
    killCount,
  };
}

/** Test-only reset: closes any live session (best effort) and zeroes the
 * counters, so one `node --test` process can run several session scenarios
 * in sequence without a child leaking between them. Never imported by
 * production code. */
export async function __resetR2000SessionForTest(): Promise<void> {
  await discardCurrentSession();
  inFlight = false;
  openCount = 0;
  killCount = 0;
}
