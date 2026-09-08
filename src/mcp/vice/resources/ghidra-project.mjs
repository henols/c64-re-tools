// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from ghidra-project.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
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
//     for a caller that skipped the resolver entirely, AND (34-07, CR-02)
//     independently refuses a preScript/postScript carrying a
//     parent-directory path segment, for the same reason.
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
//     from a caller-supplied repoRoot via ghidraRunsRoot().
//   - No second copy of the dot-segment rule anywhere outside this file.
//   - No child-process call, no reference to an `analyzeHeadless`
//     executable path, anywhere in this module -- it is pure string,
//     filesystem-EXISTENCE-check, and filesystem-CREATE logic, provable
//     with no Ghidra installation present. (`existsSync`/`mkdirSync` below
//     only ever check or create a directory this project itself is about
//     to hand to a FUTURE `analyzeHeadless` invocation -- neither ever
//     invokes anything.)
//
// LIVE FINDING, this plan's own Task 3 (not stated by 34-RESEARCH.md
// Finding 2, which only ever exercised the REFUSAL path): a real Ghidra
// 12.1.3 run against a CLEAN, non-dotted, well-formed project location that
// does not yet exist on disk fails with `java.io.FileNotFoundException:
// Directory not found` at `DefaultProjectManager.createProject()` --
// `analyzeHeadless` does not create the leaf project directory itself, on
// EITHER path (refusal or success). resolveGhidraProject() therefore
// CREATES the directory as the last step of a successful resolution (never
// on a refusal) -- this is what makes it a genuine RESERVATION, not just a
// path computation: the moment a caller receives `ok: true`, the directory
// exists and a second call under the same run id is refused, with no
// window where two callers could observe an absent directory and both
// proceed. See `evidence/34-ghidra-dotpath.md` for the full transcript.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync } from "node:fs";
import { join, sep } from "node:path";
/** The refusal-message fragment naming Ghidra's own literal error text, in
 * ONE place, so every refusal in this module (and any caller reading a
 * refusal message) can quote the same words Ghidra itself would have used
 * ~12-16 seconds later. */
export const DOT_SEGMENT_REFUSAL = "path element starting with '.' is not permitted";
/** Gap G-40-1 (2026-09-08): the Ghidra runs root moved UNDER the single
 * tool-written root (`.c64-re-tools/`, D-33) via a broker-minted symlink
 * HANDLE, not by relocating the physical bytes anywhere else. This corrects
 * an earlier, unmeasured claim recorded right here -- see "What this
 * corrects" below.
 *
 * MEASURED against real Ghidra 12.1.3
 * (`.planning/notes/ghidra-dot-path-check-semantics.md`: 5 live
 * `analyzeHeadless` runs plus a `javap` read of `ProjectLocator.class`): the
 * dot-segment refusal binds the ABSOLUTIZED project-location path argument
 * -- `ProjectLocator` calls `java.io.File.getAbsolutePath()` and never
 * `getCanonicalPath()`. So:
 *   - a RELATIVE location is absolutized against the process cwd and then
 *     refused if that absolutized path carries a dotted segment;
 *   - a bare `.` segment survives absolutization and is itself caught;
 *   - a SYMLINK is NOT resolved -- Ghidra never canonicalises the path, so a
 *     non-dotted symlink into a dotted directory is ACCEPTED. Proven by a
 *     FULL import plus analysis run through such a link
 *     (`REPORT: Analysis succeeded`, 2.1M of program database physically
 *     under `.c64-re-tools/`), not merely by project creation -- an earlier,
 *     less complete run had mistaken creation alone for proof.
 *
 * The chosen location therefore satisfies three conditions SIMULTANEOUSLY,
 * all three load-bearing and none of them optional:
 *   1. No dotted or bare-dot segment anywhere in the ABSOLUTIZED path handed
 *      to `analyzeHeadless` (this file's own `hasDotPrefixedSegment()`).
 *   2. The path stays INSIDE the bind-mounted workspace tree --
 *      `containerPath()` THROWS on a host path matching no known host root
 *      (`containerpath.ts`), so an out-of-workspace handle (a `/tmp` or
 *      XDG-cache location) breaks the container route outright.
 *   3. The link TARGET is RELATIVE, not absolute -- the CONTAINER itself
 *      traverses this handle to read the per-run log (`ghidra-run.ts:241`),
 *      and an absolute HOST-side target names a path that does not exist
 *      inside the container, so every run-log read would ENOENT.
 *
 * What this corrects: an earlier version of this comment stated re-pointing
 * the runs root under `.c64-re-tools/` would make `resolveGhidraProject()`
 * "refuse EVERY call, unconditionally," and called that "a hard
 * external-tool constraint, not a preference." Both claims were inferred
 * from running THIS MODULE'S OWN `hasDotPrefixedSegment()` against a
 * synthetic `.c64-re-tools/runs/ghidra/<runId>` string -- a self-referential
 * check that observes this project's own predicate, never Ghidra itself.
 * That inference is superseded by the measurement above; do not
 * reconstruct it from the same self-referential method a second time.
 *
 * Fragility this design knowingly accepts: the symlink route depends on
 * Ghidra continuing to call `getAbsolutePath()` rather than
 * `getCanonicalPath()` -- a one-word upstream change would silently break
 * every run with the same misleading dot-segment error, ~12-16s late. Plan
 * 40-09 adds a live guard for this; this module still must NEVER implement
 * that guard by string-matching Ghidra's own stderr (this file's header,
 * above, already prohibits paying the JVM-startup cost to learn a fact a
 * string comparison already knows). */
