// The source of a ZX Spectrum program in the syntax of sjasmplus: ORG for each
// segment, a label for each symbol at the start of a line, the instructions of
// the code regions as the Z80 decoder gives them with names in place of their
// addresses, db for the other bytes, and the comments of the knowledge.
//
// The Z80 has instructions with more than one encoding (for example ED 63,
// which sjasmplus writes as 22 for "ld (nn),hl"). A probe source assembles each
// decoded instruction at its own address with numbers only; an instruction
// whose bytes the probe does not give again is written as db, with its text in
// the comment, so the source gives the bytes of the program again.

import { formatAddress, formatByte } from "#src/address.ts";
import type { Cpu } from "#src/cpu.ts";

export interface Z80SourceInput {
  segments: ReadonlyArray<{ start: number; end: number }>;
  byteAt: (address: number) => number;
  cpu: Cpu;
  symbols: ReadonlyArray<{ address: number; name: string }>;
  regions: ReadonlyArray<{ start: number; end: number; type: string }>;
  comments: ReadonlyArray<{ address: number; placement: "line" | "side"; text: string }>;
  platform: ReadonlyArray<{ address: number; name: string; meaning: string }>;
  header: readonly string[];
}

export interface Z80Instruction {
  address: number;
  length: number;
  text: string;
  /** The address that the operand of the instruction gives: a word operand or a relative target. */
  target?: number;
}

const DATA_PER_LINE = 16;
/** A run of this many equal bytes or more is one ds line. */
const MIN_RUN = 16;

/** The instructions of the code regions: decoded from the start of each region, each one inside its region and segment. */
export function z80Instructions(input: Pick<Z80SourceInput, "segments" | "byteAt" | "cpu" | "regions">): Z80Instruction[] {
  const inSegment = (address: number) => input.segments.find((segment) => address >= segment.start && address <= segment.end);
  const byteAt = (address: number) => (inSegment(address) === undefined ? undefined : input.byteAt(address));
  const instructions: Z80Instruction[] = [];
  for (const region of input.regions.filter((item) => item.type === "code").sort((a, b) => a.start - b.start)) {
    let address = region.start;
    while (address <= region.end) {
      const decoded = input.cpu.decode(byteAt, address);
      const end = address + (decoded?.length ?? 1) - 1;
      if (decoded?.text === undefined || end > region.end || inSegment(address) !== inSegment(end)) {
        address++;
        continue;
      }
      const { operand } = decoded;
      const target =
        operand === undefined ? undefined : operand.relative ? (decoded.branch ?? decoded.jump) : operand.size === 2 ? input.byteAt(address + operand.offset) | (input.byteAt(address + operand.offset + 1) << 8) : undefined;
      instructions.push({ address, length: decoded.length, text: decoded.text, ...(target === undefined ? {} : { target }) });
      address += decoded.length;
    }
  }
  return instructions;
}

/** The probe: each instruction at its own address, with numbers only. */
export function z80ProbeSource(instructions: readonly Z80Instruction[]): string {
  return `${instructions.map((instruction) => `\tORG ${formatAddress(instruction.address)}\n\t${instruction.text}`).join("\n")}\n`;
}

/** The instructions whose bytes the probe build gives again. */
export function z80Encoded(instructions: readonly Z80Instruction[], built: Uint8Array, byteAt: (address: number) => number): Set<number> {
  const same = new Set<number>();
  for (const instruction of instructions) {
    let equal = true;
    for (let offset = 0; offset < instruction.length && equal; offset++) equal = built[instruction.address + offset] === byteAt(instruction.address + offset);
    if (equal) same.add(instruction.address);
  }
  return same;
}

export interface Z80Rendered {
  text: string;
  instructions: number;
  dataBytes: number;
  /** The instructions that the source writes as db: sjasmplus encodes their text in another way. */
  asBytes: number[];
}

