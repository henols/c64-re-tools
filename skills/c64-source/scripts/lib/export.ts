// The parts of an export that need no tool: which ranges of the baked program
// become free, how the tests of the project change for the new project, and
// the README of the new project.
//
// A range becomes free only when no run executed or read it and nothing that
// stays reaches it. The reachability runs two times over the blocks of the
// decoded instructions. Pass A starts at the entry and the hardware vectors:
// it tells what the program can reach. Pass B also starts at each block that
// a run executed, at --keep and at the patches that the export changed: it
// tells what stays. Without coverage nothing becomes free by itself.

import { type AddressRange, COVERAGE, formatC64Address, pointerTableEntries, POINTER_TABLE_TYPES, type PointerTableType } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";
import { NO_FALL_THROUGH, type Root, separate } from "#src/knowledge/separate.ts";
import type { RegionType } from "#src/knowledge/schema.ts";
import { OPCODES } from "#src/opcodes.ts";

/**
 * The data region types that can become free by themselves. The VIC-II reads
 * charset, sprite, bitmap and screen data without the CPU, so the coverage
 * does not show that a program uses them: only --drop makes them free.
 */
export const DROPPABLE_DATA: readonly RegionType[] = ["bytes", "words", ...POINTER_TABLE_TYPES, "petscii", "workspace", "unused"];

/** Regions of code: their bytes are the blocks of the decoded instructions. */
const CODE_TYPES: readonly RegionType[] = ["code", "jumps", "dual-use"];

/** The hardware vectors $fffa-$ffff: they stay when the image holds them. */
const VECTORS: AddressRange = { start: 0xfffa, end: 0xffff };

/** Two immediate operands at most this many immediates apart can be the low and high byte of one address. */
const PAIR_WINDOW = 4;

export interface DropInput {
  segments: readonly AddressRange[];
  /** 64 KiB with the baked image at its addresses. */
  memory: Uint8Array;
  entry?: number;
  /** The decoded instructions of the baked image: start and length. */
  instructions: ReadonlyMap<number, number>;
  coverage?: Uint8Array;
  regions: ReadonlyArray<{ start: number; end: number; type: RegionType }>;
  references: ReadonlyArray<{ from: number; to: number; kind: string }>;
  /** The addresses that the operand expression of an instruction names, by the address of the instruction. */
  operandTargets: ReadonlyMap<number, readonly number[]>;
  /** The patch ranges whose bytes the export changed. */
  changed: readonly AddressRange[];
  keep: readonly AddressRange[];
  drop: readonly AddressRange[];
  routines: ReadonlyArray<{ address: number; name: string }>;
}

/** A free range: what it held. */
export interface FreeRange extends AddressRange {
  what: "code" | "data" | "code and data";
}

export interface DropPlan {
  free: FreeRange[];
  /** Code that a run executed and that the entry and the vectors do not reach: --drop can make it free. */
  unreachableExecuted: Array<AddressRange & { routine?: string }>;
  /** False when the image has no entry and no hardware vectors: then nothing is unreachable. */
  rooted: boolean;
}

const inside = (address: number, ranges: readonly AddressRange[]) => ranges.some((range) => address >= range.start && address <= range.end);
const overlaps = (a: AddressRange, b: AddressRange) => a.start <= b.end && b.start <= a.end;
const within = (a: AddressRange, b: AddressRange) => a.start >= b.start && a.end <= b.end;
const shown = (range: AddressRange) => `${formatC64Address(range.start)}-${formatC64Address(range.end)}`;

/** The blocks of the instructions: a block ends after an instruction that does not run on, and before a gap. An instruction inside the one before stays in its block. */
export function blocksOf(instructions: ReadonlyMap<number, number>, memory: Uint8Array): AddressRange[] {
  const blocks: AddressRange[] = [];
  let open = false;
  for (const start of [...instructions.keys()].sort((a, b) => a - b)) {
    const end = Math.min(0xffff, start + instructions.get(start)! - 1);
    const last = blocks.at(-1);
    if (last !== undefined && (start <= last.end || (open && start === last.end + 1))) last.end = Math.max(last.end, end);
    else blocks.push({ start, end });
    open = !NO_FALL_THROUGH.has(memory[start]!);
  }
  return blocks;
}

