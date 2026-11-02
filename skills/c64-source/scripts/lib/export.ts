// The parts of an export that need no tool: which ranges of the baked program
// become free, how the tests of the project change for the new project, and
// the README of the new project.
//
// A range becomes free only when no run executed or read it and nothing that
// stays reaches it. The code reach (src/knowledge/code-reach.ts) tells which
// code is unused and which code stays. Data becomes free when no run touched
// it and nothing that stays names it. Without coverage nothing becomes free by
// itself.

import { type AddressRange, c64AddressOf, formatC64Address, formatC64Range, hexWord, inRanges, mergeRanges, POINTER_TABLE_TYPES, rangesOverlap } from "#src/c64.ts";
import { symbolsPath } from "#src/build-name.ts";
import { Refusal } from "#src/errors.ts";
import { codeReach, type CodeReachInput, isTable, RAM_ACCESS } from "#src/knowledge/code-reach.ts";
import type { UnresolvedFlow } from "#src/knowledge/separate.ts";
import { INSTRUCTION_REGION_TYPES, type RegionType } from "#src/knowledge/schema.ts";

/**
 * The data region types that can become free by themselves. The VIC-II reads
 * charset, sprite, bitmap and screen data without the CPU, so the coverage
 * does not show that a program uses them: only --drop makes them free.
 */
const DROPPABLE_DATA: readonly RegionType[] = ["bytes", "words", ...POINTER_TABLE_TYPES, "petscii", "workspace", "unused"];

/** The data that the VIC-II reads: a region of another type that overlaps it stays too, for example unused bytes in a bitmap. */
const VIC_DATA: readonly RegionType[] = ["charset", "sprite", "bitmap", "screen"];

/** The hardware vectors $fffa-$ffff: they stay when the image holds them. */
const VECTORS: AddressRange = { start: 0xfffa, end: 0xffff };

export interface DropInput extends CodeReachInput {
  /** The BASIC line that starts the program: RUN reads it, which no coverage from the entry shows. */
  basic?: AddressRange;
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
  /** Code that nothing reaches and that no run executed, which stays because of the flows in `unresolved`. */
  unknown: AddressRange[];
  /** The flows whose targets the knowledge does not give. */
  unresolved: UnresolvedFlow[];
}

const within = (a: AddressRange, b: AddressRange) => a.start >= b.start && a.end <= b.end;

/**
 * The free ranges of the baked image, the code that a run executed and the
 * entry does not reach, and the refusals of --drop and --keep.
 */
export function planDrops(input: DropInput): DropPlan {
  const inImage = (address: number) => inRanges(input.segments, address);
  const touched = (address: number) => input.coverage !== undefined && (input.coverage[address]! & RAM_ACCESS) !== 0;
  const reach = codeReach(input);
  const { regions, blocks, flows, reads, targetsOf } = reach;

  for (const range of [...input.keep, ...input.drop]) {
    for (let address = range.start; address <= range.end; address++) {
      if (!inImage(address)) throw new Refusal("invalid-input", `${formatC64Range(range)} is not in the program: ${formatC64Address(address)} is in no segment.`);
    }
  }
  for (const range of input.drop) {
    const kept = input.keep.find((other) => rangesOverlap(range, other));
    if (kept !== undefined) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)} overlaps --keep ${formatC64Range(kept)}.`);
    const changed = input.changed.find((other) => rangesOverlap(range, other));
    if (changed !== undefined) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)} overlaps the patch ${formatC64Range(changed)}, which the export changed.`);
    const cutBlock = blocks.find((block) => rangesOverlap(block, range) && !within(block, range));
    if (cutBlock !== undefined) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)} cuts the code ${formatC64Range(cutBlock)}. Give a range that holds all of it, or none of it.`);
    const cutData = regions.find((region) => !INSTRUCTION_REGION_TYPES.includes(region.type) && rangesOverlap(region, range) && !within(region, range));
    if (cutData !== undefined) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)} cuts the ${cutData.type} region ${formatC64Range(cutData)}. Give a range that holds all of it, or none of it.`);
  }
  for (const range of input.drop) {
    const live = blocks.findIndex((block, index) => within(block, range) && reach.reachable[index]);
    if (live >= 0) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)} holds the code ${formatC64Range(blocks[live]!)}, which the entry or a vector reaches. Only code that nothing reaches can be dropped.`);
  }
  const staying = new Uint8Array(0x10000);
  for (const block of reach.stays) staying.fill(1, block.start, block.end + 1);
  const inStaying = (address: number) => staying[address] === 1;
  for (const range of input.drop) {
    const into = flows.find((flow) => inStaying(flow.from) && inRanges([range], flow.to));
    if (into !== undefined) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)}: the code at ${formatC64Address(into.from)} stays and goes to ${formatC64Address(into.to)}.`);
    const read = reads.find((item) => inStaying(item.from) && rangesOverlap(item, range));
    if (read !== undefined) throw new Refusal("invalid-input", `--drop ${formatC64Range(range)}: the code at ${formatC64Address(read.from)} stays and reads ${formatC64Range({ start: Math.max(read.start, range.start), end: Math.min(read.end, range.end) })}.`);
  }

  // Data: a region of a droppable type that no run touched and that nothing that stays names.
  const tables = [...targetsOf.keys()];
  const gone = [...input.drop, ...reach.unused];
  const units =
    input.coverage !== undefined && reach.rooted
      ? regions.filter((region) => {
          if (!DROPPABLE_DATA.includes(region.type) || gone.some((range) => rangesOverlap(range, region))) return false;
          if (regions.some((other) => VIC_DATA.includes(other.type) && rangesOverlap(other, region))) return false;
          if ([...input.keep, ...input.changed, VECTORS, ...(input.basic === undefined ? [] : [input.basic])].some((range) => rangesOverlap(range, region))) return false;
          for (let address = region.start; address <= region.end; address++) if (touched(address)) return false;
          return true;
        })
      : [];
  const dropped = new Set(units.map((_, index) => index));
  const unitAt = (address: number) => units.findIndex((unit) => address >= unit.start && address <= unit.end);
  // A name from code that stays, or from a unit that stays, keeps the unit. Kept tables keep their entries.
  for (let grown = true; grown; ) {
    grown = false;
    const keeps = (from: number) => inStaying(from) || (!inRanges(gone, from) && (unitAt(from) < 0 || !dropped.has(unitAt(from))));
    for (const [index, unit] of units.entries()) {
      if (!dropped.has(index)) continue;
      const named = reads.some((read) => read.start <= unit.end && unit.start <= read.end && keeps(read.from));
      const entry = units.some((table, other) => !dropped.has(other) && isTable(table.type) && targetsOf.get(table)!.some((target) => target >= unit.start && target <= unit.end));
      const fromTable = tables.some((table) => unitAt(table.start) < 0 && targetsOf.get(table)!.some((target) => target >= unit.start && target <= unit.end));
      if (named || entry || fromTable) {
        dropped.delete(index);
        grown = true;
      }
    }
  }
  const droppedData = units.filter((_, index) => dropped.has(index));

  const pieces = [
    ...input.drop.map((range) => ({ ...range, code: blocks.some((block) => within(block, range)), data: !blocks.some((block) => within(block, range)) || regions.some((region) => within(region, range) && !isTable(region.type) && region.type !== "code") })),
    ...reach.unused.map((range) => ({ ...range, code: true, data: false })),
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
  const unreachableExecuted = mergeRanges(blocks.filter((block, index) => !reach.reachable[index] && reach.executed[index] && !input.drop.some((range) => within(block, range)))).map((range) => {
    const routine = routines.filter((item) => item.address <= range.start).at(-1)?.name;
    return { ...range, ...(routine === undefined ? {} : { routine }) };
  });
  return { free, unreachableExecuted, rooted: reach.rooted, unknown: reach.unknown, unresolved: reach.unresolved };
}

