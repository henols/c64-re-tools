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
 * SCOPE, and a real fragility: a "bullet" here is ONE LINE. Both scanned
 * documents keep their whole Architecture bullet on a single unwrapped
 * line today (`CLAUDE.md:26`, `.planning/PROJECT.md:311`), which is what
 * makes a line-based predicate correct for them. If a future editor
 * HARD-WRAPS one of those bullets, the citations split across lines and
 * this guard reds with "found 1" or "found 0" on a document that is
 * factually RIGHT. The fix in that case is to UNWRAP the bullet, never to
 * loosen this predicate into a multi-line scan -- a paragraph-scoped
 * window would start sweeping in neighbouring prose, including the dated
 * drift record discussed on CITATION_RE above. The synthetic plant bodies
 * at the bottom of this file are single-line for exactly this reason, and
 * a wrapped first draft of them is what surfaced this note.
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

/** WR-09 (phase 32 review, re-measured and RE-SCOPED 2026-09-02).
 *
 * WHAT THE FINDING GOT WRONG, recorded because the correction is the point:
 * it called the `isFunctionStart` arm "permanently unreachable". Measured
 * against this tree, it is neither unreachable nor optional -- TWO of the four
 * live citations resolve through it and ONLY through it, because they name the
 * ENCLOSING FUNCTION rather than the call line (`vice-proxy.ts:2985`
 * `async function forwardToVice`, and `:1505` `async function
 * gatherWedgeEvidence`). Deleting the arm would have reddened the guard on a
 * correct tree. CLAUDE.md's own constraint text cites exactly those two
 * function-start lines, so the arm is load-bearing by design, not by accident.
 *
 * WHAT THE FINDING GOT RIGHT: the arm was far too permissive. It accepted ANY
 * line matching `function <name>`, and `vice-proxy.ts` has 71 top-level
 * function declarations of which only 4 contain a `rewriteArguments()` call.
 * A citation that drifted from `:2985` onto any of the other 67 passed
 * silently -- the exact "weakens the assertion" half of the finding.
 *
 * So the arm is TIGHTENED rather than removed: a cited function-start line
 * resolves only if the function it declares actually contains a
 * `rewriteArguments()` call. That keeps both real citations passing and cuts
 * the drift-accepting surface from 71 lines to 4.
 *
 * ONE PREDICATE, driven by the real scan AND by the planted violations below,
 * per this file's own convention -- a plant proved against a re-implementation
 * of the rule proves nothing about the rule the scan applies. */
function citationResolves(lineNumber: number, lines: readonly string[]): { ok: boolean; why: string } {
  const lineText = lines[lineNumber - 1];
  if (lineText === undefined) return { ok: false, why: "no such line" };
  if (lineText.includes("rewriteArguments(")) return { ok: true, why: "call site" };
  if (!/^(async\s+)?function\s+\w+/.test(lineText)) {
    return { ok: false, why: "neither a rewriteArguments() call nor a top-level function declaration" };
  }
  // Extent of a TOP-LEVEL declaration: from its own line to the next line that
  // is exactly a closing brace at column 0. Brace matching is unnecessary
  // here and would be less robust against strings and comments.
  let end = lines.length;
  for (let i = lineNumber; i < lines.length; i++) {
    if (lines[i] === "}") {
      end = i + 1;
      break;
    }
  }
  const body = lines.slice(lineNumber - 1, end).join("\n");
  return body.includes("rewriteArguments(")
    ? { ok: true, why: "enclosing function containing a rewriteArguments() call" }
    : { ok: false, why: "a function declaration whose body contains no rewriteArguments() call" };
}

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
        // Citations are 1-indexed in prose; the predicate handles the offset.
        const verdict = citationResolves(lineNumber, viceProxyLines);
        assert.ok(
          verdict.ok,
          `vice-proxy.ts:${lineNumber} (cited in ${doc}) does not resolve -- ${verdict.why} -- drift. ` +
            `Line reads: ${JSON.stringify(viceProxyLines[lineNumber - 1])}`,
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
  assert.equal(
    citationResolves(plantedLineNumber, viceProxyLines).ok,
    false,
    "line 1 of vice-proxy.ts must not resolve as a rewriteArguments() call site or enclosing function -- if it does, this planted-violation check itself is broken",
  );
});

