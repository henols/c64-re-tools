// The c64-source script: generates ACME source from the program and the
// knowledge and Ghidra's instructions, which it runs itself, and checks
// with ACME that the build of the base release assembles to the program byte
// by byte. With --loader it also writes a loader that recreates the entry
// state, simulates it, and checks it in the emulator. The default build may
// differ from the program only in the patches that it puts in; each release
// builds to the bytes of its file; each switch is built alone against the
// base release. A macro use that does not give the bytes of the image is
// written as its instructions. result is PASS when every check passes, else
// FAIL.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

import { Refusal } from "#src/errors.ts";
import { type AddressRange, coverageSeedKinds, findHandoffs, formatC64Address, parseTokenized, textToPetscii } from "#src/c64.ts";
import { autostartLoaded, RUN_LIMIT_FRAMES } from "#src/host-client/autostart.ts";
import { readImage, type Image } from "#src/host-client/image.ts";
import { readProjectFile } from "#src/host-client/transfer.ts";
import { MAX_MEMORY_READ, WireFailure } from "#src/host-client/tools.ts";
import { writeReported, type Written } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { conflicts } from "#src/knowledge/conflicts.ts";
import { openForRead, withWrite } from "#src/knowledge/database.ts";
import { identifiers } from "#src/knowledge/expression.ts";
import { analyzedBytes, memoryRows, programCoverage, requireProgram, type ProgramImage } from "#src/knowledge/program.ts";
import { ANALYZER_NAME_ORDER, baseValue, currentRevision, listAnalyzerNames, listComments, listMacros, listMacroUses, listModules, listOperands, listPatches, listReferences, listRegions, listReleases, listSpaces, listSwitches, listSymbols, type ReleaseRow, type SymbolRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, isSemantic, RELEASE_DEFINE, type Space } from "#src/knowledge/schema.ts";
import { subtract, write } from "#src/knowledge/write.ts";
import { assemble, symbolsFileText } from "#src/native/acme.ts";
import { analyze } from "#src/native/ghidra/analyze.ts";
import { localToolContext } from "#src/native/local.ts";
import { GHIDRA_LIMITS, type AssembledSymbol, type Diagnostic } from "#src/native/types.ts";
import { decode as decodeRegister, describeAddress, platformNames, platformNamesFor, romUseOfProgram } from "#src/platform.ts";
import { ensureLocal, LOCAL_DIRECTORY, newProjectFolder, PROJECT_DIRECTORY, projectRoot, resolveProjectPath } from "#src/project.ts";
import { isoCet } from "#src/time.ts";
import { zipFiles } from "#src/zip.ts";
import { listed, OPTIONS, runScript, UsageError, type Call } from "#src/script.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { COPIER_SOURCE, LOADER_JUMP, loaderLimits, planLoader, rasterLine, loaderState, simulate, stopCause, VIC_DISPLAY_REGISTERS, type EntryState, type LoaderPlan } from "./lib/loader.ts";
import { instructionWith, OPCODES } from "#src/opcodes.ts";
import { freeName, planDrops, readmeText, rewriteTest } from "./lib/export.ts";
import { CONFIG_FILE, configText, configValues, entriesInData, entryOutsideImage, hasSwitchFile, layout, literalOperand, probeForms, render, switchesOf, type Layout, type PatchBlock, type Rendered, type SourceSwitch } from "./lib/source.ts";

/** At most this many diagnostics or differences of one check. */
const MAX_DIAGNOSTICS = 20;
/** Rounds of assembly that move operand expressions to numbers and macro uses to instructions. */
const ROUNDS = 6;
const PROBE_BASE = 0x1000;
const PROBE_SLOT = 4;
/** Why a source has no instructions when the knowledge has no code. */
const DATA_ONLY = "The knowledge has no entry, routine, code region or executed address in this space. Thus the source has only data. For instructions, give --entry, or classify the code with knowledge.ts classify, then generate again.";

/** The copies of a full 64 KiB take about 140 frames. */
const LOADER_FRAMES = 1500;

/** The knowledge of one space that the source uses, read once. With `analyzerNames`, an address without a name takes its first analyzer name. */
function readKnowledge(space: Space, analyzerNames = false) {
  const db = openForRead();
  try {
    // With conflicts from a git merge, the source would depend on which of two rows comes first.
    const found = conflicts(db).length;
    if (found > 0) throw new Refusal("conflict", `The knowledge has ${found} conflict${found === 1 ? "" : "s"} from a git merge. Nothing was generated. Run c64-knowledge's knowledge.ts merge, then generate again.`);
    const symbols = listSymbols(db, undefined, undefined, undefined, space);
    const second = listAnalyzerNames(db, undefined, undefined, undefined, space);
    const releases = listReleases(db, undefined, space);
    const base = releases.find((release) => release.base)?.label;
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
      switches: listSwitches(db, undefined, space).map((row): SourceSwitch => ({ name: row.name, kind: row.kind, default: row.default, base: baseValue(row, base), releases: row.releases, ...(row.comment === undefined ? {} : { comment: row.comment }) })),
      releases,
      macros: listMacros(db, undefined, space),
      macroUses: listMacroUses(db, undefined, undefined, undefined, space),
    };
  } finally {
    db?.close();
  }
}

/** The knowledge of one space that a source is made from. */
type SourceKnowledge = ReturnType<typeof readKnowledge>;

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
 * is in the source. A program without a seed has no known code: it is data
 * only, and Ghidra does not run.
 */