/** The label of a free range. */
export const freeName = (range: AddressRange) => `free_${hexWord(range.start)}`;

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
 * project: a step of the reference side alone goes, and a step of the rebuild
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
  const scenario = typeof test.reference === "object" && typeof test.rebuild === "object" && Array.isArray(test.steps);
  const run = typeof test.start === "object" && test.start !== null && Array.isArray(test.steps);
  if (!scenario && typeof test.rebuild === "object" && Array.isArray(test.steps)) return { reason: "it is a scenario without a reference side. A scenario has reference, rebuild and steps" };
  if (!scenario && !run) return { reason: "it is not a scenario or a run file" };
  if (hasSnapshot(test)) return { reason: "it restores a snapshot, which is a state of the old program" };
  for (const location of locationsOf(test.steps)) {
    const address = c64AddressOf(location);
    if (address !== undefined) {
      if (inRanges(free, address)) return { reason: `it names ${location}, which is in a free range` };
    } else if (!symbols.has(location)) return { reason: `it names ${location}, which the exported program does not have` };
  }
  const side = (program: string) => ({ program: `${program}.prg`, symbols: symbolsPath(`${program}.prg`) });
  if (scenario) {
    // Both sides are the exported program now: a step of the reference alone (for example a key for its intro) goes, and a step of the rebuild alone runs on both sides.
    const { reference: _reference, rebuild: _rebuild, steps, ...rest } = test;
    const both = (steps as unknown[]).flatMap((step) => {
      if (step === null || typeof step !== "object" || !("side" in step)) return [step];
      const { side: only, ...action } = step as Record<string, unknown>;
      return only === "reference" ? [] : [action];
    });
    return { kind: "scenario", text: `${JSON.stringify({ ...rest, reference: side(`baseline/${name}`), rebuild: side(`build/${name}`), steps: both }, null, 2)}\n` };
  }
  const start = test.start as Record<string, unknown>;
  const symbolsFile = test.symbols === undefined || test.symbols === "none" ? {} : { symbols: symbolsPath(`build/${name}.prg`) };
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
  /** The loader shows the start screen of the program. */
  startScreen?: boolean;
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
    `Assemble \`src/${input.entryFile}\` to \`build/${name}.prg\`, with its symbols in \`${symbolsPath(`build/${name}.prg`)}\`.`,
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
    ...(input.startScreen === true ? ["", "The loader shows the start screen of the program and waits for a key or a fire button. To start the program at once, add `-DSTART_SCREEN=0` to the command."] : []),
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
    for (const range of input.free) lines.push(`| \`${formatC64Range(range)}\` | ${range.end - range.start + 1} | ${range.what} |`);
  }
  lines.push(
    "",
    "## Files",
    "",
    `- \`src/\`: the source. You own it now: change it as you like.`,
    `- \`baseline/${name}.prg\` and \`${symbolsPath(`baseline/${name}.prg`)}\`: the exported program and its symbols, the reference of the scenarios.`,
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
