// Analyzer import: reconciles one analyzer's normalized findings with
// current knowledge as one revision in one transaction.
//
// An import is a snapshot of what the analyzer asserts inside its coverage.
// In an authoritative category, the analyzer's own current rows in coverage
// that the snapshot no longer holds are closed. Rows of the user, the LLM or
// another analyzer are never replaced: a finding that contradicts one is
// reported as a conflict. Code against data is a contradiction; a different
// name or a finer data type for the same kind of memory is not. One exception
//: where a run executed an instruction start, a code finding replaces
// the data of another analyzer, never of the user, the LLM or a heuristic.

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { type AddressRange, formatC64Address } from "../c64.ts";
import { Refusal } from "../errors.ts";
import { transaction } from "./database.ts";
import {
  analyzerNamed,
  REFERENCE_COLUMNS,
  referenceSuppressed,
  regionsOverlapping,
  suppressionsOverlapping,
  SYMBOL_COLUMNS,
  symbolAt,
  toReference,
  toSymbol,
  type ReferenceRow,
  type RegionRow,
  type SymbolRow,
} from "./read.ts";
import { ANALYZERS, CODE_REGION_TYPES, DEFAULT_SPACE, POINTER_KIND, REFERENCE_KINDS, REGION_TYPES, SEMANTIC_ORIGINS, SYMBOL_KINDS, type Analyzer, type Origin, type ReferenceKind, type RegionType, type Space, type SymbolKind } from "./schema.ts";
import { Change, checkAddress, checkSpace, subtract, SYMBOL_NAME, type Evidence } from "./write.ts";



export interface NormalizedFindings {
  analyzer: Analyzer;
  /** The address space that the analyzed image belongs to; the C64 when absent. */
  space?: Space;
  /** The address ranges the analyzer examined; it makes claims only there. */
  coverage: AddressRange[];
  /** A category is authoritative when its findings are complete in coverage, so absence means "no longer asserted". */
  authoritative: { symbols: boolean; regions: boolean; references: boolean };
  symbols: Array<{ address: number; name: string; kind: SymbolKind }>;
  regions: Array<{ start: number; end: number; type: RegionType }>;
  /** Owned and covered by their source address. */
  references: Array<{ from: number; to: number; kind: ReferenceKind }>;
  /** True for an address where a coverage run executed an instruction start. */
  executed?: (address: number) => boolean;
}

export interface ImportContext {
  /** The revision the caller read; the import is refused if knowledge changed since. */
  expectedRevision?: string;
  description?: string;
  /** The SHA-256 of the analyzed image, as lowercase hex. */
  inputHash?: string;
  /** The analyzer's own version line. */
  toolVersion?: string;
  /** What the import rests on besides the image, for example the coverage files. */
  evidence?: Evidence[];
}

/** What a revision records about one analyzer run: the hash of the image bytes and, when the analyzer tells it, its version. */
export function runProvenance(image: Uint8Array, toolVersion: string | undefined): Pick<ImportContext, "inputHash" | "toolVersion"> {
  const inputHash = createHash("sha256").update(image).digest("hex");
  return toolVersion === undefined ? { inputHash } : { inputHash, toolVersion };
}

export type ImportConflict =
  | {
      category: "symbol";
      address: number;
      reason: "kind" | "name-taken";
      current: { address: number; name: string; kind: SymbolKind; origin: Origin };
      finding: { name: string; kind: SymbolKind };
    }
  | { category: "region"; start: number; end: number; current: { type: RegionType; origin: Origin }; finding: { type: RegionType } }
  | {
      /** A data finding over code that a run executed or that the user or the LLM named: the finding is not imported. */
      category: "code-evidence";
      start: number;
      end: number;
      finding: { type: RegionType };
      /** The first executed instruction start in the range. */
      executed?: number;
      /** The first code name (label or routine) of the user or the LLM in the range. */
      symbol?: { address: number; name: string; kind: SymbolKind; origin: Origin };
    };

export interface ImportCounts {
  added: number;
  changed: number;
  retired: number;
  unchanged: number;
  /** Findings at a place that a user/LLM removal blocks; not written. */
  suppressed: number;
}

