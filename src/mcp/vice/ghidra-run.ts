#!/usr/bin/env node
// ghidra-run.ts
//
// Phase 36, plan 36-01 (OPC-04): CONTAINER-SIDE orchestration ONLY for the
// `ghidra.analyze` host tool. Mirrors dxa-run.ts field-for-field: reaches
// Ghidra through `runHostToolFromContainer("ghidra.analyze", …)`
// (host-tool-client.ts) and NEVER `node:child_process` -- a direct spawn
// here would bypass the one host-tool execution seam this project's own
// architecture constraint requires every runtime path to cross.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` (mirrors dxa-run.ts's own
// stated rule for itself, and host-tool-client.ts's rule for ITSELF). The
// run log's path has ALREADY been translated through `containerPath()` by
// `runHostToolFromContainer()` (host-tool-client.ts's own
// `translateHostToolResponse()`) before this module ever sees it on the
// container route; on the host route the two coordinate systems are the
// same filesystem, so no translation is needed there either. This module
// therefore reads the run log at the path the response returns AS GIVEN --
// it never calls `hostPath()` (the wrong direction entirely) and never
// needs to call `containerPath()` a second time.
//
// Phase 36, plan 36-01 (D-36-05): `HostToolClientResult` carries `results[]`
// and `stderrTail` and NO stdout field at all, so the run log is
// structurally unreachable from the container side any other way --
// `results[0]` IS the run log, always, for `ghidra.analyze` (the same
// output-slot invariant `buildHostToolArgv()`'s ghidra branch documents,
// host-tool.mts).
//
// The run-log CLASSIFIER (`classifyGhidraRunLog()`) lives in THIS module,
// not a sibling one, because plan 36-03 imports it and must not modify this
// file -- the two plans run in the same wave (36-02 also edits this
// module's sibling, host-tool.mts). It answers three questions over run-log
// TEXT and takes NO exit status in its signature, because MEASURED this
// session against real Ghidra 12.1.3: a run whose post-script THROWS still
// exits 0 -- `analyzeHeadless`'s own exit status carries no information
// about whether a script inside the run succeeded. The three questions:
//
//   1. Did a script throw? The exact literal signal, and ONLY that literal
//      -- MEASURED this session: a thrown script's own log line reads
//      `ERROR REPORT SCRIPT ERROR:` (HeadlessAnalyzer). A naive substring
//      search for "ERROR" alone would false-fire on ANY log carrying an
//      unrelated ERROR line (e.g. a benign stock-warning-adjacent line);
//      this classifier matches the exact literal only.
//   2. Which language did the run use? The `Using Language/Compiler:`
//      token, reported as a NAMED ABSENCE when the line is missing --
//      never an empty-string match, which would be indistinguishable from
//      a language id that happened to be the empty string.
//   3. What did the run report for the classification expectation and the
//      observed count? PROVISIONAL: the export script that prints these
//      two labelled numbers (`GhidraStructExport.java`) does not exist
//      until plan 36-03, so this question's parser is a best-effort,
//      generic labelled-number extraction over "expected"/"observed" text,
//      seeded here so plan 36-03 can import a complete shape without
//      touching this file. Per that plan's own instruction: if the
//      classifier as landed cannot answer this question against the real
//      export format, that plan records it as a finding rather than
//      editing this file.
//
// `runGhidraAnalyze()` reads the run log at `results[0].path` AS GIVEN,
// parses the language id out of its own `Using Language/Compiler:` line via
// this same classifier, and REFUSES (throws, naming both sides) when that
// parsed id differs from the `processor` the caller asked for by even a
// single byte -- a BYTE-EXACT, CASE-SENSITIVE comparison, never case-folded
// (must_haves.truths, 36-01-PLAN.md). This is the criterion-1 check: a run
// that silently used a different language than the one requested must
// never be readable as success.
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { runHostToolFromContainer, type HostToolClientResult, type RunHostToolFromContainerOptions } from "./host-tool-client.ts";

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
}

/** The function shape `runHostToolFromContainer()` itself has -- named here
 * so `GhidraRunOptions.run` below can be typed without importing a value
 * this module does not otherwise need. Mirrors `DxaRunFn` (dxa-run.ts). */
export type GhidraRunFn = (tool: string, args: Record<string, unknown>, opts: RunHostToolFromContainerOptions) => Promise<HostToolClientResult>;

export interface GhidraRunOptions {
  /** Test seam, mirroring `DxaRunOptions.run` (dxa-run.ts): an injectable
   * runner, defaulting to `runHostToolFromContainer()`. Lets a hermetic
   * test drive this module with no host process at all. */
  run?: GhidraRunFn;
  /** Passed straight through to the (injected or default) runner's own
   * `dir`/`repoRoot` options. */
  dir?: string;
  repoRoot?: string;
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
 * resulting run log AS GIVEN (already container-translated where
 * applicable -- see this module's own header), classifies it, and REFUSES
 * (throws) when the parsed language id differs from the requested
 * `processor` by even a single byte -- byte-exact, case-sensitive, never
 * case-folded.
 *
 * @throws {Error} when the seam refuses the request, when the run log
 *   carries no `Using Language/Compiler:` line at all, or when the parsed
 *   language id does not byte-exactly match the requested `processor`.
 */
export async function runGhidraAnalyze(args: GhidraRunArgs, opts: GhidraRunOptions = {}): Promise<GhidraRunResult> {
  const run = opts.run ?? runHostToolFromContainer;

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

  const runOpts: RunHostToolFromContainerOptions = {};
  if (opts.dir !== undefined) runOpts.dir = opts.dir;
  if (opts.repoRoot !== undefined) runOpts.repoRoot = opts.repoRoot;

  const response = await run("ghidra.analyze", wireArgs, runOpts);
  if (!response.ok) {
    throw new Error(`runGhidraAnalyze: ghidra.analyze refused: ${response.message}`);
  }
  const runLogResult = response.results[0];
  if (runLogResult === undefined) {
    throw new Error("runGhidraAnalyze: ghidra.analyze reported no run-log output");
  }

  // Read at the path the response returns, AS GIVEN -- already
  // container-translated by runHostToolFromContainer() where applicable;
  // see this module's own header for why no second translation belongs
  // here.
  const text = opts.runLogText ?? readFileSync(resolvePath(runLogResult.path), "utf8");
  const verdict = classifyGhidraRunLog(text);

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

  return {
    runLogPath: runLogResult.path,
    sha256: runLogResult.sha256,
    byteLength: runLogResult.byteLength,
    exitStatus: response.exitStatus,
    language: verdict.language,
  };
}
