// The c64-source script: generates ACME source from the program and the
// knowledge and Ghidra's instructions, which it runs itself, and checks
// with ACME that the source assembles to the program byte by byte. With --loader it
// also writes a loader that recreates the entry state, simulates it, and
// checks it in the emulator. Each switch of the patches is built on
// alone and checked. A macro use that does not give the bytes of the
// image is written as its instructions. Exit status: 0 when every check
// passes, 1 when one fails, 2 for a bad call.

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { COVERAGE, coverageSeedKinds, formatC64Address, parseC64Address, textToPetscii } from "#src/c64.ts";
import { autostartLoaded, RUN_LIMIT_FRAMES } from "#src/host-client/autostart.ts";
import { MAX_MEMORY_READ, WireFailure } from "#src/host-client/tools.ts";
import { writeProjectFile } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { conflicts } from "#src/knowledge/conflicts.ts";
import { KnowledgeError, openForRead } from "#src/knowledge/database.ts";
import { identifiers } from "#src/knowledge/expression.ts";
import { analyzedBytes, programCoverage, requireProgram, type ProgramImage } from "#src/knowledge/program.ts";
import { ANALYZER_NAME_ORDER, currentRevision, listAnalyzerNames, listComments, listMacros, listMacroUses, listModules, listOperands, listPatches, listReferences, listRegions, listSymbols, type SymbolRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, SPACE, type Space } from "#src/knowledge/schema.ts";
import { assemble } from "#src/native/acme.ts";
import { analyze } from "#src/native/ghidra/analyze.ts";
import { localToolContext } from "#src/native/local.ts";
import { GHIDRA_LIMITS, type AssembledSymbol, type Diagnostic } from "#src/native/types.ts";
import { decode as decodeRegister, describeAddress, platformNamesFor, romUseOf, romUseOfPort, type RomUse } from "#src/platform.ts";
import { resolveProjectPath } from "#src/project.ts";
import { runScript, UsageError } from "#src/script.ts";
import { COPIER_SOURCE, LOADER_JUMP, loaderLimits, planLoader, rasterLine, readEntryState, simulate, stopCause, VIC_DISPLAY_REGISTERS, type EntryState, type LoaderPlan } from "./lib/loader.ts";
import { OPCODES } from "#src/opcodes.ts";
import { entriesInData, entryOutsideImage, instructionText, layout, literalOperand, probeForms, render, switchesOf, type Layout, type PatchBlock, type Range, type Rendered } from "./lib/source.ts";

const USAGE = `generate.ts --out <dir> [options]

The program, its entry state and the coverage come from the knowledge:
put them in with knowledge.ts image and coverage of the c64-knowledge skill.
Code that no imported run executed is marked and listed; <dir>/not_executed.json
has all of its ranges.

  --out <dir>        the directory for the source files, relative to the project
  --entry <address>  an entry point for Ghidra, for example '$080d' (repeatable)
  --space <space>    the knowledge space of the program: c64 (the default), drive8,
                     or bank0 to bank255; the coverage and --loader are for c64 only
  --loader           also write loader.asm and loader.prg: the loader copies the
                     segments into place, sets the entry state of the knowledge,
                     and jumps to the entry; it is checked in the emulator
  --analyzer-names   name an address that has no name of the user or the LLM, and
                     no platform name, with its analyzer name

The result is one JSON object. Addresses are $ and four hex digits.`;

const MAX_LISTED = 20;
/** Rounds of assembly that move operand expressions to numbers and macro uses to instructions. */
const ROUNDS = 6;
const PROBE_BASE = 0x1000;
const PROBE_SLOT = 4;
/** The copies of a full 64 KiB take about 140 frames. */
const LOADER_FRAMES = 1500;

/** The knowledge of one space that the source uses, read once. With `analyzerNames`, an address without a name takes its first analyzer name. */
function readKnowledge(space: Space, analyzerNames = false) {
  const db = openForRead();
  try {
    // With conflicts from a git merge, the source would depend on which of two rows comes first.
    const found = conflicts(db).length;
    if (found > 0) throw new KnowledgeError("conflict", `The knowledge has ${found} conflict${found === 1 ? "" : "s"} from a git merge. Nothing was generated. Run c64-knowledge's knowledge.ts merge, then generate again.`);
    const symbols = listSymbols(db, undefined, undefined, undefined, space);
    const second = listAnalyzerNames(db, undefined, undefined, undefined, space);
    return {
      revision: currentRevision(db),
      program: requireProgram(db, space),
      // The coverage is of the C64: drive code and banks have none.
      coverage: space === DEFAULT_SPACE ? programCoverage(db)?.map : undefined,
      symbols: analyzerNames ? withAnalyzerNames(symbols, second) : symbols,
      // Analyzer routines are entry points for the decode, also without --analyzer-names.
      routines: [...symbols, ...second].filter((symbol) => symbol.kind === "routine").map((symbol) => symbol.address),
      regions: listRegions(db, undefined, undefined, undefined, space),
      comments: listComments(db, undefined, undefined, space),
      modules: listModules(db, undefined, undefined, space),
      references: listReferences(db, undefined, undefined, undefined, space),
      operands: listOperands(db, undefined, undefined, space),
      patches: listPatches(db, undefined, undefined, undefined, space),
      macros: listMacros(db, undefined, space),
      macroUses: listMacroUses(db, undefined, undefined, undefined, space),
    };
  } finally {
    db?.close();
  }
}

/**
 * The names of the user and the LLM, and for each address without one the
 * first analyzer name in the order heuristic, Ghidra, DXA. An analyzer
 * name that another address has already is left out. The analyzer names keep
 * their origin, so a platform name still wins over them.
 */
function withAnalyzerNames(symbols: SymbolRow[], second: SymbolRow[]): SymbolRow[] {
  const named = new Set(symbols.map((symbol) => symbol.address));
  const taken = new Set(symbols.map((symbol) => symbol.name));
  const added: SymbolRow[] = [];
  for (const origin of ANALYZER_NAME_ORDER) {
    for (const row of second.filter((candidate) => candidate.origin === origin)) {
      if (named.has(row.address) || taken.has(row.name)) continue;
      named.add(row.address);
      taken.add(row.name);
      added.push(row);
    }
  }
  return [...symbols, ...added].sort((a, b) => a.address - b.address);
}

