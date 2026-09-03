// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from ghidra-project.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to tools/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// ghidra-project.mts
//
// Phase 34, plan 34-03 (SEAM-04): the dot-segment refusal and the per-run
// Ghidra project location, enforced in THIS PROJECT'S OWN CODE before
// `analyzeHeadless` is ever reached. Motivated by 34-RESEARCH.md Finding 2:
// this session ran real Ghidra 12.1.3 twice and found the refusal walks the
// ENTIRE absolute project-location path, not just the leaf --
// `ghidra.util.NamingUtilities.checkName()` -> `GhidraURL.checkValidProjectPath()`
// -> `ghidra.framework.model.ProjectLocator`'s constructor -- firing after
// 12-16 seconds of JVM startup with a hard `exit 1` and the literal message
// "Path element starting with '.' is not permitted". A client-side
// per-segment check is not merely tidier here; it is the ONLY way to
// satisfy "refused before analyzeHeadless is ever reached" literally,
// because Ghidra's own refusal necessarily happens INSIDE a running
// `analyzeHeadless` process.
//
// THIS IS THE ONE AUTHORITATIVE PLACE for three things, none of which may
// be re-derived anywhere else -- in particular not copied into
// host-tool.mts, which reaches these by a VALUE import of this module's
// compiled `.mjs` sibling instead:
//   - the dot-segment rule (hasDotPrefixedSegment());
//   - the per-run project location (resolveGhidraProject()) -- a fresh,
//     never-reused directory per run id, which is what makes Ghidra's
//     single-writer project lock UNREACHABLE rather than merely guarded;
//   - analyzeHeadless argv construction (buildAnalyzeHeadlessArgv()), which
//     re-runs the dot-segment check independently so the rule holds even
//     for a caller that skipped the resolver entirely.
//
// WHAT NOT TO DO, each naming the prohibition it guards (34-03-PLAN.md's
// own `must_haves.prohibitions`):
//   - Never implement the refusal by parsing Ghidra's own stderr for the
//     `IllegalArgumentException` string -- that would mean paying the
//     ~12-16s JVM startup cost to learn a fact a string comparison already
//     knows.
//   - Never reuse a project directory across run ids -- reuse is exactly
//     what makes the single-writer lock reachable again.
//   - Never hardcode an absolute runs-root path -- it is always derived
//     from a caller-supplied repoRoot plus GHIDRA_RUNS_DIR_NAME.
//   - No second copy of the dot-segment rule anywhere outside this file.
//   - No child-process call, no reference to an `analyzeHeadless`
//     executable path, anywhere in this module -- it is pure string and
//     filesystem-EXISTENCE-check logic, provable with no Ghidra
//     installation present. (`existsSync` below checks only whether a
//     directory this project itself is about to hand to a FUTURE
//     `analyzeHeadless` invocation already exists -- it never invokes
//     anything.)
import { existsSync } from "node:fs";
import { join, sep } from "node:path";
/** The refusal-message fragment naming Ghidra's own literal error text, in
 * ONE place, so every refusal in this module (and any caller reading a
 * refusal message) can quote the same words Ghidra itself would have used
 * ~12-16 seconds later. */
export const DOT_SEGMENT_REFUSAL = "path element starting with '.' is not permitted";
/** The runs-root directory name, joined under `<repoRoot>/tools/` (A-07) --
 * `install-resources.ts`'s own `installTargetDir()` root, already
 * non-dot-prefixed and already inside the bind-mounted workspace tree, so a
 * result path under it is always translatable by `containerPath()`. */
export const GHIDRA_RUNS_DIR_NAME = "ghidra-runs";
/** Anchored, narrow run-id shape, in `vice-broker-client.ts`'s own
 * `REQUEST_ID_PATTERN` spirit for a validated opaque id: begins
 * alphanumeric, then a small explicitly-listed printable set (alphanumeric,
 * dash, underscore), no path separator, no dot ANYWHERE (a leading OR
 * embedded dot is refused, since either would make the corresponding path
 * segment dot-PREFIXED at its own start once joined -- e.g. a hypothetical
 * "a.b" run id would be fine as a segment name, but this pattern refuses it
 * anyway to keep the accepted run-id alphabet simple and auditable), and a
 * stated length cap so a run id can never grow into something implausible. */
