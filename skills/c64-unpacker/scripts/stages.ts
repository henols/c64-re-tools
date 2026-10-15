// The stage rule of the c64-unpacker script (D43, F-17). The memory map keeps
// no order: a written and executed byte can be code that ran first and was
// written over later, as a decruncher does to its own start code. So a stage
// starts only where the CPU executes an opcode byte that the current stage
// wrote before the CPU got there. Code that the stage executed before it wrote
// it is the stage's own code: it stops the run once, and then a write watch
// over it arms it again.

import { COVERAGE } from "#src/c64.ts";
import { writtenBlocks } from "#src/host-client/coverage.ts";

export interface Range {
  start: number;
  end: number;
}

const contains = (range: Range, address: number) => address >= range.start && address <= range.end;

/** The flags of two maps from $0000 in one. */
export function mergeMaps(into: Uint8Array, from: Uint8Array): void {
  for (let address = 0; address < into.length; address++) into[address]! |= from[address]!;
}

/**
 * The written blocks of at least `minimum` bytes in which a chunk executed
 * code that can start a stage: every executed address except own code that
 * the stage has not written.
 */
export function stageCandidates(stage: Uint8Array, chunk: Uint8Array, own: ReadonlySet<number>, minimum: number): Range[] {
  const combined = Uint8Array.from(stage);
  mergeMaps(combined, chunk);
  return writtenBlocks(combined, minimum).filter((block) => {
    for (let address = block.start; address <= block.end; address++) {
      if ((chunk[address]! & COVERAGE.ramExecute) === 0) continue;
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
export function stagePoints(blocks: readonly Range[], own: ReadonlySet<number>, written: (address: number) => boolean): { exec: Range[]; watch: Range[] } {
  const exec: Range[] = [];
  const watch: Range[] = [];
  const add = (list: Range[], address: number) => {
    const last = list[list.length - 1];
    if (last !== undefined && last.end === address - 1) last.end = address;
    else list.push({ start: address, end: address });
  };
  for (const block of blocks) {
    for (let address = block.start; address <= block.end; address++) {
      if (own.has(address) && !written(address)) add(watch, address);
      else add(exec, address);
    }
  }
  return { exec, watch };
}

/** True when the address lies in one of the ranges. */
export function inRanges(ranges: readonly Range[], address: number): boolean {
  return ranges.some((range) => contains(range, address));
}
