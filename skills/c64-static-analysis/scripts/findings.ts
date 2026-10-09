// Knowledge seeds for an analyzer, and the mapping of a Ghidra result to the
// common normalized findings (12 §4, §18).

import type { DatabaseSync } from "node:sqlite";

import type { NormalizedFindings } from "#src/knowledge/import.ts";
import { listRegions, listSymbols } from "#src/knowledge/read.ts";
import type { DxaResult, GhidraParams, GhidraResult } from "#src/native/types.ts";

export type Seeds = Pick<GhidraParams, "entryPoints" | "dataRanges" | "labels">;

const semantic = (row: { origin: string }) => row.origin === "user" || row.origin === "llm";

/**
 * Seeds from current semantic knowledge (12 §18): routines from the user or
 * the LLM are entry points, their non-code regions are data, and their names
 * are labels. Analyzer facts are never seeds: fed back, an analyzer's own
 * earlier guess would force the same answer again, and a re-analysis could
 * not retire it (12 §7).
 */
export function seedsFromKnowledge(db: DatabaseSync | undefined, extraEntryPoints: number[] = []): Seeds {
  const symbols = listSymbols(db).filter(semantic);
  const entryPoints = [...new Set([...extraEntryPoints, ...symbols.filter((symbol) => symbol.kind === "routine").map((symbol) => symbol.address)])].sort((a, b) => a - b);
  return {
    entryPoints,
    dataRanges: listRegions(db)
      .filter((region) => semantic(region) && region.type !== "code")
      .map((region) => ({ start: region.start, end: region.end })),
    labels: symbols.map((symbol) => ({ address: symbol.address, name: symbol.name })),
  };
}

/**
 * Ghidra's result as normalized findings. A function named by an echoed seed
 * stays in the snapshot: its address holds the seed's semantic symbol, which
 * the importer never replaces, so the name keeps its owner (12 §18, 16 §10),
 * and a code/data disagreement with that symbol is still reported.
 */
export function ghidraFindings(result: GhidraResult): NormalizedFindings {
  // Ghidra can give one generated name to two functions, for example
  // thunk_FUN_e434 to two thunks of one routine (found on a real game). A name
  // must have one address, so a repeated name that is not a seed gets its address.
  const uses = new Map<string, number>();
  for (const fn of result.functions) uses.set(fn.name, (uses.get(fn.name) ?? 0) + 1);
  const nameOf = (fn: GhidraResult["functions"][number]) =>
    fn.nameSource !== "seed" && uses.get(fn.name)! > 1 ? `${fn.name}_${fn.entry.toString(16).padStart(4, "0")}` : fn.name;
  return {
    analyzer: "ghidra",
    coverage: result.coverage,
    authoritative: { symbols: result.completeness.functions, regions: result.completeness.regions, references: result.completeness.references },
    symbols: result.functions.map((fn) => ({ address: fn.entry, name: nameOf(fn), kind: "routine" as const })),
    regions: result.regions.map((region) => ({ start: region.start, end: region.end, type: region.classification === "code" ? ("code" as const) : ("bytes" as const) })),
    references: result.references.map((reference) => ({ from: reference.from, to: reference.to, kind: reference.type })),
  };
}

/**
 * DXA's result as normalized findings (12 §17). A label in one of DXA's data
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
