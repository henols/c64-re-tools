// host.status: finds each native tool the way its operations do, and runs it
// once with a version option, so a user can see in advance which tools work.
// It changes nothing and starts no emulator.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WireFailure, type ToolStatus } from "../../protocol.ts";
import type { ProcessSupervisor } from "../processes.ts";
import { findVice } from "../vice/process.ts";
import { ACME, C1541, DXA, findTool, PETCAT } from "./discover.ts";
import { findGhidra } from "./ghidra/index.ts";
import { runTool } from "./run.ts";

const PROBE_TIMEOUT_MS = 20_000;

interface Probe {
  name: string;
  /** The executable; throws WireFailure(installation-incomplete) when missing. */
  find: (env: NodeJS.ProcessEnv) => string;
  args: string[];
  /** The version line; no such line means the tool did not run correctly. */
  pattern: RegExp;
}

/** The first output line that matches, without terminal color codes (c1541 colors an OpenCBM notice). */
export function versionLine(output: string, pattern: RegExp): string | undefined {
  return output
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => pattern.test(line));
}

const PROBES: Probe[] = [
  { name: "VICE (x64sc)", find: findVice, args: ["-version"], pattern: /^x64sc \(VICE \d/ },
  { name: "ACME", find: (env) => findTool(ACME, env), args: ["--version"], pattern: /^This is ACME, release / },
  // dxa -V prints its version and exits with status 1.
  { name: "dxa", find: (env) => findTool(DXA, env), args: ["-V"], pattern: /^dxa v\d/ },
  { name: "c1541", find: (env) => findTool(C1541, env), args: ["-version"], pattern: /^c1541 \(VICE \d/ },
  { name: "petcat", find: (env) => findTool(PETCAT, env), args: ["-version"], pattern: /^petcat \(VICE \d/ },
];

async function probe(name: string, argv: string[], version: (output: string) => string | undefined, context: Context): Promise<ToolStatus> {
  const run = await runTool({
    argv,
    cwd: tmpdir(),
    supervisor: context.supervisor,
    signal: context.signal,
    timeoutMs: PROBE_TIMEOUT_MS,
    ...(context.env === undefined ? {} : { env: context.env }),
  });
  const found = version(`${run.stdout}\n${run.stderr}`);
  if (found !== undefined) return { name, found: true, path: argv[0]!, version: found, runs: true };
  return { name, found: true, path: argv[0]!, runs: false, problem: run.timedOut ? "It did not answer in time." : `It did not run correctly (exit ${run.code ?? run.signal}).` };
}

interface Context {
  supervisor: ProcessSupervisor;
  signal: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

function missing(name: string, error: unknown): ToolStatus {
  if (!(error instanceof WireFailure)) throw error;
  return { name, found: false, runs: false, problem: error.message };
}

export async function hostStatus(context: Context): Promise<{ result: { tools: ToolStatus[] } }> {
  const env = context.env ?? process.env;
  const tools = await Promise.all([
    ...PROBES.map(async (entry) => {
      let path: string;
      try {
        path = entry.find(env);
      } catch (error) {
        return missing(entry.name, error);
      }
      return probe(entry.name, [path, ...entry.args], (output) => versionLine(output, entry.pattern), context);
    }),
    (async () => {
      try {
        const ghidra = findGhidra(env);
        // Without arguments analyzeHeadless starts Java and prints its usage: proof that it runs.
        // Its own settings directory keeps the user's Ghidra settings and logs untouched.
        const settings = mkdtempSync(join(tmpdir(), "c64-re-tools-ghidra-status-"));
        try {
          const status = await probe(
            "Ghidra",
            [ghidra.analyzeHeadless],
            (output) => (/Headless Analyzer Usage/.test(output) ? `Ghidra ${ghidra.version}` : undefined),
            { ...context, env: { ...env, XDG_CONFIG_HOME: settings, XDG_CACHE_HOME: settings } },
          );
          return { ...status, path: ghidra.root };
        } finally {
          rmSync(settings, { recursive: true, force: true });
        }
      } catch (error) {
        return missing("Ghidra", error);
      }
    })(),
  ]);
  return { result: { tools } };
}