export const GHIDRA_RUNS_HANDLE_NAME = "c64-re-tools";
/** The symlink TARGET `ensureGhidraRunsHandle()` mints at
 * `<repoRoot>/GHIDRA_RUNS_HANDLE_NAME` -- the RELATIVE string `.c64-re-tools`
 * (condition 3 above), never an absolute path. Relative so the CONTAINER
 * resolves it against the symlink's own directory rather than a host-only
 * absolute path. */
export const GHIDRA_RUNS_HANDLE_TARGET = ".c64-re-tools";
/** THE one place the path HANDED TO GHIDRA is computed: the repo root, the
 * non-dotted handle segment, then `runs`, then `ghidra`. Every consumer
 * (`resolveGhidraProject()` below, `host-tool.mts`'s run-log path, any
 * future caller) derives the runs root from this function rather than
 * re-joining the segments itself. */
export function ghidraRunsRoot(repoRoot) {
    return join(repoRoot, GHIDRA_RUNS_HANDLE_NAME, "runs", "ghidra");
}
/** The PHYSICAL location the same runs live at, reached through the handle
 * symlink `ghidraRunsRoot()` points at -- the repo root, the dotted target
 * segment, then `runs`, then `ghidra`. Exported so a test (or a filesystem
 * audit) can assert the D-33 "physically under `.c64-re-tools/`" truth
 * without re-deriving this shape itself. */
export function ghidraRunsRealRoot(repoRoot) {
    return join(repoRoot, GHIDRA_RUNS_HANDLE_TARGET, "runs", "ghidra");
}
/**
 * Mints (or verifies) the broker-owned symlink HANDLE that lets a Ghidra
 * project location satisfy the dot-segment refusal while the bytes
 * genuinely live under `.c64-re-tools/` (D-33). Never throws; idempotent;
 * NEVER repairs a wrong or foreign handle -- refuses BY NAME instead. This
 * is the precondition that makes the reservation `mkdirSync` in
 * `resolveGhidraProject()` below safe: without it, a missing handle would
 * let recursive `mkdir` silently materialise a REAL directory tree at the
 * handle path, and D-33 would break invisibly (the gap this whole function
 * closes).
 *
 * Order, so a dangling link is never observable:
 *   1. Narrow `repoRoot` the same way `resolveGhidraProject()` does.
 *   2. Create the PHYSICAL runs tree first, recursively, at
 *      `ghidraRunsRealRoot()`. On failure, refuse naming that path and the
 *      underlying error.
 *   3. `lstatSync()` the handle path. On ENOENT, `symlinkSync()` the
 *      RELATIVE target at the handle path. `EEXIST` is caught specifically
 *      and falls through to step 4 rather than being treated as a failure --
 *      two host-side callers (the broker at startup, a concurrent
 *      brokerless spawn) can race here, and the loser of that race must
 *      observe success, not a spurious error. No lock is taken and none is
 *      needed: both callers write the identical link.
 *   4. VERIFY unconditionally, including immediately after minting -- one
 *      verification path, no trust placed in this function's own write.
 *      `lstatSync()` must report a symbolic link, and `readlinkSync()` must
 *      equal `GHIDRA_RUNS_HANDLE_TARGET` by EXACT string comparison.
 *      Anything else refuses.
 *
 * A refusal NEVER repairs: no unlink, no replace, no rename. Whatever
 * already sits at the handle path may be a user's own deliberate directory,
 * a stale artifact, or a redirect -- silently replacing it is exactly the
 * invisible-breakage shape this function exists to close.
 */
