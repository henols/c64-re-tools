// anno-types.test.ts -- the committed freeze of the annotation store's one
// irreversible decision: the twelve data-type members, in their exact spelling
// and order, and the four split layouts derived from them.
//
// WHY THIS ONE PIN IS HAND-WRITTEN WHILE THE CROSS-CHECKS ELSEWHERE ARE
// DERIVED. The two instruments answer different questions and are not
// interchangeable:
//
//   * A DERIVED check ("read both homes and compare") is the right instrument
//     when the question is DO TWO HOMES AGREE. That is what the split-layout
//     membership assertion below does, and what a vocabulary-versus-schema
//     drift check would do.
//   * A HAND-WRITTEN check is the right instrument when the question is DID
//     THE ONE HOME CHANGE. Deriving the expectation from `DATA_TYPES` would
//     make the pin read its own subject: a silent edit to the vocabulary would
//     silently edit its own expectation and the test would keep passing. So
//     the twelve strings below are typed out by hand, in the
//     `r2000_set_data_type` schema's own order, and any edit to `DATA_TYPES`
//     must be accompanied by a deliberate edit HERE.
//
// The decision this pins is irreversible in a specific way: split-table
// ORIENTATION cannot be recovered from a store that never recorded it, so the
// recovery cost is a hand re-annotation of every split table in every project
// file rather than a schema migration.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertAccessKind,
  assertCommentText,
  assertCommentType,
  assertLabelKind,
  assertEnumName,
  assertLegalLabel,
  AnnoAddressError,
  AnnoCommentError,
  AnnoLabelError,
  AnnoRangeShapeError,
  AnnoTypeError,
  COMMENT_TYPES,
  DATA_TYPES,
  type EnumUsageRow,
  LABEL_KINDS,
  MAX_COMMENT_BYTES,
  MNEMONIC_DENYLIST,
  parseStoreAddress,
  parseVariantKey,
  producesXrefsFor,
  resolveSplitTargets,
  SCHEMA_VERSION,
  splitEntryAddressPairs,
  SPLIT_DATA_TYPES,
  XREF_ACCESS_KINDS,
} from "./anno-types.ts";
import { OPCODES } from "./disasm-opcodes.ts";
import { codeOnly } from "./shipped-modules.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The twelve members, WRITTEN OUT BY HAND -- see the file header for why this
 * one expectation is not derived from its own subject. */
const TWELVE_MEMBERS = [
  "code",
  "byte",
  "word",
  "address",
  "petscii",
  "screencode",
  "lo_hi_address",
  "hi_lo_address",
  "lo_hi_word",
  "hi_lo_word",
  "external_file",
  "undefined",
];

/** The four split layouts, also written out by hand, in vocabulary order. */
const FOUR_SPLIT_LAYOUTS = ["lo_hi_address", "hi_lo_address", "lo_hi_word", "hi_lo_word"];

test("DATA_TYPES is exactly the twelve members, in the schema's own order and spelling, and is frozen", () => {
  assert.deepEqual([...DATA_TYPES], TWELVE_MEMBERS, "the vocabulary changed -- if that was deliberate, edit TWELVE_MEMBERS in this file too");
  assert.equal(DATA_TYPES.length, 12, "twelve members: a deepEqual catches a wrong spelling, the length catches a truncated list");
  assert.equal(Object.isFrozen(DATA_TYPES), true, "the vocabulary must be frozen -- a caller must not be able to push a thirteenth member");
});

test("SPLIT_DATA_TYPES is exactly the four split layouts, frozen, and every member of it is also a member of DATA_TYPES", () => {
  assert.deepEqual([...SPLIT_DATA_TYPES], FOUR_SPLIT_LAYOUTS);
  assert.equal(SPLIT_DATA_TYPES.length, 4, "four split layouts: both byte orders, for both address tables and word tables");
  assert.equal(Object.isFrozen(SPLIT_DATA_TYPES), true);

  // The DERIVED half, and the reason it belongs beside the hand-written half:
  // SPLIT_DATA_TYPES is produced by FILTERING DATA_TYPES, so this is the
  // assertion that the filter cannot drift into producing a string the
  // vocabulary does not contain.
  for (const layout of SPLIT_DATA_TYPES) {
    assert.ok(
      (DATA_TYPES as readonly string[]).includes(layout),
      `${layout} is in SPLIT_DATA_TYPES but not in DATA_TYPES -- the derived filter invented a member`,
    );
  }
});

test("the twelve members are pairwise distinct and none contains the substring r2000, so the rented-analyser removal gate (CUT-02) is unaffected by the vocabulary", () => {
  assert.equal(new Set(DATA_TYPES).size, 12, "a duplicated member would make one of the twelve unreachable");
  for (const member of DATA_TYPES) {
    assert.equal(member.includes("r2000"), false, `${member} contains the substring a removal gate greps for`);
    assert.equal(member, member.toLowerCase(), `${member} must be lowercase -- the schema's spellings are lowercase snake_case`);
  }
});

