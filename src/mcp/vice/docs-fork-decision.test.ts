// docs-fork-decision.test.ts
//
// WHY THIS EXISTS: FORK-01. This project answered the fork-backend question
// by default at two milestone closes in a row. Phase 14 broke that pattern
// with a dated `retain` decision recorded in `.planning/PROJECT.md`'s `##
// Key Decisions` table. On 2026-09-12 that decision was ITSELF reversed: the
// owner reported the fork never worked, and the project's own v0.8.0 close
// audit had already recorded in writing that the hedge it retained was never
// exercised. A dated decision written in prose can drift the same way
// `docs-linerefs.test.ts`'s line citations and `docs-deferred-ledger.test.ts`'s
// pending-todo table drifted -- a later edit can silently strip the reversal
// date, drop the `docs/stock-hard-losses.md` acceptance-record citation, or
// let the Out of Scope bullet and the Key Decisions row start contradicting
// each other again (e.g. one saying "removed", the other still reading
// "retained"). This file makes the reversal's presence, dating, and
// re-reversal criteria a checked invariant instead of a one-time write.
//
// Like `docs-linerefs.test.ts` and `docs-deferred-ledger.test.ts`, this file
// verifies planning-facing documentation, not runtime behaviour shipped in
// the tarball, and is deliberately kept OUT of package.json's files[].
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const PROJECT_MD = join(ROOT, ".planning/PROJECT.md");
const STOCK_HARD_LOSSES_RELATIVE = "docs/stock-hard-losses.md";
const STOCK_HARD_LOSSES_MD = join(ROOT, STOCK_HARD_LOSSES_RELATIVE);

/** Named, non-empty set of re-reversal phrases the FORK-01 row must carry at
 * least one of, verbatim -- the condition under which the 2026-09-12
 * reversal would itself be reversed (i.e. the fork reinstated). Its own
 * length is asserted non-zero in test 1 below, so an emptied set cannot make
 * test 5's check vacuously pass by finding nothing to check. Renamed from
 * the pre-reversal `REVERSAL_PHRASES` (which named the retain-era trigger
 * for reversing INTO removal); this set names the trigger for reversing
 * BACK, now that removal is the current state. */
const RE_REVERSAL_PHRASES: readonly string[] = [
  "re-reverses only if",
  "reinstates the fork",
  "restores the fork",
];

/** Isolates the `## Key Decisions` table body: everything from that heading
 * up to (not including) the next `## ` heading. Returns `null` if the
 * heading cannot be found -- a renamed heading must FAIL the tests that
 * depend on it, not silently scan an empty string. */
function keyDecisionsSection(projectMd: string): string | null {
  const m = projectMd.match(/^## Key Decisions\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}

/** Every real data row of the Key Decisions table: lines beginning `| `
 * (pipe, space -- the separator row `|---|---|---|` has no space after its
 * leading pipe and is excluded by construction), minus the header row
 * itself. */
function keyDecisionsDataRows(section: string): string[] {
  return section
    .split("\n")
    .filter((line) => line.startsWith("| "))
    .filter((line) => line !== "| Decision | Rationale | Outcome |");
}

/** Isolates the `### Out of Scope` section body: everything from that
 * heading up to (not including) the next `## ` heading. Returns `null` if
 * the heading cannot be found. Scoping to this section (rather than the
 * whole file) avoids false hits like the unrelated "The fork backend keeps
 * working..." validated-requirement bullet elsewhere in PROJECT.md. */
function outOfScopeSection(projectMd: string): string | null {
  const m = projectMd.match(/^### Out of Scope\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}

/** Isolates the Out of Scope bullet whose BOLDED subject names "fork
 * backend" -- e.g. "- **Re-adding the fork backend, or any second
 * backend, once removed** -- ...". Matched on the bold span specifically
 * (not the whole line) the same way `docs-linerefs.test.ts`'s
 * `findRewriteArgumentsBullet()` isolates one bullet from many by substring
 * -- a sibling bullet that merely mentions "fork backend" in its body prose
 * (e.g. the SID write-shadowing bullet) must NOT be picked up as this one.
 * Returns `null` if no such bullet exists in the section. */
function findForkBackendBullet(section: string): string | null {
  const lines = section.split("\n");
  const hit = lines.find((line) => /^-\s+\*\*[^*]*fork backend[^*]*\*\*/.test(line.trim()));
  return hit ?? null;
}

/** Locates the one FORK-01 row, asserting it uniquely exists. Shared by
 * tests 3-5 and 7 so each can assume the row was found rather than
 * re-deriving the lookup (and re-failing identically if it is ever
 * missing). */
function findForkRow(section: string): string {
  const rows = keyDecisionsDataRows(section);
  const forkRows = rows.filter((row) => row.includes("FORK-01"));
  assert.equal(
    forkRows.length,
    1,
    `expected exactly one Key Decisions row containing FORK-01, found ${forkRows.length}`,
  );
  return forkRows[0]!;
}

test("1. non-vacuity: the Key Decisions table is located and clears a 20-row floor", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  // A table rewrite that empties the section, or a heading rename that
  // makes the regex above match nothing, must FAIL this test -- not
  // silently report zero rows as a pass for the tests that key off it.
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading -- has it been renamed?");
  const rows = keyDecisionsDataRows(section!);
  assert.ok(rows.length >= 20, `expected at least 20 Key Decisions data rows, found ${rows.length}`);
  assert.ok(
    RE_REVERSAL_PHRASES.length > 0,
    "RE_REVERSAL_PHRASES must be non-empty -- an emptied set would make test 5's check vacuously pass",
  );
});

test("2. exactly one Key Decisions row names FORK-01", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading");
  const rows = keyDecisionsDataRows(section!);
  const forkRows = rows.filter((row) => row.includes("FORK-01"));
  assert.equal(
    forkRows.length,
    1,
    `expected exactly one Key Decisions row containing FORK-01, found ${forkRows.length} -- ` +
      "either the row is missing (the dated decision was never written or was later deleted) " +
      "or a duplicate row was added",
  );
});

test("3. the FORK-01 row states an ISO YYYY-MM-DD date", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading");
  const forkRow = findForkRow(section!);
  assert.match(
    forkRow,
    /\d{4}-\d{2}-\d{2}/,
    "the FORK-01 row does not contain an ISO YYYY-MM-DD date -- a decision recorded without a date " +
      "cannot be distinguished from the default-carried status quo FORK-01 exists to stop",
  );
});

test("4. the FORK-01 row names KEYBOARD_MATRIX_SET in its canonical upper-case spelling (case-sensitive)", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading");
  const forkRow = findForkRow(section!);
  // Deliberately NOT a case-insensitive match. REQUIREMENTS.md's UP-01 and
  // VICE's own opcode naming both use the upper-case spelling
  // `KEYBOARD_MATRIX_SET`; a lower-case-only mention (e.g. "keyboard_matrix_set")
  // is not the canonical opcode name and must fail this guard, not pass it.
  assert.ok(
    forkRow.includes("KEYBOARD_MATRIX_SET"),
    "the FORK-01 row does not contain the literal, upper-case 'KEYBOARD_MATRIX_SET' -- " +
      "a case-insensitive match was deliberately NOT used here, so a lower-case-only mention " +
      "of the opcode does not satisfy this guard",
  );
});

