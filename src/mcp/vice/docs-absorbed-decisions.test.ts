// docs-absorbed-decisions.test.ts
//
// WHY THIS EXISTS: D18-30. `anno_get_address_details` was excluded from the
// curated anno_* surface by D-32 (Phase 11, v0.3.0) and carried, unexamined,
// into v0.4.0. Phase 18 re-decides it with D-36 -- a dated decision that
// supersedes D-32, states the client-side-composition verdict, and names a
// specific reversal trigger (an upstream fix to the external analyser issue #42).
// This is the SECOND milestone the item has been carried; D18-30 says a
// pinning guard is what stops a third. Like `docs-fork-decision.test.ts` and
// `docs-core-value-decision.test.ts`, a dated decision written in prose can
// drift silently -- a later edit can strip the date, soften the reversal
// trigger, or let the D-36 row and the ARCHITECTURE.md reversal record it
// implements start contradicting each other. This file makes both records'
// presence, dating, and named content a checked invariant instead of a
// one-time write.
//
// This file verifies planning-facing documentation (`.planning/ARCHITECTURE.md`
// and `.planning/PROJECT.md`), not runtime behaviour shipped in the tarball,
// and is therefore deliberately kept OUT of `package.json`'s `files[]`, the
// same way its `docs-fork-decision.test.ts` and `docs-core-value-decision.test.ts`
// siblings are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const ARCHITECTURE_MD = join(ROOT, ".planning/ARCHITECTURE.md");
const PROJECT_MD = join(ROOT, ".planning/PROJECT.md");

/** Named, non-empty set of reversal-trigger phrases the D-36 row must carry
 * at least one of, verbatim -- the identical set `docs-fork-decision.test.ts`
 * uses for FORK-01's row (duplicated here rather than imported, following
 * `docs-core-value-decision.test.ts`'s own precedent for reusing this exact
 * set without creating a cross-test-file import). Its own length is asserted
 * non-zero in test 1, so an emptied set cannot make test 4's reversal-phrase
 * check vacuously pass by finding nothing to check. */
const REVERSAL_PHRASES: readonly string[] = ["reverses if", "would reverse", "reversal criteria"];

/** Named, non-empty set of guard filenames the Architecture Change Record's
 * step 5 must name. Its own length is asserted non-zero in test 1, so an
 * emptied set cannot make test 2's filename check vacuously pass by finding
 * nothing to check.
 *
 * RE-POINTED BY PHASE 29 PLAN 29-05, and both halves of the move matter.
 * `spawn-seam.test.ts` is `spawn-seam.test.ts` now -- a rename, the
 * same guard. `anno-session.test.ts` is NOT renamed: plan 29-10 deletes it
 * with the session primitive it gates, so naming it here would be a scheduled
 * red rather than a check. It is replaced by `anno-durability.test.ts`, the
 * owned store's crash-durability gate, which is the surviving guard carrying
 * the save-discipline half of what step 5 records -- a mutation must be on
 * disk when the call resolves, proven by planted violation. Both names are
 * added to ARCHITECTURE.md's step 5 in the same commit as this change, since
 * this array is checked BY CONTAINMENT against that section's text. */
const GUARD_FILENAMES: readonly string[] = ["spawn-seam.test.ts", "anno-durability.test.ts"];

/** Isolates a Markdown section body: everything after the line starting with
 * `headingPrefix`, up to (not including) the next heading line of any level
 * (`#` through `######`). Returns `null` if no line starts with
 * `headingPrefix` -- a renamed heading must FAIL the tests that depend on
 * it, not silently scan an empty string.
 *
 * Deliberately line-based rather than a single non-greedy regex with a `$`
 * lookahead: `docs-fork-decision.test.ts` and `docs-core-value-decision.test.ts`
 * both anchor their non-greedy match on `(?=\n## )`, which only works
 * because their target section is never the LAST section in the file. The
 * `## Architecture Change Record` section this file also isolates IS the
 * last section in `.planning/ARCHITECTURE.md` -- under the `m` flag, `$`
 * matches before every line ending, not just end-of-string, so a
 * `(?=\n## |$)`-style lookahead would incorrectly stop the match at the
 * first line ending inside the section instead of running to end of file.
 * The line-based approach below has no such failure mode: an absent next
 * heading simply means "take the rest of the file". */
