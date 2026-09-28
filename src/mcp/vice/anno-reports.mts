#!/usr/bin/env node
// anno-reports.mts
//
// WHY THIS FILE EXISTS: the engine half of the six `anno` report verbs. Each
// report is computed from an open, project-bound store handle plus the bytes
// the client staged, and answers JSON plus the files the client writes. No
// path reaches this module and nothing here touches the filesystem, so it runs
// where the store lives. The client half -- confining paths, reading inputs,
// writing outputs, printing -- is `anno-cli.ts`.
//
// WHAT NOT TO DO:
//   - Never read, write or confine a caller's file here.
//   - Never print. The client renders the answer; a line printed here would
//     never reach a remote caller.
//   - Never echo a store path. Every label an answer carries is one the client
//     supplied.
import { decode } from "./disasm-decoder.mts";
import type { Instruction } from "./disasm-decoder.mts";
import {
  listComments,
  listExecObservations,
  listLabels,
  listObservedRuns,
  listRanges,
  listXrefs,
  type AnnoStoreHandle,
} from "./anno-store.mts";
import { isSplitDataType } from "./anno-types.mts";
import type { CommentRow, DataType, LabelRow, RangeRow } from "./anno-types.mts";
import { AUTO_NAME_PREFIX_RE, buildCoverageReport, decodeProjectImage } from "./anno-coverage.mts";
import type { AnnoComment, AnnoCrossReference, AnnoSymbol } from "./anno-coverage.mts";
import { blocksFromStore } from "./block-class.mts";
import { crossReferencesTo } from "./anno-derive.mts";
import { reconcileObservedExecution } from "./evid-reconcile.mts";
import type { EvidReconciliation } from "./evid-reconcile.mts";
import { buildHazardReport } from "./anno-hazard-report.mts";
import { jsonParsePosition, renderMemoryMapFrom } from "./anno-memmap-render.mts";
import { exportAsmFrom, planExportAsmTree } from "./anno-export-asm.mts";
import {
  AUTHORED_PROVENANCE_COMMENT_PREFIX,
  DECLINE_COMMENT_PREFIX,
  DISAGREEMENT_ACCEPTED_COMMENT_PREFIX,
  exportStoreDocument,
  importStoreDocument,
  type StoreExportDocument,
} from "./anno-store-export.mts";
import { stagedInputFile, type AnnoInputFile, type AnnoInputs } from "./anno-tools.mts";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The report verbs this engine answers. */
export const ANNO_REPORT_NAMES = [
  "render-memmap",
  "coverage",
  "export-asm",
  "evid-disagreements",
  "decomp-completeness",
  "hazard-report",
  "export-project",
  "import-project",
] as const;
export type AnnoReportName = (typeof ANNO_REPORT_NAMES)[number];

/** One file a report produced, for the client to write where it chooses. */
export interface AnnoReportFile {
  name: string;
  bytes: Uint8Array;
}

/** A report's answer: JSON for the client to print or save, and the files it
 * produced, in the order they must be written. */
export interface AnnoReportResult {
  json: unknown;
  files: AnnoReportFile[];
}

/** A refusal whose message is complete as written, verb prefix included; the
 * client prints it verbatim. Any other error is printed after the verb. */
export class AnnoReportRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnoReportRefusal";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stringArg(verb: string, args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new AnnoReportRefusal(`${verb}: "${key}" must be a string, got ${JSON.stringify(value)}`);
  return value;
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// THE STORE-TO-CENSUS ADAPTER (Discretion 4).
//
// `anno-coverage.mts` declares four input shapes and fetches NONE of them: a
// caller hands the data in. So moving the census from the retired analyser's
// project JSON onto this project's own annotation store is a CALLER-side
// change and nothing else -- the four functions below, and no edit to the
// instrument.
//
// THE COLUMN MAPPING, stated once, here, because a vocabulary mismatch at this
// boundary changes coverage verdicts SILENTLY (T-29-29):
//
//   LabelRow   -> AnnoSymbol        address, name, kind. `kind` needs no
//                                    translation: the store's LABEL_KINDS are
//                                    the same four tokens the census filters
//                                    on ("User"/"Auto"/"System"/"Platform").
//                                    `id` and `bank` are store-only and are
//                                    dropped. The census never reads a
//                                    symbol's `type`, so its absence from the
//                                    store costs nothing.
//   CommentRow -> AnnoComment       address, commentType -> type, text ->
//                                    comment. COMMENT_TYPES is "line"/"side",
//                                    which is exactly the census's own pair.
//   RangeRow   -> BlockEntry         start -> start_address, endInclusive ->
//                                    end_address (both INCLUSIVE on both
//                                    sides), dataType -> type. That last
//                                    column is the one the census must NOT
//                                    interpret itself: it goes through
//                                    `block-class.mts`, the one boundary
//                                    allowed to read a store block spelling,
//                                    and `block-class.test.ts` pins the class
//                                    each of the frozen twelve resolves to BY
//                                    NAME so this mapping cannot drift
//                                    quietly.
//   derived    -> AnnoCrossReference the union `crossReferencesTo()` computes
//                                    from the bytes, the typed split tables
//                                    and the stored rows.
// ---------------------------------------------------------------------------

/** `LabelRow[]` as the census's symbol shape. */
export function symbolsFromStore(rows: readonly LabelRow[]): AnnoSymbol[] {
  return rows.map((row) => ({ address: row.address, name: row.name, kind: row.kind }));
}

/** `CommentRow[]` as the census's comment shape. */
export function commentsFromStore(rows: readonly CommentRow[]): AnnoComment[] {
  return rows.map((row) => ({ address: row.address, type: row.commentType, comment: row.text }));
}


