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
//   - Never restate the eleven auto-name prefixes here. `anno-types.ts:93-99`
//     forbids a second copy of that vocabulary BY NAME, and names the exact
//     failure a short reimplementation causes: a five-prefix copy silently
//     under-counts, which breaks `routine-queue-walker`'s backlog construction
//     while every test keeps passing. This module DOES need the vocabulary --
//     it marks auto-generated names in the emitted source -- and it gets it by
//     IMPORTING `AUTO_NAME_PREFIX_RE` from its one home. A copy made "just to
//     filter" is how the eleventh prefix goes missing in one of two places.
//   - Never emit an enum on anything but an IMMEDIATE operand. Measured on ACME
//     0.97, `sta viccolor_WHITE` with `viccolor_WHITE = $01` encodes as
//     ZEROPAGE -- `85 01`, two bytes where the absolute original was three --
//     so the substitution changes both the bytes and the instruction length. A
//     non-immediate operand is REFUSED by name below, never rendered and hoped
//     for.
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
// SCOPE, STILL DELIBERATELY NARROW: code ranges, the twelve typed data ranges,
// comments, mid-instruction inline labels and immediate-operand enum
// substitution.
import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { openStore, closeStore, listRanges, listLabels, listComments, listProjectEnums, listEnumUsage } from "./anno-store.ts";
import { AnnoCommentError, COMMENT_TYPES, DATA_TYPES, assertCommentText, assertDataType, parseVariantKey } from "./anno-types.ts";
import type { CommentRow, DataType, EnumUsageRow, LabelRow, ProjectEnumRow, RangeRow } from "./anno-types.ts";
import { assertLegalAcmeIdentifier } from "./anno-acme-ident.ts";
// The eleven typed auto-name prefixes, IMPORTED FROM THEIR ONE HOME rather than
// restated. This is the first cross-module PRODUCTION importer of that
// constant; before this the only consumers were `anno-coverage.ts`'s own
// `computeLabelRatio()` and its test file.
//
// WHY THE EXPORTER CARES. `routine-queue-walker`'s SKILL.md reads the typed
// prefixes as DOCUMENTED VOCABULARY (`s_`, `p_`, `b_`, `zpp_`, `zpf_`, `zpa_`,
// `f_`, `a_` at :128-181 and :220-226) and never imports the regex, so the
// coupling between that skill's backlog signal and this repo's definition of
// "auto-generated name" is by convention and would break in SILENCE. Marking
// those definitions in the exported source is what keeps the backlog visible to
// a human reading the generated assembly, which is the one artefact that leaves
// this tree.
//
// WHAT NOT TO DO: do not restate the eleven here, in any form -- not as an
// array, not as a second regex, not as a doc comment listing them.
// `anno-types.ts:93-99` forbids it by name, and `EXPORT-02` names the failure
// mode: a five-prefix copy under-counts silently.
import { AUTO_NAME_PREFIX_RE } from "./anno-coverage.ts";
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
  /** How many STORE LABELS the export carries, header and inline together --
   * i.e. `sortedLabels.length`, one per `anno_label` row in range.
   *
   * THIS DOC USED TO SAY "how many symbol definitions the header carries",
   * AND THAT WAS NOT WHAT IT COUNTED (30-REVIEW WR-01, corrected 2026-08-31).
   * The two readings diverge in BOTH directions: a mid-instruction label is
   * defined inline and skipped by the header loop yet still counted here,
   * and every `enumDefinitionLines` entry IS a header definition yet is not.
   * Reproduced: a store with `start`@$0801 plus `smc_operand`/`smc_alias`
   * both at the mid-instruction address $0802 emits a header carrying exactly
   * ONE definition while this field reported 3 -- a number the CLI prints
   * verbatim to the user as "3 symbol(s)".
   *
   * The header count is now its own field (`headerDefinitionCount` below)
   * rather than this one being redefined, because both numbers have a real
   * consumer and collapsing them into one is what produced the divergence. */
  symbolCount: number;
  /** How many definition lines the HEADER block actually carries -- enum
   * variant definitions plus every store label NOT defined inline. Computed
   * from `headerLines` itself, so it cannot drift from the emitted text the
   * way a separately-maintained count did (30-REVIEW WR-01). */
  headerDefinitionCount: number;
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
  /** How many inline mid-instruction label definitions the source carries --
   * one per store label whose address falls STRICTLY INSIDE a decoded
   * instruction. `midInstructionLabelLine()` is the one place that spelling
   * exists. Equal to the number of labels that were therefore EXCLUDED from the
   * header definition block, because such a label is defined inline and
   * defining it twice is ACME's `Symbol already defined.`
   *
   * COUNTED PER EMITTED DEFINITION, NOT PER ADDRESS (30-REVIEW WR-02,
   * corrected 2026-08-31). It used to be `midInstructionLabelAddresses.size`,
   * a set of ADDRESSES, while the inline loop emits one line per LABEL.
   * `anno_label` is `unique` on `name` only and `setLabel()` refuses only a
   * name already bound to a DIFFERENT address, so two names at one address is
   * a supported store state -- and in it, two inline definitions were emitted
   * and two labels excluded from the header while this field reported 1,
   * contradicting the sentence directly above. */
  midInstructionLabelCount: number;
  /** How many emitted symbol definitions carry an AUTO-GENERATED name, decided
   * by `AUTO_NAME_PREFIX_RE` -- the eleven typed prefixes, read from their one
   * home and never restated here. This is `routine-queue-walker`'s backlog
   * signal, surfaced in the one artefact that leaves this tree. */
  autoNamedSymbolCount: number;
  /** How many instruction operands were rendered through a project enum's
   * variant name instead of a hex literal. Every one of them is an IMMEDIATE
   * operand; any other operand role is refused. */
  enumSubstitutionCount: number;
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
 * `$XXXX` FOR A BLOCK'S EXCLUSIVE END, WHICH IS `hex4()` -- MASKED, NOT PADDED.
 *
 * THIS FUNCTION USED TO DO THE OPPOSITE, AND IT WAS WRONG (30-REVIEW WR-04,
 * corrected 2026-08-31). It padded without masking, so a range ending at
 * `$ffff` produced the end assertion `!if * != $10000`. Its doc justified that
 * by asserting that `hex4()`'s mask "would render that as `$0000` -- an
 * assertion no assembly can ever satisfy, firing on a correct export". That
 * claim was never measured, and it is FALSE in exactly the direction that
 * matters: ACME's `*` is a 16-BIT program counter and WRAPS.
 *
 * MEASURED, real ACME 0.97 "Zem" on this host, 2026-08-31:
 *
 *   !cpu 6510
 *   * = $fffe
 *   !if * != $fffe { !error "origin drifted, expected $fffe" }
 *           !byte $aa, $bb
 *   !if * != $0000 { !error "end drifted, expected $0000" }
 *
 *   -> exit 0, output file written, bytes `aa bb`.
 *
 * The same source with `!if * != $10000` fails: `!error: end drifted` and no
 * output file. So the UNMASKED form is the one that "fires on a correct
 * export", for every range touching the top of memory -- and the failure looks
 * like an exporter bug rather than an arithmetic one.
 *
 * WHY THE ASSUMPTION LOOKED SAFE: ACME's own `-v2` diagnostics DO print the
 * unwrapped extent, `Saving 2 (0x2) bytes (0xfffe - 0x10000 exclusive)`. That
 * is ACME describing a SEGMENT; `*` is a different thing and wraps. Do not
 * reintroduce an unmasked extent on the strength of that line.
 *
 * THE GUARD STILL BITES AT THE TOP OF MEMORY, measured the same way: the same
 * source emitting ONE byte instead of two leaves `*` at `$ffff`, the
 * assertion fires, ACME exits 1 and writes no output file. The mask does not
 * make the top-of-memory assertion vacuous.
 *
 * Kept as a named function rather than folded into `hex4()` so this record has
 * somewhere to live, and so the ONE value in this module that is not an
 * address still reads differently at its call site.
 */
