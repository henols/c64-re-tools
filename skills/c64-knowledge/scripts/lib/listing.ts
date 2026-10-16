// One listing of the image with its knowledge (D78): the lines of a range as
// ACME text with names, operand expressions and comments, the access class of
// the bytes from coverage files, and the references in and out. A hex dump of
// a range with the names in it, and the call graph as Mermaid. Nothing here
// reads files: knowledge.ts gives the lookups.

import { COVERAGE } from "#src/c64.ts";
import { MODE_LENGTH, OPCODES, type Mode } from "#src/opcodes.ts";

export interface ListingSource {
  /** The image byte at an address, or undefined outside the image. */
  byteAt: (address: number) => number | undefined;
  /** The name of an address: a symbol, else a platform name. */
  nameOf: (address: number) => string | undefined;
  /** The analyzer names of an address (D74), for reference. */
  secondNames: (address: number) => string[];
  /** The knowledge regions, in address order. */
  regions: ReadonlyArray<{ start: number; end: number; type: string }>;
  /** The line and side comments of an address. */
  comments: (address: number) => { line: string[]; side?: string };
  /** The operand expression of the instruction at an address (D65), as ACME text. */
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

const CODE = new Set(["code", "jumps"]);
const hex2 = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
const hex4 = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
const DATA_PER_LINE = 8;

/** The access class of bytes from the coverage: x, r and w as they occur, or - for none. */
function accessOf(coverage: Uint8Array | undefined, start: number, length: number): string | undefined {
  if (coverage === undefined) return undefined;
  let flags = 0;
  for (let offset = 0; offset < length; offset++) flags |= coverage[start + offset]!;
  const text = `${flags & (COVERAGE.ramExecute | COVERAGE.romExecute) ? "x" : ""}${flags & (COVERAGE.ramRead | COVERAGE.romRead) ? "r" : ""}${flags & COVERAGE.ramWrite ? "w" : ""}`;
  return text === "" ? "-" : text;
}

/** The operand of an instruction in ACME syntax, with the name of its target where one exists. */
function operandOf(mode: Mode, address: number, low: number, high: number, nameOf: ListingSource["nameOf"]): string {
  const word = low | (high << 8);
  const named = (target: number, digits: 2 | 4) => nameOf(target) ?? (digits === 2 ? hex2(target) : hex4(target));
  switch (mode) {
    case "imp":
      return "";
    case "imm":
      return `#${hex2(low)}`;
    case "zp":
      return named(low, 2);
    case "zpx":
      return `${named(low, 2)},x`;
    case "zpy":
      return `${named(low, 2)},y`;
    case "abs":
      return named(word, 4);
    case "abx":
      return `${named(word, 4)},x`;
    case "aby":
      return `${named(word, 4)},y`;
    case "ind":
      return `(${named(word, 4)})`;
    case "izx":
      return `(${named(low, 2)},x)`;
    case "izy":
      return `(${named(low, 2)}),y`;
    case "rel":
      return named((address + 2 + (low < 0x80 ? low : low - 0x100)) & 0xffff, 4);
  }
}

/** The lines of start..end: instructions in code regions, decoded from the region start, and bytes elsewhere. */
export function listing(source: ListingSource, start: number, end: number): ListingLine[] {
  const lines: ListingLine[] = [];
  const line = (address: number, length: number, text: string): ListingLine => {
    const bytes = Array.from({ length }, (_, offset) => source.byteAt(address + offset)!.toString(16).padStart(2, "0")).join(" ");
    const label = source.nameOf(address);
    const second = source.secondNames(address).filter((name) => name !== label);
    const { line: lineComments, side } = source.comments(address);
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
  // Start at the code region that holds the first address, so the instructions keep their boundaries.
  const first = regionAt(start);
  let address = first !== undefined && CODE.has(first.type) ? first.start : start;
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
        const operand = source.operand(address) ?? operandOf(opcode.mode, address, bytes[0] ?? 0, bytes[1] ?? 0, source.nameOf);
        if (address >= start) lines.push(line(address, length, operand === "" ? opcode.mnemonic : `${opcode.mnemonic} ${operand}`));
        address += length;
        continue;
      }
    }
    // Bytes up to the next label, region edge or end of the line.
    const values: number[] = [];
    let at = address;
    while (at <= end && values.length < DATA_PER_LINE && source.byteAt(at) !== undefined && (at === address || (source.nameOf(at) === undefined && regionAt(at) === region))) {
      values.push(source.byteAt(at)!);
      at++;
    }
    if (address >= start) lines.push(line(address, values.length, `!byte ${values.map(hex2).join(",")}`));
    address = at;
  }
  return lines;
}