export interface ImportResult {
  /** The new revision, or null when nothing changed. */
  revision: string | null;
  /** The analyzer names. */
  names: ImportCounts;
  /** The analyzer's own rows from an older version that the run closed in symbols: only `retired` counts. */
  symbols: ImportCounts;
  regions: ImportCounts;
  references: ImportCounts & {
    /** Findings from an address in a data region of the user, the LLM or a heuristic: false code, not written. */
    inData: number;
  };
  conflicts: ImportConflict[];
}

const isCode = (value: SymbolKind | RegionType) => value === "label" || value === "routine" || (CODE_REGION_TYPES as readonly string[]).includes(value);

const counts = (): ImportCounts => ({ added: 0, changed: 0, retired: 0, unchanged: 0, suppressed: 0 });

function invalid(message: string): never {
  throw new Refusal("invalid-input", `The analyzer result is not usable: ${message} Nothing was imported.`);
}

/** Sorted, merged coverage ranges. */
function mergeCoverage(coverage: AddressRange[]): AddressRange[] {
  const sorted = [...coverage].sort((a, b) => a.start - b.start);
  const merged: AddressRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/**
 * Checks complete findings before anything is written. Every finding
 * lies in coverage, names are valid and unique, regions do not overlap.
 * Returns the merged coverage.
 */
export function validateFindings(findings: NormalizedFindings): AddressRange[] {
  if (!(ANALYZERS as readonly string[]).includes(findings.analyzer)) invalid(`the analyzer must be one of ${ANALYZERS.join(", ")}.`);
  checkSpace(findings);
  if (!Array.isArray(findings.coverage) || findings.coverage.length === 0) invalid("the result has no coverage.");
  for (const range of findings.coverage) {
    checkAddress(range.start, "coverage start");
    checkAddress(range.end, "coverage end");
    if (range.end < range.start) invalid(`coverage ${formatC64Address(range.start)}-${formatC64Address(range.end)} ends before it starts.`);
  }
  const coverage = mergeCoverage(findings.coverage);
  const covering = (start: number, end: number) => coverage.some((range) => range.start <= start && end <= range.end);

  const addresses = new Set<number>();
  const names = new Set<string>();
  for (const symbol of findings.symbols) {
    checkAddress(symbol.address);
    if (!covering(symbol.address, symbol.address)) invalid(`the symbol at ${formatC64Address(symbol.address)} is outside the coverage.`);
    if (!SYMBOL_NAME.test(symbol.name)) invalid(`the symbol name ${JSON.stringify(symbol.name)} is not valid.`);
    if (!(SYMBOL_KINDS as readonly string[]).includes(symbol.kind)) invalid(`the symbol kind ${symbol.kind} is not known.`);
    if (addresses.has(symbol.address)) invalid(`two symbols are at ${formatC64Address(symbol.address)}.`);
    if (names.has(symbol.name)) invalid(`the name ${symbol.name} is at two addresses.`);
    addresses.add(symbol.address);
    names.add(symbol.name);
  }
  const regions = [...findings.regions].sort((a, b) => a.start - b.start);
  regions.forEach((region, index) => {
    checkAddress(region.start, "region start");
    checkAddress(region.end, "region end");
    if (region.end < region.start) invalid(`the region ${formatC64Address(region.start)}-${formatC64Address(region.end)} ends before it starts.`);
    if (!covering(region.start, region.end)) invalid(`the region ${formatC64Address(region.start)}-${formatC64Address(region.end)} is not inside the coverage.`);
    if (!(REGION_TYPES as readonly string[]).includes(region.type)) invalid(`the region type ${region.type} is not known.`);
    const previous = regions[index - 1];
    if (previous !== undefined && region.start <= previous.end) invalid(`the regions at ${formatC64Address(previous.start)} and ${formatC64Address(region.start)} overlap.`);
  });
  for (const reference of findings.references) {
    checkAddress(reference.from, "reference source");
    checkAddress(reference.to, "reference target");
    if (!covering(reference.from, reference.from)) invalid(`the reference from ${formatC64Address(reference.from)} is outside the coverage.`);
    if (!(REFERENCE_KINDS as readonly string[]).includes(reference.kind)) invalid(`the reference kind ${reference.kind} is not known.`);
    if (reference.kind === POINTER_KIND) invalid(`only an operand expression writes a pointer reference, not an analyzer.`);
  }
  return coverage;
}

function ownSymbols(db: DatabaseSync, analyzer: Analyzer, range: AddressRange, space: Space): SymbolRow[] {
  return db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND origin = ? AND address BETWEEN ? AND ? ORDER BY address`)
    .all(space, analyzer, range.start, range.end)
    .map((row) => toSymbol(row as Record<string, unknown>));
}

function ownReferences(db: DatabaseSync, analyzer: Analyzer, range: AddressRange, space: Space): ReferenceRow[] {
  return db
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE space = ? AND origin = ? AND from_address BETWEEN ? AND ? ORDER BY from_address`)
    .all(space, analyzer, range.start, range.end)
    .map((row) => toReference(row as Record<string, unknown>));
}