async function decode(image: ProgramImage, knowledge: Pick<SourceKnowledge, "routines" | "regions">, entries: number[], coverage: Uint8Array | undefined): Promise<{ instructions: Map<number, number>; dataOnly: boolean }> {
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
    return { instructions: new Map(), dataOnly: image.entry === undefined || inImage(image.entry) };
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
  return { instructions, dataOnly: false };
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
      lines.push(`        ${instructionWith(item.form.opcode, operand, item.form.suffix)}`);
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
function check(program: Buffer, start: number, image: Pick<ProgramImage, "segments" | "byteAt">): { identical: boolean; segments: SegmentCheck[] } {
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

/** What a build with other switch values gives, against the build of the base release. */
interface BuildCheck {
  result: "fits" | "overflow" | "changes outside" | "does not assemble";
  changedBytes?: number;
  outside?: { count: number; first: { address: string; built: number; base: number } };
  overflow?: Array<{ start: string; message: string }>;
  diagnostics?: Diagnostic[];
}

/** What ACME gives for a source: the program, or the diagnostics. */
type Assembled = Awaited<ReturnType<typeof assembleFiles>>;

/**
 * Compares a build with the build of the base release: only the ranges may
 * change, and the program keeps its start and length. A patch longer than its
 * range, or two alternatives together, stop ACME with !error.
 */
function compareBuilds(built: Assembled, ranges: readonly AddressRange[], base: { program: Buffer; start: number }): BuildCheck {
  if (built.program === undefined) {
    const overflow = built.diagnostics.flatMap((diagnostic) => {
      const found = /The patch \S+ at (\$[0-9a-f]{4}) has .*|\S+ and \S+ change (\$[0-9a-f]{4})-\$[0-9a-f]{4}: turn on one of them\./.exec(diagnostic.message);
      return found === null ? [] : [{ start: (found[1] ?? found[2])!, message: found[0] }];
    });
    if (overflow.length > 0) return { result: "overflow", overflow };
    return { result: "does not assemble", diagnostics: built.diagnostics.slice(0, MAX_DIAGNOSTICS) };
  }
  const inside = (address: number) => ranges.some((range) => address >= range.start && address <= range.end);
  let changed = 0;
  let outside: BuildCheck["outside"];
  const end = Math.max(base.start + base.program.length, built.start! + built.program.length) - 2;
  for (let address = Math.min(base.start, built.start!); address < end; address++) {
    const at = (program: Buffer, start: number) => (address >= start && address < start + program.length - 2 ? program[2 + address - start]! : -1);
    const now = at(built.program, built.start!);
    const before = at(base.program, base.start);
    if (now === before) continue;
    if (inside(address)) changed++;
    else outside = { count: (outside?.count ?? 0) + 1, first: outside?.first ?? { address: formatC64Address(address), built: now, base: before } };
  }
  return outside === undefined ? { result: "fits", changedBytes: changed } : { result: "changes outside", changedBytes: changed, outside };
}

/**
 * The files with config.asm at the switch values. A build takes the switches
 * from config.asm: a define of a switch is an error, because config.asm also
 * gives it a value. A switch without a value has its default.
 */
function withValues(files: Array<{ name: string; text: string }>, laid: Pick<Layout, "switches" | "patches">, values: ReadonlyMap<string, number>): Array<{ name: string; text: string }> {
  return files.map((file) => (file.name === CONFIG_FILE ? { ...file, text: configText(laid, values) } : file));
}

/** Builds the source and compares it with the build of the base release (compareBuilds). */
async function checkBuild(files: Array<{ name: string; text: string }>, ranges: readonly AddressRange[], base: { program: Buffer; start: number }): Promise<BuildCheck> {
  return compareBuilds(await assembleFiles(files, "main.asm"), ranges, base);
}

/** What a build with one switch at the value that the base release does not have gives. */
type SwitchCheck = BuildCheck & {
  name: string;
  kind: string;
  default: number;
  base: number;
  patches: Array<{ start: string; end: string; bytes: number; insideNames?: string[] }>;
};

/** Builds the source with one switch changed from its base value; only the ranges of its patches may change. */
async function checkSwitch(row: SourceSwitch, patches: PatchBlock[], files: Array<{ name: string; text: string }>, laid: Layout, baseValues: ReadonlyMap<string, number>, base: { program: Buffer; start: number }): Promise<SwitchCheck> {
  const built = await checkBuild(withValues(files, laid, new Map([...baseValues, [row.name, 1 - row.base]])), patches, base);
  return {
    name: row.name,
    kind: row.kind,
    default: row.default,
    base: row.base,
    patches: patches.map((patch) => {
      const inside = patch.inner.map((address) => laid.names.get(address)!);
      return { start: formatC64Address(patch.start), end: formatC64Address(patch.end), bytes: patch.end - patch.start + 1, ...(inside.length === 0 ? {} : { insideNames: inside }) };
    }),
    ...built,
  };
}

/** What the build of a release gives against the bytes of its file. */
interface ReleaseCheck {
  label: string;
  base: boolean;
  file: string;
  define: string;
  result: "identical" | "different" | "layout differs" | "file changed" | "does not assemble";
  reason?: string;
  segments?: SegmentCheck[];
  diagnostics?: Diagnostic[];
}

/**
 * Builds a release with RELEASE_<label> and compares it with its file. A
 * release whose segments are not the segments of the program has moved code,
 * which patches cannot give: it is shown and does not fail the run.
 */
async function checkRelease(release: ReleaseRow, files: Array<{ name: string; text: string }>, program: ProgramImage): Promise<ReleaseCheck> {
  const shown = { label: release.label, base: release.base, file: release.file, define: `--define ${RELEASE_DEFINE}${release.label}=1` };
  let image: Image;
  try {
    const bytes = readProjectFile(release.file).bytes;
    if (createHash("sha256").update(bytes).digest("hex") !== release.sha256) {
      return { ...shown, result: "file changed", reason: `The SHA-256 of ${release.file} is not the one that the knowledge has. Record the release again (knowledge.ts release), or put back the file.` };
    }
    image = readImage(release.file);
  } catch (error) {
    if (!(error instanceof Refusal || error instanceof WireFailure)) throw error;
    return { ...shown, result: "file changed", reason: error.message };
  }
  if (JSON.stringify(image.segments) !== JSON.stringify(program.segments)) {
    const segments = (list: readonly AddressRange[]) => list.map((segment) => `${formatC64Address(segment.start)}-${formatC64Address(segment.end)}`).join(", ");
    return { ...shown, result: "layout differs", reason: `The release has the segments ${segments(image.segments)}, and the program has ${segments(program.segments)}. Patches change bytes in place; they cannot move code.` };
  }
  const built = await assembleFiles(files, "main.asm", { [`${RELEASE_DEFINE}${release.label}`]: 1 });
  if (built.program === undefined) return { ...shown, result: "does not assemble", diagnostics: built.diagnostics.slice(0, MAX_DIAGNOSTICS) };
  const checked = check(built.program, built.start!, image);
  return { ...shown, result: checked.identical ? "identical" : "different", ...(checked.identical ? {} : { segments: checked.segments.filter((segment) => segment.result !== "identical") }) };
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
    return { verified: differences.length === 0, differences: differences.slice(0, MAX_DIAGNOSTICS) };
  } finally {
    await client.close();
  }
}

/** The platform names that `used` leaves out: the names of the ROMs that the program does not use. */
function leftOutNames(used: ReadonlyArray<{ name: string }>): Set<string> {
  const kept = new Set(used.map((entry) => entry.name));
  return new Set(platformNames().flatMap((entry) => (kept.has(entry.name) ? [] : [entry.name])));
}

/** The first words of every file that the script writes. */
const GENERATED_MARK = "; Generated by c64-source";
/** The file with every range of instructions that no run executed. */
const NOT_EXECUTED_FILE = "not_executed.json";
/** The line of each name and address in the source, for links from the documentation. */
const SOURCE_MAP_FILE = "source-map.json";

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

/** The files of the loader. Only a run with --loader writes them, so only such a run removes them. */
const LOADER_FILES: ReadonlySet<string> = new Set(["loader.asm", "loader.prg"]);

/**
 * Removes the generated .asm files of an earlier run that this run does not
 * write, and an earlier not_executed.json and source-map.json. An earlier
 * loader.asm and loader.prg stay unless this run has --loader: a source of the
 * user can include loader.asm. Other files stay. Gives the names it removed.
 */
function removeOldFiles(out: string, keep: ReadonlySet<string>, loaderRun: boolean): string[] {
  const directory = resolveProjectPath(out);
  if (!existsSync(directory)) return [];
  const removed: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const path = join(directory, name);
    if (LOADER_FILES.has(name) && !loaderRun) continue;
    const old = name === "loader.prg" || name === NOT_EXECUTED_FILE || name === SOURCE_MAP_FILE || (name.endsWith(".asm") && !keep.has(name) && readFileSync(path, "utf8").startsWith(GENERATED_MARK));
    if (!old) continue;
    rmSync(path, { force: true });
    removed.push(name);
  }
  return removed;
}