/**
 * The census's fourth input, derived in ONE pass over the store and the image
 * rather than fetched one address at a time.
 *
 * WHAT THIS REPLACED, and why the replacement has no ceiling. The previous
 * implementation issued one transport round trip PER LABEL through a held
 * child process, and bounded that at a hard ceiling of 512 lookups, printing a
 * note when the ceiling bit. Over an in-process derivation that ceiling would
 * be strictly worse than the bound it used to express: it would truncate a
 * COMPLETE answer and call the remainder a floor. So it is gone, and this
 * function answers over the WHOLE population -- every non-System, non-Platform
 * label the store holds.
 *
 * `System`/`Platform` labels are excluded because every label figure already
 * excludes them, so deriving their callers would buy the census nothing.
 */
export function crossReferencesFromStore(
  handle: AnnoStoreHandle,
  image: Uint8Array,
  origin: number,
  symbols: readonly AnnoSymbol[],
): AnnoCrossReference[] {
  const targets = [
    ...new Set(
      (Array.isArray(symbols) ? symbols : [])
        .filter((s) => s && String(s.kind ?? "") !== "System" && String(s.kind ?? "") !== "Platform")
        .map((s) => s.address),
    ),
  ].sort((a, b) => a - b);
  return targets.map((address) => ({ address, callers: crossReferencesTo(handle, image, origin, address).callers }));
}

// ---------------------------------------------------------------------------
// decomp-completeness -- the fifth verb.
// ---------------------------------------------------------------------------

/**
 * The frozen survivor prefix set, measured
 * against a real dxa+Ghidra-derived store rather than against roadmap prose
 * alone -- MEASURED against a zero-label population (derivation writes typed
 * ranges and xrefs, never names) and the reasoning this set was frozen
 * against. `AUTO_NAME_PREFIX_RE`
 * (imported from anno-coverage.mts, NEVER restated as a second literal here --
 * a census over this file for any of its own eleven prefix strings returns
 * zero, proving that) covers the eleven upstream-analyser-shaped
 * prefixes; this file adds three defensive, ANCHORED, case-sensitive cases no
 * import route writes today, kept here in case a future one ever carries a
 * raw dxa or Ghidra name through unrenamed: `l_XXXX` (an underscored form no
 * current tool emits), `FUN_XXXX`/`LAB_XXXX` (Ghidra's own default naming),
 * and `lXXX`/`lXXXX` (dxa's own real, no-underscore listing convention).
 * Anchored at both ends, unlike
 * `AUTO_NAME_PREFIX_RE`'s prefix-only match, because these three shapes are
 * short enough that an unanchored match would false-fire on a legitimate
 * longer authored name that merely starts the same way.
 */
const SURVIVOR_EXTRA_RE = /^(?:l_[0-9a-f]{4}|(?:FUN|LAB)_[0-9a-f]{4}|l[0-9a-f]{3,4})$/;

/** True iff `name` is a survivor under the frozen set above. ASCII
 * case-sensitive throughout -- `l_0810` IS a survivor, `L_0810` is NOT
 * (anno-coverage.test.ts's own `L_` exclusion precedent, restated for this
 * phase's own prefix set rather than reused blindly, since `L_` was never
 * one of `AUTO_NAME_PREFIX_RE`'s eleven prefixes to begin with). */
function isSurvivorLabelName(name: string): boolean {
  return AUTO_NAME_PREFIX_RE.test(name) || SURVIVOR_EXTRA_RE.test(name);
}

/** One row of the manifest `anno decomp-completeness --manifest FILE` reads.
 * `path` is relative to the manifest file's own directory; `reason` is
 * required (non-empty) when `execution` is `"not-executed"` and `null`
 * otherwise. */
export interface DecompExecutionManifestEntry {
  path: string;
  execution: "executed" | "not-executed";
  reason: string | null;
  ghidraRoute: "flat64k" | "prg";
}

export interface DecompExecutionManifest {
  fixtures: DecompExecutionManifestEntry[];
}

/** The subset of `EvidReconciliation` (verbatim field names, never renamed)
 * that a `--disagreements` document must carry for
 * `decomp-completeness` to accept it as real, plus the `runIdentity` this
 * verb (via `cmdEvidDisagreements`'s own `--json` branch) adds alongside it.
 * `disagreementInput` in the `--json` answer below is exactly this shape. */
export interface DecompDisagreementInput extends EvidReconciliation {
  // (Rule 1 fix, disclosed): `null` is a THIRD, LEGITIMATE
  // value here -- `anno evid-disagreements --json`'s own `runIdentity` field
  // reads `null` when the store holds zero observed runs (listObservedRuns()),
  // which is exactly the real, non-fabricated answer a non-executed
  // fixture's store produces. Refusing null unconditionally made a real
  // `anno evid-disagreements --json` answer for a non-executed fixture
  // unusable by this verb, contradicting this phase's own must_haves ("a
  // non-executed fixture's disagreement answer is a real answer over zero
  // observations ... never an omitted argument"). The anti-vacuity property
  // is preserved below: null is accepted ONLY when the store's own evid-runs
  // table is ALSO empty (cmdDecompCompleteness's own match-check) -- a store
  // that DOES carry real runs must still supply a real, matching identity.
  runIdentity: { imageSha256: string; argvDigest: string; seed: string } | null;
}

