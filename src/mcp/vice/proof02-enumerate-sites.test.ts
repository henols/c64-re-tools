// proof02-enumerate-sites.test.ts -- unit tests for proof02-enumerate-sites.mjs,
// the Ghidra-independent candidate indirect-dispatch site enumerator (plan 38-03).
//
// Gap G1 coverage (7 behavioral requirements):
//   a) The immediate-index positive control classifies as immediate-index
//   b) A genuine computed-index shape classifies as computed-index (not immediate)
//   c) Bare jmp ($fb) with no pointer write classifies as vector or unknown
//   d) decodeForward() / length table: known NMOS opcode lengths decode correctly
//   e) backwardAlignedInstructions() keeps the realignment using MOST of the window
//   f) enumerateSites() is deterministic: same input twice → deep-equal output
//   g) Only DIRECT STA forms ($85 zp, $8D abs) count as pointer writes
//
// This file reads the module at line 541's export and exercises its pure functions
// over hand-constructed byte sequences, never hitting the filesystem or spawning
// a process.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(repoRoot({ from: HERE }), ".planning", "phases", "38-proof-01-03-on-real-cracked-code", "evidence", "proof02-enumerate-sites.mjs");

// Dynamically import the module under test to avoid loading it during test discovery.
let moduleExports: any = null;

async function loadModule() {
  if (moduleExports === null) {
    moduleExports = await import(MODULE_PATH);
  }
  return moduleExports;
}

// =============================================================================
// Behavior (a): The immediate-index positive control classifies as immediate-index
// =============================================================================
//
// The pivot fixture's own shape: `ldx #$02 / lda disp_lo,x / sta $fb / lda disp_hi,x / sta $fc / jmp ($fb)`
// This is a loaded immediate index in X, followed by indexed loads that feed the pointer bytes,
// followed by direct STA writes to $fb/$fc, then indirect dispatch through ($fb).

test("(a) immediate-index control: ldx #$02 / lda disp_lo,x / sta $fb / lda disp_hi,x / sta $fc / jmp ($fb) classifies as immediate-index", async (t) => {
  const mod = await loadModule();

  // Build the byte sequence for the immediate-index pattern.
  // We'll place it at $0801 (BASIC load address) and put the jmp ($fb) at offset 18.
  // ldx #$02 = A2 02
  const ldx_imm_02 = [0xa2, 0x02];
  // lda disp_lo,x (dxa's listing has some dispatch table) = BD xx yy
  const lda_abs_x = [0xbd, 0x00, 0x10]; // Example dispatch table at $1000+
  // sta $fb = 85 fb
  const sta_zp_fb = [0x85, 0xfb];
  // lda disp_hi,x = BD xx yy
  const lda_abs_x_hi = [0xbd, 0x00, 0x11];
  // sta $fc = 85 fc
  const sta_zp_fc = [0x85, 0xfc];
  // jmp ($fb) = 6C FB 00
  const jmp_ind_fb = [0x6c, 0xfb, 0x00];

  const body = new Uint8Array([
    ...ldx_imm_02,
    ...lda_abs_x,
    ...sta_zp_fb,
    ...lda_abs_x_hi,
    ...sta_zp_fc,
    ...jmp_ind_fb,
  ]);

  const jmpOffset = ldx_imm_02.length + lda_abs_x.length + sta_zp_fb.length + lda_abs_x_hi.length + sta_zp_fc.length;
  const pointer = 0x00fb; // The operand of jmp ($fb) is $FB 00 = $00FB

  const result = mod.classifySite(body, jmpOffset, pointer);

  assert.equal(result.classification, "immediate-index", `Expected immediate-index, got ${result.classification}; reason: ${result.reason}`);
});

// =============================================================================
// Behavior (b): A genuine computed-index discriminates (not immediate)
// =============================================================================
//
// Instead of LDX #imm, we load X from memory (e.g., LDX $2000), which makes the
// index register value computed, not immediate. This must discriminate as computed-index.

test("(b) computed-index: ldx $mem / lda disp_lo,x / sta $fb / jmp ($fb) classifies as computed-index, not immediate-index", async (t) => {
  const mod = await loadModule();

  // ldx $2000 (0xAE is LDX abs) = AE 00 20
  const ldx_mem = [0xae, 0x00, 0x20];
  // lda disp_lo,x = BD xx yy
  const lda_abs_x = [0xbd, 0x00, 0x10];
  // sta $fb = 85 fb
  const sta_zp_fb = [0x85, 0xfb];
  // lda disp_hi,x = BD xx yy
  const lda_abs_x_hi = [0xbd, 0x00, 0x11];
  // sta $fc = 85 fc
  const sta_zp_fc = [0x85, 0xfc];
  // jmp ($fb) = 6C FB 00
  const jmp_ind_fb = [0x6c, 0xfb, 0x00];

  const body = new Uint8Array([
    ...ldx_mem,
    ...lda_abs_x,
    ...sta_zp_fb,
    ...lda_abs_x_hi,
    ...sta_zp_fc,
    ...jmp_ind_fb,
  ]);

  const jmpOffset = ldx_mem.length + lda_abs_x.length + sta_zp_fb.length + lda_abs_x_hi.length + sta_zp_fc.length;
  const pointer = 0x00fb;

  const result = mod.classifySite(body, jmpOffset, pointer);

  assert.equal(result.classification, "computed-index", `Expected computed-index, got ${result.classification}; reason: ${result.reason}`);
});

