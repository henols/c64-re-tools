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
import { existsSync, readFileSync, statSync } from "node:fs";
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
 * The real default behind `deps.statKind` above -- not yet called anywhere
 * in this module's own resolution logic (see that field's own comment). */
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
    const readFile = deps.readFile ?? ((p) => readFileSync(p, "utf8"));
    const here = deps.here ?? HERE;
    const tried = [];
    const declaration = readDeclaration(here);
    const record = declaration.tools[id];
    if (!record) {
        return {
            id,
            path: null,
            tried,
            layer: null,
            mechanism: null,
            refusal: `"${id}" is not a declared tool id`,
        };
    }
    // Layer 1: the environment.
    const envVarName = record.location?.envVar;
    if (envVarName) {
        const envValue = env[envVarName];
        if (typeof envValue === "string" && envValue !== "") {
            tried.push(envValue);
            if (exists(envValue)) {
                return { id, path: envValue, tried, layer: "env", mechanism: envVarName, refusal: null };
            }
        }
    }
    // Layer 2: `.c64-re-tools/tools.json`.
    const toolsJsonPath = join(deps.toolsDir, "tools.json");
    if (exists(toolsJsonPath)) {
        let parsed = null;
        try {
            parsed = JSON.parse(readFile(toolsJsonPath));
        }
        catch {
            parsed = null;
        }
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const rawValue = parsed[id];
            if (typeof rawValue === "string" && rawValue !== "") {
                // A later addition to this file expands a leading `~/` against the
                // injected environment's HOME and resolves a relative value against
                // `projectRoot`, applied ONLY here in the file layer. This first cut
                // proves the three-layer wiring itself against an already-absolute
                // value; the normalisation lands as its own, separately reviewable
                // change to this exact spot.
                const resolvedPath = rawValue;
                tried.push(resolvedPath);
                if (exists(resolvedPath)) {
                    return { id, path: resolvedPath, tried, layer: "file", mechanism: "tools.json", refusal: null };
                }
            }
        }
    }
    // Layer 3: `$PATH`, executable-kind ids only (a directory has no
    // meaningful `$PATH` candidate).
    if (record.kind === "executable") {
        const probe = resolveOnPath(id, env);
        tried.push(...probe.tried);
        if (probe.path) {
            return { id, path: probe.path, tried, layer: "probe", mechanism: "$PATH", refusal: null };
        }
    }
    return { id, path: null, tried, layer: null, mechanism: null, refusal: null };
}
// Referenced only in this module's own doc comments above until a later
// phase reads it -- kept here, unused, so `defaultStatKind` is a real
// function and not a promise this file makes without keeping it.
void defaultStatKind;
