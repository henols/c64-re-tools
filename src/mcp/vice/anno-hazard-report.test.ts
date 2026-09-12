#!/usr/bin/env node
// anno-hazard-report.test.ts
//
// HERMETIC except for reading committed fixture images and this module's own
// (and `anno-coverage.ts`'s) source text off disk -- no store, no VICE, no
// network.
//
// Behaviors covered, grouped by the stable name prefixes the plan declares:
//
//   hazard class-1:  the imported indexed-dispatch scanner, mapped onto this
//                     module's finding shape -- stack-return dispatch,
//                     indirect jump through a vector, a proven split table,
//                     an advisory decline, mismatched index registers, and
//                     the scanner's own truncation flag propagating through
//   hazard reuse:    the exact-count call-site pin (criterion 3)
//   hazard class-3:  VIC-II hardware alignment -- constant-write-fact
//                     recovery, the character-set base derived through the
//                     imported graphics module, the missing-register
//                     undecided case, the sprite-pointer literal/computed
//                     forms, and the two committed negative controls
//   hazard class-2:  the self-modifying-code detector -- opcode-byte hits,
//                     operand-byte hits, read-modify-write instructions,
//                     non-findings (hardware register / zp scratch / outside
//                     the image), the committed negative control, and the
//                     indirect-indexed miss named as a limit
//   hazard shape:    no boolean field but `truncated`, no banned field name,
//                     de-duplication and survival on the (class, anchor,
//                     mechanism) triple, empty-input safety, no-signal never
//                     read as clean
//   hazard order:    determinism and ascending-by-anchor ordering
//   hazard read-only: a structural source-text assertion

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHazardReport,
  HAZARD_CLASSES,
  HAZARD_DETECTION_STRENGTHS,
  HAZARD_LIMITS,
  type HazardReport,
} from "./anno-hazard-report.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, "anno-hazard-report.ts");

const SMC_PRG_PATH = join(HERE, "fixtures", "export-asm", "smc.prg");
const TRACER_PRG_PATH = join(HERE, "fixtures", "dxa", "tracer.prg");
const HAZARD_SUBJECT_PRG_PATH = join(HERE, "fixtures", "hazard-subject", "hazard-subject.prg");
const COVERAGE_MODULE_PATH = join(HERE, "anno-coverage.ts");
const CHARSET_PHANTOM_PRG_PATH = join(HERE, "fixtures", "ghidra", "charset-phantom.prg");
const BANK_PRG_PATH = join(HERE, "fixtures", "ghidra", "bank.prg");

/** A committed `.prg`'s bytes and load address, split the same way every
 * caller in this tree splits a loaded image: the first two bytes are the
 * little-endian load address, and are never passed to `decode()` as part of
 * the payload. */
function loadPrg(path: string): { bytes: Uint8Array; origin: number } {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  return { bytes: new Uint8Array(raw.subarray(2)), origin };
}

// ---------------------------------------------------------------------------
// hazard class-1: the imported indexed-dispatch scanner
// ---------------------------------------------------------------------------