/** The instructions that Ghidra decoded, and whether the program has known code. */
type DecodedProgram = Awaited<ReturnType<typeof decode>>;

/** How buildSource makes and checks the source of a knowledge. */
interface SourceOptions {
  space: Space;
  /** More entry points for Ghidra. */
  entries: number[];
  header: string[];
  /** The first line of each file, or none. */
  mark?: string;
  /** The switch values of the build that must give the program. */
  values: ReadonlyMap<string, number>;
  /** The instructions of an earlier decode: then Ghidra does not run again. */
  decoded?: DecodedProgram;
  /** Mark the code that no run executed. Without the marks, the coverage only gives the seeds of Ghidra and the ROM use. */
  notExecutedMarks: boolean;
  /** With an entry state, the loader is planned too. */
  state?: EntryState;
  loaderHeader?: string[];
}

/**
 * The source of a knowledge: the layout, the rendered files and the build
 * with the switch values. An operand expression that ACME refuses or assembles to
 * other bytes is written as its number, and a macro use as its instructions;
 * then the source is assembled again.
 */
async function buildSource(knowledge: SourceKnowledge, options: SourceOptions) {
  const { space } = options;
  const image = knowledge.program;
  const coverage = knowledge.coverage;
  const romUse = romUseOfProgram(coverage, image.state);
  const platform = platformNamesFor(romUse);
  const { instructions, dataOnly } = options.decoded ?? (await decode(image, knowledge, options.entries, coverage));
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
    switches: knowledge.switches,
    releases: knowledge.releases.map((release) => ({ label: release.label, file: release.file, base: release.base, ...(release.comment === undefined ? {} : { comment: release.comment }) })),
    macros: knowledge.macros,
    macroUses: knowledge.macroUses,
    ...(coverage === undefined || !options.notExecutedMarks ? {} : { coverage }),
    // The platform names are C64 names: drive code and banks get none. A ROM that the program does not use gives none.
    ...(space === DEFAULT_SPACE ? { platform, platformLeftOut: leftOutNames(platform), describe: describeAddress, decode: decodeRegister } : {}),
  });
  const asBytes = await probe(laid);
  const { header } = options;
  let loader: LoaderPlan | undefined;
  // An image without its entry has no program: the source is still written and checked, but the run fails.
  const missingEntry = entryOutsideImage(image.entry, image.segments);
  // A loader that cannot be planned does not stop the source: the source is written and checked, and the result says why.
  const { state } = options;
  let loaderRefused: string | undefined = state === undefined ? undefined : missingEntry;
  if (state !== undefined && missingEntry === undefined) {
    const segments = image.segments.map((segment) => ({ ...segment, files: laid.pieces.filter((piece) => piece.start >= segment.start && piece.start <= segment.end).map((piece) => piece.file) }));
    try {
      const entryName = laid.names.get(image.entry!);
      loader = planLoader({ segments, byteAt: image.byteAt, state, entry: image.entry!, ...(entryName === undefined ? {} : { entryName }), switches: hasSwitchFile(laid), macros: laid.macros.length > 0, header: options.loaderHeader ?? [] });
    } catch (error) {
      if (!(error instanceof WireFailure)) throw error;
      loaderRefused = error.message;
    }
  }
  // With a mark, every file starts with it.
  const { mark } = options;
  const marked = (list: Array<{ name: string; text: string }>) => (mark === undefined ? list : list.map((file) => (file.name === CONFIG_FILE ? file : { ...file, text: `${mark}\n${file.text}` })));
  const markLines = mark === undefined ? 0 : 1;
  const loaderFiles = loader === undefined ? [] : [{ name: "loader.asm", text: loader.text }];
  const numbers = new Map<number, string>();
  const asInstructions = new Map<number, string>();
  let rendered = render(laid, asBytes, header, numbers, asInstructions);
  if (laid.macroUses.size > 0) for (const [start, reason] of await probeUses(laid, rendered, image)) asInstructions.set(start, reason);
  if (asInstructions.size > 0) rendered = render(laid, asBytes, header, numbers, asInstructions);
  let files = marked([...rendered.files, ...loaderFiles]);
  let built = await assembleFiles(withValues(files, laid, options.values), "main.asm");
  for (let round = 0; round < ROUNDS && (rendered.expressions.length > 0 || rendered.uses.length > 0); round++) {
    const blamed = blame(rendered, built, image, markLines);
    if (blamed.numbers.size === 0 && blamed.uses.size === 0) break;
    for (const [address, reason] of blamed.numbers) numbers.set(address, reason);
    for (const [start, reason] of blamed.uses) asInstructions.set(start, reason);
    rendered = render(laid, asBytes, header, numbers, asInstructions);
    files = marked([...rendered.files, ...loaderFiles]);
    built = await assembleFiles(withValues(files, laid, options.values), "main.asm");
  }
  return { romUse, instructions, dataOnly, laid, rendered, files, built, loader, missingEntry, loaderRefused };
}

/**
 * Assembles loader.asm with the switch values and simulates its copies: the
 * loader as it loads, then every copy in its order, byte by byte. A layout
 * other than the plan is a defect of the script.
 */
async function buildLoader(files: Array<{ name: string; text: string }>, laid: Layout, loader: LoaderPlan, image: ProgramImage, state: EntryState, values: ReadonlyMap<string, number>): Promise<{ program: Buffer; symbols: AssembledSymbol[]; jump: number; copierSource: number; expected: (address: number) => number } | { diagnostics: Diagnostic[] }> {
  const loaderBuilt = await assembleFiles(withValues(files, laid, values), "loader.asm");
  if (loaderBuilt.program === undefined) return { diagnostics: loaderBuilt.diagnostics.slice(0, MAX_DIAGNOSTICS) };
  const program = loaderBuilt.program;
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
  const symbolValue = (name: string) => {
    const symbol = loaderBuilt.symbols?.find((item) => item.name === name);
    if (symbol === undefined) throw new WireFailure("operation-failed", `The assembled loader has no ${name} label. This is a defect of the c64-source script.`);
    return symbol.kind === "address" ? symbol.address : symbol.value;
  };
  const jump = symbolValue(LOADER_JUMP);
  const wrong = simulate(memory, loader.copies, expected);
  if (wrong !== undefined) throw new WireFailure("operation-failed", `The simulated loader writes a wrong byte at ${formatC64Address(wrong)}. This is a defect of the c64-source script.`);
  return { program, symbols: loaderBuilt.symbols ?? [], jump, copierSource: symbolValue(COPIER_SOURCE), expected };
}

