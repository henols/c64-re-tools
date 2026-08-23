// docs-core-value-decision.test.ts
//
// WHY THIS EXISTS: CORE-01. Plan 17-02 recorded a dated, evidence-citing
// verdict inside PROJECT.md's `## Core Value` section: the statement is KEPT,
// with the evidence weighed named in place. A "kept, with a dated
// confirmation" verdict is the shape most prone to silent future drift -- a
// later edit can strip the date, soften the evidence citation, or quietly
// delete the reversal condition, and the section would still read plausibly
// to a casual reader. That is the identical argument that motivated
// `docs-fork-decision.test.ts`'s own existence for the FORK-01 row, and this
// file is its direct sibling for CORE-01: it makes the dated verdict's
// presence, dating, named evidence, and reversal condition a checked
// invariant instead of a one-time write.
//
// Like `docs-fork-decision.test.ts` and `docs-deferred-ledger.test.ts`, this
// file verifies planning-facing documentation, not runtime behaviour shipped
// in the tarball, and is deliberately kept OUT of `package.json`'s `files[]`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const PROJECT_MD = join(ROOT, ".planning/PROJECT.md");

/** Named, non-empty set of evidence phrases the CORE-01 entry must carry at
 * least one of, verbatim (case-sensitive) -- the two RESEARCH.md's `## Core
 * Value evidence` names as sufficient anchors. Its own length is asserted
 * non-zero in test 1, so an emptied set cannot make test 5's named-evidence
 * check vacuously pass by finding nothing to check. */
const EVIDENCE_PHRASES: readonly string[] = ["Phase 11", "sealed-question"];

/** Named, non-empty set of reversal-trigger phrases the CORE-01 entry must
 * carry at least one of, verbatim -- the same set `docs-fork-decision.test.ts`
 * uses for FORK-01's row, since both decisions follow the identical
 * dated-verdict shape. Its own length is asserted non-zero in test 1, so an
 * emptied set cannot make test 5's reversal-condition check vacuously pass by
 * finding nothing to check. */
const REVERSAL_PHRASES: readonly string[] = ["reverses if", "would reverse", "reversal criteria", "reopen"];

/** Non-vacuity floor on the section's own trimmed text length. Core Value is
 * prose, not a table -- the fork guard's `>= 20 rows` floor does not transfer
 * to a section with no rows at all. Generous enough not to be brittle against
 * routine copy-editing, small enough to fail if the section were ever
 * emptied back down to a bare heading. */
const MIN_SECTION_CHARS = 200;

/** Isolates the `## Core Value` section body: everything from that heading up
 * to (not including) the next `## ` heading. Returns `null` if the heading
 * cannot be found -- a renamed heading must FAIL the tests that depend on it,
 * not silently scan an empty string. Mirrors `docs-fork-decision.test.ts`'s
 * `keyDecisionsSection()`, retargeted at Core Value. */
function coreValueSection(projectMd: string): string | null {
  const m = projectMd.match(/^## Core Value\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}

/** Predicate: does the section carry an ISO `YYYY-MM-DD` date? A decision
 * recorded without a date cannot be distinguished from the default-carried
 * status quo CORE-01 exists to stop -- the same reasoning
 * `docs-fork-decision.test.ts`'s test 3 states for FORK-01's row. */
function hasIsoDate(section: string): boolean {
  return /\d{4}-\d{2}-\d{2}/.test(section);
}

/** Predicate: does the section name at least one of `EVIDENCE_PHRASES`
 * verbatim, case-sensitively? Mirrors `docs-fork-decision.test.ts`'s test 4
 * (the `KEYBOARD_MATRIX_SET` check) -- an entry that gestures at "the
 * evidence" without naming a specific piece of it is exactly the bookkeeping
 * edit `REQUIREMENTS.md`'s Out of Scope table describes. */
function hasNamedEvidence(section: string): boolean {
  return EVIDENCE_PHRASES.some((phrase) => section.includes(phrase));
}

/** Predicate: does the section carry at least one of `REVERSAL_PHRASES`
 * verbatim? A section with no stated reversal condition is a status-quo
 * restatement, not the dated decision CORE-01 requires -- mirrors
 * `docs-fork-decision.test.ts`'s test 5. */
function hasReversalPhrase(section: string): boolean {
  return REVERSAL_PHRASES.some((phrase) => section.includes(phrase));
}

test("1. non-vacuity: the Core Value section is located, clears a character floor, and the phrase sets are non-empty", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  // A rewrite that empties the section, or a heading rename that makes the
  // regex above match nothing, must FAIL this test -- not silently report an
  // empty section as a pass for the tests that key off it.
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading -- has it been renamed?");
  assert.ok(
    section!.trim().length >= MIN_SECTION_CHARS,
    `expected the Core Value section to clear a ${MIN_SECTION_CHARS}-character floor, found ${section!.trim().length}`,
  );
  assert.ok(
    EVIDENCE_PHRASES.length > 0,
    "EVIDENCE_PHRASES must be non-empty -- an emptied set would make test 5's named-evidence check vacuously pass",
  );
  assert.ok(
    REVERSAL_PHRASES.length > 0,
    "REVERSAL_PHRASES must be non-empty -- an emptied set would make test 5's reversal-condition check vacuously pass",
  );
});

test("2. the Core Value section states an ISO YYYY-MM-DD date", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  assert.ok(
    hasIsoDate(section!),
    "the Core Value section does not contain an ISO YYYY-MM-DD date -- a decision recorded without a date " +
      "cannot be distinguished from the default-carried status quo CORE-01 exists to stop",
  );
});