/**
 * Ghidra's instruction starts and lengths inside the image, seeded from the
 * entry, from knowledge of any origin, and from the coverage: a run's flow
 * starts, also after a JSR, so code that an analyzer does not reach by itself
 * is in the source.
 */
async function decode(image: ProgramImage, knowledge: ReturnType<typeof readKnowledge>, entries: number[], coverage: Uint8Array | undefined): Promise<Map<number, number>> {
  const inImage = (address: number) => image.segments.some((segment) => address >= segment.start && address <= segment.end);
  const seeds = new Set<number>([...(image.entry === undefined ? [] : [image.entry]), ...entries]);
  for (const address of knowledge.routines) seeds.add(address);
  const flows = coverage === undefined ? { routines: [], codeStarts: [] } : coverageSeedKinds(coverage, (address) => (image.segments.some((segment) => address >= segment.start && address <= segment.end) ? image.byteAt(address) : undefined));
  for (const address of flows.routines) seeds.add(address);
  for (const region of knowledge.regions) {
    if (CODE_REGION_TYPES.includes(region.type)) seeds.add(region.start);
    if (region.type === "jumps") for (let at = region.start; at + 2 <= region.end; at += 3) seeds.add(at);
  }
  const entryPoints = [...seeds].filter(inImage).sort((a, b) => a - b);
  if (entryPoints.length === 0) {
    // An entry in no segment is a capture fault: the image is data only, and the result says entryOutside.
    if (image.entry !== undefined && !inImage(image.entry)) return new Map();
    throw new UsageError("Ghidra needs an entry point: give --entry, or record a routine or a code region in knowledge with the c64-knowledge skill");
  }
  const dataRanges = knowledge.regions
    .filter((region) => !CODE_REGION_TYPES.includes(region.type) && region.type !== "dual-use")
    .flatMap((region) => image.segments.filter((segment) => region.start <= segment.end && segment.start <= region.end).map((segment) => ({ start: Math.max(region.start, segment.start), end: Math.min(region.end, segment.end) })));
  const { result } = await analyze(
    {
      imageKind: analyzedBytes(image).kind,
      entryPoints: entryPoints.slice(0, GHIDRA_LIMITS.entryPoints),
      codeStarts: flows.codeStarts.filter((address) => !seeds.has(address)).slice(0, GHIDRA_LIMITS.codeStarts),
      dataRanges: dataRanges.slice(0, GHIDRA_LIMITS.dataRanges),
      labels: [],
      decompile: [],
    },
    analyzedBytes(image).bytes,
    localToolContext(),
  );
  const instructions = new Map<number, number>();
  for (const instruction of result.instructions) {
    const bytes = Buffer.from(instruction.bytes, "hex");
    const inside = Array.from({ length: bytes.length }, (_, offset) => instruction.address + offset).every((address, offset) => inImage(address) && image.byteAt(address) === bytes[offset]);
    if (inside) instructions.set(instruction.address, bytes.length);
  }
  return instructions;
}

/** Assembles files given as text with ACME; the program or the diagnostics. */
async function assembleFiles(
  files: Array<{ name: string; text: string }>,
  entry: string,
  defines: Record<string, number> = {},
): Promise<{ program?: Buffer; start?: number; symbols?: AssembledSymbol[]; diagnostics: Diagnostic[] }> {
  const contents = files.map((file) => Buffer.from(file.text, "utf8"));
  const { result, attachments } = await assemble(
    { files: files.map((file, index) => ({ path: file.name, size: contents[index]!.length })), entrySource: entry, includeDirs: [], defines },
    contents,
    localToolContext(),
  );
  if (!result.assembled) return { diagnostics: result.diagnostics };
  return { program: attachments![0]!, start: result.loadRange!.start, ...(result.symbols === undefined ? {} : { symbols: result.symbols }), diagnostics: result.diagnostics };
}

/**
 * Assembles one instruction of each opcode form that the source uses, each
 * in its own slot. A form that ACME refuses, or writes with other bytes, is
 * written as bytes in the source.
 */
async function probe(laid: Layout): Promise<Set<string>> {
  const asBytes = new Set<string>();
  for (let round = 0; round < 3; round++) {
    const forms = probeForms(laid).filter((item) => !asBytes.has(item.form.key));
    if (forms.length === 0) return asBytes;
    const lines = ["!cpu 6510"];
    const lineOf = new Map<number, string>();
    forms.forEach((item, index) => {
      const slot = PROBE_BASE + PROBE_SLOT * index;
      const { mode } = OPCODES[item.form.opcode]!;
      const operand =
        mode === "imp"
          ? ""
          : mode === "rel"
            ? formatC64Address((slot + 2 + (item.bytes[1]! < 0x80 ? item.bytes[1]! : item.bytes[1]! - 0x100)) & 0xffff)
            : literalOperand(item.form.opcode, item.bytes.length === 3 ? item.bytes[1]! | (item.bytes[2]! << 8) : item.bytes[1]!);
      lines.push(`* = ${formatC64Address(slot)}`);
      lines.push(`        ${instructionText(item.form.opcode, item.form.suffix, operand)}`);
      lineOf.set(lines.length, item.form.key);
    });
    const built = await assembleFiles([{ name: "probe.asm", text: `${lines.join("\n")}\n` }], "probe.asm");
    if (built.program === undefined) {
      const refused = built.diagnostics.filter((diagnostic) => diagnostic.severity === "error" && diagnostic.line !== undefined && lineOf.has(diagnostic.line));
      if (refused.length === 0) throw new WireFailure("operation-failed", `ACME refused the opcode probe: ${built.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`);
      for (const diagnostic of refused) asBytes.add(lineOf.get(diagnostic.line!)!);
      continue;
    }
    forms.forEach((item, index) => {
      const offset = 2 + PROBE_BASE + PROBE_SLOT * index - built.start!;
      const same = item.bytes.every((byte, at) => built.program![offset + at] === byte);
      if (!same) asBytes.add(item.form.key);
    });
    return asBytes;
  }
  throw new WireFailure("operation-failed", "ACME refused the opcode probe three times.");
}