test("hazard class-1: a stack-return (RTS-trick) dispatch is proven on the committed hazard-subject fixture and produces mechanism stack-return-dispatch", () => {
  const { bytes, origin } = loadPrg(HAZARD_SUBJECT_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  const dispatchFindings = report.findings.filter((f) => f.hazardClass === "indexed-dispatch" && f.mechanism === "stack-return-dispatch");
  assert.ok(dispatchFindings.length >= 1, "the committed hazard-subject fixture must produce at least one stack-return-dispatch finding");
  for (const f of dispatchFindings) {
    assert.notEqual(f.blockedAddress, null, "a stack-return-dispatch finding must name a blocked table base");
    assert.notEqual(f.blockedAddress, f.anchorAddress, "the blocked address must be the table base, never the dispatching instruction's own address");
  }
});

test("hazard class-1: an indirect jump through a zero-page vector produces mechanism indirect-jump-through-vector, blocked at the vector address", () => {
  // jmp ($00fb) -- pointer $fb is a zero-page vector, outside this tiny image.
  const bytes = new Uint8Array([0x6c, 0xfb, 0x00]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  const finding = report.findings.find((f) => f.hazardClass === "indexed-dispatch" && f.mechanism === "indirect-jump-through-vector");
  assert.ok(finding, "an indirect jump must produce an indirect-jump-through-vector finding");
  assert.equal(finding!.anchorAddress, 0x0800, "the anchor is the jmp instruction itself");
  assert.equal(finding!.blockedAddress, 0x00fb, "the blocked address is the vector location the jump reads its target from");
});

test("hazard class-1: a proven split hi/lo address-table pairing gated by a zero-page-vector jump produces mechanism split-address-table, blocked at the table base -- never the dispatching instruction", () => {
  // ldx #0 ; lda $0810,x ; sta $fc ; lda $0811,x ; sta $fb ; jmp ($00fb)
  // Table at $0810 (hi byte)/$0811 (lo byte) encodes target $0812 (a nop).
  const bytes = new Uint8Array([
    0xa2, 0x00, // 0800 ldx #0
    0xbd, 0x10, 0x08, // 0802 lda $0810,x
    0x85, 0xfc, // 0805 sta $fc
    0xbd, 0x11, 0x08, // 0807 lda $0811,x
    0x85, 0xfb, // 080a sta $fb
    0x6c, 0xfb, 0x00, // 080c jmp ($00fb)
    0xea, // 080f nop (padding)
    0x08, // 0810 tbl_hi = HI(target $0812)
    0x12, // 0811 tbl_lo = LO(target $0812)
    0xea, // 0812 target: nop
  ]);
  const origin = 0x0800;
  const report = buildHazardReport({ bytes, origin });
  const splitFindings = report.findings.filter((f) => f.hazardClass === "indexed-dispatch" && f.mechanism === "split-address-table");
  assert.equal(splitFindings.length, 1, "exactly one proven split-address-table finding must be produced");
  assert.equal(splitFindings[0]!.anchorAddress, 0x0802, "the anchor is the first indexed load, the dispatching instruction");
  assert.equal(splitFindings[0]!.blockedAddress, 0x0810, "the blocked address is the table base ($0810), never the dispatching instruction's own address ($0802)");
});

test("hazard class-1: an advisory, ungated split-table pairing (mismatched index registers) produces NO entry in findings, and appears verbatim in unprovenDispatchCandidates", () => {
  // ldx #0 ; lda $080d,x ; pha ; ldy #0 ; lda $080e,y ; pha ; rts
  // Structurally the stack-return shape, but X on one load and Y on the
  // other: class 4 declines (mismatched registers), and class 3 cannot
  // resolve an orientation either -- purely advisory.
  const bytes = new Uint8Array([
    0xa2, 0x00, // 0800 ldx #0
    0xbd, 0x0d, 0x08, // 0802 lda $080d,x
    0x48, // 0805 pha
    0xa0, 0x00, // 0806 ldy #0
    0xb9, 0x0e, 0x08, // 0808 lda $080e,y
    0x48, // 080b pha
    0x60, // 080c rts
    0x00, // 080d tbl_hi (arbitrary; advisory candidates carry no targets)
    0x00, // 080e tbl_lo
    0xea, // 080f trailing pad -- the scanner's own inImage() needs room for a
    // full 2-byte word read at $080e, i.e. $080e+1 < effectiveEnd
  ]);
  const origin = 0x0800;
  const report = buildHazardReport({ bytes, origin });
  const dispatchFindings = report.findings.filter((f) => f.hazardClass === "indexed-dispatch");
  assert.deepEqual(dispatchFindings, [], "a mismatched-register pairing must produce no proven class-1 finding");
  assert.ok(report.unprovenDispatchCandidates.length >= 1, "the mismatched pairing must appear as an unproven candidate");
  for (const candidate of report.unprovenDispatchCandidates) {
    assert.equal(candidate.orientationResolved, false, "an advisory candidate carries no orientation claim");
    assert.deepEqual(candidate.targets, [], "an advisory candidate reconstructs no targets");
  }
});

test("hazard class-1: a byte stream with two indexed loads through different index registers produces no proven class-1 finding (same construction as the advisory case above)", () => {
  const bytes = new Uint8Array([
    0xa2, 0x00, 0xbd, 0x0d, 0x08, 0x48, 0xa0, 0x00, 0xb9, 0x0e, 0x08, 0x48, 0x60, 0x00, 0x00,
  ]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.filter((f) => f.hazardClass === "indexed-dispatch").length, 0);
});

test("hazard class-1: the scanner's truncation flag propagates to the report's own truncation flag rather than being swallowed", () => {
  const origin = 0x0800;
  const tableEntries = 64; // MAX_TABLE_ENTRIES: the 65th check trips truncation
  const bytes = new Uint8Array(3 + tableEntries * 2);
  bytes[0] = 0x6c;
  bytes[1] = 0x03;
  bytes[2] = 0x08; // jmp ($0803)
  for (let k = 0; k < tableEntries; k++) {
    bytes[3 + k * 2] = origin & 0xff;
    bytes[3 + k * 2 + 1] = (origin >> 8) & 0xff;
  }
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.truncated, true, "a scan cut short by MAX_TABLE_ENTRIES must set the report's own truncated flag");
});

// ---------------------------------------------------------------------------
// hazard reuse: the exact-count call-site pin (criterion 3)
// ---------------------------------------------------------------------------

/**
 * `text` with its `//` and block comments removed, positions otherwise
 * intact -- the same minimal shape `anno-coverage.test.ts`'s own
 * `withoutComments()` uses for its own call-site pins against this SAME
 * file. Deliberately does NOT also track quotes/template literals (unlike
 * `anno-cli.test.ts`'s `stripCommentsAndLiterals()`): neither source file
 * this pin reads ever spells `scanIndirectDispatch(` inside a real string or
 * template literal (every occurrence outside a call site is inside a `//`
 * or `/* *\/`-style doc comment), and a quote-tracking stripper desyncs on
 * this file's own quote-heavy prose comments, undercounting real call
 * sites -- measured directly against this file during authoring.
 */
function withoutComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (source[i] === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += source[i++];
  }
  return out;
}

