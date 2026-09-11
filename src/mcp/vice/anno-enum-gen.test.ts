// anno-enum-gen.test.ts -- coverage for anno-enum-gen.ts (D-20/D-22/D-23,
// ANNO-13): the pinned variantNameFor() target, decoding totality across all
// 256 values for four registers, sanitization refusals, the adjacent-pair
// rule, D-20's one-variant-per-distinct-value plan, and the truncation-signal
// wording contract.
//
// WHAT CHANGED HERE (plan 29-10, D-01, 2026-08-30). This file used to end in
// four blocks that drove a real external analyser child: an UNGATED
// availability assertion that ran on every suite invocation, and three
// environment-gated integration tests. All four are GONE, not skipped and not
// converted to `todo` -- D-01's own words are that the retired integration
// must "never be included in any tests", and a gated block whose subject no
// longer exists is still a test that includes it. Their imports (the
// availability-gate module and the project-file synthesiser) were deleted in
// the same commit, so the file would have failed at load time regardless.
//
// THE COVERAGE DID NOT GO WITH THEM. Every assertion those blocks made about
// this module's OWN logic is now made against the real extracted functions
// rather than against a synthetic reconstruction of their shape:
//   - the adjacent-pair arithmetic used to be re-derived inline here, in a
//     test whose own comment said it could not call the real function because
//     that function needed a live child. It calls `pairSearchRows()` now.
//   - the truncation wording used to be rebuilt line by line here, for the
//     same reason. It calls `buildEnumGenerationReport()` now.
//   - the per-register enum plan (D-20's one-variant-per-distinct-value rule)
//     was only ever exercised through the live pipeline. It is unit-tested
//     here now, against `planEnumsForPairing()`.
// Two assertions were DELETED rather than re-pointed, and neither was
// weakened to keep it green: the spy-binary zero-spawn proof (its subject was
// the deleted installer's first child spawn -- the client-side refusal it
// proved is still asserted directly, below, against `sanitizeVariantMap()`),
// and the grep asserting the two disassembly-search call sites passed an
// explicit `max_results` (those call sites are the fetch this plan removed;
// the "no silent caps" rule they served is asserted against the report
// builder instead). Restoring the fetch and the installer -- and with them the
// integration coverage those two assertions covered -- is work NO PHASE
// CURRENTLY OWNS. An earlier version of this line named a numbered phase for
// it; the phase it named rebuilt the ACME export route only, and this line is
// corrected rather than deleted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertLegalAcmeIdentifier,
  buildEnumGenerationReport,
  DEFAULT_MAX_RESULTS,
  decomposeRegisterValue,
  type DisasmSearchRow,
  type EnumInstallSummary,
  type RegisterDecomposition,
  __resetRegBitsCacheForTests,
  pairSearchRows,
  parseImmediateOperand,
  planEnumsForPairing,
  registerKeyFor,
  sanitizeVariantMap,
  variantNameFor,
} from "./anno-enum-gen.ts";
import type { RegBitsTable } from "./anno-regbits-gen.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Builds one disassembly row in the shape the deleted fetch returned and the
 * shape any rebuilt fetch must still produce. */
function row(addr: number, mnemonic: string, operand: string): DisasmSearchRow {
  return {
    address: `$${addr.toString(16).toUpperCase().padStart(4, "0")}`,
    address_decimal: addr,
    label: "",
    mnemonic,
    operand,
    comment: "",
  };
}

// ---------------------------------------------------------------------------
// The pinned measured target.
// ---------------------------------------------------------------------------

test("variantNameFor(0xd011, 0x1b) === 'YSCROLL3_ROW25_SCREENON_TEXT' (the pinned criterion-3 target)", () => {
  assert.equal(variantNameFor(0xd011, 0x1b), "YSCROLL3_ROW25_SCREENON_TEXT");
});

test("registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)", () => {
  assert.equal(registerKeyFor(0xd011), "$D011");
  assert.equal(registerKeyFor(1), "$0001");
});

// ---------------------------------------------------------------------------
// Decoding is total: two distinct values for the same register never produce
// the same variant name, checked across all 256 possible byte values.
// ---------------------------------------------------------------------------

