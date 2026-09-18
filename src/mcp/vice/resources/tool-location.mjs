// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from tool-location.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// tool-location.mts
//
// THIS IS THE ONE AUTHORITATIVE PLACE that knows the precedence order for a
// declared tool id -- a key under `tools` in the committed
// prerequisites.json. For an id, this module walks three layers in a fixed
// order (an environment variable, then `.c64-re-tools/tools.json`, then a
// `$PATH` walk or a probe) and reports the resolved path plus which layer
// and which exact mechanism answered. Nothing calls this module today; a
// later phase rewires a live callsite to ask it, and that absence here is
// correct, not an oversight -- wiring this in before the module itself is
// proven would risk shipping an unproven answer to a real caller.
//
// Three separate `$PATH`-walk implementations coexist in this tree right
// now: `defaultResolveBinPath()` in backend-detect.mts, the fallback loop
// inside `findSiblingBinary()` in host-tool.mts, and this module's own
// exported `resolveOnPath()`. A later phase collapses all three into one --
// naming that here so a future reader finds scheduled work, not
// rediscovered duplication this file quietly left behind.
//
// This module deliberately holds no memo, unlike the two probes named
// above. Two reasons. First, this project's own architecture record
// enumerates a small, fixed set of modules that are allowed to hold
// process-lifetime global state, and growing that set is an architecture
// change, not a performance optimisation -- this file is not that change.
// Second, a future doctor built on top of this seam must never report a
// tool's location as something it no longer is; caching here would make a
// stale answer structurally possible, and no result this module returns is
// worth that risk.
//
// Two of the eight declared ids may never be located through any layer this
// module walks, and each has exactly one legitimate route instead --
// documented here as well as refused by name (`resolveTool()`) and reported
// by name (`validateToolsFile()`), because criterion 4 of this phase asks for
// both: refused in code, and documented "where a reader would look for it".
//   - `node`: `vice-launcher.sh` is bash and reads `VICE_BROKER_NODE` before
//     any working Node interpreter exists to parse a `tools.json` file with,
//     so the environment variable is the only route and this file has no say
//     at all.
//   - `dxa`: it is vendored and built by this project against a pinned
//     source, so an override here could only ever select a binary this
//     project did not build and did not pin.
// `toolsFileTemplate()` ships a reserved `_viceBrokerNode` key and a reserved
// `_dxa` key so a reader editing the file by hand finds both exclusions and
// their reasons without opening this module -- the reason text itself is
// read from `prerequisites.json` at call time, never re-authored here, for
// the same reason `resolveTool()`'s own refusal sentences are.
//
// WHAT NOT TO DO, each because of something already recorded above:
//   - Do not call the emulator-identity resolver in backend-detect.mts, and
//     do not import backend-detect.mjs or host-tool.mjs. A location query
//     stays read-only: it must not write either sibling's on-disk cache and
//     must not inherit either sibling's process-lifetime memo.
//   - Do not add a module-level memo, a caller-supplied cache, or a
//     reset-for-tests hatch of any kind. See the no-memo paragraph above.
//   - Do not statically import this project's repo-root resolver. The
//     caller resolves `toolsDir` and `projectRoot` and passes both in as
//     plain strings; re-deriving either locally here would be the same
//     mistake this tree has already warned against elsewhere for a
//     different directory.
//   - Do not interpolate a resolved path into a shell string, and do not
//     import node:child_process anywhere in this file. This seam exists so
//     a future caller inherits an already-safe string, not a string this
//     file itself made unsafe.
//   - Do not hand-edit the compiled artifact under resources/. This file is
//     the source; the compiled copy is generated and committed, and a
//     hand-edit there is silently overwritten by the next build.
//
// `remedyTextsFor()` is the FIRST runtime reader of the declaration's
// `remedies` arrays -- every one of the eight records' `remedies` blocks has
// existed as data only, read by no shipped code path, since Phase 58 wrote
// them. It exists because of `DECL-03`: a live refusal and a future doctor
// must never be able to name different remedies for the same tool, which is
// only true if both read the same declaration through the same reader. A
// caller composes its own sentence around the strings this returns and never
// re-types one, and nothing in this tree may execute a remedy string -- the
// never-auto-install constraint made structural, not merely documented.
import { accessSync, constants as fsConstants, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
/** This module's own directory. Computed once, at module load, purely as
 * the DEFAULT for `deps.here` below -- never assigned to again, and never
 * read as a substitute for a caller-supplied `toolsDir`/`projectRoot`. */
const HERE = dirname(fileURLToPath(import.meta.url));
/** Reads `prerequisites.json` through a two-candidate list -- beside `here`,
 * and one directory up from it -- taking the first that exists. This
 * module ships two ways: as unbuilt source (`src/mcp/vice/tool-location.mts`,
 * where `here` is `src/mcp/vice/`) and as the compiled artifact this
 * project actually runs (`src/mcp/vice/resources/tool-location.mjs`, where
 * `here` is `src/mcp/vice/resources/`). So "the declaration relative to
 * `here`" means two different real locations depending on which form of
 * this module is executing, and the two-candidate join is what makes both
 * forms find the same file. Always reads the real filesystem directly
 * (never `deps.exists`/`deps.readFile`, which govern the environment and
 * `tools.json` layers below, not this declaration) -- the one thing a test
 * can vary here is `here` itself. */
function readDeclaration(here) {
    const candidates = [join(here, "prerequisites.json"), join(here, "..", "prerequisites.json")];
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return JSON.parse(readFileSync(candidate, "utf8"));
        }
    }
    throw new Error(`tool-location: prerequisites.json not found at any of: ${candidates.join(", ")}`);
}
/** Classifies a path as a statable file, a statable directory, or neither.
 * The real default behind `deps.statKind` above -- called by
 * `resolveTool()`'s own kind-aware existence check for every layer it
 * reaches. */