const EVID_RECONCILIATION_FIELDS = [
  "disagreements",
  "disagreementCount",
  "agreementCount",
  "blockCoveredNeverObservedCount",
  "observedOutsideAnyBlockCount",
  "observedAtUndefinedBlockCount",
  "denominator",
  "positiveClass",
  "tier",
] as const;

/**
 * Validates a parsed `--disagreements` document has every `EvidReconciliation`
 * field AND a complete `runIdentity` -- refusing BY NAME, never silently
 * treating a missing field as an empty answer (a required
 * output-schema field only the real `--disagreements` input can populate).
 * Returns the validated document (typed as `DecompDisagreementInput`) or a
 * refusal message string. Never throws.
 */
function validateDisagreementDocumentShape(doc: unknown): DecompDisagreementInput | string {
  if (typeof doc !== "object" || doc === null) {
    return "decomp-completeness: the --disagreements document is not a JSON object -- refusing to render";
  }
  const bag = doc as Record<string, unknown>;
  for (const field of EVID_RECONCILIATION_FIELDS) {
    if (!(field in bag)) {
      return (
        `decomp-completeness: the --disagreements document is missing the "${field}" field -- ` +
        "this is not a real anno evid-disagreements --json answer, refusing to render"
      );
    }
  }
  const runIdentity = bag.runIdentity;
  // Rule 1 fix (disclosed): `null` is accepted HERE as a
  // well-formed shape -- it is `anno evid-disagreements --json`'s own real
  // answer for a store with zero observed runs (a non-executed
  // fixture). It is NOT yet accepted as a legitimate ANSWER: cmdDecompCompleteness's
  // own match-check below still refuses a null identity unless the store's
  // evid-runs table is ALSO genuinely empty, so a store that DOES carry real
  // runs can never slip past validation with a null identity.
  if (runIdentity !== null) {
    if (
      typeof runIdentity !== "object" ||
      typeof (runIdentity as Record<string, unknown>).imageSha256 !== "string" ||
      typeof (runIdentity as Record<string, unknown>).argvDigest !== "string" ||
      typeof (runIdentity as Record<string, unknown>).seed !== "string"
    ) {
      return (
        "decomp-completeness: the --disagreements document carries no complete runIdentity " +
        "(image_sha256/argv_digest/seed) -- an empty or ambiguous-run document is refused rather than " +
        "rendered as \"no disagreements\""
      );
    }
  }
  return doc as DecompDisagreementInput;
}

// ---------------------------------------------------------------------------
// The full measure set -- rangeProvenance
// (typed by evidence, never inferred), entryPoints, referencedAddresses and
// disagreementResolution (the gate-vs-bulletin distinction).
// ---------------------------------------------------------------------------

/** One typed range's provenance classification. Always
 * one of the three named values -- never a fourth, never a boolean. */
export type RangeTypedBy = "observed-executing" | "byte-derived" | "authored";

export interface RangeProvenanceRow {
  start: number;
  endInclusive: number;
  dataType: DataType;
  /** `dataType` unless it is one of the four `SPLIT_DATA_TYPES` members, in
   * which case it renders as `"table"` -- read from `anno-types.mts`'s
   * own `isSplitDataType()`, NEVER a restated literal, so the four split
   * spellings never appear in this file's own source as strings. */
  renderedType: string;
  typedBy: RangeTypedBy;
}

export interface EntryPointPurposeElements {
  function: boolean;
  inputs: boolean;
  outputs: boolean;
  sideEffects: boolean;
}

export interface EntryPointRow {
  address: number;
  name: string | null;
  /** True iff `name` is a real, authored label -- present AND not one of the
   * frozen survivor prefixes (an auto-generated name is not a name for this
   * gate's purposes, exactly like criterion 3's own survivor search). */
  hasName: boolean;
  purposeElements: EntryPointPurposeElements;
}

export interface ReferencedAddressesCensus {
  resolved: number[];
  declined: { address: number; reason: string }[];
  unresolved: number[];
  denominator: number;
}

export interface DisagreementResolutionRow {
  address: number;
  resolved: boolean;
  accepted: boolean;
  reason: string | null;
}

export interface DisagreementResolutionCensus {
  rows: DisagreementResolutionRow[];
  unresolvedCount: number;
  denominator: number;
}

/**
 * The four hardware-chip memory-mapped register bands `c64-memory-map`'s
 * own `memmap.json` labels by name -- VIC-II, SID, CIA#1, CIA#2. Color RAM
 * ($D800-$DBFF) and the two generic "I/O Area" bands are deliberately
 * EXCLUDED: neither holds a chip register this project's curated
 * `anno-regbits.json` table names, and folding them in would make an
 * ordinary color-RAM write "hardware" by construction. `$0001` (the 6510's
 * own I/O port, zero page -- outside every one of these four bands) is
 * covered separately, by `hardwareRegisterAddresses()` below reading
 * `anno-regbits.json` itself, never a hand-restated address list.
 */
const HARDWARE_CHIP_RANGES: readonly { start: number; endInclusive: number }[] = Object.freeze([
  { start: 0xd000, endInclusive: 0xd3ff }, // VIC-II
  { start: 0xd400, endInclusive: 0xd7ff }, // SID
  { start: 0xdc00, endInclusive: 0xdcff }, // CIA#1
  { start: 0xdd00, endInclusive: 0xddff }, // CIA#2
]);

// Beside this module (the package root), else one directory up (the
// compiled dist/ copy, one level below the package root).
const REGBITS_PATH_FOR_HARDWARE_CHECK =
  [join(HERE, "anno-regbits.json"), join(HERE, "..", "anno-regbits.json")].find((c) => existsSync(c)) ?? join(HERE, "anno-regbits.json");

