#!/usr/bin/env node
// dxa-partition.ts
//
// Phase 35, plan 35-03 (DXA-04): the ONE producer of a ground-truth
// code/data partition in this project. `dxa-listing.ts` parses dxa's OWN
// CLAIM about a listing; this module never sees dxa's output at all --
// neither tier below imports `dxa-listing.ts`, and a rate comparing the two
// is always computed by a caller that names both, never folded together
// here (T-35-13).
//
// TWO TIERS, both always named by `renderPartitionReport()`, neither chosen
// after seeing which flatters a result (A-07):
//
//   PARTITION_SOURCE_DERIVED -- for a fixture-class input where an ACME
//   source and its `-r` report exist. Ported from
//   `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/
//   fixture/fixture-baseline.mjs`'s four-step ground-truth method, UNCHANGED:
//   read every report line that emitted bytes; recover a truncated byte
//   column's length from the directive itself; classify an emission as data
//   iff its source text's first token is one of the ten ACME data
//   pseudo-ops; treat bytes covered by no emission as assembler padding, a
//   THIRD category, reported separately and never folded into code or data.
//
//   PARTITION_BYTE_DERIVED -- for a real-release-class input with no source.
//   Exactly two facts are decidable from bytes alone with no execution and
//   no external oracle (A-09): the `.prg` format's 2-byte load-address
//   header is definitionally not part of the loaded image, so it is
//   excluded from the partition entirely; and a C64 BASIC tokenised program
//   at load address $0801 is a fully documented, source-independent byte
//   grammar (link-address word, line-number word, tokens, `$00` line
//   terminator, `$00 $00` program-end marker) whose bytes, once a stub
//   parses cleanly to its end marker, are certain-DATA by construction of
//   how the BASIC interpreter consumes them. EVERYTHING ELSE is `unknown`.
//   No convention-based guess about a screen matrix at $0400 or a charset at
//   $1000 is ever made (T-35-12) -- that convention is not universal, and
//   asserting it without source or execution is exactly the silent guess
//   this requirement exists to prevent.
//
// NO EXECUTION ORACLE ANYWHERE IN THIS MODULE. No VICE observation, no chip
// state, no VIC-pointer derivation, no snapshot. Phase 23's own W/C/D/U
// scheme (`SCHEMA.md` section 4) is disqualified for exactly this reason and
// is not reused -- its `D` set comes from VIC-DMA derivation off a live chip
// snapshot and its `C` set from VICE runtime observation, both
// execution-derived.
//
// EVERY RATE CARRIES ITS NUMERATOR, DENOMINATOR AND POSITIVE CLASS
// (`POSITIVE_CLASS: data`, A-08) on the same line, in the `72.39 (97/134)`
// shape Phase 23 already established (`formatPercent()` below) -- and the
// denominator is always the count of bytes THIS module can prove
// (certain-code plus certain-data), never the image size. A zero
// denominator refuses by name (`formatPercent` throws) rather than
// rendering `0.00`, `NaN` or `100.00`.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` (mirrors `dxa-listing.ts`'s
// own stated rule for itself) and MUST NEVER CALL `node:child_process`
// (mirrors `dxa-listing.ts` and `dxa-run.ts`'s SEAM-05 discipline) -- ground
// truth here is read from a report and from raw bytes the caller already
// has; it is never derived by running anything.
//
// THIS PLAN COMPUTES NO RATE ABOUT DXA ON REAL CRACKED CODE (A-10). Real-
// release recovery-rate numbers belong to Phase 38. The rates this module
// prints describe ONLY this partition's own composition -- what fraction of
// the bytes it can prove are data -- never a comparison to any external
// tool's classification.

/** Renders an address as a 4-hex-digit `$xxxx` column, matching Phase 23's
 * own evidence-script convention (`fixture-baseline.mjs`'s `hex()`). */
function hexAddr(address: number): string {
  return `$${address.toString(16).padStart(4, "0")}`;
}

// ============================================================================
// Shared range representation, both tiers
// ============================================================================

/** One contiguous, inclusive-`end` range in a rendered range list. Built by
 * `buildRanges()` below by walking addresses strictly ascending and
 * coalescing only IMMEDIATELY CONSECUTIVE same-class addresses -- sorted
 * ascending and disjoint BY CONSTRUCTION, never by a separate sort/merge
 * pass that could hide an overlap. `rangesAreDisjointAndSorted()` proves
 * this rather than assuming it. */
export interface PartitionRange {
  class: string;
  /** Inclusive lower bound. */
  start: number;
  /** Inclusive upper bound. */
  end: number;
}