function isolateSection(markdown: string, headingPrefix: string): string | null {
  const lines = markdown.split("\n");
  const startIdx = lines.findIndex((line) => line.startsWith(headingPrefix));
  if (startIdx === -1) return null;
  const rest = lines.slice(startIdx + 1);
  const nextHeadingIdx = rest.findIndex((line) => /^#{1,6} /.test(line));
  const bodyLines = nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx);
  return bodyLines.join("\n");
}

/** Isolates `.planning/ARCHITECTURE.md`'s `## Architecture Change Record`
 * section body. */
function architectureChangeRecordSection(architectureMd: string): string | null {
  return isolateSection(architectureMd, "## Architecture Change Record");
}

/** Isolates `.planning/ARCHITECTURE.md`'s `### Rule A21` section body. */
function ruleA21Section(architectureMd: string): string | null {
  return isolateSection(architectureMd, "### Rule A21");
}

/** Isolates the `## Key Decisions` table body: everything from that heading
 * up to (not including) the next `## ` heading. Returns `null` if the
 * heading cannot be found. Mirrors `docs-fork-decision.test.ts`'s own
 * `keyDecisionsSection()` (the `## Key Decisions` section is never the last
 * section in PROJECT.md, so the `(?=\n## )` lookahead is safe here, unlike
 * the ARCHITECTURE.md case above). */
