// host-tool.mts
//
// Phase 34, plan 34-01 (SEAM-01..SEAM-03, tracer): the host-bound executor
// for the host-tool control op. A container-side caller (host-tool-client.ts)
// reaches this module over broker-control.mts's `host_tool` op -- never
// directly -- and this module is the ONE place that turns an untrusted wire
// request into a real child process on the HOST, outside any container.
// Motivated by the project owner's own rule of 2026-08-28
// (.planning/seeds/host-tool-executor.md): a skill script runs container-side,
// the binaries it needs (acme, and later dxa/Ghidra/c1541/petcat/cartconv)
// live host-side, and there is no container PATH to find them on.
//
// THIS IS THE ONE AUTHORITATIVE PLACE for three things, none of which may be
// re-derived anywhere else:
//   - the typed per-tool allowlist (HOST_TOOL_IDS / HOST_TOOL_ARG_KEYS /
//     normaliseHostToolRequest()) -- mirrors broker-control.mts's own
//     normaliseLaunchProfile() discipline: refuse unknown keys BY NAME, never
//     coerce a type, never drop a key silently;
//   - server-side argv construction (buildHostToolArgv()) -- argv is built
//     ENTIRELY from typed, already-narrowed fields; a wire array or a wire
//     string never reaches argv (T-34-01);
//   - the async child-process invocation and its result digest (runHostTool())
//     -- spawned via node:child_process's async `spawn`, never `spawnSync`,
//     never a shell string, and bounded by a per-invocation timeout (T-34-02,
//     T-34-05).
//
// WHAT NOT TO DO, each naming the prohibition it guards (must_haves.prohibitions,
// 34-01-PLAN.md):
//   - No generic wire op that accepts a raw argv array or a raw command
//     string for a host tool -- argv is constructed server-side from typed
//     fields only (T-34-01).
//   - No shell-form child process on any host-tool path: no command
//     interpreter, no interpolated command string (T-34-02).
//   - No host-tool output written outside the bind-mounted workspace tree --
//     resolveWorkspacePath() is the only place a wire-supplied path becomes a
//     real path. BOTH the workspace root and the candidate go through the
//     same ancestor-realpath walk (realpathOfNearestExisting(), mirroring
//     anno-types.ts's storePathWithinWorkspace() and its own incident
//     history by name) before the prefix comparison, and the comparison is
//     over the WALKED (real) paths, never the lexical join -- a purely
//     lexical path.resolve() + startsWith() check is exactly what CR-05
//     (34-VERIFICATION.md gap 3) found: a symlink planted inside the
//     workspace defeated it live. This covers EVERY path-bearing wire field
//     on every tool, not only the ones present when this file was first
//     written: acme.build's source/outDir AND each entry of its includes
//     array (34-07, CR-03), and ghidra.analyze's importPath AND its
//     preScript/postScript (34-07, CR-02).
//     Two residuals recorded beside the guarantee, not hidden past it: the
//     check-then-open window between this decision and the child process's
//     own open is NOT closed here -- the child is a third-party binary
//     handed a path string, so there is no descriptor-based route to making
//     the check and the open one operation (T-34-52, accepted). And the
//     comparison is byte-wise over the resolved strings with no Unicode
//     normalisation, so two spellings differing only in normalisation form
//     are two distinct paths here (same residual anno-confinement.test.ts
//     records for the same comparison). A third note, A-16
//     (docs/phase34-host-tool-seam-decisions.md): because the return value
//     is now the REAL path, on a host whose workspace root is itself reached
//     through a symlink the response `path` need not match any member of
//     hostRootCandidates(), and containerPath() throws rather than passing
//     an untranslatable path through -- HOST_WORKSPACE_PATH naming the real
//     root is the pre-existing mitigation; this is a recorded limit, not a
//     widened hostpath.ts consumer set.
//   - No inline byte payload on a host-tool response, at any result size --
//     every result crosses as `{ path, sha256, byteLength }`, never bytes.
//   - No second copy of a tool's argv construction -- buildHostToolArgv() is
//     the one place.
//   - No synchronous child-process call on any path reachable from the
//     broker process -- runHostTool() awaits an async spawn only.
//   - No unbounded host-tool child process -- every invocation is bounded by
//     a timeout that kills the child and reports a refusal on expiry.
//
// This module must never be added to package.json's `files[]` (mirrors
// broker-control.mts's own precedent: shipped only as its compiled
// `resources/host-tool.mjs` artifact, added to build.ts's HOST_BOUND_ARTIFACTS
// and tsconfig.build.json's include[] in the same commit as this file).
//
// Phase 34, plan 34-03 (A-06, SEAM-04): this module's first SIBLING import.
// `ghidra-project.mjs` is a VALUE import (not type-only) because the rule
// must be enforced where `analyzeHeadless` is actually spawned -- inside the
// broker process -- which is why `ghidra-project.mts` ships as a compiled
// `resources/*.mjs` artifact exactly like this file does. A `.mjs`-specifier
// value import only resolves once both siblings are compiled into
// resources/ (the same reason plan 34-01's A-04 already has
// host-tool.test.ts reach THIS module as the committed artifact). The
// dot-segment rule and the per-run project location are NEVER copied here --
// this module reaches them through the one place that owns them.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGhidraProject, buildAnalyzeHeadlessArgv, hasDotPrefixedSegment } from "./ghidra-project.mjs";

// ---------------------------------------------------------------------------
// The typed per-tool allowlist (SEAM-02). Mirrors broker-control.mts's own
// normaliseLaunchProfile(): one narrowing function, refuse unknown keys BY
// NAME, never coerce, never drop.
// ---------------------------------------------------------------------------

/** The complete accepted tool-id set -- plan 34-01's tracer (`acme.build`)
 * plus plan 34-03's `ghidra.analyze` (SEAM-04). A second tool is ALWAYS a new
 * entry here, never a ninth `ControlRequestKind` member -- see
 * broker-control.mts's own D-15-derived comment on `host_tool`.
 * Matched by EXACT, case-sensitive ARRAY membership everywhere in this
 * module -- never an object-property lookup keyed by the untrusted wire
 * string -- so "__proto__"/"constructor"/"toString" refuse exactly like any
 * other unrecognised value, with no separate special-case needed (T-34-04). */
export type HostToolId = "acme.build" | "ghidra.analyze" | "oracle.probe" | "oracle.run";

export const HOST_TOOL_IDS: readonly HostToolId[] = Object.freeze([
  "acme.build",
  "ghidra.analyze",
  "oracle.probe",
  "oracle.run",
]);

/** Per-tool accepted argument-key lists, built with `Object.create(null)`
 * (the vsf-slice.mjs WR-04 idiom) so no prototype key can ever resolve to a
 * value here even if a future caller indexed it with an untrusted string
 * directly -- belt-and-suspenders alongside the array-membership check
 * above, which is what actually guards the lookup below.
 *
 * `ghidra.analyze`'s accepted keys carry no raw argv array and no raw
 * command string. Per field (corrected 34-07, CR-02 -- the previous wording
 * here claimed all four already flowed through a resolver, which was false
 * for the two script fields until this plan): `runId` is a bare name, never
 * a path, and flows through `resolveGhidraProject()`'s own per-run-directory
 * resolution; `importPath`, `preScript` and `postScript` each flow through
 * `resolveWorkspacePath()` -- the SAME workspace-boundary resolver
 * `acme.build`'s `source`/`outDir`/`includes` use -- before any of the four
 * ever reaches argv. `buildAnalyzeHeadlessArgv()` (ghidra-project.mts) also
 * independently re-checks `preScript`/`postScript` for a parent-directory
 * path segment, exactly as it already re-checks `projectLocation` for a
 * dot-prefixed segment -- so both rules hold even for a caller that
 * constructed these fields itself and skipped this module's own resolution
 * sites entirely. */
