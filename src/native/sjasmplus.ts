// The sjasmplus adapter: argv from the typed request only, structured
// diagnostics and symbols, and the assembled bytes of a ZX Spectrum program.
//
// sjasmplus writes no file that holds both the bytes and their addresses, as a
// PRG does. The adapter builds the program into the memory of the device of
// the model: a wrapper source sets the device, fills the 64 KiB with a marker
// byte, includes the entry source and saves the 64 KiB. It assembles two times,
// with two markers: an address that holds the same byte in both is a byte of
// the program. So the entry source sets its addresses with ORG and has no
// DEVICE of its own: the adapter refuses a DEVICE line with a diagnostic.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { WireFailure } from "../protocol/messages.ts";
import { isRelativePath, type SourceTree } from "../protocol/tools.ts";
import type { AssembledSymbol, Diagnostic } from "./types.ts";
import { Workspace } from "./staging.ts";
import { findTool, SJASMPLUS } from "./discover.ts";
import { outputTail, runToolOrFail, type ToolContext } from "./run.ts";

export interface SjasmplusParams {
  files: SourceTree;
  /** Relative to the source root. */
  entrySource: string;
  /** Directories relative to the source root. */
  includeDirs: string[];
  defines: Record<string, number | boolean>;
  /** The device whose memory holds the program: the 48K, or the 128K with its paging at the reset. */
  model: "48k" | "128k";
}

export interface SjasmplusResult {
  assembled: boolean;
  /** Present when assembled: the address ranges that the program fills. The 64 KiB memory is the one attachment that assemble returns. */
  segments?: Array<{ start: number; end: number }>;
  bytes?: number;
  symbols?: AssembledSymbol[];
  diagnostics: Diagnostic[];
}

const TIMEOUT_MS = 60_000;
const MARKERS = [0xaa, 0x55] as const;

/** True for a relative path inside the source root: no absolute path, no drive letter, no "..", and no quote, which would end the INCLUDE string. */
const insideSourceRoot = (path: string) => isRelativePath(path) && !/^[A-Za-z]:/.test(path) && !path.includes('"');

/** Refuses an entry source or include directory that sjasmplus could read outside the source root, by name. */
export function checkSjasmplusParams(params: SjasmplusParams): void {
  if (!insideSourceRoot(params.entrySource)) throw new WireFailure("invalid-input", `The entry source ${params.entrySource} is not a relative path inside the source root.`);
  for (const directory of params.includeDirs) {
    if (!insideSourceRoot(directory) || directory.startsWith("-")) throw new WireFailure("invalid-input", `The include directory ${directory} is not a relative path inside the source root.`);
  }
  for (const name of Object.keys(params.defines)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new WireFailure("invalid-input", `The define ${name} is not a name: a letter or underscore, then letters, digits or underscores.`);
  }
}

/** The wrapper source of one run: the device, the marker in all 64 KiB, the entry source, and the save of the memory. */
export function wrapperSource(params: SjasmplusParams, marker: number, memory: string): string {
  return [
    `\tDEVICE ${params.model === "128k" ? "ZXSPECTRUM128" : "ZXSPECTRUM48"}`,
    "\tORG 0",
    `\tBLOCK 65536, ${marker}`,
    `\tINCLUDE "${params.entrySource}"`,
    `\tSAVEBIN "${memory.replaceAll("\\", "/")}", 0, 65536`,
    "",
  ].join("\n");
}

/** A DEVICE directive: after a label or indented, with or without its dot, in any letter case. */
const DEVICE_LINE = /^(?:[^\s;]+\s+|\s+)?\.?device(?:\s|$)/i;

/**
 * The DEVICE lines of the source files. The build sets the device of the model
 * and reads the program from its memory: another DEVICE gives the memory of
 * another device. A file with a NUL byte is binary data, not source.
 */
export function deviceDiagnostics(params: Pick<SjasmplusParams, "files">, contents: readonly Buffer[]): Diagnostic[] {
  const found: Diagnostic[] = [];
  params.files.forEach((file, index) => {
    const bytes = contents[index];
    if (bytes === undefined || bytes.includes(0)) return;
    bytes
      .toString("latin1")
      .split(/\r?\n/)
      .forEach((text, line) => {
        const code = text.replace(/;.*$|\/\/.*$/, "");
        if (DEVICE_LINE.test(code)) found.push({ severity: "error", file: file.path, line: line + 1, message: "The source must not set DEVICE: the build sets the device of the model (--model). Remove this line." });
      });
  });
  return found;
}

/** The argv for one run; every value comes from the request that checkSjasmplusParams accepted. */
export function sjasmplusArguments(executable: string, params: SjasmplusParams, wrapper: string, symbols: string): string[] {
  const argv = [executable, "--nologo", "--msg=war", `--sym=${symbols}`];
  for (const directory of params.includeDirs) argv.push(`--inc=${directory}`);
  for (const [name, value] of Object.entries(params.defines)) argv.push(`-D${name}=${typeof value === "boolean" ? (value ? 1 : 0) : value}`);
  argv.push(wrapper);
  return argv;
}

