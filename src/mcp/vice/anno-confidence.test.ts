// anno-confidence.test.ts -- pins D-25's confidence-prefix convention: the
// five-grade vocabulary, the parser's must-throw-on-typo behaviour, the
// composer, and the search-query builder.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONFIDENCE_GRADES,
  parseConfidencePrefix,
  AnnoConfidenceGradeError,
} from "./anno-confidence.mts";

// ---------------------------------------------------------------------------
// Non-vacuity control: the vocabulary itself. A drift from
// skills/c64-annotations/SKILL.md's own confidence table must fail HERE.
// ---------------------------------------------------------------------------

test("CONFIDENCE_GRADES has exactly five members with the exact five phrases from the skill's table", () => {
  assert.equal(CONFIDENCE_GRADES.length, 5);
  const phrases = CONFIDENCE_GRADES.map((g) => g.phrase);
  assert.deepEqual(phrases, [
    "confirmed code",
    "probable code",
    "confirmed data",
    "probable data",
    "unknown",
  ]);
});

test("CONFIDENCE_GRADES tokens and brackets are the five canonical bracket tokens", () => {
  const tokens = CONFIDENCE_GRADES.map((g) => g.token);
  assert.deepEqual(tokens, [
    "confirmed-code",
    "probable-code",
    "confirmed-data",
    "probable-data",
    "unknown",
  ]);
  const brackets = CONFIDENCE_GRADES.map((g) => g.bracket);
  assert.deepEqual(brackets, [
    "[confirmed-code]",
    "[probable-code]",
    "[confirmed-data]",
    "[probable-data]",
    "[unknown]",
  ]);
});

// ---------------------------------------------------------------------------
// Round trip: each of the five tokens survives format -> parse.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Ungraded comments are legal, never an error.
// ---------------------------------------------------------------------------

test("parseConfidencePrefix returns grade: null for a plain comment, without throwing", () => {
  const parsed = parseConfidencePrefix("plain comment");
  assert.equal(parsed.grade, null);
  assert.equal(parsed.rest, "plain comment");
});

test("parseConfidencePrefix returns grade: null for an empty comment", () => {
  const parsed = parseConfidencePrefix("");
  assert.equal(parsed.grade, null);
  assert.equal(parsed.rest, "");
});

test("parseConfidencePrefix returns grade: null for a comment with an unclosed bracket", () => {
  const parsed = parseConfidencePrefix("[confirmed-code without a closing bracket");
  assert.equal(parsed.grade, null);
});

// ---------------------------------------------------------------------------
// The point of the module: a typo'd bracket token THROWS, never silently
// degrades to an ungraded comment. Six distinct near-miss shapes, per the
// plan's acceptance criteria.
// ---------------------------------------------------------------------------

test("parseConfidencePrefix throws on a plain typo, naming the offending token and all five valid ones", () => {
  assert.throws(
    () => parseConfidencePrefix("[confimed-code] foo"),
    (err: unknown) => {
      assert.ok(err instanceof AnnoConfidenceGradeError);
      const typed = err as AnnoConfidenceGradeError;
      assert.equal(typed.offendingToken, "confimed-code");
      assert.match(typed.message, /confimed-code/);
      for (const grade of CONFIDENCE_GRADES) {
        assert.match(typed.message, new RegExp(grade.bracket.replace(/[[\]]/g, "\\$&")));
      }
      return true;
    },
  );
});

test("parseConfidencePrefix throws on wrong case", () => {
  assert.throws(() => parseConfidencePrefix("[CONFIRMED-CODE] foo"), AnnoConfidenceGradeError);
});

test("parseConfidencePrefix throws on an underscore instead of a hyphen", () => {
  assert.throws(() => parseConfidencePrefix("[confirmed_code] foo"), AnnoConfidenceGradeError);
});

test("parseConfidencePrefix throws on a plural", () => {
  assert.throws(() => parseConfidencePrefix("[confirmed-codes] foo"), AnnoConfidenceGradeError);
});

test("parseConfidencePrefix throws on extra whitespace inside the brackets", () => {
  assert.throws(() => parseConfidencePrefix("[ confirmed-code] foo"), AnnoConfidenceGradeError);
  assert.throws(() => parseConfidencePrefix("[confirmed-code ] foo"), AnnoConfidenceGradeError);
});

test("parseConfidencePrefix throws on a near-miss single-word grade", () => {
  assert.throws(() => parseConfidencePrefix("[unkown] foo"), AnnoConfidenceGradeError);
});

// ---------------------------------------------------------------------------
// formatConfidenceComment / searchQueryForGrade reject an invalid token too
// -- the composer and query builder must not silently accept a caller's own
// misspelling either.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// searchQueryForGrade: the returned string appears verbatim in a graded
// comment, so the "still [grade]" query has exactly one spelling.
// ---------------------------------------------------------------------------
