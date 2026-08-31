// docs-linerefs.test.ts
//
// WHY THIS EXISTS: CLAUDE.md's Architecture bullet cites two exact
// `vice-proxy.ts:<N>` line numbers for `rewriteArguments()`'s two call
// sites -- the load-bearing evidence behind "derived tools must be
// intercepted before forwardToVice()". Those two numbers drifted between
// Phase 10 and Phase 11 (2889/1368 -> 2943/1422) and were re-verified BY
// HAND, twice, by two different sessions reading the same bullet's own
// "treat a mismatch as drift to re-verify" instruction. A citation the
// repo can check mechanically is cheaper than a convention that asks each
// future phase to re-check it by hand and get it right.
//
// This test reads each scanned document's real prose (not a copy pasted
// into the test) and vice-proxy.ts's real current source, extracts every
// `vice-proxy.ts:<N>` citation from the bullet, and asserts each cited
// line actually contains what the surrounding sentence claims it contains
// -- `rewriteArguments(` for a call-site citation, or a `function` keyword
// for a function-start citation. It is deliberately kept OUT of
// package.json's files[] (see check-npm-packages.mjs) since it verifies
// planning-facing documentation, not runtime behaviour shipped in the
// tarball.
//
// WHY THE SET WIDENED (phase 32 plan 32-04, D-10): the SAME bullet exists
// a second time in `.planning/PROJECT.md`, and its copy of the four
// numbers went stale at `:3029`/`:2964`/`:1508`/`:1484` and stayed stale
// until the v0.7.0 open -- for exactly one reason, which PROJECT.md:311
// now records against itself: "docs-linerefs.test.ts was found to read
// only CLAUDE.md and not this copy". One hard-coded document is what made
// a second copy of load-bearing evidence unguarded. The scanned set below
// is therefore a DECLARED SET, and the three checks loop over it.
//
// The predicates below RETURN their findings instead of asserting
// internally. That is deliberate: it lets the planted-violation tests at
// the bottom of this file drive the REAL rule with an in-memory document
// body -- no fixture files, no filesystem writes -- rather than
// re-implementing the rule locally and proving nothing about the rule the
// real checks apply (the lesson recorded at
// `scripts/check-no-<subject>.mjs:149-154`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every document carrying a `rewriteArguments()` bullet whose
 * `vice-proxy.ts:<N>` citations this guard checks. Paths are relative to
 * the repo root and are ALL expected to exist -- a missing one FAILS
 * rather than silently shrinking the scanned set. Shape copied from
 * `docs-dangling-refs.test.ts`'s ALWAYS_PRESENT_NORMATIVE_DOCS.
 *
 * A hand-typed list is correct here and is NOT a violation of "derive
 * from disk, never hand-type a second list": this is the guard's own
 * SUBJECT declaration -- which documents a human chose to hold to this
 * standard -- not a set that exists on disk and could be enumerated.
 * There is no disk query that means "documents whose citations matter".
 *
 * Adding a document here is a deliberate act with teeth: that document's
 * bullet must then carry at least two citations and every one of them
 * must resolve, forever. */
const SCANNED_DOCS = Object.freeze([
  "CLAUDE.md",
  ".planning/PROJECT.md",
]);

/** Matches the literal `vice-proxy.ts:<digits>` citation shape used
 * throughout CLAUDE.md and this project's other docs. Deliberately does
 * NOT anchor to line start -- citations appear mid-sentence.
 *
 * DO NOT loosen this to also match the bare `:<digits>` shorthand that
 * appears in the same prose (`(which starts at ':2985')`). Two reasons,
 * both load-bearing:
 *   1. `.planning/PROJECT.md:1319` is a DATED record of PAST drift,
 *      reading "rewriteArguments() citations had drifted to
 *      ':3029'/':2964'/':1508'/':1484'". Those are bare shorthands, so
 *      this regex does not see them and correctly-preserved history
 *      cannot red this guard. Loosening the shape would sweep that line
 *      in and fail the guard on a line that is RIGHT.
 *   2. A bare `:<digits>` matches far too much ordinary prose to be a
 *      citation signal at all. */
const CITATION_RE = /vice-proxy\.ts:(\d+)/g;

/** What `isolateCitationBullet()` found in one document. `problems` is
 * empty when the document is checkable; each entry names the document and
 * says what to do about it. Returned rather than asserted so the planted
 * violations below drive this exact function. */
