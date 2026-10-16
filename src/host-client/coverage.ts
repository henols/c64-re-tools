// Reads the emulator's memory access map as coverage bytes (D40): one byte
// per address, RAM, ROM and I/O apart. The MCP tool and the skill scripts share it.

import { COVERAGE, type CodeRange } from "../c64.ts";
import { MAX_MEMMAP_RANGES, type MemmapRange } from "../protocol/vice.ts";
import type { ViceSessionClient } from "./vice-session.ts";

/** A full coverage file: offset n is address n (D40). */
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

