// The loader of a generated source (D48): a PRG that copies each segment and
// the entry state's pages $0002-$03ff into place, sets $00/$01, the stack
// pointer, A, X, Y and the flags, and jumps to the entry. The copies run
// from a free page with SEI and all RAM visible, in an order where no copy
// overwrites the packed bytes of a copy that has not run yet. The plan is
// simulated here before the emulator runs it.

import { formatC64Address } from "#src/c64.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import type { Range } from "./source.ts";

export interface EntryState {
  pc: number;
  a: number;
  x: number;
  y: number;
  sp: number;
  /** The status register as PLP reads it. */
  flags: number;
  port: [number, number];
  /** $0000-$03ff at the entry. */
  pages: Uint8Array;
}

const FLAG_BITS: Record<string, number> = { n: 0x80, v: 0x40, b: 0x10, d: 0x08, i: 0x04, z: 0x02, c: 0x01 };

/** Reads entry_state.json of the c64-unpacker skill. */
export function readEntryState(text: string, path: string): EntryState {
  const fail = (what: string): never => {
    throw new WireFailure("invalid-input", `${path} is not an entry_state.json of the c64-unpacker skill: ${what}.`);
  };
  let value: Record<string, any>;
  try {
    value = JSON.parse(text) as Record<string, any>;
  } catch (error) {
    return fail((error as Error).message);
  }
  const registers = value.registers;
  const byte = (item: unknown, what: string) => (Number.isInteger(item) && (item as number) >= 0 && (item as number) <= 0xff ? (item as number) : fail(`${what} is not a byte`));
  if (typeof registers !== "object" || registers === null) return fail("it has no registers");
  const pc = typeof registers.pc === "string" && /^\$[0-9a-f]{4}$/i.test(registers.pc) ? Number.parseInt(registers.pc.slice(1), 16) : fail("registers.pc is not a $ address");
  if (typeof registers.flags !== "object" || registers.flags === null) fail("registers.flags is missing");
  let flags = 0x20;
  for (const [name, bit] of Object.entries(FLAG_BITS)) if (registers.flags[name] === true) flags |= bit;
  const pages = new Uint8Array(0x400);
  for (let page = 0; page < 4; page++) {
    const hex = value.pages?.[formatC64Address(page << 8)];
    if (typeof hex !== "string" || !/^[0-9a-f]{512}$/i.test(hex)) fail(`pages.${formatC64Address(page << 8)} is not 256 bytes of hex`);
    pages.set(Buffer.from(hex as string, "hex"), page << 8);
  }
  return {
    pc,
    a: byte(registers.a, "registers.a"),
    x: byte(registers.x, "registers.x"),
    y: byte(registers.y, "registers.y"),
    sp: byte(registers.sp, "registers.sp"),
    flags,
    port: [byte(value.cpuPort?.$00, "cpuPort.$00"), byte(value.cpuPort?.$01, "cpuPort.$01")],
    pages,
  };
}

export interface Copy {
  /** What the copy writes: a segment or a part of pages 0-3. */
  what: string;
  target: Range;
  source: Range;
  /** True when the copy runs from the last byte down: its target is above an overlapping source. */
  backward: boolean;
}

/** What the loader holds, in its order: a segment or a part of pages 0-3, packed at an address of the loader. */
export interface PackedBlock {
  what: string;
  range: Range;
  packedAt: number;
  bytes: (address: number) => number;
}

export interface LoaderPlan {
  blocks: PackedBlock[];
  copies: Copy[];
  /** The first of the two free pages where the copier runs. */
  copier: number;
  /** The address of the free stack byte below the stack pointer, which the flags pass through. */
  stackByte: number;
  end: number;
  text: string;
}

/** The label of the loader's jump to the entry, in ACME's symbol list. */
export const LOADER_JUMP = "c64_source_loader_jump";

const LOAD = 0x0801;
const STUB = 0x080d;
/** sei, ldx, the 2-page move loop and jmp. */
const STUB_SIZE = 21;
/** The copier code and its three variables, without the table. */
const COPIER_CODE_SIZE = 167;
const COPY_ENTRY = 7;
/** X indexes the table, so the table fits in 256 bytes. */
export const MAX_COPIES = Math.floor((256 - 2) / COPY_ENTRY);
/** A loader that loads into $d000 or higher would write the I/O area. */
const LOAD_LIMIT = 0xcfff;
const COPIER_PAGES = [...Array.from({ length: 15 }, (_, index) => 0xc000 + index * 0x100), ...Array.from({ length: 0x9b }, (_, index) => 0x9e00 - index * 0x100)];

const hex2 = (value: number) => `$${value.toString(16).padStart(2, "0")}`;
const hex4 = formatC64Address;
const overlaps = (a: Range, b: Range) => a.start <= b.end && b.start <= a.end;
const show = (range: Range) => `${hex4(range.start)}-${hex4(range.end)}`;