export const HOST_TOOL_ARG_KEYS: Readonly<Record<HostToolId, readonly string[]>> = Object.freeze(
  Object.assign(Object.create(null) as Record<HostToolId, readonly string[]>, {
    "acme.build": Object.freeze(["source", "outDir", "format", "setpc", "defines", "includes", "noReport"]),
    "ghidra.analyze": Object.freeze(["runId", "importPath", "preScript", "postScript"]),
    // 34-08 (CR-01): EMPTY -- the oracle's location is host-side
    // configuration only (resolveOracleCommand(), below), never a wire
    // value. No caller-supplied value may ever select what the host
    // executes, even framed as merely reconfiguring an already-allowlisted
    // tool.
    "oracle.probe": Object.freeze([]),
    "oracle.run": Object.freeze(["source"]),
  }),
);

/** 34-08 (Task 3): the answer to ONE question -- which accepted argument
 * keys, per tool, name a filesystem path and therefore MUST pass
 * `resolveWorkspacePath()` before ever reaching argv. Built with the SAME
 * `Object.freeze(Object.assign(Object.create(null), ...))` idiom
 * `HOST_TOOL_ARG_KEYS` above uses. Consumed by `host-tool.test.ts`'s
 * data-driven census, never by production code -- the census is what makes
 * "no argv passthrough anywhere" a mechanism rather than three point fixes:
 * a key added here without a matching resolution site is what the test
 * proves, a key ADDED to `HOST_TOOL_ARG_KEYS` without being classified HERE
 * (as path-bearing or not) is what the test's both-directions completeness
 * check catches.
 *
 * Deliberately NOT included: `ghidra.analyze`'s `runId`. It is a validated
 * opaque id bounded by its own anchored pattern (`RUN_ID_PATTERN`,
 * ghidra-project.mts), turned into a path only by `resolveGhidraProject()`
 * -- a DIFFERENT mechanism with its own guard, not `resolveWorkspacePath()`.
 * `oracle.probe`'s entry is empty because that tool accepts no arguments at
 * all (Task 1, CR-01). */
export const HOST_TOOL_PATH_ARG_KEYS: Readonly<Record<HostToolId, readonly string[]>> = Object.freeze(
  Object.assign(Object.create(null) as Record<HostToolId, readonly string[]>, {
    "acme.build": Object.freeze(["source", "outDir", "includes"]),
    "ghidra.analyze": Object.freeze(["importPath", "preScript", "postScript"]),
    "oracle.probe": Object.freeze([]),
    "oracle.run": Object.freeze(["source"]),
  }),
);

export interface AcmeBuildArgs {
  source: string;
  outDir?: string;
  format?: string;
  setpc?: string;
  defines?: string[];
  includes?: string[];
  noReport?: boolean;
}

export interface GhidraAnalyzeArgs {
  runId: string;
  importPath: string;
  preScript?: string;
  postScript?: string;
}

/** 34-08 (CR-01): the wire request carries NO configuration at all -- the
 * oracle's binary location is host-side configuration ONLY, decided by
 * `resolveOracleCommand()` from the broker process's own environment
 * (`UNP64`/`UNP64_PATH`, packer-finding.mjs's own configured-path
 * convention), exactly like the ACME library directory `findAcmeLib()`
 * probes. There is no field here for the same reason there is no `command`
 * key in `HOST_TOOL_ARG_KEYS["oracle.probe"]`: a container-side caller must
 * never choose what the host executes, even framed as merely reconfiguring
 * an already-allowlisted tool. (Previously an optional `command` override
 * field -- removed this plan; see CR-01's trust-boundary-regression
 * finding.) */
export type OracleProbeArgs = Record<string, never>;

/** `source` is workspace-relative, resolved through the SAME
 * resolveWorkspacePath() site every other tool's path argument uses. */
export interface OracleRunArgs {
  source: string;
}

export type HostToolRequest =
  | { tool: "acme.build"; args: AcmeBuildArgs }
  | { tool: "ghidra.analyze"; args: GhidraAnalyzeArgs }
  | { tool: "oracle.probe"; args: OracleProbeArgs }
  | { tool: "oracle.run"; args: OracleRunArgs };

export type NormaliseHostToolRequestResult = { ok: true; request: HostToolRequest } | { ok: false; message: string };

const HOST_TOOL_SHAPE = `an object with a "tool" field naming one of ${HOST_TOOL_IDS.map((t) => JSON.stringify(t)).join(", ")}, and an optional "args" object`;

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

/** THIS IS THE ONE PLACE a `host_tool` request is narrowed. Never throws;
 * answers a discriminated result naming the offending value or key AND the
 * accepted shape, exactly as broker-control.mts's normaliseLaunchProfile()
 * does. Never coerces a type (a string "true" for `noReport` is refused, not
 * converted) and never drops a key silently. */
