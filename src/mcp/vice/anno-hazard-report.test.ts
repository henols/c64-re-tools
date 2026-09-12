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
//   hazard class-4:  structural signature matching only -- raster-register
//                     access, a timing sled, a one-shot timer reload, all
//                     inside a routine an interrupt vector store names;
//                     negatives, wording discipline, observed-corroborated
//                     promotion, and an out-of-image vector handled safely
//   hazard limits:   every one of the four hazard classes has a limit entry
//   hazard shape:    no boolean field but `truncated`, no banned field name
//                     (including verdict/pass), de-duplication and survival
//                     on the (class, anchor, mechanism) triple, empty-input
//                     safety, no-signal never read as clean, and the
//                     undecided third outcome proven REACHED by real
//                     fixtures rather than merely declared reachable
//   hazard order:    determinism and ascending-by-anchor ordering
//   hazard read-only: a structural source-text assertion

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildHazardReport,
  crossCheckHazardFixture,
  HAZARD_CLASSES,
  HAZARD_DETECTION_STRENGTHS,
  HAZARD_LIMITS,
  HAZARD_REGION_OUTCOMES,
  type HazardClass,
  type HazardCrossCheckExpectation,
  type HazardFinding,
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
const CROSS_CHECK_PATH = join(HERE, "fixtures", "hazard-subject", "CROSS-CHECK.md");

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
// hazard class-4: cycle-exact-raster (structural signature only)
// ---------------------------------------------------------------------------

/** Builds a synthetic image: a RAM IRQ vector install (`lda #lo ; sta $0314
 * ; lda #hi ; sta $0315 ; rts`) at $0800, NOP-padded up to `handlerAddress`,
 * followed by `handlerBytes`. Shared by every class-4 test below so each
 * test states only what its own handler contains. */
function buildVectorInstallImage(handlerAddress: number, handlerBytes: number[]): { bytes: Uint8Array; origin: number } {
  const origin = 0x0800;
  const lo = handlerAddress & 0xff;
  const hi = (handlerAddress >> 8) & 0xff;
  const prefix = [0xa9, lo, 0x8d, 0x14, 0x03, 0xa9, hi, 0x8d, 0x15, 0x03, 0x60];
  const prefixEnd = origin + prefix.length;
  if (handlerAddress < prefixEnd) throw new Error("test construction error: handler overlaps the vector-install prefix");
  const paddingLength = handlerAddress - prefixEnd;
  const bytes = new Uint8Array(prefix.length + paddingLength + handlerBytes.length);
  bytes.set(prefix, 0);
  bytes.fill(0xea, prefix.length, prefix.length + paddingLength);
  bytes.set(handlerBytes, prefix.length + paddingLength);
  return { bytes, origin };
}

const HANDLER_ADDRESS = 0x0810;

test("hazard class-4: a raster-register access inside a routine an interrupt vector store names yields mechanism raster-access-in-vectored-handler at the weakest strength", () => {
  const { bytes, origin } = buildVectorInstallImage(HANDLER_ADDRESS, [0xad, 0x12, 0xd0, 0x40]); // lda $d012 ; rti
  const report = buildHazardReport({ bytes, origin });
  const finding = report.findings.find((f) => f.hazardClass === "cycle-exact-raster" && f.mechanism === "raster-access-in-vectored-handler");
  assert.ok(finding, "a raster-register access inside the vectored handler must produce this finding");
  assert.equal(finding!.anchorAddress, HANDLER_ADDRESS);
  assert.equal(finding!.strength, "static-signature-only");
});

test("hazard class-4: three or more consecutive NOPs immediately following a raster-register access yield mechanism timing-sled-after-raster-access at the weakest strength", () => {
  const { bytes, origin } = buildVectorInstallImage(HANDLER_ADDRESS, [0xad, 0x12, 0xd0, 0xea, 0xea, 0xea, 0x60]); // lda $d012 ; nop*3 ; rts
  const report = buildHazardReport({ bytes, origin });
  const finding = report.findings.find((f) => f.hazardClass === "cycle-exact-raster" && f.mechanism === "timing-sled-after-raster-access");
  assert.ok(finding, "a timing sled after a raster access must produce this finding");
  assert.equal(finding!.strength, "static-signature-only");
});