test("hazard reuse: the scanner is declared exactly once and called from exactly two non-test source sites", () => {
  const coverageText = withoutComments(readFileSync(COVERAGE_MODULE_PATH, "utf8"));
  const hazardText = withoutComments(readFileSync(MODULE_PATH, "utf8"));
  const combined = `${coverageText}\n${hazardText}`;
  const declarations = (combined.match(/\bfunction scanIndirectDispatch\(/g) ?? []).length;
  assert.equal(declarations, 1, "scanIndirectDispatch must be declared exactly once, in anno-coverage.ts");
  const occurrences = (combined.match(/\bscanIndirectDispatch\(/g) ?? []).length;
  const callSites = occurrences - declarations;
  assert.equal(
    callSites,
    2,
    `scanIndirectDispatch() has ${callSites} non-test call site(s) across anno-coverage.ts and anno-hazard-report.ts. The two ` +
      "expected sites are the coverage report builder (anno-coverage.ts's buildCoverageReport()) and the hazard report " +
      "(anno-hazard-report.ts's buildHazardReport()). A third site means either a new caller that must be recorded in this " +
      "test's own comment, or a second implementation of the scan, which this phase forbids.",
  );
});

// ---------------------------------------------------------------------------
// hazard class-2: opcode-byte hit (hand-built)
// ---------------------------------------------------------------------------

test("hazard class-2: a store landing on another instruction's opcode byte yields one finding with mechanism store-target-in-instruction-opcode-byte", () => {
  // $0800 nop            <- host, 1 byte, its own opcode byte is $0800
  // $0801 lda #$60
  // $0803 sta $0800      <- target ($0800) is the host's opcode byte
  const bytes = new Uint8Array([0xea, 0xa9, 0x60, 0x8d, 0x00, 0x08]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.length, 1);
  const [finding] = report.findings;
  assert.equal(finding!.hazardClass, "self-modifying-code");
  assert.equal(finding!.mechanism, "store-target-in-instruction-opcode-byte");
  assert.equal(finding!.anchorAddress, 0x0800);
  assert.equal(finding!.blockedAddress, 0x0800);
  assert.equal(finding!.strength, "static-shape-matched");
  assert.equal(finding!.corroboration, "none");
});

// ---------------------------------------------------------------------------
// hazard class-2: operand-byte hit, both hand-built and the committed smc.prg
// ---------------------------------------------------------------------------

test("hazard class-2: a read-modify-write instruction landing on another instruction's operand byte yields mechanism store-target-in-instruction-operand-byte", () => {
  // $0800 lda #$00       <- host, 2 bytes; $0801 is its operand byte
  // $0802 dec $0801      <- RMW, target ($0801) is the host's operand byte
  const bytes = new Uint8Array([0xa9, 0x00, 0xce, 0x01, 0x08]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.length, 1);
  const [finding] = report.findings;
  assert.equal(finding!.mechanism, "store-target-in-instruction-operand-byte");
  assert.equal(finding!.anchorAddress, 0x0800);
  assert.equal(finding!.blockedAddress, 0x0801);
});

test("hazard class-2: the committed smc.prg bytes produce exactly one finding, mechanism store-target-in-instruction-operand-byte", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.hazardClass, "self-modifying-code");
  assert.equal(report.findings[0]!.mechanism, "store-target-in-instruction-operand-byte");
});

