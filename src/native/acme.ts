// The ACME adapter: argv from the typed request only, structured
// diagnostics and symbols, and a validated C64 PRG as the result.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, posix, relative, sep } from "node:path";

import { formatC64Address } from "../c64.ts";
import { WireFailure } from "../protocol/messages.ts";
import { isRelativePath } from "../protocol/tools.ts";
import type { AcmeParams, AcmeResult, AssembledSymbol, Diagnostic } from "./types.ts";
import { Workspace } from "./staging.ts";
import { ACME, findTool } from "./discover.ts";
import { outputTail, runToolOrFail, type ToolContext } from "./run.ts";

/** A symbol of a build as a person and c64-testing read it: an address as $ and four hex digits, a constant as $ and at least four hex digits. */
export function showSymbol(symbol: AssembledSymbol) {
  return symbol.kind === "address"
    ? { name: symbol.name, kind: "address", address: formatC64Address(symbol.address), used: symbol.used }
    : { name: symbol.name, kind: "constant", value: `$${symbol.value.toString(16).padStart(4, "0")}`, used: symbol.used };
}

/** The text of a symbols file (symbols/<build>.json next to the program): the symbols of a build, which c64-testing reads for the names of a program. */
export const symbolsFileText = (symbols: readonly AssembledSymbol[]) => `${JSON.stringify({ symbols: symbols.map(showSymbol) }, null, 1)}\n`;

const PROGRAM = "program.prg";
const SYMBOLS = "symbols.txt";
const TIMEOUT_MS = 60_000;

/** True for a relative path that stays inside the source root: no absolute path, no drive letter and no "..". */
const insideSourceRoot = (path: string) => isRelativePath(path) && !/^[A-Za-z]:/.test(path);

/** The path of a staged file or directory from the top of the staged tree, for a path relative to the source root. Can start with "..". */
const fromTree = (sourceDir: string, path: string) => posix.normalize(posix.join(sourceDir, path));

/** The path from the source root to a path from the top of the staged tree. */
const fromSourceRoot = (sourceDir: string, path: string) => posix.relative(`/${sourceDir}`, `/${path}`);

/**
 * True for an include directory that stays inside the staged tree: a relative
 * path of names, "." and "..", with no drive letter and no backslash, that
 * does not go above the top of the tree from the source root.
 */
function insideTree(sourceDir: string, path: string): boolean {
  if (!path.split("/").every((part) => part === "." || part === ".." || isRelativePath(part)) || /^[A-Za-z]:/.test(path)) return false;
  const inside = fromTree(sourceDir, path);
  return inside !== ".." && !inside.startsWith("../") && !posix.isAbsolute(inside);
}

/** Refuses an entry source or include directory that ACME could read outside the staged tree, by name. */
export function checkAcmeParams(params: AcmeParams): void {
  const sourceDir = params.sourceDir ?? "";
  if (sourceDir !== "" && !insideSourceRoot(sourceDir)) throw new WireFailure("invalid-input", `The source directory ${sourceDir} is not a relative path inside the staged tree.`);
  if (!insideSourceRoot(params.entrySource)) throw new WireFailure("invalid-input", `The entry source ${params.entrySource} is not a relative path inside the source root.`);
  if (params.entrySource.startsWith("-")) throw new WireFailure("invalid-input", `The entry source ${params.entrySource} starts with a hyphen, which ACME reads as an option. Give the file a different name.`);
  for (const directory of params.includeDirs) {
    if (!insideTree(sourceDir, directory)) throw new WireFailure("invalid-input", `The include directory ${directory} is not a relative path inside the staged source files.`);
  }
}

/** The argv for one assembly; every value comes from the request that checkAcmeParams accepted. */
export function acmeArguments(executable: string, params: AcmeParams, outputDirectory: string): string[] {
  const argv = [executable, "--format", "cbm", "--cpu", "6510", "--maxerrors", "100", "-o", join(outputDirectory, PROGRAM), "--symbollist", join(outputDirectory, SYMBOLS)];
  for (const directory of params.includeDirs) argv.push("-I", directory);
  for (const [name, value] of Object.entries(params.defines)) argv.push(`-D${name}=${typeof value === "boolean" ? (value ? 1 : 0) : value}`);
  if (params.setPc !== undefined) argv.push("--setpc", String(params.setPc));
  argv.push(params.entrySource);
  return argv;
}

const DIAGNOSTIC = /^(Error|Warning|Serious error) - File (.+?), line (\d+)(?: \(.*?\))?: (.*)$/;

/**
 * Parses ACME's "Error - File main.a, line 4 (Zone ...): message" lines. Files
 * become source-root relative: an absolute path through `tree`, the top of
 * the staged tree, and a name that ACME found in an include directory
 * through the staged files, in the order that ACME searches them.
 */
export function parseDiagnostics(output: string, tree: string, params: Pick<AcmeParams, "files" | "includeDirs" | "sourceDir"> = { files: [], includeDirs: [] }): Diagnostic[] {
  const sourceDir = params.sourceDir ?? "";
  const staged = new Set(params.files.map((file) => file.path));
  const sourcePath = (file: string): string => {
    if (isAbsolute(file)) {
      const inside = relative(tree, file);
      return inside.startsWith("..") || isAbsolute(inside) ? "(outside the source files)" : fromSourceRoot(sourceDir, inside.split(sep).join("/"));
    }
    if (staged.has(fromTree(sourceDir, file))) return file;
    const directory = params.includeDirs.find((candidate) => staged.has(fromTree(sourceDir, posix.join(candidate, file))));
    return directory === undefined ? file : fromSourceRoot(sourceDir, fromTree(sourceDir, posix.join(directory, file)));
  };
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(line.trim());
    if (match !== null) {
      const file = sourcePath(match[2]!);
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
    const name = match[1]!;
    const value = Number.parseInt(match[2]!, 16);
    const used = match[3] !== "unused";
    symbols.push(value >= program.start && value <= program.end ? { name, kind: "address", address: value, used } : { name, kind: "constant", value, used });
  }
  // Code-point order: the same on every host, whatever its locale.
  return symbols.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export async function assemble(
  params: AcmeParams,
  files: Buffer[],
  context: ToolContext,
): Promise<{ result: AcmeResult; attachments?: Buffer[] }> {
  checkAcmeParams(params);
  const executable = findTool(ACME, context.env);
  const workspace = Workspace.create(context.supervisor);
  try {
    const tree = workspace.materialize("source", params.files, files);
    // ACME runs in the source root, which can be a folder of the staged tree.
    const source = params.sourceDir === undefined || params.sourceDir === "" ? tree : workspace.path(`source/${params.sourceDir}`);
    // A fresh output directory, so no stale file can pass for this run's output.
    const output = workspace.directory("out");
    const run = await runToolOrFail("ACME", "The assembly", { argv: acmeArguments(executable, params, output), cwd: source, timeoutMs: TIMEOUT_MS }, context);
    const diagnostics = parseDiagnostics(`${run.stdout}\n${run.stderr}`, tree, params);
    const programPath = join(output, PROGRAM);
    if (run.code !== 0) {
      if (diagnostics.every((diagnostic) => diagnostic.severity !== "error")) {
        context.log?.(`ACME exited ${run.code} without a parsed error:\n${run.stdout}\n${run.stderr}`);
        diagnostics.push({ severity: "error", message: `ACME stopped with exit code ${run.code} and gave no error in its usual form.${outputTail("ACME", run, workspace.root)}` });
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