/** The first line of each file that generate writes. */
const GENERATED_LINE = `${GENERATED_MARK}. Do not edit: change the knowledge and generate again.`;

async function generate(call: Call): Promise<{ output: Record<string, unknown>; failed: boolean; removed: string[] }> {
  const out = call.string("out")!;
  const entries = call.addresses("entry");
  const max = call.count("max-listed")!;
  const space = call.space;
  const loaderWanted = call.flag("loader");
  if (space !== DEFAULT_SPACE && loaderWanted) throw new UsageError("--loader works only in space c64");
  const knowledge = readKnowledge(space, call.flag("analyzer-names"));
  const image = knowledge.program;
  if (loaderWanted && (image.state === undefined || image.entry === undefined)) {
    throw new Refusal("not-found", "--loader needs the entry and the entry state of a c64-unpacker capture in the knowledge: put the capture in with knowledge.ts image <image.json>");
  }
  // Read the entry state before the long steps, so a bad state stops the run at once.
  const state = loaderWanted ? loaderState(image.state, "the entry state of the knowledge") : undefined;
  // Every build that is compared with the program is the build of the base release: each switch at its base value.
  const baseValues = new Map(knowledge.switches.map((row) => [row.name, row.base]));
  const header = [`Generated by c64-source from knowledge revision ${knowledge.revision}${space === DEFAULT_SPACE ? "" : ` in space ${space}`}.`, "Change names, comments, regions and modules in knowledge, then generate again."];
  const loaderHeader = [`Loader generated by c64-source from knowledge revision ${knowledge.revision}.`, "It copies the segments into place, sets the entry state and jumps to the entry."];
  const { romUse, dataOnly, laid, rendered, files, built, loader, missingEntry, loaderRefused } = await buildSource(knowledge, {
    space,
    entries,
    header,
    mark: GENERATED_LINE,
    values: baseValues,
    notExecutedMarks: true,
    ...(state === undefined ? {} : { state, loaderHeader }),
  });
  // config.asm keeps the value of each switch that it already has: the user sets the switches there.
  const configPath = resolveProjectPath(`${out}/${CONFIG_FILE}`);
  const given = existsSync(configPath) ? configValues(readFileSync(configPath, "utf8")) : new Map<string, 0 | 1>();
  const kept = new Map(laid.switches.flatMap((row) => (given.has(row.name) ? [[row.name, given.get(row.name)!] as const] : [])));
  const notDefault = laid.switches.flatMap((row) => (kept.has(row.name) && kept.get(row.name) !== row.default ? [{ name: row.name, value: kept.get(row.name)!, default: row.default }] : []));
  const removed = removeOldFiles(out, new Set(files.map((file) => file.name)), loaderWanted).map((name) => `${out}/${name}`);
  const written: Written[] = withValues(files, laid, kept).map((file) => writeReported(`${out}/${file.name}`, file.text, { what: "--out" }));
  written.push(writeReported(`${out}/${SOURCE_MAP_FILE}`, sourceMapText(rendered, space, knowledge.revision, files), { what: "--out" }));
  const showRange = (range: AddressRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
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
    written.push(writeReported(`${out}/${NOT_EXECUTED_FILE}`, `${JSON.stringify(all, null, 2)}\n`, { what: "--out" }));
  }

  const output: Record<string, unknown> = {
    out,
    files: written,
    sourceMap: `${out}/${SOURCE_MAP_FILE}`,
    // The values that config.asm keeps and that are not the default: a build of the source is not the default build.
    ...(notDefault.length === 0 ? {} : { config: { file: `${out}/${CONFIG_FILE}`, notDefault } }),
    revision: knowledge.revision,
    instructions: rendered.instructions,
    dataBytes: rendered.dataBytes,
    ...(rendered.undecodedBytes === 0 ? {} : { undecodedBytes: rendered.undecodedBytes }),
    // The ROM names that the source leaves out, and the evidence.
    ...(space !== DEFAULT_SPACE || (romUse.basic && romUse.kernal) ? {} : { romNamesLeftOut: { roms: [...(romUse.basic ? [] : ["BASIC"]), ...(romUse.kernal ? [] : ["KERNAL"])], ...(romUse.basic || romUse.kernal ? {} : { systemArea: true }), from: romUse.from } }),
    ...(missingEntry === undefined ? {} : { entryOutside: { entry: formatC64Address(image.entry!), reason: missingEntry } }),
    ...(dataOnly ? { dataOnly: DATA_ONLY } : {}),
    labels: { named: laid.namedLabels, generated: laid.generatedLabels },
    // An --entry in a data region decodes nothing: the result says so, and a code region in the knowledge changes it.
    ...(inData.length === 0
      ? {}
      : { entriesInData: inData.map(({ entry, region }) => ({ entry: formatC64Address(entry), region: { ...showRange(region), type: region.type }, origin: region.origin })) }),
    ...(rendered.asBytes.length === 0
      ? {}
      : { asBytes: listed(rendered.asBytes, max, (item) => ({ address: formatC64Address(item.address), instruction: item.text })) }),
    ...(rendered.notExecuted === undefined
      ? {}
      : {
          notExecuted: { instructions: rendered.notExecuted.instructions, ...listed(rendered.notExecuted.ranges, max, showRange, `${out}/${NOT_EXECUTED_FILE}`) },
        }),
    ...(laid.unusedModules.length === 0 ? {} : { unusedModules: laid.unusedModules.map((module) => ({ start: formatC64Address(module.start), file: module.file })) }),
    ...(rendered.expressions.length === 0 && rendered.operandsAsNumbers.length === 0 ? {} : { operandExpressions: rendered.expressions.length }),
    ...(rendered.operandsAsNumbers.length === 0
      ? {}
      : {
          operandsAsNumbers: listed(rendered.operandsAsNumbers, max, (item) => ({ address: formatC64Address(item.address), expression: item.expression, reason: item.reason })),
        }),
    ...(rendered.uses.length === 0 && rendered.macrosAsInstructions.length === 0 ? {} : { macroUses: rendered.uses.length }),
    // A macro use that the source writes as its instructions does not fail the run: the source stays identical.
    ...(rendered.macrosAsInstructions.length === 0
      ? {}
      : {
          macrosAsInstructions: listed(rendered.macrosAsInstructions, max, (item) => ({ start: formatC64Address(item.start), end: formatC64Address(item.end), macro: item.macro, reason: item.reason })),
        }),
    // A patch that the source cannot write fails the run: the switch would miss a part.
    ...(laid.patchesNotWritten.length === 0
      ? {}
      : {
          patchesNotWritten: listed(laid.patchesNotWritten, max, (item) => ({ start: formatC64Address(item.start), end: formatC64Address(item.end), switch: item.switch, reason: item.reason })),
        }),
  };
  // The loader includes the source, so it is built only from a source that is identical to the image.
  const notBuilt = (reason: string) => (state === undefined ? {} : { loader: { verified: false, reason: loaderRefused ?? reason } });
  if (built.program === undefined) {
    return { output: { ...output, check: { identical: false, diagnostics: built.diagnostics.slice(0, MAX_DIAGNOSTICS) }, ...notBuilt("The source does not assemble, and the loader includes it.") }, removed, failed: true };
  }
  const checked = check(built.program, built.start!, image);
  output.check = checked;
  if (!checked.identical) return { output: { ...output, ...notBuilt("The source does not assemble to the image, and the loader includes it.") }, removed, failed: true };
  const baseBuild = { program: built.program, start: built.start! };
  // Each switch alone at the value that the base release does not have, against the base release.
  const switches: SwitchCheck[] = [];
  const withPatches = switchesOf(laid);
  for (const row of laid.switches) {
    const patches = withPatches.get(row.name);
    if (patches !== undefined) switches.push(await checkSwitch(row, patches, files, laid, baseValues, baseBuild));
  }
  if (switches.length > 0) output.switches = switches;
  // The default build: the patches of each switch whose default is not its base value are in, and nothing else changes.
  let defaultFailed = false;
  if (laid.switches.length > 0) {
    const changed = laid.switches.filter((row) => row.default !== row.base);
    const ranges = changed.flatMap((row) => withPatches.get(row.name) ?? []);
    const built = await checkBuild(withValues(files, laid, new Map()), ranges, baseBuild);
    output.default = { in: changed.map((row) => row.name), ...built };
    defaultFailed = built.result !== "fits";
  }
  // Each release built with its switch values, against its file.
  const releases: ReleaseCheck[] = [];
  for (const release of knowledge.releases) releases.push(await checkRelease(release, files, image));
  if (releases.length > 0) output.releases = releases;
  const releasesFailed = releases.some((item) => item.result !== "identical" && (item.base || item.result !== "layout differs"));
  const sourceFailed = laid.patchesNotWritten.length > 0 || switches.some((item) => item.result !== "fits") || defaultFailed || releasesFailed;
  if (loaderRefused !== undefined) return { output: { ...output, loader: { verified: false, reason: loaderRefused } }, removed, failed: true };
  if (loader === undefined || state === undefined) return { output, removed, failed: missingEntry !== undefined || sourceFailed };

  // The entry state is the state of the base release: the loader is built and checked with it.
  const loaderBuilt = await buildLoader(files, laid, loader, image, state, baseValues);
  if ("diagnostics" in loaderBuilt) return { output: { ...output, loader: { verified: false, reason: "loader.asm does not assemble.", diagnostics: loaderBuilt.diagnostics } }, removed, failed: true };
  const { program, jump, copierSource, expected } = loaderBuilt;
  const loaderPath = `${out}/loader.prg`;
  written.push(writeReported(loaderPath, program, { what: "--out" }));
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
  return { output, removed, failed: !ran.verified || sourceFailed };
}