/** Walks `[origin, origin + length)` address by address, classifying each
 * with `classify`, and coalesces consecutive addresses sharing a class into
 * one range. Ascending order and disjointness are structural: each address
 * is visited exactly once, in strictly increasing order. */
function buildRanges(origin: number, length: number, classify: (address: number) => string): PartitionRange[] {
  const ranges: PartitionRange[] = [];
  for (let i = 0; i < length; i += 1) {
    const address = origin + i;
    const cls = classify(address);
    const last = ranges[ranges.length - 1];
    if (last !== undefined && last.class === cls && last.end + 1 === address) {
      last.end = address;
    } else {
      ranges.push({ class: cls, start: address, end: address });
    }
  }
  return ranges;
}

/** Proves -- rather than assumes -- that a range list is sorted ascending by
 * `start` and pairwise disjoint (no range's `start` falls at or before the
 * previous range's `end`). Exported so a test can assert this directly over
 * a tier's real output instead of trusting `buildRanges()`'s own
 * construction argument. */
export function rangesAreDisjointAndSorted(ranges: readonly PartitionRange[]): boolean {
  for (let i = 0; i < ranges.length; i += 1) {
    const r = ranges[i]!;
    if (r.end < r.start) return false;
    if (i > 0 && ranges[i - 1]!.end >= r.start) return false;
  }
  return true;
}

/** Renders a percentage from exact integer counts ONLY -- no floating-point
 * accumulation anywhere; the single `n * 10000` scaling below is one
 * computation from exact integers to a float, never an accumulated sum.
 * Rounds HALF UP at the second decimal using pure integer arithmetic (never
 * `Number.prototype.toFixed`, whose half-to-even/binary-representation
 * quirks do not guarantee half-up -- `1.005.toFixed(2)` famously renders
 * `"1.00"`, not `"1.01"`). Returns the `72.39 (97/134)` shape Phase 23
 * already established, with the raw fraction always printed alongside the
 * percentage so the rounding is never load-bearing.
 * @throws {Error} when `denominator` is 0 -- a rate with nothing to divide
 *   by is refused BY NAME, never rendered as `0.00`, `NaN` or `100.00`. */
export function formatPercent(numerator: number, denominator: number): string {
  if (!Number.isInteger(numerator) || numerator < 0) {
    throw new Error(`formatPercent: numerator must be a non-negative integer, got ${numerator}`);
  }
  if (!Number.isInteger(denominator) || denominator < 0) {
    throw new Error(`formatPercent: denominator must be a non-negative integer, got ${denominator}`);
  }
  if (denominator === 0) {
    throw new Error("formatPercent: refusing a zero denominator -- no rate exists to print for an empty class.");
  }
  const scaledNumerator = numerator * 10000; // hundredths of a percent
  const quotient = Math.floor(scaledNumerator / denominator);
  const remainder = scaledNumerator - quotient * denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient; // half-up, exact integer tie test
  const wholePart = Math.floor(rounded / 100);
  const fracPart = rounded % 100;
  return `${wholePart}.${String(fracPart).padStart(2, "0")} (${numerator}/${denominator})`;
}

// ============================================================================
// Tier 1: PARTITION_SOURCE_DERIVED (Task 1)
// ============================================================================

/** The ten ACME data pseudo-ops (and their short forms), ported verbatim
 * from `fixture-baseline.mjs`'s `DATA_PSEUDO_OPS`. An emission is data iff
 * its source text's first token is one of these; everything else is an
 * instruction, i.e. code. */
const DATA_PSEUDO_OPS = new Set([
  "!byte", "!by", "!8",
  "!word", "!wo", "!16",
  "!text", "!tx",
  "!fill", "!fi",
  "!pet", "!scr", "!raw",
]);

/** Matches an emitting `-r` report line: leading line number, the emission
 * address, the (possibly truncated) byte column, then the source text.
 * Ported verbatim from `fixture-baseline.mjs`'s `REPORT_EMIT_RE`. A line
 * with no address column (a comment, a label, a blank line) does not match
 * and contributes nothing -- never counted as an emission. */
const REPORT_EMIT_RE = /^\s*\d+\s+([0-9a-f]{4})\s+([0-9a-f.]+)\s+(.*)$/;

/**
 * Recovers the emitted length of a data directive whose byte column ACME
 * truncated with `...` (above 8 bytes). Ported verbatim from
 * `fixture-baseline.mjs`'s `directiveLength()`. Only the forms this
 * project's fixtures actually use are handled; any other directive THROWS
 * rather than guessing a length.
 * @throws {Error} naming the offending directive/source line when the
 *   directive is not one whose length this function knows how to recover,
 *   or when a `!fill` count cannot be read.
 */
