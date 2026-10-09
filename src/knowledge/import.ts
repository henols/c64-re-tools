// Analyzer import: reconciles one analyzer's normalized findings with
// current knowledge as one revision in one transaction.
//
// An import is a snapshot of what the analyzer asserts inside its coverage.
// In an authoritative category, the analyzer's own current rows in coverage
// that the snapshot no longer holds are closed. Rows of the user, the LLM or
// another analyzer are never replaced: a finding that contradicts one is
// reported as a conflict. Code against data is a contradiction; a different
// name or a finer data type for the same kind of memory is not.

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import { KnowledgeError, transaction } from "./database.ts";
import {
  REFERENCE_COLUMNS,
  regionsOverlapping,
  SYMBOL_COLUMNS,
  symbolAt,
  symbolNamed,
  toReference,
  toSymbol,
  type ReferenceRow,
  type RegionRow,
  type SymbolRow,
} from "./read.ts";
import { REFERENCE_KINDS, REGION_TYPES, SYMBOL_KINDS, type Origin, type ReferenceKind, type RegionType, type SymbolKind } from "./schema.ts";
import { Change, checkAddress, hex, SYMBOL_NAME } from "./write.ts";

export const ANALYZERS = ["dxa", "ghidra"] as const satisfies readonly Origin[];
export type Analyzer = (typeof ANALYZERS)[number];

export interface AddressRange {
  start: number;
  end: number;
}

export interface NormalizedFindings {
  analyzer: Analyzer;
  /** The address ranges the analyzer examined; it makes claims only there. */
  coverage: AddressRange[];
  /** A category is authoritative when its findings are complete in coverage, so absence means "no longer asserted". */
  authoritative: { symbols: boolean; regions: boolean; references: boolean };
  symbols: Array<{ address: number; name: string; kind: SymbolKind }>;
  regions: Array<{ start: number; end: number; type: RegionType }>;
  /** Owned and covered by their source address. */
  references: Array<{ from: number; to: number; kind: ReferenceKind }>;
}