// ---------------------------------------------------------------------------
// hazard class-2: read-modify-write instructions produce the same two
// mechanisms by target-byte position (opcode case, via inc)
// ---------------------------------------------------------------------------

test("hazard class-2: an increment landing on another instruction's opcode byte is mechanism store-target-in-instruction-opcode-byte", () => {
  // $0800 nop            <- host, opcode byte at $0800
  // $0801 inc $0800      <- RMW absolute, target is the host's opcode byte
  const bytes = new Uint8Array([0xea, 0xee, 0x00, 0x08]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.mechanism, "store-target-in-instruction-opcode-byte");
});

// ---------------------------------------------------------------------------
// hazard class-2: non-findings
// ---------------------------------------------------------------------------

test("hazard class-2: a store to a hardware register, a zero-page scratch address, or an address outside every decoded instruction yields no finding", () => {
  // sta $d020 -- hardware register, far outside the tiny decoded image
  const hardware = buildHazardReport({ bytes: new Uint8Array([0x8d, 0x20, 0xd0]), origin: 0x0800 });
  assert.deepEqual(hardware.findings, []);

  // sta $02 -- zero-page scratch, no instruction lives at address 2
  const zpScratch = buildHazardReport({ bytes: new Uint8Array([0x85, 0x02]), origin: 0x0800 });
  assert.deepEqual(zpScratch.findings, []);

  // sta $9000 -- absolute, far past the end of a 3-byte image
  const outside = buildHazardReport({ bytes: new Uint8Array([0x8d, 0x00, 0x90]), origin: 0x0800 });
  assert.deepEqual(outside.findings, []);
});

test("hazard class-2: the committed tracer.prg bytes yield zero class-2 findings (negative control)", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.deepEqual(
    report.findings.filter((f) => f.hazardClass === "self-modifying-code"),
    [],
  );
});

