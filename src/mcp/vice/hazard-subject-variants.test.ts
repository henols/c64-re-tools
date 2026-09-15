#!/usr/bin/env node
// hazard-subject-variants.test.ts -- assertions over the two subject
// VARIANTS plan 50-02 adds: the regressed twin (a red control for the
// cross-binary comparison instrument) and the modified subject (the
// material for ROADMAP criterion 4).
//
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// `hazard-subject-fixture.test.ts` already asserts the committed subject and
// its mis-aligned twin. This is a SEPARATE file, not an extension of that
// one, because these two new images serve a different purpose: they are not
// more coverage of the SAME subject, they are the two variants the rest of
// Phase 50 measures a cross-binary comparison AGAINST. Every assertion here
// names the byte-level construction the fixture's source actually contains
// or the address a real ACME symbol resolves to, never a detector's opinion
// of either -- the same evidence discipline the sibling file already
// establishes.
//
// GATE
// ---------------------------------------------------------------------------
// Exactly one test always runs and is never skipped: "ACME availability
// gate". With `VICE_REQUIRE_ACME` set (CI's Test step) a missing ACME FAILS
// that test. Locally, with no ACME on PATH, every other ACME-dependent test
// skips with a named reason computed ONCE by the shared `acme-gate.ts` seam.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { decode, type Instruction } from "./disasm-decoder.ts";
import type { StoreExportDocument } from "./anno-store-export.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, "fixtures", "hazard-subject");
const PRG_PATH = join(FIXTURE_DIR, "hazard-subject.prg");
const REGRESSED_PRG_PATH = join(FIXTURE_DIR, "hazard-subject-regressed.prg");
const MODIFIED_PRG_PATH = join(FIXTURE_DIR, "hazard-subject-modified.prg");
const MODIFIED_ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject-modified.annostore.json");
const ANNOSTORE_PATH = join(FIXTURE_DIR, "hazard-subject.annostore.json");
const ROOT_SOURCE_NAME = "hazard-subject.a";
const ALIGN_NOSPRITE_SOURCE_NAME = "hazard-subject-align-nosprite.a";

const SKIP_REASON = acmeSkipReasonFor("hazard-subject-variants.test.ts");

test("ACME availability gate", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

/** Splits a committed `.prg`'s two-byte little-endian load address from its
 * payload, the same way every consumer in this tree does. */
function loadPrg(path: string): { bytes: Uint8Array; origin: number } {
  const raw = readFileSync(path);
  const origin = raw[0]! | (raw[1]! << 8);
  return { bytes: new Uint8Array(raw.subarray(2)), origin };
}

/** Population count -- the number of set bits in an XOR value. */
function popcount(n: number): number {
  let count = 0;
  let v = n;
  while (v !== 0) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
}

/** Every byte offset (relative to `origin`) where `a` and `b` differ, with
 * the XOR value and its population count. */
function diffOffsets(a: Uint8Array, b: Uint8Array): { offset: number; xor: number; bits: number }[] {
  assert.equal(a.length, b.length, "images being diffed must have equal length -- a length mismatch is not a byte-level diff");
  const diffs: { offset: number; xor: number; bits: number }[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const xor = a[i]! ^ b[i]!;
      diffs.push({ offset: i, xor, bits: popcount(xor) });
    }
  }
  return diffs;
}

/** Decodes exactly one instruction starting at absolute `address`, the same
 * "decode from the target offset, not from the image start" discipline
 * `hazard-subject-fixture.test.ts`'s own `isLegalInstructionStart()` uses --
 * walking from `origin` through a data region (the BASIC stub, a table)
 * would desynchronize the instruction stream before reaching the target. */
function instructionAt(bytes: Uint8Array, origin: number, address: number): Instruction | undefined {
  if (address < origin) return undefined;
  const offset = address - origin;
  if (offset < 0 || offset >= bytes.length) return undefined;
  return decode(bytes.subarray(offset), address, { count: 1 })[0];
}

/** Assembles `rootSourceName` fresh into a throwaway directory with a
 * symbol list, never touching a committed image. Same discipline as
 * `hazard-subject-fixture.test.ts`'s `assembleFreshWithSymbols()`. */