export function ensureGhidraRunsHandle(repoRoot) {
    if (typeof repoRoot !== "string" || repoRoot === "") {
        return { ok: false, message: `ensureGhidraRunsHandle requires a non-empty string "repoRoot"; got ${describe(repoRoot)}` };
    }
    const realRoot = ghidraRunsRealRoot(repoRoot);
    try {
        mkdirSync(realRoot, { recursive: true });
    }
    catch (e) {
        return { ok: false, message: `ensureGhidraRunsHandle failed to create the physical runs tree (${realRoot}): ${e instanceof Error ? e.message : String(e)}` };
    }
    const handlePath = join(repoRoot, GHIDRA_RUNS_HANDLE_NAME);
    let handleAlreadyExists = true;
    try {
        lstatSync(handlePath);
    }
    catch {
        handleAlreadyExists = false;
    }
    if (!handleAlreadyExists) {
        try {
            symlinkSync(GHIDRA_RUNS_HANDLE_TARGET, handlePath);
        }
        catch (e) {
            const code = e instanceof Error && "code" in e ? e.code : undefined;
            if (code !== "EEXIST") {
                return {
                    ok: false,
                    message: `ensureGhidraRunsHandle failed to create the handle symlink (${handlePath} -> ${GHIDRA_RUNS_HANDLE_TARGET}): ${e instanceof Error ? e.message : String(e)}`,
                };
            }
            // EEXIST: a concurrent caller won the race and created the identical
            // link between our lstatSync() above and this symlinkSync() call --
            // fall through to unconditional verification rather than treating
            // this as a failure.
        }
    }
    // VERIFY unconditionally -- never trust the write above, whichever branch
    // took it.
    let stat;
    try {
        stat = lstatSync(handlePath);
    }
    catch (e) {
        return {
            ok: false,
            message: `ensureGhidraRunsHandle: the handle (${handlePath}) does not exist after a creation attempt: ${e instanceof Error ? e.message : String(e)}`,
        };
    }
    if (!stat.isSymbolicLink()) {
        const kind = stat.isDirectory() ? "a directory" : stat.isFile() ? "a file" : "neither a directory, a file, nor a symbolic link";
        return {
            ok: false,
            message: `ensureGhidraRunsHandle refuses: ${handlePath} already exists and is ${kind}, not a symbolic link. ` +
                `This handle must remain a broker-minted alias pointing at the relative target "${GHIDRA_RUNS_HANDLE_TARGET}" -- ` +
                `it is never deleted, replaced, or repaired automatically. Remove it by hand if it is safe to do so, then retry.`,
        };
    }
    // Guarded for the same reason the two lstatSync() calls above are: this
    // function documents "Never throws", and its broker call site
    // (vice-broker.mts run(), requirement R2) sits deliberately OUTSIDE any
    // try/catch so that a refusal is reported without stopping startup. An
    // unguarded throw here would instead reach main()'s outer catch and abort
    // the whole broker -- the exact opposite of R2's "a broker that cannot mint
    // the handle still starts and says so". The window is narrow but real: the
    // handle can be deleted or replaced between the verifying lstatSync() above
    // and this readlinkSync() (TOCTOU). Found by code review, plan 40-09.
    let target;
    try {
        target = readlinkSync(handlePath);
    }
    catch (e) {
        return {
            ok: false,
            message: `ensureGhidraRunsHandle: ${handlePath} verified as a symbolic link but its target could not be read ` +
                `(it was most likely removed or replaced concurrently): ${e instanceof Error ? e.message : String(e)}`,
        };
    }
    if (target !== GHIDRA_RUNS_HANDLE_TARGET) {
        return {
            ok: false,
            message: `ensureGhidraRunsHandle refuses: ${handlePath} is a symbolic link but points to "${target}", not the expected ` +
                `relative target "${GHIDRA_RUNS_HANDLE_TARGET}" -- an absolute or otherwise-wrong target breaks the container ` +
                `route, which traverses this link to read the per-run log. It is never repaired automatically. Remove it by ` +
                `hand if it is safe to do so, then retry.`,
        };
    }
    return { ok: true, handle: handlePath, target };
}
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
// ---------------------------------------------------------------------------
// Phase 36, plan 36-01 (OPC-01, OPC-04, T-36-02, T-36-03). The SLEIGH
// language-id shape and the extension-module file set, in the SAME
// "one authoritative place" discipline this module's own header states for
// the dot-segment rule and the per-run project location.
// ---------------------------------------------------------------------------
/** Anchored Ghidra language-id shape, in `RUN_ID_PATTERN`'s own spirit: a
 * colon-separated sequence of alphanumeric-and-underscore segments (e.g.
 * `6502:LE:16:nmos`), no path separator, no dot ANYWHERE, and a stated
 * length cap so a caller-supplied `processor` string can never grow into
 * something implausible. Deliberately NOT routed through
 * `resolveWorkspacePath()` -- it is a language id, not a path (T-36-02).
 * Compared byte-exactly and case-sensitively wherever it is used --
 * `6502:le:16:nmos` does not match this pattern's own literal segment
 * alphabet in a case-insensitive sense; the RegExp itself carries no `i`
 * flag, so a caller cannot silently loosen the comparison by construction. */