function defaultStatKind(p) {
    try {
        const st = statSync(p);
        if (st.isDirectory())
            return "directory";
        if (st.isFile())
            return "file";
        return null;
    }
    catch {
        return null;
    }
}
/** The `$PATH` walk, exported as its own named function so it is one thing
 * this seam owns rather than a third private copy of an algorithm that
 * already exists twice elsewhere in this tree. Mirrors the existing
 * algorithm exactly: a name containing a separator is resolved directly
 * rather than walked, and `PATH` is split on `:`. Unlike the two existing
 * private copies, this one returns every candidate it inspected, not only
 * the winner -- and it holds no memo of its own. */
export function resolveOnPath(bin, env) {
    const tried = [];
    if (bin.includes("/")) {
        const abs = resolvePath(bin);
        tried.push(abs);
        return { path: existsSync(abs) ? abs : null, tried };
    }
    const pathEnv = env.PATH ?? "";
    for (const dir of pathEnv.split(":")) {
        if (!dir)
            continue;
        const candidate = join(dir, bin);
        tried.push(candidate);
        if (existsSync(candidate))
            return { path: candidate, tried };
    }
    return { path: null, tried };
}
/** Normalises a raw `tools.json` value into an absolute path. Applied ONLY
 * to a value that came out of `tools.json` (D-08) -- the environment and
 * probe layers keep today's `existsSync`-only behaviour and see none of
 * this. Exactly two steps, in order:
 *   1. A value beginning `~/` has the `~` replaced by the injected
 *      environment's `HOME`. A bare `~` with no following separator is
 *      left alone -- it is a legal relative path name, and guessing what a
 *      user meant by it is worse than not.
 *   2. The result is handed to `node:path`'s own `resolve`, seeded with
 *      `projectRoot` -- which both resolves a still-relative value against
 *      `projectRoot` (never against `toolsDir` and never against the
 *      process working directory) and is the ONLY normalisation applied:
 *      no case folding, no Unicode normalisation, no comparison against a
 *      normalised form. A non-ASCII segment survives byte-identically, and
 *      a trailing separator resolves to the same path as the same value
 *      without one. */