export function normaliseHostToolRequest(raw: unknown): NormaliseHostToolRequestResult {
  if (!isPlainObject(raw)) {
    return { ok: false, message: `host_tool request must be ${HOST_TOOL_SHAPE}; got ${describe(raw)}` };
  }

  const toolRaw = raw.tool;
  if (typeof toolRaw !== "string" || toolRaw === "") {
    return {
      ok: false,
      message: `host_tool request "tool" field must be a non-empty string naming one of ${HOST_TOOL_IDS.join(", ")}; got ${describe(toolRaw)}`,
    };
  }
  if (!HOST_TOOL_IDS.includes(toolRaw as HostToolId)) {
    return { ok: false, message: `unknown host_tool "tool" value ${describe(toolRaw)}; accepted values are ${HOST_TOOL_IDS.join(", ")}` };
  }
  const tool = toolRaw as HostToolId;

  const argsRaw = raw.args;
  if (argsRaw !== undefined && !isPlainObject(argsRaw)) {
    return { ok: false, message: `host_tool "args" must be a plain object or absent; got ${describe(argsRaw)}` };
  }
  const argsObj: Record<string, unknown> = argsRaw ?? {};
  const acceptedKeys = HOST_TOOL_ARG_KEYS[tool];
  const acceptedShape =
    acceptedKeys.length > 0 ? `an object with optional key(s) ${acceptedKeys.join("/")}` : "an object with no accepted keys -- this tool takes no arguments";
  const unknownKeys = Object.keys(argsObj).filter((key) => !acceptedKeys.includes(key));
  if (unknownKeys.length > 0) {
    return { ok: false, message: `host_tool "${tool}" args has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${acceptedShape}` };
  }

  if (tool === "acme.build") {
    const source = argsObj.source;
    if (typeof source !== "string" || source === "") {
      return { ok: false, message: `host_tool "acme.build" requires a non-empty string "source"; got ${describe(source)}` };
    }
    const args: AcmeBuildArgs = { source };

    if ("outDir" in argsObj) {
      const outDir = argsObj.outDir;
      if (typeof outDir !== "string" || outDir === "") {
        return { ok: false, message: `host_tool "acme.build" args.outDir must be a non-empty string; got ${describe(outDir)}` };
      }
      args.outDir = outDir;
    }
    if ("format" in argsObj) {
      const format = argsObj.format;
      if (typeof format !== "string" || format === "") {
        return { ok: false, message: `host_tool "acme.build" args.format must be a non-empty string; got ${describe(format)}` };
      }
      args.format = format;
    }
    if ("setpc" in argsObj) {
      const setpc = argsObj.setpc;
      if (typeof setpc !== "string" || setpc === "") {
        return { ok: false, message: `host_tool "acme.build" args.setpc must be a non-empty string; got ${describe(setpc)}` };
      }
      args.setpc = setpc;
    }
    if ("defines" in argsObj) {
      const defines = argsObj.defines;
      if (!Array.isArray(defines) || !defines.every((d) => typeof d === "string")) {
        return { ok: false, message: `host_tool "acme.build" args.defines must be an array of strings; got ${describe(defines)}` };
      }
      args.defines = defines as string[];
    }
    if ("includes" in argsObj) {
      const includes = argsObj.includes;
      // Task 1 (CR-03): an empty-string entry is refused here rather than
      // silently skipped or forwarded to resolveWorkspacePath() -- the same
      // "must be an array of strings" message, tightened to reject the one
      // string value that would otherwise slip through as "an array of
      // strings" while carrying no real path.
      if (!Array.isArray(includes) || !includes.every((i) => typeof i === "string" && i !== "")) {
        return { ok: false, message: `host_tool "acme.build" args.includes must be an array of strings; got ${describe(includes)}` };
      }
      args.includes = includes as string[];
    }
    if ("noReport" in argsObj) {
      const noReport = argsObj.noReport;
      if (typeof noReport !== "boolean") {
        return { ok: false, message: `host_tool "acme.build" args.noReport must be a boolean; got ${describe(noReport)}` };
      }
      args.noReport = noReport;
    }

    return { ok: true, request: { tool, args } };
  }

  if (tool === "ghidra.analyze") {
    const runIdRaw = argsObj.runId;
    if (typeof runIdRaw !== "string" || runIdRaw === "") {
      return { ok: false, message: `host_tool "ghidra.analyze" requires a non-empty string "runId"; got ${describe(runIdRaw)}` };
    }
    const importPathRaw = argsObj.importPath;
    if (typeof importPathRaw !== "string" || importPathRaw === "") {
      return { ok: false, message: `host_tool "ghidra.analyze" requires a non-empty string "importPath"; got ${describe(importPathRaw)}` };
    }
    const args: GhidraAnalyzeArgs = { runId: runIdRaw, importPath: importPathRaw };

    if ("preScript" in argsObj) {
      const preScript = argsObj.preScript;
      if (typeof preScript !== "string" || preScript === "") {
        return { ok: false, message: `host_tool "ghidra.analyze" args.preScript must be a non-empty string; got ${describe(preScript)}` };
      }
      args.preScript = preScript;
    }
    if ("postScript" in argsObj) {
      const postScript = argsObj.postScript;
      if (typeof postScript !== "string" || postScript === "") {
        return { ok: false, message: `host_tool "ghidra.analyze" args.postScript must be a non-empty string; got ${describe(postScript)}` };
      }
      args.postScript = postScript;
    }

    return { ok: true, request: { tool, args } };
  }

  if (tool === "oracle.probe") {
    // 34-08 (CR-01): no key is accepted at all -- the unknown-key check
    // above already refused the retired "command" key (and any other key)
    // by name, since HOST_TOOL_ARG_KEYS["oracle.probe"] is now empty. No new
    // refusal code is needed here.
    return { ok: true, request: { tool, args: {} } };
  }

  if (tool === "oracle.run") {
    const source = argsObj.source;
    if (typeof source !== "string" || source === "") {
      return { ok: false, message: `host_tool "oracle.run" requires a non-empty string "source"; got ${describe(source)}` };
    }
    return { ok: true, request: { tool, args: { source } } };
  }

  // Unreachable while HOST_TOOL_IDS has exactly four members -- kept so a
  // future tool added to HOST_TOOL_IDS without a matching narrowing arm
  // fails loudly here rather than silently returning an under-typed request.
  return { ok: false, message: `normaliseHostToolRequest: no narrowing arm for tool "${tool}"` };
}

// ---------------------------------------------------------------------------
// Workspace-relative path resolution (A-03 / T-34-03, CR-05 / 34-10). A
// `host_tool` request never carries a host-absolute path -- every path
// argument is workspace-relative and resolved HERE, against the broker's own
// `--repo-root`, then re-checked to be inside it. This is the ONLY place a
// wire-supplied path becomes a real path.
//
// BOTH the workspace root and the candidate go through the SAME
// ancestor-realpath walk (realpathOfNearestExisting(), below) before the
// separator-appended prefix comparison, and the returned `ok: true` value is
// the WALKED (real) path, never the lexical join. That is load-bearing
// rather than a symmetry preference, for the two reasons
// anno-types.ts:1159-1176 already names for its own two consumers of this
// walk: a workspace root that does not yet exist is a legitimate input (a
// bare realpath would throw a raw ENOENT), and resolving only the candidate
// side makes every in-workspace path look foreign whenever the root itself
// is reached through a symlink. CR-05 (34-VERIFICATION.md gap 3) is what a
// purely lexical path.resolve() + startsWith() check missed: a symlink
// planted inside the workspace, pointing outside it, lexically satisfied the
// prefix check while a real write through it landed outside the root.
//
// BEHAVIOURAL CONSEQUENCE, intended: because this returns the real path, a
// link pointing INSIDE the workspace is FOLLOWED and the request is
// accepted at the link's real location -- the alternative, refusing every
// symlink, is the over-broad fix host-tool.test.ts's discriminating cases
// (34-10 Task 2) exist to redden.
//
// Two residuals recorded here, beside the guarantee rather than past it: (1)
// the check-then-open window between this decision and the child process's
// own open is not closed at this layer -- the child is a third-party binary
// handed a path string, so there is no descriptor-based route to making the
// check and the open one operation (T-34-52, accepted); (2) the comparison
// is byte-wise over the resolved strings with the platform separator
// appended and applies no Unicode normalisation, so two spellings differing
// only in normalisation form are two distinct paths here (the same residual
// anno-confinement.test.ts records for the same comparison).
//
// A-16 (docs/phase34-host-tool-seam-decisions.md): because the return value
// is now the REAL path, on a host whose workspace root is itself reached
// through a symlink the response `path` need not match any member of
// hostRootCandidates() (containerpath.ts), and containerPath() throws
// rather than passing an untranslatable path through --
// HOST_WORKSPACE_PATH naming the real root is the pre-existing mitigation.
// This is a recorded limit, not a widened hostpath.ts consumer set.
// ---------------------------------------------------------------------------

/**
 * The maximum number of DANGLING-symlink hops `realpathOfNearestExisting`
 * will take before refusing. 40 is deliberately the same value
 * anno-types.ts:971 uses -- Linux's own `MAXSYMLINKS`, so a chain this walk
 * refuses is one the kernel would refuse too. Task 2's equivalence case
 * (against anno-types.ts's storePathWithinWorkspace()) is what keeps the two
 * copies from drifting apart. The bound exists because a cycle (`a -> b`,
 * `b -> a`) is otherwise an infinite loop inside a function whose input
 * arrives unvalidated from the transport.
 */
const MAX_SYMLINK_HOPS = 40;

/**
 * Does the path ENTRY `entry` exist -- does this NAME exist in its
 * directory -- without following a symlink at the leaf, and without
 * throwing. Mirrors anno-types.ts's own `pathEntryExists`, with one
 * deliberate difference: this returns a refusal where that version throws,
 * because `resolveWorkspacePath()`'s contract is a result object and this
 * module's own never-throw discipline must not be widened by adding
 * filesystem access.
 *
 * `throwIfNoEntry: false` suppresses `ENOENT` and NOTHING ELSE
 * (anno-types.ts:985-1000's own REVERSED-2026-08-28 note) -- a permission
 * error or any other stat failure on an ancestor becomes a named refusal
 * here rather than escaping as a bare thrown error.
 */
function pathEntryExists(entry: string, forPath: string): { ok: true; exists: boolean } | { ok: false; message: string } {
  try {
    return { ok: true, exists: lstatSync(entry, { throwIfNoEntry: false }) !== undefined };
  } catch (e) {
    return {
      ok: false,
      message: `cannot stat ${JSON.stringify(entry)} while confining ${JSON.stringify(forPath)} (${(e as Error).message})`,
    };
  }
}

