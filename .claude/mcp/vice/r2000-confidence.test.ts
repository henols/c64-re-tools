// r2000-confidence.test.ts -- pins D-25's confidence-prefix convention: the
// five-grade vocabulary, the parser's must-throw-on-typo behaviour, the
// composer, and the search-query builder.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CONFIDENCE_GRADES,
  parseConfidencePrefix,
  formatConfidenceComment,
  searchQueryForGrade,
  R2000ConfidenceGradeError,
} from "./r2000-confidence.ts";

// ---------------------------------------------------------------------------
// Non-vacuity control: the vocabulary itself. A drift from
// memory-map.template.md's own confidence table must fail HERE.
// ---------------------------------------------------------------------------

test("CONFIDENCE_GRADES has exactly five members with the exact five phrases from the template", () => {
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

test("every grade round-trips through formatConfidenceComment -> parseConfidencePrefix", () => {
  for (const grade of CONFIDENCE_GRADES) {
    const comment = formatConfidenceComment(grade.token, "some evidence text");
    assert.equal(comment, `${grade.bracket} some evidence text`);
    const parsed = parseConfidencePrefix(comment);
    assert.equal(parsed.grade?.token, grade.token);
    assert.equal(parsed.rest, "some evidence text");
  }
});

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
      assert.ok(err instanceof R2000ConfidenceGradeError);
      const typed = err as R2000ConfidenceGradeError;
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
  assert.throws(() => parseConfidencePrefix("[CONFIRMED-CODE] foo"), R2000ConfidenceGradeError);
});

test("parseConfidencePrefix throws on an underscore instead of a hyphen", () => {
  assert.throws(() => parseConfidencePrefix("[confirmed_code] foo"), R2000ConfidenceGradeError);
});

test("parseConfidencePrefix throws on a plural", () => {
  assert.throws(() => parseConfidencePrefix("[confirmed-codes] foo"), R2000ConfidenceGradeError);
});

test("parseConfidencePrefix throws on extra whitespace inside the brackets", () => {
  assert.throws(() => parseConfidencePrefix("[ confirmed-code] foo"), R2000ConfidenceGradeError);
  assert.throws(() => parseConfidencePrefix("[confirmed-code ] foo"), R2000ConfidenceGradeError);
});

test("parseConfidencePrefix throws on a near-miss single-word grade", () => {
  assert.throws(() => parseConfidencePrefix("[unkown] foo"), R2000ConfidenceGradeError);
});

// ---------------------------------------------------------------------------
// formatConfidenceComment / searchQueryForGrade reject an invalid token too
// -- the composer and query builder must not silently accept a caller's own
// misspelling either.
// ---------------------------------------------------------------------------

test("formatConfidenceComment throws on an invalid grade token", () => {
  assert.throws(() => formatConfidenceComment("confimed-code", "x"), R2000ConfidenceGradeError);
});

test("searchQueryForGrade throws on an invalid grade token", () => {
  assert.throws(() => searchQueryForGrade("confimed-code"), R2000ConfidenceGradeError);
});

// ---------------------------------------------------------------------------
// searchQueryForGrade: the returned string appears verbatim in a graded
// comment, so the "still [grade]" query has exactly one spelling.
// ---------------------------------------------------------------------------

test("searchQueryForGrade returns a string that appears verbatim in a graded comment", () => {
  for (const grade of CONFIDENCE_GRADES) {
    const query = searchQueryForGrade(grade.token);
    const comment = formatConfidenceComment(grade.token, "evidence");
    assert.ok(comment.includes(query), `expected "${comment}" to include "${query}"`);
  }
});