export function directiveLength(source: string): number {
  const [op, ...restParts] = source.split(/\s+/);
  const rest = restParts.join(" ").trim();
  const opLower = (op ?? "").toLowerCase();

  if (opLower === "!fill" || opLower === "!fi") {
    const countText = rest.split(",")[0]!.trim();
    const n = countText.startsWith("$") ? parseInt(countText.slice(1), 16) : Number(countText);
    if (!Number.isInteger(n)) {
      throw new Error(`directiveLength: cannot read !fill count from "${source}"`);
    }
    return n;
  }

  const items = rest.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (opLower === "!byte" || opLower === "!by" || opLower === "!8") return items.length;
  if (opLower === "!word" || opLower === "!wo" || opLower === "!16") return items.length * 2;
  if (["!text", "!tx", "!pet", "!scr", "!raw"].includes(opLower)) {
    let total = 0;
    for (const item of items) {
      if (item.startsWith('"') && item.endsWith('"')) total += item.length - 2;
      else total += 1;
    }
    return total;
  }

  throw new Error(
    `directiveLength: byte column truncated and directive "${op}" is not one whose length this function ` +
      `knows how to recover (source: "${source}")`,
  );
}

/** One report line that emitted bytes, classified. */
export interface Emission {
  address: number;
  source: string;
  length: number;
  truncated: boolean;
  isData: boolean;
}

/** The source-derived ground-truth partition: `code`, `data` and `pad`
 * (assembler padding -- bytes no emission covers) are THREE disjoint
 * categories tiling `[loadAddr, loadAddr + imageSize)` exactly. `pad` is
 * never folded into either `code` or `data`; `dataWithPadding` is printed
 * as a SEPARATE, labelled second number (never as the data count itself). */
export interface SourceDerivedPartition {
  loadAddr: number;
  imageSize: number;
  code: Set<number>;
  data: Set<number>;
  pad: Set<number>;
  padRanges: [number, number][];
  emissions: Emission[];
  ranges: PartitionRange[];
}

/**
 * Derives the source-derived ground-truth partition from an ACME `-r`
 * report, over the window `[loadAddr, loadAddr + imageSize)`. Ported from
 * `fixture-baseline.mjs`'s `deriveGroundTruth()`, unchanged in method: (1)
 * read every emitting report line; (2) recover its EXACT length from the
 * byte column, or from the directive itself when ACME truncated the column;
 * (3) classify data iff the first token is one of the ten data pseudo-ops;
 * (4) bytes no emission covers are assembler padding, a third category.
 * @throws {Error} when the accounted total (code + data + pad) does not
 *   equal `imageSize` -- refusing to report a partition that does not tile
 *   the image -- or when `code` and `data` overlap on any byte.
 */
export function partitionSourceDerived(reportText: string, loadAddr: number, imageSize: number): SourceDerivedPartition {
  if (!Number.isInteger(loadAddr) || loadAddr < 0) {
    throw new Error(`partitionSourceDerived: loadAddr must be a non-negative integer, got ${loadAddr}`);
  }
  if (!Number.isInteger(imageSize) || imageSize <= 0) {
    throw new Error(`partitionSourceDerived: imageSize must be a positive integer, got ${imageSize}`);
  }

  const emissions: Emission[] = [];
  for (const line of reportText.split("\n")) {
    const m = REPORT_EMIT_RE.exec(line);
    if (m === null) continue; // no address column -- contributes nothing, never counted
    const address = parseInt(m[1]!, 16);
    const column = m[2]!;
    const source = m[3]!.trim();
    const firstToken = source.split(/\s/)[0]!.toLowerCase();
    const truncated = column.endsWith("...");
    const length = truncated ? directiveLength(source) : column.length / 2;
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error(`partitionSourceDerived: bad emission length ${length} at ${hexAddr(address)} ("${source}")`);
    }
    emissions.push({ address, source, length, truncated, isData: DATA_PSEUDO_OPS.has(firstToken) });
  }
  emissions.sort((a, b) => a.address - b.address);

  const code = new Set<number>();
  const data = new Set<number>();
  for (const e of emissions) {
    const target = e.isData ? data : code;
    for (let a = e.address; a < e.address + e.length; a += 1) target.add(a);
  }

  const pad = new Set<number>();
  const padRanges: [number, number][] = [];
  let runStart: number | null = null;
  for (let a = loadAddr; a < loadAddr + imageSize; a += 1) {
    const covered = code.has(a) || data.has(a);
    if (!covered) {
      pad.add(a);
      if (runStart === null) runStart = a;
    } else if (runStart !== null) {
      padRanges.push([runStart, a - 1]);
      runStart = null;
    }
  }
  if (runStart !== null) padRanges.push([runStart, loadAddr + imageSize - 1]);

  const accounted = code.size + data.size + pad.size;
  if (accounted !== imageSize) {
    throw new Error(
      `partitionSourceDerived: accounted ${accounted} bytes, expected ${imageSize}. ` +
        "Refusing to report a partition that does not tile the image.",
    );
  }
  const overlap = [...code].filter((a) => data.has(a));
  if (overlap.length !== 0) {
    throw new Error(`partitionSourceDerived: code and data overlap on ${overlap.length} byte(s).`);
  }

  const ranges = buildRanges(loadAddr, imageSize, (a) => (code.has(a) ? "code" : data.has(a) ? "data" : "pad"));

  return { loadAddr, imageSize, code, data, pad, padRanges, emissions, ranges };
}