test("5. the FORK-01 row carries at least one named re-reversal-trigger phrase", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading");
  const forkRow = findForkRow(section!);
  assert.ok(RE_REVERSAL_PHRASES.length > 0, "RE_REVERSAL_PHRASES must be non-empty -- see test 1");
  const matched = RE_REVERSAL_PHRASES.filter((phrase) => forkRow.includes(phrase));
  assert.ok(
    matched.length > 0,
    `the FORK-01 row contains none of the named re-reversal-trigger phrases (${RE_REVERSAL_PHRASES.join(", ")}) -- ` +
      "a row with no stated re-reversal condition reads as a status-quo restatement, not the dated " +
      "reversal FORK-01 now requires",
  );
});

test("6. the Out of Scope fork-backend bullet cites FORK-01", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = outOfScopeSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '### Out of Scope' heading -- has it been renamed?");
  const bullet = findForkBackendBullet(section!);
  assert.ok(
    bullet !== null,
    "could not find an Out of Scope bullet whose bolded subject names 'fork backend' -- has it been reworded or removed?",
  );
  assert.ok(
    bullet!.includes("FORK-01"),
    "the Out of Scope fork-backend bullet does not cite FORK-01 -- the bullet and the Key Decisions row " +
      "can silently contradict each other without this cross-reference",
  );
});

test("7. the FORK-01 row cites docs/stock-hard-losses.md, and that acceptance record exists and is non-vacuous", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading");
  const forkRow = findForkRow(section!);
  assert.ok(
    forkRow.includes(STOCK_HARD_LOSSES_RELATIVE),
    `the FORK-01 row does not cite '${STOCK_HARD_LOSSES_RELATIVE}' -- the reversal's cost (the three ` +
      "permanent hard losses it accepts) must be reachable from the decision, not a floating file",
  );
  assert.ok(
    existsSync(STOCK_HARD_LOSSES_MD),
    `'${STOCK_HARD_LOSSES_RELATIVE}' does not exist at the repo root -- the FORK-01 row cites a file that ` +
      "was never created",
  );
  const contents = readFileSync(STOCK_HARD_LOSSES_MD, "utf8");
  assert.ok(
    contents.length > 1000,
    `'${STOCK_HARD_LOSSES_RELATIVE}' is only ${contents.length} bytes -- an emptied stub cannot pass this floor`,
  );
  assert.ok(contents.includes("SID"), `'${STOCK_HARD_LOSSES_RELATIVE}' does not mention 'SID'`);
  assert.ok(contents.includes("RESTORE"), `'${STOCK_HARD_LOSSES_RELATIVE}' does not mention 'RESTORE'`);
  assert.ok(
    contents.includes("vice_keyboard_matrix"),
    `'${STOCK_HARD_LOSSES_RELATIVE}' does not mention the tool name 'vice_keyboard_matrix'`,
  );
});