function normalizeFileLayerValue(rawValue, env, projectRoot) {
    const expanded = rawValue.startsWith("~/") ? join(env.HOME ?? "", rawValue.slice(2)) : rawValue;
    return resolvePath(projectRoot, expanded);
}
/** Describes a value's shape for a refusal message -- `null`, `false` and
 * a number render with their own literal, an array or a plain object
 * renders as its JSON shape name, and a string renders quoted (or as "an
 * empty string"). Deliberately local rather than importing `host-tool.mts`'s
 * own `describe()`: this module's header forbids importing that sibling. */
function describeValueShape(value) {
    if (value === null)
        return "null";
    if (Array.isArray(value))
        return "an array";
    if (typeof value === "object")
        return "an object";
    if (typeof value === "string")
        return value === "" ? "an empty string" : `a string (${JSON.stringify(value)})`;
    return `a ${typeof value} (${JSON.stringify(value)})`;
}
/** Judges `.c64-re-tools/tools.json` alone and returns every file-level
 * problem it finds -- unparseable JSON, a top level that is not a plain
 * object, a key that names no declared tool, a value that is not a
 * non-empty string, and an entry naming a tool this declaration says the
 * file may never name -- WITHOUT resolving anything (D-10). This function
 * does not walk `$PATH`, does not read the environment for a location,
 * and does not stat a declared path; that is `resolveTool()`'s job. An
 * absent file, a zero-byte file and a bare `{}` are not problems -- they
 * are the default state of an installation that has not written one yet
 * -- so each returns an empty array. Problems are returned in file key
 * order, so the same file always produces the same output, and each
 * problem is independent: one bad key changes nothing about a report on
 * any other key in the same file. */
export function validateToolsFile(deps) {
    const exists = deps.exists ?? existsSync;
    const readFile = deps.readFile ?? ((p) => readFileSync(p, "utf8"));
    const here = deps.here ?? HERE;
    const filePath = join(deps.toolsDir, "tools.json");
    let text;
    if (deps.raw !== undefined) {
        text = deps.raw;
    }
    else {
        if (!exists(filePath))
            return [];
        text = readFile(filePath);
    }
    if (text.trim() === "")
        return [];
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        return [{ toolId: null, key: "", message: `${filePath} could not be parsed: its bytes are not valid JSON` }];
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return [
            {
                toolId: null,
                key: "",
                message: `${filePath} must be a plain object mapping a declared tool id to a path string; found ${describeValueShape(parsed)}`,
            },
        ];
    }
    const doc = parsed;
    const declaration = readDeclaration(here);
    const acceptedIds = Object.keys(declaration.tools);
    const problems = [];
    for (const key of Object.keys(doc)) {
        // D-11: a key beginning with a SINGLE leading underscore (its second
        // character is anything other than another underscore) is reserved for
        // prose and is skipped before the unknown-key check runs -- never
        // reported, whatever its value. The single-underscore qualifier is
        // deliberate: it is what the template's own "_readme"/"_viceBrokerNode"
        // keys look like, and it is what keeps a double-underscore JavaScript
        // dunder name -- "__proto__" foremost -- OUT of the exemption, so that
        // key falls through to the ordinary array-membership check below and is
        // reported as unknown like any other unrecognised value, with no
        // separate branch naming it.
        if (key[0] === "_" && key[1] !== "_")
            continue;
        // Exact, case-sensitive ARRAY membership against the declaration's own
        // key set -- never an object-property lookup keyed by the raw string --
        // so a prototype-shaped key (e.g. "__proto__") refuses exactly like any
        // other unrecognised value, with no separate branch (T-59-09).
        if (!acceptedIds.includes(key)) {
            problems.push({
                toolId: null,
                key,
                message: `"${key}" is not a declared tool id; ${filePath} may only name one of ${acceptedIds.join(", ")}`,
            });
            continue;
        }
        const record = declaration.tools[key];
        // A record declared `fileOverridable: false` may not be named in
        // tools.json at all (LOC-05, LOC-07): the refusal quotes the
        // declaration's own `reason` field verbatim, read at call time, never
        // duplicated in this module.
        if (record.location?.fileOverridable === false) {
            problems.push({
                toolId: key,
                key,
                message: `"${key}" may not be named in tools.json: ${record.location.reason ?? ""}`,
            });
            continue;
        }
        const value = doc[key];
        if (typeof value !== "string" || value === "") {
            problems.push({
                toolId: key,
                key,
                message: `"${key}"'s tools.json entry must be a non-empty string naming a path; found ${describeValueShape(value)}`,
            });
        }
    }
    return problems;
}
/** Resolves one declared tool id through, in order: an environment
 * variable (using the env-var name the declaration's own `location.envVar`
 * names -- never a name hardcoded in this file), `.c64-re-tools/tools.json`,
 * then a `$PATH` walk for the tool's own id (executable-kind ids only -- a
 * `$PATH` walk for a directory-kind id is meaningless, so that id's probe
 * layer answers `null` rather than recording a candidate nobody meant).
 * The first layer that yields an existing path wins. An id this
 * declaration does not know returns a refusal naming it and reads
 * `tools.json` never. Every call re-resolves from scratch: this function
 * holds no memo of its own and reads no memo of anyone else's, so a binary
 * that appears on disk between two calls is found by the very next one. */
