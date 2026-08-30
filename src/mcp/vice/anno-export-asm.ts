// anno-export-asm.ts -- the ONE place annotation-store rows plus image bytes
// become ACME source text (EXPORT-01).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The previous export route was WITHDRAWN in Phase 29 rather than left
// standing, because it made a reassembly claim nothing verified: it produced
// something that looked like ACME source and asserted, in effect, that
// assembling it would reproduce the program. No assembler ever ran. Withdrawing
// it was the right call and the withdrawal notices in both skill trees are the
// record that the capability was missing.
//
// This module is the rebuild, over the Phase 28 annotation store, and it is
// allowed to exist only because the claim is now settled somewhere else: a real
// ACME 0.97 assembles this module's output and the resulting bytes are diffed
// against the IMAGE bytes. Nothing in this file verifies this file. Re-reading,
// re-parsing or substring-matching the text below to decide whether the export
// is correct would be a self-check wearing an oracle's clothes, and this
// project's own record is that an internally-verified opcode table still
// shipped fourteen wrong entries.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Turning `(store rows, image bytes)` into `(ACME source text, the exact bytes
// that source must assemble to)`. The second half of that pair is what makes
// the round trip a round trip: `expectedBytes` is built from the IMAGE, never
// from `source`.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never re-derive the opcode table. `disasm-opcodes.ts` forbids a second
//     copy by name, and its `acmeExpressible` column is round-trip-proven
//     against a real assembler across all 256 opcodes. Decoding here happens
//     through `decode()` and nowhere else.
//   - Never write a second `!byte` / `+2` / hex emitter. `disasm-renderer.ts`
//     owns D-09's `!byte` substitution and D-11's width invariant, both
//     verified against real ACME. A second emitter would be a second answer to
//     "how wide is this operand", and the two would drift silently.
//   - Never restate the eleven auto-name prefixes here. `anno-types.ts` forbids
//     a second copy of that vocabulary by name; this module does not need it at
//     all, and a copy made "just to filter" is how the eleventh prefix goes
//     missing in one of two places.
//   - Never compare a `dataType` string in this module beyond the TWO places
//     that already do, each of which says so in its own comment:
//     `CODE_DATA_TYPE`'s decoder-or-dump branch, and `WORD_PAIR_DATA_TYPES`'s
//     `!word` eligibility check. Both are questions about the emitted TEXT.
//     `block-class.ts` is the one place in this tree allowed to INTERPRET that
//     column -- what the data means -- and everywhere else here the string is
//     copied VERBATIM onto the emitted block and its trailing comment.
//   - Never import this tree's host/container path-translation modules
//     (`hostpath.ts` / `containerpath.ts`). Their consumer set is a closed,
//     mechanically asserted list of named modules and an exporter has no reason
//     to join it -- the failure would surface as a test about something else
//     entirely.
//   - Never interpolate a read file's own bytes into an error message. A path,
//     an address and a length are facts ABOUT a file; its contents are not, and
//     an error text that quotes them turns a refusal into a content-disclosure
//     oracle (CR-03). Every throw below carries paths, addresses and counts and
//     nothing read out of the image or the store.
//   - Never sanitise a label name. `assertLegalAcmeIdentifier()`'s contract is
//     REJECT: a space-to-underscore substitution silently merges two distinct
//     names into one, permanently, and the caller-visible name then diverges
//     from what actually reached the ACME source.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE DOES NOT CHECK
// ---------------------------------------------------------------------------
// Addresses no range covers. `expectedBytes` spans `[minStart,
// maxEndExclusive)` with `$00` in the gaps between blocks -- which is exactly
// what ACME `-f plain` emits for those gaps (measured) -- so the padding is
// never a false disagreement. But an export makes no claim about bytes outside
// its own blocks, and neither does the byte-diff that settles it.
//
// SCOPE, STILL DELIBERATELY NARROW: code ranges, the twelve typed data ranges
// and comments. There is no enum substitution and no mid-instruction `=*+$01`
// label insertion here yet; those arrive in a later plan of this phase.
import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { openStore, closeStore, listRanges, listLabels, listComments } from "./anno-store.ts";
import { AnnoCommentError, COMMENT_TYPES, assertCommentText } from "./anno-types.ts";
import type { CommentRow, LabelRow, RangeRow } from "./anno-types.ts";
import { assertLegalAcmeIdentifier } from "./anno-acme-ident.ts";
import { decode } from "./disasm-decoder.ts";
import { renderLine } from "./disasm-renderer.ts";
import { parsePrg, flatImageOrigin } from "./prg-image.ts";