function ownNames(db: DatabaseSync, analyzer: Analyzer, range: AddressRange, space: Space): SymbolRow[] {
  return db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_analyzer_names WHERE space = ? AND origin = ? AND address BETWEEN ? AND ? ORDER BY address`)
    .all(space, analyzer, range.start, range.end)
    .map((row) => toSymbol(row as Record<string, unknown>));
}

/**
 * The names of an analyzer are second names: they go to analyzer_names,
 * one for each analyzer at an address, and never to symbols. A run replaces
 * the analyzer's own names in its coverage, and closes the analyzer's old rows
 * in symbols there (knowledge from an older version). A name that the user or the LLM
 * gave the address already is not kept twice. A code or data kind that
 * disagrees with the name of the address is a conflict.
 */
function importNames(db: DatabaseSync, change: Change, findings: NormalizedFindings, coverage: AddressRange[], result: ImportResult): void {
  const { analyzer } = findings;
  const space = findings.space ?? DEFAULT_SPACE;
  for (const range of coverage) {
    for (const own of ownSymbols(db, analyzer, range, space)) {
      change.close("symbols", "space = ? AND address = ? AND origin = ?", space, own.address, analyzer);
      result.symbols.retired++;
    }
  }
  const wanted = new Map(findings.symbols.map((symbol) => [symbol.address, symbol]));
  const settled = new Set<number>();
  const replaced = new Set<number>();
  for (const range of coverage) {
    for (const own of ownNames(db, analyzer, range, space)) {
      const finding = wanted.get(own.address);
      // A seeded run gives back the name of the user or the LLM: the analyzer's own name there stays.
      const echo = finding !== undefined && symbolAt(db, own.address, space)?.name === finding.name;
      if (echo || (finding !== undefined && finding.name === own.name && finding.kind === own.kind)) {
        settled.add(own.address);
        result.names.unchanged++;
        continue;
      }
      change.close("analyzer_names", "space = ? AND address = ? AND origin = ?", space, own.address, analyzer);
      if (finding === undefined) result.names.retired++;
      else replaced.add(own.address);
    }
  }
  for (const finding of findings.symbols) {
    const current = symbolAt(db, finding.address, space);
    if (current !== undefined && isCode(current.kind) !== isCode(finding.kind)) {
      result.conflicts.push({ category: "symbol", address: finding.address, reason: "kind", current, finding: { name: finding.name, kind: finding.kind } });
    }
    if (settled.has(finding.address)) continue;
    if (current?.name === finding.name) {
      // The analyzer only gives back the name of the address.
      if (replaced.has(finding.address)) result.names.retired++;
      continue;
    }
    // The analyzer moved its own name from an address outside the coverage.
    for (const moved of analyzerNamed(db, finding.name, space).filter((row) => row.origin === analyzer)) {
      change.close("analyzer_names", "space = ? AND address = ? AND origin = ?", space, moved.address, analyzer);
      result.names.retired++;
    }
    change.insertAnalyzerName({ space, address: finding.address, name: finding.name, kind: finding.kind, origin: analyzer });
    if (replaced.has(finding.address)) result.names.changed++;
    else result.names.added++;
  }
}

/** Analyzers whose regions a heuristic finding replaces where it lies: user/LLM > heuristic > DXA/Ghidra. */
const YIELDS_TO_HEURISTIC = new Set<Origin>(["dxa", "ghidra"]);
/** Analyzers whose data gives way to a code finding over an executed instruction start. */
const YIELDS_TO_EXECUTED_CODE = new Set<Origin>(["dxa", "ghidra"]);

/** The first address in the range that is an executed instruction start, or undefined. */
function firstExecuted(findings: NormalizedFindings, start: number, end: number): number | undefined {
  if (findings.executed === undefined) return undefined;
  for (let address = start; address <= end; address++) if (findings.executed(address)) return address;
  return undefined;
}

/** True when an address in the range is an executed instruction start. */
function holdsExecuted(findings: NormalizedFindings, start: number, end: number): boolean {
  return firstExecuted(findings, start, end) !== undefined;
}

/**
 * The data findings of DXA or Ghidra that code evidence contradicts: an
 * executed instruction start, or a code name (label or routine) of the user or
 * the LLM, in the range. Evidence wins over an analyzer guess: such a finding
 * is not imported, and the analyzer's own code there stays.
 */
function contradictedData(db: DatabaseSync, findings: NormalizedFindings, space: Space): Array<ImportConflict & { category: "code-evidence" }> {
  if (!YIELDS_TO_EXECUTED_CODE.has(findings.analyzer)) return [];
  const names = db.prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE space = ? AND origin IN ('user', 'llm') AND kind IN ('label', 'routine') AND address BETWEEN ? AND ? ORDER BY address LIMIT 1`);
  const found: Array<ImportConflict & { category: "code-evidence" }> = [];
  for (const region of findings.regions) {
    if (isCode(region.type) || region.type === "dual-use") continue;
    const executed = firstExecuted(findings, region.start, region.end);
    const raw = names.get(space, region.start, region.end) as Record<string, unknown> | undefined;
    if (executed === undefined && raw === undefined) continue;
    const symbol = raw === undefined ? undefined : toSymbol(raw);
    found.push({
      category: "code-evidence",
      start: region.start,
      end: region.end,
      finding: { type: region.type },
      ...(executed === undefined ? {} : { executed }),
      ...(symbol === undefined ? {} : { symbol: { address: symbol.address, name: symbol.name, kind: symbol.kind, origin: symbol.origin } }),
    });
  }
  return found;
}

