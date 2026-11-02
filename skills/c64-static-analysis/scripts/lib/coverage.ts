// Runtime evidence for static analysis: the coverage as entry points,
// user/LLM code regions and JMP tables as entry points, and the check that
// shows analyzer data over executed code.

import type { DatabaseSync } from "node:sqlite";

import { COVERAGE } from "#src/c64.ts";
import type { RefusedSeed, RefusedSeedReason } from "#src/native/types.ts";
import { listReferences, listRegions, type RegionRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, isAnalyzer, isSemantic, type Analyzer, type Space } from "#src/knowledge/schema.ts";

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

/**
 * The code regions of an analyzer on bytes that a run wrote and that no run
 * executed, each with the call and jump instructions outside it that reach it:
 * a wrong entry point leads an analyzer from code into data.
 */
export function writtenNotExecuted(db: DatabaseSync | undefined, analyzer: Analyzer, coverage: Uint8Array, space: Space = DEFAULT_SPACE): Array<{ start: number; end: number; from: number[] }> {
  const found: Array<{ start: number; end: number; from: number[] }> = [];
  for (const region of listRegions(db, undefined, "code", [analyzer], space)) {
    let written = false;
    let executed = false;
    for (let address = region.start; address <= region.end && !executed; address++) {
      executed = (coverage[address]! & COVERAGE.ramExecute) !== 0;
      written ||= (coverage[address]! & COVERAGE.ramWrite) !== 0;
    }
    if (executed || !written) continue;
    const outside = (address: number) => address < region.start || address > region.end;
    const from = listReferences(db, region, undefined, undefined, space).filter((reference) => (reference.kind === "call" || reference.kind === "jump") && !outside(reference.to) && outside(reference.from));
    found.push({ start: region.start, end: region.end, from: [...new Set(from.map((reference) => reference.from))].sort((a, b) => a - b) });
  }
  return found;
}

/** Why an executed instruction start has no decoded instruction. */
export interface GapReason {
  address: number;
  reason: RefusedSeedReason | "not-reached";
  /** The instruction that holds the start or that its instruction runs into. */
  at?: number;
  /** The data range of the analysis that holds the start. */
  range?: { start: number; end: number };
}

/**
 * The reason of each coverage gap: the reason of the analysis when the gap
 * was a seed that it refused; else inside a decoded instruction, in a data
 * range of the analysis, or not reached by any flow or seed.
 */
export function explainGaps(gaps: readonly number[], instructions: ReadonlyArray<{ address: number; bytes: string }>, refused: readonly RefusedSeed[], dataRanges: ReadonlyArray<{ start: number; end: number }>): GapReason[] {
  const holder = new Map<number, number>();
  for (const instruction of instructions) for (let offset = 1; offset < instruction.bytes.length / 2; offset++) holder.set(instruction.address + offset, instruction.address);
  const refusedAt = new Map(refused.map((seed) => [seed.address, seed]));
  return gaps.map((address): GapReason => {
    const seed = refusedAt.get(address);
    if (seed !== undefined) return { ...seed };
    const at = holder.get(address);
    if (at !== undefined) return { address, reason: "inside-instruction", at };
    const range = dataRanges.find((item) => address >= item.start && address <= item.end);
    if (range !== undefined) return { address, reason: "in-data", range: { start: range.start, end: range.end } };
    return { address, reason: "not-reached" };
  });
}