/** A listing as text, one line for each line, with its line comments above it. */
export function listingText(lines: readonly ListingLine[]): string {
  const out: string[] = [];
  for (const item of lines) {
    for (const comment of item.lineComments ?? []) out.push(`                         ; ${comment}`);
    const head = `${hex4(item.address)}  ${item.bytes.padEnd(9)} ${(item.access ?? "").padEnd(3)}`;
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

export interface DumpLine {
  address: number;
  hex: string;
  /** The names of addresses on this line. */
  names?: Array<{ address: number; name: string }>;
}

/** The bytes of start..end, 16 to a line from a multiple of 16, with the names on each line. */
export function dump(source: Pick<ListingSource, "byteAt" | "nameOf">, start: number, end: number): DumpLine[] {
  const lines: DumpLine[] = [];
  for (let base = start & 0xfff0; base <= end; base += 16) {
    const cells: string[] = [];
    const names: Array<{ address: number; name: string }> = [];
    for (let address = base; address < base + 16; address++) {
      const byte = address >= start && address <= end ? source.byteAt(address) : undefined;
      cells.push(byte === undefined ? ".." : byte.toString(16).padStart(2, "0"));
      const name = byte === undefined ? undefined : source.nameOf(address);
      if (name !== undefined) names.push({ address, name });
    }
    if (cells.every((cell) => cell === "..")) continue;
    lines.push({ address: base, hex: cells.join(" "), ...(names.length === 0 ? {} : { names }) });
  }
  return lines;
}

/**
 * The call graph as Mermaid: one node for each routine that a call or jump
 * reference reaches from the root (every routine without a root), and one
 * edge for each reference from inside a routine to another routine.
 */
export function graph(
  routines: ReadonlyArray<{ address: number; name: string }>,
  references: ReadonlyArray<{ from: number; to: number; kind: string }>,
  root?: number,
  depth = Number.POSITIVE_INFINITY,
): { mermaid: string; nodes: number; edges: number } {
  const sorted = [...routines].sort((a, b) => a.address - b.address);
  const starts = new Set(sorted.map((routine) => routine.address));
  const owner = (address: number) => sorted.filter((routine) => routine.address <= address).at(-1)?.address;
  const edges = new Map<string, { from: number; to: number; kind: string }>();
  for (const reference of references) {
    if ((reference.kind !== "call" && reference.kind !== "jump") || !starts.has(reference.to)) continue;
    const from = owner(reference.from);
    if (from === undefined || from === reference.to) continue;
    edges.set(`${from}>${reference.to}`, { from, to: reference.to, kind: reference.kind });
  }
  let kept = new Set(starts);
  if (root !== undefined) {
    kept = new Set([root]);
    for (let level = 0, frontier = [root]; level < depth && frontier.length > 0; level++) {
      frontier = [...edges.values()].filter((edge) => frontier.includes(edge.from) && !kept.has(edge.to)).map((edge) => edge.to);
      for (const node of frontier) kept.add(node);
    }
  }
  const nameOf = new Map(sorted.map((routine) => [routine.address, routine.name]));
  const id = (address: number) => `r${address.toString(16).padStart(4, "0")}`;
  const lines = ["flowchart TD"];
  for (const address of [...kept].sort((a, b) => a - b)) lines.push(`  ${id(address)}["${nameOf.get(address) ?? hex4(address)} ${hex4(address)}"]`);
  const shown = [...edges.values()].filter((edge) => kept.has(edge.from) && kept.has(edge.to));
  for (const edge of shown) lines.push(`  ${id(edge.from)} ${edge.kind === "call" ? "-->" : "-.->"} ${id(edge.to)}`);
  return { mermaid: `${lines.join("\n")}\n`, nodes: kept.size, edges: shown.length };
}
