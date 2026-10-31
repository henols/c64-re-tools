// One listing of the image with its knowledge: the lines of a range as
// ACME text with names, operand expressions and comments, the access class of
// the bytes from coverage files, and the references in and out. Nothing here
// reads files: knowledge.ts gives the lookups.

import { COVERAGE, formatC64Address, formatC64Byte, hexByte, POINTER_TABLE_TYPES, pointerEntryText, pointerTableEntries, type PointerTableType, splitEntryByte } from "#src/c64.ts";
import { CODE_REGION_TYPES, INSTRUCTION_REGION_TYPES } from "#src/knowledge/schema.ts";
import { instructionWith, MODE_LENGTH, OPCODES, type Mode } from "#src/opcodes.ts";

export interface ListingSource {
  /** The image byte at an address, or undefined outside the image. */
  byteAt: (address: number) => number | undefined;
  /** The name of an address: a symbol, else a platform name. */
  nameOf: (address: number) => string | undefined;
  /** The start of the platform entry of more bytes that holds an address outside the image (NMINV for its high byte), or undefined. */
  entryStart?: (address: number) => number | undefined;
  /** The analyzer names of an address, for reference. */
  secondNames: (address: number) => string[];
  /** The knowledge regions, in address order. */
  regions: ReadonlyArray<{ start: number; end: number; type: string }>;
  /** The line and side comments of an address. */
  comments: (address: number) => { line: string[]; side?: string };
  /** The operand expression of the instruction at an address, as ACME text. */
  operand: (address: number) => string | undefined;
  /** The references to and from an address. */
  references: (address: number) => { in: number; out: number };
  /** Joined coverage files, or undefined without them. */
  coverage?: Uint8Array;
}

export interface ListingLine {
  address: number;
  /** The bytes as hex, separated by spaces. */
  bytes: string;
  label?: string;
  analyzerNames?: string[];
  text: string;
  /** From the coverage: x executed, r read, w written, - none. */
  access?: string;
  referencesIn: number;
  referencesOut: number;
  lineComments?: string[];
  comment?: string;
}

type Region = ListingSource["regions"][number];

const CODE = new Set<string>(CODE_REGION_TYPES);
const INSTRUCTIONS = new Set<string>(INSTRUCTION_REGION_TYPES);
const TABLES = new Set<string>(["words", ...POINTER_TABLE_TYPES]);
const DATA_PER_LINE = 8;

/** The access class of bytes from the coverage: x, r and w as they occur, or - for none. */
function accessOf(coverage: Uint8Array | undefined, start: number, length: number): string | undefined {
  if (coverage === undefined) return undefined;
  let flags = 0;
  for (let offset = 0; offset < length; offset++) flags |= coverage[start + offset]!;
  const text = `${flags & (COVERAGE.ramExecute | COVERAGE.romExecute) ? "x" : ""}${flags & (COVERAGE.ramRead | COVERAGE.romRead) ? "r" : ""}${flags & COVERAGE.ramWrite ? "w" : ""}`;
  return text === "" ? "-" : text;
}

/**
 * The name of an operand target, as c64-source writes it: its own name, else
 * name+offset inside a named data region, or inside a platform entry of more bytes.
 */
function targetName(target: number, source: ListingSource): string | undefined {
  const own = source.nameOf(target);
  if (own !== undefined) return own;
  const region = source.regions.find((row) => target > row.start && target <= row.end && !INSTRUCTIONS.has(row.type));
  const start = region?.start ?? source.entryStart?.(target);
  const name = start === undefined ? undefined : source.nameOf(start);
  return name === undefined ? undefined : `${name}+${target - start!}`;
}

/** The operand value of an instruction as an expression: the name of its target where one exists, else the number. Empty for no operand. */
function operandOf(mode: Mode, address: number, low: number, high: number, source: ListingSource): string {
  const named = (target: number, digits: 2 | 4) => targetName(target, source) ?? (digits === 2 ? formatC64Byte(target) : formatC64Address(target));
  if (mode === "imp") return "";
  if (mode === "imm") return formatC64Byte(low);
  if (mode === "rel") return named((address + 2 + (low < 0x80 ? low : low - 0x100)) & 0xffff, 4);
  return MODE_LENGTH[mode] === 3 ? named(low | (high << 8), 4) : named(low, 2);
}

/**
 * The values of a table region in the form that c64-source writes, with the names of the
 * knowledge and the platform: a word of a words or an address table as one !word value, and
 * each byte of a split table as <target or >target. A byte of no entry has no value.
 */
function tableValues(region: Region, source: ListingSource): Map<number, { length: 1 | 2; text: string }> {
  const values = new Map<number, { length: 1 | 2; text: string }>();
  const present = (address: number) => source.byteAt(address) !== undefined;
  const byteAt = (address: number) => source.byteAt(address) ?? 0;
  if (region.type === "words") {
    for (let address = region.start; address + 1 <= region.end; address += 2) {
      if (present(address) && present(address + 1)) values.set(address, { length: 2, text: formatC64Address(byteAt(address) | (byteAt(address + 1) << 8)) });
    }
    return values;
  }
  const rts = region.type === "rts-addresses" || region.type === "rts-addresses-split";
  const split = region.type === "addresses-split" || region.type === "rts-addresses-split";
  for (const entry of pointerTableEntries({ start: region.start, end: region.end, type: region.type as PointerTableType }, byteAt)) {
    if (!present(entry.low) || !present(entry.high)) continue;
    const text = pointerEntryText(entry.target, rts, (address) => targetName(address, source));
    if (!split) {
      values.set(entry.low, { length: 2, text });
      continue;
    }
    values.set(entry.low, { length: 1, text: splitEntryByte(text, false) });
    values.set(entry.high, { length: 1, text: splitEntryByte(text, true) });
  }
  return values;
}