function assembleFreshWithSymbols(rootSourceName: string): { bytes: Uint8Array; symbols: Map<string, number> } {
  const dir = mkdtempSync(join(tmpdir(), "hazard-subject-variants-"));
  try {
    const outPath = join(dir, "out.prg");
    const symPath = join(dir, "out.sym");
    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", "cbm", "-o", outPath, "--symbollist", symPath, rootSourceName], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: FIXTURE_DIR,
    });
    assert.equal(r.status, 0, `${rootSourceName} must assemble:\n  stderr: ${r.stderr ?? ""}`);
    assert.equal(existsSync(outPath), true, "ACME must write an output file");
    assert.equal(existsSync(symPath), true, "ACME must write a symbol list file");
    const symbols = new Map<string, number>();
    for (const line of readFileSync(symPath, "utf8").split("\n")) {
      const m = line.match(/^\s*(\S+)\s*=\s*\$([0-9a-fA-F]+)/);
      if (m) symbols.set(m[1]!, parseInt(m[2]!, 16));
    }
    return { bytes: new Uint8Array(readFileSync(outPath)), symbols };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Builds the regressed twin's root text the same way
 * `make-hazard-subject-fixtures.mjs`'s `regressedRootSource()` does, so the
 * test's own fresh assembly and the committed generator agree on what root
 * text produces `hazard-subject-regressed.prg`. */
function regressedRootSourceText(): string {
  let rootText = readFileSync(join(FIXTURE_DIR, ROOT_SOURCE_NAME), "utf8");
  const dispatchLine = '!source "hazard-subject-dispatch.a"';
  const dispatchRegressedLine = '!source "hazard-subject-dispatch-regressed.a"';
  const alignLine = '!source "hazard-subject-align.a"';
  const alignRegressedLine = '!source "hazard-subject-align-regressed.a"';
  assert.ok(rootText.includes(dispatchLine), `precondition: root must contain ${JSON.stringify(dispatchLine)}`);
  assert.ok(rootText.includes(alignLine), `precondition: root must contain ${JSON.stringify(alignLine)}`);
  rootText = rootText.replace(dispatchLine, dispatchRegressedLine).replace(alignLine, alignRegressedLine);
  return rootText;
}

function assembleRegressedFreshWithSymbols(): { bytes: Uint8Array; symbols: Map<string, number> } {
  const dir = mkdtempSync(join(tmpdir(), "hazard-subject-variants-regressed-"));
  try {
    const rootPath = join(dir, "synthesized-regressed-root.a");
    writeFileSync(rootPath, regressedRootSourceText());
    const outPath = join(dir, "out.prg");
    const symPath = join(dir, "out.sym");
    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", "cbm", "-o", outPath, "--symbollist", symPath, rootPath], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: FIXTURE_DIR,
    });
    assert.equal(r.status, 0, `the synthesized regressed root must assemble:\n  stderr: ${r.stderr ?? ""}`);
    assert.equal(existsSync(outPath), true, "ACME must write an output file");
    assert.equal(existsSync(symPath), true, "ACME must write a symbol list file");
    const symbols = new Map<string, number>();
    for (const line of readFileSync(symPath, "utf8").split("\n")) {
      const m = line.match(/^\s*(\S+)\s*=\s*\$([0-9a-fA-F]+)/);
      if (m) symbols.set(m[1]!, parseInt(m[2]!, 16));
    }
    return { bytes: new Uint8Array(readFileSync(outPath)), symbols };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// The regressed twin -- red control for the cross-binary comparison
// instrument, three single-bit regressions at $D020, $D015 and $D018.
// ---------------------------------------------------------------------------

test("hazard subject variants: hazard-subject-regressed.prg exists and is tracked by git", () => {
  assert.ok(existsSync(REGRESSED_PRG_PATH), "hazard-subject-regressed.prg must be committed");
  const ls = spawnSync("git", ["ls-files", "--error-unmatch", REGRESSED_PRG_PATH], { encoding: "utf8", cwd: FIXTURE_DIR });
  assert.equal(ls.status, 0, "hazard-subject-regressed.prg must be a tracked file, not merely present on disk");
});