export function resolveTool(id, deps) {
    const env = deps.env ?? process.env;
    const exists = deps.exists ?? existsSync;
    const statKind = deps.statKind ?? defaultStatKind;
    const access = deps.access ?? ((p, mode) => accessSync(p, mode));
    const readFile = deps.readFile ?? ((p) => readFileSync(p, "utf8"));
    const here = deps.here ?? HERE;
    const tried = [];
    const declaration = readDeclaration(here);
    // Exact, case-sensitive ARRAY membership against the declaration's own
    // key set -- never a bracket property lookup keyed by the raw string --
    // so an id shaped like an inherited Object.prototype member (constructor,
    // toString, valueOf, hasOwnProperty, ...) refuses exactly like any other
    // undeclared id, with no separate branch. Mirrors `validateToolsFile()`'s
    // own unknown-key check one function over: that function already carries
    // this exact defence for the same hazard, and this lookup previously did
    // not, which let such an id slip past this guard and reach the
    // tools.json layer below for an id nobody declared.
    const declaredIds = Object.keys(declaration.tools);
    if (!declaredIds.includes(id)) {
        return {
            id,
            path: null,
            tried,
            layer: null,
            mechanism: null,
            refusal: `"${id}" is not a declared tool id`,
        };
    }
    const record = declaration.tools[id];
    // A record declared `fileOverridable: false` has exactly one legitimate
    // location, and that location is not any of the three layers this
    // function walks (D-16). No layer is consulted at all -- not the
    // environment, not `tools.json`, not `$PATH` -- because walking any of
    // them is precisely the substitution the exclusion exists to refuse.
    // The refusal quotes the declaration's own `reason` field verbatim
    // (LOC-05, LOC-07): this module never re-authors that sentence.
    if (record.location?.fileOverridable === false) {
        return {
            id,
            path: null,
            tried: [],
            layer: null,
            mechanism: null,
            refusal: `"${id}" may not be located through an environment variable, tools.json, or $PATH: ${record.location.reason ?? ""}`,
        };
    }
    /** Whether `candidate` matches this record's declared `kind` -- a
     * statable file for an `executable` record, or a statable directory
     * containing the declared `marker` for a `directory` record. This is an
     * EXISTENCE test widened to be kind-aware (D-07), not the executable-bit
     * check below, which lives in `passesFileLayerCheck` and applies to the
     * file layer alone (D-08). */
    const matchesDeclaredKind = (candidate) => {
        if (record.kind === "directory") {
            return statKind(candidate) === "directory" && typeof record.marker === "string" && exists(join(candidate, record.marker));
        }
        return statKind(candidate) === "file";
    };
    /** Whether `candidate` satisfies this record's declared `kind` on the
     * FILE LAYER specifically (D-08, LOC-06's amended triad): everything
     * `matchesDeclaredKind` already tests, PLUS -- for an `executable`-kind
     * record only -- a real executable-bit check via `accessSync(candidate,
     * fsConstants.X_OK)` inside a `try`/`catch`, never mode-bit arithmetic.
     * A `directory`-kind candidate is never subjected to this additional
     * check at all: emptiness or permission bits on a directory are not this
     * criterion's concern, only its marker is. */
    const passesFileLayerCheck = (candidate) => {
        if (!matchesDeclaredKind(candidate))
            return false;
        if (record.kind === "directory")
            return true;
        try {
            access(candidate, fsConstants.X_OK);
            return true;
        }
        catch {
            return false;
        }
    };
    /** Builds the file layer's refusal sentence for a `candidate` that
     * failed `passesFileLayerCheck` -- naming the tool id, quoting the
     * offending path, saying `tools.json` supplied it (the half of LOC-06
     * that tells a user which of the three layers to go fix), and naming
     * which condition failed: absent, wrong kind, a missing marker, or a
     * missing executable bit. */
    const buildFileLayerRefusal = (candidate) => {
        const onDiskKind = statKind(candidate);
        if (onDiskKind === null) {
            return `"${id}"'s tools.json entry (${candidate}) does not exist on disk; tools.json supplied this path`;
        }
        if (record.kind === "directory") {
            if (onDiskKind !== "directory") {
                return `"${id}"'s tools.json entry (${candidate}) is a ${onDiskKind}, but the declaration requires a directory; tools.json supplied this path`;
            }
            return `"${id}"'s tools.json entry (${candidate}) is a directory but is missing its required marker (${record.marker ?? ""}); tools.json supplied this path`;
        }
        if (onDiskKind !== "file") {
            return `"${id}"'s tools.json entry (${candidate}) is a ${onDiskKind}, but the declaration requires an executable file; tools.json supplied this path`;
        }
        return `"${id}"'s tools.json entry (${candidate}) exists but is not executable (missing the executable bit); tools.json supplied this path`;
    };
    // Layer 1: the environment. Kept at today's existence-only posture
    // (D-08): a candidate that exists but fails the kind check simply does
    // not match here -- it is not refused, only not found -- and resolution
    // falls through to the next layer.
    const envVarName = record.location?.envVar;
    if (envVarName) {
        const envValue = env[envVarName];
        if (typeof envValue === "string" && envValue !== "") {
            tried.push(envValue);
            if (matchesDeclaredKind(envValue)) {
                return { id, path: envValue, tried, layer: "env", mechanism: envVarName, refusal: null };
            }
        }
    }
    // Layer 2: `.c64-re-tools/tools.json`. This is the one layer D-08 scopes
    // validation to, and the amended LOC-06 triad applies in full here: a
    // named entry is refused by name when the path is absent, is not what
    // its record's `kind` declares, or -- for a `directory` kind -- does
    // not contain its declared marker, or -- for an `executable` kind --
    // exists but carries no executable bit. Once a non-empty entry names a
    // candidate for this id, resolution is TERMINAL for this call: it either
    // accepts the candidate or refuses it, and never falls through to
    // `$PATH` afterward (D-09) -- silently continuing would resolve a
    // different binary than the one the file named and report success,
    // which is exactly the failure LOC-06 exists to replace. An id that
    // tools.json does not mention at all is simply absent from the file,
    // which is unaffected by any of this and falls through as before.
    //
    // A malformed FILE is refused too, not silently treated as "nothing to
    // say" -- mirroring the exact three problem shapes `validateToolsFile()`
    // already detects and reports, so a JSON typo never silently downgrades
    // an intended override into a $PATH search with no signal at all. An
    // absent file, a zero-byte one, and a bare `{}` one are NOT malformed --
    // each is the default state of an installation that has not written a
    // file yet -- and each keeps falling through silently exactly as before.
    // Unparseable JSON and a non-object top level affect every id in the same
    // way `validateToolsFile()`'s own file-level problems do (no per-id entry
    // can be read from either shape at all); a present-but-not-a-non-empty-
    // string value affects only the id it names, so a sibling id's own
    // well-formed entry in the same file still resolves.
    const toolsJsonPath = join(deps.toolsDir, "tools.json");
    if (exists(toolsJsonPath)) {
        const rawText = readFile(toolsJsonPath);
        if (rawText.trim() !== "") {
            let parsed;
            let parseFailed = false;
            try {
                parsed = JSON.parse(rawText);
            }
            catch {
                parseFailed = true;
            }
            if (parseFailed) {
                return {
                    id,
                    path: null,
                    tried,
                    layer: null,
                    mechanism: null,
                    refusal: `${toolsJsonPath} could not be parsed: its bytes are not valid JSON`,
                };
            }
            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                return {
                    id,
                    path: null,
                    tried,
                    layer: null,
                    mechanism: null,
                    refusal: `${toolsJsonPath} must be a plain object mapping a declared tool id to a path string; found ${describeValueShape(parsed)}`,
                };
            }
            const doc = parsed;
            // Same defence as the declaration lookup above, applied symmetrically:
            // exact array membership against this file's own keys, never a bare
            // bracket lookup keyed by `id`, so an inherited Object.prototype
            // member never answers for a key the file itself did not write.
            if (Object.keys(doc).includes(id)) {
                const rawValue = doc[id];
                if (typeof rawValue !== "string" || rawValue === "") {
                    return {
                        id,
                        path: null,
                        tried,
                        layer: null,
                        mechanism: null,
                        refusal: `"${id}"'s tools.json entry must be a non-empty string naming a path; found ${describeValueShape(rawValue)}`,
                    };
                }
                const resolvedPath = normalizeFileLayerValue(rawValue, env, deps.projectRoot);
                tried.push(resolvedPath);
                if (passesFileLayerCheck(resolvedPath)) {
                    return { id, path: resolvedPath, tried, layer: "file", mechanism: "tools.json", refusal: null };
                }
                return {
                    id,
                    path: null,
                    tried,
                    layer: null,
                    mechanism: null,
                    refusal: buildFileLayerRefusal(resolvedPath),
                };
            }
        }
    }
    // Layer 3: `$PATH`, executable-kind ids only (a directory has no
    // meaningful `$PATH` candidate, and recording one nobody meant would be
    // misleading in a later doctor's output -- D-15).
    if (record.kind === "executable") {
        const probe = resolveOnPath(id, env);
        tried.push(...probe.tried);
        if (probe.path) {
            return { id, path: probe.path, tried, layer: "probe", mechanism: "$PATH", refusal: null };
        }
    }
    return { id, path: null, tried, layer: null, mechanism: null, refusal: null };
}
/** Builds the text a doctor (Phase 61's `DOCTOR-08`) writes as
 * `.c64-re-tools/tools.json` -- an EXPORT of this seam, never a committed
 * static example, so the doctor fills in paths it itself resolved through
 * `resolveTool()` and this project never carries two templates that can
 * disagree (D-12's locked bare-string shape rides along: every emitted tool
 * entry is the caller's path unchanged, never wrapped in an object).
 *
 * `resolved` is a read-only map from declared tool id to an absolute path
 * the CALLER resolved -- this function invents no path and supplies no
 * default for an id `resolved` does not name; `DOCTOR-08` requires the
 * emitted template contain no path the doctor did not itself resolve, and a
 * plausible-looking default is exactly the invented-remedy failure this
 * milestone exists to remove.
 *
 * The emitted object's keys, in order: `_readme` (what the file is, the
 * precedence order in words, and the underscore-prose rule that makes the
 * next two keys legal), `_viceBrokerNode` and `_dxa` (D-11's reserved keys,
 * quoting the `node`/`dxa` records' own declared `reason` fields verbatim,
 * read from the declaration at call time -- never duplicated as a literal
 * in this module, for the same reason `resolveTool()`'s own exclusion
 * refusals read them), then one key per entry in `resolved` whose id both
 * the declaration knows and marks `fileOverridable`, in declaration order,
 * with the caller's path as a bare string. An id `resolved` names that the
 * declaration does not know, or that the declaration says the file may
 * never name, is silently omitted -- this builder emits a template, it does
 * not judge its caller's map; `validateToolsFile()` is what judges a file. */
