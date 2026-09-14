// anno-provenance-ledger.ts -- the ONE place `recovery/PROVENANCE.md`'s
// generated tier is turned back into typed rows.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Nothing in this repository has ever READ the provenance ledger. It has one
// writer -- `renderLedger()` in `src/skills/c64-provenance-diff/scripts/
// diff-images.mjs` -- and zero readers, because the requirement governing this
// module requires the verdict be READ from the existing ledger, "never
// re-derived". Recomputing it in-process would force the
// exporter to import a registry-resolution path it has no other reason to
// know about, and would make "ledger absent" ambiguous between three
// different missing things. This module exists so "read" has an implementation
// distinct from "recompute".
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Turning `renderLedger()`'s emitted Markdown table -- the generated tier of
// `recovery/PROVENANCE.md` -- back into typed `ProvenanceLedgerRow` values,
// plus the one pure address-range join (`provenanceForRange()`) a caller uses
// to find which rows overlap a block it is about to emit.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never recompute a verdict. This module parses TEXT `renderLedger()`
//     already wrote; it never calls `diffRanges()`, never touches a release
//     registry, and never derives a Verdict or Confidence value from bytes.
//   - Never repair a malformed row. A row that does not split into exactly
//     seven pipe-delimited cells, or whose Start/End cell is not the `$XXXX`
//     shape `renderLedger()`'s own `hex4()` writes, is REFUSED -- never
//     best-effort-parsed, never defaulted, never silently skipped. No
//     trimming a cell into shape, no defaulting a missing column, no
//     coercing a bad address to zero, no dropping a bad row and continuing
//     with the rest: a partially-parsed ledger that reports success is worse
//     than a refusal, because every downstream verdict then looks
//     authoritative.
//   - Never interpolate the ledger's own row text into an error message. A
//     path, a line number and an expected shape are facts ABOUT a file; its
//     contents are not, and quoting them turns a refusal into a
//     content-disclosure oracle -- the same rule `anno-export-asm.ts`'s own
//     header states and this module's refusals below all follow. THE
//     PERMITTED VOCABULARY, enumerated rather than left as a general
//     instruction so a later contributor adding a refusal has it in front of
//     them, is exactly these five fact kinds and nothing else:
//       1. the ledger's PATH.
//       2. a 1-based LINE NUMBER, when the refusal is about one row.
//       3. a column NAME (`"Start"`, `"End"`, or one of
//          `PROVENANCE_LEDGER_HEADER_CELLS`).
//       4. a cell COUNT (how many cells a row split into, vs. how many were
//          expected).
//       5. a parsed ADDRESS (a `number` this module itself derived by calling
//          `parseHexAddress()`, formatted back through this module's own
//          `hex4()` -- never a cell's raw text passed through unexamined).
//     Cell TEXT -- Kind, Verdict, Confidence, Agreeing releases, Evidence /
//     Reason, or any cell that failed to parse -- is not on this list and
//     must never appear in a thrown message.
//   - Never re-derive `renderLedger()`'s CONTENT-shaped preconditions here.
//     `renderLedger()` refuses to EMIT under three conditions: an UNKNOWN row
//     with an empty reason, an ORIGINAL row with `agreeing_releases` below 2,
//     and a generated tier that does not tile `$0000-$FFFF` exactly. The
//     first two are claims about what a Verdict cell's CONTENT means --
//     asserting them here would make this reader adjudicate a verdict's
//     substance, exactly the "tool is the decider" shape this phase exists
//     to make structurally unreachable. Coverage, disjointness and ascending
//     order (the third condition, and the ones this module DOES assert
//     below) are claims about ADDRESSES only, which is the one thing a join
//     over ranges is allowed to reason about. A file violating an
//     ADDRESS-shaped invariant was never producible by the one writer this
//     format has, so the violation is evidence of a hand edit or corruption,
//     not of a reader bug -- accepting it would mean joining a store range
//     against a table that does not describe the whole address space.
//
// This module imports NOTHING from `src/skills/` (the shipped `@henols/
// vice-mcp` tarball does not contain that tree, and `anno-join.ts:26` already
// states the rule for this module family) and nothing from
// `hostpath.ts`/`containerpath.ts` -- every path this module reads is handed
// to it already resolved, exactly as `anno-export-asm.ts`'s own `imagePath`
// is documented: the CALLER owns confinement, this module only reads.
import { readFileSync } from "node:fs";

/**
 * The seven column names `renderLedger()` writes, in this exact order and
 * spelling (`diff-images.mjs`'s own header row). ONE declaration, one
 * spelling -- `readProvenanceLedger()` below locates the header row by
 * matching every cell against this array, so a header row that drifted from
 * this exact wording is treated as "no header found" rather than guessed at.
 */