test("hazard class-4: a one-shot timer reload written inside a routine an interrupt vector store names yields mechanism timer-reload-in-vectored-handler at the weakest strength", () => {
  const { bytes, origin } = buildVectorInstallImage(HANDLER_ADDRESS, [0xa9, 0x05, 0x8d, 0x04, 0xdc, 0x60]); // lda #5 ; sta $dc04 ; rts
  const report = buildHazardReport({ bytes, origin });
  const finding = report.findings.find((f) => f.hazardClass === "cycle-exact-raster" && f.mechanism === "timer-reload-in-vectored-handler");
  assert.ok(finding, "a one-shot timer reload inside the vectored handler must produce this finding");
  assert.equal(finding!.strength, "static-signature-only");
});

test("hazard class-4: a routine that writes the border colour register in a plain loop with no interrupt vector store and no raster-register access yields no class-4 finding", () => {
  const bytes = new Uint8Array([0xa9, 0x01, 0x8d, 0x20, 0xd0, 0x4c, 0x00, 0x08]); // lda #1 ; sta $d020 ; jmp $0800
  const report = buildHazardReport({ bytes, origin: 0x0800 });
  assert.equal(report.findings.filter((f) => f.hazardClass === "cycle-exact-raster").length, 0);
});

test("hazard class-4: the committed 23-byte negative-control image yields zero class-4 findings", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.findings.filter((f) => f.hazardClass === "cycle-exact-raster").length, 0);
});

test("hazard class-4: no finding is ever emitted at the shape-matched or corroborated strength on the strength of a static match alone, and detail prose says 'signature' but never 'verified', 'proven' or 'confirmed'", () => {
  const images = [
    buildVectorInstallImage(HANDLER_ADDRESS, [0xad, 0x12, 0xd0, 0x40]),
    buildVectorInstallImage(HANDLER_ADDRESS, [0xad, 0x12, 0xd0, 0xea, 0xea, 0xea, 0x60]),
    buildVectorInstallImage(HANDLER_ADDRESS, [0xa9, 0x05, 0x8d, 0x04, 0xdc, 0x60]),
  ];
  let checked = 0;
  for (const { bytes, origin } of images) {
    const report = buildHazardReport({ bytes, origin });
    for (const f of report.findings.filter((x) => x.hazardClass === "cycle-exact-raster")) {
      checked++;
      assert.equal(f.strength, "static-signature-only", "no class-4 finding may be shape-matched or corroborated from a static match alone");
      assert.ok(/signature/i.test(f.detail), "class-4 detail prose must name the match as a signature");
      assert.ok(!/verified|proven|confirmed/i.test(f.detail), `class-4 detail must never assert verification: "${f.detail}"`);
      assert.ok(!/verified|proven|confirmed|exact/i.test(f.mechanism), `class-4 mechanism id must never assert verification: "${f.mechanism}"`);
    }
  }
  assert.ok(checked >= 3, "precondition: all three positive class-4 constructions above must actually produce findings to check");
});

test("hazard class-4: a runtime observation covering the finding's own anchor address promotes its strength to observed-corroborated", () => {
  const { bytes, origin } = buildVectorInstallImage(HANDLER_ADDRESS, [0xad, 0x12, 0xd0, 0x40]);
  const report = buildHazardReport({
    bytes,
    origin,
    execObservations: [{ id: 1, imageSha256: "x", argvDigest: "y", seed: "z", address: HANDLER_ADDRESS, sourceBank: "ram" }],
  });
  const finding = report.findings.find((f) => f.hazardClass === "cycle-exact-raster" && f.mechanism === "raster-access-in-vectored-handler");
  assert.ok(finding);
  assert.equal(finding!.strength, "observed-corroborated");
  assert.equal(finding!.corroboration, "runtime-observed");
});

test("hazard class-4: an interrupt vector naming an address outside the loaded image is skipped safely -- no finding, no crash", () => {
  const origin = 0x0800;
  const bytes = new Uint8Array([0xa9, 0x00, 0x8d, 0x14, 0x03, 0xa9, 0x99, 0x8d, 0x15, 0x03, 0x60]); // vector -> $9900, far outside
  const report = buildHazardReport({ bytes, origin });
  assert.equal(report.findings.filter((f) => f.hazardClass === "cycle-exact-raster").length, 0);
});