const DIAGNOSTIC = /^(.+?)\((\d+)\): (error|warning)(?:\[[\w-]+\])?: (.*)$/;

/** Parses sjasmplus's "main.asm(4): error: message" lines. A line of the wrapper has no source location. */
export function parseSjasmplusDiagnostics(output: string, wrapper: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = DIAGNOSTIC.exec(line.trim());
    if (match === null) {
      if (/^(error|warning)\b/i.test(line.trim())) diagnostics.push({ severity: /^warning/i.test(line.trim()) ? "warning" : "error", message: line.trim() });
      continue;
    }
    const severity = match[3] === "warning" ? "warning" : "error";
    if (match[1] === wrapper) diagnostics.push({ severity, message: match[4]! });
    else diagnostics.push({ severity, file: match[1]!, line: Number(match[2]), message: match[4]! });
  }
  return diagnostics;
}

/** Parses the --sym file ("name: EQU 0x00008030"). A value in a segment of the program is an address; any other value is a constant. */
export function parseSjasmplusSymbols(list: string, segments: ReadonlyArray<{ start: number; end: number }>): AssembledSymbol[] {
  const symbols: AssembledSymbol[] = [];
  for (const line of list.split(/\r?\n/)) {
    const match = /^([A-Za-z_][\w.]*):\s+EQU\s+0x([0-9A-Fa-f]+)\s*$/.exec(line.trim());
    if (match === null) continue;
    const value = Number.parseInt(match[2]!, 16);
    const inside = segments.some((segment) => value >= segment.start && value <= segment.end);
    symbols.push(inside ? { name: match[1]!, kind: "address", address: value, used: true } : { name: match[1]!, kind: "constant", value, used: true });
  }
  return symbols.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The ranges of the addresses where both memories hold the same byte: the bytes of the program. */
export function filledSegments(first: Uint8Array, second: Uint8Array): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = [];
  for (let address = 0; address < 0x10000; address++) {
    if (first[address] !== second[address]) continue;
    const last = segments.at(-1);
    if (last !== undefined && last.end === address - 1) last.end = address;
    else segments.push({ start: address, end: address });
  }
  return segments;
}

export async function assemble(params: SjasmplusParams, files: Buffer[], context: ToolContext): Promise<{ result: SjasmplusResult; attachments?: Buffer[] }> {
  checkSjasmplusParams(params);
  const devices = deviceDiagnostics(params, files);
  if (devices.length > 0) return { result: { assembled: false, diagnostics: devices } };
  const executable = findTool(SJASMPLUS, context.env);
  const workspace = Workspace.create(context.supervisor);
  try {
    const source = workspace.materialize("source", params.files, files);
    const output = workspace.directory("out");
    const memories: Buffer[] = [];
    let diagnostics: Diagnostic[] = [];
    let symbolList = "";
    for (const [index, marker] of MARKERS.entries()) {
      const wrapper = `__c64rt_build_${index}.asm`;
      const memory = join(output, `memory${index}.bin`);
      const symbols = join(output, `symbols${index}.txt`);
      writeFileSync(join(source, wrapper), wrapperSource(params, marker, memory));
      const run = await runToolOrFail("sjasmplus", "The assembly", { argv: sjasmplusArguments(executable, params, wrapper, symbols), cwd: source, timeoutMs: TIMEOUT_MS }, context);
      const found = parseSjasmplusDiagnostics(`${run.stdout}\n${run.stderr}`, wrapper);
      if (index === 0) diagnostics = found;
      if (run.code !== 0) {
        if (diagnostics.every((diagnostic) => diagnostic.severity !== "error")) {
          diagnostics.push({ severity: "error", message: `sjasmplus stopped with exit code ${run.code} and gave no error in its usual form.${outputTail("sjasmplus", run, workspace.root)}` });
        }
        return { result: { assembled: false, diagnostics } };
      }
      if (!existsSync(memory)) throw new WireFailure("operation-failed", "sjasmplus reported success but wrote no memory.");
      memories.push(readFileSync(memory));
      if (index === 0 && existsSync(symbols)) symbolList = readFileSync(symbols, "latin1");
    }
    const segments = filledSegments(memories[0]!, memories[1]!);
    if (segments.length === 0) throw new WireFailure("invalid-input", "The source assembles to no bytes: give it ORG and code or data.");
    // The memory of the program alone: 0 where the program puts no byte.
    const memory = Buffer.alloc(0x10000);
    for (const segment of segments) memories[0]!.copy(memory, segment.start, segment.start, segment.end + 1);
    const bytes = segments.reduce((sum, segment) => sum + segment.end - segment.start + 1, 0);
    return { result: { assembled: true, segments, bytes, symbols: parseSjasmplusSymbols(symbolList, segments), diagnostics }, attachments: [memory] };
  } finally {
    workspace.remove();
  }
}
