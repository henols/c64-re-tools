// Runtime evidence for static analysis (D44): the coverage as entry points,
// user/LLM code regions and JMP tables as entry points, and the check that
// shows analyzer data over executed code.

import type { DatabaseSync } from "node:sqlite";

import { COVERAGE, coverageEntries, coverageSeedKinds, executedStarts } from "#src/c64.ts";

export { coverageEntries, coverageSeedKinds, executedStarts };
import { FULL_COVERAGE } from "#src/host-client/coverage.ts";
import { listRegions, type RegionRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, type Space } from "#src/knowledge/schema.ts";

const FULL_MAP = FULL_COVERAGE;
const ANALYZER_ORIGINS = new Set(["dxa", "ghidra", "heuristic"]);

/** The byte at an address of the analyzed image, or undefined outside it. */
export type ImageByte = (address: number) => number | undefined;

export function imageReader(bytes: Uint8Array, kind: "prg" | "flat64k"): ImageByte {
  if (kind === "flat64k") return (address) => bytes[address];
  const load = bytes[0]! | (bytes[1]! << 8);
  return (address) => (address >= load && address - load + 2 < bytes.length ? bytes[address - load + 2] : undefined);
}

const ROM_ACCESS = COVERAGE.romRead | COVERAGE.romExecute;
const RAM_USE = COVERAGE.ramRead | COVERAGE.ramExecute;

/**
 * The image bytes under ROM that the runs never used: the CPU read or ran the
 * ROM there, and never read or ran the RAM (R2-07). A JSR $FFE4 or an IRQ
 * vector at $FFFE then leads into ROM, not into the leftover RAM bytes of a
 * flat image, so the ranges are data for the analysis run.
 */
export function romOnlyRanges(map: Uint8Array, image: ImageByte): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let address = 0; address < FULL_MAP; address++) {
    if ((map[address]! & ROM_ACCESS) === 0 || (map[address]! & RAM_USE) !== 0 || image(address) === undefined) continue;
    const last = ranges.at(-1);
    if (last !== undefined && last.end === address - 1) last.end = address;
    else ranges.push({ start: address, end: address });
  }
  return ranges;
}

/** Entry points from semantic knowledge beyond routines: the start of each code region, and each entry of a JMP table with its target. */
export function codeEntries(db: DatabaseSync | undefined, image: ImageByte, space: Space = DEFAULT_SPACE): number[] {
  const entries: number[] = [];
  for (const region of listRegions(db, undefined, undefined, undefined, space).filter((row) => row.origin === "user" || row.origin === "llm")) {
    if (region.type === "code") entries.push(region.start);
    if (region.type !== "jumps") continue;
    for (let at = region.start; at + 2 <= region.end; at += 3) {
      entries.push(at);
      const low = image(at + 1);
      const high = image(at + 2);
      if (image(at) === 0x4c && low !== undefined && high !== undefined) entries.push(low | (high << 8));
    }
  }
  return entries;
}

/** Analyzer data regions that hold executed instruction starts: the coverage shows code there. */
export function coverageConflicts(db: DatabaseSync | undefined, map: Uint8Array): Array<{ region: RegionRow; executed: number }> {
  const conflicts: Array<{ region: RegionRow; executed: number }> = [];
  for (const region of listRegions(db)) {
    if (!ANALYZER_ORIGINS.has(region.origin) || CODE_REGION_TYPES.includes(region.type) || region.type === "dual-use") continue;
    let executed = 0;
    for (let address = region.start; address <= region.end; address++) if ((map[address]! & COVERAGE.ramExecute) !== 0) executed++;
    if (executed > 0) conflicts.push({ region, executed });
  }
  return conflicts;
}
