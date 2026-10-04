// Tool status: finds each native tool the way its operations do and runs it
// once with a version option, so a user can see in advance which tools work.
// The Host Runtime reports VICE and its tools (host.status); the CLI reports
// the tools that skill scripts run themselves (ACME, DXA, Ghidra).

import { tmpdir } from "node:os";
import { stripVTControlCharacters } from "node:util";

import { WireFailure, type ToolStatus } from "../protocol.ts";
import { ACME, DXA, findTool } from "./discover.ts";
import { findGhidra } from "./ghidra/index.ts";
import { runTool, type ToolContext } from "./run.ts";
import { Workspace } from "./staging.ts";

const PROBE_TIMEOUT_MS = 20_000;

export interface Probe {
  name: string;
  /** The executable; throws WireFailure(installation-incomplete) when missing. */
  find: (env: NodeJS.ProcessEnv) => string;
  args: string[];
  /** The version line; no such line means the tool did not run correctly. */
  pattern: RegExp;
}


/** The first output line that matches, without terminal color codes (c1541 colors an OpenCBM notice). */
/** dxa's version line, also as "D:\\tools\\dxa.exe v0.1.5 -- symbolic 65xx disassembler" on Windows. */
export const DXA_VERSION = /^(?:.*[\\/])?dxa(?:\.exe)? v\d/i;

export function versionLine(output: string, pattern: RegExp): string | undefined {
  return stripVTControlCharacters(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => pattern.test(line));
}

async function run(name: string, argv: string[], version: (output: string) => string | undefined, context: ToolContext): Promise<ToolStatus> {
  const result = await runTool({ argv, cwd: tmpdir(), supervisor: context.supervisor, signal: context.signal, timeoutMs: PROBE_TIMEOUT_MS, env: context.env });
  const found = version(`${result.stdout}\n${result.stderr}`);
  if (found !== undefined) return { name, found: true, path: argv[0]!, version: found, runs: true };
  return { name, found: true, path: argv[0]!, runs: false, problem: result.timedOut ? "It did not answer in time." : `It did not run correctly (exit ${result.code ?? result.signal}).` };
}

function missing(name: string, error: unknown): ToolStatus {
  if (!(error instanceof WireFailure)) throw error;
  return { name, found: false, runs: false, problem: error.message };
}

/** Finds and runs each probed tool once. */
export function probeTools(probes: Probe[], context: ToolContext): Promise<ToolStatus[]> {
  const env = context.env ?? process.env;
  return Promise.all(
    probes.map(async (probe) => {
      let path: string;
      try {
        path = probe.find(env);
      } catch (error) {
        return missing(probe.name, error);
      }
      return run(probe.name, [path, ...probe.args], (output) => versionLine(output, probe.pattern), context);
    }),
  );
}

/** Ghidra: without arguments analyzeHeadless starts Java and prints its usage, which proves that it runs. */
export async function probeGhidra(context: ToolContext): Promise<ToolStatus> {
  const env = context.env ?? process.env;
  try {
    const ghidra = findGhidra(env);
    // Its own settings directory keeps the user's Ghidra settings and logs untouched.
    const workspace = Workspace.create(context.supervisor, "c64-re-tools-ghidra-status-");
    const settings = workspace.root;
    try {
      const status = await run(
        "Ghidra",
        [ghidra.analyzeHeadless],
        (output) => (/Headless Analyzer Usage/.test(output) ? `Ghidra ${ghidra.version}` : undefined),
        { ...context, env: { ...env, XDG_CONFIG_HOME: settings, XDG_CACHE_HOME: settings } },
      );
      return { ...status, path: ghidra.root };
    } finally {
      workspace.remove();
    }
  } catch (error) {
    return missing("Ghidra", error);
  }
}

/** The tools that skill scripts run themselves, on this machine. */
export async function localToolStatus(context: ToolContext): Promise<ToolStatus[]> {
  const probes: Probe[] = [
    { name: "ACME", find: (env) => findTool(ACME, env), args: ["--version"], pattern: /^This is ACME, release / },
    // dxa -V prints its version and exits with status 1. It names itself by argv[0], without the
    // directory only where that uses "/": on Windows the line starts with the full path (found in CI).
    { name: "dxa", find: (env) => findTool(DXA, env), args: ["-V"], pattern: DXA_VERSION },
  ];
  return [...(await probeTools(probes, context)), await probeGhidra(context)];
}