/** Joins ranges in address order that touch or overlap. */
function merged(ranges: readonly AddressRange[]): AddressRange[] {
  const result: AddressRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last !== undefined && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else result.push({ ...range });
  }
  return result;
}

/** A place where code goes or reads: the instruction (or table) at `from`, and what it names. */
interface Flow {
  from: number;
  to: number;
}

interface DataReference {
  from: number;
  start: number;
  end: number;
}

/**
 * The code flows and the data references of the instructions, the knowledge
 * references and the operand expressions. `indexedEnd` gives the last address
 * that an indexed operand can read.
 */
function flowsOf(input: DropInput, inImage: (address: number) => boolean, indexedEnd: (operand: number) => number) {
  const flows: Flow[] = [];
  const reads: DataReference[] = [];
  const { memory } = input;
  const word = (at: number) => memory[at]! | (memory[(at + 1) & 0xffff]! << 8);
  const immediates: Array<{ at: number; value: number }> = [];
  let previousEnd = -2;
  const pairs = () => {
    // A low byte and a high byte near each other in one block: the address of a vector, a table or an RTS target.
    immediates.forEach((low, index) => {
      for (let other = Math.max(0, index - PAIR_WINDOW); other <= Math.min(immediates.length - 1, index + PAIR_WINDOW); other++) {
        if (other === index) continue;
        const target = low.value | (immediates[other]!.value << 8);
        if (!inImage(target)) continue;
        flows.push({ from: low.at, to: target }, { from: low.at, to: (target + 1) & 0xffff });
        reads.push({ from: low.at, start: target, end: target });
      }
    });
    immediates.length = 0;
  };
  for (const at of [...input.instructions.keys()].sort((a, b) => a - b)) {
    const opcode = memory[at]!;
    const { mode } = OPCODES[opcode]!;
    if (at > previousEnd + 1) pairs();
    previousEnd = at + input.instructions.get(at)! - 1;
    const operand = input.instructions.get(at) === 3 ? word(at + 1) : memory[at + 1]!;
    switch (mode) {
      case "rel":
        flows.push({ from: at, to: (at + 2 + (operand < 0x80 ? operand : operand - 0x100)) & 0xffff });
        break;
      case "imm":
        immediates.push({ at, value: operand });
        break;
      case "ind":
        reads.push({ from: at, start: operand, end: (operand + 1) & 0xffff });
        if (inImage(operand) && inImage((operand + 1) & 0xffff)) flows.push({ from: at, to: word(operand) });
        break;
      case "abs":
      case "zp":
        if (opcode === 0x20 || opcode === 0x4c) flows.push({ from: at, to: operand });
        else reads.push({ from: at, start: operand, end: operand });
        break;
      case "abx":
      case "aby":
      case "zpx":
      case "zpy":
        reads.push({ from: at, start: operand, end: indexedEnd(operand) });
        break;
      case "izx":
      case "izy":
        reads.push({ from: at, start: operand, end: (operand + 1) & 0xff });
        break;
      default:
        break;
    }
    if (NO_FALL_THROUGH.has(opcode)) pairs();
  }
  pairs();
  for (const reference of input.references) {
    if (inside(reference.from, input.changed)) continue;
    if (reference.kind === "call" || reference.kind === "jump" || reference.kind === "pointer") flows.push({ from: reference.from, to: reference.to });
    reads.push({ from: reference.from, start: reference.to, end: reference.to });
  }
  for (const [at, targets] of input.operandTargets) {
    for (const target of targets) {
      flows.push({ from: at, to: target });
      reads.push({ from: at, start: target, end: target });
    }
  }
  return { flows, reads };
}

/** The entries of a table of addresses or of jumps. */
function tableTargets(table: { start: number; end: number; type: RegionType }, memory: Uint8Array): number[] {
  if (table.type === "jumps") return Array.from({ length: Math.floor((table.end - table.start + 1) / 3) }, (_, index) => table.start + 3 * index);
  return pointerTableEntries(table as { start: number; end: number; type: PointerTableType }, (address) => memory[address]!).map((entry) => entry.target);
}

const isTable = (type: RegionType) => type === "jumps" || (POINTER_TABLE_TYPES as readonly string[]).includes(type);

