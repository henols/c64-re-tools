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

/** CR-01 (17-REVIEW.md): the literal, bolded verdict marker this file's own
 * header says CORE-01 recorded -- `**Kept as-is (CORE-01, decided
 * YYYY-MM-DD).**`. This is the ONE anchor every other predicate below is now
 * scoped from. Before this fix, `hasIsoDate`/`hasNamedEvidence`/
 * `hasReversalPhrase` scanned the WHOLE section independently, with nothing
 * checking what the verdict itself says -- a synthetic section stating the
 * OPPOSITE conclusion ("should be REMOVED, not kept") but still carrying a
 * bare date, "Phase 11", and a reversal-shaped phrase passed all three. */
const VERDICT_RE = /\*\*Kept as-is \(CORE-01, decided (\d{4}-\d{2}-\d{2})\)\.\*\*/;

/** Predicate: does the section carry the literal, anchored CORE-01 verdict
 * marker at all? This is the check CR-01 found missing entirely -- none of
 * the original three predicates checked the verdict word itself, only three
 * independent, unanchored tokens anywhere in the section. A section that
 * flips or drops the verdict while leaving a stray date/evidence-phrase/
 * reversal-phrase elsewhere must fail HERE. */
function hasVerdictMarker(section: string): boolean {
  return VERDICT_RE.test(section);
}

/** The verdict window: everything from the verdict marker's own start
 * offset to the end of the section. `null` when the marker is not present at
 * all (`hasVerdictMarker` is false) -- callers must not fall back to
 * scanning the whole section in that case, since doing so is exactly the
 * unanchored behaviour CR-01 flagged. Scoping the date/evidence/reversal
 * checks to this window (rather than the whole section) means an unrelated
 * "Phase 11" or bare date appearing BEFORE the verdict marker -- e.g. in the
 * leading Core Value statement itself -- cannot satisfy them. */
function verdictWindow(section: string): string | null {
  const m = section.match(VERDICT_RE);
  if (!m || m.index === undefined) return null;
  return section.slice(m.index);
}

/** Predicate: does `text` carry an ISO `YYYY-MM-DD` date? A decision recorded
 * without a date cannot be distinguished from the default-carried status quo
 * CORE-01 exists to stop -- the same reasoning `docs-fork-decision.test.ts`'s
 * test 3 states for FORK-01's row. Callers pass the verdict window (see
 * `verdictWindow()` above), not the raw section, so this is no longer
 * satisfied by a date appearing anywhere unrelated in the section. */
function hasIsoDate(text: string): boolean {
  return /\d{4}-\d{2}-\d{2}/.test(text);
}

/** Predicate: does `text` name at least one of `EVIDENCE_PHRASES` verbatim,
 * case-sensitively? Mirrors `docs-fork-decision.test.ts`'s test 4 (the
 * `KEYBOARD_MATRIX_SET` check) -- an entry that gestures at "the evidence"
 * without naming a specific piece of it is exactly the bookkeeping edit
 * `REQUIREMENTS.md`'s Out of Scope table describes. Callers pass the verdict
 * window, not the raw section (CR-01). */
function hasNamedEvidence(text: string): boolean {
  return EVIDENCE_PHRASES.some((phrase) => text.includes(phrase));
}

/** Predicate: does `text` carry at least one of `REVERSAL_PHRASES` verbatim?
 * A section with no stated reversal condition is a status-quo restatement,
 * not the dated decision CORE-01 requires -- mirrors
 * `docs-fork-decision.test.ts`'s test 5. Callers pass the verdict window,
 * not the raw section (CR-01). */
function hasReversalPhrase(text: string): boolean {
  return REVERSAL_PHRASES.some((phrase) => text.includes(phrase));
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

test("2. the Core Value section carries the literal, anchored CORE-01 verdict marker", () => {
  // CR-01 (17-REVIEW.md): this is the predicate that was missing entirely --
  // the original three predicates never checked what the verdict itself
  // says, only three independent, unanchored tokens anywhere in the section.
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  assert.ok(
    hasVerdictMarker(section!),
    "the Core Value section does not carry the literal '**Kept as-is (CORE-01, decided YYYY-MM-DD).**' " +
      "verdict marker -- a reworded, softened, or reversed verdict must fail here, even if a bare date, " +
      "named evidence phrase, or reversal phrase still happens to appear elsewhere in the section",
  );
  assert.ok(
    verdictWindow(section!) !== null,
    "verdictWindow() could not locate the verdict marker's own offset even though hasVerdictMarker() reported true",
  );
});

test("3. the window starting at the verdict marker states an ISO YYYY-MM-DD date", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  const window = verdictWindow(section!);
  assert.ok(window !== null, "could not locate the verdict marker to scope the ISO-date check against");
  assert.ok(
    hasIsoDate(window!),
    "the text from the verdict marker onward does not contain an ISO YYYY-MM-DD date -- a decision recorded " +
      "without a date cannot be distinguished from the default-carried status quo CORE-01 exists to stop",
  );
});

test("4. the window starting at the verdict marker names at least one specific piece of evidence, verbatim", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  const window = verdictWindow(section!);
  assert.ok(window !== null, "could not locate the verdict marker to scope the named-evidence check against");
  assert.ok(
    hasNamedEvidence(window!),
    `the text from the verdict marker onward names none of the required evidence phrases ` +
      `(${EVIDENCE_PHRASES.join(", ")}) -- an entry that gestures at "the evidence" without naming a specific ` +
      "piece of it reads as a bookkeeping edit, not a decision reached by weighing it",
  );
});