/** The store's own spelling for an executable range, read out of the one home
 * of that vocabulary rather than re-typed as a literal. `dataType` is never
 * COMPARED anywhere else in this module -- `block-class.ts` owns
 * interpretation; this single equality is the emitter deciding whether to run
 * a decoder or dump bytes, and it is the only one. */
const CODE_DATA_TYPE = "code";

/** One block as this module emitted it. */
export interface ExportBlock {
  /** First address the block covers. */
  start: number;
  /** One past the last address the block covers. ACME's `*` sits here after
   * the block, and the store's own row uses an INCLUSIVE end, so the
   * conversion is `endExclusive = row.endInclusive + 1`. */
  endExclusive: number;
  /** The store's `dataType`, copied VERBATIM off the row. Never compared in
   * this module beyond the single code/not-code branch the emitter needs. */
  dataType: string;
  /** How many CONTENT lines the block emitted -- not its `* =` origin line and
   * not the two `!if * != ...` assertions that bracket it. */
  lineCount: number;
}

export interface ExportAsmOptions {
  /**
   * The annotation store to export. `openStore()` below confines it against
   * `workspaceRoot`; a CLI caller confines the same string a second time
   * through `storePathWithinWorkspace()` before it ever reaches here, so both
   * answers agree by construction rather than by a second rule. */
  storePath: string;
  /** The program image the store annotates -- a `.prg` (2-byte little-endian
   * load address then payload) or a flat 64K capture. NOTHING CONFINES THIS
   * PATH INSIDE THIS MODULE: it reaches `readFileSync` directly, so the CALLER
   * owns its confinement, exactly as it owns `storePath`'s. That sentence is
   * present because an absent comment beside a present one is itself a claim,
   * and a silently-undocumented path field is what a prior review named as the
   * mechanism of a real defect. */
  imagePath: string;
  /** The workspace root the store-path confinement is taken against. REQUIRED
   * rather than defaulted: `openStore()`'s default behaviour is to CREATE the
   * file, so an unconfined store path is a store file created wherever the
   * caller's argument pointed -- and an export of a store this call just
   * invented would read as "the program has no annotations". */
  workspaceRoot: string;
}

export interface ExportAsmResult {
  /** The ACME source text. */
  source: string;
  /** The bytes `source` must assemble to, DERIVED FROM THE IMAGE and never
   * from `source`. Spans `[minStart, maxEndExclusive)` across every emitted
   * block, with `$00` filling the gaps between them -- which is exactly what
   * ACME `-f plain` emits for those gaps (measured), so padding can never
   * register as a disagreement while a wrong byte inside a covered range
   * still fails. */
  expectedBytes: Uint8Array;
  /** The blocks emitted, ascending by start. Passed straight to the verify
   * primitive as its `expectedSegments`. */
  blocks: ExportBlock[];
  /** How many symbol definitions the header carries. */
  symbolCount: number;
  /** How many decoded instructions ACME's `!cpu 6510` cannot express, and
   * which therefore went out as `!byte` directives with their mnemonic moved
   * into a trailing comment. */
  unexpressibleCount: number;
  /** How many bytes went out through the DATA path -- every byte of every
   * block whose `dataType` is not `code`. A code block contributes nothing
   * here, however many bytes it decoded. */
  dataByteCount: number;
  /** How many store comments the source carries. Always the store's FULL
   * comment count when this function returns: a comment with no emitted line
   * to attach to is refused by name rather than left out of this number. */
  commentCount: number;
}

/** How many raw bytes go on one `!byte` line for a non-code block. */
const BYTES_PER_DATA_LINE = 16;

/** How many 16-bit values go on one `!word` line. */
const WORDS_PER_DATA_LINE = 8;

