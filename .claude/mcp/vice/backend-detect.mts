// backend-detect.mts
//
// The ONE place that decides which VICE build a binary is, and the ONE
// reader of VICE_BACKEND anywhere in this tree (D-01). Everything else that
// needs to know "fork or stock" -- broker-launch.mts's buildViceArgs(),
// vice-broker.mts's startup wiring, and plan 02-08's later connect handshake
// -- calls resolvedBackend() below and threads its answer down, exactly like
// vice.ts's mcpHost() documents for its own container-versus-host question:
// a SECOND independent reader of the same signal is a bug waiting to
// happen the moment one copy is updated and the other is not (mcpHost()'s
// own "three inlined copies" incident is the exact regression this file
// exists to keep from recurring here).
//
// WHAT NOT TO DO:
//   - Do not call resolvedBackend()/probeBackend() per acquire, per launch,
//     or per connect. The broker resolves the backend exactly ONCE, at
//     process startup (vice-broker.mts's run()), and passes the resolved
//     value down through every real launch call site -- see this module's
//     own module-level memo below, which exists as a second line of defence
//     against an accidental extra call, not as the PRIMARY mechanism (that
//     is the caller only ever invoking this once).
//   - Do not call this from inside broker-launch.mts's `inFlight`
//     single-owner launch guard. This is a possibly-blocking child-process
//     spawn (probeBackend()'s --help probe); anything that can block inside
//     that synchronous check-and-set window is the exact failure class the
//     2026-08-01 triple-launch outage came from (D-03/T-02-25).
//   - Do not add a trial-launch fallback (launch the binary for real and
//     watch what happens) as a second detection mechanism. The `--help`
//     probe below runs entirely outside any launch-guarded critical section
//     BY CONSTRUCTION -- a trial launch would not. It would also depend on
//     RESEARCH.md's assumption A1 (stock's argument parser rejects an
//     unknown flag rather than ignoring it), which is UNVERIFIED against a
//     real stock binary; see docs/phase2-backend-probe-evidence.md.
//
// ENVIRONMENT CONSTRAINT (2026-08-13, explicit user scope override): no real
// stock or fork VICE binary is reachable from the environment this plan
// executed in, and the user's own ruling for this plan is "we can't do
// tests with deciding what vice is". Every test in backend-detect.test.ts
// therefore drives this module's OVERRIDE path, its on-disk CACHE lifecycle,
// and classifyHelpOutput()'s STRING-PARSING logic against fixture strings
// authored in the test file -- never a real spawned binary. The `--help`
// discriminator itself (does a real stock build's --help output actually
// contain "-binarymonitor" and omit "-mcpserver", the way classifyHelpOutput()
// below assumes) is recorded as an OPEN, not a VERIFIED, question in
// docs/phase2-backend-probe-evidence.md section 2 -- that document's verdict
// is deliberately left standing; nothing in this file's own tests attempts to
// resolve it, and no fixture string anywhere in this tree should ever be
// presented as real captured output from either build. See the follow-up
// todo tracked under .planning/todos/pending/ for what a real-hardware run
// must still confirm.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  renameSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, resolve as resolvePath } from "node:path";

/** Phase 2 (BROK-01, D-12, D-01): the two shapes this whole tree ever
 * launches or speaks to. Moved here (plan 02-07) from broker-launch.mts's
 * own plan-02-03 definition -- broker-launch.mts now imports/re-exports
 * this one, so the type keeps exactly one home. */
export type ViceBackend = "fork" | "stock";

// ---------------------------------------------------------------------------
// classifyHelpOutput() -- pure string classification, no I/O at all.
// ---------------------------------------------------------------------------

/** Matches on the literal flag tokens D-02 names as the discriminator: the
 * fork's `-mcpserver` flag versus stock's `-binarymonitor`-only surface.
 * `"fork"` wins when BOTH tokens appear (the fork's own VICE tree is a 3.10
 * checkout and accepts both flags) -- checked FIRST, deliberately, so a
 * build that advertises both is classified by the flag that actually makes
 * it the fork, not merely "also has stock's flag too". `"unknown"` when
 * NEITHER token appears -- a real --help transcript that does not match
 * either shape, a probe that spawned nothing at all (empty text), or
 * anything else this function was never taught to recognise. Never throws;
 * pure function of the text it is given. */