/** The value of a switch in an export: fixes, trainers and cheats are in; protection and crack changes are out; a change keeps its default. */
function exportValue(row: SourceSwitch): 0 | 1 {
  if (row.kind === "change") return row.default;
  return row.kind === "fix" || row.kind === "trainer" || row.kind === "cheat" ? 1 : 0;
}

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** The entry of a PRG without one in the knowledge: the address of the first SYS of its BASIC line, when the image holds it. */
function basicEntry(image: ProgramImage): number | undefined {
  const first = image.segments[0];
  if (first === undefined) return undefined;
  const tokenized = parseTokenized(Uint8Array.from([first.start & 0xff, first.start >> 8, ...image.memory.subarray(first.start, first.end + 1)]));
  if ("reason" in tokenized) return undefined;
  const sys = findHandoffs(tokenized.lines).find((handoff) => handoff.kind === "sys" && "address" in handoff);
  const address = sys !== undefined && "address" in sys ? sys.address : undefined;
  return address !== undefined && image.segments.some((segment) => address >= segment.start && address <= segment.end) ? address : undefined;
}

/** The parts of a region outside the holes. A part that is not the whole region has no element size: its length need not be a multiple of it. */
function clipped<R extends { start: number; end: number; element?: number }>(region: R, holes: readonly AddressRange[]): R[] {
  return subtract(region, [...holes]).map((piece) => {
    if (piece.start === region.start && piece.end === region.end) return region;
    const part = { ...region, ...piece };
    delete part.element;
    return part;
  });
}

/** The regions that decide the memory map: the user and LLM regions, and the parts of analyzer regions outside them. */
function effectiveRegions(regions: SourceKnowledge["regions"]): SourceKnowledge["regions"] {
  const semantic = regions.filter((region) => isSemantic(region.origin));
  const holes = semantic.map((region) => ({ start: region.start, end: region.end }));
  return [...semantic, ...regions.filter((region) => !isSemantic(region.origin)).flatMap((region) => clipped(region, holes))].sort((a, b) => a.start - b.start);
}

