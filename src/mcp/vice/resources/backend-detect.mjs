// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from backend-detect.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// backend-detect.mts
//
// FORKRM-01 (plan 52-06): this file used to be the ONE place that decided
// which VICE build a binary is (the fork's `-mcpserver` flag versus stock's
// `-binarymonitor`-only surface) and the ONE reader of an environment
// override naming a backend, anywhere in this tree. There is only one
// backend now, so there is nothing left to detect between: the `--help`
// probe (its own spawn, its fork/stock/unknown classifier) and the
// environment override are both deleted outright, not merely unreachable.
//
// What SURVIVES, and why:
//   - Binary-path resolution (`resolveBinPath`/`binPathFields`, WR-05) --
//     `vice_ping`'s `resolvedBinaryPath` field and host-tool.mts's sibling
//     binary resolution (`c1541`/`petcat`) both still need "which file did
//     you actually mean", independent of any backend concept.
//   - The on-disk identity/capability cache (BACK-04) -- it still records
//     something worth caching once the backend verdict is gone: the version
//     quad and CPU-history capability a live connect handshake (plan 02-08,
//     stock-connect.ts) attaches to a resolved binary's identity
//     (`resolvedPath`/`mtimeMs`/`sizeBytes`). `readCapabilityRecord()`/
//     `writeCapabilityRecord()` are unchanged in shape; only the cache
//     record's `backend` field is gone, since it never meant anything once
//     there was nothing to distinguish.
//
// `ViceBackend` is NARROWED to a single literal (`"stock"`), not deleted:
// text-capability-probe.ts and stock-connect.ts (both out of this plan's
// scope -- plan 52-07 owns text-capability-probe.ts's own registry-shaped
// fork references) still import it as a type-only import, and deleting it
// outright would break their compile for no benefit this plan is scoped to
// deliver.
//
// WHAT NOT TO DO:
//   - Do not reintroduce an environment-variable backend override, a
//     --help probe, or any other backend-discrimination mechanism. There is
//     one binary shape now; a second detection mechanism would be solving a
//     problem that no longer exists.
//   - Do not call resolvedBackend() from inside broker-launch.mts's
//     `inFlight` single-owner launch guard. This still performs filesystem
//     I/O (a stat call and, on a fresh or changed identity, a cache write);
//     anything that can block inside that synchronous check-and-set window
//     is the exact failure class the 2026-08-01 triple-launch outage came
//     from (D-03/T-02-25) -- unchanged reasoning from before this plan, only
//     the mechanism inside resolvedBackend() changed.
//
// Phase 60 (LOC-01/LOC-02, PD-01/PD-02/PD-03): resolvedBackend() gains a real
// VALUE dependency on the tool-location seam (tool-location.mts) for the
// emulator binary's own resolution -- when neither `viceBin` nor
// `resolveBinPath` is injected, resolution goes through the seam's
// `resolveTool("x64sc", ...)` instead of this file's own ordering, so a
// `.c64-re-tools/tools.json` entry for `x64sc` now changes what this broker
// actually spawns. `defaultResolveBinPath()` collapses into a thin wrapper
// over the seam's own exported `resolveOnPath()` -- the first of Phase 59
// D-02's three independent `$PATH`-walk copies to collapse.
//
// This file ships two ways (see the cache-section comment below): unbuilt,
// imported directly by container-side .ts (vice-proxy.ts's own `import *
// as backendDetect from "./backend-detect.mts"`), and compiled into
// resources/ for the host (vice-broker.mts's own `./backend-detect.mjs`
// value import). A STATIC `import ... from "./tool-location.mjs"` would
// resolve in only the SECOND form -- that file exists as a real sibling
// only once both are compiled into resources/, never beside the unbuilt
// source. Loading it instead through node:module's `createRequire()`
// (`toolLocationSeam()` below) defers resolution to the call site rather
// than parse time, so trying the compiled sibling first and falling back to
// the unbuilt source sibling keeps this ONE seam call working in both
// shipped forms -- one implementation, no #ifdef-style split, and every
// existing unbuilt importer of this file needs no change at all.
import { existsSync, readFileSync, writeFileSync, chmodSync, renameSync, mkdirSync, statSync, } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
/** The client-side capability-decision schema version stamped into every
 * capability record this module writes (see BackendCacheRecord's own field
 * comment). BUMP THIS whenever the client's capability probing or the
 * decoding it depends on changes, so records decided by the older code are
 * re-probed instead of trusted.
 *
 * History:
 *   1 -- plan 02-08's original probe (implicit; never written to disk).
 *   2 -- CR-01 fix: decode failures are no longer persisted at all, and the
 *        CPUHISTORY_GET body layout was corrected (07-12). Every record
 *        written before this constant existed lacks the field and is
 *        therefore stale, which is exactly the intent. */