export function classifyHelpOutput(text: string): "fork" | "stock" | "unknown" {
  const hasFork = text.includes("-mcpserver");
  const hasStock = text.includes("-binarymonitor");
  if (hasFork) return "fork";
  if (hasStock) return "stock";
  return "unknown";
}

// ---------------------------------------------------------------------------
// probeBackend() -- the --help probe. spawnSync only, argv array, shell:
// false, never a shell string and never string interpolation of binPath
// into a command line (T-02-03's mitigation). Bounded by a 5000ms timeout
// with kill-on-timeout so a hostile or hung binary cannot stall broker
// startup (T-02-25's second mitigation half).
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 5000;

/** `--help` first, falling back to `-help` then `-?` ONLY when a run exits
 * non-zero with EMPTY combined output -- a run that exits non-zero but
 * still printed something (some builds write usage to stderr and exit 1) is
 * already usable and is not retried further. */
const HELP_FLAG_CANDIDATES: readonly string[] = ["--help", "-help", "-?"];

export interface SpawnHelpResult {
  text: string;
  exitedZero: boolean;
}

export interface ProbeBackendDeps {
  /** Runs ONE candidate flag against `binPath` and returns its combined
   * stdout+stderr text (VICE writes usage to either, depending on build)
   * plus whether the process exited zero. Injected so no test in this tree
   * ever spawns a real binary -- this environment has none, and per this
   * file's own environment-constraint note above, no test may execute one.
   * Defaults to a real, argv-array, shell:false spawnSync call bounded by
   * PROBE_TIMEOUT_MS with kill-on-timeout; never throws -- a spawn failure
   * (ENOENT, EACCES, a real timeout) collapses to `{ text: "", exitedZero:
   * false }`, which classifyHelpOutput() reads as "unknown" like any other
   * unrecognised output. */
  spawnHelp?: (binPath: string, flag: string) => SpawnHelpResult;
}

