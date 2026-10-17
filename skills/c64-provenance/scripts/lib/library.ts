// A library of routines that several programs share (D71): a plain folder
// with one <name>.json for each routine, outside every project. A routine holds
// its bytes, which of its bytes move with it, and its knowledge at offsets from
// its start, so match finds it in another program at another address and
// suggests its names there as an apply batch. Nothing here writes knowledge.

import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Refusal } from "#src/errors.ts";
import { formatC64Address, instructionLength } from "#src/c64.ts";
import { evaluate, identifiers, operandText } from "#src/knowledge/expression.ts";
import type { CommentRow, OperandRow, ReferenceRow, RegionRow, SymbolRow } from "#src/knowledge/read.ts";
import { COMMENT_PLACEMENTS, type CommentPlacement, isSemantic, OPERAND_SELECTS, type OperandSelect, REFERENCE_KINDS, type ReferenceKind, REGION_TYPES, type RegionType, SYMBOL_KINDS, type SymbolKind } from "#src/knowledge/schema.ts";
import { PROJECT_DIRECTORY } from "#src/project.ts";

/** A routine shorter than this is not saved and not searched: its bytes occur by chance. */
export const MIN_ROUTINE = 16;

/** A routine name is also its file name: a letter or underscore, then letters, digits or underscores. */
const ROUTINE_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

/** Bytes on each line of a routine file, so that git shows a small diff. */
const BYTES_PER_LINE = 16;

/** A refusal of the library rules, with a stable code. */
export class LibraryError extends Error {
  override name = "LibraryError";
  readonly code: "invalid-input" | "not-found" | "conflict";