/**
 * The two `DATA_TYPES` members whose bytes are ADJACENT little-endian pairs,
 * and therefore the only ones `!word` can emit without changing a byte.
 *
 * THIS IS THE ONE PLACE IN THIS MODULE A TYPE NAME IS READ FOR EMISSION, other
 * than `CODE_DATA_TYPE`'s decoder/dump branch. `block-class.ts` owns
 * INTERPRETATION of a `dataType`; these two names are read here only to answer
 * "may this block's bytes be re-grouped into pairs", which is a question about
 * the emitted TEXT and not about what the data means. Every other type -- the
 * four split-table layouts included, whose low and high halves are NOT adjacent
 * pairs -- is copied verbatim onto a `!byte` line and never compared.
 */
const WORD_PAIR_DATA_TYPES: readonly string[] = Object.freeze(["word", "address"]);

/** One emitted data line, with the address span it covers. The span is what
 * lets a stored comment find its line: a `!byte` line covers up to sixteen
 * addresses, and a comment on any of them belongs to that line. */
interface DataLine {
  text: string;
  start: number;
  endExclusive: number;
}

/**
 * Emits one non-code block's bytes.
 *
 * THE RULE, and its reason: byte-identity is the criterion, and `!byte` is
 * byte-identical for every type. `!word` is used ONLY where it is provably
 * identical AND improves readability -- `word` and `address` ranges of even
 * length, where ACME's `!word` emits little-endian pairs (measured). Everything
 * else goes out as `!byte`.
 *
 * `!text` IS DELIBERATELY NOT EMITTED for `petscii` / `screencode`. `!text`
 * applies ACME's CURRENT conversion table, and a conversion this exporter does
 * not control is exactly the way a byte-identical claim stops being true --
 * silently, on somebody else's machine, with a different ACME build. The type
 * name goes into the trailing comment instead, so a human reader loses nothing
 * a converter would have told them about the bytes' meaning.
 *
 * `stock-petscii.ts` was checked for a reusable byte-to-text converter and
 * exports only `asciiToPetscii()` -- the other direction. A second conversion
 * table is NOT invented here; that would be the same drift hazard wearing a
 * local name.
 *
 * OVERLAP: `--strict-segments` is in the verify argv, which promotes ACME's
 * "Segment starts inside another one, overwriting it." from a Warning to an
 * Error (measured, exit 1). Without it a store holding two overlapping ranges
 * would silently overwrite one with the other and the byte-diff would compare
 * against whichever won.
 */
function emitDataLines(slice: Uint8Array, dataType: string, blockStart: number): DataLine[] {
  const out: DataLine[] = [];

  if (WORD_PAIR_DATA_TYPES.includes(dataType) && slice.length % 2 === 0) {
    for (let offset = 0; offset < slice.length; offset += WORDS_PER_DATA_LINE * 2) {
      const chunk = slice.subarray(offset, Math.min(offset + WORDS_PER_DATA_LINE * 2, slice.length));
      const values: string[] = [];
      for (let i = 0; i < chunk.length; i += 2) values.push(hex4(chunk[i]! | (chunk[i + 1]! << 8)));
      out.push({
        text: `${INDENT}!word ${values.join(", ")}  ; ${dataType}`,
        start: blockStart + offset,
        endExclusive: blockStart + offset + chunk.length,
      });
    }
    return out;
  }

  // The fallback says WHY it happened, because "this word table came out as
  // bytes" is otherwise indistinguishable from a missing feature.
  const why = WORD_PAIR_DATA_TYPES.includes(dataType)
    ? ` (odd byte count ${slice.length} -- !word emits PAIRS, so a byte-identical emission falls back to !byte)`
    : "";
  for (let offset = 0; offset < slice.length; offset += BYTES_PER_DATA_LINE) {
    const chunk = slice.subarray(offset, Math.min(offset + BYTES_PER_DATA_LINE, slice.length));
    out.push({
      text: `${INDENT}!byte ${[...chunk].map(hex2).join(", ")}  ; ${dataType}${why}`,
      start: blockStart + offset,
      endExclusive: blockStart + offset + chunk.length,
    });
  }
  return out;
}

/** ACME source indent for directive lines, matching `disasm-renderer.ts`'s own
 * cosmetic indent so the two emitters' output reads as one document. */