test("hazard class-2: an indirect-indexed store yields no finding, and the report's limits name exactly that miss", () => {
  // lda #$00 ; sta ($01),y -- indirect_y. The zero-page pointer address (1)
  // is not itself a literal target this detector may test.
  const bytes = new Uint8Array([0xa9, 0x00, 0x91, 0x01]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.deepEqual(
    report.findings.filter((f) => f.hazardClass === "self-modifying-code"),
    [],
  );
  const indirectLimit = HAZARD_LIMITS.find(
    (l) => l.hazardClass === "self-modifying-code" && /indirect/i.test(l.limit),
  );
  assert.ok(indirectLimit, "HAZARD_LIMITS must name the indirect-indexed self-modification miss");
});

// ---------------------------------------------------------------------------
// hazard class-3: VIC-II hardware alignment (page-alignment)
// ---------------------------------------------------------------------------

test("hazard class-3: an immediate load followed by a store to a watched VIC-II register is recovered as a constant-write fact, evidenced by the resulting finding's anchor address", () => {
  const bytes = new Uint8Array([
    0xa9, 0x3f, // 0000 lda #$3f
    0x8d, 0x00, 0xdd, // 0002 sta $dd00  (bank select)
    0xa9, 0x00, // 0005 lda #$00
    0x8d, 0x18, 0xd0, // 0007 sta $d018  (memory control -- the recovered fact this test checks)
    0xa9, 0x1b, // 000a lda #$1b
    0x8d, 0x11, 0xd0, // 000c sta $d011  (control register 1 -- character-set mode)
    0x60, // 000f rts
  ]);
  const report = buildHazardReport({ bytes, origin: 0x0000 });
  const finding = report.findings.find((f) => f.hazardClass === "page-alignment" && f.mechanism === "charset-base-pinned-by-register");
  assert.ok(finding, "a full recovered VIC-II combination must produce a charset-base-pinned-by-register finding");
  assert.equal(finding!.anchorAddress, 0x0007, "the anchor must be the store that actually wrote the memory-control register");
});

test("hazard class-3: the recovered facts handed to the graphics derivation yield a character-set range whose base lies inside the image, producing mechanism charset-base-pinned-by-register", () => {
  const bytes = new Uint8Array([
    0xa9, 0x3f, 0x8d, 0x00, 0xdd, // lda #$3f ; sta $dd00
    0xa9, 0x00, 0x8d, 0x18, 0xd0, // lda #$00 ; sta $d018 -> char base $0000
    0xa9, 0x1b, 0x8d, 0x11, 0xd0, // lda #$1b ; sta $d011
    0x60,
  ]);
  const report = buildHazardReport({ bytes, origin: 0x0000 });
  const finding = report.findings.find((f) => f.hazardClass === "page-alignment" && f.mechanism === "charset-base-pinned-by-register");
  assert.ok(finding);
  assert.equal(finding!.blockedAddress, 0x0000, "char base $0000 is derived from bankSelect=$3f (bank 0) and memoryControl=$00");
});

test("hazard class-3: the committed character-set fixture produces exactly that finding, with the blocked address at the 2K-aligned base its own source comment derives", () => {
  const { bytes, origin } = loadPrg(CHARSET_PHANTOM_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  const finding = report.findings.find((f) => f.hazardClass === "page-alignment" && f.mechanism === "charset-base-pinned-by-register");
  assert.ok(finding, "the committed character-set fixture must produce a charset-base-pinned-by-register finding");
  assert.equal(finding!.blockedAddress, 0x1000, "the blocked address must be the 2K-aligned base ($1000) the fixture's own header derives");
});

test("hazard class-3: a graphics map whose missingRegisters list is non-empty contributes no finding for the dependent ranges, and the region is undecided (unclassified) rather than no-signal", () => {
  // Only $d018 is written -- $dd00 (bank select) and $d011 (control register
  // 1) are never touched, so the combination is genuinely incomplete.
  const bytes = new Uint8Array([
    0xa9, 0x05, // 0000 lda #$05
    0x8d, 0x18, 0xd0, // 0002 sta $d018
    0x60, // 0005 rts
  ]);
  const origin = 0x0000;
  const report = buildHazardReport({
    bytes,
    origin,
    ranges: [{ start_address: origin, end_address: origin + bytes.length - 1, type: "code" }],
  });
  assert.equal(report.findings.filter((f) => f.hazardClass === "page-alignment").length, 0, "an incomplete combination must produce no page-alignment finding");
  assert.equal(report.regions.length, 1);
  assert.equal(report.regions[0]!.outcome, "unclassified", "the region must read undecided, never no-signal, when the report could not tell rather than looked and found nothing");
  assert.ok(report.regions[0]!.reason && /bank-select|control-register-1/.test(report.regions[0]!.reason), "the reason must name a missing register");
});

test("hazard class-3: a store of an immediate literal into the derived sprite pointer table yields mechanism sprite-pointer-names-aligned-base, blocked at the literal times 64, when inside the image", () => {
  const bytes = new Uint8Array(100).fill(0xea);
  bytes.set([0xa9, 0x3f, 0x8d, 0x00, 0xdd], 0); // lda #$3f ; sta $dd00 (bank 0)
  bytes.set([0xa9, 0x10, 0x8d, 0x18, 0xd0], 5); // lda #$10 ; sta $d018 (screen @ $0400 -> sprite table $07f8)
  bytes.set([0xa9, 0x01, 0x8d, 0xf8, 0x07], 10); // lda #1 ; sta $07f8 -> blocked = 1*64 = 64
  const report = buildHazardReport({ bytes, origin: 0x0000 });
  const finding = report.findings.find((f) => f.hazardClass === "page-alignment" && f.mechanism === "sprite-pointer-names-aligned-base");
  assert.ok(finding, "a literal sprite-pointer store inside the derived table must produce sprite-pointer-names-aligned-base");
  assert.equal(finding!.anchorAddress, 12, "the anchor is the sta $07f8 instruction");
  assert.equal(finding!.blockedAddress, 64, "the blocked address is the literal value times 64");
});

test("hazard class-3: the same store whose scaled product lies outside the loaded image yields no finding", () => {
  const bytes = new Uint8Array(100).fill(0xea);
  bytes.set([0xa9, 0x3f, 0x8d, 0x00, 0xdd], 0);
  bytes.set([0xa9, 0x10, 0x8d, 0x18, 0xd0], 5);
  bytes.set([0xa9, 0xc8, 0x8d, 0xf8, 0x07], 10); // lda #200 ; sta $07f8 -> 200*64=12800, past a 100-byte image
  const report = buildHazardReport({ bytes, origin: 0x0000 });
  const finding = report.findings.find((f) => f.hazardClass === "page-alignment" && f.mechanism === "sprite-pointer-names-aligned-base");
  assert.equal(finding, undefined, "a scaled product outside the loaded image must yield no finding");
});

test("hazard class-3: a store into a sprite pointer address whose value is not an immediate literal yields mechanism sprite-pointer-computed-value at the weakest strength with a null blocked address", () => {
  const bytes = new Uint8Array(100).fill(0xea);
  bytes.set([0xa9, 0x3f, 0x8d, 0x00, 0xdd], 0);
  bytes.set([0xa9, 0x10, 0x8d, 0x18, 0xd0], 5);
  bytes.set([0xae, 0x34, 0x12, 0x8e, 0xf8, 0x07], 10); // ldx $1234 ; stx $07f8 -- not immediate
  const report = buildHazardReport({ bytes, origin: 0x0000 });
  const finding = report.findings.find((f) => f.hazardClass === "page-alignment" && f.mechanism === "sprite-pointer-computed-value");
  assert.ok(finding, "a non-immediate-sourced sprite-pointer store must produce sprite-pointer-computed-value");
  assert.equal(finding!.blockedAddress, null);
  assert.equal(finding!.strength, "static-signature-only", "the weakest strength token -- the target is not statically known");
});

test("hazard class-3: the committed processor-port bank-switching image yields zero class-3 findings", () => {
  const { bytes, origin } = loadPrg(BANK_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.findings.filter((f) => f.hazardClass === "page-alignment").length, 0, "a $01-dependent construction is not a page-alignment hazard");
});

test("hazard class-3: the committed 23-byte negative-control image yields zero class-3 findings", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.findings.filter((f) => f.hazardClass === "page-alignment").length, 0);
});