// ---------------------------------------------------------------------------
// hazard limits
// ---------------------------------------------------------------------------

test("hazard limits: every one of the four hazard classes has at least one entry in the emitted limits array", () => {
  for (const cls of HAZARD_CLASSES) {
    assert.ok(HAZARD_LIMITS.some((l) => l.hazardClass === cls), `HAZARD_LIMITS must contain at least one entry for hazard class "${cls}"`);
  }
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

test("hazard shape: enumerating a real report's own keys finds no boolean field but truncated, and no key name reading clean/dirty/safe/ok/verdict/pass", () => {
  // The committed hazard-subject fixture carries a real, non-empty
  // unprovenDispatchCandidates entry (the declining mixed-index-register
  // construction from plan 48-02) -- the scanner's OWN foreign shape,
  // preserved verbatim, carries its own `truncated`/`orientationResolved`
  // booleans. This module's "no boolean but truncated" discipline governs
  // fields IT defines, not a foreign collection carried through unchanged
  // (see this field's own doc comment on `HazardReport`), so it is excluded
  // from this particular walk -- every field this module itself defines is
  // still walked in full.
  const { bytes, origin } = loadPrg(HAZARD_SUBJECT_PRG_PATH);
  const report = buildHazardReport({
    bytes,
    origin,
    ranges: [{ start_address: origin, end_address: origin + bytes.length - 1, type: "code" }],
  });
  assert.ok(report.unprovenDispatchCandidates.length > 0, "precondition: this fixture must carry a real advisory candidate for the exclusion above to be meaningful");
  const { unprovenDispatchCandidates: _foreign, ...ownFields } = report;
  const entries = collectEntries(ownFields as unknown);
  assert.ok(entries.length > 0, "the walk must actually visit nested rows");
  for (const [key, val] of entries) {
    assert.ok(!/clean|dirty|safe|ok|verdict|pass/i.test(key), `field name "${key}" reads as a safety verdict`);
    if (typeof val === "boolean") assert.equal(key, "truncated", `only "truncated" may be a boolean field (found on "${key}")`);
  }
});

test("hazard shape: across the fixture corpus the suite reads, all three region-outcome tokens occur at least once", () => {
  const smc = loadPrg(SMC_PRG_PATH);
  const smcReport = buildHazardReport({
    bytes: smc.bytes,
    origin: smc.origin,
    ranges: [
      { start_address: smc.origin, end_address: smc.origin + smc.bytes.length - 1, type: "code" },
      { start_address: 0x9000, end_address: 0x9010, type: "code" }, // wholly outside the loaded image -> unclassified
    ],
  });
  const tracer = loadPrg(TRACER_PRG_PATH);
  const tracerReport = buildHazardReport({
    bytes: tracer.bytes,
    origin: tracer.origin,
    ranges: [{ start_address: tracer.origin, end_address: tracer.origin + tracer.bytes.length - 1, type: "code" }],
  });
  const outcomes = new Set([...smcReport.regions, ...tracerReport.regions].map((r) => r.outcome));
  for (const token of HAZARD_REGION_OUTCOMES) {
    assert.ok(outcomes.has(token), `region outcome "${token}" must be reached by at least one real fixture in the suite`);
  }
});

test("hazard shape: every undecided (unclassified) region across the fixture corpus carries a non-empty cause", () => {
  const smc = loadPrg(SMC_PRG_PATH);
  const smcReport = buildHazardReport({
    bytes: smc.bytes,
    origin: smc.origin,
    ranges: [
      { start_address: smc.origin, end_address: smc.origin + smc.bytes.length - 1, type: "code" },
      { start_address: 0x9000, end_address: 0x9010, type: "code" },
    ],
  });
  const unclassified = smcReport.regions.filter((r) => r.outcome === "unclassified");
  assert.ok(unclassified.length > 0, "precondition: at least one unclassified region must exist to check its cause");
  for (const region of unclassified) {
    assert.ok(typeof region.reason === "string" && region.reason.length > 0, "every unclassified region must carry a non-empty reason naming its cause");
  }
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
// hazard crosscheck: the expectation table for the four independently-sourced
// fixtures, declared from each fixture's OWN committed content -- never from
// a detector run. See `crossCheckHazardFixture()`'s own doc comment for why
// an expectation is never edited to make a disagreeing row agree.
// ---------------------------------------------------------------------------

const TRACER_FIXTURE = "fixtures/dxa/tracer.prg";
const BANK_FIXTURE = "fixtures/ghidra/bank.prg";
const SMC_FIXTURE = "fixtures/export-asm/smc.prg";
const CHARSET_FIXTURE = "fixtures/ghidra/charset-phantom.prg";

/**
 * Sixteen rows: four independently-sourced fixtures times the four hazard
 * classes. Every `positive` row's `expectedAddresses` is read from that
 * fixture's own committed source, cited in the comment beside it -- never
 * from running a detector over it first.
 */
const CROSS_CHECK_EXPECTATIONS: readonly HazardCrossCheckExpectation[] = [
  // --- fixtures/dxa/tracer.prg: the 23-byte border-colour program. Its
  // whole body is `lda #$00 ; sta $d020 ; rts` (fixtures/dxa/README.md's own
  // byte table) -- no dispatch construct, no self-modification, no VIC-II
  // register combination, no interrupt vector store. Negative for all four.
  { fixture: TRACER_FIXTURE, hazardClass: "indexed-dispatch", kind: "negative", expectedAddresses: [] },
  { fixture: TRACER_FIXTURE, hazardClass: "self-modifying-code", kind: "negative", expectedAddresses: [] },
  { fixture: TRACER_FIXTURE, hazardClass: "page-alignment", kind: "negative", expectedAddresses: [] },
  { fixture: TRACER_FIXTURE, hazardClass: "cycle-exact-raster", kind: "negative", expectedAddresses: [] },

  // --- fixtures/ghidra/bank.prg: the processor-port bank-switching program.
  // Every access to $d020/$d000 in bank.a is gated by the CURRENT `$01`
  // value written immediately before it -- a runtime STATE dependency, never
  // a spatial-alignment one, and the fixture's own header comment says so in
  // as many words ("the SAME address means different things under different
  // $01"). No dispatch construct, no self-modifying store, no $dd00/$d018/
  // $d011 write, no interrupt vector store anywhere in bank.a. Negative for
  // all four classes, and specifically negative for page-alignment: a
  // program whose address-meaning dependency is a processor-port state
  // change is a negative control for a spatial-boundary class, not a
  // positive example of one.
  { fixture: BANK_FIXTURE, hazardClass: "indexed-dispatch", kind: "negative", expectedAddresses: [] },
  { fixture: BANK_FIXTURE, hazardClass: "self-modifying-code", kind: "negative", expectedAddresses: [] },
  { fixture: BANK_FIXTURE, hazardClass: "page-alignment", kind: "negative", expectedAddresses: [] },
  { fixture: BANK_FIXTURE, hazardClass: "cycle-exact-raster", kind: "negative", expectedAddresses: [] },

  // --- fixtures/export-asm/smc.a: the 13-byte self-modifying loop.
  // `smc_operand = *+$01` immediately before `lda #$00` at $0801 names
  // $0802 -- the operand byte `inc smc_operand` rewrites on every pass
  // (smc.a's own header comment, and export-asm/README.md's byte table).
  // Positive for self-modifying-code at exactly $0802. No dispatch
  // construct, no VIC-II register write, no interrupt vector store anywhere
  // in smc.a -- negative for the other three.
  { fixture: SMC_FIXTURE, hazardClass: "indexed-dispatch", kind: "negative", expectedAddresses: [] },
  { fixture: SMC_FIXTURE, hazardClass: "self-modifying-code", kind: "positive", expectedAddresses: [0x0802] },
  { fixture: SMC_FIXTURE, hazardClass: "page-alignment", kind: "negative", expectedAddresses: [] },
  { fixture: SMC_FIXTURE, hazardClass: "cycle-exact-raster", kind: "negative", expectedAddresses: [] },

  // --- fixtures/ghidra/charset-phantom.a: the character-set program.
  // Its own header comment derives the character-set base register by
  // register: $dd00=$3f -> bank base $0000; $d018=$04 -> character base
  // = bank base + 2*2048 = $1000; $d011=$1b -> character-set mode, 2048
  // bytes. Positive for page-alignment at exactly $1000. The charset block
  // itself is a chain of plain `jsr`/`rts` blocks (never the stack-return
  // RTS-trick idiom, never a split hi/lo table), so it produces no
  // indexed-dispatch finding; no store lands on another instruction's own
  // decoded byte range, so no self-modifying-code finding; no interrupt
  // vector store exists anywhere in the source, so no cycle-exact-raster
  // finding. Negative for the other three.
  { fixture: CHARSET_FIXTURE, hazardClass: "indexed-dispatch", kind: "negative", expectedAddresses: [] },
  { fixture: CHARSET_FIXTURE, hazardClass: "self-modifying-code", kind: "negative", expectedAddresses: [] },
  { fixture: CHARSET_FIXTURE, hazardClass: "page-alignment", kind: "positive", expectedAddresses: [0x1000] },
  { fixture: CHARSET_FIXTURE, hazardClass: "cycle-exact-raster", kind: "negative", expectedAddresses: [] },
];

/** The classes with NO independently-sourced positive example among the
 * four fixtures above -- computed from the expectation table itself so the
 * two never drift apart, rather than hand-listed a second time. */
const CLASSES_WITH_NO_INDEPENDENT_POSITIVE: readonly HazardClass[] = HAZARD_CLASSES.filter(
  (cls) => !CROSS_CHECK_EXPECTATIONS.some((e) => e.hazardClass === cls && e.kind === "positive"),
);

const FIXTURE_PRG_PATHS: Readonly<Record<string, string>> = {
  [TRACER_FIXTURE]: TRACER_PRG_PATH,
  [BANK_FIXTURE]: BANK_PRG_PATH,
  [SMC_FIXTURE]: SMC_PRG_PATH,
  [CHARSET_FIXTURE]: CHARSET_PHANTOM_PRG_PATH,
};

const REPORT_BY_FIXTURE: Readonly<Record<string, HazardReport>> = Object.fromEntries(
  Object.entries(FIXTURE_PRG_PATHS).map(([fixture, path]) => [fixture, buildHazardReport(loadPrg(path))]),
);

test("hazard crosscheck: crossCheckHazardFixture() returns a shape with a denominator, three counts and three sorted address arrays, and no boolean, score, rate or percentage field", () => {
  const report = REPORT_BY_FIXTURE[SMC_FIXTURE]!;
  const result = crossCheckHazardFixture(report, CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === SMC_FIXTURE && e.hazardClass === "self-modifying-code")!);
  assert.equal(result.fixture, SMC_FIXTURE);
  assert.equal(result.hazardClass, "self-modifying-code");
  assert.equal(result.positiveClass, "self-modifying-code");
  assert.equal(typeof result.denominator, "number");
  assert.equal(typeof result.detected, "number");
  assert.equal(typeof result.missed, "number");
  assert.equal(typeof result.falsePositive, "number");
  assert.ok(Array.isArray(result.detectedAddresses));
  assert.ok(Array.isArray(result.missedAddresses));
  assert.ok(Array.isArray(result.falsePositiveAddresses));
  for (const [key, val] of Object.entries(result)) {
    assert.notEqual(typeof val, "boolean", `field "${key}" must never be a boolean`);
    assert.ok(!/score|rate|percent/i.test(key), `field name "${key}" must never read as a score, rate or percentage`);
  }
});

test("hazard crosscheck: the expectation table covers four fixtures times four classes -- sixteen rows, each with an expectation kind", () => {
  assert.equal(CROSS_CHECK_EXPECTATIONS.length, 16);
  const fixtures = new Set(CROSS_CHECK_EXPECTATIONS.map((e) => e.fixture));
  assert.equal(fixtures.size, 4);
  for (const cls of HAZARD_CLASSES) {
    const rowsForClass = CROSS_CHECK_EXPECTATIONS.filter((e) => e.hazardClass === cls);
    assert.equal(rowsForClass.length, 4, `hazard class "${cls}" must have exactly one row per fixture`);
  }
  for (const e of CROSS_CHECK_EXPECTATIONS) {
    assert.ok(["positive", "negative", "no-example"].includes(e.kind));
  }
});

test("hazard crosscheck: every negative-control fixture has a false-positive count of zero across all four classes -- fails by name, naming fixture, class and addresses, otherwise", () => {
  for (const expectation of CROSS_CHECK_EXPECTATIONS) {
    if (expectation.kind !== "negative") continue;
    const report = REPORT_BY_FIXTURE[expectation.fixture]!;
    const result = crossCheckHazardFixture(report, expectation);
    assert.equal(
      result.falsePositive,
      0,
      `negative-control fixture "${expectation.fixture}" produced ${result.falsePositive} false positive(s) for class "${expectation.hazardClass}" at address(es) ${result.falsePositiveAddresses.map((a) => `$${a.toString(16)}`).join(", ")} -- a detector has learned the shape of its own fixture`,
    );
  }
});

test("hazard crosscheck: the 23-byte border-colour fixture has a false-positive count of zero for all four classes", () => {
  const report = REPORT_BY_FIXTURE[TRACER_FIXTURE]!;
  for (const cls of HAZARD_CLASSES) {
    const expectation = CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === TRACER_FIXTURE && e.hazardClass === cls)!;
    const result = crossCheckHazardFixture(report, expectation);
    assert.equal(result.falsePositive, 0, `the border-colour negative control must produce zero false positives for class "${cls}"`);
  }
});

test("hazard crosscheck: the processor-port fixture has a false-positive count of zero for all four classes, and specifically zero for the spatial-alignment class", () => {
  const report = REPORT_BY_FIXTURE[BANK_FIXTURE]!;
  for (const cls of HAZARD_CLASSES) {
    const expectation = CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === BANK_FIXTURE && e.hazardClass === cls)!;
    const result = crossCheckHazardFixture(report, expectation);
    assert.equal(result.falsePositive, 0, `the processor-port negative control must produce zero false positives for class "${cls}"`);
  }
  const alignmentExpectation = CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === BANK_FIXTURE && e.hazardClass === "page-alignment")!;
  assert.equal(alignmentExpectation.kind, "negative", "the processor-port fixture must be a negative control specifically for page-alignment -- a state dependency, never a spatial one");
});

