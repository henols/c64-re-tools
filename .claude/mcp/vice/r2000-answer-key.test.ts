// r2000-answer-key.test.ts -- keeps criterion 1's (D-26) sealed answer key
// honest. Two independent failure classes it exists to catch:
//
//   1. T-11-SEAL-DRIFT: ANSWER.sha256 silently stops matching ANSWER.md's own
//      canonical line (someone edits one file and forgets the other). This
//      is the same class of defect Phase 10's WR-02 named: a committed claim
//      whose checker never actually checks it.
//   2. T-11-LEAK: QUESTION.md ends up containing the answer it asks for, so
//      plan 11-09 (session B) could answer by reading the question file
//      instead of by querying the store -- which would falsify criterion 1's
//      whole claim ("query the store instead of re-deriving") without
//      anyone noticing, because the automated suite would still be green.
//
// Both checks are pure file-reads against the phase's evidence/ directory --
// no regenerator2000 child, no D-11 gate needed. This file is TEST-ONLY: it
// is not (and must not be) listed in package.json's files[].
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// .claude/mcp/vice -> repo root -> .planning/phases/11-.../evidence/criterion1
const EVIDENCE_DIR = join(
  HERE,
  "..",
  "..",
  "..",
  ".planning",
  "phases",
  "11-annotation-store-enums-and-the-symbol-round-trip",
  "evidence",
  "criterion1",
);

const ANSWER_PATH = join(EVIDENCE_DIR, "ANSWER.md");
const ANSWER_SHA_PATH = join(EVIDENCE_DIR, "ANSWER.sha256");
const QUESTION_PATH = join(EVIDENCE_DIR, "QUESTION.md");

const OPEN_MARKER = "<!-- CANONICAL-ANSWER-LINE -->";
const CLOSE_MARKER = "<!-- /CANONICAL-ANSWER-LINE -->";

/**
 * Extracts the canonical answer line from ANSWER.md's own marker fence --
 * exactly the mechanism ANSWER.md's own header documents. Strictly between
 * the two marker lines, with the surrounding blank lines/newlines trimmed,
 * so the hashed text is exactly the single canonical line with no trailing
 * newline (matching QUESTION.md's stated hashing convention).
 */
function extractCanonicalLine(answerMd: string): string {
  const openIdx = answerMd.indexOf(OPEN_MARKER);
  const closeIdx = answerMd.indexOf(CLOSE_MARKER);
  assert.ok(openIdx !== -1, `ANSWER.md is missing its ${OPEN_MARKER} marker`);
  assert.ok(closeIdx !== -1, `ANSWER.md is missing its ${CLOSE_MARKER} marker`);
  assert.ok(closeIdx > openIdx, "ANSWER.md's close marker appears before its open marker");
  const between = answerMd.slice(openIdx + OPEN_MARKER.length, closeIdx);
  const line = between.trim();
  assert.ok(line.length > 0, "ANSWER.md's marker fence contains no canonical line");
  assert.ok(!line.includes("\n"), `ANSWER.md's marker fence must contain exactly one line, got: ${JSON.stringify(line)}`);
  return line;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

test("ANSWER.sha256 is exactly 64 hex characters", () => {
  const sealed = readFileSync(ANSWER_SHA_PATH, "utf8").trim();
  assert.match(sealed, /^[0-9a-f]{64}$/, `ANSWER.sha256 must be exactly 64 lowercase hex characters, got: ${JSON.stringify(sealed)}`);
});

test("ANSWER.sha256 matches the sha256 recomputed from ANSWER.md's own canonical line (T-11-SEAL-DRIFT)", () => {
  const answerMd = readFileSync(ANSWER_PATH, "utf8");
  const line = extractCanonicalLine(answerMd);
  const recomputed = sha256(line);
  const sealed = readFileSync(ANSWER_SHA_PATH, "utf8").trim();
  assert.equal(
    recomputed,
    sealed,
    `ANSWER.sha256 (${sealed}) does not match the sha256 recomputed from ANSWER.md's canonical line ` +
      `${JSON.stringify(line)} (${recomputed}) -- the seal has drifted from the answer it seals. Re-seal ` +
      `by recomputing sha256 of the exact canonical line (no trailing newline) and rewriting ANSWER.sha256.`,
  );
});

test("the canonical answer line matches QUESTION.md's own grammar (four lowercase key=value fields, single spaces)", () => {
  const answerMd = readFileSync(ANSWER_PATH, "utf8");
  const line = extractCanonicalLine(answerMd);
  assert.match(
    line,
    /^label=\S+ confidence=[a-z-]+ blocktype=[a-z]+ xrefcount=(0|[1-9][0-9]*)$/,
    `canonical line does not match the label=... confidence=... blocktype=... xrefcount=... grammar: ${JSON.stringify(line)}`,
  );
});

test("QUESTION.md does not contain the canonical answer line (T-11-LEAK)", () => {
  const answerMd = readFileSync(ANSWER_PATH, "utf8");
  const line = extractCanonicalLine(answerMd);
  const questionMd = readFileSync(QUESTION_PATH, "utf8");
  assert.ok(
    !questionMd.includes(line),
    "QUESTION.md contains the full canonical answer line -- it would let session B answer by " +
      "reading the question instead of querying the store.",
  );
});

test("QUESTION.md does not contain the sealed answer's distinctive field values (T-11-LEAK)", () => {
  const answerMd = readFileSync(ANSWER_PATH, "utf8");
  const line = extractCanonicalLine(answerMd);
  const questionMd = readFileSync(QUESTION_PATH, "utf8");

  const fields = Object.fromEntries(
    line.split(" ").map((pair) => {
      const eq = pair.indexOf("=");
      return [pair.slice(0, eq), pair.slice(eq + 1)];
    }),
  ) as Record<string, string>;

  assert.ok(fields.label, "canonical line has no label= field to check");

  // The label is the one field that is a genuinely distinctive, made-up
  // identifier (not drawn from a small enumerated vocabulary like
  // confidence grades, block types, or a bare integer count) -- checking it
  // as a whole word (not a bare substring) is the meaningful, non-vacuous
  // leak check. The other three fields are deliberately NOT checked as bare
  // substrings here: their values are drawn from small enumerated
  // vocabularies (five D-25 confidence grades, twelve r2000 block types,
  // small integers) that legitimately appear as illustrative examples
  // elsewhere in QUESTION.md's own field-rules prose -- forbidding the bare
  // word "byte" or the digit "2" from the whole document would be a vacuous
  // constraint that flags prose, not a leak. What IS checked for those
  // three fields is the compound "key=value" form, which only appears if
  // QUESTION.md quotes the actual sealed assignment.
  const labelPattern = new RegExp(`\\b${fields.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  assert.ok(
    !labelPattern.test(questionMd),
    `QUESTION.md contains the sealed label value "${fields.label}" as a standalone word -- this is ` +
      "the one distinctive, made-up field value and must not appear anywhere in the question.",
  );

  for (const key of ["confidence", "blocktype", "xrefcount"] as const) {
    const compound = `${key}=${fields[key]}`;
    assert.ok(
      !questionMd.includes(compound),
      `QUESTION.md contains the compound assignment "${compound}" verbatim -- this is the sealed ` +
        `answer's own ${key} field written in its canonical key=value form.`,
    );
  }
});
