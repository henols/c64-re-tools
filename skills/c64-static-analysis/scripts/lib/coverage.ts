// Runtime evidence for static analysis: the coverage as entry points,
// user/LLM code regions and JMP tables as entry points, and the check that
// shows analyzer data over executed code.

import type { DatabaseSync } from "node:sqlite";

import { COVERAGE } from "#src/c64.ts";
import { coverageEntries, coverageSeedKinds, executedStarts, romOnlyRanges } from "#src/cpu/coverage.ts";

export { coverageEntries, coverageSeedKinds, executedStarts, romOnlyRanges };
import { listRegions, type RegionRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, isAnalyzer, isSemantic, type Space } from "#src/knowledge/schema.ts";

/** The byte at an address of the analyzed image, or undefined outside it. */
export type ImageByte = (address: number) => number | undefined;

export function imageReader(bytes: Uint8Array, kind: "prg" | "flat64k"): ImageByte {
  if (kind === "flat64k") return (address) => bytes[address];
  const load = bytes[0]! | (bytes[1]! << 8);
  return (address) => (address >= load && address - load + 2 < bytes.length ? bytes[address - load + 2] : undefined);
}

/** Entry points from semantic knowledge beyond routines: the start of each code region, and each entry of a JMP table with its target. */
export function codeEntries(db: DatabaseSync | undefined, image: ImageByte, space: Space = DEFAULT_SPACE): number[] {
  const entries: number[] = [];
  for (const region of listRegions(db, undefined, undefined, undefined, space).filter((row) => isSemantic(row.origin))) {
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
    if (!isAnalyzer(region.origin) || CODE_REGION_TYPES.includes(region.type) || region.type === "dual-use") continue;
    let executed = 0;
    for (let address = region.start; address <= region.end; address++) if ((map[address]! & COVERAGE.ramExecute) !== 0) executed++;
    if (executed > 0) conflicts.push({ region, executed });
  }
  return conflicts;
}
