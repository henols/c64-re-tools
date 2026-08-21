// docs-deferred-ledger.test.ts
//
// WHY THIS EXISTS: AUDIT-04. `STATE.md`'s "Deferred Items" table was v0.2.0's
// 13-item inheritance, hand-typed once at that milestone's close and then
// never updated: it listed two todos as Pending that had since moved to
// `.planning/todos/completed/`, and it never grew to include five todos
// opened during v0.3.0. This is structurally the SAME defect class as four
// other findings this phase (11.1) closes -- a list that stopped growing
// because nothing forced it to keep deriving from the ground truth. This
// file makes the Deferred Items <-> pending-todo-tree relationship a checked,
// two-directional invariant instead of a promise.
//
// SCOPE: only the `## Deferred Items` section of `STATE.md` is scanned, not
// the whole file. The rest of `STATE.md` legitimately mentions completed
// todos while describing their closure (e.g. "Also carried, not blocking"
// prose, `### Quick Tasks Completed`) -- the same false-positive reasoning
// `docs-dangling-refs.test.ts` records for why it does not scan
// `.planning/phases/**`. A guard that demanded the WHOLE file avoid ever
// mentioning a completed todo's stem would be unsatisfiable and would get
// switched off.
//
// NOT checked: the `uat_gap` row or the "Carried forward from earlier
// closes" table. Neither corresponds to a file in `.planning/todos/`, so a
// guard that demanded they match a directory listing would be
// unsatisfiable by construction.
//
// Like `docs-dangling-refs.test.ts`, this file verifies planning-facing
// documentation, not runtime behaviour shipped in the tarball, and is
// deliberately kept OUT of `package.json`'s `files[]`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

const STATE_MD = join(ROOT, ".planning/STATE.md");
const PENDING_DIR = join(ROOT, ".planning/todos/pending");
const COMPLETED_DIR = join(ROOT, ".planning/todos/completed");

/** A todo's "stem" is its filename without the `.md` extension -- the token
 * both this guard and STATE.md's own table rows key on (per the plan's own
 * instruction: "the Item cell holding the todo's filename stem"). */
function todoStems(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
}

/** Extracts the body of STATE.md's `## Deferred Items` section: everything
 * from that heading up to (not including) the next `## ` heading. Returns
 * `null` if the heading cannot be found at all -- a renamed heading or a
 * missing file must FAIL the non-vacuity test below, not silently produce
 * an empty-but-passing scan. */