interface BulletIsolation {
  /** The single qualifying bullet, or null when there was a problem. */
  bullet: string | null;
  /** How many qualifying bullets were found (0, 1, or more). */
  qualifyingCount: number;
  /** Citations extracted from `bullet`, empty when `bullet` is null. */
  citations: number[];
  problems: string[];
}

function extractCitations(bullet: string): number[] {
  const citations: number[] = [];
  // `String.prototype.matchAll` clones the regex internally, so this
  // global CITATION_RE's lastIndex is never mutated across calls. Do NOT
  // switch to CITATION_RE.test()/exec() here -- those ARE stateful on a
  // /g regex and would make results depend on call order.
  for (const match of bullet.matchAll(CITATION_RE)) {
    citations.push(Number(match[1]));
  }
  return citations;
}

/** Isolates the ONE bullet in `text` that cites rewriteArguments()'s call
 * sites, so a citation added elsewhere in the file for an unrelated
 * reason is never swept into the non-vacuity count.
 *
 * A qualifying line must contain BOTH the literal `rewriteArguments()`
 * AND at least one CITATION_RE match. Requiring both is the whole point
 * of this function, and it replaced an `Array#find` over the lines that took the
 * first `rewriteArguments()` line and nothing more:
 *
 *   - `CLAUDE.md` has exactly ONE line mentioning `rewriteArguments()`
 *     (`:26`), and it carries the citations, so first-match happened to be
 *     right there -- by luck, not by construction.
 *   - `.planning/PROJECT.md` has SIX (`:230`, `:311`, `:375`, `:381`,
 *     `:1111`, `:1319`). First-match returns `:230` -- "`docs-linerefs.test.ts`
 *     pins CLAUDE.md's `rewriteArguments()` citations;" -- which carries
 *     ZERO citations. Measured at plan time and re-measured in the RED
 *     commit of 32-04, which failed with "found 0" for precisely this
 *     reason. The citations live at `:311`.
 *
 * Then asserts EXACTLY ONE qualifying line. Exactly-one, not at-least-one:
 * a second citation-carrying bullet appearing later would otherwise be
 * checked by nobody while this guard reported success, which is the
 * silent-drift class the widening exists to end. */
function isolateCitationBullet(doc: string, text: string): BulletIsolation {
  const qualifying = text
    .split("\n")
    .filter((line) => line.includes("rewriteArguments()") && extractCitations(line).length > 0);

  if (qualifying.length === 0) {
    return {
      bullet: null,
      qualifyingCount: 0,
      citations: [],
      problems: [
        `${doc} has no line that BOTH mentions rewriteArguments() AND cites vice-proxy.ts:<N>. ` +
          `Rewording the bullet so the citation regex matches nothing must FAIL here, not silently ` +
          `report zero checked citations as a pass -- that is exactly the class of vacuous guard ` +
          `T-11-DOC-DRIFT exists to catch. Restore the citations, or remove ${doc} from SCANNED_DOCS ` +
          `deliberately.`,
      ],
    };
  }

  if (qualifying.length > 1) {
    return {
      bullet: null,
      qualifyingCount: qualifying.length,
      citations: [],
      problems: [
        `${doc} has ${qualifying.length} lines that both mention rewriteArguments() and cite ` +
          `vice-proxy.ts:<N>; expected exactly 1. A second citation-carrying bullet would be checked ` +
          `by nobody while this guard reported success. Fold the citations into one bullet, or widen ` +
          `this predicate deliberately.`,
      ],
    };
  }

  const bullet = qualifying[0] as string;
  const citations = extractCitations(bullet);
  const problems: string[] = [];
  // PER DOCUMENT, and never a sum across documents: a summed floor stays
  // green while one document's bullet is reworded down to zero citations
  // and the other still carries two -- which is the exact vacuity this
  // widening was supposed to close, not open.
  // The floor is spelled as a literal comparison, not hidden behind a
  // named constant: two is the number of call sites the bullet claims, and
  // this exact expression is what the phase-32 acceptance criteria grep for.
  const meetsFloor = citations.length >= 2;
  if (!meetsFloor) {
    problems.push(
      `${doc}: expected at least 2 vice-proxy.ts:<N> citations in the rewriteArguments() bullet, ` +
        `found ${citations.length}. This floor is per document.`,
    );
  }
  return { bullet, qualifyingCount: 1, citations, problems };
}