export const LANGUAGE_ID_PATTERN = /^[A-Za-z0-9_]{1,64}(:[A-Za-z0-9_]{1,64}){1,7}$/;
// ---------------------------------------------------------------------------
// Phase 36, plan 36-02 (GHID-01, D-36-07). The loader-base-address shape and
// the import-route enum, in the SAME "one authoritative place" discipline
// this module's header states.
// ---------------------------------------------------------------------------
/** Anchored loader-base-address shape: a `0x` prefix followed by one to four
 * LOWERCASE hex digits, anchored at both ends -- `"0X0"` (uppercase X) and
 * `"0x0; rm -rf /"` both fail this pattern by construction, since the
 * comparison is over the WHOLE string, not a prefix match. It is a raw argv
 * token (never a path), so it is validated here rather than routed through
 * `resolveWorkspacePath()` (T-36-09). */
export const LOADER_BASE_ADDR_PATTERN = /^0x[0-9a-f]{1,4}$/;
export const GHIDRA_IMPORT_ROUTES = Object.freeze(["prg", "flat64k"]);
// ---------------------------------------------------------------------------
// Phase 37, plan 37-08 (AUTO-07): the data-range pre-script's own fixed
// script name. `dataRangesPath` (below) is a wire field naming a RANGE FILE
// only -- never a script name -- because the script that reads it always
// lives beside `VolatileCarve.java`/`GhidraStructExport.java` in the SAME
// `scriptPath` directory every caller already supplies (see
// `ghidra-live.test.ts`'s own `scriptPath: "vendor/ghidra-scripts"`
// convention), exactly like `GHIDRA_STOCK_6502_LANGUAGE_FILES` above names a
// fixed file set rather than accepting one on the wire. This keeps
// `dataRangesPath` the ONLY new field this plan adds (D-37-33), with no
// second "which script" field to keep in sync.
// ---------------------------------------------------------------------------
/** The fixed name of plan 37-08's new pre-script, `DataRangeSeed.java` --
 * resolved by Ghidra against the SAME `-scriptPath` directory every other
 * script name here already resolves against. Never a wire field. */