test("hazard crosscheck: the self-modifying fixture's class-2 row shows one detected and zero missed", () => {
  const report = REPORT_BY_FIXTURE[SMC_FIXTURE]!;
  const expectation = CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === SMC_FIXTURE && e.hazardClass === "self-modifying-code")!;
  const result = crossCheckHazardFixture(report, expectation);
  assert.equal(result.detected, 1);
  assert.equal(result.missed, 0);
  assert.deepEqual(result.detectedAddresses, [0x0802]);
});

test("hazard crosscheck: the character-set fixture's alignment row shows at least one detected and zero missed", () => {
  const report = REPORT_BY_FIXTURE[CHARSET_FIXTURE]!;
  const expectation = CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === CHARSET_FIXTURE && e.hazardClass === "page-alignment")!;
  const result = crossCheckHazardFixture(report, expectation);
  assert.ok(result.detected >= 1);
  assert.equal(result.missed, 0);
  assert.ok(result.detectedAddresses.includes(0x1000));
});

test("hazard crosscheck: a no-example expectation returns the marker -- every count and the denominator at zero, contributing nothing to any measurement", () => {
  const noExampleExpectation: HazardCrossCheckExpectation = { fixture: TRACER_FIXTURE, hazardClass: "indexed-dispatch", kind: "no-example", expectedAddresses: [] };
  const report = REPORT_BY_FIXTURE[TRACER_FIXTURE]!;
  const result = crossCheckHazardFixture(report, noExampleExpectation);
  assert.equal(result.denominator, 0);
  assert.equal(result.detected, 0);
  assert.equal(result.missed, 0);
  assert.equal(result.falsePositive, 0);
  assert.deepEqual(result.detectedAddresses, []);
  assert.deepEqual(result.missedAddresses, []);
  assert.deepEqual(result.falsePositiveAddresses, []);
});