/** The macro uses that an ACME error names: its line, or a line of the macro body in macros.asm, which every use of that macro shares. */
function usesInErrors(diagnostics: Diagnostic[], lineOf: ReadonlyMap<string, number>, uses: ReadonlyArray<{ start: number; macro: string }>, macroLines: Rendered["macroLines"], markLines: number): Map<number, string> {
  const blamed = new Map<number, string>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== "error" || diagnostic.file === undefined || diagnostic.line === undefined) continue;
    const start = lineOf.get(`${diagnostic.file}:${diagnostic.line}`);
    if (start !== undefined) blamed.set(start, `ACME refuses it: ${diagnostic.message}`);
    if (diagnostic.file !== "macros.asm") continue;
    for (const [macro, lines] of macroLines) {
      if (diagnostic.line < lines.first + markLines || diagnostic.line > lines.last + markLines) continue;
      for (const use of uses) if (use.macro === macro) blamed.set(use.start, `ACME refuses the macro ${macro}: ${diagnostic.message}`);
    }
  }
  return blamed;
}

/** The first address where two byte runs differ, as a reason. */
function firstDifference(start: number, built: (address: number) => number, original: (address: number) => number, end: number): string | undefined {
  for (let address = start; address <= end; address++) {
    if (built(address) !== original(address)) return `ACME assembles it to other bytes than the image: at ${formatC64Address(address)} it gives $${built(address).toString(16).padStart(2, "0")}, and the image has $${original(address).toString(16).padStart(2, "0")}.`;
  }
  return undefined;
}

/**
 * Assembles each macro use alone at its own address, with the constants and
 * the macros, and gives the uses that ACME refuses or assembles to other bytes
 * than the image, with the reason. A use of another length moves no
 * other use, so each one is checked on its own, as the opcode probe does.
 */
async function probeUses(laid: Layout, rendered: Rendered, image: ProgramImage): Promise<Map<number, string>> {
  const blamed = new Map<number, string>();
  const support = rendered.files.filter((file) => file.name === "constants.asm" || file.name === "macros.asm");
  for (let round = 0; round < 3; round++) {
    const uses = [...laid.macroUses.values()].filter((use) => !blamed.has(use.start));
    if (uses.length === 0) return blamed;
    // The labels of the image that the args name, with their values: the probe has no other source.
    const labels = new Map<string, number>();
    for (const [address, name] of laid.names) if (laid.inImage(address)) labels.set(name, address);
    const used = [...new Set(uses.flatMap((use) => use.args.flatMap((arg) => identifiers(arg))))].filter((name) => labels.has(name)).sort();
    const lines = ["!cpu 6510", '!source "constants.asm"', '!source "macros.asm"', ...used.map((name) => `${name} = ${labels.get(name)! < 0x100 ? `$${labels.get(name)!.toString(16).padStart(2, "0")}` : formatC64Address(labels.get(name)!)}`), `* = ${formatC64Address(PROBE_BASE)}`];
    const lineOf = new Map<string, number>();
    uses.forEach((use, index) => {
      lines.push(`!pseudopc ${formatC64Address(use.start)} {`, `        +${use.macro}${use.args.length === 0 ? "" : ` ${use.args.join(", ")}`}`);
      lineOf.set(`probe.asm:${lines.length}`, use.start);
      lines.push(`probe_end_${index}`, "}");
    });
    const built = await assembleFiles([...support, { name: "probe.asm", text: `${lines.join("\n")}\n` }], "probe.asm");
    if (built.program === undefined) {
      const refused = usesInErrors(built.diagnostics, lineOf, uses, rendered.macroLines, 0);
      if (refused.size === 0) throw new WireFailure("operation-failed", `ACME refused the macro probe: ${built.diagnostics.map((diagnostic) => diagnostic.message).join("; ")}`);
      for (const [start, reason] of refused) blamed.set(start, reason);
      continue;
    }
    const ends = new Map((built.symbols ?? []).map((symbol) => [symbol.name, symbol.kind === "address" ? symbol.address : symbol.value]));
    let offset = 2 + PROBE_BASE - built.start!;
    uses.forEach((use, index) => {
      const length = ends.get(`probe_end_${index}`)! - use.start;
      const wanted = use.end - use.start + 1;
      const program = built.program!;
      const at = offset;
      offset += length;
      if (length !== wanted) {
        blamed.set(use.start, `ACME assembles it to ${length} bytes, and the range has ${wanted}.`);
        return;
      }
      const reason = firstDifference(use.start, (address) => program[at + address - use.start]!, image.byteAt, use.end);
      if (reason !== undefined) blamed.set(use.start, reason);
    });
    return blamed;
  }
  throw new WireFailure("operation-failed", "ACME refused the macro probe three times.");
}

/**
 * The operand expressions and macro uses that made the assembly
 * fail or that ACME assembled to other bytes than the image, with the
 * reason. `markLines` is the number of lines added before the rendered text of
 * each file. A use of another length moves every byte after it: then only the
 * first use that differs is blamed, and no operand.
 */