/** The source text. `encoded` holds the instructions that sjasmplus encodes as the program has them. */
export function renderZ80(input: Z80SourceInput, instructions: readonly Z80Instruction[], encoded: ReadonlySet<number>): Z80Rendered {
  const at = new Map(instructions.map((instruction) => [instruction.address, instruction]));
  const labelAt = new Map<number, string>();
  for (const symbol of input.symbols) if (!labelAt.has(symbol.address)) labelAt.set(symbol.address, symbol.name);
  const taken = new Set(labelAt.values());
  // A target of a jump, branch or call at an instruction start gets a name of the source, as l_8015.
  for (const instruction of instructions) {
    const target = instruction.target;
    if (target === undefined || labelAt.has(target) || !at.has(target) || !encoded.has(instruction.address)) continue;
    const name = `l_${target.toString(16).padStart(4, "0")}`;
    if (taken.has(name)) continue;
    labelAt.set(target, name);
    taken.add(name);
  }
  // A platform name only where the knowledge has no name: of the address, or the same name elsewhere.
  const platformAt = new Map(input.platform.filter((entry) => !labelAt.has(entry.address) && !taken.has(entry.name)).map((entry) => [entry.address, entry]));
  const nameOf = (address: number) => labelAt.get(address) ?? platformAt.get(address)?.name;
  /** True when MIN_RUN equal bytes start at the address, inside the program. */
  const startsRun = (address: number) => {
    const segment = input.segments.find((item) => address >= item.start && address <= item.end);
    if (segment === undefined || address + MIN_RUN - 1 > segment.end) return false;
    for (let offset = 1; offset < MIN_RUN; offset++) if (input.byteAt(address + offset) !== input.byteAt(address)) return false;
    return true;
  };
  const lineComments = (address: number) => input.comments.filter((comment) => comment.address === address && comment.placement === "line").map((comment) => comment.text);
  const sideComment = (address: number) => input.comments.find((comment) => comment.address === address && comment.placement === "side")?.text;

  const body: string[] = [];
  const placed = new Set<number>();
  const usedPlatform = new Set<string>();
  let dataBytes = 0;
  const asBytes: number[] = [];
  const emit = (address: number, text: string, side?: string) => {
    for (const comment of lineComments(address)) body.push(`; ${comment}`);
    const label = labelAt.get(address);
    if (label !== undefined) {
      body.push(`${label}:`);
      placed.add(address);
    }
    const note = sideComment(address);
    const notes = [side, note].filter((item) => item !== undefined);
    body.push(`\t${text}${notes.length === 0 ? "" : `\t; ${notes.join(" | ")}`}`);
  };
  for (const segment of [...input.segments].sort((a, b) => a.start - b.start)) {
    body.push("", `\tORG ${formatAddress(segment.start)}`);
    let address = segment.start;
    while (address <= segment.end) {
      const instruction = at.get(address);
      if (instruction !== undefined && encoded.has(address)) {
        let text = instruction.text;
        if (instruction.target !== undefined) {
          const name = nameOf(instruction.target);
          if (name !== undefined) {
            text = text.replace(formatAddress(instruction.target), name);
            if (platformAt.get(instruction.target)?.name === name) usedPlatform.add(name);
          }
        }
        emit(address, text);
        address += instruction.length;
        continue;
      }
      if (instruction !== undefined) {
        // An instruction that sjasmplus encodes in another way: its bytes, with its text.
        const bytes = Array.from({ length: instruction.length }, (_, offset) => formatByte(input.byteAt(address + offset)));
        emit(address, `db ${bytes.join(",")}`, instruction.text);
        asBytes.push(address);
        dataBytes += instruction.length;
        address += instruction.length;
        continue;
      }
      // A byte that may end a run or a data line: a label, an instruction or a comment starts there.
      const free = (next: number) => !labelAt.has(next) && !at.has(next) && lineComments(next).length === 0 && sideComment(next) === undefined;
      let run = address + 1;
      while (run <= segment.end && free(run) && input.byteAt(run) === input.byteAt(address)) run++;
      if (run - address >= MIN_RUN) {
        emit(address, `ds ${run - address},${formatByte(input.byteAt(address))}`);
        dataBytes += run - address;
        address = run;
        continue;
      }
      // Bytes up to the next label, instruction, run, segment end or the end of the line.
      const values: string[] = [];
      let next = address;
      while (next <= segment.end && values.length < DATA_PER_LINE && (next === address || (free(next) && !startsRun(next)))) {
        values.push(formatByte(input.byteAt(next)));
        next++;
      }
      emit(address, `db ${values.join(",")}`);
      dataBytes += values.length;
      address = next;
    }
  }
  // A name that is no label of a line: an address outside the program or inside an instruction.
  const equates = [...labelAt].filter(([address]) => !placed.has(address)).sort(([a], [b]) => a - b);
  const platformLines = input.platform.filter((entry) => usedPlatform.has(entry.name)).map((entry) => `${entry.name}\tEQU ${formatAddress(entry.address)}\t; ${entry.meaning}`);
  const text = [
    ...input.header.map((line) => `; ${line}`),
    ...(platformLines.length === 0 ? [] : ["", "; The platform names that the program uses.", ...platformLines]),
    ...(equates.length === 0 ? [] : ["", "; The names of the knowledge at addresses that no line starts.", ...equates.map(([address, name]) => `${name}\tEQU ${formatAddress(address)}`)]),
    ...body,
    "",
  ].join("\n");
  return { text, instructions: instructions.length - asBytes.length, dataBytes, asBytes };
}
