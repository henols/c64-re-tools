// Runtime evidence for static analysis (D44): coverage files as entry points,
// user/LLM code regions and JMP tables as entry points, and the check that
// shows analyzer data over executed code.

import type { DatabaseSync } from "node:sqlite";

import { COVERAGE, instructionLength } from "#src/c64.ts";
import { FULL_COVERAGE, readCoverageFiles as readFiles } from "#src/host-client/coverage.ts";
import { listRegions, type RegionRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES } from "#src/knowledge/schema.ts";
import { UsageError } from "#src/script.ts";

const FULL_MAP = FULL_COVERAGE;
/** Instructions after which the next instruction is not reached by falling through. */
const FLOW_ENDS = new Set([0x00, 0x40, 0x4c, 0x60, 0x6c]);
const ANALYZER_ORIGINS = new Set(["dxa", "ghidra", "heuristic"]);

/** Reads coverage files and joins them: an address has every flag that any run gave it. */
export function readCoverageFiles(paths: string[]): Uint8Array | undefined {
  return readFiles(paths, (message) => {
    throw new UsageError(message);
  });
}

/** The byte at an address of the analyzed image, or undefined outside it. */
export type ImageByte = (address: number) => number | undefined;

export function imageReader(bytes: Uint8Array, kind: "prg" | "flat64k"): ImageByte {
  if (kind === "flat64k") return (address) => bytes[address];
  const load = bytes[0]! | (bytes[1]! << 8);
  return (address) => (address >= load && address - load + 2 < bytes.length ? bytes[address - load + 2] : undefined);
}

/**
 * The executed instruction starts in RAM that begin a flow: the first after
 * a gap, or the first after an instruction that does not fall through. The
 * analyzers follow the rest of a flow themselves.
 */
export function coverageEntries(map: Uint8Array, image: ImageByte): number[] {
  const entries: number[] = [];
  let falls: number | undefined;
  for (let address = 0; address < FULL_MAP; address++) {
    if ((map[address]! & COVERAGE.ramExecute) === 0) continue;
    const opcode = image(address);
    if (opcode === undefined) continue;
    if (falls !== address) entries.push(address);
    falls = FLOW_ENDS.has(opcode) ? undefined : address + instructionLength(opcode);
  }
  return entries;
}

/** Entry points from semantic knowledge beyond routines: the start of each code region, and each entry of a JMP table with its target. */
export function codeEntries(db: DatabaseSync | undefined, image: ImageByte): number[] {
  const entries: number[] = [];
  for (const region of listRegions(db).filter((row) => row.origin === "user" || row.origin === "llm")) {
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