test("hazard crosscheck: an expected address the report found lands in detected, an expected address not found lands in missed, and a reported address no expectation named lands in false-positive", () => {
  const syntheticReport: HazardReport = {
    findings: [
      {
        hazardClass: "self-modifying-code",
        anchorAddress: 0x1000,
        blockedAddress: 0x1001,
        mechanism: "store-target-in-instruction-operand-byte",
        strength: "static-shape-matched",
        detail: "synthetic",
        corroboration: "none",
      },
      {
        hazardClass: "self-modifying-code",
        anchorAddress: 0x2000,
        blockedAddress: 0x2001,
        mechanism: "store-target-in-instruction-opcode-byte",
        strength: "static-shape-matched",
        detail: "synthetic",
        corroboration: "none",
      },
    ],
    regions: [],
    limits: HAZARD_LIMITS,
    denominator: 0,
    classesEvaluated: ["self-modifying-code"],
    unprovenDispatchCandidates: [],
    truncated: false,
  };
  const expectation: HazardCrossCheckExpectation = {
    fixture: "synthetic",
    hazardClass: "self-modifying-code",
    kind: "positive",
    expectedAddresses: [0x1001, 0x9999],
  };
  const result = crossCheckHazardFixture(syntheticReport, expectation);
  assert.deepEqual(result.detectedAddresses, [0x1001], "the expected address the synthetic report found must land in detected");
  assert.deepEqual(result.missedAddresses, [0x9999], "the expected address the synthetic report did not find must land in missed");
  assert.deepEqual(result.falsePositiveAddresses, [0x2001], "the reported address no expectation named must land in false-positive");
});