let cachedHardwareRegBitsAddresses: ReadonlySet<number> | undefined;

/** Every address `anno-regbits.json` names, read directly (this file never
 * imports `anno-enum-gen.mts`'s own private `loadRegBits()`, which is not
 * exported) -- this is a KEY-EXISTENCE check against the generated,
 * committed artifact, never a second bit-name derivation from memmap.json
 * (that generator's own header reserves that job to itself). Cached once per
 * process, mirroring `anno-enum-gen.mts`'s own cache discipline for the same
 * file. */
function hardwareRegBitsAddresses(): ReadonlySet<number> {
  if (cachedHardwareRegBitsAddresses === undefined) {
    const doc = JSON.parse(readFileSync(REGBITS_PATH_FOR_HARDWARE_CHECK, "utf8")) as Record<string, unknown>;
    const addresses = new Set<number>();
    for (const key of Object.keys(doc)) {
      if (key === "_generated") continue;
      const parsed = Number.parseInt(key.slice(1), 16);
      if (Number.isInteger(parsed)) addresses.add(parsed);
    }
    cachedHardwareRegBitsAddresses = addresses;
  }
  return cachedHardwareRegBitsAddresses;
}

/** True iff `address` is a hardware register address -- the union `anno-
 * regbits.json`'s own keys and memmap.json's four labelled chip bands
 * classify as hardware (see `HARDWARE_CHIP_RANGES`'s own doc comment for
 * what is deliberately excluded and why). */
function isHardwareRegisterAddress(address: number): boolean {
  if (hardwareRegBitsAddresses().has(address)) return true;
  return HARDWARE_CHIP_RANGES.some((r) => address >= r.start && address <= r.endInclusive);
}

/** The address an instruction references for the purposes of this file's
 * entry-point and referenced-address censuses -- mirrors `anno-derive.mts`'s
 * own (private, unexported) `referencedAddress()` rule exactly: no operand
 * (`rts`), an `immediate` operand (the value itself, never an address) and an
 * `indirect` operand (the target lives AT the operand, not IN it) all
 * reference nothing; everything else resolves to `resolvedTarget` when the
 * decoder produced one (a branch, a `jmp`/`jsr` absolute) or `operand.value`
 * otherwise. Restated here, not imported, because `anno-derive.mts` does not
 * export it. */
function instructionReferencedAddress(instruction: Instruction): number | undefined {
  const operand = instruction.operand;
  if (operand === undefined) return undefined;
  if (operand.role === "immediate" || operand.role === "indirect") return undefined;
  const target = instruction.resolvedTarget ?? operand.value;
  if (!Number.isInteger(target) || target < 0 || target > 0xffff) return undefined;
  return target;
}

/** Decodes every `code`-typed range fresh (never memoised, never a second
 * decoder) and returns every instruction found, tagged with nothing but its
 * own decoded shape. `image` is the SAME `{origin, bytes}` pair
 * `loadProjectImage()` already produced for this store's own fixture file. */
function decodeCodeRanges(ranges: readonly RangeRow[], image: { origin: number; bytes: Uint8Array }): Instruction[] {
  const instructions: Instruction[] = [];
  for (const range of ranges) {
    if (range.dataType !== "code") continue;
    const from = range.start - image.origin;
    const to = range.endInclusive - image.origin;
    if (from < 0 || to >= image.bytes.length || from > to) continue; // this image does not cover the range
    const bytes = image.bytes.subarray(from, to + 1);
    instructions.push(...decode(bytes, range.start, { end: range.endInclusive }));
  }
  return instructions;
}

/** True iff any comment at `address` starts with `prefix`. */
function hasCommentWithPrefix(comments: readonly CommentRow[], address: number, prefix: string): boolean {
  return comments.some((c) => c.address === address && c.text.startsWith(prefix));
}

/** The first comment at `address` starting with `prefix`, its text with the
 * prefix stripped and trimmed -- or `null` when none exists. */
function commentReasonAfterPrefix(comments: readonly CommentRow[], address: number, prefix: string): string | null {
  const found = comments.find((c) => c.address === address && c.text.startsWith(prefix));
  return found ? found.text.slice(prefix.length).trim() : null;
}

/** How ONE typed range was typed. Evidence beats
 * inference, stated as a fixed precedence that must never be reordered:
 * `observed-executing` (at least one real execute observation falls inside
 * the range) beats `authored` (the range's start address carries an
 * `AUTHORED_PROVENANCE_COMMENT_PREFIX` comment and no observation) beats
 * `byte-derived` (neither). */
function typedByFor(hasObservation: boolean, hasAuthoredComment: boolean): RangeTypedBy {
  if (hasObservation) return "observed-executing";
  if (hasAuthoredComment) return "authored";
  return "byte-derived";
}

/** Builds `rangeProvenance`: one row per typed range,
 * sorted ascending by `start` then `endInclusive` (ranges never overlap, so
 * this is already the input order once `ranges` itself is pre-sorted, but
 * the sort is restated here so this function's OWN output contract does not
 * depend on a caller's sort surviving unchanged). */
function buildRangeProvenance(
  ranges: readonly RangeRow[],
  observations: readonly { address: number }[],
  comments: readonly CommentRow[],
): RangeProvenanceRow[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.endInclusive - b.endInclusive);
  return sorted.map((r) => {
    const hasObservation = observations.some((o) => o.address >= r.start && o.address <= r.endInclusive);
    const hasAuthoredComment = hasCommentWithPrefix(comments, r.start, AUTHORED_PROVENANCE_COMMENT_PREFIX);
    return {
      start: r.start,
      endInclusive: r.endInclusive,
      dataType: r.dataType,
      renderedType: isSplitDataType(r.dataType) ? "table" : r.dataType,
      typedBy: typedByFor(hasObservation, hasAuthoredComment),
    };
  });
}

