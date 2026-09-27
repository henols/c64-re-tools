#!/usr/bin/env node
// ghidra-run.ts
//
// WHY THIS FILE EXISTS: the client side of the `ghidra.analyze` host tool.
// runGhidraAnalyze() sends one typed request through the broker's fixed
// endpoint (`runHostToolOverEndpoint()`, host-tool-endpoint.mts), reads the
// downloaded run log, and classifies it with classifyGhidraRunLog(). Run as
// a script, this file is the CLI that the c64-disassembler skill spawns with
// `process.execPath`: it parses flags, calls runGhidraAnalyze() and prints
// one JSON line (see the CLI section at the bottom).
//
// The endpoint client uploads every input by bytes and downloads every
// result under the caller's tools root, so every result path is a local
// path, read as given. `results[0]` is always the run log (the output-slot
// invariant of buildHostToolArgv()'s ghidra branch, host-tool.mts);
// `results[1]` is the export when the request names an `exportPath`.
//
// WHY THE RUN LOG DECIDES SUCCESS, NOT THE EXIT STATUS: measured against
// real Ghidra 12.1.3, a run whose post-script throws still exits 0. The
// classifier therefore takes run-log TEXT only and answers three questions:
//   1. Did a script throw? Only the exact literal `ERROR REPORT SCRIPT
//      ERROR:` (HeadlessAnalyzer) counts.
//   2. Which language did the run use? The `Using Language/Compiler:` token,
//      or a named absence when that line is missing.
//   3. What expected/observed classification counts did the run print? A
//      best-effort labelled-number extraction. The export file itself
//      carries the exact `CLASSIFICATION_*` lines.
// runGhidraAnalyze() refuses (throws, naming both sides) when the parsed
// language id differs from the requested `processor` by even one byte.
//
// WHAT NOT TO DO:
//   - Never import `node:child_process` here or spawn Ghidra. Every run goes
//     through the one host-tool route.
//   - Never match "ERROR" loosely. An unrelated ERROR line in the log would
//     then read as a thrown script.
//   - Never case-fold the language comparison, and never read
//     analyzeHeadless's exit status as success.
//   - Never default `--processor` or `--import-route` on the CLI. Both are
//     required; a missing one is refused by name.
//   - Never print anything to stdout from the CLI except the one JSON line.
import { readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { runHostToolOverEndpoint, type HostToolClientResult, type RunHostToolOverEndpointOptions } from "./host-tool-endpoint.mts";
import { repoRoot as findRepoRoot, toolsDirUnder } from "./repo-root.ts";
import { ensureLocalDir } from "./project-local.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Mirrors the extended `GhidraAnalyzeArgs` (host-tool.mts) field-for-field.
 * `processor` is required, exactly as it is on the wire (D-36-01's promote
 * decision). The seven fields below `postScript` are plan 36-02's own
 * additions to `ghidra.analyze` -- written here NOW, all optional, so this
 * interface is authored ONCE rather than edited a second time when that
 * plan lands; `runGhidraAnalyze()` includes each in the wire request ONLY
 * when the caller supplies it, so omitting all seven here is
 * indistinguishable from calling this module before plan 36-02 landed. */
export interface GhidraRunArgs {
  runId: string;
  importPath: string;
  processor: string;
  preScript?: string;
  postScript?: string;
  /** Plan 36-02: required, two-member enum on the WIRE once that plan
   * lands; optional HERE because no caller in this plan supplies it. */
  importRoute?: "prg" | "flat64k";
  loaderBaseAddr?: string;
  noanalysis?: boolean;
  scriptPath?: string;
  entrypointsPath?: string;
  exportPath?: string;
  expectedClassificationLines?: number;
  /** Phase 37, plan 37-08 (AUTO-07): optional, path-bearing -- a range file
   * for the new DataRangeSeed.java pre-script. Included in the wire request
   * ONLY when the caller supplies it, mirroring every other field below. */
  dataRangesPath?: string;
}

/** The function shape `runHostToolOverEndpoint()` itself has. Mirrors
 * `DxaRunFn` (dxa-run.ts). */
export type GhidraRunFn = (tool: string, args: Record<string, unknown>, opts: RunHostToolOverEndpointOptions) => Promise<HostToolClientResult>;

export interface GhidraRunOptions {
  /** Test seam, mirroring `DxaRunOptions.run` (dxa-run.ts): an injectable
   * runner, defaulting to `runHostToolOverEndpoint()`. Lets a hermetic
   * test drive this module with no broker at all. */
  run?: GhidraRunFn;
  /** The local root: relative paths in the args resolve against it, and
   * every result downloads under `<repoRoot>/.c64-re-tools/`. Defaults to
   * this checkout's own root. */
  repoRoot?: string;
  /** Where results download; defaults to `<repoRoot>/.c64-re-tools`. */
  toolsRoot?: string;
  /** The broker endpoint port; defaults to the endpoint client's own. */
  port?: number;
  /** Test seam: injected run-log text, bypassing the filesystem read of the
   * response's run-log path -- mirrors `DxaRunOptions.listingText`. */
  runLogText?: string;
}

export interface GhidraRunResult {
  /** The run log's own path, sha256 and byte length, as reported by the
   * seam (the digested `results[0]` entry). */
  runLogPath: string;
  sha256: string;
  byteLength: number;
  /** Where the post-script's export was downloaded (`results[1]`, under the
   * caller's `.c64-re-tools/local/runs/ghidra/`) -- present only when the request
   * named an `exportPath`. The export never lands at `exportPath` itself:
   * that is only the name the broker-side script writes. */
  exportPath?: string;
  /** `analyzeHeadless`'s own process exit status. Carries NO information
   * about whether a script inside the run threw (MEASURED this session) --
   * surfaced here for completeness, never the basis of a pass/fail
   * decision on its own. */
  exitStatus: number | null;
  /** The language id parsed from the run log's own `Using Language/Compiler:`
   * line -- a named absence when the line itself is missing. */
  language: { present: true; id: string } | { present: false };
}

/** Answers three questions over run-log TEXT ONLY -- no exit status in this
 * function's signature, by design (see this module's own header). Never
 * throws: an absent signal for any of the three questions is reported as a
 * structured "not present" value, never inferred from an empty match. */
export interface GhidraRunLogVerdict {
  /** Did a script throw during this run? MEASURED literal signal (this
   * session, real Ghidra 12.1.3, a deliberately-thrown GhidraScript):
   * `ERROR REPORT SCRIPT ERROR:` (HeadlessAnalyzer). Matched as an EXACT
   * literal substring, never a looser "contains ERROR" test, which would
   * false-fire on any unrelated ERROR line. */
  scriptThrew: boolean;
  /** The `Using Language/Compiler:` token, or a named absence when the
   * line itself is missing from the run log. */
  language: { present: true; id: string } | { present: false };
  /** PROVISIONAL (see header): the classification expectation and observed
   * count the export script (plan 36-03's `GhidraStructExport.java`)
   * prints on their own labelled lines. Absent until that script's real
   * output format is measured; this generic extraction may not match it. */
  classification: { present: true; expected: number; observed: number } | { present: false };
}

/** The exact literal signal for a thrown script, MEASURED this session
 * against real Ghidra 12.1.3 (see this module's own header). Matched by
 * exact substring, never a looser pattern. */
const SCRIPT_THREW_LITERAL = "ERROR REPORT SCRIPT ERROR:";

/** The run log's own `Using Language/Compiler:` line, as emitted by
 * `analyzeHeadless`'s `ProgramLoader` (MEASURED, real Ghidra 12.1.3):
 * `INFO  Using Language/Compiler: 6502:LE:16:nmos:default (ProgramLoader)`.
 * Captures the language id up to (but not including) the compiler-spec
 * suffix (`:default`) that always follows it on this line. */
const LANGUAGE_LINE_PATTERN = /Using Language\/Compiler:\s*([^\s:]+(?::[^\s:]+)*?):[A-Za-z0-9_]+\s/;

/** A generic, best-effort labelled-number extraction for the classification
 * question (see this module's own header on why this is PROVISIONAL). */
const CLASSIFICATION_EXPECTED_PATTERN = /expected[^0-9\n]{0,40}?(\d+)/i;
const CLASSIFICATION_OBSERVED_PATTERN = /observed[^0-9\n]{0,40}?(\d+)/i;

/** THE ONE PLACE run-log text is classified. Pure string logic -- no
 * filesystem access, no child process, no Ghidra installation required.
 * Plan 36-03 imports this function over its own captured log fixtures
 * without modifying this file. */
export function classifyGhidraRunLog(logText: string): GhidraRunLogVerdict {
  const scriptThrew = logText.includes(SCRIPT_THREW_LITERAL);

  const languageMatch = LANGUAGE_LINE_PATTERN.exec(logText);
  const language: GhidraRunLogVerdict["language"] = languageMatch ? { present: true, id: languageMatch[1]! } : { present: false };

  const expectedMatch = CLASSIFICATION_EXPECTED_PATTERN.exec(logText);
  const observedMatch = CLASSIFICATION_OBSERVED_PATTERN.exec(logText);
  const classification: GhidraRunLogVerdict["classification"] =
    expectedMatch && observedMatch
      ? { present: true, expected: Number(expectedMatch[1]), observed: Number(observedMatch[1]) }
      : { present: false };

  return { scriptThrew, language, classification };
}

/**
 * Runs `ghidra.analyze` end to end: calls the host-tool seam, reads the
 * downloaded run log AS GIVEN, classifies it, and REFUSES
 * (throws) when the parsed language id differs from the requested
 * `processor` by even a single byte -- byte-exact, case-sensitive, never
 * case-folded.
 *
 * @throws {Error} when the seam refuses the request, when the run log
 *   carries no `Using Language/Compiler:` line at all, or when the parsed
 *   language id does not byte-exactly match the requested `processor`.
 */
export async function runGhidraAnalyze(args: GhidraRunArgs, opts: GhidraRunOptions = {}): Promise<GhidraRunResult> {
  const run = opts.run ?? runHostToolOverEndpoint;

  const wireArgs: Record<string, unknown> = { runId: args.runId, importPath: args.importPath, processor: args.processor };
  if (args.preScript !== undefined) wireArgs.preScript = args.preScript;
  if (args.postScript !== undefined) wireArgs.postScript = args.postScript;
  // Plan 36-02's own fields -- included ONLY when the caller supplies them,
  // so a caller of this module today (before that plan lands) never sends
  // a key host-tool.mts does not yet accept.
  if (args.importRoute !== undefined) wireArgs.importRoute = args.importRoute;
  if (args.loaderBaseAddr !== undefined) wireArgs.loaderBaseAddr = args.loaderBaseAddr;
  if (args.noanalysis !== undefined) wireArgs.noanalysis = args.noanalysis;
  if (args.scriptPath !== undefined) wireArgs.scriptPath = args.scriptPath;
  if (args.entrypointsPath !== undefined) wireArgs.entrypointsPath = args.entrypointsPath;
  if (args.exportPath !== undefined) wireArgs.exportPath = args.exportPath;
  if (args.expectedClassificationLines !== undefined) wireArgs.expectedClassificationLines = args.expectedClassificationLines;
  if (args.dataRangesPath !== undefined) wireArgs.dataRangesPath = args.dataRangesPath;

  const root = opts.repoRoot ?? findRepoRoot({ from: HERE });
  const runOpts: RunHostToolOverEndpointOptions = { baseDir: root, toolsRoot: opts.toolsRoot ?? ensureLocalDir(toolsDirUnder(root)) };
  if (opts.port !== undefined) runOpts.port = opts.port;

  const response = await run("ghidra.analyze", wireArgs, runOpts);
  if (!response.ok) {
    throw new Error(`runGhidraAnalyze: ghidra.analyze refused: ${response.message}`);
  }
  const runLogResult = response.results[0];
  if (runLogResult === undefined) {
    throw new Error("runGhidraAnalyze: ghidra.analyze reported no run-log output");
  }

  // Read at the path the response returns, AS GIVEN -- a local download.
  const text = opts.runLogText ?? readFileSync(resolvePath(runLogResult.path), "utf8");
  const verdict = classifyGhidraRunLog(text);

  if (verdict.scriptThrew) {
    throw new Error(
      `runGhidraAnalyze: a script threw during this run (run log at ${runLogResult.path} carries ` +
        `"ERROR REPORT SCRIPT ERROR:") -- analyzeHeadless's own exit status (${response.exitStatus}) ` +
        `carries no information about this and must never be read as success`,
    );
  }
  if (!verdict.language.present) {
    throw new Error(
      `runGhidraAnalyze: the run log at ${runLogResult.path} carries no "Using Language/Compiler:" line -- cannot verify the requested processor "${args.processor}" was actually used`,
    );
  }
  if (verdict.language.id !== args.processor) {
    throw new Error(
      `runGhidraAnalyze: language mismatch -- requested processor "${args.processor}" but the run log's own "Using Language/Compiler:" line names "${verdict.language.id}" (byte-exact, case-sensitive comparison)`,
    );
  }

  const exportResult = args.exportPath !== undefined ? response.results[1] : undefined;
  if (args.exportPath !== undefined && exportResult === undefined) {
    throw new Error(`runGhidraAnalyze: ghidra.analyze reported no export output for exportPath ${JSON.stringify(args.exportPath)}`);
  }
  return {
    runLogPath: runLogResult.path,
    sha256: runLogResult.sha256,
    byteLength: runLogResult.byteLength,
    ...(exportResult !== undefined ? { exportPath: exportResult.path } : {}),
    exitStatus: response.exitStatus,
    language: verdict.language,
  };
}

// ---------------------------------------------------------------------------
// CLI. The c64-disassembler skill locates this file with resolveMcpModule()
// and spawns it with `process.execPath` -- the skill never imports it. The
// last (and only) stdout line is `{ "ok": true, ... }` or
// `{ "ok": false, "message": "..." }`; the exit code is 0 or 1 to match.
// ---------------------------------------------------------------------------

/** What the CLI prints: runGhidraAnalyze()'s result with the language
 * flattened to its id, or a refusal. */
export type GhidraCliResult =
  | ({ ok: true; language: string } & Omit<GhidraRunResult, "language">)
  | { ok: false; message: string };

export const GHIDRA_CLI_USAGE =
  "usage: node ghidra-run.ts --run-id ID --import-path FILE --processor LANG-ID --import-route prg|flat64k\n" +
  "  [--loader-base-addr 0xNNNN] [--noanalysis] [--script-path DIR] [--pre-script FILE] [--post-script FILE]\n" +
  "  [--entrypoints-path FILE] [--export-path NAME] [--expected-classification-lines N] [--data-ranges-path FILE]\n" +
  "  [--project-root DIR] [--tools-root DIR] [--port N]";

/** Parses the CLI flags into runGhidraAnalyze()'s two arguments. Relative
 * input paths resolve against `cwd`; `--export-path` is an output NAME
 * (only its basename rides the wire), so it is passed as given. */
export function parseGhidraCli(argv: string[], cwd: string = process.cwd()): { ok: true; args: GhidraRunArgs; opts: GhidraRunOptions } | { ok: false; message: string } {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        "run-id": { type: "string" },
        "import-path": { type: "string" },
        processor: { type: "string" },
        "import-route": { type: "string" },
        "loader-base-addr": { type: "string" },
        noanalysis: { type: "boolean" },
        "script-path": { type: "string" },
        "pre-script": { type: "string" },
        "post-script": { type: "string" },
        "entrypoints-path": { type: "string" },
        "export-path": { type: "string" },
        "expected-classification-lines": { type: "string" },
        "data-ranges-path": { type: "string" },
        "project-root": { type: "string" },
        "tools-root": { type: "string" },
        port: { type: "string" },
      },
    }));
  } catch (e) {
    return { ok: false, message: `ghidra-run: ${(e as Error).message}\n${GHIDRA_CLI_USAGE}` };
  }

  for (const required of ["run-id", "import-path", "processor", "import-route"] as const) {
    if (values[required] === undefined || values[required] === "") {
      return { ok: false, message: `ghidra-run: --${required} is required and has no default\n${GHIDRA_CLI_USAGE}` };
    }
  }
  const route = values["import-route"];
  if (route !== "prg" && route !== "flat64k") {
    return { ok: false, message: `ghidra-run: --import-route must be "prg" or "flat64k"; got ${JSON.stringify(route)}` };
  }

  const abs = (p: string | undefined): string | undefined => (p === undefined ? undefined : resolvePath(cwd, p));
  const args: GhidraRunArgs = {
    runId: values["run-id"]!,
    importPath: abs(values["import-path"])!,
    processor: values.processor!,
    importRoute: route,
  };
  if (values["loader-base-addr"] !== undefined) args.loaderBaseAddr = values["loader-base-addr"];
  if (values.noanalysis === true) args.noanalysis = true;
  if (values["script-path"] !== undefined) args.scriptPath = abs(values["script-path"]);
  if (values["pre-script"] !== undefined) args.preScript = abs(values["pre-script"]);
  if (values["post-script"] !== undefined) args.postScript = abs(values["post-script"]);
  if (values["entrypoints-path"] !== undefined) args.entrypointsPath = abs(values["entrypoints-path"]);
  if (values["export-path"] !== undefined) args.exportPath = values["export-path"];
  if (values["data-ranges-path"] !== undefined) args.dataRangesPath = abs(values["data-ranges-path"]);
  const lines = values["expected-classification-lines"];
  if (lines !== undefined) {
    if (!/^\d+$/.test(lines)) {
      return { ok: false, message: `ghidra-run: --expected-classification-lines must be a non-negative integer; got ${JSON.stringify(lines)}` };
    }
    args.expectedClassificationLines = Number(lines);
  }

  const opts: GhidraRunOptions = {};
  if (values["project-root"] !== undefined) opts.repoRoot = abs(values["project-root"]);
  if (values["tools-root"] !== undefined) opts.toolsRoot = abs(values["tools-root"]);
  if (values.port !== undefined) {
    if (!/^\d+$/.test(values.port)) return { ok: false, message: `ghidra-run: --port must be an integer; got ${JSON.stringify(values.port)}` };
    opts.port = Number(values.port);
  }
  return { ok: true, args, opts };
}

/** The whole CLI as a function: parse, run, and turn every throw into a
 * refusal. `seams` carries the test seams of GhidraRunOptions (`run`,
 * `runLogText`) so a test drives this with no broker. Never rejects. */
export async function runGhidraCli(argv: string[], seams: Pick<GhidraRunOptions, "run" | "runLogText"> = {}, cwd: string = process.cwd()): Promise<GhidraCliResult> {
  const parsed = parseGhidraCli(argv, cwd);
  if (!parsed.ok) return parsed;
  try {
    const { language, ...rest } = await runGhidraAnalyze(parsed.args, { ...parsed.opts, ...seams });
    // runGhidraAnalyze() refuses a run log with no language line, so a
    // returned result always carries one.
    return { ok: true, ...rest, language: language.present ? language.id : "" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runGhidraCli(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.ok ? 0 : 1;
}