function blame(rendered: Rendered, built: Awaited<ReturnType<typeof assembleFiles>>, image: ProgramImage, markLines: number): { numbers: Map<number, string>; uses: Map<number, string> } {
  const blamed = new Map<number, string>();
  if (built.program === undefined) {
    const lines = new Map(rendered.expressions.map((item) => [`${item.file}:${item.line + markLines}`, item.address]));
    for (const diagnostic of built.diagnostics) {
      if (diagnostic.severity !== "error" || diagnostic.file === undefined || diagnostic.line === undefined) continue;
      const address = lines.get(`${diagnostic.file}:${diagnostic.line}`);
      if (address !== undefined) blamed.set(address, `ACME refuses it: ${diagnostic.message}`);
    }
    const useLines = new Map(rendered.uses.map((use) => [`${use.file}:${use.line + markLines}`, use.start]));
    return { numbers: blamed, uses: usesInErrors(built.diagnostics, useLines, rendered.uses, rendered.macroLines, markLines) };
  }
  const end = built.start! + built.program.length - 3;
  const at = (address: number) => (address >= built.start! && address <= end ? built.program![2 + address - built.start!]! : -1);
  const uses = new Map<number, string>();
  const imageEnd = Math.max(...image.segments.map((segment) => segment.end));
  for (const use of rendered.uses) {
    const reason = firstDifference(use.start, at, image.byteAt, use.end);
    if (reason === undefined) continue;
    uses.set(use.start, reason);
    if (end !== imageEnd) break;
  }
  if (uses.size > 0) return { numbers: blamed, uses };
  const word = (at: (address: number) => number, item: Rendered["expressions"][number]) => (item.length === 3 ? at(item.address + 1) | (at(item.address + 2) << 8) : at(item.address + 1));
  const show = (value: number, length: number) => `$${value.toString(16).padStart(length === 3 ? 4 : 2, "0")}`;
  for (const item of rendered.expressions) {
    if (item.address + item.length - 1 > end || item.address < built.start!) continue;
    const assembled = word((address) => built.program![2 + address - built.start!]!, item);
    const original = word(image.byteAt, item);
    if (assembled !== original) blamed.set(item.address, `ACME assembles it to ${show(assembled, item.length)}, and the image has ${show(original, item.length)}.`);
  }
  return { numbers: blamed, uses };
}

interface SegmentCheck {
  start: string;
  end: string;
  result: "identical" | "different" | "not covered";
  differences?: number;
  firstDifference?: { address: string; built: number; image: number };
}

/** Compares the assembled program with the image, segment by segment. */
function check(program: Buffer, start: number, image: ProgramImage): { identical: boolean; segments: SegmentCheck[] } {
  const end = start + program.length - 3;
  const segments = image.segments.map((segment): SegmentCheck => {
    const shown = { start: formatC64Address(segment.start), end: formatC64Address(segment.end) };
    if (segment.start < start || segment.end > end) return { ...shown, result: "not covered" };
    let differences = 0;
    let first: SegmentCheck["firstDifference"];
    for (let address = segment.start; address <= segment.end; address++) {
      const built = program[2 + address - start]!;
      if (built === image.byteAt(address)) continue;
      differences++;
      first ??= { address: formatC64Address(address), built, image: image.byteAt(address) };
    }
    return differences === 0 ? { ...shown, result: "identical" } : { ...shown, result: "different", differences, firstDifference: first! };
  });
  return { identical: segments.every((segment) => segment.result === "identical"), segments };
}

/** What a build with one switch on gives. */
interface SwitchCheck {
  name: string;
  define: string;
  patches: Array<{ start: string; end: string; bytes: number; insideNames?: string[] }>;
  result: "fits" | "overflow" | "changes outside" | "does not assemble";
  changedBytes?: number;
  outside?: { count: number; first: { address: string; built: number; default: number } };
  overflow?: Array<{ start: string; message: string }>;
  diagnostics?: Diagnostic[];
}

/**
 * Builds the source with one switch on and compares it with the default
 * build: only the ranges of its patches may change, and the program keeps its
 * start and length. A patch longer than its range stops ACME with !error.
 */
async function checkSwitch(name: string, patches: PatchBlock[], files: Array<{ name: string; text: string }>, base: { program: Buffer; start: number }, names: Layout["names"]): Promise<SwitchCheck> {
  const shown: SwitchCheck = {
    name,
    define: `--define ${name}=1`,
    patches: patches.map((patch) => {
      const inside = patch.inner.map((address) => names.get(address)!);
      return { start: formatC64Address(patch.start), end: formatC64Address(patch.end), bytes: patch.end - patch.start + 1, ...(inside.length === 0 ? {} : { insideNames: inside }) };
    }),
    result: "fits",
  };
  const built = await assembleFiles(files, "main.asm", { [name]: 1 });
  if (built.program === undefined) {
    const overflow = built.diagnostics.flatMap((diagnostic) => {
      const found = /The patch \S+ at (\$[0-9a-f]{4}) has .*/.exec(diagnostic.message);
      return found === null ? [] : [{ start: found[1]!, message: found[0] }];
    });
    if (overflow.length > 0) return { ...shown, result: "overflow", overflow };
    return { ...shown, result: "does not assemble", diagnostics: built.diagnostics.slice(0, MAX_LISTED) };
  }
  const inside = (address: number) => patches.some((patch) => address >= patch.start && address <= patch.end);
  let changed = 0;
  let outside: SwitchCheck["outside"];
  const end = Math.max(base.start + base.program.length, built.start! + built.program.length) - 2;
  for (let address = Math.min(base.start, built.start!); address < end; address++) {
    const at = (program: Buffer, start: number) => (address >= start && address < start + program.length - 2 ? program[2 + address - start]! : -1);
    const now = at(built.program, built.start!);
    const before = at(base.program, base.start);
    if (now === before) continue;
    if (inside(address)) changed++;
    else outside = { count: (outside?.count ?? 0) + 1, first: outside?.first ?? { address: formatC64Address(address), built: now, default: before } };
  }
  return outside === undefined ? { ...shown, changedBytes: changed } : { ...shown, result: "changes outside", changedBytes: changed, outside };
}

/** Reads RAM in parts. */
async function readRam(client: ViceSessionClient, start: number, size: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (let at = start; at < start + size; at += MAX_MEMORY_READ) {
    parts.push(Buffer.from((await client.memoryRead({ address: at, size: Math.min(MAX_MEMORY_READ, start + size - at), space: "c64", view: "ram" })).data, "hex"));
  }
  return Buffer.concat(parts);
}

/** Runs the loader in the emulator to the entry and compares memory, $00/$01 and the registers with the entry state. */
/**
 * Runs the loader in the emulator to its jump to the entry and compares the
 * machine with the entry state there. At the jump, every byte and register is
 * set and no interrupt has run since the PLP: the 6502 takes one only after
 * the JMP, as the original program can take one right at its entry.
 */