const INDENT = "        ";

function hex2(value: number): string {
  return `$${(value & 0xff).toString(16).padStart(2, "0")}`;
}

function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).padStart(4, "0")}`;
}

/**
 * `$XXXX` for an address, and for the ONE value in this module that is not an
 * address: a block's EXCLUSIVE end, which is `$10000` for a range ending at
 * `$ffff`. `hex4()` masks with `0xffff` and would render that as `$0000` -- an
 * assertion no assembly can ever satisfy, firing on a correct export. Padded,
 * never masked.
 */
function hexExtent(value: number): string {
  return `$${value.toString(16).padStart(4, "0")}`;
}

/**
 * Wraps one block's content lines in its origin and its `*` assertions.
 *
 * THE EXCLUSIVE END IS THE POINT. Measured on ACME 0.97: `* = $0801` followed
 * by `lda #$00` and `rts` leaves `*` at `$0804`, one past the last emitted
 * byte. The store's own row uses an INCLUSIVE end, so the conversion is
 * `endExclusive = row.endInclusive + 1` and it is done in exactly one place
 * (see `exportAsm()`'s block construction).
 *
 * WHY BOTH ENDS. `!cpu 6510` plus correct-looking mnemonics is not enough:
 * measured, a substitution that changes ONE instruction's length -- dropping
 * ACME's `+2` size force from an absolute operand below `$0100`, or
 * forward-referencing a zero-page symbol -- assembles at exit 0 and shifts
 * every byte after it. The end assertion is what turns that into a refusal:
 * ACME exits 1, prints the `!error` text below on stderr, and writes NO output
 * file.
 *
 * WHY THE EXPECTED VALUE IS SPELLED OUT IN THE MESSAGE. Interpolating `*` into
 * an `!error` renders it as `<decimal> (0x<hex>)`, not as `$hex`, so the
 * expected value is written in `$` form in the message text itself rather than
 * relying on ACME's rendering.
 *
 * WHY NOT `!pseudopc`. It is not an alternative: measured, it errors with
 * `Program counter undefined.` unless `*` has already been set.
 */
function emitBlock(start: number, endExclusive: number, lines: readonly string[]): string[] {
  return [
    `* = ${hexExtent(start)}`,
    `!if * != ${hexExtent(start)} { !error "export-asm: block origin drifted, expected ${hexExtent(start)}" }`,
    ...lines,
    `!if * != ${hexExtent(endExclusive)} { !error "export-asm: block end drifted, expected ${hexExtent(endExclusive)}" }`,
  ];
}

/**
 * Reads the image and dispatches its layout, BY EXTENSION FIRST and never by
 * byte length. That order is a contract copied from the surface's own image
 * loaders rather than re-derived: a truncated flat capture that falls through
 * to the `.prg` parser gets a load address read backwards out of its own
 * payload bytes, and every downstream address is then wrong with no
 * diagnostic.
 */
function loadImage(imagePath: string): { origin: number; bytes: Uint8Array } {
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(readFileSync(imagePath));
  } catch (err) {
    // An ERRNO-class failure (ENOENT, EACCES, EISDIR) carries no byte of the
    // file's content, so it is left interpolated on purpose.
    throw new Error(`exportAsm: could not read the image at "${imagePath}": ${err instanceof Error ? err.message : String(err)}`);
  }

  const ext = extname(imagePath).toLowerCase();
  if (ext === ".raw" || ext === ".bin") {
    return { origin: flatImageOrigin(raw), bytes: raw };
  }
  if (ext !== ".prg" && raw.length === 65536) {
    return { origin: flatImageOrigin(raw), bytes: raw };
  }
  if (ext === ".prg") {
    const { origin, body } = parsePrg(raw);
    return { origin, bytes: new Uint8Array(body) };
  }
  throw new Error(
    `exportAsm: the image at "${imagePath}" has extension "${ext}", which is not one this exporter reads. ` +
      `Supply a .prg (2-byte load address plus payload) or a flat 64K capture (.raw/.bin, exactly 65536 bytes).`,
  );
}