test("3. the Core Value section names at least one specific piece of evidence, verbatim", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  assert.ok(
    hasNamedEvidence(section!),
    `the Core Value section names none of the required evidence phrases (${EVIDENCE_PHRASES.join(", ")}) -- ` +
      "an entry that gestures at \"the evidence\" without naming a specific piece of it reads as a " +
      "bookkeeping edit, not a decision reached by weighing it",
  );
});

test("4. the Core Value section carries at least one named reversal-trigger phrase", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  assert.ok(
    hasReversalPhrase(section!),
    `the Core Value section contains none of the named reversal-trigger phrases (${REVERSAL_PHRASES.join(", ")}) -- ` +
      "a section with no stated reversal condition is a status-quo restatement, not the dated decision CORE-01 requires",
  );
});

test("5. planted violation: all three predicates fire on synthetic input, and the real, current text is flagged by none of them", () => {
  // A Core Value section with no date at all.
  const sectionMissingDate = `
A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program. Kept as-is on Phase 11's sealed-question evidence; this reverses if a
shipped skill demonstrably depends on cross-session recall.
`;
  assert.equal(hasIsoDate(sectionMissingDate), false, "predicate 1 (ISO date) failed to flag a synthetic section with no date at all");

  // A Core Value section with a date but no named evidence -- gestures at
  // "the evidence" without citing a specific piece of it.
  const sectionMissingEvidence = `
Kept as-is (CORE-01, decided 2026-08-23). The evidence was weighed and the
statement is retained. This reverses if a shipped skill demonstrably depends
on cross-session recall.
`;
  assert.equal(
    hasNamedEvidence(sectionMissingEvidence),
    false,
    "predicate 2 (named evidence) failed to flag a synthetic section citing no specific evidence phrase",
  );

  // A Core Value section with a date and named evidence but no reversal
  // condition -- a status-quo restatement wearing a date.
  const sectionMissingReversal = `
Kept as-is (CORE-01, decided 2026-08-23). Phase 11's sealed-question test was
weighed and the statement is retained as the strongest, most primary axis.
`;
  assert.equal(
    hasReversalPhrase(sectionMissingReversal),
    false,
    "predicate 3 (reversal condition) failed to flag a synthetic section with no stated reversal trigger",
  );

  // The real, current, corrected PROJECT.md text must be flagged by NONE of
  // the three predicates -- a guard that cannot be satisfied by the real
  // fixed state gets switched off (the same point
  // `docs-deferred-ledger.test.ts`'s own planted-violation test makes).
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const realSection = coreValueSection(projectMd);
  assert.ok(realSection !== null, "could not locate PROJECT.md's '## Core Value' heading");
  assert.ok(hasIsoDate(realSection!), "the real, corrected Core Value section must contain an ISO date");
  assert.ok(hasNamedEvidence(realSection!), "the real, corrected Core Value section must name specific evidence");
  assert.ok(hasReversalPhrase(realSection!), "the real, corrected Core Value section must state a reversal condition");
});