/**
 * Returns the REAL absolute path of `p`, resolved through the deepest
 * ancestor whose path ENTRY exists on disk, with the non-existent tail
 * re-joined after it -- or a refusal naming the path when the walk cannot
 * answer.
 *
 * Mirrors anno-types.ts:1082's `realpathOfNearestExisting()` exactly, with
 * the same deliberate difference `pathEntryExists()` above states: this
 * RETURNS a refusal where that version THROWS `AnnoStorePathError`. Walks up
 * while the path ENTRY does not exist, unshifting each `basename` onto a
 * `tail` array; when the walk reaches the filesystem root
 * (`dirname(current) === current`) answers from `current` plus `tail`
 * rather than from the pre-walk resolved string, because after a hop the
 * pre-walk string describes a location the walk is no longer on; when the
 * stopping entry is a symlink whose target does not exist, counts a hop,
 * refuses past `MAX_SYMLINK_HOPS` naming the bound, and resolves the link's
 * target against the LINK'S OWN DIRECTORY -- never the process cwd, since a
 * relative target (`../outside/x`) is the common form. Otherwise
 * `realpathSync(current)`, joined with `tail`. Every `lstatSync`,
 * `readlinkSync` and `realpathSync` failure becomes a refusal naming the
 * path, never a throw.
 */
function realpathOfNearestExisting(p: string): { ok: true; path: string } | { ok: false; message: string } {
  const resolved = resolvePath(p);
  const tail: string[] = [];
  let current = resolved;
  let hops = 0;

  for (;;) {
    let reachedFilesystemRoot = false;
    for (;;) {
      const entryCheck = pathEntryExists(current, resolved);
      if (!entryCheck.ok) return { ok: false, message: entryCheck.message };
      if (entryCheck.exists) break;
      const parent = dirname(current);
      if (parent === current) {
        reachedFilesystemRoot = true;
        break;
      }
      tail.unshift(basename(current));
      current = parent;
    }
    if (reachedFilesystemRoot) {
      return { ok: true, path: tail.length === 0 ? current : join(current, ...tail) };
    }

    // The stopping ENTRY exists. Is it a symlink whose target does not?
    // That is the one class a resolve-following existence predicate cannot
    // see, and the only one needing a hop.
    let stoppedAtDanglingLink: boolean;
    try {
      stoppedAtDanglingLink = lstatSync(current).isSymbolicLink() && !existsSync(current);
    } catch (e) {
      return {
        ok: false,
        message: `cannot stat ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
      };
    }

    if (stoppedAtDanglingLink) {
      hops += 1;
      if (hops > MAX_SYMLINK_HOPS) {
        return {
          ok: false,
          message:
            `cannot resolve ${JSON.stringify(resolved)}: more than ${MAX_SYMLINK_HOPS} symbolic-link hops while resolving ` +
            `${JSON.stringify(current)} -- a symlink cycle or an over-long chain, refused rather than followed`,
        };
      }
      let link: string;
      try {
        link = readlinkSync(current);
      } catch (e) {
        return {
          ok: false,
          message: `cannot read the symbolic link ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
        };
      }
      // Against the LINK'S directory, never the process cwd.
      current = resolvePath(dirname(current), link);
      continue;
    }

    let real: string;
    try {
      real = realpathSync(current);
    } catch (e) {
      return {
        ok: false,
        message: `cannot resolve the real path of ${JSON.stringify(current)} while confining ${JSON.stringify(resolved)} (${(e as Error).message})`,
      };
    }
    return { ok: true, path: tail.length === 0 ? real : join(real, ...tail) };
  }
}

export type ResolveWorkspacePathResult = { ok: true; path: string } | { ok: false; message: string };

export function resolveWorkspacePath(repoRoot: string, relative: string): ResolveWorkspacePathResult {
  if (typeof relative !== "string" || relative === "") {
    return { ok: false, message: `workspace path must be a non-empty relative string; got ${describe(relative)}` };
  }
  if (isAbsolute(relative)) {
    return { ok: false, message: `workspace path must be relative to the workspace root, not absolute: ${describe(relative)}` };
  }
  const rootAbs = resolvePath(repoRoot);
  const walkedRoot = realpathOfNearestExisting(rootAbs);
  if (!walkedRoot.ok) {
    return { ok: false, message: `cannot resolve the workspace root ${JSON.stringify(rootAbs)}: ${walkedRoot.message}` };
  }
  const walkedCandidate = realpathOfNearestExisting(resolvePath(walkedRoot.path, relative));
  if (!walkedCandidate.ok) {
    return { ok: false, message: walkedCandidate.message };
  }
  if (walkedCandidate.path !== walkedRoot.path && !walkedCandidate.path.startsWith(walkedRoot.path + sep)) {
    return {
      ok: false,
      message: `workspace path escapes the workspace root: ${describe(relative)} resolves to ${walkedCandidate.path}, outside ${walkedRoot.path}`,
    };
  }
  return { ok: true, path: walkedCandidate.path };
}

// ---------------------------------------------------------------------------
// Server-side argv construction (SEAM-02, T-34-01). Argv is built ENTIRELY
// from typed fields already narrowed by normaliseHostToolRequest() above and
// paths already resolved by resolveWorkspacePath() -- never from a raw wire
// array or a raw wire string.
// ---------------------------------------------------------------------------

export interface ResolvedAcmeBuildPaths {
  sourcePath: string;
  outDirPath: string;
  /** Task 1 (CR-03): every `includes` entry, resolved through
   * resolveWorkspacePath() by runHostTool() BEFORE buildHostToolArgv() ever
   * sees this object. buildHostToolArgv() reads paths ONLY from this array --
   * never from request.args.includes -- so an absent or empty `includes` on
   * the wire becomes an empty array here, not an omitted field. */
  includePaths: string[];
}

/** Phase 34, plan 34-03 (SEAM-04): the resolved fields ghidra.analyze's own
 * buildHostToolArgv() branch needs. `projectLocation`/`projectName` come
 * from ghidra-project.mts's resolveGhidraProject() -- NEVER computed here --
 * and `importPath` is resolved through resolveWorkspacePath() exactly like
 * acme.build's `source`, so the workspace-escape mitigation is the same one
 * site for every tool. */
export interface ResolvedGhidraAnalyzePaths {
  importPath: string;
  projectLocation: string;
  projectName: string;
  /** Task 2 (CR-02): present only when the wire request carried the
   * corresponding field, each resolved through resolveWorkspacePath() by
   * runHostTool() BEFORE buildHostToolArgv() ever sees this object --
   * buildHostToolArgv() reads these two fields ONLY from here, never from
   * request.args. */
  preScriptPath?: string;
  postScriptPath?: string;
}

export type ResolvedHostToolPaths = ResolvedAcmeBuildPaths | ResolvedGhidraAnalyzePaths;

export type BuildHostToolArgvResult =
  | { ok: true; toolPath: string; argv: string[]; outputs: string[] }
  | { ok: false; message: string };

/** Deterministic: the same typed request and the same resolved paths yield a
 * byte-identical argv array on two successive calls -- no randomness, no
 * timestamp, no environment-dependent ordering. */