/**
 * The free ranges of the baked image, the code that a run executed and the
 * entry does not reach, and the refusals of --drop and --keep.
 */
export function planDrops(input: DropInput): DropPlan {
  const inImage = (address: number) => inside(address, input.segments);
  const touched = (address: number) => input.coverage !== undefined && input.coverage[address] !== 0;
  const executed = (address: number) => input.coverage !== undefined && (input.coverage[address]! & COVERAGE.ramExecute) !== 0;
  const regions = input.regions.flatMap((region) => input.segments.filter((segment) => overlaps(region, segment)).map((segment) => ({ start: Math.max(region.start, segment.start), end: Math.min(region.end, segment.end), type: region.type })));
  // The source writes a data region as data, also where Ghidra decoded instructions in it: those are no code.
  const instructions = new Map([...input.instructions].filter(([start, length]) => !regions.some((region) => !CODE_TYPES.includes(region.type) && start <= region.end && region.start <= start + length - 1)));
  const blocks = blocksOf(instructions, input.memory);
  // An indexed operand reads in the region that holds it, and in the next region when it is the last byte (table-1,x).
  // Without a region, it can read the 256 bytes from the operand.
  const holding = (address: number) => regions.find((region) => address >= region.start && address <= region.end);
  const indexedEnd = (operand: number) => {
    const holder = holding(operand);
    const next = holder === undefined || holder.end === operand ? holding((operand + 1) & 0xffff) : undefined;
    return next?.end ?? holder?.end ?? Math.min(0xffff, operand + 0xff);
  };
  const { flows, reads } = flowsOf({ ...input, instructions }, inImage, indexedEnd);

  for (const range of [...input.keep, ...input.drop]) {
    for (let address = range.start; address <= range.end; address++) {
      if (!inImage(address)) throw new Refusal("invalid-input", `${shown(range)} is not in the program: ${formatC64Address(address)} is in no segment.`);
    }
  }
  for (const range of input.drop) {
    const kept = input.keep.find((other) => overlaps(range, other));
    if (kept !== undefined) throw new Refusal("invalid-input", `--drop ${shown(range)} overlaps --keep ${shown(kept)}.`);
    const changed = input.changed.find((other) => overlaps(range, other));
    if (changed !== undefined) throw new Refusal("invalid-input", `--drop ${shown(range)} overlaps the patch ${shown(changed)}, which the export changed.`);
    const cutBlock = blocks.find((block) => overlaps(block, range) && !within(block, range));
    if (cutBlock !== undefined) throw new Refusal("invalid-input", `--drop ${shown(range)} cuts the code ${shown(cutBlock)}. Give a range that holds all of it, or none of it.`);
    const cutData = regions.find((region) => !CODE_TYPES.includes(region.type) && overlaps(region, range) && !within(region, range));
    if (cutData !== undefined) throw new Refusal("invalid-input", `--drop ${shown(range)} cuts the ${cutData.type} region ${shown(cutData)}. Give a range that holds all of it, or none of it.`);
  }

  // Tables that a run read or that the knowledge names: their entries can be the only way to code, so they are roots.
  const tables = regions.filter((region) => isTable(region.type));
  const tableUsers = (table: AddressRange) => reads.filter((read) => read.start <= table.end && table.start <= read.end).map((read) => read.from);
  const tableRoots: Root[] = [];
  for (const table of tables) {
    const targets = tableTargets(table, input.memory);
    let read = false;
    for (let address = table.start; address <= table.end && !read; address++) read = touched(address);
    if (read || input.references.some((reference) => reference.to >= table.start && reference.to <= table.end)) for (const target of targets) tableRoots.push({ address: target, from: "table entry" });
    for (const from of tableUsers(table)) for (const target of targets) flows.push({ from, to: target });
  }

  const asRegions = (list: readonly AddressRange[]) => list.map((block) => ({ ...block, type: "code" }));
  const references = flows.map((flow) => ({ ...flow, kind: "jump" }));
  const passA = separate({ segments: [...input.segments], memory: input.memory, ...(input.entry === undefined ? {} : { entry: input.entry }), codeRegions: asRegions(blocks), references, roots: tableRoots });
  const rooted = passA.codeRegions.every((region) => region.reachable !== undefined);
  const reachable = (index: number) => !rooted || passA.codeRegions[index]!.reachable === true;
  for (const range of input.drop) {
    const live = blocks.findIndex((block, index) => within(block, range) && reachable(index));
    if (live >= 0) throw new Refusal("invalid-input", `--drop ${shown(range)} holds the code ${shown(blocks[live]!)}, which the entry or a vector reaches. Only code that nothing reaches can be dropped.`);
  }
  const ran = (block: AddressRange) => {
    for (let address = block.start; address <= block.end; address++) if (executed(address)) return true;
    return false;
  };

  // Pass B: what stays. Blocks in a --drop range are gone.
  const candidates = blocks.filter((block) => !input.drop.some((range) => within(block, range)));
  const extra: Root[] = [...tableRoots];
  for (const block of candidates) {
    if (ran(block)) extra.push({ address: block.start, from: "executed code" });
    else if ([...input.keep, ...input.changed].some((range) => overlaps(block, range))) extra.push({ address: block.start, from: "kept range" });
  }
  const passB = separate({ segments: [...input.segments], memory: input.memory, ...(input.entry === undefined ? {} : { entry: input.entry }), codeRegions: asRegions(candidates), references, roots: extra });
  const automatic = input.coverage !== undefined && rooted;
  const stays = candidates.filter((_, index) => !automatic || passB.codeRegions[index]!.reachable !== false);
  const droppedCode = candidates.filter((_, index) => automatic && passB.codeRegions[index]!.reachable === false);
  const inStaying = (address: number) => stays.some((block) => address >= block.start && address <= block.end);
  for (const range of input.drop) {
    const into = flows.find((flow) => inStaying(flow.from) && inside(flow.to, [range]));
    if (into !== undefined) throw new Refusal("invalid-input", `--drop ${shown(range)}: the code at ${formatC64Address(into.from)} stays and goes to ${formatC64Address(into.to)}.`);
    const read = reads.find((item) => inStaying(item.from) && overlaps(item, range));
    if (read !== undefined) throw new Refusal("invalid-input", `--drop ${shown(range)}: the code at ${formatC64Address(read.from)} stays and reads ${shown({ start: Math.max(read.start, range.start), end: Math.min(read.end, range.end) })}.`);
  }

  // Data: a region of a droppable type that no run touched and that nothing that stays names.
  const gone = [...input.drop, ...droppedCode];
  const imageStart = Math.min(...input.segments.map((segment) => segment.start));
  const units = automatic
    ? regions.filter((region) => {
        if (!DROPPABLE_DATA.includes(region.type) || gone.some((range) => overlaps(range, region))) return false;
        if ([...input.keep, ...input.changed, VECTORS].some((range) => overlaps(range, region)) || (region.start <= imageStart && imageStart <= region.end)) return false;
        for (let address = region.start; address <= region.end; address++) if (touched(address)) return false;
        return true;
      })
    : [];
  const dropped = new Set(units.map((_, index) => index));
  const unitAt = (address: number) => units.findIndex((unit) => address >= unit.start && address <= unit.end);
  // A name from code that stays, or from a unit that stays, keeps the unit. Kept tables keep their entries.
  for (let grown = true; grown; ) {
    grown = false;
    const keeps = (from: number) => inStaying(from) || (!inside(from, gone) && (unitAt(from) < 0 || !dropped.has(unitAt(from))));
    for (const [index, unit] of units.entries()) {
      if (!dropped.has(index)) continue;
      const named = reads.some((read) => read.start <= unit.end && unit.start <= read.end && keeps(read.from));
      const entry = units.some((table, other) => !dropped.has(other) && isTable(table.type) && tableTargets(table, input.memory).some((target) => target >= unit.start && target <= unit.end));
      const fromTable = tables.some((table) => unitAt(table.start) < 0 && tableTargets(table, input.memory).some((target) => target >= unit.start && target <= unit.end));
      if (named || entry || fromTable) {
        dropped.delete(index);
        grown = true;
      }
    }
  }
  const droppedData = units.filter((_, index) => dropped.has(index));

  const pieces = [
    ...input.drop.map((range) => ({ ...range, code: blocks.some((block) => within(block, range)), data: !blocks.some((block) => within(block, range)) || regions.some((region) => within(region, range) && !isTable(region.type) && region.type !== "code") })),
    ...droppedCode.map((range) => ({ ...range, code: true, data: false })),
    ...droppedData.map((range) => ({ ...range, code: false, data: true })),
  ].sort((a, b) => a.start - b.start);
  const free: FreeRange[] = [];
  for (const piece of pieces) {
    const last = free.at(-1);
    const what = (code: boolean, data: boolean): FreeRange["what"] => (code && data ? "code and data" : code ? "code" : "data");
    if (last !== undefined && piece.start <= last.end + 1) {
      last.end = Math.max(last.end, piece.end);
      last.what = what(last.what !== "data" || piece.code, last.what !== "code" || piece.data);
    } else free.push({ start: piece.start, end: piece.end, what: what(piece.code, piece.data) });
  }

  const routines = [...input.routines].sort((a, b) => a.address - b.address);
  const unreachableExecuted = merged(blocks.filter((block, index) => rooted && passA.codeRegions[index]!.reachable === false && ran(block) && !input.drop.some((range) => within(block, range)))).map((range) => {
    const routine = routines.filter((item) => item.address <= range.start).at(-1)?.name;
    return { ...range, ...(routine === undefined ? {} : { routine }) };
  });
  return { free, unreachableExecuted, rooted };
}