  constructor(code: "invalid-input" | "not-found" | "conflict", message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Bytes that move with the routine: a word, or the low or high byte, of the
 * address at `value` (an offset from the routine start; -1 for the RTS entry
 * of the first byte).
 */
export interface Relocation {
  at: number;
  size: "word" | "lo" | "hi";
  value: number;
}

/** A routine of the library. Every position is an offset from its start. */
export interface Routine {
  name: string;
  title?: string;
  /** The program (its project folder name), the image, and the address it came from. */
  from: { program: string; image: string; start: number };
  bytes: Uint8Array;
  /** The offset of each instruction start. */
  instructions: number[];
  relocations: Relocation[];
  /** Operand bytes that address something outside the routine: they may differ in another program. */
  variable: number[];
  symbols: Array<{ at: number; name: string; kind: SymbolKind }>;
  regions: Array<{ start: number; end: number; type: RegionType; element?: number }>;
  comments: Array<{ at: number; placement: CommentPlacement; text: string }>;
  references: Array<{ from: number; to: number; kind: ReferenceKind }>;
  /** Operand expressions; `offset` is added to the symbol, as in knowledge. */
  operands: Array<{ at: number; select: OperandSelect; symbol?: string; offset?: number; expression?: string }>;
}

/** The pointer region types: a table of addresses, or of addresses minus 1 for RTS. */
const POINTER_TYPES: readonly RegionType[] = ["addresses", "addresses-split", "rts-addresses", "rts-addresses-split"];

/** The code region types: their bytes are instructions. */
const CODE_TYPES: readonly RegionType[] = ["code", "jumps"];

/** True for an opcode with an immediate operand, undocumented ones included. */
function isImmediate(opcode: number): boolean {
  return (opcode & 0x1d) === 0x09 || (opcode >= 0x80 && ((opcode & 0x1f) === 0x00 || (opcode & 0x1f) === 0x02));
}

const isBranch = (opcode: number) => (opcode & 0x1f) === 0x10;

/** What the program knows about the range of a routine. Symbols, regions, comments, references and operands are user and LLM rows only. */
export interface RoutineSource {
  name: string;
  title?: string;
  program: string;
  image: string;
  start: number;
  end: number;
  byteAt: (address: number) => number;
  /** Regions of every origin: code regions give the instructions, pointer tables give relocations. */
  analyzed: RegionRow[];
  symbols: SymbolRow[];
  regions: RegionRow[];
  comments: CommentRow[];
  references: ReferenceRow[];
  operands: OperandRow[];
  /** The C64 platform names: an operand expression may use them in any program. */
  platform: ReadonlyMap<string, number>;
}

/** A row that a routine does not keep, and why. */
export interface LeftOut {
  what: string;
  reason: string;
}

/**
 * Makes a routine from the knowledge of a program. Throws LibraryError for a
 * range that cannot be a routine. Returns the rows it did not keep.
 */
export function routineFrom(source: RoutineSource): { routine: Routine; leftOut: LeftOut[] } {
  const { start, end } = source;
  const where = (address: number) => formatC64Address(address);
  if (!ROUTINE_NAME.test(source.name)) throw new LibraryError("invalid-input", `A routine name is a letter or underscore, then letters, digits or underscores (at most 64), not ${source.name}.`);
  const length = end - start + 1;
  if (length < MIN_ROUTINE) throw new LibraryError("invalid-input", `${where(start)}-${where(end)} has ${length} bytes. A routine has at least ${MIN_ROUTINE}, because shorter byte sequences occur by chance.`);
  const inside = (address: number) => address >= start && address <= end;
  const bytes = Uint8Array.from({ length }, (_, index) => source.byteAt(start + index));
  const leftOut: LeftOut[] = [];

  // The instructions: each code region decoded from its start, or from the routine start.
  const instructions: number[] = [];
  const codeRegions = source.analyzed.filter((region) => CODE_TYPES.includes(region.type) && region.end >= start && region.start <= end).sort((a, b) => a.start - b.start);
  /** The address after the last instruction: a code region that an instruction runs into goes on after it. */
  let next = start;
  for (const region of codeRegions) {
    for (let at = Math.max(region.start, next); at <= Math.min(region.end, end); at = next) {
      next = at + instructionLength(bytes[at - start]!);
      if (next - 1 > end) throw new LibraryError("invalid-input", `The instruction at ${where(at)} runs past the end ${where(end)} of the routine. Give an end after it.`);
      instructions.push(at - start);
    }
  }
  if (instructions.length === 0) throw new LibraryError("invalid-input", `The knowledge has no code region in ${where(start)}-${where(end)}. Run c64-static-analysis first, or classify the code.`);

  // The operands: an address inside the routine moves with it; one outside may differ.
  const relocations = new Map<number, Relocation>();
  const variable = new Set<number>();
  for (const offset of instructions) {
    const opcode = bytes[offset]!;
    const size = instructionLength(opcode);
    if (size === 3) {
      const value = bytes[offset + 1]! | (bytes[offset + 2]! << 8);
      if (inside(value)) relocations.set(offset + 1, { at: offset + 1, size: "word", value: value - start });
      else variable.add(offset + 1).add(offset + 2);
    } else if (size === 2 && !isBranch(opcode) && !isImmediate(opcode)) variable.add(offset + 1);
  }
  for (const region of source.analyzed.filter((item) => POINTER_TYPES.includes(item.type))) {
    const split = region.type.endsWith("-split");
    const minus = region.type.startsWith("rts-") ? 1 : 0;
    const count = Math.floor((region.end - region.start + 1) / 2);
    for (let index = 0; index < count; index++) {
      const low = split ? region.start + index : region.start + 2 * index;
      const high = split ? region.start + count + index : low + 1;
      if (!inside(low) || !inside(high)) continue;
      const raw = source.byteAt(low) | (source.byteAt(high) << 8);
      if (!inside((raw + minus) & 0xffff)) continue;
      if (split) {
        relocations.set(low - start, { at: low - start, size: "lo", value: raw - start });
        relocations.set(high - start, { at: high - start, size: "hi", value: raw - start });
      } else relocations.set(low - start, { at: low - start, size: "word", value: raw - start });
    }
  }

  // The names of the routine, and its operand expressions over those names and the platform names.
  const symbols = source.symbols.filter((symbol) => inside(symbol.address));
  const named = new Map(symbols.map((symbol) => [symbol.name, symbol.address]));
  const instructionAt = new Set(instructions.map((offset) => start + offset));
  const operands: Routine["operands"] = [];
  for (const row of source.operands.filter((item) => inside(item.address))) {
    const what = `the operand at ${where(row.address)}`;
    if (!instructionAt.has(row.address)) {
      leftOut.push({ what, reason: "it is not at an instruction start of the code regions" });
      continue;
    }
    const names = row.select === "expr" ? identifiers(row.expression!) : [row.symbol!];
    const outside = names.filter((name) => !named.has(name) && !source.platform.has(name));
    if (outside.length > 0) {
      leftOut.push({ what, reason: `it names ${outside.join(", ")}, which is neither a user or LLM name in the routine nor a platform name` });
      continue;
    }
    const offset = row.address - start;
    const opcode = bytes[offset]!;
    if (instructionLength(opcode) === 2 && isImmediate(opcode) && names.some((name) => named.has(name))) {
      // An immediate that holds a byte of an address inside the routine moves with it.
      if (row.select === "lo" || row.select === "hi") {
        relocations.set(offset + 1, { at: offset + 1, size: row.select, value: named.get(row.symbol!)! + row.offset - start });
      } else variable.add(offset + 1);
    }
    operands.push({ at: offset, select: row.select, ...(row.symbol === undefined ? {} : { symbol: row.symbol }), ...(row.offset === 0 ? {} : { offset: row.offset }), ...(row.expression === undefined ? {} : { expression: row.expression }) });
  }
  for (const at of relocations.keys()) variable.delete(at);

  // The code regions of every origin, cut at the border: the routine's instructions are its code in any program.
  // Other regions only from the user and the LLM, and only inside the routine.
  const regions: Routine["regions"] = codeRegions.map((region) => ({ start: Math.max(region.start, start) - start, end: Math.min(region.end, end) - start, type: region.type }));
  for (const region of source.regions.filter((item) => !CODE_TYPES.includes(item.type))) {
    if (region.start >= start && region.end <= end) regions.push({ start: region.start - start, end: region.end - start, type: region.type, ...(region.element === undefined ? {} : { element: region.element }) });
    else leftOut.push({ what: `the ${region.type} region ${where(region.start)}-${where(region.end)}`, reason: "it crosses the border of the routine" });
  }
  regions.sort((a, b) => a.start - b.start);
  const references: Routine["references"] = [];
  for (const reference of source.references) {
    // Operand expressions make their pointer references again.
    if (reference.kind === "pointer") continue;
    if (inside(reference.from) && inside(reference.to)) references.push({ from: reference.from - start, to: reference.to - start, kind: reference.kind });
  }

  const routine: Routine = {
    name: source.name,
    ...(source.title === undefined ? {} : { title: source.title }),
    from: { program: source.program, image: source.image, start },
    bytes,
    instructions,
    relocations: [...relocations.values()].sort((a, b) => a.at - b.at),
    variable: [...variable].sort((a, b) => a - b),
    symbols: symbols.map((symbol) => ({ at: symbol.address - start, name: symbol.name, kind: symbol.kind })),
    regions,
    comments: source.comments.filter((comment) => inside(comment.address)).map((comment) => ({ at: comment.address - start, placement: comment.placement, text: comment.text })),
    references,
    operands,
  };
  return { routine, leftOut };
}

/** The text of a routine file: keys in a fixed order, one list item on each line. */
export function routineText(routine: Routine): string {
  const lines: string[] = [];
  const field = (key: string, value: string) => lines.push(`  ${JSON.stringify(key)}: ${value}`);
  const list = (items: readonly unknown[]) => (items.length === 0 ? "[]" : `[\n${items.map((item) => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`);
  field("name", JSON.stringify(routine.name));
  if (routine.title !== undefined) field("title", JSON.stringify(routine.title));
  field("from", JSON.stringify({ program: routine.from.program, image: routine.from.image, start: formatC64Address(routine.from.start) }));
  field("length", String(routine.bytes.length));
  const hex = Buffer.from(routine.bytes).toString("hex");
  field("bytes", list(Array.from({ length: Math.ceil(hex.length / (2 * BYTES_PER_LINE)) }, (_, index) => hex.slice(index * 2 * BYTES_PER_LINE, (index + 1) * 2 * BYTES_PER_LINE))));
  field("instructions", JSON.stringify(routine.instructions));
  field("relocations", list(routine.relocations.map((item) => ({ at: item.at, size: item.size, value: item.value }))));
  field("variable", JSON.stringify(routine.variable));
  field("symbols", list(routine.symbols.map((item) => ({ at: item.at, name: item.name, kind: item.kind }))));
  field("regions", list(routine.regions.map((item) => ({ start: item.start, end: item.end, type: item.type, ...(item.element === undefined ? {} : { element: item.element }) }))));
  field("comments", list(routine.comments.map((item) => ({ at: item.at, placement: item.placement, text: item.text }))));
  field("references", list(routine.references.map((item) => ({ from: item.from, to: item.to, kind: item.kind }))));
  field("operands", list(routine.operands.map((item) => ({ at: item.at, select: item.select, ...(item.symbol === undefined ? {} : { symbol: item.symbol }), ...(item.offset === undefined ? {} : { offset: item.offset }), ...(item.expression === undefined ? {} : { expression: item.expression }) }))));
  return `{\n${lines.join(",\n")}\n}\n`;
}

/** Reads the text of a routine file. Throws LibraryError for a file that is no routine. */
export function parseRoutine(text: string, file: string): Routine {
  const fail = (what: string): never => {
    throw new LibraryError("invalid-input", `${file} is not a routine file of the library: ${what}.`);
  };
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    return fail((error as Error).message);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("it is not a JSON object");
  if (typeof value.name !== "string" || !ROUTINE_NAME.test(value.name)) fail("name is not a routine name");
  if (`${value.name as string}.json` !== file.split(/[\\/]/).at(-1)) fail(`its name ${value.name as string} is not its file name`);
  if (value.title !== undefined && typeof value.title !== "string") fail("title is not text");
  const from = value.from as Record<string, unknown> | undefined;
  if (typeof from?.program !== "string" || typeof from.image !== "string" || typeof from.start !== "string" || !/^\$[0-9a-f]{4}$/i.test(from.start)) fail("from needs program, image and start");
  if (!Array.isArray(value.bytes) || !value.bytes.every((line) => typeof line === "string" && /^([0-9a-f]{2})+$/i.test(line))) fail("bytes is not a list of hex lines");
  const bytes = Uint8Array.from(Buffer.from((value.bytes as string[]).join(""), "hex"));
  if (value.length !== bytes.length) fail(`length is not the ${bytes.length} bytes of bytes`);
  if (bytes.length < MIN_ROUTINE) fail(`it has fewer than ${MIN_ROUTINE} bytes`);
  const offset = (item: unknown, what: string, low = 0) => (Number.isInteger(item) && (item as number) >= low && (item as number) < bytes.length ? (item as number) : fail(`${what} is not an offset in the routine`));
  const items = (key: string): Array<Record<string, unknown>> => (Array.isArray(value[key]) && (value[key] as unknown[]).every((item) => typeof item === "object" && item !== null) ? (value[key] as Array<Record<string, unknown>>) : fail(`${key} is not a list of objects`));
  const oneOf = <T extends string>(allowed: readonly T[], item: unknown, what: string): T => (allowed.includes(item as T) ? (item as T) : fail(`${what} is not one of ${allowed.join(", ")}`));
  const numbers = (key: string) => (Array.isArray(value[key]) ? (value[key] as unknown[]).map((item) => offset(item, key)) : fail(`${key} is not a list of offsets`));
  return {
    name: value.name as string,
    ...(value.title === undefined ? {} : { title: value.title as string }),
    from: { program: from!.program as string, image: from!.image as string, start: Number.parseInt((from!.start as string).slice(1), 16) },
    bytes,
    instructions: numbers("instructions"),
    relocations: items("relocations").map((item) => ({
      at: offset(item.at, "a relocation at"),
      size: oneOf(["word", "lo", "hi"] as const, item.size, "a relocation size"),
      value: offset(item.value, "a relocation value", -1),
    })),
    variable: numbers("variable"),
    symbols: items("symbols").map((item) => ({ at: offset(item.at, "a symbol at"), name: typeof item.name === "string" ? item.name : fail("a symbol has no name"), kind: oneOf(SYMBOL_KINDS, item.kind, "a symbol kind") })),
    regions: items("regions").map((item) => ({
      start: offset(item.start, "a region start"),
      end: offset(item.end, "a region end"),
      type: oneOf(REGION_TYPES, item.type, "a region type"),
      ...(item.element === undefined ? {} : { element: Number.isInteger(item.element) ? (item.element as number) : fail("a region element is not a whole number") }),
    })),
    comments: items("comments").map((item) => ({ at: offset(item.at, "a comment at"), placement: oneOf(COMMENT_PLACEMENTS, item.placement, "a comment placement"), text: typeof item.text === "string" ? item.text : fail("a comment has no text") })),
    references: items("references").map((item) => ({ from: offset(item.from, "a reference from"), to: offset(item.to, "a reference to"), kind: oneOf(REFERENCE_KINDS, item.kind, "a reference kind") })),
    operands: items("operands").map((item) => ({
      at: offset(item.at, "an operand at"),
      select: oneOf(OPERAND_SELECTS, item.select, "an operand select"),
      ...(item.symbol === undefined ? {} : { symbol: String(item.symbol) }),
      ...(item.offset === undefined ? {} : { offset: Number.isInteger(item.offset) ? (item.offset as number) : fail("an operand offset is not a whole number") }),
      ...(item.expression === undefined ? {} : { expression: String(item.expression) }),
    })),
  };
}

/**
 * The library folder that --library names, relative to the working directory
 * like --project (D71). A library is a plain folder, never a project. With
 * `create`, a missing folder is made.
 */
export function libraryFolder(folder: string, options: { create: boolean; cwd?: string }): string {
  if (folder.length === 0) throw new LibraryError("invalid-input", "The library folder must not be empty.");
  const path = resolve(options.cwd ?? process.cwd(), folder);
  const stat = statSync(path, { throwIfNoEntry: false });
  if (stat === undefined) {
    if (!options.create) throw new LibraryError("not-found", `There is no library folder ${folder}. Save a routine to it first with routine.`);
    mkdirSync(path, { recursive: true });
  } else if (!stat.isDirectory()) throw new LibraryError("invalid-input", `${folder} is not a folder.`);
  if (statSync(join(path, PROJECT_DIRECTORY), { throwIfNoEntry: false }) !== undefined) {
    throw new LibraryError("invalid-input", `${folder} is a project folder. A library is a plain folder beside the projects, for example library/ at the workspace root.`);
  }
  return path;
}

/** Every routine of a library folder, by name. */
export function readLibrary(folder: string): Routine[] {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort()
    .map((name) => parseRoutine(readFileSync(join(folder, name), "utf8"), name));
}

/** Writes a routine file into the library: a temporary file, then a rename. Refuses a name that exists unless `replace`. */
export function saveRoutine(folder: string, routine: Routine, replace: boolean): string {
  const file = join(folder, `${routine.name}.json`);
  if (!replace && statSync(file, { throwIfNoEntry: false }) !== undefined) {
    throw new LibraryError("conflict", `The library already has the routine ${routine.name}. Give another --name, or give --replace to save over it.`);
  }
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, routineText(routine));
  renameSync(temporary, file);
  return file;
}

/** An image to search: its segments and its bytes inside them. */
export interface Searched {
  segments: ReadonlyArray<{ start: number; end: number }>;
  byteAt: (address: number) => number;
}

/** An operand that addresses something outside the routine and has other bytes in the program. */
export interface DifferingOperand {
  /** The address of the instruction in the program. */
  address: number;
  library: number;
  program: number;
  size: 1 | 2;
}

export interface Match {
  routine: string;
  start: number;
  /** The program address minus the library address. */
  shift: number;
  differing: DifferingOperand[];
}

/** The byte that a relocation gives at `start`, or undefined when the address leaves $0000-$ffff. */
function relocated(relocation: Relocation, start: number, part: 0 | 1): number | undefined {
  const value = start + relocation.value;
  if (value < -1 || value > 0xffff) return undefined;
  const word = value & 0xffff;
  if (relocation.size === "lo") return word & 0xff;
  if (relocation.size === "hi") return word >> 8;
  return part === 0 ? word & 0xff : word >> 8;
}

/**
 * The places where the routine occurs in the image: its fixed bytes equal,
 * each relocation pointing into the routine at one shift, and the variable
 * bytes free. Matches do not overlap.
 */
export function findRoutine(routine: Routine, image: Searched, origin = routine.from.start): Match[] {
  const length = routine.bytes.length;
  if (length < MIN_ROUTINE) return [];
  // 0: fixed, 1: variable, 2: the first byte of a relocation, 3: the second byte of a word.
  const kind = new Uint8Array(length);
  for (const at of routine.variable) kind[at] = 1;
  const relocations = new Map<number, Relocation>();
  for (const relocation of routine.relocations) {
    kind[relocation.at] = 2;
    relocations.set(relocation.at, relocation);
    if (relocation.size === "word") kind[relocation.at + 1] = 3;
  }
  const matches: Match[] = [];
  for (const segment of image.segments) {
    for (let start = segment.start; start + length - 1 <= segment.end; start++) {
      let equal = true;
      for (let offset = 0; offset < length && equal; offset++) {
        const byte = image.byteAt(start + offset);
        if (kind[offset] === 0) equal = byte === routine.bytes[offset];
        else if (kind[offset] === 2) {
          const relocation = relocations.get(offset)!;
          equal = byte === relocated(relocation, start, 0) && (relocation.size !== "word" || image.byteAt(start + offset + 1) === relocated(relocation, start, 1));
        }
      }
      if (!equal) continue;
      const differing: DifferingOperand[] = [];
      for (const offset of routine.instructions) {
        const size = instructionLength(routine.bytes[offset]!) - 1;
        if (size === 0 || kind[offset + 1] !== 1) continue;
        const read = (at: (offset: number) => number) => (size === 2 ? at(offset + 1) | (at(offset + 2) << 8) : at(offset + 1));
        const library = read((at) => routine.bytes[at]!);
        const program = read((at) => image.byteAt(start + at));
        if (library !== program) differing.push({ address: start + offset, library, program, size: size as 1 | 2 });
      }
      matches.push({ routine: routine.name, start, shift: start - origin, differing });
      start += length - 1;
    }
  }
  return matches;
}

/** What the program knows, read at the program addresses of a match. */
export interface ProgramKnowledge {
  symbolAt: (address: number) => SymbolRow | undefined;
  symbolNamed: (name: string) => SymbolRow | undefined;
  regionsOverlapping: (start: number, end: number) => RegionRow[];
  commentsAt: (address: number) => CommentRow[];
  referencesFrom: (address: number) => ReferenceRow[];
  operandAt: (address: number) => OperandRow | undefined;
  /** True when a user or LLM removal holds at the place. */
  symbolSuppressed: (address: number) => boolean;
  regionSuppressed: (start: number, end: number) => boolean;
  referenceSuppressed: (reference: { from: number; to: number; kind: ReferenceKind }) => boolean;
}

/** One write of an apply batch, in the form of knowledge.ts apply. */
export type BatchWrite = Record<string, string | number> & { op: string };

export interface Skipped {
  routine: string;
  address: string;
  op?: string;
  reason: string;
}

export interface Suggestions {
  batch: BatchWrite[];
  /** Writes that the program already has. */
  known: number;
  leftOut: Skipped[];
}

const semantic = (row: { origin: string }) => isSemantic(row.origin);

/**
 * The names, regions, comments, references and operand expressions of each
 * matched routine at its program addresses, as an apply batch. A write that
 * the program already has is counted as known. A write that would replace a
 * user or LLM row, take a name that the program uses elsewhere, undo a
 * removal, or give an operand that is not in the image, is left out with the
 * reason. Only the first match of a routine gets its names.
 */
export function suggest(found: ReadonlyArray<{ routine: Routine; matches: Match[] }>, program: ProgramKnowledge, image: Searched, platform: ReadonlyMap<string, number>): Suggestions {
  const batch: BatchWrite[] = [];
  const leftOut: Skipped[] = [];
  let known = 0;
  const show = formatC64Address;
  /** The names that are at their place after the batch: written here or known. */
  const placed = new Map<string, number>();
  const symbolsHere = new Map<number, string>();
  const regionsHere: Array<{ start: number; end: number }> = [];

  for (const { routine, matches } of found) {
    const [first, ...others] = [...matches].sort((a, b) => a.start - b.start);
    for (const other of others) leftOut.push({ routine: routine.name, address: show(other.start), reason: `a second copy of the routine; the first is at ${show(first!.start)}` });
    if (first === undefined) continue;
    const at = (offset: number) => first.start + offset;
    const skip = (address: number, op: string, reason: string) => leftOut.push({ routine: routine.name, address: show(address), op, reason });

    for (const symbol of routine.symbols) {
      const address = at(symbol.at);
      const existing = program.symbolAt(address);
      const elsewhere = program.symbolNamed(symbol.name);
      if (existing?.name === symbol.name) {
        known++;
        placed.set(symbol.name, address);
      } else if (existing !== undefined && semantic(existing)) skip(address, "rename", `the program names it ${existing.name} (${existing.origin})`);
      else if (elsewhere !== undefined && elsewhere.address !== address) skip(address, "rename", `the program uses the name ${symbol.name} at ${show(elsewhere.address)}`);
      else if (placed.has(symbol.name) && placed.get(symbol.name) !== address) skip(address, "rename", `the batch gives the name ${symbol.name} to ${show(placed.get(symbol.name)!)}`);
      else if (symbolsHere.has(address)) skip(address, "rename", `the batch names it ${symbolsHere.get(address)}`);
      else if (program.symbolSuppressed(address)) skip(address, "rename", "a removal of a name holds there");
      else {
        batch.push({ op: "rename", address: show(address), name: symbol.name, kind: symbol.kind });
        placed.set(symbol.name, address);
        symbolsHere.set(address, symbol.name);
      }
    }

    for (const region of routine.regions) {
      const start = at(region.start);
      const end = at(region.end);
      const overlapping = program.regionsOverlapping(start, end);
      if (overlapping.some((item) => item.start === start && item.end === end && item.type === region.type && item.element === region.element)) known++;
      else if (overlapping.some(semantic)) {
        const other = overlapping.find(semantic)!;
        skip(start, "classify", `the program has the ${other.type} region ${show(other.start)}-${show(other.end)} (${other.origin})`);
      } else if (regionsHere.some((item) => item.start <= end && item.end >= start)) skip(start, "classify", "the batch classifies an overlapping range");
      else if (program.regionSuppressed(start, end)) skip(start, "classify", "a removal of a region holds there");
      else {
        batch.push({ op: "classify", start: show(start), end: show(end), type: region.type, ...(region.element === undefined ? {} : { element: region.element }) });
        regionsHere.push({ start, end });
      }
    }

    for (const comment of routine.comments) {
      const address = at(comment.at);
      const existing = program.commentsAt(address).find((item) => item.placement === comment.placement);
      if (existing?.text === comment.text) known++;
      else if (existing !== undefined) skip(address, "comment", `the program has a ${comment.placement} comment there (${existing.origin})`);
      else batch.push({ op: "comment", address: show(address), placement: comment.placement, text: comment.text });
    }

    for (const reference of routine.references) {
      const wanted = { from: at(reference.from), to: at(reference.to), kind: reference.kind };
      if (program.referencesFrom(wanted.from).some((item) => item.to === wanted.to && item.kind === wanted.kind)) known++;
      else if (program.referenceSuppressed(wanted)) skip(wanted.from, "reference", "a removal of this reference holds");
      else batch.push({ op: "reference", from: show(wanted.from), to: show(wanted.to), kind: wanted.kind });
    }

    const own = new Set(routine.symbols.map((symbol) => symbol.name));
    for (const operand of routine.operands) {
      const address = at(operand.at);
      const existing = program.operandAt(address);
      const names = operand.select === "expr" ? identifiers(operand.expression!) : [operand.symbol!];
      const text = operandText(operand);
      if (existing !== undefined && operandText(existing) === text) {
        known++;
        continue;
      }
      if (existing !== undefined) {
        skip(address, "operand", `the program has the operand expression ${operandText(existing)} there`);
        continue;
      }
      const missing = names.filter((name) => own.has(name) && placed.get(name) === undefined);
      if (missing.length > 0) {
        skip(address, "operand", `its name ${missing.join(", ")} was left out`);
        continue;
      }
      const problem = operandProblem(address, text, image, (name) => placed.get(name) ?? program.symbolNamed(name)?.address ?? platform.get(name));
      if (problem !== undefined) {
        skip(address, "operand", problem);
        continue;
      }
      batch.push({
        op: "operand",
        address: show(address),
        select: operand.select,
        ...(operand.symbol === undefined ? {} : { symbol: operand.symbol }),
        ...(operand.offset === undefined ? {} : { offset: operand.offset }),
        ...(operand.expression === undefined ? {} : { expression: operand.expression }),
      });
    }
  }
  return { batch, known, leftOut };
}

/** Why the expression is not the operand of the instruction at `address` in the image, or undefined when it is. */
function operandProblem(address: number, text: string, image: Searched, resolveName: (name: string) => number | undefined): string | undefined {
  const opcode = image.byteAt(address);
  const size = instructionLength(opcode);
  if (size === 1 || isBranch(opcode)) return "the instruction has no value operand";
  const operand = size === 3 ? image.byteAt(address + 1) | (image.byteAt(address + 2) << 8) : image.byteAt(address + 1);
  let value: number;
  try {
    value = evaluate(text, resolveName);
  } catch (error) {
    if (error instanceof Refusal) return error.message;
    throw error;
  }
  const range = size === 2 ? 0x100 : 0x10000;
  if (value < -range / 2 || value >= range || ((value % range) + range) % range !== operand) {
    return `${text} gives ${value}, but the operand in the image is ${operand}`;
  }
  return undefined;
}
