// Types of the native tools that skill scripts run directly (ACME, DXA,
// Ghidra), and the checks of their complete results. The skill script runs
// these tools itself: nothing here crosses the Host Runtime wire. Bytes
// (a program, an image, a listing) go next to these values as attachments.

import { prgRange, REFERENCE_KINDS, SYMBOL_NAME, type ReferenceKind } from "../c64.ts";
import { isInteger, isObject, isOneOf, WireFailure, type SourceTree } from "../protocol.ts";

export interface Diagnostic {
  severity: "error" | "warning" | "note";
  /** Relative to the source root; absent when the message has no source location. */
  file?: string;
  line?: number;
  message: string;
}

export interface AcmeParams {
  files: SourceTree;
  /** Relative to the source root. */
  entrySource: string;
  /** Directories relative to the source root. */
  includeDirs: string[];
  defines: Record<string, number | boolean>;
  setPc?: number;
}

export interface AssembledSymbol {
  name: string;
  kind: "address" | "constant";
  value: number;
  used: boolean;
}

export interface AcmeResult {
  assembled: boolean;
  /** Present when assembled: where the program loads. The program bytes are the one attachment that assemble returns. */
  loadRange?: { start: number; end: number; bytes: number };
  symbols?: AssembledSymbol[];
  diagnostics: Diagnostic[];
}