/** The label of a free range. */
export const freeName = (range: AddressRange) => `free_${range.start.toString(16).padStart(4, "0")}`;

/** What the export does with one test file of the project. */
export type TestRewrite = { kind: "scenario" | "run"; text: string } | { reason: string };

/** Each location that a step names: the strings of address, pc, start and end, and the names in a memory list. */
function locationsOf(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) locationsOf(item, found);
  else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && ["address", "pc", "start", "end"].includes(key)) found.push(item);
      else if (key === "memory" && Array.isArray(item)) {
        for (const entry of item) if (typeof entry === "string") found.push(entry);
        locationsOf(item, found);
      } else locationsOf(item, found);
    }
  }
  return found;
}

const hasSnapshot = (value: unknown): boolean =>
  Array.isArray(value) ? value.some(hasSnapshot) : value !== null && typeof value === "object" ? Object.entries(value).some(([key, item]) => key === "snapshot" || hasSnapshot(item)) : false;

/**
 * A scenario or a run file of the project for the new project. A scenario
 * compares the baseline (the exported program) with the build of the new
 * project: a step of the original side alone goes, and a step of the rebuild
 * side alone runs on both sides. A run file runs the build. A test is left out when it restores a
 * snapshot (a state of the old program), names something that the exported
 * program does not have, or names an address in a free range.
 */