export const CAPABILITY_SCHEMA_VERSION = 2;
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function cachePathFor(supervisorDir) {
    return join(supervisorDir, "backend.json");
}
/** Reads and narrows the cache file at the boundary with isPlainObject()-
 * style checks, never a cast -- absent, unreadable, unparseable, or
 * wrong-shaped (missing/mistyped required fields) all collapse to `null`,
 * treated identically as a cache MISS, never as an error this function
 * surfaces to its caller. */
function readCacheRecord(supervisorDir) {
    let raw;
    try {
        raw = readFileSync(cachePathFor(supervisorDir), "utf8");
    }
    catch {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (!isPlainObject(parsed))
        return null;
    if (typeof parsed.resolvedPath !== "string" ||
        typeof parsed.mtimeMs !== "number" ||
        typeof parsed.sizeBytes !== "number") {
        return null;
    }
    const record = {
        version: 1,
        resolvedPath: parsed.resolvedPath,
        mtimeMs: parsed.mtimeMs,
        sizeBytes: parsed.sizeBytes,
        probedAt: typeof parsed.probedAt === "string" ? parsed.probedAt : "",
    };
    if (typeof parsed.versionQuad === "string")
        record.versionQuad = parsed.versionQuad;
    if (typeof parsed.cpuHistoryAvailable === "boolean")
        record.cpuHistoryAvailable = parsed.cpuHistoryAvailable;
    if (typeof parsed.capabilitySchema === "number")
        record.capabilitySchema = parsed.capabilitySchema;
    return record;
}
/** Tmp-sibling -> chmod 0600 -> content -> rename, the SAME atomic-write
 * discipline vice-broker.mts's writeBrokerRecordFile() already uses -- a
 * crash mid-write can only ever leave a stray tmp sibling behind, never a
 * truncated or empty file at the real cache path that a later read would
 * wrongly accept. */
function writeCacheRecordAtomic(supervisorDir, record) {
    mkdirSync(supervisorDir, { recursive: true });
    const finalPath = cachePathFor(supervisorDir);
    const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, "");
    chmodSync(tmpPath, 0o600);
    writeFileSync(tmpPath, JSON.stringify(record, null, 2) + "\n");
    renameSync(tmpPath, finalPath);
}
/** This module's own directory. Computed once, purely to seed
 * `toolLocationSeam()`'s two-candidate join below -- mirrors
 * `tool-location.mts`'s own `HERE` constant and its `readDeclaration()`
 * "beside `here`, take the first that exists" idiom exactly. */
const HERE = dirname(fileURLToPath(import.meta.url));
/** Loads the tool-location seam through `node:module`'s `createRequire()`
 * rather than a static ESM import -- see this file's own header for why a
 * static specifier cannot work in both of this file's two shipped forms.
 * `require()` resolves at THIS call site, not at parse time, so trying the
 * compiled resources/ sibling first and falling back to the unbuilt source
 * sibling (the exact two-candidate order `tool-location.mts`'s own
 * `readDeclaration()` already uses for `prerequisites.json`) lets the SAME
 * source file resolve correctly whichever way this file itself was loaded.
 * Never memoised here -- `resolvedBackend()`'s own `memoisedResult` already
 * ensures this runs at most once in the one production path that reaches
 * it, and a test process that resets that memo between scenarios must be
 * free to call this again, cheaply, rather than replay a stale answer. */
function toolLocationSeam() {
    const req = createRequire(import.meta.url);
    const specifier = existsSync(join(HERE, "tool-location.mjs")) ? "./tool-location.mjs" : "./tool-location.mts";
    return req(specifier);
}
/** Reduced (Phase 60) to a thin wrapper over the seam's own exported
 * `resolveOnPath()` -- the first of Phase 59 D-02's three independent
 * `$PATH`-walk copies to collapse. Kept as a named function (rather than
 * inlined at its one call site) only because `ResolvedBackendDeps.resolveBinPath`
 * needs a real default to fall back to when a caller supplies `viceBin` but
 * not this override (PD-02). */