/** Builds `entryPoints`: every address that is the target of at least one
 * JSR-shaped cross-reference (a decoded `jsr` instruction in a `code` range,
 * unioned with every stored `listXrefs()` row whose target falls inside a
 * `code`-typed range -- the store's own `XrefAccessKind` vocabulary carries
 * no separate "call" member, so a stored xref landing in code is treated as
 * a call reference for this census), PLUS the image's own load/start
 * address (`image.origin`) -- the fixture's own natural entry point.
 * Sorted ascending by address.
 *
 * `image === null` (fixed 2026-09-11) means the fixture's
 * own bytes could not be located: no instructions are decoded and NO
 * `image.origin` candidate is added -- a missing image degrades this to
 * whatever the store's own stored `xrefs` already establish, never a
 * fabricated `$0000` from a placeholder's own zero origin. */
function buildEntryPoints(
  ranges: readonly RangeRow[],
  image: { origin: number; bytes: Uint8Array } | null,
  xrefs: readonly { toAddress: number }[],
  labels: readonly LabelRow[],
  comments: readonly CommentRow[],
): EntryPointRow[] {
  const codeRanges = ranges.filter((r) => r.dataType === "code");
  const instructions = image === null ? [] : decodeCodeRanges(ranges, image);

  const candidates = new Set<number>();
  if (image !== null) candidates.add(image.origin);
  for (const instr of instructions) {
    if (instr.mnemonic === "jsr") {
      const target = instructionReferencedAddress(instr);
      if (target !== undefined) candidates.add(target);
    }
  }
  for (const xref of xrefs) {
    if (codeRanges.some((r) => xref.toAddress >= r.start && xref.toAddress <= r.endInclusive)) {
      candidates.add(xref.toAddress);
    }
  }

  const purposeLabelPatterns: Record<keyof EntryPointPurposeElements, RegExp> = {
    function: /function:/i,
    inputs: /inputs:/i,
    outputs: /outputs:/i,
    sideEffects: /side effects:/i,
  };

  return [...candidates]
    .sort((a, b) => a - b)
    .map((address) => {
      const label = labels.find((l) => l.address === address);
      const hasName = label !== undefined && !isSurvivorLabelName(label.name);
      const addressComments = comments.filter((c) => c.address === address);
      const purposeElements: EntryPointPurposeElements = {
        function: addressComments.some((c) => purposeLabelPatterns.function.test(c.text)),
        inputs: addressComments.some((c) => purposeLabelPatterns.inputs.test(c.text)),
        outputs: addressComments.some((c) => purposeLabelPatterns.outputs.test(c.text)),
        sideEffects: addressComments.some((c) => purposeLabelPatterns.sideEffects.test(c.text)),
      };
      return { address, name: label?.name ?? null, hasName, purposeElements };
    });
}

/** Builds `referencedAddresses` (criterion 4): every non-hardware address a
 * `code` range's decoded instructions or the store's own `listXrefs()` rows
 * reference, classified `resolved` (an authored, non-survivor label exists),
 * `declined` (a `DECLINE_COMMENT_PREFIX` comment exists, carrying the
 * decline's own reason), or `unresolved` (neither) -- sorted ascending by
 * address within each bucket.
 *
 * `image === null` (fixed 2026-09-11): no instructions are
 * decoded, so this degrades to whatever the store's own stored `xrefs`
 * establish -- never fabricated from a placeholder image's bytes. */
function buildReferencedAddresses(
  ranges: readonly RangeRow[],
  image: { origin: number; bytes: Uint8Array } | null,
  xrefs: readonly { toAddress: number }[],
  labels: readonly LabelRow[],
  comments: readonly CommentRow[],
): ReferencedAddressesCensus {
  const instructions = image === null ? [] : decodeCodeRanges(ranges, image);
  const candidates = new Set<number>();
  for (const instr of instructions) {
    const target = instructionReferencedAddress(instr);
    if (target !== undefined && !isHardwareRegisterAddress(target)) candidates.add(target);
  }
  for (const xref of xrefs) {
    if (!isHardwareRegisterAddress(xref.toAddress)) candidates.add(xref.toAddress);
  }

  const resolved: number[] = [];
  const declined: { address: number; reason: string }[] = [];
  const unresolved: number[] = [];
  for (const address of [...candidates].sort((a, b) => a - b)) {
    const label = labels.find((l) => l.address === address);
    if (label !== undefined && !isSurvivorLabelName(label.name)) {
      resolved.push(address);
      continue;
    }
    const reason = commentReasonAfterPrefix(comments, address, DECLINE_COMMENT_PREFIX);
    if (reason !== null) {
      declined.push({ address, reason });
      continue;
    }
    unresolved.push(address);
  }
  return { resolved, declined, unresolved, denominator: resolved.length + declined.length + unresolved.length };
}

/** Builds `disagreementResolution` (the gate-vs-bulletin distinction,
 * criterion 2): one row per disagreement the supplied `--disagreements`
 * document carries, `accepted` when the address carries a
 * `DISAGREEMENT_ACCEPTED_COMMENT_PREFIX` comment, `resolved` identically (the
 * only resolution mechanism this gate recognises today), `reason` the
 * accepting comment's own text with the prefix stripped. `unresolvedCount`
 * is a named line beside its own `denominator`, never folded into any other
 * count -- criterion 2's own words: a nonzero unresolved count BLOCKS rather
 * than being reported beside a pass. */