test("hazard class-3: a finding's detail prose names the boundary its blocked base must satisfy -- 2048 for a character set, 64 for a sprite shape", () => {
  const charsetBytes = new Uint8Array([
    0xa9, 0x3f, 0x8d, 0x00, 0xdd, 0xa9, 0x00, 0x8d, 0x18, 0xd0, 0xa9, 0x1b, 0x8d, 0x11, 0xd0, 0x60,
  ]);
  const charsetReport = buildHazardReport({ bytes: charsetBytes, origin: 0x0000 });
  const charsetFinding = charsetReport.findings.find((f) => f.mechanism === "charset-base-pinned-by-register");
  assert.ok(charsetFinding && charsetFinding.detail.includes("2048"));

  const spriteBytes = new Uint8Array(100).fill(0xea);
  spriteBytes.set([0xa9, 0x3f, 0x8d, 0x00, 0xdd], 0);
  spriteBytes.set([0xa9, 0x10, 0x8d, 0x18, 0xd0], 5);
  spriteBytes.set([0xa9, 0x01, 0x8d, 0xf8, 0x07], 10);
  const spriteReport = buildHazardReport({ bytes: spriteBytes, origin: 0x0000 });
  const spriteFinding = spriteReport.findings.find((f) => f.mechanism === "sprite-pointer-names-aligned-base");
  assert.ok(spriteFinding && spriteFinding.detail.includes("64"));
});