export interface ImportContext {
  /** The revision the caller read; the import is refused if knowledge changed since. */
  expectedRevision?: number;
  description?: string;
  /** The SHA-256 of the analyzed image, as lowercase hex. */
  inputHash?: string;
  /** The analyzer's own version line. */
  toolVersion?: string;
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
  | { category: "region"; start: number; end: number; current: { type: RegionType; origin: Origin }; finding: { type: RegionType } };

export interface ImportCounts {
  added: number;
  changed: number;
  retired: number;
  unchanged: number;
}

export interface ImportResult {
  /** The new revision, or null when nothing changed. */
  revision: number | null;
  symbols: ImportCounts;
  regions: ImportCounts;
  references: ImportCounts;
  conflicts: ImportConflict[];
}

const isCode = (value: SymbolKind | RegionType) => value === "label" || value === "routine" || value === "code";

const counts = (): ImportCounts => ({ added: 0, changed: 0, retired: 0, unchanged: 0 });

function invalid(message: string): never {
  throw new KnowledgeError("invalid-input", `The analyzer result is not usable: ${message} Nothing was imported.`);
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

/** Parts of `range` that no range in `holes` covers. */
function subtract(range: AddressRange, holes: AddressRange[]): AddressRange[] {
  let pieces = [range];
  for (const hole of holes) {
    pieces = pieces.flatMap((piece) => {
      if (hole.end < piece.start || hole.start > piece.end) return [piece];
      const left = hole.start > piece.start ? [{ start: piece.start, end: hole.start - 1 }] : [];
      const right = hole.end < piece.end ? [{ start: hole.end + 1, end: piece.end }] : [];
      return [...left, ...right];
    });
  }
  return pieces;
}

/**
 * Checks complete findings before anything is written. Every finding
 * lies in coverage, names are valid and unique, regions do not overlap.
 * Returns the merged coverage.
 */
export function validateFindings(findings: NormalizedFindings): AddressRange[] {
  if (!(ANALYZERS as readonly string[]).includes(findings.analyzer)) invalid(`the analyzer must be one of ${ANALYZERS.join(", ")}.`);
  if (!Array.isArray(findings.coverage) || findings.coverage.length === 0) invalid("the result has no coverage.");
  for (const range of findings.coverage) {
    checkAddress(range.start, "coverage start");
    checkAddress(range.end, "coverage end");
    if (range.end < range.start) invalid(`coverage ${hex(range.start)}-${hex(range.end)} ends before it starts.`);
  }
  const coverage = mergeCoverage(findings.coverage);
  const covering = (start: number, end: number) => coverage.some((range) => range.start <= start && end <= range.end);

  const addresses = new Set<number>();
  const names = new Set<string>();
  for (const symbol of findings.symbols) {
    checkAddress(symbol.address);
    if (!covering(symbol.address, symbol.address)) invalid(`the symbol at ${hex(symbol.address)} is outside the coverage.`);
    if (!SYMBOL_NAME.test(symbol.name)) invalid(`the symbol name ${JSON.stringify(symbol.name)} is not valid.`);
    if (!(SYMBOL_KINDS as readonly string[]).includes(symbol.kind)) invalid(`the symbol kind ${symbol.kind} is not known.`);
    if (addresses.has(symbol.address)) invalid(`two symbols are at ${hex(symbol.address)}.`);
    if (names.has(symbol.name)) invalid(`the name ${symbol.name} is at two addresses.`);
    addresses.add(symbol.address);
    names.add(symbol.name);
  }
  const regions = [...findings.regions].sort((a, b) => a.start - b.start);
  regions.forEach((region, index) => {
    checkAddress(region.start, "region start");
    checkAddress(region.end, "region end");
    if (region.end < region.start) invalid(`the region ${hex(region.start)}-${hex(region.end)} ends before it starts.`);
    if (!covering(region.start, region.end)) invalid(`the region ${hex(region.start)}-${hex(region.end)} is not inside the coverage.`);
    if (!(REGION_TYPES as readonly string[]).includes(region.type)) invalid(`the region type ${region.type} is not known.`);
    const previous = regions[index - 1];
    if (previous !== undefined && region.start <= previous.end) invalid(`the regions at ${hex(previous.start)} and ${hex(region.start)} overlap.`);
  });
  for (const reference of findings.references) {
    checkAddress(reference.from, "reference source");
    checkAddress(reference.to, "reference target");
    if (!covering(reference.from, reference.from)) invalid(`the reference from ${hex(reference.from)} is outside the coverage.`);
    if (!(REFERENCE_KINDS as readonly string[]).includes(reference.kind)) invalid(`the reference kind ${reference.kind} is not known.`);
  }
  return coverage;
}

function ownSymbols(db: DatabaseSync, analyzer: Analyzer, range: AddressRange): SymbolRow[] {
  return db
    .prepare(`SELECT ${SYMBOL_COLUMNS} FROM current_symbols WHERE origin = ? AND address BETWEEN ? AND ? ORDER BY address`)
    .all(analyzer, range.start, range.end)
    .map((row) => toSymbol(row as Record<string, unknown>));
}

function ownReferences(db: DatabaseSync, analyzer: Analyzer, range: AddressRange): ReferenceRow[] {
  return db
    .prepare(`SELECT ${REFERENCE_COLUMNS} FROM current_references WHERE origin = ? AND from_address BETWEEN ? AND ? ORDER BY from_address`)
    .all(analyzer, range.start, range.end)
    .map((row) => toReference(row as Record<string, unknown>));
}

function importSymbols(db: DatabaseSync, change: Change, findings: NormalizedFindings, coverage: AddressRange[], result: ImportResult): void {
  const { analyzer } = findings;
  const wanted = new Map(findings.symbols.map((symbol) => [symbol.address, symbol]));
  const settled = new Set<number>();
  const replaced = new Set<number>();
  // Close first, so a name can move between addresses within one import.
  for (const range of coverage) {
    for (const own of ownSymbols(db, analyzer, range)) {
      const finding = wanted.get(own.address);
      if (finding === undefined) {
        if (!findings.authoritative.symbols) continue;
        change.close("symbols", "address = ?", own.address);
        result.symbols.retired++;
      } else if (finding.name === own.name && finding.kind === own.kind) {
        settled.add(own.address);
        result.symbols.unchanged++;
      } else {
        change.close("symbols", "address = ?", own.address);
        replaced.add(own.address);
      }
    }
  }
  for (const finding of findings.symbols) {
    if (settled.has(finding.address)) continue;
    const current = symbolAt(db, finding.address);
    if (current !== undefined) {
      // A semantic or other-analyzer row stays; only a code/data disagreement matters.
      if (isCode(current.kind) !== isCode(finding.kind)) {
        result.conflicts.push({ category: "symbol", address: finding.address, reason: "kind", current, finding: { name: finding.name, kind: finding.kind } });
      }
      continue;
    }
    const owner = symbolNamed(db, finding.name);
    if (owner?.origin === analyzer) {
      // The analyzer moved its own name: its newer finding replaces its own older row.
      change.close("symbols", "address = ?", owner.address);
      result.symbols.retired++;
    } else if (owner !== undefined) {
      result.conflicts.push({ category: "symbol", address: finding.address, reason: "name-taken", current: owner, finding: { name: finding.name, kind: finding.kind } });
      if (replaced.has(finding.address)) result.symbols.retired++;
      continue;
    }
    change.insertSymbol({ address: finding.address, name: finding.name, kind: finding.kind, origin: analyzer });
    if (replaced.has(finding.address)) result.symbols.changed++;
    else result.symbols.added++;
  }
}

function importRegions(db: DatabaseSync, change: Change, findings: NormalizedFindings, coverage: AddressRange[], result: ImportResult): void {
  const { analyzer } = findings;
  const conflictWith = (row: RegionRow, region: { start: number; end: number; type: RegionType }) => {
    if (isCode(row.type) === isCode(region.type)) return;
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
      const current = regionsOverlapping(db, region.start, region.end);
      const protectedRows = current.filter((row) => row.origin !== analyzer);
      for (const row of protectedRows) conflictWith(row, region);
      const own = current.filter((row) => row.origin === analyzer);
      const kept = own.filter((row) => row.type === region.type);
      result.regions.unchanged += kept.length;
      for (const row of own.filter((candidate) => candidate.type !== region.type)) {
        // Close the row and keep its parts outside the finding.
        change.close("regions", "start_address = ? AND end_address = ? AND origin = ?", row.start, row.end, analyzer);
        if (row.start < region.start) change.insertRegion({ start: row.start, end: region.start - 1, type: row.type, origin: analyzer });
        if (row.end > region.end) change.insertRegion({ start: region.end + 1, end: row.end, type: row.type, origin: analyzer });
        result.regions.changed++;
      }
      const empty = subtract(region, current);
      for (const piece of subtract(region, [...protectedRows, ...kept])) {
        change.insertRegion({ ...piece, type: region.type, origin: analyzer });
      }
      result.regions.added += empty.length;
    }
    return;
  }

  for (const range of coverage) {
    const current = regionsOverlapping(db, range.start, range.end);
    const protectedRows = current.filter((row) => row.origin !== analyzer);
    const own = current.filter((row) => row.origin === analyzer);
    // What the analyzer may own here: its regions minus protected rows.
    const desired = new Map<string, { start: number; end: number; type: RegionType }>();
    for (const region of findings.regions.filter((candidate) => candidate.start >= range.start && candidate.end <= range.end)) {
      for (const row of protectedRows) if (row.start <= region.end && row.end >= region.start) conflictWith(row, region);
      for (const piece of subtract(region, protectedRows)) desired.set(`${piece.start}-${piece.end}`, { ...piece, type: region.type });
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
      change.close("regions", "start_address = ? AND end_address = ? AND origin = ?", row.start, row.end, analyzer);
      if (row.start < range.start) change.insertRegion({ start: row.start, end: range.start - 1, type: row.type, origin: analyzer });
      if (row.end > range.end) change.insertRegion({ start: range.end + 1, end: row.end, type: row.type, origin: analyzer });
      retiredRanges.add(key);
    }
    for (const [key, piece] of desired) {
      change.insertRegion({ ...piece, origin: analyzer });
      if (retiredRanges.delete(key)) result.regions.changed++;
      else result.regions.added++;
    }
    result.regions.retired += retiredRanges.size;
  }
}

function importReferences(db: DatabaseSync, change: Change, findings: NormalizedFindings, coverage: AddressRange[], result: ImportResult): void {
  const { analyzer } = findings;
  const key = (reference: { from: number; to: number; kind: ReferenceKind }) => `${reference.from}|${reference.to}|${reference.kind}`;
  const wanted = new Map(findings.references.map((reference) => [key(reference), reference]));
  for (const range of coverage) {
    for (const own of ownReferences(db, analyzer, range)) {
      if (wanted.has(key(own))) continue;
      if (!findings.authoritative.references) continue;
      change.close('"references"', "from_address = ? AND to_address = ? AND kind = ? AND origin = ?", own.from, own.to, own.kind, analyzer);
      result.references.retired++;
    }
  }
  const existing = db.prepare('SELECT origin FROM current_references WHERE from_address = ? AND to_address = ? AND kind = ?');
  for (const reference of wanted.values()) {
    const rows = existing.all(reference.from, reference.to, reference.kind) as Array<{ origin: Origin }>;
    if (rows.some((row) => row.origin === analyzer)) result.references.unchanged++;
    // The same fact from the user, the LLM or another analyzer already holds.
    else if (rows.length === 0) {
      change.insertReference({ ...reference, origin: analyzer });
      result.references.added++;
    }
  }
}

/** Imports one analyzer result as one revision. Nothing is written when validation fails. */
export function importFindings(db: DatabaseSync, findings: NormalizedFindings, context: ImportContext = {}): ImportResult {
  const coverage = validateFindings(findings);
  return transaction(db, () => {
    const change = new Change(db, { origin: findings.analyzer, ...context }, `import-${findings.analyzer}`);
    const result: ImportResult = { revision: null, symbols: counts(), regions: counts(), references: counts(), conflicts: [] };
    importSymbols(db, change, findings, coverage, result);
    importRegions(db, change, findings, coverage, result);
    importReferences(db, change, findings, coverage, result);
    result.revision = change.revision;
    return result;
  });
}
