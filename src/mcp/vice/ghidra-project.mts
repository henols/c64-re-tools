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
//     from a caller-supplied repoRoot plus GHIDRA_RUNS_DIR_NAME.
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
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
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
export const RUN_ID_PATTERN: RegExp = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

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
export const LANGUAGE_ID_PATTERN: RegExp = /^[A-Za-z0-9_]{1,64}(:[A-Za-z0-9_]{1,64}){1,7}$/;

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
export const LOADER_BASE_ADDR_PATTERN: RegExp = /^0x[0-9a-f]{1,4}$/;

/** `ghidra.analyze`'s required two-member import-route enum (D-36-07).
 * `"prg"` mirrors `dxa.disassemble`'s own `imageKind` enum member of the
 * same name; `BinaryLoader` -- the loader ITSELF -- is a fixed literal and
 * never a wire field at all, so there is no free-string loader name for
 * either route to carry. */
export type GhidraImportRoute = "prg" | "flat64k";
export const GHIDRA_IMPORT_ROUTES: readonly GhidraImportRoute[] = Object.freeze(["prg", "flat64k"]);

/** The route's own fixed loader base address, as a lowercase-hex string
 * matching `LOADER_BASE_ADDR_PATTERN`. The flat-64K route bases at zero --
 * the whole 64K address space IS the image; the `.prg` route bases at
 * `0x801`, the C64 BASIC program start address (MEASURED, carried from
 * `36-RESEARCH.md`'s own recorded `analyzeHeadless` invocations) -- a
 * `.prg`'s load address is a property of the IMAGE, not of the route, which
 * is why `loaderBaseAddr` stays a separately overridable field on the `prg`
 * route (D-36-07) rather than being folded into this function entirely. */
export function importRouteBaseAddr(route: GhidraImportRoute): string {
  return route === "flat64k" ? "0x0" : "0x801";
}

/** The canonical module name this project's own tooling and live tests
 * install the vendored SLEIGH extension under, via `ghidra.installExtension`
 * (`<GHIDRA_HOME>/Ghidra/Extensions/<this name>/`). Exported so no future
 * caller re-types the literal -- a wire request MAY name a different
 * `moduleName` (it is caller-supplied, validated against `RUN_ID_PATTERN`),
 * but this project's own tests and live-run scripts use this one value so
 * `installedLanguageIds()` (plan 36-02) finds a stable, predictable install
 * location across runs. */
export const GHIDRA_EXTENSION_MODULE_NAME = "C64Undocumented6502";

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
export const GHIDRA_STOCK_6502_LANGUAGE_FILES: readonly string[] = Object.freeze(["6502.slaspec", "6502.pspec", "6502.cspec"]);

// ---------------------------------------------------------------------------
// Phase 36, plan 36-02 (D-36-01, OPC-04, Task 2). installedLanguageIds() --
// the checked, NON-MATERIALISING preflight's own data source. Filesystem-
// READ-ONLY: no child-process call, no reference to an `analyzeHeadless`
// executable path, provable with no Ghidra installation present, exactly
// like every other function this module's header already promises.
// ---------------------------------------------------------------------------