/** What the check of the loader gives. `stop`: why the loader did not get to its copier or its jump. */
interface LoaderRun {
  verified: boolean;
  differences: string[];
  stop?: { pc: string; port: string; cause?: string; history: string[] };
}

/** The history entries that a stop of the loader gives, so the agent sees the last instructions. */
const STOP_HISTORY = 16;

async function runLoader(path: string, program: Buffer, plan: LoaderPlan, image: ProgramImage, state: EntryState, jump: number, copierSource: number, expected: (address: number) => number): Promise<LoaderRun> {
  const client = await ViceSessionClient.open({ videoStandard: "pal" });
  try {
    await client.reset({ mode: "hard", run: false });
    if (!(await autostartLoaded(client, path, program))) return { verified: false, differences: ["The loader was not in memory after autostart."] };
    await client.keyboard(textToPetscii("RUN\n"));
    // A stop before the copier or the jump gives $01, the last instructions and the first byte that is not as planned.
    const stopped = async (pc: number, copied: boolean, what: string): Promise<LoaderRun> => {
      const ram = await readRam(client, 0x0000, 0x10000);
      const port = Buffer.from((await client.memoryRead({ address: 0x0001, size: 1, space: "c64", view: "cpu" })).data, "hex")[0]!;
      const history = (await client.cpuHistory({ limit: STOP_HISTORY, space: "c64" })).entries.map((entry) => `${formatC64Address(entry.address)}  ${entry.text}`);
      const cause = stopCause(ram, plan, copierSource, (address) => program[2 + address - 0x0801]!, copied, expected);
      const port01 = `$${port.toString(16).padStart(2, "0")}`;
      return { verified: false, differences: [`The loader did not get to ${what}; it stopped at ${formatC64Address(pc)}.`], stop: { pc: formatC64Address(pc), port: port01, ...(cause === undefined ? {} : { cause }), history } };
    };
    const copier = await client.runUntil({ target: { kind: "address", address: plan.copier, space: "c64" }, timeoutFrames: RUN_LIMIT_FRAMES });
    if (!copier.reached) return await stopped(copier.pc, false, `its copier at ${formatC64Address(plan.copier)}`);
    const atJump = await client.runUntil({ target: { kind: "address", address: jump, space: "c64" }, timeoutFrames: LOADER_FRAMES });
    if (!atJump.reached) return await stopped(atJump.pc, true, `its jump to the entry at ${formatC64Address(jump)}`);
    const memory = await readRam(client, 0x0000, 0x10000);
    if (memory[jump] !== 0x4c || (memory[jump + 1]! | (memory[jump + 2]! << 8)) !== state.pc) {
      return { verified: false, differences: [`The instruction at ${formatC64Address(jump)} is not JMP ${formatC64Address(state.pc)}.`] };
    }
    const port = Buffer.from((await client.memoryRead({ address: 0x0000, size: 2, space: "c64", view: "cpu" })).data, "hex");
    const registers = await client.registersGet("c64");
    const differences: string[] = [];
    const byte = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
    const differ = (what: string, got: number, wanted: number) => got !== wanted && differences.push(`${what} is ${byte(got)}, not ${byte(wanted)}`);
    for (const segment of image.segments) {
      for (let address = Math.max(segment.start, 2); address <= segment.end; address++) differ(formatC64Address(address), memory[address]!, image.byteAt(address));
    }
    for (let address = 2; address < 0x400; address++) if (address !== plan.stackByte) differ(formatC64Address(address), memory[address]!, state.pages[address]!);
    differ("$00", port[0]!, state.port[0]);
    differ("$01", port[1]!, state.port[1]);
    differ("a", registers.a, state.a);
    differ("x", registers.x, state.x);
    differ("y", registers.y, state.y);
    differ("sp", registers.sp, state.sp);
    const flags = (["n", "v", "d", "i", "z", "c"] as const).reduce((value, name, index) => value | (registers.flags[name] ? [0x80, 0x40, 0x08, 0x04, 0x02, 0x01][index]! : 0), 0);
    differ("flags", flags, state.flags & 0xcf);
    if (state.vic !== undefined) {
      // The display registers and the raster line: the loader waited for the line, so the jump comes in it or the next one.
      const vic = Buffer.from((await client.ioRead(0xd000, 0x2f)).data, "hex");
      for (const { register, mask } of VIC_DISPLAY_REGISTERS) differ(formatC64Address(0xd000 + register), vic[register]! & mask, state.vic.registers[register]! & mask);
      differ("the VIC bank", Buffer.from((await client.ioRead(0xdd00, 1)).data, "hex")[0]! & 0x03, state.vic.bank);
      const line = rasterLine(vic);
      const wanted = rasterLine(state.vic.registers);
      if (line !== wanted && line !== wanted + 1) differences.push(`the raster line is ${line}, not ${wanted}`);
    }
    if (plan.cia !== undefined) {
      // The CIA timers: at the jump a running timer is 3 cycles, the JMP, before its value at the entry.
      const chips = (await client.cia("both")).chips;
      const word = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
      const differWord = (what: string, got: number, wanted: number) => got !== wanted && differences.push(`${what} is ${word(got)}, not ${word(wanted)}`);
      for (const timer of plan.cia.timers) {
        const chip = chips[timer.cia - 1]!;
        const name = `CIA ${timer.cia} timer ${timer.timer}`;
        const [counter, latch, control] = timer.timer === "A" ? [chip.timerA, chip.latchA, chip.controlA] : [chip.timerB, chip.latchB, chip.controlB];
        differ(`${name} control`, control, timer.control);
        differWord(`${name} latch`, latch, timer.latch);
        if (timer.counterAtJump !== undefined) differWord(`${name} counter`, counter, timer.counterAtJump);
      }
      plan.cia.masks.forEach((mask, index) => differ(`CIA ${index + 1} interrupt mask`, chips[index]!.interruptMask, mask));
    }
    return { verified: differences.length === 0, differences: differences.slice(0, MAX_LISTED) };
  } finally {
    await client.close();
  }
}