function hexExtent(value: number): string {
  return hex4(value);
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
 * One mid-instruction label definition, in the golden witness's own compact
 * spelling -- no spaces around the `=`, the offset in two hex digits:
 * `f_0900 =*+$01` [`.planning/notes/dxa-ghidra-pivot-evidence/r2000.asm:202`].
 * That witness carries SIX such labels (lines 51, 81, 135, 145, 202 and 205);
 * the ROADMAP note saying four is documentation drift, corrected in
 * `30-RESEARCH.md`.
 *
 * `offset` is `label.address - instr.address`, so it is 1 or 2 for every
 * 6502/6510 instruction -- the value is rendered rather than bounded here
 * because the caller derives it from a decoded instruction's own length and
 * cannot produce anything else.
 */
function midInstructionLabelLine(name: string, offset: number): string {
  return `${name} =*+$${offset.toString(16).padStart(2, "0")}`;
}

/**
 * Below this address a mid-instruction label is REFUSED rather than emitted.
 * See `exportAsm()`'s code-block emitter for the measured reason.
 */
const MID_INSTRUCTION_LABEL_FLOOR = 0x100;

/**
 * The fixed trailing comment that marks an auto-generated symbol name in the
 * emitted source. ONE spelling, in one place: a second wording would make the
 * marker ungreppable for the human reading the generated assembly, which is the
 * only reader it exists for.
 */
const AUTO_NAME_MARKER = "  ; auto-generated name -- still in the annotation backlog";

/**
 * The fixed trailing comment that marks a definition at an address carrying
 * MORE THAN ONE store label (30-REVIEW WR-02). ONE spelling, in one place, for
 * the same reason `AUTO_NAME_MARKER` is: a second wording makes it ungreppable
 * for the only reader it exists for.
 *
 * The full marker is this prefix, the colliding names in `sortedLabels` order,
 * and which of them references actually render through -- so the arbitrary
 * pick `symbolFor()` used to make in silence is stated in the artefact.
 */
const ALIAS_MARKER_PREFIX = "  ; ALIAS: this address also carries ";

/**
 * The largest value an enum variant may carry to be substitutable into an
 * IMMEDIATE operand.
 *
 * Measured on ACME 0.97: `viccolor_WIDE = $0100` then `lda #viccolor_WIDE`
 * is `Error ... : Number does not fit in 8 bits.` at exit 1. The exporter
 * refuses FIRST so the message can name the store row and the enum, rather than
 * a line number in a temp file the caller never sees.
 */
const MAX_IMMEDIATE_VARIANT_VALUE = 0xff;

/**
 * Replaces the `#$XX` immediate literal `renderLine()` produced with `#symbol`.
 *
 * WHY A TARGETED TEXT SUBSTITUTION RATHER THAN A `RenderOptions` WIDENING.
 * D-11 forbids `renderLine()` from substituting a symbol into an immediate
 * operand at all, because of the `#<`/`#>` high/low-byte ambiguity, and that
 * rule is verified against a real assembler in `disasm-roundtrip.test.ts`. It
 * is not relaxed here. What an ENUM adds is a caller-supplied fact the renderer
 * does not have -- that this particular byte is a member of a named vocabulary
 * -- so the substitution happens at this boundary, on this module's own output,
 * for exactly one operand whose width is one byte and therefore cannot change.
 *
 * The literal is located and matched EXACTLY. A rendered line that does not
 * carry the expected literal is a disagreement between this module and the
 * renderer, and it is refused rather than patched over: a `replace()` that
 * silently matched nothing would emit the hex literal while the count claimed a
 * substitution happened.
 *
 * THE SEARCH IS CONFINED TO THE DIRECTIVE HALF OF THE LINE, AND THAT IS THE
 * SECOND HALF OF 30-REVIEW CR-01's FIX (2026-08-31). `renderLine()` emits a
 * trailing `"  ; "` comment for notes, and for an instruction whose
 * `acmeExpressible` is false it emits the whole thing as a `!byte` directive
 * with the mnemonic AND its `#$xx` operand moved INTO that comment
 * (`disasm-renderer.ts`'s `!instr.acmeExpressible` branch). A bare
 * `line.indexOf()` therefore found `#$00` in the COMMENT, rewrote it there,
 * and returned a line whose assembler-visible half still carried the raw
 * byte -- while the caller counted a substitution and the export exited 0.
 * Reproduced against the committed code before this fix, for `$eb`
 * (`sbc #imm`):
 *
 *   !byte $eb, $00  ; sbc #viccolor_BLACK  [illegal opcode | not expressible ...]
 *
 * The caller now refuses an unexpressible opcode outright, so this confinement
 * is defence in depth against the same class of mistake arriving by a
 * different route -- a future renderer that puts a `#$xx` in a comment for any
 * other reason gets the "does not contain the literal" refusal below instead
 * of a silent no-op substitution.
 *
 * EXPORTED FOR TEST REACH ONLY, on the same terms as
 * `assertExportableCommentText()` below: no other module calls it, and the one
 * that would (`anno-cli.ts`) goes through `exportAsm()`. It is exported
 * because the caller now refuses an unexpressible opcode BEFORE reaching here,
 * which makes the confinement above unreachable through `exportAsm()` and
 * therefore untestable at that level -- an untested guard is the thing that
 * lets the next route in.
 */
export function substituteImmediateEnum(line: string, value: number, symbol: string, address: number): string {
  const literal = `#${hex2(value)}`;
  // `"  ; "` is `renderLine()`'s own comment separator, in the one place this
  // module has to know about it. Everything from it onward is prose for a
  // human and is never assembler input; a substitution there reaches nobody.
  const directiveHalf = line.split("  ; ")[0];
  const at = directiveHalf.indexOf(literal);
  if (at < 0) {
    throw new Error(
      `exportAsm: the instruction at ${hex4(address)} carries an enum usage, but the ASSEMBLER-VISIBLE half of its rendered line ` +
        `does not contain the immediate literal ${literal} this module expected to replace. Refusing to emit a line whose ` +
        `substitution silently did nothing (or landed in the trailing comment, where the assembler never reads it).`,
    );
  }
  return `${line.slice(0, at)}#${symbol}${line.slice(at + literal.length)}`;
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

/**
 * Re-checks, at the EXPORT boundary, that a stored range's `dataType` is one
 * the store's own vocabulary defines (30-REVIEW WR-03).
 *
 * The sibling of `assertExportableCommentText()` below, on the same terms and
 * for the same reason: `listRanges()` casts the column with no validator, so
 * this is the last place before that string is interpolated into ACME source
 * text. See the call site in `exportAsm()` for the full record.
 *
 * The store validator's own message is deliberately DISCARDED and replaced,
 * again for `assertExportableCommentText()`'s reason: `assertDataType()`
 * interpolates the offending value, and an exporter error that quotes a
 * file's contents back is a content-disclosure oracle. What survives is the
 * ADDRESS RANGE and the valid list -- facts about the row and about this
 * module's own vocabulary, never a byte read off disk.
 *
 * EXPORTED FOR TEST REACH ONLY, on the same terms as
 * `assertExportableCommentText()`: the state it guards against is reachable
 * only through a store file edited outside `anno-store.ts`, and
 * `anno-store.ts` is the ONE module in this repo permitted to name
 * `node:sqlite` -- so a test cannot manufacture the row and can only drive the
 * predicate. An unreachable-through-the-type guard with no test is how the
 * next such column goes unchecked.
 */
export function assertDataTypeForExport(row: { start: number; endInclusive: number; dataType: unknown }): DataType {
  try {
    return assertDataType(row.dataType);
  } catch {
    throw new Error(
      `exportAsm: the range ${hex4(row.start)}..${hex4(row.endInclusive)} (inclusive) carries a data type that is not one of the ` +
        `${DATA_TYPES.length} the store defines (${DATA_TYPES.join(", ")}) -- refusing to guess what it meant. This module copies a ` +
        `range's data type VERBATIM into the emitted source's block comment, so an unvalidated value reaches ACME as text: one ` +
        `containing a line break would put everything after it at column zero, as assembler input rather than as a comment. ` +
        `The offending value is deliberately NOT quoted here -- an exporter error that echoes a file's contents is a ` +
        `content-disclosure oracle.`,
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
  let projectEnums: ProjectEnumRow[];
  let enumUsage: EnumUsageRow[];
  try {
    ranges = listRanges(handle);
    labels = listLabels(handle);
    comments = listComments(handle);
    projectEnums = listProjectEnums(handle);
    enumUsage = listEnumUsage(handle);
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
    // THE STORE'S `dataType` IS RE-CHECKED AT THIS BOUNDARY (30-REVIEW WR-03,
    // fixed 2026-08-31), for exactly the reason `withComments()` re-checks
    // `commentType` a few functions up: "Unreachable through the type, and
    // reachable through a store file somebody edited. Refusing beats
    // guessing." That reasoning applies here and had not been applied.
    //
    // `listRanges()` casts `row.data_type as DataType` with no validator call
    // (`anno-store.ts`), so a store whose `anno_range.data_type` column was
    // edited on disk carried an ARBITRARY string into `emitDataLines()`, which
    // interpolates it verbatim into the emitted block comment. A value
    // containing a line break would put everything after it into the ACME
    // source at COLUMN ZERO, as assembler input rather than as a comment --
    // the same mechanism `assertExportableCommentText()` refuses for comment
    // text, arriving through a column nobody had checked.
    //
    // The block-end `!if` assertion would catch the resulting drift at
    // ASSEMBLY time, but the `anno export-asm` CLI verb assembles nothing: it
    // would write the corrupted file and exit 0. This is the last boundary
    // before those bytes become assembler input, so it asks the question here.
    //
    // RE-CHECKS rather than RE-DEFINES: the predicate is `assertDataType()`'s,
    // called here, never a second list of the twelve types that could drift
    // from it.
    dataType: assertDataTypeForExport(row) as string,
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
  /** Every address carrying MORE THAN ONE store label, with all their names in
   * `sortedLabels` order. See the loop below for why this is recorded rather
   * than refused. */
  const aliasedAddresses = new Map<number, string[]>();
  for (const label of sortedLabels) {
    assertLegalAcmeIdentifier(label.name, `exportAsm: label at ${hex4(label.address)}`);
    // TWO NAMES AT ONE ADDRESS IS RECORDED IN THE EMITTED SOURCE, NOT RESOLVED
    // IN SILENCE (30-REVIEW WR-02, second half, fixed 2026-08-31).
    //
    // `labelIndex` is a `Map<number, string>` while `anno_label` is `unique`
    // on NAME only -- `setLabel()` refuses only a name already bound to a
    // DIFFERENT address -- so two names at one address is a SUPPORTED store
    // state (an alias). In it, this `set()` silently overwrote the first and
    // `symbolFor()` returned whichever name sorted last. Reproduced: with
    // `smc_operand` and `smc_alias` both at $0802, the emitted `inc`
    // referenced `smc_alias` with no diagnostic anywhere.
    //
    // NOT REFUSED, DELIBERATELY, and this is the one place in this module that
    // records rather than refuses. Every other refusal here is for something
    // the exporter CANNOT express; an alias it CAN -- both definitions go into
    // the header (or inline), ACME accepts two symbols with one value, and the
    // bytes are unaffected. The only thing that was wrong is that the arbitrary
    // pick for REFERENCES was invisible. Refusing instead would delete a
    // supported store state to fix a diagnostic problem.
    //
    // FIRST NAME WINS, not last: `sortedLabels` is ascending by address and
    // otherwise in `listLabels()` order, so keeping the first makes the pick
    // stable rather than an artefact of a sort that never promised a
    // tiebreak. The comment emitted with the definitions names every
    // candidate, so a human reading the source can see what was chosen and
    // what was not.
    const existing = labelIndex.get(label.address);
    if (existing === undefined) {
      labelIndex.set(label.address, label.name);
    } else {
      const names = aliasedAddresses.get(label.address);
      if (names) names.push(label.name);
      else aliasedAddresses.set(label.address, [existing, label.name]);
    }
  }
  const symbolFor = (address: number): string | undefined => labelIndex.get(address);

  /** EVERY store label's NAME, whether it ends up defined in the header or
   * inline. `labelIndex` cannot serve this: it is keyed by address and holds
   * only the first name at each, so an ALIASED label would be invisible to a
   * collision check reading it. ACME has ONE symbol namespace, so an enum
   * variant symbol colliding with any of these is `Symbol already defined.`
   * (30-REVIEW WR-10). */
  const labelSymbolNames = new Set(sortedLabels.map((label) => label.name));

  // Comments indexed by the address they annotate, each address's list left in
  // `listComments()`'s own `id` order.
  const commentsByAddress = new Map<number, CommentRow[]>();
  for (const row of comments) {
    const at = commentsByAddress.get(row.address);
    if (at) at.push(row);
    else commentsByAddress.set(row.address, [row]);
  }
  const placement: CommentPlacement = { byAddress: commentsByAddress, placed: new Set<number>() };

  // Enum usages indexed by the address they annotate. `listEnumUsage()` already
  // resolves the enum's NAME through a join on `anno_enum.id`, so this module
  // never holds a second on-disk copy of it; the row set is turned into an
  // address lookup here and the enum's own variants are joined on by name from
  // `listProjectEnums()`.
  const enumsByName = new Map<string, ProjectEnumRow>();
  for (const row of projectEnums) enumsByName.set(row.name, row);
  const usageByAddress = new Map<number, EnumUsageRow>();
  for (const row of enumUsage) usageByAddress.set(row.address, row);
  const appliedEnumUsage = new Set<number>();
  /** `<enumName>_<VARIANT> = $XX` definition lines, in first-emitted order.
   * They join the header block for the same reason label definitions do. */
  const enumDefinitionLines: string[] = [];
  const definedEnumSymbols = new Set<string>();

  let unexpressibleCount = 0;
  let dataByteCount = 0;

  // AUTO-GENERATED NAMES ARE MARKED, not filtered. Every store label reaches
  // the source either way; the marker is the backlog signal, carried into the
  // one artefact that leaves this tree. The predicate is
  // `AUTO_NAME_PREFIX_RE`'s, imported -- never a second copy. It is applied at
  // BOTH definition sites, header and inline, so an auto-named self-modifying
  // code operand is as visible in the backlog as any other.
  let autoNamedSymbolCount = 0;
  const markIfAutoNamed = (name: string, line: string): string => {
    if (!AUTO_NAME_PREFIX_RE.test(name)) return line;
    autoNamedSymbolCount++;
    return `${line}${AUTO_NAME_MARKER}`;
  };

  // THE ALIAS PICK IS MADE VISIBLE IN THE SOURCE (30-REVIEW WR-02, second
  // half). Two store labels at one address are BOTH defined -- ACME accepts
  // two symbols with one value and the bytes are unaffected -- but a
  // REFERENCE to that address can render through only one of them. Which one
  // was previously invisible. Marking both definitions with the same fixed
  // wording means the human reading the generated assembly can see the
  // collision and the choice, from either definition line, without having to
  // reconstruct the exporter's sort order. Applied at BOTH definition sites,
  // header and inline, for the reason `markIfAutoNamed()` is: an aliased
  // self-modifying-code operand is exactly the shape this was reproduced on.
  const markIfAliased = (address: number, line: string): string => {
    const names = aliasedAddresses.get(address);
    if (names === undefined) return line;
    return `${line}${ALIAS_MARKER_PREFIX}${names.join(", ")} -- references render through ${labelIndex.get(address)}`;
  };

  // The addresses of every label emitted INLINE as `name =*+$NN`. They are
  // collected during block emission and read afterwards by the header, which
  // is why the header is built AFTER this loop even though it is emitted
  // BEFORE it: a label defined inline must not ALSO be defined in the header,
  // or ACME refuses the whole source with `Symbol already defined.`
  const midInstructionLabelAddresses = new Set<number>();

  // ONE PER EMITTED INLINE DEFINITION, not one per address (30-REVIEW WR-02).
  // The set above answers the HEADER's question ("is this address defined
  // inline already?"), which is per-address by nature. This counter answers
  // the RESULT's question ("how many inline definitions does the source
  // carry?"), which is per-label -- and two labels at one address is a
  // supported store state, so the two questions have different answers.
  // Incremented beside the `content.push()` that emits the line it counts,
  // so it cannot drift from the emitted text.
  let midInstructionLabelCount = 0;

  const blockLines: string[] = [];

  for (const block of blocks) {
    const slice = image.bytes.subarray(block.start - imageStart, block.endExclusive - imageStart);
    const content: string[] = [];

    if (block.dataType === CODE_DATA_TYPE) {
      // D-11 is inherited UNCHANGED: `renderLine()` decides operand width and
      // refuses to substitute a symbol into an immediate or zeropage-family
      // operand. Do not widen `RenderOptions` and do not bypass `renderLine()`.
      // `end` IS INCLUSIVE, SO IT IS HANDED AN INCLUSIVE VALUE (30-REVIEW
      // WR-07, corrected 2026-08-31). This used to pass `block.endExclusive`.
      // `DecodeOptions.end` is compared with `if (end !== undefined && address
      // > end) break` and documented as "an instruction starting past `end` is
      // dropped ... an instruction starting AT OR BEFORE `end` is emitted in
      // full" -- an INCLUSIVE bound. Passing the exclusive end therefore
      // permitted one instruction more than intended.
      //
      // It was INERT, and that is exactly why it needed fixing rather than
      // leaving: `slice` is exactly the block's bytes and `decode()`'s own
      // `offset < bytes.length` loop condition bounds it first, so the `end`
      // guard was doing nothing at all. The next maintainer who passes a WIDER
      // slice -- to give `decode()` lookahead across a block boundary, say --
      // inherits a silent one-instruction overrun with no test to catch it.
      //
      // THE SLICE IS THE AUTHORITY AND `end` IS THE BELT-AND-BRACES SECOND
      // BOUND, stated here so the two are not read as one mechanism. Both now
      // describe the same last byte, `block.endExclusive - 1`.
      const instructions = decode(slice, block.start, { end: block.endExclusive - 1 });
      for (const instr of instructions) {
        if (!instr.acmeExpressible) unexpressibleCount++;

        // A store label whose address falls STRICTLY INSIDE this instruction
        // names one of its operand bytes -- a self-modifying-code write target.
        // It is emitted as `name =*+$NN` on its own line IMMEDIATELY BEFORE the
        // instruction that owns the byte, and NEVER after it.
        //
        // PLACEMENT IS LOAD-BEARING AND WAS MEASURED IN BOTH DIRECTIONS ON ACME
        // 0.97. With `smc_operand =*+$01` above `lda #$00` at $0801, a later
        // `sta smc_operand` assembles as `8d 02 08` -- $0802, the `lda`'s own
        // operand byte. Move the same line BELOW its host and the symbol takes
        // the value of the NEXT instruction's operand ($0804), producing
        // `8d 04 08`. ACME exits 0 in BOTH cases and prints nothing to
        // distinguish them: only a byte-diff tells the two apart, which is why
        // `anno-export-asm.test.ts` carries that move as a negative control
        // rather than trusting an exit status.
        for (const label of sortedLabels) {
          if (label.address <= instr.address || label.address >= instr.address + instr.bytes.length) continue;

          // A mid-instruction label below $0100 is REFUSED. This is the ONE
          // hole `disasm-renderer.ts`'s `+2` width force does not already close
          // FOR THIS MODULE, in the precise sense that it is the one place this
          // module has no mitigation of its own and depends entirely on the
          // renderer's.
          //
          // For an ORDINARY label this module owns the mitigation: it writes
          // the header definition with TWO hex digits below $0100 (see
          // `formatSymbolDefinition()`), which is what makes ACME encode the
          // reference at the original width. A `=*+$NN` label cannot use it --
          // it is defined INLINE by construction, so its width is decided by
          // whatever the referencing instruction's own rendering forced.
          //
          // MEASURED, ACME 0.97, a label at $0081 named by an earlier
          // `lda #$00` at $0080:
          //   `inc+2 smc_operand`  -> `ee 81 00`, EXIT 0, no diagnostic  (correct)
          //   `inc   smc_operand`  -> `e6 81`,    EXIT 0, NO DIAGNOSTIC AT ALL
          // Two bytes where the original was three, silently, with the whole
          // rest of the block shifted. (The same reference placed BEFORE the
          // definition widens instead, and does at least emit
          // `Warning (Zone <untitled>): Using oversized addressing mode.` --
          // still exit 0.) The only thing standing between this exporter and
          // that shift is a `disasm-renderer.ts` invariant this module does not
          // own, so the case is refused BY NAME rather than emitted and hoped
          // for.
          if (label.address < MID_INSTRUCTION_LABEL_FLOOR) {
            throw new Error(
              `exportAsm: label ${JSON.stringify(label.name)} names address ${hex4(label.address)} inside an instruction, and a ` +
                `mid-instruction label below ${hex4(MID_INSTRUCTION_LABEL_FLOOR)} cannot be emitted -- it must be defined INLINE, ` +
                `relative to the program counter at its host instruction, which forgoes this exporter's own two-hex-digit ` +
                `header-definition width rule, and a reference to it ` +
                `then encodes at whatever width the renderer forced. Measured on ACME 0.97: the unforced form shrinks a three-byte ` +
                `absolute instruction to a two-byte zeropage one at exit 0 with NO diagnostic, shifting every byte after it. ` +
                `REFUSED rather than emitted.`,
            );
          }

          midInstructionLabelAddresses.add(label.address);
          content.push(markIfAliased(label.address, markIfAutoNamed(label.name, midInstructionLabelLine(label.name, label.address - instr.address))));
          midInstructionLabelCount++;
          block.lineCount++;
        }

        let rendered = renderLine(instr, { showSymbols: true, symbolFor });

        // ENUM SUBSTITUTION, IMMEDIATE OPERAND ONLY.
        const usage = usageByAddress.get(instr.address);
        if (usage !== undefined) {
          const role = instr.operand?.role;
          if (role !== "immediate") {
            throw new Error(
              `exportAsm: enum ${JSON.stringify(usage.enumName)} is bound to ${hex4(usage.address)}, whose operand role is ` +
                `${JSON.stringify(role ?? "none")} -- an enum renders on the IMMEDIATE operand only. Emitting it on any other operand ` +
                `changes both the bytes and the instruction length while ACME exits 0 (measured on ACME 0.97: \`sta\` on a symbol below ` +
                `$0100 encodes as zeropage, 2 bytes instead of 3). REFUSED rather than rendered.`,
            );
          }

          // ROLE IS NOT ENOUGH: THE OPERAND MUST ALSO BE ASSEMBLER-VISIBLE
          // (30-REVIEW CR-02, fixed 2026-08-31). `decode()` assigns
          // `role: "immediate"` from the ADDRESSING MODE alone, independently
          // of `acmeExpressible`. Six opcodes in `disasm-opcodes.ts` are
          // `mode: "immediate"` AND `acmeExpressible: false` -- $2b (`anc`),
          // $82/$89/$c2/$e2 (`nop #imm`) and $eb (`sbc #imm`). For those,
          // `renderLine()` emits a `!byte` DIRECTIVE and moves the mnemonic
          // and its `#$xx` operand into the trailing comment
          // (`disasm-renderer.ts`'s `!instr.acmeExpressible` branch), so the
          // substitution below reached the COMMENT and never the assembler:
          // the operand stayed a raw byte in the `!byte` list, an unreferenced
          // `viccolor_BLACK = $00` was emitted into the header, the usage was
          // counted as applied, and the CLI printed "1 enum substitution(s)"
          // and exited 0. The bytes stay correct, so the byte-diff oracle
          // cannot see it either -- a round-trip test goes green on it.
          //
          // Reproduced against the committed code, store: one `code` range
          // $0801..$0803 over `eb 00 60`, enum `viccolor { $00: BLACK }`
          // applied at $0801 through the ordinary public `applyEnumUsage()`
          // route (which performs no opcode validation, so this needs no
          // hand-edited store):
          //
          //   !byte $eb, $00  ; sbc #viccolor_BLACK  [illegal opcode | ...]
          //   === enumSubstitutionCount: 1
          //
          // This is D-30's "an annotation the exporter cannot express is
          // REFUSED loudly and by name, never silently dropped while the
          // export reports success" exactly inverted. It is refused now.
          if (!instr.acmeExpressible) {
            throw new Error(
              `exportAsm: enum ${JSON.stringify(usage.enumName)} is bound to the immediate operand at ${hex4(usage.address)}, but that ` +
                `opcode (${hex2(instr.bytes[0])}, ${instr.mnemonic}) is NOT EXPRESSIBLE in ACME's !cpu 6510 dialect. An unexpressible ` +
                `opcode goes out as a \`!byte\` directive with its mnemonic and operand in a TRAILING COMMENT, so an enum symbol ` +
                `substituted there would reach the comment and never the assembler -- the operand would stay a raw byte while this ` +
                `export reported the substitution as applied. REFUSED rather than counted as applied.`,
            );
          }

          const project = enumsByName.get(usage.enumName);
          if (project === undefined) {
            // Unreachable through `applyEnumUsage()`, which resolves the enum
            // inside its own transaction, and reachable through a store file
            // somebody edited. Refusing beats emitting an operand with no
            // vocabulary behind it.
            throw new Error(
              `exportAsm: the enum usage at ${hex4(usage.address)} names enum ${JSON.stringify(usage.enumName)}, which the store holds ` +
                `no definition for. Refusing to emit an operand whose vocabulary is missing.`,
            );
          }

          // EVERY variant of the enum is checked, not only the one this operand
          // matched. An enum carrying a variant above $ff is not a BYTE
          // vocabulary, and binding it to a byte operand is a modelling error
          // whose only symptom would otherwise be a variant that silently never
          // renders. Refusing here names the enum and the variant; ACME's own
          // refusal for the same shape is `Number does not fit in 8 bits.` at
          // exit 1, and names a line in a temp file instead.
          let matched: string | undefined;
          for (const [key, variantName] of Object.entries(project.variants)) {
            const value = parseVariantKey(key);
            if (value > MAX_IMMEDIATE_VARIANT_VALUE) {
              throw new Error(
                `exportAsm: enum ${JSON.stringify(usage.enumName)} is bound to the immediate operand at ${hex4(usage.address)}, but its ` +
                  `variant ${JSON.stringify(variantName)} has the value ${value}, above ` +
                  `${MAX_IMMEDIATE_VARIANT_VALUE} -- an immediate operand is ONE byte, so this enum is not a byte vocabulary. ` +
                  `Real ACME refuses the same shape with "Number does not fit in 8 bits." and exit 1; this refusal happens first so it ` +
                  `can name the enum and the variant rather than a temp-file line number.`,
              );
            }
            if (value === instr.operand!.value) matched = variantName;
          }

          if (matched === undefined) {
            throw new Error(
              `exportAsm: enum ${JSON.stringify(usage.enumName)} is bound to the immediate operand at ${hex4(usage.address)}, whose ` +
                `value is ${hex2(instr.operand!.value)}, and the enum has no variant for that value. Refusing to emit the hex literal ` +
                `while reporting an enum substitution that did not happen.`,
            );
          }

          const symbol = `${usage.enumName}_${matched}`;
          // REJECT, never sanitise -- the same contract every other name this
          // module emits passes through, applied to the COMPOSED name because
          // that is what actually reaches the ACME source.
          assertLegalAcmeIdentifier(symbol, `exportAsm: enum variant symbol for ${hex4(usage.address)}`);

          // THE COLLISION THE COMMENT BELOW NAMES IS NOW CHECKED FOR
          // (30-REVIEW WR-10, fixed 2026-08-31). That comment identified the
          // hazard exactly -- "every extra emitted symbol is one more chance to
          // collide with a label name and turn a correct export into ACME's
          // `Symbol already defined.`" -- and then did not look.
          // `definedEnumSymbols` dedupes enum symbols against EACH OTHER but
          // never against the store's labels.
          //
          // Since the `anno export-asm` CLI verb runs no assembler, the
          // collision produced a file that exited 0 here and failed wherever
          // the user actually assembled it, with no pointer back to the store
          // row that caused it. Refusing here names BOTH the enum and the
          // label, which is what makes it fixable.
          //
          // Checked against `labelSymbolNames` -- every store label's name,
          // whether it ends up defined in the header or inline -- because ACME
          // has ONE symbol namespace and an inline `=*+$NN` definition
          // collides exactly as a header one does.
          if (labelSymbolNames.has(symbol)) {
            throw new Error(
              `exportAsm: the enum variant symbol ${JSON.stringify(symbol)} (enum ${JSON.stringify(usage.enumName)}, variant ` +
                `${JSON.stringify(matched)}, bound at ${hex4(usage.address)}) is ALSO the name of a store label. ACME has one symbol ` +
                `namespace, so emitting both definitions is \`Symbol already defined.\` and exit 1 -- and this verb assembles ` +
                `nothing, so without this refusal the export would exit 0 here and fail wherever you assembled it, with no pointer ` +
                `back to the rows that caused it. REFUSED -- rename the label or the enum variant.`,
            );
          }

          // ONLY THE MATCHED VARIANT IS DEFINED, not the whole vocabulary. A
          // definition the source never references is clutter a human reader
          // has to discount, and every extra emitted symbol is one more chance
          // to collide with a label name and turn a correct export into ACME's
          // `Symbol already defined.`
          if (!definedEnumSymbols.has(symbol)) {
            definedEnumSymbols.add(symbol);
            enumDefinitionLines.push(formatSymbolDefinition(symbol, instr.operand!.value));
          }
          rendered = substituteImmediateEnum(rendered, instr.operand!.value, symbol, instr.address);
          appliedEnumUsage.add(usage.id);
        }

        // The span is the instruction's FIRST address only, not its whole
        // length: a comment stored against an operand byte belongs to no
        // emitted line, and attaching it to the instruction that happens to
        // contain that byte would move a human's note onto a different address
        // than the one they chose. It stays unplaced and is refused below.
        const emitted = withComments(rendered, instr.address, instr.address + 1, placement);
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
    blockLines.push(...emitBlock(block.start, block.endExclusive, content));
  }

  // EVERY store label is defined here, in a block BEFORE the first `* =`, not
  // only the ones a substitution happened to use -- EXCEPT the mid-instruction
  // ones, which the loop above already defined inline and which ACME would
  // refuse as `Symbol already defined.` if they appeared twice.
  //
  // Measured on ACME 0.97: a symbol defined AFTER its first reference widens
  // the referencing instruction from zeropage to absolute -- `a5 10` becomes
  // `ad 10 00`, three bytes where the original was two -- and it does so with
  // the WARNING `Using oversized addressing mode.` and exit status 0.
  // Everything after it shifts. Defining first is the mitigation; the per-block
  // `*` assertions are the backstop for a future change that ever drops this
  // block, and the byte-diff is what settles the whole claim.
  //
  // THIS BLOCK IS BUILT AFTER THE BLOCK LOOP AND EMITTED BEFORE IT. Which
  // labels are defined inline is only knowable once the code blocks have been
  // decoded, and the header must not restate those; the assembled order below
  // is what the source actually carries.
  const headerLines: string[] = [...enumDefinitionLines];
  for (const label of sortedLabels) {
    if (midInstructionLabelAddresses.has(label.address)) continue;
    headerLines.push(markIfAliased(label.address, markIfAutoNamed(label.name, formatSymbolDefinition(label.name, label.address))));
  }

  // An enum usage this export never reached is REFUSED BY NAME, for the reason
  // an unplaceable comment is: its address is inside an instruction rather than
  // at its start, or is not covered by any CODE range, and in both cases the
  // honest answer is that this export does not carry it, said out loud.
  if (appliedEnumUsage.size !== enumUsage.length) {
    const unapplied = enumUsage.filter((row) => !appliedEnumUsage.has(row.id));
    const first = unapplied[0]!;
    throw new Error(
      `exportAsm: the enum usage at ${hex4(first.address)} (enum ${JSON.stringify(first.enumName)}) has no decoded instruction to ` +
        `attach to -- that address is inside an instruction rather than at its start, or is not covered by any \`code\` range. ` +
        `${unapplied.length} of ${enumUsage.length} enum usage(s) are in this state. Refusing to export while silently dropping them.`,
    );
  }

  const lines: string[] = ["!cpu 6510", ...headerLines, ...blockLines];

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
    headerDefinitionCount: headerLines.length,
    unexpressibleCount,
    dataByteCount,
    commentCount: placement.placed.size,
    midInstructionLabelCount,
    autoNamedSymbolCount,
    enumSubstitutionCount: appliedEnumUsage.size,
  };
}
