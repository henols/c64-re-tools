// Knowledge seeds for an analyzer, and the mapping of a Ghidra result to the
// common normalized findings.

import type { Cpu } from "#src/cpu.ts";
import { mainSpaceOf } from "#src/knowledge/project-machine.ts";
import type { DatabaseSync } from "node:sqlite";

import type { NormalizedFindings } from "#src/knowledge/import.ts";
import { listRegions, listSymbols } from "#src/knowledge/read.ts";
import { CODE_REGION_TYPES, isSemantic, type Space } from "#src/knowledge/schema.ts";
import type { DxaResult, GhidraParams, GhidraResult } from "#src/native/types.ts";

export type Seeds = Pick<GhidraParams, "entryPoints" | "dataRanges" | "labels">;

const semantic = (row: { origin: string }) => isSemantic(row.origin);

/**
 * Seeds from current semantic knowledge: routines from the user or
 * the LLM are entry points, their non-code regions are data, and their names
 * are labels. Analyzer facts are never seeds alone: fed back, an analyzer's
 * own earlier guess would force the same answer again, and a re-analysis
 * could not retire it. A data or variable symbol of the user or the LLM is a
 * decision that its address is data: the non-code region that holds it is
 * data, also a region of an analyzer, else the byte of the symbol. Where a
 * code region holds the symbol (a variable in the operand of self-modifying
 * code) or the address executed, the symbol gives no data. A region with an
 * executed address or an entry point in it gives only the byte of the symbol.
 */
export function seedsFromKnowledge(db: DatabaseSync | undefined, extraEntryPoints: number[] = [], space: Space = mainSpaceOf(db), executed: (address: number) => boolean = () => false): Seeds {
  const symbols = listSymbols(db, undefined, undefined, undefined, space).filter(semantic);
  const entryPoints = [...new Set([...extraEntryPoints, ...symbols.filter((symbol) => symbol.kind === "routine").map((symbol) => symbol.address)])].sort((a, b) => a - b);
  const regions = listRegions(db, undefined, undefined, undefined, space);
  // A JMP table is code and dual-use bytes are both: neither is a data range.
  const isData = (region: { type: string }) => !CODE_REGION_TYPES.includes(region.type as never) && region.type !== "dual-use";
  const dataRanges = regions.filter((region) => semantic(region) && isData(region)).map((region) => ({ start: region.start, end: region.end }));
  const covered = (range: { start: number; end: number }) => dataRanges.some((seed) => seed.start <= range.end && range.start <= seed.end);
  const holdsCode = (range: { start: number; end: number }) => entryPoints.some((entry) => entry >= range.start && entry <= range.end) || Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset).some(executed);
  for (const symbol of symbols.filter((row) => row.kind === "data" || row.kind === "variable").sort((a, b) => a.address - b.address)) {
    const own = { start: symbol.address, end: symbol.address };
    const region = regions.find((row) => row.start <= symbol.address && symbol.address <= row.end);
    if ((region !== undefined && !isData(region)) || holdsCode(own) || covered(own)) continue;
    const range = region !== undefined && !holdsCode(region) ? { start: region.start, end: region.end } : own;
    dataRanges.push(range);
  }
  return {
    entryPoints,
    dataRanges: dataRanges.sort((a, b) => a.start - b.start),
    labels: symbols.map((symbol) => ({ address: symbol.address, name: symbol.name })),
  };
}

/**
 * The 6510 opcodes with a low nibble of 1 or 3 use (zp,x) or (zp),y, also the
 * undocumented ones. Ghidra gives such an instruction a reference to the target
 * that it computes from the pointer value at the entry state: a guess, because
 * the program sets the pointer at run time. Only the reference to the pointer
 * itself (zp or zp+1) is a fact.
 */
function guessedIndirectTarget(instructions: GhidraResult["instructions"]): (reference: { from: number; to: number }) => boolean {
  const pointers = new Map<number, number>();
  for (const instruction of instructions) {
    const opcode = Number.parseInt(instruction.bytes.slice(0, 2), 16);
    if (instruction.bytes.length === 4 && ((opcode & 0x0f) === 0x01 || (opcode & 0x0f) === 0x03)) pointers.set(instruction.address, Number.parseInt(instruction.bytes.slice(2, 4), 16));
  }
  return (reference) => {
    const pointer = pointers.get(reference.from);
    return pointer !== undefined && reference.to !== pointer && reference.to !== ((pointer + 1) & 0xff);
  };
}

/**
 * Ghidra's result as normalized findings. A reference from a (zp,x) or (zp),y
 * instruction to a computed target is not a finding (see guessedIndirectTarget).
 * A function named by an echoed seed
 * stays in the snapshot: its address holds the seed's semantic symbol, which
 * the importer never replaces, so the name keeps its owner,
 * and a code/data disagreement with that symbol is still reported.
 */
export function ghidraFindings(result: GhidraResult, cpu: Cpu["id"] = "6502"): NormalizedFindings {
  // Ghidra can give one generated name to two functions, for example
  // thunk_FUN_e434 to two thunks of one routine. A name
  // must have one address, so a repeated name that is not a seed gets its address.
  const uses = new Map<string, number>();
  for (const fn of result.functions) uses.set(fn.name, (uses.get(fn.name) ?? 0) + 1);
  const nameOf = (fn: GhidraResult["functions"][number]) =>
    fn.nameSource !== "seed" && uses.get(fn.name)! > 1 ? `${fn.name}_${fn.entry.toString(16).padStart(4, "0")}` : fn.name;
  // A function that branches and jumps reach, and no call, is a place in a routine: a label.
  const called = new Set(result.references.filter((reference) => reference.type === "call").map((reference) => reference.to));
  const jumped = new Set(result.references.filter((reference) => reference.type === "jump").map((reference) => reference.to));
  // The guess is 6502 addressing: Z80 references are facts.
  const guessed = cpu === "6502" ? guessedIndirectTarget(result.instructions) : () => false;
  const kindOf = (fn: GhidraResult["functions"][number]) => (jumped.has(fn.entry) && !called.has(fn.entry) ? ("label" as const) : ("routine" as const));
  return {
    analyzer: "ghidra",
    coverage: result.coverage,
    authoritative: { symbols: result.completeness.functions, regions: result.completeness.regions, references: result.completeness.references },
    symbols: result.functions.map((fn) => ({ address: fn.entry, name: nameOf(fn), kind: kindOf(fn) })),
    regions: result.regions.map((region) => ({ start: region.start, end: region.end, type: region.classification === "code" ? ("code" as const) : ("bytes" as const) })),
    references: result.references.filter((reference) => !guessed(reference)).map((reference) => ({ from: reference.from, to: reference.to, kind: reference.type })),
  };
}

/**
 * DXA's result as normalized findings. A label in one of DXA's data
 * regions becomes a symbol of kind data, any other label one of kind label.
 * DXA names only referenced addresses, so labels are not authoritative, while
 * its regions cover every byte and are.
 */
export function dxaFindings(result: DxaResult): NormalizedFindings {
  const inData = (address: number) => result.regions.some((region) => region.classification === "data" && region.start <= address && address <= region.end);
  return {
    analyzer: "dxa",
    coverage: result.coverage,
    authoritative: { symbols: result.completeness.labels, regions: result.completeness.regions, references: false },
    symbols: result.labels.map((label) => ({ address: label.address, name: label.name, kind: inData(label.address) ? ("data" as const) : ("label" as const) })),
    regions: result.regions.map((region) => ({ start: region.start, end: region.end, type: region.classification === "code" ? ("code" as const) : ("bytes" as const) })),
    references: [],
  };
}