/**
 * The ROMs the program uses: from the coverage when the knowledge has
 * it, else from $01 of the entry state, else both.
 */
function romsInUse(image: ProgramImage, coverage: Uint8Array | undefined): RomUse & { from: "coverage" | "entry state" | "none" } {
  if (coverage !== undefined) return { ...romUseOf(coverage, COVERAGE.romExecute), from: "coverage" };
  const port = (image.state?.cpuPort as Record<string, unknown> | undefined)?.$01;
  if (typeof port === "number") return { ...romUseOfPort(port), from: "entry state" };
  return { basic: true, kernal: true, from: "none" };
}

/** The first words of every file that the script writes. */
const GENERATED_MARK = "; Generated by c64-source";
/** The file with every range of instructions that no run executed. */
const NOT_EXECUTED_FILE = "not_executed.json";
/** The line of each name and address in the source, for links from the documentation. */
const SOURCE_MAP_FILE = "source-map.json";

/** Removes the .asm files of an earlier run that this run does not write, and an earlier loader.prg and not_executed.json; other files stay. */
/**
 * source-map.json: the line of each name and of each address that the
 * files write, after the mark line. One entry per line of the file, so a diff
 * of two maps stays short.
 */
function sourceMapText(rendered: Rendered, space: string, revision: string | null, files: ReadonlyArray<{ name: string }>): string {
  const labels = rendered.labels.map((label) => JSON.stringify({ address: formatC64Address(label.address), name: label.name, file: label.file, line: label.line + 1 }));
  const items = rendered.items.map((item) => JSON.stringify({ start: formatC64Address(item.start), end: formatC64Address(item.end), file: item.file, line: item.line + 1 }));
  const head = JSON.stringify({ space, revision, files: files.map((file) => file.name) }).slice(0, -1);
  return `${head},\n"labels": [\n${labels.join(",\n")}\n],\n"items": [\n${items.join(",\n")}\n]}\n`;
}

function removeOldFiles(out: string, keep: ReadonlySet<string>): void {
  const directory = resolveProjectPath(out);
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const path = join(directory, name);
    if (name === "loader.prg" || name === NOT_EXECUTED_FILE || name === SOURCE_MAP_FILE) rmSync(path, { force: true });
    else if (name.endsWith(".asm") && !keep.has(name) && readFileSync(path, "utf8").startsWith(GENERATED_MARK)) rmSync(path, { force: true });
  }
}