export function buildHostToolArgv(request: HostToolRequest, resolved: ResolvedHostToolPaths): BuildHostToolArgvResult {
  if (request.tool === "acme.build") {
    const { args } = request;
    const { sourcePath, outDirPath, includePaths } = resolved as ResolvedAcmeBuildPaths;
    const stem = join(outDirPath, basename(sourcePath).replace(/\.(a|asm|s)$/i, ""));
    const prg = `${stem}.prg`;
    // Overridable local variable named for what it holds -- never `binPath`/
    // `viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's
    // EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site.
    const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";

    // Fixed flags first, in the SAME order src/skills/acme-build/scripts/
    // acme.mjs's build() uses today, then one -D per define and one -I pair
    // per include in caller-given order, then --setpc if given, then the
    // resolved source path LAST.
    const argv: string[] = [
      "--cpu",
      "6510",
      "-f",
      args.format ?? "cbm",
      "-Wtype-mismatch",
      "--strict-segments",
      "--msvc",
      "-v1",
      "-o",
      prg,
      "-l",
      `${stem}.sym`,
      "--vicelabels",
      `${stem}.vs`,
    ];
    if (!args.noReport) argv.push("-r", `${stem}.rep`);
    for (const define of args.defines ?? []) argv.push(`-D${define}`);
    // Task 1 (CR-03): reads ONLY from resolved.includePaths -- never from
    // request.args.includes -- so argv never carries a raw wire string for
    // this field. Defensively defaults to [] so a caller that omits
    // includePaths entirely still yields a valid, empty-include argv rather
    // than throwing on an undefined iterable.
    for (const include of includePaths ?? []) argv.push("-I", include);
    if (args.setpc) argv.push("--setpc", args.setpc);
    argv.push(sourcePath);

    return { ok: true, toolPath: acmePath, argv, outputs: [prg] };
  }

  if (request.tool === "ghidra.analyze") {
    const { importPath, projectLocation, projectName, preScriptPath, postScriptPath } = resolved as ResolvedGhidraAnalyzePaths;

    // Named environment variable, never a guessed install location and
    // never this repository's own local probe directory (T-34-16).
    const ghidraHome = process.env.GHIDRA_HOME;
    if (ghidraHome === undefined || ghidraHome === "") {
      return {
        ok: false,
        message: `host_tool "ghidra.analyze" requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset`,
      };
    }
    // Overridable local variable named for what it holds -- never `binPath`/
    // `viceBin`/`VICE_BIN`/`x64sc`, which spawn-seam.test.ts's
    // EMULATOR_BIN_SHAPE would misclassify as an emulator spawn site.
    const ghidraPath = join(ghidraHome, "support", "analyzeHeadless");
    if (!existsSync(ghidraPath)) {
      return {
        ok: false,
        message: `host_tool "ghidra.analyze" refuses: GHIDRA_HOME's resolved launcher does not exist on disk (${ghidraPath})`,
      };
    }

    // Argv construction and the dot-segment re-check both live in
    // ghidra-project.mts's buildAnalyzeHeadlessArgv() -- never re-derived
    // here (A-06).
    // Task 2 (CR-02): reads ONLY from resolved.preScriptPath/postScriptPath --
    // never from request.args.preScript/postScript -- so argv never carries
    // a raw, unresolved wire string for either field.
    const argvInput: { projectLocation: string; projectName: string; importPath: string; preScript?: string; postScript?: string } = {
      projectLocation,
      projectName,
      importPath,
    };
    if (preScriptPath !== undefined) argvInput.preScript = preScriptPath;
    if (postScriptPath !== undefined) argvInput.postScript = postScriptPath;

    const built = buildAnalyzeHeadlessArgv(argvInput);
    if (!built.ok) return { ok: false, message: built.message };

    return { ok: true, toolPath: ghidraPath, argv: built.argv, outputs: [] };
  }

  return { ok: false, message: `buildHostToolArgv: no argv builder for tool "${(request as { tool: string }).tool}"` };
}

// ---------------------------------------------------------------------------
// Async child-process invocation and result digest (SEAM-02, SEAM-03,
// T-34-02, T-34-05, T-34-06). NEVER `spawnSync` -- broker-kill.mts's
// uncaughtException/unhandledRejection handlers kill the ENTIRE VICE pool on
// any unhandled throw in this process, and a synchronous spawn for a
// multi-second tool run would block the single-threaded event loop for its
// whole duration, starving acquires, the warm floor, and monitor claims.
// ---------------------------------------------------------------------------

/** Fallback per-invocation timeout for a tool id absent from
 * HOST_TOOL_TIMEOUT_MS below -- unreachable today, since every HOST_TOOL_IDS
 * member has an explicit table entry, but this constant stays exported and
 * consulted as the honest bottom of the resolver's fallback chain. It is
 * also the value acme.build/oracle.probe/oracle.run's own table entries
 * hold today (20s, the same value packer-finding.mjs's own
 * ORACLE_TIMEOUT_MS convention already used) -- no longer the ceiling for
 * EVERY invocation (34-09, CR-04): a single default governing every tool is
 * exactly how CR-04 happened -- a number chosen for a stateless assembler
 * silently governed a JVM. */
export const DEFAULT_HOST_TOOL_TIMEOUT_MS = 20_000;

/** 34-09 (CR-04): the per-tool SERVER-side budget table, built with the SAME
 * `Object.freeze(Object.assign(Object.create(null), ...))` idiom
 * HOST_TOOL_ARG_KEYS uses, with an entry for EVERY HOST_TOOL_IDS member --
 * completeness enforced by host-tool.test.ts's own completeness case, never
 * assumed silently. `acme.build`, `oracle.probe` and `oracle.run` keep the
 * value DEFAULT_HOST_TOOL_TIMEOUT_MS already held (20_000ms) -- none of
 * their measured costs approach the fixed ceiling. `ghidra.analyze` gets
 * 600_000ms (10 minutes), justified from this project's own recorded
 * numbers rather than a round guess: the documented JVM startup range is
 * 12.6-17.4s (docs/phase34-host-tool-seam-decisions.md Part 1), this
 * phase's own transcript measured 12407ms and 11160ms for a *refusal* alone,
 * and the same decision record states a real analysis run takes multiple
 * minutes -- 10 minutes clears startup plus a realistic analysis budget
 * with headroom, while staying a finite, stated ceiling: raising a budget
 * must never mean removing the kill-on-expiry bound
 * (must_haves.prohibitions) -- spawnHostTool()'s timer below still kills and
 * reports a refusal on expiry, unchanged. */
export const HOST_TOOL_TIMEOUT_MS: Readonly<Record<HostToolId, number>> = Object.freeze(
  Object.assign(Object.create(null) as Record<HostToolId, number>, {
    "acme.build": DEFAULT_HOST_TOOL_TIMEOUT_MS,
    "ghidra.analyze": 600_000,
    "oracle.probe": DEFAULT_HOST_TOOL_TIMEOUT_MS,
    "oracle.run": DEFAULT_HOST_TOOL_TIMEOUT_MS,
  }),
);

/** The resolver every spawn site reads its budget from: an explicit
 * override (`deps.timeoutMs` -- the in-process test seam) always wins;
 * else the table entry above for `tool`; else DEFAULT_HOST_TOOL_TIMEOUT_MS
 * as the fallback for a tool id with no table entry (unreachable today, but
 * keeps this function total rather than partial). This is the ONE place a
 * budget is decided -- runHostTool()'s acme.build/ghidra.analyze branch,
 * runOracleProbe() and runOracleRun() all call it rather than reading
 * DEFAULT_HOST_TOOL_TIMEOUT_MS or the table directly. */
export function hostToolTimeoutMs(tool: HostToolId, override?: number): number {
  if (override !== undefined) return override;
  return HOST_TOOL_TIMEOUT_MS[tool] ?? DEFAULT_HOST_TOOL_TIMEOUT_MS;
}

/** stderrTail's byte cap -- diagnostics only, never a result. */
const STDERR_TAIL_CAP_BYTES = 64 * 1024;

/** oracle.run's stdout cap -- the SAME measured bound as
 * packer-finding.mjs's own (unmoved, still exported there) MAX_ORACLE_STDOUT_BYTES.
 * The executor enforces the bound on what it accumulates; the script keeps
 * exporting the number for its own parser and its own tests -- not a
 * duplicated maintenance burden, the same measured constant on both sides. */
const ORACLE_STDOUT_CAP_BYTES = 64 * 1024;