export const PROVENANCE_LEDGER_HEADER_CELLS = Object.freeze([
  "Start",
  "End",
  "Kind",
  "Verdict",
  "Confidence",
  "Agreeing releases",
  "Evidence / Reason",
] as const);

/**
 * One row of the ledger's generated tier, copied verbatim off the table --
 * every string field is the cell's own text, UN-ESCAPED (`\|` back to `|`)
 * but never trimmed of meaning, normalised, upper-cased or mapped. An
 * unrecognised Verdict or Confidence string is carried through exactly as
 * written; this module does not know the vocabulary and does not check it.
 */
export interface ProvenanceLedgerRow {
  /** First address the row covers, parsed from the `$XXXX` form `hex4()`
   * writes. */
  start: number;
  /** Last address the row covers, INCLUSIVE -- `renderLedger()` writes
   * `hex4(r.end)` and advances its own coverage cursor with `r.end + 1`, so
   * the column this module reads is already an inclusive end. */
  endInclusive: number;
  /** The Kind cell, copied verbatim -- `game`/`loader`/`cracktro`/`io`/
   * `unused`/`unresolved` in a well-formed ledger, but this module does not
   * check membership; it copies whatever text is there. */
  kind: string;
  /** The Verdict cell, copied verbatim. Never normalised: an unrecognised
   * string is carried through as text, exactly as the plan's own prohibition
   * requires. */
  verdict: string;
  /** The Confidence cell, copied verbatim, on the same terms as `verdict`. */
  confidence: string;
  /**
   * The Agreeing releases cell, carried as a STRING, never parsed to a
   * number. `renderLedger()` interpolates `${r.agreeing_releases}` with no
   * guard, so a `CRACKER-PATCH` or `UNKNOWN` row can legitimately carry the
   * literal text `undefined` in this column -- inventing a number there
   * would be this module deciding something the ledger itself never
   * committed to.
   */
  agreeingReleases: string;
  /** The Evidence / Reason cell, un-escaped (`\|` back to `|`) but
   * otherwise verbatim. */
  evidence: string;
}

/** One parsed ledger: the path it was read from, and every row the generated
 * tier carried, in file order. */
export interface ProvenanceLedger {
  path: string;
  rows: readonly ProvenanceLedgerRow[];
}

export interface ProvenanceLedgerErrorOptions {
  path: string;
  /** 1-based line number of the offending row, when the refusal is about one
   * specific row rather than the file as a whole. */
  lineNumber?: number;
}

/**
 * Thrown by `readProvenanceLedger()`. Follows `ViceError`'s shape convention
 * (`vice.ts`) -- plain public fields, no sanitising -- rather than a
 * message-only `Error`, so a caller that wants the path or the line number
 * programmatically (a CLI wrapper printing its own summary, say) does not
 * have to parse them back out of prose.
 */
export class ProvenanceLedgerError extends Error {
  path: string;
  lineNumber?: number;

  constructor(message: string, { path, lineNumber }: ProvenanceLedgerErrorOptions) {
    super(message);
    this.name = "ProvenanceLedgerError";
    this.path = path;
    this.lineNumber = lineNumber;
  }
}

/** The remedy every refusal below names -- one sentence, one place, so the
 * two named routes stay in sync with each other rather than being retyped at
 * every throw site. */
const LEDGER_REMEDY =
  'regenerate it with c64-provenance-diff\'s "ledger" verb, or omit --ledger to export without provenance annotation';