test("hazard subject variants: the regressed image and the committed subject have identical byte length", () => {
  const original = readFileSync(PRG_PATH);
  const regressed = readFileSync(REGRESSED_PRG_PATH);
  assert.equal(regressed.length, original.length, "planting only single-bit regressions must never change the image length");
});

test("hazard subject variants: the regressed image differs from the committed subject at exactly three byte offsets, each a single-bit change", () => {
  const original = readFileSync(PRG_PATH);
  const regressed = readFileSync(REGRESSED_PRG_PATH);
  const diffs = diffOffsets(new Uint8Array(original), new Uint8Array(regressed));
  assert.equal(diffs.length, 3, `expected exactly 3 differing byte offsets, found ${diffs.length}: ${JSON.stringify(diffs)}`);
  for (const d of diffs) {
    assert.equal(d.bits, 1, `offset ${d.offset} must differ by exactly one bit, XOR was $${d.xor.toString(16)} (${d.bits} bits)`);
  }
});

test(
  "hazard subject variants: the three regressed differences map one-to-one onto stores targeting $D020, $D015 and $D018, resolved by decoding the image",
  { skip: SKIP_REASON },
  () => {
    const { bytes, origin } = loadPrg(REGRESSED_PRG_PATH);
    const { bytes: originalRaw } = loadPrg(PRG_PATH);
    const diffs = diffOffsets(originalRaw, bytes);
    assert.equal(diffs.length, 3, "precondition: exactly three differing offsets");

    const targetRegisters = new Set<number>();
    for (const d of diffs) {
      const diffAddress = origin + d.offset;
      const storeAddress = diffAddress + 1;
      const instruction = instructionAt(bytes, origin, storeAddress);
      assert.ok(instruction, `no decodable instruction begins immediately after the differing byte at $${diffAddress.toString(16)}`);
      assert.equal(instruction!.mnemonic, "sta", `the instruction immediately after $${diffAddress.toString(16)} must be a store (sta), found ${instruction!.mnemonic}`);
      assert.ok(instruction!.operand, "a store instruction must carry an operand");
      const target = instruction!.operand!.value;
      assert.ok(
        target === 0xd020 || target === 0xd015 || target === 0xd018,
        `store target $${target.toString(16)} at $${storeAddress.toString(16)} is not one of $D020/$D015/$D018`,
      );
      targetRegisters.add(target);
    }
    assert.equal(targetRegisters.size, 3, "the three differences must map onto three DISTINCT registers, not the same register three times");
    assert.deepEqual(
      [...targetRegisters].sort((a, b) => a - b),
      [0xd015, 0xd018, 0xd020],
      "the three regressed differences must together cover exactly $D015, $D018 and $D020",
    );
  },
);

test("hazard subject variants: REGENERATOR AGREEMENT (regressed twin) -- re-deriving the synthesized root reproduces the committed hazard-subject-regressed.prg byte-for-byte", { skip: SKIP_REASON }, () => {
  const { bytes } = assembleRegressedFreshWithSymbols();
  assert.deepEqual(
    [...bytes],
    [...new Uint8Array(readFileSync(REGRESSED_PRG_PATH))],
    "the synthesized regressed root and hazard-subject-regressed.prg have drifted apart; regenerate with " +
      "`cd src/mcp/vice && node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs`.",
  );
});