function defaultResolveBinPath(bin, env) {
    return toolLocationSeam().resolveOnPath(bin, env).path;
}
function defaultStat(resolvedPath) {
    try {
        const st = statSync(resolvedPath);
        return { mtimeMs: st.mtimeMs, sizeBytes: st.size };
    }
    catch {
        return null;
    }
}
// Memoised answer -- a long-running process (the real broker) resolves once
// per process lifetime; a test suite driving many scenarios calls
// resetResolvedBackendForTests() between them (see that function's own
// comment).
let memoisedResult = null;
/** Test-only escape hatch: clears the in-process memo. Never called by any
 * real production code path -- vice-broker.mts calls resolvedBackend()
 * exactly once per real process lifetime and has no reason to ever reset it;
 * this exists solely so backend-detect.test.ts can drive many distinct
 * scenarios (fresh identity, matching cached identity, changed identity, ...)
 * in one shared test process without one scenario's memoised answer
 * contaminating the next. */
export function resetResolvedBackendForTests() {
    memoisedResult = null;
}
/** WR-05: the ONE place `binPath`/`binPathResolved` are derived, so a
 * resolved absolute path when there is one, or the configured name flagged
 * as unresolved when there is not, is computed identically everywhere this
 * file returns it. */
function binPathFields(resolvedPath, viceBin) {
    return resolvedPath !== null ? { binPath: resolvedPath, binPathResolved: true } : { binPath: viceBin, binPathResolved: false };
}
/** Resolves the emulator binary's identity and (re)initialises the on-disk
 * identity/capability cache record for it when a `supervisorDir` is given.
 * Memoises the answer in a module-level variable so a long-running process
 * resolves once (see the memo's own comment above for what "once" means
 * here). Never throws.
 *
 * FORKRM-01: there is nothing left to detect -- `backend` is always
 * `"stock"`. What this function still does is identity resolution (WR-05's
 * `binPath`/`binPathResolved`) and cache bookkeeping for BACK-04's capability
 * record: when the resolved binary's identity (`resolvedPath`/`mtimeMs`/
 * `sizeBytes`) does not match whatever is already on file -- no record at
 * all, or a record describing a DIFFERENT binary (replaced in place, or a
 * fresh install) -- a fresh identity record is written, with no stale
 * capability fields carried over from a different binary's answer. A
 * matching identity is left untouched, so a capability answer already
 * recorded for THIS binary survives. */
export function resolvedBackend(deps = {}) {
    if (memoisedResult !== null)
        return memoisedResult;
    const env = deps.env ?? process.env;
    const stat = deps.stat ?? defaultStat;
    const now = deps.now ?? (() => Date.now());
    let viceBin;
    let resolvedPath;
    // Phase 60 gap closure (LOC-03, PD-13): non-null only in the PD-01 branch
    // below, and only when the seam itself refused. Carried verbatim onto the
    // returned result's own `locationRefusal` field (see that field's own doc
    // comment for why); this module reads no environment variable to compose
    // it, and reads none to name it here either.
    let locationRefusal = null;
    if (deps.viceBin !== undefined || deps.resolveBinPath !== undefined) {
        // PD-02: an explicit override bypasses the seam entirely -- byte-for-byte
        // the same behaviour every existing injected test case already exercises.
        viceBin = deps.viceBin ?? "x64sc";
        const resolveBinPath = deps.resolveBinPath ?? defaultResolveBinPath;
        resolvedPath = resolveBinPath(viceBin, env);
    }
    else {
        // PD-01: resolvedBackend() gains the tools.json layer internally by
        // calling the seam; it keeps no ordering of its own. The seam's WHOLE
        // result is taken here (PD-13), not only its `path`: the display name
        // handed to binPathFields() below falls back to the seam's own
        // `envCandidate` -- the value the developer actually wrote -- when the
        // seam reports one, and to the literal "x64sc" only when it does not
        // (retiring the hardcoded display name IN-01 logged). `refusal` is
        // carried onto `locationRefusal` above unchanged.
        const projectRoot = deps.projectRoot ?? (deps.supervisorDir !== undefined ? dirname(dirname(deps.supervisorDir)) : process.cwd());
        const toolsDir = deps.toolsDir ?? (deps.supervisorDir !== undefined ? dirname(deps.supervisorDir) : join(process.cwd(), ".c64-re-tools"));
        const locate = deps.locate ?? toolLocationSeam().resolveTool;
        const locateDeps = { toolsDir, projectRoot, env };
        const locateResult = locate("x64sc", locateDeps);
        resolvedPath = locateResult.path;
        viceBin = locateResult.envCandidate ?? "x64sc";
        locationRefusal = locateResult.refusal;
    }
    const identity = resolvedPath ? stat(resolvedPath) : null;
    const cacheEligible = resolvedPath !== null && identity !== null && typeof deps.supervisorDir === "string";
    if (cacheEligible) {
        const existing = readCacheRecord(deps.supervisorDir);
        const identityMatches = existing !== null &&
            existing.resolvedPath === resolvedPath &&
            existing.mtimeMs === identity.mtimeMs &&
            existing.sizeBytes === identity.sizeBytes;
        if (!identityMatches) {
            writeCacheRecordAtomic(deps.supervisorDir, {
                version: 1,
                resolvedPath: resolvedPath,
                mtimeMs: identity.mtimeMs,
                sizeBytes: identity.sizeBytes,
                probedAt: new Date(now()).toISOString(),
            });
        }
    }
    const result = { backend: "stock", ...binPathFields(resolvedPath, viceBin), locationRefusal };
    memoisedResult = result;
    return result;
}
/** Reads whatever capability answers (BACK-04) are on record for `binPath`
 * -- `null` when there is no cache at all, the binary cannot be resolved, the
 * record on file names a DIFFERENT resolved binary, or nothing has been
 * recorded for this binary yet. Never throws. */