/**
 * The lines of start..end: instructions in code regions, decoded from the
 * region start, tables as their values, and bytes elsewhere. With `code`, only
 * the instructions of the code regions.
 */
export function listing(source: ListingSource, start: number, end: number, options: { code?: boolean } = {}): ListingLine[] {
  const lines: ListingLine[] = [];
  const data = options.code !== true;
  const line = (address: number, length: number, text: string): ListingLine => {
    const bytes = Array.from({ length }, (_, offset) => hexByte(source.byteAt(address + offset)!)).join(" ");
    const label = source.nameOf(address);
    const second = source.secondNames(address).filter((name) => name !== label);
    const { line: lineComments, side: own } = source.comments(address);
    // A comment inside the line (knowledge of an older version) shows with its address, as in the source of c64-source.
    const inner: string[] = [];
    for (let offset = 1; offset < length; offset++) {
      const found = source.comments(address + offset);
      for (const text of [...found.line, ...(found.side === undefined ? [] : [found.side])]) inner.push(`${formatC64Address(address + offset)}: ${text}`);
    }
    const side = own === undefined && inner.length === 0 ? undefined : [...(own === undefined ? [] : [own]), ...inner].join(" ");
    const references = source.references(address);
    const access = accessOf(source.coverage, address, length);
    return {
      address,
      bytes,
      ...(label === undefined ? {} : { label }),
      ...(second.length === 0 ? {} : { analyzerNames: second }),
      text,
      ...(access === undefined ? {} : { access }),
      referencesIn: references.in,
      referencesOut: references.out,
      ...(lineComments.length === 0 ? {} : { lineComments }),
      ...(side === undefined ? {} : { comment: side }),
    };
  };
  const regionAt = (address: number) => source.regions.find((region) => address >= region.start && address <= region.end);
  const tables = new Map<Region, ReturnType<typeof tableValues>>();
  const valuesOf = (region: Region) => tables.get(region) ?? tables.set(region, tableValues(region, source)).get(region)!;
  // Start at the code or table region that holds the first address, so the instructions and the words keep their boundaries.
  const first = regionAt(start);
  let address = first !== undefined && (CODE.has(first.type) || TABLES.has(first.type)) ? first.start : start;
  while (address <= end) {
    const byte = source.byteAt(address);
    if (byte === undefined) {
      address++;
      continue;
    }
    const region = regionAt(address);
    if (region !== undefined && CODE.has(region.type)) {
      const opcode = OPCODES[byte]!;
      const length = MODE_LENGTH[opcode.mode];
      const bytes = Array.from({ length: length - 1 }, (_, offset) => source.byteAt(address + 1 + offset));
      if (address + length - 1 <= region.end && bytes.every((value) => value !== undefined)) {
        if (address >= start) {
          // The operand expression of the knowledge in the syntax of the addressing mode, as c64-source writes it.
          const operand = source.operand(address) ?? operandOf(opcode.mode, address, bytes[0] ?? 0, bytes[1] ?? 0, source);
          lines.push(line(address, length, instructionWith(byte, operand)));
        }
        address += length;
        continue;
      }
    }
    // Table values of one size up to the next label, region edge or end of the line. A label inside a word gives its bytes.
    const table = region !== undefined && TABLES.has(region.type) ? valuesOf(region) : undefined;
    // Before the start, step over the values of a table one at a time, so the first line starts at the first value from the start.
    if (address < start) {
      address += table?.get(address)?.length ?? 1;
      continue;
    }
    if (table !== undefined) {
      const size = table.get(address)?.length;
      const texts: string[] = [];
      let at = address;
      while (size !== undefined && at <= end && texts.length * size < DATA_PER_LINE) {
        const value = table.get(at);
        if (value?.length !== size || (at !== address && source.nameOf(at) !== undefined) || (size === 2 && source.nameOf(at + 1) !== undefined)) break;
        texts.push(value.text);
        at += size;
      }
      if (texts.length > 0) {
        if (data) lines.push(line(address, at - address, `${size === 2 ? "!word" : "!byte"} ${texts.join(",")}`));
        address = at;
        continue;
      }
    }
    // Bytes up to the next label, table value, region edge or end of the line.
    const values: number[] = [];
    let at = address;
    while (at <= end && values.length < DATA_PER_LINE && source.byteAt(at) !== undefined && (at === address || (source.nameOf(at) === undefined && regionAt(at) === region && table?.has(at) !== true))) {
      values.push(source.byteAt(at)!);
      at++;
    }
    if (data) lines.push(line(address, values.length, `!byte ${values.map(formatC64Byte).join(",")}`));
    address = at;
  }
  return lines;
}

/** A listing as text, one line for each line, with its line comments above it. */
export function listingText(lines: readonly ListingLine[]): string {
  const out: string[] = [];
  for (const item of lines) {
    for (const comment of item.lineComments ?? []) out.push(`                         ; ${comment}`);
    const head = `${formatC64Address(item.address)}  ${item.bytes.padEnd(9)} ${(item.access ?? "").padEnd(3)}`;
    const body = (item.label === undefined ? "" : `${item.label} `).padEnd(20) + item.text;
    const notes = [
      ...(item.comment === undefined ? [] : [item.comment]),
      ...(item.referencesIn + item.referencesOut === 0 ? [] : [`refs in ${item.referencesIn} out ${item.referencesOut}`]),
      ...(item.analyzerNames === undefined ? [] : [`also ${item.analyzerNames.join(", ")}`]),
    ];
    out.push(`${head} ${body.padEnd(44)}${notes.length === 0 ? "" : ` ; ${notes.join(" | ")}`}`.trimEnd());
  }
  return `${out.join("\n")}\n`;
}
