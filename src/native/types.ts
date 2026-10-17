// Types of the native tools that skill scripts run directly (ACME, DXA,
// Ghidra), and the checks of their complete results. The skill script runs
// these tools itself: nothing here crosses the Host Runtime wire. Bytes
// (a program, an image, a listing) go next to these values as attachments.

import { Refusal } from "../errors.ts";
import { prgRange, REFERENCE_KINDS, SYMBOL_NAME, type ReferenceKind } from "../c64.ts";
import { isInteger, isObject, isOneOf, WireFailure } from "../protocol/messages.ts";
import { type SourceTree } from "../protocol/tools.ts";

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

/** A symbol from the assembly: an address inside the program, or a constant value. */
export type AssembledSymbol = { name: string; kind: "address"; address: number; used: boolean } | { name: string; kind: "constant"; value: number; used: boolean };

export interface AcmeResult {
  assembled: boolean;
  /** Present when assembled: where the program loads. The program bytes are the one attachment that assemble returns. */
  loadRange?: { start: number; end: number; bytes: number };
  symbols?: AssembledSymbol[];
  diagnostics: Diagnostic[];
}

export const IMAGE_KINDS = ["prg", "flat64k"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const GHIDRA_LIMITS = { entryPoints: 1024, codeStarts: 8192, dataRanges: 1024, labels: 4096, decompile: 32, decompiledChars: 16_000, decompiledTotalChars: 128_000 } as const;

/** The Ghidra analysis. Its image is given next to these fields: a PRG, or 64 KiB from $0000. */
export interface GhidraParams {
  imageKind: ImageKind;
  /** Seeds from current knowledge. */
  entryPoints: number[];
  /** Executed instruction starts that Ghidra disassembles without making a function: a branch target is no routine. */
  codeStarts?: number[];
  dataRanges: Array<{ start: number; end: number }>;
  labels: Array<{ address: number; name: string }>;
  /** Routine entries to decompile for immediate reasoning; the text is never stored. */
  decompile: number[];
}

export interface GhidraInstruction {
  address: number;
  /** Lowercase hex, 1 to 3 bytes. */
  bytes: string;
  mnemonic: string;
  /** Ghidra's text of the operands, empty for an implied operand. */
  operands: string;
  /** Where the flow goes besides the next instruction: a branch, jump or call target. */
  flows: number[];
}

export interface GhidraResult {
  coverage: Array<{ start: number; end: number }>;
  functions: Array<{ entry: number; name: string; nameSource: "seed" | "generated" | "native" }>;
  regions: Array<{ start: number; end: number; classification: "code" | "data" }>;
  references: Array<{ from: number; to: number; type: ReferenceKind }>;
  decompilations: Array<{ entry: number; text: string; truncated: boolean }>;
  /** Requested routines without decompiled code, with the decompiler's reason. */
  notDecompiled?: Array<{ entry: number; reason: string }>;
  /** Every instruction in the coverage, as Ghidra decoded it. */
  instructions: GhidraInstruction[];
  /** Which categories are complete inside the coverage; private to the importer. */
  completeness: { functions: boolean; regions: boolean; references: boolean };
  /** The version of the Ghidra that made the result, for example "Ghidra 12.1.3". */
  toolVersion?: string;
}

/** Refuses a DXA or Ghidra request with more seeds or decompilations than the request bounds allow, by name. */
export function checkRequestBounds(params: DxaParams & { decompile?: number[]; codeStarts?: number[] }): void {
  const bounds = [
    ["entry points", params.entryPoints.length, GHIDRA_LIMITS.entryPoints],
    ["code starts", params.codeStarts?.length ?? 0, GHIDRA_LIMITS.codeStarts],
    ["data ranges", params.dataRanges.length, GHIDRA_LIMITS.dataRanges],
    ["labels", params.labels.length, GHIDRA_LIMITS.labels],
    ["routines to decompile", params.decompile?.length ?? 0, GHIDRA_LIMITS.decompile],
  ] as const;
  for (const [name, count, limit] of bounds) {
    if (count > limit) throw new WireFailure("invalid-input", `The request has ${count} ${name}. Give at most ${limit} ${name}.`);
  }
}

/** The DXA analysis: the same image and seeds as Ghidra, without decompilation. */
export type DxaParams = Omit<GhidraParams, "decompile" | "codeStarts">;

export interface DxaResult {
  coverage: Array<{ start: number; end: number }>;
  regions: Array<{ start: number; end: number; classification: "code" | "data" }>;
  labels: Array<{ address: number; name: string }>;
  /** The size of the listing, which is the one attachment that analyze returns (UTF-8 text). */
  listingBytes: number;
  /** Which categories are complete inside the coverage; private to the importer. */
  completeness: { regions: boolean; labels: boolean };
  /** The version line of the dxa that made the result; absent when dxa prints none. */
  toolVersion?: string;
}

/** The longest tool version that a result can carry. */
const MAX_TOOL_VERSION = 200;

/** True for a tool version that a result can carry: absent, or one line of text without control characters, at most MAX_TOOL_VERSION characters. */
const isToolVersion = (value: unknown) => value === undefined || (typeof value === "string" && value.length <= MAX_TOOL_VERSION && /^[^\p{Cc}]+$/u.test(value));

/** Ends a result check with the Error that names its first problem. */
function fail(message: string): never {
  throw new Refusal("operation-failed", message);
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
  const { coverage, functions, regions, references, decompilations, notDecompiled, completeness, toolVersion, instructions } = value;
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
  if (!isList(instructions)) fail("no instructions");
  for (const instruction of instructions) {
    if (
      !isObject(instruction) ||
      !isInteger(instruction.address, 0, 0xffff) ||
      typeof instruction.bytes !== "string" ||
      !/^(?:[0-9a-f]{2}){1,3}$/.test(instruction.bytes) ||
      typeof instruction.mnemonic !== "string" ||
      typeof instruction.operands !== "string" ||
      !isList(instruction.flows) ||
      !instruction.flows.every((flow) => isInteger(flow, 0, 0xffff))
    ) {
      fail("bad instruction");
    }
    if (!covered(instruction.address)) fail("an instruction lies outside the coverage");
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
  if (!isToolVersion(toolVersion)) fail("bad tool version");
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
  const { coverage, regions, labels, listingBytes, completeness, toolVersion } = value;
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
  if (!isToolVersion(toolVersion)) fail("bad tool version");
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
  return prgRange(image);
}

/**
 * The seeds that an analysis of [start, end] can use: the entry points inside
 * it, and the data ranges cut to it. A data range that holds an entry point
 * is left out, so that the entry point is disassembled.
 */
export function seedsInside(params: Pick<GhidraParams, "entryPoints" | "dataRanges" | "codeStarts">, start: number, end: number): { entryPoints: number[]; codeStarts: number[]; dataRanges: GhidraParams["dataRanges"] } {
  const inside = (address: number) => address >= start && address <= end;
  const entryPoints = params.entryPoints.filter(inside);
  const codeStarts = (params.codeStarts ?? []).filter(inside);
  const code = [...entryPoints, ...codeStarts];
  const dataRanges = params.dataRanges
    .filter((range) => range.end >= start && range.start <= end)
    .map((range) => ({ start: Math.max(range.start, start), end: Math.min(range.end, end) }))
    .filter((range) => !code.some((entry) => entry >= range.start && entry <= range.end));
  return { entryPoints, codeStarts, dataRanges };
}