/** Recorded once, here, as a historical constant -- NEVER computed from a
 * live dxa run. The pivot's published fixture partition. Printed only as a
 * stated NON-MATCH against the re-derived numbers below; never treated as
 * ground truth (T-35-12's whole reason for existing: the published figure
 * flattered dxa exactly where its "0 false positives" headline lived). */
const PUBLISHED_GT_CODE_BYTES = 141;
const PUBLISHED_GT_DATA_BYTES = 138;

/** Renders the `PARTITION_SOURCE_DERIVED` section: `GT_*` outcome lines
 * (SCREAMING_SNAKE, one per line, following Phase 23's own convention),
 * the recorded non-match against the published 141/138 figures, and a
 * composition rate (data as a fraction of code+data -- never a comparison
 * to dxa, which this module never sees). Byte-identical across two calls
 * on the same `partition` -- no timestamp, no randomness. */
export function renderSourceDerivedReport(
  partition: SourceDerivedPartition,
  options: { publishedCodeBytes?: number; publishedDataBytes?: number } = {},
): string {
  const publishedCode = options.publishedCodeBytes ?? PUBLISHED_GT_CODE_BYTES;
  const publishedData = options.publishedDataBytes ?? PUBLISHED_GT_DATA_BYTES;
  const dataWithPadding = partition.data.size + partition.pad.size;
  const matches = partition.code.size === publishedCode && partition.data.size === publishedData;

  const lines: string[] = [];
  lines.push(`GT_LOAD_ADDR: ${hexAddr(partition.loadAddr)}`);
  lines.push(`GT_IMAGE_SIZE: ${partition.imageSize}`);
  lines.push(`GT_EMISSIONS: ${partition.emissions.length}`);
  lines.push(`GT_TRUNCATED_COLUMNS_RECOVERED: ${partition.emissions.filter((e) => e.truncated).length}`);
  lines.push(`GT_CODE_BYTES: ${partition.code.size}`);
  lines.push(`GT_DATA_BYTES: ${partition.data.size}`);
  lines.push(`GT_PAD_BYTES: ${partition.pad.size}`);
  lines.push(`GT_DATA_BYTES_WITH_PADDING: ${dataWithPadding}`);
  for (const [lo, hi] of partition.padRanges) {
    lines.push(`GT_PAD_RANGE: ${hexAddr(lo)}-${hexAddr(hi)} (${hi - lo + 1} byte(s), emitted by no source directive)`);
  }
  lines.push(`PUBLISHED_GT_CODE_BYTES: ${publishedCode}`);
  lines.push(`PUBLISHED_GT_DATA_BYTES: ${publishedData}`);
  lines.push(`GT_PARTITION_MATCHES_PUBLISHED: ${matches ? "yes" : "no"} (recorded as a non-match, never as ground truth)`);
  const classifiedTotal = partition.code.size + partition.data.size;
  if (classifiedTotal === 0) {
    lines.push("GT_DATA_FRACTION: refused -- denominator is 0 (no classified bytes)");
  } else {
    lines.push(`GT_DATA_FRACTION: ${formatPercent(partition.data.size, classifiedTotal)}`);
  }
  for (const r of partition.ranges) {
    lines.push(`GT_RANGE: ${hexAddr(r.start)}-${hexAddr(r.end)} (${r.class})`);
  }
  return lines.join("\n");
}

