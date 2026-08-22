// assumption-label-discipline.test.ts
//
// WHY THIS FILE EXISTS: the correction unit for an Assumptions Log row is
// the LABEL, not the file. Two of this tree's four `[ASSUMED]` rows (A3 and
// A5, as of this commit) live at MORE THAN ONE authored source site --
// `stock-protocol.ts`'s wire-body encoder JSDoc names the row again at the
// callers/companions that also depend on the same unconfirmed detail
// (`stock-input.ts` for A3's bit mapping). A plan that reads "close A3" and
// edits only one of those two sites would leave one file saying "confirmed"
// and its sibling still saying "unverified" about the identical fact --
// contradictory statements landed in shipped source, which is the exact
// defect class this milestone (External Verification) exists to stop. This
// file makes that specific half-strip a red, automated gate rather than a
// promise a reviewer has to remember to check by eye.
//
// WHAT THIS IS THE ONE AUTHORITATIVE CHECK FOR: for every Assumptions Log
// row this guard knows about (A1, A2, A3, A5 -- A4 is deliberately excluded,
// see below), the set of authored `.ts`/`.mts` files under
// `src/mcp/vice/` carrying an `[ASSUMED]`-bearing comment that names
// that row is either EMPTY (every site closed) or EXACTLY the row's
// complete expected set (no site closed yet) -- never a proper subset.
//
// WHAT THIS DELIBERATELY DOES NOT CHECK:
//   - A4 (the `stop:false` rate limiter's auto-disable deferral timing) is
//     out of this guard's scope entirely, per this plan's own scope fence
//     (D-13-05): A4 was deliberately not probed (a non-stopping checkpoint's
//     `CHECKPOINT_INFO` frame is emitted synchronously from inside the
//     emulator's CPU loop, a hot-address stall hazard) and carries no
//     `[ASSUMED]` comment token today (RESEARCH.md's A4 row is prose, not a
//     source-code label). Adding it here would invent a check for a row
//     this guard has no source site to point at.
//   - Whether a given row's VERDICT is correct -- that judgment lives in
//     `13-PROBE-RESULTS.md` and is out of a mechanical guard's reach. This
//     file only enforces that whatever the current label state is, it is
//     CONSISTENT across every site naming the same row.
//   - Any file outside `src/mcp/vice/` (e.g. `.planning/phases/03-direct-
//     tools/03-RESEARCH.md`'s own Assumptions Log prose) -- this guard is
//     scoped to shipped/authored TypeScript source, not planning documents.
//   - Comments outside an `[ASSUMED]` token's immediate vicinity that merely
//     mention a row number for unrelated reasons (e.g. citing "Focus Item 1"
//     alongside a row letter in a different sentence) -- the lookahead
//     window below is bounded, not whole-file, precisely so a distant,
//     unrelated mention cannot be misattributed as "naming" a row.
//
// SCOPE: authored `.ts`/`.mts` files directly under `src/mcp/vice/`,
// excluding the generated `resources/` subdirectory (never authored, always
// rebuilt) and every `*.test.*` file (this file itself, and the twelve or so
// other suites that could otherwise legitimately quote `[ASSUMED]` text
// inside a planted-violation fixture and pollute the real scan). The scan
// reads RAW file text, never a comment-stripped or literal-extracted copy --
// unlike `docs-dangling-refs.test.ts`'s string-literal extractor, the thing
// this guard checks LIVES in comments, so a guard blind to comments would be
// blind to exactly what it exists to check.
//
// Like `docs-dangling-refs.test.ts` and `docs-deferred-ledger.test.ts`, this
// file verifies source-comment discipline, not shipped runtime behaviour, so
// it stays OUT of `package.json`'s `files[]` and IN the automated gate
// (`test-gate.mjs` is not touched -- a new `*.test.ts` file is auto-
// discovered by `automatedTestFiles()`'s glob, and this file is deliberately
// never added to `MANUAL_ONLY_TESTS`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = repoRoot({ from: HERE });
const VICE_DIR = join(ROOT, "src/mcp/vice");

