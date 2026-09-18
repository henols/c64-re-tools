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

/** The three things a user can actually go and fix: an environment
 * variable, the `tools.json` file, or their `$PATH`. */
export type ToolLocationLayer = "env" | "file" | "probe";

/** The specific search that answered, one layer deeper than
 * `ToolLocationLayer`. When the environment layer answers, this carries the
 * declared environment-variable name itself (e.g. `"VICE_BIN"`) rather than
 * the literal string `"env"` -- modelled as `string` so a newly declared
 * environment variable needs no type edit here. The five literals below
 * name every non-environment-variable mechanism this tree uses today. */
export type ToolLocationMechanism = "tools.json" | "$PATH" | "sibling-of-x64sc" | "fixed-prefix-list" | "vendored-path" | string;

/** What one `resolveTool()` call answers. `layer` and `mechanism` are two
 * separate fields, deliberately: `layer` names the thing a user can fix,
 * `mechanism` names the specific search. `refusal` is prose a caller can
 * show a user directly, never a code meant to be mapped later -- this
 * project's standing convention for a field with that name. */
export interface ResolveToolResult {
  /** The tool id that was queried. */
  id: string;
  /** The resolved path, or `null` when nothing answered or the id itself
   * was refused. */
  path: string | null;
  /** Every candidate this call inspected, across every layer it reached, in
   * the order it inspected them. */
  tried: string[];
  /** Which of the three layers answered, or `null` when none did. */
  layer: ToolLocationLayer | null;
  /** The specific mechanism that answered, or `null` when none did. */
  mechanism: ToolLocationMechanism | null;
  /** Prose naming why a query was refused outright (e.g. an id this
   * declaration does not know), or `null` when the query was not refused. A
   * query that reached every layer and simply found nothing is NOT a
   * refusal -- `refusal` stays `null` and `path`/`layer`/`mechanism` stay
   * `null` instead. */
  refusal: string | null;
}

/** `resolveTool()`'s injection surface -- a single destructured options
 * object, matching this project's own convention for a function that
 * touches the environment or the filesystem. `toolsDir` and `projectRoot`
 * are both required, explicit strings: this seam derives neither from the
 * other and derives neither from anywhere else. Every other field is
 * optional with a real default, so a caller that only cares about the
 * happy path can omit all of them. */
export interface ResolveToolDeps {
  /** The directory holding `.c64-re-tools/tools.json` (NOT the file path
   * itself -- this seam joins `"tools.json"` onto it). Always supplied by
   * the caller; this seam never guesses it. */
  toolsDir: string;
  /** The project root a relative `tools.json` value resolves against.
   * Always supplied by the caller, and never derived from `toolsDir`: a
   * caller-supplied string is right for both because either one could
   * legitimately differ from the other on a real host. */
  projectRoot: string;
  /** Defaults to `process.env`. Overridable so a test can drive the
   * environment layer without mutating the real process environment. */
  env?: NodeJS.ProcessEnv;
  /** Defaults to `existsSync`. Overridable so a test can drive candidate
   * existence without touching the real filesystem. */
  exists?: (p: string) => boolean;
  /** Defaults to a `statSync`-based classifier. Read by `resolveTool()`'s
   * kind-aware existence check for every layer it reaches, so a test can
   * drive that check without touching the real filesystem. */
  statKind?: (p: string) => "file" | "directory" | null;
  /** Defaults to a UTF-8 `readFileSync`. Overridable so a test can drive
   * file contents without touching the real filesystem. */
  readFile?: (p: string) => string;
  /** Defaults to this module's own directory. Lets a test drive the
   * declaration-resolution logic (the two-candidate join below) against a
   * scratch layout instead of the real, committed declaration. */
  here?: string;
  /** Optional warning sink. Not yet called by this module's own resolution
   * logic -- declared here for the same forward-compatibility reason as
   * `statKind` above. */
  log?: (line: string) => void;
}

/** The one `location` shape a `prerequisites.json` record may carry. Kept
 * private to this module: nothing outside `resolveTool()` needs to know
 * this shape, and exporting it would be a second place a caller could come
 * to depend on the declaration's own internal structure. */