/**
 * Formats one header symbol definition.
 *
 * THE HEX-DIGIT COUNT IS LOAD-BEARING, not cosmetic. Measured on ACME 0.97:
 * `zpf = $10` then `lda zpf` assembles to `a5 10` (2 bytes, zeropage), while
 * `zpf = $0010` then the same `lda zpf` assembles to `ad 10 00` (3 bytes,
 * absolute). The DEFINITION's width decides the OPERAND's width, so an address
 * below `$0100` must be written with two digits and everything else with four.
 * Getting this wrong ships an export that ACME accepts and that produces the
 * wrong bytes -- the single most likely way for this module to be quietly
 * incorrect.
 */
function formatSymbolDefinition(name: string, address: number): string {
  const digits = address < 0x100 ? 2 : 4;
  return `${name} = $${address.toString(16).toUpperCase().padStart(digits, "0")}`;
}

/**
 * The store's own spellings for the two comment placements, DESTRUCTURED out of
 * `COMMENT_TYPES` -- the ONE home of that vocabulary -- rather than re-typed as
 * literals here. The same idiom `anno-memmap-render.ts` uses at its own read
 * boundary: a re-typed `"line"` is a second copy of a vocabulary that has one
 * home, and the two diverge in silence the first time the schema's spelling
 * changes.
 */
const [LINE_COMMENT, SIDE_COMMENT] = COMMENT_TYPES;

/**
 * Re-checks, at the EXPORT boundary, that a stored comment can be emitted.
 *
 * WHY THIS EXISTS RATHER THAN TRUSTING THE STORE. `assertCommentText()` is the
 * one comment-text vocabulary and it now refuses an embedded line break -- but
 * a store file written BEFORE that refusal existed, or through any route that
 * did not call it, can still hold one on disk. This boundary is the last place
 * before those bytes become assembler input, so it asks the question again. It
 * RE-CHECKS rather than RE-DEFINES: the predicate is `assertCommentText()`'s,
 * called here, never a second regex that could drift from it.
 *
 * The store validator's own message is deliberately DISCARDED and replaced.
 * That message interpolates the offending text for one of its four cases, and
 * an exporter error that quotes a file's contents back is a content-disclosure
 * oracle (CR-03). What survives is the address and which rule fired -- facts
 * ABOUT the comment, never the comment.
 */
export function assertExportableCommentText(text: string, address: number): string {
  try {
    return assertCommentText(text);
  } catch (err) {
    const reason = err instanceof AnnoCommentError && err.reason !== undefined ? err.reason : "refused by the store's comment-text vocabulary";
    throw new Error(
      `exportAsm: the comment at ${hex4(address)} cannot be emitted (${reason}). Every comment this exporter emits is a single line of text ` +
        `that the store's own comment-text vocabulary accepts; a stored line break would put everything after it into the ACME source at ` +
        `column zero, as assembler input rather than as a comment. REFUSED rather than repaired -- stripping or truncating here would change ` +
        `what somebody wrote and report success.`,
    );
  }
}

/** Where the comments live while a block is being emitted, and which of them
 * have found a line to attach to. Anything still unplaced when the last block
 * is done is REFUSED by name rather than dropped. */
interface CommentPlacement {
  byAddress: ReadonlyMap<number, CommentRow[]>;
  placed: Set<number>;
}

/**
 * Attaches every stored comment for the addresses `[start, endExclusive)` to
 * one emitted line: a `line` comment on its own line immediately before it, a
 * `side` comment appended to it.
 *
 * Multiple comments at one address emit in `id` order, which is the order
 * `listComments()` returns them in -- so two people's notes at one address keep
 * the order they were written in rather than an order this module invented.
 */
function withComments(text: string, start: number, endExclusive: number, ctx: CommentPlacement): string[] {
  const before: string[] = [];
  let line = text;

  for (let address = start; address < endExclusive; address++) {
    for (const row of ctx.byAddress.get(address) ?? []) {
      const safe = assertExportableCommentText(row.text, row.address);
      ctx.placed.add(row.id);
      if (row.commentType === LINE_COMMENT) {
        before.push(`${INDENT}; ${safe}`);
      } else if (row.commentType === SIDE_COMMENT) {
        line = `${line}  ; ${safe}`;
      } else {
        // Unreachable through the type, and reachable through a store file
        // somebody edited. Refusing beats guessing which of the two placements
        // an unknown third one meant.
        throw new Error(
          `exportAsm: the comment at ${hex4(row.address)} has placement ${JSON.stringify(row.commentType)}, which is not one of the ` +
            `${COMMENT_TYPES.length} placements the store defines (${COMMENT_TYPES.join(", ")}) -- refusing to guess where it belongs.`,
        );
      }
    }
  }

  return [...before, line];
}