test("hazard crosscheck: two comparator runs over identical input return deeply equal results", () => {
  const report = REPORT_BY_FIXTURE[SMC_FIXTURE]!;
  const expectation = CROSS_CHECK_EXPECTATIONS.find((e) => e.fixture === SMC_FIXTURE && e.hazardClass === "self-modifying-code")!;
  const first = crossCheckHazardFixture(report, expectation);
  const second = crossCheckHazardFixture(report, expectation);
  assert.deepEqual(first, second);
});

test("hazard crosscheck: the indexed-dispatch and cycle-exact-raster classes have no positive row in the expectation table -- computed from the table itself", () => {
  assert.deepEqual(new Set(CLASSES_WITH_NO_INDEPENDENT_POSITIVE), new Set(["indexed-dispatch", "cycle-exact-raster"]));
});

test("hazard crosscheck: CROSS-CHECK.md is consistent with the comparator's live output -- every fixture and class named in the expectation table appears in the document, and the document's own no-positive-example statement is present for exactly the classes with no positive row and absent for the classes with one", () => {
  const doc = readFileSync(CROSS_CHECK_PATH, "utf8");
  const lines = doc.split("\n");

  for (const fixture of new Set(CROSS_CHECK_EXPECTATIONS.map((e) => e.fixture))) {
    const basename = fixture.split("/").pop()!;
    assert.ok(doc.includes(basename), `CROSS-CHECK.md must name the fixture "${basename}"`);
  }
  for (const cls of HAZARD_CLASSES) {
    assert.ok(doc.includes(cls), `CROSS-CHECK.md must name the hazard class "${cls}" (its own table's class column)`);
  }

  for (const cls of HAZARD_CLASSES) {
    const hasPositiveRow = CROSS_CHECK_EXPECTATIONS.some((e) => e.hazardClass === cls && e.kind === "positive");
    // The document spells a class either hyphenated ("indexed-dispatch") or
    // as two words ("indexed dispatch") in prose -- both must be tolerated.
    const classPattern = cls.replace(/-/g, "[- ]");
    const classLineRe = new RegExp(classPattern, "i");
    const noExampleLines = lines.filter((line) => classLineRe.test(line) && /no independent positive example/i.test(line));
    if (hasPositiveRow) {
      assert.equal(
        noExampleLines.length,
        0,
        `CROSS-CHECK.md must NOT carry a no-positive-example statement for "${cls}", which has a positive row in the expectation table`,
      );
    } else {
      assert.ok(
        noExampleLines.length > 0,
        `CROSS-CHECK.md must state, on a line naming "${cls}", that it has no independent positive example`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// hazard evidence: runtime observation strengthens, never suppresses
// ---------------------------------------------------------------------------

test("hazard evidence: the same input built twice -- once with an empty observation list and once with observations covering every finding's anchor address -- produces finding sets identical in class, anchor address, blocked address and mechanism, differing only in strength and corroboration", () => {
  const { bytes, origin } = loadPrg(HAZARD_SUBJECT_PRG_PATH);
  const bare = buildHazardReport({ bytes, origin });
  assert.ok(bare.findings.length > 0, "precondition: the subject image must produce at least one finding");
  const execObservations = bare.findings.map((f, i) => ({
    id: i + 1,
    imageSha256: "x",
    argvDigest: "y",
    seed: "z",
    address: f.anchorAddress,
    sourceBank: "ram" as const,
  }));
  const corroborated = buildHazardReport({ bytes, origin, execObservations });
  const strip = (f: HazardFinding) => ({
    hazardClass: f.hazardClass,
    anchorAddress: f.anchorAddress,
    blockedAddress: f.blockedAddress,
    mechanism: f.mechanism,
  });
  assert.deepEqual(bare.findings.map(strip), corroborated.findings.map(strip));
});

test("hazard evidence: building the same input with the observation field absent entirely and with it present but empty produces deeply equal reports", () => {
  const { bytes, origin } = loadPrg(SMC_PRG_PATH);
  const absent = buildHazardReport({ bytes, origin });
  const emptyArray = buildHazardReport({ bytes, origin, execObservations: [] });
  assert.deepEqual(absent, emptyArray);
});

test("hazard evidence: observations covering addresses where no finding exists add no finding and change no count", () => {
  const { bytes, origin } = loadPrg(TRACER_PRG_PATH);
  const bare = buildHazardReport({ bytes, origin });
  assert.deepEqual(bare.findings, [], "precondition: the negative-control fixture must produce zero findings");
  const withObservations = buildHazardReport({
    bytes,
    origin,
    execObservations: [
      { id: 1, imageSha256: "x", argvDigest: "y", seed: "z", address: origin, sourceBank: "ram" },
      { id: 2, imageSha256: "x", argvDigest: "y", seed: "z", address: origin + bytes.length - 1, sourceBank: "ram" },
    ],
  });
  assert.deepEqual(withObservations.findings, []);
  assert.equal(withObservations.denominator, bare.denominator);
});

test("hazard evidence: the module's source contains no arithmetic over the never-observed population -- no identifier containing 'neverObserved' and no field computed as a covered-minus-observed difference", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.ok(!/neverObserved/i.test(source), "the module must never define a never-observed identifier or count");
  assert.ok(
    !/observedAddresses\s*\.\s*size\s*-|-\s*observedAddresses\s*\.\s*size/.test(source),
    "no field may be computed as a difference against the observed-address count",
  );
});

test("hazard evidence: a finding whose anchor carries an observation reports the corroborated strength token and the runtime-observed corroboration field; one whose anchor carries none reports its static token and the none corroboration field", () => {
  // Two independent self-modifying-code findings at two distinct anchors:
  // host A's opcode byte at $0800, host B's opcode byte at $0806.
  const bytes = new Uint8Array([
    0xea, // 0800 nop (host A)
    0xa9, 0x60, // 0801 lda #$60
    0x8d, 0x00, 0x08, // 0803 sta $0800 (writer A -> opcode-byte hit at $0800)
    0xea, // 0806 nop (host B)
    0xa9, 0x61, // 0807 lda #$61
    0x8d, 0x06, 0x08, // 0809 sta $0806 (writer B -> opcode-byte hit at $0806)
  ]);
  const origin = 0x0800;
  const bare = buildHazardReport({ bytes, origin });
  assert.equal(bare.findings.length, 2, "precondition: the hand-built image must produce exactly two findings");

  const report = buildHazardReport({
    bytes,
    origin,
    execObservations: [{ id: 1, imageSha256: "x", argvDigest: "y", seed: "z", address: 0x0800, sourceBank: "ram" }],
  });
  const covered = report.findings.find((f) => f.anchorAddress === 0x0800)!;
  const uncovered = report.findings.find((f) => f.anchorAddress === 0x0806)!;
  assert.ok(covered && uncovered, "precondition: both findings must survive into the observed run");
  assert.equal(covered.strength, "observed-corroborated");
  assert.equal(covered.corroboration, "runtime-observed");
  assert.equal(uncovered.strength, "static-shape-matched");
  assert.equal(uncovered.corroboration, "none");
});

test("hazard evidence: the report's emitted limits contain an entry stating that an address never observed executing proves nothing about whether moving it is safe", () => {
  const neverObservedLimit = HAZARD_LIMITS.find(
    (l) => l.hazardClass === null && /never observed executing proves nothing/i.test(l.consequence),
  );
  assert.ok(neverObservedLimit, "HAZARD_LIMITS must name the never-observed-proves-nothing limit");
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