export function rewriteTest(text: string, name: string, symbols: ReadonlyMap<string, number>, free: readonly AddressRange[]): TestRewrite {
  let test: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { reason: "it is not a JSON object" };
    test = parsed as Record<string, unknown>;
  } catch {
    return { reason: "it is not JSON" };
  }
  const scenario = typeof test.original === "object" && typeof test.rebuild === "object" && Array.isArray(test.steps);
  const run = typeof test.start === "object" && test.start !== null && Array.isArray(test.steps);
  if (!scenario && !run) return { reason: "it is not a scenario or a run file" };
  if (hasSnapshot(test)) return { reason: "it restores a snapshot, which is a state of the old program" };
  for (const location of locationsOf(test.steps)) {
    if (/^\$[0-9a-fA-F]{1,4}$/.test(location)) {
      const address = Number.parseInt(location.slice(1), 16);
      if (inside(address, free)) return { reason: `it names ${location}, which is in a free range` };
    } else if (!symbols.has(location)) return { reason: `it names ${location}, which the exported program does not have` };
  }
  const side = (program: string) => ({ program: `${program}.prg`, symbols: `${program}.json` });
  if (scenario) {
    // Both sides are the exported program now: a step of the original alone (for example a key for its intro) goes, and a step of the rebuild alone runs on both sides.
    const { original: _original, rebuild: _rebuild, steps, ...rest } = test;
    const both = (steps as unknown[]).flatMap((step) => {
      if (step === null || typeof step !== "object" || !("side" in step)) return [step];
      const { side: only, ...action } = step as Record<string, unknown>;
      return only === "original" ? [] : [action];
    });
    return { kind: "scenario", text: `${JSON.stringify({ ...rest, original: side(`baseline/${name}`), rebuild: side(`build/${name}`), steps: both }, null, 2)}\n` };
  }
  const start = test.start as Record<string, unknown>;
  const symbolsFile = test.symbols === undefined || test.symbols === "none" ? {} : { symbols: `build/${name}.json` };
  return { kind: "run", text: `${JSON.stringify({ ...test, start: { ...start, program: `build/${name}.prg` }, ...symbolsFile }, null, 2)}\n` };
}