test("hazard subject variants: make-hazard-subject-fixtures.mjs contains exactly one implementation of the !source line substitution", () => {
  const generatorSource = readFileSync(join(FIXTURE_DIR, "make-hazard-subject-fixtures.mjs"), "utf8");
  const helperDefinitions = generatorSource.match(/function substituteSourceLines\(/g) ?? [];
  assert.equal(helperDefinitions.length, 1, "exactly one substituteSourceLines() implementation must exist");
  const helperCalls = generatorSource.match(/substituteSourceLines\(\[/g) ?? [];
  assert.ok(helperCalls.length >= 3, "the mis-aligned twin, the regressed twin and the modified subject must all call the shared substitution helper");
});

// ---------------------------------------------------------------------------
// The modified subject -- one behaviour removed (the sprite construction),
// one behaviour added (the second self-modifying construction), each
// cross-referenced to a named committed hazard-report finding. Material
// for ROADMAP criterion 4.
// ---------------------------------------------------------------------------

/** Builds the modified subject's root text the same way
 * `make-hazard-subject-fixtures.mjs`'s `modifiedRootSource()` does. */
function modifiedRootSourceText(): string {
  const rootText = readFileSync(join(FIXTURE_DIR, ROOT_SOURCE_NAME), "utf8");
  const alignLine = '!source "hazard-subject-align.a"';
  const nospriteLine = `!source "${ALIGN_NOSPRITE_SOURCE_NAME}"`;
  assert.ok(rootText.includes(alignLine), `precondition: root must contain ${JSON.stringify(alignLine)}`);
  return rootText.replace(alignLine, nospriteLine);
}

function assembleModifiedFreshWithSymbols(): { bytes: Uint8Array; symbols: Map<string, number> } {
  const dir = mkdtempSync(join(tmpdir(), "hazard-subject-variants-modified-"));
  try {
    const rootPath = join(dir, "synthesized-modified-root.a");
    writeFileSync(rootPath, modifiedRootSourceText());
    const outPath = join(dir, "out.prg");
    const symPath = join(dir, "out.sym");
    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", "cbm", "-o", outPath, "--symbollist", symPath, rootPath], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: FIXTURE_DIR,
    });
    assert.equal(r.status, 0, `the synthesized modified root must assemble:\n  stderr: ${r.stderr ?? ""}`);
    assert.equal(existsSync(outPath), true, "ACME must write an output file");
    assert.equal(existsSync(symPath), true, "ACME must write a symbol list file");
    const symbols = new Map<string, number>();
    for (const line of readFileSync(symPath, "utf8").split("\n")) {
      const m = line.match(/^\s*(\S+)\s*=\s*\$([0-9a-fA-F]+)/);
      if (m) symbols.set(m[1]!, parseInt(m[2]!, 16));
    }
    return { bytes: new Uint8Array(readFileSync(outPath)), symbols };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("hazard subject variants: hazard-subject-modified.prg exists and is tracked by git", () => {
  assert.ok(existsSync(MODIFIED_PRG_PATH), "hazard-subject-modified.prg must be committed");
  const ls = spawnSync("git", ["ls-files", "--error-unmatch", MODIFIED_PRG_PATH], { encoding: "utf8", cwd: FIXTURE_DIR });
  assert.equal(ls.status, 0, "hazard-subject-modified.prg must be a tracked file, not merely present on disk");
});

test("hazard subject variants: the modified image and the committed subject have equal byte length", () => {
  const original = readFileSync(PRG_PATH);
  const modified = readFileSync(MODIFIED_PRG_PATH);
  assert.equal(modified.length, original.length, "the !align $7ff, 0 directive after hazard_align_entry must absorb the code shrinkage");
});

test(
  "hazard subject variants: every differing byte offset between the modified image and the committed subject lies inside the alignment routine's own range, both bounds resolved from real ACME symbols",
  { skip: SKIP_REASON },
  () => {
    const { symbols } = assembleFreshWithSymbols(ROOT_SOURCE_NAME);
    const alignEntry = symbols.get("hazard_align_entry");
    const charBase = symbols.get("align_char_base");
    assert.ok(alignEntry !== undefined, "hazard_align_entry must be a real symbol in the committed subject");
    assert.ok(charBase !== undefined, "align_char_base must be a real symbol in the committed subject");

    const original = readFileSync(PRG_PATH);
    const modified = readFileSync(MODIFIED_PRG_PATH);
    const diffs = diffOffsets(new Uint8Array(original), new Uint8Array(modified));
    assert.ok(diffs.length > 0, "the modified subject must actually differ from the committed subject");

    const origin = original[0]! | (original[1]! << 8);
    for (const d of diffs) {
      const address = origin + d.offset;
      assert.ok(
        address >= alignEntry! && address < charBase!,
        `differing byte at $${address.toString(16)} lies outside [hazard_align_entry $${alignEntry!.toString(16)}, align_char_base $${charBase!.toString(16)})`,
      );
    }
  },
);

test(
  "hazard subject variants: the modified image contains a jsr to hazard_smc2_entry, and the committed subject contains none",
  { skip: SKIP_REASON },
  () => {
    const { symbols: modifiedSymbols } = assembleModifiedFreshWithSymbols();
    const smc2Entry = modifiedSymbols.get("hazard_smc2_entry");
    assert.ok(smc2Entry !== undefined, "hazard_smc2_entry must be a real symbol");

    const modified = loadPrg(MODIFIED_PRG_PATH);
    const modifiedInstructions = decode(modified.bytes, modified.origin);
    const modifiedJsrToSmc2 = modifiedInstructions.filter((i) => i.mnemonic === "jsr" && i.resolvedTarget === smc2Entry);
    assert.ok(modifiedJsrToSmc2.length >= 1, "the modified image must contain a jsr to hazard_smc2_entry");

    const original = loadPrg(PRG_PATH);
    const originalInstructions = decode(original.bytes, original.origin);
    const originalJsrToSmc2 = originalInstructions.filter((i) => i.mnemonic === "jsr" && i.resolvedTarget === smc2Entry);
    assert.equal(originalJsrToSmc2.length, 0, "the committed subject must contain no jsr to hazard_smc2_entry");
  },
);

test(
  "hazard subject variants: the modified image contains no store to $D015, and the committed subject contains exactly one",
  { skip: SKIP_REASON },
  () => {
    const modified = loadPrg(MODIFIED_PRG_PATH);
    const modifiedInstructions = decode(modified.bytes, modified.origin);
    const modifiedD015Stores = modifiedInstructions.filter((i) => i.mnemonic === "sta" && i.operand?.value === 0xd015);
    assert.equal(modifiedD015Stores.length, 0, "the modified image must contain zero stores to $D015");

    const original = loadPrg(PRG_PATH);
    const originalInstructions = decode(original.bytes, original.origin);
    const originalD015Stores = originalInstructions.filter((i) => i.mnemonic === "sta" && i.operand?.value === 0xd015);
    assert.equal(originalD015Stores.length, 1, "the committed subject must contain exactly one store to $D015");
  },
);

test("hazard subject variants: REGENERATOR AGREEMENT (modified subject) -- re-deriving the synthesized root reproduces the committed hazard-subject-modified.prg byte-for-byte", { skip: SKIP_REASON }, () => {
  const { bytes } = assembleModifiedFreshWithSymbols();
  assert.deepEqual(
    [...bytes],
    [...new Uint8Array(readFileSync(MODIFIED_PRG_PATH))],
    "the synthesized modified root and hazard-subject-modified.prg have drifted apart; regenerate with " +
      "`cd src/mcp/vice && node fixtures/hazard-subject/make-hazard-subject-fixtures.mjs`.",
  );
});

test("hazard subject variants: hazard-subject-align-nosprite.a names both required finding anchors in its header", () => {
  const source = readFileSync(join(FIXTURE_DIR, "hazard-subject-align-nosprite.a"), "utf8");
  assert.ok(/088B/i.test(source), "must name anchor $088B (page-alignment, sprite-pointer-names-aligned-base)");
  assert.ok(/0825/i.test(source), "must name anchor $0825 (self-modifying-code, store-target-in-instruction-opcode-byte)");
});

// ---------------------------------------------------------------------------
// The modified annotation-store export -- derived by the existing generator
// from real ACME symbol addresses, never hand-typed.
// ---------------------------------------------------------------------------

function loadExport(path: string): StoreExportDocument {
  return JSON.parse(readFileSync(path, "utf8")) as StoreExportDocument;
}

test("hazard subject variants: hazard-subject-modified.annostore.json exists and is tracked by git", () => {
  assert.ok(existsSync(MODIFIED_ANNOSTORE_PATH), "hazard-subject-modified.annostore.json must be committed");
  const ls = spawnSync("git", ["ls-files", "--error-unmatch", MODIFIED_ANNOSTORE_PATH], { encoding: "utf8", cwd: FIXTURE_DIR });
  assert.equal(ls.status, 0, "hazard-subject-modified.annostore.json must be a tracked file, not merely present on disk");
});

test("hazard subject variants: the modified export's ranges partition the modified image with no hole and no overlap", () => {
  const doc = loadExport(MODIFIED_ANNOSTORE_PATH);
  const { origin, bytes } = loadPrg(MODIFIED_PRG_PATH);
  const imageEndInclusive = origin + bytes.length - 1;

  const sorted = [...doc.ranges].sort((a, b) => a.start - b.start);
  assert.ok(sorted.length > 0, "the modified export must declare at least one range");
  assert.equal(sorted[0]!.start, origin, `the first range must start at the image origin $${origin.toString(16)}`);

  let expected = origin;
  for (const r of sorted) {
    assert.equal(r.start, expected, `range gap or overlap at $${expected.toString(16)}..$${(r.start - 1).toString(16)}`);
    assert.ok(r.endInclusive >= r.start, `range ${r.start}..${r.endInclusive} must not be inverted`);
    expected = r.endInclusive + 1;
  }
  assert.equal(expected, imageEndInclusive + 1, `the ranges must cover through the image end $${imageEndInclusive.toString(16)}; coverage stopped at $${(expected - 1).toString(16)}`);
});

test("hazard subject variants: the modified export carries the same number of scopes as the committed export", () => {
  const modifiedDoc = loadExport(MODIFIED_ANNOSTORE_PATH);
  const committedDoc = loadExport(ANNOSTORE_PATH);
  assert.equal(modifiedDoc.scopes?.length ?? 0, committedDoc.scopes?.length ?? 0, "the modification removes no hazard-bearing routine, so the scope count must be unchanged");
});

test(
  "hazard subject variants: the modified export's hazard_align_entry label resolves to the same address as the modified image's own decoded alignment-routine start",
  { skip: SKIP_REASON },
  () => {
    const doc = loadExport(MODIFIED_ANNOSTORE_PATH);
    const label = doc.labels.find((l) => l.name === "hazard_align_entry");
    assert.ok(label, "the modified export must declare a hazard_align_entry label");

    const { symbols } = assembleModifiedFreshWithSymbols();
    const assembledAddress = symbols.get("hazard_align_entry");
    assert.ok(assembledAddress !== undefined, "hazard_align_entry must be a real symbol in the modified image");
    assert.equal(label!.address, assembledAddress, "the export's hazard_align_entry label address must match the modified image's own assembled address");

    const { bytes, origin } = loadPrg(MODIFIED_PRG_PATH);
    const instruction = instructionAt(bytes, origin, assembledAddress!);
    assert.ok(instruction, `hazard_align_entry's address $${assembledAddress!.toString(16)} must decode as a real instruction start in the modified image`);
  },
);

test("hazard subject variants: make-hazard-subject-annostore.mjs contains exactly one copy of the decomposition arrays, shared by both subjects", () => {
  const generatorSource = readFileSync(join(FIXTURE_DIR, "make-hazard-subject-annostore.mjs"), "utf8");
  const rangesDeclarations = generatorSource.match(/const ranges = \[/g) ?? [];
  assert.equal(rangesDeclarations.length, 1, "exactly one `ranges` decomposition array must exist");
  const scopesDeclarations = generatorSource.match(/const scopes = \[/g) ?? [];
  assert.equal(scopesDeclarations.length, 1, "exactly one `scopes` decomposition array must exist");
  const subjectsDeclarations = generatorSource.match(/const SUBJECTS = \[/g) ?? [];
  assert.equal(subjectsDeclarations.length, 1, "exactly one SUBJECTS array must declare the two subjects sharing this decomposition");
});

test("hazard subject variants: the committed hazard-subject.annostore.json is unchanged by the annostore generator's parameterisation", () => {
  // This is a REGRESSION guard, not a regeneration -- it reads the
  // committed file as-is and checks internal self-consistency the
  // parameterisation must have preserved (16 ranges / 5 scopes / 22 labels,
  // the same counts `make-hazard-subject-annostore.mjs`'s own stdout
  // reports for the first SUBJECTS entry).
  const doc = loadExport(ANNOSTORE_PATH);
  assert.equal(doc.ranges.length, 16, "the committed original export's range count must be unchanged by parameterisation");
  assert.equal(doc.scopes?.length ?? 0, 5, "the committed original export's scope count must be unchanged by parameterisation");
  assert.equal(doc.labels.length, 22, "the committed original export's label count must be unchanged by parameterisation");
});