for (const addr of [0xd011, 0xd016, 0xd018, 0xd015]) {
  test(`variantNameFor is injective across all 256 values for $${addr.toString(16).toUpperCase()}`, () => {
    const seen = new Map<string, number>();
    for (let value = 0; value <= 0xff; value++) {
      const name = variantNameFor(addr, value);
      assert.ok(name.length > 0, `value 0x${value.toString(16)} produced an empty variant name`);
      const prior = seen.get(name);
      assert.equal(
        prior,
        undefined,
        `values 0x${prior?.toString(16)} and 0x${value.toString(16)} both produced the name "${name}"`,
      );
      seen.set(name, value);
    }
    assert.equal(seen.size, 256);
  });
}

// ---------------------------------------------------------------------------
// Task 1 (D-16/D-17): decomposeRegisterValue() -- the ONE owning multi-bit
// decoder. Loads the SAME committed anno-regbits.json this module loads
// (via the file-read helper below), so the exhaustive checks run against
// every register the real committed table carries, not a hand-picked
// subset.
// ---------------------------------------------------------------------------

const REGBITS_TABLE_RAW = JSON.parse(readFileSync(join(HERE, "anno-regbits.json"), "utf8")) as Record<string, unknown>;
const ALL_REGISTER_KEYS = Object.keys(REGBITS_TABLE_RAW).filter((k) => k !== "_generated");

test("decomposeRegisterValue(0xd018, 0x04) returns one term per $D018 field, in ascending bit order, matching the pinned criterion-5 fixture", () => {
  const decomposition = decomposeRegisterValue(0xd018, 0x04);
  assert.deepEqual(
    decomposition.terms.map((t) => [t.name, t.value]),
    [
      ["D018_SELECT_UPPER_LOWER_CHARACTER_SET0", 0x00],
      ["D018_CHARACTER_DOT_DATA_BASE_ADDRESS2", 0x04],
      ["D018_VIDEO_MATRIX_BASE_ADDRESS0", 0x00],
    ],
  );
});

/**
 * Calls `decomposeRegisterValue`, returning `null` for a LEGITIMATE refusal
 * rather than letting it fail the exhaustive loops below. Two real, MEASURED
 * shapes of legitimate refusal exist in the actual committed
 * `anno-regbits.json` (found BY these exhaustive tests, not assumed):
 *   - `$D019` ("VIC Interrupt Flag Register") genuinely leaves bits 4-6
 *     (mask 0x70) with no field entry at all -- reserved/unused hardware
 *     bits `memmap.json`'s own `bits` prose never documented. A value with
 *     any of those bits set is correctly UNCOVERED, and refusing it is
 *     Task 1's own rule working as designed, not a bug.
 *   - `$0001` ("MOS 6510 ... I/O Port")'s `registerKeyFor(1).slice(1)` is
 *     the all-digit string `"0001"`, so EVERY term name this function would
 *     build for that register starts with a digit -- an illegal ACME
 *     identifier for every value, refused by the T-45-10 gate below. This
 *     is a genuine, disclosed limitation of the `<enumName>_<field token>`
 *     naming scheme for a numeric-only register key; see the dedicated
 *     regression test for it below.
 * A refusal for any OTHER reason is a genuine test failure, so only these
 * two named error shapes are swallowed here -- anything else re-throws.
 */
function tryDecompose(register: number, value: number): RegisterDecomposition | null {
  try {
    return decomposeRegisterValue(register, value);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/is not fully covered by its fields/.test(message) || /is not a legal ACME identifier/.test(message)) {
      return null;
    }
    throw err;
  }
}

test("decomposeRegisterValue: the OR of every term's value reconstructs the input value exactly, exhaustively over every register and all 256 values (legitimate refusals excepted -- see tryDecompose)", () => {
  let sawAtLeastOneAccepted = false;
  for (const key of ALL_REGISTER_KEYS) {
    const address = Number.parseInt(key.slice(1), 16);
    for (let value = 0; value <= 0xff; value++) {
      const decomposition = tryDecompose(address, value);
      if (decomposition === null) continue;
      sawAtLeastOneAccepted = true;
      const reconstructed = decomposition.terms.reduce((acc, term) => acc | term.value, 0);
      assert.equal(
        reconstructed,
        value,
        `register ${key} value 0x${value.toString(16)}: OR of terms (0x${reconstructed.toString(16)}) != value`,
      );
    }
  }
  assert.ok(sawAtLeastOneAccepted, "the exhaustive loop must exercise at least one accepted decomposition, or this test is vacuous");
});

