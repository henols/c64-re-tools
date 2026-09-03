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
//     real path, and it refuses anything that resolves outside the caller's
//     repo root (T-34-03).
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
import { existsSync, readFileSync, statSync } from "node:fs";
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
export type HostToolId = "acme.build" | "ghidra.analyze";

export const HOST_TOOL_IDS: readonly HostToolId[] = Object.freeze(["acme.build", "ghidra.analyze"]);

/** Per-tool accepted argument-key lists, built with `Object.create(null)`
 * (the vsf-slice.mjs WR-04 idiom) so no prototype key can ever resolve to a
 * value here even if a future caller indexed it with an untrusted string
 * directly -- belt-and-suspenders alongside the array-membership check
 * above, which is what actually guards the lookup below. `ghidra.analyze`'s
 * accepted keys carry no raw argv array and no raw command string -- only
 * `runId`/`importPath`/`preScript`/`postScript`, each a plain string that
 * flows through resolveWorkspacePath()/resolveGhidraProject() before it ever
 * reaches argv. */
export const HOST_TOOL_ARG_KEYS: Readonly<Record<HostToolId, readonly string[]>> = Object.freeze(
  Object.assign(Object.create(null) as Record<HostToolId, readonly string[]>, {
    "acme.build": Object.freeze(["source", "outDir", "format", "setpc", "defines", "includes", "noReport"]),
    "ghidra.analyze": Object.freeze(["runId", "importPath", "preScript", "postScript"]),
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

export type HostToolRequest = { tool: "acme.build"; args: AcmeBuildArgs } | { tool: "ghidra.analyze"; args: GhidraAnalyzeArgs };

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
  const acceptedShape = `an object with optional key(s) ${acceptedKeys.join("/")}`;
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
      if (!Array.isArray(includes) || !includes.every((i) => typeof i === "string")) {
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

  // Unreachable while HOST_TOOL_IDS has exactly two members -- kept so a
  // future tool added to HOST_TOOL_IDS without a matching narrowing arm
  // fails loudly here rather than silently returning an under-typed request.
  return { ok: false, message: `normaliseHostToolRequest: no narrowing arm for tool "${tool}"` };
}

// ---------------------------------------------------------------------------
// Workspace-relative path resolution (A-03 / T-34-03). A `host_tool` request
// never carries a host-absolute path -- every path argument is
// workspace-relative and resolved HERE, against the broker's own
// `--repo-root`, then re-checked to be inside it. This is the ONLY place a
// wire-supplied path becomes a real path.
// ---------------------------------------------------------------------------

export type ResolveWorkspacePathResult = { ok: true; path: string } | { ok: false; message: string };

export function resolveWorkspacePath(repoRoot: string, relative: string): ResolveWorkspacePathResult {
  if (typeof relative !== "string" || relative === "") {
    return { ok: false, message: `workspace path must be a non-empty relative string; got ${describe(relative)}` };
  }
  if (isAbsolute(relative)) {
    return { ok: false, message: `workspace path must be relative to the workspace root, not absolute: ${describe(relative)}` };
  }
  const rootAbs = resolvePath(repoRoot);
  const resolved = resolvePath(rootAbs, relative);
  if (resolved !== rootAbs && !resolved.startsWith(rootAbs + sep)) {
    return {
      ok: false,
      message: `workspace path escapes the workspace root: ${describe(relative)} resolves to ${resolved}, outside ${rootAbs}`,
    };
  }
  return { ok: true, path: resolved };
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
    const { sourcePath, outDirPath } = resolved as ResolvedAcmeBuildPaths;
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
    for (const include of args.includes ?? []) argv.push("-I", include);
    if (args.setpc) argv.push("--setpc", args.setpc);
    argv.push(sourcePath);

    return { ok: true, toolPath: acmePath, argv, outputs: [prg] };
  }

  if (request.tool === "ghidra.analyze") {
    const { args } = request;
    const { importPath, projectLocation, projectName } = resolved as ResolvedGhidraAnalyzePaths;

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
    const argvInput: { projectLocation: string; projectName: string; importPath: string; preScript?: string; postScript?: string } = {
      projectLocation,
      projectName,
      importPath,
    };
    if (args.preScript !== undefined) argvInput.preScript = args.preScript;
    if (args.postScript !== undefined) argvInput.postScript = args.postScript;

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

/** Default per-invocation timeout -- the same value packer-finding.mjs's own
 * ORACLE_TIMEOUT_MS convention already uses. */
export const DEFAULT_HOST_TOOL_TIMEOUT_MS = 20_000;

/** stderrTail's byte cap -- diagnostics only, never a result. */
const STDERR_TAIL_CAP_BYTES = 64 * 1024;

export interface HostToolFileResult {
  path: string;
  sha256: string;
  byteLength: number;
}

export type HostToolResponse =
  | { ok: true; tool: HostToolId; exitStatus: number | null; results: HostToolFileResult[]; stderrTail: string }
  | { ok: false; message: string };

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
  stderr: string;
}

/** Spawns `toolPath` with `argv` (an ARRAY, never a shell string; the command
 * interpreter is never enabled) and resolves -- NEVER rejects -- once the
 * child exits, errors, or is killed on timeout expiry. This is the ONE spawn
 * call in this module. */
function spawnHostTool(toolPath: string, argv: string[], timeoutMs: number): Promise<HostToolSpawnResult> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let timedOut = false;
    let stderr = "";

    let child;
    try {
      child = spawn(toolPath, argv, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (e) {
      resolvePromise({
        exitCode: null,
        timedOut: false,
        spawnErrorMessage: e instanceof Error ? e.message : String(e),
        stderr: "",
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ exitCode: null, timedOut, spawnErrorMessage: err.message, stderr });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ exitCode: code, timedOut, spawnErrorMessage: null, stderr });
    });
  });
}