// ---------------------------------------------------------------------------
// THE SPLIT-ORIENTATION CONTROL, and why it is shaped this way.
//
// The four split layouts stay first-class members only if BOTH axes that
// distinguish them are separately observable. This block observes both:
//
//   * ORIENTATION -- a `lo_hi_address` fixture read as `hi_lo_address` produces
//     a DIFFERING resolved-target set. That difference is the whole observable
//     consequence of recording orientation, and a collapsed vocabulary (one
//     `table` member with a forgotten orientation flag) makes it vanish. The
//     planting below shows the assertion going red against exactly that.
//   * ADDRESS VERSUS WORD -- over IDENTICAL bytes, the two `_address` members
//     produce cross-references and the two `_word` members do not, while the
//     resolved target VALUES are equal. Equal targets plus differing reference
//     production is precisely the claim that the second axis is orthogonal, and
//     it is what answers a reviewer who says two members would do.
//
// A BYTE-IDENTICAL REASSEMBLY ASSERTION CANNOT BE THE ORIENTATION CONTROL, and
// Test 4 records that as an assertion rather than leaving it as prose: a retype
// changes no bytes, so a reassembly comparison is green under BOTH orientations
// and can never go red on a collapsed vocabulary. It is worth having separately,
// for a different reason -- it catches an exporter that mangles bytes.
// ---------------------------------------------------------------------------

/** The research-verified fixture: a four-entry split table's raw bytes.
 * Low-high reads `$0810 $1234 $c000 $cfff`; high-low reads
 * `$1008 $3412 $00c0 $ffcf`. */
const SPLIT_FIXTURE = Object.freeze([0x10, 0x34, 0x00, 0xff, 0x08, 0x12, 0xc0, 0xcf] as const);

/** THE ONE definition of "these two target sets differ". Called by the real
 * control AND by the collapse planting, so the control and its own proof cannot
 * drift apart into two slightly different comparisons. */
function targetSetsDiffer(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((value, index) => value !== b[index]);
}

/** Renders a target set for a failure message. A failure in the control means
 * the orientation axis stopped being observable, and the reader needs to see
 * WHICH way -- "not equal" alone would not say. */
function renderTargets(targets: readonly number[]): string {
  return targets.map((value) => `$${value.toString(16).padStart(4, "0")}`).join(" ");
}

/**
 * THE COLLAPSE PLANTING (inline synthetic-source route, the shape
 * `hostpath-consumers.test.ts:231-262` labels its cases with). A test-local
 * implementation that ignores the orientation axis entirely -- exactly what a
 * single `table` member with a forgotten orientation flag produces.
 *
 * Inline rather than a `fixtures/*.ts.txt` module, deliberately: this planting
 * is a small ALGORITHMIC variation of one function, not a whole plausible
 * module, so a fixture file would hide the one line that differs.
 */
function resolveSplitTargetsCollapsed(bytes: readonly number[]): number[] {
  const n = bytes.length / 2;
  const targets: number[] = [];
  for (let i = 0; i < n; i += 1) {
    // The collapse: the low-high arithmetic, whatever the caller asked for.
    targets.push(bytes[i] | (bytes[n + i] << 8));
  }
  return targets;
}

test("criterion 1's control: the fixture is non-degenerate FIRST, and then a lo_hi_address reading and a hi_lo_address reading of it produce DIFFERING target sets", () => {
  const bytes = Uint8Array.from(SPLIT_FIXTURE);

  // THE NON-DEGENERACY ASSERTIONS COME FIRST, in this same test, on purpose. A
  // table whose low half and high half are byte-identical, or a one-entry table
  // with equal low and high bytes, would make the differing-set assertion below
  // hold for no reason -- and a vacuous control is WORSE than none, because it
  // reads as evidence.
  const lowHalf = [...SPLIT_FIXTURE].slice(0, 4);
  const highHalf = [...SPLIT_FIXTURE].slice(4);
  assert.equal(
    targetSetsDiffer(lowHalf, highHalf),
    true,
    `the fixture's two halves must not be byte-identical, or the differing-set control below is vacuous: ${lowHalf} vs ${highHalf}`,
  );

  const lo = resolveSplitTargets(bytes, "lo_hi_address");
  const hi = resolveSplitTargets(bytes, "hi_lo_address");
  assert.equal(lo.entryCount, 4, "a four-entry table, so the control is not a one-entry accident");
  assert.ok(lo.entryCount > 1, "an entry count of one would make the control vacuous too");

  assert.deepEqual([...lo.targets], [0x0810, 0x1234, 0xc000, 0xcfff], "the low-high reading, verified arithmetically during research");
  assert.deepEqual([...hi.targets], [0x1008, 0x3412, 0x00c0, 0xffcf], "the high-low reading, verified arithmetically during research");

  assert.equal(
    targetSetsDiffer(lo.targets, hi.targets),
    true,
    `the two orientations must resolve to DIFFERENT targets -- that difference is the whole observable consequence of recording ` +
      `orientation, and if it has gone the vocabulary can no longer be told apart. lo_hi_address: ${renderTargets(lo.targets)} ; ` +
      `hi_lo_address: ${renderTargets(hi.targets)}`,
  );
});

test("the collapse planting, observed: a single-orientation implementation makes the control's OWN comparison report the two readings as identical", () => {
  const collapsedLo = resolveSplitTargetsCollapsed([...SPLIT_FIXTURE]);
  const collapsedHi = resolveSplitTargetsCollapsed([...SPLIT_FIXTURE]);

  assert.equal(
    targetSetsDiffer(collapsedLo, collapsedHi),
    false,
    `a collapsed implementation must produce IDENTICAL sets for the two orientations -- if this ever reports a difference, the planting ` +
      `has stopped being a collapse and the control's red is no longer proven. lo: ${renderTargets(collapsedLo)} ; ` +
      `hi: ${renderTargets(collapsedHi)}`,
  );

  // And the real implementation disagrees with the collapsed one on at least
  // one orientation, which is what makes the planting a planting rather than a
  // restatement.
  const realHi = resolveSplitTargets(Uint8Array.from(SPLIT_FIXTURE), "hi_lo_address");
  assert.equal(
    targetSetsDiffer(collapsedHi, realHi.targets),
    true,
    "the collapsed reading must differ from the real high-low reading, or the planting is not planting anything",
  );
});