function importRegions(db: DatabaseSync, change: Change, given: NormalizedFindings, coverage: AddressRange[], result: ImportResult): void {
  const { analyzer } = given;
  const space = given.space ?? DEFAULT_SPACE;
  // Data findings over code evidence are conflicts, not facts.
  const contradicted = contradictedData(db, given, space);
  result.conflicts.push(...contradicted);
  const findings = { ...given, regions: given.regions.filter((region) => !contradicted.some((item) => item.start === region.start && item.end === region.end)) };
  if (analyzer === "heuristic") {
    // An idiom is specific evidence about its bytes: the DXA or Ghidra region there gives way, its parts outside stay.
    for (const region of findings.regions) {
      for (const row of regionsOverlapping(db, region.start, region.end, space).filter((candidate) => YIELDS_TO_HEURISTIC.has(candidate.origin))) {
        change.close("regions", "space = ? AND start_address = ? AND end_address = ? AND origin = ?", space, row.start, row.end, row.origin);
        for (const piece of subtract(row, [region])) change.insertRegion({ space, ...piece, type: row.type, ...(row.element === undefined ? {} : { element: row.element }), origin: row.origin });
      }
    }
  }
  // Executed code is evidence about its bytes: another analyzer's data region under a code finding gives way where a run executed an instruction start.
  for (const region of findings.regions.filter((candidate) => isCode(candidate.type))) {
    for (const row of regionsOverlapping(db, region.start, region.end, space)) {
      if (row.origin === analyzer || !YIELDS_TO_EXECUTED_CODE.has(row.origin) || isCode(row.type) || row.type === "dual-use") continue;
      if (!holdsExecuted(findings, Math.max(row.start, region.start), Math.min(row.end, region.end))) continue;
      change.close("regions", "space = ? AND start_address = ? AND end_address = ? AND origin = ?", space, row.start, row.end, row.origin);
      for (const piece of subtract(row, [region])) change.insertRegion({ space, ...piece, type: row.type, ...(row.element === undefined ? {} : { element: row.element }), origin: row.origin });
      result.regions.retired++;
    }
  }
  const conflictWith = (row: RegionRow, region: { start: number; end: number; type: RegionType }) => {
    // dual-use bytes are code at one time and data at another: neither finding contradicts them.
    if (isCode(row.type) === isCode(region.type) || row.type === "dual-use") return;
    result.conflicts.push({
      category: "region",
      start: Math.max(row.start, region.start),
      end: Math.min(row.end, region.end),
      current: { type: row.type, origin: row.origin },
      finding: { type: region.type },
    });
  };

  if (!findings.authoritative.regions) {
    // Retire nothing the snapshot leaves out. Fill addresses that no region covers yet, and
    // give the analyzer's own regions under a finding the type that the analyzer finds now.
    for (const region of findings.regions) {
      const suppressed = suppressionsOverlapping(db, "region", region.start, region.end, space);
      if (suppressed.length > 0) result.regions.suppressed++;
      const current = regionsOverlapping(db, region.start, region.end, space);
      const protectedRows = current.filter((row) => row.origin !== analyzer);
      for (const row of protectedRows) conflictWith(row, region);
      const own = current.filter((row) => row.origin === analyzer);
      const kept = own.filter((row) => row.type === region.type);
      result.regions.unchanged += kept.length;
      for (const row of own.filter((candidate) => candidate.type !== region.type)) {
        // Close the row and keep its parts outside the finding.
        change.close("regions", "space = ? AND start_address = ? AND end_address = ? AND origin = ?", space, row.start, row.end, analyzer);
        if (row.start < region.start) change.insertRegion({ space, start: row.start, end: region.start - 1, type: row.type, origin: analyzer });
        if (row.end > region.end) change.insertRegion({ space, start: region.end + 1, end: row.end, type: row.type, origin: analyzer });
        result.regions.changed++;
      }
      const empty = subtract(region, [...current, ...suppressed]);
      for (const piece of subtract(region, [...protectedRows, ...kept, ...suppressed])) {
        change.insertRegion({ space, ...piece, type: region.type, origin: analyzer });
      }
      result.regions.added += empty.length;
    }
    return;
  }

  for (const range of coverage) {
    const current = regionsOverlapping(db, range.start, range.end, space);
    const protectedRows = current.filter((row) => row.origin !== analyzer);
    const own = current.filter((row) => row.origin === analyzer);
    // What the analyzer may own here: its regions minus protected rows.
    const desired = new Map<string, { start: number; end: number; type: RegionType }>();
    for (const region of findings.regions.filter((candidate) => candidate.start >= range.start && candidate.end <= range.end)) {
      for (const row of protectedRows) if (row.start <= region.end && row.end >= region.start) conflictWith(row, region);
      const suppressed = suppressionsOverlapping(db, "region", region.start, region.end, space);
      if (suppressed.length > 0) result.regions.suppressed++;
      for (const piece of subtract(region, [...protectedRows, ...suppressed])) desired.set(`${piece.start}-${piece.end}`, { ...piece, type: region.type });
    }
    // Under a contradicted data finding, the analyzer's own regions stay: they join the findings of the same type next to them.
    for (const row of own) {
      for (const item of contradicted) {
        const inside = { start: Math.max(row.start, item.start, range.start), end: Math.min(row.end, item.end, range.end) };
        if (inside.start > inside.end) continue;
        for (const piece of subtract(inside, [...protectedRows, ...suppressionsOverlapping(db, "region", inside.start, inside.end, space)])) keepPiece(desired, { ...piece, type: row.type });
      }
    }
    const retiredRanges = new Set<string>();
    for (const row of own) {
      const inside = { start: Math.max(row.start, range.start), end: Math.min(row.end, range.end) };
      const key = `${inside.start}-${inside.end}`;
      if (desired.get(key)?.type === row.type) {
        desired.delete(key);
        result.regions.unchanged++;
        continue;
      }
      // Close the row and keep its parts outside the coverage.
      change.close("regions", "space = ? AND start_address = ? AND end_address = ? AND origin = ?", space, row.start, row.end, analyzer);
      if (row.start < range.start) change.insertRegion({ space, start: row.start, end: range.start - 1, type: row.type, origin: analyzer });
      if (row.end > range.end) change.insertRegion({ space, start: range.end + 1, end: row.end, type: row.type, origin: analyzer });
      retiredRanges.add(key);
    }
    for (const [key, piece] of desired) {
      change.insertRegion({ space, ...piece, origin: analyzer });
      if (retiredRanges.delete(key)) result.regions.changed++;
      else result.regions.added++;
    }
    result.regions.retired += retiredRanges.size;
  }
}