/** The complete Assumptions Log row inventory this guard knows about, one
 * entry per row Phase 13 plan 04's own `grep -rn '\[ASSUMED\]'` inventory
 * (13-04-PLAN.md Task 1) enumerated against real source, cross-checked
 * against `13-PROBE-RESULTS.md`'s verdicts. Each value is the COMPLETE set
 * of authored source file basenames that carry an `[ASSUMED]`-bearing
 * comment naming that row as of this commit -- frozen here as the
 * enforcement target, since re-deriving "the complete expected set" from a
 * live scan every run would make the guard incapable of ever detecting a
 * site going missing (it would just shrink its own expectation to match).
 *
 * A1 and A2 (CONFIRMED by `13-PROBE-RESULTS.md`) map to the empty set: their
 * label was removed everywhere it lived. A3 (INCONCLUSIVE) and A5
 * (CONTRADICTED, escape-hatched per D-13-04) both stay `[ASSUMED]` at every
 * site named below -- A3 is this tree's paradigm multi-site row (the
 * encoder's own JSDoc in `stock-protocol.ts` PLUS the composing caller's
 * `JOYPORT_BITS` constant in `stock-input.ts`), which is exactly the shape a
 * one-file edit would miss half of. A4 is intentionally absent from this
 * map -- see this file's header. */
const EXPECTED_LABEL_SITES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  A1: Object.freeze([]),
  A2: Object.freeze([]),
  A3: Object.freeze(["stock-input.ts", "stock-protocol.ts"]),
  A5: Object.freeze(["stock-protocol.ts"]),
});

const ROW_NAMES = Object.freeze(Object.keys(EXPECTED_LABEL_SITES));

/** A floor well below the real, current file count (68 at authoring time) --
 * high enough that a filter regression (e.g. a typo'd extension test that
 * matches nothing) fails loudly here rather than silently scanning zero
 * files and reporting every row "closed" by vacuous absence. */
const MIN_SCANNED_FILES = 40;

/** Every authored `.ts`/`.mts` file directly under `dir`, excluding the
 * generated `resources/` subdirectory (never listed here -- `readdirSync`
 * without `recursive` does not descend into it) and every `*.test.*` file.
 * Derived from a directory read, never a hardcoded name list, so a newly
 * added source file (like this one, once landed) joins the scan
 * automatically the next time this suite runs. */
function scannedSourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /\.(ts|mts)$/.test(f) && !/\.test\./.test(f))
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort();
}

const LABEL_TOKEN_RE = /\[ASSUMED\]/g;
const ROW_TOKEN_RE = /\bA([1-5])\b/g;
/** How far past an `[ASSUMED]` token to look for the row letter+digit that
 * names it. RESEARCH.md's own JSDoc style line-wraps "row" and the row
 * token onto the next comment line ("...row\n * A3 --"), so the window must
 * clear a line break, but it is bounded well short of a whole file so a
 * later, unrelated paragraph's row mention is never misattributed. Measured
 * against every real site in this tree: the farthest observed gap is under
 * 60 characters. */
const LOOKAHEAD_WINDOW = 300;

/** THE shared predicate: for one file's raw text, the set of Assumptions Log
 * rows an `[ASSUMED]`-bearing comment in that text names. Called by BOTH the
 * real scan below and the planted-violation test -- there is exactly one
 * implementation of "which rows does this text's [ASSUMED] label(s) name",
 * so the real check and its own proof of non-vacuity cannot drift apart into
 * two copies that quietly disagree. */
function rowsNamedByAssumedLabels(text: string): Set<string> {
  const rows = new Set<string>();
  for (const labelMatch of text.matchAll(LABEL_TOKEN_RE)) {
    const start = labelMatch.index;
    const windowEnd = Math.min(text.length, start + labelMatch[0].length + LOOKAHEAD_WINDOW);
    const window = text.slice(start, windowEnd);
    for (const rowMatch of window.matchAll(ROW_TOKEN_RE)) {
      rows.add(`A${rowMatch[1]}`);
    }
  }
  return rows;
}

/** THE shared set-equality predicate: `actual` (the real, scanned file set
 * for one row) satisfies the all-or-nothing rule iff it is empty OR exactly
 * equal to `expected` -- never a proper subset (some sites closed, others
 * not) and never a superset (a site claiming the row that Task 1's
 * inventory did not expect). Extracted once so the real scan and the
 * planted-violation scan below share this exact logic. */
function isEmptyOrExactMatch(actual: ReadonlySet<string>, expected: ReadonlySet<string>): boolean {
  if (actual.size === 0) return true;
  if (actual.size !== expected.size) return false;
  for (const item of actual) {
    if (!expected.has(item)) return false;
  }
  return true;
}