interface ToolLocationBlock {
  envVar?: string;
  fileOverridable: boolean;
  reason?: string;
}

interface ToolDeclarationRecord {
  location?: ToolLocationBlock;
  kind?: "executable" | "directory";
  marker?: string;
}

interface ToolDeclaration {
  schemaVersion: number;
  tools: Record<string, ToolDeclarationRecord>;
}

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
function readDeclaration(here: string): ToolDeclaration {
  const candidates = [join(here, "prerequisites.json"), join(here, "..", "prerequisites.json")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, "utf8")) as ToolDeclaration;
    }
  }
  throw new Error(`tool-location: prerequisites.json not found at any of: ${candidates.join(", ")}`);
}

/** Classifies a path as a statable file, a statable directory, or neither.
 * The real default behind `deps.statKind` above -- called by
 * `resolveTool()`'s own kind-aware existence check for every layer it
 * reaches. */
function defaultStatKind(p: string): "file" | "directory" | null {
  try {
    const st = statSync(p);
    if (st.isDirectory()) return "directory";
    if (st.isFile()) return "file";
    return null;
  } catch {
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
export function resolveOnPath(bin: string, env: NodeJS.ProcessEnv): { path: string | null; tried: string[] } {
  const tried: string[] = [];
  if (bin.includes("/")) {
    const abs = resolvePath(bin);
    tried.push(abs);
    return { path: existsSync(abs) ? abs : null, tried };
  }
  const pathEnv = env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, bin);
    tried.push(candidate);
    if (existsSync(candidate)) return { path: candidate, tried };
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
function normalizeFileLayerValue(rawValue: string, env: NodeJS.ProcessEnv, projectRoot: string): string {
  const expanded = rawValue.startsWith("~/") ? join(env.HOME ?? "", rawValue.slice(2)) : rawValue;
  return resolvePath(projectRoot, expanded);
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
export function resolveTool(id: string, deps: ResolveToolDeps): ResolveToolResult {
  const env = deps.env ?? process.env;
  const exists = deps.exists ?? existsSync;
  const statKind = deps.statKind ?? defaultStatKind;
  const readFile = deps.readFile ?? ((p: string) => readFileSync(p, "utf8"));
  const here = deps.here ?? HERE;

  const tried: string[] = [];

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
   * check that arrives in a later plan and applies to the file layer
   * alone (D-08). */
  const matchesDeclaredKind = (candidate: string): boolean => {
    if (record.kind === "directory") {
      return statKind(candidate) === "directory" && typeof record.marker === "string" && exists(join(candidate, record.marker));
    }
    return statKind(candidate) === "file";
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
  // validation to: an entry that resolves to something ON DISK but is not
  // what its record's `kind` declares -- the wrong kind, or a directory
  // missing its marker -- is refused by name (D-09, the LOC-06 criterion
  // amendment), rather than silently falling through to `$PATH`. An entry
  // that resolves to nothing at all on disk is NOT refused: it is simply
  // absent, and resolution proceeds to the next layer exactly as it did
  // before this record's `kind` existed.
  const toolsJsonPath = join(deps.toolsDir, "tools.json");
  if (exists(toolsJsonPath)) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(readFile(toolsJsonPath));
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rawValue = (parsed as Record<string, unknown>)[id];
      if (typeof rawValue === "string" && rawValue !== "") {
        const resolvedPath = normalizeFileLayerValue(rawValue, env, deps.projectRoot);
        tried.push(resolvedPath);
        const onDiskKind = statKind(resolvedPath);
        if (onDiskKind !== null) {
          if (matchesDeclaredKind(resolvedPath)) {
            return { id, path: resolvedPath, tried, layer: "file", mechanism: "tools.json", refusal: null };
          }
          return {
            id,
            path: null,
            tried,
            layer: null,
            mechanism: null,
            refusal:
              record.kind === "directory"
                ? `"${id}"'s tools.json entry (${resolvedPath}) is a directory but is missing its required marker (${record.marker ?? ""})`
                : `"${id}"'s tools.json entry (${resolvedPath}) does not resolve to a ${record.kind ?? "executable"}`,
          };
        }
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