/**
 * Splits one line into its pipe-delimited cells, or returns `undefined` when
 * the line is not shaped like a table row at all (does not start with `|`
 * once trimmed -- true of the blank line and the `## Prose tier` heading that
 * follow the generated tier, and of every prose line before the table).
 *
 * `\|` is protected before splitting and restored afterward in every cell,
 * matching the one escape `renderLedger()`'s writer applies (only ever to the
 * Evidence/Reason cell in practice, but restored uniformly here since a
 * split-time placeholder is an artefact of splitting, not a second escaping
 * rule).
 *
 * `PLACEHOLDER` is a one-character NUL string, built at RUNTIME with
 * String.fromCharCode(0) rather than written as a literal byte -- or any
 * backslash escape sequence naming that byte -- anywhere in this file's
 * own source text. A raw NUL byte on disk makes `git diff` render this
 * module as `Bin 0 -> N bytes` with no line-level diff ever again, and
 * hides the file from a plain (non-`-a`) `grep` census -- the exact
 * hazard `anno-memmap-render.ts` already carries and that this module
 * must not add a second instance of. `String.fromCharCode(0)` produces
 * the IDENTICAL runtime character while keeping every byte of the
 * source file printable ASCII, with no escape-sequence spelling for a
 * reviewing tool (or a lossy copy-paste) to silently collapse into the
 * raw byte it names. A plain space is NOT a safe substitute for the
 * sentinel value: ordinary ledger prose ("Agreeing releases", "Evidence
 * / Reason") already contains spaces, so restoring a space-shaped
 * placeholder back to `|` would corrupt every cell that happens to
 * contain one -- reproduced against this file's own header-row match
 * failing outright. NUL is chosen because ordinary ledger text -- a
 * Markdown table written by renderLedger(), plausibly hand-edited --
 * cannot contain it.
 *
 * The leading and trailing empty cells a `| a | b |`-shaped line produces are
 * dropped ONLY when they are genuinely empty -- a row missing its closing `|`
 * is left with a non-empty last cell, so the seven-cell count check at the
 * call site catches the malformed shape rather than this function silently
 * repairing it.
 *
 * A raw NUL byte already present in the line -- e.g. in a hand-edited or
 * corrupted ledger's Evidence/Reason cell -- is REFUSED rather than restored:
 * without this check, an existing NUL would collide with the placeholder
 * this function inserts for its own `\|` escaping, and the unconditional
 * `.join("|")` restoration below would silently turn that pre-existing NUL
 * into an extra, unescaped `|` that never delimited anything in the source
 * file. That is exactly the "repair a malformed row" outcome this module's
 * header forbids, so it is named and refused like every other malformed
 * shape this function's caller checks for -- never coerced, never dropped.
 * `ledgerPath` and `lineNumber` are threaded through only to build that
 * refusal's message; they change no other behaviour of this function.
 */
function splitTableRow(line: string, ledgerPath: string, lineNumber: number): string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return undefined;

  const PLACEHOLDER = String.fromCharCode(0);
  if (trimmed.includes(PLACEHOLDER)) {
    throw new ProvenanceLedgerError(
      `anno-provenance-ledger: row ${lineNumber} of "${ledgerPath}" contains a raw NUL byte -- refusing to parse a row that ` +
        `could collide with this module's own internal escape-placeholder sentinel rather than silently turning it into an ` +
        `unescaped "|". ${LEDGER_REMEDY}.`,
      { path: ledgerPath, lineNumber },
    );
  }
  const protectedLine = trimmed.replace(/\\\|/g, PLACEHOLDER);
  let cells = protectedLine.split("|");
  if (cells[0] === "") cells = cells.slice(1);
  if (cells.length > 0 && cells[cells.length - 1] === "") cells = cells.slice(0, -1);

  return cells.map((cell) => cell.trim().split(PLACEHOLDER).join("|"));
}

/** Parses a `$XXXX` cell (exactly `hex4()`'s own output shape) into a
 * number, or `undefined` when the cell does not match -- the caller turns
 * `undefined` into a named refusal rather than this function guessing. */
function parseHexAddress(cell: string): number | undefined {
  const match = /^\$([0-9a-fA-F]{4})$/.exec(cell);
  if (!match) return undefined;
  return Number.parseInt(match[1]!, 16);
}

/** Formats a PARSED address (never a cell's raw text) as `$XXXX`, for use in
 * refusal messages -- the one fact kind on the permitted-vocabulary list that
 * is a number this module derived itself, not text copied off the file. */
function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

/**
 * Throws the shared bad-address refusal for row `lineNumber`'s `column`
 * cell (`"Start"` or `"End"`) -- ONE template for both columns, since the
 * only fact that differs between them is the column NAME, which is on the
 * permitted vocabulary list. The cell's own text is never read here or by
 * either call site: the caller passes only the column name, never the
 * string that failed to parse.
 */
function refuseBadAddress(ledgerPath: string, lineNumber: number, column: "Start" | "End"): never {
  throw new ProvenanceLedgerError(
    `anno-provenance-ledger: row ${lineNumber} of "${ledgerPath}" has a ${column} cell that is not the "$XXXX" shape ` +
      `renderLedger()'s own hex4() writes -- refusing to parse an address this module cannot be sure of, and never guessing ` +
      `one from the cell's own text. ${LEDGER_REMEDY}.`,
    { path: ledgerPath, lineNumber },
  );
}

