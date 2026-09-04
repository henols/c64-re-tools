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

/** Renders an address as a 4-hex-digit column, e.g. `0x0812` -- used only in
 * `UnclassifiedByte` reasons and refusal messages, never in the ONE
 * line-matching regular expression above. */
function hex4(address: number): string {
  return `0x${address.toString(16).padStart(4, "0")}`;
}

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
 * INCLUSIVE. Two `code`/`data` ranges are never merged across a source-line
 * boundary even when their addresses touch or their class matches -- only
 * bytes emitted by the SAME matched line ever coalesce into one `code`/`data`
 * entry (`dxa-listing.test.ts`'s adjacency cases assert this directly). This
 * is what makes "two spans that merely touch stay two entries" true
 * regardless of class agreement. `unclassified` addresses (an overlapping
 * decode; see `UnclassifiedByte`) coalesce among themselves by address
 * alone -- they have no single owning line to key on -- but never merge into
 * an adjacent `code` or `data` run, since a class change always breaks a
 * range. */
export interface DumpRange {
  class: "code" | "data" | "unclassified";
  /** Inclusive lower bound. */
  start: number;
  /** Inclusive upper bound. */
  end: number;
}

/** One address two (or more) matched lines both claim. A byte-per-address
 * map structurally cannot represent two decodes of the same byte, so this
 * project declines to decide and says why -- there is no tie-break, no
 * first-wins, no last-wins, no longest-span-wins and no code-beats-data
 * rule anywhere in this module, including when the claims AGREE on class:
 * agreement is not resolution, since a rule that resolved the agreeing case
 * would be the same tie-break rule, merely unobservable on that input. */
export interface UnclassifiedByte {
  /** The contested address. */
  address: number;
  /** Every line that claimed this address, verbatim, with its claimed
   * class. */
  claims: { raw: string; class: "code" | "data" }[];
  /** Human-readable reason naming every claiming line verbatim and every
   * claimed class -- always derived from `claims`, never a separate,
   * driftable statement. */
  reason: string;
}

export interface DumpListingMap {
  /** Distinct in-window addresses dxa classified as code. */
  code: Set<number>;
  /** Distinct in-window addresses dxa classified as data. */
  data: Set<number>;
  /** Every in-window address TWO OR MORE matched lines claimed -- an
   * overlapping decode. Never a member of `code` or `data` (an address is
   * removed from whichever class set already held it the moment a second
   * claim arrives, and never re-entered by a third). Keyed by address for
   * direct reason lookup. */
  unclassified: Map<number, UnclassifiedByte>;
  /** Distinct in-window addresses covered by `code`, `data` OR
   * `unclassified` -- the quantity the one refusal predicate compares
   * against `imageSize`. An `unclassified` address counts toward this total
   * exactly once, so an overlapping listing whose distinct coverage equals
   * `imageSize` does not spuriously refuse. */
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
  const unclassified = new Map<number, UnclassifiedByte>();
  const covered = new Set<number>();
  let codeBytes = 0;
  let dataBytes = 0;
  let matchedLines = 0;
  const outOfWindow: string[] = [];
  const lines: DumpLineShape[] = [];
  let firstAddress: number | null = null;
  let lastAddress: number | null = null;
  // Every in-window byte EMISSION, keyed by address, collected BEFORE any
  // classification decision is made -- an address with more than one claim
  // is an overlapping decode and is resolved below, never awarded to
  // whichever claim happened to be seen first.
  const claims = new Map<number, { lineIndex: number; cls: "code" | "data" }[]>();

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
    const cls: "code" | "data" = isData ? "data" : "code";
    lines.push({ address, bytes, isData, raw: line });

    let lineHasOutOfWindow = false;
    for (let i = 0; i < bytes.length; i += 1) {
      const a = address + i;
      if (a < origin || a >= windowEnd) {
        // Never claimed -- recorded once per LINE below instead.
        lineHasOutOfWindow = true;
        continue;
      }
      let list = claims.get(a);
      if (list === undefined) {
        list = [];
        claims.set(a, list);
      }
      list.push({ lineIndex, cls });
      // codeBytes/dataBytes are raw EMISSION counts, not distinct-address
      // counts (see the field's own doc) -- incremented here, once per
      // claim, so an overlapping decode's byte total may exceed
      // code.size/data.size exactly as documented.
      if (cls === "data") dataBytes += 1;
      else codeBytes += 1;
      if (firstAddress === null || a < firstAddress) firstAddress = a;
      if (lastAddress === null || a > lastAddress) lastAddress = a;
    }
    if (lineHasOutOfWindow) outOfWindow.push(line);
  }

  // Resolve every claimed address. A SINGLE claim classifies normally; TWO
  // OR MORE claims -- whether they agree or disagree on class -- resolve to
  // `unclassified` with a stated reason naming every claiming line and
  // class. Agreement is not resolution: a rule that resolved the agreeing
  // case would be the same tie-break rule, merely unobservable on that
  // input (dxa-listing.test.ts's agreeing-overlap case asserts this).
  // Tracks which matched line (by index into `lines`) produced each
  // `code`/`data` address -- used ONLY to decide range-merge boundaries
  // below (two different lines never coalesce even when touching);
  // `unclassified` addresses have no single owner and are never looked up
  // here.
  const owner = new Map<number, number>();
  for (const [a, claimList] of claims) {
    covered.add(a);
    if (claimList.length === 1) {
      const claim = claimList[0]!;
      owner.set(a, claim.lineIndex);
      if (claim.cls === "code") code.add(a);
      else data.add(a);
    } else {
      const claimDescs = claimList.map((c) => ({ raw: lines[c.lineIndex]!.raw, class: c.cls }));
      const reason =
        `address ${hex4(a)} claimed by ${claimList.length} lines -- ` +
        claimDescs.map((c) => `"${c.raw}" (${c.class})`).join(" and ") +
        `; a byte-per-address map cannot represent two decodes of the same byte, so this parser declines to award it to either class.`;
      unclassified.set(a, { address: a, claims: claimDescs, reason });
    }
  }

  if (covered.size !== imageSize) {
    throw new Error(
      `parseDumpListing: covered byte total ${covered.size} does not equal expected image size ${imageSize}. ` +
        `Refusing to report an under- or over-counted classification. covered=${covered.size} expected=${imageSize} ` +
        `unclassified=${unclassified.size} (matched ${matchedLines} byte-emitting lines; first out-of-window line: ${outOfWindow[0] ?? "<none>"}).`,
    );
  }

  // Ordering and adjacency: sort covered addresses ascending and coalesce
  // ONLY consecutive addresses that share both class AND originating line
  // for `code`/`data` -- two different lines never merge even when their
  // spans touch exactly or agree on class (dxa-listing.test.ts's adjacency
  // cases assert this). `unclassified` addresses coalesce by address alone
  // (they have no single owning line), but a class change ALWAYS breaks a
  // range, so `unclassified` never merges into an adjacent `code`/`data`
  // run.
  const ranges: DumpRange[] = [];
  const rangeOwner: (number | undefined)[] = [];
  for (const a of [...covered].sort((x, y) => x - y)) {
    const cls: "code" | "data" | "unclassified" = code.has(a) ? "code" : data.has(a) ? "data" : "unclassified";
    const lineOwner = cls === "unclassified" ? undefined : owner.get(a)!;
    const lastIdx = ranges.length - 1;
    const last = lastIdx >= 0 ? ranges[lastIdx]! : undefined;
    const sameOwner = cls === "unclassified" || rangeOwner[lastIdx] === lineOwner;
    if (last !== undefined && last.class === cls && last.end + 1 === a && sameOwner) {
      last.end = a;
    } else {
      ranges.push({ class: cls, start: a, end: a });
      rangeOwner.push(lineOwner);
    }
  }

  return { code, data, unclassified, covered, codeBytes, dataBytes, matchedLines, outOfWindow, lines, firstAddress, lastAddress, ranges };
}