/** Puts a kept piece into the desired regions, joined with the pieces of the same type that touch or overlap it. */
function keepPiece(desired: Map<string, { start: number; end: number; type: RegionType }>, piece: { start: number; end: number; type: RegionType }): void {
  let joined = { ...piece };
  for (let found = true; found; ) {
    found = false;
    for (const [key, other] of desired) {
      if (other.type !== joined.type || other.end + 1 < joined.start || joined.end + 1 < other.start) continue;
      desired.delete(key);
      joined = { start: Math.min(joined.start, other.start), end: Math.max(joined.end, other.end), type: joined.type };
      found = true;
      break;
    }
  }
  desired.set(`${joined.start}-${joined.end}`, joined);
}

/** Origins whose data regions are not code: an analyzer reference from there is false code. */
const DATA_HOLDS_NO_REFERENCES = new Set<Origin>([...SEMANTIC_ORIGINS, "heuristic"]);

/** True for an address in a data region of the user, the LLM or a heuristic, other than the analyzer itself; dual-use bytes are also code. */
function inDataRegion(db: DatabaseSync, analyzer: Analyzer, coverage: AddressRange[], space: Space): (address: number) => boolean {
  const data = coverage
    .flatMap((range) => regionsOverlapping(db, range.start, range.end, space))
    .filter((row) => row.origin !== analyzer && DATA_HOLDS_NO_REFERENCES.has(row.origin) && !isCode(row.type) && row.type !== "dual-use");
  return (address) => data.some((row) => row.start <= address && address <= row.end);
}

