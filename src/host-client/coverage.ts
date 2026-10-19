// Reads the emulator's memory access map as coverage bytes: one byte
// per address, RAM, ROM and I/O apart. The MCP tool and the skill scripts share it.

import { COVERAGE, type CodeRange } from "../cpu/coverage.ts";
import { MAX_MEMMAP_RANGES, type MemmapRange } from "../protocol/vice.ts";
import type { ViceSessionClient } from "./vice-session.ts";

/** A full coverage file: offset n is address n. */
export const FULL_COVERAGE = 0x10000;

/** The coverage bytes of start..end, read from the session in parts. */
export async function readCoverage(session: Pick<ViceSessionClient, "memmap">, start = 0x0000, end = 0xffff): Promise<Uint8Array> {
  const map = new Uint8Array(end - start + 1);
  for (let from: number | undefined = start; from !== undefined; ) {
    const part: { ranges: MemmapRange[]; next?: number } = await session.memmap({ action: "read", start: from, end, maxRanges: MAX_MEMMAP_RANGES });
    for (const range of part.ranges) map.fill(range.flags, range.start - start, range.end - start + 1);
    from = part.next;
  }
  return map;
}

/** The I/O area. VICE maps every write there as an I/O write, also one with the RAM banked in by $01. */
export const IO_RAM = { start: 0xd000, end: 0xdfff } as const;

/**
 * Marks the RAM writes under the I/O area in a map from $0000, from two reads
 * of that RAM. The RAM there changes only by a write with the I/O area banked
 * out. A run of written or changed bytes is RAM written when one byte of it
 * changed: a byte written with the value that was there is part of it too.
 * A run of register writes changes no RAM. `before` and `after` hold $d000-$dfff.
 */
export function markIoRamWrites(map: Uint8Array, before: Uint8Array, after: Uint8Array): void {
  const size = IO_RAM.end - IO_RAM.start + 1;
  const written = (offset: number) => before[offset] !== after[offset] || (map[IO_RAM.start + offset]! & (COVERAGE.ioWrite | COVERAGE.ramWrite)) !== 0;
  for (let start = 0; start < size; ) {
    if (!written(start)) {
      start++;
      continue;
    }
    let end = start;
    let changed = false;
    for (; end < size && written(end); end++) changed ||= before[end] !== after[end];
    if (changed) for (let offset = start; offset < end; offset++) map[IO_RAM.start + offset]! |= COVERAGE.ramWrite;
    start = end;
  }
}

/** Runs of RAM that a program wrote, at least `minimum` bytes each, in a map from $0000. */
export function writtenBlocks(map: Uint8Array, minimum: number): CodeRange[] {
  const blocks: CodeRange[] = [];
  let start = -1;
  for (let address = 0; address <= map.length; address++) {
    const written = address < map.length && (map[address]! & COVERAGE.ramWrite) !== 0;
    if (written && start < 0) start = address;
    if (!written && start >= 0) {
      if (address - start >= minimum) blocks.push({ start, end: address - 1 });
      start = -1;
    }
  }
  return blocks;
}