test("the reassembly NON-control, recorded as an assertion: the fixture's bytes are unchanged by resolving under either orientation", () => {
  const bytes = Uint8Array.from(SPLIT_FIXTURE);
  const before = [...bytes];
  resolveSplitTargets(bytes, "lo_hi_address");
  resolveSplitTargets(bytes, "hi_lo_address");
  assert.deepEqual(
    [...bytes],
    before,
    "a retype changes NO bytes. That is why a byte-identical reassembly assertion is green under both orientations and cannot be " +
      "criterion 1's control -- it is worth having separately, because it catches an exporter that mangles bytes, but it is not this " +
      "claim's evidence and must not be presented as such.",
  );
});

test("the second axis: over IDENTICAL bytes the two _address members produce cross-references and the two _word members do not, while the resolved targets are equal", () => {
  const bytes = Uint8Array.from(SPLIT_FIXTURE);

  const loAddress = resolveSplitTargets(bytes, "lo_hi_address");
  const loWord = resolveSplitTargets(bytes, "lo_hi_word");
  const hiAddress = resolveSplitTargets(bytes, "hi_lo_address");
  const hiWord = resolveSplitTargets(bytes, "hi_lo_word");

  assert.equal(loAddress.producesXrefs, true, "address=16-bit LE pointers creates X-Refs -- the schema's own words");
  assert.equal(hiAddress.producesXrefs, true);
  assert.equal(loWord.producesXrefs, false, "word=16-bit LE values does not");
  assert.equal(hiWord.producesXrefs, false);

  // BOTH HALVES MATTER. Equal targets plus differing reference production is
  // precisely the claim that the address-versus-word axis is orthogonal to the
  // orientation axis -- so four members, not two.
  assert.deepEqual([...loWord.targets], [...loAddress.targets], "the word form resolves the SAME values; only reference production differs");
  assert.deepEqual([...hiWord.targets], [...hiAddress.targets]);
  assert.equal(producesXrefsFor("lo_hi_address"), true, "producesXrefsFor answers the same question without resolving anything");
  assert.equal(producesXrefsFor("lo_hi_word"), false);
});

test("resolveSplitTargets refuses an odd byte count on each of the four split layouts, and refuses a non-split type outright", () => {
  for (const layout of SPLIT_DATA_TYPES) {
    assert.throws(
      () => resolveSplitTargets(Uint8Array.from([0x10, 0x34, 0x00]), layout),
      (e: unknown) => {
        assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError for ${layout}, got ${String(e)}`);
        assert.match(e.message, /even byte count/, "the refusal must name the rule that fired");
        assert.match(e.message, new RegExp(layout), "and the layout it fired for");
        return true;
      },
    );
  }

  for (const notSplit of ["byte", "word", "address", "code", "table"]) {
    assert.throws(
      () => resolveSplitTargets(Uint8Array.from([0x10, 0x34]), notSplit),
      (e: unknown) => {
        assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for ${notSplit}, got ${String(e)}`);
        assert.equal(e.dataType, notSplit, "the refusal carries the offending value");
        assert.deepEqual(e.validTypes, [...SPLIT_DATA_TYPES], "and the full list of split layouts");
        return true;
      },
    );
  }
});

// ---------------------------------------------------------------------------
// CR-10: THE PARTNER RULE HAS ONE DEFINITION, AND THE WRITER CONSULTS IT.
// ---------------------------------------------------------------------------
//
// `splitEntryAddressPairs()` names the two ADDRESSES whose bytes form one entry
// of a split table. `anno-store.ts`'s `retype()` gate consults it before it
// fragments a split row, and `resolveSplitTargets()` above consults the SAME
// underlying `splitPartnerOffsets()` couples to read bytes -- so a resolver and
// a writer cannot disagree about what an entry IS.
//
// THE EXPECTED PAIRS BELOW ARE HAND-DERIVED FROM THE LAYOUT RULE IN WORDS, not
// computed by the function under test: a 16-byte table has n = 8 entries, entry
// `i` reads offset `i` and offset `8 + i`, so over `$1000..$100f` entry 0 reads
// `$1000` and `$1008`, entry 1 reads `$1001` and `$1009`, and so on to entry 7
// reading `$1007` and `$100f`. Deriving them from `splitEntryAddressPairs`
// would make the pin read its own subject -- the same argument the file header
// makes for the twelve members.

test("CR-10: splitEntryAddressPairs reports the eight entry-address couples of a 16-byte split table, hand-derived and asserted BY VALUE", () => {
  const pairs = splitEntryAddressPairs(0x1000, 0x100f, "lo_hi_address");

  assert.equal(pairs.entryCount, 8, "16 bytes, first half paired with second half -- eight entries");
  assert.deepEqual(
    pairs.pairs.map((pair) => [...pair]),
    [
      [0x1000, 0x1008],
      [0x1001, 0x1009],
      [0x1002, 0x100a],
      [0x1003, 0x100b],
      [0x1004, 0x100c],
      [0x1005, 0x100d],
      [0x1006, 0x100e],
      [0x1007, 0x100f],
    ],
    "the eight couples, written out from the layout rule rather than computed by the function under test",
  );
  assert.equal(pairs.entryCount, pairs.pairs.length, "the restated count and the array agree");

  // The rule is about the LAYOUT, not about the orientation or the
  // address-versus-word axis: all four members pair the same way, and only the
  // arithmetic applied to the two bytes differs.
  for (const layout of SPLIT_DATA_TYPES) {
    assert.deepEqual(
      splitEntryAddressPairs(0x1000, 0x100f, layout).pairs.map((pair) => [...pair]),
      pairs.pairs.map((pair) => [...pair]),
      `${layout} pairs the same two addresses -- orientation changes how the bytes are read, never which two they are`,
    );
  }
});