// ---------------------------------------------------------------------------
// hazard shape
// ---------------------------------------------------------------------------

/** Recursively walks a value, collecting every (key, value) pair found at
 * any depth -- mirrors evid-reconcile.test.ts's own banned-key walk. */
function collectEntries(value: unknown, out: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    for (const item of value) collectEntries(item, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push([k, v]);
      collectEntries(v, out);
    }
  }
  return out;
}

test("hazard shape: no field is boolean except truncated, and no field name reads as a clean/dirty/safe/ok verdict", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const report: HazardReport = buildHazardReport({
    bytes,
    origin,
    ranges: [{ start_address: origin, end_address: origin + bytes.length - 1, type: "code" }],
  });
  const entries = collectEntries(report as unknown);
  assert.ok(entries.length > 0, "the walk must actually visit nested rows");
  for (const [key, val] of entries) {
    assert.ok(!/clean|dirty|safe|ok/i.test(key), `field name "${key}" reads as a safety verdict`);
    if (typeof val === "boolean") {
      assert.equal(key, "truncated", `only "truncated" may be a boolean field (found on "${key}")`);
    }
  }
});

test("hazard shape: every finding carries a non-empty mechanism and a strength drawn from the declared token list", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.ok(report.findings.length > 0);
  for (const finding of report.findings) {
    assert.ok(finding.mechanism.length > 0);
    assert.ok((HAZARD_DETECTION_STRENGTHS as readonly string[]).includes(finding.strength));
  }
});

test("hazard shape: two findings at the same anchor address with different mechanisms both survive; identical triples appear once", () => {
  // Host: sta $9999 at $0800 (3 bytes: opcode $0800, operand bytes $0801-$0802)
  // Writer A: lda #$60 ; sta $0800   -> hits the host's OPCODE byte
  // Writer B: lda #$05 ; sta $0801   -> hits the host's OPERAND byte
  // Writer C: lda #$61 ; sta $0800   -> a SECOND opcode-byte hit, same triple as A
  const bytes = new Uint8Array([
    0x8d, 0x99, 0x99, // $0800 sta $9999 (host)
    0xa9, 0x60, // $0803 lda #$60
    0x8d, 0x00, 0x08, // $0805 sta $0800 (writer A: opcode-byte hit)
    0xa9, 0x05, // $0808 lda #$05
    0x8d, 0x01, 0x08, // $080a sta $0801 (writer B: operand-byte hit)
    0xa9, 0x61, // $080d lda #$61
    0x8d, 0x00, 0x08, // $080f sta $0800 (writer C: duplicate of A's triple)
  ]);
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  const scMods = report.findings.filter((f) => f.hazardClass === "self-modifying-code");
  assert.equal(scMods.length, 2, "the duplicate triple from writer C must be de-duplicated to one");
  const mechanisms = scMods.map((f) => f.mechanism).sort();
  assert.deepEqual(mechanisms, ["store-target-in-instruction-opcode-byte", "store-target-in-instruction-operand-byte"]);
  assert.ok(scMods.every((f) => f.anchorAddress === 0x0800), "both survivors anchor at the same host address");
});

test("hazard shape: an empty input returns a zero denominator, empty findings and empty regions, never throws, never reads as 'no hazards'", () => {
  const report = buildHazardReport({ bytes: new Uint8Array(0), origin: 0 });
  assert.equal(report.denominator, 0);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.regions, []);
  assert.deepEqual(report.classesEvaluated, []);
  // The limits array is still present -- absence of evaluation is not itself
  // a safety claim either.
  assert.ok(report.limits.length > 0);
});