export const DATA_RANGE_SEED_SCRIPT_NAME = "DataRangeSeed.java";
/** The route's own fixed loader base address, as a lowercase-hex string
 * matching `LOADER_BASE_ADDR_PATTERN`. The flat-64K route bases at zero --
 * the whole 64K address space IS the image; the `.prg` route bases at
 * `0x801`, the C64 BASIC program start address (MEASURED, carried from
 * `36-RESEARCH.md`'s own recorded `analyzeHeadless` invocations) -- a
 * `.prg`'s load address is a property of the IMAGE, not of the route, which
 * is why `loaderBaseAddr` stays a separately overridable field on the `prg`
 * route (D-36-07) rather than being folded into this function entirely. */
export function importRouteBaseAddr(route) {
    return route === "flat64k" ? "0x0" : "0x801";
}
/** The three stock 6502-processor language files `6502_nmos.slaspec` and
 * `6502_nmos.ldefs` depend on (`@include "6502.slaspec"`, and `.ldefs`
 * `processorspec="6502.pspec"` / `compiler spec="6502.cspec"`) -- per
 * D-36-02, copied at INSTALL time from the host's own Ghidra installation,
 * never committed into this repository (committing them would silently pin
 * a Ghidra version inside this repo, the same objection already recorded
 * against committing the compiled `.sla`). `ghidra.installExtension`
 * (host-tool.mts) and `sleigh-compile-gate.test.ts`'s COMPILE half both copy
 * exactly this list from `<GHIDRA_HOME>/Ghidra/Processors/6502/data/languages/`
 * -- one shared list, never re-typed at either call site. */
export const GHIDRA_STOCK_6502_LANGUAGE_FILES = Object.freeze(["6502.slaspec", "6502.pspec", "6502.cspec"]);
/** Matches one `<language ...>` opening tag at a time. Attributes may span
 * multiple lines (MEASURED against the real stock `6502.ldefs`), so this
 * deliberately does not anchor to a single line -- it stops at the first
 * unescaped `>`, which is always the tag's own close, since no attribute
 * value in a `.ldefs` file contains a literal `>`. */
const LANGUAGE_ELEMENT_PATTERN = /<language\b[^>]*>/g;
const ID_ATTR_PATTERN = /\bid\s*=\s*"([^"]*)"/;
const SLAFILE_ATTR_PATTERN = /\bslafile\s*=\s*"([^"]*)"/;
/**
 * Walks every module directory under `<ghidraHome>/Ghidra/Extensions/` and
 * `<ghidraHome>/Ghidra/Processors/`, reading each one's own
 * `data/languages/` directory for `.ldefs` files, and returns
 * every declared `<language>` element's own `id`/`slafile` pair, plus
 * whether that `slafile` exists on disk beside its own `.ldefs` -- a SORTED
 * list (by `id`) so any assertion over the result is order-independent.
 *
 * `ghidraHome` is an explicit parameter, never read from
 * `process.env.GHIDRA_HOME` internally, so the whole function is drivable
 * against a synthetic directory tree with no real Ghidra installation
 * present.
 *
 * A missing root (no `Extensions/` directory at all, the ordinary state of
 * a fresh Ghidra install before any extension is ever installed) is
 * treated as "no entries there" -- neither a refusal nor a throw. Any other
 * filesystem error on a candidate module/language-file is likewise skipped
 * rather than thrown: this function's contract is a plain data return, not
 * a discriminated result.
 *
 * Read via a narrow anchored attribute match, never a general XML parse --
 * this module has no parser dependency today and must not gain one for a
 * single filesystem-read helper.
 *
 * This function performs no child-process call and touches nothing outside
 * the directory it is given -- it never creates, copies, or compiles
 * anything, preserving this module's own header invariant.
 */