/**
 * Reads and parses `ledgerPath`'s generated tier.
 *
 * Locates the header row by matching every cell against
 * `PROVENANCE_LEDGER_HEADER_CELLS`, skips the `|---|` separator line
 * immediately below it without re-validating its own shape, then parses
 * every following pipe-delimited line into a `ProvenanceLedgerRow` until the
 * first line that is not a table row at all, then asserts the accepted rows
 * as a WHOLE are strictly ascending, disjoint, and tile exactly
 * `$0000-$FFFF`.
 *
 * Refuses (`ProvenanceLedgerError`) for eight distinct reasons, and REJECTS
 * rather than repairs at every one of them -- no trimming, no defaulting, no
 * coercing a bad address to zero, no dropping a bad row and continuing with
 * the rest. Listed here in RULE order rather than strict execution order
 * (the zero-data-rows check can only run once the per-row loop below has
 * finished, so it fires textually after checks 4-6 even though it is
 * conceptually "does the table hold any rows at all"):
 *   1. the file cannot be read.
 *   2. no header row matching all seven cells is found.
 *   3. the header and separator are present but zero data rows follow.
 *   4. a candidate row does not split into exactly seven cells.
 *   5. a candidate row's Start or End cell is not the `$XXXX` shape
 *      `hex4()` writes.
 *   6. a candidate row's End is below its Start.
 *   7. two rows overlap, or are not strictly ascending by Start.
 *   8. the accepted rows do not begin at `$0000`, leave a gap, or stop
 *      below `$FFFF`.
 *
 * Every refusal names the path and, for a single-row problem, the 1-based
 * line number -- never the row's own cell text. See the module header's
 * "WHAT NOT TO DO" section for the full permitted-fact vocabulary, and for
 * why checks 7 and 8 are the ONLY two that mirror `renderLedger()`'s own
 * emit-time preconditions: they are the ADDRESS-shaped ones, and the two
 * CONTENT-shaped ones (UNKNOWN-with-empty-reason, ORIGINAL-agreeing-below-2)
 * are deliberately never re-asserted here.
 */