function deferredItemsSection(stateMd: string): string | null {
  const m = stateMd.match(/^## Deferred Items\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}

/** Predicate 1 (AUDIT-04, direction A): every pending todo's stem must
 * appear somewhere in the Deferred Items section text. Returns the stems
 * that do NOT appear -- empty means the guard is satisfied. Shared verbatim
 * by the real-source test and the planted-violation test below. */
function missingPendingStems(pendingStems: readonly string[], sectionText: string): string[] {
  return pendingStems.filter((stem) => !sectionText.includes(stem));
}

/** Predicate 2 (AUDIT-04, direction B): no completed todo's stem may still
 * appear in the Deferred Items section text (as a Pending row -- since this
 * section is scanned in isolation from the rest of STATE.md, any mention
 * here reads as "still pending"). Returns the stems that DO appear -- empty
 * means the guard is satisfied. Shared verbatim by the real-source test and
 * the planted-violation test below. */
function wronglyListedCompletedStems(completedStems: readonly string[], sectionText: string): string[] {
  return completedStems.filter((stem) => sectionText.includes(stem));
}

test("every pending todo has a row in STATE.md's Deferred Items section (AUDIT-04, direction A)", () => {
  assert.ok(existsSync(STATE_MD), `${STATE_MD} does not exist`);
  assert.ok(existsSync(PENDING_DIR), `${PENDING_DIR} does not exist`);
  const section = deferredItemsSection(readFileSync(STATE_MD, "utf8"));
  assert.ok(section !== null, "could not locate STATE.md's '## Deferred Items' heading -- has it been renamed?");
  const pending = todoStems(PENDING_DIR);
  const missing = missingPendingStems(pending, section!);
  assert.deepEqual(
    missing,
    [],
    "pending todo(s) missing a row in STATE.md's Deferred Items section -- add a row for:\n" +
      missing.map((s) => `  ${s}`).join("\n"),
  );
});

test("no completed todo is still listed as Pending in STATE.md's Deferred Items section (AUDIT-04, direction B)", () => {
  assert.ok(existsSync(STATE_MD), `${STATE_MD} does not exist`);
  assert.ok(existsSync(COMPLETED_DIR), `${COMPLETED_DIR} does not exist`);
  const section = deferredItemsSection(readFileSync(STATE_MD, "utf8"));
  assert.ok(section !== null, "could not locate STATE.md's '## Deferred Items' heading -- has it been renamed?");
  const completed = todoStems(COMPLETED_DIR);
  const stale = wronglyListedCompletedStems(completed, section!);
  assert.deepEqual(
    stale,
    [],
    "completed todo(s) still listed as Pending in STATE.md's Deferred Items section -- these are done on disk, remove their row:\n" +
      stale.map((s) => `  ${s}`).join("\n"),
  );
});

test("non-vacuity: the Deferred Items section is located, non-empty, and the scanned sets clear a floor", () => {
  const stateMd = readFileSync(STATE_MD, "utf8");
  const section = deferredItemsSection(stateMd);
  assert.ok(section !== null, "the '## Deferred Items' heading was not found -- a renamed heading must FAIL this test, not silently pass elsewhere");
  assert.ok(section!.trim().length > 0, "the located Deferred Items section is empty");

  const pending = todoStems(PENDING_DIR);
  const completed = todoStems(COMPLETED_DIR);
  assert.ok(pending.length >= 10, `expected at least 10 pending todos, got ${pending.length}`);
  assert.ok(completed.length >= 5, `expected at least 5 completed todos, got ${completed.length}`);

  // Positive control: a specific, known-present pending stem must actually
  // be found by predicate 1's own matcher -- without this, the two tests
  // above could both pass by scanning nothing.
  const knownStem = "2026-08-20-vsf-as-a-bootstrap-input";
  assert.ok(pending.includes(knownStem), `expected ${knownStem} to be a real pending todo -- update the control if it has been resolved`);
  assert.deepEqual(missingPendingStems([knownStem], section!), [], `the positive-control stem ${knownStem} was not found by missingPendingStems() against the real section text`);
});

test("planted violation: both predicates fire on synthetic input, and the real, corrected text is reported by neither", () => {
  // A Deferred Items section missing a known pending stem.
  const sectionMissingAPendingStem = `
| Category | Item | Priority | Status |
|----------|------|----------|--------|
| todo | 2026-08-12-vice-broker-tests-stall-outside-devcontainer | low | Pending |
`;
  const missing = missingPendingStems(["2026-08-20-vsf-as-a-bootstrap-input"], sectionMissingAPendingStem);
  assert.deepEqual(missing, ["2026-08-20-vsf-as-a-bootstrap-input"], "predicate 1 failed to flag a synthetic section that is missing a known pending stem");

  // A Deferred Items section that still lists a completed todo as Pending --
  // the exact AUDIT-04 defect, reproduced with the two real stems it named.
  const sectionWithACompletedStem = `
| Category | Item | Priority | Status |
|----------|------|----------|--------|
| todo | 2026-08-17-document-second-binmon-client-as-a-wedge-lookalike | — | Pending |
`;
  const stale = wronglyListedCompletedStems(
    ["2026-08-17-document-second-binmon-client-as-a-wedge-lookalike"],
    sectionWithACompletedStem,
  );
  assert.deepEqual(
    stale,
    ["2026-08-17-document-second-binmon-client-as-a-wedge-lookalike"],
    "predicate 2 failed to flag a synthetic section that still lists a completed todo as Pending",
  );

  // The real, current, corrected STATE.md text must be reported by NEITHER
  // predicate -- a guard that cannot be satisfied by the real fixed state
  // gets switched off (the same point docs-dangling-refs.test.ts's own
  // planted-violation test makes).
  const realSection = deferredItemsSection(readFileSync(STATE_MD, "utf8"));
  assert.ok(realSection !== null);
  const realMissing = missingPendingStems(todoStems(PENDING_DIR), realSection!);
  const realStale = wronglyListedCompletedStems(todoStems(COMPLETED_DIR), realSection!);
  assert.deepEqual(realMissing, [], "the real, corrected STATE.md must not be flagged by predicate 1");
  assert.deepEqual(realStale, [], "the real, corrected STATE.md must not be flagged by predicate 2");
});