test("scanned source file set meets the minimum-count floor (a broken filter must fail loudly, not scan nothing)", () => {
  const files = scannedSourceFiles(VICE_DIR);
  assert.ok(
    files.length >= MIN_SCANNED_FILES,
    `expected at least ${MIN_SCANNED_FILES} authored .ts/.mts files under src/mcp/vice/, found ` +
      `${files.length} (${files.slice(0, 5).join(", ")}${files.length > 5 ? ", ..." : ""}) -- a filter that silently ` +
      "scans (near) nothing would make every row below pass vacuously by finding no labelled sites at all",
  );
});

test("stock-protocol.ts still states its module-level unconfirmed-behaviour convention", () => {
  const text = readFileSync(join(VICE_DIR, "stock-protocol.ts"), "utf8");
  assert.match(
    text,
    /never silently claimed as verified/,
    "stock-protocol.ts's module-level convention -- that an encoder whose runtime behaviour is unconfirmed " +
      "against a real binary says so explicitly in its own JSDoc as [ASSUMED], and is never silently claimed as " +
      "verified -- must survive every label edit this guard polices. Its disappearance would mean the general " +
      "rule was deleted, not just one row's label",
  );
});

for (const row of ROW_NAMES) {
  test(`Assumptions Log row ${row}: the [ASSUMED]-labelled file set is empty or exactly the expected complete set, never a partial strip`, () => {
    const expected = new Set(EXPECTED_LABEL_SITES[row]);
    const files = scannedSourceFiles(VICE_DIR);
    const actual = new Set<string>();
    for (const file of files) {
      const text = readFileSync(join(VICE_DIR, file), "utf8");
      if (rowsNamedByAssumedLabels(text).has(row)) actual.add(file);
    }
    assert.ok(
      isEmptyOrExactMatch(actual, expected),
      `row ${row}: expected the [ASSUMED]-labelled file set to be empty or exactly {${[...expected].sort().join(", ")}}, ` +
        `got {${[...actual].sort().join(", ")}} -- a proper subset means the label was stripped from one site while a ` +
        "sibling site still claims the identical detail unverified: contradictory statements in shipped source, " +
        "the exact defect class this guard exists to catch",
    );
  });
}

test("planted-violation: half-stripping row A3's label (removed from one site, kept on its sibling) is rejected by the shared predicate", () => {
  // A3 is this tree's real, current multi-site row (stock-input.ts AND
  // stock-protocol.ts both name it) -- proof that a half-strip is caught,
  // exercised against IN-MEMORY COPIES of the real files' text, never by
  // mutating the real tree on disk.
  const expected = new Set(EXPECTED_LABEL_SITES.A3);
  assert.ok(
    expected.size >= 2,
    "this planted-violation test needs A3 to remain a genuine multi-site row to mutate meaningfully -- if A3 " +
      "closed to a single site or zero, pick a different still-multi-site row for this test instead of weakening it",
  );

  const siteToStrip = "stock-protocol.ts";
  assert.ok(expected.has(siteToStrip), "expected stock-protocol.ts to be one of row A3's real sites");

  const realTexts = new Map<string, string>();
  for (const file of expected) {
    realTexts.set(file, readFileSync(join(VICE_DIR, file), "utf8"));
  }

  // Remove row A3's [ASSUMED] token from ONE site's in-memory copy only,
  // leaving the sibling site's real text (and the real files on disk)
  // completely untouched.
  const mutatedTexts = new Map(realTexts);
  const strippedText = mutatedTexts
    .get(siteToStrip)!
    .replace(/up\/down\/left\/right\/fire\) is \[ASSUMED\] -- RESEARCH\.md Assumptions Log row\s*\n \* A3/, "up/down/left/right/fire) is CONFIRMED (planted mutation) -- RESEARCH.md Assumptions Log row\n * A3");
  assert.notEqual(strippedText, realTexts.get(siteToStrip), "the planted mutation's regex did not match the real site text -- update it to match the current JSDoc wording");
  mutatedTexts.set(siteToStrip, strippedText);

  const actual = new Set<string>();
  for (const [file, text] of mutatedTexts) {
    if (rowsNamedByAssumedLabels(text).has("A3")) actual.add(file);
  }

  assert.equal(
    actual.size,
    expected.size - 1,
    "the planted mutation should leave exactly one fewer site still naming row A3 than the real, unmutated set",
  );
  assert.ok(
    !isEmptyOrExactMatch(actual, expected),
    "the shared predicate FAILED to reject a half-stripped row -- one site's label was removed while a sibling " +
      "site's label for the SAME row survives untouched, which is precisely the contradictory-shipped-source " +
      "defect this guard exists to catch. A guard that accepts this planted violation is vacuous",
  );
});