function buildDisagreementResolution(
  disagreements: readonly { address: number }[],
  comments: readonly CommentRow[],
): DisagreementResolutionCensus {
  const rows = disagreements.map((d) => {
    const reason = commentReasonAfterPrefix(comments, d.address, DISAGREEMENT_ACCEPTED_COMMENT_PREFIX);
    const accepted = reason !== null;
    return { address: d.address, resolved: accepted, accepted, reason };
  });
  const unresolvedCount = rows.filter((r) => !r.resolved).length;
  return { rows, unresolvedCount, denominator: rows.length };
}


// ---------------------------------------------------------------------------
// The six reports.
// ---------------------------------------------------------------------------

/** render-memmap: the memory map, from the staged provenance sidecar. */
function renderMemmapReport(handle: AnnoStoreHandle, args: Record<string, unknown>, inputs: AnnoInputs): AnnoReportResult {
  const sidecar = stagedInputFile("render-memmap", "sidecar", args.sidecar, inputs);
  const rendered = renderMemoryMapFrom({
    handle,
    sidecarText: utf8(sidecar.bytes),
    sidecarLabel: sidecar.name,
    sidecarLocation: stringArg("render-memmap", args, "sidecar_location"),
  });
  return {
    json: { renderDigest: rendered.renderDigest, rowCount: rendered.rowCount, unknownCount: rendered.unknownCount },
    files: [{ name: "memory-map.md", bytes: new TextEncoder().encode(rendered.markdown) }],
  };
}

/** coverage: the three measures over the staged image. */
function coverageReport(handle: AnnoStoreHandle, args: Record<string, unknown>, inputs: AnnoInputs): AnnoReportResult {
  const image = stagedInputFile("coverage", "image", args.image, inputs);
  const project = decodeProjectImage(image.name, image.bytes);
  const symbols = symbolsFromStore(listLabels(handle));
  const comments = commentsFromStore(listComments(handle));
  const blocks = blocksFromStore(listRanges(handle));
  // A payload that will not decode yields no cross-references at all rather
  // than a partial answer -- the census reports that condition itself.
  const decodable = project.payloadDecoded && project.bytes.length > 0;
  const crossReferences = decodable ? crossReferencesFromStore(handle, project.bytes, project.origin, symbols) : [];
  const sampleSize = args.sample_size;
  const report = buildCoverageReport({
    projectPath: image.name,
    project,
    symbols,
    comments,
    blocks,
    crossReferences,
    ...(typeof sampleSize === "number" ? { sampleSize } : {}),
  });
  return { json: report, files: [] };
}

/** export-asm: the ACME source tree, planned file by file, root last. */
function exportAsmReport(handle: AnnoStoreHandle, args: Record<string, unknown>, inputs: AnnoInputs): AnnoReportResult {
  const image = stagedInputFile("export-asm", "image", args.image, inputs);
  const ledger: AnnoInputFile | undefined = args.ledger === undefined ? undefined : stagedInputFile("export-asm", "ledger", args.ledger, inputs);
  const result = exportAsmFrom({
    handle,
    storeLabel: `project ${handle.projectId}`,
    image,
    ...(ledger !== undefined ? { ledger: { name: ledger.name, text: () => utf8(ledger.bytes) } } : {}),
  });
  const plan = planExportAsmTree(result);
  return {
    json: {
      files: plan.files.map((file) => file.name).sort(),
      sourceOrder: plan.sourceOrder,
      blockCount: result.blocks.length,
      symbolCount: result.symbolCount,
      autoNamedSymbolCount: result.autoNamedSymbolCount,
      unexpressibleCount: result.unexpressibleCount,
      midInstructionLabelCount: result.midInstructionLabelCount,
      enumSubstitutionCount: result.enumSubstitutionCount,
      excludedRangeCount: result.excludedRangeCount,
    },
    files: plan.files,
  };
}

/** evid-disagreements: where runtime evidence disagrees with the typed ranges.
 * `runIdentity` rides beside the reconciliation, `null` unless the store
 * holds exactly one run -- an ambiguous "which run" is refused by the
 * consuming verb, never guessed here. */
function evidDisagreementsReport(handle: AnnoStoreHandle): AnnoReportResult {
  const blocks = blocksFromStore(listRanges(handle));
  const reconciliation = reconcileObservedExecution({ blocks, observations: listExecObservations(handle) });
  const { runs } = listObservedRuns(handle);
  const run = runs.length === 1 ? runs[0]! : undefined;
  const runIdentity = run === undefined ? null : { imageSha256: run.imageSha256, argvDigest: run.argvDigest, seed: run.seed };
  return { json: { runIdentity, ...reconciliation }, files: [] };
}

/** Validates the manifest entry the client matched to this store. */
function manifestEntryArg(value: unknown): DecompExecutionManifestEntry {
  if (
    !isPlainObject(value) ||
    typeof value.path !== "string" ||
    (value.execution !== "executed" && value.execution !== "not-executed") ||
    (value.reason !== null && value.reason !== undefined && typeof value.reason !== "string")
  ) {
    throw new AnnoReportRefusal("decomp-completeness: the manifest entry is not a {path, execution, reason} object -- refusing to render");
  }
  return value as unknown as DecompExecutionManifestEntry;
}