/**
 * References replace the analyzer's own in its coverage. A reference from a
 * data region of the user, the LLM or a heuristic comes from bytes that the
 * analyzer decoded as code by mistake: it is not imported, and the analyzer's
 * own reference from there closes.
 */
function importReferences(db: DatabaseSync, change: Change, findings: NormalizedFindings, coverage: AddressRange[], result: ImportResult): void {
  const { analyzer } = findings;
  const space = findings.space ?? DEFAULT_SPACE;
  const key = (reference: { from: number; to: number; kind: ReferenceKind }) => `${reference.from}|${reference.to}|${reference.kind}`;
  const inData = inDataRegion(db, analyzer, coverage, space);
  const kept = findings.references.filter((reference) => !inData(reference.from));
  result.references.inData = findings.references.length - kept.length;
  const wanted = new Map(kept.map((reference) => [key(reference), reference]));
  for (const range of coverage) {
    for (const own of ownReferences(db, analyzer, range, space)) {
      if (wanted.has(key(own))) continue;
      if (!findings.authoritative.references && !inData(own.from)) continue;
      change.close('"references"', "space = ? AND from_address = ? AND to_address = ? AND kind = ? AND origin = ?", space, own.from, own.to, own.kind, analyzer);
      result.references.retired++;
    }
  }
  const existing = db.prepare("SELECT origin FROM current_references WHERE space = ? AND from_address = ? AND to_address = ? AND kind = ?");
  for (const reference of wanted.values()) {
    const rows = existing.all(space, reference.from, reference.to, reference.kind) as Array<{ origin: Origin }>;
    if (rows.some((row) => row.origin === analyzer)) result.references.unchanged++;
    else if (rows.length === 0 && referenceSuppressed(db, reference, space)) result.references.suppressed++;
    // The same fact from the user, the LLM or another analyzer already holds.
    else if (rows.length === 0) {
      change.insertReference({ space, ...reference, origin: analyzer });
      result.references.added++;
    }
  }
}

/** Imports one analyzer result as one revision. Nothing is written when validation fails. */
export function importFindings(db: DatabaseSync, findings: NormalizedFindings, context: ImportContext = {}): ImportResult {
  const coverage = validateFindings(findings);
  return transaction(db, () => {
    const change = new Change(db, { origin: findings.analyzer, ...context }, `import-${findings.analyzer}`);
    const result: ImportResult = { revision: null, names: counts(), symbols: counts(), regions: counts(), references: { ...counts(), inData: 0 }, conflicts: [] };
    importNames(db, change, findings, coverage, result);
    importRegions(db, change, findings, coverage, result);
    importReferences(db, change, findings, coverage, result);
    change.check();
    result.revision = change.revision;
    return result;
  });
}