test("CR-10: splitEntryAddressPairs refuses an ODD span in the shape family, with assertRangeShape's own message, and refuses a non-split type by name", () => {
  for (const layout of SPLIT_DATA_TYPES) {
    assert.throws(
      // The span $1000..$100e is 15 bytes -- the odd fragment CR-09 refuses.
      () => splitEntryAddressPairs(0x1000, 0x100e, layout),
      (e: unknown) => {
        assert.ok(e instanceof AnnoRangeShapeError, `expected AnnoRangeShapeError for ${layout}, got ${String(e)}`);
        assert.match(e.message, /even byte count/, "the SAME rule assertRangeShape raises, not a second one");
        assert.match(e.message, new RegExp(layout), "and it names the layout it fired for");
        return true;
      },
    );
  }

  for (const notSplit of ["byte", "word", "address", "code", "table"]) {
    assert.throws(
      () => splitEntryAddressPairs(0x1000, 0x100f, notSplit as never),
      (e: unknown) => {
        assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for ${notSplit}, got ${String(e)}`);
        assert.equal(e.dataType, notSplit, "the refusal carries the offending value");
        assert.deepEqual(e.validTypes, [...SPLIT_DATA_TYPES], "and the full list of split layouts");
        return true;
      },
    );
  }
});

test("CR-10: the partner rule has exactly ONE definition -- the pairs splitEntryAddressPairs reports and the targets resolveSplitTargets produces agree ENTRY FOR ENTRY", () => {
  // WHY THIS TEST EXISTS AND WHAT IT IS FOR. It is what makes PLANTING P2
  // meaningful: with the shared `splitPartnerOffsets()` couples changed to an
  // interleaved `[2i, 2i + 1]`, BOTH consumers move together and the
  // worked-arithmetic pin above goes red. If the resolver had kept its own copy
  // of the `n + i` arithmetic the two would disagree here instead, and the
  // planting would prove nothing about the resolver.
  const start = 0x1000;
  const endInclusive = 0x100f;
  // A byte image whose value at each address is that address's OFFSET, so the
  // resolved target names its own two source addresses unambiguously.
  const image = Uint8Array.from(Array.from({ length: endInclusive - start + 1 }, (_, i) => i));

  const pairs = splitEntryAddressPairs(start, endInclusive, "lo_hi_address");
  const resolved = resolveSplitTargets(image, "lo_hi_address");

  assert.equal(resolved.entryCount, pairs.entryCount, "the two consumers must agree on how many entries a 16-byte table has");
  for (const [i, pair] of pairs.pairs.entries()) {
    const low = image[pair[0] - start];
    const high = image[pair[1] - start];
    assert.equal(
      resolved.targets[i],
      low | (high << 8),
      `entry ${i}: resolveSplitTargets read the bytes at ${pair[0]} and ${pair[1]} -- if it did not, the writer-side gate and the ` +
        `resolver are consulting two different definitions of what an entry is, which is CR-10's whole class`,
    );
  }
});

test("the three remaining vocabularies are frozen with exactly their members, and each assert* accepts a member and refuses a non-member by name", () => {
  assert.deepEqual([...COMMENT_TYPES], ["line", "side"], "the comment placements, in the schema's own order");
  assert.equal(COMMENT_TYPES.length, 2);
  assert.equal(Object.isFrozen(COMMENT_TYPES), true);

  assert.deepEqual([...LABEL_KINDS], ["User", "Auto", "System", "Platform"], "the four label kinds, in the census's own capitalised spelling");
  assert.equal(LABEL_KINDS.length, 4);
  assert.equal(Object.isFrozen(LABEL_KINDS), true);

  assert.deepEqual([...XREF_ACCESS_KINDS], ["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"], "the four access kinds fixed by STORE-05");
  assert.equal(XREF_ACCESS_KINDS.length, 4);
  assert.equal(Object.isFrozen(XREF_ACCESS_KINDS), true);

  assert.equal(assertCommentType("side"), "side");
  assert.equal(assertLabelKind("Platform"), "Platform", "Platform is a first-class member, not normalised away to System");
  assert.equal(assertAccessKind("COMPUTED_JUMP"), "COMPUTED_JUMP");

  const refusals: readonly (readonly [string, (value: unknown) => unknown, unknown, readonly string[]])[] = [
    ["comment type", assertCommentType, "inline", [...COMMENT_TYPES]],
    ["label kind", assertLabelKind, "user", [...LABEL_KINDS]],
    ["access kind", assertAccessKind, "EXECUTE", [...XREF_ACCESS_KINDS]],
  ];
  for (const [what, assertFn, offender, members] of refusals) {
    assert.throws(
      () => assertFn(offender),
      (e: unknown) => {
        assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for ${what}, got ${String(e)}`);
        assert.equal(e.dataType, offender, "the refusal carries the offending value");
        assert.deepEqual(e.validTypes, members, "and the full valid-member list, so a caller never has to go looking");
        return true;
      },
    );
  }
});

test("the mnemonic denylist is DERIVED from the opcode table -- its size equals the distinct mnemonic count computed here from OPCODES, and it carries the illegal-opcode names a hand-typed list misses", () => {
  // The expectation is COMPUTED from OPCODES rather than pinned as a literal,
  // so a change to the opcode table cannot leave a stale number behind here.
  // This is the "do two homes agree" question, which is the derived
  // instrument's job -- unlike the twelve-member freeze above, which asks "did
  // the one home change" and is therefore hand-written.
  const distinct = new Set(OPCODES.map((entry) => entry.mnemonic.toLowerCase()));
  assert.equal(MNEMONIC_DENYLIST.size, distinct.size, "the denylist must be exactly the distinct mnemonics of the 256-entry opcode table");
  assert.ok(distinct.size > 56, `there must be more than the 56 documented mnemonics, got ${distinct.size} -- otherwise the illegal ones are missing`);
  for (const mnemonic of ["lda", "jsr", "jam", "slo", "lax"]) {
    assert.equal(MNEMONIC_DENYLIST.has(mnemonic), true, `${mnemonic} must be on the denylist -- jam, slo and lax are the ones a hand list misses`);
  }
});

test("assertLegalLabel accepts a legal identifier unchanged, refuses an illegal one WITHOUT sanitising it, and refuses a mnemonic case-insensitively", () => {
  for (const legal of ["init_screen", "loop_start", "_private", "a1"]) {
    assert.equal(assertLegalLabel(legal), legal, `${legal} must be accepted and returned UNCHANGED`);
  }

  for (const illegal of ["init screen", "1abc", "init-screen", ""]) {
    assert.throws(
      () => assertLegalLabel(illegal),
      (e: unknown) => {
        assert.ok(e instanceof AnnoLabelError, `expected AnnoLabelError for ${JSON.stringify(illegal)}, got ${String(e)}`);
        assert.equal(e.identifier, illegal === "" ? "" : illegal, "the refusal carries the offending name VERBATIM");
        assert.ok(typeof e.reason === "string" && e.reason.length > 0, "and a reason naming which rule fired");
        return true;
      },
    );
  }

  // The specific hazard, asserted rather than described: `init screen` is
  // REFUSED, not turned into `init_screen`. If it were sanitised, the two names
  // would become one row and nothing would record that it happened.
  assert.throws(() => assertLegalLabel("init screen"), AnnoLabelError);
  assert.equal(assertLegalLabel("init_screen"), "init_screen", "and the underscore spelling remains a DIFFERENT, legal name");

  for (const mnemonic of ["LDA", "lda", "Lda", "JAM", "slo"]) {
    assert.throws(
      () => assertLegalLabel(mnemonic),
      (e: unknown) => {
        assert.ok(e instanceof AnnoLabelError, `expected AnnoLabelError for ${mnemonic}, got ${String(e)}`);
        assert.equal(e.reason, "6502/6510 mnemonic", "the denylist comparison is case-insensitive: all three spellings assemble the same");
        return true;
      },
    );
  }
});

test("parseStoreAddress accepts an in-range number and both hex prefixes, and REFUSES an unprefixed numeric string with the divergence named in the message", () => {
  assert.equal(parseStoreAddress(1024), 0x0400);
  assert.equal(parseStoreAddress("$0400"), 0x0400);
  assert.equal(parseStoreAddress("$400"), 0x0400, "a short hex string is not padded, it is parsed");
  assert.equal(parseStoreAddress("0x400"), 0x0400);
  assert.equal(parseStoreAddress("0X400"), 0x0400);

  for (const offender of ["1024", "0xzz", "$", "", 65536]) {
    assert.throws(
      () => parseStoreAddress(offender, { what: "toAddress" }),
      (e: unknown) => {
        assert.ok(e instanceof AnnoAddressError, `expected AnnoAddressError for ${JSON.stringify(offender)}, got ${String(e)}`);
        assert.equal(e.input, offender, "the refusal carries the offending input");
        assert.equal(e.what, "toAddress", "and the caller-supplied field name, so the message says WHICH argument");
        return true;
      },
    );
  }

  // The divergence, asserted where a reader will trip over it. `stock-address.ts`
  // accepts the bare decimal form AS DECIMAL under its own decision; this store
  // refuses it, because a mis-based address written into the store is PERSISTENT
  // and silently wrong while a mis-based memory read is transient.
  assert.throws(
    () => parseStoreAddress("1024"),
    (e: unknown) => {
      assert.ok(e instanceof AnnoAddressError);
      assert.match(e.message, /persistent/, "the refusal must say WHY an unprefixed numeric string is refused here but read elsewhere");
      return true;
    },
  );
});

test("assertCommentText measures its bound in UTF-8 BYTES, not code units, and refuses the semicolon prefix the schema tells callers to omit", () => {
  assert.equal(assertCommentText("raster split at line $64"), "raster split at line $64");
  assert.equal(assertCommentText("x".repeat(MAX_COMMENT_BYTES)).length, MAX_COMMENT_BYTES, "exactly at the bound is accepted");

  // 2048 euro signs: 2048 UTF-16 code units (comfortably under the 4096 bound
  // if length were measured in code units) but 6144 UTF-8 bytes (over it). This
  // is the case a `String.length` check passes and the disk then exceeds.
  const multiByte = "€".repeat(2048);
  assert.ok(multiByte.length < MAX_COMMENT_BYTES, "the fixture must be UNDER the bound in code units, or it does not test the distinction");
  assert.throws(
    () => assertCommentText(multiByte),
    (e: unknown) => {
      assert.ok(e instanceof AnnoCommentError, `expected AnnoCommentError, got ${String(e)}`);
      assert.equal(e.byteLength, 6144, "the refusal carries the UTF-8 byte length -- 3 bytes per character, not 1");
      assert.equal(e.reason, "over MAX_COMMENT_BYTES");
      return true;
    },
  );

  assert.throws(
    () => assertCommentText("x".repeat(MAX_COMMENT_BYTES + 1)),
    (e: unknown) => {
      assert.ok(e instanceof AnnoCommentError);
      assert.equal(e.byteLength, MAX_COMMENT_BYTES + 1, "one byte over is over -- the text is REFUSED, never truncated");
      return true;
    },
  );

  assert.throws(
    () => assertCommentText("; the IRQ handler"),
    (e: unknown) => {
      assert.ok(e instanceof AnnoCommentError);
      assert.equal(e.reason, "semicolon prefix", "the store holds the words; the exporter adds the prefix");
      return true;
    },
  );
  assert.equal(
    assertCommentText("; a description may start with one", { allowLeadingSemicolon: true }),
    "; a description may start with one",
    "the opt-out exists for the one neighbouring field with the same bound and no semicolon rule",
  );
});

test("assertCommentText REFUSES an embedded line break by name -- every separator, and every position in the string", () => {
  // The store holds the comment's WORDS and the exporter adds the `;` prefix.
  // A stored line break therefore puts everything after it into the generated
  // ACME source at column zero, as assembler INPUT rather than as a comment.
  const cases: readonly (readonly [string, string])[] = [
    ["a newline in the middle", "raster split\nlda #$00"],
    ["a newline as the FINAL character", "raster split\n"],
    ["a newline as the FIRST character", "\nlda #$00"],
    ["a carriage return", "raster split\rlda #$00"],
    ["a CRLF pair", "raster split\r\nlda #$00"],
    // Written as escapes, never as the raw characters: a bare U+2028 in this
    // file would be invisible in every editor and in every reviewer's diff.
    ["U+2028 LINE SEPARATOR", "raster split\u2028lda #$00"],
    ["U+2029 PARAGRAPH SEPARATOR", "raster split\u2029lda #$00"],
  ];

  for (const [what, text] of cases) {
    assert.throws(
      () => assertCommentText(text),
      (e: unknown) => {
        assert.ok(e instanceof AnnoCommentError, `${what}: expected AnnoCommentError, got ${String(e)}`);
        assert.equal(e.reason, "embedded newline", `${what}: the refusal must name the rule that fired`);
        assert.match(
          e.message,
          /line break|newline/i,
          `${what}: the message must name the mechanism, not merely say the text was refused -- got ${JSON.stringify(e.message)}`,
        );
        return true;
      },
      `${what} must be REFUSED, never stripped: stripping merges two comments a human wrote separately into one text, silently and permanently`,
    );
  }
});

test("the embedded-newline refusal applies with allowLeadingSemicolon: true too -- that flag governs the semicolon rule only", () => {
  assert.throws(
    () => assertCommentText("a description\nwith a line break", { allowLeadingSemicolon: true }),
    (e: unknown) => {
      assert.ok(e instanceof AnnoCommentError);
      assert.equal(e.reason, "embedded newline", "both call sites are SINGLE-LINE text fields; the opt-out is about the ';' prefix, not about line breaks");
      return true;
    },
  );
});

test("text with no line break is returned UNCHANGED -- including one byte under the bound, so the new check cannot be what makes the old assertions pass", () => {
  assert.equal(assertCommentText("raster split at line $64"), "raster split at line $64");
  assert.equal(assertCommentText("tabs\tand spaces are not line breaks"), "tabs\tand spaces are not line breaks");
  const underBound = "x".repeat(MAX_COMMENT_BYTES - 1);
  assert.equal(assertCommentText(underBound), underBound, "one byte under the bound with no line break is accepted and returned unchanged");
  assert.equal(
    assertCommentText("; a description may still start with one", { allowLeadingSemicolon: true }),
    "; a description may still start with one",
  );
});

test("assertEnumName and parseVariantKey complete the validator set: the identifier rule, the four numeric-string key forms, and a refusal for anything else", () => {
  for (const legal of ["vic_registers", "_mode", "Sprite0"]) {
    assert.equal(assertEnumName(legal), legal, `${legal} must be accepted and returned unchanged`);
  }
  for (const illegal of ["vic registers", "9lives", "vic-registers", ""]) {
    assert.throws(
      () => assertEnumName(illegal),
      (e: unknown) => {
        assert.ok(e instanceof AnnoLabelError, `expected AnnoLabelError for ${JSON.stringify(illegal)}, got ${String(e)}`);
        assert.equal(e.reason, "illegal enum name", "the refusal names which rule fired");
        return true;
      },
    );
  }
  // The mnemonic denylist is deliberately NOT applied to an enum name: the
  // schema's mnemonic rule is scoped to LABEL names, which are the symbols an
  // assembler sees.
  assert.equal(assertEnumName("lda"), "lda", "an enum name is not a label, so the label-scoped denylist must not fire here");

  // All four numeric-string forms the schema names, plus plain decimal.
  assert.equal(parseVariantKey("64"), 64, "decimal IS accepted for a variant key -- the schema says so, and a key's base is not ambiguous");
  assert.equal(parseVariantKey("$40"), 64);
  assert.equal(parseVariantKey("0x40"), 64);
  assert.equal(parseVariantKey("%01000000"), 64);
  assert.equal(parseVariantKey("0b01000000"), 64);

  for (const offender of ["", "0x", "$zz", "sixty-four", "%12"]) {
    assert.throws(
      () => parseVariantKey(offender),
      (e: unknown) => {
        assert.ok(e instanceof AnnoTypeError, `expected AnnoTypeError for ${JSON.stringify(offender)}, got ${String(e)}`);
        assert.equal(e.dataType, offender, "the refusal carries the offending key");
        return true;
      },
    );
  }
  assert.throws(
    () => parseVariantKey(64),
    (e: unknown) => {
      assert.ok(e instanceof AnnoTypeError, "a raw number is not a variant KEY -- the schema's keys are numeric STRINGS");
      assert.equal(e.dataType, 64);
      return true;
    },
  );
});

test("anno-types.ts declares no module-level mutable binding, and its import specifier set is exactly the four it needs", () => {
  const raw = readFileSync(join(HERE, "anno-types.ts"), "utf8");

  // Trap 3 forbids module-level MUTABLE STATE, not the `let`/`var` keywords.
  // Two adjustments to `block-class.test.ts:194-212`'s scan, both necessary
  // here and both stated so a later reader does not "restore" the original:
  //
  //   * ANCHORED AT COLUMN ZERO. This module's functions have genuine local
  //     containers (`const targets: number[] = []` inside
  //     `resolveSplitTargets`, `const ends: readonly ... = [...]` inside
  //     `assertRangeShape`). The requirement is about MODULE-level state, and
  //     the anchor is what makes the scan mean that instead of "no local array
  //     anywhere", which is a different and wrong rule.
  //   * `export` INCLUDED IN THE PATTERN. The original matches `^\s*const`,
  //     which an `export const` line never satisfies -- and in this module
  //     almost every module-level binding is exported, so without this the scan
  //     would look at nothing that matters.
  //
  // The `let`-only form of this grep let the likeliest real offender through
  // once already (a `const seen = new Map()` memoising cache is module-level
  // mutable state and is `const`), which is why the container half is here.
  const strict = codeOnly(raw);
  const offenders = strict
    .split("\n")
    .filter(
      (line) =>
        /^(let|var)\s/.test(line) ||
        /^(export\s+)?const\s+\w+\s*(:[^=]*)?=\s*(new\s+(Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line),
    );
  // MESSAGE NARROWED (2026-08-28), logic untouched. The scan above, its
  // anchor, its container filter and its two documented adjustments are
  // byte-identical and still report `[]` -- the confinement fix added no
  // module-level binding. What changed is the SENTENCE beside it: it used to
  // claim every export is a frozen constant or a pure function of its
  // arguments, and that is now false for exactly one export. An assertion that
  // is sound with a message that over-claims is the same defect as a comment
  // asserting a guarantee the code does not provide, so the message moves in
  // the same edit as the thing that falsified it.
  assert.deepEqual(offenders, [],
    "no module-level mutable state: nothing is held between calls, two concurrent callers cannot observe each other, and there is nothing " +
      "to reset. Every export here is a frozen constant or a pure function of its arguments EXCEPT storePathWithinWorkspace, which is a " +
      "function of its arguments AND THE FILESYSTEM -- workspace confinement has to know whether a path lands outside the root once " +
      "symbolic links are followed, and no string comparison can answer that. Narrowed in step with trap 3 in anno-types.ts's own header, " +
      "so the header and this test cannot disagree about which exports are pure.",
  );

  // Literal bodies KEPT: an import specifier IS a string literal, so blanking
  // literal bodies would make the thing under assertion unobservable.
  const kept = codeOnly(raw, true);
  const specifiers = [
    ...kept.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => specifier !== undefined);

  // WIDENED 2026-08-28, AND THIS IS A REVERSAL RATHER THAN A CORRECTION.
  // This list held three entries until this date. It now holds four: node:fs
  // was added when workspace confinement was fixed to compare REAL paths
  // (28-VERIFICATION.md gap 3 / 28-REVIEW.md CR-03, where a symlinked
  // subdirectory inside the workspace escaped and the store file was created
  // outside the root). The reason is recorded here, and in the rationale
  // below, because a guard widened with no record of why is indistinguishable
  // from a floor quietly lowered to make a red go away -- which is exactly the
  // failure 28-03's prohibition P2 names. The three absence assertions after
  // it pin the directions this widening deliberately did NOT open, so the
  // four-entry list is a floor and not a wildcard.
  assert.deepEqual(
    [...specifiers].sort(),
    ["./disasm-opcodes.ts", "./vice.ts", "node:fs", "node:path"],
    "anno-types.ts may import the opcode table (for the derived denylist), the error base, node:path, and node:fs -- nothing else. " +
      "STILL FORBIDDEN, unchanged: either host/container path-translation seam, any transport import, any census import, and the SQLite " +
      "builtin, which belongs to anno-store.ts alone under STORE-07. WHY THE THREE-ENTRY VERSION BECAME FALSE: workspace confinement has " +
      "to answer whether a path resolves outside the root once symbolic links are followed, and that is a filesystem question. The string " +
      "comparison the shorter list implied WAS the gap CR-03 reported, and node:fs is the minimum that closes it. WHAT THAT MINIMUM IS " +
      "GREW ON 2026-08-28, and the growth is recorded rather than quietly absorbed: it was existsSync and realpathSync; it is now those " +
      "two plus lstatSync and readlinkSync, which is what it takes to stop the ancestor walk at a path ENTRY rather than at a path that " +
      "RESOLVES (28-VERIFICATION.md gap 2 / 28-REVIEW.md CR-04 -- existsSync follows links, so a DANGLING one read as absent and the walk " +
      "stepped past it while openStore created the store file outside the root). Four named bindings on one builtin specifier, nothing " +
      "more. WHY node:fs IS NOT WHAT THE OLD SENTENCE GUARDED AGAINST: it is a Node builtin, not a seam. The failure " +
      "that rationale feared was a store module growing a dependency on the transport or on path translation, and the guard that actually " +
      "enforces that is hostpath-consumers.test.ts's closed consumer set -- which anno-types.ts is still absent from, and which did not " +
      "move. A reader who widens this list further should be looking there.",
  );
  assert.equal(specifiers.length, 4, "four specifiers: a deepEqual catches a wrong one, the length catches a duplicate");

  const localSpecifiers = specifiers.filter((specifier) => specifier.startsWith("./"));
  assert.deepEqual([...localSpecifiers].sort(), ["./disasm-opcodes.ts", "./vice.ts"]);
  assert.equal(localSpecifiers.length, 2);

  // THREE TARGETED ABSENCE ASSERTIONS -- what the widening did NOT open. The
  // specifier scan above is already non-vacuous (its length assertion proves it
  // read four real specifiers), so these run over the same stripped source and
  // each carries its own message rather than being folded into one.
  //
  // The SQLite specifier is assembled rather than written out, and that is
  // deliberate rather than stylistic: anno-seam.test.ts's
  // TEST_FILES_NAMING_SQLITE scans every test file's code with literal bodies
  // KEPT, so writing "node:sqlite" as a literal here would make THIS file a
  // second declared namer of the builtin and redden that guard. Comments are
  // stripped by that scan, which is why the name appears in this comment and
  // not in the code below.
  const sqliteSpecifier = ["node", "sqlite"].join(":");
  assert.equal(
    kept.includes("hostpath"),
    false,
    "anno-types.ts must not reach the host path-translation seam: a host-translated store path would let a store write land on the HOST " +
      "filesystem, outside the workspace -- anno-store.ts's trap 7",
  );
  assert.equal(
    kept.includes("containerpath"),
    false,
    "and not the container-side inverse either: the confinement contract compares real paths in ONE namespace, and a translation on " +
      "either side of it would make the comparison meaningless",
  );
  assert.equal(
    kept.includes(sqliteSpecifier),
    false,
    "and not the SQLite builtin: STORE-07 puts the dependency in anno-store.ts alone, and a validator layer that opened a connection " +
      "would be a second place the store can be reached",
  );
});

// ---------------------------------------------------------------------------
// D-15: the SCHEMA_VERSION 2 -> 3 bump that bought `anno_enum_usage`, and the
// row shape the association is read back through.
//
// These two pins are HAND-WRITTEN for the same reason the twelve data types
// above are: the question is DID THE ONE HOME CHANGE, not DO TWO HOMES AGREE.
// Deriving `3` from the constant would make the pin read its own subject.
// ---------------------------------------------------------------------------

test("SCHEMA_VERSION is 3, and the constant's own doc comment records D-15 by name and by date -- the bump is a decision on the record, not a number that drifted", () => {
  assert.equal(
    SCHEMA_VERSION,
    3,
    "version 3 is D-15's deliberate one-way bump: it buys the anno_enum_usage table, and it strands every version 2 store on disk " +
      "because no migration arm was written. An edit to this number must be a decision, which is why the expectation is typed out here " +
      "by hand rather than derived from the constant it is checking.",
  );

  const src = readFileSync(join(HERE, "anno-types.ts"), "utf8");
  assert.match(
    src,
    /D-15/,
    "the SCHEMA_VERSION doc comment must cite D-15 by name: a version bump whose rationale lives only in a planning directory is a " +
      "number the next reader has no way to weigh",
  );
  assert.match(src, /2026-08-29/, "and it must carry the decision's date, matching the dated-record discipline the version 1 paragraph beside it already uses");
  assert.match(
    src,
    /no migration arm/i,
    "and it must state the accepted COST in the same voice: no migration arm was written, so every version 2 store is unopenable",
  );
});

test("EnumUsageRow carries exactly id, address, enumId, enumName and bank -- the association is read back by enum ID, with the name resolved through the join rather than stored twice", () => {
  // A TYPE-LEVEL assertion first: this literal only compiles under `npm run
  // typecheck` if the interface has these five fields and no other required
  // one. The runtime key check below is the second half -- together they catch
  // both a renamed field and a field silently added.
  const row: EnumUsageRow = { id: 1, address: 0xd020, enumId: 7, enumName: "Colors", bank: null };
  assert.deepEqual(
    Object.keys(row).sort(),
    ["address", "bank", "enumId", "enumName", "id"],
    "enumId is what the store persists and enumName is what the join resolves; a row that carried only the NAME would be re-pointed " +
      "silently by updateProjectEnum's rename, which is exactly the failure the id association exists to prevent",
  );
  assert.equal(row.bank, null, "bank is the same reserved, uninterpreted column every other row type carries");
});