/** Parts of `range` that no range in `holes` covers. */
function subtract(range: Range, holes: Range[]): Range[] {
  let pieces = [range];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      if (!overlaps(piece, hole)) return [piece];
      return [...(hole.start > piece.start ? [{ start: piece.start, end: hole.start - 1 }] : []), ...(hole.end < piece.end ? [{ start: hole.end + 1, end: piece.end }] : [])];
    });
  }
  return pieces;
}

/** Orders the copies so that no copy writes over the source of a later one; undefined when they form a cycle. */
export function copyOrder(copies: Array<Omit<Copy, "backward">>): number[] | undefined {
  const order: number[] = [];
  const done = new Set<number>();
  while (order.length < copies.length) {
    const next = copies.findIndex((copy, index) => !done.has(index) && copies.every((other, at) => at === index || done.has(at) || !overlaps(copy.target, other.source)));
    if (next < 0) return undefined;
    order.push(next);
    done.add(next);
  }
  return order;
}

/** Runs the copies on a memory model as the copier does, byte by byte; returns the first wrong target byte. */
export function simulate(memory: Int16Array, copies: Copy[], expected: (address: number) => number): number | undefined {
  for (const copy of copies) {
    const length = copy.target.end - copy.target.start + 1;
    for (let step = 0; step < length; step++) {
      const offset = copy.backward ? length - 1 - step : step;
      memory[copy.target.start + offset] = memory[copy.source.start + offset]!;
    }
  }
  for (const copy of copies) for (let address = copy.target.start; address <= copy.target.end; address++) if (memory[address] !== expected(address)) return address;
  return undefined;
}

export interface LoaderInput {
  /** The segments with the files that hold them, in address order. */
  segments: Array<Range & { files: string[] }>;
  byteAt: (address: number) => number;
  state: EntryState;
  entry: number;
  header: string[];
}