test("hazard shape: a single-range store over an image with zero findings reports that range as no-signal, and the limits state that no detection is not evidence of safety", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const report = buildHazardReport({
    bytes,
    origin,
    ranges: [{ start_address: origin, end_address: origin + bytes.length - 1, type: "code" }],
  });
  assert.equal(report.regions.length, 1);
  assert.equal(report.regions[0]!.outcome, "no-signal");
  assert.equal(report.regions[0]!.reason, undefined, "no-signal never carries a reason -- reason is unclassified-only");
  const safetyLimit = HAZARD_LIMITS.find((l) => l.hazardClass === null);
  assert.ok(safetyLimit && /no detection is not evidence of safety/i.test(safetyLimit.consequence));
});

// ---------------------------------------------------------------------------
// hazard order
// ---------------------------------------------------------------------------

test("hazard order: calling the builder twice on the same input returns deeply equal results, and findings are non-decreasing by anchor address", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const first = buildHazardReport({ bytes, origin });
  const second = buildHazardReport({ bytes, origin });
  assert.deepEqual(first, second);
  for (let i = 1; i < first.findings.length; i++) {
    assert.ok(first.findings[i]!.anchorAddress >= first.findings[i - 1]!.anchorAddress);
  }
});

// ---------------------------------------------------------------------------
// hazard read-only: structural source-text assertion (T-48-01)
// ---------------------------------------------------------------------------

test("hazard read-only: the module contains no file-write call, no store-open call, no cross-reference write call, no apply-write call, no live-session import and no path-translation import", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  const forbidden = [
    "writeFileSync",
    "renameSync",
    "appendFileSync",
    "save_project",
    "anno-session.ts",
    "openStore",
    "putXref",
    "applyWrite",
  ];
  for (const banned of forbidden) {
    assert.ok(!source.includes(banned), `anno-hazard-report.ts must never mention ${banned} -- a report run must be read-only by construction`);
  }
  assert.ok(!/hostpath|containerpath/.test(source), "the hazard report must stay absent from the path-translation consumer set");
});

test("hazard read-only: the module never uses the existing confidence-grade vocabulary's rendered bracket tokens", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  // Bracket form only -- the rendered collision this module's header discusses.
  // The bare word "unknown" is excluded deliberately: it is both a
  // TypeScript primitive type keyword this module legitimately uses in its
  // own argument-narrowing helpers and ordinary English, and flagging it
  // would fail on a false positive rather than a genuine vocabulary clash --
  // see this module's own header section on the separate vocabulary.
  for (const bracket of ["[confirmed-code]", "[probable-code]", "[confirmed-data]", "[probable-data]", "[unknown]"]) {
    assert.ok(!source.includes(bracket), `anno-hazard-report.ts must never render the existing confidence bracket token ${bracket}`);
  }
  for (const bareToken of ["confirmed-code", "probable-code", "confirmed-data", "probable-data"]) {
    assert.ok(!source.includes(bareToken), `anno-hazard-report.ts must never reuse the existing confidence token ${bareToken}`);
  }
});

// ---------------------------------------------------------------------------
// Shipped, not test-only
// ---------------------------------------------------------------------------

test("anno-hazard-report.ts IS present in package.json's files[] array", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files));
  assert.equal(pkg.files.includes("anno-hazard-report.ts"), true, "anno-hazard-report.ts must ship -- it is reachable through anno-tools.ts and anno-cli.ts once wired");
});

test("hazard shape: HAZARD_CLASSES and HAZARD_DETECTION_STRENGTHS are frozen and declared in a stable order", () => {
  assert.deepEqual(HAZARD_CLASSES, ["indexed-dispatch", "self-modifying-code", "page-alignment", "cycle-exact-raster"]);
  assert.ok(Object.isFrozen(HAZARD_CLASSES));
  assert.deepEqual(HAZARD_DETECTION_STRENGTHS, ["observed-corroborated", "static-shape-matched", "static-signature-only"]);
  assert.ok(Object.isFrozen(HAZARD_DETECTION_STRENGTHS));
});