/** Every file in a folder with its path in it, with / between the parts, in path order. `skip` leaves out a folder by its path. */
function filesIn(root: string, skip: (path: string) => boolean, folder = ""): Array<{ path: string; bytes: Buffer }> {
  const found: Array<{ path: string; bytes: Buffer }> = [];
  for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
    const path = folder === "" ? entry.name : `${folder}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!skip(path)) found.push(...filesIn(root, skip, path));
    } else if (entry.isFile()) found.push({ path, bytes: readFileSync(join(root, path)) });
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * export: the program of the knowledge as the start of a new program, in a
 * new project folder and a zip file of it. Every switch is fixed at its export
 * value, code and data that nothing uses become free ($00), the source has no
 * mark, no switches and no not-executed marks, and the knowledge keeps the
 * program, the entry, the names, the comments and the memory map. Nothing is
 * written until every check passes.
 */
async function exportProject(call: Call): Promise<Record<string, unknown>> {
  const project = projectRoot();
  const { root: to, zip } = newProjectFolder(call.string("to")!, project);
  const name = call.string("name") ?? basename(to);
  if (!NAME_PATTERN.test(name)) throw new UsageError(`--name ${name}: a name has letters, digits, dots, underscores and hyphens, and starts with a letter or a digit. Give --name`);
  const keep = call.ranges("keep");
  const drop = call.ranges("drop");
  const max = call.count("max-listed")!;
  const shownRange = (range: AddressRange) => ({ start: formatC64Address(range.start), end: formatC64Address(range.end) });
  const fromProject = (path: string) => relative(project, path).split(sep).join("/");

  const db = openForRead();
  const spacesLeftOut = (() => {
    try {
      return listSpaces(db).filter((space) => space !== DEFAULT_SPACE);
    } finally {
      db?.close();
    }
  })();
  const knowledge = readKnowledge(DEFAULT_SPACE);
  const image = knowledge.program;
  const state = image.state === undefined || image.entry === undefined ? undefined : loaderState(image.state, "the entry state of the knowledge");

  // 1. The source of the knowledge must give the base release byte for byte, with every patch in it.
  const baseValues = new Map(knowledge.switches.map((row) => [row.name, row.base]));
  const original = await buildSource(knowledge, { space: DEFAULT_SPACE, entries: [], header: [], values: baseValues, notExecutedMarks: false });
  const fix = "Run source.ts generate, correct the knowledge until generate gives PASS, then export again.";
  if (original.built.program === undefined) return { result: "FAIL", stage: "original", reason: `The source of the knowledge does not assemble. ${fix}`, diagnostics: original.built.diagnostics.slice(0, MAX_DIAGNOSTICS) };
  const checked = check(original.built.program, original.built.start!, image);
  if (!checked.identical) return { result: "FAIL", stage: "original", reason: `The source of the knowledge does not assemble to the program. ${fix}`, check: checked };
  if (original.missingEntry !== undefined) return { result: "FAIL", stage: "original", reason: original.missingEntry };
  if (original.laid.patchesNotWritten.length > 0) {
    return { result: "FAIL", stage: "original", reason: `The source cannot write every patch. ${fix}`, patchesNotWritten: listed(original.laid.patchesNotWritten, max, (item) => ({ ...shownRange(item), switch: item.switch, reason: item.reason })) };
  }

  // 2. Each switch at its export value. Two alternatives of one range cannot both be in.
  const values = new Map(knowledge.switches.map((row) => [row.name, exportValue(row)]));
  for (const patch of original.laid.patches.values()) {
    const both = patch.alternatives.filter((alternative) => values.get(alternative.switch) !== alternative.base);
    if (both.length > 1) {
      throw new Refusal("invalid-input", `The switches ${both.map((item) => item.switch).join(" and ")} change ${formatC64Address(patch.start)}-${formatC64Address(patch.end)} in different ways, and the export puts both in. Give all but one of them the kind change with --default and the value of the base release (knowledge.ts switch), then export again.`);
    }
  }
  const withPatches = switchesOf(original.laid);
  const changedSwitches = knowledge.switches.filter((row) => values.get(row.name) !== row.base);
  const patchesIn = changedSwitches.flatMap((row) => withPatches.get(row.name) ?? []);
  const baked = await assembleFiles(withValues(original.files, original.laid, values), "main.asm");
  const bakedCheck = compareBuilds(baked, patchesIn, { program: original.built.program, start: original.built.start! });
  const switches = knowledge.switches.map((row) => ({ name: row.name, kind: row.kind, base: row.base, value: values.get(row.name)! }));
  if (bakedCheck.result !== "fits" || baked.program === undefined) return { result: "FAIL", stage: "switches", reason: "The build with the export values of the switches does not fit. Build each switch alone with source.ts generate and correct its patches.", switches, build: bakedCheck };

  // 3. The baked image: the bytes of that build in the segments of the program.
  const memory = Uint8Array.from(image.memory);
  for (const segment of image.segments) for (let address = segment.start; address <= segment.end; address++) memory[address] = baked.program[2 + address - baked.start!]!;
  const changed = patchesIn.filter((patch) => {
    for (let address = patch.start; address <= patch.end; address++) if (memory[address] !== image.byteAt(address)) return true;
    return false;
  });
  const bakedImage: ProgramImage = { space: DEFAULT_SPACE, segments: image.segments, memory, byteAt: (address) => memory[address]!, ...(image.entry === undefined ? {} : { entry: image.entry }), ...(image.state === undefined ? {} : { state: image.state }) };
  const decoded = await decode(bakedImage, knowledge, [], knowledge.coverage);

  // 4. The free ranges.
  const addressOf = new Map(knowledge.symbols.map((symbol) => [symbol.name, symbol.address]));
  const operandTargets = new Map<number, number[]>();
  for (const operand of knowledge.operands) {
    const names = operand.symbol !== undefined ? [operand.symbol] : identifiers(operand.expression ?? "");
    const targets = names.flatMap((item) => (addressOf.has(item) ? [(addressOf.get(item)! + (operand.symbol !== undefined ? operand.offset : 0)) & 0xffff] : []));
    if (targets.length > 0) operandTargets.set(operand.address, targets);
  }
  const regions = effectiveRegions(knowledge.regions);
  const entry = image.entry ?? basicEntry(image);
  const plan = planDrops({
    segments: image.segments,
    memory,
    ...(entry === undefined ? {} : { entry }),
    instructions: decoded.instructions,
    ...(knowledge.coverage === undefined ? {} : { coverage: knowledge.coverage }),
    regions,
    references: knowledge.references,
    operandTargets,
    changed,
    keep,
    drop,
    routines: knowledge.symbols.filter((symbol) => symbol.kind === "routine"),
  });
  const free = plan.free;
  const inFree = (address: number) => free.some((range) => address >= range.start && address <= range.end);
  const overlapsAny = (start: number, end: number, ranges: readonly AddressRange[]) => ranges.some((range) => start <= range.end && range.start <= end);
  for (const range of free) memory.fill(0, range.start, range.end + 1);

  // 5. The knowledge of the export: the baked program with the free ranges, without patches, switches and releases.
  const revision = knowledge.revision ?? "";
  const taken = new Set(knowledge.symbols.map((symbol) => symbol.name));
  const freeSymbols = free.filter((range) => !taken.has(freeName(range))).map((range) => ({ space: DEFAULT_SPACE, address: range.start, name: freeName(range), kind: "label" as const, origin: "llm" as const, revision }));
  const lineComments = new Map<number, string>();
  for (const range of free) lineComments.set(range.start, `Free: ${range.end - range.start + 1} bytes of ${range.what} that nothing uses. The export made them $00.`);
  for (const row of changedSwitches) {
    for (const patch of withPatches.get(row.name) ?? []) {
      if (!changed.includes(patch)) continue;
      const alternative = patch.alternatives.find((item) => item.switch === row.name);
      const text = [`${row.name} (${row.kind}) is ${values.get(row.name)} in the export.`, row.comment, alternative?.comment].filter((part) => part !== undefined && part !== "").join(" ");
      lineComments.set(patch.start, lineComments.has(patch.start) ? `${lineComments.get(patch.start)} ${text}` : text);
    }
  }
  const keptComments = knowledge.comments.filter((comment) => !inFree(comment.address));
  const comments = [
    ...keptComments.map((comment) => (comment.placement === "line" && lineComments.has(comment.address) ? { ...comment, text: `${comment.text} ${lineComments.get(comment.address)}` } : comment)),
    ...[...lineComments].filter(([address]) => !keptComments.some((comment) => comment.placement === "line" && comment.address === address)).map(([address, text]) => ({ space: DEFAULT_SPACE, address, placement: "line" as const, text, origin: "llm" as const, revision })),
  ].sort((a, b) => a.address - b.address);
  const freeHoles = free.map((range) => ({ start: range.start, end: range.end }));
  const clip = <R extends { start: number; end: number; element?: number }>(region: R): R[] => clipped(region, freeHoles);
  const exportRegions = [...regions.flatMap(clip), ...free.map((range) => ({ space: DEFAULT_SPACE, start: range.start, end: range.end, type: "unused" as const, origin: "llm" as const, revision }))].sort((a, b) => a.start - b.start);
  const derived: SourceKnowledge = {
    ...knowledge,
    program: { ...bakedImage, byteAt: (address) => memory[address]! },
    symbols: [...knowledge.symbols.filter((symbol) => !inFree(symbol.address)), ...freeSymbols].sort((a, b) => a.address - b.address),
    routines: knowledge.routines.filter((address) => !inFree(address)),
    regions: [...knowledge.regions.flatMap(clip), ...exportRegions.filter((region) => region.type === "unused" && free.some((range) => range.start === region.start))],
    comments,
    references: knowledge.references.filter((reference) => !inFree(reference.from) && !inFree(reference.to) && !overlapsAny(reference.from, reference.from, changed)),
    operands: knowledge.operands.filter((operand) => !inFree(operand.address) && !overlapsAny(operand.address, operand.address, changed)),
    macroUses: knowledge.macroUses.filter((use) => !overlapsAny(use.start, use.end, [...changed, ...free])),
    patches: [],
    switches: [],
    releases: [],
  };
  const instructions = new Map([...decoded.instructions].filter(([address, length]) => !overlapsAny(address, address + length - 1, free)));
  const header = [`${name}: the start of a new program, exported from ${basename(project)} at knowledge revision ${knowledge.revision}.`, "You own this source: change it as you like."];
  const exported = await buildSource(derived, {
    space: DEFAULT_SPACE,
    entries: [],
    header,
    values: new Map(),
    decoded: { instructions, dataOnly: decoded.dataOnly },
    notExecutedMarks: false,
    ...(state === undefined ? {} : { state, loaderHeader: [`The loader of ${name}.`, "It copies the segments into place, sets the entry state and jumps to the entry."] }),
  });
  if (exported.built.program === undefined) return { result: "FAIL", stage: "export", reason: "The source of the export does not assemble. This is a defect of the c64-source script.", diagnostics: exported.built.diagnostics.slice(0, MAX_DIAGNOSTICS) };
  const exportCheck = check(exported.built.program, exported.built.start!, derived.program);
  if (!exportCheck.identical) return { result: "FAIL", stage: "export", reason: "The source of the export does not assemble to the exported program. This is a defect of the c64-source script.", check: exportCheck };

  // 6. The loader of a capture: planned and simulated. The tests of the new project run it.
  let baseline = { program: exported.built.program, symbols: exported.built.symbols ?? [], entryFile: "main.asm" };
  let loaderOutput: Record<string, unknown> | undefined;
  if (state !== undefined) {
    if (exported.loader === undefined) return { result: "FAIL", stage: "loader", reason: exported.loaderRefused ?? "The loader could not be planned." };
    const loaderBuilt = await buildLoader(exported.files, exported.laid, exported.loader, derived.program, state, new Map());
    if ("diagnostics" in loaderBuilt) return { result: "FAIL", stage: "loader", reason: "loader.asm does not assemble. This is a defect of the c64-source script.", diagnostics: loaderBuilt.diagnostics };
    baseline = { program: loaderBuilt.program, symbols: loaderBuilt.symbols, entryFile: "loader.asm" };
    loaderOutput = {
      copies: exported.loader.copies.map((copy) => ({ what: copy.what, to: `${formatC64Address(copy.target.start)}-${formatC64Address(copy.target.end)}` })),
      copier: formatC64Address(exported.loader.copier),
      stackByte: formatC64Address(exported.loader.stackByte),
      simulated: true,
      ...(loaderLimits(exported.loader).length === 0 ? {} : { limits: loaderLimits(exported.loader) }),
    };
  }
  const shownSymbols = baseline.symbols.filter((symbol) => symbol.kind === "address" || symbol.used);

  // 7. The tests of the project, changed for the new project.
  const testsFolder = join(project, "tests");
  const testFiles = existsSync(testsFolder) ? readdirSync(testsFolder, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort() : [];
  const symbolMap = new Map(shownSymbols.map((symbol) => [symbol.name, symbol.kind === "address" ? symbol.address : symbol.value]));
  const tests: Array<{ file: string; kind: "scenario" | "run"; text: string }> = [];
  const testsLeftOut: Array<{ file: string; reason: string }> = [];
  for (const file of testFiles) {
    const rewritten = rewriteTest(readFileSync(join(testsFolder, file), "utf8"), name, symbolMap, free);
    if ("reason" in rewritten) testsLeftOut.push({ file: `tests/${file}`, reason: rewritten.reason });
    else tests.push({ file: `tests/${file}`, kind: rewritten.kind, text: rewritten.text });
  }

  // 8. Write the new project, then the zip of it. The knowledge goes first: withWrite tries it in memory before it makes the folder.
  const memoryRowsOf = memoryRows(derived.program.segments, derived.program.byteAt);
  const kept = { symbols: derived.symbols.length, comments: comments.length, regions: exportRegions.length, modules: knowledge.modules.length };
  withWrite(
    (index) =>
      write(index, { origin: "llm", description: `Export of ${basename(project)} at knowledge revision ${knowledge.revision}` }, "export", (change) => {
        for (const [address, bytes] of [...memoryRowsOf].sort(([a], [b]) => a - b)) change.insertMemory({ space: DEFAULT_SPACE, address, bytes, origin: "llm" });
        if (image.entry !== undefined) change.insertEntry({ space: DEFAULT_SPACE, address: image.entry, state: image.state === undefined ? null : JSON.stringify(image.state), stages: null, origin: "llm" });
        for (const { revision: _revision, ...symbol } of derived.symbols) change.insertSymbol(symbol);
        for (const { revision: _revision, ...comment } of comments) change.insertComment(comment);
        for (const { revision: _revision, ...region } of exportRegions) change.insertRegion(region);
        for (const { revision: _revision, ...module } of knowledge.modules) change.insertModule(module);
      }),
    to,
  );
  const put = (path: string, data: Uint8Array | string) => writeReported(path, data, { root: to, what: "--to" });
  const files: Written[] = [];
  files.push(
    put(
      "README.md",
      readmeText({ name, project: basename(project), revision: knowledge.revision, date: isoCet().slice(0, 10), entryFile: baseline.entryFile, free, switches, tests: { written: tests.map(({ file, kind }) => ({ file, kind })), leftOut: testsLeftOut } }),
    ),
  );
  for (const file of exported.files) files.push(put(`src/${file.name}`, file.text));
  files.push(put(`baseline/${name}.prg`, baseline.program), put(`baseline/${name}.json`, symbolsFileText(shownSymbols)));
  for (const test of tests) files.push(put(test.file, test.text));
  ensureLocal(to);
  const folder = basename(to);
  const archive = zipFiles(filesIn(to, (path) => path === `${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}`).map((file) => ({ path: `${folder}/${file.path}`, bytes: file.bytes })));
  writeFileSync(zip, archive);
  const zipWritten: Written = { out: fromProject(zip), bytes: archive.length, sha256: createHash("sha256").update(archive).digest("hex") };

  const freeBytes = free.reduce((sum, range) => sum + range.end - range.start + 1, 0);
  return {
    result: "PASS",
    to: fromProject(to),
    zip: zipWritten,
    source: { project: basename(project), revision: knowledge.revision },
    files: listed(files.map((file) => ({ ...file, out: fromProject(join(to, file.out)) })), max, (file) => file, "the folder of the new project"),
    switches,
    check: exportCheck,
    ...(loaderOutput === undefined ? {} : { loader: loaderOutput }),
    ...(plan.rooted ? {} : { unrooted: "The knowledge has no entry, the program has no BASIC line with SYS, and the image does not hold the hardware vectors. Thus no code is unreachable, and nothing became free by itself." }),
    ...(knowledge.coverage === undefined ? { noCoverage: "The knowledge has no coverage, so nothing became free by itself. Only --drop makes a range free." } : {}),
    free: { bytes: freeBytes, ...listed(free, max, (range) => ({ ...shownRange(range), bytes: range.end - range.start + 1, what: range.what, label: freeName(range) })) },
    unreachableExecuted: listed(plan.unreachableExecuted, max, (range) => ({ ...shownRange(range), ...(range.routine === undefined ? {} : { routine: range.routine }), drop: `--drop '${formatC64Address(range.start)}-${formatC64Address(range.end)}'` })),
    knowledge: kept,
    tests: { written: tests.map((test) => test.file), leftOut: listed(testsLeftOut, max, (item) => item) },
    ...(spacesLeftOut.length === 0 ? {} : { spacesLeftOut }),
    ...(exported.rendered.operandsAsNumbers.length === 0 ? {} : { operandsAsNumbers: listed(exported.rendered.operandsAsNumbers, max, (item) => ({ address: formatC64Address(item.address), expression: item.expression, reason: item.reason })) }),
    ...(exported.rendered.macrosAsInstructions.length === 0 ? {} : { macrosAsInstructions: listed(exported.rendered.macrosAsInstructions, max, (item) => ({ start: formatC64Address(item.start), end: formatC64Address(item.end), macro: item.macro, reason: item.reason })) }),
  };
}

await runScript({
  name: "source",
  summary: "Generates ACME source from the program and the knowledge, and checks with ACME that it assembles to the program byte by byte.",
  names: knowledgeNames,
  commands: [
    {
      name: "generate",
      summary: "Writes the source files, source-map.json and not_executed.json, and checks them. result is PASS when every check passes, else FAIL.",
      options: {
        out: { ...OPTIONS.out, output: "folder", value: "<dir>", help: "the folder for the source files, relative to the project folder", required: true },
        entry: { ...OPTIONS.entry, multiple: true, help: "an entry point for Ghidra" },
        space: { ...OPTIONS.space, help: "the knowledge space of the program: c64 (the default), drive8, or bank0 to bank255. The coverage and --loader are for c64 only" },
        loader: { kind: "flag", help: "also write loader.asm and loader.prg: the loader copies the segments into place, sets the entry state of the knowledge, and jumps to the entry. It is checked in the emulator" },
        "analyzer-names": { kind: "flag", help: "name an address that has no name of the user or the LLM, and no platform name, with its analyzer name" },
        "max-listed": OPTIONS["max-listed"],
      },
      notes: "The program, its entry state and the coverage come from the knowledge: put them in with knowledge.ts image and coverage of the c64-knowledge skill. Code that no imported run executed is marked and listed, and <dir>/not_executed.json has all of its ranges. Without --analyzer-names, an address without a name gets a name of the source, for example l_17e2.",
      run: async (call) => {
        const { output, failed, removed } = await generate(call);
        // A file of an earlier run that this run removed and did not write again.
        const written = new Set((output.files as Written[]).map((file) => file.out));
        const gone = removed.filter((path) => !written.has(path));
        return { result: failed ? "FAIL" : "PASS", ...output, ...(gone.length === 0 ? {} : { removed: gone }) };
      },
    },
    {
      name: "export",
      summary: "Writes the program of the knowledge as the start of a new program: a new project folder with the source, a baseline program, the tests and a slim knowledge, and a zip file of the folder. Each switch is fixed at its export value, and code and data that nothing uses become free. result is PASS when the export is written, else FAIL with the stage that failed.",
      options: {
        to: { kind: "text", value: "<folder>", required: true, help: "the folder of the new project, relative to the project folder, for example ../game-new. It must be new or empty, and outside every project. The zip file is <folder>.zip beside it" },
        name: { kind: "text", value: "<name>", help: "the name of the program files baseline/<name>.prg and build/<name>.prg. The default is the name of the folder" },
        keep: { ...OPTIONS.range, multiple: true, help: "a range that stays, also when nothing uses it" },
        drop: { ...OPTIONS.range, multiple: true, help: "a range that becomes free: code that the entry does not reach (see unreachableExecuted), or data. Nothing that stays may go to it or read it" },
        "max-listed": OPTIONS["max-listed"],
      },
      notes: "Fixes, trainers and cheats are in, protection and crack changes are out, and a change keeps its default. Code becomes free only when no run executed it and nothing reaches it; data only when no run touched it and nothing names it. Charset, sprite, bitmap and screen data stay unless --drop names them. Addresses do not move: a free range is $00 with a label free_xxxx. The export needs coverage in the knowledge to make ranges free by itself.",
      run: (call) => exportProject(call),
    },
  ],
});
