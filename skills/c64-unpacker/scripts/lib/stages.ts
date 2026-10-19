// The stage rule of the c64-unpacker script. The memory map keeps
// no order: a written and executed byte can be code that ran first and was
// written over later, as a decruncher does to its own start code. So a stage
// starts only where the CPU executes an opcode byte that the current stage
// wrote before the CPU got there. Code that the stage executed before it wrote
// it is the stage's own code: it stops the run once, and then a write watch
// over it arms it again. Written code that the stage calls, and that returns
// to the stage, is the stage's own code too: a packer hands off by JMP,
// RTS or RTI and never runs its own code again.

import { COVERAGE } from "#src/cpu/coverage.ts";
import { type AddressRange } from "#src/address.ts";
import { writtenBlocks } from "#src/host-client/coverage.ts";

const contains = (range: AddressRange, address: number) => address >= range.start && address <= range.end;

/** The flags of two maps from $0000 in one. */
export function mergeMaps(into: Uint8Array, from: Uint8Array): void {
  for (let address = 0; address < into.length; address++) into[address]! |= from[address]!;
}

/**
 * The written blocks of at least `minimum` bytes in which a chunk executed
 * code that can start a stage: every executed address except own code that
 * the stage has not written.
 */
export function stageCandidates(stage: Uint8Array, chunk: Uint8Array, own: ReadonlySet<number>, minimum: number, called: readonly AddressRange[] = []): AddressRange[] {
  const combined = Uint8Array.from(stage);
  mergeMaps(combined, chunk);
  return writtenBlocks(combined, minimum).filter((block) => {
    for (let address = block.start; address <= block.end; address++) {
      if ((chunk[address]! & COVERAGE.ramExecute) === 0) continue;
      if (inRanges(called, address)) continue;
      if (own.has(address) && (combined[address]! & COVERAGE.ramWrite) === 0) continue;
      return true;
    }
    return false;
  });
}

/**
 * The points of a run over the candidate blocks: exec breakpoints over all of
 * them except own code that is not written yet, and write watches over that
 * own code.
 */
export function stagePoints(blocks: readonly AddressRange[], own: ReadonlySet<number>, written: (address: number) => boolean, called: readonly AddressRange[] = []): { exec: AddressRange[]; watch: AddressRange[] } {
  const exec: AddressRange[] = [];
  const watch: AddressRange[] = [];
  const add = (list: AddressRange[], address: number) => {
    const last = list[list.length - 1];
    if (last !== undefined && last.end === address - 1) last.end = address;
    else list.push({ start: address, end: address });
  };
  for (const block of blocks) {
    for (let address = block.start; address <= block.end; address++) {
      if (inRanges(called, address)) continue;
      if (own.has(address) && !written(address)) add(watch, address);
      else add(exec, address);
    }
  }
  return { exec, watch };
}

/** True when the address lies in one of the ranges. */
export function inRanges(ranges: readonly AddressRange[], address: number): boolean {
  return ranges.some((range) => contains(range, address));
}

/**
 * Where a call returns to the stage: the return address on top of the
 * stack, when a JSR that the stage executed pushed it. `stack` is page 1.
 * Returns the address of the instruction after that JSR.
 */
export function callReturn(stack: Uint8Array, sp: number, byteAt: (address: number) => number, executed: (address: number) => boolean): number | undefined {
  const pushed = stack[(sp + 1) & 0xff]! | (stack[(sp + 2) & 0xff]! << 8);
  const jsr = (pushed - 2) & 0xffff;
  if (byteAt(jsr) !== 0x20 || !executed(jsr)) return undefined;
  return (pushed + 1) & 0xffff;
}

/**
 * The code that ran in a block: its executed opcode bytes with the two bytes
 * after each, which can be operands, joined and cut at the block's end.
 */
export function executedIn(map: Uint8Array, block: AddressRange): AddressRange[] {
  const ranges: AddressRange[] = [];
  for (let address = block.start; address <= block.end; address++) {
    if ((map[address]! & COVERAGE.ramExecute) === 0) continue;
    const end = Math.min(block.end, address + 2);
    const last = ranges[ranges.length - 1];
    if (last !== undefined && address <= last.end + 1) last.end = Math.max(last.end, end);
    else ranges.push({ start: address, end });
  }
  return ranges;
}

/** Pages 0-3 ($0000-$03ff) are in entry_state.json: a written block that is all in them is no segment. */
export const FIRST_SEGMENT_ADDRESS = 0x0400;

/**
 * The segments of a capture: the blocks that the stages wrote, without loader
 * leftovers and without blocks that are all in pages 0-3 (the entry state
 * holds them), joined into ranges that do not overlap or touch. A block
 * is a leftover when it holds the entry of an intermediate stage that started
 * after the block's writer, and no write from that stage on replaced the code
 * at that entry. Code that a stage ran before a later stage wrote over
 * it never drops a block, and the block that holds the capture entry is always
 * a segment. A block that an intermediate stage wrote inside a leftover, for
 * example a variable of the loader, is a leftover too. The filter comes before
 * the join: a join first would drop the program with a leftover. `writtenBy` is
 * the last stage that wrote into the range.
 */
export function captureSegments(stages: ReadonlyArray<{ entry: number; wrote: readonly AddressRange[] }>, entry: number): Array<AddressRange & { writtenBy: number }> {
  const last = stages.length - 1;
  const replaced = (from: number, address: number) => stages.slice(from).some((stage) => inRanges(stage.wrote, address));
  const leftover = (block: AddressRange, writer: number) =>
    !contains(block, entry) && stages.some((stage, index) => index > writer && index < last && contains(block, stage.entry) && !replaced(index, stage.entry));
  const written = stages.flatMap((stage, index) => stage.wrote.map((range) => ({ start: range.start, end: range.end, writtenBy: index })));
  const leftovers = written.filter((block) => leftover(block, block.writtenBy));
  const inLeftover = (block: AddressRange & { writtenBy: number }) =>
    block.writtenBy < last && !contains(block, entry) && leftovers.some((left) => block.start >= left.start && block.end <= left.end);
  const blocks = written
    .filter((block) => !leftover(block, block.writtenBy) && !inLeftover(block) && (block.end >= FIRST_SEGMENT_ADDRESS || contains(block, entry)))
    .sort((a, b) => a.start - b.start);
  const segments: Array<AddressRange & { writtenBy: number }> = [];
  for (const block of blocks) {
    const previous = segments[segments.length - 1];
    if (previous !== undefined && block.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, block.end);
      previous.writtenBy = Math.max(previous.writtenBy, block.writtenBy);
    } else segments.push({ ...block });
  }
  return segments;
}

/** The segments without the bytes of `holes`: a segment that a hole cuts gives its parts, each with the fields of the segment. */
export function withoutRanges<T extends AddressRange>(segments: readonly T[], holes: readonly AddressRange[]): T[] {
  let pieces = [...segments];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      if (hole.end < piece.start || hole.start > piece.end) return [piece];
      return [...(hole.start > piece.start ? [{ ...piece, end: hole.start - 1 }] : []), ...(hole.end < piece.end ? [{ ...piece, start: hole.end + 1 }] : [])];
    });
  }
  return pieces;
}
