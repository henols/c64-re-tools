// Runtime evidence for static analysis (D44): coverage files as entry points,
// user/LLM code regions and JMP tables as entry points, and the check that
// shows analyzer data over executed code.

import type { DatabaseSync } from "node:sqlite";

import { COVERAGE, instructionLength } from "#src/c64.ts";
import { FULL_COVERAGE, readCoverageMaps as readMaps } from "#src/host-client/coverage.ts";
import { listRegions, type RegionRow } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, DEFAULT_SPACE, type Space } from "#src/knowledge/schema.ts";
import { UsageError } from "#src/script.ts";

const FULL_MAP = FULL_COVERAGE;
/**
 * Instructions after which the next instruction starts a flow for the seeds: the
 * ones that do not fall through, and JSR, because an analyzer that takes the
 * called routine for one that does not return stops there (the Bruce Lee run).
 */
const FLOW_ENDS = new Set([0x00, 0x20, 0x40, 0x4c, 0x60, 0x6c]);
const ANALYZER_ORIGINS = new Set(["dxa", "ghidra", "heuristic"]);

/** Reads coverage files, one map per file (a run). */
export function readCoverageMaps(paths: string[]): Uint8Array[] {
  return readMaps(paths, (message) => {
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
 * a gap, or the first after an instruction that does not fall through or is a
 * JSR. The analyzers follow the rest of a flow themselves.
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

/** Every executed instruction start in RAM inside the image: VICE marks the opcode byte of an instruction as executed, not its operand. */
export function executedStarts(map: Uint8Array, image: ImageByte): number[] {
  const starts: number[] = [];
  for (let address = 0; address < FULL_MAP; address++) if ((map[address]! & COVERAGE.ramExecute) !== 0 && image(address) !== undefined) starts.push(address);
  return starts;
}

const BRANCHES = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);

/** Instructions that never fall through to the next one. */
const NO_FALL = new Set([0x00, 0x40, 0x4c, 0x60, 0x6c]);

/**
 * The coverage flow starts split for Ghidra (D74). A start is a code start, a
 * place in a routine, when it follows an executed JSR, or when an executed
 * branch or JMP from outside its own flow reaches it (the loop of a routine
 * that jumps back to its own start does not count). Any other start, for
 * example a vector or table target, is a routine entry.
 */
export function coverageSeedKinds(map: Uint8Array, image: ImageByte): { routines: number[]; codeStarts: number[] } {
  const entries = coverageEntries(map, image);
  const flowOf = new Map<number, number>();
  for (const entry of entries) {
    // A flow runs over the executed instructions that fall through, also over a JSR.
    for (let at = entry; ; ) {
      const opcode = image(at);
      if (opcode === undefined || (map[at]! & COVERAGE.ramExecute) === 0 || flowOf.has(at)) break;
      flowOf.set(at, entry);
      if (NO_FALL.has(opcode)) break;
      at += instructionLength(opcode);
    }
  }
  const inside = new Set<number>();
  for (const address of executedStarts(map, image)) {
    const opcode = image(address)!;
    const low = image(address + 1);
    const high = image(address + 2);
    const reach = (target: number) => flowOf.get(address) !== target && inside.add(target);
    if (BRANCHES.has(opcode) && low !== undefined) reach((address + 2 + (low < 0x80 ? low : low - 0x100)) & 0xffff);
    if (opcode === 0x4c && low !== undefined && high !== undefined) reach(low | (high << 8));
    if (opcode === 0x20) inside.add(address + 3);
  }
  return { routines: entries.filter((entry) => !inside.has(entry)), codeStarts: entries.filter((entry) => inside.has(entry)) };
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
