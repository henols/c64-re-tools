// docs-dangling-refs.test.ts
//
// WHY THIS EXISTS: T-11-DOC-DANGLE. Phase 10's D-03 dropped `.vsf` from
// regenerator2000's bootstrap input set but pointed the deferral at "Phase
// 11's `c64-ram-capture` extension" as `.vsf`'s eventual home. That pointer
// was wrong -- no `R2000-*` requirement covers `.vsf` as a bootstrap input
// (D-34) -- so Phase 11 plan 11-03 corrected it and filed the idea as a real
// backlog item instead.
//
// It corrected FOUR of the FIVE sites. `.planning/REQUIREMENTS.md`'s
// `R2000-08` fold entry still read "`.vsf` moves to Phase 11's
// `c64-ram-capture` extension" for a further day, through phase completion,
// verification AND a security audit, because 11-03-T1's declared verification
// was a hand-run `grep -c vsf .planning/ROADMAP.md` -- scoped to a single
// file. A one-file grep can never catch a five-file class of defect. That is
// the gap this file closes: the SAME assertion, repo-wide and mechanical.
//
// The check is deliberately scoped to the NORMATIVE, forward-looking
// documents -- the ones a future session reads for guidance about where work
// lives. Executed-phase artifacts under `.planning/phases/**` are historical
// records that legitimately quote the wrong wording while describing its
// removal, and the backlog item is the sanctioned home, so neither is
// scanned. Widening the scope to them would produce false positives and the
// guard would be switched off; keeping it narrow keeps it trusted.
//
// Like docs-linerefs.test.ts (the precedent this follows), it reads the real
// documents rather than a copy pasted into the test, and it is deliberately
// kept OUT of package.json's files[] -- it verifies planning-facing
// documentation, not runtime behaviour shipped in the tarball.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });

/** The normative, forward-looking document set. A future session reads these
 * to learn where work lives; a dangling phase pointer in any of them sends
 * that session to a phase that never claimed the work. Paths are relative to
 * the repo root and are all expected to exist -- a missing one FAILS rather
 * than silently shrinking the scanned set. */
const NORMATIVE_DOCS = Object.freeze([
  ".planning/ROADMAP.md",
  ".planning/REQUIREMENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/roadmap-stock-vice.md",
  "docs/stock-vice-parity.md",
]);

/** The backlog item `.vsf` was filed as. It IS `.vsf`'s recorded home, so it
 * must keep existing -- if it is deleted, the corrected pointers in
 * NORMATIVE_DOCS all become dangling again in the other direction. */
const VSF_BACKLOG_ITEM = ".planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md";

/** Splits prose into sentence-ish units. Markdown wraps mid-sentence, so
 * splitting on lines would hide a pointer whose two halves straddle a line
 * break -- which is exactly the shape REQUIREMENTS.md's surviving instance
 * had ("...for\n  this phase; `.vsf` moves to Phase 11's..."). Newlines
 * collapse to spaces first, then split on sentence terminators. */