// =============================================================================
// Behavior (c): Bare jmp ($fb) with no resolvable pointer write classifies as vector or unknown
// =============================================================================
//
// A JMP indirect with no preceding direct STA write to the pointer address
// inside the 48-byte window must be classified as vector or unknown.

test("(c) bare jmp with no pointer write: jmp ($fb) with no preceding sta to $fb/$fc classifies as vector or unknown", async (t) => {
  const mod = await loadModule();

  // Just fill with some harmless code (implied ops, no pointer write)
  // nop = EA (1 byte each)
  const nops = new Array(30).fill(0xea);
  // jmp ($fb) = 6C FB 00
  const jmp_ind_fb = [0x6c, 0xfb, 0x00];

  const body = new Uint8Array([...nops, ...jmp_ind_fb]);
  const jmpOffset = nops.length;
  const pointer = 0x00fb;

  const result = mod.classifySite(body, jmpOffset, pointer);

  // The result should be either "vector" or "unknown"; both are valid per the module's vocabulary.
  assert.ok(
    result.classification === "vector" || result.classification === "unknown",
    `Expected vector or unknown, got ${result.classification}; reason: ${result.reason}`,
  );
});

// =============================================================================
// Behavior (d): decodeForward() decodes NMOS instruction lengths correctly
// =============================================================================
//
// Test a variety of 1/2/3-byte opcodes to confirm the length table is correct.

test("(d) decodeForward: 1-byte implied opcodes", async (t) => {
  const mod = await loadModule();

  // NOP (0xEA) = 1 byte
  const body = new Uint8Array([0xea]);
  const list = mod.decodeForward(body, 0, 1);

  assert.ok(list !== null, "decodeForward should succeed");
  assert.equal(list.length, 1, "Should decode exactly 1 instruction");
  assert.equal(list[0].opcode, 0xea, "Opcode should be NOP");
  assert.equal(list[0].offset, 0, "Offset should be 0");
  assert.equal(list[0].operandLow, undefined, "1-byte opcode should have no operand");
});

test("(d) decodeForward: 2-byte immediate opcodes", async (t) => {
  const mod = await loadModule();

  // LDA #$42 (0xA9 42) = 2 bytes
  const body = new Uint8Array([0xa9, 0x42]);
  const list = mod.decodeForward(body, 0, 2);

  assert.ok(list !== null, "decodeForward should succeed");
  assert.equal(list.length, 1, "Should decode exactly 1 instruction");
  assert.equal(list[0].opcode, 0xa9, "Opcode should be LDA immediate");
  assert.equal(list[0].operandLow, 0x42, "Operand should be $42");
});

test("(d) decodeForward: 3-byte absolute opcodes", async (t) => {
  const mod = await loadModule();

  // LDA $1234 (0xAD 34 12) = 3 bytes (little-endian)
  const body = new Uint8Array([0xad, 0x34, 0x12]);
  const list = mod.decodeForward(body, 0, 3);

  assert.ok(list !== null, "decodeForward should succeed");
  assert.equal(list.length, 1, "Should decode exactly 1 instruction");
  assert.equal(list[0].opcode, 0xad, "Opcode should be LDA absolute");
  assert.equal(list[0].operandLow, 0x34, "Low byte should be $34");
  assert.equal(list[0].operandHigh, 0x12, "High byte should be $12");
});

test("(d) decodeForward: JMP $1234 (3-byte, 0x4C)", async (t) => {
  const mod = await loadModule();

  // JMP $5678 (0x4C 78 56) = 3 bytes
  const body = new Uint8Array([0x4c, 0x78, 0x56]);
  const list = mod.decodeForward(body, 0, 3);

  assert.ok(list !== null, "decodeForward should succeed");
  assert.equal(list[0].opcode, 0x4c, "Opcode should be JMP absolute");
});

test("(d) decodeForward: sequence of instructions", async (t) => {
  const mod = await loadModule();

  // LDA #$42 (0xA9 42) + TAX (0xAA) + NOP (0xEA)
  const body = new Uint8Array([0xa9, 0x42, 0xaa, 0xea]);
  const list = mod.decodeForward(body, 0, 4);

  assert.ok(list !== null, "decodeForward should succeed");
  assert.equal(list.length, 3, "Should decode exactly 3 instructions");
  assert.equal(list[0].opcode, 0xa9, "First: LDA immediate");
  assert.equal(list[1].opcode, 0xaa, "Second: TAX");
  assert.equal(list[2].opcode, 0xea, "Third: NOP");
});

// =============================================================================
// Behavior (e): backwardAlignedInstructions() uses the MOST of the window
// =============================================================================
//
// When multiple candidate realignments decode cleanly, the one using the MOST
// of the 48-byte window (smallest start offset) wins. This is deterministic
// and independent of iteration order.