/** Plans the loader: the packed layout, the copy order and the copier page, and writes loader.asm. Refuses by name when no plan exists. */
export function planLoader(input: LoaderInput): LoaderPlan {
  const { state } = input;
  // What the copies write: each segment without $00/$01, which the loader sets last, and pages $0002-$03ff where no segment is.
  const blocks: Array<{ what: string; range: Range; files?: string[]; pseudo: number; bytes: (address: number) => number }> = [];
  for (const segment of input.segments) blocks.push({ what: `segment ${show(segment)}`, range: segment, files: segment.files, pseudo: segment.start, bytes: input.byteAt });
  for (const part of subtract({ start: 0x0002, end: 0x03ff }, input.segments)) {
    blocks.push({ what: `entry state ${show(part)}`, range: part, pseudo: part.start, bytes: (address) => state.pages[address]! });
  }
  blocks.sort((a, b) => a.range.start - b.range.start);

  let at = STUB + STUB_SIZE;
  const plain: Array<Omit<Copy, "backward">> = [];
  const packedAt: number[] = [];
  for (const block of blocks) {
    packedAt.push(at);
    const target = { start: Math.max(block.range.start, 0x0002), end: block.range.end };
    if (target.start <= target.end) {
      const source = { start: at + (target.start - block.range.start), end: at + (target.end - block.range.start) };
      plain.push({ what: block.what, target, source });
    }
    at += block.range.end - block.range.start + 1;
  }
  if (plain.length > MAX_COPIES) throw new WireFailure("invalid-input", `The loader needs ${plain.length} copies; it can do at most ${MAX_COPIES}. Join segments in the unpacker capture (--range) or write the loader by hand.`);
  const copierImage = at;
  const copierSize = COPIER_CODE_SIZE + COPY_ENTRY * plain.length + 2;
  const end = copierImage + copierSize - 1;
  if (end > LOAD_LIMIT) throw new WireFailure("invalid-input", `The loader would end at ${hex4(end)}, after ${hex4(LOAD_LIMIT)}: loading it would write the I/O area. The image is too large for one loader file.`);

  const order = copyOrder(plain);
  if (order === undefined) {
    const clashing = plain.filter((copy) => plain.some((other) => other !== copy && overlaps(copy.target, other.source))).map((copy) => `${copy.what} (packed at ${show(copy.source)})`);
    throw new WireFailure("invalid-input", `No copy order exists: each of these copies writes over the packed bytes of another one: ${clashing.join(", ")}. Write the loader by hand.`);
  }
  const loaded = { start: LOAD, end };
  const copier = COPIER_PAGES.find((page) => {
    const pages = { start: page, end: page + 0x1ff };
    return !overlaps(pages, loaded) && plain.every((copy) => !overlaps(pages, copy.target));
  });
  if (copier === undefined) throw new WireFailure("invalid-input", `No two free pages exist for the copier in $0400-$9fff or $c000-$cfff outside the loader (${show(loaded)}) and the targets: ${plain.map((copy) => show(copy.target)).join(", ")}.`);
  const copies: Copy[] = order.map((index) => {
    const copy = plain[index]!;
    return { ...copy, backward: copy.target.start > copy.source.start && overlaps(copy.target, copy.source) };
  });

  const stackByte = 0x0100 + state.sp;
  const lines: string[] = [...input.header.map((line) => `; ${line}`), "", "!cpu 6510", '!source "constants.asm"', "", `* = ${hex4(LOAD)}`];
  lines.push(`        !byte $0b,$08,$0a,$00,$9e,${[...String(STUB)].map((digit) => hex2(digit.charCodeAt(0))).join(",")},$00,$00,$00 ; 10 SYS ${STUB}`);
  lines.push(
    "!zone loader_stub {",
    "        sei",
    "        ldx #0",
    `-       lda ${hex4(copierImage)},x`,
    `        sta ${hex4(copier)},x`,
    `        lda ${hex4(copierImage + 0x100)},x`,
    `        sta ${hex4(copier + 0x100)},x`,
    "        inx",
    "        bne -",
    `        jmp ${hex4(copier)}`,
    "}",
  );
  for (const block of blocks) {
    lines.push("", `; ${block.what}`, `!pseudopc ${hex4(block.pseudo)} {`);
    if (block.files !== undefined) for (const file of block.files) lines.push(`!source "${file}"`);
    else {
      for (let address = block.range.start; address <= block.range.end; address += 16) {
        const last = Math.min(block.range.end, address + 15);
        lines.push(`        !byte ${Array.from({ length: last - address + 1 }, (_, offset) => hex2(block.bytes(address + offset))).join(",")}`);
      }
    }
    lines.push("}");
  }
  const [port0, port1] = state.port;
  lines.push(
    "",
    `; The copier runs at ${hex4(copier)}. The flags pass through ${hex4(stackByte)}, the free stack byte below the stack pointer.`,
    `!pseudopc ${hex4(copier)} {`,
    "!zone loader_copier {",
    "        lda #$34",
    "        sta $01",
    "        ldx #0",
    ".next   lda .table,x",
    "        sta .count",
    "        lda .table+1,x",
    "        sta .count+1",
    "        ora .count",
    "        beq .done",
    "        lda .table+2,x",
    "        sta .read+1",
    "        lda .table+3,x",
    "        sta .read+2",
    "        lda .table+4,x",
    "        sta .write+1",
    "        lda .table+5,x",
    "        sta .write+2",
    "        lda .table+6,x",
    "        sta .back",
    "        stx .index",
    ".read   lda $ffff",
    ".write  sta $ffff",
    "        lda .back",
    "        bne .down",
    "        inc .read+1",
    "        bne +",
    "        inc .read+2",
    "+       inc .write+1",
    "        bne +",
    "        inc .write+2",
    "+       jmp .counted",
    ".down   lda .read+1",
    "        bne +",
    "        dec .read+2",
    "+       dec .read+1",
    "        lda .write+1",
    "        bne +",
    "        dec .write+2",
    "+       dec .write+1",
    ".counted",
    "        lda .count",
    "        bne +",
    "        dec .count+1",
    "+       dec .count",
    "        lda .count",
    "        ora .count+1",
    "        bne .read",
    "        lda .index",
    "        clc",
    "        adc #7",
    "        tax",
    "        jmp .next",
    `.done   lda #${hex2(port0)}`,
    "        sta $00",
    `        lda #${hex2(port1)}`,
    "        sta $01",
    `        ldx #${hex2((state.sp - 1) & 0xff)}`,
    "        txs",
    `        lda #${hex2(state.flags)}`,
    `        sta ${hex4(stackByte)}`,
    `        lda #${hex2(state.a)}`,
    `        ldx #${hex2(state.x)}`,
    `        ldy #${hex2(state.y)}`,
    "        plp",
    // A global label: the check of the loader stops here, before an interrupt can run (F-32).
    `${LOADER_JUMP} jmp ${hex4(input.entry)}`,
    ".count  !word 0",
    ".index  !byte 0",
    ".back   !byte 0",
    ".table",
  );
  for (const copy of copies) {
    const length = copy.target.end - copy.target.start + 1;
    const read = copy.backward ? copy.source.end : copy.source.start;
    const write = copy.backward ? copy.target.end : copy.target.start;
    lines.push(`        !word ${hex4(length)},${hex4(read)},${hex4(write)} : !byte ${copy.backward ? 1 : 0} ; ${copy.what}`);
  }
  lines.push("        !word 0", "}", "}");

  return {
    blocks: blocks.map((block, index) => ({ what: block.what, range: block.range, packedAt: packedAt[index]!, bytes: block.bytes })),
    copies,
    copier,
    stackByte,
    end,
    text: `${lines.join("\n")}\n`,
  };
}