export function readProvenanceLedger(ledgerPath: string): ProvenanceLedger {
  let raw: string;
  try {
    raw = readFileSync(ledgerPath, "utf8");
  } catch (err) {
    throw new ProvenanceLedgerError(
      `anno-provenance-ledger: could not read the ledger at "${ledgerPath}" (${err instanceof Error ? err.message : String(err)}) -- ` +
        `refusing to annotate without it. ${LEDGER_REMEDY}.`,
      { path: ledgerPath },
    );
  }

  const lines = raw.split(/\r?\n/);

  let headerLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const cells = splitTableRow(lines[i]!, ledgerPath, i + 1);
    if (
      cells !== undefined &&
      cells.length === PROVENANCE_LEDGER_HEADER_CELLS.length &&
      cells.every((cell, idx) => cell === PROVENANCE_LEDGER_HEADER_CELLS[idx])
    ) {
      headerLineIndex = i;
      break;
    }
  }
  if (headerLineIndex === -1) {
    throw new ProvenanceLedgerError(
      `anno-provenance-ledger: no header row matching the seven expected columns (${PROVENANCE_LEDGER_HEADER_CELLS.join(", ")}) ` +
        `was found in "${ledgerPath}" -- refusing to guess which row starts the table. ${LEDGER_REMEDY}.`,
      { path: ledgerPath },
    );
  }

  const rows: ProvenanceLedgerRow[] = [];
  /** 1-based source line number for `rows[k]`, kept parallel to `rows` so the
   * ordering/overlap check below can name both offending rows without
   * re-scanning `lines` -- an internal bookkeeping array, never exposed on
   * `ProvenanceLedgerRow` itself. */
  const rowLineNumbers: number[] = [];
  // headerLineIndex + 1 is the `|---|` separator -- skipped, not
  // re-validated. Parsing starts one line further on.
  for (let i = headerLineIndex + 2; i < lines.length; i++) {
    const line = lines[i]!;
    const cells = splitTableRow(line, ledgerPath, i + 1);
    if (cells === undefined) break; // first line that is not a table row at all ends the generated tier

    if (cells.length !== PROVENANCE_LEDGER_HEADER_CELLS.length) {
      throw new ProvenanceLedgerError(
        `anno-provenance-ledger: row ${i + 1} of "${ledgerPath}" splits into ${cells.length} pipe-delimited cells, not the ` +
          `${PROVENANCE_LEDGER_HEADER_CELLS.length} renderLedger() always writes -- refusing to parse a row whose own shape ` +
          `is wrong. ${LEDGER_REMEDY}.`,
        { path: ledgerPath, lineNumber: i + 1 },
      );
    }

    const [startCell, endCell, kind, verdict, confidence, agreeingReleases, evidence] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const start = parseHexAddress(startCell);
    if (start === undefined) refuseBadAddress(ledgerPath, i + 1, "Start");
    const end = parseHexAddress(endCell);
    if (end === undefined) refuseBadAddress(ledgerPath, i + 1, "End");

    if (end < start) {
      throw new ProvenanceLedgerError(
        `anno-provenance-ledger: row ${i + 1} of "${ledgerPath}" has End ${hex4(end)} below its Start ${hex4(start)} -- ` +
          `refusing to accept a row whose own span is inverted. ${LEDGER_REMEDY}.`,
        { path: ledgerPath, lineNumber: i + 1 },
      );
    }

    rows.push({ start, endInclusive: end, kind, verdict, confidence, agreeingReleases, evidence });
    rowLineNumbers.push(i + 1);
  }

  if (rows.length === 0) {
    throw new ProvenanceLedgerError(
      `anno-provenance-ledger: the header and separator in "${ledgerPath}" are present but zero data rows follow -- ` +
        `refusing to treat a table that parsed to no rows the same as no ledger having been asked for at all. ${LEDGER_REMEDY}.`,
      { path: ledgerPath },
    );
  }

  // CHECK 7 -- ADDRESS-SHAPED, mirrors `renderLedger()`'s own "gap or
  // overlap" precondition. Two rows overlap, or the rows are not strictly
  // ascending by Start, iff a later row's Start does not come strictly after
  // the earlier row's own Start AND End. `rows` is in FILE order (not
  // re-sorted), so this also catches a ledger whose rows were reordered by a
  // hand edit, not only a genuine address collision.
  for (let idx = 1; idx < rows.length; idx++) {
    const prev = rows[idx - 1]!;
    const cur = rows[idx]!;
    if (cur.start <= prev.start || cur.start <= prev.endInclusive) {
      throw new ProvenanceLedgerError(
        `anno-provenance-ledger: rows ${rowLineNumbers[idx - 1]} and ${rowLineNumbers[idx]} of "${ledgerPath}" are not ` +
          `strictly ascending and disjoint by Start -- row ${rowLineNumbers[idx - 1]} spans ${hex4(prev.start)}..${hex4(prev.endInclusive)} ` +
          `and row ${rowLineNumbers[idx]} spans ${hex4(cur.start)}..${hex4(cur.endInclusive)} -- refusing to join a store range against rows ` +
          `this module cannot order unambiguously. ${LEDGER_REMEDY}.`,
        { path: ledgerPath, lineNumber: rowLineNumbers[idx] },
      );
    }
  }

  // CHECK 8 -- ADDRESS-SHAPED, mirrors `renderLedger()`'s own two coverage
  // preconditions (starts at $0000 with no gap; reaches $FFFF). Run only
  // after check 7 has already established the rows are disjoint and
  // ascending, so `expected` is a running "next address a row must start at"
  // cursor rather than a re-derivation of the ordering check above.
  let expected = 0;
  for (const row of rows) {
    if (row.start !== expected) {
      throw new ProvenanceLedgerError(
        `anno-provenance-ledger: "${ledgerPath}"'s accepted rows do not cover $0000..$FFFF -- address ${hex4(expected)} is not ` +
          `covered by any row -- refusing to join a store range against a table that does not describe the whole address space. ` +
          `${LEDGER_REMEDY}.`,
        { path: ledgerPath },
      );
    }
    expected = row.endInclusive + 1;
  }
  if (expected !== 0x10000) {
    throw new ProvenanceLedgerError(
      `anno-provenance-ledger: "${ledgerPath}"'s accepted rows stop at ${hex4(expected - 1)}, not $FFFF -- refusing to join a ` +
        `store range against a table that does not describe the whole address space. ${LEDGER_REMEDY}.`,
      { path: ledgerPath },
    );
  }

  return { path: ledgerPath, rows };
}

/**
 * Every row of `ledger` overlapping `[start, endInclusive]`, both ends
 * inclusive, in ascending `start` order.
 *
 * Two ranges overlap iff each starts at or before the other ends -- the same
 * `>=` reasoning `addScope()` in `anno-store.ts` already documents for
 * scopes, so a row ending exactly at `start - 1` does NOT overlap. Returns
 * EVERY match and never picks one: multiplicity is the caller's to record,
 * never this function's to resolve. Takes no threshold, no filter predicate
 * and no default -- the join is address-only, and no Verdict, Confidence or
 * Kind value is ever read here.
 */
export function provenanceForRange(ledger: ProvenanceLedger, start: number, endInclusive: number): readonly ProvenanceLedgerRow[] {
  return ledger.rows.filter((row) => row.start <= endInclusive && row.endInclusive >= start).sort((a, b) => a.start - b.start);
}