/** decomp-completeness: the completeness gate over one fixture's store. */
function decompCompletenessReport(handle: AnnoStoreHandle, args: Record<string, unknown>, inputs: AnnoInputs): AnnoReportResult {
  const storeLabel = `project ${handle.projectId}`;
  const manifestEntry = manifestEntryArg(args.manifest_entry);
  const disagreementsFile = stagedInputFile("decomp-completeness", "disagreements", args.disagreements, inputs);

  let disagreementDoc: unknown;
  try {
    disagreementDoc = JSON.parse(utf8(disagreementsFile.bytes));
  } catch (err) {
    throw new AnnoReportRefusal(`decomp-completeness: --disagreements file is not valid JSON: ${errMsg(err)}`);
  }
  const validated = validateDisagreementDocumentShape(disagreementDoc);
  if (typeof validated === "string") throw new AnnoReportRefusal(validated);
  const disagreementInput = validated;

  const ranges = listRanges(handle);
  const { runs } = listObservedRuns(handle);
  // A `null` runIdentity is accepted ONLY when the store's own evid-runs table
  // is ALSO genuinely empty -- the real, honest answer for a non-executed
  // fixture. A store that DOES carry real runs must supply a real, matching
  // identity.
  if (disagreementInput.runIdentity === null) {
    if (runs.length !== 0) {
      throw new AnnoReportRefusal(
        `decomp-completeness: the --disagreements document carries a null run identity, but ${storeLabel}'s own ` +
          `evid-runs table is NOT empty (${runs.length} recorded run(s)) -- a store with real runs must supply a ` +
          "real, matching identity, never null.",
      );
    }
  } else {
    const identity = disagreementInput.runIdentity;
    const matchesSomeRun = runs.some((r) => r.imageSha256 === identity.imageSha256 && r.argvDigest === identity.argvDigest && r.seed === identity.seed);
    if (!matchesSomeRun) {
      throw new AnnoReportRefusal(
        `decomp-completeness: the --disagreements document's run identity (image_sha256=${identity.imageSha256}, ` +
          `argv_digest=${identity.argvDigest}, seed=${JSON.stringify(identity.seed)}) ` +
          `matches no row in ${storeLabel}'s own evid-runs table -- a fabricated or foreign document is refused, never rendered.`,
      );
    }
  }

  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
  const byType: Record<string, number> = {};
  let denominator = 0;
  let undefinedCount = 0;
  // Every gap between typed ranges, by ADDRESS, so the gate can name exactly
  // which byte(s) are Undefined rather than reporting a bare count.
  const undefinedRanges: { start: number; endInclusive: number }[] = [];
  let cursor = sortedRanges.length > 0 ? sortedRanges[0]!.start : 0;
  for (const r of sortedRanges) {
    if (r.start > cursor) {
      const gap = r.start - cursor;
      undefinedCount += gap;
      denominator += gap;
      undefinedRanges.push({ start: cursor, endInclusive: r.start - 1 });
    }
    const len = r.endInclusive - r.start + 1;
    byType[r.dataType] = (byType[r.dataType] ?? 0) + len;
    denominator += len;
    cursor = Math.max(cursor, r.endInclusive + 1);
  }

  const labels = listLabels(handle);
  const survivors = labels
    .filter((l) => isSurvivorLabelName(l.name) && sortedRanges.some((r) => r.dataType === "code" && l.address >= r.start && l.address <= r.endInclusive))
    .map((l) => ({ address: l.address, name: l.name }))
    .sort((a, b) => a.address - b.address);

  // The fixture's own bytes, staged by the client from the manifest entry's
  // path. An image that was not sent, or does not decode, degrades
  // entryPoints/referencedAddresses to what the stored xrefs establish --
  // never a synthetic zero-length placeholder whose origin (0) would read as a
  // real `$0000` entry point. `imageUnavailable` reports the condition BY NAME.
  const comments = listComments(handle);
  const xrefs = listXrefs(handle);
  let loadedImage: { origin: number; bytes: Uint8Array } | null = null;
  if (args.fixture_image !== undefined) {
    const file = stagedInputFile("decomp-completeness", "fixture_image", args.fixture_image, inputs);
    const project = decodeProjectImage(file.name, file.bytes);
    if (project.payloadDecoded && project.bytes.length > 0) loadedImage = { origin: project.origin, bytes: project.bytes };
  }
  const imageUnavailable = loadedImage === null;

  const rangeProvenance = buildRangeProvenance(sortedRanges, listExecObservations(handle), comments);
  const entryPoints = buildEntryPoints(sortedRanges, loadedImage, xrefs, labels, comments);
  const referencedAddresses = buildReferencedAddresses(sortedRanges, loadedImage, xrefs, labels, comments);
  const disagreementResolution = buildDisagreementResolution(disagreementInput.disagreements, comments);

  const report: DecompCompletenessReport = {
    project: handle.projectId,
    fixture: manifestEntry.path,
    executionDisposition: manifestEntry.execution,
    notExecutedReason: manifestEntry.execution === "not-executed" ? manifestEntry.reason : null,
    byteCensus: { byType, undefinedCount, denominator, undefinedRanges },
    survivors,
    rangeProvenance,
    imageUnavailable,
    entryPoints,
    referencedAddresses,
    disagreementInput,
    disagreementResolution,
  };
  return { json: report, files: [] };
}

/** The decomp-completeness answer. */
export interface DecompCompletenessReport {
  project: string;
  fixture: string;
  executionDisposition: "executed" | "not-executed";
  notExecutedReason: string | null;
  byteCensus: { byType: Record<string, number>; undefinedCount: number; denominator: number; undefinedRanges: { start: number; endInclusive: number }[] };
  survivors: { address: number; name: string }[];
  rangeProvenance: RangeProvenanceRow[];
  /** True when the fixture's own image bytes were not available; see above. */
  imageUnavailable: boolean;
  entryPoints: EntryPointRow[];
  referencedAddresses: ReferencedAddressesCensus;
  disagreementInput: DecompDisagreementInput;
  disagreementResolution: DisagreementResolutionCensus;
}