test("5. the window starting at the verdict marker carries at least one named reversal-trigger phrase", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = coreValueSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Core Value' heading");
  const window = verdictWindow(section!);
  assert.ok(window !== null, "could not locate the verdict marker to scope the reversal-phrase check against");
  assert.ok(
    hasReversalPhrase(window!),
    `the text from the verdict marker onward contains none of the named reversal-trigger phrases ` +
      `(${REVERSAL_PHRASES.join(", ")}) -- a section with no stated reversal condition is a status-quo ` +
      "restatement, not the dated decision CORE-01 requires",
  );
});

test("6. planted violation: every predicate fires on synthetic input, and the real, current text is flagged by none of them", () => {
  // A Core Value section with no verdict marker at all (and, incidentally,
  // no bare date either).
  const sectionMissingDate = `
A Claude session can reliably drive a real C64 emulator to reverse-engineer a
program. Kept as-is on Phase 11's sealed-question evidence; this reverses if a
shipped skill demonstrably depends on cross-session recall.
`;
  assert.equal(hasVerdictMarker(sectionMissingDate), false, "predicate: verdict marker failed to flag a synthetic section with no verdict marker (and no date) at all");
  assert.equal(verdictWindow(sectionMissingDate), null, "verdictWindow() must return null when no verdict marker is present");

  // A Core Value section with the verdict marker (and its embedded date) but
  // no named evidence within the window -- gestures at "the evidence"
  // without citing a specific piece of it.
  const sectionMissingEvidence = `
**Kept as-is (CORE-01, decided 2026-08-23).** The evidence was weighed and the
statement is retained. This reverses if a shipped skill demonstrably depends
on cross-session recall.
`;
  const windowMissingEvidence = verdictWindow(sectionMissingEvidence);
  assert.ok(windowMissingEvidence !== null, "verdictWindow() failed to locate the marker in the 'missing evidence' fixture");
  assert.equal(
    hasNamedEvidence(windowMissingEvidence!),
    false,
    "predicate (named evidence) failed to flag a synthetic window citing no specific evidence phrase",
  );

  // A Core Value section with the verdict marker and named evidence within
  // the window, but no reversal condition -- a status-quo restatement
  // wearing a dated verdict marker.
  const sectionMissingReversal = `
**Kept as-is (CORE-01, decided 2026-08-23).** Phase 11's sealed-question test was
weighed and the statement is retained as the strongest, most primary axis.
`;
  const windowMissingReversal = verdictWindow(sectionMissingReversal);
  assert.ok(windowMissingReversal !== null, "verdictWindow() failed to locate the marker in the 'missing reversal' fixture");
  assert.equal(
    hasReversalPhrase(windowMissingReversal!),
    false,
    "predicate (reversal condition) failed to flag a synthetic window with no stated reversal trigger",
  );

  // CR-01's exact reproduced shape: the opposite verdict, with a bare date,
  // "Phase 11", and a reversal-shaped phrase all still present UNANCHORED
  // elsewhere in the text. Before this fix, hasIsoDate/hasNamedEvidence/
  // hasReversalPhrase ran unanchored over the whole section and all three
  // returned true on this text -- nothing checked the verdict itself.
  const sectionFlippedVerdict = `
This project's core value statement should be REMOVED, not kept, decided
2026-08-23, since none of the evidence justifies retaining it as the primary
axis. Unrelated aside: Phase 11 shipped tooling not used for this argument.
This would reverse if someone reads this paragraph again next milestone.
`;
  assert.ok(hasIsoDate(sectionFlippedVerdict), "sanity: the flipped-verdict fixture still carries a bare ISO date");
  assert.ok(hasNamedEvidence(sectionFlippedVerdict), "sanity: the flipped-verdict fixture still names evidence (Phase 11)");
  assert.ok(hasReversalPhrase(sectionFlippedVerdict), "sanity: the flipped-verdict fixture still carries a reversal-shaped phrase (would reverse)");
  assert.equal(
    hasVerdictMarker(sectionFlippedVerdict),
    false,
    "the verdict-marker predicate must flag a section with all three unanchored tokens present but the verdict " +
      "itself flipped or missing -- this is CR-01's exact reproduction, which the pre-fix predicates all missed",
  );
  assert.equal(
    verdictWindow(sectionFlippedVerdict),
    null,
    "verdictWindow() must return null for the flipped-verdict fixture, even though unanchored tokens exist elsewhere in the text",
  );

  // The real, current, corrected PROJECT.md text must be flagged by NONE of
  // the predicates -- a guard that cannot be satisfied by the real fixed
  // state gets switched off (the same point `docs-deferred-ledger.test.ts`'s
  // own planted-violation test makes).
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const realSection = coreValueSection(projectMd);
  assert.ok(realSection !== null, "could not locate PROJECT.md's '## Core Value' heading");
  assert.ok(hasVerdictMarker(realSection!), "the real, corrected Core Value section must carry the anchored CORE-01 verdict marker");
  const realWindow = verdictWindow(realSection!);
  assert.ok(realWindow !== null, "verdictWindow() failed to locate the marker in the real, corrected PROJECT.md text");
  assert.ok(hasIsoDate(realWindow!), "the real, corrected Core Value section's verdict window must contain an ISO date");
  assert.ok(hasNamedEvidence(realWindow!), "the real, corrected Core Value section's verdict window must name specific evidence");
  assert.ok(hasReversalPhrase(realWindow!), "the real, corrected Core Value section's verdict window must state a reversal condition");
});