export function readCapabilityRecord(binPath, deps = {}) {
    if (typeof deps.supervisorDir !== "string")
        return null;
    const env = deps.env ?? process.env;
    const resolveBinPath = deps.resolveBinPath ?? defaultResolveBinPath;
    const resolvedPath = resolveBinPath(binPath, env);
    if (!resolvedPath)
        return null;
    const existing = readCacheRecord(deps.supervisorDir);
    if (!existing || existing.resolvedPath !== resolvedPath)
        return null;
    if (existing.versionQuad === undefined && existing.cpuHistoryAvailable === undefined)
        return null;
    const versionMismatch = deps.observedVersionQuad !== undefined &&
        existing.versionQuad !== undefined &&
        existing.versionQuad !== deps.observedVersionQuad;
    // CR-01: a record decided by a different client-side capability schema is
    // as untrustworthy as one decided against a different binary. Absent
    // counts as a mismatch -- that is every record written before the field
    // existed, i.e. every record a possibly-broken parser could have written.
    const schemaMismatch = existing.capabilitySchema !== CAPABILITY_SCHEMA_VERSION;
    const stale = versionMismatch || schemaMismatch;
    const result = { versionQuad: existing.versionQuad, cpuHistoryAvailable: existing.cpuHistoryAvailable, stale };
    if (existing.capabilitySchema !== undefined)
        result.capabilitySchema = existing.capabilitySchema;
    return result;
}
/** Attaches `{ versionQuad, cpuHistoryAvailable }` to the EXISTING identity
 * record already on file for `binPath`'s resolved identity -- a no-op, never
 * a throw, when there is no such matching record yet (no supervisorDir
 * given, the binary cannot be resolved or stat'd, or the cache names a
 * different binary or has no record at all). This function never invents an
 * identity record of its own: it can only EXTEND a record resolvedBackend()
 * already wrote. */
export function writeCapabilityRecord(binPath, capability, deps = {}) {
    if (typeof deps.supervisorDir !== "string")
        return;
    const env = deps.env ?? process.env;
    const resolveBinPath = deps.resolveBinPath ?? defaultResolveBinPath;
    const stat = deps.stat ?? defaultStat;
    const resolvedPath = resolveBinPath(binPath, env);
    if (!resolvedPath)
        return;
    const identity = stat(resolvedPath);
    if (!identity)
        return;
    const existing = readCacheRecord(deps.supervisorDir);
    if (!existing || existing.resolvedPath !== resolvedPath)
        return;
    writeCacheRecordAtomic(deps.supervisorDir, {
        version: 1,
        resolvedPath,
        mtimeMs: identity.mtimeMs,
        sizeBytes: identity.sizeBytes,
        probedAt: existing.probedAt,
        versionQuad: capability.versionQuad,
        cpuHistoryAvailable: capability.cpuHistoryAvailable,
        // CR-01: stamp WHICH client decided this, so a later parser change
        // invalidates it. Never accept this from the caller -- it describes this
        // module's own code, not anything the caller observed.
        capabilitySchema: CAPABILITY_SCHEMA_VERSION,
    });
}
