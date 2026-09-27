// anno-enum-gen.test.ts -- coverage for anno-enum-gen.mts (D-20/D-22/D-23,
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
  decomposeRegisterValue,
  hasRegBitsEntry,
  type RegisterDecomposition,
  __resetRegBitsCacheForTests,
  registerKeyFor,
} from "./anno-enum-gen.mts";
import type { RegBitsTable } from "./anno-regbits-gen.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

test("registerKeyFor formats addresses as $XXXX (uppercase, 4-hex-digit)", () => {
  assert.equal(registerKeyFor(0xd011), "$D011");
  assert.equal(registerKeyFor(1), "$0001");
});

// ---------------------------------------------------------------------------
// Task 1 (D-16/D-17): decomposeRegisterValue() -- the ONE owning multi-bit
// decoder. Loads the SAME committed anno-regbits.json this module loads
// (via the file-read helper below), so the exhaustive checks run against
// every register the real committed table carries, not a hand-picked
// subset.
// ---------------------------------------------------------------------------

const REGBITS_TABLE_RAW = JSON.parse(readFileSync(join(HERE, "anno-regbits.json"), "utf8")) as Record<string, unknown>;
const ALL_REGISTER_KEYS = Object.keys(REGBITS_TABLE_RAW).filter((k) => k !== "_generated");

// ---------------------------------------------------------------------------
// hasRegBitsEntry() -- THE ONE MEMBERSHIP-TEST PREDICATE (45-REVIEW CR-01,
// fixed 2026-09-11). Both D-16 render surfaces gate their decomposition
// attempt on this, rather than each re-deriving "is this register in the
// table" from a lookup-and-catch of requireRegBitsEntry()'s own throw.
// ---------------------------------------------------------------------------

test("hasRegBitsEntry: true for every real committed table key, exhaustively -- never a hand-picked subset", () => {
  assert.ok(ALL_REGISTER_KEYS.length > 0, "the committed table must not be empty, or this check is vacuous");
  for (const key of ALL_REGISTER_KEYS) {
    assert.equal(hasRegBitsEntry(key), true, `${key} is a real committed table key and must be reported present`);
  }
});

test("hasRegBitsEntry: false for $D020/$D021 -- these registers are name-shaped but CONFIRMED ABSENT from the committed anno-regbits.json table, the exact CR-01 regression case where a name-shaped register with no table entry must not be mistaken for one that has one", () => {
  assert.equal(ALL_REGISTER_KEYS.includes("$D020"), false, "precondition: $D020 really is absent from the committed table");
  assert.equal(ALL_REGISTER_KEYS.includes("$D021"), false, "precondition: $D021 really is absent from the committed table");
  assert.equal(hasRegBitsEntry("$D020"), false);
  assert.equal(hasRegBitsEntry("$D021"), false);
});

test("hasRegBitsEntry: true for $DD00 -- present but only PARTIALLY covered (bits #0-#1 uncovered), a genuinely different case from absent-entirely", () => {
  assert.equal(ALL_REGISTER_KEYS.includes("$DD00"), true, "precondition: $DD00 really is in the committed table");
  assert.equal(hasRegBitsEntry("$DD00"), true, "membership is about the TABLE ENTRY existing, not about full bit coverage");
});

test("hasRegBitsEntry: honours the test-only cache reset -- a synthetic table with no entries reports false for every real key", () => {
  __resetRegBitsCacheForTests({});
  try {
    for (const key of ALL_REGISTER_KEYS) {
      assert.equal(hasRegBitsEntry(key), false, `${key} must report absent against an EMPTY synthetic table`);
    }
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

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
      assert.match(err.message, /anno-regbits-gen\.mts/);
      return true;
    });
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

test("decomposeRegisterValue: a value whose every field decodes to a silent token returns exactly one V<value> term", () => {
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
  } finally {
    __resetRegBitsCacheForTests(undefined);
  }
});

test("decomposeRegisterValue: every returned term name passes the ACME identifier gate, for every register and all 256 values (illegal shapes are refused rather than returned -- see tryDecompose)", () => {
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

test("anno-enum-gen.mts never references the machine-global save_global_enum() route (D-21, zero-count grep)", () => {
  const src = readFileSync(join(HERE, "anno-enum-gen.mts"), "utf8");
  const count = (src.match(/save_global_enum/g) ?? []).length;
  assert.equal(count, 0);
});
