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
//   - Never compare a `dataType` string in this module. `block-class.ts` is the
//     one place in this tree allowed to interpret that column; here it is
//     copied VERBATIM onto the emitted block and read by nobody.
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
// SCOPE, DELIBERATELY NARROW: code ranges only. There is no typed-data emitter,
// no enum substitution, no mid-instruction `=*+$01` label insertion and no
// comment emission here. Those arrive in later plans of this phase; the tracer
// this module belongs to proves the PATH, not the breadth.
import { readFileSync } from "node:fs";
import { extname } from "node:path";

import { openStore, closeStore, listRanges, listLabels } from "./anno-store.ts";
import type { LabelRow, RangeRow } from "./anno-types.ts";
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
  /** How many content lines the block emitted, not counting its `* =` origin
   * line. */
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
}

/** How many raw bytes go on one `!byte` line for a non-code block. */
const BYTES_PER_DATA_LINE = 8;

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
function symbolDefinition(name: string, address: number): string {
  const digits = address < 0x100 ? 2 : 4;
  return `${name} = $${address.toString(16).toUpperCase().padStart(digits, "0")}`;
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
  try {
    ranges = listRanges(handle);
    labels = listLabels(handle);
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
  // bytes where the original was two -- and it does so with a WARNING and exit
  // status 0. Everything after it shifts. Defining first is the mitigation;
  // the byte-diff is what would catch it if this block were ever dropped.
  for (const label of sortedLabels) {
    lines.push(symbolDefinition(label.name, label.address));
  }

  let unexpressibleCount = 0;

  for (const block of blocks) {
    lines.push(`* = ${hex4(block.start)}`);
    const slice = image.bytes.subarray(block.start - imageStart, block.endExclusive - imageStart);

    if (block.dataType === CODE_DATA_TYPE) {
      // D-11 is inherited UNCHANGED: `renderLine()` decides operand width and
      // refuses to substitute a symbol into an immediate or zeropage-family
      // operand. Do not widen `RenderOptions` and do not bypass `renderLine()`.
      const instructions = decode(slice, block.start, { end: block.endExclusive });
      for (const instr of instructions) {
        if (!instr.acmeExpressible) unexpressibleCount++;
        lines.push(renderLine(instr, { showSymbols: true, symbolFor }));
        block.lineCount++;
      }
      continue;
    }

    // Every non-code block goes out as raw `!byte` directives in this plan.
    // The typed emitter (word, address, petscii, screencode, the four split
    // layouts) arrives in a later plan; emitting bytes is correct in the
    // meantime because it reproduces the image exactly, which is the only
    // property the byte-diff measures.
    for (let offset = 0; offset < slice.length; offset += BYTES_PER_DATA_LINE) {
      const chunk = slice.subarray(offset, Math.min(offset + BYTES_PER_DATA_LINE, slice.length));
      lines.push(`${INDENT}!byte ${[...chunk].map(hex2).join(", ")}`);
      block.lineCount++;
    }
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
  };
}