/** Narrows, resolves, builds argv, then spawns the child ASYNCHRONOUSLY.
 * NOTHING throws out of this function -- every failure path (refusal, launch
 * error, timeout, non-zero exit, unreadable output) resolves to a response
 * object, because broker-kill.mts's uncaughtException/unhandledRejection
 * handlers kill the whole VICE pool on an unhandled throw in this process.
 * Emits exactly one `log()` line per ATTEMPTED invocation (i.e. once argv
 * construction succeeded and a child was actually spawned) naming the tool
 * id, the exit status and the elapsed milliseconds (A-02). A request refused
 * before a child is ever spawned emits no log line -- there is no invocation
 * to record. */
export async function runHostTool(raw: unknown, deps: HostToolDeps): Promise<HostToolResponse> {
  const narrowed = normaliseHostToolRequest(raw);
  if (!narrowed.ok) return { ok: false, message: narrowed.message };
  const { request } = narrowed;

  const repoRootAbs = resolvePath(deps.repoRoot);

  let built: BuildHostToolArgvResult;
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

    built = buildHostToolArgv(request, { sourcePath: sourceResolved.path, outDirPath });
  } else {
    // request.tool === "ghidra.analyze" -- the only other HOST_TOOL_IDS
    // member. `importPath` is workspace-relative, resolved through the
    // SAME resolveWorkspacePath() site acme.build's `source` uses; the
    // project location itself comes from ghidra-project.mts's
    // resolveGhidraProject() -- never computed here (A-06).
    const importResolved = resolveWorkspacePath(repoRootAbs, request.args.importPath);
    if (!importResolved.ok) return { ok: false, message: importResolved.message };

    const projectResolved = resolveGhidraProject({ repoRoot: repoRootAbs, runId: request.args.runId });
    if (!projectResolved.ok) return { ok: false, message: projectResolved.message };

    built = buildHostToolArgv(request, {
      importPath: importResolved.path,
      projectLocation: projectResolved.projectLocation,
      projectName: projectResolved.projectName,
    });
  }
  if (!built.ok) return { ok: false, message: built.message };

  const timeoutMs = deps.timeoutMs ?? DEFAULT_HOST_TOOL_TIMEOUT_MS;
  const startedAt = Date.now();
  const spawnResult = await spawnHostTool(built.toolPath, built.argv, timeoutMs);
  const elapsedMs = Date.now() - startedAt;

  if (spawnResult.spawnErrorMessage !== null) {
    deps.log?.(`host_tool tool=${request.tool} exit=spawn_error elapsed_ms=${elapsedMs}`);
    return { ok: false, message: `runHostTool: failed to launch "${built.toolPath}": ${spawnResult.spawnErrorMessage}` };
  }
  if (spawnResult.timedOut) {
    deps.log?.(`host_tool tool=${request.tool} exit=timeout elapsed_ms=${elapsedMs}`);
    return { ok: false, message: `runHostTool: "${request.tool}" timed out after ${timeoutMs}ms and was killed` };
  }

  deps.log?.(`host_tool tool=${request.tool} exit=${spawnResult.exitCode ?? "null"} elapsed_ms=${elapsedMs}`);

  const results: HostToolFileResult[] = [];
  for (const outputPath of built.outputs) {
    const digested = digestOutputFile(outputPath);
    if (digested) results.push(digested);
  }

  return {
    ok: true,
    tool: request.tool,
    exitStatus: spawnResult.exitCode,
    results,
    stderrTail: tailBytes(spawnResult.stderr, STDERR_TAIL_CAP_BYTES),
  };
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