export interface HostToolFileResult {
  path: string;
  sha256: string;
  byteLength: number;
}

/** 34-04, SEAM-05: oracle.probe/oracle.run's response shapes mirror
 * packer-finding.mjs's OWN pre-existing `{ available, command, version,
 * reason }` / `{ ok, stdout, reason }` contracts directly (not the generic
 * `{ tool, exitStatus, results, stderrTail }` envelope acme.build/
 * ghidra.analyze use) -- the migrated client-side functions return the
 * seam's response with no field renaming. */
export type HostToolResponse =
  | { ok: true; tool: "acme.build" | "ghidra.analyze"; exitStatus: number | null; results: HostToolFileResult[]; stderrTail: string }
  | { ok: false; message: string }
  | { ok: true; tool: "oracle.probe"; available: boolean; command: string | null; version: string | null; reason: string | null }
  | { ok: boolean; tool: "oracle.run"; stdout: string; reason: string | null };

export interface HostToolDeps {
  repoRoot: string;
  log?: (line: string) => void;
  timeoutMs?: number;
}

/** Digests one produced output file: byte size from a filesystem stat, sha256
 * over its real bytes. A zero-byte file yields `byteLength: 0` and the
 * sha256 of the empty byte string -- never an omitted or null entry. Returns
 * `null` only when the file does not exist / is unreadable, so a tool run
 * that never produced this output reports no entry for it at all (distinct
 * from a produced-but-empty file). */
function digestOutputFile(path: string): HostToolFileResult | null {
  try {
    const stat = statSync(path);
    const contents = readFileSync(path);
    const sha256 = createHash("sha256").update(contents).digest("hex");
    return { path, sha256, byteLength: stat.size };
  } catch {
    return null;
  }
}

/** Caps `text` to its LAST `capBytes` bytes (UTF-8), never its first --
 * diagnostics from the tail of a long run are what a caller actually needs. */
function tailBytes(text: string, capBytes: number): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= capBytes) return text;
  return buf.subarray(buf.length - capBytes).toString("utf8");
}

interface HostToolSpawnResult {
  exitCode: number | null;
  timedOut: boolean;
  spawnErrorMessage: string | null;
  stdout: string;
  stderr: string;
}

/** Spawns `toolPath` with `argv` (an ARRAY, never a shell string; the command
 * interpreter is never enabled) and resolves -- NEVER rejects -- once the
 * child exits, errors, or is killed on timeout expiry. This is the ONE spawn
 * call in this module -- oracle.probe/oracle.run (34-04, SEAM-05) reuse it
 * rather than adding a second. `env` defaults to the broker process's own
 * environment (`spawn()`'s own default) when omitted; acme.build overrides it
 * to inject a probed `ACME` library directory (see `findAcmeLib()` below).
 * `stdout` is captured (not just `stderr`) because oracle.run's contract is
 * "the oracle's stdout", not a file digest -- acme.build/ghidra.analyze
 * simply ignore the field, exactly as they ignored stdout before it was
 * piped (ACME writes nothing to stdout; verified empirically this phase). */
function spawnHostTool(
  toolPath: string,
  argv: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<HostToolSpawnResult> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let timedOut = false;
    let stdout = "";
    let stderr = "";

    let child;
    try {
      child = spawn(toolPath, argv, { stdio: ["ignore", "pipe", "pipe"], ...(env ? { env } : {}) });
    } catch (e) {
      resolvePromise({
        exitCode: null,
        timedOut: false,
        spawnErrorMessage: e instanceof Error ? e.message : String(e),
        stdout: "",
        stderr: "",
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ exitCode: null, timedOut, spawnErrorMessage: err.message, stdout, stderr });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ exitCode: code, timedOut, spawnErrorMessage: null, stdout, stderr });
    });
  });
}

// ---------------------------------------------------------------------------
// The ACME library probe (34-04, SEAM-05). Moved server-side from
// acme.mjs's own findAcmeLib(): the project owner's rule of 2026-08-28 is
// that a container has no PATH to a host binary, and these five candidates
// are HOST paths -- so probing them belongs on the host side of the seam,
// not in the container-side skill script. Behaviourally identical to the
// removed client-side function: same candidate order, same marker file, same
// "first candidate whose marker exists wins" rule.
// ---------------------------------------------------------------------------

/** The marker file used to validate a candidate ACME library directory --
 * the layout fact `acme.mjs`'s own troubleshooting hint names. */
const ACME_LIB_MARKER = join("cbm", "c64", "vic.a");

function findAcmeLib(): { path: string | null; tried: string[] } {
  const tried: string[] = [];
  const candidates = [
    process.env.ACME,
    "/usr/local/share/acme",
    "/usr/share/acme",
    "/usr/lib/acme",
    process.env.HOME ? join(process.env.HOME, ".acme") : undefined,
  ].filter((c): c is string => typeof c === "string" && c !== "");
  for (const c of candidates) {
    tried.push(c);
    if (existsSync(join(c, ACME_LIB_MARKER))) return { path: c, tried };
  }
  return { path: null, tried };
}

/** Narrows, resolves, builds argv, then spawns the child ASYNCHRONOUSLY.
 * NOTHING throws out of this function -- every failure path (refusal, launch
 * error, timeout, non-zero exit, unreadable output) resolves to a response
 * object, because broker-kill.mts's uncaughtException/unhandledRejection
 * handlers kill the whole VICE pool on an unhandled throw in this process.
 * Emits exactly one `log()` line per ATTEMPTED invocation (i.e. once argv
 * construction succeeded and a child was actually spawned) naming the tool
 * id, the exit status, the elapsed milliseconds and (34-09, CR-04) the
 * budget that was actually applied (`timeout_ms=<n>`, from
 * hostToolTimeoutMs()) -- so which budget governed a run is observable off
 * the log line rather than inferred (A-02). A request refused before a
 * child is ever spawned emits no log line -- there is no invocation to
 * record. */