export interface ReadmeInput {
  name: string;
  project: string;
  revision: string | null;
  date: string;
  /** main.asm, or loader.asm for a program that needs its entry state. */
  entryFile: string;
  free: readonly FreeRange[];
  switches: ReadonlyArray<{ name: string; kind: string; value: number }>;
  tests: { written: ReadonlyArray<{ file: string; kind: "scenario" | "run" }>; leftOut: ReadonlyArray<{ file: string; reason: string }> };
}

/** The README of the new project: the build and the tests first, then the free ranges, the files and where the program comes from. */
export function readmeText(input: ReadmeInput): string {
  const { name } = input;
  const lines = [
    `# ${name}`,
    "",
    `The start of a new program, exported from \`${input.project}\` (knowledge revision ${input.revision ?? "none"}) on ${input.date}.`,
    "",
    "## Build",
    "",
    `Assemble \`src/${input.entryFile}\` to \`build/${name}.prg\`, with its symbols in \`build/${name}.json\`.`,
    input.entryFile === "main.asm"
      ? "Compare the build with the program in the project knowledge: the source must give that program."
      : "Assemble `src/main.asm` to `.c64-re-tools/local/program.prg`, and compare it with the program in the project knowledge: the source must give that program.",
    "After a change to the source, the compare gives FAIL: that is correct.",
    "",
    "With ACME only, from the folder `src`:",
    "",
    "```",
    `acme -f cbm -o ../build/${name}.prg ${input.entryFile}`,
    "```",
    "",
    "## Test",
    "",
  ];
  if (input.tests.written.length === 0) lines.push("No tests came with the program. Write run files with `expect` steps in `tests/`.");
  else {
    lines.push(`Build first. A scenario compares \`build/${name}.prg\` with \`baseline/${name}.prg\`, the exported program. A run file runs \`build/${name}.prg\`. Run each test:`, "");
    for (const test of input.tests.written) lines.push(test.kind === "run" ? `- \`${test.file}\`: run the run file, with its results in \`.c64-re-tools/local/runs/${test.file.replace(/^tests\//, "").replace(/\.json$/, "")}\`.` : `- \`${test.file}\`: run the scenario.`);
  }
  lines.push("", "## Free ranges", "");
  if (input.free.length === 0) lines.push("None: the export dropped nothing.");
  else {
    lines.push("The export dropped code and data that nothing uses. Each range is `$00` in the source, with a label `free_xxxx`. Use the space for new code.", "", "| Range | Bytes | Was |", "|---|---|---|");
    for (const range of input.free) lines.push(`| \`${shown(range)}\` | ${range.end - range.start + 1} | ${range.what} |`);
  }
  lines.push(
    "",
    "## Files",
    "",
    `- \`src/\`: the source. You own it now: change it as you like.`,
    `- \`baseline/${name}.prg\` and \`baseline/${name}.json\`: the exported program and its symbols, the reference of the scenarios.`,
    "- `tests/`: the tests.",
    "- `.c64-re-tools/knowledge/`: the names, comments and memory map of the exported program. They do not follow your changes to the source.",
    "",
    "## Origin",
    "",
  );
  if (input.switches.length === 0) lines.push("The program had no switches.");
  else {
    lines.push("The switches of the rebuild are now fixed code:", "", "| Switch | Kind | Value |", "|---|---|---|");
    for (const item of input.switches) lines.push(`| ${item.name} | ${item.kind} | ${item.value} |`);
  }
  if (input.tests.leftOut.length > 0) {
    lines.push("", "Tests that the export left out:", "");
    for (const item of input.tests.leftOut) lines.push(`- \`${item.file}\`: ${item.reason}.`);
  }
  return `${lines.join("\n")}\n`;
}