async function run(argv: string[]): Promise<{ output: Record<string, unknown>; failed: boolean }> {
  const { values, positionals } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      entry: { type: "string", multiple: true },
      space: { type: "string" },
      loader: { type: "boolean" },
      "analyzer-names": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) throw new UsageError("");
  if (positionals.length !== 0) throw new UsageError("generate takes no image: it reads the program from the knowledge (knowledge.ts image of the c64-knowledge skill puts it in)");
  if (values.out === undefined) throw new UsageError("generate needs --out <dir>");
  try {
    resolveProjectPath(values.out);
  } catch {
    throw new UsageError(`--out must be a path relative to the project folder that stays inside it, not ${values.out}`);
  }
  const entries = (values.entry ?? []).map((value) => {
    try {
      return parseC64Address(value);
    } catch {
      throw new UsageError(`--entry must be $ followed by four hex digits, not ${value}`);
    }
  });
  const space = values.space ?? DEFAULT_SPACE;
  if (!SPACE.test(space)) throw new UsageError("--space must be c64, drive8, or bank0 to bank255");
  if (space !== DEFAULT_SPACE && values.loader) throw new UsageError("--loader works only in space c64");
  const knowledge = readKnowledge(space, values["analyzer-names"] === true);
  const image = knowledge.program;
  const coverage = knowledge.coverage;
  if (values.loader && (image.state === undefined || image.entry === undefined)) {
    throw new UsageError("--loader needs the entry and the entry state of a c64-unpacker capture in the knowledge: put the capture in with knowledge.ts image <image.json>");
  }
  // Read the entry state before the long steps, so a bad state stops the run at once.
  const state = values.loader ? readEntryState(JSON.stringify(image.state), "the entry state of the knowledge") : undefined;
  const romUse = romsInUse(image, coverage);
  const instructions = await decode(image, knowledge, entries, coverage);
  const laid = layout({
    segments: image.segments,
    byteAt: image.byteAt,
    ...(image.entry === undefined ? {} : { entry: image.entry }),
    instructions,
    symbols: knowledge.symbols,
    regions: knowledge.regions,
    comments: knowledge.comments,
    modules: knowledge.modules,
    referenceTargets: knowledge.references.map((reference) => reference.to),
    operands: knowledge.operands,
    patches: knowledge.patches,
    macros: knowledge.macros,
    macroUses: knowledge.macroUses,
    ...(coverage === undefined ? {} : { coverage }),
    // The platform names are C64 names: drive code and banks get none. A ROM that the program does not use gives none.
    ...(space === DEFAULT_SPACE ? { platform: platformNamesFor(romUse), describe: describeAddress, decode: decodeRegister } : {}),
  });
  const asBytes = await probe(laid);
  const header = [`Generated by c64-source from knowledge revision ${knowledge.revision}${space === DEFAULT_SPACE ? "" : ` in space ${space}`}.`, "Change names, comments, regions and modules in knowledge, then generate again."];
  let loader: LoaderPlan | undefined;
  // An image without its entry has no program: the source is still written and checked, but the run fails.
  const missingEntry = entryOutsideImage(image.entry, image.segments);
  // A loader that cannot be planned does not stop the source: the source is written and checked, and the result says why.
  let loaderRefused: string | undefined = state === undefined ? undefined : missingEntry;
  if (state !== undefined && missingEntry === undefined) {
    const segments = image.segments.map((segment) => ({ ...segment, files: laid.pieces.filter((piece) => piece.start >= segment.start && piece.start <= segment.end).map((piece) => piece.file) }));
    try {
      const entryName = laid.names.get(image.entry!);
      loader = planLoader({ segments, byteAt: image.byteAt, state, entry: image.entry!, ...(entryName === undefined ? {} : { entryName }), macros: laid.macros.length > 0, header: [`Loader generated by c64-source from knowledge revision ${knowledge.revision}.`, "It copies the segments into place, sets the entry state and jumps to the entry."] });
    } catch (error) {
      if (!(error instanceof WireFailure)) throw error;
      loaderRefused = error.message;
    }
  }
  // Every generated file starts with the mark, so a later run knows its own files and removes the ones it does not write again.
  const marked = (list: Array<{ name: string; text: string }>) => list.map((file) => ({ ...file, text: `${GENERATED_MARK}. Do not edit: change the knowledge and generate again.\n${file.text}` }));
  const loaderFiles = loader === undefined ? [] : [{ name: "loader.asm", text: loader.text }];
  // An operand expression that ACME refuses, or assembles to other bytes, is written as its number, and a macro use as its
  // instructions; then the source is assembled again.
  const numbers = new Map<number, string>();
  const asInstructions = new Map<number, string>();
  let rendered = render(laid, asBytes, header, numbers, asInstructions);
  if (laid.macroUses.size > 0) for (const [start, reason] of await probeUses(laid, rendered, image)) asInstructions.set(start, reason);
  if (asInstructions.size > 0) rendered = render(laid, asBytes, header, numbers, asInstructions);
  let files = marked([...rendered.files, ...loaderFiles]);
  let built = await assembleFiles(files, "main.asm");
  for (let round = 0; round < ROUNDS && (rendered.expressions.length > 0 || rendered.uses.length > 0); round++) {
    const blamed = blame(rendered, built, image, 1);
    if (blamed.numbers.size === 0 && blamed.uses.size === 0) break;
    for (const [address, reason] of blamed.numbers) numbers.set(address, reason);
    for (const [start, reason] of blamed.uses) asInstructions.set(start, reason);
    rendered = render(laid, asBytes, header, numbers, asInstructions);
    files = marked([...rendered.files, ...loaderFiles]);
    built = await assembleFiles(files, "main.asm");
  }
  removeOldFiles(values.out, new Set(files.map((file) => file.name)));
  for (const file of files) writeProjectFile(`${values.out}/${file.name}`, Buffer.from(file.text, "utf8"), { what: "--out" });
  writeProjectFile(`${values.out}/${SOURCE_MAP_FILE}`, Buffer.from(sourceMapText(rendered, space, knowledge.revision, files), "utf8"), { what: "--out" });
  const showRange = (range: Range) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
  const inData = entriesInData(entries, knowledge.regions);
  if (rendered.notExecuted !== undefined) {
    // Each range with the file of the source that holds it and the routine before it, as a report groups them.
    const routines = knowledge.symbols.filter((symbol) => symbol.kind === "routine").sort((a, b) => a.address - b.address);
    const placed = rendered.notExecuted.ranges.map((range) => {
      const file = laid.pieces.find((piece) => range.start >= piece.start && range.start <= piece.end)?.file;
      const routine = routines.filter((symbol) => symbol.address <= range.start).at(-1)?.name;
      return { ...showRange(range), ...(file === undefined ? {} : { file }), ...(routine === undefined ? {} : { routine }) };
    });
    const files: Record<string, number> = {};
    for (const range of placed) if (range.file !== undefined) files[range.file] = (files[range.file] ?? 0) + 1;
    const all = { revision: knowledge.revision, instructions: rendered.notExecuted.instructions, files, ranges: placed };
    writeProjectFile(`${values.out}/${NOT_EXECUTED_FILE}`, Buffer.from(`${JSON.stringify(all, null, 2)}\n`, "utf8"), { what: "--out" });
  }

  const output: Record<string, unknown> = {
    out: values.out,
    files: files.map((file) => file.name),
    sourceMap: `${values.out}/${SOURCE_MAP_FILE}`,
    revision: knowledge.revision,
    instructions: rendered.instructions,
    dataBytes: rendered.dataBytes,
    ...(rendered.undecodedBytes === 0 ? {} : { undecodedBytes: rendered.undecodedBytes }),
    // The ROM names that the source leaves out, and the evidence.
    ...(space !== DEFAULT_SPACE || (romUse.basic && romUse.kernal) ? {} : { romNamesLeftOut: { roms: [...(romUse.basic ? [] : ["BASIC"]), ...(romUse.kernal ? [] : ["KERNAL"])], ...(romUse.basic || romUse.kernal ? {} : { systemArea: true }), from: romUse.from } }),
    ...(missingEntry === undefined ? {} : { entryOutside: { entry: formatC64Address(image.entry!), reason: missingEntry } }),
    labels: { named: laid.namedLabels, generated: laid.generatedLabels },
    // An --entry in a data region decodes nothing: the result says so, and a code region in the knowledge changes it.
    ...(inData.length === 0
      ? {}
      : { entriesInData: inData.map(({ entry, region }) => ({ entry: formatC64Address(entry), region: { ...showRange(region), type: region.type }, origin: region.origin })) }),
    ...(rendered.asBytes.length === 0
      ? {}
      : { asBytes: { count: rendered.asBytes.length, listed: rendered.asBytes.slice(0, MAX_LISTED).map((item) => ({ address: formatC64Address(item.address), instruction: item.text })) } }),
    ...(rendered.notExecuted === undefined
      ? {}
      : {
          notExecuted: {
            instructions: rendered.notExecuted.instructions,
            ranges: rendered.notExecuted.ranges.length,
            listed: rendered.notExecuted.ranges.slice(0, MAX_LISTED).map(showRange),
            all: `${values.out}/${NOT_EXECUTED_FILE}`,
          },
        }),
    ...(laid.unusedModules.length === 0 ? {} : { unusedModules: laid.unusedModules.map((module) => ({ start: formatC64Address(module.start), file: module.file })) }),
    ...(rendered.expressions.length === 0 && rendered.operandsAsNumbers.length === 0 ? {} : { operandExpressions: rendered.expressions.length }),
    ...(rendered.operandsAsNumbers.length === 0
      ? {}
      : {
          operandsAsNumbers: {
            count: rendered.operandsAsNumbers.length,
            listed: rendered.operandsAsNumbers.slice(0, MAX_LISTED).map((item) => ({ address: formatC64Address(item.address), expression: item.expression, reason: item.reason })),
          },
        }),
    ...(rendered.uses.length === 0 && rendered.macrosAsInstructions.length === 0 ? {} : { macroUses: rendered.uses.length }),
    // A macro use that the source writes as its instructions does not fail the run: the source stays identical.
    ...(rendered.macrosAsInstructions.length === 0
      ? {}
      : {
          macrosAsInstructions: {
            count: rendered.macrosAsInstructions.length,
            listed: rendered.macrosAsInstructions.slice(0, MAX_LISTED).map((item) => ({ start: formatC64Address(item.start), end: formatC64Address(item.end), macro: item.macro, reason: item.reason })),
          },
        }),
    // A patch that the source cannot write fails the run: the switch would miss a part.
    ...(laid.patchesNotWritten.length === 0
      ? {}
      : {
          patchesNotWritten: {
            count: laid.patchesNotWritten.length,
            listed: laid.patchesNotWritten.slice(0, MAX_LISTED).map((item) => ({ start: formatC64Address(item.start), end: formatC64Address(item.end), switch: item.switch, reason: item.reason })),
          },
        }),
  };
  // The loader includes the source, so it is built only from a source that is identical to the image.
  const notBuilt = (reason: string) => (state === undefined ? {} : { loader: { verified: false, reason: loaderRefused ?? reason } });
  if (built.program === undefined) {
    return { output: { ...output, check: { identical: false, diagnostics: built.diagnostics.slice(0, MAX_LISTED) }, ...notBuilt("The source does not assemble, and the loader includes it.") }, failed: true };
  }
  const checked = check(built.program, built.start!, image);
  output.check = checked;
  if (!checked.identical) return { output: { ...output, ...notBuilt("The source does not assemble to the image, and the loader includes it.") }, failed: true };
  // Each switch on alone, against the default build; combinations are not built.
  const switches: SwitchCheck[] = [];
  for (const [name, patches] of switchesOf(laid)) switches.push(await checkSwitch(name, patches, files, { program: built.program, start: built.start! }, laid.names));
  if (switches.length > 0) output.switches = switches;
  const sourceFailed = laid.patchesNotWritten.length > 0 || switches.some((item) => item.result !== "fits");
  if (loaderRefused !== undefined) return { output: { ...output, loader: { verified: false, reason: loaderRefused } }, failed: true };
  if (loader === undefined || state === undefined) return { output, failed: missingEntry !== undefined || sourceFailed };

  const loaderBuilt = await assembleFiles(files, "loader.asm");
  if (loaderBuilt.program === undefined) return { output: { ...output, loader: { verified: false, reason: "loader.asm does not assemble.", diagnostics: loaderBuilt.diagnostics.slice(0, MAX_LISTED) } }, failed: true };
  const program = loaderBuilt.program;
  // The simulation: the loader in memory as it loads, then every copy in its order, byte by byte.
  const memory = new Int16Array(0x10000).fill(-1);
  program.subarray(2).forEach((byte, offset) => (memory[loaderBuilt.start! + offset] = byte));
  const expected = (address: number) => (image.segments.some((segment) => address >= segment.start && address <= segment.end) ? image.byteAt(address) : state.pages[address]!);
  const wrongPacking = loader.blocks.find((block) => {
    for (let address = block.range.start; address <= block.range.end; address++) if (memory[block.packedAt + address - block.range.start] !== block.bytes(address)) return true;
    return false;
  });
  if (loaderBuilt.start !== 0x0801 || loaderBuilt.start + program.length - 3 !== loader.end || wrongPacking !== undefined) {
    throw new WireFailure("operation-failed", `The assembled loader does not have the planned layout${wrongPacking === undefined ? "" : ` (${wrongPacking.what})`}. This is a defect of the c64-source script.`);
  }
  const jumpSymbol = loaderBuilt.symbols?.find((symbol) => symbol.name === LOADER_JUMP);
  if (jumpSymbol === undefined) throw new WireFailure("operation-failed", `The assembled loader has no ${LOADER_JUMP} label. This is a defect of the c64-source script.`);
  const jump = jumpSymbol.kind === "address" ? jumpSymbol.address : jumpSymbol.value;
  const wrong = simulate(memory, loader.copies, expected);
  if (wrong !== undefined) throw new WireFailure("operation-failed", `The simulated loader writes a wrong byte at ${formatC64Address(wrong)}. This is a defect of the c64-source script.`);
  const loaderPath = `${values.out}/loader.prg`;
  writeProjectFile(loaderPath, program, { what: "--out" });
  (output.files as string[]).push("loader.prg");
  const copierSymbol = loaderBuilt.symbols?.find((symbol) => symbol.name === COPIER_SOURCE);
  if (copierSymbol === undefined) throw new WireFailure("operation-failed", `The assembled loader has no ${COPIER_SOURCE} label. This is a defect of the c64-source script.`);
  const copierSource = copierSymbol.kind === "address" ? copierSymbol.address : copierSymbol.value;
  const ran = await runLoader(loaderPath, program, loader, image, state, jump, copierSource, expected);
  output.loader = {
    program: loaderPath,
    copies: loader.copies.map((copy) => ({ what: copy.what, to: `${formatC64Address(copy.target.start)}-${formatC64Address(copy.target.end)}` })),
    copier: formatC64Address(loader.copier),
    stackByte: formatC64Address(loader.stackByte),
    ...ran,
    // What the loader cannot set as it was at the entry.
    ...(loaderLimits(loader).length === 0 ? {} : { limits: loaderLimits(loader) }),
  };
  return { output, failed: !ran.verified || sourceFailed };
}

await runScript(
  async (argv) => {
    const { output, failed } = await run(argv);
    if (failed) process.exitCode = 1;
    return output;
  },
  { usage: USAGE, refusals: [KnowledgeError] },
);