/** hazard-report: the movement hazards over the staged image. */
function hazardReport(handle: AnnoStoreHandle, args: Record<string, unknown>, inputs: AnnoInputs): AnnoReportResult {
  const image = stagedInputFile("hazard-report", "image", args.image, inputs);
  const project = decodeProjectImage(image.name, image.bytes);
  if (!project.payloadDecoded || project.bytes.length === 0) {
    throw new AnnoReportRefusal(`hazard-report: ${image.name} did not decode -- supply a .prg or an exactly-65536-byte flat capture`);
  }
  const report = buildHazardReport({
    bytes: project.bytes,
    origin: project.origin,
    symbols: listLabels(handle),
    comments: listComments(handle),
    ranges: blocksFromStore(listRanges(handle)),
    xrefs: listXrefs(handle),
    execObservations: listExecObservations(handle),
  });
  return { json: { ...report, returned: report.findings.length, matched: report.findings.length }, files: [] };
}

// ---------------------------------------------------------------------------
// The text pair. A project's annotations.db is committed as a binary file,
// so these two give it a text form that diffs and reviews, and fill a fresh
// project from one. The document is the same export document the committed
// fixtures use.
// ---------------------------------------------------------------------------

/** The file name export-project's document travels under. */
const PROJECT_EXPORT_FILE = "project-export.json";

/** How many rows of each class a document holds. */
function documentCounts(doc: StoreExportDocument): Record<string, number> {
  return {
    ranges: doc.ranges.length,
    labels: doc.labels.length,
    comments: doc.comments.length,
    projectEnums: doc.projectEnums.length,
    enumUsage: doc.enumUsage.length,
    xrefs: doc.xrefs.length,
    execObservations: doc.execObservations.length,
    scopes: doc.scopes.length,
    excludedRanges: doc.excludedRanges.length,
  };
}

function exportProjectReport(handle: AnnoStoreHandle): AnnoReportResult {
  const doc = exportStoreDocument(handle);
  const bytes = new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`);
  return {
    json: { schemaVersion: doc.schemaVersion, counts: documentCounts(doc) },
    files: [{ name: PROJECT_EXPORT_FILE, bytes }],
  };
}

/**
 * Fills an EMPTY project from an export document, in one transaction. A
 * project that already holds any row is refused and left untouched: merging
 * two sets of annotations is a decision about which one is right, and this
 * verb does not make it.
 */
function importProjectReport(handle: AnnoStoreHandle, args: Record<string, unknown>, inputs: AnnoInputs): AnnoReportResult {
  const file = stagedInputFile("import-project", "document", args.document, inputs);
  let doc: unknown;
  try {
    doc = JSON.parse(utf8(file.bytes));
  } catch (err) {
    // Never the parser's own message: it quotes the file's bytes.
    throw new AnnoReportRefusal(`import-project: ${file.name} is not valid JSON${jsonParsePosition(err)} -- it is not an export-project document.`);
  }
  if (!isPlainObject(doc)) {
    throw new AnnoReportRefusal(`import-project: ${file.name} holds JSON but not an object -- it is not an export-project document.`);
  }
  for (const key of ["ranges", "labels", "comments", "projectEnums", "enumUsage", "xrefs", "execObservations", "scopes", "excludedRanges"]) {
    if (!Array.isArray(doc[key])) {
      throw new AnnoReportRefusal(`import-project: ${file.name} has no "${key}" array -- it is not an export-project document.`);
    }
  }

  const held = Object.entries(documentCounts(exportStoreDocument(handle))).filter(([, n]) => n > 0);
  if (held.length > 0) {
    throw new AnnoReportRefusal(
      `import-project: this workspace's project already holds annotations (${held.map(([k, n]) => `${n} ${k}`).join(", ")}) -- ` +
        "import-project fills an EMPTY project only and never merges. To replace it, save it first with " +
        "`anno export-project --out FILE`, delete .c64-re-tools/annotations.db, and import into the new, empty project.",
    );
  }

  const imported = importStoreDocument(handle, doc as unknown as StoreExportDocument);
  return { json: { imported }, files: [] };
}

/**
 * Answers one report against `handle`, which the caller opened and closes.
 * Throws on a refusal: an `AnnoReportRefusal` carries its complete message,
 * anything else is a failure the client names after the verb.
 */
export async function runAnnoReportOnHandle(handle: AnnoStoreHandle, name: string, args: unknown, inputs: AnnoInputs): Promise<AnnoReportResult> {
  const bag = isPlainObject(args) ? args : {};
  switch (name) {
    case "render-memmap":
      return renderMemmapReport(handle, bag, inputs);
    case "coverage":
      return coverageReport(handle, bag, inputs);
    case "export-asm":
      return exportAsmReport(handle, bag, inputs);
    case "evid-disagreements":
      return evidDisagreementsReport(handle);
    case "decomp-completeness":
      return decompCompletenessReport(handle, bag, inputs);
    case "hazard-report":
      return hazardReport(handle, bag, inputs);
    case "export-project":
      return exportProjectReport(handle);
    case "import-project":
      return importProjectReport(handle, bag, inputs);
    default:
      throw new AnnoReportRefusal(`anno: "${name}" is not a report -- expected one of ${ANNO_REPORT_NAMES.join(", ")}`);
  }
}