export async function runHostTool(raw: unknown, deps: HostToolDeps): Promise<HostToolResponse> {
  const narrowed = normaliseHostToolRequest(raw);
  if (!narrowed.ok) return { ok: false, message: narrowed.message };
  const { request } = narrowed;

  // Phase 34, plan 34-04 (SEAM-05): oracle.probe/oracle.run do not fit the
  // "spawn a tool that writes files, then digest them" shape below -- their
  // contract is the SPAWNED PROCESS'S OWN stdout (a version banner, or the
  // oracle's unpacked-output text), not a produced-file digest. Handled as
  // their own branch, reusing spawnHostTool() (the one spawn call) rather
  // than adding a second.
  if (request.tool === "oracle.probe") return runOracleProbe(deps);
  if (request.tool === "oracle.run") return runOracleRun(request.args, deps);

  const repoRootAbs = resolvePath(deps.repoRoot);

  let built: BuildHostToolArgvResult;
  let acmeLib: { path: string | null; tried: string[] } | null = null;
  if (request.tool === "acme.build") {
    const sourceResolved = resolveWorkspacePath(repoRootAbs, request.args.source);
    if (!sourceResolved.ok) return { ok: false, message: sourceResolved.message };

    let outDirPath: string;
    if (request.args.outDir !== undefined) {
      const outDirResolved = resolveWorkspacePath(repoRootAbs, request.args.outDir);
      if (!outDirResolved.ok) return { ok: false, message: outDirResolved.message };
      outDirPath = outDirResolved.path;
    } else {
      outDirPath = dirname(sourceResolved.path);
    }

    // Task 1 (CR-03): every `includes` entry resolved through the SAME
    // resolveWorkspacePath() site source/outDir just used. The FIRST
    // refusal returns unchanged -- the whole request fails, the offending
    // entry is never dropped and the remaining entries are never resolved
    // (no partial-success degradation, T-34-33). An absent or empty
    // `includes` yields an empty array, which buildHostToolArgv() emits as
    // no -I flags at all.
    const includePaths: string[] = [];
    for (const entry of request.args.includes ?? []) {
      const includeResolved = resolveWorkspacePath(repoRootAbs, entry);
      if (!includeResolved.ok) return { ok: false, message: includeResolved.message };
      includePaths.push(includeResolved.path);
    }

    built = buildHostToolArgv(request, { sourcePath: sourceResolved.path, outDirPath, includePaths });
    acmeLib = findAcmeLib();
  } else {
    // request.tool === "ghidra.analyze" -- the only other HOST_TOOL_IDS
    // member. `importPath` is workspace-relative, resolved through the
    // SAME resolveWorkspacePath() site acme.build's `source` uses; the
    // project location itself comes from ghidra-project.mts's
    // resolveGhidraProject() -- never computed here (A-06).
    const importResolved = resolveWorkspacePath(repoRootAbs, request.args.importPath);
    if (!importResolved.ok) return { ok: false, message: importResolved.message };

    // Task 2 (CR-02): preScript/postScript resolved through the SAME
    // resolveWorkspacePath() site, BEFORE resolveGhidraProject()'s own
    // directory RESERVATION below -- a refusal here must never leave a
    // reserved-but-unused run directory behind.
    let preScriptPath: string | undefined;
    if (request.args.preScript !== undefined) {
      const preScriptResolved = resolveWorkspacePath(repoRootAbs, request.args.preScript);
      if (!preScriptResolved.ok) return { ok: false, message: preScriptResolved.message };
      preScriptPath = preScriptResolved.path;
    }
    let postScriptPath: string | undefined;
    if (request.args.postScript !== undefined) {
      const postScriptResolved = resolveWorkspacePath(repoRootAbs, request.args.postScript);
      if (!postScriptResolved.ok) return { ok: false, message: postScriptResolved.message };
      postScriptPath = postScriptResolved.path;
    }

    const projectResolved = resolveGhidraProject({ repoRoot: repoRootAbs, runId: request.args.runId });
    if (!projectResolved.ok) return { ok: false, message: projectResolved.message };

    built = buildHostToolArgv(request, {
      importPath: importResolved.path,
      projectLocation: projectResolved.projectLocation,
      projectName: projectResolved.projectName,
      preScriptPath,
      postScriptPath,
    });
  }
  if (!built.ok) return { ok: false, message: built.message };

  const timeoutMs = hostToolTimeoutMs(request.tool, deps.timeoutMs);
  const startedAt = Date.now();
  // acme.build only: inject the probed ACME library directory as the child's
  // `ACME` env var, exactly as acme.mjs's own removed findAcmeLib() call
  // used to (T-34's own "same behaviour, moved" requirement) -- undefined
  // when no candidate matched, which spawnHostTool() treats identically to
  // "no override" (inherits the broker's own environment unchanged).
  const spawnEnv = acmeLib?.path ? { ...process.env, ACME: acmeLib.path } : undefined;
  const spawnResult = await spawnHostTool(built.toolPath, built.argv, timeoutMs, spawnEnv);
  const elapsedMs = Date.now() - startedAt;

  if (spawnResult.spawnErrorMessage !== null) {
    deps.log?.(`host_tool tool=${request.tool} exit=spawn_error elapsed_ms=${elapsedMs} timeout_ms=${timeoutMs}`);
    return { ok: false, message: `runHostTool: failed to launch "${built.toolPath}": ${spawnResult.spawnErrorMessage}` };
  }
  if (spawnResult.timedOut) {
    deps.log?.(`host_tool tool=${request.tool} exit=timeout elapsed_ms=${elapsedMs} timeout_ms=${timeoutMs}`);
    return { ok: false, message: `runHostTool: "${request.tool}" timed out after ${timeoutMs}ms and was killed` };
  }

  deps.log?.(`host_tool tool=${request.tool} exit=${spawnResult.exitCode ?? "null"} elapsed_ms=${elapsedMs} timeout_ms=${timeoutMs}`);

  const results: HostToolFileResult[] = [];
  for (const outputPath of built.outputs) {
    const digested = digestOutputFile(outputPath);
    if (digested) results.push(digested);
  }

  // acme.build only: ACME's own "for <...> includes..." complaint names no
  // directory it tried -- append a note line (in the plain, non-MSVC shape
  // acme.mjs's own parseDiagnostics() already treats as a "note" entry)
  // naming every candidate this probe tried, exactly as the removed
  // client-side hint used to. A line appended here, rather than reported as
  // a separate field, keeps acme.mjs's diagnostics parsing untouched -- it
  // already scans the combined text for exactly this shape.
  let stderrText = spawnResult.stderr;
  if (acmeLib && /ACME.*environment variable/i.test(stderrText)) {
    stderrText += `\nfor <...> includes, set $ACME to the directory holding ${ACME_LIB_MARKER} (looked in: ${acmeLib.tried.join(", ")})`;
  }

  return {
    ok: true,
    tool: request.tool,
    exitStatus: spawnResult.exitCode,
    results,
    stderrTail: tailBytes(stderrText, STDERR_TAIL_CAP_BYTES),
  };
}

// ---------------------------------------------------------------------------
// oracle.probe / oracle.run (34-04, SEAM-05). Migrated from
// packer-finding.mjs's own probeUnp64()/runUnp64(): everything about the
// BINARY (locating it, the version-banner probe, the scratch output
// location, the argument array, the runtime bound) lives here now; the
// script keeps everything about the FINDING (the name parser, the accepted
// character set, the caps, the packedness threshold, the never-throw return
// shapes). Response shapes are NOT the generic `{ ok, tool, exitStatus,
// results, stderrTail }` envelope above -- they mirror packer-finding.mjs's
// OWN pre-existing `{ available, command, version, reason }` /
// `{ ok, stdout, reason }` contracts directly, so the migrated client-side
// functions can return the seam's response with no field renaming.
// ---------------------------------------------------------------------------

/** Default command name when no host-side configuration is present -- the
 * same default packer-finding.mjs's own (removed) DEFAULT_ORACLE_COMMAND
 * used. */
const DEFAULT_ORACLE_COMMAND = "unp64";

/** The two environment variables the oracle's location is read from, in this
 * order -- the SAME variable order and names packer-finding.mjs's own
 * (client-side, container-facing) `ORACLE_ENV_VARS` declares, so a
 * container-side hint naming one of these two variables always describes
 * where this host-side resolver actually looked. */
const ORACLE_ENV_VARS: readonly string[] = Object.freeze(["UNP64", "UNP64_PATH"]);

export type ResolveOracleCommandResult = { ok: true; command: string } | { ok: false; reason: string };

/** 34-08 (CR-01): THE ONE PLACE the oracle binary's location is decided,
 * consulted by BOTH `runOracleProbe()` and `runOracleRun()` -- mirrors
 * `findAcmeLib()` above, which `34-04` already moved host-side for exactly
 * this reason: the container has no PATH to a host binary, so probing host
 * locations belongs on the host side of the seam. Reads the BROKER
 * PROCESS'S OWN environment -- never a wire value, because
 * `HOST_TOOL_ARG_KEYS["oracle.probe"]` accepts no keys at all. When a
 * variable is set, two checks apply in order: the configured path's base
 * name must equal `DEFAULT_ORACLE_COMMAND` (the review's own suggested
 * check, kept as a second layer over the wire-key removal), and the path
 * must exist on disk. Each refusal reason names WHICH variable was set and
 * NEVER interpolates the configured value (T-19-18, carried forward from
 * `34-04`). With no variable set, answers the bare `DEFAULT_ORACLE_COMMAND`
 * -- the existing search-path behaviour, unchanged. */