test("(e) backwardAlignedInstructions: prefers largest (earliest-starting) valid decode", async (t) => {
  const mod = await loadModule();

  // Build a 50-byte sequence where multiple realignments are valid.
  // Offsets 0-29: valid decodable instructions
  // Offsets 30-48: might also decode validly, but we want the earliest win
  // Offset 50: the JMP site

  // Fill with valid 1-byte ops to create multiple decode paths
  const body = new Uint8Array(52);
  for (let i = 0; i < 48; i++) {
    body[i] = 0xea; // NOP, 1 byte each
  }
  // Offset 48-50: JMP ($fb) = 6C FB 00
  body[48] = 0x6c;
  body[49] = 0xfb;
  body[50] = 0x00;

  const jmpOffset = 48;
  const list = mod.backwardAlignedInstructions(body, jmpOffset);

  assert.ok(list !== null, "Should find a valid decode");
  // The earliest valid start in a 48-byte window would be max(0, 48-48) = 0
  // and we should get all NOPs from 0-47 aligning perfectly on the JMP
  assert.equal(list[0].offset, 0, "Should start at offset 0 (earliest possible)");
  assert.equal(list.length, 48, "Should decode exactly 48 instructions (48 NOPs)");
});

// =============================================================================
// Behavior (f): enumerateSites() is deterministic
// =============================================================================
//
// Running enumerateSites() twice on the same body should produce byte-identical
// output (order-independent, no timestamps or env vars).

test("(f) enumerateSites: deterministic output, same input twice", async (t) => {
  const mod = await loadModule();

  // Build a simple body with a couple of JMP indirect sites
  const body = new Uint8Array([
    0xea, 0xea, 0xea, 0xea, // NOPs at 0-3
    0x6c, 0x10, 0x20,       // JMP ($2010) at offset 4 (site at $0801+4=$0805)
    0xea, 0xea, 0xea, 0xea, // NOPs at 7-10
    0x6c, 0xfb, 0x00,       // JMP ($00FB) at offset 11 (site at $0801+11=$080C)
  ]);

  const origin = 0x0801;

  // Run twice
  const result1 = mod.enumerateSites(body, origin);
  const result2 = mod.enumerateSites(body, origin);

  // Convert to JSON and compare (ensures deterministic serialization)
  const json1 = JSON.stringify(result1);
  const json2 = JSON.stringify(result2);

  assert.equal(json1, json2, "Two runs of enumerateSites should produce identical JSON output");
  assert.deepEqual(result1, result2, "Two runs should produce deep-equal results");
});

// =============================================================================
// Behavior (g): Only DIRECT STA forms count as pointer writes
// =============================================================================
//
// STA $85 (zp) and STA $8D (abs) are direct and count.
// STA $95 ($85,X), $9D ($8D,X), $99 ($8D,Y) are indexed and must NOT count.

test("(g) pointer writes: direct STA $85 (zp) counts, indexed STA $95 does not", async (t) => {
  const mod = await loadModule();

  // Case 1: Direct STA $85 should work as pointer write
  // ldx #$02 / lda disp_lo,x / sta $fb / jmp ($fb)
  const body1 = new Uint8Array([
    0xa2, 0x02,             // ldx #$02
    0xbd, 0x00, 0x10,       // lda $1000,x
    0x85, 0xfb,             // sta $fb (DIRECT, 2 bytes) — should count
    0x6c, 0xfb, 0x00,       // jmp ($fb)
  ]);
  const result1 = mod.classifySite(body1, body1.length - 3, 0xfb);
  assert.equal(result1.classification, "immediate-index", "Direct STA $85 should allow immediate-index classification");

  // Case 2: Indexed STA $95 should NOT work as pointer write
  // We'll build a sequence with only indexed STA, no direct STA
  // ldx #$02 / lda disp_lo,x / sta $fb,x / jmp ($fb)
  const body2 = new Uint8Array([
    0xa2, 0x02,             // ldx #$02
    0xbd, 0x00, 0x10,       // lda $1000,x
    0x95, 0xf9,             // sta $f9,x (INDEXED, 2 bytes) — should NOT count as pointer write to $fb
    0x6c, 0xfb, 0x00,       // jmp ($fb)
  ]);
  const result2 = mod.classifySite(body2, body2.length - 3, 0xfb);
  // With only an indexed STA and no direct STA, we should NOT get immediate-index
  assert.notEqual(result2.classification, "immediate-index", "Indexed STA $95 should NOT allow immediate-index classification");
});

test("(g) pointer writes: direct STA $8D (abs) counts", async (t) => {
  const mod = await loadModule();

  // ldx #$02 / lda disp_lo,x / sta $00fb / jmp ($fb)
  const body = new Uint8Array([
    0xa2, 0x02,             // ldx #$02
    0xbd, 0x00, 0x10,       // lda $1000,x
    0x8d, 0xfb, 0x00,       // sta $00fb (DIRECT, 3 bytes) — should count
    0x6c, 0xfb, 0x00,       // jmp ($fb)
  ]);
  const result = mod.classifySite(body, body.length - 3, 0xfb);
  assert.equal(result.classification, "immediate-index", "Direct STA $8D should allow immediate-index classification");
});