function keyDecisionsSection(projectMd: string): string | null {
  const m = projectMd.match(/^## Key Decisions\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}

/** Every real data row of the Key Decisions table: lines beginning `| `
 * (pipe, space -- the separator row `|---|---|---|` has no space after its
 * leading pipe and is excluded by construction), minus the header row
 * itself. Reuses `docs-fork-decision.test.ts`'s own row-extraction shape. */
function keyDecisionsDataRows(section: string): string[] {
  return section
    .split("\n")
    .filter((line) => line.startsWith("| "))
    .filter((line) => line !== "| Decision | Rationale | Outcome |");
}

/** Locates the one D-36 row, asserting it uniquely exists. Shared by test 4
 * so it can assume the row was found rather than re-deriving the lookup. */
function findD36Row(section: string): string {
  const rows = keyDecisionsDataRows(section);
  const d36Rows = rows.filter((row) => row.includes("D-36"));
  assert.equal(d36Rows.length, 1, `expected exactly one Key Decisions row containing D-36, found ${d36Rows.length}`);
  return d36Rows[0]!;
}

test("1. non-vacuity: the guard's own phrase sets are non-empty and its section isolators return non-null for both documents", () => {
  // An emptied phrase/filename set, or a renamed heading that makes an
  // isolator return null, must FAIL here -- not silently make a later test
  // vacuously pass by finding nothing to check.
  assert.ok(
    REVERSAL_PHRASES.length > 0,
    "REVERSAL_PHRASES must be non-empty -- an emptied set would make test 4's reversal-phrase check vacuously pass",
  );
  assert.ok(
    GUARD_FILENAMES.length > 0,
    "GUARD_FILENAMES must be non-empty -- an emptied set would make test 2's filename check vacuously pass",
  );

  const architectureMd = readFileSync(ARCHITECTURE_MD, "utf8");
  assert.ok(
    architectureChangeRecordSection(architectureMd) !== null,
    "could not locate ARCHITECTURE.md's '## Architecture Change Record' heading -- has it been renamed?",
  );
  assert.ok(
    ruleA21Section(architectureMd) !== null,
    "could not locate ARCHITECTURE.md's '### Rule A21' heading -- has it been renamed?",
  );

  const projectMd = readFileSync(PROJECT_MD, "utf8");
  assert.ok(
    keyDecisionsSection(projectMd) !== null,
    "could not locate PROJECT.md's '## Key Decisions' heading -- has it been renamed?",
  );
});

test("2. ARCHITECTURE.md's Architecture Change Record names D-17/D-18, carries a date, has six numbered steps, and names both guard filenames in step 5", () => {
  const architectureMd = readFileSync(ARCHITECTURE_MD, "utf8");
  const section = architectureChangeRecordSection(architectureMd);
  assert.ok(section !== null, "could not locate ARCHITECTURE.md's '## Architecture Change Record' heading");

  assert.ok(section!.includes("D-17"), "the Architecture Change Record does not name D-17");
  assert.ok(section!.includes("D-18"), "the Architecture Change Record does not name D-18");
  assert.match(
    section!,
    /\d{4}-\d{2}-\d{2}/,
    "the Architecture Change Record does not carry an ISO YYYY-MM-DD date",
  );

  for (let step = 1; step <= 6; step++) {
    assert.match(
      section!,
      new RegExp(`^${step}\\. \\*\\*`, "m"),
      `the Architecture Change Record is missing numbered step ${step} (expected a line starting "${step}. **")`,
    );
  }

  for (const filename of GUARD_FILENAMES) {
    assert.ok(
      section!.includes(filename),
      `the Architecture Change Record's step 5 text does not name the guard filename ${filename}`,
    );
  }
});

test("3. ARCHITECTURE.md carries Rule A21 naming resolveStorePath, ChildProcess, and anno-mcp-client.ts", () => {
  const architectureMd = readFileSync(ARCHITECTURE_MD, "utf8");
  const section = ruleA21Section(architectureMd);
  assert.ok(section !== null, "could not locate ARCHITECTURE.md's '### Rule A21' heading");
  assert.ok(section!.includes("resolveStorePath"), "Rule A21's body does not name resolveStorePath");
  assert.ok(section!.includes("ChildProcess"), "Rule A21's body does not name ChildProcess");
  assert.ok(section!.includes("anno-mcp-client.ts"), "Rule A21's body does not name anno-mcp-client.ts");
});

test("4. PROJECT.md's Key Decisions D-36 row states supersession of D-32, names handler.rs:1894, the upstream issue url, and a named reversal-trigger phrase", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const section = keyDecisionsSection(projectMd);
  assert.ok(section !== null, "could not locate PROJECT.md's '## Key Decisions' heading");
  const row = findD36Row(section!);

  assert.ok(row.includes("supersedes D-32"), "the D-36 row does not state 'supersedes D-32'");
  assert.ok(row.includes("handler.rs:1894"), "the D-36 row does not name handler.rs:1894");
  assert.ok(row.includes("issues/42"), "the D-36 row does not name the upstream issue url (the external analyser issue #42)");

  const matched = REVERSAL_PHRASES.filter((phrase) => row.includes(phrase));
  assert.ok(
    matched.length > 0,
    `the D-36 row contains none of the named reversal-trigger phrases (${REVERSAL_PHRASES.join(", ")}) -- ` +
      "a row with no stated reversal condition is a status-quo restatement, not the dated decision D-36 requires",
  );
});

test("5. cross-document consistency: every PROJECT.md line naming D-32 also names D-36 or the word 'supersede'", () => {
  const projectMd = readFileSync(PROJECT_MD, "utf8");
  const lines = projectMd.split("\n").filter((line) => line.includes("D-32"));
  assert.ok(
    lines.length > 0,
    "expected at least one PROJECT.md line naming D-32 -- if D-32 is no longer mentioned at all, this test's " +
      "premise (that D-32 is superseded, not deleted) may no longer hold and should be re-examined by hand",
  );
  for (const line of lines) {
    assert.ok(
      line.includes("D-36") || line.includes("supersede"),
      `PROJECT.md line naming D-32 does not also name D-36 or the word "supersede", so a future reader cannot ` +
        `tell this is a superseded decision rather than a still-live one: ${line}`,
    );
  }
});