export function installedLanguageIds(ghidraHome) {
    const results = [];
    const moduleRoots = [join(ghidraHome, "Ghidra", "Extensions"), join(ghidraHome, "Ghidra", "Processors")];
    for (const moduleRoot of moduleRoots) {
        let moduleNames;
        try {
            moduleNames = readdirSync(moduleRoot, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);
        }
        catch {
            continue;
        }
        for (const moduleName of moduleNames) {
            const languagesDir = join(moduleRoot, moduleName, "data", "languages");
            let fileNames;
            try {
                fileNames = readdirSync(languagesDir).filter((name) => name.endsWith(".ldefs"));
            }
            catch {
                continue;
            }
            for (const fileName of fileNames) {
                const ldefsPath = join(languagesDir, fileName);
                let text;
                try {
                    text = readFileSync(ldefsPath, "utf8");
                }
                catch {
                    continue;
                }
                for (const tagMatch of text.matchAll(LANGUAGE_ELEMENT_PATTERN)) {
                    const tagText = tagMatch[0];
                    const idMatch = ID_ATTR_PATTERN.exec(tagText);
                    const slafileMatch = SLAFILE_ATTR_PATTERN.exec(tagText);
                    if (!idMatch || !slafileMatch)
                        continue;
                    const id = idMatch[1];
                    const slafile = slafileMatch[1];
                    const slafileExists = existsSync(join(languagesDir, slafile));
                    results.push({ id, ldefsPath, slafile, slafileExists });
                }
            }
        }
    }
    results.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return results;
}
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
 * then `ensureGhidraRunsHandle()` as an idempotent precondition (a refusal
 * here propagates straight out, before any reuse check and before the
 * reservation `mkdirSync` below ever runs -- this order is what keeps a
 * missing/wrong handle from silently materialising a second root), then the
 * already-exists (no-reuse) idempotency check. */
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
    const runsRoot = ghidraRunsRoot(repoRoot);
    const projectLocation = join(runsRoot, runId);
    const projectName = runId;
    const dotted = hasDotPrefixedSegment(projectLocation);
    if (dotted.dotted) {
        return {
            ok: false,
            message: `resolveGhidraProject refuses a project location containing a dot-prefixed path element ("${dotted.segment}"): ${DOT_SEGMENT_REFUSAL}; computed location was ${projectLocation}`,
        };
    }
    const handleResult = ensureGhidraRunsHandle(repoRoot);
    if (!handleResult.ok) {
        return { ok: false, message: handleResult.message };
    }
    if (existsSync(projectLocation)) {
        return {
            ok: false,
            message: `resolveGhidraProject refuses to reuse an existing run directory (${projectLocation}): ` +
                `a Ghidra project directory is never reused across runs, because reuse is exactly what makes ` +
                `Ghidra's single-writer project lock reachable again -- choose a different runId`,
        };
    }
    // CREATE the directory here, as the LAST step of a successful resolution
    // (never on a refusal above). Measured live this plan (Task 3): real
    // Ghidra 12.1.3 does NOT create the leaf project directory itself --
    // `analyzeHeadless` against a clean, well-formed, not-yet-existing
    // location fails with `java.io.FileNotFoundException: Directory not
    // found` at `DefaultProjectManager.createProject()`. Creating it HERE
    // (rather than leaving it to host-tool.mts or to a caller) is what makes
    // this function a genuine RESERVATION: the directory exists the instant
    // `ok: true` is returned, so the existsSync() check above is what a
    // second call under the SAME run id will see -- there is no window where
    // two concurrent callers could both observe an absent directory.
    try {
        mkdirSync(projectLocation, { recursive: true });
    }
    catch (e) {
        return {
            ok: false,
            message: `resolveGhidraProject failed to create the run directory (${projectLocation}): ${e instanceof Error ? e.message : String(e)}`,
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
    "processor",
    "loaderBaseAddr",
    "noanalysis",
    "scriptPath",
    "preScript",
    "entrypointsPath",
    "postScript",
    "exportPath",
    "expectedClassificationLines",
    // Phase 37, plan 37-08 (AUTO-07, D-37-33): the ONE new key this plan adds.
    "dataRangesPath",
]);
const BUILD_ANALYZE_HEADLESS_ARGV_SHAPE = `an object with keys ${BUILD_ANALYZE_HEADLESS_ARGV_KEYS.join("/")} ` +
    `("projectLocation"/"projectName"/"importPath"/"processor"/"loaderBaseAddr" required non-empty strings, ` +
    `"noanalysis" an optional boolean, "scriptPath"/"preScript"/"entrypointsPath"/"postScript"/"exportPath"/` +
    `"dataRangesPath" optional non-empty strings, "expectedClassificationLines" an optional non-negative integer)`;