/**
 * Exports the annotation store at `options.storePath`, over the image at
 * `options.imagePath`, as ACME source plus the exact bytes that source must
 * assemble to.
 *
 * The returned `source` is NOT self-verifying and this function makes no claim
 * that it reassembles: that claim is settled by assembling it with a real ACME
 * and byte-diffing the result against `expectedBytes`.
 *
 * Throws (never returns a degraded result) when the store holds no ranges, when
 * a range is not covered by the image, or when a label name is not a legal ACME
 * identifier. Every message is prefixed `exportAsm:` and carries paths,
 * addresses and counts only.
 */
export function exportAsm(options: ExportAsmOptions): ExportAsmResult {
  const { storePath, imagePath, workspaceRoot } = options;

  const image = loadImage(imagePath);

  // ONE handle for the whole export, closed in a `finally`. `mustExist` is what
  // makes "the annotations are gone" and "there are no annotations" refuse
  // differently: without it a mistyped path would CREATE an empty store and
  // export as a program with nothing annotated, indistinguishable from a real
  // one.
  const handle = openStore(storePath, { workspaceRoot, mustExist: true });
  let ranges: RangeRow[];
  let labels: LabelRow[];
  let comments: CommentRow[];
  try {
    ranges = listRanges(handle);
    labels = listLabels(handle);
    comments = listComments(handle);
  } finally {
    closeStore(handle);
  }

  if (ranges.length === 0) {
    throw new Error(
      `exportAsm: the annotation store at "${storePath}" holds no ranges -- refusing to emit an empty ACME source, ` +
        `because "nothing is annotated" and "the export produced nothing" must not read the same.`,
    );
  }

  const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);

  // The store's end is INCLUSIVE; ACME's `*` after a block sits one past the
  // last byte. This conversion is a documented carried hazard in this project
  // with several boundaries -- it is done ONCE, here.
  const blocks: ExportBlock[] = sortedRanges.map((row) => ({
    start: row.start,
    endExclusive: row.endInclusive + 1,
    dataType: row.dataType as string,
    lineCount: 0,
  }));

  const imageStart = image.origin;
  const imageEndExclusive = image.origin + image.bytes.length;
  for (const block of blocks) {
    if (block.start < imageStart || block.endExclusive > imageEndExclusive) {
      throw new Error(
        `exportAsm: the range ${hex4(block.start)}..${hex4(block.endExclusive - 1)} (inclusive) is not covered by the ` +
          `image at "${imagePath}", which covers ${hex4(imageStart)}..${hex4(imageEndExclusive - 1)} (inclusive). ` +
          `Refusing to export a range whose bytes the image does not contain.`,
      );
    }
  }

  // The label index the renderer's `symbolFor` hook reads. Every name is
  // validated BEFORE it can reach the source text -- REJECT, never sanitise.
  const sortedLabels = [...labels].sort((a, b) => a.address - b.address);
  const labelIndex = new Map<number, string>();
  for (const label of sortedLabels) {
    assertLegalAcmeIdentifier(label.name, `exportAsm: label at ${hex4(label.address)}`);
    labelIndex.set(label.address, label.name);
  }
  const symbolFor = (address: number): string | undefined => labelIndex.get(address);

  const lines: string[] = ["!cpu 6510"];

  // EVERY store label is defined here, in a block BEFORE the first `* =`, not
  // only the ones a substitution happened to use. Measured on ACME 0.97: a
  // symbol defined AFTER its first reference widens the referencing
  // instruction from zeropage to absolute -- `a5 10` becomes `ad 10 00`, three
  // bytes where the original was two -- and it does so with the WARNING
  // `Using oversized addressing mode.` and exit status 0. Everything after it
  // shifts. Defining first is the mitigation; the per-block `*` assertions
  // below are the backstop for a future change that ever drops this block, and
  // the byte-diff is what settles the whole claim.
  for (const label of sortedLabels) {
    lines.push(formatSymbolDefinition(label.name, label.address));
  }

  // Comments indexed by the address they annotate, each address's list left in
  // `listComments()`'s own `id` order.
  const commentsByAddress = new Map<number, CommentRow[]>();
  for (const row of comments) {
    const at = commentsByAddress.get(row.address);
    if (at) at.push(row);
    else commentsByAddress.set(row.address, [row]);
  }
  const placement: CommentPlacement = { byAddress: commentsByAddress, placed: new Set<number>() };

  let unexpressibleCount = 0;
  let dataByteCount = 0;

  for (const block of blocks) {
    const slice = image.bytes.subarray(block.start - imageStart, block.endExclusive - imageStart);
    const content: string[] = [];

    if (block.dataType === CODE_DATA_TYPE) {
      // D-11 is inherited UNCHANGED: `renderLine()` decides operand width and
      // refuses to substitute a symbol into an immediate or zeropage-family
      // operand. Do not widen `RenderOptions` and do not bypass `renderLine()`.
      const instructions = decode(slice, block.start, { end: block.endExclusive });
      for (const instr of instructions) {
        if (!instr.acmeExpressible) unexpressibleCount++;
        // The span is the instruction's FIRST address only, not its whole
        // length: a comment stored against an operand byte belongs to no
        // emitted line, and attaching it to the instruction that happens to
        // contain that byte would move a human's note onto a different address
        // than the one they chose. It stays unplaced and is refused below.
        const emitted = withComments(renderLine(instr, { showSymbols: true, symbolFor }), instr.address, instr.address + 1, placement);
        content.push(...emitted);
        block.lineCount += emitted.length;
      }
    } else {
      // The `dataType` reaching `emitDataLines()` is the store's own string,
      // copied off the row and passed through -- this module never branches on
      // it beyond the code/not-code test above and the `!word` eligibility
      // check inside the emitter.
      for (const dataLine of emitDataLines(slice, block.dataType, block.start)) {
        const emitted = withComments(dataLine.text, dataLine.start, dataLine.endExclusive, placement);
        content.push(...emitted);
        block.lineCount += emitted.length;
      }
      dataByteCount += slice.length;
    }

    // EVERY block goes through `emitBlock()`, code and data alike, so there is
    // exactly one place that brackets a block and no route that emits an
    // unbracketed one.
    lines.push(...emitBlock(block.start, block.endExclusive, content));
  }

  // An annotation this exporter cannot express is REFUSED BY NAME, never
  // dropped from the output while the export reports success. A comment is
  // unplaceable when its address is inside an instruction rather than at its
  // start, or outside every annotated range -- and in both cases the honest
  // answer is that this export does not carry it, said out loud.
  if (placement.placed.size !== comments.length) {
    const unplaced = comments.filter((row) => !placement.placed.has(row.id));
    const first = unplaced[0]!;
    throw new Error(
      `exportAsm: the ${first.commentType} comment at ${hex4(first.address)} has no emitted line to attach to -- that address is inside an ` +
        `instruction rather than at its start, or is not covered by any annotated range. ` +
        `${unplaced.length} of ${comments.length} comment(s) are in this state. Refusing to export while silently dropping them.`,
    );
  }

  // `expectedBytes` is built from the IMAGE, never from `lines`. Gaps between
  // blocks stay `$00`, matching ACME `-f plain`'s measured zero-fill.
  const minStart = blocks[0]!.start;
  const maxEndExclusive = blocks.reduce((acc, b) => Math.max(acc, b.endExclusive), blocks[0]!.endExclusive);
  const expectedBytes = new Uint8Array(maxEndExclusive - minStart);
  for (const block of blocks) {
    expectedBytes.set(image.bytes.subarray(block.start - imageStart, block.endExclusive - imageStart), block.start - minStart);
  }

  return {
    source: `${lines.join("\n")}\n`,
    expectedBytes,
    blocks,
    symbolCount: sortedLabels.length,
    unexpressibleCount,
    dataByteCount,
    commentCount: placement.placed.size,
  };
}