function defaultSpawnHelp(binPath: string, flag: string): SpawnHelpResult {
  try {
    const result = spawnSync(binPath, [flag], {
      encoding: "utf8",
      timeout: PROBE_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    return { text, exitedZero: result.status === 0 };
  } catch {
    return { text: "", exitedZero: false };
  }
}

/** Runs the fallback ladder above against `binPath` and classifies whatever
 * text the LAST attempted flag produced. Never throws -- every failure mode
 * (spawn error, timeout, empty output, an exit code the caller does not
 * recognise) flows through to classifyHelpOutput() as ordinary text, which
 * itself never throws either. */
export function probeBackend(binPath: string, deps: ProbeBackendDeps = {}): "fork" | "stock" | "unknown" {
  const spawnHelp = deps.spawnHelp ?? defaultSpawnHelp;
  let text = "";
  for (const flag of HELP_FLAG_CANDIDATES) {
    const outcome = spawnHelp(binPath, flag);
    text = outcome.text;
    if (outcome.exitedZero || text.trim() !== "") break;
  }
  return classifyHelpOutput(text);
}

// ---------------------------------------------------------------------------
// The on-disk cache -- `join(supervisorDir, "backend.json")`. `supervisorDir`
// is ALWAYS an explicit string this module receives from its caller, never a
// default this module derives itself: the one true resolver for "where is
// .vice-supervisor" is repo-root.ts's own supervisorDir() (ARCHITECTURE.md's
// named "re-deriving a cross-cutting seam locally" anti-pattern -- this file
// must not become a second, silently-driftable copy of that resolution).
// A container-side caller passes repo-root.ts's supervisorDir() return value
// directly; vice-broker.mts's own host-side wiring passes its already-
// resolved args.stateDir, which IS that same directory (see vice-broker.mts's
// own parseArgs()). This file cannot import repo-root.ts's VALUE as a static
// import and still compile as a host-bound artifact: repo-root.ts (and its
// own dependency install-resources.ts) use `.ts`-extension imports that only
// resolve under Node's native type-stripping, unbuilt -- exactly the mode a
// bare host running this module's COMPILED resources/backend-detect.mjs
// cannot rely on (this project's own standing constraint: "the host side
// cannot rely on Node's type-stripping the same way"). Passing the resolved
// string in, rather than importing the resolver, is what keeps this file
// importable UNBUILT from a container-side .ts (exactly like
// container-guard.mts's own precedent) AND compilable into resources/ for the
// host, from the SAME source, with no `#ifdef`-style split.
//
// When `supervisorDir` is omitted entirely, every cache read/write below is a
// no-op (a miss on read, silently skipped on write) -- this module still
// answers correctly (probe-and-memoise-in-process only), it just never
// persists an answer across process restarts. This is a graceful
// degradation, not an error: a caller that has not yet resolved a
// supervisor directory (or genuinely has none) gets a working, if
// unpersisted, answer rather than a thrown exception or a guessed path.
// ---------------------------------------------------------------------------

export interface BackendCacheRecord {
  version: 1;
  resolvedPath: string;
  mtimeMs: number;
  sizeBytes: number;
  backend: ViceBackend;
  probedAt: string;
  /** BACK-04: filled in later, by a connect handshake (plan 02-08), never by
   * this file's own probe -- the `--help` probe cannot observe a version
   * quad; only a live VICE_INFO reply over an established connection can. */
  versionQuad?: string;
  cpuHistoryAvailable?: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cachePathFor(supervisorDir: string): string {
  return join(supervisorDir, "backend.json");
}

/** Reads and narrows the cache file at the boundary with isPlainObject()-
 * style checks, never a cast -- absent, unreadable, unparseable, or
 * wrong-shaped (missing/mistyped required fields) all collapse to `null`,
 * treated identically as a cache MISS, never as an error this function
 * surfaces to its caller. */
function readCacheRecord(supervisorDir: string): BackendCacheRecord | null {
  let raw: string;
  try {
    raw = readFileSync(cachePathFor(supervisorDir), "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  if (
    typeof parsed.resolvedPath !== "string" ||
    typeof parsed.mtimeMs !== "number" ||
    typeof parsed.sizeBytes !== "number" ||
    (parsed.backend !== "fork" && parsed.backend !== "stock")
  ) {
    return null;
  }
  const record: BackendCacheRecord = {
    version: 1,
    resolvedPath: parsed.resolvedPath,
    mtimeMs: parsed.mtimeMs,
    sizeBytes: parsed.sizeBytes,
    backend: parsed.backend,
    probedAt: typeof parsed.probedAt === "string" ? parsed.probedAt : "",
  };
  if (typeof parsed.versionQuad === "string") record.versionQuad = parsed.versionQuad;
  if (typeof parsed.cpuHistoryAvailable === "boolean") record.cpuHistoryAvailable = parsed.cpuHistoryAvailable;
  return record;
}

/** Tmp-sibling -> chmod 0600 -> content -> rename, the SAME atomic-write
 * discipline refresh-manifest.ts's writeManifestAtomic() and vice-broker.mts's
 * writeBrokerRecordFile() both already use -- a crash mid-write can only ever
 * leave a stray tmp sibling behind, never a truncated or empty file at the
 * real cache path that a later read would wrongly accept. */
function writeCacheRecordAtomic(supervisorDir: string, record: BackendCacheRecord): void {
  mkdirSync(supervisorDir, { recursive: true });
  const finalPath = cachePathFor(supervisorDir);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, "");
  chmodSync(tmpPath, 0o600);
  writeFileSync(tmpPath, JSON.stringify(record, null, 2) + "\n");
  renameSync(tmpPath, finalPath);
}

// ---------------------------------------------------------------------------
// Binary identity -- resolve a possibly-bare command name (e.g. "x64sc") to
// an absolute path (for cache KEYING and stat only -- probeBackend() above
// still spawns the ORIGINAL, unresolved binPath/viceBin string, letting the
// OS's own PATH search resolve it exactly like a real invocation would), and
// stat it for mtimeMs/sizeBytes -- the D-03 planner decision's cache key
// half: `{ resolvedPath, mtimeMs, sizeBytes }`, which catches a binary
// replaced in place (an `apt upgrade`, a manual `cp`) without hashing a
// multi-megabyte file on every broker start.
// ---------------------------------------------------------------------------

export interface BinaryIdentity {
  mtimeMs: number;
  sizeBytes: number;
}

function defaultResolveBinPath(bin: string, env: NodeJS.ProcessEnv): string | null {
  if (bin.includes("/")) {
    const abs = resolvePath(bin);
    return existsSync(abs) ? abs : null;
  }
  const pathEnv = env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, bin);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function defaultStat(resolvedPath: string): BinaryIdentity | null {
  try {
    const st = statSync(resolvedPath);
    return { mtimeMs: st.mtimeMs, sizeBytes: st.size };
  } catch {
    return null;
  }
}

function defaultLog(line: string): void {
  process.stderr.write(`${line}\n`);
}

// ---------------------------------------------------------------------------
// resolvedBackend() -- the public entry point.
// ---------------------------------------------------------------------------

export type ResolvedBackendSource = "override" | "cache" | "probe" | "indeterminate";

export interface ResolvedBackendResult {
  backend: ViceBackend;
  source: ResolvedBackendSource;
  binPath: string;
  note?: string;
}

export interface ResolvedBackendDeps {
  env?: NodeJS.ProcessEnv;
  /** Which binary to detect against -- defaults to VICE_BIN or "x64sc",
   * matching broker-launch.mts's own spawnAndRecordInstance() default
   * exactly (one broker, one binary, one verdict -- D-04). */
  viceBin?: string;
  /** See this module's own header comment on the cache section above --
   * NEVER defaulted here. Omitted entirely disables the on-disk cache
   * (probe-and-memoise-in-process only, never persisted). */
  supervisorDir?: string;
  resolveBinPath?: (bin: string, env: NodeJS.ProcessEnv) => string | null;
  stat?: (resolvedPath: string) => BinaryIdentity | null;
  probe?: (binPath: string) => "fork" | "stock" | "unknown";
  now?: () => number;
  log?: (line: string) => void;
}

// Memoised answer for the probe/cache path ONLY -- the override path
// (VICE_BACKEND set) is always answered fresh, on every call, straight from
// the environment, and never touches this memo (an explicit override can
// legitimately differ from call to call within, e.g., a test process driving
// many scenarios; the detected-backend answer for a fixed binary cannot).
// This is what makes resolvedBackend() answer "once per long-running
// process" for the case that actually spawns something, while never
// requiring a caller to somehow signal "this is a fresh scenario" the way
// container-guard.mts's isInsideContainer() asks callers to pass explicit
// deps to bypass ITS OWN memo -- here, the override/no-override distinction
// already IS that signal.
let memoisedResult: ResolvedBackendResult | null = null;

// D-06: gates the "detected backend X for binary Y" stderr note so a
// long-running broker (or a test suite driving resolvedBackend() many times)
// emits it at most once per process -- repo-root.ts's warnedEnvOutsideFrom/
// warnedNoMarkerFound pattern, reused here verbatim.
let warnedBackendUnset = false;

function emitDetectedNote(result: ResolvedBackendResult, viceBin: string, log: (line: string) => void): void {
  if (warnedBackendUnset) return;
  warnedBackendUnset = true;
  log(
    `vice-broker: detected backend "${result.backend}" for ${viceBin} (source: ${result.source}) -- ` +
      `set VICE_BACKEND=stock or VICE_BACKEND=fork to override this detection explicitly`,
  );
}

/** Test-only escape hatch: clears the in-process memo and the D-06
 * one-time-note gate. Never called by any real production code path --
 * vice-broker.mts calls resolvedBackend() exactly once per real process
 * lifetime and has no reason to ever reset it; this exists solely so
 * backend-detect.test.ts can drive many distinct scenarios (cache hit, cache
 * miss, indeterminate, ...) in one shared test process without one
 * scenario's memoised answer contaminating the next -- mirroring
 * broker-launch.test.ts's own discipline of restoring module-level state
 * between test cases, made explicit here rather than left to careful test
 * ordering, since this module's memo (unlike buildViceArgs()'s one-time
 * note) has no natural "always widens the same way" ordering to exploit. */
export function resetResolvedBackendForTests(): void {
  memoisedResult = null;
  warnedBackendUnset = false;
}

/** Honours VICE_BACKEND FIRST, returning immediately without spawning
 * anything when it names `stock` or `fork` (BACK-01: one optional config
 * value switches backends, no code edit). Otherwise consults the on-disk
 * cache (when `supervisorDir` is given and the binary's current
 * `{ resolvedPath, mtimeMs, sizeBytes }` all match the stored record); on a
 * miss, probes via probeBackend() and writes the cache. Memoises the
 * probe/cache answer in a module-level variable so a long-running process
 * resolves once (see the memo's own comment above for what "once" means
 * here). Never throws: a probe that classifies "unknown" (including a
 * spawn failure or a timeout, both of which probeBackend() already reduces
 * to "unknown") returns a defined `{ backend: "fork", source:
 * "indeterminate", ... }` outcome instead -- "fork" because that is the
 * pre-Phase-2 behaviour every existing install already has, so an
 * undetectable binary degrades to what already worked rather than to
 * nothing. */
export function resolvedBackend(deps: ResolvedBackendDeps = {}): ResolvedBackendResult {
  const env = deps.env ?? process.env;
  const viceBin = deps.viceBin ?? env.VICE_BIN ?? "x64sc";
  // A direct read of the real environment on the right of this ternary
  // (rather than the generic `env` local above) is deliberate: this file is
  // grep-gated, tree-wide, as the ONE place that ever names this variable
  // directly against the real environment -- `deps.env` (the test-injection
  // seam) still takes precedence when supplied, exactly like every other
  // field on this options object.
  const override = deps.env ? deps.env.VICE_BACKEND : process.env.VICE_BACKEND;

  if (override === "stock" || override === "fork") {
    return { backend: override, source: "override", binPath: viceBin };
  }

  if (memoisedResult !== null) return memoisedResult;

  const log = deps.log ?? defaultLog;
  const resolveBinPath = deps.resolveBinPath ?? defaultResolveBinPath;
  const stat = deps.stat ?? defaultStat;
  const probe = deps.probe ?? ((bin: string) => probeBackend(bin));
  const now = deps.now ?? ((): number => Date.now());

  const resolvedPath = resolveBinPath(viceBin, env);
  const identity = resolvedPath ? stat(resolvedPath) : null;
  const cacheEligible = resolvedPath !== null && identity !== null && typeof deps.supervisorDir === "string";

  if (cacheEligible) {
    const cached = readCacheRecord(deps.supervisorDir as string);
    if (
      cached &&
      cached.resolvedPath === resolvedPath &&
      cached.mtimeMs === identity!.mtimeMs &&
      cached.sizeBytes === identity!.sizeBytes
    ) {
      const result: ResolvedBackendResult = { backend: cached.backend, source: "cache", binPath: viceBin };
      memoisedResult = result;
      emitDetectedNote(result, viceBin, log);
      return result;
    }
  }

  const verdict = probe(viceBin);

  if (verdict === "unknown") {
    const note =
      `vice-broker: could not determine whether ${viceBin} is the stock or fork VICE build -- ` +
      `its --help output matched neither the -mcpserver nor the -binarymonitor discriminator. ` +
      `Set VICE_BACKEND=stock or VICE_BACKEND=fork explicitly.`;
    log(note);
    const result: ResolvedBackendResult = { backend: "fork", source: "indeterminate", binPath: viceBin, note };
    memoisedResult = result;
    return result;
  }

  if (cacheEligible) {
    writeCacheRecordAtomic(deps.supervisorDir as string, {
      version: 1,
      resolvedPath: resolvedPath as string,
      mtimeMs: identity!.mtimeMs,
      sizeBytes: identity!.sizeBytes,
      backend: verdict,
      probedAt: new Date(now()).toISOString(),
    });
  }

  const result: ResolvedBackendResult = { backend: verdict, source: "probe", binPath: viceBin };
  memoisedResult = result;
  emitDetectedNote(result, viceBin, log);
  return result;
}

// ---------------------------------------------------------------------------
// BACK-04: the capability record. Same cache file, same identity match --
// filled in by plan 02-08's connect handshake, once per binary, never once
// per connect. This file's own probe never populates these fields (a
// `--help` transcript cannot carry a version quad); it only ever reads or
// updates them against a backend verdict this file already wrote.
// ---------------------------------------------------------------------------

export interface CapabilityRecordResult {
  versionQuad?: string;
  cpuHistoryAvailable?: boolean;
  /** True only when `observedVersionQuad` was given AND differs from the
   * stored value -- the caller has just seen a DIFFERENT VICE build than
   * whatever wrote this record (the binary was swapped since the last
   * capability determination), so the stored answer cannot be trusted and
   * must be re-determined rather than reused. */
  stale: boolean;
}

export interface CapabilityDeps {
  env?: NodeJS.ProcessEnv;
  supervisorDir?: string;
  resolveBinPath?: (bin: string, env: NodeJS.ProcessEnv) => string | null;
  stat?: (resolvedPath: string) => BinaryIdentity | null;
  /** A version quad the caller just observed live (over VICE_INFO on an
   * established connection) -- compared against whatever this cache
   * currently has on record for the SAME resolved binary. Omitted entirely
   * skips the staleness comparison outright (the returned `stale` is always
   * `false` when this is omitted). */
  observedVersionQuad?: string;
}

/** Reads whatever capability answers (BACK-04) are on record for `binPath`
 * -- `null` when there is no cache at all, the binary cannot be resolved, the
 * record on file names a DIFFERENT resolved binary, or nothing has been
 * recorded for this binary yet. Never throws. */
export function readCapabilityRecord(binPath: string, deps: CapabilityDeps = {}): CapabilityRecordResult | null {
  if (typeof deps.supervisorDir !== "string") return null;
  const env = deps.env ?? process.env;
  const resolveBinPath = deps.resolveBinPath ?? defaultResolveBinPath;
  const resolvedPath = resolveBinPath(binPath, env);
  if (!resolvedPath) return null;

  const existing = readCacheRecord(deps.supervisorDir);
  if (!existing || existing.resolvedPath !== resolvedPath) return null;
  if (existing.versionQuad === undefined && existing.cpuHistoryAvailable === undefined) return null;

  const stale =
    deps.observedVersionQuad !== undefined &&
    existing.versionQuad !== undefined &&
    existing.versionQuad !== deps.observedVersionQuad;

  return { versionQuad: existing.versionQuad, cpuHistoryAvailable: existing.cpuHistoryAvailable, stale };
}

/** Attaches `{ versionQuad, cpuHistoryAvailable }` to the EXISTING backend
 * verdict already on record for `binPath`'s resolved identity -- a no-op,
 * never a throw, when there is no such matching record yet (no supervisorDir
 * given, the binary cannot be resolved or stat'd, or the cache names a
 * different binary or has no verdict at all). This function never invents a
 * backend verdict of its own: it can only EXTEND a record resolvedBackend()
 * already wrote, since a `--help` probe has no way to observe a version
 * quad and this function must not silently fabricate the field it did not
 * observe either. */
export function writeCapabilityRecord(
  binPath: string,
  capability: { versionQuad: string; cpuHistoryAvailable: boolean },
  deps: CapabilityDeps = {},
): void {
  if (typeof deps.supervisorDir !== "string") return;
  const env = deps.env ?? process.env;
  const resolveBinPath = deps.resolveBinPath ?? defaultResolveBinPath;
  const stat = deps.stat ?? defaultStat;

  const resolvedPath = resolveBinPath(binPath, env);
  if (!resolvedPath) return;
  const identity = stat(resolvedPath);
  if (!identity) return;

  const existing = readCacheRecord(deps.supervisorDir);
  if (!existing || existing.resolvedPath !== resolvedPath) return;

  writeCacheRecordAtomic(deps.supervisorDir, {
    version: 1,
    resolvedPath,
    mtimeMs: identity.mtimeMs,
    sizeBytes: identity.sizeBytes,
    backend: existing.backend,
    probedAt: existing.probedAt,
    versionQuad: capability.versionQuad,
    cpuHistoryAvailable: capability.cpuHistoryAvailable,
  });
}