export interface InstalledLanguageInfo {
  /** The Ghidra language id a `<language>` element's own `id` attribute
   * declares (e.g. `"6502:LE:16:nmos"`). */
  id: string;
  /** The absolute path of the `.ldefs` file that declared this id. */
  ldefsPath: string;
  /** The `slafile` attribute's own value, EXACTLY as written in the
   * `.ldefs` (e.g. `"6502_nmos.sla"`) -- a bare filename, resolved relative
   * to `ldefsPath`'s own directory, never an absolute path in its own
   * right. */
  slafile: string;
  /** Whether that `slafile`, resolved beside `ldefsPath`, exists on disk. */
  slafileExists: boolean;
}

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
export function installedLanguageIds(ghidraHome: string): InstalledLanguageInfo[] {
  const results: InstalledLanguageInfo[] = [];
  const moduleRoots = [join(ghidraHome, "Ghidra", "Extensions"), join(ghidraHome, "Ghidra", "Processors")];

  for (const moduleRoot of moduleRoots) {
    let moduleNames: string[];
    try {
      moduleNames = readdirSync(moduleRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      continue;
    }

    for (const moduleName of moduleNames) {
      const languagesDir = join(moduleRoot, moduleName, "data", "languages");
      let fileNames: string[];
      try {
        fileNames = readdirSync(languagesDir).filter((name) => name.endsWith(".ldefs"));
      } catch {
        continue;
      }

      for (const fileName of fileNames) {
        const ldefsPath = join(languagesDir, fileName);
        let text: string;
        try {
          text = readFileSync(ldefsPath, "utf8");
        } catch {
          continue;
        }

        for (const tagMatch of text.matchAll(LANGUAGE_ELEMENT_PATTERN)) {
          const tagText = tagMatch[0];
          const idMatch = ID_ATTR_PATTERN.exec(tagText);
          const slafileMatch = SLAFILE_ATTR_PATTERN.exec(tagText);
          if (!idMatch || !slafileMatch) continue;
          const id = idMatch[1]!;
          const slafile = slafileMatch[1]!;
          const slafileExists = existsSync(join(languagesDir, slafile));
          results.push({ id, ldefsPath, slafile, slafileExists });
        }
      }
    }
  }

  results.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return results;
}

export type HasDotPrefixedSegmentResult = { dotted: true; segment: string } | { dotted: false };

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
export function hasDotPrefixedSegment(absolutePath: string): HasDotPrefixedSegmentResult {
  if (typeof absolutePath !== "string" || absolutePath === "") return { dotted: false };
  const rawSegments = absolutePath.split(sep);
  for (let i = 0; i < rawSegments.length; i++) {
    const segment = rawSegments[i];
    if (segment === "") continue; // the absolute-path leading empty segment, or a doubled separator
    if (segment.startsWith(".")) return { dotted: true, segment };
  }
  return { dotted: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// resolveGhidraProject -- the per-run project location (SEAM-04). Mirrors
// broker-control.mts's normaliseLaunchProfile()/host-tool.mts's
// normaliseHostToolRequest() discipline: narrow at one site, refuse unknown
// keys BY NAME, never coerce.
// ---------------------------------------------------------------------------

const RESOLVE_GHIDRA_PROJECT_KEYS: readonly string[] = Object.freeze(["repoRoot", "runId"]);
const RESOLVE_GHIDRA_PROJECT_SHAPE = `an object with exactly the keys ${RESOLVE_GHIDRA_PROJECT_KEYS.join("/")}, both non-empty strings`;

export type ResolveGhidraProjectResult =
  | { ok: true; runsRoot: string; projectLocation: string; projectName: string }
  | { ok: false; message: string };

/** THIS IS THE ONE PLACE a Ghidra run's project location is computed. Never
 * throws; answers a discriminated result naming the offending value, key,
 * or path segment. Refusal order: shape/keys, then `repoRoot` type, then
 * `runId` type and pattern, then the dot-segment check over the computed
 * ABSOLUTE `projectLocation` (which, since it is built by joining `repoRoot`
 * onto itself, also catches a dot-prefixed `repoRoot` -- e.g. a caller that
 * mistakenly passed `.vice-supervisor/` or `.planning/` as `repoRoot`),
 * then the already-exists (no-reuse) idempotency check. */
export function resolveGhidraProject(input: unknown): ResolveGhidraProjectResult {
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
      message:
        `resolveGhidraProject refuses to reuse an existing run directory (${projectLocation}): ` +
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
  } catch (e) {
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

const BUILD_ANALYZE_HEADLESS_ARGV_KEYS: readonly string[] = Object.freeze([
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
]);
const BUILD_ANALYZE_HEADLESS_ARGV_SHAPE =
  `an object with keys ${BUILD_ANALYZE_HEADLESS_ARGV_KEYS.join("/")} ` +
  `("projectLocation"/"projectName"/"importPath"/"processor"/"loaderBaseAddr" required non-empty strings, ` +
  `"noanalysis" an optional boolean, "scriptPath"/"preScript"/"entrypointsPath"/"postScript"/"exportPath" optional ` +
  `non-empty strings, "expectedClassificationLines" an optional non-negative integer)`;

export type BuildAnalyzeHeadlessArgvResult = { ok: true; argv: string[] } | { ok: false; message: string };

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
export function buildAnalyzeHeadlessArgv(input: unknown): BuildAnalyzeHeadlessArgvResult {
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

  const { projectLocation, projectName, importPath, processor, loaderBaseAddr, noanalysis, scriptPath, preScript, entrypointsPath, postScript, exportPath, expectedClassificationLines } = input;

  for (const [key, value] of [
    ["projectLocation", projectLocation],
    ["projectName", projectName],
    ["importPath", importPath],
    ["processor", processor],
    ["loaderBaseAddr", loaderBaseAddr],
  ] as const) {
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
  if (!LANGUAGE_ID_PATTERN.test(processor as string)) {
    return {
      ok: false,
      message: `buildAnalyzeHeadlessArgv "processor" must match ${LANGUAGE_ID_PATTERN.source}; got ${describe(processor)}`,
    };
  }
  // Phase 36, plan 36-02 (D-36-07, T-36-09): the SAME independent
  // second-layer discipline, fourth field -- so the rule holds even for a
  // caller that constructed `loaderBaseAddr` itself and bypassed
  // host-tool.mts's own route-conflict check entirely.
  if (!LOADER_BASE_ADDR_PATTERN.test(loaderBaseAddr as string)) {
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
  ] as const) {
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
  ] as const) {
    if (typeof value !== "string") continue;
    const hasParentSegment = value.split(sep).some((segment) => segment === "..");
    if (hasParentSegment) {
      return {
        ok: false,
        message:
          `buildAnalyzeHeadlessArgv refuses a "${key}" containing a parent-directory path segment: a script ` +
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
  const dotted = hasDotPrefixedSegment(projectLocation as string);
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
  const argv: string[] = [
    projectLocation as string,
    projectName as string,
    "-import",
    importPath as string,
    "-processor",
    processor as string,
    "-loader",
    "BinaryLoader",
    "-loader-baseAddr",
    loaderBaseAddr as string,
  ];
  if (noanalysis === true) argv.push("-noanalysis");
  if (typeof scriptPath === "string") argv.push("-scriptPath", scriptPath);
  if (typeof preScript === "string") {
    argv.push("-preScript", preScript);
    if (typeof entrypointsPath === "string") argv.push(entrypointsPath);
  }
  if (typeof postScript === "string") {
    argv.push("-postScript", postScript);
    if (typeof exportPath === "string") {
      argv.push(exportPath);
      if (typeof expectedClassificationLines === "number") argv.push(String(expectedClassificationLines));
    }
  }
  argv.push("-deleteProject");

  return { ok: true, argv };
}