test("decomposeRegisterValue: joining the returned terms' field-token halves with '_' reproduces variantNameFor() exactly, exhaustively over every register and all 256 values (legitimate refusals excepted)", () => {
  let sawAtLeastOneAccepted = false;
  for (const key of ALL_REGISTER_KEYS) {
    const address = Number.parseInt(key.slice(1), 16);
    const enumName = key.slice(1);
    for (let value = 0; value <= 0xff; value++) {
      const decomposition = tryDecompose(address, value);
      if (decomposition === null) continue;
      sawAtLeastOneAccepted = true;
      const fieldTokenHalves = decomposition.terms.map((t) => t.name.slice(enumName.length + 1));
      assert.equal(
        fieldTokenHalves.join("_"),
        variantNameFor(address, value),
        `register ${key} value 0x${value.toString(16)}: decomposed name does not match variantNameFor()`,
      );
    }
  }
  assert.ok(sawAtLeastOneAccepted, "the exhaustive loop must exercise at least one accepted decomposition, or this test is vacuous");
});

test("decomposeRegisterValue: a register whose fields do not cover every set bit refuses by name, naming the uncovered mask and the OVERRIDES remedy", () => {
  const synthetic: RegBitsTable = {
    $A999: {
      label: "synthetic partial-coverage register (test-only)",
      fields: [{ mask: 0x0f, shift: 0, name: "LOW", kind: "numeric" }],
    },
  };
  __resetRegBitsCacheForTests(synthetic);
  try {
    assert.throws(() => decomposeRegisterValue(0xa999, 0xff), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /0xf0/);
      assert.match(err.message, /anno-regbits-gen\.ts/);
      return true;
    });
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

test("decomposeRegisterValue: a value whose every field decodes to a silent token returns exactly one V<value> term, matching variantNameFor()'s own degenerate case", () => {
  const synthetic: RegBitsTable = {
    $A998: {
      label: "synthetic all-silent register (test-only)",
      fields: [
        { mask: 0x01, shift: 0, name: "A", kind: "flag", tokens: { 0: "", 1: "A" } },
        { mask: 0x02, shift: 1, name: "B", kind: "flag", tokens: { 0: "", 1: "B" } },
      ],
    },
  };
  __resetRegBitsCacheForTests(synthetic);
  try {
    const decomposition = decomposeRegisterValue(0xa998, 0x00);
    assert.equal(decomposition.terms.length, 1);
    assert.equal(decomposition.terms[0]!.name, "A998_V0");
    assert.equal(decomposition.terms[0]!.value, 0x00);
    assert.equal(variantNameFor(0xa998, 0x00), "V0");
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

test("decomposeRegisterValue: every returned term name passes the same identifier gate sanitizeVariantMap() applies, for every register and all 256 values (illegal shapes are refused rather than returned -- see tryDecompose)", () => {
  let sawAtLeastOneAccepted = false;
  for (const key of ALL_REGISTER_KEYS) {
    const address = Number.parseInt(key.slice(1), 16);
    for (let value = 0; value <= 0xff; value++) {
      const decomposition = tryDecompose(address, value);
      if (decomposition === null) continue;
      sawAtLeastOneAccepted = true;
      for (const term of decomposition.terms) {
        assert.doesNotThrow(() => assertLegalAcmeIdentifier(term.name, `decomposeRegisterValue term for ${key} value 0x${value.toString(16)}`));
      }
    }
  }
  assert.ok(sawAtLeastOneAccepted, "the exhaustive loop must exercise at least one accepted decomposition, or this test is vacuous");
});

test("T-45-10: decomposeRegisterValue refuses register $0001 for every value, because its all-digit enum-name prefix (registerKeyFor(1).slice(1) === \"0001\") makes every term name illegal -- a genuine, MEASURED limitation, never silently emitted", () => {
  for (const value of [0x00, 0x37, 0xff]) {
    assert.throws(() => decomposeRegisterValue(0x0001, value), /is not a legal ACME identifier/);
  }
});

test("decomposeRegisterValue: multiField is true for a register with two or more fields, false for a single-field register", () => {
  assert.equal(decomposeRegisterValue(0xd018, 0x00).multiField, true, "$D018 has three fields");
  const singleField: RegBitsTable = {
    $A997: { label: "synthetic single-field register (test-only)", fields: [{ mask: 0xff, shift: 0, name: "ALL", kind: "numeric" }] },
  };
  __resetRegBitsCacheForTests(singleField);
  try {
    assert.equal(decomposeRegisterValue(0xa997, 0x00).multiField, false);
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

// ---------------------------------------------------------------------------
// assertLegalAcmeIdentifier -- the sanitization gate.
// ---------------------------------------------------------------------------

test("assertLegalAcmeIdentifier rejects '1BAD', 'has space', 'has-dash', '' and accepts a legal identifier", () => {
  assert.throws(() => assertLegalAcmeIdentifier("1BAD", "test"));
  assert.throws(() => assertLegalAcmeIdentifier("has space", "test"));
  assert.throws(() => assertLegalAcmeIdentifier("has-dash", "test"));
  assert.throws(() => assertLegalAcmeIdentifier("", "test"));
  assert.doesNotThrow(() => assertLegalAcmeIdentifier("YSCROLL3_ROW25_SCREENON_TEXT", "test"));
});

test("assertLegalAcmeIdentifier rejects a newline-bearing token and a token containing '='", () => {
  assert.throws(() => assertLegalAcmeIdentifier("BAD\nNAME", "test"));
  assert.throws(() => assertLegalAcmeIdentifier("BAD=$00", "test"));
});

test("assertLegalAcmeIdentifier rejects a reserved 6502 mnemonic, measured against real ACME (LDA)", () => {
  assert.throws(() => assertLegalAcmeIdentifier("LDA", "test"), /reserved/i);
  assert.throws(() => assertLegalAcmeIdentifier("lda", "test"), /reserved/i);
});

test("assertLegalAcmeIdentifier accepts a bare register letter (A/X/Y), measured NOT reserved against real ACME", () => {
  assert.doesNotThrow(() => assertLegalAcmeIdentifier("A", "test"));
});

test("assertLegalAcmeIdentifier rejects an identifier longer than the length ceiling", () => {
  assert.throws(() => assertLegalAcmeIdentifier("A".repeat(500), "test"));
});

test("sanitizeVariantMap builds the {$hex: name} shape and sanitizes every value", () => {
  const out = sanitizeVariantMap("$D011", new Map([[0x1b, "YSCROLL3_ROW25_SCREENON_TEXT"]]));
  assert.deepEqual(out, { $1b: "YSCROLL3_ROW25_SCREENON_TEXT" });
});

test("sanitizeVariantMap refuses a bad token before returning anything", () => {
  assert.throws(() => sanitizeVariantMap("$D011", new Map([[0x1b, "BAD\nNAME=$00"]])));
});

test(
  "T-11-NAME-INJECT: sanitizeVariantMap refuses the injection shape (newline + '= $00') and returns NOTHING, so a rebuilt installer that calls it first cannot pass the name on",
  () => {
    // The property the deleted installer proved with a spy binary: because
    // this refusal is entirely client-side and happens before any I/O, an
    // illegal variant name provably never reaches a child. With the installer
    // gone the spy has nothing to observe, so the refusal itself is asserted
    // directly -- including that it is total (no partial map is returned for
    // the legal entries that preceded the illegal one).
    let returned: unknown = "not-thrown";
    assert.throws(
      () => {
        returned = sanitizeVariantMap(
          "$D011",
          new Map([
            [0x00, "LEGAL_NAME"],
            [0x1b, "BAD\nNAME = $00"],
          ]),
        );
      },
      /not a legal ACME identifier/,
    );
    assert.equal(returned, "not-thrown", "sanitizeVariantMap must return nothing at all when any name is illegal");
  },
);

// ---------------------------------------------------------------------------
// Pairing: the D-23 adjacent-only rule, against the real pairSearchRows().
// ---------------------------------------------------------------------------

test("pairSearchRows: a store at A+2 pairs with its immediate load; a store at A+3 does not", () => {
  const ldaRows = [row(0x0810, "lda", "#$1b")];
  const staRows = [row(0x0812, "sta", "$d011")];
  const paired = pairSearchRows(ldaRows, staRows);
  assert.equal(paired.totalRegisterStores, 1);
  assert.equal(paired.pairedStores, 1);
  assert.equal(paired.unpairedStores, 0);
  assert.deepEqual(paired.occurrences, [{ regKey: "$D011", value: 0x1b, ldaAddr: 0x0810 }]);

  const offByOne = pairSearchRows(ldaRows, [row(0x0813, "sta", "$d011")]);
  assert.equal(offByOne.totalRegisterStores, 1, "the store is still a store to a known register");
  assert.equal(offByOne.pairedStores, 0, "a store at A+3 must NOT pair -- adjacent-only, no dataflow");
  assert.equal(offByOne.unpairedStores, 1);
});

test("pairSearchRows: a store to a register the bit-name table does not know is not counted at all", () => {
  const paired = pairSearchRows([row(0x0810, "lda", "#$1b")], [row(0x0812, "sta", "$c000")]);
  assert.equal(paired.totalRegisterStores, 0, "$C000 is not in anno-regbits.json, so it is not a register store");
  assert.equal(paired.occurrences.length, 0);
});

test("pairSearchRows: register matching is case-insensitive on the operand's hex ($d011 and $D011 both pair)", () => {
  for (const operand of ["$d011", "$D011"]) {
    const paired = pairSearchRows([row(0x0810, "lda", "#$1b")], [row(0x0812, "sta", operand)]);
    assert.equal(paired.pairedStores, 1, `expected ${operand} to normalise onto $D011`);
    assert.equal(paired.occurrences[0]!.regKey, "$D011");
  }
});

test("pairSearchRows: an unparsable immediate operand is skipped rather than fatal (D-23's 'a miss costs nothing')", () => {
  // This is the exact shape an already-enum-applied instruction took in the
  // live view: the raw "#$1b" was replaced by an enum reference, which is not
  // a parsable immediate. A re-run must be a safe no-op, never a crash.
  const paired = pairSearchRows([row(0x0810, "lda", "#D011.YSCROLL3_ROW25_SCREENON_TEXT")], [row(0x0812, "sta", "$d011")]);
  assert.equal(paired.totalRegisterStores, 1);
  assert.equal(paired.pairedStores, 0);
  assert.equal(paired.unpairedStores, 1);
});

test("pairSearchRows: a pass whose row count EQUALS the requested ceiling is reported as possibly truncated (D-23, no silent caps)", () => {
  const ldas = [row(0x0810, "lda", "#$1b"), row(0x0820, "lda", "#$1b")];
  const stas = [row(0x0812, "sta", "$d011"), row(0x0822, "sta", "$d011")];
  const atCeiling = pairSearchRows(ldas, stas, 2);
  assert.equal(atCeiling.pass1Truncated, true);
  assert.equal(atCeiling.pass2Truncated, true);

  const belowCeiling = pairSearchRows(ldas, stas, 3);
  assert.equal(belowCeiling.pass1Truncated, false);
  assert.equal(belowCeiling.pass2Truncated, false);
});

test("parseImmediateOperand parses hex, decimal and binary immediates, and refuses a non-immediate operand", () => {
  assert.equal(parseImmediateOperand("#$1b"), 0x1b);
  assert.equal(parseImmediateOperand("#27"), 27);
  assert.equal(parseImmediateOperand("#%00011011"), 0b00011011);
  assert.throws(() => parseImmediateOperand("$d011"));
});

// ---------------------------------------------------------------------------
// D-20: one variant per DISTINCT value the program actually writes.
// ---------------------------------------------------------------------------

test("planEnumsForPairing: two stores of the SAME value to one register produce ONE variant and TWO usages (D-20)", () => {
  const pairing = pairSearchRows(
    [row(0x0810, "lda", "#$1b"), row(0x0820, "lda", "#$1b")],
    [row(0x0812, "sta", "$d011"), row(0x0822, "sta", "$d011")],
  );
  const planned = planEnumsForPairing(pairing);
  assert.equal(planned.length, 1);
  assert.equal(planned[0]!.enumName, "D011");
  assert.equal(planned[0]!.variants.size, 1, "one variant per DISTINCT value -- never one per occurrence");
  assert.equal(planned[0]!.variants.get(0x1b), "YSCROLL3_ROW25_SCREENON_TEXT");
  assert.equal(planned[0]!.occurrences.length, 2, "both usages still bind, at their own lda addresses");
  assert.deepEqual(
    planned[0]!.occurrences.map((o) => o.ldaAddr),
    [0x0810, 0x0820],
  );
});

test("planEnumsForPairing: two DISTINCT values to one register produce two variants, and never a 256-value table", () => {
  const pairing = pairSearchRows(
    [row(0x0810, "lda", "#$1b"), row(0x0820, "lda", "#$00")],
    [row(0x0812, "sta", "$d011"), row(0x0822, "sta", "$d011")],
  );
  const planned = planEnumsForPairing(pairing);
  assert.equal(planned.length, 1);
  assert.equal(planned[0]!.variants.size, 2);
  assert.deepEqual([...planned[0]!.variants.keys()].sort((a, b) => a - b), [0x00, 0x1b]);
});

test("planEnumsForPairing: a usage binds to the lda address, NEVER the store address (measured binding rule)", () => {
  const pairing = pairSearchRows([row(0x0810, "lda", "#$1b")], [row(0x0812, "sta", "$d011")]);
  const planned = planEnumsForPairing(pairing);
  assert.equal(planned[0]!.occurrences[0]!.ldaAddr, 0x0810);
  assert.notEqual(planned[0]!.occurrences[0]!.ldaAddr, 0x0812);
});

test("planEnumsForPairing: two different registers produce two separate enums", () => {
  const pairing = pairSearchRows(
    [row(0x0810, "lda", "#$1b"), row(0x0820, "lda", "#$08")],
    [row(0x0812, "sta", "$d011"), row(0x0822, "sta", "$d016")],
  );
  const planned = planEnumsForPairing(pairing);
  assert.deepEqual(planned.map((p) => p.enumName).sort(), ["D011", "D016"]);
});

// ---------------------------------------------------------------------------
// D-23's wording contract, against the real report builder.
// ---------------------------------------------------------------------------

test("buildEnumGenerationReport: the summary lines contain 'truncat' when a pass hit its ceiling, and always carry total/paired/unpaired", () => {
  const ldas = [row(0x0810, "lda", "#$1b"), row(0x0820, "lda", "#$00")];
  const stas = [row(0x0812, "sta", "$d011"), row(0x0822, "sta", "$d011")];
  const pairing = pairSearchRows(ldas, stas, 2); // exactly at the ceiling
  const installed: EnumInstallSummary[] = [
    { regKey: "$D011", enumName: "D011", variantCount: 2, action: "created", usagesApplied: 2 },
  ];
  const report = buildEnumGenerationReport(pairing, installed, 2);

  const joined = report.summaryLines.join("\n");
  assert.match(joined, /truncat/i);
  assert.match(joined, /total register stores seen: 2/);
  assert.match(joined, /paired \(adjacent lda #imm found\): 2/);
  assert.match(joined, /unpaired \(no adjacent immediate load\): 0/);
  assert.match(joined, /enum D011: created, 2 variant\(s\), 2 usage\(s\) applied/);
});

test("buildEnumGenerationReport: a run below its ceiling says NOTHING about truncation -- the signal must not be always-on", () => {
  const pairing = pairSearchRows([row(0x0810, "lda", "#$1b")], [row(0x0812, "sta", "$d011")], DEFAULT_MAX_RESULTS);
  const report = buildEnumGenerationReport(pairing, [], DEFAULT_MAX_RESULTS);
  assert.doesNotMatch(report.summaryLines.join("\n"), /truncat/i);
  assert.equal(report.pass1Truncated, false);
  assert.equal(report.pass2Truncated, false);
});

test("buildEnumGenerationReport: an 'updated' action is reportable, so ANNO-13's re-runnability stays expressible", () => {
  const pairing = pairSearchRows([row(0x0810, "lda", "#$1b")], [row(0x0812, "sta", "$d011")]);
  const report = buildEnumGenerationReport(pairing, [
    { regKey: "$D011", enumName: "D011", variantCount: 1, action: "updated", usagesApplied: 1 },
  ]);
  assert.match(report.summaryLines.join("\n"), /enum D011: updated,/);
});

// ---------------------------------------------------------------------------
// grep-gate structural assertion (module hygiene, mechanical not eyeballed).
//
// DORMANT BY DESIGN, and kept for that reason. This module has no install
// route at all after plan 29-10, so nothing here could currently write a
// machine-global enum. The guard goes live again the instant ANY installer is
// added -- the condition is a route existing, not a phase arriving, and that is
// precisely the commit in which D-21 could be violated,
// and precisely the commit in which nobody would think to re-add a guard that
// had been deleted for being trivially green.
// ---------------------------------------------------------------------------

test("anno-enum-gen.ts never references the machine-global save_global_enum() route (D-21, zero-count grep)", () => {
  const src = readFileSync(join(HERE, "anno-enum-gen.ts"), "utf8");
  const count = (src.match(/save_global_enum/g) ?? []).length;
  assert.equal(count, 0);
});