export const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** Splits `absolutePath` on the platform separator and reports the FIRST
 * segment beginning with `.` -- checking EVERY segment, not just the leaf,
 * per Finding 2's own discovery. Returning the offending SEGMENT (never a
 * bare boolean) is what lets every caller's refusal message name the
 * offender rather than merely saying "refused".
 *
 * The empty leading segment produced by splitting an absolute path (e.g.
 * `"/a/b".split(sep)` -> `["", "a", "b"]`) is ignored -- it is not a real
 * path element and does not begin with `.` in any user-meaningful sense.
 * A doubled separator (`"a//b"`) produces an empty INTERNAL segment, which
 * is likewise skipped: there is no element there to judge.
 *
 * A literal `".."` segment (a parent-directory reference) STARTS with `.`
 * exactly like any other dot-prefixed name, so it is refused by the same
 * check with no special-casing -- this function never resolves or
 * normalises the path, precisely so a `".."` segment stays visible to it
 * (path.resolve()/path.join() would silently normalise `".."` away before
 * this function ever saw it).
 *
 * Never throws: `/` and `""` both resolve to no dotted segment. */
export function hasDotPrefixedSegment(absolutePath) {
    if (typeof absolutePath !== "string" || absolutePath === "")
        return { dotted: false };
    const rawSegments = absolutePath.split(sep);
    for (let i = 0; i < rawSegments.length; i++) {
        const segment = rawSegments[i];
        if (segment === "")
            continue; // the absolute-path leading empty segment, or a doubled separator
        if (segment.startsWith("."))
            return { dotted: true, segment };
    }
    return { dotted: false };
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function describe(value) {
    try {
        const json = JSON.stringify(value);
        return json === undefined ? String(value) : json;
    }
    catch {
        return String(value);
    }
}
// ---------------------------------------------------------------------------
// resolveGhidraProject -- the per-run project location (SEAM-04). Mirrors
// broker-control.mts's normaliseLaunchProfile()/host-tool.mts's
// normaliseHostToolRequest() discipline: narrow at one site, refuse unknown
// keys BY NAME, never coerce.
// ---------------------------------------------------------------------------
const RESOLVE_GHIDRA_PROJECT_KEYS = Object.freeze(["repoRoot", "runId"]);
const RESOLVE_GHIDRA_PROJECT_SHAPE = `an object with exactly the keys ${RESOLVE_GHIDRA_PROJECT_KEYS.join("/")}, both non-empty strings`;
/** THIS IS THE ONE PLACE a Ghidra run's project location is computed. Never
 * throws; answers a discriminated result naming the offending value, key,
 * or path segment. Refusal order: shape/keys, then `repoRoot` type, then
 * `runId` type and pattern, then the dot-segment check over the computed
 * ABSOLUTE `projectLocation` (which, since it is built by joining `repoRoot`
 * onto itself, also catches a dot-prefixed `repoRoot` -- e.g. a caller that
 * mistakenly passed `.vice-supervisor/` or `.planning/` as `repoRoot`),
 * then the already-exists (no-reuse) idempotency check. */
export function resolveGhidraProject(input) {
    if (!isPlainObject(input)) {
        return { ok: false, message: `resolveGhidraProject input must be ${RESOLVE_GHIDRA_PROJECT_SHAPE}; got ${describe(input)}` };
    }
    const unknownKeys = Object.keys(input).filter((key) => !RESOLVE_GHIDRA_PROJECT_KEYS.includes(key));
    if (unknownKeys.length > 0) {
        return {
            ok: false,
            message: `resolveGhidraProject input has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${RESOLVE_GHIDRA_PROJECT_SHAPE}`,
        };
    }
    const repoRoot = input.repoRoot;
    if (typeof repoRoot !== "string" || repoRoot === "") {
        return { ok: false, message: `resolveGhidraProject requires a non-empty string "repoRoot"; got ${describe(repoRoot)}` };
    }
    const runId = input.runId;
    if (typeof runId !== "string" || runId === "") {
        return { ok: false, message: `resolveGhidraProject requires a non-empty string "runId"; got ${describe(runId)}` };
    }
    if (!RUN_ID_PATTERN.test(runId)) {
        return {
            ok: false,
            message: `resolveGhidraProject "runId" must match ${RUN_ID_PATTERN.source} (alphanumeric-first, alphanumeric/dash/underscore only, no separator, no dot, length-capped); got ${describe(runId)}`,
        };
    }
    const runsRoot = join(repoRoot, "tools", GHIDRA_RUNS_DIR_NAME);
    const projectLocation = join(runsRoot, runId);
    const projectName = runId;
    const dotted = hasDotPrefixedSegment(projectLocation);
    if (dotted.dotted) {
        return {
            ok: false,
            message: `resolveGhidraProject refuses a project location containing a dot-prefixed path element ("${dotted.segment}"): ${DOT_SEGMENT_REFUSAL}; computed location was ${projectLocation}`,
        };
    }
    if (existsSync(projectLocation)) {
        return {
            ok: false,
            message: `resolveGhidraProject refuses to reuse an existing run directory (${projectLocation}): ` +
                `a Ghidra project directory is never reused across runs, because reuse is exactly what makes ` +
                `Ghidra's single-writer project lock reachable again -- choose a different runId`,
        };
    }
    return { ok: true, runsRoot, projectLocation, projectName };
}
// ---------------------------------------------------------------------------
// buildAnalyzeHeadlessArgv -- server-side argv construction (mirrors
// host-tool.mts's own buildHostToolArgv() discipline: typed fields only,
// re-checks the dot-segment rule independently so it holds even for a
// caller that bypassed resolveGhidraProject()).
// ---------------------------------------------------------------------------
const BUILD_ANALYZE_HEADLESS_ARGV_KEYS = Object.freeze([
    "projectLocation",
    "projectName",
    "importPath",
    "preScript",
    "postScript",
]);
const BUILD_ANALYZE_HEADLESS_ARGV_SHAPE = `an object with keys ${BUILD_ANALYZE_HEADLESS_ARGV_KEYS.join("/")} ` +
    `("projectLocation"/"projectName"/"importPath" required non-empty strings, ` +
    `"preScript"/"postScript" optional non-empty strings)`;
/** Emits `[projectLocation, projectName, "-import", importPath,
 * "-deleteProject", ...optional pre/post script flags]`.
 *
 * `-deleteProject` only applies on the `-import` path (never on `-process`)
 * -- the local `analyzeHeadlessREADME.md` (Ghidra 12.1.3) states: "the
 * Ghidra project will be deleted after scripts and/or analysis have
 * completed (only applies if the project has been created in the current
 * session with `-import`; existing projects are never deleted)." This is
 * exactly why the per-run directory (resolveGhidraProject()'s own refusal
 * to reuse an existing run directory) is the PRIMARY mechanism that makes
 * the single-writer lock unreachable, and `-deleteProject` is a SECONDARY
 * cleanup on top of it, never a substitute for it. */
export function buildAnalyzeHeadlessArgv(input) {
    if (!isPlainObject(input)) {
        return { ok: false, message: `buildAnalyzeHeadlessArgv input must be ${BUILD_ANALYZE_HEADLESS_ARGV_SHAPE}; got ${describe(input)}` };
    }
    const unknownKeys = Object.keys(input).filter((key) => !BUILD_ANALYZE_HEADLESS_ARGV_KEYS.includes(key));
    if (unknownKeys.length > 0) {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv input has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${BUILD_ANALYZE_HEADLESS_ARGV_SHAPE}`,
        };
    }
    const { projectLocation, projectName, importPath, preScript, postScript } = input;
    for (const [key, value] of [
        ["projectLocation", projectLocation],
        ["projectName", projectName],
        ["importPath", importPath],
    ]) {
        if (typeof value !== "string" || value === "") {
            return { ok: false, message: `buildAnalyzeHeadlessArgv requires a non-empty string "${key}"; got ${describe(value)}` };
        }
    }
    if (preScript !== undefined && (typeof preScript !== "string" || preScript === "")) {
        return { ok: false, message: `buildAnalyzeHeadlessArgv "preScript" must be a non-empty string or absent; got ${describe(preScript)}` };
    }
    if (postScript !== undefined && (typeof postScript !== "string" || postScript === "")) {
        return { ok: false, message: `buildAnalyzeHeadlessArgv "postScript" must be a non-empty string or absent; got ${describe(postScript)}` };
    }
    // Re-run the dot-segment check independently of resolveGhidraProject() --
    // so the rule holds even for a caller that constructed `projectLocation`
    // itself and skipped the resolver entirely (T-34-14).
    const dotted = hasDotPrefixedSegment(projectLocation);
    if (dotted.dotted) {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv refuses a dot-prefixed project location ("${dotted.segment}"): ${DOT_SEGMENT_REFUSAL}; got ${describe(projectLocation)}`,
        };
    }
    const argv = [projectLocation, projectName, "-import", importPath, "-deleteProject"];
    if (typeof preScript === "string")
        argv.push("-preScript", preScript);
    if (typeof postScript === "string")
        argv.push("-postScript", postScript);
    return { ok: true, argv };
}
