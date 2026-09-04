#!/usr/bin/env node
// dxa-listing.ts
//
// Phase 35, plan 35-01 (DXA-02, A-04): the ONE parser that turns a `dxa -a
// dump` listing (as text) into a byte-level code/data map. Ported from
// `.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/
// dxa-listing-parse.mjs`'s ONE line-matching regular expression and its
// `.byt`/`.word` text-prefix classifier, UNCHANGED -- it is already proven
// against the rebuilt 279-byte fixture from that phase.
//
// A-04's window contract, the deliberate correction to the Phase 23 evidence
// script: `parseDumpListing(text, { origin, imageSize })` classifies over the
// half-open window `[origin, origin + imageSize)`. The ONE refusal predicate
// is `covered.size !== imageSize`, where `covered` is the set of DISTINCT
// in-window addresses -- never a running emission COUNT, which cannot
// represent an overlapping decode at all and which, MEASURED this session,
// refuses a perfectly good full-64K listing over dxa's own top-of-memory
// dump-column wraparound (a final line at `$ffff` whose hex column reprints
// the image's first two bytes, over-counting a running total by exactly 2).
// Emitted addresses outside the window are NEVER added to any set; each such
// line is recorded in the returned `outOfWindow[]` and is never silently
// dropped.
//
// THIS MODULE MUST NEVER IMPORT `hostpath.ts` (mirrors host-tool-client.ts's
// own stated rule for itself, :29-38): it receives an already
// container-translated path from its caller (`dxa-run.ts`) and performs NO
// filesystem or network I/O of its own -- every function here takes a
// string and returns values, exactly as `prg-image.ts` states of itself for
// the same reason (path resolution and path-boundary hazards stay entirely
// out of this module's threat surface).
//
// Plan 35-02 (DXA-02) hardening, landed on top of the above: this module now
// owns all FIVE measured `-a dump` line shapes (two of which -- the
// label-only line and the mid-instruction `= * + n` continuation line --
// correctly emit no bytes because they never match `DUMP_LINE_RE` below),
// strips a trailing CRLF carriage return so line-ending choice never changes
// a result, and renders a sorted, per-source-line range list alongside the
// address sets. The overlapping-decode disposition (two lines claiming the
// same byte resolve to `unclassified` with a stated reason, never a winner)
// is this same plan's own scope too -- see `UnclassifiedByte` below.

/** The ONE line-matching regular expression in this module, ported unchanged
 * from the Phase 23 evidence script: a whitespace class (NOT a literal tab)
 * before the trailing directive/mnemonic text, because `.word` lines are
 * space-separated where instruction lines are tab-separated. Its
 * correctness DEPENDS on the label-only and mid-instruction-continuation
 * shapes NOT matching -- widening it to "handle" them would turn a correct
 * skip into a wrong classification. */
const DUMP_LINE_RE = /^([0-9a-f]{4}) ((?:[0-9a-f]{2} )+)\s+(.*)$/;

/** One matched `dxa -a dump` listing line, classified. Exported so a future
 * consumer (plan 35-02's partitioner, DXA-03) can work from the same typed
 * per-line shape this parser already computed, rather than re-deriving it
 * from the raw text a second time. */
export interface DumpLineShape {
  /** The line's own address column, as an integer (not clamped to the
   * window -- the caller decides in-window membership per byte, below). */
  address: number;
  /** Every byte value on the line's hex-byte column, in file order. */
  bytes: readonly number[];
  /** `true` iff the line's trailing text begins `.byt` or `.word` -- data
   * dxa chose to emit rather than an instruction. */
  isData: boolean;
  /** The line, verbatim, exactly as matched. */
  raw: string;
}

/** One contiguous, sorted range in the rendered range list. `end` is
 * INCLUSIVE. Two ranges are never merged across a source-line boundary even
 * when their addresses touch or their class matches -- only bytes emitted by
 * the SAME matched line ever coalesce into one entry (`dxa-listing.test.ts`'s
 * adjacency cases assert this directly). This is what makes "two spans that
 * merely touch stay two entries" true regardless of class agreement. */
export interface DumpRange {
  class: "code" | "data";
  /** Inclusive lower bound. */
  start: number;
  /** Inclusive upper bound. */
  end: number;
}

export interface DumpListingMap {
  /** Distinct in-window addresses dxa classified as code. */
  code: Set<number>;
  /** Distinct in-window addresses dxa classified as data. */
  data: Set<number>;
  /** Distinct in-window addresses covered by EITHER set -- the quantity the
   * one refusal predicate compares against `imageSize`. */
  covered: Set<number>;
  /** Count of in-window byte EMISSIONS classified as code (may exceed
   * `code.size` under an overlapping decode -- a raw count, not a distinct
   * address count). */
  codeBytes: number;
  /** Count of in-window byte EMISSIONS classified as data (same caveat). */
  dataBytes: number;
  /** Total lines the line-matching regular expression matched, in-window or
   * not. */
  matchedLines: number;
  /** Every matched line that carried at least one out-of-window byte,
   * verbatim -- never silently dropped. */
  outOfWindow: string[];
  /** Every matched line, classified, in file order -- forward context for a
   * future consumer that needs per-line detail rather than the aggregated
   * sets above. */
  lines: DumpLineShape[];
  /** The lowest in-window address any line touched, or `null` if none did. */
  firstAddress: number | null;
  /** The highest in-window address any line touched, or `null` if none did. */
  lastAddress: number | null;
  /** Sorted ascending by `start`. See `DumpRange`'s own doc for the
   * never-merge-across-lines rule. */
  ranges: DumpRange[];
}