function sentences(markdown: string): string[] {
  return markdown
    .replace(/\s*\n\s*/g, " ")
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Reads a phase-assignment pointer: prose that hands a topic to a numbered
 * phase as its home. Both orderings are covered -- the verb-first shape
 * ("moves to Phase 11", "deferred to Phase 12") and the possessive shape
 * ("Phase 11's c64-ram-capture extension"). */
const ASSIGNMENT_RES = Object.freeze([
  /\b(?:moves?|move|moved|deferred|defers?|belongs?|lands?|pushed|punted|reassigned|handed)\b[^.;]{0,80}?\bPhase\s+\d+/i,
  /\bPhase\s+\d+(?:'s|s')\s+[^.;]{0,60}?\b(?:extension|home|scope|deliverable|remit)\b/i,
  /\b(?:home|owner|owned by|covered by|claimed by|lives in)\b[^.;]{0,40}?\bPhase\s+\d+/i,
]);

function isPhaseAssignment(sentence: string): boolean {
  return ASSIGNMENT_RES.some((re) => re.test(sentence));
}

/** Every sentence in the normative docs that both mentions `.vsf` and hands
 * a topic to a numbered phase. Returned as `{ doc, sentence }` so a failure
 * message names the file to edit. */
function danglingVsfPointers(): { doc: string; sentence: string }[] {
  const hits: { doc: string; sentence: string }[] = [];
  for (const doc of NORMATIVE_DOCS) {
    const path = join(ROOT, doc);
    assert.ok(existsSync(path), `${doc} is in NORMATIVE_DOCS but does not exist -- update the list rather than letting the scanned set shrink silently`);
    for (const sentence of sentences(readFileSync(path, "utf8"))) {
      if (!/\bvsf\b/i.test(sentence)) continue;
      if (isPhaseAssignment(sentence)) hits.push({ doc, sentence });
    }
  }
  return hits;
}

test("no normative document points at a numbered phase as `.vsf`'s home (T-11-DOC-DANGLE)", () => {
  const hits = danglingVsfPointers();
  assert.deepEqual(
    hits,
    [],
    "dangling `.vsf` phase pointer(s) found. No `R2000-*` requirement covers `.vsf` as a regenerator2000 " +
      `bootstrap input (D-34) -- point at ${VSF_BACKLOG_ITEM} instead of at a phase:\n` +
      hits.map((h) => `  ${h.doc}: ${h.sentence}`).join("\n"),
  );
});

test("the `.vsf` backlog item still exists and still records why it is deferred", () => {
  const path = join(ROOT, VSF_BACKLOG_ITEM);
  assert.ok(existsSync(path), `${VSF_BACKLOG_ITEM} is missing -- it is where the corrected pointers in ${NORMATIVE_DOCS.join(", ")} send the reader. Deleting it re-creates the dangling reference in the other direction.`);
  const body = readFileSync(path, "utf8");
  assert.match(body, /vsf/i, "the backlog item must still be about `.vsf`");
  assert.match(body, /R2000-\d+/, "the backlog item must still name the requirement IDs it establishes do NOT cover `.vsf` -- that is the reason it is backlog and not a phase");
});

test("non-vacuity: the scanned document set is non-empty and `.vsf` is actually discussed in it", () => {
  // A rewording that removed every `.vsf` mention from the normative docs
  // would make the guard above pass by finding nothing to check -- the
  // vacuity WR-02 and T-11-VACUOUS exist to catch. Assert there is real
  // subject matter being scanned.
  assert.ok(NORMATIVE_DOCS.length >= 4, `expected a meaningful normative document set, got ${NORMATIVE_DOCS.length}`);
  const mentioning = NORMATIVE_DOCS.filter((doc) => /\bvsf\b/i.test(readFileSync(join(ROOT, doc), "utf8")));
  assert.ok(mentioning.length >= 2, `expected at least two normative documents to discuss \`.vsf\` (so the guard has something to check); only ${mentioning.length} do: ${mentioning.join(", ")}`);
});

test("planted-violation: the exact wording that survived plan 11-03 is detected by this guard's own logic", () => {
  // Verbatim from `.planning/REQUIREMENTS.md`'s R2000-08 fold entry as it
  // read from plan 11-03 (2026-08-20) until the Phase 11 validation audit
  // (2026-08-21) -- including the line break it straddled, which is why the
  // scanner joins lines before splitting sentences.
  const survived = "Flat 64K (`.raw`) is the surviving non-`.prg`/`.d64` route for\n  this phase; `.vsf` moves to Phase 11's `c64-ram-capture` extension.";
  const flagged = sentences(survived).filter((s) => /\bvsf\b/i.test(s) && isPhaseAssignment(s));
  assert.ok(flagged.length >= 1, `the guard failed to flag the exact wording it exists to catch -- it is vacuous. Sentences seen: ${JSON.stringify(sentences(survived))}`);

  // And the corrected wording must NOT be flagged, or the guard is
  // unsatisfiable and would just get deleted.
  const corrected = "`.vsf` has **no** later phase as its home — no `R2000-*` requirement covers it as a bootstrap input (confirmed by D-34), so it is filed as backlog rather than pointed at a phase.";
  const falsePositives = sentences(corrected).filter((s) => /\bvsf\b/i.test(s) && isPhaseAssignment(s));
  assert.deepEqual(falsePositives, [], "the corrected wording must not be flagged -- a guard that cannot be satisfied gets switched off");
});
