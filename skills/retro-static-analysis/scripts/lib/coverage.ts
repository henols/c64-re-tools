// Runtime evidence for static analysis: the coverage as entry points,
// user/LLM code regions, JMP tables and tables of code addresses as entry
// points, and the check that shows analyzer data over executed code.

import { mainSpaceOf } from "#src/knowledge/project-machine.ts";
import type { DatabaseSync } from "node:sqlite";

import { COVERAGE } from "#src/cpu/coverage.ts";
import { coverageEntries, coverageSeedKinds, executedStarts, romOnlyRanges } from "#src/cpu/coverage.ts";

export { coverageEntries, coverageSeedKinds, executedStarts, romOnlyRanges };
import { POINTER_TABLE_TYPES, pointerTableEntries, type PointerTableType } from "#src/address.ts";
import { listRegions, listSymbols, type RegionRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, isAnalyzer, isSemantic, SEMANTIC_ORIGINS, type Space } from "#src/knowledge/schema.ts";

/** The byte at an address of the analyzed image, or undefined outside it. */
export type ImageByte = (address: number) => number | undefined;

export function imageReader(bytes: Uint8Array, kind: "prg" | "flat64k"): ImageByte {
  if (kind === "flat64k") return (address) => bytes[address];
  const load = bytes[0]! | (bytes[1]! << 8);
  return (address) => (address >= load && address - load + 2 < bytes.length ? bytes[address - load + 2] : undefined);
}

/** Entry points from semantic knowledge beyond routines: the start of each code region, and each entry of a JMP table with its target. */
export function codeEntries(db: DatabaseSync | undefined, image: ImageByte, space: Space = mainSpaceOf(db)): number[] {
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

/**
 * The targets of each table of addresses of the user or the LLM that holds
 * code addresses: entry points, for the code that only the table reaches. An
 * RTS table holds code addresses. Another table holds them when a run
 * executed one of its targets, or when the user or the LLM has a routine, a
 * label or a code region at one of them; a table of data addresses has none of
 * these. `image` gives the bytes of the program: a table with a byte outside
 * it gives nothing, and a target outside it, in a data region of the user or
 * the LLM or at their data or variable symbol is no entry point.
 */
export function tableEntries(db: DatabaseSync | undefined, image: ImageByte, space: Space = mainSpaceOf(db), executed: (address: number) => boolean = () => false): number[] {
  const regions = listRegions(db, undefined, undefined, undefined, space).filter((row) => isSemantic(row.origin));
  const symbols = listSymbols(db, undefined, undefined, [...SEMANTIC_ORIGINS], space);
  const holds = (address: number, code: boolean) =>
    regions.some((row) => row.start <= address && address <= row.end && (code ? CODE_REGION_TYPES.includes(row.type) : !CODE_REGION_TYPES.includes(row.type) && row.type !== "dual-use"));
  const named = (address: number, kinds: readonly string[]) => symbols.some((symbol) => symbol.address === address && kinds.includes(symbol.kind));
  const code = (address: number) => executed(address) || named(address, ["routine", "label"]) || holds(address, true);
  const entries: number[] = [];
  for (const table of regions) {
    if (!(POINTER_TABLE_TYPES as readonly string[]).includes(table.type)) continue;
    let whole = true;
    for (let address = table.start; address <= table.end && whole; address++) whole = image(address) !== undefined;
    if (!whole) continue;
    const targets = pointerTableEntries({ start: table.start, end: table.end, type: table.type as PointerTableType }, (address) => image(address)!)
      .map((entry) => entry.target)
      .filter((target) => image(target) !== undefined && !holds(target, false) && !named(target, ["data", "variable"]));
    if (table.type.startsWith("rts-") || targets.some(code)) entries.push(...targets);
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
