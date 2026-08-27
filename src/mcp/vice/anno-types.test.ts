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

import { DATA_TYPES, SPLIT_DATA_TYPES } from "./anno-types.ts";

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