export const IMAGE_KINDS = ["prg", "flat64k"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const GHIDRA_LIMITS = { entryPoints: 1024, dataRanges: 1024, labels: 4096, decompile: 32, decompiledChars: 16_000, decompiledTotalChars: 128_000 } as const;

/** The Ghidra analysis. Its image is given next to these fields: a PRG, or 64 KiB from $0000. */
export interface GhidraParams {
  imageKind: ImageKind;
  /** Seeds from current knowledge. */
  entryPoints: number[];
  dataRanges: Array<{ start: number; end: number }>;
  labels: Array<{ address: number; name: string }>;
  /** Routine entries to decompile for immediate reasoning; the text is never stored. */
  decompile: number[];
}

export interface GhidraResult {
  coverage: Array<{ start: number; end: number }>;
  functions: Array<{ entry: number; name: string; nameSource: "seed" | "generated" | "native" }>;
  regions: Array<{ start: number; end: number; classification: "code" | "data" }>;
  references: Array<{ from: number; to: number; type: ReferenceKind }>;
  decompilations: Array<{ entry: number; text: string; truncated: boolean }>;
  /** Requested routines without decompiled code, with the decompiler's reason. */
  notDecompiled?: Array<{ entry: number; reason: string }>;
  /** Which categories are complete inside the coverage; private to the importer. */
  completeness: { functions: boolean; regions: boolean; references: boolean };
}

/** Refuses a DXA or Ghidra request with more seeds or decompilations than the request bounds allow, by name. */
export function checkRequestBounds(params: DxaParams & { decompile?: number[] }): void {
  const bounds = [
    ["entry points", params.entryPoints.length, GHIDRA_LIMITS.entryPoints],
    ["data ranges", params.dataRanges.length, GHIDRA_LIMITS.dataRanges],
    ["labels", params.labels.length, GHIDRA_LIMITS.labels],
    ["routines to decompile", params.decompile?.length ?? 0, GHIDRA_LIMITS.decompile],
  ] as const;
  for (const [name, count, limit] of bounds) {
    if (count > limit) throw new WireFailure("invalid-input", `The request has ${count} ${name}. Give at most ${limit} ${name}.`);
  }
}

/** The DXA analysis: the same image and seeds as Ghidra, without decompilation. */
export type DxaParams = Omit<GhidraParams, "decompile">;

export interface DxaResult {
  coverage: Array<{ start: number; end: number }>;
  regions: Array<{ start: number; end: number; classification: "code" | "data" }>;
  labels: Array<{ address: number; name: string }>;
  /** The size of the listing, which is the one attachment that analyze returns (UTF-8 text). */
  listingBytes: number;
  /** Which categories are complete inside the coverage; private to the importer. */
  completeness: { regions: boolean; labels: boolean };
}

/** Ends a result check with the Error that names its first problem. */
function fail(message: string): never {
  throw new Error(message);
}

/** Narrows to a list whose items are still unchecked. */
const isList = (value: unknown): value is unknown[] => Array.isArray(value);

/**
 * Checks a complete Ghidra result: every field typed and in range, every
 * function, region and reference source inside the coverage, regions sorted
 * and without overlap. Throws an Error naming the first problem.
 */
export function checkGhidraResult(value: unknown): GhidraResult {
  if (!isObject(value)) fail("not an object");
  const { coverage, functions, regions, references, decompilations, notDecompiled, completeness } = value;
  if (!isList(coverage) || coverage.length === 0) fail("no coverage");
  const ranges: Array<{ start: number; end: number }> = [];
  for (const range of coverage) {
    if (!isObject(range) || !isInteger(range.start, 0, 0xffff) || !isInteger(range.end, range.start, 0xffff)) fail("bad coverage range");
    ranges.push({ start: range.start, end: range.end });
  }
  const covered = (address: number) => ranges.some((range) => range.start <= address && address <= range.end);
  if (!isList(functions)) fail("no functions");
  for (const fn of functions) {
    if (!isObject(fn) || !isInteger(fn.entry, 0, 0xffff) || typeof fn.name !== "string" || !SYMBOL_NAME.test(fn.name) || !isOneOf(["seed", "generated", "native"] as const, fn.nameSource)) fail("bad function");
    if (!covered(fn.entry)) fail("a function lies outside the coverage");
  }
  if (!isList(regions)) fail("no regions");
  let previousEnd = -1;
  for (const region of regions) {
    if (!isObject(region) || !isInteger(region.start, 0, 0xffff) || !isInteger(region.end, region.start, 0xffff) || (region.classification !== "code" && region.classification !== "data")) fail("bad region");
    const start = region.start;
    const end = region.end;
    if (start <= previousEnd) fail("regions overlap or are out of order");
    if (!ranges.some((range) => range.start <= start && end <= range.end)) fail("a region lies outside the coverage");
    previousEnd = end;
  }
  if (!isList(references)) fail("no references");
  for (const reference of references) {
    if (!isObject(reference) || !isInteger(reference.from, 0, 0xffff) || !isInteger(reference.to, 0, 0xffff) || !isOneOf(REFERENCE_KINDS, reference.type)) fail("bad reference");
    if (!covered(reference.from)) fail("a reference source lies outside the coverage");
  }
  if (!isList(decompilations) || decompilations.length > GHIDRA_LIMITS.decompile) fail("bad decompilations");
  let total = 0;
  for (const item of decompilations) {
    if (!isObject(item) || !isInteger(item.entry, 0, 0xffff) || typeof item.text !== "string" || typeof item.truncated !== "boolean") fail("bad decompilation");
    if (item.text.length > GHIDRA_LIMITS.decompiledChars) fail("a decompilation is too long");
    total += item.text.length;
  }
  if (total > GHIDRA_LIMITS.decompiledTotalChars) fail("the decompilations are too long together");
  if (notDecompiled !== undefined) {
    if (!isList(notDecompiled) || notDecompiled.length > GHIDRA_LIMITS.decompile) fail("bad list of routines that were not decompiled");
    for (const item of notDecompiled) {
      if (!isObject(item) || !isInteger(item.entry, 0, 0xffff) || typeof item.reason !== "string" || item.reason.length > 1000) fail("bad routine that was not decompiled");
    }
  }
  if (!isObject(completeness) || typeof completeness.functions !== "boolean" || typeof completeness.regions !== "boolean" || typeof completeness.references !== "boolean") fail("no completeness");
  // Every field is checked: the object is the result as it is.
  return value as unknown as GhidraResult;
}

/**
 * Checks a complete DXA result: typed fields, regions in order, without
 * overlap and covering the coverage exactly, labels inside the coverage, and
 * the listing as the one attachment. Throws an Error naming the first problem.
 */
export function checkDxaResult(value: unknown, attachments: readonly Uint8Array[]): DxaResult {
  if (!isObject(value)) fail("not an object");
  const { coverage, regions, labels, listingBytes, completeness } = value;
  if (!isList(coverage) || coverage.length !== 1) fail("the coverage is not one range");
  const range = coverage[0];
  if (!isObject(range) || !isInteger(range.start, 0, 0xffff) || !isInteger(range.end, range.start, 0xffff)) fail("bad coverage range");
  const start = range.start;
  const end = range.end;
  if (!isList(regions)) fail("no regions");
  let next = start;
  for (const region of regions) {
    if (!isObject(region) || !isInteger(region.start, 0, 0xffff) || !isInteger(region.end, region.start, 0xffff) || (region.classification !== "code" && region.classification !== "data")) fail("bad region");
    if (region.start !== next) fail("the regions leave a gap or overlap");
    next = region.end + 1;
  }
  if (next !== end + 1) fail("the regions do not reach the end of the coverage");
  if (!isList(labels)) fail("no labels");
  for (const label of labels) {
    if (!isObject(label) || !isInteger(label.address, start, end) || typeof label.name !== "string" || !SYMBOL_NAME.test(label.name)) fail("bad label");
  }
  const [listing] = attachments;
  if (attachments.length !== 1 || listing === undefined || listingBytes !== listing.length) fail("the listing is missing");
  if (!isObject(completeness) || typeof completeness.regions !== "boolean" || typeof completeness.labels !== "boolean") fail("no completeness");
  // Every field is checked: the object is the result as it is.
  return value as unknown as DxaResult;
}

/**
 * The address range of an analyzer image: a PRG at its load address, or 64 KiB
 * of memory from $0000. Throws WireFailure(invalid-input) for anything else.
 */
export function imageRange(kind: ImageKind, image: Uint8Array): { start: number; end: number; body: Uint8Array } {
  if (kind === "flat64k") {
    if (image.length !== 0x10000) throw new WireFailure("invalid-input", "A flat 64 KiB image has exactly 65536 bytes.");
    return { start: 0, end: 0xffff, body: image };
  }
  try {
    return prgRange(image);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new WireFailure("invalid-input", error.message);
  }
}

/**
 * The seeds that an analysis of [start, end] can use: the entry points inside
 * it, and the data ranges cut to it. A data range that holds an entry point
 * is left out, so that the entry point is disassembled.
 */
export function seedsInside(params: Pick<DxaParams, "entryPoints" | "dataRanges">, start: number, end: number): Pick<DxaParams, "entryPoints" | "dataRanges"> {
  const entryPoints = params.entryPoints.filter((address) => address >= start && address <= end);
  const dataRanges = params.dataRanges
    .filter((range) => range.end >= start && range.start <= end)
    .map((range) => ({ start: Math.max(range.start, start), end: Math.min(range.end, end) }))
    .filter((range) => !entryPoints.some((entry) => entry >= range.start && entry <= range.end));
  return { entryPoints, dataRanges };
}