test("planted-violation (WR-09): a citation pointing at an unrelated top-level function is REJECTED, and the two real function-start citations are ACCEPTED", () => {
  const viceProxyLines = readFileSync(join(HERE, "vice-proxy.ts"), "utf8").split("\n");

  // The whole point of tightening the function-start arm. Derived from the
  // file rather than hard-coded, so this plant cannot drift onto a line that
  // stopped being what it was: take the FIRST top-level function whose body
  // carries no rewriteArguments() call.
  const declarations: number[] = [];
  viceProxyLines.forEach((text, i) => {
    if (/^(async\s+)?function\s+\w+/.test(text)) declarations.push(i + 1);
  });
  assert.ok(declarations.length >= 10, `expected many top-level declarations, found ${declarations.length}`);

  const unrelated = declarations.filter((n) => !citationResolves(n, viceProxyLines).ok);
  const accepted = declarations.filter((n) => citationResolves(n, viceProxyLines).ok);

  // Non-vacuity in BOTH directions: the plant needs a real rejected line to
  // exist, and the arm must still accept the declarations it exists for.
  assert.ok(unrelated.length > 0, "no top-level function lacks a rewriteArguments() call -- this plant would be vacuous");
  assert.ok(accepted.length > 0, "no top-level function contains a rewriteArguments() call -- the arm would be dead");
  assert.ok(
    unrelated.length > accepted.length,
    `the tightened arm must reject more declarations than it accepts, or it is not a narrowing: ` +
      `${unrelated.length} rejected vs ${accepted.length} accepted`,
  );

  // And the two citations CLAUDE.md names as function starts must be among the
  // accepted set -- the arm is not allowed to narrow onto nothing.
  for (const lineNumber of [1505, 2991]) {
    const verdict = citationResolves(lineNumber, viceProxyLines);
    assert.ok(
      verdict.ok && verdict.why.startsWith("enclosing function"),
      `vice-proxy.ts:${lineNumber} must resolve VIA THE FUNCTION-START ARM -- it is a declaration line, not a ` +
        `call line. CLAUDE.md's Architecture bullet cites both of these as function starts and instructs `+
        `the reader to treat a mismatch as drift to re-verify, so an arm that stopped accepting them `+
        `would make that instruction uncheckable. Got: ${verdict.why}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Planted violations for the failure modes the WIDENING introduced (32-04).
//
// Every plant below drives the REAL predicates defined above -- with an
// in-memory document body and a declared name, so there are no fixture
// files and no filesystem writes. That matters twice over: a plant proved
// against a re-implementation of the rule proves nothing about the rule the
// real checks apply (`scripts/check-no-<subject>.mjs:149-154`), and no new
// file may appear under `src/mcp/vice/fixtures/planted-` because that
// prefix carries an exact hit-count pin in the removal gate.
// ---------------------------------------------------------------------------

/** Synthetic body: the only `rewriteArguments()` line carries NO
 * `vice-proxy.ts:<N>` citation. This is the shape a well-meaning rewording
 * produces, and the shape a GLOBAL summed floor would hide. */
const ZERO_CITATION_BODY = [
  "# Synthetic document",
  "",
  "- **Architecture**: derived tools must be intercepted before forwardToVice(), and `rewriteArguments()` is where that happens. (A rewording dropped the line numbers that used to be here.)",
  "",
].join("\n");

/** Synthetic body: one qualifying bullet carrying ONE citation -- above the
 * isolation predicate's bar, below the per-document floor. */
const ONE_CITATION_BODY = [
  "# Synthetic document",
  "",
  "- **Architecture**: `rewriteArguments()` runs at `vice-proxy.ts:3050`.",
  "",
].join("\n");

/** Synthetic body: one qualifying bullet carrying TWO citations. The
 * control for the plants below -- if this one is not clean, they prove
 * nothing. */
const TWO_CITATION_BODY = [
  "# Synthetic document",
  "",
  "- **Architecture**: `rewriteArguments()` runs at `vice-proxy.ts:3050`, and at `vice-proxy.ts:1529` for the second call site.",
  "",
].join("\n");

/** Synthetic body: TWO citation-carrying `rewriteArguments()` bullets. The
 * former first-match predicate would have silently checked the first and
 * left the second guarded by nobody. */
const AMBIGUOUS_BODY = [
  "# Synthetic document",
  "",
  "- **Architecture**: `rewriteArguments()` runs at `vice-proxy.ts:3050`, and at `vice-proxy.ts:1529` for the second call site.",
  "",
  "- **Appendix**: a later bullet also mentioning `rewriteArguments()` and citing `vice-proxy.ts:3050` and `vice-proxy.ts:1529`, added by a copy-paste nobody noticed.",
  "",
].join("\n");

test("planted-violation: a document whose only rewriteArguments() line carries no citation is reported, and the message NAMES the document", () => {
  const isolation = isolateCitationBullet("synthetic/zero-citations.md", ZERO_CITATION_BODY);

  assert.equal(isolation.qualifyingCount, 0, "a line mentioning rewriteArguments() but citing nothing must not qualify");
  assert.equal(isolation.bullet, null);
  assert.deepEqual(isolation.citations, []);
  assert.equal(isolation.problems.length, 1, "exactly one problem expected for a zero-citation document");
  const problem = isolation.problems[0] as string;
  assert.ok(
    problem.startsWith("synthetic/zero-citations.md "),
    `the failure must NAME the offending document -- in a multi-document set an unnamed message is unactionable. Got: ${JSON.stringify(problem)}`,
  );
  assert.match(problem, /T-11-DOC-DRIFT/, "the message must still point at the vacuous-guard class it belongs to");

  // Self-non-vacuity, in the retired removal-gate test's idiom: if the real
  // predicate were ever refactored into one that always reports "clean",
  // THIS is the assertion that catches it. Without it, every plant in this
  // file would pass against a neutered rule.
  const stubbedAlwaysClean = (): string[] => [];
  assert.notDeepEqual(stubbedAlwaysClean(), isolation.problems);
});

test("planted-violation: the floor is PER DOCUMENT -- a global summed count stays green while one document is reworded to zero", () => {
  const good = isolateCitationBullet("synthetic/two-citations.md", TWO_CITATION_BODY);
  const bad = isolateCitationBullet("synthetic/zero-citations.md", ZERO_CITATION_BODY);

  assert.deepEqual(good.problems, [], "the two-citation control must be clean, or this plant proves nothing");
  assert.deepEqual(good.citations, [3050, 1529]);

  const summedAcrossDocuments = good.citations.length + bad.citations.length;
  assert.ok(
    summedAcrossDocuments >= 2,
    "a GLOBAL summed floor would be SATISFIED here (2 + 0 = 2) -- which is exactly why this guard must never sum across documents",
  );
  assert.equal(bad.problems.length, 1, "...and the per-document check must nonetheless report the reworded document");
});

test("planted-violation: a document whose bullet cites only ONE line number fails the per-document floor", () => {
  const isolation = isolateCitationBullet("synthetic/one-citation.md", ONE_CITATION_BODY);

  assert.equal(isolation.qualifyingCount, 1, "one citation is still a qualifying bullet -- the floor, not the isolation, is what must reject it");
  assert.deepEqual(isolation.citations, [3050]);
  assert.equal(isolation.problems.length, 1);
  const problem = isolation.problems[0] as string;
  assert.ok(problem.startsWith("synthetic/one-citation.md:"), `the floor failure must name the document. Got: ${JSON.stringify(problem)}`);
  assert.match(problem, /expected at least 2 /, "the floor must state the number it wanted");
  assert.match(problem, /found 1/, "the floor must state the number it found");
  assert.match(problem, /per document/, "the message must say the floor is per document, so nobody 'fixes' it by summing");
});

test("planted-violation: a document with TWO citation-carrying rewriteArguments() bullets is reported, and the message states the count", () => {
  const isolation = isolateCitationBullet("synthetic/ambiguous.md", AMBIGUOUS_BODY);

  assert.equal(isolation.qualifyingCount, 2);
  assert.equal(
    isolation.bullet,
    null,
    "an ambiguous document must yield NO bullet -- silently picking one of the two is precisely the drift this widening exists to end",
  );
  assert.equal(isolation.problems.length, 1);
  const problem = isolation.problems[0] as string;
  assert.ok(problem.startsWith("synthetic/ambiguous.md "), `the ambiguity failure must name the document. Got: ${JSON.stringify(problem)}`);
  assert.match(problem, /has 2 lines/, "the failure must report HOW MANY qualifying bullets were found, so a reader knows what to fold together");
  assert.match(problem, /expected exactly 1/);
});

test("planted-violation: a declared document that does not exist FAILS rather than shrinking the scanned set", () => {
  const missing = ".planning/THIS-DOCUMENT-DOES-NOT-EXIST-32-04-PLANT.md";
  assert.equal(
    existsSync(join(repoRoot({ from: HERE }), missing)),
    false,
    "the plant path must genuinely not exist on disk, or this test proves nothing",
  );

  const read = readScannedDoc(missing);
  assert.equal(read.text, null, "a missing document must not be read as empty text -- empty text would sail through the isolation predicate as 'no citations'");
  assert.equal(read.problems.length, 1);
  const problem = read.problems[0] as string;
  assert.ok(problem.startsWith(`${missing} `), `the missing-document failure must name the path. Got: ${JSON.stringify(problem)}`);
  assert.match(problem, /is in the scanned set but does not exist/);
  assert.match(
    problem,
    /update SCANNED_DOCS rather than letting the scanned set shrink silently/,
    "the message must instruct the reader to update the DECLARED set -- not a skip, not a shrunken set, not a pass",
  );

  // Control: every genuinely declared document reads clean, so the plant
  // above is the only absent one and this test cannot pass for the wrong
  // reason (e.g. a broken repoRoot() making everything look missing).
  for (const doc of SCANNED_DOCS) {
    assert.deepEqual(readScannedDoc(doc).problems, [], `${doc} is declared in SCANNED_DOCS and must exist`);
  }
});
