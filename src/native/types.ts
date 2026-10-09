// Types of the native tools that skill scripts run directly (ACME, DXA,
// Ghidra), and the checks of their complete results. The skill script runs
// these tools itself: nothing here crosses the Host Runtime wire. Bytes
// (a program, an image, a listing) go next to these values as attachments.

import { REFERENCE_KINDS, SYMBOL_NAME, type ReferenceKind } from "../c64.ts";
import { WireFailure, type SourceTree } from "../protocol.ts";

type Fields = Record<string, unknown>;

function isObject(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

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


/**
 * Checks a complete Ghidra result: every field typed and in range, every
 * function, region and reference source inside the coverage, regions sorted
 * and without overlap. Throws an Error naming the first problem.
 */
export function checkGhidraResult(value: unknown): GhidraResult {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (!isObject(value)) fail("not an object");
  const result = value as Fields;
  const coverage = result.coverage;
  if (!Array.isArray(coverage) || coverage.length === 0) fail("no coverage");
  for (const range of coverage as unknown[]) if (!isObject(range) || !isInteger(range.start, 0, 0xffff) || !isInteger(range.end, range.start as number, 0xffff)) fail("bad coverage range");
  const covered = (address: number) => (coverage as Array<{ start: number; end: number }>).some((range) => range.start <= address && address <= range.end);
  if (!Array.isArray(result.functions)) fail("no functions");
  for (const fn of result.functions as unknown[]) {
    if (!isObject(fn) || !isInteger(fn.entry, 0, 0xffff) || typeof fn.name !== "string" || !SYMBOL_NAME.test(fn.name) || !isOneOf(["seed", "generated", "native"] as const, fn.nameSource)) fail("bad function");
    if (!covered((fn as Fields).entry as number)) fail("a function lies outside the coverage");
  }
  if (!Array.isArray(result.regions)) fail("no regions");
  let previousEnd = -1;
  for (const region of result.regions as unknown[]) {
    if (!isObject(region) || !isInteger(region.start, 0, 0xffff) || !isInteger(region.end, region.start as number, 0xffff) || (region.classification !== "code" && region.classification !== "data")) fail("bad region");
    const { start, end } = region as { start: number; end: number };
    if (start <= previousEnd) fail("regions overlap or are out of order");
    if (!(coverage as Array<{ start: number; end: number }>).some((range) => range.start <= start && end <= range.end)) fail("a region lies outside the coverage");
    previousEnd = end;
  }
  if (!Array.isArray(result.references)) fail("no references");
  for (const reference of result.references as unknown[]) {
    if (!isObject(reference) || !isInteger(reference.from, 0, 0xffff) || !isInteger(reference.to, 0, 0xffff) || !isOneOf(REFERENCE_KINDS, reference.type)) fail("bad reference");
    if (!covered((reference as Fields).from as number)) fail("a reference source lies outside the coverage");
  }
  if (!Array.isArray(result.decompilations) || result.decompilations.length > GHIDRA_LIMITS.decompile) fail("bad decompilations");
  let total = 0;
  for (const item of result.decompilations as unknown[]) {
    if (!isObject(item) || !isInteger(item.entry, 0, 0xffff) || typeof item.text !== "string" || typeof item.truncated !== "boolean") fail("bad decompilation");
    const text = (item as Fields).text as string;
    if (text.length > GHIDRA_LIMITS.decompiledChars) fail("a decompilation is too long");
    total += text.length;
  }
  if (total > GHIDRA_LIMITS.decompiledTotalChars) fail("the decompilations are too long together");
  if (result.notDecompiled !== undefined) {
    if (!Array.isArray(result.notDecompiled) || result.notDecompiled.length > GHIDRA_LIMITS.decompile) fail("bad list of routines that were not decompiled");
    for (const item of result.notDecompiled as unknown[]) {
      if (!isObject(item) || !isInteger(item.entry, 0, 0xffff) || typeof item.reason !== "string" || item.reason.length > 1000) fail("bad routine that was not decompiled");
    }
  }
  const completeness = result.completeness;
  if (!isObject(completeness) || typeof completeness.functions !== "boolean" || typeof completeness.regions !== "boolean" || typeof completeness.references !== "boolean") fail("no completeness");
  return result as unknown as GhidraResult;
}

/**
 * Checks a complete DXA result: typed fields, regions in order, without
 * overlap and covering the coverage exactly, labels inside the coverage, and
 * the listing as the one attachment. Throws an Error naming the first problem.
 */
export function checkDxaResult(value: unknown, attachments: readonly Uint8Array[]): DxaResult {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (!isObject(value)) fail("not an object");
  const result = value as Fields;
  const coverage = result.coverage;
  if (!Array.isArray(coverage) || coverage.length !== 1) fail("the coverage is not one range");
  const range = (coverage as unknown[])[0];
  if (!isObject(range) || !isInteger(range.start, 0, 0xffff) || !isInteger(range.end, range.start as number, 0xffff)) fail("bad coverage range");
  const { start, end } = range as { start: number; end: number };
  if (!Array.isArray(result.regions)) fail("no regions");
  let next = start;
  for (const region of result.regions as unknown[]) {
    if (!isObject(region) || !isInteger(region.start, 0, 0xffff) || !isInteger(region.end, region.start as number, 0xffff) || (region.classification !== "code" && region.classification !== "data")) fail("bad region");
    if ((region as Fields).start !== next) fail("the regions leave a gap or overlap");
    next = ((region as Fields).end as number) + 1;
  }
  if (next !== end + 1) fail("the regions do not reach the end of the coverage");
  if (!Array.isArray(result.labels)) fail("no labels");
  for (const label of result.labels as unknown[]) {
    if (!isObject(label) || !isInteger(label.address, start, end) || typeof label.name !== "string" || !SYMBOL_NAME.test(label.name)) fail("bad label");
  }
  if (attachments.length !== 1 || result.listingBytes !== attachments[0]!.length) fail("the listing is missing");
  const completeness = result.completeness;
  if (!isObject(completeness) || typeof completeness.regions !== "boolean" || typeof completeness.labels !== "boolean") fail("no completeness");
  return result as unknown as DxaResult;
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
  if (image.length < 3) throw new WireFailure("invalid-input", "A PRG has a 2-byte load address and at least one byte.");
  const start = image[0]! | (image[1]! << 8);
  if (start + image.length - 2 > 0x10000) throw new WireFailure("invalid-input", "The PRG runs past $ffff.");
  return { start, end: start + image.length - 3, body: image.subarray(2) };
}
