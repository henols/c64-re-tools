// Reads the emulator's memory access map as coverage bytes (D40): one byte
// per address, RAM, ROM and I/O apart. The MCP tool and the skill scripts share it.

import { COVERAGE, type CodeRange } from "../c64.ts";
import { MAX_MEMMAP_RANGES, type MemmapRange } from "../protocol/vice.ts";
import { readProjectFile } from "./transfer.ts";
import type { ViceSessionClient } from "./vice-session.ts";

/** A full coverage file: offset n is address n (D40). */
export const FULL_COVERAGE = 0x10000;

/**
 * Reads full coverage files from the project and joins them: an address has
 * every flag that any run gave it. `fail` refuses a file of another size.
 */
export function readCoverageFiles(paths: string[], fail: (message: string) => never): Uint8Array | undefined {
  if (paths.length === 0) return undefined;
  const joined = new Uint8Array(FULL_COVERAGE);
  for (const path of paths) {
    const { bytes } = readProjectFile(path);
    if (bytes.length !== FULL_COVERAGE) {
      fail(`--coverage ${path} has ${bytes.length} bytes; a full coverage file has 65536, one for each address. Write it with c64_memmap action read and out, without start and end.`);
    }
    for (let address = 0; address < FULL_COVERAGE; address++) joined[address]! |= bytes[address]!;
  }
  return joined;
}

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

/** True when the CPU executed an instruction in RAM somewhere in the range. */
export function executedIn(map: Uint8Array, range: CodeRange): boolean {
  for (let address = range.start; address <= range.end; address++) if ((map[address]! & COVERAGE.ramExecute) !== 0) return true;
  return false;
}