export function toolsFileTemplate(resolved, deps = {}) {
    const here = deps.here ?? HERE;
    const declaration = readDeclaration(here);
    const nodeReason = declaration.tools.node?.location?.reason ?? "";
    const dxaReason = declaration.tools.dxa?.location?.reason ?? "";
    const out = {
        _readme: "This file overrides where c64-re-tools looks for an external tool. " +
            "Precedence order, highest first: an environment variable, then this file, then a $PATH search or probe. " +
            "Any key beginning with an underscore is prose for a human reader and is ignored.",
        _viceBrokerNode: `${nodeReason} Set the VICE_BROKER_NODE environment variable instead -- this file has no say over it.`,
        _dxa: `${dxaReason} There is no environment-variable or tools.json override for it.`,
    };
    for (const id of Object.keys(declaration.tools)) {
        if (!(id in resolved))
            continue;
        const record = declaration.tools[id];
        if (record.location?.fileOverridable === false)
            continue;
        out[id] = resolved[id];
    }
    return JSON.stringify(out, null, 2) + "\n";
}
/** Reads a declared tool id's remedy prose out of `prerequisites.json`,
 * ordered and byte-identical, for a caller to compose its own refusal
 * sentence around -- `DECL-03`'s FIRST runtime reader of the `remedies`
 * arrays (see this module's header). Collects, in order, every entry's
 * `text` under the key matching `platform` (one of `linux`, `darwin`,
 * `win32`), then every entry's `text` under `universal`, preserving
 * declaration order within each key. Returns the strings exactly as parsed
 * -- no trimming, no case change, no Unicode normalisation, no joining.
 *
 * An id the declaration does not carry, and a record with no `remedies`
 * block, both return `[]` rather than throwing: this module returns
 * structured results, and `vice-errors.ts` is not reached from here. The id
 * lookup is exact ARRAY membership against the declaration's own key set,
 * never a bracket property lookup on an unchecked string (T-60-02) -- the
 * same defence `resolveTool()` and `validateToolsFile()` already carry for
 * the identical hazard (an id shaped like an inherited Object.prototype
 * member must refuse like any other undeclared id, with no separate
 * branch). Reads through the existing private `readDeclaration(here)`; adds
 * no second reader, no memo (Phase 59 `D-03`), and no reset-for-tests
 * hatch. */
export function remedyTextsFor(id, deps = {}) {
    const platform = deps.platform ?? process.platform;
    const here = deps.here ?? HERE;
    const declaration = readDeclaration(here);
    // Exact, case-sensitive ARRAY membership against the declaration's own key
    // set -- never a bracket property lookup on the raw string -- mirroring
    // resolveTool()'s and validateToolsFile()'s own defence against an id
    // shaped like an inherited Object.prototype member (T-60-02).
    const declaredIds = Object.keys(declaration.tools);
    if (!declaredIds.includes(id))
        return [];
    const record = declaration.tools[id];
    const remedies = record.remedies;
    if (remedies === undefined || remedies === null || typeof remedies !== "object")
        return [];
    const platformEntries = remedies[platform] ?? [];
    const universalEntries = remedies.universal ?? [];
    return [...platformEntries, ...universalEntries].map((entry) => entry.text);
}