/** Emits `[projectLocation, projectName, "-import", importPath, "-processor",
 * processor, "-deleteProject", ...optional pre/post script flags]`.
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
    const { projectLocation, projectName, importPath, processor, loaderBaseAddr, noanalysis, scriptPath, preScript, entrypointsPath, postScript, exportPath, expectedClassificationLines, dataRangesPath } = input;
    for (const [key, value] of [
        ["projectLocation", projectLocation],
        ["projectName", projectName],
        ["importPath", importPath],
        ["processor", processor],
        ["loaderBaseAddr", loaderBaseAddr],
    ]) {
        if (typeof value !== "string" || value === "") {
            return { ok: false, message: `buildAnalyzeHeadlessArgv requires a non-empty string "${key}"; got ${describe(value)}` };
        }
    }
    // Phase 36, plan 36-01 (T-36-02): an INDEPENDENT second-layer check --
    // re-validated against LANGUAGE_ID_PATTERN here, so the rule holds even
    // for a caller that constructed this field itself and bypassed
    // host-tool.mts's own normaliseHostToolRequest() entirely. Mirrors the
    // dot-segment re-check below and the parent-segment re-check just after
    // it -- same second-layer discipline, third field.
    if (!LANGUAGE_ID_PATTERN.test(processor)) {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv "processor" must match ${LANGUAGE_ID_PATTERN.source}; got ${describe(processor)}`,
        };
    }
    // Phase 36, plan 36-02 (D-36-07, T-36-09): the SAME independent
    // second-layer discipline, fourth field -- so the rule holds even for a
    // caller that constructed `loaderBaseAddr` itself and bypassed
    // host-tool.mts's own route-conflict check entirely.
    if (!LOADER_BASE_ADDR_PATTERN.test(loaderBaseAddr)) {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv "loaderBaseAddr" must match ${LOADER_BASE_ADDR_PATTERN.source}; got ${describe(loaderBaseAddr)}`,
        };
    }
    if (noanalysis !== undefined && typeof noanalysis !== "boolean") {
        return { ok: false, message: `buildAnalyzeHeadlessArgv "noanalysis" must be a boolean or absent; got ${describe(noanalysis)}` };
    }
    if (expectedClassificationLines !== undefined && (typeof expectedClassificationLines !== "number" || !Number.isInteger(expectedClassificationLines) || expectedClassificationLines < 0)) {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv "expectedClassificationLines" must be a non-negative integer or absent; got ${describe(expectedClassificationLines)}`,
        };
    }
    for (const [key, value] of [
        ["scriptPath", scriptPath],
        ["preScript", preScript],
        ["entrypointsPath", entrypointsPath],
        ["postScript", postScript],
        ["exportPath", exportPath],
        // Phase 37, plan 37-08 (AUTO-07): the SAME "optional non-empty string"
        // validation every other script-adjacent path field already gets.
        ["dataRangesPath", dataRangesPath],
    ]) {
        if (value !== undefined && (typeof value !== "string" || value === "")) {
            return { ok: false, message: `buildAnalyzeHeadlessArgv "${key}" must be a non-empty string or absent; got ${describe(value)}` };
        }
    }
    // 34-07 (CR-02) / 36-02: an INDEPENDENT second-layer check -- refuse a
    // preScript/postScript/scriptPath/entrypointsPath/exportPath containing a
    // parent-directory path segment, even for a caller that constructed
    // these fields itself and bypassed host-tool.mts's own
    // resolveWorkspacePath() entirely. Mirrors the dot-segment re-check just
    // below: same per-SEGMENT splitting approach (never a substring test), so
    // a name that merely CONTAINS two dots (e.g. "..foo.java") is not
    // misjudged -- only an exact ".." segment is a parent-directory
    // reference. Does NOT require absoluteness: a bare Ghidra script name
    // ("Pre.java") is Ghidra's own documented form for these flags and must
    // stay accepted (ghidra-project.test.ts's own pre-existing case).
    for (const [key, value] of [
        ["preScript", preScript],
        ["postScript", postScript],
        ["scriptPath", scriptPath],
        ["entrypointsPath", entrypointsPath],
        ["exportPath", exportPath],
        // Phase 37, plan 37-08 (AUTO-07): the SAME independent parent-segment
        // re-check every other script-adjacent path field already gets.
        ["dataRangesPath", dataRangesPath],
    ]) {
        if (typeof value !== "string")
            continue;
        const hasParentSegment = value.split(sep).some((segment) => segment === "..");
        if (hasParentSegment) {
            return {
                ok: false,
                message: `buildAnalyzeHeadlessArgv refuses a "${key}" containing a parent-directory path segment: a script ` +
                    `argument is either a bare Ghidra script name or a path already bounded inside the workspace; got ${describe(value)}`,
            };
        }
    }
    // Phase 36, plan 36-02: "a script argument with no script" is refused BY
    // NAME rather than silently dropped -- a dropped argument is how a run
    // reports success having asserted nothing (must_haves.prohibitions).
    // Independent second-layer check, mirroring every other rule above.
    if (typeof entrypointsPath === "string" && typeof preScript !== "string") {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv refuses "entrypointsPath" without "preScript": a script argument with no script to receive it`,
        };
    }
    if (typeof postScript !== "string" && (typeof exportPath === "string" || expectedClassificationLines !== undefined)) {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv refuses "exportPath"/"expectedClassificationLines" without "postScript": a script argument with no script to receive it`,
        };
    }
    if (expectedClassificationLines !== undefined && typeof exportPath !== "string") {
        return {
            ok: false,
            message: `buildAnalyzeHeadlessArgv refuses "expectedClassificationLines" without "exportPath": it is the export script's own second argument, positioned after the export path`,
        };
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
    // Phase 36, plan 36-01/36-02 (OPC-04, D-36-07): fixed-order argv, each
    // flag and its value as SEPARATE array entries, never string-concatenated.
    // "-loader BinaryLoader" is a fixed literal (never a wire field, D-36-07);
    // "-loader-baseAddr" is ALWAYS emitted, since host-tool.mts always
    // supplies a value (either the caller's own or the route's own default).
    const argv = [
        projectLocation,
        projectName,
        "-import",
        importPath,
        "-processor",
        processor,
        "-loader",
        "BinaryLoader",
        "-loader-baseAddr",
        loaderBaseAddr,
    ];
    if (noanalysis === true)
        argv.push("-noanalysis");
    if (typeof scriptPath === "string")
        argv.push("-scriptPath", scriptPath);
    // Phase 37, plan 37-08 (AUTO-07, D-37-33): DataRangeSeed.java's own
    // `-preScript` pair is emitted FIRST, before the caller's own `preScript`
    // (VolatileCarve.java) -- `analyzeHeadless` runs `-preScript` entries in
    // argv order (analyzeHeadlessREADME.md: "Using Multiple Scripts"), and
    // VolatileCarve.java's own `run()` calls `analyzeAll()` itself at the end
    // of ITS run -- so the data ranges must already be marked as data before
    // that call happens, or the code-discovery analysis this whole feedback
    // exists to suppress would already have run over them. Independent of
    // whether a `preScript` is present at all: `dataRangesPath` needs no
    // OTHER script to be useful (unlike `entrypointsPath`, which is
    // VolatileCarve.java's own positional argument).
    if (typeof dataRangesPath === "string")
        argv.push("-preScript", DATA_RANGE_SEED_SCRIPT_NAME, dataRangesPath);
    if (typeof preScript === "string") {
        argv.push("-preScript", preScript);
        if (typeof entrypointsPath === "string")
            argv.push(entrypointsPath);
    }
    if (typeof postScript === "string") {
        argv.push("-postScript", postScript);
        if (typeof exportPath === "string") {
            argv.push(exportPath);
            if (typeof expectedClassificationLines === "number")
                argv.push(String(expectedClassificationLines));
        }
    }
    argv.push("-deleteProject");
    return { ok: true, argv };
}