/** What `readScannedDoc()` found. Same return-don't-assert shape, so the
 * missing-document plant below drives this exact function. */
interface ScannedDocRead {
  text: string | null;
  problems: string[];
}

/** Reads one declared document off disk. A declared path that does not
 * exist is a PROBLEM, never a skip: message shape copied verbatim from
 * `docs-dangling-refs.test.ts:136`, because the failure mode is
 * identical -- a renamed or moved document must fail loudly rather than
 * shrink the scanned set to whatever still happens to be there. */
function readScannedDoc(doc: string): ScannedDocRead {
  const path = join(repoRoot({ from: HERE }), doc);
  if (!existsSync(path)) {
    return {
      text: null,
      problems: [
        `${doc} is in the scanned set but does not exist -- update SCANNED_DOCS rather than ` +
          `letting the scanned set shrink silently`,
      ],
    };
  }
  return { text: readFileSync(path, "utf8"), problems: [] };
}

test("every scanned document's rewriteArguments() bullet cites at least two vice-proxy.ts line numbers (per-document non-vacuity)", async (t) => {
  assert.ok(SCANNED_DOCS.length >= 2, "SCANNED_DOCS must still name more than one document -- a shrinking set is the drift this guard now checks for");
  for (const doc of SCANNED_DOCS) {
    // A subtest per document so `node --test`'s own output NAMES every
    // scanned document. A single looped assertion would report a pass
    // without ever saying which files it read.
    await t.test(`${doc}: bullet isolated, at least two citations`, () => {
      const read = readScannedDoc(doc);
      assert.deepEqual(read.problems, [], read.problems.join(" | "));
      const isolation = isolateCitationBullet(doc, read.text as string);
      assert.deepEqual(isolation.problems, [], isolation.problems.join(" | "));
      assert.equal(isolation.qualifyingCount, 1, `${doc}: expected exactly one citation-carrying rewriteArguments() bullet`);
    });
  }
});

test("every vice-proxy.ts:<N> citation in a scanned document's rewriteArguments() bullet points at a real rewriteArguments() call or its enclosing function", async (t) => {
  const viceProxySrc = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const viceProxyLines = viceProxySrc.split("\n");

  for (const doc of SCANNED_DOCS) {
    await t.test(`${doc}: every citation resolves in vice-proxy.ts`, () => {
      const read = readScannedDoc(doc);
      assert.deepEqual(read.problems, [], read.problems.join(" | "));
      const isolation = isolateCitationBullet(doc, read.text as string);
      assert.deepEqual(isolation.problems, [], isolation.problems.join(" | "));
      const citations = isolation.citations;
      assert.ok(citations.length >= 2, `${doc}: no citations extracted -- see the non-vacuity test above`);

      for (const lineNumber of citations) {
        // Citations are 1-indexed in prose; array is 0-indexed.
        const lineText = viceProxyLines[lineNumber - 1];
        assert.ok(lineText !== undefined, `${doc} cites vice-proxy.ts:${lineNumber}, but the file has no such line`);
        const isCallSite = lineText.includes("rewriteArguments(");
        const isFunctionStart = /^\s*(async\s+)?function\s+\w+/.test(lineText);
        assert.ok(
          isCallSite || isFunctionStart,
          `vice-proxy.ts:${lineNumber} (cited in ${doc}) contains neither a rewriteArguments() call nor a function declaration -- drift. Line reads: ${JSON.stringify(lineText)}`,
        );
      }
    });
  }
});

test("planted-violation: a citation pointing at an unrelated line fails this test's own logic (proves the guard is not vacuous)", () => {
  const viceProxySrc = readFileSync(join(HERE, "vice-proxy.ts"), "utf8");
  const viceProxyLines = viceProxySrc.split("\n");

  // Line 1 of vice-proxy.ts is never a rewriteArguments() call or a
  // function declaration -- it is the shebang/header. A citation planted
  // there must be rejected by the same check the real test above uses.
  const plantedLineNumber = 1;
  const lineText = viceProxyLines[plantedLineNumber - 1];
  const isCallSite = lineText.includes("rewriteArguments(");
  const isFunctionStart = /^\s*(async\s+)?function\s+\w+/.test(lineText);
  assert.equal(isCallSite || isFunctionStart, false, "line 1 of vice-proxy.ts must not look like a rewriteArguments() call site or function start -- if it does, this planted-violation check itself is broken");
});