function resolveOracleCommand(): ResolveOracleCommandResult {
  for (const varName of ORACLE_ENV_VARS) {
    const raw = process.env[varName];
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const configured = raw.trim();
    if (basename(configured) !== DEFAULT_ORACLE_COMMAND) {
      return {
        ok: false,
        reason: `the oracle configured via ${varName} is not named "${DEFAULT_ORACLE_COMMAND}" -- treated as oracle-absent`,
      };
    }
    if (!existsSync(configured)) {
      return {
        ok: false,
        reason: `the oracle configured via ${varName} does not exist on disk -- treated as oracle-absent`,
      };
    }
    return { ok: true, command: configured };
  }
  return { ok: true, command: DEFAULT_ORACLE_COMMAND };
}

async function runOracleProbe(deps: HostToolDeps): Promise<HostToolResponse> {
  const resolved = resolveOracleCommand();
  if (!resolved.ok) {
    // No child is spawned on this branch -- WITHOUT echoing the configured
    // value anywhere (T-19-18); resolved.reason already names the variable,
    // never the value.
    deps.log?.(`host_tool tool=oracle.probe exit=absent_configured_path`);
    return { ok: true, tool: "oracle.probe", available: false, command: null, version: null, reason: resolved.reason };
  }
  const command = resolved.command;

  const timeoutMs = hostToolTimeoutMs("oracle.probe", deps.timeoutMs);
  const spawnResult = await spawnHostTool(command, ["--version"], timeoutMs);

  if (spawnResult.spawnErrorMessage !== null) {
    deps.log?.(`host_tool tool=oracle.probe exit=spawn_error timeout_ms=${timeoutMs}`);
    return {
      ok: true,
      tool: "oracle.probe",
      available: false,
      command: null,
      version: null,
      reason: `no "${DEFAULT_ORACLE_COMMAND}" packer identifier could be launched`,
    };
  }
  if (spawnResult.timedOut) {
    deps.log?.(`host_tool tool=oracle.probe exit=timeout timeout_ms=${timeoutMs}`);
    return {
      ok: true,
      tool: "oracle.probe",
      available: false,
      command: null,
      version: null,
      reason: "the packer identifier timed out during the version probe",
    };
  }

  deps.log?.(`host_tool tool=oracle.probe exit=${spawnResult.exitCode ?? "null"} timeout_ms=${timeoutMs}`);
  const banner = `${spawnResult.stdout}${spawnResult.stderr}`.trim();
  if (banner === "") {
    return {
      ok: true,
      tool: "oracle.probe",
      available: false,
      command: null,
      version: null,
      reason: "the packer identifier produced no version banner, so it was not accepted as an oracle",
    };
  }
  return { ok: true, tool: "oracle.probe", available: true, command, version: banner.slice(0, 200), reason: null };
}

async function runOracleRun(args: OracleRunArgs, deps: HostToolDeps): Promise<HostToolResponse> {
  const repoRootAbs = resolvePath(deps.repoRoot);
  const sourceResolved = resolveWorkspacePath(repoRootAbs, args.source);
  if (!sourceResolved.ok) {
    return { ok: false, tool: "oracle.run", stdout: "", reason: sourceResolved.message };
  }
  if (!existsSync(sourceResolved.path)) {
    return { ok: false, tool: "oracle.run", stdout: "", reason: "the input file does not exist" };
  }

  // 34-08 (CR-01): the SAME resolver oracle.probe consults -- never a bare
  // DEFAULT_ORACLE_COMMAND argument at the spawn site below. Before this
  // change a host-side configured oracle was honoured by the probe and
  // silently ignored by the run, so a working probe could be followed by a
  // failing run; resolving here closes that gap as a real defect fix, not
  // merely a mechanical follow-on from Task 1's wire-key removal.
  const resolvedCommand = resolveOracleCommand();
  if (!resolvedCommand.ok) {
    deps.log?.(`host_tool tool=oracle.run exit=absent_configured_path`);
    return { ok: false, tool: "oracle.run", stdout: "", reason: resolvedCommand.reason };
  }

  // The oracle's unpacked output goes to a scratch location INSIDE the
  // workspace tree -- never the system temp directory, which cannot be
  // translated back across the container boundary -- removed after this
  // function returns, mirroring packer-finding.mjs's own (removed)
  // "removed before this function returns" property (T-19-24).
  const scratchDir = join(repoRootAbs, "tools", "oracle-runs", `run-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(scratchDir, { recursive: true });
  const scratchOut = join(scratchDir, "unpacked.out");

  try {
    const timeoutMs = hostToolTimeoutMs("oracle.run", deps.timeoutMs);
    const spawnResult = await spawnHostTool(resolvedCommand.command, [sourceResolved.path, scratchOut], timeoutMs);

    if (spawnResult.spawnErrorMessage !== null) {
      deps.log?.(`host_tool tool=oracle.run exit=spawn_error timeout_ms=${timeoutMs}`);
      return { ok: false, tool: "oracle.run", stdout: "", reason: "the oracle could not be run against the input file" };
    }
    if (spawnResult.timedOut) {
      deps.log?.(`host_tool tool=oracle.run exit=timeout timeout_ms=${timeoutMs}`);
      return { ok: false, tool: "oracle.run", stdout: "", reason: "the oracle timed out" };
    }
    deps.log?.(`host_tool tool=oracle.run exit=${spawnResult.exitCode ?? "null"} timeout_ms=${timeoutMs}`);
    // Capped the same way packer-finding.mjs's own MAX_ORACLE_STDOUT_BYTES
    // caps it client-side -- the executor enforces the bound on what it
    // accumulates; the script still exports the number for its own parser
    // and its own tests, so the value is not duplicated as a maintained pair,
    // only as the same measured constant on both sides of the seam.
    const stdout = spawnResult.stdout.length > ORACLE_STDOUT_CAP_BYTES ? spawnResult.stdout.slice(0, ORACLE_STDOUT_CAP_BYTES) : spawnResult.stdout;
    return { ok: true, tool: "oracle.run", stdout, reason: null };
  } finally {
    try {
      rmSync(scratchDir, { recursive: true, force: true });
    } catch {
      // Best effort -- a leftover empty scratch directory is not worth
      // failing a read-only recon finding over (mirrors packer-finding.mjs's
      // own removed comment to the same effect).
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entry point (guarded on being the process entry point, the
// check-npm-packages.mjs:159 IS_ENTRY_POINT idiom). Plan 34-04 needs this for
// the host-local route (no broker in the loop); wired now so this tracer
// proves it. `node resources/host-tool.mjs run --repo-root <path> --request
// <json>` prints the response as one JSON line on stdout and exits non-zero
// on a refusal.
// ---------------------------------------------------------------------------

function parseCliArgs(argv: string[]): { repoRoot?: string; request?: string } {
  let repoRoot: string | undefined;
  let request: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo-root") {
      repoRoot = argv[i + 1];
      i++;
    } else if (argv[i] === "--request") {
      request = argv[i + 1];
      i++;
    }
  }
  return { repoRoot, request };
}

const IS_ENTRY_POINT = process.argv[1] !== undefined && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);

if (IS_ENTRY_POINT) {
  const [, , cliCommand, ...cliRest] = process.argv;
  if (cliCommand !== "run") {
    process.stderr.write("usage: host-tool.mjs run --repo-root <path> --request <json>\n");
    process.exitCode = 1;
  } else {
    const { repoRoot, request } = parseCliArgs(cliRest);
    if (!repoRoot || !request) {
      process.stderr.write("usage: host-tool.mjs run --repo-root <path> --request <json>\n");
      process.exitCode = 1;
    } else {
      let raw: unknown;
      try {
        raw = JSON.parse(request);
      } catch {
        raw = null;
      }
      runHostTool(raw, { repoRoot }).then((response) => {
        process.stdout.write(`${JSON.stringify(response)}\n`);
        process.exitCode = response.ok ? 0 : 1;
      });
    }
  }
}
