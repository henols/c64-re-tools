// The ACME adapter (16 §8): argv from the typed request only, structured
// diagnostics and symbols, and a validated C64 PRG as the result.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

import { WireFailure } from "../protocol.ts";
import type { AcmeParams, AcmeResult, AssembledSymbol, Diagnostic } from "./types.ts";
import type { ProcessSupervisor } from "./processes.ts";
import { Workspace } from "./staging.ts";
import { ACME, findTool } from "./discover.ts";
import { runTool } from "./run.ts";

const PROGRAM = "program.prg";
const SYMBOLS = "symbols.txt";
const TIMEOUT_MS = 60_000;

/** The argv for one assembly; every value comes from the validated request. */
export function acmeArguments(executable: string, params: AcmeParams, outputDirectory: string): string[] {
  const argv = [executable, "--format", "cbm", "--cpu", "6510", "--maxerrors", "100", "-o", join(outputDirectory, PROGRAM), "--symbollist", join(outputDirectory, SYMBOLS)];
  for (const directory of params.includeDirs) argv.push("-I", directory);
  for (const [name, value] of Object.entries(params.defines)) argv.push(`-D${name}=${typeof value === "boolean" ? (value ? 1 : 0) : value}`);
  if (params.setPc !== undefined) argv.push("--setpc", String(params.setPc));
  argv.push(params.entrySource);
  return argv;
}

const DIAGNOSTIC = /^(Error|Warning|Serious error) - File (.+?), line (\d+)(?: \(.*?\))?: (.*)$/;

/** Parses ACME's "Error - File main.a, line 4 (Zone ...): message" lines. Files become source-root relative. */
export function parseDiagnostics(output: string, sourceRoot: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(line.trim());
    if (match !== null) {
      let file = match[2]!;
      if (isAbsolute(file)) {
        const inside = relative(sourceRoot, file);
        file = inside.startsWith("..") || isAbsolute(inside) ? "(outside the source root)" : inside.split(sep).join("/");
      }
      diagnostics.push({ severity: match[1] === "Warning" ? "warning" : "error", file, line: Number(match[3]), message: match[4]! });
    } else if (/^(Error|Serious error|Warning)\b/.test(line.trim())) {
      diagnostics.push({ severity: line.trim().startsWith("Warning") ? "warning" : "error", message: line.trim() });
    }
  }
  return diagnostics;
}

/**
 * Parses ACME's symbol list ("\tname\t= $2100\t; unused"). A value inside the
 * assembled program is an address; any other value is a constant.
 */
export function parseSymbols(list: string, program: { start: number; end: number }): AssembledSymbol[] {
  const symbols: AssembledSymbol[] = [];
  for (const line of list.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][\w.]*)\s*=\s*\$([0-9a-fA-F]+)\s*(?:;\s*(.*?))?\s*$/.exec(line);
    if (match === null) continue;
    const value = Number.parseInt(match[2]!, 16);
    symbols.push({
      name: match[1]!,
      kind: value >= program.start && value <= program.end ? "address" : "constant",
      value,
      used: match[3] !== "unused",
    });
  }
  // Code-point order: the same on every host, whatever its locale.
  return symbols.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function assemble(
  params: AcmeParams,
  files: Buffer[],
  context: { supervisor: ProcessSupervisor; signal: AbortSignal; env?: NodeJS.ProcessEnv; log?: (line: string) => void },
): Promise<{ result: AcmeResult; attachments?: Buffer[] }> {
  const executable = findTool(ACME, context.env);
  const workspace = Workspace.create(context.supervisor);
  try {
    const source = workspace.materialize("source", params.files, files);
    // A fresh output directory, so no stale file can pass for this run's output.
    const output = workspace.directory("out");
    const run = await runTool({
      argv: acmeArguments(executable, params, output),
      cwd: source,
      supervisor: context.supervisor,
      signal: context.signal,
      timeoutMs: TIMEOUT_MS,
      ...(context.env === undefined ? {} : { env: context.env }),
    });
    if (run.aborted) throw new WireFailure("operation-failed", "The assembly was cancelled.");
    if (run.timedOut) throw new WireFailure("operation-failed", `ACME did not finish within ${TIMEOUT_MS / 1000} seconds.`);
    const diagnostics = parseDiagnostics(`${run.stdout}\n${run.stderr}`, source);
    const programPath = join(output, PROGRAM);
    if (run.code !== 0) {
      if (diagnostics.every((diagnostic) => diagnostic.severity !== "error")) {
        context.log?.(`ACME exited ${run.code} without a parsed error:\n${run.stdout}\n${run.stderr}`);
        diagnostics.push({ severity: "error", message: "ACME stopped with an error it did not describe." });
      }
      return { result: { assembled: false, diagnostics } };
    }
    if (!existsSync(programPath)) throw new WireFailure("operation-failed", "ACME reported success but wrote no program.");
    const program = readFileSync(programPath);
    if (program.length < 3) throw new WireFailure("operation-failed", "ACME wrote a program without bytes.");
    const start = program.readUInt16LE(0);
    const bytes = program.length - 2;
    if (start + bytes > 0x10000) throw new WireFailure("operation-failed", "ACME wrote a program that runs past $ffff.");
    const end = start + bytes - 1;
    const symbolList = existsSync(join(output, SYMBOLS)) ? readFileSync(join(output, SYMBOLS), "latin1") : "";
    return {
      result: { assembled: true, loadRange: { start, end, bytes }, symbols: parseSymbols(symbolList, { start, end }), diagnostics },
      attachments: [program],
    };
  } finally {
    workspace.remove();
  }
}