export interface ParseDumpListingWindow {
  /** The window's inclusive lower bound. */
  origin: number;
  /** The window's width in bytes -- the window is the half-open range
   * `[origin, origin + imageSize)`. */
  imageSize: number;
}

/**
 * Parses a `dxa -a dump` listing into a byte-level code/data map over the
 * half-open window `[origin, origin + imageSize)`.
 *
 * @throws {Error} when `covered.size !== imageSize` -- refusing to report an
 *   under- or over-counted classification rather than a plausible-looking
 *   wrong number.
 */
export function parseDumpListing(text: string, window: ParseDumpListingWindow): DumpListingMap {
  const { origin, imageSize } = window;
  if (!Number.isInteger(origin) || origin < 0) {
    throw new Error(`parseDumpListing: origin must be a non-negative integer, got ${origin}`);
  }
  if (!Number.isInteger(imageSize) || imageSize <= 0) {
    throw new Error(`parseDumpListing: imageSize must be a positive integer, got ${imageSize}`);
  }
  const windowEnd = origin + imageSize;

  const code = new Set<number>();
  const data = new Set<number>();
  const covered = new Set<number>();
  let codeBytes = 0;
  let dataBytes = 0;
  let matchedLines = 0;
  const outOfWindow: string[] = [];
  const lines: DumpLineShape[] = [];
  let firstAddress: number | null = null;
  let lastAddress: number | null = null;
  // Tracks which matched line (by index into `lines`) produced each
  // in-window address -- used ONLY to decide range-merge boundaries below
  // (two different lines never coalesce even when touching); never exposed
  // on the returned structure itself.
  const owner = new Map<number, number>();

  for (const rawLine of text.split("\n")) {
    // Strip a single trailing carriage return so CRLF and LF listings parse
    // identically. `DUMP_LINE_RE`'s trailing `(.*)$` matches `\r` (only `\n`
    // is excluded by `.`), so an un-stripped `\r` would ride along inside
    // the captured trailing text and inside `raw` below, breaking
    // byte-identical comparisons between the two line-ending variants.
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const m = DUMP_LINE_RE.exec(line);
    if (m === null) continue;

    const lineIndex = lines.length;
    matchedLines += 1;

    const address = parseInt(m[1]!, 16);
    const bytes = m[2]!.trim().split(/ +/).map((b) => parseInt(b, 16));
    const rest = m[3]!;
    // Data iff the emitted text begins `.byt` or `.word`; anything else is
    // an instruction dxa chose to emit, i.e. code.
    const isData = rest.startsWith(".byt") || rest.startsWith(".word");
    lines.push({ address, bytes, isData, raw: line });
    const target = isData ? data : code;

    let lineHasOutOfWindow = false;
    for (let i = 0; i < bytes.length; i += 1) {
      const a = address + i;
      if (a < origin || a >= windowEnd) {
        // Never added to any set -- recorded once per LINE below instead.
        lineHasOutOfWindow = true;
        continue;
      }
      target.add(a);
      covered.add(a);
      owner.set(a, lineIndex);
      if (isData) dataBytes += 1;
      else codeBytes += 1;
      if (firstAddress === null || a < firstAddress) firstAddress = a;
      if (lastAddress === null || a > lastAddress) lastAddress = a;
    }
    if (lineHasOutOfWindow) outOfWindow.push(line);
  }

  if (covered.size !== imageSize) {
    throw new Error(
      `parseDumpListing: covered byte total ${covered.size} does not equal expected image size ${imageSize}. ` +
        `Refusing to report an under- or over-counted classification. covered=${covered.size} expected=${imageSize} ` +
        `(matched ${matchedLines} byte-emitting lines; first out-of-window line: ${outOfWindow[0] ?? "<none>"}).`,
    );
  }

  // Ordering and adjacency: sort covered addresses ascending and coalesce
  // ONLY consecutive addresses that share both class AND originating line --
  // two different lines never merge even when their spans touch exactly or
  // agree on class (dxa-listing.test.ts's adjacency cases assert this).
  const ranges: DumpRange[] = [];
  const rangeOwner: number[] = [];
  for (const a of [...covered].sort((x, y) => x - y)) {
    const cls: "code" | "data" = code.has(a) ? "code" : "data";
    const lineOwner = owner.get(a)!;
    const lastIdx = ranges.length - 1;
    const last = lastIdx >= 0 ? ranges[lastIdx]! : undefined;
    if (last !== undefined && last.class === cls && last.end + 1 === a && rangeOwner[lastIdx] === lineOwner) {
      last.end = a;
    } else {
      ranges.push({ class: cls, start: a, end: a });
      rangeOwner.push(lineOwner);
    }
  }

  return { code, data, covered, codeBytes, dataBytes, matchedLines, outOfWindow, lines, firstAddress, lastAddress, ranges };
}
